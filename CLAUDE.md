# CLAUDE.md

Guidance for Claude Code when working in this QA Automation portfolio repository.

## Project Overview

Single-page portfolio site for a Senior QA Automation Engineer / Test Architect, deployed at **aserban.ro**. Audience: hiring managers, QA professionals, potential collaborators.

**Stack** (keep versions accurate here — this file has drifted before):

| | |
|---|---|
| Next.js | 16.2.6 — App Router, Turbopack |
| React | 19.2.6 |
| TypeScript | 5.9 — strict mode, `@/*` → `./src/*` |
| Tailwind CSS | 4.3.0 — **CSS-first, no `tailwind.config.js`** |
| Heroicons | 2.2.0 |
| Analytics | `@vercel/analytics` 2.x |
| ESLint | 9.x — flat config |

## Essential Commands

```bash
npm run dev          # Dev server (Turbopack) at http://localhost:3000
npm run build        # Production build — also runs the TypeScript check
npm run start        # Serve the production build
npm run lint         # ESLint (flat config); must exit 0
npm run lint:fix     # Auto-fix

rm -rf .next && npm run dev    # Clear cache when the build acts stale

npm run check:tokens # Token codec, HMAC, sanitisation and admin-session assertions
npm run postbuild    # Static-route / secret-leak / content gates (npm runs it after `build`)
npm run invite       # Mint a testimonial invite link + paste-ready DM (needs .env.local)
```

**`.env.local` must exist before `npm run build` works — a fresh clone cannot build.** Three
module-scope assertions see to it: `src/lib/token.ts` asserts `INVITE_SECRET` and `MOD_SECRET`,
and `src/lib/admin-auth.ts` asserts `ADMIN_PASSWORD` (minimum 24 characters) the same way. `next
build` evaluates route-handler modules during "Collecting page data", so the moment a route imports
either file the build needs all three. No `.env.local` means:

```
Error: INVITE_SECRET is missing, empty, or shorter than 32 characters...
Error: Failed to collect page data for /api/testimonials/submit
```

This is deliberate — a misconfigured Vercel deploy should fail loudly at build, not ship a broken
feature silently. Fix: `cp .env.local.example .env.local` and fill in real values (§1 of
`docs/testimonials-runbook.md`). **Unsetting shell env vars does not reproduce this** — Next loads
`.env.local` itself regardless of the shell environment, so the file has to be missing or renamed,
not just unexported. Confirmed twice during Task 10; both times the first diagnosis (blaming the
shell) was wrong.

The verification gate is `npm run build` + `npm run lint`, plus `npm run check:tokens` — the one executable test suite in the repo, covering the testimonial token codec, HMAC verification, sanitisation and the admin session cookie. `npm run build` also fires `npm run postbuild`, which fails the build if the home page stopped being statically prerendered or a secret reached the bundle. There is no component or e2e harness. For visual changes, eyeball `npm run dev`.

## Architecture

```
qa-portfolio/
├── src/
│   ├── app/
│   │   ├── page.tsx        # ~1790 lines — the entire site, one 'use client' component
│   │   ├── layout.tsx      # Metadata, OG/Twitter, JSON-LD, fonts, <Analytics/>
│   │   ├── globals.css     # @import "tailwindcss", global rules, .card-surface classes
│   │   ├── favicon.ico
│   │   ├── invite/         # Testimonial invite form (noindex, 'use client')
│   │   ├── admin/          # Pending queue + password login (noindex, server component)
│   │   ├── api/testimonials/submit/route.ts
│   │   ├── api/admin/{login,publish,reject}/route.ts
│   │   └── robots.ts
│   ├── components/         # TestimonialCard, TestimonialsSection
│   ├── content/
│   │   └── testimonials.json   # The published testimonial store — second content source
│   └── lib/
│       ├── career.ts       # Career start dates + getYearsSince()
│       └── …               # token*, sanitize, consent, projects-meta, testimonials,
│                           #   admin-auth, pending-store, publish-to-git
├── scripts/                # invite.mjs, token-roundtrip.mjs, postbuild-check.mjs
├── docs/superpowers/       # Design specs and implementation plans (in-flight work)
├── docs/testimonials-runbook.md   # Operating the testimonials feature — read before touching it
├── public/                 # Static SVGs (default CRA-style assets, mostly unused)
├── eslint.config.mjs       # Flat config, native eslint-config-next imports
├── postcss.config.mjs      # @tailwindcss/postcss only
├── next.config.js          # Intentionally empty
└── CLAUDE.md
```

