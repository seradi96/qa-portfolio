# aserban.ro — Personal portfolio

Portfolio site of **Andrei Șerban** — Senior QA Automation Engineer & Test Architect.

Live: **[aserban.ro](https://aserban.ro)**

## Stack

- **Next.js 16** (App Router, React 19)
- **TypeScript** (strict)
- **Tailwind CSS 4** (utility-first)
- **Heroicons** (UI icons)
- Schema.org JSON-LD (`Person` + `WebSite`) for SEO / knowledge panel
- Deployed on **Vercel**

## Sections

- Hero with live "hours worked" counter
- About — current obsessions + how I approach QA
- KPI metrics
- Featured Projects (filterable by tech)
- **Architecture & Approach** — patterns, layering, and folder structures for the three production QA stacks I own (functional, performance, reporting), plus the railway QA stack and AI-augmented authoring loop
- Technical Skills
- Certifications & Learning Goals
- Contact

## Development

```bash
npm install
npm run dev          # http://localhost:3000
```

## Production

```bash
npm run build
npm run start
```

## Project files of note

- `src/app/page.tsx` — single-page portfolio (all content)
- `src/app/layout.tsx` — metadata, OG tags, JSON-LD structured data
- `build_cv.js` — generator script for the CV PDF / DOCX (uses `docx-js` + LibreOffice for PDF conversion)
- `CV-Changes-and-Final.md` — changelog and canonical CV content as Markdown
- `Andrei-Serban-CV.pdf` / `.docx` — current CV outputs

## License

Personal portfolio — content © Andrei Șerban. Code structure free to fork as a Next.js starting point.
