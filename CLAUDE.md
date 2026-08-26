# CLAUDE.md

Guidance for Claude Code when working in this QA Automation portfolio repository.

## Project Overview

Single-page portfolio site for a Senior QA Automation Engineer / Test Architect, deployed at **aserban.ro**. Audience: hiring managers, QA professionals, potential collaborators.

**Stack** (keep versions accurate here — this file has drifted before):

| | |
|---|---|
| Next.js | 16.2.6 — App Router, Turbopack |
| React | 19.2.4 |
| TypeScript | 5.9 — strict mode, `@/*` → `./src/*` |
| Tailwind CSS | 4.1.18 — **CSS-first, no `tailwind.config.js`** |
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
```

There is **no test harness** in this repo. `npm run build` + `npm run lint` are the full verification gate. For visual changes, also eyeball `npm run dev`.

## Architecture

```
qa-portfolio/
├── src/
│   ├── app/
│   │   ├── page.tsx        # ~1770 lines — the entire site, one 'use client' component
│   │   ├── layout.tsx      # Metadata, OG/Twitter, JSON-LD, fonts, <Analytics/>
│   │   ├── globals.css     # @import "tailwindcss" + a few global rules
│   │   └── favicon.ico
│   └── lib/
│       └── career.ts       # Career start dates + getYearsSince()
├── docs/superpowers/       # Design specs and implementation plans (in-flight work)
├── public/                 # Static SVGs (default CRA-style assets, mostly unused)
├── eslint.config.mjs       # Flat config, native eslint-config-next imports
├── postcss.config.mjs      # @tailwindcss/postcss only
├── next.config.js          # Intentionally empty
└── CLAUDE.md
```

`page.tsx` sections in order: Nav → Hero → About → KPI Metrics → Quote → Key Wins → Projects → Architecture & Approach → Skills → Certifications → Contact → Footer → Back-to-top.

## Content Model

All content lives in `src/app/page.tsx` as plain arrays/objects above the JSX — there is no CMS and no data fetching.

- **`projects`** (line ~65) — ordered array; display order = array order. Each entry: `title`, `description`, `technologies[]`, optional `tooling[]`, `highlights[]`, `status`, `impact { businessValue, scale, timeline, efficiency? }`, `clientType`, `role`, `keyAchievements[]`, optional `subProjects[]`.
- **`SubProject`** type (line 8) — `name`, `repo`, `stack[]`, `metrics`, `timeline`, `status`, `highlights[]`.
- **`qaFilterOptions`** — technology filter chips. A chip only matches if the exact string appears in a project's `technologies[]` or as a substring of a `tooling[]` entry. Adding a chip with no match silently yields an empty grid.
- **`skills`** — category → skill list, rendered as cards.

**Status vocabulary** drives badge styling: `'Ongoing'` renders amber with a pulsing dot; anything else (`'Completed'`, `'Done'`) renders muted gray. Same rule for `subProjects`. Use `'Ongoing'` only for genuinely active work.

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

`docs/superpowers/` holds a committed spec + implementation plan for a **card surface system** — unifying every card onto one neutral glass surface with amber as the single accent, calming the decorative animations, and replacing emoji-as-icons with SVG. Not yet implemented. Read the plan before large-scale card restyling so the two efforts don't conflict.

## Deployment

Vercel, auto-deploy on push. `<Analytics />` in `layout.tsx` loads `/_vercel/insights/script.js` — it is a no-op outside Vercel, so absence of network calls locally is expected, not a bug.
