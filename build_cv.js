// CV builder for Andrei Șerban - Senior QA Automation Engineer / Test Architect
// Combines info from: Andrei CV.pdf (Europass), Andrei Serban-CV.pdf (visual), portfolio site

const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, ExternalHyperlink, TabStopType, TabStopPosition,
  HeadingLevel, BorderStyle, WidthType, ShadingType, PageBreak
} = require('docx');

// ---------- Color & spacing tokens ----------
const ACCENT = "B45309";     // amber-700 — mirrors portfolio
const ACCENT_DARK = "78350F"; // amber-900 for headings
const INK = "1F2937";        // slate-800 — body text
const MUTED = "6B7280";      // gray-500 — meta info
const RULE = "D1D5DB";       // gray-300 — hairline rule

const DATE = "May 2026"; // for footer

// ---------- Reusable helpers ----------

// Hairline divider as paragraph with bottom border (NOT a table)
const ruleParagraph = () => new Paragraph({
  spacing: { before: 0, after: 60 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 1 } },
  children: [new TextRun("")]
});

// Section heading
const sectionHeading = (text) => new Paragraph({
  spacing: { before: 240, after: 80 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 2 } },
  children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 24, color: ACCENT_DARK, font: "Calibri", characterSpacing: 30 })]
});

// Role line: bold company / role with right-aligned dates
const roleLine = (role, company, dates) => new Paragraph({
  spacing: { before: 140, after: 20 },
  tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
  children: [
    new TextRun({ text: role, bold: true, size: 22, color: INK, font: "Calibri" }),
    new TextRun({ text: "  ·  ", color: MUTED, size: 22, font: "Calibri" }),
    new TextRun({ text: company, italics: true, color: INK, size: 22, font: "Calibri" }),
    new TextRun({ text: "\t" + dates, color: MUTED, size: 20, font: "Calibri" }),
  ]
});

// Role sub-line: location + context
const roleSubline = (text) => new Paragraph({
  spacing: { before: 0, after: 60 },
  children: [new TextRun({ text, italics: true, color: MUTED, size: 19, font: "Calibri" })]
});

// Body paragraph
const body = (text, opts = {}) => new Paragraph({
  spacing: { before: opts.before ?? 60, after: opts.after ?? 60 },
  children: [new TextRun({ text, size: 21, color: INK, font: "Calibri" })]
});

// Bullet
const bullet = (parts) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  spacing: { before: 30, after: 30, line: 280 },
  children: parts.map(p => typeof p === 'string'
    ? new TextRun({ text: p, size: 21, color: INK, font: "Calibri" })
    : new TextRun({ ...p, size: 21, font: "Calibri" })
  )
});

// Skill row (label : value)
const skillRow = (label, value) => new Paragraph({
  spacing: { before: 40, after: 40, line: 280 },
  indent: { left: 0 },
  children: [
    new TextRun({ text: label + "  ", bold: true, size: 21, color: ACCENT_DARK, font: "Calibri" }),
    new TextRun({ text: value, size: 21, color: INK, font: "Calibri" }),
  ]
});

// ---------- Header block ----------

const nameHeader = new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 0, after: 40 },
  children: [
    new TextRun({ text: "Andrei Șerban", bold: true, size: 48, color: INK, font: "Calibri" }),
  ]
});

const roleHeader = new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 0, after: 80 },
  children: [
    new TextRun({ text: "Senior QA Automation Engineer  ·  Test Architect", size: 26, color: ACCENT, font: "Calibri" }),
  ]
});

const contactLine = new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 0, after: 60 },
  children: [
    new TextRun({ text: "Iași, Romania", size: 20, color: MUTED, font: "Calibri" }),
    new TextRun({ text: "  ·  ", size: 20, color: MUTED, font: "Calibri" }),
    new TextRun({ text: "+40 758 242 526", size: 20, color: MUTED, font: "Calibri" }),
    new TextRun({ text: "  ·  ", size: 20, color: MUTED, font: "Calibri" }),
    new ExternalHyperlink({
      children: [new TextRun({ text: "andre.serban96@gmail.com", size: 20, color: ACCENT, font: "Calibri", underline: {} })],
      link: "mailto:andre.serban96@gmail.com",
    }),
    new TextRun({ text: "  ·  ", size: 20, color: MUTED, font: "Calibri" }),
    new ExternalHyperlink({
      children: [new TextRun({ text: "LinkedIn", size: 20, color: ACCENT, font: "Calibri", underline: {} })],
      link: "https://www.linkedin.com/in/șerban-andrei-5a14a51a5",
    }),
    new TextRun({ text: "  ·  ", size: 20, color: MUTED, font: "Calibri" }),
    new ExternalHyperlink({
      children: [new TextRun({ text: "aserban.ro", size: 20, color: ACCENT, font: "Calibri", underline: {} })],
      link: "https://aserban.ro",
    }),
  ]
});

