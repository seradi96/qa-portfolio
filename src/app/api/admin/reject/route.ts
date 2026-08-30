// POST /api/admin/reject — admin-moderation design §8.
//
// No `export const runtime` here either: 'nodejs' is the Next 16 default, and 'edge' is
// deprecated and hard-fails the build on node:crypto, which @/lib/token and
// @/lib/admin-auth both use.
//
// Rejection is one delete. There is no publish path in this file, no confirmation write,
// no second store call: the design's whole promise for a rejected submission is that
// nothing of it remains, and every extra step here is another way for that to be
// half-done.

import { deletePending } from '@/lib/pending-store'
import { SESSION_COOKIE, verifySession } from '@/lib/admin-auth'
import { SITE_ORIGIN } from '@/lib/token'

/** The body is `{"id":"<12 characters>"}` — 21 bytes. 1 KiB is many times the largest honest body. */
const MAX_BODY_BYTES = 1024

const ID_RE = /^[A-Za-z0-9_-]{12}$/

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

  // The session, before the body is read. A tampered signature, a rotated MOD_SECRET and
  // an expired stamp are all one answer here.
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
    // An id that is not 12 base64url characters can never name a stored record, and this
    // is the only 404 this route has: a WELL-FORMED id that is already gone is not an
    // error, it is the outcome the owner asked for, and a double tap on a phone must not
    // turn into a red message. Whether an absent file is a silent success is
    // deletePending's business, and this route makes exactly one call into it.
    const id = body.id
    if (!ID_RE.test(id)) {
      return json({ error: 'That submission is no longer in the pending queue.' }, 404)
    }

    await deletePending(id)

    // 204 must carry NO body: `new Response(JSON.stringify(...), { status: 204 })` throws
    // `TypeError: Response constructor: Invalid response status code 204` (verified on
    // Node 24), so this answer cannot go through json().
    return new Response(null, { status: 204 })
  } catch (err) {
    // Name only, never the message: GITHUB_TOKEN must never be logged, and an Error from
    // an HTTP client is exactly where a credential can end up in text.
    console.error('[admin/reject] unhandled:', err instanceof Error ? err.name : typeof err)
    return json({ error: 'Something went wrong on our side.' }, 500)
  }
}
