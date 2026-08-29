// POST /api/testimonials/submit — spec §7.
//
// There is deliberately NO `export const runtime` in this file. 'nodejs' is the
// default in Next 16, and 'edge' is deprecated there AND hard-fails the build the
// moment anything in the import graph touches node:crypto — which @/lib/token does.
// Adding `export const runtime = 'edge'` is the one reflex an experienced Next
// developer has when they see a route handler. Do not.
//
// No rate limiting and no CAPTCHA here, on purpose. A module-scoped `Map` throttle
// is refused rather than merely omitted: on Vercel this route runs as a lambda that
// resets on every cold start and is never shared across concurrent invocations, so
// a per-process counter would let a burst through on every fresh instance while
// still rejecting a legitimate retry that happens to land on a warm one — it is
// theatre that reads as protection, not protection. The real defenses are the ones
// actually enforced per request below: the Origin check, the invite HMAC (forging
// it requires INVITE_SECRET), the 16 KiB body cap, and the fact that a successful
// POST only ever writes one small file to the owner's own PRIVATE repository, never
// a public write — there is nothing here worth spamming for. A durable rate limit
// would need shared state (e.g. an external KV store), which is a new dependency
// this task is not scoped to add.

import { randomBytes } from 'node:crypto'

import { CONSENT_VERSION } from '@/lib/consent'
import { putPending } from '@/lib/pending-store'
import { isProjectSlug } from '@/lib/projects-meta'
import {
  CAPS,
  FieldError,
  extractLinkedinSlug,
  sanitizeAnswer,
  sanitizeIdentity,
} from '@/lib/sanitize'
import { SITE_ORIGIN, assertSecret, verifyInviteToken } from '@/lib/token'
import type { TestimonialRecord } from '@/lib/token-types'

/** §7 step 1. Roughly 8x the largest legitimate submission at the §5 caps. */
const MAX_BODY_BYTES = 16384

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
 * Reads at most MAX_BODY_BYTES from the request, whatever Content-Length claimed.
 * Returns null when the body is over budget. Counting what actually arrives, chunk
 * by chunk, is what makes a lying Content-Length header unable to force an
 * allocation — the header check alone is advisory.
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

