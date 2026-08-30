// SERVER ONLY. The admin gate: one password, then a signed session cookie.
//
// The `.ts` extension below is load-bearing: scripts/token-roundtrip.mjs loads this module
// through Node's built-in type stripping, which does NO extension resolution, so './token'
// fails there with ERR_MODULE_NOT_FOUND. tsc accepts the explicit form because tsconfig sets
// allowImportingTsExtensions; elsewhere under src/ keep the extensionless style.
import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { assertSecret } from './token.ts'

if (typeof window !== 'undefined') {
  throw new Error(
    'src/lib/admin-auth.ts is server-only: it reads ADMIN_PASSWORD and signs with MOD_SECRET. ' +
      'A client component must POST to /api/admin/login instead.',
  )
}

export const SESSION_COOKIE = 'admin_session'
/** 30 days, in seconds. Also the cookie's Max-Age. */
export const SESSION_TTL_SECONDS = 2592000

// 24 characters of generated entropy, and it is NOT a stylistic preference: it is what stands in
// for rate limiting. A login endpoint on Vercel has no throttle in front of it, and a
// module-scoped attempt counter is theatre — it resets on every cold start and is not shared
// across concurrent lambdas, so an attacker gets an unlimited, parallel guessing budget either
// way. The only defence left that actually holds is entropy in the secret itself. A generated
// 24-character password is not brute-forceable; a memorable one is, and no counter changes that.
const MIN_PASSWORD_CHARS = 24

// Mirrors the i1 / m1 tags in token.ts. A session token can never be confused with an invite
// token even when both are signed with the same key, because the tag is inside the MAC input.
const SESSION_DOMAIN = 's1'

/**
 * Called at module load, deliberately, exactly as assertSecret is in token.ts: a missing or
 * memorable ADMIN_PASSWORD must break `next build` during "Collecting page data" — the moment
 * any route imports this file — rather than surface as a broken login at 11pm.
 */
function assertAdminPassword(value: string | undefined): string {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_CHARS) {
    throw new Error(
      `ADMIN_PASSWORD is missing, empty, or shorter than ${MIN_PASSWORD_CHARS} characters. ` +
        'It is the whole gate on /admin and there is no rate limiting behind it, so it must be ' +
        'generated, not memorable: node -e "console.log(require(\'node:crypto\')' +
        '.randomBytes(24).toString(\'base64url\'))"',
    )
  }
  return value
}

assertAdminPassword(process.env.ADMIN_PASSWORD)

function sessionMac(expiry: number, secret: string): Buffer {
  return createHmac('sha256', secret).update(`${SESSION_DOMAIN}.${expiry}`, 'utf8').digest()
}

/**
 * `unknown` because the argument comes straight out of `await request.json()`, where a caller
 * can send a number, an array, or nothing at all.
 */
export function checkPassword(supplied: unknown): boolean {
  const expected = Buffer.from(assertAdminPassword(process.env.ADMIN_PASSWORD), 'utf8')
  if (typeof supplied !== 'string') return false
  const given = Buffer.from(supplied, 'utf8')
  // Length check FIRST: timingSafeEqual throws RangeError on unequal-length buffers, which would
  // turn a wrong-length password into a 500 instead of a 401.
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}

/** `<expiryUnixSeconds>.<base64url HMAC-SHA256(MOD_SECRET, "s1." + expiry)>` */
export function mintSession(nowSeconds: number): string {
  const secret = assertSecret('MOD_SECRET', process.env.MOD_SECRET)
  if (!Number.isFinite(nowSeconds) || nowSeconds <= 0) {
    throw new Error(`mintSession needs a positive unix-seconds clock, got ${nowSeconds}`)
  }
  const expiry = Math.floor(nowSeconds) + SESSION_TTL_SECONDS
  return `${expiry}.${sessionMac(expiry, secret).toString('base64url')}`
}

export function verifySession(cookieValue: string | undefined, nowSeconds: number): boolean {
  if (typeof cookieValue !== 'string') return false
  const parts = cookieValue.split('.')
  if (parts.length !== 2) return false
  const [stamp, sigB64] = parts
  if (!/^[0-9]{1,12}$/.test(stamp)) return false
  // Buffer.from(x, 'base64url') silently DROPS characters outside the alphabet instead of
  // throwing, so a shape check has to come first or "!!!!" would decode to an empty buffer.
  if (!/^[A-Za-z0-9_-]+$/.test(sigB64)) return false

  const expiry = Number(stamp)
  if (!Number.isSafeInteger(expiry) || expiry <= 0) return false

  const secret = assertSecret('MOD_SECRET', process.env.MOD_SECRET)
  const given = Buffer.from(sigB64, 'base64url')
  const expected = sessionMac(expiry, secret)
  // Same trap as above: unequal lengths must be a plain false, never a RangeError escaping into
  // a server component and rendering a 500 where a login form belongs.
  if (given.length !== expected.length) return false
  if (!timingSafeEqual(given, expected)) return false

  return expiry > Math.floor(nowSeconds)
}
