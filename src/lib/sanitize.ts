/**
 * Pure, zero dependencies, no secrets, no node builtins.
 * The entire input-validation surface of the testimonials feature.
 */

export class FieldError extends Error {
  readonly field: string
  constructor(field: string, message: string) {
    super(message)
    this.name = 'FieldError'
    this.field = field
  }
}

export const CAPS = {
  whatIDid: 300,
  whatChanged: 400,
  hiringManager: 400,
  anythingElse: 700,
  name: 80,
  role: 80,
  company: 80,
} as const

const CONTROLS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g
const BIDI = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g

const COMBINING_RUN = /(\p{M}{4})\p{M}+/gu
// Not /g: a global regex carries lastIndex between .test() calls and would alternate true/false.
const IDENTITY_FORBIDDEN = /[^\p{L}\p{M}\p{N} .,'’&()\-\/+]/u

// Lazily constructed, NOT at module scope. src/app/invite/TestimonialForm.tsx imports this
// module, so a module-scope `new Intl.Segmenter(...)` runs the instant the client chunk is
// evaluated — on Firefox < 125, Samsung Internet < 14, older Android WebView, and plausibly
// LinkedIn's in-app browser (exactly where a colleague opens an invite link sent as a LinkedIn
// DM), the constructor throws `TypeError: Intl.Segmenter is not a constructor` at that point,
// the chunk never finishes evaluating, and /invite never hydrates — no error, no fallback, the
// page just sits on "Opening your link…" forever. Deferring construction to first use means the
// throw (if any) happens inside the try/catch below instead of during chunk evaluation.
let segmenter: Intl.Segmenter | null | undefined

function getSegmenter(): Intl.Segmenter | null {
  if (segmenter !== undefined) return segmenter
  try {
    segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
  } catch {
    segmenter = null
  }
  return segmenter
}

export function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROLS, '')
    .replace(BIDI, '')
    .replace(ZERO_WIDTH, '')
    .replace(COMBINING_RUN, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function graphemeCount(input: string): number {
  const seg = getSegmenter()
  if (seg) return Array.from(seg.segment(input)).length
  // Fallback for a browser with no Intl.Segmenter: Array.from(string) counts Unicode code
  // points, not grapheme clusters, so a ZWJ emoji sequence or a stacked combining-mark run
  // counts as several characters instead of one. That makes the cap slightly stricter on such
  // a browser — it can only cause the client to refuse a submission the server (Node >= 22.18,
  // which always has Intl.Segmenter) would accept, never the reverse, since the server-side
  // re-sanitisation in the publish route is what is actually authoritative.
  return Array.from(input).length
}

export function sanitizeAnswer(field: string, value: unknown, cap: number, required = false): string {
  if (value === undefined || value === null) {
    if (required) throw new FieldError(field, 'This one is required.')
    return ''
  }
  if (typeof value !== 'string') throw new FieldError(field, 'Expected text.')
  const clean = normalizeText(value)
  if (clean === '') {
    if (required) throw new FieldError(field, 'This one is required.')
    return ''
  }
  const length = graphemeCount(clean)
  if (length > cap) {
    throw new FieldError(field, `That is ${length - cap} characters too long (limit ${cap}).`)
  }
  return clean
}

export function sanitizeIdentity(field: string, value: unknown, cap: number): string {
  if (typeof value !== 'string') throw new FieldError(field, 'Expected text.')
  const clean = normalizeText(value).replace(/\s+/g, ' ').trim()
  if (clean === '') throw new FieldError(field, 'This one is required.')
  if (IDENTITY_FORBIDDEN.test(clean)) {
    throw new FieldError(field, 'Letters, numbers and . , - / + & ( ) only.')
  }
  const length = graphemeCount(clean)
  if (length > cap) {
    throw new FieldError(field, `That is ${length - cap} characters too long (limit ${cap}).`)
  }
  return clean
}

const LINKEDIN_URL = /linkedin\.com\/in\/([^/?#\s]+)/i
// Real slugs are percent-encoded: this site's own is %C8%99erban-andrei-5a14a51a5.
const SLUG = /^[A-Za-z0-9%_-]{3,60}$/
// The same shape before a browser encoded it — letters in any script, marks, digits, - and _.
// Deliberately excludes '/', ':', '.', whitespace and everything else that could carry URL
// structure, so only a slug that is genuinely just a name gets percent-encoded below.
const DECODED_SLUG = /^[\p{L}\p{M}\p{N}_-]{3,60}$/u

export function extractLinkedinSlug(value: unknown): string {
  if (typeof value !== 'string') throw new FieldError('linkedinSlug', 'Expected text.')
  const trimmed = value.replace(BIDI, '').replace(ZERO_WIDTH, '').trim()
  const matched = LINKEDIN_URL.exec(trimmed)
  const candidate = matched ? matched[1] : trimmed.replace(/^\/+/, '').replace(/\/+$/, '')
  if (SLUG.test(candidate)) return candidate

  // Safari and Firefox show — and copy — the DECODED address, so a colleague whose slug carries a
  // diacritic pastes `linkedin.com/in/șerban-andrei-…` where Chrome would have handed them
  // `%C8%99erban-andrei-…`. Both name the same profile. Refusing the first would turn away much of
  // this site's own audience: Romanian and German names put ș, ț, ă, ö and ü in the slug as a
  // matter of course, and the person would see "paste your profile URL" while looking at a profile
  // URL they had just pasted.
  //
  // Percent-encoding it rather than refusing lands the value in exactly the restricted alphabet
  // SLUG already enforces, so the href the card builds from it is no less constrained than before —
  // the security property is the alphabet, and encoding cannot leave it.
  //
  // Skipped when the candidate already contains a '%': encoding an encoded slug would double it
  // (`%C8%99…` becomes `%25C8%2599…`) and silently produce a link to nothing.
  // Only a candidate that is ALREADY slug-shaped apart from its non-ASCII letters may be encoded.
  // Without this guard `name/with/slashes` encodes to `name%2Fwith%2Fslashes`, which satisfies
  // SLUG and would be accepted — turning input that used to earn a clear error into a link that
  // silently goes nowhere. It cannot leave linkedin.com either way, so this is about not
  // pretending to understand garbage, rather than about safety.
  if (!candidate.includes('%') && DECODED_SLUG.test(candidate)) {
    const encoded = encodeURIComponent(candidate)
    if (SLUG.test(encoded)) return encoded
  }

  throw new FieldError(
    'linkedinSlug',
    'Paste your profile URL, or just the bit after linkedin.com/in/.',
  )
}
