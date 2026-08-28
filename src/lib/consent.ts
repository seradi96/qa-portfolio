/**
 * The consent text, verbatim. If a word ever changes, bump CONSENT_VERSION and add
 * CONSENT_TEXT_V2 rather than editing this — git history is the Article 7(1) archive of
 * exactly what a given person agreed to on a given date.
 *
 * Plain TS string, NOT JSX: real apostrophes here. The component that renders it escapes them.
 */

export const CONSENT_VERSION = 1

export const CONSENT_TEXT_V1 =
  "I'm happy for Andrei to publish this on aserban.ro with my name, my role and company at the time we worked together, and my LinkedIn link. I understand the site's source code is public on GitHub, so a published testimonial becomes part of its history. He can fix a typo or trim for length, never change what I meant. I can have it taken down any time by emailing andre.serban96@gmail.com."
