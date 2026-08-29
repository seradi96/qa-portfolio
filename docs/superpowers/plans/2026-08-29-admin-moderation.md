# Admin-Page Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace email-based moderation with a private GitHub repository as the pending store and an `/admin` page to review, approve and reject submissions.

**Architecture:** A submitted testimonial is written as `pending/<id>.json` to a private repository through the same GitHub REST API `publish-to-git.ts` already calls, with the same token and plain `fetch`. The owner opens `/admin`, authenticates once with a generated password exchanged for an HMAC-signed cookie, and reviews each pending record rendered with the real `TestimonialCard`. Approving publishes through the existing `publishTestimonial` and then deletes the pending file; rejecting deletes it and nothing else. Published testimonials still reach the public page as a module import, so no store outage can ever remove the section from the live site.

**Tech Stack:** Next.js 16.2.6 (App Router, Turbopack), React 19.2.6, TypeScript 5.9.3 strict, Tailwind CSS 4.3.0 (CSS-first, no config file), Node 24 (`node:crypto`), GitHub REST API. **Zero new npm dependencies.**

**Spec:** `docs/superpowers/specs/2026-08-29-admin-moderation-design.md` — read it alongside this plan. It also records what this supersedes in `2026-08-28-testimonials-design.md`.

## Global Constraints

Every task's requirements implicitly include this section.

- **Zero new npm dependencies.** Not one. If a task seems to need a package, its boundary is wrong.
- **The private store repository is `seradi96/qa-portfolio-pending`, hardcoded as a module constant** exactly as `OWNER`/`REPO`/`BASE_BRANCH` already are in `publish-to-git.ts:19-21`. A misconfigured environment variable must never be able to redirect submissions to a repository somebody else controls.
- **`ADMIN_PASSWORD` must be generated and at least 24 characters**, asserted at module scope. This replaces rate limiting: a login endpoint on Vercel has no throttle, and a module-scoped attempt counter is theatre because it resets on every cold start and is not shared across concurrent lambdas. Entropy is the only defence that holds.
- **`MOD_SECRET` is repurposed** to sign the admin session cookie. No new secret is introduced. `RESEND_API_KEY` is removed everywhere.
- **`npm run build` requires `.env.local`.** `assertSecret` runs at module scope and `next build` evaluates route modules during "Collecting page data". This is deliberate and already documented in CLAUDE.md; `ADMIN_PASSWORD` now joins that set.
- **`SITE_ORIGIN` is a hardcoded constant, never an env var.** Consequence: no route handler, including the admin ones, can be exercised under `npm run dev` — they 403 against localhost. Develop the write path against a deployed environment, or with an *uncommitted* working-tree edit.
- **`react/no-unescaped-entities` is an ESLint error.** Every literal apostrophe in JSX text must be `&apos;`.
- **Never `export const runtime = 'edge'`** — deprecated in Next 16 and hard-fails on `node:crypto`.
- **`scripts/token-roundtrip.mjs` is append-only and shares one module scope**, except in Task 6, which is the single place deletion from it is correct. Redeclaring an already-bound identifier there is a hard `SyntaxError`.
- **The verification gate is `npm run build` && `npm run lint` && `npm run check:tokens`**, all green, at the end of every task. `npm run build` also runs `npm run postbuild`.
- **Never make real GitHub API calls, never send email, never use the real `GITHUB_TOKEN` or `ADMIN_PASSWORD` in a test.** Mock at the network boundary. A stray call opens a pull request on a live public repository.
- **Design system:** amber-400/500 accent only, `.card-surface` for cards, `focus:outline-none focus:ring-2 focus:ring-amber-500` on every interactive element. **No cyan** (reserved for AI content), **no emoji**, no `animate-ping/bounce/spin`, no decorative `animate-pulse`.
- `eslint-plugin-react-hooks` 7.1.1 is strict: `react-hooks/set-state-in-effect` and `react-hooks/refs` both bite. Prefer deriving state during render or a lazy `useState` initialiser over a mount effect.

## Task Map

| Task | Deliverable | Automated coverage |
|---|---|---|
| 1 | `admin-auth.ts` — password check, signed session cookie | `check:tokens` — real TDD, 6 assertions |
| 2 | `pending-store.ts`, plus exporting `isTestimonial` | Mocked `fetch` only |
| 3 | Submit route writes to the store; `notify.ts` deleted | Build + mocked exercise |
| 4 | `/api/admin/login`, `/publish`, `/reject` | Build + mocked exercise |
| 5 | `/admin` page — login gate, list, approve, reject | Build + named manual checks |
| 6 | Remove the moderation machinery | Grep + build |
| 7 | robots, env example, postbuild scan, privacy note | Build |
| 8 | CLAUDE.md and the runbook | Fact-check |

Task 1 is the only place real TDD applies, because the session token is the only new piece the harness can reach. Tasks 2-5 name a manual or mocked check instead and say so honestly rather than dressing one up as a test.

**Setup this plan assumes, done once by the owner before Task 2 can be exercised live:** create the private repository `seradi96/qa-portfolio-pending`, extend the fine-grained token to cover both repositories, and set Watch → All Activity on the private one. Task 8 documents all three.

---

### Task 1: The admin session token (`src/lib/admin-auth.ts`)

**Files:**
- Create: `src/lib/admin-auth.ts`
- Modify: `scripts/token-roundtrip.mjs:630` — append a new section immediately above the summary `console.log` on line 631
- Modify: `.env.local.example:4`
- Modify: `.env.local` (gitignored — never committed, never in a `git add`)

**Interfaces:**
- Consumes: `assertSecret(name: string, value: string | undefined): string` from `src/lib/token.ts` (already exists)
- Produces:
  ```ts
  export const SESSION_COOKIE = 'admin_session'
  export const SESSION_TTL_SECONDS = 2592000
  export function checkPassword(supplied: unknown): boolean
  export function mintSession(nowSeconds: number): string
  export function verifySession(cookieValue: string | undefined, nowSeconds: number): boolean
  ```
  Later tasks build the cookie as `${SESSION_COOKIE}=${mintSession(Math.floor(Date.now() / 1000))}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}` and gate every admin surface on `verifySession(cookies().get(SESSION_COOKIE)?.value, Math.floor(Date.now() / 1000))`.

---

- [ ] **Step 1: Document `ADMIN_PASSWORD` in the committed env example**

Edit `.env.local.example`. Replace line 4:

```
# The same four names must exist in Vercel, Production environment ONLY — never Preview, because
```

with:

```
# The same five names must exist in Vercel, Production environment ONLY — never Preview, because
```

Then append this block to the end of the same file (after `GITHUB_TOKEN=`):

```
# The whole gate on /admin: compared with crypto.timingSafeEqual, then swapped for a signed
# session cookie. GENERATED, minimum 24 characters — src/lib/admin-auth.ts refuses to load below
# that, the same way token.ts refuses a short INVITE_SECRET. It must not be a memorable password:
# /admin has no rate limiting, because a per-lambda attempt counter resets on every cold start and
# is not shared across concurrent invocations, so entropy in this value is the only defence that
# actually holds.
#   node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"
ADMIN_PASSWORD=
```

- [ ] **Step 2: Put a real generated password in your local `.env.local`**

Run: `node -e "console.log('ADMIN_PASSWORD=' + require('node:crypto').randomBytes(24).toString('base64url'))" >> .env.local`

Expected: `.env.local` gains a fifth line, `ADMIN_PASSWORD=` followed by 32 base64url characters. Confirm with `grep -c '^ADMIN_PASSWORD=.\{24,\}$' .env.local` → `1`. This file is gitignored; it is never part of any commit in this plan.

- [ ] **Step 3: Append the first half of the harness section (setup, round trip, tamper, expiry)**

`scripts/token-roundtrip.mjs` is append-only and shares ONE module scope, so `INVITE_SECRET`, `MOD_SECRET`, `check`, `checkAsync` and `assert` are already declared above and must be reused, never redeclared — redeclaring any of them is a hard `SyntaxError` at parse time, before a single assertion runs. Insert this at line 630, i.e. immediately **above** `console.log(`\n${passed} passed, ${failed} failed`)`:

```js
// --- admin session cookie ----------------------------------------------------
// randomBytes is imported statically at the top of this file; createHmac is not, and this file
// is append-only, so it is pulled in here rather than by editing that import.
const { createHmac } = await import('node:crypto')

// src/lib/admin-auth.ts asserts ADMIN_PASSWORD at module load (and imports token.ts, whose own
// module-scope asserts already ran above), so it must exist before the dynamic import below.
// A test value; it is not the real password and never leaves this file.
const ADMIN_PASSWORD = 'check-tokens-admin-password-0123456789'
process.env.ADMIN_PASSWORD = ADMIN_PASSWORD

const { SESSION_COOKIE, SESSION_TTL_SECONDS, checkPassword, mintSession, verifySession } =
  await import('../src/lib/admin-auth.ts')

// A fixed clock, so "expired" is a property of the assertion and not of when the suite runs.
const NOW = 1800000000

// 1 - round trip
check('an admin session token survives a full round trip', () => {
  assert(SESSION_COOKIE === 'admin_session', `SESSION_COOKIE is ${SESSION_COOKIE}`)
  assert(SESSION_TTL_SECONDS === 2592000, `SESSION_TTL_SECONDS is ${SESSION_TTL_SECONDS}`)
  const token = mintSession(NOW)
  assert(
    /^[0-9]{10}\.[A-Za-z0-9_-]{43}$/.test(token),
    `token is not <expiry>.<base64url sha256>: ${token}`,
  )
  assert(token.split('.')[0] === String(NOW + SESSION_TTL_SECONDS), 'expiry stamp is wrong')
  assert(verifySession(token, NOW) === true, 'a freshly minted session did not verify')
  // Cookie-safe: no ';', ',', '=' or whitespace, so it needs no quoting in a Set-Cookie header.
  assert(!/[;,=\s"]/.test(token), `token needs cookie quoting: ${token}`)
})

// 2 - tamper must fail
check('a tampered admin session signature fails verification', () => {
  const token = mintSession(NOW)
  const [stamp, sig] = token.split('.')
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const at = Math.floor(sig.length / 2)
  const swapped = alphabet[(alphabet.indexOf(sig[at]) + 1) % alphabet.length]
  const tampered = `${stamp}.${sig.slice(0, at)}${swapped}${sig.slice(at + 1)}`
  assert(tampered !== token, 'the tamper did not change the token')
  assert(verifySession(tampered, NOW) === false, 'a tampered signature verified')
  // Moving the expiry stamp forward is the interesting forgery: it is signed, so it must fail.
  assert(
    verifySession(`${Number(stamp) + 86400}.${sig}`, NOW) === false,
    'an extended expiry verified against the original signature',
  )
})

// 3 - expiry must be enforced
check('an expired admin session fails verification', () => {
  const token = mintSession(NOW)
  assert(verifySession(token, NOW + SESSION_TTL_SECONDS - 1) === true, 'rejected one second early')
  assert(verifySession(token, NOW + SESSION_TTL_SECONDS) === false, 'accepted at the exact expiry')
  assert(verifySession(token, NOW + SESSION_TTL_SECONDS + 1) === false, 'accepted after expiry')
})
```

- [ ] **Step 4: Append the second half (wrong domain, wrong-length signature, password, module load)**

Continue immediately after the block from Step 3, still above the summary `console.log`:

```js
// 4 - wrong domain must fail
check('a stamp signed under the invite i1 domain does not verify as a session', () => {
  const expiry = NOW + SESSION_TTL_SECONDS
  const asI1 = createHmac('sha256', MOD_SECRET).update(`i1.${expiry}`, 'utf8').digest('base64url')
  assert(verifySession(`${expiry}.${asI1}`, NOW) === false, 'an i1-domain MAC verified as s1')
  const wrongKey = createHmac('sha256', INVITE_SECRET)
    .update(`s1.${expiry}`, 'utf8')
    .digest('base64url')
  assert(verifySession(`${expiry}.${wrongKey}`, NOW) === false, 'INVITE_SECRET signed a session')
})

// 5 - wrong-length signature must be false, not RangeError
check('a wrong-length admin session signature returns false instead of throwing RangeError', () => {
  const [stamp] = mintSession(NOW).split('.')
  for (const sig of ['A', 'AA', 'A'.repeat(42), 'A'.repeat(44), 'A'.repeat(86)]) {
    let result
    try {
      result = verifySession(`${stamp}.${sig}`, NOW)
    } catch (err) {
      throw new Error(`verifySession threw on a ${sig.length}-char signature: ${err}`)
    }
    assert(result === false, `a ${sig.length}-char signature verified`)
  }
  for (const bad of [undefined, '', '.', 'nodot', 'a.b.c', `${NOW}.`, `x.${'A'.repeat(43)}`]) {
    let result
    try {
      result = verifySession(bad, NOW)
    } catch (err) {
      throw new Error(`verifySession threw on ${JSON.stringify(bad)}: ${err}`)
    }
    assert(result === false, `expected false for ${JSON.stringify(bad)}`)
  }
})

// 6 - the password comparison
check('checkPassword accepts only the exact password, and never throws', () => {
  assert(checkPassword(ADMIN_PASSWORD) === true, 'the real password was rejected')
  const sameLength = `${ADMIN_PASSWORD.slice(0, -1)}X`
  assert(sameLength.length === ADMIN_PASSWORD.length, 'the fixture is not the same length')
  assert(checkPassword(sameLength) === false, 'a same-length wrong password was accepted')
  // The RangeError trap: timingSafeEqual throws on unequal lengths, so a short guess must be
  // caught by the length check and come back as a plain false (a 401), never a 500.
  for (const bad of ['', 'short', `${ADMIN_PASSWORD}x`, undefined, null, 42, {}, []]) {
    let result
    try {
      result = checkPassword(bad)
    } catch (err) {
      throw new Error(`checkPassword threw on ${JSON.stringify(bad)}: ${err}`)
    }
    assert(result === false, `checkPassword accepted ${JSON.stringify(bad)}`)
  }
})

// 7 - a short or missing ADMIN_PASSWORD must break the build, not the login
await checkAsync('an empty or short ADMIN_PASSWORD throws at module load', async () => {
  try {
    for (const bad of ['', 'x'.repeat(23), 'correct horse battery']) {
      process.env.ADMIN_PASSWORD = bad
      let threw = false
      try {
        // A query string forces Node to re-evaluate the module instead of serving the cached
        // instance; the extension in the pathname still selects type stripping.
        await import(`../src/lib/admin-auth.ts?bad-password-${encodeURIComponent(bad)}`)
      } catch {
        threw = true
      }
      assert(threw, `admin-auth.ts loaded with ADMIN_PASSWORD = ${JSON.stringify(bad)}`)
    }
  } finally {
    // This file shares one module scope and is appended to over time: leaving the environment
    // broken would fail whatever is added below for a reason that has nothing to do with it.
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD
  }
})
```

- [ ] **Step 5: Watch the new assertions fail (red)**

Run: `npm run check:tokens`

Expected: the 37 existing `PASS` lines print, then the harness dies at the top-level `await import` with no summary line and exit code 1:

```
    code: 'ERR_MODULE_NOT_FOUND',
    url: 'file:///Users/andreiserban/Projects/qa-portfolio/src/lib/admin-auth.ts'
```

All seven new assertions fail as one crash rather than seven `FAIL` lines, because the module under test is imported at module scope. That is the correct red for a file that does not exist yet.

- [ ] **Step 6: Write `src/lib/admin-auth.ts`**

```ts
// SERVER ONLY. The admin gate: one password, then a signed session cookie.
//
// The `.ts` extension below is load-bearing: scripts/token-roundtrip.mjs loads this module
// through Node's built-in type stripping, which does NO extension resolution, so './token'
// fails there with ERR_MODULE_NOT_FOUND. tsc accepts the explicit form because tsconfig sets
// allowImportingTsExtensions; elsewhere under src/ keep the extensionless style.
import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { assertSecret } from './token.ts'

if (typeof window !== 'undefined') {
  throw new Error(
    'src/lib/admin-auth.ts is server-only: it reads ADMIN_PASSWORD and signs with MOD_SECRET. ' +
      'A client component must POST to /api/admin/login instead.',
  )
}

export const SESSION_COOKIE = 'admin_session'
/** 30 days, in seconds. Also the cookie's Max-Age. */
export const SESSION_TTL_SECONDS = 2592000

// 24 characters of generated entropy, and it is NOT a stylistic preference: it is what stands in
// for rate limiting. A login endpoint on Vercel has no throttle in front of it, and a
// module-scoped attempt counter is theatre — it resets on every cold start and is not shared
// across concurrent lambdas, so an attacker gets an unlimited, parallel guessing budget either
// way. The only defence left that actually holds is entropy in the secret itself. A generated
// 24-character password is not brute-forceable; a memorable one is, and no counter changes that.
const MIN_PASSWORD_CHARS = 24

// Mirrors the i1 / m1 tags in token.ts. A session token can never be confused with an invite
// token even when both are signed with the same key, because the tag is inside the MAC input.
const SESSION_DOMAIN = 's1'

/**
 * Called at module load, deliberately, exactly as assertSecret is in token.ts: a missing or
 * memorable ADMIN_PASSWORD must break `next build` during "Collecting page data" — the moment
 * any route imports this file — rather than surface as a broken login at 11pm.
 */
function assertAdminPassword(value: string | undefined): string {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_CHARS) {
    throw new Error(
      `ADMIN_PASSWORD is missing, empty, or shorter than ${MIN_PASSWORD_CHARS} characters. ` +
        'It is the whole gate on /admin and there is no rate limiting behind it, so it must be ' +
        'generated, not memorable: node -e "console.log(require(\'node:crypto\')' +
        '.randomBytes(24).toString(\'base64url\'))"',
    )
  }
  return value
}

assertAdminPassword(process.env.ADMIN_PASSWORD)

function sessionMac(expiry: number, secret: string): Buffer {
  return createHmac('sha256', secret).update(`${SESSION_DOMAIN}.${expiry}`, 'utf8').digest()
}

/**
 * `unknown` because the argument comes straight out of `await request.json()`, where a caller
 * can send a number, an array, or nothing at all.
 */
export function checkPassword(supplied: unknown): boolean {
  const expected = Buffer.from(assertAdminPassword(process.env.ADMIN_PASSWORD), 'utf8')
  if (typeof supplied !== 'string') return false
  const given = Buffer.from(supplied, 'utf8')
  // Length check FIRST: timingSafeEqual throws RangeError on unequal-length buffers, which would
  // turn a wrong-length password into a 500 instead of a 401.
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}

/** `<expiryUnixSeconds>.<base64url HMAC-SHA256(MOD_SECRET, "s1." + expiry)>` */
export function mintSession(nowSeconds: number): string {
  const secret = assertSecret('MOD_SECRET', process.env.MOD_SECRET)
  if (!Number.isFinite(nowSeconds) || nowSeconds <= 0) {
    throw new Error(`mintSession needs a positive unix-seconds clock, got ${nowSeconds}`)
  }
  const expiry = Math.floor(nowSeconds) + SESSION_TTL_SECONDS
  return `${expiry}.${sessionMac(expiry, secret).toString('base64url')}`
}

export function verifySession(cookieValue: string | undefined, nowSeconds: number): boolean {
  if (typeof cookieValue !== 'string') return false
  const parts = cookieValue.split('.')
  if (parts.length !== 2) return false
  const [stamp, sigB64] = parts
  if (!/^[0-9]{1,12}$/.test(stamp)) return false
  // Buffer.from(x, 'base64url') silently DROPS characters outside the alphabet instead of
  // throwing, so a shape check has to come first or "!!!!" would decode to an empty buffer.
  if (!/^[A-Za-z0-9_-]+$/.test(sigB64)) return false

  const expiry = Number(stamp)
  if (!Number.isSafeInteger(expiry) || expiry <= 0) return false

  const secret = assertSecret('MOD_SECRET', process.env.MOD_SECRET)
  const given = Buffer.from(sigB64, 'base64url')
  const expected = sessionMac(expiry, secret)
  // Same trap as above: unequal lengths must be a plain false, never a RangeError escaping into
  // a server component and rendering a 500 where a login form belongs.
  if (given.length !== expected.length) return false
  if (!timingSafeEqual(given, expected)) return false

  return expiry > Math.floor(nowSeconds)
}
```

Note the transitive consequence of `import { assertSecret } from './token.ts'`: importing this module also runs token.ts's module-scope `assertSecret('INVITE_SECRET', …)`. Every route that gates on a session therefore needs `INVITE_SECRET` set too. That is already true of every route in this repo, and the harness sets both secrets long before this section runs.

- [ ] **Step 7: Watch the assertions pass (green)**

Run: `npm run check:tokens`

Expected, as the last nine lines:

```
PASS  an admin session token survives a full round trip
PASS  a tampered admin session signature fails verification
PASS  an expired admin session fails verification
PASS  a stamp signed under the invite i1 domain does not verify as a session
PASS  a wrong-length admin session signature returns false instead of throwing RangeError
PASS  checkPassword accepts only the exact password, and never throws
PASS  an empty or short ADMIN_PASSWORD throws at module load

44 passed, 0 failed
```

37 before, 7 added, 44 now. If it reads 43 with one `FAIL … createHmac is not defined`, the `const { createHmac } = await import('node:crypto')` line from Step 3 was dropped.

- [ ] **Step 8: Confirm the build and lint gates**

Run: `npm run build && npm run lint`

Expected: the build finishes with the existing seven-row route table (`/`, `/_not-found`, `/api/testimonials/publish`, `/api/testimonials/submit`, `/invite`, `/moderate`, `/robots.txt`), then postbuild prints `postbuild: OK — static: verified …; secrets: 4/4 checked, none found; content: skipped (store empty)`, and `eslint` prints nothing and exits 0. `admin-auth.ts` is not in the route import graph yet, so its module-scope assertion does not run during "Collecting page data" — it will start doing so in the task that adds the login route, which is why Step 2 put a real value in `.env.local` now.

- [ ] **Step 9: Commit**

```bash
git add src/lib/admin-auth.ts scripts/token-roundtrip.mjs .env.local.example
git commit -m "feat(admin): sign and verify the admin session cookie"
```

