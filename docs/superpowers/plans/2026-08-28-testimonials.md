# Testimonials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an invite-only testimonials section on aserban.ro: a former colleague writes via a private signed link, the owner approves from a notification email on his phone, and the approved record lands in the repo as a pull request.

**Architecture:** No database. A testimonial travels as a gzipped, HMAC-signed payload inside a URL fragment; nothing is stored anywhere until the owner taps Publish, at which point one record is committed to `src/content/testimonials.json` on a branch and a pull request is opened. The read path is a plain module import, so the published section is bundled into the build output and survives any external service failing. `src/app/page.tsx` stays a single `'use client'` component and is never restructured.

**Tech Stack:** Next.js 16.2.6 (App Router, Turbopack), React 19.2.6, TypeScript 5.9.3 strict, Tailwind CSS 4.3.0 (CSS-first, no config file), Node 24 (`node:crypto`, `node:zlib`, `Intl.Segmenter`), Resend HTTP API, GitHub REST API. **Zero new npm dependencies.**

**Spec:** `docs/superpowers/specs/2026-08-28-testimonials-design.md` — read it alongside this plan. The plan argues from the spec; where this plan says *why*, the spec says it at length.

## Global Constraints

Every task's requirements implicitly include this section.

- **Zero new npm dependencies.** Not one. If a task seems to need a package, it has drawn its boundary wrong.
- **`src/app/page.tsx` stays `'use client'` and is never renamed or split.** `docs/superpowers/plans/2026-06-27-card-surface-system.md` carries 28 references to it.
- **`react/no-unescaped-entities` is an ESLint *error*.** Every literal apostrophe and quote in JSX text must be `&apos;` / `&quot;`. This plan's prose-heavy tasks show the copy already escaped; paste it as written.
- **Never `export const runtime = 'edge'`.** Deprecated in Next 16 and hard-fails the build on `node:crypto`. `'nodejs'` is the default; do not declare a runtime at all.
- **Never `revalidatePath` / `revalidateTag` / `'use cache'` / `cacheComponents`.** There is no cache-invalidation primitive in this design; publication happens through git and Vercel's normal deploy.
- **`SITE_ORIGIN` is a hardcoded module constant, never an env var.** Consequence: **neither route handler can be exercised under `npm run dev`** — both 403 against localhost. Develop the write path against a preview deployment with the constant temporarily edited in an *uncommitted* working-tree change. Spec §18.4 item 9 is the check that the edit never shipped.
- **The verification gate is `npm run build` && `npm run lint`, both exiting 0**, plus `npm run check:tokens` once it exists. `npm run build` also runs `npm run postbuild` from Task 14 onward.
- **`npm run check:tokens` is the only executable test harness in this repo.** Where it can cover behaviour — codec, crypto, sanitisation, URL budget — TDD is real: write the failing assertion, run it, watch it fail, then implement. Where it cannot — UI, route handlers — the cycle is build + lint plus a *named* manual check. Never record a manual check as a test.
- **Node ≥ 22.18 required** for the harness, which imports `.ts` modules directly via type stripping. Verified working on Node v24.5.0.
- **Field caps, in graphemes:** `whatIDid` 300, `whatChanged` 400, `hiringManager` 400, `anythingElse` 700, and 80 each for name, role, company. Only `hiringManager` is required.
- **Design system:** amber-400/500 accent only; cards `rounded-2xl` on the `.card-surface` glass; `focus:outline-none focus:ring-2 focus:ring-amber-500` on every interactive element; **no cyan** (reserved for AI content), **no emoji**, no `animate-ping/bounce/spin`, no decorative `animate-pulse`.
- **Environment variables** (Vercel, Production only): `INVITE_SECRET`, `MOD_SECRET`, `RESEND_API_KEY`, `GITHUB_TOKEN`. Repo `seradi96/qa-portfolio`; owner `andre.serban96@gmail.com`; Resend sender `onboarding@resend.dev`.

## Task Map

| Task | Deliverable | Automated coverage |
|---|---|---|
| 1 | `token-types.ts`, `projects-meta.ts`, `consent.ts`, the test harness | `check:tokens` — TDD |
| 2 | `sanitize.ts` | `check:tokens` — TDD |
| 3 | `token.ts` — HMAC + gzip, all six spec §18.2 cases | `check:tokens` — TDD |
| 4 | `token-client.ts`, `scripts/invite.mjs`, `.env.local.example`, `.gitignore` | Partial |
| 5 | `testimonials.json`, `testimonials.ts` loader, `globals.css` card classes | Build + grep |
| 6 | `TestimonialCard.tsx` | Build + named manual check |
| 7 | `TestimonialsSection.tsx` + the four `page.tsx` edits + `layout.tsx` `@id` | Build + before/after diff |
| 8 | `notify.ts`, `robots.ts` | None — live rehearsal only |
| 9 | `publish-to-git.ts` | None — live rehearsal only |
| 10 | `POST /api/testimonials/submit` | Build + lint |
| 11 | `POST /api/testimonials/publish` | Build + lint |
| 12 | `/invite` page, layout, form | Manual, on a phone |
| 13 | `/moderate` page, layout, panel | Manual, on a phone |
| 14 | `postbuild-check.mjs`, package scripts, eslint ignores | Self-verifying |
| 15 | `CLAUDE.md`, runbook, card-surface plan re-anchoring | Review |

After Task 15, run the full 12-item live rehearsal in spec §18.4 against an invite minted to yourself, **before any real colleague sees a link**. Items 4, 6, 10 and 11 are the ones that actually bite, and none of them is automatable.

---

### Task 1: Pure foundation and the `check:tokens` harness

**Files:**
- Create: `scripts/token-roundtrip.mjs`
- Create: `src/lib/token-types.ts`
- Create: `src/lib/projects-meta.ts`
- Create: `src/lib/consent.ts`
- Modify: `package.json:8`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `src/lib/token-types.ts` — `FS`, `InviteFields`, `TestimonialRecord`, `b64urlEncode(bytes: Uint8Array): string`, `b64urlDecode(s: string): Uint8Array`, `encodeInviteFields(f: InviteFields): string`, `decodeInviteFields(s: string): InviteFields | null`, `splitToken(token: string): { payloadB64: string; sigB64: string } | null`
  - `src/lib/projects-meta.ts` — `PROJECT_SLUGS`, `ProjectSlug`, `PROJECT_LABELS`, `isProjectSlug(v: unknown): v is ProjectSlug`
  - `src/lib/consent.ts` — `CONSENT_VERSION`, `CONSENT_TEXT_V1`
  - `package.json` — the `check:tokens` script, the only test command in this repo

Why this task exists at all: there is no test runner in this repo, so before any crypto is written we build the ~35-line one that will carry the whole feature. It imports the `.ts` modules **directly** — Node ≥ 22.18 strips TypeScript types on the fly, so there is no build step and no second JS copy of the code under test to drift.

- [ ] **Step 1: Write the test runner with its first tests — codec round trips only**

Create `scripts/token-roundtrip.mjs`. Nothing it imports exists yet; that is the point.

```js
// The only executable test harness in this repo. Zero npm dependencies.
// Run: npm run check:tokens
//
// It imports the .ts modules directly — Node >= 22.18 strips types on the fly, so there is
// no build step and no duplicated JS copy of the code under test.

import { isDeepStrictEqual } from 'node:util'

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(
    `check:tokens imports TypeScript directly and needs Node >= 22.18 (type stripping). Found ${process.versions.node}.`,
  )
  process.exit(1)
}

let passed = 0
let failed = 0

function check(name, fn) {
  try {
    fn()
    passed++
    console.log(`PASS  ${name}`)
  } catch (err) {
    failed++
    console.log(`FAIL  ${name}`)
    console.log(`      ${err instanceof Error ? err.message : String(err)}`)
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

function assertDeepEqual(actual, expected, message) {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(`${message}\n      actual:   ${JSON.stringify(actual)}\n      expected: ${JSON.stringify(expected)}`)
  }
}

// Dynamic, not static: a static import is hoisted above the Node-version guard above,
// so an old Node would die with a parse error instead of the friendly message.
const { FS, b64urlEncode, b64urlDecode, encodeInviteFields, decodeInviteFields, splitToken } =
  await import('../src/lib/token-types.ts')

// --- base64url ---------------------------------------------------------------

check('b64url round trip preserves arbitrary bytes', () => {
  const bytes = new Uint8Array(256)
  for (let i = 0; i < 256; i++) bytes[i] = i
  const back = b64urlDecode(b64urlEncode(bytes))
  assertDeepEqual(Array.from(back), Array.from(bytes), 'bytes changed across the round trip')
})

check('b64url output is URL safe and unpadded', () => {
  const bytes = new Uint8Array([251, 255, 254, 0, 1])
  const encoded = b64urlEncode(bytes)
  assert(/^[A-Za-z0-9_-]+$/.test(encoded), `not URL safe: ${encoded}`)
})

check('b64url round trips every payload length modulo 4', () => {
  for (let n = 1; n <= 8; n++) {
    const bytes = new Uint8Array(n).fill(200)
    const back = b64urlDecode(b64urlEncode(bytes))
    assertDeepEqual(Array.from(back), Array.from(bytes), `length ${n} did not survive`)
  }
})

// --- invite field codec ------------------------------------------------------

const invite = {
  v: '1',
  name: 'Maria Popescu',
  role: 'QA Lead',
  company: 'TOKERO',
  projectSlug: 'tokero',
  message: 'You saw the whole thing from the inside - would you write a few lines?',
  exp: 1801526400,
}

check('invite fields survive encode then decode', () => {
  const decoded = decodeInviteFields(encodeInviteFields(invite))
  assertDeepEqual(decoded, invite, 'invite fields changed across the round trip')
})

check('invite fields survive diacritics and an empty message', () => {
  const withDiacritics = { ...invite, name: 'Andrei Șerban', company: 'Deutsche Bahn', message: '' }
  const decoded = decodeInviteFields(encodeInviteFields(withDiacritics))
  assertDeepEqual(decoded, withDiacritics, 'diacritics or the empty field were mangled')
})

check('encoded payload uses U+001F as the delimiter', () => {
  assert(FS === '\u001F', `FS is ${JSON.stringify(FS)}, expected U+001F`)
  assert(encodeInviteFields(invite).split(FS).length === 7, 'payload is not 7 FS-joined fields')
})

check('wrong arity decodes to null', () => {
  assert(decodeInviteFields(['1', 'a', 'b'].join(FS)) === null, 'three fields should be rejected')
  assert(decodeInviteFields('') === null, 'empty payload should be rejected')
})

check('bad exp decodes to null', () => {
  const bad = ['1', 'A', 'B', 'C', 'tokero', 'msg', 'soon'].join(FS)
  assert(decodeInviteFields(bad) === null, 'non-numeric exp should be rejected')
  const zero = ['1', 'A', 'B', 'C', 'tokero', 'msg', '0'].join(FS)
  assert(decodeInviteFields(zero) === null, 'zero exp should be rejected')
})

check('unknown schema version decodes to null', () => {
  const v2 = ['2', 'A', 'B', 'C', 'tokero', 'msg', '1801526400'].join(FS)
  assert(decodeInviteFields(v2) === null, 'version 2 should be rejected by a v1 decoder')
})

check('a field containing the delimiter throws at mint time', () => {
  let threw = false
  try {
    encodeInviteFields({ ...invite, name: `Maria${FS}Popescu` })
  } catch {
    threw = true
  }
  assert(threw, 'encodeInviteFields accepted a field containing U+001F')
})

// --- token shape -------------------------------------------------------------

check('splitToken accepts payload.sig and rejects everything else', () => {
  assertDeepEqual(splitToken('abc.def'), { payloadB64: 'abc', sigB64: 'def' }, 'valid token misparsed')
  assert(splitToken('abcdef') === null, 'a token with no dot should be rejected')
  assert(splitToken('a.b.c') === null, 'a token with two dots should be rejected')
  assert(splitToken('.def') === null, 'an empty payload should be rejected')
  assert(splitToken('abc.') === null, 'an empty signature should be rejected')
  assert(splitToken('ab+c.def') === null, 'non-base64url characters should be rejected')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
```

- [ ] **Step 2: Add the `check:tokens` script**

Insert one line into `package.json` after `"start"` (line 8). Both `--disable-warning` flags are load-bearing noise suppression, not cosmetics: `ExperimentalWarning` fires on Node 22.x/23.x for type stripping, and `MODULE_TYPELESS_PACKAGE_JSON` fires on every `.ts` import because this `package.json` has no `"type"` field. **Do not add `"type": "module"` to fix the second one** — `next.config.js` is CommonJS and would break.

```json
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "check:tokens": "node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/token-roundtrip.mjs",
    "lint": "eslint",
    "lint:fix": "eslint --fix"
  },
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm run check:tokens`
Expected: exit code 1, and the run dies before any `PASS` line:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/andreiserban/Projects/qa-portfolio/src/lib/token-types.ts' imported from /Users/andreiserban/Projects/qa-portfolio/scripts/token-roundtrip.mjs
```

- [ ] **Step 4: Implement `src/lib/token-types.ts`**

Create the file. It is imported by browser code, server code and the runner, so: **no `node:` builtins, no secrets, no `'use client'`.** `btoa`/`atob` are global in both Node ≥ 16 and every browser, which is why they are used instead of `Buffer`.

```ts
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
```

- [ ] **Step 5: Confirm `FS` is the escape sequence, not a pasted control character**

U+001F is invisible in every editor and diff. If it got pasted literally, the file still works but the source is unreadable and one stray copy-paste later corrupts it silently.

Run: `grep -c "u001F" src/lib/token-types.ts`
Expected: `1`. If it prints `0`, line 7 holds a literal control character — retype it as the six ASCII characters `\u001F`.

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npm run check:tokens`
Expected: exit code 0 and exactly this:

```
PASS  b64url round trip preserves arbitrary bytes
PASS  b64url output is URL safe and unpadded
PASS  b64url round trips every payload length modulo 4
PASS  invite fields survive encode then decode
PASS  invite fields survive diacritics and an empty message
PASS  encoded payload uses U+001F as the delimiter
PASS  wrong arity decodes to null
PASS  bad exp decodes to null
PASS  unknown schema version decodes to null
PASS  a field containing the delimiter throws at mint time
PASS  splitToken accepts payload.sig and rejects everything else

11 passed, 0 failed
```

- [ ] **Step 7: Create `src/lib/projects-meta.ts`**

The single slug allowlist, used by the invite `<select>`, the submit route, and the card. The labels are deliberately short: the real titles in `page.tsx` (lines 67, 144, 231, 270) run to ~90 characters and are unusable in a dropdown on a phone.

```ts
/**
 * The single slug allowlist. Short human labels for the invite form's <select> — the real
 * titles in page.tsx run to ~90 characters and are unusable in a dropdown.
 */

export const PROJECT_SLUGS = [
  'deutsche-bahn',
  'tokero',
  'dentsply-sirona',
  'happy-media',
  'other',
] as const

export type ProjectSlug = (typeof PROJECT_SLUGS)[number]

export const PROJECT_LABELS: Record<ProjectSlug, string> = {
  'deutsche-bahn': 'Deutsche Bahn — SAP ERP railway QA',
  tokero: 'TOKERO — crypto exchange QA platform',
  'dentsply-sirona': 'Dentsply Sirona — medical CAD/CAM QA',
  'happy-media': 'Happy Media — web platform and campaigns',
  other: 'Something else we worked on',
}

export function isProjectSlug(v: unknown): v is ProjectSlug {
  return typeof v === 'string' && (PROJECT_SLUGS as readonly string[]).includes(v)
}
```

- [ ] **Step 8: Create `src/lib/consent.ts`**

Spec §13.2 verbatim. This is a plain TS string, **not** JSX, so it carries real apostrophes — `react/no-unescaped-entities` does not apply here and escaping them would corrupt the legal record. The component that renders it does the escaping.

```ts
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
```

- [ ] **Step 9: Run the full repo gate**

Nothing imports these three modules yet, but `tsconfig.json` includes `**/*.ts`, so `next build` type-checks them anyway. `scripts/**/*.mjs` is outside that include and is not type-checked; ESLint leaves it alone too.

Run: `npm run lint && npm run build`
Expected: `lint` prints only its own npm banner and exits 0. `build` ends with:

```
Route (app)
┌ ○ /
└ ○ /_not-found


○  (Static)  prerendered as static content
```

- [ ] **Step 10: Commit**

```bash
git add scripts/token-roundtrip.mjs src/lib/token-types.ts src/lib/projects-meta.ts src/lib/consent.ts package.json
git commit -m "feat(testimonials): invite field codec, slug allowlist, consent text, check:tokens harness"
```

---

### Task 2: `src/lib/sanitize.ts`, TDD against the runner

**Files:**
- Create: `src/lib/sanitize.ts`
- Modify: `scripts/token-roundtrip.mjs` (append before the trailing summary block)

**Interfaces:**
- Consumes: nothing from Task 1 at runtime — `sanitize.ts` is standalone. It shares only the runner created in Task 1.
- Produces: `src/lib/sanitize.ts` — `FieldError` (with `readonly field: string`), `CAPS`, `normalizeText(input: string): string`, `graphemeCount(input: string): number`, `sanitizeAnswer(field: string, value: unknown, cap: number, required?: boolean): string`, `sanitizeIdentity(field: string, value: unknown, cap: number): string`, `extractLinkedinSlug(value: unknown): string`

This module is the entire input-validation surface of the feature — the submit route calls nothing else before signing. Every rule below comes from spec §7 step 5.

- [ ] **Step 1: Append the sanitize import, the FieldError helper, and the grapheme tests**

In `scripts/token-roundtrip.mjs`, insert this **immediately above** the final two lines (`console.log(...)` / `if (failed > 0) process.exit(1)`).

```js
// --- sanitize ----------------------------------------------------------------

const {
  FieldError,
  CAPS,
  normalizeText,
  graphemeCount,
  sanitizeAnswer,
  sanitizeIdentity,
  extractLinkedinSlug,
} = await import('../src/lib/sanitize.ts')

function assertFieldError(field, fn, message) {
  let caught = null
  try {
    fn()
  } catch (err) {
    caught = err
  }
  assert(caught instanceof FieldError, `${message} — expected a FieldError, got ${caught}`)
  assert(caught.field === field, `${message} — FieldError.field was ${caught.field}, expected ${field}`)
}

// q + combining dot below + combining dot above. No precomposed form, so NFC keeps all three
// code units — .length is 3 per cluster, graphemeCount is 1. That difference is the whole point.
// A ZWJ emoji sequence would NOT work here: U+200D is stripped as a zero-width, by design.
const CLUSTER = 'q' + '\u0323' + '\u0307'

check('graphemeCount counts clusters, not code units', () => {
  const hundred = CLUSTER.repeat(100)
  assert(hundred.length === 300, `expected .length 300, got ${hundred.length}`)
  assert(graphemeCount(hundred) === 100, `expected 100 graphemes, got ${graphemeCount(hundred)}`)
})

check('caps are enforced in graphemes, not code units', () => {
  const hundred = CLUSTER.repeat(100)
  assert(
    sanitizeAnswer('whatIDid', hundred, 100) === hundred,
    '100 clusters should fit a cap of 100 even though .length is 300',
  )
  assertFieldError('whatIDid', () => sanitizeAnswer('whatIDid', hundred, 99), '101st grapheme')
})
```

- [ ] **Step 2: Append the stripping tests**

Directly after the block from Step 1, still above the summary lines.

```js
check('bidi controls are stripped', () => {
  const attack = 'Maria' + '\u202E' + 'Popescu' + '\u202C'
  assert(normalizeText(attack) === 'MariaPopescu', `bidi survived: ${JSON.stringify(normalizeText(attack))}`)
  assert(sanitizeIdentity('name', attack, CAPS.name) === 'MariaPopescu', 'bidi survived sanitizeIdentity')
})

check('zero-width characters are stripped', () => {
  const sneaky = 'TO' + '\u200B' + 'KE' + '\u200D' + 'RO' + '\uFEFF'
  assert(normalizeText(sneaky) === 'TOKERO', `zero-widths survived: ${JSON.stringify(normalizeText(sneaky))}`)
})

check('C0 controls go, single newlines stay, runs collapse', () => {
  assert(normalizeText('a' + '\u0000' + 'b' + '\u0007' + 'c') === 'abc', 'C0 controls survived')
  assert(normalizeText('one' + '\n' + 'two') === 'one' + '\n' + 'two', 'a single newline was eaten')
  assert(normalizeText('one' + '\n'.repeat(5) + 'two') === 'one' + '\n' + '\n' + 'two', 'newline run not collapsed to two')
  assert(normalizeText('one' + '\r' + '\n' + 'two') === 'one' + '\n' + 'two', 'CRLF not normalised')
})

check('combining-mark runs are capped at four', () => {
  // 'q' has no precomposed form with a dot below, so NFC cannot swallow the first mark.
  const zalgo = 'q' + '\u0323'.repeat(30)
  const out = normalizeText(zalgo)
  assert(out === 'q' + '\u0323'.repeat(4), `expected 4 marks, got ${out.length - 1}`)
})
```

- [ ] **Step 3: Append the required-field, identity-allowlist and LinkedIn tests**

Directly after Step 2's block, still above the summary lines. These four LinkedIn shapes are exactly the ones a colleague will paste.

```js
check('an empty required answer is rejected, an empty optional one is not', () => {
  assertFieldError('hiringManager', () => sanitizeAnswer('hiringManager', '   ', CAPS.hiringManager, true), 'blank required')
  assertFieldError('hiringManager', () => sanitizeAnswer('hiringManager', undefined, CAPS.hiringManager, true), 'missing required')
  assert(sanitizeAnswer('anythingElse', '', CAPS.anythingElse) === '', 'blank optional should return an empty string')
  assert(sanitizeAnswer('anythingElse', undefined, CAPS.anythingElse) === '', 'missing optional should return an empty string')
})

check('identity fields accept real names and reject markup', () => {
  assert(sanitizeIdentity('name', '  Andrei  Serban ', CAPS.name) === 'Andrei Serban', 'inner whitespace not collapsed')
  assert(sanitizeIdentity('company', 'S.C. Happy Media & Co (RO)', CAPS.company) === 'S.C. Happy Media & Co (RO)', 'legal name rejected')
  assert(sanitizeIdentity('role', 'QA Lead / Test Architect', CAPS.role) === 'QA Lead / Test Architect', 'slash rejected')
  assertFieldError('name', () => sanitizeIdentity('name', 'Maria <script>', CAPS.name), 'angle brackets')
  assertFieldError('name', () => sanitizeIdentity('name', 'maria@example.com', CAPS.name), 'at sign')
  assertFieldError('name', () => sanitizeIdentity('name', '   ', CAPS.name), 'blank identity')
})

check('extractLinkedinSlug handles a full https URL', () => {
  assert(
    extractLinkedinSlug('https://www.linkedin.com/in/maria-popescu-8a41b2') === 'maria-popescu-8a41b2',
    'https www URL not reduced to a slug',
  )
})

check('extractLinkedinSlug handles a bare host with a trailing slash', () => {
  assert(
    extractLinkedinSlug('linkedin.com/in/maria-popescu-8a41b2/') === 'maria-popescu-8a41b2',
    'schemeless URL with a trailing slash not reduced to a slug',
  )
})

check('extractLinkedinSlug handles a country subdomain with tracking params', () => {
  assert(
    extractLinkedinSlug('https://ro.linkedin.com/in/%C8%99erban-andrei-5a14a51a5?trk=x') ===
      '%C8%99erban-andrei-5a14a51a5',
    'percent-encoded slug behind a subdomain and a query string was mangled',
  )
})

check('extractLinkedinSlug passes a bare slug through', () => {
  assert(extractLinkedinSlug('maria-popescu-8a41b2') === 'maria-popescu-8a41b2', 'bare slug rejected')
  assert(extractLinkedinSlug('  maria-popescu-8a41b2  ') === 'maria-popescu-8a41b2', 'padded bare slug rejected')
})

check('extractLinkedinSlug refuses anything that is not a LinkedIn profile', () => {
  assertFieldError('linkedinSlug', () => extractLinkedinSlug('https://evil.example.com/in/maria'), 'foreign host')
  assertFieldError('linkedinSlug', () => extractLinkedinSlug('javascript:alert(1)'), 'javascript URL')
  assertFieldError('linkedinSlug', () => extractLinkedinSlug('ab'), 'too short')
  assertFieldError('linkedinSlug', () => extractLinkedinSlug('x'.repeat(61)), 'too long')
  assertFieldError('linkedinSlug', () => extractLinkedinSlug(42), 'not a string')
})
```

- [ ] **Step 4: Run the tests and watch them fail**

Run: `npm run check:tokens`
Expected: exit code 1. The eleven Task 1 tests do not even print, because the failing dynamic `import()` aborts the module before any `check()` runs:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/andreiserban/Projects/qa-portfolio/src/lib/sanitize.ts' imported from /Users/andreiserban/Projects/qa-portfolio/scripts/token-roundtrip.mjs
```

- [ ] **Step 5: Implement `src/lib/sanitize.ts`**

Create the file exactly as below. Three notes where a choice looks arbitrary:
`\p{...}` regex literals compile fine under this repo's `target: ES2017` (verified with `tsc`) — no `new RegExp` workaround and no tsconfig change is needed. `\u200D` (ZWJ) is stripped as a zero-width per spec §7 step 5, which does break ZWJ emoji sequences; that is intended. `IDENTITY_FORBIDDEN` is deliberately **not** `/g`, because a global regex's `lastIndex` makes repeated `.test()` calls return alternating answers.

```ts
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
  anythingElse: 550,
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
```

- [ ] **Step 6: Confirm the four unicode escapes survived typing**

Run: `grep -c 'u0000\|u200E\|u200B\|uFEFF' src/lib/sanitize.ts`
Expected: `3` (lines 24, 25, 26). If it prints less, a control character was pasted literally instead of the escape sequence — retype those three regex constants.

- [ ] **Step 7: Run the tests and watch them pass**

Run: `npm run check:tokens`
Expected: exit code 0, all Task 1 lines still passing, and:

```
PASS  graphemeCount counts clusters, not code units
PASS  caps are enforced in graphemes, not code units
PASS  bidi controls are stripped
PASS  zero-width characters are stripped
PASS  C0 controls go, single newlines stay, runs collapse
PASS  combining-mark runs are capped at four
PASS  an empty required answer is rejected, an empty optional one is not
PASS  identity fields accept real names and reject markup
PASS  extractLinkedinSlug handles a full https URL
PASS  extractLinkedinSlug handles a bare host with a trailing slash
PASS  extractLinkedinSlug handles a country subdomain with tracking params
PASS  extractLinkedinSlug passes a bare slug through
PASS  extractLinkedinSlug refuses anything that is not a LinkedIn profile

24 passed, 0 failed
```

- [ ] **Step 8: Run the full repo gate**

Run: `npm run lint && npm run build`
Expected: `lint` exits 0 with no output beyond its npm banner. `build` ends with `Route (app) ┌ ○ / └ ○ /_not-found` and `○ (Static) prerendered as static content`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/sanitize.ts scripts/token-roundtrip.mjs
git commit -m "feat(testimonials): input sanitisation with grapheme caps and LinkedIn slug extraction"
```

---

### Task 3: Server crypto — sign and verify the two token families

**Files:**
- Create: `src/lib/token.ts`
- Modify: `tsconfig.json:16`
- Modify: `scripts/token-roundtrip.mjs` (created by the earlier primitives task; this task appends one section above its summary lines)

**Interfaces:**
- Consumes: `b64urlEncode`, `b64urlDecode`, `encodeInviteFields`, `decodeInviteFields`, `splitToken`, `InviteFields`, `TestimonialRecord` from `src/lib/token-types.ts`; `CAPS` from `src/lib/sanitize.ts` (used by the URL-budget check only)
- Produces: `SITE_ORIGIN`, `INVITE_TTL_DAYS`, `MAX_MODERATION_URL_CHARS`, `assertSecret(name: string, value: string | undefined): string`, `signInviteToken(fields: InviteFields, secret: string): string`, `verifyInviteToken(token: string, secret: string): InviteFields | null`, `signModerationToken(record: TestimonialRecord, secret: string): string`, `verifyModerationToken(token: string, secret: string): TestimonialRecord | null`

- [ ] **Step 1: Allow `.ts` import specifiers so a `.mjs` script can load a `.ts` module**

`scripts/token-roundtrip.mjs` imports the modules under test directly — Node ≥ 22.18 strips types on the fly, so there is no build step and no duplicated JS copy that can drift. But Node's ESM resolver does **no** extension resolution: verified on this machine (Node 24.5.0), `import './token-types'` inside a `.ts` file fails with `ERR_MODULE_NOT_FOUND`, `'./token-types.js'` also fails, and only `'./token-types.ts'` resolves. tsc rejects that spelling as `TS5097` unless the flag below is on. Turbopack resolves it either way (verified with a real `next build`).

Add one line to `tsconfig.json`, immediately after `"resolveJsonModule": true,` (line 16):

```json
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
```

The flag only *permits* the explicit form; every existing extensionless import in `src/` keeps working. It requires `noEmit: true`, which `tsconfig.json:12` already sets. Rule for the rest of the feature: **a module under `src/lib/` that `check:tokens` imports uses explicit `.ts` specifiers; everything else stays extensionless.**

- [ ] **Step 2: Write the six failing assertions**

First add `randomBytes` to the imports at the top of `scripts/token-roundtrip.mjs`, beside the existing `node:util` import:

```js
import { isDeepStrictEqual } from 'node:util'
import { randomBytes } from 'node:crypto'
```

Then paste the whole block below into `scripts/token-roundtrip.mjs` **immediately above its final two lines**, which read:

```js
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
```

The six cases go in as one block because they share a single `await import()` of the module under test; there is no way to make case 2 red while case 1 is green without stubbing the module, and a stub is worse than a block. All six are written before `src/lib/token.ts` exists.

