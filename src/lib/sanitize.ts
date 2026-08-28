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

const GRAPHEMES = new Intl.Segmenter('en', { granularity: 'grapheme' })

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
  return Array.from(GRAPHEMES.segment(input)).length
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

export function extractLinkedinSlug(value: unknown): string {
  if (typeof value !== 'string') throw new FieldError('linkedinSlug', 'Expected text.')
  const trimmed = value.replace(BIDI, '').replace(ZERO_WIDTH, '').trim()
  const matched = LINKEDIN_URL.exec(trimmed)
  const candidate = matched ? matched[1] : trimmed.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!SLUG.test(candidate)) {
    throw new FieldError(
      'linkedinSlug',
      'Paste your profile URL, or just the bit after linkedin.com/in/.',
    )
  }
  return candidate
}