---

### Task 2: The private pending store (`src/lib/pending-store.ts`)

**Files:**
- Create: `src/lib/pending-store.ts`
- Modify: `src/lib/testimonials.ts:36`
- Modify: `.env.local.example:21`
- Create, then delete before committing: `scripts/pending-store-probe.mjs`, `scripts/pending-store-probe-hook.mjs`, `scripts/pending-store-probe-register.mjs`

**Interfaces:**
- Consumes: nothing from Task 1. It uses `assertSecret` from `src/lib/token.ts`, `TestimonialRecord` from `src/lib/token-types.ts`, and `isTestimonial` from `src/lib/testimonials.ts` (exported in Step 1 below) — all pre-existing.
- Produces:
  ```ts
  // src/lib/testimonials.ts
  export function isTestimonial(value: unknown): value is Testimonial
  // src/lib/pending-store.ts
  export async function listPending(): Promise<TestimonialRecord[]>
  export async function getPending(id: string): Promise<TestimonialRecord | null>
  export async function putPending(record: TestimonialRecord): Promise<void>
  export async function deletePending(id: string): Promise<void>
  ```
  Behaviour later tasks depend on: an empty queue is `[]`, never a throw. `getPending` returns `null` both for an unknown id and for a malformed one — that single `null` is the 404 for `/api/admin/publish` and `/api/admin/reject`. `deletePending` is idempotent (a file already gone is a completed delete) and throws only on a malformed id or a real GitHub failure, so a route should establish existence with `getPending` first, then delete.

**No automated test can reach this module.** `npm run check:tokens` cannot import it: it resolves `@/lib/…` through the tsconfig alias, which Node's type stripping does not understand, and `src/lib/testimonials.ts` imports `@/content/testimonials.json` without the `with { type: 'json' }` attribute that Node ESM requires. Steps 2–4 below therefore build a **throwaway** probe — an alias loader hook plus a mocked `fetch` — run it red, run it green, and delete it before committing, so the repo keeps its single-harness property. It never contacts GitHub and never reads the real `GITHUB_TOKEN`.

---

- [ ] **Step 1: Export `isTestimonial` from `src/lib/testimonials.ts`**

One line, at line 36. Change:

```ts
function isTestimonial(value: unknown): value is Testimonial {
```

to:

```ts
export function isTestimonial(value: unknown): value is Testimonial {
```

Change nothing else in that file. Its doc comment, its per-field checks, the `rows`/`parsed` widening below it and the `TESTIMONIALS` sort all stay exactly as they are.

- [ ] **Step 2: Create the throwaway alias loader hook**

`scripts/` is in `eslint.config.mjs`'s ignore list, so nothing here is linted. Create `scripts/pending-store-probe-hook.mjs`:

```js
// Throwaway. Maps the `@/...` tsconfig alias to src/ and turns a .json import into an ES module,
// so a plain .mjs probe can load src/lib/pending-store.ts through Node's type stripping.
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
const ROOT = pathToFileURL(process.cwd() + '/')
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2)
    return { url: new URL('src/' + (rel.endsWith('.json') ? rel : rel + '.ts'), ROOT).href, shortCircuit: true }
  }
  return next(specifier, context)
}
export async function load(url, context, next) {
  if (url.endsWith('.json')) {
    return { format: 'module', source: 'export default ' + readFileSync(fileURLToPath(url), 'utf8'), shortCircuit: true }
  }
  return next(url, context)
}
```

And `scripts/pending-store-probe-register.mjs`:

```js
import { register } from 'node:module'
register('./pending-store-probe-hook.mjs', import.meta.url)
```

- [ ] **Step 3: Write the mocked-`fetch` probe**

Create `scripts/pending-store-probe.mjs`. The fake repository is a plain object of filename → text; `globalThis.fetch` is replaced by a router over it that returns **404 for `GET contents/pending` when that object is empty**, which is exactly what GitHub does, because git cannot store an empty directory.

```js
// Throwaway probe for src/lib/pending-store.ts. NEVER touches GitHub: globalThis.fetch is
// replaced by a router over an in-memory fake repository. Run:
//   node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
//     --import ./scripts/pending-store-probe-register.mjs ./scripts/pending-store-probe.mjs
process.env.INVITE_SECRET = 'probe-invite-secret-0123456789abcdef'
process.env.MOD_SECRET = 'probe-moderation-secret-0123456789abcdef'
process.env.GITHUB_TOKEN = 'probe-github-token-not-a-real-one-0123456789'

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`PASS  ${name}`) }
  else { failed++; console.log(`FAIL  ${name}\n      ${detail}`) }
}

const API = 'https://api.github.com/repos/seradi96/qa-portfolio-pending'
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')

const record = (id, name, submittedAt) => ({
  id,
  projectSlug: 'tokero',
  publishedAt: submittedAt,
  submittedAt,
  consent: { version: 1, at: `${submittedAt}T18:42:07Z` },
  author: { name, role: 'QA Lead', company: 'TOKERO', linkedinSlug: 'maria-popescu-8a41b2' },
  answers: { whatIDid: '', whatChanged: '', hiringManager: 'I would work with him again.', anythingElse: '' },
})

let files = {}
const calls = []
globalThis.fetch = async (url, init = {}) => {
  const method = init.method ?? 'GET'
  const path = String(url).slice(API.length + '/contents/'.length)
  calls.push(`${method} ${path}`)
  const res = (status, body) =>
    new Response(body === undefined ? '' : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })

  if (method === 'GET' && path === 'pending') {
    const names = Object.keys(files)
    // Git cannot store an empty directory: with nothing pending, GitHub 404s.
    if (names.length === 0) return res(404, { message: 'Not Found' })
    return res(200, names.map((n) => ({ type: 'file', name: n })))
  }
  if (method === 'GET') {
    const name = path.slice('pending/'.length)
    if (!(name in files)) return res(404, { message: 'Not Found' })
    // Wrapped at 60 characters, exactly as the real API returns it.
    return res(200, { encoding: 'base64', sha: `sha-${name}`, content: b64(files[name]).replace(/(.{60})/g, '$1\n') })
  }
  if (method === 'PUT') {
    const body = JSON.parse(init.body)
    const name = path.slice('pending/'.length)
    if (name in files && body.sha !== `sha-${name}`) return res(422, { message: 'sha required' })
    files[name] = Buffer.from(body.content, 'base64').toString('utf8')
    return res(201, { content: { sha: `sha-${name}` } })
  }
  if (method === 'DELETE') {
    const body = JSON.parse(init.body)
    const name = path.slice('pending/'.length)
    if (body.sha !== `sha-${name}`) return res(422, { message: 'sha mismatch' })
    delete files[name]
    return res(200, {})
  }
  return res(500, { message: 'unrouted' })
}

const { listPending, getPending, putPending, deletePending } = await import('../src/lib/pending-store.ts')

// 1 — the empty-directory 404 is an empty queue, not an error.
files = {}
let out
try { out = await listPending() } catch (err) { out = err }
check('an empty pending directory (404) lists as []', Array.isArray(out) && out.length === 0, String(out))

// 2 — a normal list, newest first.
files = {
  'aB3xK9pQr7Zt.json': JSON.stringify(record('aB3xK9pQr7Zt', 'Maria Popescu', '2026-09-13')),
  'zY8wV7uT6sR5.json': JSON.stringify(record('zY8wV7uT6sR5', 'Hans Keller', '2026-09-15')),
}
out = await listPending()
check('a normal list returns every record, newest first',
  out.length === 2 && out[0].id === 'zY8wV7uT6sR5' && out[1].id === 'aB3xK9pQr7Zt',
  JSON.stringify(out.map((r) => r.id)))

// 3 — UTF-8 round trip through put -> get.
files = {}
await putPending(record('Qq1Ww2Ee3Rr4', 'Ștefania Brâncoveanu-Vodă', '2026-09-16'))
const back = await getPending('Qq1Ww2Ee3Rr4')
check('a Romanian name survives the base64 round trip',
  back !== null && back.author.name === 'Ștefania Brâncoveanu-Vodă',
  JSON.stringify(back && back.author.name))

// 4 — a malformed file is dropped, not thrown.
files = {
  'aB3xK9pQr7Zt.json': JSON.stringify(record('aB3xK9pQr7Zt', 'Maria Popescu', '2026-09-13')),
  'bC4yL0qRs8Au.json': '{ not json at all',
  'cD5zM1rSt9Bv.json': JSON.stringify({ id: 'cD5zM1rSt9Bv', author: { name: 'No answers' } }),
}
try { out = await listPending() } catch (err) { out = err }
check('a malformed file is dropped and the rest of the queue survives',
  Array.isArray(out) && out.length === 1 && out[0].id === 'aB3xK9pQr7Zt', String(out))

// 5 — delete reads the sha first, then sends it.
files = { 'aB3xK9pQr7Zt.json': JSON.stringify(record('aB3xK9pQr7Zt', 'Maria Popescu', '2026-09-13')) }
calls.length = 0
await deletePending('aB3xK9pQr7Zt')
check('delete reads the sha first and removes the file',
  !('aB3xK9pQr7Zt.json' in files) &&
    calls[0] === 'GET pending/aB3xK9pQr7Zt.json' &&
    calls[1] === 'DELETE pending/aB3xK9pQr7Zt.json',
  JSON.stringify(calls))

// 6 — an id that cannot name a file never reaches the network.
calls.length = 0
const traversal = await getPending('../../../etc/passwd')
check('a malformed id is null without a request', traversal === null && calls.length === 0, JSON.stringify(calls))

// 7 — deleting an already-deleted file is a completed delete.
files = {}
let threw = false
try { await deletePending('aB3xK9pQr7Zt') } catch { threw = true }
check('deleting a file that is already gone is not an error', threw === false)

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
```

- [ ] **Step 4: Watch the probe fail (red)**

Run:

```bash
node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  --import ./scripts/pending-store-probe-register.mjs ./scripts/pending-store-probe.mjs
```

Expected: no `PASS` lines, no summary, exit code 1, and a stack ending in:

```
    code: 'ERR_MODULE_NOT_FOUND',
    url: 'file:///Users/andreiserban/Projects/qa-portfolio/src/lib/pending-store.ts'
```

- [ ] **Step 5: Write `src/lib/pending-store.ts`**

Match `src/lib/publish-to-git.ts` — same header shape, same `ghHeaders` / `ghError` / `decodeBase64Utf8` / `encodeBase64Utf8` helpers, same `cache: 'no-store'` on every read. This module calls the same API with the same token and should read as if it were written beside it.

```ts
/**
 * SERVER ONLY. The pending queue: one JSON file per unreviewed submission, held in a PRIVATE
 * GitHub repository. Zero dependencies: plain fetch against the same REST API, with the same
 * token, that publish-to-git.ts already calls — which is the whole reason this store was chosen
 * over a database. No new account, no new service, no new npm package.
 *
 * Watching that repository on GitHub is what replaces the notification email, so a submission
 * landing here reaches the owner's phone without any code in this file doing anything about it.
 */
import { Buffer } from 'node:buffer'
import { assertSecret } from '@/lib/token'
import { isTestimonial } from '@/lib/testimonials'
import type { TestimonialRecord } from '@/lib/token-types'

// Hardcoded, exactly as OWNER/REPO/BASE_BRANCH are in publish-to-git.ts:19-21, and for the same
// reason: a misconfigured environment variable must not be able to redirect a colleague's
// submission into a repository somebody else controls.
const OWNER = 'seradi96'
const PENDING_REPO = 'qa-portfolio-pending'
const PENDING_DIR = 'pending'
const API = `https://api.github.com/repos/${OWNER}/${PENDING_REPO}`

// The id the submit route mints: randomBytes(9).toString('base64url'), which is exactly 12
// base64url characters. Same shape as ID_RE in testimonials.ts. Checked before an id is ever
// interpolated into a URL path, so `..` and `%2e%2e` cannot reach GitHub's contents API.
const ID_RE = /^[A-Za-z0-9_-]{12}$/

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

/** Returned, not thrown, so call sites can `throw await ghError(...)` and TypeScript sees the
 *  control flow end there. Same helper shape as publish-to-git.ts — deliberately duplicated
 *  rather than shared, because that module's copy is module-private and points at a different
 *  repository; exporting it would widen a file whose surface is intentionally two symbols. */
async function ghError(what: string, res: Response): Promise<Error> {
  const body = await res.text().catch(() => '')
  return new Error(`GitHub ${what} failed: ${res.status} ${res.statusText} ${body.slice(0, 500)}`)
}

/**
 * GitHub hands base64 back wrapped at 60 characters, and the payload is UTF-8. Buffer is the
 * only correct codec here: atob()/btoa() are byte-per-char, so "Șerban" would come back as
 * mojibake and be re-encoded corrupted. This is the same defect class already caught in
 * publish-to-git.ts, and it applies identically to every record that passes through here.
 */
function decodeBase64Utf8(b64: string): string {
  return Buffer.from(b64.replace(/\s+/g, ''), 'base64').toString('utf8')
}

function encodeBase64Utf8(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64')
}

function pathFor(id: string): string {
  return `${PENDING_DIR}/${id}.json`
}

type PendingFile = { text: string; sha: string }

/** `null` on 404 — the ordinary answer for an id already published or rejected. */
async function readFile(token: string, path: string): Promise<PendingFile | null> {
  const res = await fetch(`${API}/contents/${path}`, {
    method: 'GET',
    headers: ghHeaders(token, false),
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw await ghError(`read ${path}`, res)

  const body = (await res.json()) as { content?: unknown; sha?: unknown; encoding?: unknown }
  if (
    typeof body.sha !== 'string' ||
    typeof body.content !== 'string' ||
    body.encoding !== 'base64'
  ) {
    throw new Error(`GitHub returned an unexpected shape for ${path}`)
  }
  return { text: decodeBase64Utf8(body.content), sha: body.sha }
}

/**
 * Drop, never throw: one hand-broken file must not make the whole queue unreadable, which is the
 * same discipline testimonials.ts applies to the published file. The warning is unconditional
 * (not dev-only as it is there) because this runs on Vercel, where the server log is the only
 * place the owner can find out a submission has gone quiet.
 *
 * The validator is imported from testimonials.ts rather than written again here. A second
 * definition of "a valid record" would be free to drift from the first, and this feature already
 * carries one scar from exactly that — `.trim()` and `normalizeText()` disagreeing about what
 * counts as empty. One concept, one function.
 */
function parseRecord(path: string, text: string): TestimonialRecord | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    console.warn(`[pending-store] ${path} is not valid JSON — dropped from the queue`)
    return null
  }
  if (!isTestimonial(parsed)) {
    console.warn(`[pending-store] ${path} is not a well-formed record — dropped from the queue`)
    return null
  }
  return parsed
}

/** Descending string compare — newest / highest first, matching testimonials.ts. */
function descending(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? 1 : -1
}

export async function listPending(): Promise<TestimonialRecord[]> {
  const token = assertSecret('GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  const res = await fetch(`${API}/contents/${PENDING_DIR}`, {
    method: 'GET',
    headers: ghHeaders(token, false),
    cache: 'no-store',
  })

  // THE TRAP. Git cannot store an empty directory, so the moment the last pending file is
  // published or rejected the `pending` directory stops existing and this GET returns 404.
  // That is the EMPTY QUEUE, not an error. Treating it as an error breaks the admin page
  // precisely when there is nothing to do, which is most of the time.
  if (res.status === 404) return []
  if (!res.ok) throw await ghError(`list ${PENDING_DIR}`, res)

  const body = (await res.json()) as unknown
  // A directory listing is an array; a single file comes back as an object. If `pending` is
  // somehow a file, that is a broken store, not an empty one.
  if (!Array.isArray(body)) {
    throw new Error(`GitHub returned a file, not a directory, for ${PENDING_DIR}`)
  }

  const ids: string[] = []
  for (const entry of body) {
    if (typeof entry !== 'object' || entry === null) continue
    const e = entry as { type?: unknown; name?: unknown }
    if (e.type !== 'file' || typeof e.name !== 'string' || !e.name.endsWith('.json')) continue
    const id = e.name.slice(0, -'.json'.length)
    if (!ID_RE.test(id)) {
      console.warn(`[pending-store] ${PENDING_DIR}/${e.name} is not a record file — ignored`)
      continue
    }
    ids.push(id)
  }

  // One content GET per entry, sequentially. The listing carries no file contents, and this
  // queue holds single digits of records at a time — at that size a loop is simpler, and
  // easier to read a log from, than anything clever.
  const records: TestimonialRecord[] = []
  for (const id of ids) {
    const path = pathFor(id)
    const file = await readFile(token, path)
    if (file === null) continue // published or rejected between the listing and this read
    const record = parseRecord(path, file.text)
    if (record === null) continue
    if (record.id !== id) {
      console.warn(`[pending-store] ${path} holds id ${record.id} — dropped from the queue`)
      continue
    }
    records.push(record)
  }

  // Newest first, ties broken by id so the order is stable across reloads — the same rule
  // TESTIMONIALS uses, so the admin list and the public section never disagree about order.
  return records.sort(
    (a, b) => descending(a.submittedAt, b.submittedAt) || descending(a.id, b.id),
  )
}

