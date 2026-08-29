// POST /api/admin/publish — admin-moderation design §8.
//
// No `export const runtime` here either: 'nodejs' is the Next 16 default, and 'edge' is
// deprecated and hard-fails the build on node:crypto, which @/lib/token and
// @/lib/admin-auth both use.
//
// No rate limiting, deliberately. A module-scoped Map throttle is REFUSED rather than
// omitted: on Vercel it resets on every cold start and is not shared across concurrent
// lambdas, so it is theatre that reads as protection. What actually contains this route
// is the session cookie (forging one needs MOD_SECRET), the hardcoded Origin check, and
// the fact that a successful call opens a pull request rather than changing the live site.

import { getPending, deletePending } from '@/lib/pending-store'
import { CONSENT_VERSION } from '@/lib/consent'
import { isProjectSlug } from '@/lib/projects-meta'
import { publishTestimonial, type PublishResult } from '@/lib/publish-to-git'
import {
  CAPS,
  FieldError,
  extractLinkedinSlug,
  sanitizeAnswer,
  sanitizeIdentity,
} from '@/lib/sanitize'
import { SESSION_COOKIE, verifySession } from '@/lib/admin-auth'
import { SITE_ORIGIN } from '@/lib/token'
import type { TestimonialRecord } from '@/lib/token-types'

/** The body is `{"id":"<12 characters>"}` — 21 bytes. 1 KiB is many times the largest honest body. */
const MAX_BODY_BYTES = 1024

const ID_RE = /^[A-Za-z0-9_-]{12}$/
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * Bounded read, byte-counted so a lying Content-Length cannot force an allocation.
 * Deliberately duplicated from the other route handlers rather than shared: the interface
 * contract fixes the exported surface of every lib module and this helper is not in it.
 */
async function readBoundedText(req: Request): Promise<string | null> {
  const stream = req.body
  if (stream === null) return ''
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value === undefined) continue
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const joined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8').decode(joined)
}

/**
 * The session cookie's value, or undefined. Read straight off the Cookie header rather
 * than through `cookies()` from next/headers: these handlers take a plain `Request` and
 * read `req.headers` for everything else, and the async dynamic API would make the
 * handler unusable outside a Next request scope. The value is `<digits>.<base64url>`,
 * which needs no percent-decoding — decoding it would only invent failure modes.
 */
function sessionCookie(req: Request): string | undefined {
  const header = req.headers.get('cookie')
  if (header === null) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== SESSION_COOKIE) continue
    return part.slice(eq + 1).trim()
  }
  return undefined
}

type Revalidated =
  | { ok: true; record: TestimonialRecord }
  | { ok: false; field: string; message: string }

/**
 * Every field goes back through the same sanitiser the submit route used, and the
 * RE-SANITISED values are what get published — never the values that came out of the
 * store. The record has been sitting in the pending store since it was sanitised: it may
 * have been written weeks ago by a previous deploy under different caps, and it is about
 * to be written into a JSON file that ships to production. Having passed validation once
 * is not proof it is still well-formed.
 *
 * Takes `unknown` on purpose: getPending hands back a TestimonialRecord type, but the
 * underlying value came from a JSON file over the network, so the type is an assertion
 * rather than a proof.
 */
function revalidate(input: unknown): Revalidated {
  const rec = asObject(input)
  if (rec === null) return { ok: false, field: 'record', message: 'Malformed record.' }

  const author = asObject(rec.author)
  const answers = asObject(rec.answers)
  const consent = asObject(rec.consent)
  if (author === null || answers === null || consent === null) {
    return { ok: false, field: 'record', message: 'Malformed record.' }
  }

  // The id becomes the git ref `testimonial/<id>`. base64url cannot produce `..` or a
  // trailing `.lock`, but this is where that guarantee is actually enforced.
  const id = rec.id
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    return { ok: false, field: 'id', message: 'Malformed record id.' }
  }

  const projectSlug = rec.projectSlug
  if (!isProjectSlug(projectSlug)) {
    return { ok: false, field: 'projectSlug', message: 'Unknown project.' }
  }

  const submittedAt = rec.submittedAt
  if (typeof submittedAt !== 'string' || !DAY_RE.test(submittedAt)) {
    return { ok: false, field: 'submittedAt', message: 'Malformed submission date.' }
  }

  // A stored record can never carry a consent version we have not written yet.
  const version = consent.version
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1 ||
    version > CONSENT_VERSION
  ) {
    return { ok: false, field: 'consent', message: 'Unknown consent version.' }
  }
  const consentAt = consent.at
  if (typeof consentAt !== 'string' || !ISO_RE.test(consentAt)) {
    return { ok: false, field: 'consent', message: 'Malformed consent timestamp.' }
  }

  try {
    return {
      ok: true,
      record: {
        id,
        projectSlug,
        // Placeholder; the caller stamps the real pull-request-open date.
        publishedAt: submittedAt,
        submittedAt,
        consent: { version, at: consentAt },
        author: {
          name: sanitizeIdentity('name', author.name, CAPS.name),
          role: sanitizeIdentity('role', author.role, CAPS.role),
          company: sanitizeIdentity('company', author.company, CAPS.company),
          linkedinSlug: extractLinkedinSlug(author.linkedinSlug),
        },
        answers: {
          whatIDid: sanitizeAnswer('whatIDid', answers.whatIDid, CAPS.whatIDid),
          whatChanged: sanitizeAnswer('whatChanged', answers.whatChanged, CAPS.whatChanged),
          hiringManager: sanitizeAnswer(
            'hiringManager',
            answers.hiringManager,
            CAPS.hiringManager,
            true,
          ),
          anythingElse: sanitizeAnswer('anythingElse', answers.anythingElse, CAPS.anythingElse),
        },
      },
    }
  } catch (err) {
    if (err instanceof FieldError) {
      return { ok: false, field: err.field, message: err.message }
    }
    throw err
  }
}