// ---------- Summary ----------

const summary = new Paragraph({
  spacing: { before: 0, after: 120, line: 300 },
  alignment: AlignmentType.LEFT,
  children: [
    new TextRun({
      text: "Senior QA Automation Engineer & Test Architect with two concurrent senior engagements. At TOKERO (European crypto exchange) I am sole architect of the QA stack — Playwright (.NET / C#), NBomber, and a custom Blazor reporting platform. At Heaven Solutions I lead automation for the Deutsche Bahn SAP ERP Integrated Railway Management System — Karate API automation suite and Playwright UI framework. Across both engagements: 5 production QA frameworks, 55% automated coverage, ~60% faster feedback loops, and €2M+ in prevented system failures. Active practitioner of AI-augmented QA: Claude Code skills, MCP integrations (Playwright, Supabase), and spec-driven automation. I mentor junior QA engineers and treat quality as a shared responsibility — not a gate.",
      size: 21, color: INK, font: "Calibri"
    })
  ]
});

// ---------- Core Competencies ----------

const skillsBlock = [
  sectionHeading("Core Competencies"),
  skillRow("Testing Frameworks", "Playwright (TypeScript & .NET), Selenium WebDriver, Karate API, NBomber, TestNG, JUnit, xUnit / NUnit, Cucumber / BDD"),
  skillRow("Languages", "TypeScript, JavaScript, Java, C# / .NET Core, SQL"),
  skillRow("AI-Augmented QA", "Claude Code, Custom Skill Authoring (.claude/skills), MCP Integration (Playwright, Supabase), Subagent-Driven Test Development, AI-Assisted Test Generation & RCA, Prompt Engineering for QA, Spec-Driven / Plan-First Automation"),
  skillRow("Platforms & DevOps", "Docker, Kubernetes, GitLab CI/CD, Jenkins, Azure DevOps, OpenLens, Grafana, Kibana, Prometheus"),
  skillRow("API & Integration", "Postman, ReadyAPI, SoapUI, Swagger, SignalR / WebSocket testing"),
  skillRow("Test Management", "Jira, XRay, Confluence, Polarion, Bugzilla / Deskzilla"),
  skillRow("Databases", "MariaDB, PostgreSQL, Oracle, SQL query authoring for back-end validation"),
  skillRow("Methodologies", "Agile / Scrum (PSM I), BDD, Shift-Left Testing, Risk-Based Testing, UAT facilitation, Root Cause Analysis"),
];

// ---------- Experience ----------