`page.tsx` sections in order: Nav → Hero → About → KPI Metrics → Quote → Key Wins → Projects → Architecture & Approach → Skills → Certifications → Contact → Footer → Back-to-top.

## Content Model

Content lives in **two** places: `src/app/page.tsx` as plain arrays/objects above the JSX, and `src/content/testimonials.json`, the published testimonial store. There is no CMS and no data fetching — the JSON is a build-time import.

- **`testimonials.json`** — written by merging the pull request that `/api/admin/publish` opens; hand-edit it only to correct or remove a record. `src/lib/testimonials.ts` validates on import and **drops** malformed records silently, so a bad edit makes a testimonial vanish rather than fail the build. Operating instructions: `docs/testimonials-runbook.md`.

- **`projects`** (line ~65) — ordered array; display order = array order. Each entry: `title`, `description`, `technologies[]`, optional `tooling[]`, `highlights[]`, `status`, `impact { businessValue, scale, timeline, efficiency? }`, `clientType`, `role`, `keyAchievements[]`, optional `subProjects[]`.
- **`SubProject`** type (line 11) — `name`, `repo`, `stack[]`, `metrics`, `timeline`, `status`, `highlights[]`.
- **`qaFilterOptions`** — technology filter chips. A chip only matches if the exact string appears in a project's `technologies[]` or as a substring of a `tooling[]` entry. Adding a chip with no match silently yields an empty grid.
- **`skills`** — category → skill list, rendered as cards.

**Status vocabulary is exactly two values: `'Ongoing'` and `'Completed'`.** Do not invent synonyms — `'Ongoing'` renders amber with a pulsing dot, anything else falls through to a muted gray badge, so a stray `'Done'` or `'Shipped'` looks identical to `'Completed'` and just fragments the copy. Same rule for `subProjects`. Use `'Ongoing'` only for genuinely active work.

## Gotchas

**Tailwind v4 is CSS-first.** There is no `tailwind.config.js` and no `autoprefixer`. Config lives in `src/app/globals.css` via `@import "tailwindcss"`; theme customization would go in `@theme`, component classes in `@layer components`. Do not "restore" a v3-style config or PostCSS setup — it breaks the build.

**`postcss.config.mjs` contains only `@tailwindcss/postcss`.** That single plugin replaces the old `tailwindcss` + `autoprefixer` pair.

**`next lint` no longer exists** (removed in Next 16). `npm run lint` calls `eslint` directly. `eslint.config.mjs` imports `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` as native flat configs — do **not** wrap them in `FlatCompat`, which throws `Converting circular structure to JSON`.

**Dates are computed live.** `src/lib/career.ts` exports `QA_CAREER_START`, `PLAYWRIGHT_START`, `KARATE_START`; `getYearsSince()` feeds the hero years counter, the "hours worked" ticker, and certification cards. Years-of-experience numbers update themselves — never hardcode them.

**Engagement facts are duplicated in three places.** When a role starts or ends, update all of them together or the site contradicts itself:
1. `page.tsx` — the `projects` entry (`status`, `impact.timeline`, sub-project timelines), the About paragraph, the hero availability badge, the Contact availability line
2. `layout.tsx` — `metadata.description`, `openGraph.description`, `twitter.description`
3. `layout.tsx` — `personJsonLd` (`description`, `worksFor` for current employers, `alumniOf` for past ones)

