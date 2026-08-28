# Testimonials — Design

**Date:** 2026-08-28
**Status:** Approved for planning
**Codename:** Signed Postcard

An invite-only testimonials section for aserban.ro. Former colleagues write via a private link;
nothing is public until the owner approves it from his phone.

---

## 1. Verified baseline

Everything below was read from the repo on 2026-08-28, not assumed.

| Fact | Evidence |
|---|---|
| `next` 16.2.6, `react` 19.2.6, `typescript` 5.9.3 | `node_modules/*/package.json` |
| `tailwindcss` **4.3.0** | installed; `CLAUDE.md` says 4.1.18 — drift, fixed as part of this work |
| `resolveJsonModule: true` already on | `tsconfig.json:16` |
| Projects `</section>` closes at 1109; blank line at 1110; Architecture comment at 1111 | `src/app/page.tsx` |
| Desktop nav `#projects` anchor | `src/app/page.tsx:371` |
| Mobile nav `#projects` block closes | `src/app/page.tsx:411` |
| `personJsonLd` has no `@id`, yet `websiteJsonLd.author` references `https://aserban.ro/#person` | `src/app/layout.tsx:180` — dangling edge |
| `.env*` ignored | `.gitignore:34` |
| `globals.css` is 18 lines, no `@layer` block | `src/app/globals.css` |

---

## 2. Fixed requirements

Decided before design, not open for revision:

1. **Invite-only.** The owner sends a unique link to one named person. No open form.
2. **Attribution:** full name, role and company *at the time of the collaboration*, and a LinkedIn link.
   Verifiability is the entire point of the feature.
3. **Moderation by email:** the owner receives the full text plus signed approve/reject actions.
   No admin UI, no login, must work one-handed on a phone.
4. **Form content:** guided prompts plus a free-text field, linked to a project from `projects[]`.
5. **Placement:** its own section immediately after Projects, before Architecture, with a nav entry.

Volume: roughly three submissions a year; 10–20 over the life of the site. This is a hard constraint
on how much machinery is justified.

## 3. Decisions taken at design approval

| # | Decision | Chosen |
|---|---|---|
| 1 | Architecture | **Signed Postcard** — no database |
| 2 | Git write target | **Branch + pull request**, merged from the GitHub mobile app |
| 3 | Receipt to the author | **Manual** — paste-ready LinkedIn follow-up, zero DNS records |
| 4 | Typed secret on approve | **No** — fragment + POST + Origin is the defence |
| 5 | `GITHUB_TOKEN` at all | **Keep it**, publishing stays automatic |

Decision 5 was taken *after* the review corrected the record on decision 2 (see §10): a leaked token is
a site takeover under either git target, so the alternative on the table was deleting the token
entirely and publishing by hand from the email's fallback links. Automatic publishing was chosen with
that trade understood; §15 states the residual risk as accepted rather than solved.

---

## 4. Architecture

```
Owner                          Colleague                     Owner's phone
  |                                |                              |
  |-- npm run invite ------------->|                              |
  |   (mints HMAC token, prints    |                              |
  |    paste-ready LinkedIn DM)    |                              |
  |                                |                              |
  |                          /invite#<token>                      |
  |                          form, prefilled                      |
  |                                |                              |
  |                       POST /api/testimonials/submit           |
  |                       verify - sanitize - gzip - sign         |
  |                                |                              |
  |                                +-- one plain-text email ----->|
  |                                    (full text readable        |
  |                                     on the lock screen)       |
  |                                                               |
  |                            /moderate#a=publish&t=<token>      |
  |                            gunzip in browser, preview         |
  |                            with the REAL card component       |
  |                                                               |
  |                       POST /api/testimonials/publish <--------|
  |                       branch + commit + open PR               |
  |                                                               |
  |                       pull request URL ---------------------->|
  |                                                               |
  |  GitHub notifies. The pull request gets its own Vercel preview,|
  |  rendering the card on a real build of the real site.          |
  |  Merge from mobile -> main -> production in ~90 s.             |
```

**The signed link is the pending submission.** There is no `pending` row, no queue, no table.

### 4.1 Why no database

Three properties fall out of that one choice, and none of them can be bought back later:

- **Rejection is doing nothing.** No row survives to be forgotten, so the GDPR retention promise is
  true by construction rather than by the owner's discipline in three years.
- **The read path is a module import.** If every external service in this design vanished, the
  section would still render byte-identical, because it is bundled into the build output. The
  database alternative fails soft to `[]`, which silently deletes the whole section *and both nav
  entries* for up to an hour if the database is cold during a build — with no alert, and no test in
  this repo capable of catching it.
- **`page.tsx` is never restructured.** `docs/superpowers/plans/2026-06-27-card-surface-system.md`
  carries 28 references to that file. A server/client split would invalidate all of them.

---

## 5. Data model

`src/content/testimonials.json`, committed, initial content `[]`. **Approved records only.**

```jsonc
[
  {
    "id": "aB3xK9pQr7Zt",              // 12 chars base64url, minted at submit; the idempotency key
    "projectSlug": "tokero",           // must be a member of PROJECT_SLUGS
    "publishedAt": "2026-09-14",
    "submittedAt": "2026-09-13",
    "consent": { "version": 1, "at": "2026-09-13T18:42:07Z" },
    "author": {
      "name": "Maria Popescu",
      "role": "QA Lead",               // AT THE TIME of the collaboration, never current
      "company": "TOKERO",             // AT THE TIME
      "linkedinSlug": "maria-popescu-8a41b2"
    },
    "answers": {
      "whatIDid": "He owned the end-to-end suite and was the person we pinged when a pipeline went red at 6pm.",
      "whatChanged": "Regression used to eat two days of manual clicking. After his framework landed it ran overnight.",
      "hiringManager": "I'd work with him again. He'll push back if he thinks the plan is wrong.",
      "anythingElse": ""               // optional; empty optionals are legal and render nothing
    }
  }
]
```

Field caps are counted in graphemes: `whatIDid` 300, `whatChanged` 400, `hiringManager` 400,
`anythingElse` 700.

`publishedAt` is stamped by the publish endpoint at the moment the pull request is **opened**, not
when it merges — under decision 2 those can differ by days. It is a sort key and a display date only,
never a source for "time since": no field in the record, and no value returned by
`/api/testimonials/publish`, records when a testimonial actually went live.

Nested rather than flat, deliberately: the admin UI is github.com's mobile editor on this file, so
human readability on a phone beats shape rigidity.

