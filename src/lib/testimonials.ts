import rawJson from '@/content/testimonials.json'
import type { TestimonialRecord } from '@/lib/token-types'
import { isProjectSlug } from '@/lib/projects-meta'

export type Testimonial = TestimonialRecord

const ID_RE = /^[A-Za-z0-9_-]{12}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
// Matches the slug rule enforced at submit time. A slug, never a URL: it makes a
// phishing href structurally impossible rather than dependent on URL parsing.
const LINKEDIN_SLUG_RE = /^[A-Za-z0-9%_-]{3,60}$/

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isStringMatching(v: unknown, re: RegExp): boolean {
  return typeof v === 'string' && re.test(v)
}

function isNonEmptyString(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Explicit per-field check, no schema library (this feature ships zero new dependencies).
 *
 * All four answer keys must be PRESENT as strings; `""` means "not answered". The publish
 * endpoint always writes all four, so this only bites a hand-edit that deletes a key — and
 * dropping that card is the safe failure, since TestimonialCard calls `.trim()` on each.
 *
 * Field caps are deliberately NOT re-checked here: a hand-trim that lands one grapheme over
 * a cap should still render, not vanish.
 */
export function isTestimonial(value: unknown): value is Testimonial {
  if (!isObject(value)) return false

  if (!isStringMatching(value.id, ID_RE)) return false
  if (!isProjectSlug(value.projectSlug)) return false
  if (!isStringMatching(value.publishedAt, DATE_RE)) return false
  if (!isStringMatching(value.submittedAt, DATE_RE)) return false

  const consent = value.consent
  if (!isObject(consent)) return false
  if (typeof consent.version !== 'number') return false
  if (!Number.isInteger(consent.version) || consent.version < 1) return false
  if (!isStringMatching(consent.at, INSTANT_RE)) return false

  const author = value.author
  if (!isObject(author)) return false
  if (!isNonEmptyString(author.name)) return false
  if (!isNonEmptyString(author.role)) return false
  if (!isNonEmptyString(author.company)) return false
  if (!isStringMatching(author.linkedinSlug, LINKEDIN_SLUG_RE)) return false

  const answers = value.answers
  if (!isObject(answers)) return false
  if (typeof answers.whatIDid !== 'string') return false
  if (typeof answers.whatChanged !== 'string') return false
  if (typeof answers.anythingElse !== 'string') return false
  // The only required answer, and its only rule is "not empty after trim".
  if (!isNonEmptyString(answers.hiringManager)) return false

  return true
}

/** Descending string compare — newest / highest first. */
function descending(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? 1 : -1
}

// Widened to `unknown` on purpose. With an empty `[]` in the JSON, TypeScript infers
// `never[]`, and `never[].filter(<predicate returning `v is Testimonial`>)` is a hard
// compile error ("type predicate's type must be assignable to its parameter's type").
// Going through `unknown` + `Array.isArray` sidesteps that and survives the file being
// empty, populated, or replaced by a non-array by a bad hand-edit.
const rows: unknown = rawJson

const parsed: Testimonial[] = Array.isArray(rows) ? rows.filter(isTestimonial) : []

// Dev-only, so it never ships: a silently vanished card is otherwise very hard to diagnose.
if (process.env.NODE_ENV !== 'production' && Array.isArray(rows) && parsed.length !== rows.length) {
  console.warn(
    `[testimonials] dropped ${rows.length - parsed.length} malformed record(s) from src/content/testimonials.json`
  )
}

// Newest first by publishedAt, ties broken by id so the order is stable across builds.
export const TESTIMONIALS: Testimonial[] = parsed.sort(
  (a, b) => descending(a.publishedAt, b.publishedAt) || descending(a.id, b.id)
)