const experienceBlock = [
  sectionHeading("Professional Experience"),

  roleLine("Senior QA Automation Engineer & Test Architect", "TOKERO Crypto Exchange", "Jul 2025 – Present"),
  roleSubline("Concurrent senior engagement  ·  European cryptocurrency exchange  ·  150+ coins"),
  bullet([{ text: "Sole architect & owner", bold: true, color: INK }, { text: " of ", color: INK }, { text: "3 production QA systems", bold: true, color: INK }, { text: ": the ", color: INK }, { text: "Playwright (.NET / C#) functional framework", bold: true, color: INK }, { text: " in production since 2025, plus the ", color: INK }, { text: "NBomber performance suite", bold: true, color: INK }, { text: " and a custom ", color: INK }, { text: "Blazor reporting & dashboard platform", bold: true, color: INK }, { text: " — both shipped to production in 2026.", color: INK }]),
  bullet([{ text: "77 Page Objects, 49 test classes, 11 performance scenarios, and 27 performance profiles", bold: true, color: INK }, { text: " owned and maintained end-to-end across the QA estate.", color: INK }]),
  bullet([{ text: "Built the in-house ", color: INK }, { text: "pulse", bold: true, color: INK }, { text: " reporting platform from scratch (C#, .NET 10, Blazor, EF Core) with candlestick + trend analytics, flaky-test detection, and a 10% regression threshold — gave product, ops, and compliance stakeholders live visibility into release readiness.", color: INK }]),
  bullet([{ text: "Authored ", color: INK }, { text: "5+ custom Claude Code skills", bold: true, color: INK }, { text: " now standard for test and Page Object generation across the QA team; integrated Playwright MCP for agentic UI verification — first AI-augmented test authoring workflow at TOKERO.", color: INK }]),
  bullet([{ text: "Designed test architecture for high-throughput trading flows, KYC / onboarding paths, and multi-market deposit / withdrawal logic across 27 jurisdictions.", color: INK }]),
  bullet([{ text: "Built the first real Blazor SignalR independent-circuit perf scenario in the codebase — closed a load-test gap that NBomber didn't cover out of the box.", color: INK }]),
  bullet([{ text: "Stack: ", italics: true, color: MUTED }, { text: "Playwright .NET, C#, .NET 10, Blazor, MudBlazor, ApexCharts, NBomber, EF Core, PostgreSQL (Supabase), Azure Key Vault, GitLab CI/CD, Claude Code, Playwright MCP, Git.", italics: true, color: MUTED }]),

  roleLine("QA Automation Engineer", "Heaven Solutions  ·  Deutsche Bahn (SAP ERP IRMS)", "Jan 2023 – Present"),
  roleSubline("Iași, Romania  ·  SAP ERP Integrated Railway Management System for Europe's largest transportation network"),
  bullet([{ text: "Architect & owner", bold: true, color: INK }, { text: " of the QA automation stack for the Deutsche Bahn SAP ERP Integrated Railway Management System: ", color: INK }, { text: "Karate-based API regression suite (BDD, Java)", bold: true, color: INK }, { text: " and ", color: INK }, { text: "Playwright UI automation framework (TypeScript)", bold: true, color: INK }, { text: ". ", color: INK }, { text: "55% automated coverage", bold: true, color: INK }, { text: " protecting ", color: INK }, { text: "500+ critical workflows", bold: true, color: INK }, { text: ", aligned with Germany's €40B transportation modernization program.", color: INK }]),
  bullet([{ text: "Prevented ", color: INK }, { text: "€2M+", bold: true, color: INK }, { text: " in potential system failures through proactive defect detection; reduced customer-impacting defects by ", color: INK }, { text: "25%", bold: true, color: INK }, { text: " and slashed critical issue resolution time by ", color: INK }, { text: "50%", bold: true, color: INK }, { text: " via advanced monitoring and rapid diagnosis.", color: INK }]),
  bullet([{ text: "40% faster testing cycles", bold: true, color: INK }, { text: " and ", color: INK }, { text: "35% faster releases", bold: true, color: INK }, { text: " by replacing legacy Selenium with Playwright; slashed manual ERP testing by ", color: INK }, { text: "85%", bold: true, color: INK }, { text: ".", color: INK }]),
  bullet([{ text: "Leading the automation team; led 15+ engineers in critical system bug resolution and ", color: INK }, { text: "mentored 5+ junior QA engineers", bold: true, color: INK }, { text: " on test design, framework architecture, and code review.", color: INK }]),
  bullet([{ text: "Built E2E Selenium / Java / Cucumber suites for legacy modules; integrated everything into ", color: INK }, { text: "GitLab CI/CD", bold: true, color: INK }, { text: " with parallelized execution — cut feedback loops by ", color: INK }, { text: "~60%", bold: true, color: INK }, { text: " on long suites.", color: INK }]),
  bullet([{ text: "Live-debug production issues using Kibana, Grafana, and OpenLens against the Kubernetes cluster; author SQL validation queries against MariaDB to confirm developer implementations.", color: INK }]),
  bullet([{ text: "Stack: ", italics: true, color: MUTED }, { text: "Karate, Playwright, TypeScript, Java, Angular, Java Spring Boot, SAP GUI, Postman, Selenium, Cucumber, JUnit, MariaDB, SQL, Git, Kubernetes, Docker, OpenLens, Grafana, Kibana, Swagger, XRay, Jira, Confluence.", italics: true, color: MUTED }]),

  roleLine("Software Tester (on-site, Germany)", "Heaven Solutions  ·  DentsplySirona", "May 2022 – Dec 2022"),
  roleSubline("Bensheim, Hessen, Germany  ·  Medical device CAD/CAM software & hardware testing"),
  bullet([{ text: "Led precision testing for medical manufacturing systems with ±0.001mm accuracy requirements; 100% on-time deliverables.", color: INK }]),
  bullet([{ text: "Resolved 100+ critical defects with high-clarity bug reports, reducing developer resolution time by ~40% on CAD/CAM workflows.", color: INK }]),
  bullet([{ text: "Acted as interim team lead and primary point of contact for the client during the incumbent's absence.", color: INK }]),
  bullet([{ text: "Acceptance, regression, sanity, and functional/performance testing on both software and hardware; Linux-server checks on Storage Hubs; SQL back-end validation.", color: INK }]),
  bullet([{ text: "Participated in Root Cause Analysis sessions; supported the test manager on test plans, test points, and TPFs; built executive-facing reports.", color: INK }]),
  bullet([{ text: "Tools: ", italics: true, color: MUTED }, { text: "CAD/CAM software & hardware, SQL, PostgreSQL, Oracle, GitLab, GitHub, Postman, Polarion, Bugzilla / Deskzilla, Jira, MS Office.", italics: true, color: MUTED }]),

  roleLine("Junior Web Developer", "Display Events Agency  ·  Happy Media", "May 2021 – May 2022"),
  roleSubline("Iași, Romania  ·  Full-service advertising agency, 200+ SMEs, 2000+ campaigns across Eastern Europe"),
  bullet([{ text: "Delivered web platforms that helped raise client acquisition by 35% and reduce manual work by 80% for the agency's campaign operations.", color: INK }]),
  bullet([{ text: "Maintained 99.9% uptime across SME campaign sites; authored installation, execution, and maintenance documentation; tested every release before QA hand-off.", color: INK }]),
  bullet([{ text: "Active participant in team brainstorming, scoping, and post-mortems.", color: INK }]),
  bullet([{ text: "Stack: ", italics: true, color: MUTED }, { text: "HTML, CSS, JavaScript, Angular, Java, WordPress, Elementor, cPanel, PHP.", italics: true, color: MUTED }]),

  roleLine("Intern — Junior System Administrator", "RLogicDesign", "Jun 2017 – Sep 2017"),
  roleSubline("Bacău, Romania"),
  bullet([{ text: "Maintained Windows and network systems; software deployment, install, and troubleshooting for printers and end-user devices.", color: INK }]),
];