```js
// --- token crypto ------------------------------------------------------------
// src/lib/token.ts asserts both secrets at module load, so they must exist before the dynamic
// import below. These are test values; they never leave this file and are not the real secrets.
const INVITE_SECRET = 'check-tokens-invite-secret-0123456789'
const MOD_SECRET = 'check-tokens-moderation-secret-0123456789'
process.env.INVITE_SECRET = INVITE_SECRET
process.env.MOD_SECRET = MOD_SECRET

const {
  SITE_ORIGIN,
  INVITE_TTL_DAYS,
  MAX_MODERATION_URL_CHARS,
  assertSecret,
  signInviteToken,
  verifyInviteToken,
  signModerationToken,
  verifyModerationToken,
} = await import('../src/lib/token.ts')

const invite = {
  v: '1',
  name: 'Maria Popescu',
  role: 'QA Lead',
  company: 'TOKERO',
  projectSlug: 'tokero',
  message: 'You saw the whole thing from the inside - would you write a few lines?',
  exp: 1801526400,
}

const record = {
  id: 'aB3xK9pQr7Zt',
  projectSlug: 'tokero',
  publishedAt: '2026-09-14',
  submittedAt: '2026-09-13',
  consent: { version: 1, at: '2026-09-13T18:42:07Z' },
  author: {
    name: 'Maria Popescu',
    role: 'QA Lead',
    company: 'TOKERO',
    linkedinSlug: 'maria-popescu-8a41b2',
  },
  answers: {
    whatIDid: 'He owned the end-to-end suite.',
    whatChanged: 'Regression went from two days of clicking to an overnight run.',
    hiringManager: 'I would work with him again. He pushes back when the plan is wrong.',
    anythingElse: '',
  },
}

// 1 — round trip
check('invite and moderation tokens survive a full round trip', () => {
  assertDeepEqual(
    verifyInviteToken(signInviteToken(invite, INVITE_SECRET), INVITE_SECRET),
    invite,
    'invite round trip lost data',
  )
  assertDeepEqual(
    verifyModerationToken(signModerationToken(record, MOD_SECRET), MOD_SECRET),
    record,
    'moderation round trip lost data',
  )
  assert(SITE_ORIGIN === 'https://aserban.ro', 'SITE_ORIGIN is not the hardcoded production origin')
  assert(INVITE_TTL_DAYS === 45, `INVITE_TTL_DAYS is ${INVITE_TTL_DAYS}, expected 45`)
})

// 2 — tamper must fail
check('a single flipped payload byte fails verification', () => {
  for (const [label, token, secret, verify] of [
    ['invite', signInviteToken(invite, INVITE_SECRET), INVITE_SECRET, verifyInviteToken],
    ['moderation', signModerationToken(record, MOD_SECRET), MOD_SECRET, verifyModerationToken],
  ]) {
    const [payload, sig] = token.split('.')
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    const at = Math.floor(payload.length / 2)
    const swapped = alphabet[(alphabet.indexOf(payload[at]) + 1) % alphabet.length]
    const tampered = `${payload.slice(0, at)}${swapped}${payload.slice(at + 1)}.${sig}`
    assert(tampered !== token, `${label}: the tamper did not change the token`)
    assert(verify(tampered, secret) === null, `${label}: a tampered payload verified`)
  }
})

// 3 — wrong domain must fail
check('a token signed under i1 never verifies under m1', () => {
  assert(
    verifyModerationToken(signInviteToken(invite, MOD_SECRET), MOD_SECRET) === null,
    'an i1 token verified as m1',
  )
  assert(
    verifyInviteToken(signModerationToken(record, INVITE_SECRET), INVITE_SECRET) === null,
    'an m1 token verified as i1',
  )
})

// 4 — empty secret must throw
check('an empty, short or missing secret throws', () => {
  for (const bad of [undefined, '', 'short', 'x'.repeat(31)]) {
    let threw = false
    try {
      assertSecret('INVITE_SECRET', bad)
    } catch {
      threw = true
    }
    assert(threw, `assertSecret accepted ${JSON.stringify(bad)}`)
  }
  assert(
    assertSecret('INVITE_SECRET', 'y'.repeat(32)) === 'y'.repeat(32),
    'a 32-character secret was rejected',
  )
  let signThrew = false
  try {
    signInviteToken(invite, '')
  } catch {
    signThrew = true
  }
  assert(signThrew, 'signInviteToken signed with an empty secret')
})

// 5 — wrong-length signature must be null, not RangeError
check('a wrong-length signature returns null instead of throwing RangeError', () => {
  const [payload] = signInviteToken(invite, INVITE_SECRET).split('.')
  for (const sig of ['A', 'AA', 'A'.repeat(43), 'A'.repeat(86)]) {
    let result
    try {
      result = verifyInviteToken(`${payload}.${sig}`, INVITE_SECRET)
    } catch (err) {
      throw new Error(`verifyInviteToken threw on a ${sig.length}-char signature: ${err}`)
    }
    assert(result === null, `a ${sig.length}-char signature verified`)
  }
})

// 6 — URL budget
// Caps are read from CAPS, never retyped: raising a cap must move these numbers.
const { CAPS } = await import('../src/lib/sanitize.ts')

const PROSE = {
  whatIDid:
    'He owned the end-to-end suite from the first spec through to the pipeline that ran it, and he was the person we pinged when a build went red at six in the evening. He wrote the framework, reviewed our page objects, and taught two of us how to debug a flaky test without guessing at it.',
  whatChanged:
    'Regression used to eat two days of manual clicking before every release and we still shipped with our fingers crossed. After his framework landed it ran overnight on every merge, we saw failures at nine in the morning with a trace attached, and the release meeting stopped being an argument about whether anyone had actually tested the payment flow properly on a real device this time.',
  hiringManager:
    'I would work with him again without thinking about it. He will push back if he believes the plan is wrong, which is exactly what you want from someone who owns quality, and he does it with evidence in hand rather than an opinion. He is also the rare automation engineer who writes documentation that other people on the team can actually follow a year later without asking him.',
  anythingElse:
    'The thing I remember is the week the payment provider changed a response field without telling anyone. His suite caught it in the overnight run, he had the failing trace and a one paragraph explanation in our channel before the standup, and the fix shipped that afternoon instead of being discovered by a customer. Nobody outside the team ever knew. He also refused to let us mark that test as flaky and skip it, which in hindsight is the only reason it was still running at all. That is the part people miss about test automation: the value is not the tests you write, it is the ones you keep honest for two years after everybody who first wrote them has moved on to some other team.',
}

const toCap = (text, cap) => (text.length >= cap ? text.slice(0, cap) : `${text} ${text}`.slice(0, cap))
const noise = (n) => randomBytes(n * 2).toString('base64').replace(/[+/=]/g, 'A').slice(0, n)

function moderationUrlFor(answers, author) {
  const token = signModerationToken({ ...record, answers, author }, MOD_SECRET)
  return `${SITE_ORIGIN}/moderate#a=publish&t=${token}`
}

const naturalUrl = moderationUrlFor(
  {
    whatIDid: toCap(PROSE.whatIDid, CAPS.whatIDid),
    whatChanged: toCap(PROSE.whatChanged, CAPS.whatChanged),
    hiringManager: toCap(PROSE.hiringManager, CAPS.hiringManager),
    anythingElse: toCap(PROSE.anythingElse, CAPS.anythingElse),
  },
  {
    name: toCap('Maria Alexandra Popescu-Ionescu', CAPS.name),
    role: toCap('Senior Quality Assurance Engineer, Payments', CAPS.role),
    company: toCap('Deutsche Bahn Vertrieb GmbH', CAPS.company),
    linkedinSlug: 'maria-popescu-8a41b2',
  },
)

const noiseUrl = moderationUrlFor(
  {
    whatIDid: noise(CAPS.whatIDid),
    whatChanged: noise(CAPS.whatChanged),
    hiringManager: noise(CAPS.hiringManager),
    anythingElse: noise(CAPS.anythingElse),
  },
  {
    name: noise(CAPS.name),
    role: noise(CAPS.role),
    company: noise(CAPS.company),
    linkedinSlug: noise(60),
  },
)

console.log(
  `      URL budget ${MAX_MODERATION_URL_CHARS}: natural language at every cap = ${naturalUrl.length} chars ` +
    `(${MAX_MODERATION_URL_CHARS - naturalUrl.length} spare), incompressible at every cap = ${noiseUrl.length} chars`,
)

check('natural-language answers at every cap fit the moderation URL', () => {
  assert(
    naturalUrl.length <= MAX_MODERATION_URL_CHARS,
    `natural-language worst case is ${naturalUrl.length} chars, over the ${MAX_MODERATION_URL_CHARS} budget. Lower a cap in CAPS, or raise MAX_MODERATION_URL_CHARS knowing Outlook truncates around 2000.`,
  )
})

check('incompressible answers at every cap overflow the budget, which is what the 413 is for', () => {
  assert(
    noiseUrl.length > MAX_MODERATION_URL_CHARS,
    `incompressible worst case now fits (${noiseUrl.length} chars). Caps must have been lowered — /api/testimonials/submit can drop its 413 branch, and this check should be deleted with it.`,
  )
})
```

**Read this before you run it.** Spec §18.2 item 6 says the pathological incompressible payload measures 928 chars. That number is wrong, and the plan does not repeat it. Measured on this machine at the contract's caps: natural English filling every field to its cap produces a **1663-char** URL (237 spare), and random base64 filling every field produces **~2508 chars**, which does *not* fit. Gzip buys generous caps for prose, not for adversarial input — which is exactly why `/api/testimonials/submit` has a 413 branch. Both facts are asserted so neither can rot: raise a cap and the first check goes red; lower caps far enough that the 413 becomes dead code and the second goes red telling you to delete it.

- [ ] **Step 3: Run the six new assertions and watch them fail**

Run: `npm run check:tokens`
Expected: the checks from the earlier tasks print `PASS`, then the process dies before any of the six new ones run, because the module under test does not exist yet — no summary line is printed:

```
node:internal/process/esm_loader ...
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/andreiserban/Projects/qa-portfolio/src/lib/token.ts' imported from /Users/andreiserban/Projects/qa-portfolio/scripts/token-roundtrip.mjs
```

Exit code 1.

- [ ] **Step 4: Write `src/lib/token.ts`**

```ts
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
```

- [ ] **Step 5: Run the assertions and watch all six pass**

Run: `npm run check:tokens`
Expected: the earlier checks still pass, and these seven lines appear (case 6 lands as two checks plus the measurement line), with `0 failed` in the summary:

```
PASS  invite and moderation tokens survive a full round trip
PASS  a single flipped payload byte fails verification
PASS  a token signed under i1 never verifies under m1
PASS  an empty, short or missing secret throws
PASS  a wrong-length signature returns null instead of throwing RangeError
      URL budget 1900: natural language at every cap = 1663 chars (237 spare), incompressible at every cap = 2508 chars
PASS  natural-language answers at every cap fit the moderation URL
PASS  incompressible answers at every cap overflow the budget, which is what the 413 is for
```

`1663` and `237` are exact and deterministic. The incompressible figure moves a handful of characters run to run because the fixture is random; anything in the 2,490–2,530 range is the same result.

- [ ] **Step 6: Confirm the repo gate is still green**

Run: `npm run build && npm run lint`
Expected: build finishes with the route table showing `○ /` and `○ /_not-found` only, and `lint` prints nothing and exits 0. Nothing under `src/app/` imports `token.ts` yet, so the module-load secret assertion is not reached during this build — that changes in the route-handler task, which is why the next task creates `.env.local`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/token.ts scripts/token-roundtrip.mjs tsconfig.json
git commit -m "feat(testimonials): domain-tagged HMAC signing for invite and moderation tokens"
```

### Task 4: Client-side decoding, the invite minter, and the env files

**Files:**
- Create: `src/lib/token-client.ts`
- Create: `scripts/invite.mjs`
- Create: `.env.local.example`
- Create: `.env.local` (local only — stays untracked)
- Modify: `.gitignore:34`
- Modify: `package.json:8`
- Modify: `scripts/token-roundtrip.mjs`

**Interfaces:**
- Consumes: `b64urlDecode`, `decodeInviteFields`, `splitToken`, `InviteFields`, `TestimonialRecord` from `src/lib/token-types.ts`; `SITE_ORIGIN`, `INVITE_TTL_DAYS`, `signInviteToken`, `verifyInviteToken`, `signModerationToken` from `src/lib/token.ts`; `PROJECT_SLUGS`, `PROJECT_LABELS`, `isProjectSlug` from `src/lib/projects-meta.ts`
- Produces: `decodeInviteUnverified(fragment: string): InviteFields | null`, `decodeModerationUnverified(fragment: string): Promise<TestimonialRecord | null>`; the `npm run invite` script

- [ ] **Step 1: Write `.env.local.example` and prove git refuses to track it**

```bash
cat > .env.local.example <<'EOF'
# Copy to .env.local and fill in. .env.local is never committed; this example is, which is why
# .gitignore carries a `!.env.local.example` negation right under the `.env*` line.
#
# The same four names must exist in Vercel, Production environment ONLY — never Preview, because
# a preview deployment that could mint tokens would defeat the hardcoded Origin check.
#
# Generate a secret:  node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"

# HMAC key for i1 invite tokens. Minimum 32 characters — src/lib/token.ts refuses to load below
# that, because createHmac('sha256', '') returns a valid digest instead of throwing.
INVITE_SECRET=

# HMAC key for m1 moderation tokens. Different value from INVITE_SECRET. Rotating this kills every
# outstanding approve/discard link; rotating INVITE_SECRET kills every outstanding invite.
MOD_SECRET=

# Resend API key. The sender is onboarding@resend.dev, whose sandbox can only deliver to the
# Resend account's own signup address — andre.serban96@gmail.com. No DNS records, ever.
RESEND_API_KEY=

# Fine-grained GitHub PAT for seradi96/qa-portfolio ONLY: Contents Read & Write, Pull requests
# Read & Write, nothing else. Never logged. Revoke first if anything looks wrong.
GITHUB_TOKEN=
EOF
git check-ignore -v .env.local.example
```

Expected: git reports the file as ignored by the bare `.env*` pattern, so `git add -A` would skip it silently and an explicit `git add` would refuse it:

```
.gitignore:34:.env*	.env.local.example
```

- [ ] **Step 2: Add the negation to `.gitignore`**

Insert one line immediately after line 34 (`.env*`), so the block reads:

```
# env files (can opt-in for committing if needed)
.env*
!.env.local.example
```

- [ ] **Step 3: Prove the negation worked and that real secrets are still ignored**

Run:

```bash
git check-ignore .env.local.example; echo "check-ignore exit=$?"
git add -n .env.local.example
printf 'INVITE_SECRET=placeholder\n' > .env.local && git add -n .env.local
```

Expected — the example is now trackable and `.env.local` still is not:

```
check-ignore exit=1
add '.env.local.example'
The following paths are ignored by one of your .gitignore files:
.env.local
hint: Use -f if you really want to add them.
```

Use plain `git check-ignore` here rather than `-v`: with a negation in play `-v` prints the matching `!` rule and exits 0, which reads like "still ignored" and is not.

- [ ] **Step 4: Fill `.env.local` with real local values**

```bash
cat > .env.local <<EOF
INVITE_SECRET=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")
MOD_SECRET=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")
RESEND_API_KEY=re_local_placeholder_never_used_by_npm_run_build
GITHUB_TOKEN=github_pat_local_placeholder_never_used_by_npm_run_build
EOF
```

This file is not optional local convenience — it is a build dependency from the route-handler task onward. `src/lib/token.ts` asserts both secrets at module load; `next build` evaluates route handler modules during "Collecting page data" (verified: a module-load `throw` there fails the build with `Failed to collect page data for /api/...`); and Next reads `.env.local` during `next build`. Without this file, the moment a route imports `token.ts` the build stops. The two placeholder values are never read by a build — only by the live route handlers on Vercel.

- [ ] **Step 5: Write the failing client-decoder assertions**

Paste this block into `scripts/token-roundtrip.mjs` **immediately above** the final `console.log(...)` / `process.exit(1)` summary lines. It reuses `signInviteToken` and `signModerationToken` from the `await import('../src/lib/token.ts')` destructuring added in Task 3 — do **not** re-declare them, that is a redeclaration error in the same module scope.

```js
// --- client-side decoding (no secret) ----------------------------------------
// DecompressionStream and Blob are Node globals from 18 onward, so the browser path is genuinely
// executable here rather than only reasoned about.

async function checkAsync(name, fn) {
  try {
    await fn()
    passed++
    console.log(`PASS  ${name}`)
  } catch (err) {
    failed++
    console.log(`FAIL  ${name}`)
    console.log(`      ${err instanceof Error ? err.message : String(err)}`)
  }
}

const { decodeInviteUnverified, decodeModerationUnverified } = await import(
  '../src/lib/token-client.ts'
)

const clientInvite = {
  v: '1',
  name: 'Maria Popescu',
  role: 'QA Lead',
  company: 'TOKERO',
  projectSlug: 'tokero',
  message: 'A few lines about the suite?',
  exp: 1801526400,
}

const clientRecord = {
  id: 'aB3xK9pQr7Zt',
  projectSlug: 'tokero',
  publishedAt: '2026-09-14',
  submittedAt: '2026-09-13',
  consent: { version: 1, at: '2026-09-13T18:42:07Z' },
  author: {
    name: 'Maria Popescu',
    role: 'QA Lead',
    company: 'TOKERO',
    linkedinSlug: 'maria-popescu-8a41b2',
  },
  answers: {
    whatIDid: '',
    whatChanged: 'Overnight instead of two days.',
    hiringManager: 'I would work with him again.',
    anythingElse: '',
  },
}

check('the invite fragment decodes to the same fields the server will verify', () => {
  const token = signInviteToken(clientInvite, INVITE_SECRET)
  assertDeepEqual(decodeInviteUnverified(`#${token}`), clientInvite, 'prefill differs from the signed fields')
  assertDeepEqual(decodeInviteUnverified(token), clientInvite, 'a fragment without the leading # was rejected')
})

check('a forged invite signature still decodes here, because this module cannot verify', () => {
  const [payload] = signInviteToken(clientInvite, INVITE_SECRET).split('.')
  const forged = decodeInviteUnverified(`#${payload}.${'A'.repeat(43)}`)
  assert(
    forged !== null && forged.name === clientInvite.name,
    'the trust boundary moved: token-client must decode WITHOUT verifying, or the browser needs a secret',
  )
})

check('malformed invite fragments return null', () => {
  for (const bad of ['', '#', '#notatoken', '#a.b.c', '#.', `#${'A'.repeat(20)}`]) {
    assert(decodeInviteUnverified(bad) === null, `expected null for ${JSON.stringify(bad)}`)
  }
})

await checkAsync('the moderation fragment gunzips on the browser path', async () => {
  const token = signModerationToken(clientRecord, MOD_SECRET)
  assertDeepEqual(
    await decodeModerationUnverified(`#a=publish&t=${token}`),
    clientRecord,
    'the record did not survive gzip in, gunzip out',
  )
  assertDeepEqual(
    await decodeModerationUnverified(`a=discard&t=${token}`),
    clientRecord,
    'a fragment without the leading # was rejected',
  )
})

await checkAsync('an absent, malformed or non-gzip moderation fragment returns null', async () => {
  for (const bad of [
    '',
    '#',
    '#a=publish',
    '#a=publish&t=',
    '#a=publish&t=notatoken',
    '#a=publish&t=AAAAAAAA.BBBBBBBB',
    `#t=${'A'.repeat(60)}.${'B'.repeat(43)}`,
  ]) {
    let out
    try {
      out = await decodeModerationUnverified(bad)
    } catch (err) {
      throw new Error(`threw on ${JSON.stringify(bad)}: ${err}`)
    }
    assert(out === null, `expected null for ${JSON.stringify(bad)}, got ${JSON.stringify(out)}`)
  }
})
```

- [ ] **Step 6: Run them and watch them fail**

Run: `npm run check:tokens`
Expected: every check up to and including the URL-budget pair prints `PASS`, then the process dies at the new import with no summary line:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/andreiserban/Projects/qa-portfolio/src/lib/token-client.ts' imported from /Users/andreiserban/Projects/qa-portfolio/scripts/token-roundtrip.mjs
```

Exit code 1.

- [ ] **Step 7: Write `src/lib/token-client.ts`**

```ts
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
```

- [ ] **Step 8: Run the client assertions and watch them pass**

Run: `npm run check:tokens`
Expected: five more `PASS` lines and `0 failed` in the summary:

```
PASS  the invite fragment decodes to the same fields the server will verify
PASS  a forged invite signature still decodes here, because this module cannot verify
PASS  malformed invite fragments return null
PASS  the moderation fragment gunzips on the browser path
PASS  an absent, malformed or non-gzip moderation fragment returns null
```

- [ ] **Step 9: Write `scripts/invite.mjs`**

```js
// Mints one invite link and prints the LinkedIn DM to paste with it.
//
//   npm run invite -- --name "Maria Popescu" --role "QA Lead" --company TOKERO \
//                     --project tokero --message "You saw the whole thing from the inside."
//
// Nothing is stored: the signed link IS the invite. Add --days -1 to mint an already-expired
// link, which is how the /invite expiry screen gets tested (manual checklist item 8).
import { existsSync, readFileSync } from 'node:fs'

const ENV_PATH = new URL('../.env.local', import.meta.url)

// A ten-line .env parser instead of dotenv, because this repo has zero runtime dependencies and
// this file is read once, by one person, on one laptop.
function parseEnvFile(text) {
  const out = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    const quoted = value.length >= 2 && (value.startsWith('"') || value.startsWith("'"))
    if (quoted && value.endsWith(value[0])) value = value.slice(1, -1)
    out[key] = value
  }
  return out
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const eq = arg.indexOf('=')
    if (eq !== -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[arg.slice(2)] = 'true'
    } else {
      out[arg.slice(2)] = next
      i += 1
    }
  }
  return out
}

function fail(message) {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

if (!existsSync(ENV_PATH)) {
  fail('No .env.local. Copy .env.local.example to .env.local and fill in INVITE_SECRET and MOD_SECRET.')
}

const env = parseEnvFile(readFileSync(ENV_PATH, 'utf8'))
// Both secrets, not just the invite one: src/lib/token.ts asserts them at module load.
process.env.INVITE_SECRET = process.env.INVITE_SECRET ?? env.INVITE_SECRET
process.env.MOD_SECRET = process.env.MOD_SECRET ?? env.MOD_SECRET

// A .mjs CAN import a .ts module here — Node >= 22.18 strips types natively — so there is no
// duplicated copy of the signing logic to drift. It only works with the explicit .ts extension.
const { PROJECT_LABELS, PROJECT_SLUGS, isProjectSlug } = await import('../src/lib/projects-meta.ts')
const { INVITE_TTL_DAYS, SITE_ORIGIN, signInviteToken, verifyInviteToken } = await import(
  '../src/lib/token.ts'
)

const args = parseArgs(process.argv.slice(2))
const name = args.name ?? ''
const role = args.role ?? ''
const company = args.company ?? ''
const projectSlug = args.project ?? ''
const message =
  args.message ?? 'You saw the whole thing from the inside - would you write a few lines?'
const days = Number(args.days ?? INVITE_TTL_DAYS)

if (!name || !role || !company || !projectSlug) {
  fail(
    'Usage: npm run invite -- --name "Maria Popescu" --role "QA Lead" --company TOKERO ' +
      '--project tokero [--message "..."] [--days 45]',
  )
}
if (!isProjectSlug(projectSlug)) {
  fail(`--project must be one of: ${PROJECT_SLUGS.join(', ')}`)
}
if (!Number.isFinite(days)) {
  fail('--days must be a number')
}

const exp = Math.floor(Date.now() / 1000) + Math.round(days * 86400)
const fields = { v: '1', name, role, company, projectSlug, message, exp }
const secret = process.env.INVITE_SECRET

const token = signInviteToken(fields, secret)
const url = `${SITE_ORIGIN}/invite#${token}`

// A link that does not verify with the same code the route handler runs is worse than no link, so
// mint and verify in one breath rather than hearing about it from a colleague three days later.
const verified = verifyInviteToken(token, secret)
if (verified === null) fail('The minted token did not verify. Do not send this link.')
for (const [key, value] of Object.entries(fields)) {
  if (verified[key] !== value) {
    fail(
      `Round trip changed ${key}: minted ${JSON.stringify(value)}, verified ${JSON.stringify(verified[key])}`,
    )
  }
}

const firstName = name.trim().split(/\s+/)[0]
const projectLabel =
  projectSlug === 'other' ? 'the work we did together' : PROJECT_LABELS[projectSlug]
const expires = new Date(exp * 1000)

console.log(`
Link (${url.length} chars, expires ${expires.toISOString().slice(0, 10)}${days < 0 ? ' — ALREADY EXPIRED' : ''}):

${url}

--- paste into a LinkedIn DM ------------------------------------------------

Hi ${firstName},

I'm adding a short testimonials section to my portfolio (aserban.ro) and I'd love to include something from you about ${projectLabel} — if you're up for it.

The link below is just for you. Four short questions, the last one open-ended; five to ten minutes, and it works fine on a phone. It opens already filled in with your name and role, so mostly you're proof-reading.

What would appear on the site: your name, your role and company at the time we worked together, a link to your LinkedIn, and what you write. Nothing else. Nothing goes live until I've read it, and you can have it taken down later at any point.

Two honest asks: keep it to things that are fine to say publicly — no internal detail — and do check your employer is comfortable with it, since some companies have rules about giving references.

And genuinely, no pressure. If it's a bad time or just not your thing, ignore this and nothing changes between us.

${url} — it expires in ${days} days, tell me if you'd like a fresh one.

Thanks either way,
Andrei

-----------------------------------------------------------------------------
`)
```

- [ ] **Step 10: Wire up `npm run invite`**

Add one line to `package.json` scripts, directly under `check:tokens`, matching its warning flags (Node prints an experimental-TypeScript warning and a module-type warning otherwise, which buries the DM in noise):

```json
    "check:tokens": "node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/token-roundtrip.mjs",
    "invite": "node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/invite.mjs",
```

- [ ] **Step 11: Mint a real invite and read the DM as a human would**

Run: `npm run invite -- --name "Maria Popescu" --role "QA Lead" --company TOKERO --project tokero`
Expected: a 229-character link (the spec's measured figure) and the full DM beneath it:

```
Link (229 chars, expires 2026-10-12):

https://aserban.ro/invite#MR9NYXJpYSBQb3Blc2N1H1FBIExlYWQfVE9LRVJPH3Rva2Vybx9Zb3Ug...Hg.j-1VxQ2H7mzswzcZ2vPbEAf3kjDyOSGxKtjgA-u2wBY

--- paste into a LinkedIn DM ------------------------------------------------

Hi Maria,

