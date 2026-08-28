/**
 * Isomorphic, pure. No node builtins, no secrets, no 'use client'.
 * Imported by browser code, by server code, and directly by scripts/token-roundtrip.mjs.
 */

/** ASCII Unit Separator (U+001F). The invite payload's field delimiter. */
export const FS = '\u001F'

export type InviteFields = {
  v: '1'
  name: string
  role: string
  company: string
  projectSlug: string
  message: string
  /** Absolute expiry, unix SECONDS. */
  exp: number
}

export type TestimonialRecord = {
  id: string
  projectSlug: string
  publishedAt: string
  submittedAt: string
  consent: { version: number; at: string }
  author: { name: string; role: string; company: string; linkedinSlug: string }
  answers: { whatIDid: string; whatChanged: string; hiringManager: string; anythingElse: string }
}

export function b64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/[+]/g, '-').replace(/[/]/g, '_').replace(/=+$/, '')
}

/** Throws on malformed input (atob does). Every caller wraps this in try/catch. */
export function b64urlDecode(s: string): Uint8Array {
  const remainder = s.length % 4
  const padded =
    s.replace(/-/g, '+').replace(/_/g, '/') + (remainder === 0 ? '' : '='.repeat(4 - remainder))
  const binary = atob(padded)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function encodeInviteFields(f: InviteFields): string {
  const parts = [f.v, f.name, f.role, f.company, f.projectSlug, f.message, String(f.exp)]
  for (const part of parts) {
    // Fail loud on the owner's laptop at mint time rather than shipping a token that
    // silently fails arity on decode.
    if (part.includes(FS)) {
      throw new Error('Invite field contains U+001F, the field delimiter. Strip it before minting.')
    }
  }
  return parts.join(FS)
}

export function decodeInviteFields(s: string): InviteFields | null {
  const parts = s.split(FS)
  if (parts.length !== 7) return null
  const [v, name, role, company, projectSlug, message, expRaw] = parts
  if (v !== '1') return null
  if (!/^[0-9]{1,12}$/.test(expRaw)) return null
  const exp = Number(expRaw)
  if (!Number.isSafeInteger(exp) || exp <= 0) return null
  return { v: '1', name, role, company, projectSlug, message, exp }
}

export function splitToken(token: string): { payloadB64: string; sigB64: string } | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts
  if (!/^[A-Za-z0-9_-]+$/.test(payloadB64)) return null
  if (!/^[A-Za-z0-9_-]+$/.test(sigB64)) return null
  return { payloadB64, sigB64 }
}