**JSX text must escape quotes and apostrophes.** `react/no-unescaped-entities` is an error, not a warning. Use `&apos;` / `&quot;` in text nodes.

**`.claude/` is gitignored.** Local settings and launch config are not shared.

**The Testimonials nav label lives in two places** and drifts silently. `grep -n 'href="#testimonials"' src/app/page.tsx` returns exactly two hits: the desktop nav and the mobile menu. Both are gated on `TESTIMONIALS.length > 0`, so before the first published testimonial the section and both links are absent and the site is byte-identical to what it was. `PROJECT_LABELS` in `src/lib/projects-meta.ts` is likewise a second home for project identity — the `projects[]` entries carry `slug: '…' satisfies ProjectSlug` so TypeScript catches a bad slug, but nothing catches a stale label.

**Four server-only env vars**, Vercel **Production only**: `INVITE_SECRET`, `MOD_SECRET`, `ADMIN_PASSWORD`, `GITHUB_TOKEN`. Never `NEXT_PUBLIC_` anything — `npm run postbuild` greps the whole build output for all four values and fails the build on a hit. Locally they live in `.env.local` (see `.env.local.example`; `.gitignore` un-ignores only the example). Two of them changed meaning when the email path was removed: **`MOD_SECRET` no longer signs moderation tokens** — that family is deleted — it signs the `/admin` session cookie in `src/lib/admin-auth.ts` under the domain tag `s1`, so rotating it signs every admin session out at once. **`ADMIN_PASSWORD` must be generated and at least 24 characters**: it is the only gate on `/admin`, a Vercel function cannot be rate-limited (a module-scoped counter resets on every cold start and is not shared across concurrent lambdas), so entropy in the password is the whole defence, and `admin-auth.ts` refuses to load below 24. `RESEND_API_KEY` is gone: this feature sends no email at all.

**The pending queue is a second, private GitHub repository.** `seradi96/qa-portfolio-pending`, one `pending/<id>.json` per unreviewed submission. Owner and repo name are **hardcoded module constants** in `src/lib/pending-store.ts`, exactly as they are in `src/lib/publish-to-git.ts`, and deliberately not environment-configurable — a mistyped variable must not be able to redirect submissions into a repository somebody else controls. `GITHUB_TOKEN` therefore has to reach **both** repos. Git cannot store an empty directory, so `GET /contents/pending` returns **404 when the queue is empty**; that is the normal state, not an error, and the store maps it to `[]`. A malformed pending file is dropped from the list with a logged warning rather than throwing, the same drop-not-throw discipline `testimonials.ts` uses. Operating instructions: `docs/testimonials-runbook.md`.

**`/admin` and `/invite` are both `noindex` and both in `robots.ts`'s disallow list.** `/admin` is a server component that reads the `admin_session` cookie; with no valid cookie it renders a small `'use client'` login form and nothing else. Its POST routes carry the same hardcoded `SITE_ORIGIN` Origin check as the submit route, so **neither page can be exercised from localhost** — that is by design, not a bug to work around.

**Never `export const runtime = 'edge'`** in the route handlers. `'nodejs'` is the default and the only one that works: the token, session and GitHub code uses `node:crypto` and `node:buffer`, and `'edge'` is deprecated in Next 16 and hard-fails the build.

**`cacheComponents` is deliberately off, so `'use cache'` is unavailable.** Enabling the flag would remove `dynamic` / `revalidate` / `fetchCache` app-wide and force-enable PPR. This repo has no cache-invalidation primitive at all: publishing means merging a commit and letting Vercel rebuild. Do not reach for `revalidatePath` / `revalidateTag` / `updateTag` — `revalidateTag` needs a second argument in Next 16 (a TS2554 written from Next 15 muscle memory) and `updateTag` throws inside route handlers.

**`output: 'export'` is now foreclosed.** `src/app/api/testimonials/*` and `src/app/api/admin/*` are real route handlers, and `/admin` reads a cookie; a static export would drop all of it.