I'm adding a short testimonials section to my portfolio (aserban.ro) and I'd love to include something from you about TOKERO — if you're up for it.
...
```

The payload differs from run to run because `exp` moves. Named manual check, and the one that matters most here: **read the DM out loud.** If it reads like a mail-merge, nobody replies — that is the failure mode of this feature, and no assertion can catch it. Also confirm the three error paths: `--project nope` lists the five valid slugs, omitting `--role` prints the usage line, and renaming `.env.local` away prints the "copy .env.local.example" message.

- [ ] **Step 12: Mint an expired invite for the expiry screen**

Run: `npm run invite -- --name "Andrei Serban" --role "QA" --company Self --project other --days -1`
Expected: the header carries the warning, and the DM says "the work we did together" rather than the awkward `other` label:

```
Link (229 chars, expires 2026-08-27 — ALREADY EXPIRED):
```

Keep this link. The `/invite` task needs it to prove the friendly expiry message renders *before* the form, and `verifyInviteToken` deliberately does not enforce expiry — the route does, so a forged token (403) stays distinguishable from an honest expired one (410).

- [ ] **Step 13: Confirm the repo gate is still green**

Run: `npm run build && npm run lint`
Expected: build succeeds with the route table unchanged (`○ /`, `○ /_not-found`), and lint prints nothing and exits 0. ESLint does lint `scripts/**/*.mjs` by default, but only ever reports `@typescript-eslint/no-unused-vars` there as a warning — verified, exit code stays 0.

- [ ] **Step 14: Commit**

```bash
git add .gitignore .env.local.example src/lib/token-client.ts scripts/invite.mjs scripts/token-roundtrip.mjs package.json
git status --short
git commit -m "feat(testimonials): unverified client decoders and the invite minter"
```

`git status --short` before committing is the check that `.env.local` is absent from the staged set and that `.env.local.example` is present — the negation added in Step 2 is what makes both true at once.

---

### Task 5: Content store, validate-and-drop loader, and the `card-surface` CSS

**Files:**
- Create: `src/content/testimonials.json`
- Create: `src/lib/testimonials.ts`
- Modify: `src/app/globals.css:18` (append after the last line)

**Interfaces:**
- Consumes: `TestimonialRecord` (type) from `src/lib/token-types.ts`; `isProjectSlug` from `src/lib/projects-meta.ts`
- Produces: `export type Testimonial = TestimonialRecord` and `export const TESTIMONIALS: Testimonial[]` from `src/lib/testimonials.ts`; the CSS classes `.card-surface` and `.card-surface-interactive`

Why no test harness step here: `scripts/token-roundtrip.mjs` is plain Node with no TypeScript loader and no `@/*` path-alias resolution, so it physically cannot import `src/lib/testimonials.ts` (which imports `@/content/testimonials.json`). Duplicating the validator into the harness would test the copy, not the code. The drop-not-throw behaviour is exercised for real in Task 6 Step 5, where a component finally renders it.

- [ ] **Step 1: Create the content store**

The published store. Starts empty — the section stays dark until the first real testimonial is merged.

```bash
mkdir -p src/content
printf '[]\n' > src/content/testimonials.json
```

- [ ] **Step 2: Write the validate-and-drop loader**

Create `src/lib/testimonials.ts`:

```ts
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
function isTestimonial(value: unknown): value is Testimonial {
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
```

- [ ] **Step 3: Typecheck the loader**

Run: `npx tsc --noEmit`

Expected: no output at all, exit code 0. If you instead see `Type 'Testimonial' is not assignable to type 'never'`, you dropped the `const rows: unknown = rawJson` indirection — put it back.

- [ ] **Step 4: Append the card-surface classes to `globals.css`**

`src/app/globals.css` is currently 18 lines with no `@layer` block. Append exactly this to the end. This is the same block as Task 1 of `docs/superpowers/plans/2026-06-27-card-surface-system.md`, minus `.card-surface-ai` (no AI content here) and with the reduced-motion query scoped to these two classes only — the card-surface plan's global `*, *::before, *::after` variant would reach the existing nav and filter chips, which is not this feature's call to make.

```css

@layer components {
  .card-surface {
    @apply relative rounded-2xl border border-white/[0.08]
           bg-gradient-to-b from-white/[0.06] to-white/[0.03]
           transition-all duration-200 ease-out;
  }

  .card-surface-interactive {
    @apply hover:border-amber-400/30 hover:from-white/[0.08] hover:to-white/[0.04]
           hover:shadow-xl hover:shadow-amber-500/10;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card-surface,
  .card-surface-interactive {
    transition: none;
  }
}
```

Tailwind v4 note you will not know from v3 experience: this project is CSS-first — there is **no `tailwind.config.js`**, and `@import "tailwindcss"` on line 1 is the entire config. Two consequences. (1) `@apply` here resolves against the default v4 theme, and `@layer components` is a real CSS cascade layer, not Tailwind's own construct. (2) CSS you *author* inside `@layer components` is emitted unconditionally — only *utilities* are generated on demand by scanning your source. That is why the next step's grep finds these classes even though no component uses them yet.

- [ ] **Step 5: Build, then grep the emitted CSS to prove the classes compiled**

Run: `npm run build`

Expected: `✓ Compiled successfully`, and the route table shows `○ /` and `○ /_not-found`. A mistyped utility inside `@apply` fails the build outright with the offending class named — but a silently *dropped* `@layer` block does not, which is what the next command catches.

- [ ] **Step 6: Confirm the three emitted rules exist**

Run:
```bash
grep -l '\.card-surface{' .next/static/chunks/*.css
grep -rho '@media (prefers-reduced-motion:reduce){\.card-surface,\.card-surface-interactive{transition:none}}' .next/static/chunks/*.css
grep -roh 'card-surface' .next/static/chunks/*.css | wc -l
```

Expected, in order:
1. One hashed filename, e.g. `.next/static/chunks/02xw-6i~l6mja.css` (the hash changes every build — only that *a* file matches matters).
2. The literal line `@media (prefers-reduced-motion:reduce){.card-surface,.card-surface-interactive{transition:none}}`.
3. `11` on exactly the CSS above. The number moves if you touch the utility list; what is load-bearing is that it is **not 0**.

If any of the three comes back empty: the `@layer components` block got nested inside another rule, or `@import "tailwindcss";` is no longer the first line of `globals.css`. Fix and rebuild — do not proceed, because the card in Task 6 will otherwise render as unstyled text on a transparent background and you will debug the wrong file.

- [ ] **Step 7: Lint**

Run: `npm run lint`

Expected: no output, exit code 0.

- [ ] **Step 8: Commit**

```bash
git add src/content/testimonials.json src/lib/testimonials.ts src/app/globals.css
git commit -m "feat(testimonials): content store, validate-and-drop loader, card-surface classes"
```

---

### Task 6: `TestimonialCard`

**Files:**
- Create: `src/components/TestimonialCard.tsx`
- Create (throwaway, deleted in Step 6 of this task): `src/app/card-preview/page.tsx`
- Modify (temporarily, restored in Step 6 of this task): `src/content/testimonials.json`

**Interfaces:**
- Consumes: `Testimonial` (type) and `TESTIMONIALS` from `src/lib/testimonials.ts`; `PROJECT_LABELS` and `isProjectSlug` from `src/lib/projects-meta.ts`; the `.card-surface` class from `src/app/globals.css`
- Produces: `src/components/TestimonialCard.tsx` — `export default function TestimonialCard({ testimonial }: { testimonial: Testimonial })`. `TestimonialsSection` and the `/moderate` panel both render this exact component, so what the owner approves is byte-for-byte what ships.

- [ ] **Step 1: Write the card**

Create `src/components/TestimonialCard.tsx`. No `'use client'` directive — it renders in both a client tree (`page.tsx`) and the moderation panel, and inherits from whichever imports it.

The content order is load-bearing and is the design: glyph → `hiringManager` pull quote → **visible** `whatChanged` → collapsed `whatIDid` / `anythingElse`. The concrete before-and-after is the evidence; the endorsement is only the endorsement. Do not reorder them.

```tsx
import type { Testimonial } from '@/lib/testimonials'
import { PROJECT_LABELS, isProjectSlug } from '@/lib/projects-meta'

export default function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const { author, answers, projectSlug } = testimonial

  const hiringManager = answers.hiringManager.trim()
  const whatChanged = answers.whatChanged.trim()
  const whatIDid = answers.whatIDid.trim()
  const anythingElse = answers.anythingElse.trim()
  const hasDetails = whatIDid.length > 0 || anythingElse.length > 0

  // The loader already guarantees a valid slug; the narrowing is only so TypeScript will
  // index PROJECT_LABELS, whose key type is ProjectSlug while the record field is `string`.
  const projectLabel = isProjectSlug(projectSlug) ? PROJECT_LABELS[projectSlug] : projectSlug

  // Host is a SOURCE LITERAL and the record stores a slug, never a URL. React 19's
  // sanitizeURL blocks only `javascript:` — `data:`, `vbscript:`, `blob:` and a plain
  // `https://evil.com` all pass through untouched. Reconstructing the href here makes a
  // phishing link structurally impossible instead of dependent on correct URL parsing.
  const linkedinHref = `https://www.linkedin.com/in/${author.linkedinSlug}`

  return (
    <article className="card-surface p-6 flex flex-col h-full min-w-0">
      {/* Amber quote glyph. Inline SVG on purpose: no Heroicon covers it, and no emoji. */}
      <svg
        className="w-8 h-8 text-amber-400 mb-4 shrink-0"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M7.5 5.5H4.2A1.2 1.2 0 0 0 3 6.7v4.1c0 .7.5 1.2 1.2 1.2h2.2c0 2-1 3.3-3 3.9v2.6c3.6-.8 5.6-3.4 5.6-7.4V6.7c0-.7-.5-1.2-1.2-1.2H7.5zM18.8 5.5h-3.3a1.2 1.2 0 0 0-1.2 1.2v4.1c0 .7.5 1.2 1.2 1.2h2.2c0 2-1 3.3-3 3.9v2.6c3.6-.8 5.6-3.4 5.6-7.4V6.7c0-.7-.5-1.2-1.2-1.2z" />
      </svg>

      {/* dir="auto" on every field carrying someone else's words — a Romanian or Arabic
          submission must not be forced LTR. whitespace-pre-line keeps the paragraph breaks
          the sanitizer deliberately preserved (it collapses runs of 3+ newlines, not all). */}
      <blockquote dir="auto" className="text-lg text-gray-200 leading-relaxed whitespace-pre-line">
        {hiringManager}
      </blockquote>

      {whatChanged.length > 0 && (
        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80 mb-1">
            What changed
          </h4>
          <p dir="auto" className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
            {whatChanged}
          </p>
        </div>
      )}

      {/* Native <details>: zero JS, keyboard-accessible. Not rendered at all when both of
          its answers are empty — no empty disclosure triangle to click. */}
      {hasDetails && (
        <details className="mt-5">
          <summary className="cursor-pointer text-sm text-gray-400 hover:text-amber-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded">
            Read the rest
          </summary>
          <div className="mt-3 space-y-4">
            {whatIDid.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80 mb-1">
                  What I was doing on the team
                </h4>
                <p dir="auto" className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                  {whatIDid}
                </p>
              </div>
            )}
            {anythingElse.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80 mb-1">
                  Anything else
                </h4>
                <p dir="auto" className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                  {anythingElse}
                </p>
              </div>
            )}
          </div>
        </details>
      )}

      <footer className="mt-6 pt-5 border-t border-white/10">
        <div dir="auto" className="text-amber-300 font-semibold">
          {author.name}
        </div>
        {/* Role and company AS AT the collaboration — the qualifier is what stops this
            reading as a current corporate endorsement, and it never goes stale. */}
        <div dir="auto" className="text-sm text-gray-400">
          {author.role}, {author.company}{' '}
          <span className="text-gray-500">&mdash; at the time</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* Same badge classes as the project tech chips (page.tsx:1007), verbatim. */}
          <span className="bg-amber-500/20 text-amber-300 px-2 py-1 rounded text-xs font-medium">
            {projectLabel}
          </span>
          <a
            href={linkedinHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-amber-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
            aria-label={`Verify ${author.name} on LinkedIn (opens in new tab)`}
          >
            {/* Same 24x24 LinkedIn path the Contact section uses (page.tsx:1681). */}
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Verify on LinkedIn
          </a>
        </div>
      </footer>
    </article>
  )
}
```

- [ ] **Step 2: Typecheck and lint the component before wiring anything**

Run: `npx tsc --noEmit && npm run lint`

Expected: no output from either, exit code 0. `tsconfig.json` includes `**/*.tsx`, so the component is typechecked even though nothing imports it yet. A `react/no-unescaped-entities` error here would name the line — every literal apostrophe or quote in JSX text must be `&apos;` / `&quot;` (there are none in the code above; the `&mdash;` entity is fine).

- [ ] **Step 3: Create a throwaway preview route**

There is no component test harness in this repo and nothing renders `TestimonialCard` until a later task. This scratch route is how you actually look at it. **It is deleted in Step 6 and never committed.**

```bash
mkdir -p src/app/card-preview
cat > src/app/card-preview/page.tsx <<'EOF'
import TestimonialCard from '@/components/TestimonialCard'
import { TESTIMONIALS } from '@/lib/testimonials'

export default function CardPreviewPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 py-20 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
        {TESTIMONIALS.map((t) => (
          <TestimonialCard key={t.id} testimonial={t} />
        ))}
      </div>
    </main>
  )
}
EOF
```

- [ ] **Step 4: Put three fixtures into the content store**

One full record, one carrying **only** the required answer, and one that is valid JSON but an invalid record (`projectSlug` is not in the allowlist). Keep it valid JSON — malformed JSON fails the build, which is a different bug and not what you are testing.

```bash
cat > src/content/testimonials.json <<'EOF'
[
  {
    "id": "aB3xK9pQr7Zt",
    "projectSlug": "tokero",
    "publishedAt": "2026-09-14",
    "submittedAt": "2026-09-13",
    "consent": { "version": 1, "at": "2026-09-13T18:42:07Z" },
    "author": {
      "name": "Maria Popescu",
      "role": "QA Lead",
      "company": "TOKERO",
      "linkedinSlug": "maria-popescu-8a41b2"
    },
    "answers": {
      "whatIDid": "He owned the end-to-end suite and was the person we pinged when a pipeline went red at 6pm.",
      "whatChanged": "Regression used to eat two days of manual clicking. After his framework landed it ran overnight.",
      "hiringManager": "I would work with him again. He will push back if he thinks the plan is wrong.",
      "anythingElse": "He wrote the runbook nobody asked for and everybody ended up using."
    }
  },
  {
    "id": "Zz00minimal1",
    "projectSlug": "deutsche-bahn",
    "publishedAt": "2026-09-10",
    "submittedAt": "2026-09-10",
    "consent": { "version": 1, "at": "2026-09-10T09:00:00Z" },
    "author": {
      "name": "Jonas Weber",
      "role": "Engineering Manager",
      "company": "Deutsche Bahn",
      "linkedinSlug": "jonas-weber-1a2b3c"
    },
    "answers": {
      "whatIDid": "",
      "whatChanged": "",
      "hiringManager": "Hire him. He found the flakiness we had all learned to live with.",
      "anythingElse": ""
    }
  },
  {
    "id": "BrokenRec01x",
    "projectSlug": "not-a-real-project",
    "publishedAt": "2026-09-12",
    "submittedAt": "2026-09-12",
    "consent": { "version": 1, "at": "2026-09-12T09:00:00Z" },
    "author": {
      "name": "Should Not Render",
      "role": "Nobody",
      "company": "Nowhere",
      "linkedinSlug": "should-not-render"
    },
    "answers": {
      "whatIDid": "",
      "whatChanged": "",
      "hiringManager": "This record must be dropped by the loader.",
      "anythingElse": ""
    }
  }
]
EOF
```

- [ ] **Step 5: Run dev and check the card by eye — this is the named manual check**

Run: `npm run dev`, then open **http://localhost:3000/card-preview**.

Look at exactly these seven things, in order:

1. **Two cards, not three.** The `Should Not Render` card is absent.
2. The terminal running `npm run dev` (and the browser console) prints `[testimonials] dropped 1 malformed record(s) from src/content/testimonials.json`. That is the drop-not-throw path working.
3. **Card 1 (Maria Popescu)**, top to bottom: amber quote glyph, the "I would work with him again…" line at a visibly larger size than everything under it, an amber uppercase `WHAT CHANGED` label with the regression sentence **visible without clicking**, then a grey `Read the rest` line. Click it: two labelled blocks appear, `What I was doing on the team` and `Anything else`.
4. **Card 2 (Jonas Weber)** — the load-bearing check. It shows the glyph, the pull quote, and the attribution, and **nothing else**: no `WHAT CHANGED` label, no `Read the rest` line, no empty headings, no stray gap where a block used to be. This is what the first real testimonial will look like.
5. Both cards have a faint rounded border and a top-to-bottom lighter-to-darker tint. If they are flat transparent rectangles, `.card-surface` did not compile — go back to Task 5 Step 6.
6. Press Tab until focus reaches `Read the rest` on card 1: a clear amber ring appears around it. Tab once more to `Verify on LinkedIn`: amber ring again, and the browser status bar reads exactly `https://www.linkedin.com/in/maria-popescu-8a41b2`.
7. Narrow the window to phone width. The cards stack to one column and nothing scrolls sideways.

Stop the dev server with Ctrl-C when done.

- [ ] **Step 6: Delete the preview route and reset the content store**

```bash
rm -rf src/app/card-preview
printf '[]\n' > src/content/testimonials.json
```

- [ ] **Step 7: Confirm the working tree is back to just the new component**

Run:
```bash
cat src/content/testimonials.json
git status --porcelain -uall
```

Expected:
```
[]
?? src/components/TestimonialCard.tsx
```
Nothing else. In particular there must be **no** ` M src/content/testimonials.json` and no `src/app/card-preview/` — shipping either is a real bug (a fake testimonial on the live site, or a public route rendering the section outside its design).

- [ ] **Step 8: Build and lint green**

Run: `npm run build && npm run lint`

Expected: `✓ Compiled successfully`; the route table lists only `○ /` and `○ /_not-found` (plus any route a previous task added) — **no `/card-preview`**. Lint prints nothing and exits 0.

- [ ] **Step 9: Commit**

```bash
git add src/components/TestimonialCard.tsx
git commit -m "feat(testimonials): TestimonialCard with evidence-first content order"
```

---

### Task 7: Testimonials section shell, page integration, and the JSON-LD `@id` fix

**Files:**
- Create: `src/components/TestimonialsSection.tsx`
- Modify: `src/app/page.tsx:1110` (insert section)
- Modify: `src/app/page.tsx:411` (mobile nav)
- Modify: `src/app/page.tsx:371` (desktop nav)
- Modify: `src/app/page.tsx:270`, `:231`, `:144`, `:67` (project slugs)
- Modify: `src/app/page.tsx:889` (grid index lookup)
- Modify: `src/app/page.tsx:6` (imports)
- Modify: `src/app/layout.tsx:84` (`personJsonLd` `@id`)

**Interfaces:**
- Consumes: `TESTIMONIALS` from `@/lib/testimonials`; default export `TestimonialCard` from `@/components/TestimonialCard` (`({ testimonial }: { testimonial: Testimonial })`); `ProjectSlug` from `@/lib/projects-meta`
- Produces: `src/components/TestimonialsSection.tsx` default export `TestimonialsSection(): React.JSX.Element | null` — returns `null` when `TESTIMONIALS.length === 0`

Read this before touching `page.tsx`: it is one 1768-line `'use client'` component and it stays that way. There is no restructuring, no extraction, no rename in this task. Every edit below is an insertion or a one-line substitution, and each one is given with its surrounding lines so you can locate it by context rather than by line number.

**Apply the `page.tsx` edits in descending line order — 1110, then 411, then 371, then 270 / 231 / 144 / 67, then 6.** Every insertion shifts the lines below it; going bottom-up keeps every line number in this task valid as written. The steps below are already in that order.

---

- [ ] **Step 1: Capture the before-baseline on a clean tree**

This is the evidence that the empty-state gate really is invisible. Do it *before* any edit, from a clean checkout of `main` (`git status --short` shows nothing but the files earlier tasks in this plan created).

```bash
cd /Users/andreiserban/Projects/qa-portfolio
mkdir -p /tmp/testimonials-baseline
npm run build
perl -0777 -pe 's{<script\b[^>]*>.*?</script>}{}gs' .next/server/app/index.html \
  > /tmp/testimonials-baseline/before.html
wc -c /tmp/testimonials-baseline/before.html
grep -o 'href="#[a-z-]*"' .next/server/app/index.html | sort | uniq -c
node -e "console.log(Object.keys(require('./.next/prerender-manifest.json').routes))"
grep -o '"@id":"https://aserban.ro/#person"' .next/server/app/index.html | wc -l
```

Expected, measured on `main` on 2026-08-28:

```
   84132 /tmp/testimonials-baseline/before.html
   1 href="#about"
   1 href="#architecture"
   2 href="#contact"
   2 href="#projects"
   1 href="#skills"
[ '/', '/_global-error', '/_not-found', '/favicon.ico' ]
       1
```

Two things about that byte count and the `perl` strip, both verified rather than assumed:

- The **raw** `.next/server/app/index.html` is *not* reproducible across builds — two consecutive builds of an unmodified tree produce different bytes, because the build id, the content-hashed chunk filenames and the RSC flight payload's module ids all move when anything is added. A raw `cmp` would report a false failure. With every `<script>` element stripped, two consecutive builds of the unmodified tree are **byte-identical** (both 84132). That stripped file is the real "did the rendered page change" oracle.
- 84132 is today's number. The hero year counters come from `getYearsSince()` against the live date, so your baseline may differ by a few bytes. That does not matter — you compare against *your own* `before.html`, never against 84132.

Note the `@id` count of `1`: that single occurrence is `websiteJsonLd.author` at `layout.tsx:180` pointing at an identifier that nothing defines. Step 12 makes it 2.

---

- [ ] **Step 2: Create the section shell**

No `'use client'` directive. It is imported by `page.tsx`, which already has one, so this module joins the client graph automatically; adding a second directive is noise. It has no hooks, no state, no effects.

No background tint on the `<section>`, and that is deliberate: Projects (`page.tsx:843`) is `bg-black/20` and Architecture (`page.tsx:1112`) is `bg-black/10`. An untinted section between them is what separates the two tinted ones. Give this section a tint of its own and you fuse three sections into one grey slab.

```bash
mkdir -p /Users/andreiserban/Projects/qa-portfolio/src/components
```

`src/components/TestimonialsSection.tsx`:

```tsx
import TestimonialCard from '@/components/TestimonialCard'
import { TESTIMONIALS } from '@/lib/testimonials'

export default function TestimonialsSection() {
  // The whole feature ships dark. Until the first testimonial is merged into
  // src/content/testimonials.json this renders nothing at all — no empty grid,
  // no placeholder advertising the absence.
  if (TESTIMONIALS.length === 0) return null

  return (
    <section id="testimonials" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-12 text-center">Testimonials</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {TESTIMONIALS.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>

        <div className="max-w-3xl mx-auto mt-12 pt-8 border-t border-white/10 space-y-4 text-sm text-gray-400 leading-relaxed">
          <p>
            <span className="text-gray-300 font-semibold">How this section works</span> — I invite people by private
            link, one at a time, and only people I&apos;ve actually worked with; there&apos;s no open form, so every
            name here is someone I can point to a project with. I read submissions before they go up and may fix a
            typo or trim for length, never change what someone meant.
          </p>
          <p>
            These are personal comments from people I worked with directly, written in a personal capacity. Company
            names say where we worked together — they are not endorsements by those companies, and nobody quoted here
            is speaking for their employer.
          </p>
          <p>
            <a
              href="mailto:andre.serban96@gmail.com"
              className="text-amber-400 hover:text-amber-300 underline underline-offset-4 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md"
            >
              Are you quoted here and want it removed?
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
```

The three paragraphs above are spec §13.6 verbatim, with **both** apostrophes already converted: `I&apos;ve` and `there&apos;s`. `react/no-unescaped-entities` is an **error** in this repo, not a warning, and `npm run build` runs the lint-adjacent type check — one raw `'` in this block fails the deploy. The em dashes (`—`) need no escaping and must stay as literal characters. There is no invented subtitle under the heading: this footer is the copy that explains the section, and duplicating the explanation above the grid would weaken it.

- [ ] **Step 3: Prove the new file compiles before it is wired to anything**

```bash
cd /Users/andreiserban/Projects/qa-portfolio && npm run build && npm run lint
```

Expected: build succeeds, route table still shows `○ /`, `npm run lint` exits 0 with no output. The component is not imported yet, so the rendered page is untouched. If this fails, the failure is in `TestimonialCard` or `testimonials.ts` from the earlier tasks, not here.

---

- [ ] **Step 4: Insert the section into the blank line 1110**

Locate this exact region — the closing `</section>` of Projects, one blank line, then the Architecture comment:

```tsx
                )
              })}
          </div>
        </div>
      </section>

      {/* Architecture & Approach Section */}
      <section id="architecture" className="py-20 px-4 sm:px-6 bg-black/10">
```

Replace the single blank line between `</section>` and `{/* Architecture & Approach Section */}` so the region reads:

```tsx
                )
              })}
          </div>
        </div>
      </section>

      {/* Testimonials Section — renders nothing until the first testimonial is published */}
      <TestimonialsSection />

      {/* Architecture & Approach Section */}
      <section id="architecture" className="py-20 px-4 sm:px-6 bg-black/10">
```

Indentation is 6 spaces, matching the sibling `<section>` elements.

- [ ] **Step 5: Insert the mobile nav entry after line 411**

Line 411 is the `</a>` that closes the mobile Projects link. Locate:

```tsx
                <a
                  href="#projects"
                  className="transition-colors py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 text-gray-300 hover:text-white"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Projects
                </a>
                <a
                  href="#architecture"
```

Insert between `</a>` and the next `<a`:

```tsx
                {TESTIMONIALS.length > 0 && (
                  <a
                    href="#testimonials"
                    className="transition-colors py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 text-gray-300 hover:text-white"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Testimonials
                  </a>
                )}
```

The `className` is copied character-for-character from the sibling at line 407. The `onClick={() => setIsMobileMenuOpen(false)}` is not optional — every sibling in this menu carries it, and without it tapping the link scrolls the page while leaving the menu covering the top of it.

- [ ] **Step 6: Insert the desktop nav entry after line 371**

Locate the desktop nav row:

```tsx
              <a href="#about" className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 py-1">About</a>
              <a href="#projects" className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 py-1">Projects</a>
              <a href="#architecture" className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 py-1">Architecture</a>
```

Insert between the `#projects` and `#architecture` anchors:

```tsx
              {TESTIMONIALS.length > 0 && (
                <a href="#testimonials" className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 py-1">Testimonials</a>
              )}
```

Gate at 14 spaces to match its siblings, anchor at 16 inside it. The `className` is copied character-for-character from line 371 — do not "tidy" it, and do not factor the five nav links into a map. Both nav entries sit between Projects and Architecture so the nav order matches the section order.

**Accepted, documented drift:** the string `Testimonials` now exists in two places (desktop and mobile) and nothing keeps them in sync. Change one and the site says "Testimonials" on a laptop and something else on a phone, silently, forever. This is spec §15's last bullet — it is recorded in CLAUDE.md in a later task rather than engineered away, because a shared constant to deduplicate one word across two lines of the same file is worse than the drift it prevents.

- [ ] **Step 7: Add the imports at line 6**