export async function getPending(id: string): Promise<TestimonialRecord | null> {
  // An id of the wrong shape cannot name a file in this store, so it is `null` without a
  // request — and, more to the point, without ever being interpolated into a URL path.
  if (!ID_RE.test(id)) return null
  const token = assertSecret('GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  const path = pathFor(id)
  const file = await readFile(token, path)
  if (file === null) return null
  const record = parseRecord(path, file.text)
  if (record === null || record.id !== id) return null
  return record
}

export async function putPending(record: TestimonialRecord): Promise<void> {
  const token = assertSecret('GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  // Validated on the way in as well as on the way out. isTestimonial checks `id` against the
  // same 12-character base64url rule, which is what makes pathFor(record.id) below safe.
  if (!isTestimonial(record)) {
    throw new Error('putPending refused a record that is not a well-formed testimonial')
  }
  const path = pathFor(record.id)

  // GitHub's contents PUT creates a file when `sha` is absent and updates one when it is
  // present — and rejects the wrong choice with a 422. Reading first makes the write
  // idempotent, so a retried submission overwrites its own file instead of failing.
  const existing = await readFile(token, path)
  const res = await fetch(`${API}/contents/${path}`, {
    method: 'PUT',
    headers: ghHeaders(token, true),
    body: JSON.stringify({
      message: `pending: ${record.author.name} (${record.author.company})\n\nRecord id: ${record.id}`,
      // Machine-written through JSON.stringify, never a string template: no answer text can
      // break out of its own string literal.
      content: encodeBase64Utf8(JSON.stringify(record, null, 2) + '\n'),
      ...(existing === null ? {} : { sha: existing.sha }),
    }),
  })
  if (!res.ok) throw await ghError(`write ${path}`, res)
}

export async function deletePending(id: string): Promise<void> {
  const token = assertSecret('GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  if (!ID_RE.test(id)) throw new Error(`deletePending was given a malformed id: ${id}`)
  const path = pathFor(id)

  // DELETE requires the blob sha of the file as it stands, so there is always a read first.
  // A file that is already gone is a completed delete, not a failure: the owner double-tapping
  // Reject on a slow connection must not see an error for work that succeeded.
  const existing = await readFile(token, path)
  if (existing === null) return

  const res = await fetch(`${API}/contents/${path}`, {
    method: 'DELETE',
    headers: ghHeaders(token, true),
    body: JSON.stringify({ message: `pending: remove ${id}`, sha: existing.sha }),
  })
  if (!res.ok) throw await ghError(`delete ${path}`, res)
}
```

- [ ] **Step 6: Watch the probe pass (green)**

Run:

```bash
node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  --import ./scripts/pending-store-probe-register.mjs ./scripts/pending-store-probe.mjs
```

Expected, exactly:

```
PASS  an empty pending directory (404) lists as []
PASS  a normal list returns every record, newest first
PASS  a Romanian name survives the base64 round trip
[pending-store] pending/bC4yL0qRs8Au.json is not valid JSON — dropped from the queue
[pending-store] pending/cD5zM1rSt9Bv.json is not a well-formed record — dropped from the queue
PASS  a malformed file is dropped and the rest of the queue survives
PASS  delete reads the sha first and removes the file
PASS  a malformed id is null without a request
PASS  deleting a file that is already gone is not an error

7 passed, 0 failed
```

The two `[pending-store]` lines are the drop-not-throw discipline working, printed from inside assertion 4. Their absence would mean a malformed file was accepted rather than dropped.

- [ ] **Step 7: Prove the empty-directory 404 branch is really what makes assertion 1 pass**

The 404-is-empty rule is the one defect in this module that hides until the queue is empty, so confirm the assertion actually pins it rather than passing for some other reason. In `src/lib/pending-store.ts`, temporarily delete the line `if (res.status === 404) return []` (leave its comment), re-run the probe from Step 6, then put the line back and re-run.

Expected with the line removed — one failure, and it is assertion 1:

```
FAIL  an empty pending directory (404) lists as []
      Error: GitHub list pending failed: 404  {"message":"Not Found"}
```

ending in `6 passed, 1 failed` and exit code 1. With the line restored, `7 passed, 0 failed` again. If removing the line changes nothing, the mock is not returning 404 for the empty directory and Step 3 was mistyped.

- [ ] **Step 8: Delete the throwaway probe**

```bash
rm scripts/pending-store-probe.mjs scripts/pending-store-probe-hook.mjs scripts/pending-store-probe-register.mjs
```

It is deleted rather than committed on purpose: `npm run check:tokens` is the one harness in this repo, and a second one that no npm script runs would rot silently against the module it is meant to protect. Its full text is in Steps 2–3 of this plan if it is needed again.

- [ ] **Step 9: Widen the `GITHUB_TOKEN` note in `.env.local.example`**

Replace lines 21–22:

```
# Fine-grained GitHub PAT for seradi96/qa-portfolio ONLY: Contents Read & Write, Pull requests
# Read & Write, nothing else. Never logged. Revoke first if anything looks wrong.
```

with:

```
# Fine-grained GitHub PAT for TWO repositories, and only these two:
#   seradi96/qa-portfolio          Contents Read & Write, Pull requests Read & Write
#   seradi96/qa-portfolio-pending  Contents Read & Write   (the private pending store)
# Nothing else, on either. Never logged. Revoke first if anything looks wrong.
```

- [ ] **Step 10: NAMED MANUAL CHECK — create the private store and widen the token**

This is the one part of the whole plan that cannot be done from the editor, and nothing in the code above can detect that it was skipped. Do it now, in the browser:

1. Open `https://github.com/new`. Owner **seradi96**, name **qa-portfolio-pending**, visibility **Private**, and **tick "Add a README file"**. The README is not decoration: a repository with no commits has no default branch, and GitHub's contents API cannot write the first file into one.
2. On that new repo: **Watch → All Activity**. This is the entire notification mechanism now that no email is sent — without it a submission sits unseen and nothing fails loudly.
3. Open `https://github.com/settings/personal-access-tokens`, edit the existing fine-grained token, and add `seradi96/qa-portfolio-pending` to its repository access with **Contents: Read and write**. Leave the public repo's permissions exactly as they are.
4. Verify the pieces line up, without writing anything:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     -H "Authorization: Bearer $(grep '^GITHUB_TOKEN=' .env.local | cut -d= -f2-)" \
     -H 'Accept: application/vnd.github+json' \
     -H 'X-GitHub-Api-Version: 2022-11-28' \
     https://api.github.com/repos/seradi96/qa-portfolio-pending/contents/pending
   ```
   Expected: `404` — the repo exists and the token can read it, and `pending/` does not exist yet, which is the empty queue this module is built to return `[]` for. A `401` means the token was not widened; a `404` is indistinguishable from a missing repo here, so if step 1 was skipped, re-run the same curl against `.../qa-portfolio-pending` with no `/contents/pending` suffix and expect `200`.

- [ ] **Step 11: Confirm all three gates**

Run: `npm run build && npm run lint && npm run check:tokens`

Expected: the build finishes with the same seven-row route table as before, postbuild prints `postbuild: OK — static: verified …; secrets: 4/4 checked, none found; content: skipped (store empty)`, `eslint` prints nothing and exits 0, and the harness ends `44 passed, 0 failed` — unchanged from Task 1, because this task added no assertions to it. Nothing imports `pending-store.ts` yet, so it does not appear in the route table.

- [ ] **Step 12: Commit**

```bash
git add src/lib/pending-store.ts src/lib/testimonials.ts .env.local.example
git commit -m "feat(admin): read and write the private pending store"
```

Confirm the throwaway probe did not sneak in: `git show --stat HEAD` must list exactly three files, none of them under `scripts/`.

---

### Task 3: The submit route writes to the pending store instead of sending email

**Files:**
- Modify: `src/app/api/testimonials/submit/route.ts:17` (module-header rationale)
- Modify: `src/app/api/testimonials/submit/route.ts:25` (notify import → pending-store import)
- Modify: `src/app/api/testimonials/submit/route.ts:34-40` (token import list)
- Modify: `src/app/api/testimonials/submit/route.ts:111` (unused `modSecret`)
- Modify: `src/app/api/testimonials/submit/route.ts:208-253` (moderation token + URL budget + 413 + email send → store write)
- Delete: `src/lib/notify.ts`

**Interfaces:**
- Consumes: `putPending(record: TestimonialRecord): Promise<void>` from `src/lib/pending-store.ts` (Task 1). Also, unchanged: `SITE_ORIGIN`, `assertSecret`, `verifyInviteToken` from `@/lib/token`; `CONSENT_VERSION` from `@/lib/consent`; `isProjectSlug` from `@/lib/projects-meta`; `CAPS`, `FieldError`, `extractLinkedinSlug`, `sanitizeAnswer`, `sanitizeIdentity` from `@/lib/sanitize`; `TestimonialRecord` from `@/lib/token-types`.
- Produces: no new exports. What later tasks rely on is the HTTP contract of `POST /api/testimonials/submit` after this task: `200 {ok:true}` · `400` malformed body · `403` bad Origin or bad/absent invite token · `410` expired invite · `422` `{field, message}` · `500` unhandled · `503` store write failed. The URL-budget `413` with its "trim by N characters" figure is gone; the two 16 KiB body-cap `413`s remain but are unreachable from the real form (see Step 12).

Everything before the tail — the body cap, the Origin check, invite verification, expiry, `isProjectSlug`, `sanitizeIdentity` × 3, `extractLinkedinSlug`, `sanitizeAnswer` × 4, the `consent !== true` check, and the `randomBytes(9)` id — is the trust boundary this whole design rests on. Do not touch any of it. The only lines that change are listed above.

---

- [ ] **Step 1: Read the tail you are about to replace**

Run: `sed -n '206,256p' src/app/api/testimonials/submit/route.ts`

Expected: the block starts with `    // §7.7 — sign under m1 (gzip happens inside signModerationToken) and assert the` and ends with `    return json({ ok: true }, 200)`. In between you should see `signModerationToken(record, modSecret)`, a `moderationUrl.length > MAX_MODERATION_URL_CHARS` branch returning `413`, and `await sendModerationEmail(record, moderationToken)` inside a `try`. If any of those three is missing, stop — someone has already edited this file and the anchors below will not match.

- [ ] **Step 2: Replace the tail — the store write becomes the commit point**

In `src/app/api/testimonials/submit/route.ts`, replace this exact block (it begins immediately after the closing `}` of the `const record: TestimonialRecord = { … }` object and ends immediately before `    return json({ ok: true }, 200)`):

```ts
    // §7.7 — sign under m1 (gzip happens inside signModerationToken) and assert the
    // whole moderation URL fits. Measured by `npm run check:tokens` against the 2400
    // budget: English prose at every cap 1663 chars, Romanian at the absolute legal
    // maximum (every cap, 60-char encoded slug) 1991 chars, pathological incompressible
    // input ~2507 (still over, which is what the 413 below exists for). The assert is
    // what keeps a later cap increase from silently producing an unusable link.
    const moderationToken = signModerationToken(record, modSecret)
    const moderationUrl = `${SITE_ORIGIN}/moderate#a=publish&t=${moderationToken}`
    if (moderationUrl.length > MAX_MODERATION_URL_CHARS) {
      const overUrlChars = moderationUrl.length - MAX_MODERATION_URL_CHARS
      // The payload is gzipped, then base64url-encoded. Because it is compressed,
      // removing one source character shrinks the compressed payload by LESS than one
      // byte, not one-for-one. The multiplier is therefore above 1, not below it.
      // This value (1.25) was chosen by measurement: 60 randomized trials with
      // incompressible fixtures showed 0/60 success at 0.75, and 60/60 at 1.1+.
      // Asking for ~25% more margin is safe (nothing to a submitter) but buys
      // resilience against content that compresses differently from the test fixture.
      // Future editors changing field caps should re-measure rather than reason about it.
      const trimBy = Math.ceil(overUrlChars * 1.25)
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
    } catch (err) {
      console.error(
        '[testimonials/submit] send failed:',
        err instanceof Error ? err.message : typeof err,
      )
      return json(
        {
          error:
            'Could not deliver this to Andrei right now. Nothing was lost — please try again in a minute.',
        },
        503,
      )
    }
```

with exactly this:

```ts
    // §7.7 — THE STORE WRITE IS THE COMMIT POINT. It replaces the email send, and
    // inherits its meaning exactly: until this write succeeds the submission exists
    // only in the submitter's own browser, so a failure must never read as success.
    // 503 tells the form to keep every typed answer on screen and offer a retry.
    try {
      await putPending(record)
    } catch (err) {
      // Message, not just name: a bad credential, a rate limit and an outage are three
      // different problems with three different fixes, and a bare catch left no way to
      // tell them apart. What pending-store throws is the GitHub status line plus a
      // truncated response body — the token is a request header and is never echoed
      // back, so this cannot log the credential.
      console.error(
        '[testimonials/submit] pending write failed:',
        err instanceof Error ? err.message : typeof err,
      )
      return json(
        {
          error:
            'Could not save this for Andrei right now. Nothing was lost — please try again in a minute.',
        },
        503,
      )
    }
```

Leave the blank line and `    return json({ ok: true }, 200)` that follow exactly as they are.

- [ ] **Step 3: Watch it fail**

Run: `npm run build`

Expected: fails at the TypeScript stage, before "Collecting page data":

```
✓ Compiled successfully in 1394ms
  Running TypeScript ...
Failed to type check.

./src/app/api/testimonials/submit/route.ts:210:13
Type error: Cannot find name 'putPending'.
```

(The line number depends on your file; the message is the point.) `putPending` is used but not yet imported. That is the next step.

- [ ] **Step 4: Swap the notify import for the pending-store import**

In `src/app/api/testimonials/submit/route.ts`, replace:

```ts
import { CONSENT_VERSION } from '@/lib/consent'
import { sendModerationEmail } from '@/lib/notify'
import { isProjectSlug } from '@/lib/projects-meta'
```

with:

```ts
import { CONSENT_VERSION } from '@/lib/consent'
import { putPending } from '@/lib/pending-store'
import { isProjectSlug } from '@/lib/projects-meta'
```

The import block stays alphabetical by module path, which is why `pending-store` lands exactly where `notify` was.

- [ ] **Step 5: Trim the token import to what is still used**

In the same file, replace:

```ts
import {
  MAX_MODERATION_URL_CHARS,
  SITE_ORIGIN,
  assertSecret,
  signModerationToken,
  verifyInviteToken,
} from '@/lib/token'
```

with:

```ts
import { SITE_ORIGIN, assertSecret, verifyInviteToken } from '@/lib/token'
```

`signModerationToken` and `MAX_MODERATION_URL_CHARS` still exist in `src/lib/token.ts` at this point — a later task deletes them from there. This task only stops importing them.

- [ ] **Step 6: Drop the now-unused MOD_SECRET read**

In the same file, replace:

```ts
    const inviteSecret = assertSecret('INVITE_SECRET', process.env.INVITE_SECRET)
    const modSecret = assertSecret('MOD_SECRET', process.env.MOD_SECRET)
```

with:

```ts
    const inviteSecret = assertSecret('INVITE_SECRET', process.env.INVITE_SECRET)
```

`modSecret` had exactly one consumer, `signModerationToken`, which is gone. `MOD_SECRET` is not unchecked as a result: `src/lib/token.ts` asserts it at module scope, and from Task 2 onward it is the admin session signing key.

- [ ] **Step 7: Fix the one now-false sentence in the module header**

The header's rate-limiting rationale still argues from "one email to the owner's own inbox". That is no longer what a successful POST does. Replace:

```ts
// it requires INVITE_SECRET), the 16 KiB body cap, and the fact that a successful
// POST only ever produces one email to the owner's own inbox, never a public write
// — there is nothing here worth spamming for. A durable rate limit would need
// shared state (e.g. an external KV store), which is a new dependency this task is
// not scoped to add.
```

with:

```ts
// it requires INVITE_SECRET), the 16 KiB body cap, and the fact that a successful
// POST only ever writes one small file to the owner's own PRIVATE repository, never
// a public write — there is nothing here worth spamming for. A durable rate limit
// would need shared state (e.g. an external KV store), which is a new dependency
// this task is not scoped to add.
```

The argument is unchanged — nothing here is worth spamming for — only the fact it rests on.

- [ ] **Step 8: Delete notify.ts and prove nothing imports it**

```bash
git rm src/lib/notify.ts
grep -rn "notify\|sendModerationEmail" src scripts
```

Expected: `git rm` prints `rm 'src/lib/notify.ts'`, and the grep prints nothing at all (exit status 1, no output). If it prints any line, that file still imports the module you just deleted and the build will fail — fix it before continuing.

Note on `RESEND_API_KEY`: this task deletes the only code that ever read it. Removing the variable from `.env.local`, from `SECRET_NAMES` in `scripts/postbuild-check.mjs:78`, and from the runbook belongs to the environment task, not this one. Until then `npm run postbuild` still reports `secrets: 4/4 checked`, which is expected, not a regression.

- [ ] **Step 9: Watch it pass**

Run: `npm run build`

Expected: compiles, type-checks, and ends with the postbuild gate green:

```
✓ Compiled successfully in ...
  Running TypeScript ...
  Finished TypeScript in ...
```

and, after the route table (which by now also lists whatever `/api/admin/*` routes Tasks 1–2 added):

```
postbuild: note: src/content/testimonials.json is empty — content check skipped
postbuild: OK — static: verified — '/' is in the prerender manifest; secrets: 4/4 checked, none found; content: skipped (store empty)
```

`ƒ /api/testimonials/submit` must still be in the route table.

- [ ] **Step 10: Lint and the token harness**

```bash
npm run lint
npm run check:tokens
```

Expected: `npm run lint` prints only the two npm banner lines and exits 0 — **no warnings**. In particular none of `'sendModerationEmail' is defined but never used`, `'MAX_MODERATION_URL_CHARS' is defined but never used`, `'signModerationToken' is defined but never used`, `'modSecret' is assigned a value but never used`. Any of those means you skipped Step 4, 5 or 6.

`npm run check:tokens` must print the same `N passed, 0 failed` line Task 2 ended on — this task appends no assertions and must not change N (it was `37 passed, 0 failed` before Task 2's additions). `0 failed` is the gate.

- [ ] **Step 11: Write the manual exercise script**

This is a **named manual check, not a test** — it is never committed and never added to `check:tokens`. It drives the real handler with hand-built `Request` objects, resolves `@/lib/pending-store` to an in-memory mock, and replaces `globalThis.fetch` with a thrower so no HTTP call can leave the machine. It uses no real `GITHUB_TOKEN`, touches no repository, and sends no email.

Write it to `/tmp/exercise-submit.mjs`:

```js
// Manual exercise of POST /api/testimonials/submit. NOT a test, not committed.
// Zero network: globalThis.fetch is replaced with a thrower, and @/lib/pending-store
// is resolved to an in-memory mock.
import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = process.cwd()

// The mock lives in a data: URL, not a second file. An identical href is guaranteed to
// be the same module instance, so what the route imports and what this script inspects
// are the one object — with two files, a /tmp vs /private/tmp symlink difference gives
// you two instances and a silently useless mock.
const MOCK_SRC = `
export const MOCK = { fail: false }
export const WRITES = []
export async function listPending() { return WRITES.slice() }
export async function getPending(id) { return WRITES.find((r) => r.id === id) ?? null }
export async function putPending(record) {
  if (MOCK.fail) {
    throw new Error('GitHub put pending failed: 401 Unauthorized {"message":"Bad credentials"}')
  }
  WRITES.push(record)
}
export async function deletePending(id) {
  const i = WRITES.findIndex((r) => r.id === id)
  if (i >= 0) WRITES.splice(i, 1)
}
`
const MOCK_URL = `data:text/javascript;base64,${Buffer.from(MOCK_SRC).toString('base64')}`

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/pending-store') return { url: MOCK_URL, shortCircuit: true }
    if (specifier.startsWith('@/')) {
      return {
        url: pathToFileURL(path.join(ROOT, 'src', specifier.slice(2) + '.ts')).href,
        shortCircuit: true,
      }
    }
    return nextResolve(specifier, context)
  },
})

process.env.INVITE_SECRET = 'x'.repeat(48)
process.env.MOD_SECRET = 'y'.repeat(48)
delete process.env.GITHUB_TOKEN
delete process.env.RESEND_API_KEY

globalThis.fetch = async () => {
  throw new Error('NETWORK BLOCKED — the handler tried to make a real HTTP call')
}

const { signInviteToken } = await import(pathToFileURL(path.join(ROOT, 'src/lib/token.ts')).href)
const { POST } = await import(
  pathToFileURL(path.join(ROOT, 'src/app/api/testimonials/submit/route.ts')).href
)
const mock = await import(MOCK_URL)

const SITE_ORIGIN = 'https://aserban.ro'
const future = Math.floor(Date.now() / 1000) + 3600
const past = Math.floor(Date.now() / 1000) - 3600

function invite(exp) {
  return signInviteToken(
    {
      v: '1',
      name: 'Maria Popescu',
      role: 'QA Lead',
      company: 'TOKERO',
      projectSlug: 'tokero',
      message: 'Would you write a few lines?',
      exp,
    },
    process.env.INVITE_SECRET,
  )
}

function goodBody(overrides = {}) {
  return {
    token: invite(future),
    projectSlug: 'tokero',
    name: 'Maria Popescu',
    role: 'QA Lead',
    company: 'TOKERO',
    linkedinSlug: 'https://www.linkedin.com/in/maria-popescu/',
    answers: {
      whatIDid: 'He built the regression suite and taught the team to read its failures.',
      whatChanged: 'Regression went from two days of clicking to an overnight run.',
      hiringManager: 'Hire him.',
      anythingElse: '',
    },
    consent: true,
    ...overrides,
  }
}

function req(body, { origin = SITE_ORIGIN, raw } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (origin !== null) headers.origin = origin
  return new Request('https://aserban.ro/api/testimonials/submit', {
    method: 'POST',
    headers,
    body: raw ?? JSON.stringify(body),
  })
}

async function run(label, request) {
  const res = await POST(request)
  let body
  try {
    body = await res.json()
  } catch {
    body = '<non-json>'
  }
  console.log(`${String(res.status).padEnd(4)} ${label.padEnd(38)} ${JSON.stringify(body)}`)
  return res.status
}

console.log('status  case                                   body')
await run('happy path (mocked store write ok)', req(goodBody()))
await run('wrong Origin', req(goodBody(), { origin: 'https://evil.example' }))
await run('missing Origin', req(goodBody(), { origin: null }))
await run('expired invite', req(goodBody({ token: invite(past) })))
{
  const t = invite(future)
  const [payload, sig] = t.split('.')
  // Flip the FIRST signature character, not the last: 43 base64url chars carry 258
  // bits for a 32-byte HMAC, so the final character's low 4 bits are padding and
  // flipping them decodes to the identical bytes — a "tamper" that still verifies.
  const tampered = `${payload}.${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}`
  await run('tampered signature', req(goodBody({ token: tampered })))
}
await run('missing consent', req(goodBody({ consent: false })))
await run(
  'over-cap field (whatIDid 301 chars)',
  req(goodBody({ answers: { ...goodBody().answers, whatIDid: 'a'.repeat(301) } })),
)
await run('bad projectSlug', req(goodBody({ projectSlug: 'not-a-project' })))
await run('malformed JSON body', req(null, { raw: '{not json' }))
mock.MOCK.fail = true
await run('mocked GitHub failure', req(goodBody()))
mock.MOCK.fail = false

console.log(`\nrecords written to the mock store: ${mock.WRITES.length}`)
console.log(JSON.stringify(mock.WRITES[0], null, 2))
```

- [ ] **Step 12: Run the exercise and check every status**

Run, from the repo root (the script resolves `@/` against `process.cwd()`):

`node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON /tmp/exercise-submit.mjs`

Expected — these are the statuses this exact code actually returns:

```
status  case                                   body
200  happy path (mocked store write ok)     {"ok":true}
403  wrong Origin                           {"error":"Requests must come from aserban.ro."}
403  missing Origin                         {"error":"Requests must come from aserban.ro."}
410  expired invite                         {"error":"This invite link has expired. Ask Andrei for a fresh one — andre.serban96@gmail.com."}
403  tampered signature                     {"error":"This link is not valid."}
422  missing consent                        {"field":"consent","message":"Please tick the consent box before sending."}
422  over-cap field (whatIDid 301 chars)    {"field":"whatIDid","message":"That is 1 characters too long (limit 300)."}
422  bad projectSlug                        {"field":"projectSlug","message":"Pick one of the listed projects."}
400  malformed JSON body                    {"error":"Malformed request body."}
[testimonials/submit] pending write failed: GitHub put pending failed: 401 Unauthorized {"message":"Bad credentials"}
503  mocked GitHub failure                  {"error":"Could not save this for Andrei right now. Nothing was lost — please try again in a minute."}

records written to the mock store: 1
```

followed by the one stored record, which must show `"linkedinSlug": "maria-popescu"` (the submitted value was a full LinkedIn URL — proof `extractLinkedinSlug` still runs), all four answer keys present with `"anythingElse": ""`, `"consent": {"version": 1, "at": "…T…Z"}` with no milliseconds, and a 12-character base64url `id`.

Three things to read carefully:
- The `records written` count must be **1**, not 2. If the tampered-signature case also wrote a record it returned 200, which means the invite HMAC is not being enforced — stop and fix that before anything else.
- The `[testimonials/submit] pending write failed:` line must carry the GitHub status text. If it says `NETWORK BLOCKED — the handler tried to make a real HTTP call`, the mock was not wired in and the handler tried to reach the internet.
- **413 never appears.** The URL-budget branch is gone. The two 16 KiB body-cap 413s still exist in the handler but nothing the form can produce reaches them: `TestimonialForm.tsx:334-337` refuses to send an over-cap answer client-side, so a form body is orders of magnitude under 16 KiB. They now only fire for a hand-crafted oversized body, which is what they were for.

Then delete the scratch file: `rm /tmp/exercise-submit.mjs`

- [ ] **Step 13: Flag the form's now-dead copy — do not edit it**

Run: `grep -n "413\|503" src/app/invite/TestimonialForm.tsx`

Expected: hits at lines 164, 166, 182 (the 413 branch of `messageForStatus`) and 193 (the 503 branch).

Both are now wrong, and **Task 7 owns the form — make no edit here.** Record for Task 7:
- `TestimonialForm.tsx:182` — the `if (status === 413)` branch and its fallback copy ("There is a little more text than fits in one link") is dead: no reachable 413 carries a `{error}` body a submitter could see. Dead but harmless — it cannot fire.
- `TestimonialForm.tsx:164-166` — the comment above `readErrorBody` explains the `message`-then-`error` fallback by pointing at "the 413s, which are the ones that carry a computed 'trim by N characters' figure". That figure no longer exists. The fallback itself is still needed (every non-422 rejection still sends `{error}`); only the justification is stale.
- `TestimonialForm.tsx:193` — the 503 copy still says "The email did not go out, so Andrei has not seen this yet." Still the right *shape* of message (nothing lost, tap Send again) but factually wrong about email. This one is live and a submitter can actually see it.

- [ ] **Step 14: Commit**

```bash
git add src/app/api/testimonials/submit/route.ts src/lib/notify.ts
git commit -m "feat(testimonials): write submissions to the pending store instead of emailing

The submit route's commit point moves from sendModerationEmail to
putPending. Its meaning is unchanged: until the write lands, the
submission exists only in the submitter's browser, so a failure still
returns 503 with copy that keeps every typed answer and invites a retry.

Deletes the moderation-token signing and the moderation-URL budget
assert along with the 413 branch and its trim-advice arithmetic - with
no email link, there is no URL to fit anything into. Drops src/lib/notify.ts
and the last read of RESEND_API_KEY.

Sanitisation, consent and id minting are untouched.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Stage only these two paths — other tasks may have uncommitted work in the tree.

---

### Task 4: The three admin API routes — login, publish, reject

**Files:**
- Create: `src/app/api/admin/login/route.ts`
- Create: `src/app/api/admin/publish/route.ts`
- Create: `src/app/api/admin/reject/route.ts`
- Modify (local only, gitignored, never committed): `.env.local`

**Interfaces:**
- Consumes: `SESSION_COOKIE`, `SESSION_TTL_SECONDS`, `checkPassword(supplied: unknown): boolean`, `mintSession(nowSeconds: number): string`, `verifySession(cookieValue: string | undefined, nowSeconds: number): boolean` from `@/lib/admin-auth`; `getPending(id: string): Promise<TestimonialRecord | null>`, `deletePending(id: string): Promise<void>` from `@/lib/pending-store`; `publishTestimonial(record)` and the `PublishResult` type from `@/lib/publish-to-git`; `SITE_ORIGIN` from `@/lib/token`; `CAPS`, `FieldError`, `extractLinkedinSlug`, `sanitizeAnswer`, `sanitizeIdentity` from `@/lib/sanitize`; `CONSENT_VERSION` from `@/lib/consent`; `isProjectSlug` from `@/lib/projects-meta`; the `TestimonialRecord` type from `@/lib/token-types`.
- Produces: `export async function POST(req: Request): Promise<Response>` at `/api/admin/login`, `/api/admin/publish` and `/api/admin/reject`, answering exactly — login: 204 + `Set-Cookie` · 400 · 401 · 403; publish: 200 `PublishResult` · 400 · 401 · 403 · 404 · 422 · 502; reject: 204 · 400 · 401 · 403 · 404. The admin page task fetches these three paths and switches on those statuses.

- [ ] **Step 1: Confirm the working tree is where this task starts**

The three routes import modules earlier tasks created, and they must not collide with the dead moderation path. Both facts are one command each.

Run: `test -f src/lib/admin-auth.ts && test -f src/lib/pending-store.ts && echo "libs present"`

Expected: `libs present`. If either file is missing, the earlier task that creates it has not run — stop here rather than stubbing it.

Run: `grep -rn "ModerationToken" src/`

Expected: no output, and the command exits 1 (`echo "exit=$?"` prints `exit=1`). Any hit means `src/app/api/testimonials/publish/route.ts` or the submit route still references the deleted signing helpers, and `npm run build` below will fail on the import, not on anything this task wrote.

- [ ] **Step 2: Give the local environment an `ADMIN_PASSWORD`**

`@/lib/admin-auth` asserts the password at module load, and from the moment a route handler imports it `next build` evaluates that module during "Collecting page data". Without this line the build in Step 4 fails before it compiles anything. `.env.local` is gitignored; this value is local only and is not the production one.

```bash
grep -q "^ADMIN_PASSWORD=" .env.local || printf 'ADMIN_PASSWORD=%s\n' "$(node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))")" >> .env.local
grep -c "^ADMIN_PASSWORD=" .env.local
```

Expected: `1`. `randomBytes(24).toString('base64url')` is 32 characters, comfortably over the 24-character floor.

- [ ] **Step 3: Write the login route**

Create `src/app/api/admin/login/route.ts`:

```ts
// POST /api/admin/login — admin-moderation design §7.
//
// There is deliberately NO `export const runtime` in this file, exactly as in its two
// siblings. 'nodejs' is the Next 16 default, and 'edge' is deprecated there AND
// hard-fails the build the moment anything in the import graph touches node:crypto —
// which @/lib/admin-auth and @/lib/token both do. Adding `export const runtime = 'edge'`
// is the one reflex an experienced Next developer has when they see a route handler.
// Do not.
//
// No rate limiting here, and a module-scoped `Map` of attempts-per-IP is REFUSED rather
// than merely omitted. On Vercel this route runs as a lambda: the Map resets on every
// cold start and is never shared across concurrent invocations, so an attacker spraying
// guesses lands on fresh instances that have never counted anything, while a legitimate
// retry that happens to hit a warm one gets locked out. It reads as protection while
// providing none, and that reading is itself the harm — it invites treating the password
// as throttled when it is not.
//
// The real defence is ADMIN_PASSWORD: a generated value of at least 24 characters, with
// the length asserted at module load in @/lib/admin-auth so a weak one fails the build
// rather than surfacing as a broken login. At 24 random characters the keyspace is not
// brute-forceable at any rate a lambda can serve. A durable limit would need shared state
// (an external KV store), which is a new service and a new dependency this design does
// not take.

import { SESSION_COOKIE, SESSION_TTL_SECONDS, checkPassword, mintSession } from '@/lib/admin-auth'
import { SITE_ORIGIN } from '@/lib/token'

/** `{"password":"<64 characters>"}` is under 100 bytes. 1 KiB is ten times the largest honest body. */
const MAX_BODY_BYTES = 1024

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
 * Returns null when the body is over budget. Counting what actually arrives, chunk by
 * chunk, is what makes a lying Content-Length header unable to force an allocation — the
 * header check alone is advisory.
 *
 * Deliberately duplicated from the other route handlers rather than shared: the interface
 * contract fixes the exported surface of every lib module and this helper is not in it,
 * so it stays module-private in each route that needs it.
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
  // Size gate, before any parsing.
  const declaredLength = req.headers.get('content-length')
  if (declaredLength !== null) {
    const declared = Number(declaredLength)
    if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) {
      return json({ error: 'Request body too large.' }, 413)
    }
  }

  // Origin. A hardcoded module constant, never an env var, so a misconfigured
  // environment cannot widen it and every preview deployment fails closed.
  if (req.headers.get('origin') !== SITE_ORIGIN) {
    return json({ error: 'Requests must come from aserban.ro.' }, 403)
  }

  try {
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
    if (body === null) {
      return json({ error: 'Malformed request body.' }, 400)
    }

    // One flat message, and the same one for every failure: wrong password, absent
    // field, a number instead of a string. Anything that varies with what was supplied —
    // 'too short', 'nearly', a different status for a non-string — is a free oracle that
    // tells an attacker which half of the guess to keep. checkPassword takes `unknown`
    // precisely so this route never has to branch on the shape before comparing, and the
    // timing-safe compare lives behind it.
    if (!checkPassword(body.password)) {
      return json({ error: 'That password is not right.' }, 401)
    }

    const value = mintSession(Math.floor(Date.now() / 1000))

    // 204 must carry NO body: `new Response(JSON.stringify(...), { status: 204 })` throws
    // `TypeError: Response constructor: Invalid response status code 204` (verified on
    // Node 24), so this one answer cannot go through json() the way every other one here
    // does. `Secure` is unconditional and correct even in local development, because the
    // Origin check above means this line is only ever reached for a request from
    // https://aserban.ro.
    return new Response(null, {
      status: 204,
      headers: {
        'set-cookie': `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`,
      },
    })
  } catch (err) {
    // Name only, never the message: an Error thrown from a signing path can carry a key
    // in its text, and the design requires the credentials never be logged.
    console.error('[admin/login] unhandled:', err instanceof Error ? err.name : typeof err)
    return json({ error: 'Something went wrong on our side.' }, 500)
  }
}
```

- [ ] **Step 4: Build and lint with only the login route in place**

One route at a time, so an import or env mistake is unambiguous.

Run: `npm run build && npm run lint`

Expected: `✓ Compiled successfully`, a route table that now lists `/api/admin/login`, then `postbuild: OK — static: verified — '/' is in the prerender manifest; …`, and ESLint printing nothing. A failure reading `ADMIN_PASSWORD is missing or shorter than 24 characters` during "Collecting page data" means Step 2 was skipped.

- [ ] **Step 5: Write the publish route**

Create `src/app/api/admin/publish/route.ts`:

```ts
// POST /api/admin/publish — admin-moderation design §8.
//
// No `export const runtime` here either: 'nodejs' is the Next 16 default, and 'edge' is
// deprecated and hard-fails the build on node:crypto, which @/lib/token and
// @/lib/admin-auth both use.
//
// No rate limiting, deliberately. A module-scoped Map throttle is REFUSED rather than
// omitted: on Vercel it resets on every cold start and is not shared across concurrent
// lambdas, so it is theatre that reads as protection. What actually contains this route
// is the session cookie (forging one needs MOD_SECRET), the hardcoded Origin check, and
// the fact that a successful call opens a pull request rather than changing the live site.

import { getPending, deletePending } from '@/lib/pending-store'
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
import { SESSION_COOKIE, verifySession } from '@/lib/admin-auth'
import { SITE_ORIGIN } from '@/lib/token'
import type { TestimonialRecord } from '@/lib/token-types'

/** The body is `{"id":"<12 characters>"}` — 21 bytes. 1 KiB is many times the largest honest body. */
const MAX_BODY_BYTES = 1024

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
 * Deliberately duplicated from the other route handlers rather than shared: the interface
 * contract fixes the exported surface of every lib module and this helper is not in it.
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

/**
 * The session cookie's value, or undefined. Read straight off the Cookie header rather
 * than through `cookies()` from next/headers: these handlers take a plain `Request` and
 * read `req.headers` for everything else, and the async dynamic API would make the
 * handler unusable outside a Next request scope. The value is `<digits>.<base64url>`,
 * which needs no percent-decoding — decoding it would only invent failure modes.
 */
function sessionCookie(req: Request): string | undefined {
  const header = req.headers.get('cookie')
  if (header === null) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== SESSION_COOKIE) continue
    return part.slice(eq + 1).trim()
  }
  return undefined
}