export async function POST(req: Request): Promise<Response> {
  // §7.1 — size gate, before any parsing.
  const declaredLength = req.headers.get('content-length')
  if (declaredLength !== null) {
    const declared = Number(declaredLength)
    if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) {
      return json({ error: 'That submission is too large to accept.' }, 413)
    }
  }

  // §7.2 — Origin. A hardcoded module constant, never an env var, so a
  // misconfigured environment cannot widen it and every preview fails closed.
  if (req.headers.get('origin') !== SITE_ORIGIN) {
    return json({ error: 'Requests must come from aserban.ro.' }, 403)
  }

  try {
    // Read inside the handler, never at module scope: `next build` evaluates route
    // modules, so a module-scope assertSecret would fail the build on any machine
    // without the secrets rather than the request that needs them.
    const inviteSecret = assertSecret('INVITE_SECRET', process.env.INVITE_SECRET)

    const raw = await readBoundedText(req)
    if (raw === null) {
      return json({ error: 'That submission is too large to accept.' }, 413)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return json({ error: 'Malformed request body.' }, 400)
    }
    const body = asObject(parsed)
    if (body === null) {
      return json({ error: 'Malformed request body.' }, 400)
    }

    // §7.3 — verify the i1-domain HMAC. The length check before timingSafeEqual
    // lives in token.ts; without it a wrong-length signature throws RangeError and
    // this becomes a 500 instead of a 403.
    const token = body.token
    if (typeof token !== 'string') {
      return json({ error: 'This link is not valid.' }, 403)
    }
    const invite = verifyInviteToken(token, inviteSecret)
    if (invite === null) {
      return json({ error: 'This link is not valid.' }, 403)
    }

    // §7.4 — expiry. Separate from the signature check so an expired invite gets a
    // human answer instead of looking like a forgery. exp is unix SECONDS.
    if (invite.exp * 1000 < Date.now()) {
      return json(
        {
          error:
            'This invite link has expired. Ask Andrei for a fresh one — andre.serban96@gmail.com.',
        },
        410,
      )
    }

    // §7.5 — sanitize every field. The invite only prefills; the submitted values
    // win, because the form lets the author correct them. sanitizeIdentity,
    // sanitizeAnswer and extractLinkedinSlug throw FieldError, caught below as 422.
    const submittedSlug = body.projectSlug
    if (!isProjectSlug(submittedSlug)) {
      return json({ field: 'projectSlug', message: 'Pick one of the listed projects.' }, 422)
    }

    const name = sanitizeIdentity('name', body.name, CAPS.name)
    const role = sanitizeIdentity('role', body.role, CAPS.role)
    const company = sanitizeIdentity('company', body.company, CAPS.company)
    const linkedinSlug = extractLinkedinSlug(body.linkedinSlug)

    const answersRaw = asObject(body.answers) ?? {}
    const answers = {
      whatIDid: sanitizeAnswer('whatIDid', answersRaw.whatIDid, CAPS.whatIDid),
      whatChanged: sanitizeAnswer('whatChanged', answersRaw.whatChanged, CAPS.whatChanged),
      hiringManager: sanitizeAnswer(
        'hiringManager',
        answersRaw.hiringManager,
        CAPS.hiringManager,
        true,
      ),
      anythingElse: sanitizeAnswer('anythingElse', answersRaw.anythingElse, CAPS.anythingElse),
    }

    // §7.5 — consent must be exactly true. Not truthy: the string "false" is truthy.
    if (body.consent !== true) {
      return json(
        { field: 'consent', message: 'Please tick the consent box before sending.' },
        422,
      )
    }

    // §7.6 — 9 random bytes is exactly 12 base64url characters with no padding.
    // Carried in the payload so publishing is idempotent, and it becomes the git
    // ref `testimonial/<id>`; base64url cannot produce `..` or a trailing `.lock`.
    const now = new Date()
    const day = now.toISOString().slice(0, 10)
    // toISOString() carries milliseconds; §5 stores seconds. '2026-09-13T18:42:07Z'.
    const consentAt = now.toISOString().replace(/\.\d{3}Z$/, 'Z')

    const record: TestimonialRecord = {
      id: randomBytes(9).toString('base64url'),
      projectSlug: submittedSlug,
      // Provisional only. §5: publishedAt is stamped when the pull request is
      // OPENED, so /api/testimonials/publish overwrites this. It exists here so the
      // moderation preview renders a plausible date through the real card.
      publishedAt: day,
      submittedAt: day,
      consent: { version: CONSENT_VERSION, at: consentAt },
      author: { name, role, company, linkedinSlug },
      answers,
    }

    // §7.7 — THE STORE WRITE IS THE COMMIT POINT. It replaces the email send, and
    // inherits its meaning exactly: until this write succeeds the submission exists
    // only in the submitter's own browser, so a failure must never read as success.
    // 503 tells the form to keep every typed answer on screen and offer a retry.
    try {
      await putPending(record)
    } catch (err) {
      // Message, not just name: a bad credential, a rate limit and an outage are three
      // different problems with three different fixes, and a bare catch left no way to
      // tell them apart. What pending-store throws is the GitHub status line plus a
      // truncated response body — the token is a request header and is never echoed
      // back, so this cannot log the credential.
      console.error(
        '[testimonials/submit] pending write failed:',
        err instanceof Error ? err.message : typeof err,
      )
      return json(
        {
          error:
            'Could not save this for Andrei right now. Nothing was lost — please try again in a minute.',
        },
        503,
      )
    }

    return json({ ok: true }, 200)
  } catch (err) {
    if (err instanceof FieldError) {
      return json({ field: err.field, message: err.message }, 422)
    }
    // Name only, never the message: an Error thrown from a signing or HTTP path can
    // carry a key or a token in its text, and §10 requires the credentials never be
    // logged. This endpoint runs ~15 times in its life; under-logging is the right
    // trade for third-party consent data.
    console.error(
      '[testimonials/submit] unhandled:',
      err instanceof Error ? err.name : typeof err,
    )
    return json({ error: 'Something went wrong on our side.' }, 500)
  }
}
