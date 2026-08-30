// CLIENT SAFE. Imported by /invite, which is 'use client'.
//
// Nothing here checks a signature, and nothing here can: verifying an HMAC needs the same secret
// that signs it, and a secret shipped to the browser is a secret anyone can mint tokens with. So
// this module decodes for DISPLAY ONLY — to prefill the form. Every value it returns is untrusted
// until /api/testimonials/submit re-verifies the token with src/lib/token.ts.
//
// The `.ts` extension is required because scripts/token-roundtrip.mjs loads this module through
// Node's type stripping, which does no extension resolution.
import { b64urlDecode, decodeInviteFields, splitToken } from './token-types.ts'
import type { InviteFields } from './token-types.ts'

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