type Revalidated =
  | { ok: true; record: TestimonialRecord }
  | { ok: false; field: string; message: string }

/**
 * Every field goes back through the same sanitiser the submit route used, and the
 * RE-SANITISED values are what get published — never the values that came out of the
 * store. The record has been sitting in the pending store since it was sanitised: it may
 * have been written weeks ago by a previous deploy under different caps, and it is about
 * to be written into a JSON file that ships to production. Having passed validation once
 * is not proof it is still well-formed.
 *
 * Takes `unknown` on purpose: getPending hands back a TestimonialRecord type, but the
 * underlying value came from a JSON file over the network, so the type is an assertion
 * rather than a proof.
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

  // The id becomes the git ref `testimonial/<id>`. base64url cannot produce `..` or a
  // trailing `.lock`, but this is where that guarantee is actually enforced.
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

  // A stored record can never carry a consent version we have not written yet.
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
  // Size gate, before any parsing.
  const declaredLength = req.headers.get('content-length')
  if (declaredLength !== null) {
    const declared = Number(declaredLength)
    if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) {
      return json({ error: 'Request body too large.' }, 413)
    }
  }

  // Origin. A hardcoded module constant, never an env var, so a misconfigured environment
  // cannot widen it and every preview deployment fails closed.
  if (req.headers.get('origin') !== SITE_ORIGIN) {
    return json({ error: 'Requests must come from aserban.ro.' }, 403)
  }

  // The session, before the body is read: an unsigned-in caller gets no work done on its
  // behalf at all. A tampered signature, a rotated MOD_SECRET and an expired stamp are all
  // one answer here — the page turns any 401 into "sign in again", and there is nothing
  // useful to tell apart.
  if (!verifySession(sessionCookie(req), Math.floor(Date.now() / 1000))) {
    return json({ error: 'Sign in again.' }, 401)
  }

  try {
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
    if (body === null || typeof body.id !== 'string') {
      return json({ error: 'Malformed request body.' }, 400)
    }

    // Shape-check the id BEFORE it reaches the store, which interpolates it into a path.
    // An id that is not 12 base64url characters can never name a stored record, so it is
    // the same answer as a record that is not there.
    const id = body.id
    if (!ID_RE.test(id)) {
      return json({ error: 'That submission is no longer in the pending queue.' }, 404)
    }

    let stored: TestimonialRecord | null
    try {
      stored = await getPending(id)
    } catch (err) {
      // A store that cannot be reached is not an empty store. Answering 404 here would
      // tell the owner the submission is gone when it is sitting safely in the repository.
      console.error(
        '[admin/publish] pending store read failed:',
        err instanceof Error ? err.message : typeof err,
      )
      return json(
        { error: 'Could not reach the pending store. Nothing was published — try again.' },
        502,
      )
    }
    if (stored === null) {
      return json({ error: 'That submission is no longer in the pending queue.' }, 404)
    }

    const checked = revalidate(stored)
    if (!checked.ok) {
      return json({ field: checked.field, message: checked.message }, 422)
    }
    const record = checked.record

    // publishedAt is stamped at the moment the pull request is OPENED, not at submit and
    // not at merge. It is a sort key and a display date only.
    record.publishedAt = new Date().toISOString().slice(0, 10)

    // ORDER MATTERS: publish to git FIRST, delete from the pending store SECOND.
    // If the delete fails after a successful publish, the worst case is a pending entry
    // that looks like a duplicate, which the owner can reject by hand — and publishing it
    // twice is absorbed by publishTestimonial's idempotency on record.id anyway.
    // Reversed, a GitHub failure would lose the submission permanently: the pending store
    // is the only place it exists, and there is no email and no other copy to recover from.
    let result: PublishResult
    try {
      result = await publishTestimonial(record)
    } catch (err) {
      // The message from ghError includes status, statusText and the first 500 characters
      // of the response body. None of these ever echo the Authorization header, and
      // Node/undici never surface request headers in error.message. It is the only thing
      // that can distinguish a revoked token (401) from a renamed repo (404) from a
      // network timeout.
      console.error(
        '[admin/publish] github failed:',
        err instanceof Error ? err.message : typeof err,
      )
      return json(
        {
          error:
            'GitHub refused the write. Nothing was published and the submission is still in the queue — try again.',
        },
        502,
      )
    }

    try {
      await deletePending(id)
    } catch (err) {
      // Logged, not fatal, and not a different status: the publish succeeded, and telling
      // the owner it failed would invite a retry that cannot improve anything. The entry
      // reappears on the next refresh of /admin and can be rejected by hand.
      console.error(
        '[admin/publish] pending delete failed after a successful publish:',
        err instanceof Error ? err.message : typeof err,
      )
    }

    // Returned verbatim: the page switches on `status` to pick between the three outcomes
    // (already_published, pr_open, pr_opened), so none of them is an error and none of
    // them is a duplicate.
    return json(result, 200)
  } catch (err) {
    // Name only, never the message: GITHUB_TOKEN must never be logged, and an Error from
    // an HTTP client is exactly where a credential can end up in text.
    console.error('[admin/publish] unhandled:', err instanceof Error ? err.name : typeof err)
    return json({ error: 'Something went wrong on our side.' }, 500)
  }
}
```

- [ ] **Step 6: Write the reject route**

Create `src/app/api/admin/reject/route.ts`:

```ts
// POST /api/admin/reject — admin-moderation design §8.
//
// No `export const runtime` here either: 'nodejs' is the Next 16 default, and 'edge' is
// deprecated and hard-fails the build on node:crypto, which @/lib/token and
// @/lib/admin-auth both use.
//
// Rejection is one delete. There is no publish path in this file, no confirmation write,
// no second store call: the design's whole promise for a rejected submission is that
// nothing of it remains, and every extra step here is another way for that to be
// half-done.

import { deletePending } from '@/lib/pending-store'
import { SESSION_COOKIE, verifySession } from '@/lib/admin-auth'
import { SITE_ORIGIN } from '@/lib/token'

/** The body is `{"id":"<12 characters>"}` — 21 bytes. 1 KiB is many times the largest honest body. */
const MAX_BODY_BYTES = 1024

const ID_RE = /^[A-Za-z0-9_-]{12}$/

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
 * Deliberately duplicated from the other route handlers rather than shared: the interface
 * contract fixes the exported surface of every lib module and this helper is not in it.
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

/**
 * The session cookie's value, or undefined. Read straight off the Cookie header rather
 * than through `cookies()` from next/headers: these handlers take a plain `Request` and
 * read `req.headers` for everything else, and the async dynamic API would make the
 * handler unusable outside a Next request scope. The value is `<digits>.<base64url>`,
 * which needs no percent-decoding — decoding it would only invent failure modes.
 */
function sessionCookie(req: Request): string | undefined {
  const header = req.headers.get('cookie')
  if (header === null) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== SESSION_COOKIE) continue
    return part.slice(eq + 1).trim()
  }
  return undefined
}

export async function POST(req: Request): Promise<Response> {
  // Size gate, before any parsing.
  const declaredLength = req.headers.get('content-length')
  if (declaredLength !== null) {
    const declared = Number(declaredLength)
    if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) {
      return json({ error: 'Request body too large.' }, 413)
    }
  }

  // Origin. A hardcoded module constant, never an env var, so a misconfigured environment
  // cannot widen it and every preview deployment fails closed.
  if (req.headers.get('origin') !== SITE_ORIGIN) {
    return json({ error: 'Requests must come from aserban.ro.' }, 403)
  }

  // The session, before the body is read. A tampered signature, a rotated MOD_SECRET and
  // an expired stamp are all one answer here.
  if (!verifySession(sessionCookie(req), Math.floor(Date.now() / 1000))) {
    return json({ error: 'Sign in again.' }, 401)
  }

  try {
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
    if (body === null || typeof body.id !== 'string') {
      return json({ error: 'Malformed request body.' }, 400)
    }

    // Shape-check the id BEFORE it reaches the store, which interpolates it into a path.
    // An id that is not 12 base64url characters can never name a stored record, and this
    // is the only 404 this route has: a WELL-FORMED id that is already gone is not an
    // error, it is the outcome the owner asked for, and a double tap on a phone must not
    // turn into a red message. Whether an absent file is a silent success is
    // deletePending's business, and this route makes exactly one call into it.
    const id = body.id
    if (!ID_RE.test(id)) {
      return json({ error: 'That submission is no longer in the pending queue.' }, 404)
    }

    await deletePending(id)

    // 204 must carry NO body: `new Response(JSON.stringify(...), { status: 204 })` throws
    // `TypeError: Response constructor: Invalid response status code 204` (verified on
    // Node 24), so this answer cannot go through json().
    return new Response(null, { status: 204 })
  } catch (err) {
    // Name only, never the message: GITHUB_TOKEN must never be logged, and an Error from
    // an HTTP client is exactly where a credential can end up in text.
    console.error('[admin/reject] unhandled:', err instanceof Error ? err.name : typeof err)
    return json({ error: 'Something went wrong on our side.' }, 500)
  }
}
```

- [ ] **Step 7: Build, lint and run the token harness**

Run: `npm run build && npm run lint && npm run check:tokens`

Expected: `✓ Compiled successfully`; the route table lists `/api/admin/login`, `/api/admin/publish` and `/api/admin/reject`; `postbuild: OK — …`; ESLint silent; and `check:tokens` ending in `N passed, 0 failed` with the same `N` the previous task left it at (this task adds no assertions to it — nothing here is reachable from that harness).

- [ ] **Step 8: Write manual check A — the eleven status codes**

Nothing automated reaches a route handler in this repo, so the routes get driven by hand: real handler functions, hand-built `Request` objects, and a `fetch` that is replaced wholesale so **no request leaves the machine and the real `GITHUB_TOKEN` is never read**. This file lives in `/tmp`, is run once, and is deleted in Step 10 — it is not a test, it is not committed, and it is not wired into an npm script.

Create `/tmp/admin-routes-check.mjs`:

```js
// Manual check A for /api/admin/{login,publish,reject}. NOT a test: it is written to
// /tmp, run once by hand, and deleted. Nothing here is committed and nothing is wired
// into an npm script — `npm run check:tokens` remains the only test harness in this repo.
//
// It drives the three route handlers with hand-built Request objects. Every outbound
// fetch is intercepted below, so NO request reaches GitHub and the real GITHUB_TOKEN is
// never read: the values set here are fakes, long enough to satisfy assertSecret.
//
// Run from the repository root:
//   node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON /tmp/admin-routes-check.mjs

import { registerHooks } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import path from 'node:path'

const ROOT = process.cwd()
if (!existsSync(path.join(ROOT, 'src', 'app', 'api', 'admin'))) {
  console.error(`run this from the repository root; ${ROOT} has no src/app/api/admin`)
  process.exit(1)
}

