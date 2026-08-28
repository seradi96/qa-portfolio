// SERVER ONLY. The two token families of the testimonials feature:
//   i1 = invite     — minted by scripts/invite.mjs, consumed by /api/testimonials/submit
//   m1 = moderation — minted by /api/testimonials/submit, consumed by /api/testimonials/publish
//
// The `.ts` extension below is load-bearing: scripts/*.mjs load this module through Node's
// built-in type stripping, which does NO extension resolution, so './token-types' fails there
// with ERR_MODULE_NOT_FOUND. tsc accepts the explicit form because tsconfig sets
// allowImportingTsExtensions; elsewhere under src/ keep the extensionless style.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import {
  b64urlDecode,
  b64urlEncode,
  decodeInviteFields,
  encodeInviteFields,
  splitToken,
} from './token-types.ts'
import type { InviteFields, TestimonialRecord } from './token-types.ts'

if (typeof window !== 'undefined') {
  throw new Error(
    'src/lib/token.ts is server-only: it signs with INVITE_SECRET / MOD_SECRET. A client ' +
      'component must import src/lib/token-client.ts instead.',
  )
}

export const SITE_ORIGIN = 'https://aserban.ro'
export const INVITE_TTL_DAYS = 45
export const MAX_MODERATION_URL_CHARS = 1900

const MIN_SECRET_CHARS = 32
const MAX_RECORD_BYTES = 65536

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
assertSecret('INVITE_SECRET', process.env.INVITE_SECRET)
assertSecret('MOD_SECRET', process.env.MOD_SECRET)

type Domain = 'i1' | 'm1'

function bytesOf(b64: string): Uint8Array | null {
  try {
    return b64urlDecode(b64)
  } catch {
    return null
  }
}

// The domain tag is prefixed to the base64url payload exactly as it travels inside the token, so
// what is verified is byte-for-byte what was transmitted. The tag is what stops an invite token
// from ever verifying as a moderation token, even if both secrets were set to the same value.
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
  // Only the moderation payload is worth compressing.
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

export function signModerationToken(record: TestimonialRecord, secret: string): string {
  assertSecret('MOD_SECRET', secret)
  const gz = gzipSync(Buffer.from(JSON.stringify(record), 'utf8'), { level: 9 })
  return signPayload('m1', b64urlEncode(new Uint8Array(gz)), secret)
}

export function verifyModerationToken(token: string, secret: string): TestimonialRecord | null {
  assertSecret('MOD_SECRET', secret)
  const parts = splitToken(token)
  if (!parts) return null
  if (!signatureMatches('m1', parts.payloadB64, parts.sigB64, secret)) return null
  const parsed = inflate(parts.payloadB64)
  // A valid signature proves we produced the payload, not that it is still well-formed — the
  // shape check below is cheap, and the publish route re-validates every field on top of it.
  return isTestimonialRecord(parsed) ? parsed : null
}

function inflate(payloadB64: string): unknown {
  const bytes = bytesOf(payloadB64)
  if (!bytes) return null
  try {
    // maxOutputLength caps a decompression bomb. The signature already proves this payload is
    // ours, so this only defends against our own future bugs — and it costs one option.
    return JSON.parse(gunzipSync(bytes, { maxOutputLength: MAX_RECORD_BYTES }).toString('utf8'))
  } catch {
    return null
  }
}

function str(v: unknown): v is string {
  return typeof v === 'string'
}

function filled(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function isTestimonialRecord(value: unknown): value is TestimonialRecord {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  if (!filled(r.id) || !filled(r.projectSlug) || !filled(r.publishedAt) || !filled(r.submittedAt)) {
    return false
  }
  if (typeof r.consent !== 'object' || r.consent === null) return false
  const c = r.consent as Record<string, unknown>
  if (typeof c.version !== 'number' || !filled(c.at)) return false
  if (typeof r.author !== 'object' || r.author === null) return false
  const a = r.author as Record<string, unknown>
  if (!filled(a.name) || !str(a.role) || !str(a.company) || !filled(a.linkedinSlug)) return false
  if (typeof r.answers !== 'object' || r.answers === null) return false
  const n = r.answers as Record<string, unknown>
  return str(n.whatIDid) && str(n.whatChanged) && filled(n.hiringManager) && str(n.anythingElse)
}