// ---------- Featured Projects ----------

const projectsBlock = [
  sectionHeading("Featured Projects"),
  body("Architecture overviews, design patterns, framework structure, and AI-augmented workflows are documented in detail on my portfolio at aserban.ro (see Architecture & Approach section).", { before: 0, after: 80 }),

  new Paragraph({
    spacing: { before: 80, after: 20 },
    children: [
      new TextRun({ text: "TOKERO QA Automation Platform", bold: true, size: 21, color: INK, font: "Calibri" }),
      new TextRun({ text: "  ·  Ongoing  ·  Sole architect & owner  ·  Senior QA / Test Architect role at TOKERO", size: 19, color: MUTED, font: "Calibri", italics: true }),
    ]
  }),
  bullet([{ text: "End-to-end automation stack for a European crypto exchange: Playwright (.NET / C#) functional framework — ", color: INK }, { text: "77 Page Objects, 49 test classes", bold: true, color: INK }, { text: " (in production since 2025); NBomber performance suite — ", color: INK }, { text: "11 scenarios, 27 profiles", bold: true, color: INK }, { text: ", incl. first real Blazor SignalR perf scenario; and a custom Blazor reporting platform (C#, .NET 10) — both shipped to production in 2026.", color: INK }]),

  new Paragraph({
    spacing: { before: 80, after: 20 },
    children: [
      new TextRun({ text: "Deutsche Bahn — SAP ERP Integrated Railway Management System QA Automation Framework", bold: true, size: 21, color: INK, font: "Calibri" }),
      new TextRun({ text: "  ·  Ongoing  ·  Architect & owner  ·  Heaven Solutions client engagement", size: 19, color: MUTED, font: "Calibri", italics: true }),
    ]
  }),
  bullet([{ text: "Sole architect & owner of the QA automation stack supporting Europe's largest transportation network: Karate-based API regression suite (BDD, Java) and Playwright UI automation framework (TypeScript). ", color: INK }, { text: "€2M+ prevented system failures", bold: true, color: INK }, { text: ", ", color: INK }, { text: "55% automated coverage", bold: true, color: INK }, { text: ", ", color: INK }, { text: "40% faster testing cycles", bold: true, color: INK }, { text: ", ", color: INK }, { text: "35% faster releases", bold: true, color: INK }, { text: ", and ", color: INK }, { text: "85% reduction in manual ERP testing", bold: true, color: INK }, { text: " — aligned with Germany's €40B transportation modernization program. Stack: Karate, Playwright, Angular, Java Spring Boot, SAP GUI.", color: INK }]),

  new Paragraph({
    spacing: { before: 80, after: 20 },
    children: [
      new TextRun({ text: "DentsplySirona — Medical Device CAD/CAM Testing", bold: true, size: 21, color: INK, font: "Calibri" }),
      new TextRun({ text: "  ·  Delivered", size: 19, color: MUTED, font: "Calibri", italics: true }),
    ]
  }),
  bullet([{ text: "Precision testing for medical manufacturing systems with ±0.001mm tolerance; 100% on-time deliverables as interim team lead during critical product launches.", color: INK }]),

  new Paragraph({
    spacing: { before: 80, after: 20 },
    children: [
      new TextRun({ text: "Happy Media — Digital Campaign Management Platform", bold: true, size: 21, color: INK, font: "Calibri" }),
      new TextRun({ text: "  ·  Delivered", size: 19, color: MUTED, font: "Calibri", italics: true }),
    ]
  }),
  bullet([{ text: "Built and maintained a campaign platform serving 200+ SMEs across Eastern Europe; 99.9% uptime, 35% lift in client acquisition rates, 80% reduction in manual ops work.", color: INK }]),
];