Current head of the file:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { MapPinIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { BriefcaseIcon } from '@heroicons/react/24/solid'
import { QA_CAREER_START, PLAYWRIGHT_START, KARATE_START, getYearsSince } from '@/lib/career'
```

After:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { MapPinIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { BriefcaseIcon } from '@heroicons/react/24/solid'
import { QA_CAREER_START, PLAYWRIGHT_START, KARATE_START, getYearsSince } from '@/lib/career'
import type { ProjectSlug } from '@/lib/projects-meta'
import { TESTIMONIALS } from '@/lib/testimonials'
import TestimonialsSection from '@/components/TestimonialsSection'
```

Three lines, not one: `TESTIMONIALS` for the two nav gates, `TestimonialsSection` for the section, and `ProjectSlug` (a `import type`, erased at build) for the `satisfies` checks in Step 9.

- [ ] **Step 8: Prove the empty state is genuinely invisible**

```bash
cd /Users/andreiserban/Projects/qa-portfolio && npm run build && npm run lint
perl -0777 -pe 's{<script\b[^>]*>.*?</script>}{}gs' .next/server/app/index.html \
  > /tmp/testimonials-baseline/after.html
diff /tmp/testimonials-baseline/before.html /tmp/testimonials-baseline/after.html && echo "RENDERED PAGE IDENTICAL"
grep -o 'href="#[a-z-]*"' .next/server/app/index.html | sort | uniq -c
node -e "console.log(Object.keys(require('./.next/prerender-manifest.json').routes))"
```

Expected:

```
RENDERED PAGE IDENTICAL
   1 href="#about"
   1 href="#architecture"
   2 href="#contact"
   2 href="#projects"
   1 href="#skills"
[ '/', '/_global-error', '/_not-found', '/favicon.ico' ]
```

No `href="#testimonials"` anywhere, zero diff lines, and `/` still in the prerender manifest. If `diff` prints anything, the gate leaked markup — most likely `return null` was written as `return <></>` or one of the two nav gates was written as a ternary with an empty-string branch. If `/` has dropped out of the manifest keys, something in this task's import chain reached a server-only API; `TestimonialsSection` and everything it imports must stay pure.

---

- [ ] **Step 9: Wire the slug drift guard — with a deliberate typo first**

`PROJECT_SLUGS` is an allowlist the form and the publish endpoint both validate against, and `projects[]` in `page.tsx` is the list those slugs are supposed to name. Nothing today connects them. `satisfies ProjectSlug` makes `tsc` the connection: rename a slug in `projects-meta.ts` without renaming it here, or fat-finger one here, and `npm run build` fails instead of a testimonial silently pointing at a project that does not exist.

Prove the guard bites before trusting it. Add the property to each of the four project entries **immediately after its `title:` line** — that is the identity of the entry, so the slug belongs beside it, and it keeps the four edits at four locations you can find by searching for the title. Type one of them wrong on purpose:

Entry 1 (line 67 — note this entry's odd single-space indentation; match it):

```tsx
    {
 title: "Deutsche Bahn - SAP ERP Integrated Railway Management System QA Automation Framework",
 slug: 'deutsche-bhan' satisfies ProjectSlug,
  description: "Prevented €2M+ in potential system failures through proactive defect detection for Europe's largest transportation network. Reduced testing cycles by 40% while maintaining zero-tolerance safety standards for 2+ billion annual passengers. Led digital transformation of critical railway infrastructure supporting Germany's €40B transportation modernization program.",
```

Entry 2 (line 144):

```tsx
   {
  title: "TOKERO QA Automation Platform",
  slug: 'tokero' satisfies ProjectSlug,
  description: "Sole architect and maintainer of the QA stack at TOKERO (European crypto exchange): a Playwright functional framework in production since 2025, plus an NBomber performance suite and a custom Blazor reporting platform — both shipped to production in 2026. Owned end-to-end from July 2025 until the engagement concluded in August 2026, with all three systems handed over running in production.",
```

Entry 3 (line 231):

```tsx
 {
  title: "DentsplySirona - Medical Device CAD/CAM Software Testing & QA Leadership",
  slug: 'dentsply-sirona' satisfies ProjectSlug,
  description: "Led precision testing for medical manufacturing systems ensuring ±0.001mm accuracy standards. Delivered 100% on-time deliverables as interim team lead during critical product launches. Resolved 65+ critical defects with 99% clarity, reducing developer resolution time by 40% for CAD/CAM workflows.",
```

Entry 4 (line 270):

```tsx
    {
  title: "Happy Media - Full-Stack Development & Digital Campaign Management Platform",
  slug: 'happy-media' satisfies ProjectSlug,
  description: "Increased client acquisition rates by 35% and reduced manual work by 80% through quality-focused development. Maintained 99.9% uptime for Romania's leading advertising agency. Built scalable solutions that transformed 100+ SMEs from local businesses into digital market leaders across Eastern Europe.",
```

**Add the property to all four entries or to none.** `projects` is an array literal of four differently-shaped object literals, so TypeScript infers a *union* of four object types and does not normalise missing members into optionals — which is exactly why the existing code has to write `(project as { tooling?: string[] }).tooling` at line 339 and `(project as { subProjects?: SubProject[] }).subProjects` at line 1034. Put `slug` on three entries and `project.slug` in Step 10 fails to compile with "Property 'slug' does not exist on type ...".

Also keep the four slugs distinct. `PROJECT_SLUGS` being a union type does not stop two entries carrying the same member, and Step 10's `findIndex` would then return the same index for both cards — clicking one would expand the other.

- [ ] **Step 10: Switch the grid's index lookup to the slug**

Line 889, inside the Projects grid map. Locate:

```tsx
          <div className="grid md:grid-cols-2 gap-6">
            {filteredProjects.map((project) => {
              const originalIndex = projects.findIndex(p => p.title === project.title)
              const isLiveStatus = project.status === 'Ongoing'
```

Replace exactly that one line with:

```tsx
              const originalIndex = projects.findIndex(p => p.slug === project.slug)
```

To answer the question directly: **matching on `title` still works after Step 9.** Adding a property does not touch `title`, `title` is still present on all four members of the union, and `filteredProjects` is still derived from `projects`, so `findIndex` still returns the same index it does today. Switching to the slug is safe and strictly better — the slug is a short, stable, type-checked identity, whereas the title is a 90-character marketing string that gets rewritten whenever the copy is polished, and a `findIndex` returning `-1` here would silently break the expand/collapse for that card (`activeProject === -1` matches nothing, `setActiveProject(-1)` highlights nothing).

`originalIndex` stays a `number` and keeps its meaning as an index into `projects`, so `key={originalIndex}`, `activeProject === originalIndex` and `setActiveProject(originalIndex)` all keep working unchanged. **Do not** also change `key={originalIndex}` to `key={project.slug}` — it is invisible in the output and only widens the diff on a file this task is supposed to touch as little as possible.

`project.slug` types as `string`, not as `ProjectSlug`: `satisfies` preserves the literal type of the expression but the property still widens inside a mutable object literal. That is fine — the comparison is string-to-string, and the type check that matters already happened at the `satisfies`.

- [ ] **Step 11: Watch the drift guard fail**

```bash
cd /Users/andreiserban/Projects/qa-portfolio && npm run build
```

Expected: the build stops in the TypeScript phase with an error on the `deutsche-bhan` line, of the form:

```
Type '"deutsche-bhan"' does not satisfy the expected type 'ProjectSlug'.
```

If the build *passes*, the guard is not wired: either the `import type { ProjectSlug }` from Step 7 is missing (in which case you would see "Cannot find name 'ProjectSlug'" instead), or `PROJECT_SLUGS` in `src/lib/projects-meta.ts` lost its `as const` and `ProjectSlug` widened to `string`. Fix that before continuing — a guard that cannot fail is worse than no guard.

- [ ] **Step 12: Fix the typo and watch it pass**

Change `slug: 'deutsche-bhan'` to `slug: 'deutsche-bahn'` on the Deutsche Bahn entry.

```bash
cd /Users/andreiserban/Projects/qa-portfolio && npm run build && npm run lint
perl -0777 -pe 's{<script\b[^>]*>.*?</script>}{}gs' .next/server/app/index.html \
  > /tmp/testimonials-baseline/after2.html
diff /tmp/testimonials-baseline/before.html /tmp/testimonials-baseline/after2.html && echo "RENDERED PAGE STILL IDENTICAL"
```

Expected: build green, lint exits 0, `RENDERED PAGE STILL IDENTICAL`. The slug is data the page never prints and the `findIndex` swap returns the same numbers, so the rendered markup must not move by one byte.

---

- [ ] **Step 13: Fix the dangling JSON-LD reference in `layout.tsx`**

`websiteJsonLd.author` at `layout.tsx:180` is `{ "@id": "https://aserban.ro/#person" }` — a reference to a node identifier that `personJsonLd` never declares. Every consumer that resolves the graph sees an edge pointing at nothing: the `WebSite` has an author that does not exist, and the `Person` block is a second, unlinked island. One line joins them.

Locate the head of `personJsonLd`:

```ts
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Șerban Andrei",
```

Insert one line after `"@type": "Person",`:

```ts
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://aserban.ro/#person",
  name: "Șerban Andrei",
```

That is the entire change to `layout.tsx`. It is unrelated to testimonials and free, and it is the *only* JSON-LD this feature touches: no `Review` and no `aggregateRating` is added anywhere, because `layout.tsx` renders JSON-LD through `dangerouslySetInnerHTML` with plain `JSON.stringify`, which does not escape `<` — feeding third-party testimonial text through it would turn a `</script>` in someone's free text into stored XSS on every page load.

- [ ] **Step 14: Verify the `@id` reached the rendered HTML**

```bash
cd /Users/andreiserban/Projects/qa-portfolio && npm run build && npm run lint
grep -o '"@id":"https://aserban.ro/#person"' .next/server/app/index.html | wc -l
```

Expected: `2` — one declaration in the `Person` block, one reference in the `WebSite` block. It was `1` in Step 1. The stripped-HTML diff will *not* show this change, because JSON-LD lives inside a `<script type="application/ld+json">` element and the `perl` filter removes it; this grep is the check for this edit.

---

- [ ] **Step 15: Named manual check — light the section up with a throwaway record**

Nothing automated has yet rendered a single card. Temporarily replace the contents of `src/content/testimonials.json` with one record:

```json
[
  {
    "id": "zzTESTzz0001",
    "projectSlug": "tokero",
    "publishedAt": "2026-08-28",
    "submittedAt": "2026-08-27",
    "consent": { "version": 1, "at": "2026-08-27T09:15:00Z" },
    "author": {
      "name": "Maria Popescu",
      "role": "QA Lead",
      "company": "TOKERO",
      "linkedinSlug": "maria-popescu-8a41b2"
    },
    "answers": {
      "whatIDid": "He owned the end-to-end suite and was the person we pinged when a pipeline went red at 6pm.",
      "whatChanged": "Regression used to eat two days of manual clicking. After his framework landed it ran overnight.",
      "hiringManager": "I'd work with him again. He'll push back if he thinks the plan is wrong.",
      "anythingElse": ""
    }
  }
]
```

Then:

```bash
cd /Users/andreiserban/Projects/qa-portfolio && npm run build
grep -o 'href="#testimonials"' .next/server/app/index.html | wc -l
grep -c 'Maria Popescu' .next/server/app/index.html
npm run dev
```

`href="#testimonials"` must be `1` (the desktop nav; the mobile menu is closed at first paint so its copy is not in the SSR output) and `Maria Popescu` must be `≥ 1` — that second grep is what proves the content reached the **prerendered HTML** rather than only the client bundle, which is the whole point of keeping `/` static.

Then open `http://localhost:3000/` and check these six things by eye, in this order:

1. The nav reads About · Projects · **Testimonials** · Architecture · Skills · Contact, in that order, and clicking Testimonials scrolls to the section.
2. Narrow the window below 768px, open the burger menu: **Testimonials** appears between Projects and Architecture, and tapping it both scrolls *and* closes the menu.
3. The section sits between Projects and Architecture and is visibly **lighter** than both — Projects is `bg-black/20`, Architecture is `bg-black/10`, this one has no tint. If the three read as one continuous slab, a background class got added to the `<section>`.
4. Widen past 768px: the grid is two columns (one card, so it occupies the left column — that is correct, not a bug).
5. The footer copy renders with real apostrophes — "I've", "there's" — and not the literal text `&apos;`.
6. Press Tab until focus reaches "Are you quoted here and want it removed?": an amber focus ring must be visible, and the link opens a mail composer to `andre.serban96@gmail.com`.

- [ ] **Step 16: Restore the empty store and run the full gate**

The throwaway record must not be committed.

```bash
cd /Users/andreiserban/Projects/qa-portfolio
printf '[]\n' > src/content/testimonials.json
git diff --stat src/content/testimonials.json
npm run build && npm run lint
perl -0777 -pe 's{<script\b[^>]*>.*?</script>}{}gs' .next/server/app/index.html \
  > /tmp/testimonials-baseline/final.html
diff /tmp/testimonials-baseline/before.html /tmp/testimonials-baseline/final.html && echo "SHIPPING DARK — PAGE IDENTICAL TO MAIN"
node -e "const r=Object.keys(require('./.next/prerender-manifest.json').routes); console.log(r); if(!r.includes('/')) { throw new Error('HOME PAGE IS NO LONGER STATIC') }"
```

Expected: `git diff --stat` prints nothing for `testimonials.json` (it is back to the `[]` an earlier task committed), build and lint both green, `SHIPPING DARK — PAGE IDENTICAL TO MAIN`, and the manifest keys include `/` with no thrown error.

- [ ] **Step 17: Commit**

```bash
cd /Users/andreiserban/Projects/qa-portfolio
git add src/components/TestimonialsSection.tsx src/app/page.tsx src/app/layout.tsx
git commit -m "feat(testimonials): add gated testimonials section and project slug guard

Section shell renders null until the first testimonial is published, so the
page is byte-identical to today with an empty store. Both nav entries are
gated the same way. Adds satisfies ProjectSlug to the four project entries so
PROJECT_SLUGS and projects[] cannot drift, and fixes the dangling
https://aserban.ro/#person reference by declaring @id on personJsonLd.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: The moderation email, and robots.txt

**Files:**
- Create: `src/lib/notify.ts`
- Create: `src/app/robots.ts`

**Interfaces:**
- Consumes: `assertSecret`, `SITE_ORIGIN` (`@/lib/token`) · `TestimonialRecord` (`@/lib/token-types`) · `PROJECT_LABELS`, `isProjectSlug` (`@/lib/projects-meta`)
- Produces: `export async function sendModerationEmail(record: TestimonialRecord, moderationToken: string): Promise<void>` — called by `POST /api/testimonials/submit`, which turns any throw from it into a 503. `src/app/robots.ts` produces no importable symbol; it emits the static route `/robots.txt`.

Why this module is so plain: the email is **plain text, never HTML**. That is not a style preference. An HTML body would put third-party free text inside markup, which requires an escaping function, and a bug in that escaping function is stored XSS in the owner's own mail client. Plain text deletes that entire surface — there is nothing to escape. It also happens to be the format that reads best on a lock screen, which is the actual triage surface (spec §8).

Nothing imports `notify.ts` yet; the submit route arrives in a later task. `next build` still type-checks it, because `tsconfig.json` includes `**/*.ts`.

- [ ] **Step 1: Create `src/lib/notify.ts` with the constants, the header guard, and the subject**

```ts
/**
 * SERVER ONLY. The single outbound notification: one plain-text email to the owner.
 *
 * Plain text, never HTML. That is not a style choice — an HTML body would put
 * third-party free text inside markup, which means an escaping function, which
 * means a bug in that function is stored XSS in the owner's mail client. Plain
 * text deletes that entire surface: there is nothing to escape.
 */
import { assertSecret, SITE_ORIGIN } from '@/lib/token'
import type { TestimonialRecord } from '@/lib/token-types'
import { PROJECT_LABELS, isProjectSlug } from '@/lib/projects-meta'

/** Resend's sandbox sender. Delivers only to the Resend account's own signup
 *  address, which is exactly and only OWNER_EMAIL. Zero DNS records, permanently. */
const FROM = 'onboarding@resend.dev'
const OWNER_EMAIL = 'andre.serban96@gmail.com'
const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const GITHUB_EDIT_URL =
  'https://github.com/seradi96/qa-portfolio/edit/main/src/content/testimonials.json'

/**
 * We hand Resend JSON, so we are not writing SMTP headers ourselves — but Resend
 * writes them from these values. A CR or LF inside the subject folds into a new
 * header there, so strip both from every interpolated value.
 */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function projectLabel(slug: string): string {
  return isProjectSlug(slug) ? PROJECT_LABELS[slug] : slug
}

function buildSubject(record: TestimonialRecord): string {
  const name = headerSafe(record.author.name)
  const role = headerSafe(record.author.role)
  const company = headerSafe(record.author.company)
  return `${name} (${role}, ${company}) — testimonial ready to review`
}
```

- [ ] **Step 2: Append the body template to `src/lib/notify.ts`**

This is the whole email. The order is fixed by spec §8: who wrote it → every answer under its own label → the LinkedIn slug → the two moderation links → the "nothing changes yet" line → the two manual fallbacks. In plain text there is no grey; the line is set off by blank lines instead, and its wording is verbatim from the spec.

```ts
function buildBody(record: TestimonialRecord, moderationToken: string): string {
  const { author, answers } = record
  const publishUrl = `${SITE_ORIGIN}/moderate#a=publish&t=${moderationToken}`
  const discardUrl = `${SITE_ORIGIN}/moderate#a=discard&t=${moderationToken}`

  const lines: string[] = [
    author.name,
    `${author.role}, ${author.company} (at the time)`,
    `Project: ${projectLabel(record.projectSlug)}`,
    '',
  ]

  // Form order, not card order: this is a read of what the person actually wrote.
  // A blank optional answer is skipped label and all — an empty heading is noise
  // on a lock screen, and the point of this body is triage with zero taps.
  const blocks: ReadonlyArray<readonly [string, string]> = [
    ['WHAT I WAS DOING ON THE TEAM', answers.whatIDid],
    ['WHAT CHANGED BECAUSE OF IT', answers.whatChanged],
    ['TO A HIRING MANAGER', answers.hiringManager],
    ['ANYTHING ELSE', answers.anythingElse],
  ]
  for (const [label, value] of blocks) {
    if (value.trim() === '') continue
    lines.push(label, value, '')
  }

  lines.push(
    `LinkedIn: linkedin.com/in/${author.linkedinSlug}`,
    `Submitted ${record.submittedAt} · consent v${record.consent.version} at ${record.consent.at}`,
    '',
    '------------------------------------------------------------',
    '',
    'PUBLISH IT',
    publishUrl,
    '',
    'DISCARD IT',
    discardUrl,
    '',
    'Both links just open the page. Nothing changes until you tap again there.',
    '',
    '------------------------------------------------------------',
    '',
    'If the site is down, publish it by hand:',
    '',
    '1. Open',
    `   ${GITHUB_EDIT_URL}`,
    '',
    '2. Paste this object into the array, first:',
    '',
    JSON.stringify(record, null, 2),
    '',
    '3. Commit it to a new branch and merge that branch.',
    '',
    'To discard by hand: delete this email. It is the only copy.',
    '',
  )

  return lines.join('\n')
}
```

GitHub's `/edit/` route takes no content parameter — there is no way to prefill the editor from a URL. The prefill is the JSON block directly beneath it: open the link, paste, commit. Those two fallbacks are what turn `GITHUB_TOKEN` from a hard dependency into a convenience (spec §8).

- [ ] **Step 3: Append the exported sender to `src/lib/notify.ts`**

```ts
/**
 * Throws on any non-2xx, with the response body in the message. The submit route
 * turns that throw into a 503 that keeps every typed answer on screen and asks the
 * submitter to press send again — the email IS the commit point, so a failed send
 * must never look like a success.
 */
export async function sendModerationEmail(
  record: TestimonialRecord,
  moderationToken: string,
): Promise<void> {
  const apiKey = assertSecret('RESEND_API_KEY', process.env.RESEND_API_KEY)

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [OWNER_EMAIL],
      subject: buildSubject(record),
      text: buildBody(record, moderationToken),
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    // res.text() cannot leak the key: it is a request header, never echoed back.
    const body = await res.text().catch(() => '')
    throw new Error(`Resend send failed: ${res.status} ${res.statusText} ${body.slice(0, 500)}`)
  }
}
```

One `fetch`, one recipient, no retry. `AbortSignal.timeout` means a hung Resend surfaces as the same 503 as a refused one rather than holding the lambda open. `cache: 'no-store'` because Next patches global `fetch`.

- [ ] **Step 4: Create `src/app/robots.ts`**

```ts
import type { MetadataRoute } from 'next'

/**
 * /invite and /moderate are capability URLs handed out by hand, so keep them out of
 * search results. This is hygiene, not a security control: the capability lives in
 * the URL fragment, which never reaches a server or a crawler at all (spec §9.1).
 *
 * No `sitemap` key — this repo has no sitemap route, and pointing robots.txt at a
 * 404 is worse than saying nothing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/invite', '/moderate'],
    },
  }
}
```

Neither `/invite` nor `/moderate` exists yet — they arrive in a later task. Disallowing a route before it exists is harmless and means the rule is already live the first time the page ships.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, then `Finished TypeScript` with no errors, then a route table that now contains both `○ /` and `○ /robots.txt`. Exit code 0.

- [ ] **Step 6: Read the generated robots.txt**

Run: `cat .next/server/app/robots.txt.body`
Expected, exactly:

```
User-Agent: *
Allow: /
Disallow: /invite
Disallow: /moderate
```

(Next writes the static body to `.next/server/app/robots.txt.body`. If the file is missing, `robots.ts` is not in `src/app/`.)

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: no output, exit code 0.

- [ ] **Step 8: Transcription check on the email module**

Run: `grep -cE "onboarding@resend\.dev|andre\.serban96@gmail\.com|api\.resend\.com/emails|moderate#a=publish|moderate#a=discard|edit/main/src/content/testimonials\.json" src/lib/notify.ts`
Expected: `6` — the sender, the recipient, the endpoint, both moderation links, and the manual-fallback editor URL, each on its own line. Any other number means a constant was dropped or duplicated while transcribing.

- [ ] **Step 9: Record what is and is not verified**

`notify.ts` has **no automated test and cannot have one**: `scripts/token-roundtrip.mjs` runs pure functions with no network, and this module is a single `fetch` to a third party whose only legal recipient is the owner's real inbox. `npm run build` proves it compiles; nothing local proves an email arrives or is readable.

It is verified **only** by the live rehearsal in spec §18.4:
- **item 4** — the email arrives in the inbox rather than Promotions or Spam, and the whole submission is readable in the body with zero taps (this is the check on the body template and on the answer labels);
- **item 5** — tapping Discard from that email lands on the discard screen and nothing is written anywhere (this is the check on the `#a=discard` link and the "Both links just open the page" line).

Do not mark the write path done before both have actually been run against a real invite. `robots.txt`, by contrast, is fully verified by Step 6.

- [ ] **Step 10: Commit**

```bash
git add src/lib/notify.ts src/app/robots.ts
git commit -m "feat(testimonials): plain-text moderation email and robots.txt"
```

---

### Task 9: Publishing to git as a branch and a pull request

**Files:**
- Create: `src/lib/publish-to-git.ts`

**Interfaces:**
- Consumes: `assertSecret` (`@/lib/token`) · `TestimonialRecord` (`@/lib/token-types`) · `PROJECT_LABELS`, `isProjectSlug` (`@/lib/projects-meta`)
- Produces:
  ```ts
  export type PublishResult =
    | { status: 'already_published' }
    | { status: 'pr_open'; prUrl: string }
    | { status: 'pr_opened'; prUrl: string }
  export async function publishTestimonial(record: TestimonialRecord): Promise<PublishResult>
  ```
  Called by `POST /api/testimonials/publish`, which returns the `PublishResult` as its 200 body and turns any throw into a 502. **The route stamps `record.publishedAt` before calling; this module writes the record it is given, verbatim** — that keeps the JSON block in the moderation email byte-identical to what the automatic path commits.

This implements spec §10 steps 3–9 with plain `fetch` and zero dependencies. It targets a branch and a pull request, never `main` directly: a pull request does not contain a leaked token (see §10 for why no branch rule can), but it does contain every *application-initiated* wrong write — a replayed moderation token, a mis-signed payload, a bug in this file — as an unmerged PR with its own Vercel preview instead of a live change. Nothing imports it yet; the publish route arrives in a later task.

- [ ] **Step 1: Create `src/lib/publish-to-git.ts` with the constants, headers, error helper, and UTF-8-safe base64**

```ts
/**
 * SERVER ONLY. Publishes an approved testimonial as a branch + pull request.
 * Zero dependencies: plain fetch against the GitHub REST API.
 *
 * Never writes to main. Every application-initiated wrong write — a replayed
 * moderation token, a bug in here — lands as an unmerged pull request with its own
 * Vercel preview instead of on production.
 */
import { Buffer } from 'node:buffer'
import { assertSecret } from '@/lib/token'
import type { TestimonialRecord } from '@/lib/token-types'
import { PROJECT_LABELS, isProjectSlug } from '@/lib/projects-meta'

export type PublishResult =
  | { status: 'already_published' }
  | { status: 'pr_open'; prUrl: string }
  | { status: 'pr_opened'; prUrl: string }

const OWNER = 'seradi96'
const REPO = 'qa-portfolio'
const BASE_BRANCH = 'main'
const FILE_PATH = 'src/content/testimonials.json'
const API = `https://api.github.com/repos/${OWNER}/${REPO}`

function ghHeaders(token: string, withJsonBody: boolean): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'aserban.ro-testimonials',
  }
  if (withJsonBody) h['Content-Type'] = 'application/json'
  return h
}

/** Returned, not thrown, so call sites can `throw await ghError(...)` and TypeScript
 *  sees the control flow end there. */
async function ghError(what: string, res: Response): Promise<Error> {
  const body = await res.text().catch(() => '')
  return new Error(`GitHub ${what} failed: ${res.status} ${res.statusText} ${body.slice(0, 500)}`)
}

/**
 * GitHub hands base64 back wrapped at 60 characters, and the payload is UTF-8.
 * Buffer is the only correct codec here: atob()/btoa() are byte-per-char, so
 * "Șerban" would come back as mojibake and be re-encoded corrupted.
 */
function decodeBase64Utf8(b64: string): string {
  return Buffer.from(b64.replace(/\s+/g, ''), 'base64').toString('utf8')
}

function encodeBase64Utf8(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64')
}
```

The base64 detail is load-bearing and easy to get wrong. `atob()` produces one JavaScript character per *byte*, so `Ș` (two UTF-8 bytes) decodes to two Latin-1 characters; re-encoding with `btoa()` then commits mojibake into the data file — and a Romanian diacritic in a company name is the normal case here, not an edge case. `Buffer.from(b64, 'base64').toString('utf8')` decodes bytes then interprets them as UTF-8, which is the correct round trip. `Buffer` is also why this file is server-only. Stripping whitespace before decoding is belt-and-braces: Node ignores the wrapping newlines anyway.

- [ ] **Step 2: Append the file reader, the idempotency check, and the file renderer**

```ts
type FileOnRef = { entries: unknown[]; sha: string }

async function readFile(token: string, ref: string): Promise<FileOnRef> {
  const res = await fetch(`${API}/contents/${FILE_PATH}?ref=${encodeURIComponent(ref)}`, {
    method: 'GET',
    headers: ghHeaders(token, false),
    cache: 'no-store',
  })
  if (!res.ok) throw await ghError(`read ${FILE_PATH}@${ref}`, res)

  const body = (await res.json()) as { content?: unknown; sha?: unknown; encoding?: unknown }
  if (typeof body.sha !== 'string' || typeof body.content !== 'string' || body.encoding !== 'base64') {
    throw new Error(`GitHub returned an unexpected shape for ${FILE_PATH}@${ref}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(decodeBase64Utf8(body.content))
  } catch {
    throw new Error(`${FILE_PATH}@${ref} is not valid JSON — repair it by hand before publishing`)
  }
  if (!Array.isArray(parsed)) throw new Error(`${FILE_PATH}@${ref} is not a JSON array`)
  return { entries: parsed, sha: body.sha }
}

function containsId(entries: unknown[], id: string): boolean {
  return entries.some(
    (e) => typeof e === 'object' && e !== null && (e as { id?: unknown }).id === id,
  )
}

function publishedAtOf(entry: unknown): string {
  if (typeof entry === 'object' && entry !== null) {
    const v = (entry as { publishedAt?: unknown }).publishedAt
    if (typeof v === 'string') return v
  }
  return '' // a hand-broken entry sorts last rather than crashing the publish
}

/**
 * The file is machine-written: the record goes through JSON.stringify, never a
 * string template. No answer text can break out of its own string literal, so
 * injecting structure into the data file is impossible by construction.
 */
function renderFile(entries: unknown[], record: TestimonialRecord): string {
  const next = [...entries, record]
  next.sort((a, b) => publishedAtOf(b).localeCompare(publishedAtOf(a))) // newest first
  return JSON.stringify(next, null, 2) + '\n'
}
```

Existing entries stay `unknown` on purpose: `src/lib/testimonials.ts` is the validating reader, and this module only ever needs `id` and `publishedAt` off them. `cache: 'no-store'` matters — Next patches global `fetch`, and a cached read here would hand back a stale blob `sha` and turn every publish into a 409.

- [ ] **Step 3: Append the file writer and its single retry**

```ts
async function putFile(
  token: string,
  branch: string,
  sha: string,
  json: string,
  record: TestimonialRecord,
): Promise<Response> {
  return fetch(`${API}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: ghHeaders(token, true),
    body: JSON.stringify({
      message: `content: add testimonial from ${record.author.name} (${record.author.company})\n\nRecord id: ${record.id}`,
      content: encodeBase64Utf8(json),
      sha,
      branch,
    }),
  })
}

/** `sha` is the blob sha of the file as it stands on `branch`. A 409 means it went
 *  stale between our read and our write; re-read the branch and try exactly once more. */
async function putFileWithRetry(
  token: string,
  branch: string,
  sha: string,
  json: string,
  record: TestimonialRecord,
): Promise<void> {
  const first = await putFile(token, branch, sha, json, record)
  if (first.ok) return
  if (first.status !== 409) throw await ghError(`write ${FILE_PATH} on ${branch}`, first)

  const fresh = await readFile(token, branch)
  if (containsId(fresh.entries, record.id)) return // the racing write was this record
  const second = await putFile(
    token,
    branch,
    fresh.sha,
    renderFile(fresh.entries, record),
    record,
  )
  if (!second.ok) throw await ghError(`write ${FILE_PATH} on ${branch} (retry)`, second)
}
```

One retry, not a loop: a second 409 means something is writing the file concurrently and repeatedly, which at ~three submissions a year is a bug, not contention, and should surface as a 502 rather than spin.

- [ ] **Step 4: Append the ref helpers and the pull-request lookup**

```ts
/** `null` when the ref does not exist. Ids are base64url, so `heads/testimonial/<id>`
 *  never needs escaping and can never produce `..` or a trailing `.lock`. */
