// CLIENT SAFE. Imported by /invite and /moderate, both of which are 'use client'.
//
// Nothing here checks a signature, and nothing here can: verifying an HMAC needs the same secret
// that signs it, and a secret shipped to the browser is a secret anyone can mint tokens with. So
// this module decodes for DISPLAY ONLY — to prefill a form and to preview a card. Every value it
// returns is untrusted until a route handler re-verifies the token with src/lib/token.ts.
//
// The `.ts` extension is required because scripts/token-roundtrip.mjs loads this module through
// Node's type stripping, which does no extension resolution.
import { b64urlDecode, decodeInviteFields, splitToken } from './token-types.ts'
import type { InviteFields, TestimonialRecord } from './token-types.ts'

function stripHash(fragment: string): string {
  return fragment.startsWith('#') ? fragment.slice(1) : fragment
}

export function decodeInviteUnverified(fragment: string): InviteFields | null {
  const parts = splitToken(stripHash(fragment))
  if (!parts) return null
  try {
    return decodeInviteFields(new TextDecoder().decode(b64urlDecode(parts.payloadB64)))
  } catch {
    return null
  }
}

export async function decodeModerationUnverified(
  fragment: string,
): Promise<TestimonialRecord | null> {
  const token = new URLSearchParams(stripHash(fragment)).get('t')
  if (!token) return null
  const parts = splitToken(token)
  if (!parts) return null
  // Chrome 80+, Safari 16.4+, Firefox 113+. One known user, on his own phone, with two manual
  // fallbacks in the email itself — so this returns null and the panel shows them.
  if (typeof DecompressionStream === 'undefined') return null
  try {
    // Copied into a fresh Uint8Array rather than handed straight to Blob: since TypeScript 5.7 a
    // Uint8Array carries its buffer type, and b64urlDecode's ArrayBufferLike is not assignable to
    // BlobPart. The copy is a few hundred bytes.
    const compressed = b64urlDecode(parts.payloadB64)
    const bytes = new Uint8Array(compressed.length)
    bytes.set(compressed)
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    const parsed: unknown = JSON.parse(await new Response(stream).text())
    return isTestimonialRecord(parsed) ? parsed : null
  } catch {
    // Not base64url, not gzip, not JSON, or truncated by a mail client — all one outcome: the
    // panel says the link looks damaged. Never an unhandled rejection on a phone.
    return null
  }
}

function str(v: unknown): v is string {
  return typeof v === 'string'
}

function filled(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

// Deliberately duplicated from src/lib/token.ts rather than exported from token-types.ts: the
// interface contract fixes that module's export surface, and this side of the boundary must not
// import the server module. check:tokens pins both copies against the same fixture.
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
