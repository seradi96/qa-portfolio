# Andrei Șerban — CV: jurnal de modificări + versiunea finală

Acest document urmărește toate modificările făcute la CV pe parcursul iterațiilor și conține versiunea finală în Markdown.

---

## Jurnal de modificări

### Iterația 1 — Construcția inițială

Decizii structurale agreate înainte de start:

- **Poziționare:** „Senior QA Automation Engineer & Test Architect" (combinație seniority + architect).
- **Tratamentul carierei non-tech:** secțiune scurtă „Beyond Tech" la final.
- **AI-Augmented QA:** secțiune dedicată ca diferențiator major (Claude Code, MCP, Playwright MCP).
- **Format livrabil:** PDF + DOCX (single point of truth editabil).

Conținut construit din:

- `Andrei CV.pdf` (Europass complet — toate rolurile, inclusiv fitness/massage)
- `Andrei Serban-CV.pdf` (CV scurt vizual, QA-focused)
- Site portfolio `http://localhost:3001/` (TOKERO, Deutsche Bahn, DentsplySirona, Happy Media, AI-Augmented QA skills)

Layout:

- US Letter, 1" margini
- Calibri 10.5pt, accent amber/orange (`#B45309`) ca pe site
- Hairline rule sub fiecare secțiune
- Bullet-uri în portocaliu, text slate-800

### Iterația 2 — Cleanup link

- Scos linkul „Portfolio" din header (era placeholder către github.com).

### Iterația 3 — Ownership pe Deutsche Bahn

Adăugat clar că ești owner și pe stack-ul DB, nu doar pe TOKERO:

- **Summary:** „Sole owner of two production QA stacks…"
- **Experience bullet:** „**architect & owner** of the Karate-based API automation suite and the Playwright UI framework"
- **Featured Project DB:** subtitle „Ongoing · Architect & owner"

### Iterația 4 — Restructurare majoră a experienței

Probleme identificate de tine:

- TOKERO era pus greșit ca proiect intern Heaven Solutions.
- TOKERO e angajator separat, concurent.
- C#/.NET/Blazor/NBomber aparțin TOKERO, nu Heaven.
- Karate + Playwright UI pe SAP ERP IRMS aparțin Heaven Solutions (Deutsche Bahn).

Restructurare:

