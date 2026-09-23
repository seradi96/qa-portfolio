/**
 * The consent text, verbatim. If a word ever changes, bump CONSENT_VERSION and add the next
 * CONSENT_TEXT_Vn rather than editing an existing one — git history is the Article 7(1) archive
 * of exactly what a given person agreed to on a given date.
 *
 * Plain TS strings, NOT JSX: real apostrophes here. The component that renders one escapes them.
 */

export const CONSENT_VERSION = 2

/** Superseded 2026-09-23. Kept because stored records still carry `consent.version: 1`. */
export const CONSENT_TEXT_V1 =
  "I'm happy for Andrei to publish this on aserban.ro with my name, my role and company at the time we worked together, and my LinkedIn link. I understand the site's source code is public on GitHub, so a published testimonial becomes part of its history. He can fix a typo or trim for length, never change what I meant. I can have it taken down any time by emailing andre.serban96@gmail.com."

/**
 * v2 changes two things, both narrowing what v1 allowed:
 *
 * 1. "and my LinkedIn link" → "and my LinkedIn link if I give one", because the link became
 *    optional and v1 described publishing something a submitter may never give.
 * 2. The editing clause — "He can fix a typo or trim for length, never change what I meant" — is
 *    gone. Andrei publishes or rejects, and never edits. That is not a promise bolted on after
 *    the fact: /api/admin/publish accepts a body of {"id": "…"} and reads the record from the
 *    pending store, so there has never been a code path that could alter a word of it. v1 claimed
 *    a right the system does not implement.
 *
 * Nobody who agreed to v1 is worse off under either change. The one place a published word could
 * still be changed is a hand-edit of src/content/testimonials.json — see CLAUDE.md, where that is
 * now documented as removal only.
 */
export const CONSENT_TEXT_V2 =
  "I'm happy for Andrei to publish this on aserban.ro with my name, my role and company at the time we worked together, and my LinkedIn link if I give one. I understand the site's source code is public on GitHub, so a published testimonial becomes part of its history. He publishes it as I wrote it or not at all. I can have it taken down any time by emailing andre.serban96@gmail.com."

/**
 * What the form must render. Bumping CONSENT_VERSION while the form still imports the previous
 * Vn is the one way the version stamped on a record and the words actually agreed to can quietly
 * disagree — which is precisely the thing the versioning exists to prevent. Import this, not a Vn.
 */
export const CONSENT_TEXT_CURRENT = CONSENT_TEXT_V2