async function readRefSha(token: string, ref: string): Promise<string | null> {
  const res = await fetch(`${API}/git/ref/${ref}`, {
    method: 'GET',
    headers: ghHeaders(token, false),
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw await ghError(`read ref ${ref}`, res)

  const body = (await res.json()) as { object?: { sha?: unknown } }
  const sha = body.object?.sha
  if (typeof sha !== 'string') throw new Error(`GitHub returned an unexpected shape for ref ${ref}`)
  return sha
}

async function createRef(token: string, ref: string, sha: string): Promise<void> {
  const res = await fetch(`${API}/git/refs`, {
    method: 'POST',
    headers: ghHeaders(token, true),
    body: JSON.stringify({ ref, sha }),
  })
  if (!res.ok) throw await ghError(`create ref ${ref}`, res)
}

async function findOpenPullRequest(token: string, branch: string): Promise<string | null> {
  const query = new URLSearchParams({ state: 'open', head: `${OWNER}:${branch}`, per_page: '1' })
  const res = await fetch(`${API}/pulls?${query.toString()}`, {
    method: 'GET',
    headers: ghHeaders(token, false),
    cache: 'no-store',
  })
  if (!res.ok) throw await ghError(`list pull requests for ${branch}`, res)

  const body = (await res.json()) as unknown
  if (!Array.isArray(body) || body.length === 0) return null
  const url = (body[0] as { html_url?: unknown }).html_url
  return typeof url === 'string' ? url : null
}
```

Note the endpoints: reading a single ref is `GET /git/ref/{ref}` (**singular**, exact match, 404 when absent); creating one is `POST /git/refs` (**plural**) with `{ ref: 'refs/heads/…', sha }`. The plural form on a read is a prefix match and would report the wrong thing. The PR lookup filters by `head=<owner>:<branch>`, which is the only way to ask "is there already a pull request for this branch".

- [ ] **Step 5: Append the pull-request body and the open-or-find call**

```ts
function pullRequestBody(record: TestimonialRecord): string {
  const { author, answers } = record
  const label = isProjectSlug(record.projectSlug)
    ? PROJECT_LABELS[record.projectSlug]
    : record.projectSlug

  const lines: string[] = [
    `**${author.name}** — ${author.role}, ${author.company} (at the time)`,
    '',
    `Project: ${label}`,
    `LinkedIn: https://www.linkedin.com/in/${author.linkedinSlug}`,
    `Submitted ${record.submittedAt} · consent v${record.consent.version} at ${record.consent.at}`,
    '',
    '### To a hiring manager',
    answers.hiringManager,
  ]
  if (answers.whatChanged.trim() !== '') {
    lines.push('', '### What changed because of it', answers.whatChanged)
  }
  if (answers.whatIDid.trim() !== '') {
    lines.push('', '### What I was doing on the team', answers.whatIDid)
  }
  if (answers.anythingElse.trim() !== '') {
    lines.push('', '### Anything else', answers.anythingElse)
  }
  lines.push('', `Record id: \`${record.id}\``, '', 'Merging this publishes it to aserban.ro.')
  return lines.join('\n')
}

async function openOrFindPullRequest(
  token: string,
  branch: string,
  record: TestimonialRecord,
): Promise<PublishResult> {
  const res = await fetch(`${API}/pulls`, {
    method: 'POST',
    headers: ghHeaders(token, true),
    body: JSON.stringify({
      title: `Testimonial: ${record.author.name} (${record.author.company})`,
      body: pullRequestBody(record),
      head: branch,
      base: BASE_BRANCH,
    }),
  })

  if (res.ok) {
    const body = (await res.json()) as { html_url?: unknown }
    if (typeof body.html_url !== 'string') {
      throw new Error('GitHub opened the pull request but returned no html_url')
    }
    return { status: 'pr_opened', prUrl: body.html_url }
  }

  // 422 is GitHub refusing a second pull request for the same head branch. On a
  // phone the likely cause is a double tap, so answer with the one that exists
  // instead of a 502. Never an error, never a duplicate.
  if (res.status === 422) {
    const open = await findOpenPullRequest(token, branch)
    if (open !== null) return { status: 'pr_open', prUrl: open }
  }
  throw await ghError(`open pull request for ${branch}`, res)
}
```

The PR body leads with the hiring-manager answer and carries the full LinkedIn URL, so the review decision can be made from the GitHub mobile notification without opening the preview. The title is `Testimonial: <name> (<company>)`; identity fields already passed the `sanitizeIdentity` allowlist, which admits no newlines, so nothing here can break the title.

- [ ] **Step 6: Append the exported entry point**

```ts
/**
 * Idempotent in two places: an id already on main is `already_published`, and an
 * existing branch returns its open pull request instead of opening a second one.
 * The caller stamps `record.publishedAt` before calling — this module writes the
 * record it is given, verbatim.
 */
export async function publishTestimonial(record: TestimonialRecord): Promise<PublishResult> {
  const token = assertSecret('GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  const branch = `testimonial/${record.id}`

  const base = await readFile(token, BASE_BRANCH)
  if (containsId(base.entries, record.id)) return { status: 'already_published' }

  const existingBranch = await readRefSha(token, `heads/${branch}`)
  if (existingBranch !== null) {
    const open = await findOpenPullRequest(token, branch)
    if (open !== null) return { status: 'pr_open', prUrl: open }

    // A branch with no open pull request: a previous call died between creating
    // the ref and opening the pull request, or the pull request was closed by
    // hand. Finish the job on the branch that is already there.
    const onBranch = await readFile(token, branch)
    if (!containsId(onBranch.entries, record.id)) {
      await putFileWithRetry(
        token,
        branch,
        onBranch.sha,
        renderFile(onBranch.entries, record),
        record,
      )
    }
    return openOrFindPullRequest(token, branch, record)
  }

  const mainHead = await readRefSha(token, `heads/${BASE_BRANCH}`)
  if (mainHead === null) throw new Error(`GitHub has no ref heads/${BASE_BRANCH}`)
  await createRef(token, `refs/heads/${branch}`, mainHead)

  // The branch was just cut from main, so main's blob sha is the branch's blob sha.
  await putFileWithRetry(token, branch, base.sha, renderFile(base.entries, record), record)

  return openOrFindPullRequest(token, branch, record)
}
```

Order matters. The `main` check comes first because after a merge the branch is usually deleted, so "already published" must not be answered by "no branch, let me make one". The branch check comes second and answers with the existing PR rather than a second one. One branch per submission (`testimonial/<id>`) means two pending testimonials can never conflict.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, then `Finished TypeScript` with no errors. The route table is unchanged from Task 8 — this file adds no route. Exit code 0.

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: no output, exit code 0.

- [ ] **Step 9: Transcription check on the API surface**

Run: `grep -cE "api\.github\.com|vnd\.github\+json|2022-11-28|/contents/|/git/ref/|/git/refs|/pulls|Buffer\.from" src/lib/publish-to-git.ts`
Expected: `11` — the API base, the two versioned headers, the two `/contents/` calls (read and PUT), `/git/ref/` (read one ref), `/git/refs` (create one ref), the two `/pulls` calls (list and create), and the two `Buffer.from` conversions. A lower number means an endpoint or a base64 conversion was dropped in transcription.

- [ ] **Step 10: Record what is and is not verified**

`publish-to-git.ts` has **no automated test and cannot have one**. `scripts/token-roundtrip.mjs` runs pure functions with no network; every branch in this file is a real, authenticated, side-effecting call against the live repository, and there is no fixture, no mock layer, and no new dependency budget to add one. `npm run build` proves it compiles and `npm run lint` proves it is clean; neither proves a pull request opens.

It is verified **only** by the live rehearsal in spec §18.4:
- **item 6** — tap Publish once: the branch is created, the file is written, the pull request opens, its Vercel preview renders the card, and merging deploys within ~90 s (this covers the `pr_opened` path end to end, including the UTF-8 base64 round trip on a real name);
- **item 7** — tap the same Publish link a second time: `pr_open`, the existing pull request, not an error and not a duplicate. Merge, then tap a third time: `already_published`. (This is the only check on both idempotency branches, and it is the one most likely to reveal a mistake.)

Run item 6 before item 7, in that order, against an invite the owner minted to himself. Do not mark the write path done until both have actually been run.

- [ ] **Step 11: Commit**

```bash
git add src/lib/publish-to-git.ts
git commit -m "feat(testimonials): publish approved records as a branch and pull request"
```

---

### Task 10: Submission route handler (`POST /api/testimonials/submit`)

**Files:**
- Create: `src/app/api/testimonials/submit/route.ts`

**Interfaces:**
- Consumes: `SITE_ORIGIN`, `MAX_MODERATION_URL_CHARS`, `assertSecret`, `verifyInviteToken`, `signModerationToken` from `@/lib/token`; `FieldError`, `CAPS`, `sanitizeAnswer`, `sanitizeIdentity`, `extractLinkedinSlug` from `@/lib/sanitize`; `isProjectSlug` from `@/lib/projects-meta`; `CONSENT_VERSION` from `@/lib/consent`; `sendModerationEmail` from `@/lib/notify`; `TestimonialRecord` (type) from `@/lib/token-types`.
- Produces: no exported symbols. Produces the HTTP endpoint `POST /api/testimonials/submit`, which the `/invite` form posts to in a later task. Response shapes: 200 `{ ok: true }` · 400 `{ error }` · 403 `{ error }` · 410 `{ error }` · 413 `{ error }` · 422 `{ field, message }` · 503 `{ error }` · 500 `{ error }`.

**Two contract assumptions this handler is built on. Check them against Tasks 1–3 before you start; if either is false, fix the lib, not this route:**
1. `verifyInviteToken` returns `null` for a bad signature or an undecodable payload but **does not** reject on expiry. Expiry is checked here, so a forged token (403) and an honest expired one (410) get different, honest answers. `decodeInviteFields`'s "null on bad exp" means a non-numeric `exp`, not a past one.
2. `assertSecret(name, value)` throws when the value is missing or too short, and its message names the *variable*, never the value.

**⚠️ CRITICAL — you cannot exercise this handler from a browser under `npm run dev`.**
The `Origin` check compares against the hardcoded `SITE_ORIGIN` constant. A browser at `http://localhost:3000` sends `Origin: http://localhost:3000`, so the form will 403 locally, forever, by design — there is no localhost exemption and no env override, because an env override is exactly the thing a misconfigured environment would widen. The way you develop the write path is:

```
1. Edit src/lib/token.ts in the WORKING TREE ONLY:
     export const SITE_ORIGIN = 'https://<your-preview>.vercel.app'
2. npx vercel deploy          # uploads the working tree — the edit never needs a commit
3. Add INVITE_SECRET / MOD_SECRET / RESEND_API_KEY to the *Preview* environment for the
   rehearsal, and delete them afterwards: §16 pins all four to Production only.
4. git checkout -- src/lib/token.ts    # revert before you commit anything
```

Spec §18.4 item 9 — *deploy a preview branch, attempt a submit, the `Origin` check fails it closed* — is the check that this edit never shipped. Step 6 below is the cheap local version of the same guard.

(`curl` can spoof any `Origin`, so the two local checks below *do* reach the handler. That is not a hole: the `Origin` check is layer 3 of §9.1's four, aimed at browser-originated cross-site POSTs and at mail scanners like Defender Safe Links. The HMAC is what stops a determined caller.)

- [ ] **Step 1: Create the route file**

Run: `mkdir -p src/app/api/testimonials/submit`

Then write `src/app/api/testimonials/submit/route.ts`:

```ts
// POST /api/testimonials/submit — spec §7.
//
// There is deliberately NO `export const runtime` in this file. 'nodejs' is the
// default in Next 16, and 'edge' is deprecated there AND hard-fails the build the
// moment anything in the import graph touches node:crypto — which @/lib/token does.
// Adding `export const runtime = 'edge'` is the one reflex an experienced Next
// developer has when they see a route handler. Do not.

import { randomBytes } from 'node:crypto'

import { CONSENT_VERSION } from '@/lib/consent'
import { sendModerationEmail } from '@/lib/notify'
import { isProjectSlug } from '@/lib/projects-meta'
import {
  CAPS,
  FieldError,
  extractLinkedinSlug,
  sanitizeAnswer,
  sanitizeIdentity,
} from '@/lib/sanitize'
import {
  MAX_MODERATION_URL_CHARS,
  SITE_ORIGIN,
  assertSecret,
  signModerationToken,
  verifyInviteToken,
} from '@/lib/token'
import type { TestimonialRecord } from '@/lib/token-types'

/** §7 step 1. Roughly 8x the largest legitimate submission at the §5 caps. */
const MAX_BODY_BYTES = 16384

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * Reads at most MAX_BODY_BYTES from the request, whatever Content-Length claimed.
 * Returns null when the body is over budget. Counting what actually arrives, chunk
 * by chunk, is what makes a lying Content-Length header unable to force an
 * allocation — the header check alone is advisory.
 */
async function readBoundedText(req: Request): Promise<string | null> {
  const stream = req.body
  if (stream === null) return ''
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value === undefined) continue
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const joined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8').decode(joined)
}

export async function POST(req: Request): Promise<Response> {
  // §7.1 — size gate, before any parsing.
  const declaredLength = req.headers.get('content-length')
  if (declaredLength !== null) {
    const declared = Number(declaredLength)
    if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) {
      return json({ error: 'That submission is too large to accept.' }, 413)
    }
  }

  // §7.2 — Origin. A hardcoded module constant, never an env var, so a
  // misconfigured environment cannot widen it and every preview fails closed.
  if (req.headers.get('origin') !== SITE_ORIGIN) {
    return json({ error: 'Requests must come from aserban.ro.' }, 403)
  }

  try {
    // Read inside the handler, never at module scope: `next build` evaluates route
    // modules, so a module-scope assertSecret would fail the build on any machine
    // without the secrets rather than the request that needs them.
    const inviteSecret = assertSecret('INVITE_SECRET', process.env.INVITE_SECRET)
    const modSecret = assertSecret('MOD_SECRET', process.env.MOD_SECRET)

    const raw = await readBoundedText(req)
    if (raw === null) {
      return json({ error: 'That submission is too large to accept.' }, 413)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return json({ error: 'Malformed request body.' }, 400)
    }
    const body = asObject(parsed)
    if (body === null) {
      return json({ error: 'Malformed request body.' }, 400)
    }

    // §7.3 — verify the i1-domain HMAC. The length check before timingSafeEqual
    // lives in token.ts; without it a wrong-length signature throws RangeError and
    // this becomes a 500 instead of a 403.
    const token = body.token
    if (typeof token !== 'string') {
      return json({ error: 'This link is not valid.' }, 403)
    }
    const invite = verifyInviteToken(token, inviteSecret)
    if (invite === null) {
      return json({ error: 'This link is not valid.' }, 403)
    }

    // §7.4 — expiry. Separate from the signature check so an expired invite gets a
    // human answer instead of looking like a forgery. exp is unix SECONDS.
    if (invite.exp * 1000 < Date.now()) {
      return json(
        {
          error:
            'This invite link has expired. Ask Andrei for a fresh one — andre.serban96@gmail.com.',
        },
        410,
      )
    }

    // §7.5 — sanitize every field. The invite only prefills; the submitted values
    // win, because the form lets the author correct them. sanitizeIdentity,
    // sanitizeAnswer and extractLinkedinSlug throw FieldError, caught below as 422.
    const submittedSlug = body.projectSlug
    if (!isProjectSlug(submittedSlug)) {
      return json({ field: 'projectSlug', message: 'Pick one of the listed projects.' }, 422)
    }

    const name = sanitizeIdentity('name', body.name, CAPS.name)
    const role = sanitizeIdentity('role', body.role, CAPS.role)
    const company = sanitizeIdentity('company', body.company, CAPS.company)
    const linkedinSlug = extractLinkedinSlug(body.linkedinSlug)

    const answersRaw = asObject(body.answers) ?? {}
    const answers = {
      whatIDid: sanitizeAnswer('whatIDid', answersRaw.whatIDid, CAPS.whatIDid),
      whatChanged: sanitizeAnswer('whatChanged', answersRaw.whatChanged, CAPS.whatChanged),
      hiringManager: sanitizeAnswer(
        'hiringManager',
        answersRaw.hiringManager,
        CAPS.hiringManager,
        true,
      ),
      anythingElse: sanitizeAnswer('anythingElse', answersRaw.anythingElse, CAPS.anythingElse),
    }

    // §7.5 — consent must be exactly true. Not truthy: the string "false" is truthy.
    if (body.consent !== true) {
      return json(
        { field: 'consent', message: 'Please tick the consent box before sending.' },
        422,
      )
    }

    // §7.6 — 9 random bytes is exactly 12 base64url characters with no padding.
    // Carried in the payload so publishing is idempotent, and it becomes the git
    // ref `testimonial/<id>`; base64url cannot produce `..` or a trailing `.lock`.
    const now = new Date()
    const day = now.toISOString().slice(0, 10)
    // toISOString() carries milliseconds; §5 stores seconds. '2026-09-13T18:42:07Z'.
    const consentAt = now.toISOString().replace(/\.\d{3}Z$/, 'Z')

    const record: TestimonialRecord = {
      id: randomBytes(9).toString('base64url'),
      projectSlug: submittedSlug,
      // Provisional only. §5: publishedAt is stamped when the pull request is
      // OPENED, so /api/testimonials/publish overwrites this. It exists here so the
      // moderation preview renders a plausible date through the real card.
      publishedAt: day,
      submittedAt: day,
      consent: { version: CONSENT_VERSION, at: consentAt },
      author: { name, role, company, linkedinSlug },
      answers,
    }

    // §7.7 — sign under m1 (gzip happens inside signModerationToken) and assert the
    // whole moderation URL fits. Measured worst case today is 928 chars; the assert
    // is what keeps a later cap increase from silently producing an unusable link.
    const moderationToken = signModerationToken(record, modSecret)
    const moderationUrl = `${SITE_ORIGIN}/moderate#a=publish&t=${moderationToken}`
    if (moderationUrl.length > MAX_MODERATION_URL_CHARS) {
      const overUrlChars = moderationUrl.length - MAX_MODERATION_URL_CHARS
      // base64url spends 4 characters per 3 compressed bytes, and one compressed
      // byte never stands for less than one source character, so ceil(over * 3 / 4)
      // never under-states the trim. Asking for slightly too much beats a second
      // rejection after they have already retyped.
      const trimBy = Math.ceil((overUrlChars * 3) / 4)
      return json(
        {
          error: `Your answers are about ${trimBy} characters too long to fit in one link. Shorten them a little and send again — nothing you typed has been lost.`,
        },
        413,
      )
    }

    // §7.8 — THE SEND IS THE COMMIT POINT. Nothing in this feature is stored
    // anywhere, so a failed send does not leave a half-succeeded write to
    // reconcile: either the owner has the submission or the submitter still does.
    // 503 tells the form to keep every typed answer and offer a retry.
    try {
      await sendModerationEmail(record, moderationToken)
    } catch {
      return json(
        {
          error:
            'Could not deliver this to Andrei right now. Nothing was lost — please try again in a minute.',
        },
        503,
      )
    }

    return json({ ok: true }, 200)
  } catch (err) {
    if (err instanceof FieldError) {
      return json({ field: err.field, message: err.message }, 422)
    }
    // Name only, never the message: an Error thrown from a signing or HTTP path can
    // carry a key or a token in its text, and §10 requires the credentials never be
    // logged. This endpoint runs ~15 times in its life; under-logging is the right
    // trade for third-party consent data.
    console.error(
      '[testimonials/submit] unhandled:',
      err instanceof Error ? err.name : typeof err,
    )
    return json({ error: 'Something went wrong on our side.' }, 500)
  }
}
```

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, and the Route (app) table gains a line `ƒ /api/testimonials/submit`. `/` must still show `○` — if it flipped to `ƒ`, something imported the route into the page graph and §18.3's static-route gate will fail later.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: exits 0 with no output. A non-zero exit here is almost always an unused import — remove it, do not add a disable comment.

- [ ] **Step 4: Local wiring check — the route exists and fails closed**

Start `npm run dev` in another terminal, then:

Run:
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/testimonials/submit \
  -H 'content-type: application/json' -H 'origin: http://localhost:3000' -d '{}'
```
Expected: `403` — exactly what the real form would get from a browser at localhost. This is the whole local story: the endpoint is mounted and the `Origin` gate is live. A `404` means the file is in the wrong directory; a `405` means you exported something other than `POST`.

- [ ] **Step 5: Local handler check — the signature gate is reached**

Requires `INVITE_SECRET` and `MOD_SECRET` in `.env.local` (the same file `npm run invite` reads).

Run:
```bash
curl -s -w '\n%{http_code}\n' -X POST http://localhost:3000/api/testimonials/submit \
  -H 'content-type: application/json' -H 'origin: https://aserban.ro' \
  -d '{"token":"aaaa.bbbb"}'
```
Expected:
```
{"error":"This link is not valid."}
403
```
If you instead get `{"error":"Something went wrong on our side."}` and `500`, the secrets are missing from `.env.local` — which also proves `assertSecret` is wired. Add them and re-run.

- [ ] **Step 6: Guard — confirm `SITE_ORIGIN` was not edited**

Run: `git diff -- src/lib/token.ts && grep -n "SITE_ORIGIN = " src/lib/token.ts`
Expected: no diff output at all, then `export const SITE_ORIGIN = 'https://aserban.ro'`. If the diff is non-empty you still have the preview-origin edit from the rehearsal in your tree — `git checkout -- src/lib/token.ts` before committing.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/testimonials/submit/route.ts
git commit -m "feat(testimonials): add invite-verified submission endpoint"
```

**What is verified, and what is not.** `npm run build` + `npm run lint` prove it compiles and the route is mounted; step 4 proves it fails closed; step 5 proves the HMAC gate is reached. Nothing here proves an email arrives or that a real invite round-trips — `npm run check:tokens` covers the codec and the 1900-character URL budget (§18.2 assertions 1–6), and the rest is manual: **§18.4 items 3** (submit, thank-you screen shows the answers back verbatim), **4** (the mail lands in the inbox and is readable with zero taps — set the Gmail filter then), **8** (an invite minted with `exp` in the past), and **9** (a preview deployment 403s, proving the `SITE_ORIGIN` edit never shipped).

---

### Task 11: Publish route handler (`POST /api/testimonials/publish`)

**Files:**
- Create: `src/app/api/testimonials/publish/route.ts`

**Interfaces:**
- Consumes: `SITE_ORIGIN`, `assertSecret`, `verifyModerationToken` from `@/lib/token`; `FieldError`, `CAPS`, `sanitizeAnswer`, `sanitizeIdentity`, `extractLinkedinSlug` from `@/lib/sanitize`; `isProjectSlug` from `@/lib/projects-meta`; `CONSENT_VERSION` from `@/lib/consent`; `publishTestimonial` and the `PublishResult` type from `@/lib/publish-to-git`; `TestimonialRecord` (type) from `@/lib/token-types`.
- Produces: no exported symbols. Produces the HTTP endpoint `POST /api/testimonials/publish`, which `ModeratePanel` posts `{ t }` to in a later task. Response shapes: 200 `PublishResult` (`{ status: 'already_published' }` | `{ status: 'pr_open', prUrl }` | `{ status: 'pr_opened', prUrl }`) · 400 `{ error }` · 403 `{ error }` · 413 `{ error }` · 422 `{ field, message }` · 502 `{ error }` · 500 `{ error }`.

**Contract assumption:** `verifyModerationToken` does the whole inbound half of §10 step 2 — split, length-guarded `timingSafeEqual` under the `m1` domain tag, base64url-decode, **gunzip**, `JSON.parse` — and returns `null` on any failure. This route never touches `node:zlib` itself. Confirm that before you start; if `verifyModerationToken` returns the still-gzipped bytes, fix `token.ts`, not this route.

**⚠️ Same `Origin` warning as Task 10.** This handler 403s against a browser at localhost, permanently and by design. Develop it against a preview deployment with `SITE_ORIGIN` temporarily repointed in an **uncommitted working-tree edit** (`npx vercel deploy` uploads the working tree, so the edit never needs a commit), then `git checkout -- src/lib/token.ts`. Spec §18.4 item 9 is the check that the edit never shipped; step 6 below is the local pre-commit version.

**Why there is no rate limiting and no CAPTCHA on this endpoint — and why a `Map` throttle is refused rather than merely skipped.** The capability here is a signed `m1` token that only ever existed in the owner's own inbox; there is nothing to enumerate and no anonymous surface to flood. §14 caps the lifetime volume at roughly fifteen submissions. The tempting mitigation is a module-scoped `Map<string, number>` of last-seen timestamps — five lines, feels responsible. It is refused, not omitted: on Vercel that `Map` is per-lambda-instance, so it resets on every cold start and is not shared across concurrent invocations. Under any load it would actually stop, it is not there. Shipping it would put a control in the code that reads as protection during a future review while providing none, which is worse than the honest absence. IP logging is refused on the same page for a different reason — it adds a personal-data category with a retention duty (CJEU *Breyer*) in exchange for a control the invite link already provides. The real containment is §10's design: a replayed publish link produces an unmerged **pull request**, not a live change, and it needs a second deliberate human tap to reach production.

- [ ] **Step 1: Create the route file**

Run: `mkdir -p src/app/api/testimonials/publish`

Then write `src/app/api/testimonials/publish/route.ts`:

```ts
// POST /api/testimonials/publish — spec §10 steps 1, 2 and 9.
//
// No `export const runtime` here either: 'nodejs' is the Next 16 default, and
// 'edge' is deprecated and hard-fails the build on node:crypto / node:zlib, both of
// which @/lib/token uses.
//
// No rate limiting and no CAPTCHA, deliberately (§14). A module-scoped Map throttle
// is REFUSED rather than omitted: on Vercel it resets on every cold start and is not
// shared across concurrent lambdas, so it is theatre that reads as protection. The
// containment that does work is that a replayed link opens a pull request, not a
// live change.

import { CONSENT_VERSION } from '@/lib/consent'
import { isProjectSlug } from '@/lib/projects-meta'
import { publishTestimonial, type PublishResult } from '@/lib/publish-to-git'
import {
  CAPS,
  FieldError,
  extractLinkedinSlug,
  sanitizeAnswer,
  sanitizeIdentity,
} from '@/lib/sanitize'
import { SITE_ORIGIN, assertSecret, verifyModerationToken } from '@/lib/token'
import type { TestimonialRecord } from '@/lib/token-types'

/** The body is one moderation token, itself capped at 1900 URL characters. */
const MAX_BODY_BYTES = 8192

const ID_RE = /^[A-Za-z0-9_-]{12}$/
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * Bounded read, byte-counted so a lying Content-Length cannot force an allocation.
 * Deliberately duplicated from the submit route rather than shared: the interface
 * contract fixes the exported surface of every lib module and this helper is not in
 * it, so it stays module-private in both places.
 */
async function readBoundedText(req: Request): Promise<string | null> {
  const stream = req.body
  if (stream === null) return ''
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value === undefined) continue
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const joined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8').decode(joined)
}

type Revalidated =
  | { ok: true; record: TestimonialRecord }
  | { ok: false; field: string; message: string }

/**
 * §10 step 2, the second half. A valid signature proves *we* produced this payload.
 * It does not prove the payload is still well-formed: it may have been signed weeks
 * ago by a previous deploy under previous caps, and it is about to be written into a
 * JSON file that ships to production. So every field goes back through the same
 * sanitiser the submit route used, and the RE-SANITISED values are what get
 * published — never the values that arrived on the wire.
 *
 * Takes `unknown` on purpose: verifyModerationToken hands back a TestimonialRecord
 * type, but the underlying value is whatever JSON was inside the gzip, so the type
 * is an assertion rather than a proof.
 */
function revalidate(input: unknown): Revalidated {
  const rec = asObject(input)
  if (rec === null) return { ok: false, field: 'record', message: 'Malformed record.' }

  const author = asObject(rec.author)
  const answers = asObject(rec.answers)
  const consent = asObject(rec.consent)
  if (author === null || answers === null || consent === null) {
    return { ok: false, field: 'record', message: 'Malformed record.' }
  }

  // The id becomes the git ref `testimonial/<id>`. base64url cannot produce `..` or
  // a trailing `.lock`, but this is where that guarantee is actually enforced.
  const id = rec.id
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    return { ok: false, field: 'id', message: 'Malformed record id.' }
  }

  const projectSlug = rec.projectSlug
  if (!isProjectSlug(projectSlug)) {
    return { ok: false, field: 'projectSlug', message: 'Unknown project.' }
  }

  const submittedAt = rec.submittedAt
  if (typeof submittedAt !== 'string' || !DAY_RE.test(submittedAt)) {
    return { ok: false, field: 'submittedAt', message: 'Malformed submission date.' }
  }

  // A token can never carry a consent version we have not written yet.
  const version = consent.version
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1 ||
    version > CONSENT_VERSION
  ) {
    return { ok: false, field: 'consent', message: 'Unknown consent version.' }
  }
  const consentAt = consent.at
  if (typeof consentAt !== 'string' || !ISO_RE.test(consentAt)) {
    return { ok: false, field: 'consent', message: 'Malformed consent timestamp.' }
  }

  try {
    return {
      ok: true,
      record: {
        id,
        projectSlug,
        // Placeholder; the caller stamps the real pull-request-open date.
        publishedAt: submittedAt,
        submittedAt,
        consent: { version, at: consentAt },
        author: {
          name: sanitizeIdentity('name', author.name, CAPS.name),
          role: sanitizeIdentity('role', author.role, CAPS.role),
          company: sanitizeIdentity('company', author.company, CAPS.company),
          linkedinSlug: extractLinkedinSlug(author.linkedinSlug),
        },
        answers: {
          whatIDid: sanitizeAnswer('whatIDid', answers.whatIDid, CAPS.whatIDid),
          whatChanged: sanitizeAnswer('whatChanged', answers.whatChanged, CAPS.whatChanged),
          hiringManager: sanitizeAnswer(
            'hiringManager',
            answers.hiringManager,
            CAPS.hiringManager,
            true,
          ),
          anythingElse: sanitizeAnswer('anythingElse', answers.anythingElse, CAPS.anythingElse),
        },
      },
    }
  } catch (err) {
    if (err instanceof FieldError) {
      return { ok: false, field: err.field, message: err.message }
    }
    throw err
  }
}

export async function POST(req: Request): Promise<Response> {
  // §10 step 1 — Origin. Hardcoded constant, never an env var. This is layer 3 of
  // §9.1: layer 2 (the capability lives in the URL fragment) is what stops mail
  // scanners, because they never obtain the token at all.
  if (req.headers.get('origin') !== SITE_ORIGIN) {
    return json({ error: 'Requests must come from aserban.ro.' }, 403)
  }

  try {
    const modSecret = assertSecret('MOD_SECRET', process.env.MOD_SECRET)

    const raw = await readBoundedText(req)
    if (raw === null) {
      return json({ error: 'Request body too large.' }, 413)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return json({ error: 'Malformed request body.' }, 400)
    }
    const body = asObject(parsed)
    if (body === null || typeof body.t !== 'string') {
      return json({ error: 'Malformed request body.' }, 400)
    }

    // §10 step 2, first half: length-guarded timingSafeEqual under the m1 domain
    // tag, then gunzip — both inside verifyModerationToken.
    const signed = verifyModerationToken(body.t, modSecret)
    if (signed === null) {
      return json({ error: 'This approval link is not valid.' }, 403)
    }

    const checked = revalidate(signed)
    if (!checked.ok) {
      return json({ field: checked.field, message: checked.message }, 422)
    }
    const record = checked.record

    // §5 — publishedAt is stamped at the moment the pull request is OPENED, not at
    // submit and not at merge. Under §3 decision 2 those can differ by days. It is a
    // sort key and a display date only; nothing anywhere records when a testimonial
    // actually went live, which is why §10.1's copy carries no relative time.
    record.publishedAt = new Date().toISOString().slice(0, 10)

    // §10 steps 3-8 all live in publishTestimonial: read main, idempotency by id and
    // by branch, create the ref, PUT the file with one retry on 409, open the pull
    // request. Its PublishResult is returned verbatim; ModeratePanel switches on
    // `status` to pick between the three §10.1 strings, so none of the three is an
    // error and none is a duplicate.
    let result: PublishResult
    try {
      result = await publishTestimonial(record)
    } catch (err) {
      console.error(
        '[testimonials/publish] github failed:',
        err instanceof Error ? err.name : typeof err,
      )
      return json(
        {
          error:
            'GitHub refused the write. Nothing was published, and the email still has everything — retry, or use the manual fallback links in it.',
        },
        502,
      )
    }

    return json(result, 200)
  } catch (err) {
    // Name only, never the message: GITHUB_TOKEN must never be logged (§10), and an
    // Error from an HTTP client is exactly where a credential can end up in text.
    console.error(
      '[testimonials/publish] unhandled:',
      err instanceof Error ? err.name : typeof err,
    )
    return json({ error: 'Something went wrong on our side.' }, 500)
  }
}
```

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, and the Route (app) table now lists both `ƒ /api/testimonials/publish` and `ƒ /api/testimonials/submit`. `/` must still be `○`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: exits 0 with no output.

- [ ] **Step 4: Local wiring check — the route exists and fails closed**

With `npm run dev` running:

Run:
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/testimonials/publish \
  -H 'content-type: application/json' -H 'origin: http://localhost:3000' -d '{"t":"x"}'
```
Expected: `403`. A `404` means the file is in the wrong directory.

- [ ] **Step 5: Local handler check — the signature gate is reached**

Requires `MOD_SECRET` in `.env.local`.

Run:
```bash
curl -s -w '\n%{http_code}\n' -X POST http://localhost:3000/api/testimonials/publish \
  -H 'content-type: application/json' -H 'origin: https://aserban.ro' \
  -d '{"t":"aaaa.bbbb"}'
```
Expected:
```
{"error":"This approval link is not valid."}
403
```
Critically, **not** a 500: a wrong-length signature must not escape as a `RangeError` from `timingSafeEqual`. If you see `{"error":"Something went wrong on our side."}` with a `RangeError` in the dev-server log, the length guard is missing from `token.ts` — fix it there, this is §18.2 assertion 5. (If `MOD_SECRET` is absent you also get a 500, but with no `RangeError` in the log; add it and re-run.)

- [ ] **Step 6: Guard — confirm `SITE_ORIGIN` was not edited**

Run: `git diff -- src/lib/token.ts && grep -n "SITE_ORIGIN = " src/lib/token.ts`
Expected: no diff output, then `export const SITE_ORIGIN = 'https://aserban.ro'`.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/testimonials/publish/route.ts
git commit -m "feat(testimonials): add signed publish endpoint"
```

**What is verified, and what is not.** The build and lint prove it compiles and mounts; steps 4 and 5 prove the `Origin` gate and the signature gate, including that a bad signature is a 403 and not a 500. No automated test reaches the GitHub write path — `npm run check:tokens` stops at the codec. The rest is manual: **§18.4 item 6** (tap Publish once — `DecompressionStream` works in the real browser, the preview card matches the live card, the pull request opens, the Vercel preview renders it, the merge deploys within ~90 s), **item 7** (tap the same link a second time → `pr_open`, "Pull request already open"; merge, then tap a third time → `already_published`, "Already published" — never an error, never a duplicate), and **item 9** (a preview deployment 403s, proving the `SITE_ORIGIN` edit never shipped). Items 6 and 7 are the two that will actually bite; neither is automatable.

---

### Task 12: `/invite` — the page gate and the form

**Files:**
- Create: `src/app/invite/layout.tsx`
- Create: `src/app/invite/TestimonialForm.tsx`
- Create: `src/app/invite/page.tsx`

**Interfaces:**
- Consumes: `decodeInviteUnverified(fragment: string): InviteFields | null` from `@/lib/token-client` (the `fragment` is the whole `payload.sig` token string, i.e. everything after `#`); `InviteFields` from `@/lib/token-types`; `CAPS`, `graphemeCount` from `@/lib/sanitize`; `PROJECT_SLUGS`, `PROJECT_LABELS`, `isProjectSlug`, `ProjectSlug` from `@/lib/projects-meta`; `CONSENT_TEXT_V1` from `@/lib/consent`; `POST /api/testimonials/submit`
- Produces: `src/app/invite/TestimonialForm.tsx` default export `TestimonialForm({ token, fields, storageKey }: { token: string; fields: InviteFields; storageKey: string })`. Nothing else in the plan imports these files; `/invite` is a leaf route.

Why this shape: the page owns the *gate* (is there a fragment, does it decode, has it expired) and the form owns everything after the gate opens. That split is the whole reason the expiry message can render before a single textarea exists — the form component is never mounted for an expired invite, so nobody can write 400 words and then collect a 410.

- [ ] **Step 1: Create the noindex layout**

