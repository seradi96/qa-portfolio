// SERVER ONLY. One token family:
//   i1 = invite — minted by scripts/invite.mjs, consumed by /api/testimonials/submit
//
// The m1 moderation family is gone along with the email path (docs/superpowers/specs/
// 2026-08-29-admin-moderation-design.md §3). The admin session cookie is a separate mechanism in
// a separate module — src/lib/admin-auth.ts, domain tag "s1" — which signs with MOD_SECRET and
// calls assertSecret from here.
//
// The `.ts` extension below is load-bearing: scripts/*.mjs load this module through Node's
// built-in type stripping, which does NO extension resolution, so './token-types' fails there
// with ERR_MODULE_NOT_FOUND. tsc accepts the explicit form because tsconfig sets
// allowImportingTsExtensions; elsewhere under src/ keep the extensionless style.
import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  b64urlDecode,
  b64urlEncode,
  decodeInviteFields,
  encodeInviteFields,
  splitToken,
} from './token-types.ts'
import type { InviteFields } from './token-types.ts'

if (typeof window !== 'undefined') {
  throw new Error(
    'src/lib/token.ts is server-only: it signs with INVITE_SECRET. A client component must ' +
      'import src/lib/token-client.ts instead.',
  )
}

export const SITE_ORIGIN = 'https://aserban.ro'
export const INVITE_TTL_DAYS = 45

const MIN_SECRET_CHARS = 32

export function assertSecret(name: string, value: string | undefined): string {
  if (typeof value !== 'string' || value.length < MIN_SECRET_CHARS) {
    throw new Error(
      `${name} is missing, empty, or shorter than ${MIN_SECRET_CHARS} characters. ` +
        'createHmac("sha256", "") returns a perfectly valid digest instead of throwing, so a ' +
        'blank environment variable would leave every token forgeable against a public repo.',
    )
  }
  return value
}

// Called at module load, deliberately: a blank secret must break the deploy, not the first real
// submission six weeks later. Consequence to know about — `next build` evaluates route handler
// modules during "Collecting page data" (verified), so from the moment a route imports this file
// the build needs both variables. Next reads .env.local locally; Vercel injects them in Production.
//
// MOD_SECRET is asserted here even though nothing in THIS file uses it any more. It signs the
// /admin session cookie in src/lib/admin-auth.ts, which calls assertSecret per invocation rather
// than at module scope — so this line is the only thing that turns a missing MOD_SECRET into a
// failed build instead of a failed login at 11pm. admin-auth.ts imports this module, and so does
// the submit route, so the assert runs on every path that could need either value. Do not "tidy"
// it away on the grounds that this file no longer signs with it.
assertSecret('INVITE_SECRET', process.env.INVITE_SECRET)
assertSecret('MOD_SECRET', process.env.MOD_SECRET)

// One member on purpose. The tag stays inside the MAC input so a second family added later can
// never be confused with an invite token — which is exactly how m1 was kept apart, and how
// admin-auth.ts keeps "s1" apart today.
type Domain = 'i1'

function bytesOf(b64: string): Uint8Array | null {
  try {
    return b64urlDecode(b64)
  } catch {
    return null
  }
}

// The domain tag is prefixed to the base64url payload exactly as it travels inside the token, so
// what is verified is byte-for-byte what was transmitted.
function macOf(domain: Domain, payloadB64: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`${domain}.${payloadB64}`, 'utf8').digest()
}

function signPayload(domain: Domain, payloadB64: string, secret: string): string {
  return `${payloadB64}.${b64urlEncode(new Uint8Array(macOf(domain, payloadB64, secret)))}`
}

function signatureMatches(
  domain: Domain,
  payloadB64: string,
  sigB64: string,
  secret: string,
): boolean {
  const given = bytesOf(sigB64)
  if (!given) return false
  const expected = macOf(domain, payloadB64, secret)
  // Length check FIRST: timingSafeEqual throws RangeError on unequal lengths, which would turn a
  // forged signature into a 500 instead of a 403.
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}

export function signInviteToken(fields: InviteFields, secret: string): string {
  assertSecret('INVITE_SECRET', secret)
  // Deliberately NOT gzipped: measured, gzip makes this payload LARGER (174 vs 159 base64url
  // chars), because ~119 bytes of mostly-unique text never earns back gzip's header and CRC.
  const payloadB64 = b64urlEncode(new TextEncoder().encode(encodeInviteFields(fields)))
  return signPayload('i1', payloadB64, secret)
}

export function verifyInviteToken(token: string, secret: string): InviteFields | null {
  assertSecret('INVITE_SECRET', secret)
  const parts = splitToken(token)
  if (!parts) return null
  if (!signatureMatches('i1', parts.payloadB64, parts.sigB64, secret)) return null
  const bytes = bytesOf(parts.payloadB64)
  if (!bytes) return null
  // Expiry is NOT enforced here. The caller has to tell a forged token (403) apart from an honest
  // expired one (410, with the "ask me for a fresh link" message).
  return decodeInviteFields(new TextDecoder().decode(bytes))
}
