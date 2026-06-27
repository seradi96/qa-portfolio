# Card Surface System — Visual Consistency Pass

**Date:** 2026-06-27
**File touched:** `src/app/page.tsx`, `src/app/globals.css`
**Status:** Approved direction + scope; pending spec review

## Problem

Cards across the portfolio rotate through ~6 different background treatments:

- `from-amber-600/20 to-yellow-600/10` and `from-yellow-600/20 to-amber-600/10` → read as saturated **gold/yellow** tiles
- `from-black/30 to-amber-900/10`, `from-gray-800/40 to-black/20` → read as **near-black** tiles
- `from-white/5 to-white/2` glass (Projects, Contact) and cyan (AI) → two more treatments

Within a single grid (About, KPI, Key Wins, Architecture, Skills, Certifications) cards alternate gold ↔ black, producing a **patchwork** with no consistent surface of reference.

Secondary problem (flagged HIGH by ui-ux-pro-max): **excessive decorative motion** — `animate-ping/bounce/spin/pulse` on nearly every card violates "animate 1–2 elements per view max" and "infinite animation = loading only, not decoration". No `prefers-reduced-motion` support. Plus emoji used as structural icons in the KPI section.

## Goals

- One repeated, neutral card surface across the whole page; amber/gold becomes the single **accent**, not the fill.
- Cyan kept strictly as the **semantic** accent for AI-related cards.
- Calm decorative animation down to interaction feedback; honor reduced-motion.
- Replace emoji-as-icons with consistent SVG.
- No content/data changes — purely visual. No layout/structure rewrites.

## Non-Goals

- No copy/text edits, no new sections, no data changes in the `projects`/`skills` arrays.
- No font or page-background-gradient changes.
- No responsive/breakpoint restructuring.

## Design

### Surface token system (define once, reuse everywhere)

Grounded in ui-ux-pro-max "Modern Dark / glassmorphism" recommendation. Define a single component class in `globals.css` rather than repeating gradients inline (`elevation-consistent` + `color-semantic` rules):

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
```

| Token | Value | Role |
|---|---|---|
| surface | `bg-gradient-to-b from-white/[0.06] to-white/[0.03]` | glass fill + subtle top sheen (lighter at top) |
| border | `border-white/[0.08]` | hairline contour |
| radius | `rounded-2xl` (16px) | corners |
| hover | `hover:border-amber-400/30` + `hover:shadow-amber-500/10` | interaction feedback |
| easing | `duration-200 ease-out` | per UX `duration-timing` / `easing` |

- **Top sheen** (lighter at top via the gradient) replaces the per-card colored fills and the earlier "amber line" idea — it reads as authentic glass and stays identical on every card.
- **No pure black surfaces** (ui-ux-pro-max: `#000000` → harsh / OLED smear). Existing near-black card fills are removed by this change.

### Accent system

- **Icon chip:** single gradient `from-amber-500 to-yellow-500` everywhere (replaces the 5 varied gradients: amber→black, yellow→amber, amber→gray-800, etc.).
- **Accent text / numbers:** `text-amber-300` (labels/headings accents), `text-amber-400` (stat figures). Contrast on the dark glass ≈ 8–10:1 → WCAG AAA.
- **AI semantic accent (kept):** icon `from-cyan-400 to-blue-500`, text `text-cyan-300`. Applies to: Architecture "AI-Augmented Workflow" card, Skills "AI-Augmented QA" card (index 4), tooling badges, the aserban.ro contact link.
- **Selected project state (kept):** an open project card keeps the amber-tinted fill — selection *should* stand out.

### Contrast fixes

- Bump meaningful micro-text from `text-gray-500` → `text-gray-400` (e.g. "+N more", sub-labels) so it clears 4.5:1.
- Keep existing `focus:ring-2 focus:ring-amber-500` focus rings (validated High).

### Animation policy

- Remove purely decorative infinite animations on cards: `animate-ping`, `animate-bounce`, `animate-spin`, and decorative `animate-pulse` glows / dot rows under icons.
- Keep: hover transitions (scale/bg/shadow/border), and **at most one** semantic indicator — the KPI "Live Counter" pulse (single element).
- Add a global reduced-motion guard in `globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- Keep `hover:scale-[1.02]`/`hover:scale-105` (transform-layer, no reflow; within the 0.95–1.05 press range).

### Emoji → SVG

- KPI labels: `🔴 Live Counter`, `🚀 Delivered`, `⭐ Created`, `🎓 Completed` → small inline Heroicons SVG + text, amber-tinted, consistent stroke.
- About "✅" bullets (×3) → Heroicons `CheckCircle` SVG in amber.

## Scope — card inventory to convert to `card-surface`

| Section | Cards | Current fills → new |
|---|---|---|
| About — personality | 3 | amber / yellow / black → glass uniform |
| KPI metrics | 4 | amber / yellow / black / amber → glass uniform (+ emoji→SVG) |
| Key Wins & Impact | 4 | amber ×3 / yellow → glass uniform |
| Architecture — frameworks | 3 | amber / yellow / black → glass uniform |
| Architecture — DB callout | 1 | already `white/5` → align to token |
| Architecture — AI card | 1 | cyan → **keep** (semantic) |
| Skills | 5 | amber/yellow/gray-black/black + cyan → glass uniform; index 4 keeps cyan |
| Certifications | 7 | mixed amber/yellow/black/gray → glass uniform |
| Learning Goals banner | 1 | `black/40 → amber-900/20` → neutral banner consistent with token |
| Projects grid | 4 | already glass; **reference style** — keep, selected state keeps amber |
| Contact cards | — | already glass — keep; LinkedIn/email accent amber, portfolio link cyan |

## Implementation approach

- Single sequential pass over `src/app/page.tsx` + `globals.css` by one editor (consistency is the whole point — **not** parallelized across agents, which would diverge/conflict on one file).
- Add the `card-surface` component classes + reduced-motion guard to `globals.css`.
- Replace inline per-card gradient/border/animation classes section by section with the token classes + amber accents.

## Verification

- `npm run build` (or `npm run dev`) — must compile clean, no TS/ESLint errors.
- Visual check at 375 / 768 / 1024 / 1440 px.
- Toggle OS "Reduce Motion" → decorative motion stops.
- Spot-check accent text contrast on the glass surface (amber-300/400 ≥ 4.5:1).
- Confirm no emoji remain as structural icons.
- Confirm cyan appears only on the AI/portfolio-link elements.
