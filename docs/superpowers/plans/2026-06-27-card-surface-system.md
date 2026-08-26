# Card Surface System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify every card in the portfolio onto one neutral glass surface with amber as the single accent (cyan reserved for AI), calm decorative animations, and replace emoji-as-icons with SVG.

**Architecture:** Define reusable surface classes once in `globals.css` (Tailwind v4 `@layer components` + `@apply`), then replace per-card inline gradient/border/animation classes across `src/app/page.tsx` section by section. No content, layout, or data changes.

**Tech Stack:** Next.js 16, React 19, **Tailwind CSS v4** (`@import "tailwindcss"`, CSS-first — no `tailwind.config.js`), Heroicons. Spec: `docs/superpowers/specs/2026-06-27-card-surface-system-design.md`.

---

## Verification model

This is a visual/CSS change with no unit-test harness in the repo. Each task is verified by:
- **Deterministic greps** — the old per-card gradient strings are gone, emoji/animation counts drop to target.
- **`npm run lint`** after each section (fast).
- **`npm run build`** once at the end (full gate).
- **Visual** — `npm run dev` (http://localhost:3000) open throughout; eyeball each section after its task.

Run dev once before starting:
```bash
npm run dev
```

---

## File structure

- `src/app/globals.css` — add `.card-surface`, `.card-surface-interactive`, `.card-surface-ai` component classes + a `prefers-reduced-motion` guard.
- `src/app/page.tsx` — apply the classes; standardize icon-chip gradients to `from-amber-500 to-yellow-500` (cyan kept for AI); delete decorative `animate-ping/bounce/spin` blocks; swap emoji for SVG.

---

## Canonical transformations (reference for all section tasks)

These are the exact rules every section task applies. Not a placeholder — the literal class names defined in Task 1.

**A. Card surface (the inner card `<div>`):** replace the background/border/shadow segment
`bg-gradient-to-br from-*/* to-*/* p-6 rounded-2xl border border-*/30 ... transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-*/25`
→ keep spacing/layout utilities, swap the colored part for the token:
`card-surface card-surface-interactive p-6 ... hover:scale-105` (keep `text-center` etc. where present).

**B. Icon chip:** any of `from-amber-500 to-yellow-500` / `from-yellow-500 to-amber-500` / `from-amber-500 to-black` / `from-amber-500 to-gray-800` / `from-yellow-500 to-black`
→ single `from-amber-500 to-yellow-500`. (AI cards keep `from-cyan-400 to-blue-500`.)

**C. Decorative motion:** delete the absolutely-positioned `animate-ping`, `animate-bounce` dot-rows, and `animate-spin` badge `<div>`s that decorate icons. Keep only: the KPI "Live Counter" pulse (one element), the active-project status dot, the back-to-top button.

**D. Accent text:** unchanged (`text-amber-300` / `text-amber-400`); bump meaningful `text-gray-500` micro-text to `text-gray-400`.

---

## Task 1: Surface tokens + reduced-motion in globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Append component classes and motion guard**

Add to the end of `src/app/globals.css`:

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

  .card-surface-ai {
    @apply relative rounded-2xl border border-cyan-400/20
           bg-gradient-to-b from-cyan-500/[0.08] to-blue-500/[0.04]
           transition-all duration-200 ease-out;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Verify the classes compile**

Run:
```bash
npm run build
```
Expected: build succeeds. (If `@apply` of an arbitrary-opacity utility errors, the class name is mistyped — fix and rebuild.)

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add card-surface tokens + reduced-motion guard"
```

---

## Task 2: About — 3 personality cards + ✅→SVG

**Files:**
- Modify: `src/app/page.tsx` (About section, ~lines 530–602)

- [ ] **Step 1: Convert the 3 personality card inner divs**

Card 1 (`Problem Solver`): replace
`bg-gradient-to-br from-amber-600/20 to-yellow-600/10 p-6 rounded-2xl border border-amber-400/30 text-center transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25`
→ `card-surface card-surface-interactive p-6 text-center hover:scale-105`

Card 2 (`Speed & Efficiency`): replace
`bg-gradient-to-br from-yellow-600/20 to-amber-600/10 p-6 rounded-2xl border border-yellow-400/30 text-center transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/25`
→ `card-surface card-surface-interactive p-6 text-center hover:scale-105`

Card 3 (`Team Catalyst`): replace
`bg-gradient-to-br from-black/30 to-amber-900/10 p-6 rounded-2xl border border-amber-400/30 text-center transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25`
→ `card-surface card-surface-interactive p-6 text-center hover:scale-105`

- [ ] **Step 2: Standardize icon chips to amber**

In card 3, replace icon chip `bg-gradient-to-r from-amber-500 to-black` → `bg-gradient-to-r from-amber-500 to-yellow-500`. (Cards 1 and 2 chips already use amber/yellow — leave.)

- [ ] **Step 3: Delete decorative motion in these cards**

Delete these three decorative blocks (one per card):
- Card 1: the `<div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center animate-pulse">…</div>`
- Card 2: the `<div className="absolute inset-0 bg-amber-400/20 rounded-full animate-ping"></div>`
- Card 3: the bouncing dot row `<div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2"><div className="flex space-x-1"> …three animate-bounce dots… </div></div>`

- [ ] **Step 4: Replace the 3 ✅ emoji with SVG**

Replace each (lines ~591/595/599) `<span className="text-amber-400">✅</span>` with:
```tsx
<svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
```

- [ ] **Step 5: Verify**

```bash
grep -n "✅\|from-amber-600/20 to-yellow-600/10 p-6" src/app/page.tsx | sed -n '1,5p'
npm run lint
```
Expected: no `✅` remain; About card gradients gone. Lint clean. Visually confirm the 3 About cards look identical (glass) with amber icons.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "style(about): unify personality cards to glass + svg checks"
```

---

## Task 3: KPI metrics — 4 cards + emoji labels → SVG

**Files:**
- Modify: `src/app/page.tsx` (KPI section, ~lines 625–707)

- [ ] **Step 1: Convert the 4 KPI card inner divs**

Replace each card's `bg-gradient-to-br …` surface segment with `card-surface card-surface-interactive p-6 text-center hover:scale-105`. The four current fills are:
- Card 1: `from-amber-600/20 to-yellow-600/10`
- Card 2: `from-yellow-600/20 to-amber-600/10`
- Card 3: `from-black/30 to-amber-900/10`
- Card 4: `from-amber-600/20 to-yellow-600/10`

(Each keeps `p-6 text-center` + `hover:scale-105`; drop `transform … hover:shadow-2xl hover:shadow-*/25`.)

- [ ] **Step 2: Standardize icon chips**

Card 3 chip `from-amber-500 to-black` → `from-amber-500 to-yellow-500`. Others already amber/yellow.

- [ ] **Step 3: Delete decorative motion (keep ONE Live pulse)**

Delete, in the KPI cards:
- Card 1: `<div className="absolute inset-0 bg-amber-400/20 rounded-full animate-ping"></div>` AND the `animate-pulse` `-top-2 -right-2` badge div.
- Card 2: the bouncing dot row (`animate-bounce` ×3).
- Card 3: the `animate-spin` badge div (`-top-1 -right-1 … animate-spin`).
- Card 4: the `animate-pulse` glow `<div className="absolute inset-0 bg-amber-400/30 rounded-full animate-pulse"></div>` and the gradient bar div.

Keep the `🔴 Live Counter` indicator's meaning (handled next step).

- [ ] **Step 4: Replace 4 emoji labels with SVG + text**

- Line ~643 `<p className="text-amber-400 text-xs mt-1 font-medium">🔴 Live Counter</p>` →
```tsx
<p className="text-amber-400 text-xs mt-1 font-medium inline-flex items-center justify-center gap-1.5"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" aria-hidden="true"></span>Live Counter</p>
```
- Line ~665 `🚀 Delivered` →
```tsx
<p className="text-amber-400 text-xs mt-1 font-medium inline-flex items-center justify-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Delivered</p>
```
- Line ~685 `⭐ Created` →
```tsx
<p className="text-amber-400 text-xs mt-1 font-medium inline-flex items-center justify-center gap-1.5"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Created</p>
```
- Line ~704 `🎓 Completed` →
```tsx
<p className="text-amber-400 text-xs mt-1 font-medium inline-flex items-center justify-center gap-1.5"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6L23 9l-11-6zM18.82 9L12 12.72 5.18 9 12 5.28 18.82 9z"/></svg>Completed</p>
```

- [ ] **Step 5: Verify**

```bash
grep -nE "🔴|🚀|⭐|🎓" src/app/page.tsx
npm run lint
```
Expected: zero matches; lint clean. Visually: 4 KPI cards identical glass, single red Live dot pulsing.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "style(kpi): glass cards, svg labels, single live indicator"
```

---

## Task 4: Key Wins & Impact — 4 cards

**Files:**
- Modify: `src/app/page.tsx` (~lines 733–828)

- [ ] **Step 1: Convert 4 card inner divs**

Replace each surface segment with `card-surface card-surface-interactive p-6 hover:scale-105` (note: these cards have no `text-center` on the wrapper; keep their existing inner layout classes, only swap the bg/border/shadow part). Current fills: card1 `from-amber-600/20 to-yellow-600/10`, card2 `from-yellow-600/20 to-amber-600/10`, card3 `from-amber-600/20 to-yellow-600/10`, card4 `from-amber-600/20 to-yellow-600/10`.

- [ ] **Step 2: Delete decorative motion**

Remove from each card: `animate-ping` glow divs (cards 1, 4), the `animate-bounce` dot row (card 2), the `animate-spin` badge (card 3), and the `animate-pulse` bar (card 4). Icon chips are already amber/yellow — leave.

- [ ] **Step 3: Verify**

```bash
grep -c "from-amber-600/20 to-yellow-600/10 p-6 rounded-2xl border border-amber-400/30" src/app/page.tsx
npm run lint
```
Expected: count dropping toward 0 for Key Wins region; lint clean. Visual: 4 identical glass cards, amber stat numbers intact.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "style(key-wins): unify impact cards to glass"
```

---

## Task 5: Architecture — 3 framework cards + DB callout (AI card kept cyan)

**Files:**
- Modify: `src/app/page.tsx` (~lines 1109–1313)

- [ ] **Step 1: Convert the 3 framework cards**

- Functional (line ~1112): `bg-gradient-to-br from-amber-600/20 to-yellow-600/10 p-6 rounded-2xl border border-amber-400/30 hover:shadow-2xl hover:shadow-amber-500/25 transition-all duration-300` → `card-surface card-surface-interactive p-6`. Keep the leading `min-w-0`.
- Performance (line ~1160): `… from-yellow-600/20 to-amber-600/10 … border-yellow-400/30 …` → `card-surface card-surface-interactive p-6` (keep `min-w-0`).
- Reporting (line ~1212): `… from-black/30 to-amber-900/10 … border-amber-400/30 …` → `card-surface card-surface-interactive p-6` (keep `min-w-0`).

- [ ] **Step 2: Standardize icon chips**

Reporting card chip `from-amber-500 to-black` → `from-amber-500 to-yellow-500`. Performance chip `from-yellow-500 to-amber-500` → `from-amber-500 to-yellow-500`. Also update the inner `border-t border-yellow-400/20` (Performance, ~line 1187) → `border-t border-amber-400/20` for accent consistency.

- [ ] **Step 3: Align the DB callout**

Line ~1266 `bg-white/5 p-6 rounded-2xl border border-white/10` → `card-surface p-6` (static, no hover-scale here — it's a content panel).

- [ ] **Step 4: Keep the AI card cyan, but tokenize it**

Line ~1316 `bg-gradient-to-br from-cyan-600/15 to-blue-600/10 p-6 rounded-2xl border border-cyan-400/30` → `card-surface-ai p-6`. Leave its cyan icon chip and cyan text untouched.

- [ ] **Step 5: Verify**

```bash
grep -nE "from-amber-600/20 to-yellow-600/10 p-6 rounded-2xl|from-black/30 to-amber-900/10 p-6 rounded-2xl" src/app/page.tsx
npm run lint
```
Expected: Architecture framework fills gone; lint clean. Visual: 3 framework cards uniform glass, AI card still cyan, DB callout matches.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "style(architecture): glass framework cards, tokenize AI card"
```

---

## Task 6: Skills — refactor the `colors` array (keep AI index 4 cyan)

**Files:**
- Modify: `src/app/page.tsx` (Skills section, ~lines 1359–1416)

- [ ] **Step 1: Replace the per-index `colors` array with uniform glass + amber, cyan only at index 4**

Replace the `colors` array (lines ~1360–1366) with:

```tsx
const colors = [
  { surface: 'card-surface card-surface-interactive', icon: 'from-amber-500 to-yellow-500', dot: 'from-amber-500 to-yellow-500' },
  { surface: 'card-surface card-surface-interactive', icon: 'from-amber-500 to-yellow-500', dot: 'from-amber-500 to-yellow-500' },
  { surface: 'card-surface card-surface-interactive', icon: 'from-amber-500 to-yellow-500', dot: 'from-amber-500 to-yellow-500' },
  { surface: 'card-surface card-surface-interactive', icon: 'from-amber-500 to-yellow-500', dot: 'from-amber-500 to-yellow-500' },
  { surface: 'card-surface-ai card-surface-interactive', icon: 'from-cyan-400 to-blue-500', dot: 'from-cyan-400 to-blue-500' },
];
const color = colors[index % colors.length];
```

- [ ] **Step 2: Update the card wrapper to use the new shape**

Line ~1379 `<div className={`h-full bg-gradient-to-br ${color.bg} p-6 rounded-2xl border ${color.border} transform transition-all duration-300 hover:scale-105 hover:shadow-2xl ${color.shadow}`}>` →
```tsx
<div className={`h-full ${color.surface} p-6 hover:scale-105`}>
```
Line ~1381 icon chip `bg-gradient-to-r ${color.icon}` stays (now amber/cyan from new array). Line ~1411 skill dot `bg-gradient-to-r ${color.icon}` → `bg-gradient-to-r ${color.dot}` (same values; rename for clarity, optional).

- [ ] **Step 3: Delete the per-index decorative animations**

Remove the `index === 0` `animate-ping`, `index === 1` `animate-bounce` dot row, `index === 2` `animate-spin` badge, `index === 3` `animate-pulse` bar blocks (lines ~1384–1405). Also remove `animate-pulse` from the skill dots (line ~1411: drop `animate-pulse` and the inline `animationDelay` style).

- [ ] **Step 4: Verify**

```bash
grep -nE "color.bg|color.border|color.shadow" src/app/page.tsx
npm run lint
```
Expected: no references to the removed `bg/border/shadow` keys remain; lint clean. Visual: 5 skill cards uniform glass, the AI-Augmented QA card (last) cyan.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "style(skills): uniform glass via tokenized colors array"
```

---

## Task 7: Certifications — 7 cards + Learning Goals banner

**Files:**
- Modify: `src/app/page.tsx` (~lines 1428–1638)

- [ ] **Step 1: Convert all 7 certification card inner divs**

Replace each surface segment with `card-surface card-surface-interactive p-6 hover:scale-105`. Current fills (in order): ISTQB `from-amber-600/20 to-yellow-600/10`; PSM I `from-yellow-600/20 to-amber-600/10`; Playwright `from-yellow-600/20 to-amber-600/10`; GitLab `from-black/30 to-amber-900/10`; Containers `from-gray-800/40 to-black/20`; API `from-amber-600/30 to-yellow-600/10`; Continuous Learning `from-black/40 to-yellow-600/10`.

- [ ] **Step 2: Standardize icon chips to amber**

Replace any non-amber chips: GitLab `from-amber-500 to-black`, Containers `from-amber-500 to-gray-800`, Continuous Learning `from-yellow-500 to-black`, PSM/Playwright `from-yellow-500 to-amber-500` → all `from-amber-500 to-yellow-500`.

- [ ] **Step 3: Delete decorative motion in cert cards**

Remove `animate-ping` (Playwright, API), `animate-bounce` dot rows (GitLab, ISTQB/PSM badges if animated), `animate-spin` (Containers badge). Leave static badge checkmarks (non-animated) in place.

- [ ] **Step 4: Tone the Learning Goals banner**

Line ~1605 `bg-gradient-to-r from-black/40 to-amber-900/20 p-8 rounded-2xl border border-amber-400/30` → `card-surface p-8`. Its 3 inner icon chips: standardize the `from-amber-500 to-black` one → `from-amber-500 to-yellow-500`.

- [ ] **Step 5: Verify**

```bash
grep -nE "from-gray-800/40 to-black/20|from-black/30 to-amber-900/10 p-6|from-black/40 to-yellow-600/10" src/app/page.tsx
npm run lint
```
Expected: cert fills gone; lint clean. Visual: 7 cert cards + banner all uniform glass.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "style(certs): unify certification cards + learning banner to glass"
```

---

## Task 8: Sweep remaining decorative motion (hero, quote, projects)

**Files:**
- Modify: `src/app/page.tsx` (hero ~440–500, quote ~712–725, projects ~877–1092)

- [ ] **Step 1: Hero buttons**

Remove the `animate-ping` star overlay (`<div className="absolute inset-0 animate-ping">…</div>`, ~lines 468–472) and the `animate-bounce` dot row under the chat icon (~lines 488–494). Keep the `group-hover` opacity overlays (interaction feedback).

- [ ] **Step 2: Quote marks**

The decorative quote marks are static (no animation) — leave. Confirm no `animate-*` in the quote section.

- [ ] **Step 3: Projects grid**

Keep the active-project status dot `animate-pulse` (semantic, line ~917) and remove the decorative bouncing arrow `<div className="absolute -right-2 top-1/2 …"><div className="… animate-bounce"></div></div>` (~lines 1087–1091). Status badge pulse dots (lines ~929) → drop `animate-pulse` (decorative), keep the dot.

- [ ] **Step 4: Verify animation budget**

```bash
grep -cE "animate-ping|animate-bounce|animate-spin" src/app/page.tsx
```
Expected: **0**. (All ping/bounce/spin removed.)
```bash
grep -cE "animate-pulse" src/app/page.tsx
```
Expected: ≤ 2 (Live Counter dot + active-project dot).
```bash
npm run lint
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "style: remove decorative ping/bounce/spin, keep semantic pulses"
```

---

## Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Build gate**

```bash
npm run build
```
Expected: compiles with no errors/warnings about unknown classes.

- [ ] **Step 2: Residual-style grep**

```bash
grep -nE "from-amber-600/20 to-yellow-600|from-yellow-600/20 to-amber-600|from-black/30 to-amber-900|from-gray-800/40 to-black|from-black/40 to-yellow" src/app/page.tsx
```
Expected: **no card surfaces** remain (only the active-project selected state `from-amber-600/20 to-yellow-600/10` inside the project map at ~line 889 is allowed — that is the intentional selected highlight).

- [ ] **Step 3: Emoji + motion budget**

```bash
grep -cE "🔴|🚀|⭐|🎓|✅" src/app/page.tsx   # expect 0
grep -cE "animate-(ping|bounce|spin)" src/app/page.tsx   # expect 0
```

- [ ] **Step 4: Reduced-motion check**

Enable OS "Reduce Motion" (macOS: System Settings → Accessibility → Display) and reload — confirm pulses stop and scrolling is instant.

- [ ] **Step 5: Visual pass at breakpoints**

In the browser, check 375 / 768 / 1024 / 1440 px: every card is the same glass surface; amber accents on icons/numbers; cyan only on the two AI cards + the aserban.ro link; selected project still highlights amber.

- [ ] **Step 6: Final commit (if any cleanup)**

```bash
git add -A src/app/page.tsx src/app/globals.css
git commit -m "style: card surface system pass complete"
```

---

## Self-review notes

- **Spec coverage:** surface tokens (T1) · About/KPI/KeyWins/Architecture/Skills/Certs (T2–T7) · animation policy + reduced-motion (T1, T8) · emoji→SVG (T2, T3) · cyan-for-AI kept (T5, T6) · selected-project amber kept (T9 allowance) · contrast `gray-500→gray-400` (apply opportunistically per card where micro-text appears). All spec sections mapped.
- **No data/content changes** anywhere — only `className`/decorative-`<div>` edits and 7 emoji→SVG swaps.
- **Allowed residual:** the one `from-amber-600/20 to-yellow-600/10` inside the project `.map` active-state branch is intentional (selected highlight), excluded from the grep gate in T9 Step 2.