`src/app/invite/layout.tsx` — a server component, so `metadata` is allowed here (a `'use client'` file cannot export `metadata`). This is the only reason the layout exists.

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children
}
```

`React.ReactNode` without an import matches `src/app/layout.tsx:188`, which does the same — the UMD namespace is legal in a type position.

- [ ] **Step 2: Create `TestimonialForm.tsx` — header, copy constants and module-private helpers**

Create the file with exactly this content. The four questions live in a data array rather than inline JSX: they are plain JS strings, so `react/no-unescaped-entities` does not apply to them and the copy can be pasted from §13.1 byte-for-byte without hunting for apostrophes. The prose blocks further down *are* JSX text and are written pre-escaped.

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CAPS, graphemeCount } from '@/lib/sanitize'
import { PROJECT_LABELS, PROJECT_SLUGS, isProjectSlug, type ProjectSlug } from '@/lib/projects-meta'
import { CONSENT_TEXT_V1 } from '@/lib/consent'
import type { InviteFields } from '@/lib/token-types'

type AnswerKey = 'whatIDid' | 'whatChanged' | 'hiringManager' | 'anythingElse'

type Question = {
  key: AnswerKey
  label: string
  optional: boolean
  cap: number
  help: string
  placeholder?: string
  enterKeyHint?: 'done'
}

/**
 * Spec §13.1, verbatim. The placeholders are load-bearing: the failure mode of a testimonials
 * section is "He was great to work with", and a worked example is the only thing that reliably
 * prevents it. Do not shorten them into hints.
 */
const QUESTIONS: Question[] = [
  {
    key: 'whatIDid',
    label: 'What was I actually doing on the team?',
    optional: true,
    cap: CAPS.whatIDid,
    help: "One line is plenty — how you'd describe my job to someone who wasn't there.",
    placeholder:
      'He owned the end-to-end suite and was the person we pinged when a pipeline went red at 6pm.',
  },
  {
    key: 'whatChanged',
    label: 'What changed because of it?',
    optional: true,
    cap: CAPS.whatChanged,
    help: "The concrete bit. A number if you have one; if you don't, just what got easier, faster, or less painful.",
    placeholder:
      'Regression used to eat two days of manual clicking. After his framework landed it ran overnight and we stopped shipping on Fridays with our fingers crossed.',
  },
  {
    key: 'hiringManager',
    label: 'What would you tell a hiring manager who asked about him?',
    optional: false,
    cap: CAPS.hiringManager,
    help: 'The honest version, caveats included. This is the one people actually read.',
    placeholder:
      "I'd work with him again. He'll push back if he thinks the plan is wrong, which is exactly what you want in a QA lead.",
  },
  {
    key: 'anythingElse',
    label: 'Anything else?',
    optional: true,
    cap: CAPS.anythingElse,
    help: 'A story, a moment, something the questions above missed. Skip it if nothing comes to mind.',
    enterKeyHint: 'done',
  },
]

type Draft = {
  name: string
  role: string
  company: string
  linkedinSlug: string
  projectSlug: ProjectSlug
  whatIDid: string
  whatChanged: string
  hiringManager: string
  anythingElse: string
}

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; message: string; field?: string }
  | { kind: 'sent' }

const OWNER_EMAIL = 'andre.serban96@gmail.com'

const TEXTAREA_CLASS =
  'mt-2 w-full field-sizing-content min-h-24 resize-y rounded-xl border border-white/10 bg-white/5 ' +
  'px-4 py-3 text-base text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 ' +
  'focus:ring-amber-500'

const INPUT_CLASS =
  'mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-gray-100 ' +
  'placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500'

// text-base (16px) on every control is deliberate: iOS Safari zooms the viewport on focus for
// anything smaller, and the zoom does not undo itself when the field blurs.

function initialDraft(fields: InviteFields): Draft {
  return {
    name: fields.name,
    role: fields.role,
    company: fields.company,
    linkedinSlug: '',
    projectSlug: isProjectSlug(fields.projectSlug) ? fields.projectSlug : 'other',
    whatIDid: '',
    whatChanged: '',
    hiringManager: '',
    anythingElse: '',
  }
}

/**
 * Unwraps a pasted profile URL down to the slug so the static "linkedin.com/in/" prefix is not
 * doubled. Module-private on purpose: `extractLinkedinSlug` in @/lib/sanitize is the real
 * validator and it runs server-side, where rejecting is safe. Calling a throwing validator on
 * every keystroke would crash the form halfway through a paste.
 */
function stripLinkedinUrl(raw: string): string {
  let v = raw.trim()
  v = v.replace(/^https?:\/\//i, '')
  v = v.replace(/^([a-z0-9-]+\.)*linkedin\.com\//i, '')
  v = v.replace(/^in\//i, '')
  v = v.split(/[?#]/)[0]
  v = v.replace(/\/+$/, '')
  return v
}

function mergeDraft(base: Draft, raw: unknown): Draft | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const str = (key: string, fallback: string): string =>
    typeof r[key] === 'string' ? (r[key] as string) : fallback
  return {
    name: str('name', base.name),
    role: str('role', base.role),
    company: str('company', base.company),
    linkedinSlug: str('linkedinSlug', base.linkedinSlug),
    projectSlug: isProjectSlug(r.projectSlug) ? r.projectSlug : base.projectSlug,
    whatIDid: str('whatIDid', base.whatIDid),
    whatChanged: str('whatChanged', base.whatChanged),
    hiringManager: str('hiringManager', base.hiringManager),
    anythingElse: str('anythingElse', base.anythingElse),
  }
}

function sameAsPrefill(draft: Draft, fields: InviteFields): boolean {
  const base = initialDraft(fields)
  return (
    draft.name === base.name &&
    draft.role === base.role &&
    draft.company === base.company &&
    draft.linkedinSlug === base.linkedinSlug &&
    draft.projectSlug === base.projectSlug &&
    draft.whatIDid === '' &&
    draft.whatChanged === '' &&
    draft.hiringManager === '' &&
    draft.anythingElse === ''
  )
}

function readErrorBody(body: unknown): { field?: string; message?: string } {
  if (typeof body !== 'object' || body === null) return {}
  const r = body as { field?: unknown; message?: unknown }
  return {
    field: typeof r.field === 'string' ? r.field : undefined,
    message: typeof r.message === 'string' ? r.message : undefined,
  }
}

function messageForStatus(status: number, fromServer: string | undefined): string {
  if (status === 403) {
    return 'This link did not verify. It can get truncated when a link is forwarded or retyped. Ask Andrei for a fresh one and paste it in — everything you wrote is still on this page.'
  }
  if (status === 410) {
    return 'This invite expired while the page was open. Nothing you wrote is lost — ask Andrei for a fresh link and it will still be here.'
  }
  if (status === 413) {
    return (
      fromServer ??
      'There is a little more text than fits in one link. Trimming the longest answer by a few sentences will do it.'
    )
  }
  if (status === 422) {
    return fromServer ?? 'One of the fields came back rejected. Have a look and try again.'
  }
  if (status === 400) {
    return 'Something did not make it across intact. Try tapping Send once more.'
  }
  if (status === 503) {
    return 'The email did not go out, so Andrei has not seen this yet. Nothing was lost — wait a moment and tap Send again.'
  }
  return `Something went wrong at Andrei's end (${status}). Nothing was lost — try again in a minute, or email ${OWNER_EMAIL}.`
}