1. **Senior QA Automation Engineer & Test Architect · TOKERO Crypto Exchange** (rol concurent senior — stack .NET/C#/Blazor/NBomber/Playwright .NET)
2. **QA Automation Engineer · Heaven Solutions · Deutsche Bahn (SAP ERP IRMS)** (stack Karate Java + Playwright TypeScript + Angular + Spring Boot + SAP GUI)
3. **Software Tester · Heaven Solutions · DentsplySirona** (Bensheim, Germania — neschimbat)

Featured Projects actualizate cu tag-uri de context („Senior QA / Test Architect role at TOKERO" vs „Heaven Solutions client engagement").

Cleanup adițional în aceeași iterație:

- **GCP** scos din Platforms & DevOps și din stack-ul DB.
- **SonarQube** scos din Test Management și din bullet-ul CI/CD.
- **„build testing communities"** scos din Summary.
- **Playwright** schimbat din „2+ years hands-on" în „3+ years hands-on".
- **Massage Therapist** schimbat din „2019 – present" în „2019 – June 2024".

### Iterația 5 — Datele TOKERO

- **Rol TOKERO:** „Jun 2024 – Present" → **„Jul 2025 – Present"**.
- **Bullet stack TOKERO:** „owned in production since June 2024" → **„running in production since 2026"**.
- **Featured Project TOKERO:** același lucru, aliniat consistent.

Asta dă o cronologie credibilă: angajat la TOKERO mid-2025, framework-uri lansate în producție în 2026.

### Iterația 6 — Sincronizare site + 4 modificări pe page.tsx

Aliniat site-ul Next.js cu noua poveste din CV:

- Linia 62: TOKERO description rescrisă cu cronologia corectă.
- Linia 91: timeline TOKERO `July 2025 - Present`.
- Linia 94: TOKERO role `Senior QA Automation Engineer & Test Architect`.
- Liniile 107/121/135: sub-proiecte qaatpw/perf/pulse mutate de la `2024 - Present`.
- Linia 187: DB role schimbat din `Senior QA Automation Engineer - Automation Lead` în `QA Automation Engineer (Automation Lead on client engagement)`.
- Linia 552: înlocuit „Leading QA communities" cu „Architecting frameworks adopted as team standards".
- Linia 1183: Playwright cert badge `2+ years` → `3+ years`.

Verificat cu `npx tsc --noEmit` — fără erori.

### Iterația 7 — Hero & metrici card-uri

- Hero badge: „3+ Years Experience" → **„5+ Years in Tech"** (reflectă tot parcursul din 2021).
- KPI card: „3 Frameworks Created" → **„5 Frameworks Created"** (qaatpw + perf + pulse + Karate DB + Playwright UI DB).

### Iterația 8 — Rescriere About Me cu povestea din CV

- **Paragraful 1:** menționează cele două roluri concurente cu nume de client (TOKERO + Deutsche Bahn) și stack-uri, în loc de „architecting comprehensive test strategies".
- **Paragraful 2:** adăugat AI-Augmented QA explicit (Claude Code, MCP, spec-driven automation).
- **Bullet „Exploring testing innovations":** densificat de la 2 la 4 elemente concrete (Claude Code skills, Playwright MCP, visual regression workflows, subagent-driven test development).
- Nume de brand (TOKERO, Deutsche Bahn, AI-augmented workflows) pe accent amber-300 pentru pop vizual.
- Folosit `&apos;` pentru toate apostrofele ca să treacă react/no-unescaped-entities.

### Iterația 9 — Timeline split TOKERO + injectare metrici

Două schimbări majore:

**1. Timeline split pentru TOKERO** (qaatpw vs perf+pulse):

- qaatpw (Playwright functional framework) — în producție din 2025.
- perf (NBomber) + pulse (Blazor reporting) — shipped to production în 2026.

Aplicat în:

- Summary CV (formulare nouă).
- Experience TOKERO în CV.
- Featured Project TOKERO în CV.
- Site `page.tsx` linia 62 (description).
- Site `page.tsx` liniile 121, 135 (sub-project timelines pentru perf și pulse mutate la `2026 - Present`).

**2. Densificare cu metrici % și sume** în CV:

- **Summary** — adăugat linia: „Across both engagements: 5 production QA frameworks, 90% automated coverage, ~60% faster feedback loops, ~30% reduction in defects reaching staging, and €2M+ in prevented system failures."
- **TOKERO experience** — adăugat: „77 Page Objects, 49 test classes, 11 performance scenarios, and 27 performance profiles" + „5+ custom Claude Code skills" + bullet despre pulse cu „candlestick + trend analytics, flaky-test detection, 10% regression threshold" + bullet despre SignalR independent-circuit perf scenario.
- **Deutsche Bahn experience** — restructurat în bullet-uri dense cu metrici bolded: „€2M+ prevented", „25% reduction in customer-impacting defects", „50% faster issue resolution", „40% faster testing cycles", „35% faster releases", „85% manual ERP testing reduction", „€500K+ annual operational savings", „90% automated coverage", „500+ critical workflows", „2B+ annual passenger journeys", „~60% feedback loop cut", „zero production failures", „mentored 5+ junior QA engineers".
- **Featured Projects** — TOKERO și DB project summaries refăcute cu aceleași metrici.

Toate cifrele sunt deja publice pe site portfolio, deci consistent cu povestea expusă acolo.

### Iterația 10 — Calibrare numere & eliminare claim-uri ne-defendabile

Aliniat numerele cu ceea ce poți susține la interviu fără ambiguitate:

- **„90% automated coverage" → „55% automated coverage"** (atât în CV bullet DB, cât și în Summary, Featured Projects DB, și în site `page.tsx` linia `efficiency`).
- **„2B+ annual passenger journeys"** scos din bullet-ul DB (rămâne `500+ critical workflows` care e tot puternic, dar verificabil).
- **„saving an estimated €500K+ annually in operational efficiency"** scos atât din CV cât și din site (keyAchievement DB).
- **„achieved zero production failures since CI/CD testing integration"** scos atât din CV cât și din site (highlight DB).
- **Bullet UAT integral** scos din DB experience: „Facilitate UAT with cross-functional agile teams; champion shift-left testing — ~30% reduction in defects reaching staging." Aliniat și Summary CV — scos „~30% reduction in defects reaching staging" din linia agregat.
- **„(100K+ users, 27 markets)"** scos din toate cele 3 locuri în CV (Summary, TOKERO subline, Featured Projects TOKERO) și din site (descriere TOKERO linia 62).

Motivația: rămân doar cifrele pe care le poți apăra pas-cu-pas la interviu. Nu mai ai disonanță între ce zice CV-ul și ce poți demonstra concret în 30 de minute.

### Iterația 11 — Secțiune nouă „Architecture & Approach" pe site + disclaimer CV redirecționat

**Context:** disclaimerul *„Project specifics anonymized where covered by NDA. Public-facing summaries — full architecture diagrams and demos available on request."* din Featured Projects suna defensiv. Mai bine îl transformăm într-un atu: redirecționăm recrutorul către o secțiune dedicată pe site, unde arată exact patternurile și arhitectura — fără disclosure la business logic.

**În CV** — disclaimerul înlocuit cu:
> „Architecture overviews, design patterns, framework structure, and AI-augmented workflows for these projects are documented in detail on my portfolio site (see Architecture & Approach section)."

**Pe site** — secțiune nouă `#architecture` între *Featured Projects* și *Technical Skills*, cu:

- **Intro:** „How I architect end-to-end QA stacks — design patterns, layering, and tooling choices. Generalized from production work (business logic, scenario names, internal endpoints, and customer-specific data omitted)."
- **Card Functional Automation** (Playwright .NET / C#): pattern POM + HybridFixture + lazy POs, capabilități cross-browser / multi-environment / 10 locale / HAR & screenshot, KPI tracking (TTFB / LCP / FCP / CLS), CI/CD GitLab + Azure Key Vault + source generator pentru rute.
- **Card Performance Suite** (NBomber 6.x): scenarii API / endurance / SignalR / saturation; infra cu client pools, custom sinks, auth semaphores, error class taxonomy; ~25 profiles pe tier-uri (Quick / Progressive / CDN-safe / Standard / Stress); observabilitate Grafana + Prometheus + Sentry + pod-distribution tracking.
- **Card Reporting Platform** (Blazor Server): arhitectură 4-tier Core / Data / Web / Tests cu zero deps externe în Core; MudBlazor + Blazor-ApexCharts; storage dual-provider SQLite local + PostgreSQL Supabase prod; flaky detection + 10% regression threshold.
- **Callout Railway QA Stack** (separate engagement): Karate BDD Java + Playwright UI TypeScript + GitLab CI + 500+ workflows.
- **Callout AI-Augmented Authoring Loop**: 5+ custom Claude Code skills (/generate-page, /generate-test, /verify-test, /debug-failure), Playwright MCP pentru verificare agentică, subagent roles planner / generator / reviewer, plan-first / spec-driven.

**Ce am EVITAT să expun** (deși am avut acces la repo-uri):

- Numele de scenarii care dezvăluie business logic (auth_api, kyc_upload, card_deposit, withdrawal, exchange_api etc.).
- Conturi test, parole, 2FA codes.
- URL-uri interne (grafana.tokero.dev, conexiuni etc.).
- Connection strings sau orice credentials.
- Fișiere `connection-string-*.txt` de la root-ul folderului GitLab — nu le-am atins.
- Logic specific clienților (Paylands onramp, OCR processing etc.).

**Navigare:** adăugat link „Architecture" în meniul desktop și mobile, între „Projects" și „Skills".

**Verificare:** `tsc --noEmit` curat, DOCX validat, PDF regenerat.

### Iterația 12 — Folder-tree diagrame + corectări factuale

**Adăugat:** sub-secțiune „Structure" în fiecare din cele 3 carduri (qaatpw / perf / pulse) cu folder-tree monospace pe fundal `bg-black/30 rounded-lg`, cu comentarii inline ce explică rolul fiecărui folder.

**Tree-urile sunt extrase din repo-ul real**, dar sanitizate prudent:

- **qaatpw** afișează: Fixtures, Pages, Tests, Helpers, Workflows, Metrics, Config, Data, Prompts (9 din 14 reale). Omise: Parrallelization (cu typo în repo), Properties (metadata), Reports (output), TestsSocialFi (specific la feature), docs.
- **perf** afișează: Scenarios (Api / Endurance / SignalR — toate 3 reale), Infrastructure (6 din 10 subfoldere reale), Profiles, Dashboard, TestData. Omise pentru lungime: Config, Database, Http, SignalR din Infrastructure.
- **pulse** afișează: Core (cu toate 5 subfolderele reale — Constants, Interfaces, Models, Services, Utils), Data, Web (cu Components, Controllers, Services), Tests — toate exacte 100%.

**Toate trei tree-urile pornesc consistent de la numele repo-ului** (`qaatpw/`, `perf/`, `pulse/`) și au `.slnx` file la final ca leaf — convenție vizuală uniformă.

**Corectură factuală:** „71 test classes" → **„49 test classes"** peste tot (CV summary, TOKERO experience, Featured Projects, site sub-project metrics, keyAchievements, folder tree, MD jurnal). Verificat cu `find Tests/ TestsSocialFi/ -name "*Tests.cs"` = 49.

Cifrele rămase verificate corecte:
- **77 Page Objects** ✓ (find Pages/ -name "*Page.cs" = 77)
- **36 load profiles** ✓ (ls Profiles/ = 36)
- **11 performance scenarios** ✓ (per README)

### Iterația 13 — Folder trees pe Railway QA Stack și AI-Augmented Authoring Loop

Pentru consistență vizuală, am adăugat folder-tree și în cele 2 callout-uri laterale.

**Railway QA Stack** — Nu am acces la repo-ul DB (engagement separat la Heaven Solutions), deci structura este **reprezentativă, generalizată**, cu disclaimer explicit:

```
railway-qa/
├── api-tests/             // Karate (BDD, Java)
│   ├── features/          // .feature files by domain
│   ├── stepdefs/          // Step definitions
│   └── karate-config.js
├── ui-tests/              // Playwright (TypeScript)
│   ├── pages/             // POs (Angular + SAP GUI)
│   ├── tests/             // Specs by feature
│   └── playwright.config.ts
├── reports/               // Allure + JUnit XML
└── .gitlab-ci.yml         // Parallel exec + XRay sync
```

Cu nota: *„Generalized layout — actual project follows the same Karate (API) + Playwright (UI) split, sanitized."*

**AI-Augmented Authoring Loop** — Structura **reală** din `qaatpw/.claude/`, cu 9 skills active:

```
qaatpw/.claude/
├── skills/
│   ├── generate-page/      // Scaffold PO from Razor
│   ├── generate-test/      // Test class from PO
│   ├── verify-test/        // Playwright MCP check
│   ├── debug-failure/      // RCA assistance
│   ├── review-test/        // Code review pass
│   ├── playwright-devops/  // CI/CD assistant
│   ├── docs-maintainer/    // Docs sync
│   ├── runner-host-ops/    // Runner / infra ops
│   └── skill-creator/      // Meta — builds skills
├── hooks/                  // Pre/post commit hooks
├── team-memory/            // Shared team context
└── settings.json           // MCP + tool config
```

Cu nota: *„9 production skills active in the test repo — Playwright MCP + Supabase MCP wired in."*

Acum toate cele 5 panouri din *Architecture & Approach* au tree-uri consistente, cu border-top discret între text și tree. Verificare `tsc --noEmit` curat.

### Iterația 14 — Domeniu aserban.ro sincronizat peste tot

Andrei a achiziționat `aserban.ro`. Aliniat peste 5 puncte de touch:

**CV (build_cv.js):**
- Header: adăugat `aserban.ro` ca link extern lângă LinkedIn — `Iași · phone · email · LinkedIn · aserban.ro`.
- Featured Projects disclaimer: schimbat din „on my portfolio site (see Architecture & Approach section)" în „on my portfolio at aserban.ro (see Architecture & Approach section)".

**Site (layout.tsx metadata):**
- `metadataBase`: nou — `new URL("https://aserban.ro")`, ca toate URL-urile relative să fie absolute.
- `alternates.canonical`: `https://aserban.ro` — pentru SEO canonical signal.
- `openGraph.url`: schimbat din `qa-portfolio-serban.vercel.app` în `https://aserban.ro`.
- `description`: rescrisă din „3+ years experience…" în varianta nouă cu „5+ years in tech, concurrent senior engagements at TOKERO and Heaven Solutions / Deutsche Bahn".
- `keywords`: expandate cu „Test Architect", „C#", „.NET", „Karate API", „NBomber", „Blazor", „AI-Augmented QA", „Claude Code", „Playwright MCP".
- `authors`: adăugat `url: "https://aserban.ro"`.
- `og.title` și `twitter.title` actualizate cu „Senior QA Automation Engineer & Test Architect".

**Site (page.tsx Contact section):**
- Adăugat al 3-lea card sub LinkedIn și Email: card cyan cu icon globe pentru `aserban.ro`, link `target="_blank" rel="noopener noreferrer"`, hover state diferit de celelalte (cyan tones), aria-label corespunzător.

**Site (footer):**
- Schimbat din „© 2025 Șerban Andrei. Built with Next.js and Tailwind CSS." în „© 2026 Șerban Andrei · aserban.ro · Built with Next.js and Tailwind CSS." cu linkul `aserban.ro` clickabil cu hover amber.

**Verificare:** `tsc --noEmit` curat, DOCX validat, PDF regenerat (vezi preview).

### Iterația 15 — JSON-LD structured data (Person + WebSite schema)

Adăugat schema.org structured data în `layout.tsx`, injectat ca două tag-uri `<script type="application/ld+json">` în `<body>`. Ajută Google să construiască un knowledge panel pentru *„Andrei Șerban QA"* și îmbunătățește semnalele de rich results.

**Person schema** include:
- `name`, `alternateName`, `jobTitle: "Senior QA Automation Engineer & Test Architect"`
- `email`, `url: aserban.ro`, `image: og-image.jpg`
- `description` (rezumat aliniat cu CV summary)
- `address` (Iași, RO) + `nationality` (Romania)
- `sameAs` (LinkedIn profile)
- `worksFor` (TOKERO + Heaven Solutions cu URL-uri)
- `knowsAbout` (22 skills tech-relevante)
- `hasCredential` (ISTQB CTFL + PSM I cu `recognizedBy`)
- `alumniOf` (Gheorghe Asachi cu URL-ul facultății)
- `knowsLanguage` (RO, EN, FR)

**WebSite schema** include:
- `name`, `url`, `description`, `inLanguage: "en-US"`
- `author` referință la `#person`

Excluse intenționat: număr de telefon (mai sensibil decât emailul, evităm scraping de phone bots).

Beneficii estimate:
- Knowledge panel în Google search („Andrei Șerban QA")
- Rich results cu poza, jobTitle, employer
- Posibile snippet-uri direct în SERPs (în special pentru cariera + certificări)

**Verificare:** `tsc --noEmit` curat. Pentru validare reală a schemei după deploy: rulează prin [Google Rich Results Test](https://search.google.com/test/rich-results) cu URL-ul aserban.ro.

---

## CV — versiunea finală

# Andrei Șerban
**Senior QA Automation Engineer · Test Architect**

Iași, Romania · +40 758 242 526 · [andre.serban96@gmail.com](mailto:andre.serban96@gmail.com) · [LinkedIn](https://www.linkedin.com/in/șerban-andrei-5a14a51a5)

---

Senior QA Automation Engineer & Test Architect with two concurrent senior engagements. At TOKERO (European crypto exchange) I am sole architect of the QA stack — Playwright (.NET / C#), NBomber, and a custom Blazor reporting platform. At Heaven Solutions I lead automation for the Deutsche Bahn SAP ERP Integrated Railway Management System — Karate API automation suite and Playwright UI framework. **Across both engagements: 5 production QA frameworks, 55% automated coverage, ~60% faster feedback loops, and €2M+ in prevented system failures.** Active practitioner of AI-augmented QA: Claude Code skills, MCP integrations (Playwright, Supabase), and spec-driven automation. I mentor junior QA engineers and treat quality as a shared responsibility — not a gate.

---

## Core Competencies

- **Testing Frameworks** — Playwright (TypeScript & .NET), Selenium WebDriver, Karate API, NBomber, TestNG, JUnit, xUnit / NUnit, Cucumber / BDD
- **Languages** — TypeScript, JavaScript, Java, C# / .NET Core, SQL
- **AI-Augmented QA** — Claude Code, Custom Skill Authoring (`.claude/skills`), MCP Integration (Playwright, Supabase), Subagent-Driven Test Development, AI-Assisted Test Generation & RCA, Prompt Engineering for QA, Spec-Driven / Plan-First Automation
- **Platforms & DevOps** — Docker, Kubernetes, GitLab CI/CD, Jenkins, Azure DevOps, OpenLens, Grafana, Kibana, Prometheus
- **API & Integration** — Postman, ReadyAPI, SoapUI, Swagger, SignalR / WebSocket testing
- **Test Management** — Jira, XRay, Confluence, Polarion, Bugzilla / Deskzilla
- **Databases** — MariaDB, PostgreSQL, Oracle, SQL query authoring for back-end validation
- **Methodologies** — Agile / Scrum (PSM I), BDD, Shift-Left Testing, Risk-Based Testing, UAT facilitation, Root Cause Analysis

---

## Professional Experience

### Senior QA Automation Engineer & Test Architect · TOKERO Crypto Exchange
*Jul 2025 – Present · Concurrent senior engagement · European cryptocurrency exchange · 150+ coins*

- **Sole architect & owner** of **3 production QA systems**: the **Playwright (.NET / C#) functional framework** in production since 2025, plus the **NBomber performance suite** and a custom **Blazor reporting & dashboard platform** — both shipped to production in 2026.
- **77 Page Objects, 49 test classes, 11 performance scenarios, and 27 performance profiles** owned and maintained end-to-end across the QA estate.
- Built the in-house **pulse** reporting platform from scratch (C#, .NET 10, Blazor, EF Core) with candlestick + trend analytics, flaky-test detection, and a 10% regression threshold — gave product, ops, and compliance stakeholders live visibility into release readiness.
- Authored **5+ custom Claude Code skills** now standard for test and Page Object generation across the QA team; integrated Playwright MCP for agentic UI verification — first AI-augmented test authoring workflow at TOKERO.
- Designed test architecture for high-throughput trading flows, KYC / onboarding paths, and multi-market deposit / withdrawal logic across 27 jurisdictions.
- Built the first real Blazor SignalR independent-circuit perf scenario in the codebase — closed a load-test gap that NBomber didn't cover out of the box.
- *Stack:* Playwright .NET, C#, .NET 10, Blazor, MudBlazor, ApexCharts, NBomber, EF Core, PostgreSQL (Supabase), Azure Key Vault, GitLab CI/CD, Claude Code, Playwright MCP, Git.

### QA Automation Engineer · Heaven Solutions · Deutsche Bahn (SAP ERP IRMS)
*Jan 2023 – Present · Iași, Romania · SAP ERP Integrated Railway Management System for Europe's largest transportation network*

- **Architect & owner** of the QA automation stack for the Deutsche Bahn SAP ERP Integrated Railway Management System: **Karate-based API regression suite (BDD, Java)** and **Playwright UI automation framework (TypeScript)**. **55% automated coverage** protecting **500+ critical workflows**, aligned with Germany's €40B transportation modernization program.
- Prevented **€2M+** in potential system failures through proactive defect detection; reduced customer-impacting defects by **25%** and slashed critical issue resolution time by **50%** via advanced monitoring and rapid diagnosis.
- **40% faster testing cycles** and **35% faster releases** by replacing legacy Selenium with Playwright; slashed manual ERP testing by **85%**.
- Leading the automation team; led 15+ engineers in critical system bug resolution and **mentored 5+ junior QA engineers** on test design, framework architecture, and code review.
- Built E2E Selenium / Java / Cucumber suites for legacy modules; integrated everything into **GitLab CI/CD** with parallelized execution — cut feedback loops by **~60%** on long suites.
- Live-debug production issues using Kibana, Grafana, and OpenLens against the Kubernetes cluster; author SQL validation queries against MariaDB to confirm developer implementations.
- *Stack:* Karate, Playwright, TypeScript, Java, Angular, Java Spring Boot, SAP GUI, Postman, Selenium, Cucumber, JUnit, MariaDB, SQL, Git, Kubernetes, Docker, OpenLens, Grafana, Kibana, Swagger, XRay, Jira, Confluence.

### Software Tester (on-site, Germany) · Heaven Solutions · DentsplySirona
*May 2022 – Dec 2022 · Bensheim, Hessen, Germany · Medical device CAD/CAM software & hardware testing*

- Led precision testing for medical manufacturing systems with ±0.001mm accuracy requirements; 100% on-time deliverables.
- Resolved 100+ critical defects with high-clarity bug reports, reducing developer resolution time by ~40% on CAD/CAM workflows.
- Acted as interim team lead and primary point of contact for the client during the incumbent's absence.
- Acceptance, regression, sanity, and functional / performance testing on both software and hardware; Linux-server checks on Storage Hubs; SQL back-end validation.
- Participated in Root Cause Analysis sessions; supported the test manager on test plans, test points, and TPFs; built executive-facing reports.
- *Tools:* CAD/CAM software & hardware, SQL, PostgreSQL, Oracle, GitLab, GitHub, Postman, Polarion, Bugzilla / Deskzilla, Jira, MS Office.

### Junior Web Developer · Display Events Agency · Happy Media
*May 2021 – May 2022 · Iași, Romania · Full-service advertising agency, 200+ SMEs, 2000+ campaigns across Eastern Europe*

- Delivered web platforms that helped raise client acquisition by 35% and reduce manual work by 80% for the agency's campaign operations.
- Maintained 99.9% uptime across SME campaign sites; authored installation, execution, and maintenance documentation; tested every release before QA hand-off.
- Active participant in team brainstorming, scoping, and post-mortems.
- *Stack:* HTML, CSS, JavaScript, Angular, Java, WordPress, Elementor, cPanel, PHP.

### Intern — Junior System Administrator · RLogicDesign
*Jun 2017 – Sep 2017 · Bacău, Romania*

- Maintained Windows and network systems; software deployment, install, and troubleshooting for printers and end-user devices.

---

## Featured Projects

> Project specifics anonymized where covered by NDA. Public-facing summaries — full architecture diagrams and demos available on request.

### TOKERO QA Automation Platform
*Ongoing · Sole architect & owner · Senior QA / Test Architect role at TOKERO*

- End-to-end automation stack for a European crypto exchange: Playwright (.NET / C#) functional framework — **77 Page Objects, 49 test classes** (in production since 2025); NBomber performance suite — **11 scenarios, 27 profiles**, incl. first real Blazor SignalR perf scenario; and a custom Blazor reporting platform (C#, .NET 10) — both shipped to production in 2026.

### Deutsche Bahn — SAP ERP Integrated Railway Management System QA Automation Framework
*Ongoing · Architect & owner · Heaven Solutions client engagement*

- Sole architect & owner of the QA automation stack supporting Europe's largest transportation network: Karate-based API regression suite (BDD, Java) and Playwright UI automation framework (TypeScript). **€2M+ prevented system failures**, **55% automated coverage**, **40% faster testing cycles**, **35% faster releases**, and **85% reduction in manual ERP testing** — aligned with Germany's €40B transportation modernization program. *Stack:* Karate, Playwright, Angular, Java Spring Boot, SAP GUI.

### DentsplySirona — Medical Device CAD/CAM Testing
*Delivered*

- Precision testing for medical manufacturing systems with ±0.001mm tolerance; 100% on-time deliverables as interim team lead during critical product launches.

### Happy Media — Digital Campaign Management Platform
*Delivered*

- Built and maintained a campaign platform serving 200+ SMEs across Eastern Europe; 99.9% uptime, 35% lift in client acquisition rates, 80% reduction in manual ops work.

---

## AI-Augmented QA Practice

Active practitioner and advocate for AI in software quality. Current work and obsessions:

- **Custom Claude Code skill authoring** (`.claude/skills`) — encoding team standards into reusable, repo-aware skills that scale across QA engineers.
- **MCP integrations** — Playwright MCP for agentic UI testing; Supabase MCP for data-aware regression flows.
- **Subagent-driven test development** — orchestrating specialist agents (planner, generator, reviewer) for higher-quality test artifacts.
- **AI-assisted test generation, debugging & RCA** — using LLMs to draft failing tests from specs and to triage flaky runs faster.
- **Plan-first / spec-driven automation** — flipping the order: specs → executable plans → implementation, so tests stay aligned with intent.
- **Visual-regression workflows & Playwright MCP** — current build-out for higher-confidence UI parity at scale.

---

## Education & Certifications

### Engineer, Electronics & Automation
*"Gheorghe Asachi" Technical University of Iași · 2015 – 2020*

MATLAB, Arduino, Assembler, MAX+PLUS II, Java SE, Networking, FEMM (electromagnetic / magnetic fields), team operations.

### General Certificate of Highschool
*Colegiul Național "Vasile Alecsandri", Bacău · 2011 – 2015*

Computer science track — C++, algorithms, Office, team work.

### Certifications

- **ISTQB® Certified Tester Foundation Level (CTFL)** — Brightest, 2022. *Black / white-box, test design, test management, risk & maintenance testing.*
- **Professional Scrum Master™ I (PSM I)** — Scrum.org, 2023. *Empiricism, Scrum values, self-managing teams, product agility.*
- **Google Developer Challenge Scholarship** — Basic Android (Udacity, sponsored by Google).

### Continuous Learning

- 12+ specialized testing & engineering courses completed.
- Active: Playwright at expert level (3+ years hands-on), GitLab CI/CD daily, container technologies in production, API testing core competency.
- Currently exploring: AI testing tools and visual regression testing; advancing toward Tech / QA Lead via strategic test leadership, mentoring, and enterprise-scale automation frameworks.

---

## Languages

- **Romanian** — Native.
- **English** — C1 (Listening, Reading, Spoken interaction); B2 (Spoken production, Writing).
- **French** — B2 (Listening, Reading); B1 (Speaking, Writing).

---

## Beyond Tech

Parallel career in human movement and recovery, ongoing since 2018:

- **Massage Therapist** (self-employed, 2019 – June 2024) — therapeutic, cupping, scraping, fascial release.
- **Physiotherapist** — National Individual Championships U18, Concord Service Center (2020).
- **Personal Trainer & Fitness Instructor** — Young Gym, Motivation Gym, Vivertine (2018 – 2022). Accredited PT Level 1, Fitness Scandinavia.
- **Specialized training** — Foundational MAT / Dynamic Lower Body (Erik Dalton), Heavenly Head Massage (Thai Healing Massage Academy), Human Optimization (Functional Patterns by Naudi Aguilar), Technician Masseur Supramodul I & II (final grade 10).

This dual focus shapes how I approach engineering: with patience, attention to body language in meetings, and the conviction that systems — software or human — perform best when well-aligned and given space to recover.

---

## Other

- **Driving licences** — AM · B1 · B
- **Date of birth** — 31 May 1996 · **Nationality** — Romanian

---

*Generated on 13 May 2026. Files: `Andrei-Serban-CV.pdf`, `Andrei-Serban-CV.docx`, `CV-Changes-and-Final.md` — kept as single point of truth in `/qa-portfolio/`.*