`src/lib/testimonials.ts` imports the JSON, validates each entry, **drops** anything malformed rather
than throwing — a bad hand-edit must never fail a deploy that was about something else — sorts
newest-first, and exports `TESTIMONIALS: Testimonial[]`.

### 5.1 `linkedinSlug`, never a URL

The href is reconstructed at render time as `https://www.linkedin.com/in/${slug}`, with the host as a
source literal, after `/^[A-Za-z0-9%_-]{3,60}$/`.

React 19's `sanitizeURL` blocks only `javascript:` — `data:`, `vbscript:`, `blob:` and any
`https://evil.com` pass through untouched. Storing a slug makes a phishing href **structurally
impossible** rather than dependent on fifteen lines of correct URL parsing.

Real slugs are percent-encoded (this site's own is `%C8%99erban-andrei-5a14a51a5`), so the form
accepts a pasted full URL and strips it to a slug client-side, showing `linkedin.com/in/` as a
static prefix.

### 5.2 Consent record

`consent.version` is a number. `CONSENT_TEXT_V1` lives verbatim in `src/lib/consent.ts`. Git history
is the Article 7(1) archive of exactly what a given person agreed to on a given date — better
evidence than a duplicated string per row, and two bytes of storage.

---

## 6. Invite token

Stateless HMAC, minted on the owner's laptop by `npm run invite`, delivered by hand in a LinkedIn DM.
**The application never emails a third party.** That single decision deletes MX, SPF, DKIM, DMARC and
every deliverability failure mode, because the only recipient in the entire system is the owner's own
Gmail.

Fields joined with `U+001F`, then base64url:

```
[0] "1"                          schema version
[1] "Maria Popescu"              prefills the name field
[2] "QA Lead"                    prefills role-at-the-time
[3] "TOKERO"                     prefills company-at-the-time
[4] "tokero"                     preselects the project dropdown
[5] "You saw the whole thing from the inside - would you write a few lines?"
[6] 1801526400                   absolute expiry, unix seconds (iat + 45 days)

token = base64url(payload) + "." + base64url(HMAC-SHA256(INVITE_SECRET, "i1." + payload))
URL   = https://aserban.ro/invite#<token>        // measured at 229 chars
```

Fields [1]–[4] turn a blank eight-field form into a proof-read. That is the single largest completion
lever available and it costs 70 URL characters. Field [5] is the owner's handwritten line, carried
statelessly.

**Do not gzip the invite payload** — measured, gzip makes a 119-byte payload *larger* (174 vs 159
base64url chars).

**Fragment, not a path segment.** Everything after `#` never leaves the browser.

---

## 7. Submission

`POST /api/testimonials/submit` — `src/app/api/testimonials/submit/route.ts`.
**No `runtime` export**: `'nodejs'` is the default, and `'edge'` is deprecated in Next 16 and
hard-fails the build on `node:crypto`.

1. Reject before parsing if `Content-Length > 16384`; read via a bounded stream so a lying header
   cannot force an allocation.
2. `Origin === 'https://aserban.ro'` — a hardcoded module constant, not an env var, so a
   misconfigured environment cannot widen it. Every preview deployment fails closed.
   This is absolute — no localhost exemption, no env override — so **neither route handler can be
   exercised under `npm run dev`**. The whole write path is developed against a preview deployment
   with the constant temporarily pointed at that preview's origin in an uncommitted working-tree
   edit; §18.4 item 9 is the check that the edit never shipped.
3. Verify the `i1`-domain HMAC. **Length check before `timingSafeEqual`** — it throws `RangeError` on
   unequal lengths, which would turn a bad signature into a 500 instead of a 403.
4. Reject if `exp < now` → 410 with a human message.
5. Sanitize (`src/lib/sanitize.ts`, pure, zero dependencies): NFC normalise; strip C0/C1 controls
   except `\n`; strip bidi controls `U+200E/200F/202A–202E/2066–2069`; strip zero-widths
   `U+200B–200D/FEFF`; collapse runs of more than two newlines; cap combining-mark runs at 4. Caps
   counted in **graphemes** via `Intl.Segmenter`, not `.length`. Identity fields use the allowlist
   `[\p{L}\p{M}\p{N} .,'’&()\-/+]`. `projectSlug` is an allowlist membership test. Consent must be
   exactly `true`.
6. Mint `id = randomBytes(9).toString('base64url')` — 12 chars, carried in the payload so publishing
   is idempotent.
7. Build the moderation payload, `gzipSync(level 9)`, sign under `m1` with `MOD_SECRET`, assemble the
   URL. **Assert `url.length <= 2400`**, else 413 with "your answers are about N characters too long".
8. Send the notification email with one `fetch` to Resend. **The send is the commit point** — a
   non-2xx returns 503 and the form keeps every typed answer. Because nothing is stored, there is no
   half-succeeded write to reconcile: either the owner has the submission or the submitter still does.

### 7.1 Gzip is what pays for generous field limits

Same fields, same encoding, only the codec differs:

**Measured on the real implementation, 2026-08-28** (the figures in the original design were
optimistic by roughly 4x — they assumed repetitive text, which gzip crushes; distinct prose is
the honest case):

**Shipped figures, measured against the shipped budget of 2400** — these are what
`npm run check:tokens` prints on every run, so they cannot go stale silently:

| Full moderation URL, every answer field at its cap | chars | against the 2400 budget |
|---|---|---|
| Distinct English prose | 1663 | 737 spare |
| **Distinct high-entropy Romanian, absolute legal maximum** — every answer at cap, identity fields at 80, slug at 60 | **1991** | **409 spare** |
| Pathological incompressible random | ~2510 | **~110 over** — the 413 exists for this, and still fires |

The Romanian row is the one that matters: it is the tightest realistic case, and it is the assertion
that must be kept honest if anyone ever raises a cap. Two independent alternate Romanian fixtures at
the same caps measured 1739 and 1835, so genuinely different texts swing about 150–250 characters —
the 409-char cushion is roughly two to four times that. The incompressible row's ~110 is thin in
absolute terms but sits about fifteen times above its own run-to-run variance of ~7 characters,
because random bytes give gzip nothing to exploit differently between runs.

**Then the budget itself turned out to be the mistake.** Lowering `anythingElse` to 550 bought only
18 characters of margin against a high-entropy Romanian fixture — a coin flip, since gzip varies by
a few percent between texts. The right question was not "which cap fits 1900" but "where does 1900
come from". It came from Outlook truncating around 2000 — **and Outlook is not in the delivery path.**
§8 constrains the recipient absolutely: Resend's sandbox sender can only deliver to the Resend
account's own signup address, so the moderation email reaches the owner's Gmail and nothing else,
ever. Gmail and a mobile browser handle URLs many times this size.

`MAX_MODERATION_URL_CHARS` is therefore **2400**, and `anythingElse` stays at **700**. Real prose in
any of the three languages lands near 2050 with roughly 350 characters spare, while pathological
incompressible input still measures around 2555 and still earns the actionable 413. Nobody writing a
real testimonial can be rejected; the guard survives for the case it was actually built for.

**The load-bearing assumption is that the moderation email only ever reaches Gmail.** If the owner
later verifies a sending domain (decision 3's alternative), that changes who receives the *author
receipt*, not the moderation mail — but any change that widens the moderation recipient must revisit
this number. A second, softer assumption: a URL this long exceeds RFC 5322's 998-octet line limit and
survives only because MIME transfer encoding folds it with soft breaks the client removes. That is
not verifiable before the first real send, so §18.4 checks it explicitly.

Two `node:zlib` calls move the worst case from *sitting on the Outlook URL ceiling* to *928 with
generous caps*. Field limits are therefore an editorial choice, not a transport constraint.

---

## 8. Notification email

From `onboarding@resend.dev`. Resend's sandbox sender can only deliver to the Resend account's own
signup address — which is exactly and only the owner's Gmail. **Zero DNS records, permanently.**

Plain text, which deletes the entire HTML-escaping surface. Subject is a static template plus the
author name with CR/LF stripped (header injection).

```
Maria Popescu (QA Lead, TOKERO) — testimonial ready to review
```

Body carries:

- Name, role, company, project.
- Every answer verbatim under its own label, so triage happens on the lock screen with **zero taps**.
- The LinkedIn slug as plain text, verifiable without leaving the mail app.
- Two links: `https://aserban.ro/moderate#a=publish&t=<payload>.<sig>` and `#a=discard&t=…`.
  The intent inside the fragment makes the correct button open as the thumb-height primary.
- One grey line: *"Both links just open the page. Nothing changes until you tap again there."*
- **Two manual fallbacks**: a prefilled GitHub editor URL and a paste-ready JSON block of the exact
  record. These convert `GITHUB_TOKEN` from a hard dependency into a convenience.

---

## 9. Moderation, and the anti-prefetch defence

`https://aserban.ro/moderate` is a statically prerendered, `noindex` page that reads **nothing** from
the URL server-side. `src/app/moderate/page.tsx` is a server component rendering `<ModeratePanel />` and nothing else;
`ModeratePanel` (`'use client'`) reads `location.hash`, gunzips with
`DecompressionStream('gzip')`, and renders the record through **the same `TestimonialCard` the live
site uses** — so what the owner approves is byte-for-byte what ships.

- **Discard calls no endpoint at all.** Rejecting genuinely is doing nothing. The screen says:
  *"Nothing was published. Now delete this email — it is the only remaining copy."* That instruction
  is what makes the retention promise true, and it cannot be forgotten, because no row is left behind
  to forget about.
- **Publish** POSTs `{ t }` to `/api/testimonials/publish`.

### 9.1 Four layers; the owner sees one

1. **No GET in this feature mutates anything.** Microsoft Defender Safe Links GETs every URL at
   mail-flow time *and* again at click time; Gmail prefetch, Proofpoint and Mimecast do the same.
   A one-click GET approve link fires itself.
2. **The capability lives in the fragment, so no scanner can obtain it.** A prefetcher retrieving
   `/moderate` gets a static shell with nothing to act on. This is strictly stronger than "make GET a
   confirmation page": the scanner does not merely decline to act, *it lacks the data*. The same
   choice keeps the token out of Vercel function logs, out of the `Referer` sent to linkedin.com when
   the owner taps through to verify a profile, and out of the `<Analytics/>` pageview payload —
   which fires on this route, because `<Analytics/>` sits in `RootLayout` (`layout.tsx:205`). That
   last point is also why §13.3 discloses the visit counter to the submitter rather than claiming
   nothing is recorded — do not "simplify" that line back.
3. **The mutation is a POST with a hardcoded `Origin` check.**
4. **Detection and reversibility rather than more prevention.** A pull request appears, a Vercel
   preview renders it, and nothing reaches production without a second deliberate act.

**Explicitly refused:** a typed `MOD_SECRET` (a 12-character string to be typed on a phone for every
approval, forever, and still known in 2029) and an 800 ms `isTrusted` gesture gate — Playwright and
Puppeteer dispatch CDP clicks carrying `isTrusted: true`, so it is friction dressed as a layer.

---

## 10. Publishing: branch, commit, pull request

`POST /api/testimonials/publish` — `src/app/api/testimonials/publish/route.ts`.

1. `Origin` check.
2. Verify the `m1` HMAC, gunzip, and **re-validate every field server-side**. A valid signature
   proves *we* produced the payload, not that it is still well-formed.
3. `GET /repos/seradi96/qa-portfolio/contents/src/content/testimonials.json?ref=main` for
   `{ content, sha }`.
4. **Idempotency, in two places.** If `id` is already present in `main`, return 200 `{ already: true }`
   and stop. Otherwise, if the branch `testimonial/<id>` already exists, return the existing pull
   request rather than creating a second one.
5. Append, sort newest-first, `JSON.stringify(arr, null, 2) + '\n'`. The file is machine-written,
   never string-templated, so injection into the data file is structurally impossible.
6. `POST /repos/.../git/refs` to create `refs/heads/testimonial/<id>` from `main`'s head SHA.
7. `PUT .../contents/...` on that branch with the base `sha`; retry once on 409.
8. `POST /repos/.../pulls` — title `Testimonial: <name> (<company>)`, body containing the rendered
   answers and the LinkedIn URL, base `main`, head `testimonial/<id>`.
9. Return the pull request URL.

**Why a pull request rather than a commit to `main`.** A pull request buys review, not credential
containment. The PAT needs `Contents: Read & Write`, and that reaches `main` whichever target the
code writes to — fine-grained PAT permissions are repository-scoped, with no per-branch grant. No
branch rule closes the gap either: a rule weak enough to let the owner merge his own pull request
(0 required approvals) also lets a leaked token open one and immediately merge it via the API, and a
rule strong enough to stop the token (required approvals, code-owner review) stops the solo owner
too — while adding him as a bypass actor exempts his PAT with him, since a fine-grained PAT acts as
the user.

What the branch **does** buy is that every *application-initiated* wrong write — a replayed
moderation token, a mis-signed payload, a bug in `publish-to-git.ts` — lands as an unmerged pull
request with its own preview instead of on production. That is the realistic failure mode, and the
cost of containing it is one tap.

The compensation is larger than the cost: **the pull request gets its own Vercel preview deployment**,
so the owner sees the real card on a real build of the real site before anything reaches production.
That is a better review surface than the moderation page's preview, and it is free.

Fine-grained PAT, scoped to this one repository, **Contents: Read & Write** and **Pull requests:
Read & Write**, nothing else, Production environment only, never logged.

Branch naming: `testimonial/<id>`, one branch per submission, so two pending testimonials cannot
conflict. base64url ids cannot produce `..` or a trailing `.lock`, so every id yields a valid ref.

### 10.1 Publish-screen copy

- Success: *"Pull request opened. Review it, merge it, and it is live about 90 seconds later.
  [Open the pull request →]"*, plus a copy-button block containing the ready-to-send LinkedIn
  follow-up to the author.
- Re-tap: *"Already published — it's on the site. [See it →]"* or *"Pull request already open.
  [Open it →]"*. Never an error, never a duplicate. **No relative time in either string**: step 4's
  idempotency check reads only whether `id` is present in `main`, and neither the record nor the
  response stores when the merge happened.

---

## 11. How data reaches the page

`src/app/page.tsx` **stays `'use client'` and is never restructured.** One import beside the existing
`@/lib/career` import on line 6:

```tsx
import { TESTIMONIALS } from '@/lib/testimonials'
```

Turbopack resolves the JSON at build time. **Verified by build probe on 2026-08-28**: a
`resolveJsonModule` import reaching a module imported by the `'use client'` `page.tsx` compiles, `/`
stays `○ (Static)`, and the content appears in the prerendered HTML. One consequence the probe
surfaced and the design accepts: because `page.tsx` is a client component, the same JSON is **also**
emitted into `.next/static/chunks/`, so every testimonial ships twice. At 10–20 records that is a few
KB, and it is the price of not restructuring `page.tsx`.

The route `/` stays `○ (Static)`, and testimonial text lands in
`.next/server/app/index.html` exactly like the project copy does today — visible to Google and to the
LLM assistants hiring managers increasingly arrive through, which is the entire reason the section
exists. A `useEffect` fetch would put the credibility payload in the one place its audience cannot see.

**Updating after approval:** merging the pull request pushes to `main`; Vercel auto-deploys; live in
about 90 seconds. The identical mechanism that publishes every other word on this site.

No `revalidatePath`, no `revalidateTag` (which in Next 16 requires a second argument and is a TS2554
build failure written from Next 15 muscle memory), no `updateTag`/`refresh` (which throw inside route
handlers), no `cacheComponents`, no `'use cache'` (hard-blocked; enabling the flag would remove
`dynamic`/`revalidate`/`fetchCache` app-wide and force-enable PPR). There is no cache-invalidation
primitive anywhere, so there is no "revalidate fired, cache says MISS, and yet nothing changed" class
of silent failure.

### 11.1 Launch-day empty state

The section **and both nav entries** render only when `TESTIMONIALS.length > 0`. Before the first
approval the site is byte-identical to today: no "Testimonials" nav link pointing at an empty grid,
no placeholder advertising the absence. The feature ships dark and lights itself up on the first merge.

---

## 12. Section and card

```
<section id="testimonials" className="py-20 px-6">   // NO background tint:
                                                     // Projects (843) is bg-black/20,
                                                     // Architecture (1112) is bg-black/10
```

Card classes are **defined now** in `globals.css` under `@layer components`, which retires Task 1
Step 1 of the pending card-surface plan instead of adding to it:

```css
.card-surface { @apply relative rounded-2xl border border-white/[0.08]
  bg-gradient-to-b from-white/[0.06] to-white/[0.03]
  transition-all duration-200 ease-out; }
.card-surface-interactive { @apply hover:border-amber-400/30
  hover:from-white/[0.08] hover:to-white/[0.04]
  hover:shadow-xl hover:shadow-amber-500/10; }
```

plus, scoped to these two classes only — never a global `* { transition: none }`, which would reach
the existing nav and filter chips:

```css
@media (prefers-reduced-motion: reduce) {
  .card-surface, .card-surface-interactive { transition: none; }
}
```

Card contents, in this order — **the hierarchy is the design**:

1. An amber SVG quote glyph. No emoji. Note that the card-surface plan's Task 9 gate greps only
   `src/app/page.tsx`, for five specific emoji — it does not cover new component files, so this is a
   convention here, not an enforced check.
2. The `hiringManager` answer as the pull quote — `text-lg text-gray-200`, `dir="auto"`.
3. **`whatChanged` visible under its own small label.** The number is the evidence; the endorsement
   is only the endorsement. Collapsing the concrete before-and-after while promoting the softest
   answer is the mistake this ordering exists to prevent.
4. `whatIDid` and `anythingElse` inside a native `<details>` labelled "Read the rest" — zero JS,
   keyboard-accessible, `focus:ring-2 focus:ring-amber-500` on the `<summary>`.

Attribution: name in `text-amber-300 font-semibold`, then `{role}, {company}` with a quiet "at the
time" qualifier — role and company *as at the collaboration* never go stale when someone changes
jobs, never need re-confirmation, and read as historical context rather than a current corporate
endorsement. **Every optional block is omitted entirely — label included — when its answer is empty after trim,
and the `<details>` is not rendered at all when both `whatIDid` and `anythingElse` are empty.** A card
carrying only the pull quote and the attribution is a valid, complete card — and it is the most
likely shape of the very first real testimonial, since only one answer is required.

Project chip reuses the existing `bg-amber-500/20 text-amber-300 px-2 py-1 rounded text-xs
font-medium` badge (`page.tsx:1007`). "Verify on LinkedIn" reuses the Contact section's 24×24 SVG path, with
`target="_blank" rel="noopener noreferrer"`.

Amber accent only, never as a card fill. **No cyan** — reserved for AI content.
**No `animate-ping/bounce/spin`**, no decorative `animate-pulse`.
**No employer logos, ever** — naming a company is descriptive context; reproducing its mark beside
praise is the thing that actually reads as a claimed affiliation.

### 12.1 No schema.org `Review` JSON-LD

Three independent reasons, any one sufficient:

- `Person` has neither a `review` nor an `aggregateRating` property, and `Person` is not in Google's
  supported `itemReviewed` list. The rich-result upside is exactly zero.
- Self-serving reviews are explicitly ineligible for the star feature.
- `layout.tsx` renders JSON-LD through `dangerouslySetInnerHTML` with plain `JSON.stringify`, which
  **does not escape `<`**. Feeding third-party text into it would turn a `</script>` in someone's
  free text into stored XSS on every load of the site root.

One unrelated and free JSON-LD fix is made: add `"@id": "https://aserban.ro/#person"` to
`personJsonLd`, because `layout.tsx:180` already references an identifier defined nowhere.

---

## 13. Microcopy

All hardcoded JSX copy must be written with `&apos;` / `&quot;` — `react/no-unescaped-entities` is an
**error** in this repo and `npm run build` runs the type check, so one stray apostrophe fails the
deploy. Testimonial bodies rendered as `{expressions}` are unaffected.

### 13.1 Form

**Intro, above the fields:**
> Andrei wrote: *"{invite message from the token}"*
>
> Four questions, the last one open-ended. Five to ten minutes. It saves as you type, so you can stop
> and come back.

**Identity block header:** `Not right? Fix anything here.` (fields arrive prefilled)

**Which project did we work on together?** — `<select>`, preselected from the invite; the four
project labels plus "Something else we worked on". This one control satisfies both the guided prompt
and the project link.

**What was I actually doing on the team?** *(optional, 300)*
Help: `One line is plenty — how you'd describe my job to someone who wasn't there.`
Placeholder: `He owned the end-to-end suite and was the person we pinged when a pipeline went red at 6pm.`

**What changed because of it?** *(optional, 400)*
Help: `The concrete bit. A number if you have one; if you don't, just what got easier, faster, or less painful.`
Placeholder: `Regression used to eat two days of manual clicking. After his framework landed it ran overnight and we stopped shipping on Fridays with our fingers crossed.`

**What would you tell a hiring manager who asked about him?** *(required — the only required field, 400)*
Help: `The honest version, caveats included. This is the one people actually read.`
Placeholder: `I'd work with him again. He'll push back if he thinks the plan is wrong, which is exactly what you want in a QA lead.`

**Anything else?** *(optional, 700)*
Help: `A story, a moment, something the questions above missed. Skip it if nothing comes to mind.`

The placeholders are load-bearing, not decoration. The failure mode of a testimonials section is not
bad data, it is "He was great to work with" — and a worked example is the only thing that reliably
prevents it. Only the fourth question is required and its only rule is "not empty after trim": no
minimum length, no nagging validator. A four-word answer is a moderation decision, not a machine's
business.

**Mobile:** real `<label for>` throughout; `autocomplete="name" | "organization-title" |
"organization"`; `autocapitalize="sentences" autocorrect="on" spellcheck="true"` on textareas;
`enterkeyhint="done"` on the last; `field-sizing: content`; **no `maxLength` attribute** that
silently swallows characters — a soft counter that fades in at 85% instead;
`focus:outline-none focus:ring-2 focus:ring-amber-500` on every control. Autosave to
`localStorage['testimonial:' + <first 8 chars of the fragment's payload segment, i.e. everything
before the '.'>]` on a 400 ms debounce, wrapped in `try/catch` (private-mode
Safari throws), with a restore bar: `Picked up where you left off. [Start fresh]`.

### 13.2 Consent checkbox — unchecked, required, immediately above the button

> I'm happy for Andrei to publish this on aserban.ro with my name, my role and company at the time we
> worked together, and my LinkedIn link. I understand the site's source code is public on GitHub, so a
> published testimonial becomes part of its history. He can fix a typo or trim for length, never change
> what I meant. I can have it taken down any time by emailing andre.serban96@gmail.com.

### 13.3 Privacy note — always visible under the checkbox, not behind a disclosure

> **Who's asking** — Andrei Șerban, Iași, Romania, andre.serban96@gmail.com. This site is personal;
> there is no company behind it.
>
> **What gets published** — your name, your role and company at the time we worked together, your
> LinkedIn link, and your answers above. Nothing else.
>
> **What I don't collect** — I'm not asking for your email, and I don't record your IP address. The
> site uses Vercel's cookie-free visit counter, which logs that a page was opened, from which country,
> and on what kind of browser and device — never who you are.
>
> **Why I'm allowed to** — because you're saying yes, and for no other reason. Saying no costs you
> nothing.
>
> **Where it lives** — until you approve nothing is stored anywhere; your submission arrives in my
> personal Gmail so I can read it. If I publish it, it goes into this site's public repository. If I
> don't, I delete the email and nothing remains.
>
> **Your say** — ask me to correct it or take it down, any time, no reason needed; normally the same
> day. If you think I've handled this badly you can complain to ANSPDCP (dataprotection.ro).

### 13.4 Thank-you screen

> **Sent. Thank you — genuinely.**
>
> *(everything they wrote, rendered back verbatim under the same labels)*
>
> Andrei reads these himself, usually within a day. Nothing goes public until he approves it.
>
> Spotted a typo? This link stays open — just come back to it.
>
> Changed your mind later? Write to andre.serban96@gmail.com and it comes down. No explanation needed.

### 13.5 The invite — paste into a LinkedIn DM

> Hi [Name],
>
> I'm adding a short testimonials section to my portfolio (aserban.ro) and I'd love to include
> something from you about [project] — if you're up for it.
>
> The link below is just for you. Four short questions, the last one open-ended; five to ten minutes,
> and it works fine on a phone. It opens already filled in with your name and role, so mostly you're
> proof-reading.
>
> What would appear on the site: your name, your role and company at the time we worked together, a
> link to your LinkedIn, and what you write. Nothing else. Nothing goes live until I've read it, and
> you can have it taken down later at any point.
>
> Two honest asks: keep it to things that are fine to say publicly — no internal detail — and do check
> your employer is comfortable with it, since some companies have rules about giving references.
>
> And genuinely, no pressure. If it's a bad time or just not your thing, ignore this and nothing
> changes between us.
>
> [link] — it expires in 45 days, tell me if you'd like a fresh one.
>
> Thanks either way,
> Andrei

The employer-policy line is not padding: a colleague publicly praising you while their employer
forbids outside references is a risk you created for them.

### 13.6 Public section footer, under the grid

> **How this section works** — I invite people by private link, one at a time, and only people I've
> actually worked with; there's no open form, so every name here is someone I can point to a project
> with. I read submissions before they go up and may fix a typo or trim for length, never change what
> someone meant.
>
> These are personal comments from people I worked with directly, written in a personal capacity.
> Company names say where we worked together — they are not endorsements by those companies, and
> nobody quoted here is speaking for their employer.
>
> [Are you quoted here and want it removed?](mailto:andre.serban96@gmail.com)

That first paragraph is the sentence that answers the hiring manager's unspoken *"did he write these
himself?"* — it converts the invite-only gate from a limitation into the credibility asset it is.

---

## 14. Anti-abuse: what is built, and what is refused

**Built:** hand-minted invites, 45-day expiry, `Origin` pinning, 16 KB body cap, grapheme caps,
allowlists, the 1900-character URL assert, Resend's 100/day ceiling as a natural backstop, and secret
rotation as the panic button.

**Refused, deliberately:** CAPTCHA, bot detection, per-IP rate limiting, proof-of-work, IP logging.
A module-scoped `Map` throttle is *omitted rather than shipped* — on Vercel it resets every cold start
and is not shared across concurrent lambdas, so it is theatre that reads as protection. IP logging is
refused positively: it adds a personal-data category (CJEU *Breyer*) with a retention duty, in
exchange for a control the invite link already provides.

---

## 15. Residual risks — accepted, not solved

- **Approved testimonials enter permanent public git history.** Deleting an entry removes it from the
  live site in ~90 seconds but not from history; true Article 17 erasure needs `git filter-repo` and a
  force-push, documented as a rare manual runbook step. **This is the real price of the design.** It
  applies only to content the author consented to publish under their own name with a LinkedIn link,
  and the consent copy discloses it verbatim, which is what keeps the consent informed. Pending and
  rejected text never touches git at all.
- **Invite tokens are replayable within their window and cannot be individually revoked.** No
  used-token set exists, because that is state. Blast radius is noise in the owner's own inbox —
  nothing publishes without a separately signed tap plus a merge. Emergency revoke is rotating
  `INVITE_SECRET` plus a redeploy, which kills all outstanding invites at once.
- **A rejected submission's publish link stays live for the life of the moderation token.** Rejection
  writes nothing, so nothing can later refuse a replay. Mitigated by the discard screen's single
  instruction, the fragment (no scanner can obtain the token), and the fact that a replay produces a
  pull request, not a live change.
- **`GITHUB_TOKEN` can write to any branch of this repository, `main` included, and open pull
  requests.** Decision 2 keeps every write *this application performs* off `main`, so the routine
  failure — a replayed publish link — costs an unwanted pull request, which is visible and closable.
  It does **not** contain a leaked token: that remains a site takeover, and is accepted rather than
  solved, because every control that would prevent it also breaks the one-handed mobile merge the
  moderation flow rests on. Mitigation is containment and speed of recovery, not prevention:
  server-side only, Production environment only, this repository only, never logged, greppable by
  `npm run postbuild`, and revocable in minutes. Note also that anyone holding the Vercel deployment
  credentials can already publish to aserban.ro without this token at all; what the token adds on top
  is persistent write access to the repository.
- **No rate limiting of any kind.** Accepted at ~15 lifetime submissions.
- **The moderation email is the only copy of a pending submission.** Lose it to spam and the colleague
  must resubmit from the same still-valid invite link. The Gmail filter is a mandatory setup step, not
  a suggestion.
- **The moderate page requires JavaScript and `DecompressionStream`** (Chrome 80+, Safari 16.4+,
  Firefox 113+). One known user, his own phone, with two manual fallbacks in the email itself.
- **A forwarded invite lets a non-invitee submit under a name and slug of their choosing**, including a
  plausible impersonation. Nothing is public before approval; the owner reads the full text and the
  attribution model exists precisely so he verifies against the real LinkedIn profile during review.
- **Adding route handlers permanently forecloses `output: 'export'`.** Irrelevant on Vercel; a door
  closing.
- **`PROJECT_LABELS` is a second place project identity lives, and the nav label now lives in two
  places** (desktop 371, mobile 411). Both drift silently. Documented in CLAUDE.md, not engineered away.

---

## 16. File-by-file changes

### New

| File | Purpose |
|---|---|
| `src/content/testimonials.json` | The published store; starts as `[]` |
| `src/lib/testimonials.ts` | `Testimonial` type, validate-and-drop loader, exports `TESTIMONIALS` |
| `src/lib/projects-meta.ts` | `PROJECT_SLUGS`, `ProjectSlug`, `PROJECT_LABELS` — the single slug allowlist |
| `src/lib/consent.ts` | `CONSENT_VERSION` + `CONSENT_TEXT_V1` verbatim |
| `src/lib/token-types.ts` | Isomorphic and pure: the `U+001F` field codec, base64url, `InviteFields`/`TestimonialRecord`. No node builtins, no secrets |
| `src/lib/token.ts` | **Server only.** gzip + HMAC sign/verify with `i1`/`m1` domain tags, length-guarded `timingSafeEqual`, hardcoded `SITE_ORIGIN`, module-load secret-length assertion, `typeof window` throw |
| `src/lib/token-client.ts` | **Client safe.** Unverified decode for the two pages that must read a fragment in the browser; gunzip via `DecompressionStream`. Holds no secret and checks no signature |
| `src/lib/sanitize.ts` | NFC, control/bidi/zero-width stripping, `Intl.Segmenter` grapheme caps, identity allowlist, LinkedIn-slug extraction. Pure, zero deps, no secrets |
| `src/lib/notify.ts` | `sendModerationEmail` via raw `fetch` to Resend; plain text; CR/LF stripped from subject inputs |
| `src/lib/publish-to-git.ts` | GitHub API: read `main`, create `testimonial/<id>`, PUT file, open pull request; idempotent by `id`; one retry on 409 |
| `src/components/TestimonialCard.tsx` | The one card, shared by the public section and the moderation preview |
| `src/components/TestimonialsSection.tsx` | Section shell, grid, footer copy; renders nothing when the list is empty |
| `src/app/invite/page.tsx` | `'use client'`; reads the fragment, decodes prefill, shows expiry before the form |
| `src/app/invite/layout.tsx` | 4-line server layout, `metadata.robots = { index: false, follow: false }` |
| `src/app/invite/TestimonialForm.tsx` | Prefill, autosave, soft counters, mobile keyboard attributes, consent |
| `src/app/moderate/page.tsx` | Server component; renders `<ModeratePanel />` and nothing else |
| `src/app/moderate/ModeratePanel.tsx` | `'use client'`; reads the fragment, gunzips, renders `TestimonialCard`, Publish / Discard |
| `src/app/moderate/layout.tsx` | 4-line server layout, noindex |
| `src/app/api/testimonials/submit/route.ts` | Verify invite, sanitize, assert URL length, send the notification |
| `src/app/api/testimonials/publish/route.ts` | Origin check, verify `m1`, re-validate, idempotent branch + commit + pull request |
| `src/app/robots.ts` | Allow `/`, disallow `/invite` and `/moderate` |
| `scripts/invite.mjs` | Mints an invite URL and a paste-ready DM from `.env.local` |
| `scripts/token-roundtrip.mjs` | `npm run check:tokens` — the real test suite |
| `scripts/postbuild-check.mjs` | `npm run postbuild` — static-route and secret-leak gates |
| `.env.local.example` | Documents the four env vars. **`.gitignore:34` is the bare pattern `.env*`, which matches this file too** — it cannot be committed until `.gitignore` gains the negation below |
| `docs/testimonials-runbook.md` | Env vars, secret rotation (including `GITHUB_TOKEN` revoke-and-reissue, the panic button for a leaked write token), the Gmail filter, manual publish, removal on request, the rare `filter-repo` erasure path |

### Modified

| File | Change |
|---|---|
| `src/app/page.tsx` | +1 import at line 6; `<TestimonialsSection />` into the blank line **1110**; nav entry after **371** (desktop) and **411** (mobile), both gated on `TESTIMONIALS.length > 0`, classNames copied verbatim; `slug: '…' satisfies ProjectSlug` on the four project entries and the grid key off `findIndex(title)`. **Stays `'use client'`. No rename.** |
| `src/app/globals.css` | `@layer components { .card-surface, .card-surface-interactive }` + `prefers-reduced-motion` guard — retires Task 1 of the card-surface plan |
| `src/app/layout.tsx` | One line: `"@id": "https://aserban.ro/#person"` in `personJsonLd` |
| `package.json` | Scripts: `invite`, `check:tokens`, `postbuild`. **No new dependencies.** |
| `.gitignore` | Add `!.env.local.example` immediately after line 34 (`.env*`). Without it `git add -A` skips the file silently and an explicit `git add` fails outright. The negation un-ignores only the example; real `.env.local` stays ignored |
| `tsconfig.json` | Add `allowImportingTsExtensions: true` after line 16. Verified on Node 24.5.0: Node's ESM resolver does no extension resolution, so `check:tokens` can only load a `.ts` module by its explicit `.ts` specifier, and tsc rejects that spelling (TS5097) without this flag. It requires `noEmit`, already set at line 12 |
| `eslint.config.mjs` | Add `scripts/**` to `ignores` (commit 5). **Cosmetic only** — ESLint 9 lints `scripts/**/*.mjs` by default and reports `@typescript-eslint/no-unused-vars` there as a *warning*, so `npm run lint` exits 0 either way |
| `CLAUDE.md` | Second content source; nav labels in two places; the four env vars; `cacheComponents` deliberately off and `'use cache'` unavailable; never `runtime = 'edge'`; `output: 'export'` foreclosed; no `Review` JSON-LD, with the reason; correct the Tailwind row (says 4.1.18, installed is 4.3.0) |
| `docs/superpowers/plans/2026-06-27-card-surface-system.md` | Re-anchor Tasks 5–8 to grep patterns instead of line numbers — 28 `page.tsx` references, already ~50 lines stale and ~200 after this insertion; mark Task 1 done |

**Refinement discovered during planning.** §16 originally listed a single `src/lib/token.ts`. It cannot
be one module: `token.ts` is server-only and throws in a browser, yet both `/invite` (to prefill the
form) and `/moderate` (to render the preview) must decode a fragment client-side. Splitting it three
ways keeps the server crypto unreachable from the client bundle while letting both pages decode
*without* a secret — verification stays server-side, where the secret is.

### Environment variables (Vercel, Production only)

| Name | Purpose |
|---|---|
| `INVITE_SECRET` | HMAC key for `i1` invite tokens |
| `MOD_SECRET` | HMAC key for `m1` moderation tokens |
| `RESEND_API_KEY` | Notification email |
| `GITHUB_TOKEN` | Fine-grained PAT: Contents R/W + Pull requests R/W, this repo only |

---

## 17. Build order — five commits, each green on `npm run build` + `npm run lint`

1. **Primitives, no UI** (~2 h): `token.ts`, `sanitize.ts`, `projects-meta.ts`, `consent.ts`,
   `scripts/invite.mjs`, `scripts/token-roundtrip.mjs`. Run `npm run check:tokens` before anything
   else exists — the highest-value hour in the feature.
2. **Read path** (~3 h): `testimonials.json`, `testimonials.ts`, `TestimonialCard`,
   `TestimonialsSection`, the `globals.css` classes, the `page.tsx` import + section + two nav
   entries, the `layout.tsx` `@id` fix. Hand-write one fake record to see it render, delete it,
   confirm the empty-state gate works.
3. **Write path** (~3.5 h): `notify.ts`, `publish-to-git.ts`, both route handlers, `robots.ts`.
4. **Human surfaces** (~4 h): `/invite` page and form — where the time actually goes and where the
   value is — and the `/moderate` panel. Copy from §13 goes in verbatim.
5. **Guards and docs** (~1.5 h): `postbuild-check.mjs`, CLAUDE.md, the runbook, the card-surface plan
   re-anchoring. Then the four Vercel env vars and one full live rehearsal.

Roughly 1.5 focused days, ~14 h, **zero new npm dependencies**.

---

## 18. Verification

The repo's gate is `npm run build` + `npm run lint`. That gate covers less than half of what matters
here, so two things are added to it and the rest is a written manual checklist.

### 18.1 What the existing gate already proves

TypeScript compiles, including the JSON import shape and the `satisfies ProjectSlug` drift check on
`projects[]`. `react/no-unescaped-entities` catches a stray apostrophe in the prose-heavy new copy
before deploy. **Nothing else.** It cannot tell you a signature verifies, an email arrives, or a URL
fits.

### 18.2 `npm run check:tokens` — the only real test in the feature

`scripts/token-roundtrip.mjs`, ~40 lines, zero dependencies:

1. **Round trip:** build → gzip → base64url → sign → verify → gunzip → decode; assert deep equality.
2. **Tamper must fail:** flip one payload byte, assert verify returns null.
3. **Wrong domain must fail:** sign under `i1`, verify under `m1`, assert null.
4. **Empty secret must throw.** `createHmac('sha256','')` returns a valid digest rather than throwing,
   so this assertion is the only thing standing between a blank Vercel env var and every token being
   forgeable on a public repo.
5. **Length mismatch must return 403, not 500:** pass a wrong-length signature, assert no `RangeError`
   escapes.
6. **URL budget:** three assertions, not one. Distinct English prose at every cap must fit. **Distinct
   high-entropy Romanian at the ABSOLUTE legal maximum** - every answer at its cap, name/role/company
   each at 80 graphemes, a 60-character percent-encoded slug - must fit; that is the case that
   overflowed the original budget, and Romanian is what many real submitters will write. And the
   pathological incompressible payload must still overflow, because the 413 has to keep working.
   Measured today: English ~1750, Romanian maximum ~2050 against the 2400 budget, incompressible
   ~2555. Print all three with their spare headroom, so anyone raising a cap sees which case is
   closest to the edge.

### 18.3 `npm run postbuild`, wired into `npm run build`

1. Read `.next/prerender-manifest.json` and assert `Object.keys(routes)` includes `'/'`; fail
   otherwise. Belt and braces, also assert `.next/server/app/index.html` exists. **This is the
   regression test proving the home page stayed static** — SEO visibility and TTFB both rest on it.
   Verified against the current build: `routes` is `['/', '/_global-error', '/_not-found',
   '/favicon.ico']`, and a `/` that turns dynamic drops out of that map. Do **not** assert on the
   `○ /` vs `ƒ /` route table: it exists only as `next build`'s terminal stdout, and a `postbuild`
   npm hook runs in a separate process after that output is gone. Do **not** use
   `.next/routes-manifest.json` either — it lists `/` under `staticRoutes` either way, because that
   field means "no dynamic segments", not "statically rendered".
2. Grep `.next/static` and `.next/server/app` for each secret's literal value; fail on any hit. Also
   grep `src/` for any new `NEXT_PUBLIC_` occurrence.
3. When `testimonials.json` is non-empty, grep `.next/server/app/index.html` for the newest author
   name and fail if absent — proving the content reached the prerendered HTML rather than only the
   client bundle.

### 18.4 Manual checklist — once, end to end, against an invite minted to himself, before any real colleague sees a link

1. Mint an invite; confirm the pasted DM reads like a human wrote it and the URL is short enough not
   to look like phishing (~229 chars).
2. Open it **on the phone**, not the laptop. Prefill correct, keyboard offers real autocomplete
   values, textareas grow, counter behaves, autosave survives backgrounding the browser and returning.
3. Submit; the thank-you screen shows the answers back verbatim.
4. The email **arrives in the inbox, not Promotions or Spam**, and the whole submission is readable in
   the body without tapping anything. Set the Gmail filter now. **Also confirm the moderation links
   survived transit**: at roughly 2000 characters they exceed RFC 5322's 998-octet line limit, and
   they arrive intact only because MIME transfer encoding folds them with soft breaks the client
   removes. Tap the link, never retype it, and confirm the page decodes the record instead of
   reporting a malformed fragment. This is the one assumption in the design that cannot be verified
   before a real send - and if it fails, the email's two manual fallbacks are how you publish anyway.
5. Tap Discard on one submission; nothing was written anywhere, and "delete this email" is the only
   thing on screen.
6. Submit again; tap Publish. `DecompressionStream` works in his actual browser, the preview card is
   identical to the live card, the pull request opens, the Vercel preview renders it, the merge
   deploys, and the section appears within ~90 seconds.
7. Tap the same Publish link a second time; "Pull request already open", not an error and not a
   duplicate. Merge, then tap a third time; "Already published".
8. Open an expired invite (mint one with `exp` in the past); the friendly expiry message renders
   **before** the form.
9. Deploy a preview branch and attempt a submit from it; the `Origin` check fails it closed.
10. Click "Verify on LinkedIn" on the published card and confirm it resolves to the real profile. The
    slug regex accepts percent-encoded characters and this site's own slug is
    `%C8%99erban-andrei-5a14a51a5`, so this is a genuine failure mode.
11. Read the published card as a hostile stranger. Is the concrete before-and-after visible without
    expanding anything? Does the attribution look verifiable rather than self-written? That judgement
    is the entire point of the feature and no script can make it.
12. Delete the record from `testimonials.json` in GitHub's mobile editor; the section disappears and,
    when it is the last one, so do both nav entries.

Items 4, 6, 10 and 11 are the ones that will actually bite, and none is automatable.

---

## 19. Alternatives considered and rejected

**Vouch — Neon Postgres with a server-component split.** One table in eu-central-1, opaque 256-bit
tokens stored as SHA-256, real revocation, an invite link that stays open so a colleague can fix their
own typo, receipt and publication emails to the author, a bookmarkable moderation queue. The best
human experience of the three, and the only design where declining actually destroys both the
capability and the content. **Rejected** because it puts a third party in the read path of the site's
credibility section, with a fail-soft to `[]` that silently deletes the section and both nav entries
for up to an hour if the database is cold during a build — plus a hand-applied 26-column schema with
no migration tool, retention `DELETE`s run by hand "about once a year" (which at three submissions a
year means never, breaking the GDPR promise used to justify the database), four DNS records, five
environment variables, and a `git mv` that invalidates 28 card-surface-plan references.

**Paper Trail — the same JSON-in-git spine, more machinery.** Two secrets with a `_PREV` rotation
overlap, a dedicated preview endpoint so the phone does no crypto, three-tap approve, six environment
variables, 29 files. Its verification discipline is the best of the three and four of its ideas are
grafted into the recommendation: the shared card component, the manual email fallbacks, the
publish-confirmation tripwire, and gzip. **Rejected** because it is the recommendation plus roughly
40% more machinery for an identical outcome — the preview endpoint defends a non-problem, and
`INVITE_SECRET_PREV` is a permanently empty variable for a rotation that will never happen.