function SoftCounter({ value, cap }: { value: string; cap: number }) {
  const used = graphemeCount(value)
  const near = used >= Math.ceil(cap * 0.85)
  const over = used > cap
  return (
    <span
      aria-hidden={!near}
      className={
        'text-xs tabular-nums transition-opacity duration-200 ' +
        (near ? 'opacity-100 ' : 'opacity-0 ') +
        (over ? 'text-amber-300' : 'text-gray-500')
      }
    >
      {used} / {cap}
    </span>
  )
}
```

- [ ] **Step 3: Append the `TestimonialForm` component to the same file**

Append this to the bottom of `src/app/invite/TestimonialForm.tsx`. The consent sentence is rendered as `{CONSENT_TEXT_V1}` rather than retyped: `consent.version` is only an honest Article 7(1) archive if the string shown is provably the string stored.

```tsx
export default function TestimonialForm({
  token,
  fields,
  storageKey,
}: {
  token: string
  fields: InviteFields
  storageKey: string
}) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(fields))
  const [consent, setConsent] = useState(false)
  const [restored, setRestored] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const readyRef = useRef(false)

  // Restore a saved draft once, on mount. Consent is deliberately NOT restored: ticking the box
  // is the act of consenting, and a box that arrives pre-ticked from last week is not one.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored) {
        const merged = mergeDraft(initialDraft(fields), JSON.parse(stored))
        if (merged && !sameAsPrefill(merged, fields)) {
          setDraft(merged)
          setRestored(true)
        }
      }
    } catch {
      // Private-mode Safari throws on localStorage access. Autosave is a convenience; never fatal.
    }
    readyRef.current = true
  }, [fields, storageKey])

  // Autosave, 400 ms debounced.
  useEffect(() => {
    if (!readyRef.current) return
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(draft))
      } catch {
        // Same private-mode Safari case. Typing must never break because storage is unavailable.
      }
    }, 400)
    return () => window.clearTimeout(id)
  }, [draft, storageKey])

  const setField = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  function startFresh() {
    setDraft(initialDraft(fields))
    setConsent(false)
    setRestored(false)
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }

  function fail(message: string, field?: string) {
    setStatus({ kind: 'error', message, field })
    if (field) {
      const el = document.getElementById(field)
      if (el) {
        el.focus()
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status.kind === 'sending') return

    if (!draft.name.trim()) return fail('Your name is missing.', 'name')
    if (!draft.role.trim()) return fail('Your role at the time is missing.', 'role')
    if (!draft.company.trim()) return fail('Your company at the time is missing.', 'company')
    if (!draft.linkedinSlug.trim()) {
      return fail(
        'The LinkedIn link is the part that makes this verifiable to a stranger, so it is the one identity field I do need.',
        'linkedinSlug',
      )
    }
    if (!draft.hiringManager.trim()) {
      return fail(
        'Just the hiring-manager question — that one I do need. Any length is fine.',
        'hiringManager',
      )
    }
    for (const q of QUESTIONS) {
      const over = graphemeCount(draft[q.key]) - q.cap
      if (over > 0) {
        return fail(
          `That answer is ${over} character${over === 1 ? '' : 's'} over what fits. Trim it and it will go.`,
          q.key,
        )
      }
    }
    if (!consent) return fail('Tick the box above and it goes.', 'consent')

    setStatus({ kind: 'sending' })
    try {
      const res = await fetch('/api/testimonials/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          projectSlug: draft.projectSlug,
          name: draft.name,
          role: draft.role,
          company: draft.company,
          linkedinSlug: draft.linkedinSlug,
          answers: {
            whatIDid: draft.whatIDid,
            whatChanged: draft.whatChanged,
            hiringManager: draft.hiringManager,
            anythingElse: draft.anythingElse,
          },
          consent: true,
        }),
      })
      if (res.ok) {
        // The draft is deliberately left in localStorage: the thank-you screen tells them this
        // link stays open, and coming back to a blank form would make that a lie.
        setStatus({ kind: 'sent' })
        return
      }
      const parsed = readErrorBody(await res.json().catch(() => null))
      fail(messageForStatus(res.status, parsed.message), parsed.field)
    } catch {
      fail(
        'That did not reach the server. Check the connection and tap Send again — nothing you wrote is lost.',
      )
    }
  }

  if (status.kind === 'sent') {
    const written = QUESTIONS.filter((q) => draft[q.key].trim().length > 0)
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-white">Sent. Thank you &mdash; genuinely.</h1>

        <div className="mt-8 space-y-6">
          {written.map((q) => (
            <div key={q.key} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-amber-300">{q.label}</div>
              <p dir="auto" className="mt-2 whitespace-pre-wrap text-gray-200">
                {draft[q.key]}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-4 text-gray-400">
          <p>
            Andrei reads these himself, usually within a day. Nothing goes public until he approves it.
          </p>
          <p>Spotted a typo? This link stays open &mdash; just come back to it.</p>
          <p>
            Changed your mind later? Write to{' '}
            <a
              href={`mailto:${OWNER_EMAIL}`}
              className="rounded text-amber-300 underline underline-offset-2 hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {OWNER_EMAIL}
            </a>{' '}
            and it comes down. No explanation needed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold text-white">A few words about working together</h1>

      <p className="mt-6 text-gray-300">
        Andrei wrote:{' '}
        <span dir="auto" className="italic text-amber-200">
          &quot;{fields.message}&quot;
        </span>
      </p>
      <p className="mt-4 text-gray-400">
        Four questions, the last one open-ended. Five to ten minutes. It saves as you type, so you can
        stop and come back.
      </p>

      {restored && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <span>Picked up where you left off.</span>
          <button
            type="button"
            onClick={startFresh}
            className="rounded underline underline-offset-2 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            Start fresh
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-10 space-y-10">
        <fieldset className="min-w-0 space-y-6">
          <legend className="text-sm font-semibold text-gray-400">
            Not right? Fix anything here.
          </legend>

          <div className="min-w-0">
            <label htmlFor="name" className="block text-sm font-semibold text-white">
              Your name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={draft.name}
              onChange={(e) => setField('name', e.target.value)}
              autoComplete="name"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              className={INPUT_CLASS}
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="role" className="block text-sm font-semibold text-white">
              Your role at the time
            </label>
            <input
              id="role"
              name="role"
              type="text"
              value={draft.role}
              onChange={(e) => setField('role', e.target.value)}
              autoComplete="organization-title"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              className={INPUT_CLASS}
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="company" className="block text-sm font-semibold text-white">
              Your company at the time
            </label>
            <input
              id="company"
              name="company"
              type="text"
              value={draft.company}
              onChange={(e) => setField('company', e.target.value)}
              autoComplete="organization"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              className={INPUT_CLASS}
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="linkedinSlug" className="block text-sm font-semibold text-white">
              Your LinkedIn
            </label>
            <p id="linkedinSlug-help" className="mt-1 text-sm text-gray-400">
              Paste the whole profile address if that is easier &mdash; it gets trimmed for you.
            </p>
            {/* The visible focus ring sits on the wrapper via focus-within, because the prefix and
                the input are one control to a reader even though they are two elements. */}
            <div className="mt-2 flex items-stretch overflow-hidden rounded-xl border border-white/10 bg-white/5 focus-within:ring-2 focus-within:ring-amber-500">
              <span className="select-none px-3 py-3 text-base text-gray-500">linkedin.com/in/</span>
              <input
                id="linkedinSlug"
                name="linkedinSlug"
                type="text"
                inputMode="url"
                value={draft.linkedinSlug}
                onChange={(e) => setField('linkedinSlug', stripLinkedinUrl(e.target.value))}
                aria-describedby="linkedinSlug-help"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                className="min-w-0 flex-1 bg-transparent py-3 pr-4 text-base text-gray-100 placeholder:text-gray-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="min-w-0">
            <label htmlFor="projectSlug" className="block text-sm font-semibold text-white">
              Which project did we work on together?
            </label>
            <select
              id="projectSlug"
              name="projectSlug"
              value={draft.projectSlug}
              onChange={(e) =>
                setField('projectSlug', isProjectSlug(e.target.value) ? e.target.value : 'other')
              }
              className={`${INPUT_CLASS} appearance-none`}
            >
              {PROJECT_SLUGS.map((slug) => (
                <option key={slug} value={slug} className="bg-gray-900 text-gray-100">
                  {PROJECT_LABELS[slug]}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <div className="space-y-10">
          {QUESTIONS.map((q) => (
            <div key={q.key} className="min-w-0">
              <label htmlFor={q.key} className="block text-sm font-semibold text-white">
                {q.label}{' '}
                <span className="font-normal text-gray-500">
                  {q.optional ? '(optional)' : '(required)'}
                </span>
              </label>
              <p id={`${q.key}-help`} className="mt-1 text-sm text-gray-400">
                {q.help}
              </p>
              <textarea
                id={q.key}
                name={q.key}
                rows={3}
                dir="auto"
                value={draft[q.key]}
                onChange={(e) => setField(q.key, e.target.value)}
                placeholder={q.placeholder}
                aria-describedby={`${q.key}-help`}
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck={true}
                enterKeyHint={q.enterKeyHint}
                className={TEXTAREA_CLASS}
              />
              {/* No maxLength: it silently swallows the characters past the cap while the person is
                  still typing, with no explanation. A soft counter that fades in at 85% instead. */}
              <div className="mt-1 flex justify-end">
                <SoftCounter value={draft[q.key]} cap={q.cap} />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <label
            htmlFor="consent"
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <input
              id="consent"
              name="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {/* Rendered from the constant, not retyped: consent.version is only an honest record of
                what was agreed if the sentence shown is provably the sentence archived. */}
            <span className="text-sm leading-relaxed text-gray-300">{CONSENT_TEXT_V1}</span>
          </label>

          <div className="space-y-4 text-sm leading-relaxed text-gray-400">
            <p>
              <strong className="text-gray-300">Who&apos;s asking</strong> &mdash; Andrei Șerban, Iași,
              Romania, {OWNER_EMAIL}. This site is personal; there is no company behind it.
            </p>
            <p>
              <strong className="text-gray-300">What gets published</strong> &mdash; your name, your
              role and company at the time we worked together, your LinkedIn link, and your answers
              above. Nothing else.
            </p>
            <p>
              <strong className="text-gray-300">What I don&apos;t collect</strong> &mdash; I&apos;m
              not asking for your email, and I don&apos;t record your IP address. The site uses
              Vercel&apos;s cookie-free visit counter, which logs that a page was opened, from which
              country, and on what kind of browser and device &mdash; never who you are.
            </p>
            <p>
              <strong className="text-gray-300">Why I&apos;m allowed to</strong> &mdash; because
              you&apos;re saying yes, and for no other reason. Saying no costs you nothing.
            </p>
            <p>
              <strong className="text-gray-300">Where it lives</strong> &mdash; until you approve
              nothing is stored anywhere; your submission arrives in my personal Gmail so I can read
              it. If I publish it, it goes into this site&apos;s public repository. If I don&apos;t, I
              delete the email and nothing remains.
            </p>
            <p>
              <strong className="text-gray-300">Your say</strong> &mdash; ask me to correct it or take
              it down, any time, no reason needed; normally the same day. If you think I&apos;ve
              handled this badly you can complain to ANSPDCP (dataprotection.ro).
            </p>
          </div>

          {status.kind === 'error' && (
            <p role="alert" className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {status.message}
            </p>
          )}

          <button
            type="submit"
            disabled={status.kind === 'sending'}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 text-base font-semibold text-gray-900 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black"
          >
            {status.kind === 'sending' ? 'Sending…' : 'Send it to Andrei'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Confirm `CONSENT_TEXT_V1` is the §13.2 sentence**

Run: `node -e "console.log(require('fs').readFileSync('src/lib/consent.ts','utf8'))"`

Expected: the exported `CONSENT_TEXT_V1` reads exactly:

> I'm happy for Andrei to publish this on aserban.ro with my name, my role and company at the time we worked together, and my LinkedIn link. I understand the site's source code is public on GitHub, so a published testimonial becomes part of its history. He can fix a typo or trim for length, never change what I meant. I can have it taken down any time by emailing andre.serban96@gmail.com.

If it differs, fix `src/lib/consent.ts` to match §13.2 — the form renders whatever that constant holds, so the constant is the consent.

- [ ] **Step 5: Create `src/app/invite/page.tsx` — the gate**

The expiry branch returns before `TestimonialForm` is ever constructed. That ordering is the point of the file.

```tsx
'use client'

import { useEffect, useState } from 'react'
import { decodeInviteUnverified } from '@/lib/token-client'
import type { InviteFields } from '@/lib/token-types'
import TestimonialForm from './TestimonialForm'

type Gate =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'unreadable' }
  | { kind: 'expired'; fields: InviteFields }
  | { kind: 'ready'; fields: InviteFields; token: string; storageKey: string }

const OWNER_EMAIL = 'andre.serban96@gmail.com'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <main className="mx-auto max-w-6xl px-6 py-20">{children}</main>
    </div>
  )
}

function MailLink() {
  return (
    <a
      href={`mailto:${OWNER_EMAIL}`}
      className="rounded text-amber-300 underline underline-offset-2 hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      {OWNER_EMAIL}
    </a>
  )
}

export default function InvitePage() {
  const [gate, setGate] = useState<Gate>({ kind: 'loading' })

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, '')
    if (!raw) {
      setGate({ kind: 'missing' })
      return
    }
    const fields = decodeInviteUnverified(raw)
    if (!fields) {
      setGate({ kind: 'unreadable' })
      return
    }
    // exp is unix SECONDS. Checked here, before the form component exists, so an expired invite
    // never lets someone write 400 words and then collect a 410 from the server.
    if (fields.exp * 1000 <= Date.now()) {
      setGate({ kind: 'expired', fields })
      return
    }
    setGate({
      kind: 'ready',
      fields,
      token: raw,
      storageKey: `testimonial:${raw.split('.')[0].slice(0, 8)}`,
    })
  }, [])

  if (gate.kind === 'loading') {
    return (
      <Shell>
        <p className="text-gray-400">Opening your link…</p>
      </Shell>
    )
  }

  if (gate.kind === 'missing') {
    return (
      <Shell>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-white">Nothing to fill in here</h1>
          <p className="mt-6 text-gray-300">
            Testimonials on this site are invite-only, so there is no open form &mdash; every link
            goes to one named person.
          </p>
          <p className="mt-4 text-gray-400">
            If Andrei sent you a link, open it whole. The part after the <code>#</code> is what
            identifies you, and some apps drop it when a link is forwarded or retyped.
          </p>
          <p className="mt-4 text-gray-400">
            If you worked with him and would like to write one, say so at <MailLink />.
          </p>
        </div>
      </Shell>
    )
  }

  if (gate.kind === 'unreadable') {
    return (
      <Shell>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-white">This link did not open</h1>
          <p className="mt-6 text-gray-300">
            The part after the <code>#</code> looks truncated or altered &mdash; which is what
            usually happens when a link gets wrapped by a chat app or copied by hand.
          </p>
          <p className="mt-4 text-gray-400">
            Open it from the original message rather than a forward, or ask Andrei for a fresh one at{' '}
            <MailLink />. Nothing is wrong on your side.
          </p>
        </div>
      </Shell>
    )
  }

  if (gate.kind === 'expired') {
    return (
      <Shell>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-white">This link has expired</h1>
          <p className="mt-6 text-gray-300">
            Invite links only stay open for 45 days, so an old one cannot sit around forever. This one
            was addressed to {gate.fields.name}.
          </p>
          <p className="mt-4 text-gray-400">
            Ask Andrei for a fresh one &mdash; <MailLink /> &mdash; and it takes him about ten
            seconds. Nothing was lost, and you don&apos;t need to explain anything.
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <TestimonialForm token={gate.token} fields={gate.fields} storageKey={gate.storageKey} />
    </Shell>
  )
}
```

- [ ] **Step 6: Lint and build**

Run: `npm run lint && npm run build`

Expected: `npm run lint` prints nothing and exits 0. `npm run build` ends with a route table containing `○ /invite` (static prerender of the loading shell — the fragment is read in the browser, so there is nothing dynamic to render on the server). Any `react/no-unescaped-entities` error means an apostrophe in JSX text was missed: it names the exact line.

- [ ] **Step 7: Mint a fixture link and check the happy path in the browser**

`decodeInviteUnverified` does not check the signature, so a fixture needs no `INVITE_SECRET`. Start `npm run dev`, then:

Run:
```bash
node -e "const FS='\u001F';const p=['1','Maria Popescu','QA Lead','TOKERO','tokero','You saw the whole thing from the inside - would you write a few lines?',String(Math.floor(Date.now()/1000)+86400)].join(FS);console.log('http://localhost:3000/invite#'+Buffer.from(p).toString('base64url')+'.unsigned')"
```

Expected: one URL. Open it. Named checks, all four:
1. Name reads `Maria Popescu`, role `QA Lead`, company `TOKERO`, and the project `<select>` has TOKERO selected.
2. The intro shows Andrei's line in quotes, in amber italic.
3. All four questions show their help text, and the first three show their worked-example placeholders in grey.
4. In device-emulation mode at 390px wide the page does not scroll horizontally.

- [ ] **Step 8: Check the expiry message renders before the form**

Run:
```bash
node -e "const FS='\u001F';const p=['1','Maria Popescu','QA Lead','TOKERO','tokero','Would you write a few lines?',String(Math.floor(Date.now()/1000)-86400)].join(FS);console.log('http://localhost:3000/invite#'+Buffer.from(p).toString('base64url')+'.unsigned')"
```

Expected: opening that URL shows `This link has expired`, naming Maria Popescu, and **no textarea exists anywhere on the page** — confirm with `document.querySelectorAll('textarea').length` in the console, which must print `0`. Then open `http://localhost:3000/invite` with no fragment (expect `Nothing to fill in here`) and `http://localhost:3000/invite#not-a-real-token` (expect `This link did not open`). Neither may throw in the console.

- [ ] **Step 9: Check autosave, the restore bar, and the soft counter**

With the valid fixture link open:
1. Type two sentences into `What changed because of it?`, wait two seconds, reload the page. Expect the text back and the bar reading `Picked up where you left off.` with a `Start fresh` link.
2. Tap `Start fresh`. Expect every answer cleared, the identity fields back to the prefill, the consent box unticked, and the bar gone.
3. Paste `https://www.linkedin.com/in/maria-popescu-8a41b2/?originalSubdomain=ro` into the LinkedIn field. Expect the field to hold exactly `maria-popescu-8a41b2` with `linkedin.com/in/` as static grey text beside it.
4. Paste 340 characters into `What was I actually doing on the team?` (cap 300). Expect the counter visible and amber, reading over 300 — and expect the field to still accept every character typed.
5. Tab through the whole form. Every control, including `Start fresh` and the submit button, shows an amber ring.

- [ ] **Step 10: Check the failure paths keep the answers**

Fill the form in, tick consent, tap Send. Under `npm run dev` the submit route rejects on `Origin` by design (§7 item 2 pins it to `https://aserban.ro` with no localhost exemption), so this is the check that a rejection is survivable rather than a check that submitting works.

Expected: an amber alert box appears, **every answer is still in its field**, the button returns to `Send it to Andrei`, and reloading still restores the draft. Then untick consent and tap Send: expect `Tick the box above and it goes.` and no network request in the Network tab. Then clear the hiring-manager answer and tap Send: expect the page to scroll that field into view and focus it. The real 200 path can only be exercised from a preview deployment (§7 item 2) and is manual-checklist item 3.

- [ ] **Step 11: Commit**

```bash
git add src/app/invite/layout.tsx src/app/invite/page.tsx src/app/invite/TestimonialForm.tsx
git commit -m "feat(testimonials): invite page with expiry gate and the submission form"
```

---

### Task 13: `/moderate` — the server shell and the moderation panel

**Files:**
- Create: `src/app/moderate/layout.tsx`
- Create: `src/app/moderate/page.tsx`
- Create: `src/app/moderate/ModeratePanel.tsx`

**Interfaces:**
- Consumes: `decodeModerationUnverified(fragment: string): Promise<TestimonialRecord | null>` from `@/lib/token-client` (passed the `t` parameter's value, i.e. the same `payload.sig` token string the email carries); `Testimonial` from `@/lib/testimonials` (type-only); `PublishResult` from `@/lib/publish-to-git` (type-only, so the server module is erased at compile and never enters the client bundle); `PROJECT_LABELS`, `isProjectSlug` from `@/lib/projects-meta`; default export of `@/components/TestimonialCard`; `POST /api/testimonials/publish`
- Produces: `src/app/moderate/ModeratePanel.tsx` default export `ModeratePanel()`, taking no props. Nothing outside `src/app/moderate/page.tsx` imports it.

Why `page.tsx` is a server component that does nothing but render the panel: it is what makes "a prefetcher retrieving `/moderate` gets a static shell with nothing to act on" structural rather than a habit. If the page were `'use client'` it would behave identically today and stop behaving identically the first time somebody reaches for `useSearchParams`.

- [ ] **Step 1: Create the noindex layout**

`src/app/moderate/layout.tsx`:

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function ModerateLayout({ children }: { children: React.ReactNode }) {
  return children
}
```

- [ ] **Step 2: Create the server page**

`src/app/moderate/page.tsx` — no `'use client'`, no props read, nothing else in the file. Anything added here would be rendered on the server for every scanner that GETs the URL.

```tsx
import ModeratePanel from './ModeratePanel'

export default function ModeratePage() {
  return <ModeratePanel />
}
```

- [ ] **Step 3: Create `ModeratePanel.tsx` — header, types and module-private helpers**

Create the file with exactly this content.

```tsx
'use client'

import { useEffect, useState } from 'react'
import { decodeModerationUnverified } from '@/lib/token-client'
import { PROJECT_LABELS, isProjectSlug } from '@/lib/projects-meta'
import TestimonialCard from '@/components/TestimonialCard'
import type { Testimonial } from '@/lib/testimonials'
import type { PublishResult } from '@/lib/publish-to-git'

// Both imports above are `import type`, so neither @/lib/testimonials (which pulls in the JSON) nor
// @/lib/publish-to-git (server-only, node fetch to GitHub) reaches this client bundle.

type Intent = 'publish' | 'discard'

type Phase =
  | { kind: 'loading' }
  | { kind: 'no-fragment' }
  | { kind: 'no-decompression' }
  | { kind: 'unreadable' }
  | { kind: 'review'; record: Testimonial; token: string; intent: Intent }
  | { kind: 'discarded' }
  | { kind: 'published'; result: PublishResult }

const SITE_TESTIMONIALS_URL = 'https://aserban.ro/#testimonials'

function asPublishResult(body: unknown): PublishResult | null {
  if (typeof body !== 'object' || body === null) return null
  const r = body as { status?: unknown; prUrl?: unknown }
  if (r.status === 'already_published') return { status: 'already_published' }
  if (r.status === 'pr_open' && typeof r.prUrl === 'string') {
    return { status: 'pr_open', prUrl: r.prUrl }
  }
  if (r.status === 'pr_opened' && typeof r.prUrl === 'string') {
    return { status: 'pr_opened', prUrl: r.prUrl }
  }
  return null
}

function publishErrorMessage(status: number): string {
  if (status === 403) {
    return 'The link did not verify. Either it was altered on the way here, or it was opened from somewhere other than aserban.ro. Nothing was published.'
  }
  if (status === 422) {
    return 'The server re-checked the submission and rejected a field. Nothing was published — publish it by hand from the two fallback links at the bottom of the email.'
  }
  if (status === 502) {
    return 'GitHub refused the write. Nothing was published — try once more, and if it fails again use the two fallback links at the bottom of the email.'
  }
  return `Publishing failed (${status}). Nothing was published — the two fallback links at the bottom of the email still work.`
}

/**
 * Paste-ready follow-up. Deliberately carries no relative time: the record does not store when a
 * pull request merged and neither does the publish response, so any "just now" here would be a
 * guess presented as a fact.
 */
function followUpMessage(record: Testimonial): string {
  const firstName = record.author.name.trim().split(/\s+/)[0]
  return [
    `Hi ${firstName},`,
    '',
    'Your words are up on aserban.ro now — thank you again for writing them, it genuinely means a lot.',
    '',
    'It shows your name, your role and company at the time we worked together, and a link to your LinkedIn, exactly as you approved. If you ever want it changed or taken down, just tell me and it is done, no explanation needed.',
    '',
    'Thanks again,',
    'Andrei',
  ].join('\n')
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied or unavailable. The text stays selectable below, which is
      // the fallback, so there is nothing to recover from here.
    }
  }
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">
          Send this once you have merged the pull request
        </h3>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-300">
        {text}
      </pre>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl">{children}</div>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Append the `ModeratePanel` component to the same file**

Append this to the bottom of `src/app/moderate/ModeratePanel.tsx`.

```tsx
export default function ModeratePanel() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    if (!hash) {
      setPhase({ kind: 'no-fragment' })
      return
    }
    const params = new URLSearchParams(hash)
    const token = params.get('t')
    // The a= intent only decides which button is the thumb-height primary. It never acts on its own.
    const intent: Intent = params.get('a') === 'discard' ? 'discard' : 'publish'
    if (!token) {
      setPhase({ kind: 'no-fragment' })
      return
    }
    if (typeof DecompressionStream === 'undefined') {
      setPhase({ kind: 'no-decompression' })
      return
    }
    let cancelled = false
    decodeModerationUnverified(token)
      .then((record) => {
        if (cancelled) return
        setPhase(record ? { kind: 'review', record, token, intent } : { kind: 'unreadable' })
      })
      .catch(() => {
        if (!cancelled) setPhase({ kind: 'unreadable' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function publish(token: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/testimonials/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token }),
      })
      if (!res.ok) {
        setError(publishErrorMessage(res.status))
        setBusy(false)
        return
      }
      const result = asPublishResult(await res.json().catch(() => null))
      if (!result) {
        setError(
          'The server replied with something unreadable. Check GitHub before tapping again — the write may already have gone through.',
        )
        setBusy(false)
        return
      }
      setPhase({ kind: 'published', result })
    } catch {
      setError('That never reached the server. Nothing was published — tap Publish again.')
      setBusy(false)
    }
  }

  if (phase.kind === 'loading') {
    return (
      <Shell>
        <p className="text-gray-400">Unpacking the submission…</p>
      </Shell>
    )
  }

  if (phase.kind === 'no-fragment') {
    return (
      <Shell>
        <h1 className="text-3xl font-bold text-white">Nothing to review</h1>
        <p className="mt-6 text-gray-300">
          This page only does something when it is opened from a link in a notification email. The
          submission travels in the part of the URL after the <code>#</code>, which never leaves the
          browser and never reaches the server.
        </p>
        <p className="mt-4 text-gray-400">
          Opening <code>/moderate</code> on its own is meant to look exactly like this &mdash; a link
          scanner that fetches the URL gets this page and nothing to act on.
        </p>
      </Shell>
    )
  }

  if (phase.kind === 'no-decompression') {
    return (
      <Shell>
        <h1 className="text-3xl font-bold text-white">This browser cannot open it</h1>
        <p className="mt-6 text-gray-300">
          The submission is unpacked in the browser with <code>DecompressionStream</code>, which this
          browser does not have.
        </p>
        <p className="mt-4 text-gray-400">
          Open the same link in Chrome, Safari 16.4 or later, or Firefox 113 or later &mdash; or use
          the two manual links at the bottom of the email, which need no JavaScript at all.
        </p>
      </Shell>
    )
  }

  if (phase.kind === 'unreadable') {
    return (
      <Shell>
        <h1 className="text-3xl font-bold text-white">This link did not open</h1>
        <p className="mt-6 text-gray-300">
          The part after the <code>#</code> is the whole submission, and it looks truncated or
          altered. Mail apps sometimes wrap long links across a line.
        </p>
        <p className="mt-4 text-gray-400">
          Open the link from the original email rather than a forward, or use the two manual links at
          the bottom of that email. Nothing was published.
        </p>
      </Shell>
    )
  }

  if (phase.kind === 'discarded') {
    // Discard called no endpoint. Rejecting genuinely is doing nothing — and this single
    // instruction is the entire mechanism behind the retention promise, so it stands alone with
    // nothing to distract from it.
    return (
      <Shell>
        <h1 className="text-3xl font-bold text-white">Nothing was published.</h1>
        <p className="mt-6 text-lg text-gray-200">
          Now delete this email &mdash; it is the only remaining copy.
        </p>
      </Shell>
    )
  }

  if (phase.kind === 'published') {
    const { result } = phase
    if (result.status === 'already_published') {
      return (
        <Shell>
          <h1 className="text-3xl font-bold text-white">Already published &mdash; it&apos;s on the site.</h1>
          <a
            href={SITE_TESTIMONIALS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 text-base font-semibold text-gray-900 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black"
          >
            See it →
          </a>
        </Shell>
      )
    }
    if (result.status === 'pr_open') {
      return (
        <Shell>
          <h1 className="text-3xl font-bold text-white">Pull request already open.</h1>
          <a
            href={result.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 text-base font-semibold text-gray-900 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black"
          >
            Open it →
          </a>
        </Shell>
      )
    }
    return (
      <Shell>
        <h1 className="text-3xl font-bold text-white">Pull request opened.</h1>
        <p className="mt-6 text-gray-300">
          Review it, merge it, and it is live about 90 seconds later.
        </p>
        <a
          href={result.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 text-base font-semibold text-gray-900 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black"
        >
          Open the pull request →
        </a>
        <div className="mt-10">
          <CopyBlock text={followUpMessage(phase.result.status === 'pr_opened' ? phase.record : phase.record)} />
        </div>
      </Shell>
    )
  }

  const { record, token, intent } = phase
  const projectLabel = isProjectSlug(record.projectSlug)
    ? PROJECT_LABELS[record.projectSlug]
    : record.projectSlug

  const publishButton = (
    <button
      type="button"
      onClick={() => publish(token)}
      disabled={busy}
      className={
        intent === 'publish'
          ? 'w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 text-base font-semibold text-gray-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black'
          : 'w-full rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-base font-medium text-gray-300 hover:border-amber-400/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500'
      }
    >
      {busy ? 'Publishing…' : 'Publish it'}
    </button>
  )

  const discardButton = (
    <button
      type="button"
      onClick={() => setPhase({ kind: 'discarded' })}
      disabled={busy}
      className={
        intent === 'discard'
          ? 'w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 text-base font-semibold text-gray-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black'
          : 'w-full rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-base font-medium text-gray-300 hover:border-amber-400/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500'
      }
    >
      Discard
    </button>
  )

  return (
    <Shell>
      <h1 className="text-3xl font-bold text-white">Review before it goes anywhere</h1>
      <p className="mt-4 text-gray-400">
        Nothing has been published. This is the same card component the live site renders, so what
        you approve is what ships.
      </p>

      <div className="mt-8 min-w-0">
        <TestimonialCard testimonial={record} />
      </div>

      <dl className="mt-8 space-y-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <dt className="text-gray-500">Project</dt>
          <dd className="text-gray-300">{projectLabel}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-gray-500">Submitted</dt>
          <dd className="text-gray-300">{record.submittedAt}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-gray-500">LinkedIn</dt>
          <dd className="break-all text-gray-300">linkedin.com/in/{record.author.linkedinSlug}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-gray-500">Consent</dt>
          <dd className="text-gray-300">
            v{record.consent.version} at {record.consent.at}
          </dd>
        </div>
      </dl>

      {error && (
        <p
          role="alert"
          className="mt-8 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          {error}
        </p>
      )}

      <div className="mt-10 space-y-4">
        {intent === 'discard' ? discardButton : publishButton}
        {intent === 'discard' ? publishButton : discardButton}
        <p className="text-center text-sm text-gray-500">
          Discard sends nothing to the server. Publish opens a pull request &mdash; it does not change
          the live site until you merge it.
        </p>
      </div>
    </Shell>
  )
}
```

- [ ] **Step 5: Fix the one reference that does not compile**

The `pr_opened` branch above references `phase.record`, which does not exist on the `published` phase — that phase carries only the result. Carry the record through so the follow-up message can be built.

Change the `Phase` type's published variant:

```tsx
  | { kind: 'published'; result: PublishResult; record: Testimonial }
```

Change the two `setPhase` calls in `publish()` to take the record, by giving `publish` a second argument:

```tsx
  async function publish(token: string, record: Testimonial) {
```

and its success line to:

```tsx
      setPhase({ kind: 'published', result, record })
```

Change the call site in `publishButton`:

```tsx
      onClick={() => publish(token, record)}
```

And replace the `CopyBlock` line with the plain form:

```tsx
          <CopyBlock text={followUpMessage(phase.record)} />
```

Then move the `const { record, token, intent } = phase` destructuring so it stays after the `published` branch — it already is. TypeScript will point at anything missed.

- [ ] **Step 6: Lint and build**

Run: `npm run lint && npm run build`

Expected: lint exits 0 with no output. Build ends with `○ /moderate` in the route table — static, because `page.tsx` reads nothing. If it shows `ƒ /moderate`, something dynamic crept into `page.tsx`; that file must contain only the import and the three-line component.

- [ ] **Step 7: Mint a moderation fixture and check the review screen**

`decodeModerationUnverified` does not check the signature, so no `MOD_SECRET` is needed. The payload is gzip of the record's JSON (§7 step 7 gzips the moderation payload; §5 and §8 both show the record as JSON). Start `npm run dev`, then:

Run:
```bash
node -e "
const z=require('node:zlib');
const rec={id:'aB3xK9pQr7Zt',projectSlug:'tokero',publishedAt:'2026-09-14',submittedAt:'2026-09-13',consent:{version:1,at:'2026-09-13T18:42:07Z'},author:{name:'Maria Popescu',role:'QA Lead',company:'TOKERO',linkedinSlug:'maria-popescu-8a41b2'},answers:{whatIDid:'He owned the end-to-end suite and was the person we pinged when a pipeline went red at 6pm.',whatChanged:'Regression used to eat two days of manual clicking. After his framework landed it ran overnight.',hiringManager:'I would work with him again. He will push back if he thinks the plan is wrong.',anythingElse:''}};
const p=z.gzipSync(Buffer.from(JSON.stringify(rec)),{level:9}).toString('base64url');
console.log('http://localhost:3000/moderate#a=publish&t='+p+'.notasignature');
console.log('http://localhost:3000/moderate#a=discard&t='+p+'.notasignature');
"
```

Expected: two URLs. Open the first. Named checks:
1. The real `TestimonialCard` renders — the amber quote glyph, the `hiringManager` pull quote, `whatChanged` under its label, and the `Read the rest` `<details>` holding only `whatIDid` because `anythingElse` is empty.
2. `Publish it` is the large gradient button, `Discard` is the quiet outlined one below it.
3. The metadata list shows `TOKERO QA Automation Platform` (or whatever `PROJECT_LABELS.tokero` holds), `2026-09-13`, `linkedin.com/in/maria-popescu-8a41b2`, and `v1 at 2026-09-13T18:42:07Z`.

Open the second URL: the buttons swap emphasis — `Discard` becomes the large gradient button.

- [ ] **Step 8: Check Discard writes nothing**

With the `a=discard` link open, open DevTools → Network, clear it, tap `Discard`.

Expected: **zero requests recorded**, and the screen holds exactly two lines — `Nothing was published.` and `Now delete this email — it is the only remaining copy.` Nothing else: no card, no buttons, no link. If anything else is on that screen, delete it; the instruction only works if it is the only thing there.

- [ ] **Step 9: Check the Publish failure path and the double-tap guard**

Reload the `a=publish` link and tap `Publish it`. Under `npm run dev` the publish route rejects on `Origin` (§10 step 1, pinned to `https://aserban.ro`), which is the expected outcome here.

Expected: the button reads `Publishing…` and is disabled for the duration — tap it three more times while it is in flight and confirm the Network tab shows exactly **one** `POST /api/testimonials/publish`. Then an amber alert appears with the 403 wording, the button returns to `Publish it`, and the card is still on screen so nothing has to be re-opened from the email.

- [ ] **Step 10: Eyeball the three success screens**

They cannot be reached from `localhost` (the Origin check), so force each one for a look. Temporarily replace the `useState<Phase>` initialiser in `ModeratePanel` with, one at a time:

```tsx
  const [phase, setPhase] = useState<Phase>({
    kind: 'published',
    result: { status: 'pr_opened', prUrl: 'https://github.com/seradi96/qa-portfolio/pull/1' },
    record: {
      id: 'aB3xK9pQr7Zt', projectSlug: 'tokero', publishedAt: '2026-09-14', submittedAt: '2026-09-13',
      consent: { version: 1, at: '2026-09-13T18:42:07Z' },
      author: { name: 'Maria Popescu', role: 'QA Lead', company: 'TOKERO', linkedinSlug: 'maria-popescu-8a41b2' },
      answers: { whatIDid: '', whatChanged: '', hiringManager: 'I would work with him again.', anythingElse: '' },
    },
  })
```

Expected, checked for each of `pr_opened`, `pr_open`, `already_published`:
1. `pr_opened` shows the copy block; tapping `Copy` flips the label to `Copied` and pasting elsewhere yields the message opening `Hi Maria,`.
2. **No string on any of the three screens contains a relative time** — no "just now", "a moment ago", "recently". Read them out loud to check. Nothing in the system records when a merge happened, so any such phrase would be invented.
3. `already_published` links to `https://aserban.ro/#testimonials`; the other two link to the pull request.

Then revert the initialiser to `{ kind: 'loading' }` and confirm with `git diff src/app/moderate/ModeratePanel.tsx` that only the intended file content remains.

- [ ] **Step 11: Check the fragment-failure screens**

Open each and confirm none throws in the console:
- `http://localhost:3000/moderate` → `Nothing to review`
- `http://localhost:3000/moderate#a=publish` (no `t`) → `Nothing to review`
- `http://localhost:3000/moderate#a=publish&t=notgzipped.sig` → `This link did not open`

Then, in DevTools, run `Object.defineProperty(window,'DecompressionStream',{value:undefined})` before reloading a valid link — or check on any browser predating Safari 16.4 — and confirm `This browser cannot open it` renders rather than a blank page.

- [ ] **Step 12: Confirm the static shell carries nothing**

Run: `npm run build && grep -c "notasignature\|Maria Popescu" .next/server/app/moderate.html || echo "clean"`

Expected: `clean` (or grep exit 1 with no matches). The prerendered `/moderate` document must contain none of the submission — it is a shell, and everything real arrives after the `#`, in the browser, from the owner's own tap.

- [ ] **Step 13: Commit**

```bash
git add src/app/moderate/layout.tsx src/app/moderate/page.tsx src/app/moderate/ModeratePanel.tsx
git commit -m "feat(testimonials): moderation panel with fragment-only publish and no-op discard"
```

---

### Task 14: Post-build guards — static home page, secret leaks, content in the HTML

**Files:**
- Create: `scripts/postbuild-check.mjs`
- Modify: `package.json:5` (the `scripts` block)
- Modify: `eslint.config.mjs:7` (the `ignores` array)

**Interfaces:**
- Consumes: nothing at the module level. It reads build artefacts (`.next/prerender-manifest.json`, `.next/server/app/index.html`, `.next/static/**`, `.next/server/app/**`), `src/**`, `src/content/testimonials.json` and `.env.local` from disk. It imports no project code, so it cannot be broken by a TypeScript change.
- Produces: `npm run postbuild` (fires automatically after `npm run build` via the npm lifecycle), plus the `npm run invite` and `npm run check:tokens` entries.

- [ ] **Step 1: Write the post-build check script**

Three gates, zero dependencies. Gate 1 is the one that matters most: `/` going dynamic would cost SEO visibility and TTFB, and nothing else in this repo can detect it.

Create `scripts/postbuild-check.mjs`:

```js
#!/usr/bin/env node
// Post-build gates. Zero dependencies, runs after `npm run build` via the npm `postbuild` lifecycle.
//
// 1. The home page must still be statically prerendered. SEO visibility and TTFB both rest on it,
//    and nothing else in this repo can catch a regression.
// 2. No server secret may appear anywhere in the shipped bundle.
// 3. When testimonials.json is non-empty, the newest author must be in the prerendered HTML —
//    proof the content reached the HTML and not only the client chunks.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const failures = []
const notices = []
const fail = (msg) => failures.push(msg)
const note = (msg) => notices.push(msg)

const HOME_HTML = join(ROOT, '.next', 'server', 'app', 'index.html')

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    else if (entry.isFile()) acc.push(full)
  }
  return acc
}

// ---------- 1. the home page is still static ----------
// Read prerender-manifest.json, NOT routes-manifest.json: the latter lists '/' under staticRoutes
// either way, because that field means "no dynamic segments", not "statically rendered".
const manifestPath = join(ROOT, '.next', 'prerender-manifest.json')
if (!existsSync(manifestPath)) {
  fail('.next/prerender-manifest.json is missing — run `npm run build` first')
} else {
  let routes = []
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    routes = Object.keys(manifest.routes ?? {})
  } catch {
    fail('.next/prerender-manifest.json is not valid JSON')
  }
  if (routes.length > 0 && !routes.includes('/')) {
    fail(
      "the home page is no longer statically prerendered: '/' is absent from " +
        `.next/prerender-manifest.json routes (found: ${routes.join(', ')}). ` +
        'Something in the `/` import graph went dynamic — cookies(), headers(), searchParams, ' +
        'a `dynamic` export, or an uncached fetch.'
    )
  }
}
if (!existsSync(HOME_HTML)) {
  fail('.next/server/app/index.html is missing — the home page produced no prerendered HTML')
}

// ---------- 2. no secret in the bundle ----------
const SECRET_NAMES = ['INVITE_SECRET', 'MOD_SECRET', 'RESEND_API_KEY', 'GITHUB_TOKEN']

// npm does not load .env.local, and `postbuild` is a separate process from `next build`, so read the
// file directly — otherwise this gate is dead weight on the machine where the secrets actually live.
function loadEnvLocal() {
  const out = {}
  const path = join(ROOT, '.env.local')
  if (!existsSync(path)) return out
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const envLocal = loadEnvLocal()
const bundleFiles = [
  ...walk(join(ROOT, '.next', 'static')),
  ...walk(join(ROOT, '.next', 'server', 'app')),
]
const bundle = bundleFiles.map((file) => ({ file, buf: readFileSync(file) }))

for (const name of SECRET_NAMES) {
  const value = process.env[name] ?? envLocal[name]
  if (!value) {
    note(`${name} is not set here — leak check skipped (it runs on Vercel, where it is set)`)
    continue
  }
  if (value.length < 8) {
    note(`${name} is shorter than 8 characters — too short to grep for without false positives`)
    continue
  }
  for (const { file, buf } of bundle) {
    if (buf.includes(value)) {
      fail(`${name} appears verbatim in ${relative(ROOT, file)} — a server secret reached the client bundle`)
      break
    }
  }
}

for (const file of walk(join(ROOT, 'src'))) {
  if (readFileSync(file, 'utf8').includes('NEXT_PUBLIC_')) {
    fail(
      `${relative(ROOT, file)} references NEXT_PUBLIC_ — this project has no public env vars, ` +
        'and anything prefixed that way is inlined into the client bundle'
    )
  }
}

// ---------- 3. testimonial content reached the prerendered HTML ----------
const storePath = join(ROOT, 'src', 'content', 'testimonials.json')
if (existsSync(storePath) && existsSync(HOME_HTML)) {
  let records = []
  try {
    records = JSON.parse(readFileSync(storePath, 'utf8'))
  } catch {
    fail('src/content/testimonials.json is not valid JSON')
  }
  const usable = (Array.isArray(records) ? records : []).filter(
    (r) =>
      r && typeof r.publishedAt === 'string' && r.author && typeof r.author.name === 'string'
  )
  if (usable.length > 0) {
    const newest = usable.slice().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0]
    const name = newest.author.name
    // React escapes & < > " ' in text nodes; compare against both forms.
    const escaped = name
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
    const html = readFileSync(HOME_HTML, 'utf8')
    if (!html.includes(name) && !html.includes(escaped)) {
      fail(
        `"${name}" (newest record in src/content/testimonials.json) is not in ` +
          '.next/server/app/index.html — the testimonials reached the client bundle only, ' +
          'so Google and LLM crawlers cannot see them'
      )
    } else {
      note(`prerendered HTML contains the newest testimonial author ("${name}")`)
    }
  } else {
    note('src/content/testimonials.json is empty — content check skipped')
  }
}

// ---------- report ----------
for (const n of notices) console.log(`postbuild: note: ${n}`)
if (failures.length > 0) {
  for (const f of failures) console.error(`postbuild: FAIL: ${f}`)
  console.error(`postbuild: ${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('postbuild: OK — home page static, no secrets in the bundle, content in the HTML')
```

- [ ] **Step 2: Wire the three npm scripts**

`postbuild` is an npm lifecycle name: `npm run build` runs it automatically afterwards. (Running `next build` directly does **not** trigger it, and neither does `npm run build --ignore-scripts`.)

Replace the `scripts` block in `package.json` with exactly this:

```json
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "postbuild": "node scripts/postbuild-check.mjs",
    "start": "next start",
    "invite": "node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/invite.mjs",
    "check:tokens": "node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/token-roundtrip.mjs",
    "lint": "eslint",
    "lint:fix": "eslint --fix"
  },
```

The two `--disable-warning` flags are there because `invite.mjs` and `token-roundtrip.mjs` import `.ts` files directly and Node's type-stripping prints `MODULE_TYPELESS_PACKAGE_JSON` and an experimental warning after the test output, which reads like a failure. `postbuild-check.mjs` imports no TypeScript, so it needs no flags. If the earlier tasks already added `invite` and `check:tokens`, leave their exact wording alone and add only the `postbuild` line — the block above is the end state either way.

- [ ] **Step 3: Add `scripts/**` to the ESLint ignores**

Honest note so nobody expects a behaviour change: this is **cosmetic**. ESLint 9 already lints `scripts/**/*.mjs` under this flat config and reports things like unused vars there as a *warning*, so `npm run lint` exits 0 with or without this. It stops the scripts' Node-flavoured code from cluttering the output.

Replace the whole of `eslint.config.mjs` with:

```js
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

// Next 16 ships eslint-config-next as native flat config — no FlatCompat/eslintrc needed.
const eslintConfig = [
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "build_cv.js", "scripts/**"],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default eslintConfig;
```

- [ ] **Step 4: Build, and watch the gate run for the first time**

Run: `npm run build`

Expected: the usual Next route table (with `○ /`), then a `> qa-portfolio@0.1.0 postbuild` header and:

```
postbuild: note: INVITE_SECRET is not set here — leak check skipped (it runs on Vercel, where it is set)
postbuild: note: MOD_SECRET is not set here — leak check skipped (it runs on Vercel, where it is set)
postbuild: note: RESEND_API_KEY is not set here — leak check skipped (it runs on Vercel, where it is set)
postbuild: note: GITHUB_TOKEN is not set here — leak check skipped (it runs on Vercel, where it is set)
postbuild: note: src/content/testimonials.json is empty — content check skipped
postbuild: OK — home page static, no secrets in the bundle, content in the HTML
```

Exit code 0. If your `.env.local` already holds the four secrets, the first four notes are replaced by silence (they were checked and not found) — also a pass. If a record survived in `src/content/testimonials.json` from an earlier task, the fifth note reads `prerendered HTML contains the newest testimonial author ("…")` instead — also a pass.

- [ ] **Step 5: Negative control — plant a "secret" that is in the bundle, watch gate 2 fail**

`stylesheet` is 10 characters and appears in both `.next/static/chunks/*.js` and the prerendered HTML, so it is a deterministic stand-in for a leaked secret. Nothing is written; the value only lives in this one process's env.

Run: `INVITE_SECRET=stylesheet npm run postbuild`

Expected: exit code 1, and among the output a line of the form

```
postbuild: FAIL: INVITE_SECRET appears verbatim in .next/static/chunks/<hash>.js — a server secret reached the client bundle
postbuild: 1 check(s) failed
```

(The chunk filename is content-hashed and will differ; only the shape matters.) Note it names the file and never prints the value.

- [ ] **Step 6: Negative control — hide the manifest, watch gate 1 fail**

Run:
```bash
mv .next/prerender-manifest.json .next/prerender-manifest.json.bak
npm run postbuild
mv .next/prerender-manifest.json.bak .next/prerender-manifest.json
```

Expected: the middle command exits 1 with

```
postbuild: FAIL: .next/prerender-manifest.json is missing — run `npm run build` first
postbuild: 1 check(s) failed
```

and the third command restores the file silently. (This is the reachable half of gate 1; the `'/' is absent from routes` branch can only be produced by genuinely making the home page dynamic, which is exactly the regression the gate exists to catch.)

- [ ] **Step 7: Negative control — a published name that never reached the HTML, watch gate 3 fail**

This needs no rebuild: the gate compares the store against the HTML already on disk.

Run:
```bash
cp src/content/testimonials.json /tmp/testimonials.bak.json
cat > src/content/testimonials.json <<'JSON'
[
  {
    "id": "zZzZzZzZzZzZ",
    "projectSlug": "other",
    "publishedAt": "2099-01-01",
    "submittedAt": "2099-01-01",
    "consent": { "version": 1, "at": "2099-01-01T00:00:00Z" },
    "author": {
      "name": "Nobody Whatsoever",
      "role": "Tester",
      "company": "Nowhere",
      "linkedinSlug": "nobody-whatsoever"
    },
    "answers": {
      "whatIDid": "placeholder for a negative control",
      "whatChanged": "placeholder for a negative control",
      "hiringManager": "placeholder for a negative control",
      "anythingElse": ""
    }
  }
]
JSON
npm run postbuild
cp /tmp/testimonials.bak.json src/content/testimonials.json
```

Expected: `npm run postbuild` exits 1 with

```
postbuild: FAIL: "Nobody Whatsoever" (newest record in src/content/testimonials.json) is not in .next/server/app/index.html — the testimonials reached the client bundle only, so Google and LLM crawlers cannot see them
postbuild: 1 check(s) failed
```

The final `cp` restores the real store. Confirm with `git diff --stat src/content/testimonials.json` — expected: no output.

- [ ] **Step 8: Green gate**

Run: `npm run build && npm run lint`

Expected: build succeeds, `postbuild: OK — …` on the last line of the build, `npm run lint` prints nothing and exits 0.

- [ ] **Step 9: Named manual check — confirm Vercel actually runs the hook**

Not automatable from here, and worth 30 seconds on the next deploy. Vercel runs `npm run build` when a `build` script exists, which triggers `postbuild` — but that is a default, not a guarantee.

On the first Vercel deployment after this commit, open the deployment's **Build Logs** and search for `postbuild:`. Expected: the four (or fewer) `note:` lines and `postbuild: OK`. If `postbuild:` does not appear at all, the guard is not running in CI: set **Project → Settings → Build & Development Settings → Build Command** to `npm run build` explicitly and redeploy.

- [ ] **Step 10: Commit**

```bash
git add scripts/postbuild-check.mjs package.json eslint.config.mjs
git commit -m "build: add postbuild static-route, secret-leak and content gates"
```

---

### Task 15: Documentation — CLAUDE.md, the operator runbook, and re-anchoring the card-surface plan

**Files:**
- Modify: `CLAUDE.md:16` (Tailwind row), `CLAUDE.md:33` (test-harness sentence), `CLAUDE.md:38-53` (tree), `CLAUDE.md:59` (Content Model), `CLAUDE.md:85` (end of Gotchas), `CLAUDE.md:109` (In-Flight Work)
- Create: `docs/testimonials-runbook.md`
- Modify: `docs/superpowers/plans/2026-06-27-card-surface-system.md` (the 28 stale `page.tsx` line references, and Task 1's checkboxes)

**Interfaces:**
- Consumes: nothing — no code changes in this task.
- Produces: nothing importable.

- [ ] **Step 1: Correct the drifted version rows in CLAUDE.md**

The file's own header says "keep versions accurate here — this file has drifted before", and it has: `tailwindcss` is 4.3.0 installed and `react` is 19.2.6.

In `CLAUDE.md`, replace:

```
| React | 19.2.4 |
| TypeScript | 5.9 — strict mode, `@/*` → `./src/*` |
| Tailwind CSS | 4.1.18 — **CSS-first, no `tailwind.config.js`** |
```

with:

```
| React | 19.2.6 |
| TypeScript | 5.9 — strict mode, `@/*` → `./src/*` |
| Tailwind CSS | 4.3.0 — **CSS-first, no `tailwind.config.js`** |
```

- [ ] **Step 2: Update the commands block and the "no test harness" claim**

There is now one real test harness, and one guard that runs itself.

In `CLAUDE.md`, replace:

```
rm -rf .next && npm run dev    # Clear cache when the build acts stale
```

with:

```
rm -rf .next && npm run dev    # Clear cache when the build acts stale

npm run check:tokens # Token codec, HMAC, sanitisation and URL-budget assertions
npm run postbuild    # Static-route / secret-leak / content gates (npm runs it after `build`)
npm run invite       # Mint a testimonial invite link + paste-ready DM (needs .env.local)
```

and replace:

```
There is **no test harness** in this repo. `npm run build` + `npm run lint` are the full verification gate. For visual changes, also eyeball `npm run dev`.
```

with:

```
The verification gate is `npm run build` + `npm run lint`, plus `npm run check:tokens` — the one executable test suite in the repo, covering the testimonial token codec, HMAC verification, sanitisation and the URL budget. `npm run build` also fires `npm run postbuild`, which fails the build if the home page stopped being statically prerendered or a secret reached the bundle. There is no component or e2e harness. For visual changes, eyeball `npm run dev`.
```

- [ ] **Step 3: Add the new directories to the architecture tree**

In `CLAUDE.md`, replace:

```
│   │   ├── globals.css     # @import "tailwindcss" + a few global rules
│   │   └── favicon.ico
│   └── lib/
│       └── career.ts       # Career start dates + getYearsSince()
├── docs/superpowers/       # Design specs and implementation plans (in-flight work)
```

with:

```
│   │   ├── globals.css     # @import "tailwindcss", global rules, .card-surface classes
│   │   ├── favicon.ico
│   │   ├── invite/         # Testimonial invite form (noindex, 'use client')
│   │   ├── moderate/       # Approve/discard panel (noindex, 'use client')
│   │   ├── api/testimonials/{submit,publish}/route.ts
│   │   └── robots.ts
│   ├── components/         # TestimonialCard, TestimonialsSection
│   ├── content/
│   │   └── testimonials.json   # The published testimonial store — second content source
│   └── lib/
│       ├── career.ts       # Career start dates + getYearsSince()
│       └── …               # token*, sanitize, consent, projects-meta, testimonials, notify, publish-to-git
├── scripts/                # invite.mjs, token-roundtrip.mjs, postbuild-check.mjs
├── docs/superpowers/       # Design specs and implementation plans (in-flight work)
├── docs/testimonials-runbook.md   # Operating the testimonials feature — read before touching it
```

- [ ] **Step 4: Note the second content source in the Content Model section**

In `CLAUDE.md`, replace:

```
All content lives in `src/app/page.tsx` as plain arrays/objects above the JSX — there is no CMS and no data fetching.
```

with:

```
Content lives in **two** places: `src/app/page.tsx` as plain arrays/objects above the JSX, and `src/content/testimonials.json`, the published testimonial store. There is no CMS and no data fetching — the JSON is a build-time import.

- **`testimonials.json`** — written by merging the pull request that `/api/testimonials/publish` opens; hand-edit it only to correct or remove a record. `src/lib/testimonials.ts` validates on import and **drops** malformed records silently, so a bad edit makes a testimonial vanish rather than fail the build. Operating instructions: `docs/testimonials-runbook.md`.
```

- [ ] **Step 5: Add the testimonials gotchas**

These are the things that will silently bite someone six months from now. Append to the end of the `## Gotchas` section in `CLAUDE.md`, immediately after the `**`.claude/` is gitignored.**` line and before `## Design System`:

```
**The Testimonials nav label lives in two places** and drifts silently. `grep -n 'href="#testimonials"' src/app/page.tsx` returns exactly two hits: the desktop nav and the mobile menu. Both are gated on `TESTIMONIALS.length > 0`, so before the first published testimonial the section and both links are absent and the site is byte-identical to what it was. `PROJECT_LABELS` in `src/lib/projects-meta.ts` is likewise a second home for project identity — the `projects[]` entries carry `slug: '…' satisfies ProjectSlug` so TypeScript catches a bad slug, but nothing catches a stale label.

**Four server-only env vars**, Vercel **Production only**: `INVITE_SECRET`, `MOD_SECRET`, `RESEND_API_KEY`, `GITHUB_TOKEN`. Never `NEXT_PUBLIC_` anything — `npm run postbuild` greps the whole build output for all four values and fails the build on a hit. Locally they live in `.env.local` (see `.env.local.example`; `.gitignore` un-ignores only the example).

**Never `export const runtime = 'edge'`** in the route handlers. `'nodejs'` is the default and the only one that works: the token code uses `node:crypto` and `node:zlib`, and `'edge'` is deprecated in Next 16 and hard-fails the build.

**`cacheComponents` is deliberately off, so `'use cache'` is unavailable.** Enabling the flag would remove `dynamic` / `revalidate` / `fetchCache` app-wide and force-enable PPR. This repo has no cache-invalidation primitive at all: publishing means merging a commit and letting Vercel rebuild. Do not reach for `revalidatePath` / `revalidateTag` / `updateTag` — `revalidateTag` needs a second argument in Next 16 (a TS2554 written from Next 15 muscle memory) and `updateTag` throws inside route handlers.

**`output: 'export'` is now foreclosed.** `src/app/api/testimonials/*` are real route handlers; a static export would drop them.

**No schema.org `Review` JSON-LD, deliberately.** `Person` has no `review` property, so there is no valid subject to attach testimonials to; and `layout.tsx` injects JSON-LD via `dangerouslySetInnerHTML` with plain `JSON.stringify`, which does not escape `<` — visitor-authored text in that block could close the `<script>` tag. Testimonials are indexed as ordinary prerendered HTML.

**`npm run build` runs `npm run postbuild`** (npm lifecycle, not a Next hook). It asserts `/` is still in `.next/prerender-manifest.json`'s `routes`, that no secret is in the bundle, and that the newest published author is present in `.next/server/app/index.html`. Running `next build` directly skips all of it.
```

- [ ] **Step 6: Retire the card-surface plan's Task 1 in the In-Flight Work section**

In `CLAUDE.md`, replace:

```
`docs/superpowers/` holds a committed spec + implementation plan for a **card surface system** — unifying every card onto one neutral glass surface with amber as the single accent, calming the decorative animations, and replacing emoji-as-icons with SVG. Not yet implemented. Read the plan before large-scale card restyling so the two efforts don't conflict.
```

with:

```
`docs/superpowers/` holds a committed spec + implementation plan for a **card surface system** — unifying every card onto one neutral glass surface with amber as the single accent, calming the decorative animations, and replacing emoji-as-icons with SVG. **Task 1 is done**: the testimonials work defined `.card-surface` / `.card-surface-interactive` and the reduced-motion guard in `globals.css`. Tasks 2–9 (applying them across `page.tsx`) are not started, and their references are grep patterns, not line numbers — `page.tsx` line numbers move every time anything is inserted. Read the plan before large-scale card restyling so the two efforts don't conflict.
```

- [ ] **Step 7: Write the operator runbook**

Everything here is a thing the owner does on a phone, months apart, having forgotten the design. Create `docs/testimonials-runbook.md`:

````markdown
# Testimonials — runbook

Operating instructions for the invite-only testimonials feature. Design rationale lives in
`docs/superpowers/specs/2026-08-28-testimonials-design.md`; this file is only the doing.

**The shape of it in six lines.** You mint a signed invite link on your laptop and send it by hand in
a LinkedIn DM. The colleague fills in a form on aserban.ro. Nothing is stored anywhere: the submission
is signed, gzipped and mailed to your Gmail, and **that email is the only copy**. From the email you
tap Publish, which opens a pull request against `src/content/testimonials.json`; you merge it from the
GitHub mobile app and Vercel deploys in about 90 seconds. Tapping Discard writes nothing anywhere —
rejection is literally doing nothing, which is why the retention promise in the consent text is true.

---

## 1. Environment variables

All four are **server-side, Vercel Production only**. Never `NEXT_PUBLIC_`. `npm run postbuild` greps
the build output for all four values and fails the build if one leaks.

| Name | What it is | Where else it must match |
|---|---|---|
| `INVITE_SECRET` | HMAC key for `i1` invite tokens | your local `.env.local` — `npm run invite` signs with it |
| `MOD_SECRET` | HMAC key for `m1` moderation tokens | nowhere; only the server uses it |
| `RESEND_API_KEY` | Sends the moderation email | nowhere |
| `GITHUB_TOKEN` | Fine-grained PAT, `seradi96/qa-portfolio` only, Contents R/W + Pull requests R/W | nowhere |

Set them at **Vercel → the project → Settings → Environment Variables**, ticking **Production** only.
Changing a value does not affect deployments that already exist — you must redeploy
(**Deployments → ⋯ on the newest one → Redeploy**) before the change takes effect.

`INVITE_SECRET` is the one value that lives in two places. If `.env.local` and Vercel Production
disagree, every link you mint is rejected with a 403 on the live site and the colleague sees a
"this link isn't valid" screen. Copy it, don't retype it.

---

## 2. Set up the Gmail filter — mandatory, do it before the first invite

The moderation email is **the only copy of a pending submission**. Nothing is stored server-side.
If one lands in Spam, Gmail deletes it after 30 days and the submission is gone — the only recovery
is asking the colleague to write it again from the same still-valid link, which you will not enjoy
doing. The sender is `onboarding@resend.dev`, a shared Resend sandbox domain used by thousands of
other senders, so its reputation is not yours to control. That is what makes this a hard setup step
rather than a nicety.

In Gmail on desktop:

1. Search box → **Show search options** (the sliders icon).
2. **From:** `onboarding@resend.dev` → **Create filter**.
3. Tick: **Never send it to Spam**, **Always mark it as important**, **Categorize as: Primary**,
   and **Apply the label:** → *New label* → `Testimonials`.
4. **Create filter.**
5. Also add `onboarding@resend.dev` to Contacts — belt and braces on the reputation problem.

Verify it before trusting it: mint an invite to yourself (§3), submit the form, and confirm the mail
arrives in **Primary**, labelled, with the full submission readable in the body without tapping
anything. That readability is the point — triage happens on the lock screen.

---

## 3. Mint an invite

```bash
npm run invite -- \
  --name "Maria Popescu" \
  --role "QA Lead" \
  --company "TOKERO" \
  --project tokero \
  --message "You saw the whole thing from the inside — would you write a few lines?"
```

`--project` must be one of `deutsche-bahn`, `tokero`, `dentsply-sirona`, `happy-media`, `other`
(the list is `PROJECT_SLUGS` in `src/lib/projects-meta.ts`). The script prints two things: the URL
(`https://aserban.ro/invite#<token>`, around 229 characters) and a paste-ready LinkedIn DM containing
it. Send the DM by hand. **The application never emails anyone but you** — that is why there are no
DNS records to maintain.

Before sending, read the DM once as the recipient would. It should sound like you wrote it, and the
URL should be short enough not to read as phishing.

The link expires **45 days** after minting. It is not revocable and it is replayable inside that
window: someone who forwards it can submit again under any name. That is fine — nothing is public
until you approve it, and you verify the attribution against the real LinkedIn profile when you do.

---

## 4. Review a submission

The email carries the whole submission in plain text plus two links:

- `https://aserban.ro/moderate#a=publish&t=…`
- `https://aserban.ro/moderate#a=discard&t=…`

Both merely open the page — **no GET in this feature changes anything**, which is why mail scanners
prefetching your links cannot approve a testimonial by accident. The page reads the token from the
URL fragment (which never leaves the browser), gunzips it, and renders the record through the exact
same `TestimonialCard` the live site uses, so what you see is what ships.

- **Publish** → POSTs to `/api/testimonials/publish` → a branch `testimonial/<id>`, a commit, and a
  pull request. Merge it from the GitHub mobile app. Live in ~90 seconds.
- **Discard** → calls nothing at all. Then **delete the email** — the screen says so, because that
  email is the last remaining copy.

Tapping Publish twice is safe: the second tap says "Pull request already open", and after the merge
it says "Already published". Publishing is idempotent on the record's `id`.

Before you merge, do the one check no script can do: click **Verify on LinkedIn** on the preview card
and confirm it lands on the real person. Slugs are percent-encoded in the wild — this site's own is
`%C8%99erban-andrei-5a14a51a5` — so a broken slug is a genuine failure mode, not a theoretical one.

---

## 5. Publish by hand when the API path fails

If Publish returns a 502, or `GITHUB_TOKEN` has expired or been revoked, the same email contains two
fallbacks: a prefilled GitHub editor URL, and the exact JSON record as a paste-ready block. The token
is a convenience, not a dependency.

1. Open the GitHub editor link from the email (or navigate to
   `https://github.com/seradi96/qa-portfolio/edit/main/src/content/testimonials.json`).
2. Paste the JSON record into the array. It is an array of objects — mind the comma after the
   previous entry, and keep the newest record anywhere; `src/lib/testimonials.ts` sorts by
   `publishedAt`.
3. Commit to a new branch, open the pull request, wait for the Vercel preview, merge.

If you would rather do it on the laptop:

```bash
git switch -c testimonial/<id>
# paste the record into src/content/testimonials.json
npm run build && npm run lint      # postbuild proves the name reached the prerendered HTML
git add src/content/testimonials.json
git commit -m "content: publish testimonial from <Name>"
```

Then push — this repo needs the non-default GitHub identity, because the active `gh` account is
usually `PortivoApp` and a plain `git push` 403s:

```bash
export GH_PUSH_TOKEN=$(gh auth token --user seradi96)
git -c credential.helper= \
    -c credential.helper='!f() { echo username=seradi96; echo "password=${GH_PUSH_TOKEN}"; }; f' \
    push -u origin testimonial/<id>
```

---

## 6. Take a testimonial down

The consent text promises this on request, no reason needed, normally the same day. Honour it.

1. GitHub mobile (or web) → `src/content/testimonials.json` → edit → delete that whole `{ … }` object
   and the comma that joined it.
2. Commit — straight to `main` is fine for a takedown; speed is the promise.
3. Vercel deploys in ~90 seconds. Confirm on aserban.ro.
4. Reply to the person to say it is done.

If it was the last record, the array becomes `[]` and the section **and both nav entries** disappear
by design — the site returns to exactly what it looked like before the feature shipped.

This removes it from the live site, **not from git history**. Say so plainly if they ask. If they want
true erasure, §8.

---

## 7. Rotate a secret

Generate a fresh 256-bit value:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

For all four: set the new value in **Vercel → Settings → Environment Variables → Production**, then
**redeploy** — nothing changes until a new deployment exists.

**`INVITE_SECRET` — the panic button.** Rotating it invalidates **every outstanding invite at once**,
immediately and irreversibly. There is no per-invite revocation and there never will be, because that
would be state. Use it when a link has been forwarded somewhere you did not intend, or when you want
a clean slate. Afterwards, update `.env.local` to the same value and re-mint links for anyone still
mid-write, apologising for the churn.

**`MOD_SECRET`.** Rotating it invalidates every moderation email you have not yet acted on — those
submissions become unpublishable and the colleague has to resubmit. Clear your inbox of pending
testimonials before rotating, or accept that cost.

**`RESEND_API_KEY`.** resend.com → **API keys** → revoke the old key, create a new one with **Sending
access** only, paste into Vercel, redeploy. A stale key means submissions return 503 and the form keeps
everything the colleague typed — they can retry once you have fixed it, so this failure is recoverable.

**`GITHUB_TOKEN` — revoke first, ask questions later.** This is the token that can write to any branch
of `seradi96/qa-portfolio`, `main` included. A leak is a site takeover. Containment, not prevention,
is the plan:

1. github.com → **Settings → Developer settings → Personal access tokens → Fine-grained tokens** →
   the token → **Revoke**. Do this before anything else; publishing degrades to §5, which still works.
2. **Generate new token** → Repository access: **Only select repositories** → `seradi96/qa-portfolio`.
   Permissions: **Contents: Read and write**, **Pull requests: Read and write** (Metadata: Read-only is
   added for you). Nothing else. Set an expiry you will actually notice.
3. Paste into Vercel Production, redeploy, and test with the §4 loop against an invite to yourself.
4. Check `https://github.com/seradi96/qa-portfolio/branches` and the pull request list for anything
   you did not create.

Note the token's expiry date somewhere: when it lapses, Publish starts returning 502 with no other
symptom, and the fallbacks in §5 are what keep you working.

---

## 8. Erase from git history — rare, and it rewrites public history

Deleting a record (§6) removes it from the live site but not from the repository's history. Full
GDPR Article 17 erasure needs a history rewrite. Do this only on an explicit erasure request, and tell
the person it may take a day.

**Understand the cost before you start.** This rewrites every commit after the one that introduced the
record, changes every SHA, requires a force-push to a public repository, breaks every existing clone
and every pull-request reference, and does **not** reach forks or GitHub's cached views of the old
objects — for those you must open a GitHub Support request to purge them.

```bash
brew install git-filter-repo

git clone https://github.com/seradi96/qa-portfolio.git qa-portfolio-erase
cd qa-portfolio-erase

# One line per string to erase: the name, the LinkedIn slug, and each answer's text.
cat > /tmp/erase.txt <<'EOF'
literal:Maria Popescu==>REDACTED
literal:maria-popescu-8a41b2==>REDACTED
literal:He owned the end-to-end suite and was the person we pinged when a pipeline went red at 6pm.==>REDACTED
EOF

git filter-repo --replace-text /tmp/erase.txt --force
```

`git filter-repo` deletes the `origin` remote on purpose, so you cannot force-push by reflex. Re-add
it deliberately, then push with the `seradi96` identity:

```bash
git remote add origin https://github.com/seradi96/qa-portfolio.git
export GH_PUSH_TOKEN=$(gh auth token --user seradi96)
git -c credential.helper= \
    -c credential.helper='!f() { echo username=seradi96; echo "password=${GH_PUSH_TOKEN}"; }; f' \
    push --force origin main
```

Afterwards: delete your other local clones and re-clone; confirm Vercel redeployed from the rewritten
head; and open a GitHub Support request asking them to purge cached views of the removed objects.

---

## 9. Symptom → cause

| Symptom | Cause | Fix |
|---|---|---|
| Colleague sees "this link isn't valid" | `.env.local` `INVITE_SECRET` ≠ Vercel Production | Copy the Vercel value into `.env.local`, re-mint |
| "This invite has expired" | past its 45 days | Mint a fresh one |
| Form returns 403 | submitted from a preview deployment, not `https://aserban.ro` | Expected — the Origin check is absolute and has no localhost exemption |
| Form returns 413 | answers exceed the 1900-character URL budget | Ask for a shorter answer; the error says roughly how much |
| Form returns 503 | Resend rejected the send | Check `RESEND_API_KEY`; the form has kept everything they typed, so they can retry |
| No email at all | Spam, or Resend's 100/day ceiling | §2; check resend.com's logs |
| Publish returns 502 | `GITHUB_TOKEN` expired, revoked, or lacking a permission | §7, and publish by hand via §5 meanwhile |
| Moderate page is blank | no JavaScript, or a browser without `DecompressionStream` | Use Chrome 80+/Safari 16.4+/Firefox 113+, or §5 |
| Section missing from the live site | `testimonials.json` is `[]`, or every record failed validation and was dropped | `npm run build` and read the `postbuild:` lines |
````

- [ ] **Step 8: Reconcile the runbook's invite command with the script that actually shipped**

The runbook is only useful if its commands are real. `scripts/invite.mjs` was written in an earlier
task; confirm its flag names match §3.

Run: `npm run invite -- --name "Test Person" --role "QA Lead" --company "TOKERO" --project tokero --message "test"`

Expected: it prints an invite URL beginning `https://aserban.ro/invite#` and a DM body. If it instead
errors on unknown flags or prompts interactively, edit §3 of `docs/testimonials-runbook.md` to match
the real interface — the script is the source of truth, the doc follows it. If it fails with a missing
`INVITE_SECRET`, that is expected on a machine with no `.env.local`; add one from
`.env.local.example` and re-run.

- [ ] **Step 9: Learn the re-anchoring method before applying it**

The card-surface plan points at `src/app/page.tsx` by line number in 28 places. Those numbers are
already ~8–15 lines stale (the plan says the Architecture section starts at 1109; it starts at 1111,
and after this feature inserts a section at 1110 it will be ~200 out). Every one of them is
recoverable, because the plan quotes the code it is pointing at — so each line number can be replaced
by the grep that finds that code.

Add this helper to the plan's `## Verification model` section, immediately after the
`npm run dev` fenced block, so the next worker has a tool and not just a rule:

````markdown
### Finding the code this plan refers to

`src/app/page.tsx` is one 1700-line component and every insertion moves everything below it, so this
plan anchors on **greps and section comments**, never line numbers. Paste this helper into your shell
once; it prints one section of the file with real, current line numbers:

```bash
sect() {  # sect '<start marker>' '<end marker>' ['<literal pattern>']
  from=$(grep -nF -m1 -- "$1" src/app/page.tsx | cut -d: -f1)
  to=$(grep -nF -m1 -- "$2" src/app/page.tsx | cut -d: -f1)
  awk -v from="$from" -v to="$to" -v pat="${3:-}" \
      'NR>=from && NR<=to && (pat=="" || index($0,pat)) { print NR": "$0 }' src/app/page.tsx
}

# examples
sect '{/* Hero Section */}' '{/* About Section */}' 'animate-bounce'
sect '{/* Skills Section */}' '{/* Certifications Section */}' 'index === 0'
```

The section markers, in file order:
`{/* Navigation */}` · `{/* Hero Section */}` · `{/* About Section */}` · `{/* KPI Metrics Section */}` ·
`{/* Quote Section */}` · `{/* Key Wins Section */}` · `{/* Projects Section */}` ·
`{/* Architecture & Approach Section */}` · `{/* Skills Section */}` · `{/* Certifications Section */}` ·
`{/* Contact Section */}` · `{/* Footer */}` · `{/* Back to Top Button */}`

If a grep in this plan returns a different number of hits than stated, the file has moved on: find the
code by its section marker and update the pattern in this plan in the same commit.
````

- [ ] **Step 10: Replace all 28 line-number references with grep anchors**

Apply these replacements in `docs/superpowers/plans/2026-06-27-card-surface-system.md`. Each *old*
string is unique in the file; the hit counts in the *new* strings were verified against the current
`page.tsx`.

```
OLD: - Modify: `src/app/page.tsx` (About section, ~lines 530–602)
NEW: - Modify: `src/app/page.tsx` — the About section: `sect '{/* About Section */}' '{/* KPI Metrics Section */}'`

OLD: Replace each (lines ~591/595/599) `<span className="text-amber-400">✅</span>` with:
NEW: Replace each of the 3 hits of `grep -nF 'text-amber-400">✅' src/app/page.tsx` with:

OLD: - Modify: `src/app/page.tsx` (KPI section, ~lines 625–707)
NEW: - Modify: `src/app/page.tsx` — the KPI section: `sect '{/* KPI Metrics Section */}' '{/* Quote Section */}'`

OLD: - Line ~643 `<p className="text-amber-400 text-xs mt-1 font-medium">🔴 Live Counter</p>` →
NEW: - `grep -nF '🔴 Live Counter' src/app/page.tsx` (1 hit) `<p className="text-amber-400 text-xs mt-1 font-medium">🔴 Live Counter</p>` →

OLD: - Line ~665 `🚀 Delivered` →
NEW: - `grep -nF '🚀 Delivered' src/app/page.tsx` (1 hit) →

OLD: - Line ~685 `⭐ Created` →
NEW: - `grep -nF '⭐ Created' src/app/page.tsx` (1 hit) →

OLD: - Line ~704 `🎓 Completed` →
NEW: - `grep -nF '🎓 Completed' src/app/page.tsx` (1 hit) →

OLD: - Modify: `src/app/page.tsx` (~lines 733–828)
NEW: - Modify: `src/app/page.tsx` — `sect '{/* Key Wins Section */}' '{/* Projects Section */}'`

OLD: - Modify: `src/app/page.tsx` (~lines 1109–1313)
NEW: - Modify: `src/app/page.tsx` — `sect '{/* Architecture & Approach Section */}' '{/* Skills Section */}'` (the three framework cards plus both callouts)

OLD: - Functional (line ~1112): `bg-gradient-to-br
NEW: - Functional (`grep -n '{/\* Functional Framework \*/}' src/app/page.tsx`): `bg-gradient-to-br

OLD: - Performance (line ~1160): `…
NEW: - Performance (`grep -n '{/\* Performance Suite \*/}' src/app/page.tsx`): `…

OLD: - Reporting (line ~1212): `…
NEW: - Reporting (`grep -n '{/\* Reporting Platform \*/}' src/app/page.tsx`): `…

OLD: (Performance, ~line 1187) → `border-t border-amber-400/20`
NEW: (`grep -nF 'border-t border-yellow-400/20' src/app/page.tsx` — 1 hit) → `border-t border-amber-400/20`

OLD: Line ~1266 `bg-white/5 p-6 rounded-2xl border border-white/10` → `card-surface p-6`
NEW: The DB-engagement callout (`grep -n '{/\* DB engagement \*/}' src/app/page.tsx`), whose card div is the single hit of `grep -nF 'bg-white/5 p-6 rounded-2xl border border-white/10' src/app/page.tsx`: `bg-white/5 p-6 rounded-2xl border border-white/10` → `card-surface p-6`

OLD: Line ~1316 `bg-gradient-to-br from-cyan-600/15 to-blue-600/10 p-6 rounded-2xl border border-cyan-400/30` → `card-surface-ai p-6`
NEW: The AI callout (`grep -n '{/\* AI-Augmented Workflow \*/}' src/app/page.tsx` — anchor on the comment, because `from-cyan-600/15 to-blue-600/10` has 2 hits): `bg-gradient-to-br from-cyan-600/15 to-blue-600/10 p-6 rounded-2xl border border-cyan-400/30` → `card-surface-ai p-6`

OLD: - Modify: `src/app/page.tsx` (Skills section, ~lines 1359–1416)
NEW: - Modify: `src/app/page.tsx` — `sect '{/* Skills Section */}' '{/* Certifications Section */}'`

OLD: Replace the `colors` array (lines ~1360–1366) with:
NEW: Replace the `colors` array (`grep -nF 'const colors = [' src/app/page.tsx` — 1 hit) with:

OLD: Line ~1379 `<div className={`h-full bg-gradient-to-br ${color.bg} p-6 rounded-2xl border ${color.border}
NEW: `grep -nF '${color.bg} p-6 rounded-2xl' src/app/page.tsx` (1 hit) `<div className={`h-full bg-gradient-to-br ${color.bg} p-6 rounded-2xl border ${color.border}

OLD: Line ~1381 icon chip `bg-gradient-to-r ${color.icon}` stays (now amber/cyan from new array). Line ~1411 skill dot `bg-gradient-to-r ${color.icon}` → `bg-gradient-to-r ${color.dot}`
NEW: `grep -nF '${color.icon}' src/app/page.tsx` returns 2 hits: the **first** is the icon chip and stays as it is (now amber/cyan from the new array); the **second** is the skill dot → `bg-gradient-to-r ${color.dot}`

OLD: bar blocks (lines ~1384–1405). Also remove `animate-pulse` from the skill dots (line ~1411: drop `animate-pulse` and the inline `animationDelay` style).
NEW: bar blocks — `grep -nF 'index === 0' src/app/page.tsx` and likewise `index === 1` / `2` / `3`, 1 hit each, marking the four block openings. Also remove `animate-pulse` from the skill dots (the second `${color.icon}` hit: drop `animate-pulse` and the inline `animationDelay` style).

OLD: - Modify: `src/app/page.tsx` (~lines 1428–1638)
NEW: - Modify: `src/app/page.tsx` — `sect '{/* Certifications Section */}' '{/* Contact Section */}'`

OLD: Line ~1605 `bg-gradient-to-r from-black/40 to-amber-900/20 p-8 rounded-2xl border border-amber-400/30` → `card-surface p-8`
NEW: The Learning Goals banner (`grep -n '{/\* Learning Goals \*/}' src/app/page.tsx`; its div is the single hit of `grep -nF 'from-black/40 to-amber-900/20 p-8' src/app/page.tsx`): `bg-gradient-to-r from-black/40 to-amber-900/20 p-8 rounded-2xl border border-amber-400/30` → `card-surface p-8`

OLD: - Modify: `src/app/page.tsx` (hero ~440–500, quote ~712–725, projects ~877–1092)
NEW: - Modify: `src/app/page.tsx` — `sect '{/* Hero Section */}' '{/* About Section */}'`, `sect '{/* Quote Section */}' '{/* Key Wins Section */}'`, `sect '{/* Projects Section */}' '{/* Architecture & Approach Section */}'`

OLD: Remove the `animate-ping` star overlay (`<div className="absolute inset-0 animate-ping">…</div>`, ~lines 468–472) and the `animate-bounce` dot row under the chat icon (~lines 488–494).
NEW: Remove the `animate-ping` star overlay — `grep -nF 'absolute inset-0 animate-ping' src/app/page.tsx`, 1 hit, `<div className="absolute inset-0 animate-ping">…</div>` — and the 3-dot `animate-bounce` row under the chat icon, `sect '{/* Hero Section */}' '{/* About Section */}' 'animate-bounce'` (3 consecutive hits).

OLD: Keep the active-project status dot `animate-pulse` (semantic, line ~917) and remove the decorative bouncing arrow `<div className="absolute -right-2 top-1/2 …"><div className="… animate-bounce"></div></div>` (~lines 1087–1091). Status badge pulse dots (lines ~929) → drop `animate-pulse` (decorative), keep the dot.
NEW: `sect '{/* Compact Project Grid */}' '{/* Architecture & Approach Section */}' 'animate-pulse'` returns 2 hits: the **first** is the active-project dot (`activeProject === originalIndex ? 'bg-amber-500 animate-pulse'`) and is semantic — keep it; the **second** is the status badge dot (`isLiveStatus ? 'bg-amber-400 animate-pulse'`) — drop `animate-pulse`, keep the dot. Remove the decorative bouncing arrow, `grep -nF 'absolute -right-2 top-1/2' src/app/page.tsx` (1 hit), `<div className="absolute -right-2 top-1/2 …"><div className="… animate-bounce"></div></div>`.

OLD: inside the project map at ~line 889 is allowed
NEW: inside the project map — `sect '{/* Compact Project Grid */}' '{/* Architecture & Approach Section */}' 'from-amber-600/20 to-yellow-600/10'`, the hit ending `border-amber-400/50 shadow-2xl shadow-amber-500/20` — is allowed
```

- [ ] **Step 11: Mark the card-surface plan's Task 1 done**

Check what actually shipped first:

Run: `grep -n "card-surface" src/app/globals.css`

Expected: hits for `.card-surface` and `.card-surface-interactive`, and **no** `.card-surface-ai` —
this feature only needed the two the testimonial card uses.

In `docs/superpowers/plans/2026-06-27-card-surface-system.md`, change Task 1's three checkboxes from
`- [ ]` to `- [x]` and insert this note immediately under the `## Task 1: Surface tokens + reduced-motion in globals.css` heading:

```markdown
> **Done** — shipped as part of the testimonials feature (`docs/superpowers/specs/2026-08-28-testimonials-design.md`),
> which needed `.card-surface` for `TestimonialCard`. Two differences from the block below, both
> deliberate: `.card-surface-ai` was **not** added — Task 5 must add it before using it — and the
> `prefers-reduced-motion` guard is scoped to the two card classes rather than a global `*` reset,
> so it cannot disable the reduced-motion-safe transitions elsewhere on the page. Verify with
> `grep -n "card-surface" src/app/globals.css` before assuming either.
```

(If the grep *did* show `.card-surface-ai`, delete the clause about Task 5 having to add it and leave
the rest.)

- [ ] **Step 12: Prove every new anchor in the plan resolves**

A grep anchor that finds nothing is worse than a stale line number, because it looks authoritative.

Run:
```bash
sect() {
  from=$(grep -nF -m1 -- "$1" src/app/page.tsx | cut -d: -f1)
  to=$(grep -nF -m1 -- "$2" src/app/page.tsx | cut -d: -f1)
  awk -v from="$from" -v to="$to" -v pat="${3:-}" \
      'NR>=from && NR<=to && (pat=="" || index($0,pat)) { print NR": "$0 }' src/app/page.tsx
}
for p in 'text-amber-400">✅' '🔴 Live Counter' '🚀 Delivered' '⭐ Created' '🎓 Completed' \
         'border-t border-yellow-400/20' 'bg-white/5 p-6 rounded-2xl border border-white/10' \
         'const colors = [' '${color.bg} p-6 rounded-2xl' '${color.icon}' 'index === 0' \
         'index === 1' 'index === 2' 'index === 3' 'absolute inset-0 animate-ping' \
         'from-black/40 to-amber-900/20 p-8' 'absolute -right-2 top-1/2'; do
  printf '%-52s %s\n' "$p" "$(grep -cF -- "$p" src/app/page.tsx)"
done
sect '{/* Hero Section */}' '{/* About Section */}' 'animate-bounce' | wc -l
sect '{/* Compact Project Grid */}' '{/* Architecture & Approach Section */}' 'animate-pulse' | wc -l
```

Expected, exactly:

```
text-amber-400">✅                                   3
🔴 Live Counter                                      1
🚀 Delivered                                         1
⭐ Created                                           1
🎓 Completed                                         1
border-t border-yellow-400/20                        1
bg-white/5 p-6 rounded-2xl border border-white/10    1
const colors = [                                     1
${color.bg} p-6 rounded-2xl                          1
${color.icon}                                        2
index === 0                                          1
index === 1                                          1
index === 2                                          1
index === 3                                          1
absolute inset-0 animate-ping                        1
from-black/40 to-amber-900/20 p-8                    1
absolute -right-2 top-1/2                            1
       3
       2
```

Any count that differs means `page.tsx` moved on since this plan was written — fix the pattern in the
plan now rather than leaving a broken anchor.

- [ ] **Step 13: Confirm nothing in the docs broke the code gate**

Run: `npm run build && npm run lint`

Expected: build succeeds ending in `postbuild: OK — home page static, no secrets in the bundle, content in the HTML`; `npm run lint` prints nothing and exits 0. (This task touches only markdown, so a failure here means an earlier task's work regressed — investigate before committing.)

- [ ] **Step 14: Commit**

```bash
git add CLAUDE.md docs/testimonials-runbook.md docs/superpowers/plans/2026-06-27-card-surface-system.md
git commit -m "docs: testimonials runbook, CLAUDE.md updates, re-anchor card-surface plan to greps"
```