**No schema.org `Review` JSON-LD, deliberately.** `Person` has no `review` property, so there is no valid subject to attach testimonials to; and `layout.tsx` injects JSON-LD via `dangerouslySetInnerHTML` with plain `JSON.stringify`, which does not escape `<` — visitor-authored text in that block could close the `<script>` tag. Testimonials are indexed as ordinary prerendered HTML.

**`npm run build` runs `npm run postbuild`** (npm lifecycle, not a Next hook). It asserts `/` is still in `.next/prerender-manifest.json`'s `routes`, that no secret is in the bundle, and that every published author is present in `.next/server/app/index.html`. Running `next build` directly skips all of it.

**`eslint-plugin-react-hooks` 7.1.1 is stricter than it looks.** `react-hooks/set-state-in-effect` flags a direct `setState` call inside a `useEffect` body, and `react-hooks/refs` has its own opinions about ref access during render. `src/app/invite/page.tsx` wraps its effect body in `queueMicrotask(() => { … })` specifically to satisfy `set-state-in-effect` while reading a browser-only source (`location.hash`) that cannot be read during SSR. It is not stray boilerplate — read the comment above it before deleting it; removing the wrapper without the `useSyncExternalStore` redesign the comment describes fails `npm run lint` and blocks the build. `/admin` does not need the same trick and must not copy it: it is a server component that reads the cookie during render, and its login form holds no derived state.

A third rule from the same plugin, **`react-hooks/purity`**, bit during this build: it rejects `Math.floor(Date.now() / 1000)` written inline in a component body — even a **server** component, which re-executes per request rather than re-rendering the way client hooks do, so the rule's underlying worry (an impure render producing different output on every pass) does not really apply to it. The fix, in `src/app/admin/page.tsx`, was to move the clock read into a module-scope helper *function*, `nowSeconds()`, called once per request — a plain function re-evaluates on every call, so this is behaviour-preserving, not a workaround. Do not instead hoist it into a module-scope *constant*: that would freeze one `Date.now()` reading for the lifetime of the module, which on a warm serverless instance can span many requests, and turn a live cookie-expiry check into a stale one — a real bug, not a lint fix.

## Design System

Dark, amber-accented — **not** the purple/pink of the original template.

```
Page background   bg-gradient-to-br from-gray-900 via-black to-gray-900
Accent            amber-400 / amber-500 / yellow-500 — the dominant accent
AI accent         cyan-300 / cyan-400 — AI/Claude content (the card-surface spec
                  reserves cyan for AI only; the Contact "Portfolio" link still uses it)
Nav               bg-black/20 backdrop-blur-md, border-b border-white/10
Cards             bg-white/5 (or amber gradient tint), border-white/10, rounded-2xl
Text              text-white → text-gray-300 → text-gray-400
Section rhythm    py-20 px-6, max-w-6xl mx-auto
Focus rings       focus:ring-2 focus:ring-amber-500 (required — keyboard nav is wired up)
```

Breakpoints: default mobile, `md:` 2-column, `lg:` multi-column grids.

`<pre>` blocks inside grid cells need `overflow-x-auto` and their parent needs `min-w-0`, otherwise they blow out the viewport on mobile.

## In-Flight Work

`docs/superpowers/` holds a committed spec + implementation plan for a **card surface system** — unifying every card onto one neutral glass surface with amber as the single accent, calming the decorative animations, and replacing emoji-as-icons with SVG. **Task 1 is done**: the testimonials work defined `.card-surface` / `.card-surface-interactive` and the reduced-motion guard in `globals.css`. Tasks 2–9 (applying them across `page.tsx`) are not started, and their references are grep patterns, not line numbers — `page.tsx` line numbers move every time anything is inserted. Read the plan before large-scale card restyling so the two efforts don't conflict.

## Deployment

Vercel, auto-deploy on push. `<Analytics />` in `layout.tsx` loads `/_vercel/insights/script.js` — it is a no-op outside Vercel, so absence of network calls locally is expected, not a bug.