// Next resolves '@/x' to 'src/x' and adds the extension; plain Node does neither, so both
// jobs are done here. The JSON branch also sidesteps Node's import-attribute requirement,
// which src/lib/testimonials.ts (imported by the pending store) would otherwise trip.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const base = path.join(ROOT, 'src', specifier.slice(2))
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.json`]) {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true }
        }
      }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.json')) {
      return {
        format: 'module',
        source: `export default ${readFileSync(fileURLToPath(url), 'utf8')}`,
        shortCircuit: true,
      }
    }
    return nextLoad(url, context)
  },
})

const ADMIN_PASSWORD = 'manual-check-admin-password-0123456789'
process.env.INVITE_SECRET = 'manual-check-invite-secret-0123456789'
process.env.MOD_SECRET = 'manual-check-session-secret-0123456789'
process.env.ADMIN_PASSWORD = ADMIN_PASSWORD
process.env.GITHUB_TOKEN = 'manual-check-fake-github-token-0123456789'

const PENDING_ID = 'aB3xK9pQr7Zt'
const MISSING_ID = 'zZ9yX8wV7uT6'

const record = {
  id: PENDING_ID,
  projectSlug: 'tokero',
  publishedAt: '2026-09-13',
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

const store = new Map([[PENDING_ID, record]])
const outbound = []

function ghJson(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function headerOf(init, name) {
  const headers = init?.headers
  if (!headers) return undefined
  if (typeof headers.get === 'function') return headers.get(name)
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name) return value
  }
  return undefined
}

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url
  const method = String(init.method ?? 'GET').toUpperCase()
  outbound.push(`${method} ${url}`)

  if (!url.startsWith('https://api.github.com/repos/seradi96/')) {
    throw new Error(`harness: unexpected outbound request ${method} ${url}`)
  }

  // The PRIVATE pending store.
  if (url.includes('/qa-portfolio-pending/')) {
    const id = [...store.keys()].find((key) => url.includes(key))
    if (method === 'GET') {
      if (id === undefined) return ghJson({ message: 'Not Found' }, 404)
      const text = JSON.stringify(store.get(id), null, 2)
      if (String(headerOf(init, 'accept') ?? '').includes('raw')) {
        return new Response(text, { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return ghJson(
        {
          name: `${id}.json`,
          path: `pending/${id}.json`,
          sha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
          type: 'file',
          encoding: 'base64',
          content: Buffer.from(text, 'utf8').toString('base64'),
        },
        200,
      )
    }
    if (method === 'DELETE') {
      if (id === undefined) return ghJson({ message: 'Not Found' }, 404)
      store.delete(id)
      return ghJson({ commit: { sha: 'cafebabe' } }, 200)
    }
    return ghJson({ message: `harness: unhandled ${method} on the pending store` }, 500)
  }

  // The PUBLIC site repo — publishTestimonial. Always fails, on purpose: this harness
  // must never be able to look like a real publish.
  return ghJson({ message: 'harness: simulated GitHub outage' }, 500)
}

const { SESSION_COOKIE, SESSION_TTL_SECONDS, mintSession } = await import(
  `${pathToFileURL(path.join(ROOT, 'src', 'lib', 'admin-auth.ts')).href}`
)
const { POST: login } = await import(
  `${pathToFileURL(path.join(ROOT, 'src', 'app', 'api', 'admin', 'login', 'route.ts')).href}`
)
const { POST: publish } = await import(
  `${pathToFileURL(path.join(ROOT, 'src', 'app', 'api', 'admin', 'publish', 'route.ts')).href}`
)
const { POST: reject } = await import(
  `${pathToFileURL(path.join(ROOT, 'src', 'app', 'api', 'admin', 'reject', 'route.ts')).href}`
)

function call(handler, { origin = 'https://aserban.ro', cookie, body } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (origin !== null) headers.origin = origin
  if (cookie !== undefined) headers.cookie = cookie
  return handler(
    new Request('https://aserban.ro/api/admin/x', {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
    }),
  )
}

const rows = []
async function step(name, expected, run) {
  const res = await run()
  rows.push({ name, expected, actual: res.status })
  return res
}

// 1 — login with the correct password. The cookie for every later case comes from this
// response, so the format is exercised end to end rather than hand-assembled.
const loggedIn = await step('login, correct password', 204, () =>
  call(login, { body: { password: ADMIN_PASSWORD } }),
)
const setCookie = loggedIn.headers.get('set-cookie') ?? ''
const goodCookie = setCookie.split(';')[0]

await step('login, wrong password', 401, () =>
  call(login, { body: { password: 'manual-check-admin-password-0123456788' } }),
)
await step('login, wrong Origin', 403, () =>
  call(login, { origin: 'https://evil.example', body: { password: ADMIN_PASSWORD } }),
)

await step('publish, no cookie', 401, () => call(publish, { body: { id: PENDING_ID } }))

const lastChar = goodCookie.slice(-1)
const tamperedCookie = `${goodCookie.slice(0, -1)}${lastChar === 'A' ? 'B' : 'A'}`
await step('publish, tampered cookie', 401, () =>
  call(publish, { cookie: tamperedCookie, body: { id: PENDING_ID } }),
)

const expiredCookie = `${SESSION_COOKIE}=${mintSession(
  Math.floor(Date.now() / 1000) - SESSION_TTL_SECONDS - 60,
)}`
await step('publish, expired cookie', 401, () =>
  call(publish, { cookie: expiredCookie, body: { id: PENDING_ID } }),
)

await step('publish, unknown id', 404, () =>
  call(publish, { cookie: goodCookie, body: { id: MISSING_ID } }),
)
await step('publish, GitHub fails', 502, () =>
  call(publish, { cookie: goodCookie, body: { id: PENDING_ID } }),
)

await step('reject, no cookie', 401, () => call(reject, { body: { id: PENDING_ID } }))
await step('reject, unknown id', 404, () =>
  call(reject, { cookie: goodCookie, body: { id: 'nope' } }),
)
await step('reject, valid id', 204, () =>
  call(reject, { cookie: goodCookie, body: { id: PENDING_ID } }),
)

let differences = 0
for (const row of rows) {
  if (row.expected !== row.actual) differences++
  console.log(
    `${row.expected === row.actual ? 'OK' : 'DIFF'} ${row.name}: expected ${row.expected}, got ${row.actual}`,
  )
}
console.log(`${rows.length - differences} of ${rows.length} as expected`)

console.log(`\nSet-Cookie: ${setCookie}`)
console.log(`pending store after the run: ${store.size} record(s)`)
console.log('intercepted requests (none left this machine):')
for (const line of outbound) console.log(`  ${line}`)

process.exit(differences === 0 ? 0 : 1)
```

- [ ] **Step 9: Run manual check A**

Run: `node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON /tmp/admin-routes-check.mjs`

Expected — one stderr line first, from the publish route's own logging on the 502 path (`[admin/publish] github failed: GitHub read src/content/testimonials.json@main failed: 500 {"message":"harness: simulated GitHub outage"}`), then exactly:

```
OK login, correct password: expected 204, got 204
OK login, wrong password: expected 401, got 401
OK login, wrong Origin: expected 403, got 403
OK publish, no cookie: expected 401, got 401
OK publish, tampered cookie: expected 401, got 401
OK publish, expired cookie: expected 401, got 401
OK publish, unknown id: expected 404, got 404
OK publish, GitHub fails: expected 502, got 502
OK reject, no cookie: expected 401, got 401
OK reject, unknown id: expected 404, got 404
OK reject, valid id: expected 204, got 204
11 of 11 as expected
```

then `Set-Cookie: admin_session=<10-digit expiry>.<43-character signature>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`, `pending store after the run: 0 record(s)`, and a list of intercepted requests in which **every line starts with `https://api.github.com/repos/seradi96/`** (the exact number of lines depends on how `getPending`/`deletePending` are implemented; what matters is that nothing else appears and the process exits 0).

Read three things off that output before moving on: the cookie carries all five attributes; the store ends empty, which is the successful reject actually deleting the record; and the `publish, GitHub fails` case left `aB3xK9pQr7Zt` in the store at the time it answered 502 — the publish-first-delete-second ordering means a GitHub failure never costs a submission.

- [ ] **Step 10: Delete the harness and confirm nothing stray is left**

```bash
rm -f /tmp/admin-routes-check.mjs
git status --porcelain
```

Expected: exactly `?? src/app/api/admin/` and nothing else. `.env.local` is gitignored and must not appear; if it does, the `.gitignore` entry is broken and that has to be fixed before the commit below.

- [ ] **Step 11: Commit**

```bash
git add src/app/api/admin/login/route.ts src/app/api/admin/publish/route.ts src/app/api/admin/reject/route.ts
git commit -m "$(cat <<'EOF'
feat(admin): login, publish and reject API routes

Three POST handlers behind the signed session cookie, following the two
existing testimonials routes exactly: same json() helper, same hardcoded
SITE_ORIGIN check immediately after the body-size gate, same
name-only logging in the outer catch, and no `runtime` export.

login answers 204 with the Set-Cookie or one flat 401 that says nothing
about the guess. There is no rate limiting, and a module-scoped Map
counter is refused rather than omitted: on Vercel it resets on every
cold start and is not shared across concurrent lambdas, so it would read
as protection while providing none. The defence is a generated 24+
character ADMIN_PASSWORD, asserted at module load.

publish re-validates every field through the same sanitisers before
writing, because the record has been sitting in a store since it was
sanitised and passing validation once is not proof it is still
well-formed. It publishes to git FIRST and deletes from pending SECOND:
a failed delete leaves a duplicate-looking entry the owner can reject by
hand, while the reverse order would lose the submission permanently on a
GitHub failure, since the store is the only place it exists.

reject is one delete and nothing else.

Verified by hand against all three handlers with built Request objects
and an intercepted fetch -- no GitHub call and no real token: correct
password 204, wrong password 401, wrong Origin 403, publish with no /
tampered / expired cookie 401, unknown id 404, simulated GitHub failure
502, reject with no cookie 401, unknown id 404, and a successful reject
204 that empties the store.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The `/admin` page — login gate, pending list, publish and reject

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/LoginForm.tsx`
- Create: `src/app/admin/AdminList.tsx`
- Create: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `SESSION_COOKIE` and `verifySession(cookieValue: string | undefined, nowSeconds: number): boolean` from `@/lib/admin-auth`; `listPending(): Promise<TestimonialRecord[]>` from `@/lib/pending-store`; `PublishResult` (type only) from `@/lib/publish-to-git`; `TestimonialRecord` from `@/lib/token-types`; the default export of `@/components/TestimonialCard`; `PROJECT_LABELS` and `isProjectSlug` from `@/lib/projects-meta`; and the three routes `POST /api/admin/login`, `POST /api/admin/publish`, `POST /api/admin/reject`.
- Produces: `src/app/admin/layout.tsx` → `export const metadata: Metadata`, default `AdminLayout({ children })`. `src/app/admin/page.tsx` → default `async AdminPage()`. `src/app/admin/LoginForm.tsx` → default `LoginForm()`. `src/app/admin/AdminList.tsx` → default `AdminList({ items }: { items: TestimonialRecord[] })`. Nothing later in the plan imports from these files; they are leaves.

---

- [ ] **Step 1: Confirm the four environment variables exist locally**

`src/lib/token.ts` calls `assertSecret` at module scope (lines 59-60), and Task 3 added the same module-scope assertion for `ADMIN_PASSWORD` in `src/lib/admin-auth.ts`. `/admin`'s page module imports `admin-auth`, so `next build` evaluates it during "Collecting page data" and hard-fails if any of them is missing. Check the names only — never print the values.

Run: `cut -d= -f1 /Users/andreiserban/Projects/qa-portfolio/.env.local | grep -v '^#' | grep -v '^$'`

Expected: exactly these four names, in any order:

```
INVITE_SECRET
MOD_SECRET
GITHUB_TOKEN
ADMIN_PASSWORD
```

If `ADMIN_PASSWORD` is missing, Task 3 left it out. Add a throwaway local value (this is a local development value, never the production one):

```bash
cd /Users/andreiserban/Projects/qa-portfolio
printf 'ADMIN_PASSWORD=%s\n' "$(node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))")" >> .env.local
```

`.env.local` is gitignored, so nothing here is ever committed.

---

- [ ] **Step 2: Create the noindex layout**

Four lines, identical in shape to `src/app/invite/layout.tsx` and `src/app/moderate/layout.tsx`. `/admin` is a private page reached by typing the URL; it must never enter a search index.

Create `src/app/admin/layout.tsx`:

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
```

---

- [ ] **Step 3: Create the login form**

`'use client'`. One password field, posts to `/api/admin/login`, and on `204` reloads so the server component re-renders with the session cookie in hand.

The 401 message is deliberately flat and says nothing about the password — not its length, not how close the attempt was, not whether `ADMIN_PASSWORD` is even configured. Other statuses are operational faults rather than authentication answers, so naming them helps the reader and leaks nothing: a `403` on localhost is the hardcoded `SITE_ORIGIN` check firing, which is expected and is *not* a wrong password.

Create `src/app/admin/LoginForm.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'

const BTN_PRIMARY =
  'rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-3 text-base font-semibold text-gray-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black'

/**
 * 401 is the wrong-password case and gets ONE flat string. It must not vary with the
 * attempt: a message that changes shape tells an attacker which half of the check failed.
 *
 * Everything else is operational. 403 is the hardcoded SITE_ORIGIN guard in the route,
 * which is why signing in on localhost cannot work — see src/lib/token.ts SITE_ORIGIN.
 */
function errorFor(status: number): string {
  if (status === 401) return 'That did not work.'
  if (status === 403) {
    return 'The browser origin was rejected. This page only signs in on https://aserban.ro.'
  }
  if (status === 400) return 'The browser sent something the server could not read. Try again.'
  return `The sign-in did not go through (${status}). Try again.`
}

export default function LoginForm() {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.status === 204) {
        // The Set-Cookie has landed. Reload rather than fetching the queue from here:
        // the server component re-runs, verifies the cookie itself, and does the
        // listPending() call server-side, so pending records never travel to a browser
        // that has not authenticated.
        window.location.reload()
        return
      }
      setError(errorFor(res.status))
      setBusy(false)
    } catch {
      setError('That never reached the server. Try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="card-surface min-w-0 p-6">
      <h1 className="text-2xl font-bold text-white">Sign in</h1>
      <p className="mt-3 text-sm text-gray-400">
        This page lists testimonials waiting for review. It isn&apos;t linked from anywhere on the
        site.
      </p>

      <label htmlFor="admin-password" className="mt-6 block text-sm font-medium text-gray-300">
        Password
      </label>
      <input
        id="admin-password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        disabled={busy}
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder-gray-500 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />

      {error !== null && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className={`${BTN_PRIMARY} mt-6 w-full`}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
```

---

- [ ] **Step 4: Create the pending list — the heart of this task**

`'use client'`. Every record is rendered with the **real** `TestimonialCard`, so what the owner approves is byte-for-byte what ships. There is no second preview card anywhere in this file.

Three things in here are load-bearing and were review findings on the screen this page replaces, so do not paraphrase them away:

1. The three `PublishResult` outcomes get **distinct** copy, and `pr_open` says outright that the pull request **still needs merging**. `pr_open` and `already_published` sit next to each other in a tired reader's vocabulary as "already", and one of them means there is nothing left to do while the other emphatically does not.
2. **No relative time in any string.** Nothing anywhere records when a pull request merged, so "3 minutes ago" would be a guess presented as a fact.
3. Reject is a two-step confirm. It is irreversible and the pending file is the only copy, so one click must not delete a real person's words.

No `useEffect`, no `useRef` — `eslint-plugin-react-hooks` 7.1.1 flags both patterns here. Every derived value (`state`, `busy`, `confirming`, `settled`) is computed during render from one `useState` record.

Create `src/app/admin/AdminList.tsx`:

```tsx
'use client'

import { useState } from 'react'
import TestimonialCard from '@/components/TestimonialCard'
import { PROJECT_LABELS, isProjectSlug } from '@/lib/projects-meta'
import type { PublishResult } from '@/lib/publish-to-git'
import type { TestimonialRecord } from '@/lib/token-types'

// PublishResult is an `import type`, so @/lib/publish-to-git — server-only, it calls GitHub
// with GITHUB_TOKEN — is erased at compile time and never reaches this client bundle.
//
// TestimonialCard is imported as a VALUE on purpose. It carries no 'use client' of its own and
// no server imports, so it compiles into this client bundle cleanly. Rendering the real card is
// the entire point of this screen: a second, admin-only preview card would be free to drift, and
// then what the owner approves stops being what ships.

const SITE_TESTIMONIALS_URL = 'https://aserban.ro/#testimonials'

const BTN_PRIMARY =
  'rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-3 text-base font-semibold text-gray-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black'

const BTN_SECONDARY =
  'rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-base font-medium text-gray-300 hover:border-amber-400/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500'

const BTN_CONFIRM =
  'rounded-xl border border-amber-400/50 bg-amber-500/10 px-6 py-3 text-base font-semibold text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500'

const LINK_CTA =
  'mt-4 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-3 text-sm font-semibold text-gray-900 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black'

type RowState = {
  phase: 'idle' | 'confirming' | 'publishing' | 'rejecting' | 'published' | 'rejected'
  result: PublishResult | null
  error: string | null
}

const IDLE: RowState = { phase: 'idle', result: null, error: null }

/** The wire body is `unknown`; narrow it rather than trusting the route's type. */
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

/**
 * Every branch states what happened to the PENDING FILE, because that is the thing the reader
 * cannot see. 422 and 502 both leave it untouched — publishTestimonial() runs before
 * deletePending(), so a failed publish deletes nothing.
 */
function publishErrorMessage(status: number): string {
  if (status === 401) {
    return 'The session has expired. Reload the page and sign in again — nothing was published.'
  }
  if (status === 403) {
    return 'The browser origin was rejected, so nothing was published. This page only acts on https://aserban.ro.'
  }
  if (status === 404) {
    return 'That submission is no longer in the pending store. Reload the page — it may already have been published or rejected.'
  }
  if (status === 422) {
    return 'The server re-checked the submission and rejected a field, so nothing was published. The pending file is untouched.'
  }
  if (status === 502) {
    return 'GitHub refused the write. Nothing was published and the pending file is untouched — try again.'
  }
  return `Publishing failed (${status}). Nothing was published — try again.`
}

function rejectErrorMessage(status: number): string {
  if (status === 401) {
    return 'The session has expired. Reload the page and sign in again — nothing was deleted.'
  }
  if (status === 403) {
    return 'The browser origin was rejected, so nothing was deleted. This page only acts on https://aserban.ro.'
  }
  if (status === 404) {
    return 'That submission is no longer in the pending store. Reload the page — it may already have been dealt with.'
  }
  return `Deleting failed (${status}). Nothing was deleted — try again.`
}

/**
 * The three outcomes, with three genuinely different meanings.
 *
 * `already_published` and `pr_open` both read as "already" to a tired eye, and confusing them is
 * expensive in exactly one direction: `already_published` means there is nothing left to do,
 * while `pr_open` means the work is sitting unmerged and the site does NOT have it. So `pr_open`
 * says "still needs merging" in bold rather than leaving it to be inferred.
 *
 * No relative time in any of these strings. Nothing records when a pull request merged, so
 * anything of the "a moment ago" shape would be invented.
 */
function PublishOutcome({ result }: { result: PublishResult }) {
  if (result.status === 'already_published') {
    return (
      <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-semibold text-white">Already on the site</h3>
        <p className="mt-2 text-sm text-gray-300">
          This testimonial was published before and is live now. There is nothing left to do.
        </p>
        <a
          href={SITE_TESTIMONIALS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CTA}
        >
          See it on the site &rarr;
        </a>
      </div>
    )
  }

  if (result.status === 'pr_open') {
    return (
      <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-semibold text-white">A pull request was already open</h3>
        <p className="mt-2 text-sm text-gray-300">
          Nothing new was created, and{' '}
          <strong className="font-semibold text-amber-200">
            that pull request still needs merging
          </strong>{' '}
          &mdash; this testimonial is not on the site yet. Open it, merge it, and the site updates
          about 90 seconds later.
        </p>
        <a href={result.prUrl} target="_blank" rel="noopener noreferrer" className={LINK_CTA}>
          Open the pull request &rarr;
        </a>
      </div>
    )
  }

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white">Pull request opened</h3>
      <p className="mt-2 text-sm text-gray-300">
        A new pull request now holds this testimonial. Merge it and the site updates about 90
        seconds later. Until then nothing on the live site has changed.
      </p>
      <a href={result.prUrl} target="_blank" rel="noopener noreferrer" className={LINK_CTA}>
        Open the pull request &rarr;
      </a>
    </div>
  )
}

export default function AdminList({ items }: { items: TestimonialRecord[] }) {
  // One record keyed by testimonial id. Typed with `| undefined` so the `?? IDLE` below is a
  // real narrowing rather than decoration, and so per-row state needs no mount effect —
  // react-hooks/set-state-in-effect bites the obvious alternative.
  const [rows, setRows] = useState<Record<string, RowState | undefined>>({})

  function patch(id: string, next: RowState) {
    setRows((prev) => ({ ...prev, [id]: next }))
  }

  async function publish(id: string) {
    patch(id, { phase: 'publishing', result: null, error: null })
    try {
      const res = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        patch(id, { phase: 'idle', result: null, error: publishErrorMessage(res.status) })
        return
      }
      const result = asPublishResult(await res.json().catch(() => null))
      if (result === null) {
        patch(id, {
          phase: 'idle',
          result: null,
          error:
            'The server replied with something unreadable. Check GitHub before pressing Publish again — the write may already have gone through.',
        })
        return
      }
      patch(id, { phase: 'published', result, error: null })
    } catch {
      patch(id, {
        phase: 'idle',
        result: null,
        error: 'That never reached the server. Nothing was published — press Publish again.',
      })
    }
  }

  async function reject(id: string) {
    patch(id, { phase: 'rejecting', result: null, error: null })
    try {
      // 204, so there is no body to read.
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        patch(id, { phase: 'idle', result: null, error: rejectErrorMessage(res.status) })
        return
      }
      patch(id, { phase: 'rejected', result: null, error: null })
    } catch {
      patch(id, {
        phase: 'idle',
        result: null,
        error: 'That never reached the server. Nothing was deleted — press Reject again.',
      })
    }
  }

  // An empty queue is the normal state, not a fault. Calm copy, no alert styling, no retry
  // prompt: `GET contents/pending` returning 404 for an empty directory is expected and the
  // store already maps it to an empty list.
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-white">Nothing waiting</h1>
        <p className="mt-6 text-gray-300">
          The pending queue is empty. This is the normal state &mdash; a submission appears here
          as soon as someone finishes the invite form.
        </p>
      </div>
    )
  }

  const settled = items.some((record) => {
    const phase = (rows[record.id] ?? IDLE).phase
    return phase === 'published' || phase === 'rejected'
  })

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold text-white">Waiting for review</h1>
      <p className="mt-4 text-gray-400">
        {items.length === 1
          ? 'One submission is waiting.'
          : `${items.length} submissions are waiting.`}{' '}
        Each card below is the component the live site renders, so what you publish is what ships.
      </p>

      <ul className="mt-10 space-y-12">
        {items.map((record) => {
          const state = rows[record.id] ?? IDLE
          const busy = state.phase === 'publishing' || state.phase === 'rejecting'
          const confirming = state.phase === 'confirming' || state.phase === 'rejecting'
          const done = state.phase === 'published' || state.phase === 'rejected'
          const projectLabel = isProjectSlug(record.projectSlug)
            ? PROJECT_LABELS[record.projectSlug]
            : record.projectSlug

          return (
            <li key={record.id} className="min-w-0">
              <TestimonialCard testimonial={record} />

              <div className="card-surface mt-4 min-w-0 p-5">
                <dl className="space-y-2 text-sm">
                  {/* The slug as plain text, so the person can be checked without leaving the
                      page. The card itself carries the clickable link. */}
                  <div className="flex flex-wrap gap-2">
                    <dt className="text-gray-500">LinkedIn</dt>
                    <dd className="break-all text-gray-300">
                      linkedin.com/in/{record.author.linkedinSlug}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <dt className="text-gray-500">Project</dt>
                    <dd className="text-gray-300">{projectLabel}</dd>
                  </div>
                  {/* An absolute stored date, never a relative one. */}
                  <div className="flex flex-wrap gap-2">
                    <dt className="text-gray-500">Submitted</dt>
                    <dd className="text-gray-300">{record.submittedAt}</dd>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <dt className="text-gray-500">Consent</dt>
                    <dd className="text-gray-300">
                      v{record.consent.version} at {record.consent.at}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <dt className="text-gray-500">Id</dt>
                    <dd className="break-all text-gray-300">{record.id}</dd>
                  </div>
                </dl>

                {state.phase === 'published' && state.result !== null && (
                  <>
                    <PublishOutcome result={state.result} />
                    <p className="mt-3 text-sm text-gray-400">
                      Taken out of the pending store. This card disappears on the next reload.
                    </p>
                  </>
                )}

                {state.phase === 'rejected' && (
                  <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                    <h3 className="text-sm font-semibold text-white">Deleted</h3>
                    <p className="mt-2 text-sm text-gray-300">
                      Removed from the pending store. Nothing was published, and that file was the
                      only copy.
                    </p>
                  </div>
                )}

                {!done && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => publish(record.id)}
                      disabled={busy || confirming}
                      className={BTN_PRIMARY}
                    >
                      {state.phase === 'publishing' ? 'Publishing…' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        patch(record.id, { phase: 'confirming', result: null, error: null })
                      }
                      disabled={busy || confirming}
                      className={BTN_SECONDARY}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {/* Reject never fires on the first click. The pending file is the only copy of
                    what this person wrote, and deleting it cannot be undone. */}
                {confirming && (
                  <div className="mt-5 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4">
                    <p className="text-sm text-amber-100">
                      Delete this submission? The pending file is the only copy of it, and this
                      cannot be undone.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => reject(record.id)}
                        disabled={busy}
                        className={BTN_CONFIRM}
                      >
                        {state.phase === 'rejecting' ? 'Deleting…' : 'Yes, delete it'}
                      </button>
                      <button
                        type="button"
                        onClick={() => patch(record.id, IDLE)}
                        disabled={busy}
                        className={BTN_SECONDARY}
                      >
                        Keep it
                      </button>
                    </div>
                  </div>
                )}

                {state.error !== null && (
                  <p
                    role="alert"
                    className="mt-5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                  >
                    {state.error}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {settled && (
        <div className="mt-12">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={BTN_SECONDARY}
          >
            Refresh the queue
          </button>
        </div>
      )}
    </div>
  )
}
```

---

- [ ] **Step 5: Create the server component page**

The cookie is read and verified on the server, and `listPending()` is called on the server. That ordering is the point: an unauthenticated browser receives the login form and nothing else — no pending records are serialised into the RSC payload for a session that does not exist.

`cookies()` makes this route dynamic, which is correct and expected. `/` stays static because nothing here is in its import graph.

Create `src/app/admin/page.tsx`:

```tsx
import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySession } from '@/lib/admin-auth'
import { listPending } from '@/lib/pending-store'
import type { TestimonialRecord } from '@/lib/token-types'
import AdminList from './AdminList'
import LoginForm from './LoginForm'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <main className="mx-auto max-w-6xl px-6 py-20">{children}</main>
    </div>
  )
}