export async function POST(req: Request): Promise<Response> {
  // Size gate, before any parsing.
  const declaredLength = req.headers.get('content-length')
  if (declaredLength !== null) {
    const declared = Number(declaredLength)
    if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) {
      return json({ error: 'Request body too large.' }, 413)
    }
  }

  // Origin. A hardcoded module constant, never an env var, so a misconfigured environment
  // cannot widen it and every preview deployment fails closed.
  if (req.headers.get('origin') !== SITE_ORIGIN) {
    return json({ error: 'Requests must come from aserban.ro.' }, 403)
  }

  // The session, before the body is read: an unsigned-in caller gets no work done on its
  // behalf at all. A tampered signature, a rotated MOD_SECRET and an expired stamp are all
  // one answer here — the page turns any 401 into "sign in again", and there is nothing
  // useful to tell apart.
  if (!verifySession(sessionCookie(req), Math.floor(Date.now() / 1000))) {
    return json({ error: 'Sign in again.' }, 401)
  }

  try {
    const raw = await readBoundedText(req)
    if (raw === null) {
      return json({ error: 'Request body too large.' }, 413)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return json({ error: 'Malformed request body.' }, 400)
    }
    const body = asObject(parsed)
    if (body === null || typeof body.id !== 'string') {
      return json({ error: 'Malformed request body.' }, 400)
    }

    // Shape-check the id BEFORE it reaches the store, which interpolates it into a path.
    // An id that is not 12 base64url characters can never name a stored record, so it is
    // the same answer as a record that is not there.
    const id = body.id
    if (!ID_RE.test(id)) {
      return json({ error: 'That submission is no longer in the pending queue.' }, 404)
    }

    let stored: TestimonialRecord | null
    try {
      stored = await getPending(id)
    } catch (err) {
      // A store that cannot be reached is not an empty store. Answering 404 here would
      // tell the owner the submission is gone when it is sitting safely in the repository.
      console.error(
        '[admin/publish] pending store read failed:',
        err instanceof Error ? err.message : typeof err,
      )
      return json(
        { error: 'Could not reach the pending store. Nothing was published — try again.' },
        502,
      )
    }
    if (stored === null) {
      return json({ error: 'That submission is no longer in the pending queue.' }, 404)
    }

    const checked = revalidate(stored)
    if (!checked.ok) {
      return json({ field: checked.field, message: checked.message }, 422)
    }
    const record = checked.record

    // publishedAt is stamped at the moment the pull request is OPENED, not at submit and
    // not at merge. It is a sort key and a display date only.
    record.publishedAt = new Date().toISOString().slice(0, 10)

    // ORDER MATTERS: publish to git FIRST, delete from the pending store SECOND.
    // If the delete fails after a successful publish, the worst case is a pending entry
    // that looks like a duplicate, which the owner can reject by hand — and publishing it
    // twice is absorbed by publishTestimonial's idempotency on record.id anyway.
    // Reversed, a GitHub failure would lose the submission permanently: the pending store
    // is the only place it exists, and there is no email and no other copy to recover from.
    let result: PublishResult
    try {
      result = await publishTestimonial(record)
    } catch (err) {
      // The message from ghError includes status, statusText and the first 500 characters
      // of the response body. None of these ever echo the Authorization header, and
      // Node/undici never surface request headers in error.message. It is the only thing
      // that can distinguish a revoked token (401) from a renamed repo (404) from a
      // network timeout.
      console.error(
        '[admin/publish] github failed:',
        err instanceof Error ? err.message : typeof err,
      )
      return json(
        {
          error:
            'GitHub refused the write. Nothing was published and the submission is still in the queue — try again.',
        },
        502,
      )
    }

    try {
      await deletePending(id)
    } catch (err) {
      // Logged, not fatal, and not a different status: the publish succeeded, and telling
      // the owner it failed would invite a retry that cannot improve anything. The entry
      // reappears on the next refresh of /admin and can be rejected by hand.
      console.error(
        '[admin/publish] pending delete failed after a successful publish:',
        err instanceof Error ? err.message : typeof err,
      )
    }

    // Returned verbatim: the page switches on `status` to pick between the three outcomes
    // (already_published, pr_open, pr_opened), so none of them is an error and none of
    // them is a duplicate.
    return json(result, 200)
  } catch (err) {
    // Name only, never the message: GITHUB_TOKEN must never be logged, and an Error from
    // an HTTP client is exactly where a credential can end up in text.
    console.error('[admin/publish] unhandled:', err instanceof Error ? err.name : typeof err)
    return json({ error: 'Something went wrong on our side.' }, 500)
  }
}