// ---------- AI-Augmented QA ----------

const aiBlock = [
  sectionHeading("AI-Augmented QA Practice"),
  body("Active practitioner and advocate for AI in software quality. Current work and obsessions:", { before: 0, after: 60 }),
  bullet([{ text: "Custom Claude Code skill authoring", bold: true, color: INK }, { text: " (.claude/skills) — encoding team standards into reusable, repo-aware skills that scale across QA engineers.", color: INK }]),
  bullet([{ text: "MCP integrations", bold: true, color: INK }, { text: " — Playwright MCP for agentic UI testing; Supabase MCP for data-aware regression flows.", color: INK }]),
  bullet([{ text: "Subagent-driven test development", bold: true, color: INK }, { text: " — orchestrating specialist agents (planner, generator, reviewer) for higher-quality test artifacts.", color: INK }]),
  bullet([{ text: "AI-assisted test generation, debugging & RCA", bold: true, color: INK }, { text: " — using LLMs to draft failing tests from specs and to triage flaky runs faster.", color: INK }]),
  bullet([{ text: "Plan-first / spec-driven automation", bold: true, color: INK }, { text: " — flipping the order: specs → executable plans → implementation, so tests stay aligned with intent.", color: INK }]),
  bullet([{ text: "Visual-regression workflows & Playwright MCP", bold: true, color: INK }, { text: " — current build-out for higher-confidence UI parity at scale.", color: INK }]),
];

// ---------- Education & Certifications ----------

const educationBlock = [
  sectionHeading("Education & Certifications"),
  roleLine("Engineer, Electronics & Automation", "\"Gheorghe Asachi\" Technical University of Iași", "2015 – 2020"),
  roleSubline("MATLAB, Arduino, Assembler, MAX+PLUS II, Java SE, Networking, FEMM (electromagnetic / magnetic fields), team operations."),
  roleLine("General Certificate of Highschool", "Colegiul Național \"Vasile Alecsandri\", Bacău", "2011 – 2015"),
  roleSubline("Computer science track — C++, algorithms, Office, team work."),

  new Paragraph({
    spacing: { before: 160, after: 40 },
    children: [new TextRun({ text: "Certifications", bold: true, size: 22, color: ACCENT_DARK, font: "Calibri" })]
  }),
  bullet([{ text: "ISTQB® Certified Tester Foundation Level (CTFL)", bold: true, color: INK }, { text: " — Brightest, 2022.  ", color: INK }, { text: "Black/white-box, test design, test management, risk & maintenance testing.", color: MUTED, italics: true }]),
  bullet([{ text: "Professional Scrum Master™ I (PSM I)", bold: true, color: INK }, { text: " — Scrum.org, 2023.  ", color: INK }, { text: "Empiricism, Scrum values, self-managing teams, product agility.", color: MUTED, italics: true }]),
  bullet([{ text: "Google Developer Challenge Scholarship", bold: true, color: INK }, { text: " — Basic Android (Udacity, sponsored by Google).", color: INK }]),

  new Paragraph({
    spacing: { before: 160, after: 40 },
    children: [new TextRun({ text: "Continuous Learning", bold: true, size: 22, color: ACCENT_DARK, font: "Calibri" })]
  }),
  bullet([{ text: "12+ specialized testing & engineering courses completed.", color: INK }]),
  bullet([{ text: "Active: Playwright at expert level (3+ years hands-on), GitLab CI/CD daily, container technologies in production, API testing core competency.", color: INK }]),
  bullet([{ text: "Currently exploring: AI testing tools and visual regression testing; advancing toward Tech / QA Lead via strategic test leadership, mentoring, and enterprise-scale automation frameworks.", color: INK }]),
];