export default async function AdminPage() {
  const jar = await cookies()
  const nowSeconds = Math.floor(Date.now() / 1000)

  // No valid session: render the login form and stop. listPending() is never reached, so a
  // browser that has not authenticated receives no pending record at all — not in the HTML,
  // not in the RSC payload.
  if (!verifySession(jar.get(SESSION_COOKIE)?.value, nowSeconds)) {
    return (
      <Shell>
        <div className="mx-auto max-w-md">
          <LoginForm />
        </div>
      </Shell>
    )
  }

  let items: TestimonialRecord[]
  try {
    items = await listPending()
  } catch (err) {
    // Name only, never the message: GITHUB_TOKEN must never be logged, and an Error from an
    // HTTP client is exactly where a credential can end up in text.
    console.error('[admin] listPending failed:', err instanceof Error ? err.name : typeof err)
    return (
      <Shell>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-white">The queue could not be read</h1>
          <p className="mt-6 text-gray-300">
            GitHub did not answer, so the pending list is unavailable. Nothing has been lost
            &mdash; every submission is still in the private store. Reload the page and try again.
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <AdminList items={items} />
    </Shell>
  )
}
```

---

- [ ] **Step 6: Lint**

Run: `cd /Users/andreiserban/Projects/qa-portfolio && npm run lint`

Expected: no output at all and exit code 0. If `react/no-unescaped-entities` fires, an apostrophe was typed as `'` in a JSX text node instead of `&apos;` — the only one in these four files is `isn&apos;t` in `LoginForm.tsx`. If `react-hooks/set-state-in-effect` or `react-hooks/refs` fires, a `useEffect` or `useRef` was introduced; neither belongs in these files.

---

- [ ] **Step 7: Build, including the postbuild gates**

`npm run build` triggers the `postbuild` npm lifecycle, so this one command runs the TypeScript check, the route table, and `scripts/postbuild-check.mjs`.

Run: `cd /Users/andreiserban/Projects/qa-portfolio && npm run build`

Expected: a route table in which `/` is marked static (`○`) and `/admin` is marked dynamic (`ƒ`), then this line, whose first clause is the one that must match exactly:

```
postbuild: OK — static: verified — '/' is in the prerender manifest; secrets: ...; content: ...
```

The `secrets:` and `content:` clauses vary with what is set locally and what is in `src/content/testimonials.json`; the `static: verified` clause does not. If it instead reports `'/' is absent from .next/prerender-manifest.json`, something in this task leaked into the home page's import graph — check that nothing under `src/app/admin/` is imported from `src/app/page.tsx` or `src/app/layout.tsx`.

If the build dies during "Collecting page data" with a thrown `assertSecret` message, Step 1 was skipped.

---

- [ ] **Step 8: Token harness**

This task adds no assertions. The harness must be exactly as green as Task 4 left it.

Run: `cd /Users/andreiserban/Projects/qa-portfolio && npm run check:tokens`

Expected: the final line reads `N passed, 0 failed`, with the same `N` Task 4 ended on. A changed `N` means a file outside this task's four was edited.

---

- [ ] **Step 9: Create a throwaway preview route so `AdminList` can be seen**

`AdminList` cannot be reached on localhost by signing in: the login route compares `Origin` against the hardcoded `SITE_ORIGIN` (`https://aserban.ro`), so localhost always gets 403 and never gets a session cookie. Rather than weakening that check, render `AdminList` directly from a temporary route with a hand-written fixture. It touches no network and no secret.

Create `src/app/admin/preview/page.tsx` — **this file is deleted in Step 12 and is never committed**:

```tsx
import type { TestimonialRecord } from '@/lib/token-types'
import AdminList from '../AdminList'

const FIXTURE: TestimonialRecord = {
  id: 'AbCdEfGhIjKl',
  projectSlug: 'tokero',
  publishedAt: '2026-08-29',
  submittedAt: '2026-08-29',
  consent: { version: 1, at: '2026-08-29T09:00:00Z' },
  author: {
    name: 'Example Person',
    role: 'Engineering Manager',
    company: 'Example Co',
    linkedinSlug: 'example-person',
  },
  answers: {
    whatIDid: 'Owned the regression suite and the release checks.',
    whatChanged: 'Releases stopped slipping on unknown regressions.',
    hiringManager: 'He is the person I would call first for a test architecture problem.',
    anythingElse: '',
  },
}

export default function AdminPreviewPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <main className="mx-auto max-w-6xl px-6 py-20">
        <AdminList items={[FIXTURE]} />
      </main>
    </div>
  )
}
```

---

- [ ] **Step 10: Manual check — the login gate**

Run: `cd /Users/andreiserban/Projects/qa-portfolio && npm run dev`

Then open `http://localhost:3000/admin` and check all of:

1. The page renders the dark gradient background and a single `.card-surface` panel headed **Sign in**, with a labelled **Password** field. Typing shows dots, not characters.
2. The page source contains `<meta name="robots" content="noindex, nofollow"/>` — the layout is applying.
3. Tab to the field and then the button: each shows a visible amber focus ring.
4. Type anything and submit. The button reads `Signing in…` while in flight, then an amber alert box appears reading:

```
The browser origin was rejected. This page only signs in on https://aserban.ro.
```

That message is the hardcoded `SITE_ORIGIN` guard doing its job, and it confirms the form posted to `/api/admin/login` and rendered the response. If a `401` comes back instead — `That did not work.` — the login route checks the password before the Origin; either ordering is acceptable here, and what this step verifies is that the form submits, disables while in flight, and renders a message that gives nothing away.

No pending records appear anywhere in view-source, because the server component returned before `listPending()`.

**Do not remove or edit the Origin check to get further.** Signing in for real needs a deployed environment.

---

- [ ] **Step 11: Manual check — the list, the two buttons, the confirm, the error path**

With the dev server still running, open `http://localhost:3000/admin/preview` and check all of:

1. The real card renders: amber quote glyph, the quote, a **What changed** heading, a **Read the rest** disclosure that opens, the footer with `Example Person`, `Engineering Manager, Example Co — at the time`, the amber `TOKERO — crypto exchange QA platform` chip and a **Verify on LinkedIn** link.
2. Below it, a second card-surface panel lists `linkedin.com/in/example-person`, the project, `2026-08-29`, `v1 at 2026-08-29T09:00:00Z`, and the id.
3. **Publish** (amber gradient) and **Reject** (outlined) sit side by side, both with amber focus rings on Tab.
4. Press **Reject**. Nothing is deleted. A confirm panel appears reading *Delete this submission? The pending file is the only copy of it, and this cannot be undone.* with **Yes, delete it** and **Keep it**. Publish and Reject are now both disabled.
5. Press **Keep it** — the confirm panel closes and both buttons re-enable.
6. Press **Reject**, then **Yes, delete it**. The button reads `Deleting…`, then an amber alert appears: *The browser origin was rejected, so nothing was deleted. This page only acts on https://aserban.ro.* This confirms the wiring and the failure path, and nothing reached GitHub — the route rejects on Origin before doing any work.
7. Press **Publish**. Button reads `Publishing…`, then: *The browser origin was rejected, so nothing was published. This page only acts on https://aserban.ro.*
8. Narrow the window to 375px. No horizontal scrollbar on the page; the card and the panel stay inside it.

**Cannot be verified here, needs a deployed environment:** a successful login, a real pending queue from `listPending()`, the empty **Nothing waiting** state against a real empty store, and the three `PublishResult` outcomes rendering their real copy. Those are the manual checks in the design's §12 and belong to the deployment step, not to this task.

---

- [ ] **Step 12: Delete the throwaway preview route**

Stop the dev server (Ctrl-C), then:

Run: `cd /Users/andreiserban/Projects/qa-portfolio && rm -rf src/app/admin/preview && git status --short`

Expected: exactly one line, and no `preview` anywhere in it:

```
?? src/app/admin/
```

---

- [ ] **Step 13: Re-run the full gate on the final tree**

The preview route existed when Steps 6-8 ran only if they were re-run; re-run all three now so the committed tree is what was verified.

Run: `cd /Users/andreiserban/Projects/qa-portfolio && npm run lint && npm run build && npm run check:tokens`

Expected: lint silent and exit 0; the build's route table showing `/` static and `/admin` dynamic, followed by `postbuild: OK — static: verified — '/' is in the prerender manifest; ...`; and `N passed, 0 failed` from the token harness with the same `N` as Step 8.

---

- [ ] **Step 14: Commit**

```bash
cd /Users/andreiserban/Projects/qa-portfolio
git add src/app/admin/layout.tsx src/app/admin/page.tsx src/app/admin/LoginForm.tsx src/app/admin/AdminList.tsx
git commit -m "feat(admin): add the /admin review page, login form and pending list

Server component reads the session cookie with cookies() and verifies it before
calling listPending(), so pending records never reach an unauthenticated browser.
Each entry renders through the real TestimonialCard, so what is approved is what
ships. The three PublishResult outcomes get distinct copy and pr_open states that
the pull request still needs merging. Reject is a two-step confirm because the
pending file is the only copy. No relative time in any string.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Remove the moderation machinery

**Files:**
- Delete: `src/app/moderate/page.tsx`
- Delete: `src/app/moderate/layout.tsx`
- Delete: `src/app/moderate/ModeratePanel.tsx`
- Modify: `src/lib/token.ts` (whole file rewritten; the invite half is byte-identical)
- Modify: `src/lib/token-client.ts` (whole file rewritten; `decodeInviteUnverified` is byte-identical)
- Modify: `scripts/token-roundtrip.mjs:264`, `:274`, `:296`, `:313`, `:329`, `:379-525`, `:526`, `:542`, `:556`, `:597-629`

**Interfaces:**
- Consumes: `SESSION_COOKIE`, `SESSION_TTL_SECONDS`, `checkPassword`, `mintSession`, `verifySession` from `src/lib/admin-auth.ts` (already imported by the harness; this task must not break that import) — and nothing else from earlier tasks.
- Produces: `src/lib/token.ts` exporting **exactly** `SITE_ORIGIN`, `INVITE_TTL_DAYS`, `assertSecret`, `signInviteToken`, `verifyInviteToken`. `src/lib/token-client.ts` exporting **exactly** `decodeInviteUnverified`. No new exports.

**Read this before you start.** `scripts/token-roundtrip.mjs` is **append-only in every other task of this plan**. This task is the single exception: it is the only place where deleting assertions from that file is correct, because the code under test is being deleted with them. If you find yourself deleting from that file in any other task, you are doing something wrong.

**Assertion-count bookkeeping, stated so the next task can audit it.** The harness printed `37 passed, 0 failed` at the commit this plan was written against, and `44 passed, 0 failed` with Tasks 1–5 applied. (An interface-contract note says "36" — that is a grep artefact: `grep -c 'check(' scripts/token-roundtrip.mjs` counts the `function check(name, fn)` definition line and misses the two `await checkAsync(...)` call sites. The number the script prints is the number that counts.) **This task removes exactly six assertions, by name:**

1. `a token signed under i1 never verifies under m1`
2. `natural-language answers at every cap fit the moderation URL`
3. `Romanian answers at every cap, including a 60-char encoded slug, fit the moderation URL (absolute maximum)`
4. `incompressible answers at every cap overflow the budget, which is what the 413 is for`
5. `the moderation fragment gunzips on the browser path`
6. `an absent, malformed or non-gzip moderation fragment returns null`

and **edits two in place**, keeping their invite half: `invite and moderation tokens survive a full round trip` (renamed to `an invite token survives a full round trip`) and `a single flipped payload byte fails verification`. So: **whatever number the script prints before you start, it must print exactly that minus six when you finish.** If Tasks 1–5 landed as written, that is **44 → 38**.

- [ ] **Step 1: Gate — prove nothing still imports the moderation machinery**

Run: `grep -rn "signModerationToken\|verifyModerationToken\|MAX_MODERATION_URL_CHARS\|decodeModerationUnverified\|lib/notify\|/moderate" src scripts`

Expected: hits **only** in the six files this task deletes or edits — `src/lib/token.ts`, `src/lib/token-client.ts`, `scripts/token-roundtrip.mjs`, `src/app/moderate/ModeratePanel.tsx` — plus one hit in `src/app/robots.ts` (the string `'/moderate'` in the disallow list, which Task 7 replaces).

**Any hit under `src/app/api/` means Tasks 1–5 are not finished. Stop and report it; do not delete anything.** In particular, at the time this plan was written `src/app/api/testimonials/submit/route.ts` still carried `import { sendModerationEmail } from '@/lib/notify'` and `MAX_MODERATION_URL_CHARS, signModerationToken` in its `@/lib/token` import block while its body had already moved to `putPending`. That import block is Task 3's to finish, not yours.

- [ ] **Step 2: Gate — check whether `src/lib/notify.ts` is orphaned**

Run: `ls -la src/lib/notify.ts 2>/dev/null; grep -rn "lib/notify" src scripts`

Two possible outcomes, both handled here:
- The file does not exist → Task 3 already deleted it. Nothing to do.
- The file exists and the grep returns **no importer** → it is dead. `git rm src/lib/notify.ts` now and say so in this task's commit message.
- The file exists **and** something still imports it → Tasks 1–5 are unfinished. Stop and report.

- [ ] **Step 3: Record the BEFORE assertion count**

Run: `npm run check:tokens | tail -1`

Expected: `44 passed, 0 failed` (or whatever Tasks 1–5 actually produced — write the number down; it is the baseline for Step 12). `0 failed` is required. If anything is failing before you start, fix that first: you cannot tell your six deletions apart from someone else's breakage otherwise.

- [ ] **Step 4: Delete the moderation page**

```bash
git rm src/app/moderate/page.tsx src/app/moderate/layout.tsx src/app/moderate/ModeratePanel.tsx
```

- [ ] **Step 5: Prove the site still builds without it**

Run: `npm run build && npm run lint`

Expected: both exit 0. `robots.ts` still contains the literal string `'/moderate'` — that is a string, not an import, so it cannot break the build; Task 7 removes it. `postbuild` prints `secrets: 4/4 checked, none found` and `content: skipped (store empty)`.

- [ ] **Step 6: Rewrite `src/lib/token.ts` with the invite half only**

Replace the entire file with this. The invite functions, `assertSecret`, and the base64url/MAC plumbing are unchanged; what goes is `MAX_MODERATION_URL_CHARS`, `signModerationToken`, `verifyModerationToken`, `inflate`, `MAX_RECORD_BYTES`, `isTestimonialRecord`, its `str`/`filled` helpers, and the `node:zlib` import.

```ts
// SERVER ONLY. One token family:
//   i1 = invite — minted by scripts/invite.mjs, consumed by /api/testimonials/submit
//
// The m1 moderation family is gone along with the email path (docs/superpowers/specs/
// 2026-08-29-admin-moderation-design.md §3). The admin session cookie is a separate mechanism in
// a separate module — src/lib/admin-auth.ts, domain tag "s1" — which signs with MOD_SECRET and
// calls assertSecret from here.
//
// The `.ts` extension below is load-bearing: scripts/*.mjs load this module through Node's
// built-in type stripping, which does NO extension resolution, so './token-types' fails there
// with ERR_MODULE_NOT_FOUND. tsc accepts the explicit form because tsconfig sets
// allowImportingTsExtensions; elsewhere under src/ keep the extensionless style.
import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  b64urlDecode,
  b64urlEncode,
  decodeInviteFields,
  encodeInviteFields,
  splitToken,
} from './token-types.ts'
import type { InviteFields } from './token-types.ts'

if (typeof window !== 'undefined') {
  throw new Error(
    'src/lib/token.ts is server-only: it signs with INVITE_SECRET. A client component must ' +
      'import src/lib/token-client.ts instead.',
  )
}

export const SITE_ORIGIN = 'https://aserban.ro'
export const INVITE_TTL_DAYS = 45

const MIN_SECRET_CHARS = 32

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
//
// MOD_SECRET is asserted here even though nothing in THIS file uses it any more. It signs the
// /admin session cookie in src/lib/admin-auth.ts, which calls assertSecret per invocation rather
// than at module scope — so this line is the only thing that turns a missing MOD_SECRET into a
// failed build instead of a failed login at 11pm. admin-auth.ts imports this module, and so does
// the submit route, so the assert runs on every path that could need either value. Do not "tidy"
// it away on the grounds that this file no longer signs with it.
assertSecret('INVITE_SECRET', process.env.INVITE_SECRET)
assertSecret('MOD_SECRET', process.env.MOD_SECRET)

// One member on purpose. The tag stays inside the MAC input so a second family added later can
// never be confused with an invite token — which is exactly how m1 was kept apart, and how
// admin-auth.ts keeps "s1" apart today.
type Domain = 'i1'

function bytesOf(b64: string): Uint8Array | null {
  try {
    return b64urlDecode(b64)
  } catch {
    return null
  }
}

// The domain tag is prefixed to the base64url payload exactly as it travels inside the token, so
// what is verified is byte-for-byte what was transmitted.
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
```

- [ ] **Step 7: Run the harness and watch it fail**

Run: `npm run check:tokens`

Expected: three `FAIL` lines, then a crash — not a clean summary:

```
FAIL  invite and moderation tokens survive a full round trip
      signModerationToken is not a function
FAIL  a single flipped payload byte fails verification
      signModerationToken is not a function
FAIL  a token signed under i1 never verifies under m1
      verifyModerationToken is not a function
PASS  an empty, short or missing secret throws
PASS  a wrong-length signature returns null instead of throwing RangeError
```

followed by an **uncaught** `TypeError: signModerationToken is not a function` thrown from `moderationUrlFor`, and a non-zero exit. The crash is not a nuisance — it is the proof you need: the whole URL-budget block builds its fixtures at module scope by calling `signModerationToken`, so it is moderation-only code by construction and goes out whole in Step 9.

- [ ] **Step 8: Rewrite `src/lib/token-client.ts`**

Replace the entire file. `decodeInviteUnverified` and `stripHash` are byte-identical; `decodeModerationUnverified` and the duplicated `isTestimonialRecord` (with its `str`/`filled` helpers) go. That duplicate validator existed only because the browser could not import the server module; with the moderation preview gone, the codebase is back to **one** definition of a valid record.

```ts
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
```

- [ ] **Step 9: Harness edit 1 of 4 — the token-crypto destructuring and the `record` fixture**

In `scripts/token-roundtrip.mjs`, replace this (around line 264):

```js
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

