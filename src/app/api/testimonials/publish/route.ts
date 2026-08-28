// POST /api/testimonials/publish — spec §10 steps 1, 2 and 9.
//
// No `export const runtime` here either: 'nodejs' is the Next 16 default, and
// 'edge' is deprecated and hard-fails the build on node:crypto / node:zlib, both of
// which @/lib/token uses.
//
// No rate limiting and no CAPTCHA, deliberately (§14). A module-scoped Map throttle
// is REFUSED rather than omitted: on Vercel it resets on every cold start and is not
// shared across concurrent lambdas, so it is theatre that reads as protection. The
// containment that does work is that a replayed link opens a pull request, not a
// live change.

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
import { SITE_ORIGIN, assertSecret, verifyModerationToken } from '@/lib/token'
import type { TestimonialRecord } from '@/lib/token-types'

/** The body is one moderation token, itself capped at 1900 URL characters. */
const MAX_BODY_BYTES = 8192

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
 * Deliberately duplicated from the submit route rather than shared: the interface
 * contract fixes the exported surface of every lib module and this helper is not in
 * it, so it stays module-private in both places.
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

type Revalidated =
  | { ok: true; record: TestimonialRecord }
  | { ok: false; field: string; message: string }

/**
 * §10 step 2, the second half. A valid signature proves *we* produced this payload.
 * It does not prove the payload is still well-formed: it may have been signed weeks
 * ago by a previous deploy under previous caps, and it is about to be written into a
 * JSON file that ships to production. So every field goes back through the same
 * sanitiser the submit route used, and the RE-SANITISED values are what get
 * published — never the values that arrived on the wire.
 *
 * Takes `unknown` on purpose: verifyModerationToken hands back a TestimonialRecord
 * type, but the underlying value is whatever JSON was inside the gzip, so the type
 * is an assertion rather than a proof.
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

  // The id becomes the git ref `testimonial/<id>`. base64url cannot produce `..` or
  // a trailing `.lock`, but this is where that guarantee is actually enforced.
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

  // A token can never carry a consent version we have not written yet.
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
  // §10 step 1 — Origin. Hardcoded constant, never an env var. This is layer 3 of
  // §9.1: layer 2 (the capability lives in the URL fragment) is what stops mail
  // scanners, because they never obtain the token at all.
  if (req.headers.get('origin') !== SITE_ORIGIN) {
    return json({ error: 'Requests must come from aserban.ro.' }, 403)
  }

  try {
    const modSecret = assertSecret('MOD_SECRET', process.env.MOD_SECRET)

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
    if (body === null || typeof body.t !== 'string') {
      return json({ error: 'Malformed request body.' }, 400)
    }

    // §10 step 2, first half: length-guarded timingSafeEqual under the m1 domain
    // tag, then gunzip — both inside verifyModerationToken.
    const signed = verifyModerationToken(body.t, modSecret)
    if (signed === null) {
      // Could be either a forged signature or a valid signature with invalid shape.
      // The vague error message is intentional (do not tell a forger which check failed),
      // but the server should log to distinguish them later if needed.
      console.error('[testimonials/publish] verification failed: signature or shape mismatch')
      return json({ error: 'This approval link is not valid.' }, 403)
    }

    const checked = revalidate(signed)
    if (!checked.ok) {
      return json({ field: checked.field, message: checked.message }, 422)
    }
    const record = checked.record

    // §5 — publishedAt is stamped at the moment the pull request is OPENED, not at
    // submit and not at merge. Under §3 decision 2 those can differ by days. It is a
    // sort key and a display date only; nothing anywhere records when a testimonial
    // actually went live, which is why §10.1's copy carries no relative time.
    record.publishedAt = new Date().toISOString().slice(0, 10)

    // §10 steps 3-8 all live in publishTestimonial: read main, idempotency by id and
    // by branch, create the ref, PUT the file with one retry on 409, open the pull
    // request. Its PublishResult is returned verbatim; ModeratePanel switches on
    // `status` to pick between the three §10.1 strings, so none of the three is an
    // error and none is a duplicate.
    let result: PublishResult
    try {
      result = await publishTestimonial(record)
    } catch (err) {
      // The message from ghError includes status, statusText, and response body (first 500
      // chars). None of these ever echo the Authorization header, and Node/undici never
      // surface request headers in error.message. The message is safe to log and is the only
      // thing that can distinguish a revoked token (401) from a renamed repo (404) from a
      // network timeout. See ghError() in src/lib/publish-to-git.ts for the message format.
      console.error(
        '[testimonials/publish] github failed:',
        err instanceof Error ? err.message : typeof err,
      )
      return json(
        {
          error:
            'GitHub refused the write. Nothing was published, and the email still has everything — retry, or use the manual fallback links in it.',
        },
        502,
      )
    }

    return json(result, 200)
  } catch (err) {
    // Name only, never the message: GITHUB_TOKEN must never be logged (§10), and an
    // Error from an HTTP client is exactly where a credential can end up in text.
    console.error(
      '[testimonials/publish] unhandled:',
      err instanceof Error ? err.name : typeof err,
    )
    return json({ error: 'Something went wrong on our side.' }, 500)
  }
}
