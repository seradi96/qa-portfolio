// POST /api/admin/login — admin-moderation design §7.
//
// There is deliberately NO `export const runtime` in this file, exactly as in its two
// siblings. 'nodejs' is the Next 16 default, and 'edge' is deprecated there AND
// hard-fails the build the moment anything in the import graph touches node:crypto —
// which @/lib/admin-auth and @/lib/token both do. Adding `export const runtime = 'edge'`
// is the one reflex an experienced Next developer has when they see a route handler.
// Do not.
//
// No rate limiting here, and a module-scoped `Map` of attempts-per-IP is REFUSED rather
// than merely omitted. On Vercel this route runs as a lambda: the Map resets on every
// cold start and is never shared across concurrent invocations, so an attacker spraying
// guesses lands on fresh instances that have never counted anything, while a legitimate
// retry that happens to hit a warm one gets locked out. It reads as protection while
// providing none, and that reading is itself the harm — it invites treating the password
// as throttled when it is not.
//
// The real defence is ADMIN_PASSWORD: a generated value of at least 24 characters, with
// the length asserted at module load in @/lib/admin-auth so a weak one fails the build
// rather than surfacing as a broken login. At 24 random characters the keyspace is not
// brute-forceable at any rate a lambda can serve. A durable limit would need shared state
// (an external KV store), which is a new service and a new dependency this design does
// not take.

import { SESSION_COOKIE, SESSION_TTL_SECONDS, checkPassword, mintSession } from '@/lib/admin-auth'
import { SITE_ORIGIN } from '@/lib/token'

/** `{"password":"<64 characters>"}` is under 100 bytes. 1 KiB is ten times the largest honest body. */
const MAX_BODY_BYTES = 1024

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
 * Returns null when the body is over budget. Counting what actually arrives, chunk by
 * chunk, is what makes a lying Content-Length header unable to force an allocation — the
 * header check alone is advisory.
 *
 * Deliberately duplicated from the other route handlers rather than shared: the interface
 * contract fixes the exported surface of every lib module and this helper is not in it,
 * so it stays module-private in each route that needs it.
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
  // Size gate, before any parsing.
  const declaredLength = req.headers.get('content-length')
  if (declaredLength !== null) {
    const declared = Number(declaredLength)
    if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) {
      return json({ error: 'Request body too large.' }, 413)
    }
  }

  // Origin. A hardcoded module constant, never an env var, so a misconfigured
  // environment cannot widen it and every preview deployment fails closed.
  if (req.headers.get('origin') !== SITE_ORIGIN) {
    return json({ error: 'Requests must come from aserban.ro.' }, 403)
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
    if (body === null) {
      return json({ error: 'Malformed request body.' }, 400)
    }

    // One flat message, and the same one for every failure: wrong password, absent
    // field, a number instead of a string. Anything that varies with what was supplied —
    // 'too short', 'nearly', a different status for a non-string — is a free oracle that
    // tells an attacker which half of the guess to keep. checkPassword takes `unknown`
    // precisely so this route never has to branch on the shape before comparing, and the
    // timing-safe compare lives behind it.
    if (!checkPassword(body.password)) {
      return json({ error: 'That password is not right.' }, 401)
    }

    const value = mintSession(Math.floor(Date.now() / 1000))

    // 204 must carry NO body: `new Response(JSON.stringify(...), { status: 204 })` throws
    // `TypeError: Response constructor: Invalid response status code 204` (verified on
    // Node 24), so this one answer cannot go through json() the way every other one here
    // does. `Secure` is unconditional and correct even in local development, because the
    // Origin check above means this line is only ever reached for a request from
    // https://aserban.ro.
    return new Response(null, {
      status: 204,
      headers: {
        'set-cookie': `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`,
      },
    })
  } catch (err) {
    // Name only, never the message: an Error thrown from a signing path can carry a key
    // in its text, and the design requires the credentials never be logged.
    console.error('[admin/login] unhandled:', err instanceof Error ? err.name : typeof err)
    return json({ error: 'Something went wrong on our side.' }, 500)
  }
}