// `invite` is already declared above (invite field codec section) with this exact shape and
// value — reused here rather than redeclared, which would be a SyntaxError at module scope.
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
```

with this:

```js
// `invite` is already declared above (invite field codec section) and is reused here rather than
// redeclared, which would be a SyntaxError at module scope.
const { SITE_ORIGIN, INVITE_TTL_DAYS, assertSecret, signInviteToken, verifyInviteToken } =
  await import('../src/lib/token.ts')
```

- [ ] **Step 10: Harness edit 2 of 4 — the three token-crypto assertions**

Replace this (the round-trip, tamper and domain-separation assertions, which run together from around line 296 to line 340):

```js
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
```

with this:

```js
// 1 — round trip
check('an invite token survives a full round trip', () => {
  assertDeepEqual(
    verifyInviteToken(signInviteToken(invite, INVITE_SECRET), INVITE_SECRET),
    invite,
    'invite round trip lost data',
  )
  assert(SITE_ORIGIN === 'https://aserban.ro', 'SITE_ORIGIN is not the hardcoded production origin')
  assert(INVITE_TTL_DAYS === 45, `INVITE_TTL_DAYS is ${INVITE_TTL_DAYS}, expected 45`)
})

// 2 — tamper must fail
// One row in the table, not two: the m1 moderation family is gone. The table shape stays so a
// second family can be added back as a row rather than as a rewrite.
check('a single flipped payload byte fails verification', () => {
  for (const [label, token, secret, verify] of [
    ['invite', signInviteToken(invite, INVITE_SECRET), INVITE_SECRET, verifyInviteToken],
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

// The i1-versus-m1 domain-separation assertion lived here. It went out with m1 — with a single
// family left there is no second domain in this module to confuse. The property itself is still
// covered, in the admin session section at the bottom of this file: "a stamp signed under the
// invite i1 domain does not verify as a session".

// 3 — empty secret must throw
```

Then renumber the one comment below it: `// 5 — wrong-length signature must be null, not RangeError` becomes `// 4 — wrong-length signature must be null, not RangeError`.

- [ ] **Step 11: Harness edit 3 of 4 — delete the whole URL-budget section**

Delete every line from

```js
// 6 — URL budget
// Caps are read from CAPS, never retyped: raising a cap must move these numbers.
```

down to and including the closing `})` of the assertion named `incompressible answers at every cap overflow the budget, which is what the 413 is for` — the last line before the blank line that precedes `// --- client-side decoding (no secret) ---`. That is roughly 147 lines and takes with it `PROSE`, `PROSE_RO_MAX`, `toCap`, `noise`, `romanianSlugMax`, `moderationUrlFor`, `naturalUrl`, `romanianUrlMax`, `noiseUrl`, the `URL budget …` `console.log`, and three assertions.

Do **not** touch the `CAPS` destructuring in the sanitize section above — the grapheme-cap assertions still use it.

Verify the range was right: `grep -c "MAX_MODERATION_URL_CHARS\|PROSE\|noiseUrl" scripts/token-roundtrip.mjs`
Expected: `0`

- [ ] **Step 12: Harness edit 4 of 4 — the client-decoding section**

Replace this header comment:

```js
// --- client-side decoding (no secret) ----------------------------------------
// DecompressionStream and Blob are Node globals from 18 onward, so the browser path is genuinely
// executable here rather than only reasoned about.
```

with:

```js
// --- client-side decoding (no secret) ----------------------------------------
// The invite fragment is plain base64url over an FS-joined string — no compression — so the
// browser path is genuinely executable here rather than only reasoned about.
```

Replace this:

```js
const { decodeInviteUnverified, decodeModerationUnverified } = await import(
  '../src/lib/token-client.ts'
)
```

with:

```js
const { decodeInviteUnverified } = await import('../src/lib/token-client.ts')
```

Delete the `clientRecord` fixture in full:

```js
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
```

And delete both `await checkAsync(...)` moderation blocks — everything from `await checkAsync('the moderation fragment gunzips on the browser path', async () => {` down to the `})` that closes `await checkAsync('an absent, malformed or non-gzip moderation fragment returns null', ...)`, which is the last line before the blank line preceding `// --- admin session cookie ---`.

**Keep `async function checkAsync(name, fn)` itself.** It is still called by the admin-session section appended by Tasks 1–5. **Keep the `import { randomBytes } from 'node:crypto'` at the top** even though the fixture that used it just went: the admin-session section's comment explains the file's import discipline by pointing at that exact line, and removing it would falsify a comment in an append-only region for no gain.

- [ ] **Step 13: Run the harness green and check the arithmetic**

Run: `npm run check:tokens | tail -1`

Expected: `38 passed, 0 failed` — or precisely `(the Step 3 number) − 6`. Not five, not seven. If the delta is wrong, `grep -n "^\(await \)\?check\(Async\)\?(" scripts/token-roundtrip.mjs` and compare the names against the six listed at the top of this task.

- [ ] **Step 14: Orphan sweep**

Run: `grep -n "record\|clientRecord\|MOD_SECRET" scripts/token-roundtrip.mjs`

Expected: `clientRecord` gone entirely; `record` surviving only inside unrelated prose in comments (there is one in the admin section); `MOD_SECRET` surviving as the const declaration near the token-crypto section **and** in the admin-session section, which signs with it. If a bare `const record = {` is still there with no remaining use, delete it — it was the moderation fixture. If some assertion appended by Tasks 1–5 reuses it, leave it alone.

Run: `grep -rn "node:zlib\|DecompressionStream\|gzip" src scripts`
Expected: no output. The signed-postcard mechanism is now entirely gone.

- [ ] **Step 15: Full gate**

Run: `npm run build && npm run lint && npm run check:tokens`
Expected: all three exit 0; `postbuild: OK — static: verified …; secrets: 4/4 checked, none found; content: skipped (store empty)`.

- [ ] **Step 16: Commit**

```bash
git add src/lib/token.ts src/lib/token-client.ts scripts/token-roundtrip.mjs src/app/moderate
git commit -m "refactor(testimonials): delete the moderation page and the m1 token family

The signed-postcard mechanism — gzip, the 2400-character URL budget, the
fragment-based anti-prefetch defence — existed to carry a submission safely
inside an email. With no email it protects nothing.

Removes /moderate, signModerationToken, verifyModerationToken,
MAX_MODERATION_URL_CHARS, decodeModerationUnverified and the duplicated
record validator in token-client.ts. token.ts keeps the whole invite half
and keeps asserting MOD_SECRET, which now signs the admin session cookie.

check:tokens loses exactly six assertions (44 -> 38): the i1/m1 domain
separation, three URL-budget measurements and two client-side gunzip
assertions. This is the one commit where deleting from that append-only
harness is correct.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Configuration, and the privacy note the submitter reads

**Files:**
- Modify: `src/app/robots.ts:4`, `:16`
- Modify: `.env.local.example:13-19`, `:21-23`
- Modify: `scripts/postbuild-check.mjs:78`
- Modify: `src/app/invite/TestimonialForm.tsx:159-198`, `:633-638`
- Modify: `.env.local` (untracked, never committed — but the build will not start without it)

**Interfaces:**
- Consumes: `assertAdminPassword` behaviour in `src/lib/admin-auth.ts` (module-scope, minimum 24 characters) — only to document it accurately. No imports change.
- Produces: nothing exported.

**Scope note, flagged rather than smuggled.** The brief for this task says "change nothing else in that 663-line file" beyond the privacy note, then allows removing the now-unreachable 413 branch. Removing 413 leaves a second lie next to it: the 503 branch still reads *"The email did not go out, so Andrei has not seen this yet."* Task 3's rewritten submit route returns 503 when `putPending` fails — verified in the working tree — so that branch is **reachable and its copy is now false**. Re-wording it is one string. I am doing it, and saying so here so it can be vetoed rather than discovered.

- [ ] **Step 1: Rewrite `src/app/robots.ts`**

Replace the whole file:

```ts
import type { MetadataRoute } from 'next'

/**
 * /invite is a capability URL handed out by hand and /admin is the owner's own page, so keep
 * both out of search results. This is hygiene, not a security control: the invite capability
 * lives in the URL fragment, which never reaches a server or a crawler at all, and /admin is
 * gated by a signed session cookie regardless of what robots.txt says.
 *
 * No `sitemap` key — this repo has no sitemap route, and pointing robots.txt at a
 * 404 is worse than saying nothing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/invite', '/admin'],
    },
  }
}
```

- [ ] **Step 2: Confirm `/moderate` is gone from the repo's runtime code**

Run: `grep -rn "moderate" src scripts`
Expected: no output. (Task 6 deleted the page and the token family; this step deletes the last string reference.) Documentation under `docs/` still mentions it — Task 8 fixes that.

- [ ] **Step 3: Rewrite `.env.local.example`**

Replace the whole file:

```bash
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

# HMAC key for the /admin session cookie (src/lib/admin-auth.ts, domain tag "s1"). Same 32-character
# minimum, asserted by src/lib/token.ts at module load. A different value from INVITE_SECRET.
# Rotating this signs every /admin session out at once — the panic button if the phone you stay
# logged in on is lost. Rotating INVITE_SECRET instead kills every outstanding invite.
MOD_SECRET=

# The /admin password. It MUST BE GENERATED and at least 24 characters. This is not style: it is
# what stands in for rate limiting, which a Vercel function cannot have (a module-scoped counter
# resets on every cold start and is not shared across concurrent lambdas). A generated 24-character
# password is not brute-forceable; a memorable one is. src/lib/admin-auth.ts asserts the length at
# module scope, so a short or missing value fails `npm run build`, not the 11pm login.
#
# Generate one:  node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"
ADMIN_PASSWORD=

# Fine-grained GitHub PAT covering BOTH repositories, nothing else:
#   seradi96/qa-portfolio          — Contents Read & Write, Pull requests Read & Write
#   seradi96/qa-portfolio-pending  — Contents Read & Write   (private; the pending queue)
# Never logged. Revoke first if anything looks wrong.
GITHUB_TOKEN=
```

- [ ] **Step 4: Update your own `.env.local` and prove the assertion is real**

Generate a password and put it in `.env.local`, then remove the dead key:

```bash
node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"
# paste the output as ADMIN_PASSWORD=… in .env.local, then delete the RESEND_API_KEY line
```

Run: `cut -d= -f1 .env.local | grep -v '^#' | grep -v '^$'`
Expected, in any order: `INVITE_SECRET`, `MOD_SECRET`, `ADMIN_PASSWORD`, `GITHUB_TOKEN`. Four names, no `RESEND_API_KEY`.

Run: `grep -n "MIN_PASSWORD_CHARS = 24" src/lib/admin-auth.ts && grep -n "^assertAdminPassword(process.env.ADMIN_PASSWORD)" src/lib/admin-auth.ts`
Expected: both print a line. **If the module-scope call is missing, stop and report it** — the `.env.local.example` comment you just wrote would be a false claim, and Task 8 is about to repeat it in two more files.

- [ ] **Step 5: Swap the secret name in `scripts/postbuild-check.mjs`**

Read the file first — the closing summary line is assembled from `secretsChecked`, `secretsSkipped` and `SECRET_NAMES.length`, so a check that was *skipped* is never reported as one that *passed*. That honesty is the point of the script and must survive this edit. It does: the only thing that changes is one string in one array.

Replace line 78:

```js
const SECRET_NAMES = ['INVITE_SECRET', 'MOD_SECRET', 'RESEND_API_KEY', 'GITHUB_TOKEN']
```

with:

```js
const SECRET_NAMES = ['INVITE_SECRET', 'MOD_SECRET', 'ADMIN_PASSWORD', 'GITHUB_TOKEN']
```

Change nothing else in the file. The comment at line 130 about this being "a four-secret, zero-dependency script" is still accurate — it is still four.

- [ ] **Step 6: Prove the summary line is still honest in both directions**

Run: `npm run build`
Expected, on the last line: `postbuild: OK — static: verified — '/' is in the prerender manifest; secrets: 4/4 checked, none found; content: skipped (store empty)`.

Then prove the skip path still reports as a skip rather than as a pass:

```bash
mv .env.local .env.local.bak && node scripts/postbuild-check.mjs; mv .env.local.bak .env.local
```

Expected: four `postbuild: note: … is not set here — leak check skipped` lines and a summary containing `secrets: 0/4 checked (not set in this environment)`. Restore the file — the `mv` back is in the same command line on purpose, because a missing `.env.local` breaks `npm run build` entirely.

- [ ] **Step 7: Rewrite the privacy note's "Where it lives" paragraph**

In `src/app/invite/TestimonialForm.tsx`, replace:

```tsx
            <p>
              <strong className="text-gray-300">Where it lives</strong> &mdash; until you approve
              nothing is stored anywhere; your submission arrives in my personal Gmail so I can read
              it. If I publish it, it goes into this site&apos;s public repository. If I don&apos;t, I
              delete the email and nothing remains.
            </p>
```

with:

```tsx
            <p>
              <strong className="text-gray-300">Where it lives</strong> &mdash; until I publish it,
              your submission sits in a private store only I can read. If I publish it, it goes into
              this site&apos;s public repository. If I don&apos;t, I delete it and nothing remains.
            </p>
```

Both apostrophes are `&apos;` — `react/no-unescaped-entities` is an ESLint **error**, not a warning.

**Do not touch `src/lib/consent.ts`.** `CONSENT_TEXT_V1` is about publication and says nothing about where a submission is held, so nothing a past submitter agreed to has changed. `CONSENT_VERSION` stays `1` and nobody needs to re-consent. The paragraph you just edited is Article 13 information, which is a different thing from consent and is allowed to be corrected in place.

- [ ] **Step 8: Remove the unreachable 413 branch and fix the 503 copy**

Task 3 deleted the URL-budget check from the submit route, so no 413 can be produced any more. In the same file, replace:

```tsx
function readErrorBody(body: unknown): { field?: string; message?: string } {
  if (typeof body !== 'object' || body === null) return {}
  const r = body as { field?: unknown; message?: unknown; error?: unknown }
  // /api/testimonials/submit is internally consistent, not uniform: 422 sends
  // { field, message } (route.ts's FieldError branch), but every other rejection — including
  // the 413s, which are the ones that carry a computed "trim by N characters" figure — sends
  // { error }. Reading `message` first and falling back to `error` is what makes that number
  // actually reach the submitter instead of always falling through to the generic 413 copy below.
  const message =
    typeof r.message === 'string' ? r.message : typeof r.error === 'string' ? r.error : undefined
  return {
    field: typeof r.field === 'string' ? r.field : undefined,
    message,
  }
}
```

with:

```tsx
function readErrorBody(body: unknown): { field?: string; message?: string } {
  if (typeof body !== 'object' || body === null) return {}
  const r = body as { field?: unknown; message?: unknown; error?: unknown }
  // /api/testimonials/submit is internally consistent, not uniform: 422 sends
  // { field, message } (route.ts's FieldError branch), every other rejection sends { error }.
  // Reading `message` first and falling back to `error` is what makes the server's own wording
  // reach the submitter instead of always falling through to the generic copy below.
  const message =
    typeof r.message === 'string' ? r.message : typeof r.error === 'string' ? r.error : undefined
  return {
    field: typeof r.field === 'string' ? r.field : undefined,
    message,
  }
}
```

and replace:

```tsx
  if (status === 413) {
    return (
      fromServer ??
      'There is a little more text than fits in one link. Trimming the longest answer by a few sentences will do it.'
    )
  }
  if (status === 422) {
```

with:

```tsx
  if (status === 422) {
```

and replace:

```tsx
  if (status === 503) {
    return 'The email did not go out, so Andrei has not seen this yet. Nothing was lost — wait a moment and tap Send again.'
  }
```

with:

```tsx
  if (status === 503) {
    return 'This did not save, so Andrei has not seen it yet. Nothing was lost — wait a moment and tap Send again.'
  }
```

- [ ] **Step 9: Confirm no 413 handling survives anywhere**

Run: `grep -rn "413" src`
Expected: no output. If the submit route still returns a 413, Task 3 is unfinished — stop and report rather than putting the branch back.

- [ ] **Step 10: Gate**

Run: `npm run build && npm run lint && npm run check:tokens`
Expected: all three exit 0. `check:tokens` prints the same count as the end of Task 6 (`38 passed, 0 failed` if Tasks 1–5 landed as written) — this task adds and removes no assertions.

- [ ] **Step 11: NAMED MANUAL CHECK — read the privacy note as a submitter**

This is a manual check, not a test; nothing in the harness can reach it.

```bash
npm run invite -- --name "Test Person" --role "QA Lead" --company "TOKERO" --project tokero --message "test"
npm run dev
```

Take the printed URL, swap `https://aserban.ro` for `http://localhost:3000`, open it, and scroll to the privacy note. Confirm, by eye:
1. The **Where it lives** paragraph reads *"until I publish it, your submission sits in a private store only I can read. If I publish it, it goes into this site's public repository. If I don't, I delete it and nothing remains."*
2. No stray `&apos;` is visible as literal text — the apostrophes render as apostrophes.
3. The consent checkbox text above it is **unchanged** — it still starts *"I'm happy for Andrei to publish this on aserban.ro…"*.
4. The other five paragraphs (Who's asking / What gets published / What I don't collect / Why I'm allowed to / Your say) are untouched.

Do not submit the form from localhost: the hardcoded `SITE_ORIGIN` check rejects it with a 403 by design.

- [ ] **Step 12: Commit**

```bash
git add src/app/robots.ts .env.local.example scripts/postbuild-check.mjs src/app/invite/TestimonialForm.tsx
git commit -m "chore(testimonials): ADMIN_PASSWORD replaces RESEND_API_KEY, /admin is noindex

robots.ts disallows /admin instead of the deleted /moderate. .env.local.example
drops RESEND_API_KEY, documents MOD_SECRET's new job signing the admin session
cookie, and adds ADMIN_PASSWORD with the generate-it command and the reason the
24-character minimum stands in for rate limiting. postbuild's leak scan swaps
RESEND_API_KEY for ADMIN_PASSWORD; its skipped-versus-checked summary is
unchanged and still counts what actually ran.

The invite form's privacy note now says the submission sits in a private store
rather than in my Gmail. CONSENT_TEXT_V1 is untouched and CONSENT_VERSION stays
1 — it covers publication, never storage, so no re-consent is needed. The 413
branch goes with the URL budget that produced it, and the 503 copy no longer
claims an email failed to send.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Documentation — CLAUDE.md and the runbook

**Files:**
- Modify: `CLAUDE.md:32`, `:37-45`, `:54`, `:66-68`, `:75`, `:92`, `:122`, `:124`, `:128`, `:134`
- Modify: `docs/testimonials-runbook.md:4`, `:6-11`, `:17-47`, `:51-71`, `:89-90`, `:104-127`, `:130-141`, `:183-225`, `:229-238`, `:272-285`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

A documentation task that ships a wrong fact is worse than one that ships nothing. Every claim below was checked against the repository; Step 1 makes you check them again, because the code moved while this plan was being written.

- [ ] **Step 1: Fact-check pass — run these before writing a word**

```bash
grep -n "qa-portfolio-pending" src/lib/pending-store.ts
grep -n "SESSION_TTL_SECONDS = 2592000\|MIN_PASSWORD_CHARS = 24\|SESSION_COOKIE = 'admin_session'" src/lib/admin-auth.ts
grep -rn "RESEND\|node:zlib\|moderate" src scripts .env.local.example
ls src/app/admin src/app/api/admin
node -e "for (const p of ['next','react','typescript','tailwindcss']) console.log(p, require('./node_modules/'+p+'/package.json').version)"
```

Expected: the pending repo name is a hardcoded constant; the three session constants are as named; the third grep returns **nothing at all**; `/admin` and its three API routes exist; versions print `next 16.2.6`, `react 19.2.6`, `typescript 5.9.3`, `tailwindcss 4.3.0`, which is exactly what CLAUDE.md's stack table already says — leave that table alone. If any expectation fails, fix the code or the earlier task, not the sentence you were about to write.

- [ ] **Step 2: CLAUDE.md — the commands block and the build-gate paragraph**

Replace:

```
npm run check:tokens # Token codec, HMAC, sanitisation and URL-budget assertions
```

with:

```
npm run check:tokens # Token codec, HMAC, sanitisation and admin-session assertions
```

Then replace:

~~~
**`.env.local` must exist before `npm run build` works — a fresh clone cannot build.** Since the
testimonials submit route exists, `src/lib/token.ts` asserts `INVITE_SECRET`/`MOD_SECRET` at module
scope, and `next build` evaluates route-handler modules during "Collecting page data". No `.env.local`
means:

```
Error: INVITE_SECRET is missing, empty, or shorter than 32 characters...
Error: Failed to collect page data for /api/testimonials/submit
```
~~~

with:

~~~
**`.env.local` must exist before `npm run build` works — a fresh clone cannot build.** Three
module-scope assertions see to it: `src/lib/token.ts` asserts `INVITE_SECRET` and `MOD_SECRET`,
and `src/lib/admin-auth.ts` asserts `ADMIN_PASSWORD` (minimum 24 characters) the same way. `next
build` evaluates route-handler modules during "Collecting page data", so the moment a route imports
either file the build needs all three. No `.env.local` means:

```
Error: INVITE_SECRET is missing, empty, or shorter than 32 characters...
Error: Failed to collect page data for /api/testimonials/submit
```
~~~

- [ ] **Step 3: CLAUDE.md — the verification-gate sentence**

Replace `covering the testimonial token codec, HMAC verification, sanitisation and the URL budget.` with `covering the testimonial token codec, HMAC verification, sanitisation and the admin session cookie.`

- [ ] **Step 4: CLAUDE.md — the architecture tree**

Replace:

```
│   │   ├── invite/         # Testimonial invite form (noindex, 'use client')
│   │   ├── moderate/       # Approve/discard panel (noindex, 'use client')
│   │   ├── api/testimonials/{submit,publish}/route.ts
│   │   └── robots.ts
```

with:

```
│   │   ├── invite/         # Testimonial invite form (noindex, 'use client')
│   │   ├── admin/          # Pending queue + password login (noindex, server component)
│   │   ├── api/testimonials/submit/route.ts
│   │   ├── api/admin/{login,publish,reject}/route.ts
│   │   └── robots.ts
```

and replace:

```
│       └── …               # token*, sanitize, consent, projects-meta, testimonials, notify, publish-to-git
```

with:

```
│       └── …               # token*, sanitize, consent, projects-meta, testimonials,
│                           #   admin-auth, pending-store, publish-to-git
```

- [ ] **Step 5: CLAUDE.md — the content-model bullet**

Replace `written by merging the pull request that `/api/testimonials/publish` opens` with `written by merging the pull request that `/api/admin/publish` opens`.

- [ ] **Step 6: CLAUDE.md — the env-var gotcha, plus two new ones**

Replace the whole `**Four server-only env vars**…` paragraph with these three paragraphs:

```markdown
**Four server-only env vars**, Vercel **Production only**: `INVITE_SECRET`, `MOD_SECRET`, `ADMIN_PASSWORD`, `GITHUB_TOKEN`. Never `NEXT_PUBLIC_` anything — `npm run postbuild` greps the whole build output for all four values and fails the build on a hit. Locally they live in `.env.local` (see `.env.local.example`; `.gitignore` un-ignores only the example). Two of them changed meaning when the email path was removed: **`MOD_SECRET` no longer signs moderation tokens** — that family is deleted — it signs the `/admin` session cookie in `src/lib/admin-auth.ts` under the domain tag `s1`, so rotating it signs every admin session out at once. **`ADMIN_PASSWORD` must be generated and at least 24 characters**: it is the only gate on `/admin`, a Vercel function cannot be rate-limited (a module-scoped counter resets on every cold start and is not shared across concurrent lambdas), so entropy in the password is the whole defence, and `admin-auth.ts` refuses to load below 24. `RESEND_API_KEY` is gone: this feature sends no email at all.

**The pending queue is a second, private GitHub repository.** `seradi96/qa-portfolio-pending`, one `pending/<id>.json` per unreviewed submission. Owner and repo name are **hardcoded module constants** in `src/lib/pending-store.ts`, exactly as they are in `src/lib/publish-to-git.ts`, and deliberately not environment-configurable — a mistyped variable must not be able to redirect submissions into a repository somebody else controls. `GITHUB_TOKEN` therefore has to reach **both** repos. Git cannot store an empty directory, so `GET /contents/pending` returns **404 when the queue is empty**; that is the normal state, not an error, and the store maps it to `[]`. A malformed pending file is dropped from the list with a logged warning rather than throwing, the same drop-not-throw discipline `testimonials.ts` uses. Operating instructions: `docs/testimonials-runbook.md`.

**`/admin` and `/invite` are both `noindex` and both in `robots.ts`'s disallow list.** `/admin` is a server component that reads the `admin_session` cookie; with no valid cookie it renders a small `'use client'` login form and nothing else. Its POST routes carry the same hardcoded `SITE_ORIGIN` Origin check as the submit route, so **neither page can be exercised from localhost** — that is by design, not a bug to work around.
```

- [ ] **Step 7: CLAUDE.md — the runtime and `output: 'export'` gotchas**

Replace `the token code uses `node:crypto` and `node:zlib`, and `'edge'` is deprecated in Next 16 and hard-fails the build.` with `the token, session and GitHub code uses `node:crypto` and `node:buffer`, and `'edge'` is deprecated in Next 16 and hard-fails the build.`

Replace `` `src/app/api/testimonials/*` are real route handlers; a static export would drop them.`` with `` `src/app/api/testimonials/*` and `src/app/api/admin/*` are real route handlers, and `/admin` reads a cookie; a static export would drop all of it.``

- [ ] **Step 8: CLAUDE.md — the react-hooks gotcha names a deleted file**

Replace:

```
`src/app/invite/page.tsx` and `src/app/moderate/ModeratePanel.tsx` each wrap their effect body in `queueMicrotask(() => { … })` specifically to satisfy `set-state-in-effect` while reading a browser-only source (`location.hash`) that cannot be read during SSR. These are not stray boilerplate — read the comment above each one before deleting it; removing the wrapper without the `useSyncExternalStore` redesign the comment describes fails `npm run lint` and blocks the build.
```

with:

```
`src/app/invite/page.tsx` wraps its effect body in `queueMicrotask(() => { … })` specifically to satisfy `set-state-in-effect` while reading a browser-only source (`location.hash`) that cannot be read during SSR. It is not stray boilerplate — read the comment above it before deleting it; removing the wrapper without the `useSyncExternalStore` redesign the comment describes fails `npm run lint` and blocks the build. `/admin` does not need the same trick and must not copy it: it is a server component that reads the cookie during render, and its login form holds no derived state.
```

- [ ] **Step 9: Runbook — the header and the six-line summary**

In `docs/testimonials-runbook.md`, replace lines 3–11:

```markdown
Operating instructions for the invite-only testimonials feature. Design rationale lives in
`docs/superpowers/specs/2026-08-28-testimonials-design.md`; this file is only the doing.

**The shape of it in six lines.** You mint a signed invite link on your laptop and send it by hand in
a LinkedIn DM. The colleague fills in a form on aserban.ro. Nothing is stored anywhere: the submission
is signed, gzipped and mailed to your Gmail, and **that email is the only copy**. From the email you
tap Publish, which opens a pull request against `src/content/testimonials.json`; you merge it from the
GitHub mobile app and Vercel deploys in about 90 seconds. Tapping Discard writes nothing anywhere —
rejection is literally doing nothing, which is why the retention promise in the consent text is true.
```

with:

```markdown
Operating instructions for the invite-only testimonials feature. Design rationale lives in
`docs/superpowers/specs/2026-08-28-testimonials-design.md`, as amended by
`2026-08-29-admin-moderation-design.md` (which replaced the email path with an admin page); this
file is only the doing.

**The shape of it in eight lines.** You mint a signed invite link on your laptop and send it by hand
in a LinkedIn DM. The colleague fills in the form on aserban.ro. The submission is written as
`pending/<id>.json` to a **private** GitHub repository, `seradi96/qa-portfolio-pending`, and GitHub
emails you — because you are watching that repository, which is now the only notification there is.
You open `https://aserban.ro/admin` on your phone, type the password once (a signed cookie then
lasts 30 days), and read each pending submission rendered by the same `TestimonialCard` the live site
uses. **Approve** opens a pull request against `src/content/testimonials.json` and deletes the pending
file; you merge from the GitHub mobile app and Vercel deploys in about 90 seconds. **Reject** deletes
the pending file and does nothing else.

One honest change from the old design: a pending submission is now **stored**, in a private
single-reader repository, until you act on it. Rejecting deletes the file but not that repository's
git history. The privacy note on the form no longer promises otherwise — it says the submission sits
in a private store only you can read. Do not re-promise "nothing is stored anywhere" to anyone.
```

- [ ] **Step 10: Runbook §1 — the environment table and the build gate**

Replace the table body and the two paragraphs that follow it (through the `INVITE_SECRET is the one value…` paragraph):

```markdown
| Name | What it is | Where else it must match |
|---|---|---|
| `INVITE_SECRET` | HMAC key for `i1` invite tokens | your local `.env.local` — `npm run invite` signs with it |
| `MOD_SECRET` | HMAC key for the `/admin` session cookie. **Repurposed** — it no longer signs moderation tokens, which no longer exist | nowhere; only the server uses it |
| `ADMIN_PASSWORD` | The `/admin` password. **Generated, 24+ characters** — see §2.3 | nowhere |
| `GITHUB_TOKEN` | Fine-grained PAT over **both** `seradi96/qa-portfolio` (Contents R/W + Pull requests R/W) and the private `seradi96/qa-portfolio-pending` (Contents R/W) | nowhere |

Set them at **Vercel → the project → Settings → Environment Variables**, ticking **Production** only.
Changing a value does not affect deployments that already exist — you must redeploy
(**Deployments → ⋯ on the newest one → Redeploy**) before the change takes effect.

`INVITE_SECRET` is the one value that lives in two places. If `.env.local` and Vercel Production
disagree, every link you mint is rejected with a 403 on the live site and the colleague sees a
"this link isn't valid" screen. Copy it, don't retype it.
```

Then, in the paragraph immediately below, replace:

```markdown
**`.env.local` also gates the build itself, not just runtime.** `src/lib/token.ts` asserts
`INVITE_SECRET` and `MOD_SECRET` at module scope, and `next build` evaluates route-handler modules
while "Collecting page data" — so `npm run build` fails on a fresh clone with no `.env.local` at all,
before a single page renders:
```

with:

```markdown
**`.env.local` also gates the build itself, not just runtime.** `src/lib/token.ts` asserts
`INVITE_SECRET` and `MOD_SECRET` at module scope and `src/lib/admin-auth.ts` asserts `ADMIN_PASSWORD`
(minimum 24 characters) the same way, and `next build` evaluates route-handler modules while
"Collecting page data" — so `npm run build` fails on a fresh clone with no `.env.local` at all,
before a single page renders. A too-short `ADMIN_PASSWORD` fails it just as loudly, which is the
point: the login must break at build time, not at 11pm:
```

- [ ] **Step 11: Runbook §2 — replace the Gmail filter with one-time setup**

Replace the whole of `## 2. Set up the Gmail filter — mandatory, do it before the first invite` and its body with:

```markdown
## 2. One-time setup — all four steps, before the first invite

### 2.1 Create the private pending repository

github.com → **New repository** → owner `seradi96`, name **`qa-portfolio-pending`**, visibility
**Private**. Tick **Add a README file** so the repo is not empty (an empty repo has no default
branch, and the store writes to `main`). Nothing else.

The name is a hardcoded constant in `src/lib/pending-store.ts` — there is no environment variable
for it, deliberately, so a typo cannot send someone's testimonial to a repository you do not own.
If you name it anything else, edit that constant.

You will never open a file in this repo by hand in normal use. It is a queue, not a workspace.

### 2.2 Extend the fine-grained token to both repositories

github.com → **Settings → Developer settings → Personal access tokens → Fine-grained tokens** →
your existing token → **Edit**. Repository access: **Only select repositories** → add
`seradi96/qa-portfolio-pending` alongside `seradi96/qa-portfolio`.

Permissions apply to every selected repository, so the set is the union of what each needs:
**Contents: Read and write** and **Pull requests: Read and write**. Nothing else. (The pending repo
only needs Contents; a fine-grained token cannot grant Pull requests to one repo and not the other,
and the extra grant on a private single-file queue is not worth a second token to avoid.)

A token that reaches `qa-portfolio` but not `qa-portfolio-pending` fails in a specific way: invites
work, the form submits, and the submitter is told it did not save — §9.

### 2.3 Generate `ADMIN_PASSWORD`

```bash
node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"
```

Paste it into Vercel Production and into `.env.local`. Put it in your password manager, because you
will type it on a phone and there is no reset flow.

**Do not choose a memorable one.** There is no rate limiting on `/api/admin/login` and there cannot
usefully be: a Vercel function has no throttle in front of it, and a module-scoped attempt counter
resets on every cold start and is not shared across concurrent lambdas, so an attacker would get an
unlimited parallel guessing budget regardless. Entropy in the password is the entire defence.
`src/lib/admin-auth.ts` refuses to load below 24 characters, so a short one fails the build.

### 2.4 Watch the pending repository — this is the ONLY notification

github.com → `seradi96/qa-portfolio-pending` → **Watch** → **All Activity**. Confirm your GitHub
notification settings actually deliver email (**Settings → Notifications → Email**).

**Nothing fails loudly if you skip this.** The old design pushed the submission into your inbox, so
a delivery failure was visible. Now the submission lands safely in the private repo and simply sits
there unseen; there is no alarm, no retry, and no second channel. Two habits cover the gap: enable
Watch, and open `/admin` yourself a day or two after sending any invite.

### 2.5 Verify the whole loop before inviting a real person

Mint an invite to yourself (§3), submit the form on the live site, then confirm all four:

1. `pending/<id>.json` appears in `seradi96/qa-portfolio-pending`.
2. GitHub emails you about it.
3. `https://aserban.ro/admin` lists it, rendered by the real card.
4. Rejecting it removes the file from the repo.
```

- [ ] **Step 12: Runbook §3 — one sentence about email**

Replace:

```markdown
it. Send the DM by hand. **The application never emails anyone but you** — that is why there are no
DNS records to maintain.
```

with:

```markdown
it. Send the DM by hand. **The application sends no email at all** — GitHub does, because you are
watching the pending repository (§2.4). That is why there are no DNS records, no sending domain and
no email provider to maintain.
```

- [ ] **Step 13: Runbook §4 — rewrite the review workflow around `/admin`**

Replace the whole of `## 4. Review a submission` and its body with:

```markdown
## 4. Review a submission at `/admin`

Open `https://aserban.ro/admin`. First visit on a device shows a single password box; type
`ADMIN_PASSWORD` and you get a signed `admin_session` cookie good for **30 days**
(`HttpOnly; Secure; SameSite=Lax`). After that the page opens straight into the queue.

Each pending submission is rendered by the **real `TestimonialCard`**, the same component the live
site uses, so what you approve is byte-for-byte what ships. Two buttons, both POSTs, both guarded by
the session cookie and by the hardcoded `SITE_ORIGIN` Origin check:

- **Approve** → `POST /api/admin/publish` → re-validates every field, then a branch
  `testimonial/<id>`, a commit, and a pull request against `src/content/testimonials.json`, then
  deletes `pending/<id>.json`. Merge the PR from the GitHub mobile app. Live in ~90 seconds.
- **Reject** → `POST /api/admin/reject` → deletes `pending/<id>.json` and nothing else.

Re-validation on approve is not redundant: the record has travelled through a store since it was
sanitised, and passing validation once is not proof it is still well-formed. A record that fails it
comes back as a 422 and stays in the queue.

Tapping Approve twice is safe: the second tap says "Pull request already open", and after the merge
it says "Already published". Publishing is idempotent on the record's `id`.

An empty queue is the normal state and renders as an empty list, not an error — git cannot store an
empty directory, so the store reads a 404 from `GET /contents/pending` and returns `[]`.

Before you merge, do the one check no script can do: click **Verify on LinkedIn** on the card and
confirm it lands on the real person. Slugs are percent-encoded in the wild — this site's own is
`%C8%99erban-andrei-5a14a51a5` — so a broken slug is a genuine failure mode, not a theoretical one.

`/admin` cannot be exercised from `localhost`: its POST routes carry the same absolute Origin check
as the submit route. That is deliberate and unchanged from the original design.
```

- [ ] **Step 14: Runbook §5 — rewrite the manual-publish fallback**

Replace the first paragraph and the numbered list of `## 5. Publish by hand when the API path fails` with:

```markdown
If Approve returns a 502, or `GITHUB_TOKEN` has expired or been revoked, the submission is not lost:
it is still sitting in the private repo as `pending/<id>.json`, and that file **is** the record, in
exactly the shape `src/content/testimonials.json` stores. The token is a convenience, not a
dependency.

1. Open `https://github.com/seradi96/qa-portfolio-pending/blob/main/pending/<id>.json` and copy the
   whole `{ … }` object.
2. Open `https://github.com/seradi96/qa-portfolio/edit/main/src/content/testimonials.json` and paste
   it into the array. It is an array of objects — mind the comma after the previous entry, and keep
   the newest record anywhere; `src/lib/testimonials.ts` sorts by `publishedAt`.
3. Commit to a new branch, open the pull request, wait for the Vercel preview, merge.
4. **Delete `pending/<id>.json` from the private repo by hand** — the API path would have done this
   for you, and a leftover pending file will show up in `/admin` as if it were still unreviewed.
```

Leave the "If you would rather do it on the laptop" block and the dual-account push snippet below it
exactly as they are.

- [ ] **Step 15: Runbook §7 — rotation, including the new panic button**

Replace the `**`MOD_SECRET`.**` and `**`RESEND_API_KEY`.**` paragraphs with:

```markdown
**`MOD_SECRET` — the other panic button.** It signs the `/admin` session cookie, so rotating it
**signs every admin session out at once, on every device**. That is what you reach for if the phone
you stay logged in on is lost or stolen: rotate, redeploy, and every outstanding cookie is dead
within one deployment. Nothing else is affected — pending submissions are untouched, invites are
untouched, and you simply type the password again next time. It no longer signs moderation tokens;
that family was deleted with the email path.

**`ADMIN_PASSWORD`.** Generate a new one with the §2.3 command, set it in Vercel Production, redeploy,
and update `.env.local`. Rotate it if you ever type it somewhere you should not have, or on a device
you no longer trust. Note that rotating the password does **not** invalidate existing sessions — the
cookie is signed with `MOD_SECRET`, not derived from the password — so if the concern is a device
rather than the secret, rotate `MOD_SECRET` too, or instead.
```

Then, in the `**`GITHUB_TOKEN` — revoke first…**` block, replace step 2 of its numbered list:

```markdown
2. **Generate new token** → Repository access: **Only select repositories** → both
   `seradi96/qa-portfolio` **and** `seradi96/qa-portfolio-pending`. Permissions: **Contents: Read and
   write**, **Pull requests: Read and write** (Metadata: Read-only is added for you). Nothing else.
   Set an expiry you will actually notice.
```

and add one sentence to that block's opening paragraph, after "A leaked token is a site takeover":
`It now also exposes every pending submission, because the same token reaches the private queue. Same acceptance as before, same mitigation: server-side only, Production only, never logged, revocable in minutes.`

- [ ] **Step 16: Runbook §8 — one added sentence about the private repo's history**

Keep the entire `## 8. Erase from git history` section, `git filter-repo` recipe and force-push
snippet as they are. Add this paragraph immediately after the `**Understand the cost before you
start.**` paragraph:

```markdown
**Check the private repo too.** If the record ever sat in `seradi96/qa-portfolio-pending` — every
record does, now — then deleting the pending file removed it from the queue but not from that
repository's history. For a true erasure request, run the same `git filter-repo` recipe against
`qa-portfolio-pending` as well, or, far simpler for a queue nobody reads: delete that repository and
create it again empty per §2.1. Nothing in the site depends on its history.
```

- [ ] **Step 17: Runbook §9 — the symptom table**

Replace the four rows that name email, 413 or `/moderate` with these, keeping every other row as-is:

```markdown
| Form returns 503 | the write to the private pending repo failed | Check `GITHUB_TOKEN` reaches `seradi96/qa-portfolio-pending` (§2.2); the form kept everything they typed, so they can retry |
| No GitHub notification | Watch is not set to All Activity, or GitHub email notifications are off | §2.4 — and check `/admin` directly; the submission is almost certainly there |
| `/admin` shows the password box again | the 30-day session expired, or `MOD_SECRET` was rotated | Type the password again — both are expected, not a fault |
| `/admin` rejects the right password | `ADMIN_PASSWORD` in Vercel Production differs from what you are typing, or the deployment predates the change | Set it in Vercel and **redeploy** — env changes do not reach existing deployments |
| Approve returns 502 | `GITHUB_TOKEN` expired, revoked, or lacking a permission on either repo | §7, and publish by hand via §5 meanwhile |
```

Delete the `Form returns 413`, `Moderate page is blank` and `No email at all` rows outright — none of
those states can occur any more.

- [ ] **Step 18: Prove no stale fact survives**

```bash
grep -rn "Resend\|RESEND\|moderate\|Gmail filter\|onboarding@resend.dev\|413\|gzip" CLAUDE.md docs/testimonials-runbook.md
```

Expected: no output from `CLAUDE.md`. From the runbook, the only acceptable remaining hits are inside
§8's erasure examples if any fixture text happens to contain one of those words — read each hit and
confirm it is not a claim about how the feature works. Anything describing Resend, the Gmail filter,
a moderation link or a 413 is a stale fact: delete it.

```bash
grep -n "RESEND_API_KEY" CLAUDE.md docs/testimonials-runbook.md .env.local.example scripts/postbuild-check.mjs
```

Expected: no output anywhere in the repository.

- [ ] **Step 19: Gate**

Run: `npm run build && npm run lint && npm run check:tokens`
Expected: all three exit 0, and `check:tokens` prints the same count as the end of Task 6. Documentation cannot break these, which is exactly why you run them: a green gate here proves you edited only Markdown.

- [ ] **Step 20: NAMED MANUAL CHECK — read the runbook as a stranger**

Read `docs/testimonials-runbook.md` top to bottom in one pass, as someone who has never operated this
feature, and confirm four things by eye:
1. Every command in §2 and §3 can be run as written, with no placeholder left in it.
2. §2.4 makes it unmistakable that GitHub Watch is the **only** notification and that its absence is silent.
3. No sentence anywhere still says a submission is not stored, or arrives by email.
4. The §6 takedown section and the §8 `git filter-repo` recipe are intact and still correct.

Then read `CLAUDE.md` and confirm the architecture tree matches `ls -R src/app`.

- [ ] **Step 21: Commit**

```bash
git add CLAUDE.md docs/testimonials-runbook.md
git commit -m "docs: admin-page moderation replaces the email path

CLAUDE.md: ADMIN_PASSWORD replaces RESEND_API_KEY and MOD_SECRET is
documented as the admin session key; /admin joins /invite as a noindex,
localhost-unreachable route; the private qa-portfolio-pending repository
is recorded as a new external dependency with its hardcoded-constant
rationale and its empty-queue 404; the build still needs .env.local and now
also needs ADMIN_PASSWORD, for the same module-scope-assert reason.

Runbook: the Gmail filter section is replaced by one-time setup — create the
private repo, extend the token to both repos, generate the password, and set
Watch to All Activity, which is now the only notification and fails silently
if it is off. Approve/reject is rewritten around /admin, and manual publish
now copies the pending JSON instead of a mail fallback. Rotating MOD_SECRET
is documented as the panic button for a lost phone. Takedown and filter-repo
are unchanged apart from a note that the private queue keeps its own history.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