// ---------- Languages ----------

const languagesBlock = [
  sectionHeading("Languages"),
  bullet([{ text: "Romanian", bold: true, color: INK }, { text: " — Native.", color: INK }]),
  bullet([{ text: "English", bold: true, color: INK }, { text: " — C1 (Listening, Reading, Spoken interaction); B2 (Spoken production, Writing).", color: INK }]),
  bullet([{ text: "French", bold: true, color: INK }, { text: " — B2 (Listening, Reading); B1 (Speaking, Writing).", color: INK }]),
];

// ---------- Beyond Tech ----------

const beyondTechBlock = [
  sectionHeading("Beyond Tech"),
  body("Parallel career in human movement and recovery, ongoing since 2018:", { before: 0, after: 60 }),
  bullet([{ text: "Massage Therapist", bold: true, color: INK }, { text: " (self-employed, 2019 – June 2024) — therapeutic, cupping, scraping, fascial release.", color: INK }]),
  bullet([{ text: "Physiotherapist", bold: true, color: INK }, { text: " — National Individual Championships U18, Concord Service Center (2020).", color: INK }]),
  bullet([{ text: "Personal Trainer & Fitness Instructor", bold: true, color: INK }, { text: " — Young Gym, Motivation Gym, Vivertine (2018 – 2022). Accredited PT Level 1, Fitness Scandinavia.", color: INK }]),
  bullet([{ text: "Specialized training", bold: true, color: INK }, { text: " — Foundational MAT / Dynamic Lower Body (Erik Dalton), Heavenly Head Massage (Thai Healing Massage Academy), Human Optimization (Functional Patterns by Naudi Aguilar), Technician Masseur Supramodul I & II (final grade 10).", color: INK }]),
  body("This dual focus shapes how I approach engineering: with patience, attention to body language in meetings, and the conviction that systems — software or human — perform best when well-aligned and given space to recover.", { before: 60, after: 60 }),
];

// ---------- Footer / extras ----------

const extrasBlock = [
  sectionHeading("Other"),
  new Paragraph({
    spacing: { before: 0, after: 40, line: 280 },
    children: [
      new TextRun({ text: "Driving licences  ", bold: true, size: 21, color: ACCENT_DARK, font: "Calibri" }),
      new TextRun({ text: "AM · B1 · B", size: 21, color: INK, font: "Calibri" }),
    ]
  }),
  new Paragraph({
    spacing: { before: 40, after: 40, line: 280 },
    children: [
      new TextRun({ text: "Date of birth  ", bold: true, size: 21, color: ACCENT_DARK, font: "Calibri" }),
      new TextRun({ text: "31 May 1996  ·  ", size: 21, color: INK, font: "Calibri" }),
      new TextRun({ text: "Nationality  ", bold: true, size: 21, color: ACCENT_DARK, font: "Calibri" }),
      new TextRun({ text: "Romanian", size: 21, color: INK, font: "Calibri" }),
    ]
  }),
];

// ---------- Compose document ----------

const doc = new Document({
  creator: "Andrei Șerban",
  title: "Andrei Șerban — Senior QA Automation Engineer & Test Architect",
  description: "Single-source-of-truth CV",
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 21 } }
    },
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "•",
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: { indent: { left: 360, hanging: 200 } },
            run: { color: ACCENT }
          }
        }]
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
      }
    },
    children: [
      nameHeader,
      roleHeader,
      contactLine,
      ruleParagraph(),
      summary,
      ...skillsBlock,
      ...experienceBlock,
      ...projectsBlock,
      ...aiBlock,
      ...educationBlock,
      ...languagesBlock,
      ...beyondTechBlock,
      ...extrasBlock,
    ]
  }]
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/sessions/brave-serene-edison/mnt/outputs/Andrei-Serban-CV.docx", buf);
  console.log("DOCX written:", buf.length, "bytes");
});
