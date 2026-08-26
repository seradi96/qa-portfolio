'use client'

import { useState, useEffect } from 'react'
import { MapPinIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { BriefcaseIcon } from '@heroicons/react/24/solid'
import { QA_CAREER_START, PLAYWRIGHT_START, KARATE_START, getYearsSince } from '@/lib/career'

type SubProject = {
  name: string
  repo: string
  stack: string[]
  metrics: string
  timeline: string
  status: string
  highlights: string[]
}

export default function Portfolio() {
  const [activeProject, setActiveProject] = useState<number | null>(null)
  const [hoursWorked, setHoursWorked] = useState(0)
  const [yearsWorked, setYearsWorked] = useState(() => getYearsSince(QA_CAREER_START))
  const [playwrightYears, setPlaywrightYears] = useState(() => getYearsSince(PLAYWRIGHT_START))
  const [karateYears, setKarateYears] = useState(() => getYearsSince(KARATE_START))
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState('All')
  const [showBackToTop, setShowBackToTop] = useState(false)



  // Live hours tracker - calculates hours and years since QA career start (May 2021)
  useEffect(() => {
    const updateHours = () => {
      const now = new Date()
      const diffInMs = now.getTime() - QA_CAREER_START.getTime()
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
      // Assuming 8 hours work per day, 5 days per week
      const workingHours = Math.floor(diffInHours * (8/24) * (5/7))
      setHoursWorked(workingHours)
      setYearsWorked(getYearsSince(QA_CAREER_START))
      setPlaywrightYears(getYearsSince(PLAYWRIGHT_START))
      setKarateYears(getYearsSince(KARATE_START))
    }

    updateHours()
    const interval = setInterval(updateHours, 3600000) // Update every hour

    return () => clearInterval(interval)
  }, [])

  // Back to top scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }


  const projects = [
    {
 title: "Deutsche Bahn - SAP ERP Integrated Railway Management System QA Automation Framework",
  description: "Prevented €2M+ in potential system failures through proactive defect detection for Europe's largest transportation network. Reduced testing cycles by 40% while maintaining zero-tolerance safety standards for 2+ billion annual passengers. Led digital transformation of critical railway infrastructure supporting Germany's €40B transportation modernization program.",
 technologies: [
   "Angular",
   "Java Spring Boot",
   "SAP GUI",
   "SAP ERP",
   "Playwright UI",
    "Karate API",
    "Selenium",
    "Cucumber",
    "JUnit",
    "Jira",
    "SoapUI",
    "PostgreSQL",
    "Postman",
    "Grafana",
   "GitLab CI/CD",
   "Kubernetes",
   "Docker",
   "SAP Integration"
 ],
   highlights: [
    "Prevented €500K+ in system downtime through 40% faster testing cycles for critical railway services",
    "Accelerated releases by 35% replacing legacy Selenium with cutting-edge Playwright automation",
    "Reduced customer-impacting defects by 25% through proactive developer collaboration",
    "Slashed critical issue resolution time by 50% through advanced monitoring and rapid diagnosis",
    "Protected 2B+ passenger journeys through automated validation of 500+ critical workflows",
    "Eliminated manual UAT bottlenecks with real-time stakeholder reporting and validation"
  ],
 status: "Ongoing",
 impact: {
   businessValue: "€2M+ prevented losses | 40% faster testing cycles | 25% fewer production defects | Zero safety incidents",
   scale: "2+ billion passengers annually | 340,000+ employees | 33,000+ km rail network | 24/7 operations",
   timeline: "January 2023 - October 2026 (current engagement)",
   efficiency: "50% faster issue resolution | 35% faster test execution | 55% automated coverage"
 },
  clientType: "Germany's National Railway Operator & Europe's Largest Rail Network",
  role: "QA Automation Engineer (Automation Lead on client engagement)",
 keyAchievements: [
   "Slashed manual ERP testing by 85%",
    "Delivered enterprise automation supporting €40B Digital Rail transformation program",
    "Led 15+ engineers in critical system bug resolution",
    "Mentored 5+ QAs - building sustainable testing excellence",
 ],
  subProjects: [
    {
      name: "Karate API Regression Suite",
      repo: "act-backend-tests",
      stack: ["Karate", "Java 17", "JUnit 5", "Maven", "Spring JDBC", "PostgreSQL / MySQL / Oracle", "Kubernetes", "GitLab CI/CD", "Jira/XRay"],
      metrics: "264 feature files · 264 scenarios · 23 API services · 17 service domains · 134 SQL scripts",
      timeline: "2023 - Oct 2026",
      status: "Ongoing",
      highlights: [
        "23-job sequential regression pipeline across 17 microservice domains with Cucumber report aggregation and GitLab Pages deploy",
        "Multi-database test infrastructure (PostgreSQL, MySQL, Oracle) with K8s secret injection and environment-aware schema resolution via CSV lookup",
        "Custom polling utilities (waitUntil / waitForObject) for async API verification with configurable timeout and interval",
        "Jira XRay integration publishing JUnit XML results plus karate logs as attachments to test plans"
      ]
    },
    {
      name: "Playwright UI Automation Framework",
      repo: "playwright-tests-automation",
      stack: ["Playwright", "TypeScript", "openapi-fetch", "openapi-typescript", "PostgreSQL", "GitLab CI/CD", "Jira/XRay"],
      metrics: "22 page objects · 152 spec files · 254 test cases · 44 API services · 22 app areas",
      timeline: "2023 - Oct 2026",
      status: "Ongoing",
      highlights: [
        "Custom fixture layer injects typed API clients (openapi-fetch), DB connections, and page objects — zero boilerplate in test files",
        "Locator/Page separation pattern: 17 locator classes composed into 22 page objects, keeping selectors stable independent of page logic",
        "Multi-user test infrastructure via UserManager / UserSession fixtures for concurrent-session scenarios",
        "OpenAPI-generated TypeScript types for 44 microservices with an environment-aware client factory across 7 deployment targets"
      ]
    }
  ]
},
   {
  title: "TOKERO QA Automation Platform",
  description: "Sole architect and maintainer of the QA stack at TOKERO (European crypto exchange): a Playwright functional framework in production since 2025, plus an NBomber performance suite and a custom Blazor reporting platform — both shipped to production in 2026. Owned end-to-end from July 2025 until the engagement concluded in August 2026, with all three systems handed over running in production.",
  technologies: [
    "Playwright",
    ".NET 10",
    "C#",
    "NUnit",
    "NBomber",
    "Blazor",
    "MudBlazor",
    "ApexCharts",
    "PostgreSQL",
    "Supabase",
    "EF Core",
    "Azure Key Vault",
    "GitLab CI/CD",
    "Azure DevOps"
  ],
  tooling: ["Claude Code", "Playwright MCP"],
  highlights: [
    "Sole owner of 3 production QA systems serving the entire engineering org",
    "Designed and built `pulse` from zero: PostgreSQL schema, EF Core data layer, Blazor Server UI, NUnit XML parser, candlestick + trend analytics on ApexCharts",
    "Authored 9+ custom Claude Code skills now used by the QA team for standardized test and Page Object generation",
    "Built the SignalR/Blazor independent-circuit perf scenario — first real /_blazor blazorpack handshake load test in the codebase, closing a gap NBomber didn't cover out of the box",
    "Migrated `pulse` to dual-provider data layer (SQLite local + Postgres prod) without schema divergence",
    "Source-generated Razor @page route constants via Tokero.SourceGenerator — eliminates a class of stale-URL test bugs"
  ],
  status: "Completed",
  impact: {
    businessValue: "77 Page Objects · 49 test classes · 11 perf scenarios · 30+ perf profiles",
    scale: "Sole owner of 3 production QA systems · functional + performance + reporting",
    timeline: "July 2025 - August 2026"
  },
  clientType: "European cryptocurrency exchange",
  role: "Senior QA Automation Engineer & Test Architect",
  keyAchievements: [
    "Sole architect of qaatpw framework: HybridFixture + TestBase, source generator, 77 POs, 49 test classes",
    "Built `pulse` end-to-end from schema to UI — replaced the prior reporting flow",
    "Authored the team's AI-augmented test authoring workflow (Claude Code skills + Playwright MCP), still in use after handover",
    "Built the first real Blazor SignalR independent-circuit perf scenario in the codebase"
  ],
  subProjects: [
    {
      name: "Functional Automation Framework (qaatpw)",
      repo: "qaatpw",
      stack: ["Playwright", "C#", ".NET 10", "NUnit", "Azure Key Vault", "GitLab CI/CD"],
      metrics: "77 Page Objects · 49 test classes",
      timeline: "2025 - Aug 2026",
      status: "Completed",
      highlights: [
        "Sole architect: HybridFixture + TestBase, lazy-loaded page objects, fixture lifecycle",
        "Routes source-generated from Blazor @page directives via Tokero.SourceGenerator",
        "Authored team skills: /generate-page, /generate-test, /verify-test, /debug-failure",
        "Validated flows interactively via Playwright MCP before commit"
      ]
    },
    {
      name: "Performance Testing Suite (perf)",
      repo: "perf",
      stack: ["NBomber", ".NET 10", "Grafana", "Prometheus", "Supabase Postgres"],
      metrics: "11 scenarios · 30+ profiles · CPU-burn + SignalR + saturation curve",
      timeline: "2026 - Aug 2026",
      status: "Completed",
      highlights: [
        "Built Blazor SignalR independent-circuit scenario with real /_blazor blazorpack handshake",
        "Added Saturation Curve analysis on RunDedicated (1/3/5/10/20 frames + knee detection)",
        "Built Endpoint Cost Table on Diagnostics page — per-step rows + aggregate pod CPU/Mem footer",
        "Owned the correctness-pass discipline: staging guardrail, ErrorClass enum, auth semaphore, loud KYC init"
      ]
    },
    {
      name: "Reporting Platform (pulse)",
      repo: "pulse",
      stack: ["Blazor Server", "MudBlazor", "ApexCharts", "PostgreSQL (Supabase)", "EF Core"],
      metrics: "Flaky detection · Duration trends · Candlestick analysis",
      timeline: "2026 - Aug 2026",
      status: "Completed",
      highlights: [
        "Designed and built from zero: PostgreSQL schema, EF Core data layer, Blazor Server UI, parsing pipeline",
        "Three-zone Duration page: standalone card, inline expanded row, All Tests table",
        "ApexCharts candlestick + trend with 10/20/30/All run-count toggle and 10% regression threshold",
        "Laid the groundwork for extending the reporting layer toward DORA metrics (cross-team initiative)"
      ]
    }
  ]
},
 {
  title: "DentsplySirona - Medical Device CAD/CAM Software Testing & QA Leadership",
  description: "Led precision testing for medical manufacturing systems ensuring ±0.001mm accuracy standards. Delivered 100% on-time deliverables as interim team lead during critical product launches. Resolved 65+ critical defects with 99% clarity, reducing developer resolution time by 40% for CAD/CAM workflows.",
  technologies: [
    "CAD/CAM Testing",
    "Jira",
    "Windows Testing",
    "Functional Testing",
    "Regression Testing",
    "UAT Testing",
    "Performance Testing",
    "Root Cause Analysis",
    "Cross-Platform Testing",
    "Storage Testing"
  ],
  highlights: [
    "Validated CAD/CAM software workflows ensuring precision in design-to-manufacturing processes",
    "Collaborated with mechanical engineers replicating real-world manufacturing scenarios",
    "Executed 500+ manual test cases achieving zero downtime during peak system usage",
    "Led root-cause analysis sessions resolving recurring login failures with 100% success rate",
    "Maintained direct communication with developers resolving 15+ critical defects during launches",
    "Achieved ±0.001mm manufacturing accuracy through boundary testing and geometric validation"
  ],
  status: "Done",
  impact: {
    businessValue: "100% on-time deliverables | Zero manufacturing defects | 40% faster defect resolution | 99% defect clarity",
    scale: "Medical device manufacturing | CAD/CAM precision systems | Cross-functional engineering teams",
    timeline: "May 2022 - Dec 2022 (8 months)",
    efficiency: "40% faster developer clarification | 50% improved defect reporting quality | 100% launch success rate"
  },
  clientType: "Global Medical Device Manufacturer - Precision Engineering Systems",
  role: "Software Tester & Interim Team Lead",
  keyAchievements: [
    "Acted as primary QA liaison at client HQ maintaining direct developer communication",
    "Stepped in as interim team lead for 3 months achieving 100% on-time deliverables",
    "Reported 65+ defects with 99% clarity including detailed reproducibility steps",
    "Led precision boundary testing ensuring ±0.001mm manufacturing tolerance compliance",
  ]
},
    {
  title: "Happy Media - Full-Stack Development & Digital Campaign Management Platform",
  description: "Increased client acquisition rates by 35% and reduced manual work by 80% through quality-focused development. Maintained 99.9% uptime for Romania's leading advertising agency. Built scalable solutions that transformed 100+ SMEs from local businesses into digital market leaders across Eastern Europe.",
  technologies: [
    "WordPress",
    "CSS3",
    "PHP",
    "JavaScript",
    "jQuery",
    "MySQL",
    "HTML5",
    "Bootstrap",
    "Git",
    "Google Analytics"
  ],
  highlights: [
    "Delivered 10+ websites with 99.9% uptime generating millions in client revenue",
    "Eliminated 80% of manual reporting work saving 1000+ hours annually for account teams",
    "Increased client conversions by 35% through data-driven landing page optimization",
    "Future-proofed client investments with mobile-first designs capturing 70%+ mobile traffic",
    "Accelerated campaign deployment by 50% through custom automation plugins",
    "Maintained 100% quality standards preventing costly client project failures"
  ],
  status: "Done",
  impact: {
    businessValue: "35% higher client conversion | 80% reduction in manual processes | €500K+ revenue growth enabled",
    scale: "10+ satisfied clients | 99.9% uptime achieved",
    timeline: "May 2021 - May 2022 (Foundation phase)"
  },
  clientType: "Full-Service Advertising Agency",
  role: "Full-Stack Developer",
  keyAchievements: [
    "Delivered 10+ custom solutions with 100% client satisfaction rate",
    "Implemented QA protocols preventing costly project failures and client churn",
    "Built rapid deployment frameworks reducing project delivery time by 60%",
    "Created conversion-optimized e-commerce solutions driving 35% higher sales",
    "Streamlined client onboarding reducing project start time from weeks to days"
  ]
},
  ]

  // QA-focused technology filter options
  const qaFilterOptions = [
    'All',
    'Playwright',
    'Playwright UI',
    'Selenium',
    'Karate API',
    'NBomber',
    'Cucumber',
    'JUnit',
    'NUnit',
    'Postman',
    'Jira',
    'Docker',
    'CI/CD',
    'Blazor',
    '.NET 10',
    'Claude Code',
    'MCP',
    'Performance Testing',
    'Functional Testing'
  ]
  const filterOptions = qaFilterOptions

  // Filter projects based on selected technology (matches technologies + tooling)
  const filteredProjects = selectedFilter === 'All'
    ? projects
    : projects.filter(project => {
        if (project.technologies.includes(selectedFilter)) return true
        const tools = (project as { tooling?: string[] }).tooling ?? []
        return tools.some(t => t.includes(selectedFilter))
      })

  const skills = {
    "Testing Frameworks": ["Playwright", "Selenium WebDriver", "Karate API Testing", "NBomber", "TestNG", "JUnit", "xUnit/NUnit"],
    "Programming": ["JavaScript/TypeScript", "Java", ".NET Core/C#"],
    "Tools & Platforms": ["Docker", "Kubernetes", "Jenkins", "GitLab CI/CD", "Azure DevOps", "Postman", "SoapUI", "Jira/XRay", "Grafana", "Prometheus"],
    "Testing Specialties": ["API Testing", "UI Automation", "BDD/Cucumber", "Performance/Load Testing", "Database Testing", "SignalR/WebSocket Testing"],
    "AI-Augmented QA": [
      "Claude Code",
      "Custom Skill Authoring (.claude/skills)",
      "MCP Integration (Playwright, Supabase)",
      "Subagent-Driven Test Development",
      "AI-Assisted Test Generation",
      "AI-Assisted Debugging & RCA",
      "Prompt Engineering for QA",
      "Plan-First / Spec-Driven Automation"
    ]
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-black/20 backdrop-blur-md z-50 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">Șerban Andrei</h1>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8" role="navigation" aria-label="Main navigation">
              <a href="#about" className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 py-1">About</a>
              <a href="#projects" className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 py-1">Projects</a>
              <a href="#architecture" className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 py-1">Architecture</a>
              <a href="#skills" className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 py-1">Skills</a>
              <a href="#contact" className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 py-1">Contact</a>

            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg transition-colors text-white hover:bg-white/10"
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? (
                  <XMarkIcon className="w-6 h-6" />
                ) : (
                  <Bars3Icon className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-white/10" role="navigation" aria-label="Mobile navigation">
              <div className="flex flex-col space-y-4 pt-4">
                <a
                  href="#about"
                  className="transition-colors py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 text-gray-300 hover:text-white"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  About
                </a>
                <a
                  href="#projects"
                  className="transition-colors py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 text-gray-300 hover:text-white"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Projects
                </a>
                <a
                  href="#architecture"
                  className="transition-colors py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 text-gray-300 hover:text-white"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Architecture
                </a>
                <a
                  href="#skills"
                  className="transition-colors py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 text-gray-300 hover:text-white"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Skills
                </a>
                <a
                  href="#contact"
                  className="transition-colors py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:rounded-md px-2 text-gray-300 hover:text-white"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Contact
                </a>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-8">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-white">
              QA Automation
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-500">
                Engineer
              </span>
            </h1>
            <p className="text-xl max-w-3xl mx-auto leading-relaxed text-gray-300">
              Building Scalable Test Frameworks for Robust Software Delivery.
              <br />
              Bridging technical excellence with human connection to build resilient teams and robust software.
            </p>
          </div>

          <div className="flex justify-center mb-10">
            <span className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-200 text-sm font-medium backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
              </span>
              Available for new engagements from November 2026
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <div className="relative group">
              <a
                href="#projects"
                className="bg-gradient-to-r from-amber-600 to-yellow-600 text-black px-8 py-4 rounded-xl font-semibold hover:shadow-2xl hover:shadow-amber-500/30 transition-all duration-300 inline-flex items-center justify-center space-x-3 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black"
                aria-label="View my project portfolio"
              >
                <div className="relative">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <div className="absolute inset-0 animate-ping">
                    <svg className="w-5 h-5 text-amber-300/50" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                </div>
                <span>View My Work</span>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 to-yellow-600/20 rounded-xl animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </a>
            </div>
            <div className="relative group">
              <a
                href="#contact"
                className="bg-gradient-to-r from-gray-800/80 to-gray-700/80 backdrop-blur-sm border border-amber-400/30 text-white px-8 py-4 rounded-xl font-semibold hover:bg-gradient-to-r hover:from-gray-700/90 hover:to-gray-600/90 hover:shadow-2xl hover:shadow-amber-500/25 transition-all duration-300 inline-flex items-center justify-center space-x-3 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black"
                aria-label="Get in touch with me"
              >
                <div className="relative">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                  </svg>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-amber-400 rounded-full animate-bounce"></div>
                      <div className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
                <span>Get In Touch</span>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 to-yellow-600/10 rounded-xl animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </a>
            </div>
          </div>

          <div className="flex justify-center items-center space-x-6 text-gray-400">
            <div className="flex items-center space-x-2">
              <MapPinIcon className="w-5 h-5" />
              <span>Romania</span>
            </div>
            <div className="flex items-center space-x-2">
              <BriefcaseIcon className="w-5 h-5" />
              <span>{yearsWorked}+ Years in Tech</span>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-12 text-center">About Me</h2>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <p className="text-gray-300 text-lg leading-relaxed">
                I believe quality isn&apos;t just about finding bugs—it&apos;s about building confidence in every release.
                I&apos;m currently automation lead for <b className="text-amber-300">Deutsche Bahn&apos;s SAP ERP Integrated Railway Management System</b> at Heaven Solutions (Karate API, Playwright UI) — an engagement that concludes in October 2026. Through August 2026 I ran that in parallel with a second senior engagement as sole architect of the QA stack at <b className="text-amber-300">TOKERO</b> (Playwright&nbsp;.NET, NBomber, custom Blazor reporting), where I handed over three production QA systems. I thrive where technical precision meets collaborative problem-solving.
              </p>

              <p className="text-gray-300 text-lg leading-relaxed">
                My approach combines cutting-edge automation tools with practical team dynamics, and increasingly with <b className="text-amber-300">AI-augmented workflows</b> — Claude Code skills, MCP integrations (Playwright, Supabase), and spec-driven automation that scales across QA engineers. I&apos;m passionate about transforming testing bottlenecks into quality accelerators and making quality everyone&apos;s responsibility.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="relative group">
                  <div className="bg-gradient-to-br from-amber-600/20 to-yellow-600/10 p-6 rounded-2xl border border-amber-400/30 text-center transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full mx-auto flex items-center justify-center shadow-lg">
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      </div>
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center animate-pulse">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2">Problem Solver</h3>
                    <p className="text-gray-300 text-sm">I find bugs before users do</p>
                  </div>
                </div>

                <div className="relative group">
                  <div className="bg-gradient-to-br from-yellow-600/20 to-amber-600/10 p-6 rounded-2xl border border-yellow-400/30 text-center transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/25">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full mx-auto flex items-center justify-center shadow-lg">
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                      </div>
                      <div className="absolute inset-0 bg-amber-400/20 rounded-full animate-ping"></div>
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2">Speed & Efficiency</h3>
                    <p className="text-gray-300 text-sm">Faster releases, fewer bugs</p>
                  </div>
                </div>

                <div className="relative group">
                  <div className="bg-gradient-to-br from-black/30 to-amber-900/10 p-6 rounded-2xl border border-amber-400/30 text-center transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-black rounded-full mx-auto flex items-center justify-center shadow-lg">
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20a3 3 0 01-3-3v-2a3 3 0 013-3 3 3 0 013 3v2a3 3 0 01-3 3zm8-10a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                      </div>
                      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2">Team Catalyst</h3>
                    <p className="text-gray-300 text-sm">I elevate everyone around me</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 p-8 rounded-2xl border border-white/10 space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-4">Beyond Quality Assurance... I am</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-amber-400">✅</span>
                    <p className="text-gray-300"><b>Architecting frameworks</b> adopted as team standards across multiple client engagements</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-amber-400">✅</span>
                    <p className="text-gray-300"><b>Mentoring junior QA engineers</b> on test design and automation best practices</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-amber-400">✅</span>
                    <p className="text-gray-300"><b>Exploring testing innovations</b> — currently building custom Claude Code skills, Playwright MCP integrations, visual regression workflows, and subagent-driven test development</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-6">
                <h3 className="text-xl font-bold text-white mb-4">Let&apos;s Connect If You...</h3>
                <div className="space-y-2">
                  <p className="text-gray-300">• Want to discuss API testing strategies vs. UI automation trade-offs</p>
                  <p className="text-gray-300">• Need a partner to transform &quot;testing bottlenecks&quot; into &quot;quality accelerators&quot;</p>
                  <p className="text-gray-300">• Believe teams deliver better software when quality is everyone&apos;s responsibility</p>
                </div>
                <p className="text-amber-300 font-medium mt-4 italic">
                  Open to collaborations, mentorship, and conversations that strengthen software quality practices.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Metrics Section */}
      <section className="py-20 px-6 bg-black/10">
        <div className="max-w-6xl mx-auto">

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="relative group">
              <div className="bg-gradient-to-br from-amber-600/20 to-yellow-600/10 p-6 rounded-2xl border border-amber-400/30 text-center transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25">
                <div className="relative mb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full mx-auto flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l.09 1.09c.02.41.25.79.61 1.02L15 5.5l-1.39 1.39c-.37.37-.37.97 0 1.34l1.39 1.39-2.3 1.39c-.36.23-.59.61-.61 1.02L12 22l-.09-10.37c-.02-.41-.25-.79-.61-1.02L9 9.22l1.39-1.39c.37-.37.37-.97 0-1.34L9 5.5l2.3-1.39c.36-.23.59-.61.61-1.02L12 2z"/>
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-amber-400/20 rounded-full animate-ping"></div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-2">
                  {hoursWorked.toLocaleString()}
                </div>
                <p className="text-gray-300 text-sm font-medium">Hours Worked</p>
                <p className="text-amber-400 text-xs mt-1 font-medium">🔴 Live Counter</p>
              </div>
            </div>

            <div className="relative group">
              <div className="bg-gradient-to-br from-yellow-600/20 to-amber-600/10 p-6 rounded-2xl border border-yellow-400/30 text-center transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/25">
                <div className="relative mb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full mx-auto flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4zm8 16H6v-9h12v9z"/>
                    </svg>
                  </div>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                    </div>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-2">15+</div>
                <p className="text-gray-300 text-sm font-medium">Projects</p>
                <p className="text-amber-400 text-xs mt-1 font-medium">🚀 Delivered</p>
              </div>
            </div>

            <div className="relative group">
              <div className="bg-gradient-to-br from-black/30 to-amber-900/10 p-6 rounded-2xl border border-amber-400/30 text-center transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25">
                <div className="relative mb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-black rounded-full mx-auto flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zM8.5 9A1.5 1.5 0 1010 7.5 1.5 1.5 0 008.5 9zM15.5 9A1.5 1.5 0 1017 7.5 1.5 1.5 0 0015.5 9zm-.5 3H9v1.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V12z"/>
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full flex items-center justify-center animate-spin" style={{animationDuration: '3s'}}>
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-2">5</div>
                <p className="text-gray-300 text-sm font-medium">Frameworks</p>
                <p className="text-amber-400 text-xs mt-1 font-medium">⭐ Created</p>
              </div>
            </div>

            <div className="relative group">
              <div className="bg-gradient-to-br from-amber-600/20 to-yellow-600/10 p-6 rounded-2xl border border-amber-400/30 text-center transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25">
                <div className="relative mb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full mx-auto flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6L23 9l-11-6zM18.82 9L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-amber-400/30 rounded-full animate-pulse"></div>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                    <div className="w-8 h-1 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full"></div>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-2">12</div>
                <p className="text-gray-300 text-sm font-medium">Courses</p>
                <p className="text-amber-400 text-xs mt-1 font-medium">🎓 Completed</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-black/40 to-amber-900/20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative">
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-6xl text-amber-400/20">&quot;</div>
            <blockquote className="text-2xl md:text-3xl font-light text-white mb-6 leading-relaxed">
              Automation isn&apos;t about replacing humans—it&apos;s about giving us time to be more human.
            </blockquote>
            <cite className="text-lg text-gray-400">— Personal Philosophy</cite>
            <div className="absolute -bottom-8 right-1/2 transform translate-x-1/2 text-6xl text-amber-400/20 rotate-180">&quot;</div>
          </div>
          <div className="mt-12 flex justify-center">
            <div className="w-24 h-1 bg-gradient-to-r from-amber-400 to-yellow-600 rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Key Wins Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-12 text-center">Key Wins & Impact</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="relative group">
              <div className="bg-gradient-to-br from-amber-600/20 to-yellow-600/10 p-6 rounded-2xl border border-amber-400/30 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25">
                <div className="relative mb-4">
                  <div className="w-14 h-14 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full flex items-center justify-center shadow-lg mx-auto">
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-amber-400/20 rounded-full animate-ping mx-auto w-14 h-14"></div>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-2">Strategic Planning</h3>
                <p className="text-gray-300 text-xs text-center mb-3 leading-relaxed">
                  Shift-left testing initiative integrating quality into development pipeline
                </p>
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-400 mb-1">30%</div>
                  <p className="text-gray-400 text-xs">Reduction in defects</p>
                </div>
              </div>
            </div>

            <div className="relative group">
              <div className="bg-gradient-to-br from-yellow-600/20 to-amber-600/10 p-6 rounded-2xl border border-yellow-400/30 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/25">
                <div className="relative mb-4">
                  <div className="w-14 h-14 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full flex items-center justify-center shadow-lg mx-auto">
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                  </div>
                  <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-2">Automation Excellence</h3>
                <p className="text-gray-300 text-xs text-center mb-3 leading-relaxed">
                  Playwright E2E testing with parallel execution and auto-waiting
                </p>
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-400 mb-1">40%</div>
                  <p className="text-gray-400 text-xs">Faster testing cycles</p>
                </div>
              </div>
            </div>

            <div className="relative group">
              <div className="bg-gradient-to-br from-amber-600/20 to-yellow-600/10 p-6 rounded-2xl border border-amber-400/30 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25">
                <div className="relative mb-4">
                  <div className="w-14 h-14 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full flex items-center justify-center shadow-lg mx-auto">
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full flex items-center justify-center animate-spin" style={{animationDuration: '4s'}}>
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-2">API Innovation</h3>
                <p className="text-gray-300 text-xs text-center mb-3 leading-relaxed">
                  Karate Framework data-driven testing for microservices validation
                </p>
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-400 mb-1">40%</div>
                  <p className="text-gray-400 text-xs">Less maintenance</p>
                </div>
              </div>
            </div>

            <div className="relative group">
              <div className="bg-gradient-to-br from-amber-600/20 to-yellow-600/10 p-6 rounded-2xl border border-amber-400/30 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25">
                <div className="relative mb-4">
                  <div className="w-14 h-14 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full flex items-center justify-center shadow-lg mx-auto">
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 3v18h18v-2H5V3H3zm20 4H7v12h16V7zM9 17v-8l7 4-7 4z"/>
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-amber-400/20 rounded-full animate-pulse mx-auto w-14 h-14"></div>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                    <div className="w-8 h-1 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-2">Quality Visibility</h3>
                <p className="text-gray-300 text-xs text-center mb-3 leading-relaxed">
                  Jira/XRay integration connecting tests to requirements
                </p>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400 mb-1">Real-time</div>
                  <p className="text-gray-400 text-xs">Quality dashboards</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section id="projects" className="py-20 px-6 bg-black/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-6 text-center">Featured Projects</h2>
          {/* Project Filters */}
          <div className="mb-8">
            <div className="flex items-center justify-center mb-4">
              <span className="text-gray-300 mr-4 font-medium">Filter by technology:</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
              {filterOptions.slice(0, 12).map((tech) => (
                <button
                  key={tech}
                  onClick={() => {
                    setSelectedFilter(tech)
                    setActiveProject(null) // Reset active project when filtering
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                    selectedFilter === tech
                      ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-black shadow-lg'
                      : 'bg-gradient-to-r from-white/10 to-white/5 text-gray-300 border border-white/20 hover:bg-gradient-to-r hover:from-white/20 hover:to-white/10 hover:text-white'
                  }`}
                  aria-label={`Filter projects by ${tech}`}
                >
                  {tech}
                </button>
              ))}
            </div>
            {filterOptions.length > 12 && (
              <div className="text-center mt-4">
                <span className="text-gray-400 text-sm">
                  +{filterOptions.length - 12} more technologies available in projects
                </span>
              </div>
            )}
            {selectedFilter !== 'All' && (
              <div className="text-center mt-4">
                <span className="text-amber-300 text-sm">
                  Showing {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} with {selectedFilter}
                </span>
              </div>
            )}
          </div>

          {/* Compact Project Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {filteredProjects.map((project) => {
              const originalIndex = projects.findIndex(p => p.title === project.title)
              const isLiveStatus = project.status === 'Ongoing'

              return (
                <div
                  key={originalIndex}
                  className={`relative group p-6 rounded-2xl cursor-pointer transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                    activeProject === originalIndex
                      ? 'bg-gradient-to-br from-amber-600/20 to-yellow-600/10 border-amber-400/50 shadow-2xl shadow-amber-500/20'
                      : 'bg-gradient-to-br from-white/5 to-white/2 border-white/10 hover:bg-gradient-to-br hover:from-white/10 hover:to-white/5 hover:border-white/20 hover:shadow-xl hover:shadow-white/10'
                  } border`}
                  onClick={() => {
                    if (activeProject === originalIndex) {
                      setActiveProject(null)
                    } else {
                      setActiveProject(originalIndex)
                    }
                  }}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (activeProject === originalIndex) {
                        setActiveProject(null)
                      } else {
                        setActiveProject(originalIndex)
                      }
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${activeProject === originalIndex ? 'Close' : 'View'} project details for ${project.title}`}
                  aria-expanded={activeProject === originalIndex}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        activeProject === originalIndex ? 'bg-amber-500 animate-pulse' : 'bg-gray-500'
                      }`}></div>
                      <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">{project.title}</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center space-x-1 ${
                          isLiveStatus
                            ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-white/5 text-gray-400 border border-white/15'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            isLiveStatus ? 'bg-amber-400 animate-pulse' : 'bg-gray-500'
                          }`}></div>
                          <span>{project.status}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-4">{project.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {project.technologies.slice(0, 3).map((tech, techIndex) => (
                      <span key={techIndex} className="bg-gradient-to-r from-slate-600/30 to-slate-700/30 text-slate-300 px-2 py-1 rounded-lg text-xs font-medium border border-slate-500/20">
                        {tech}
                      </span>
                    ))}
                  </div>

                  {/* Expanded Details */}
                  {activeProject === originalIndex && (
                    <div className="mt-4 pt-4 border-t border-amber-400/30 space-y-4">
                      {/* Business Impact */}
                      <div>
                        <h4 className="text-white font-bold mb-2 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                          Business Impact
                        </h4>
                        <p className="text-amber-300 text-sm font-medium">{project.impact.businessValue}</p>
                        {project.impact.efficiency && (
                          <p className="text-gray-300 text-sm mt-1">
                            <span className="text-gray-400">Efficiency:</span> {project.impact.efficiency}
                          </p>
                        )}
                        <p className="text-gray-300 text-sm mt-1">
                          <span className="text-gray-400">Timeline:</span> {project.impact.timeline}
                        </p>
                      </div>

                      {/* Key Achievements (condensed) */}
                      <div>
                        <h4 className="text-white font-bold mb-2 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          </svg>
                          Key Achievements
                        </h4>
                        <div className="space-y-2">
                          {project.keyAchievements.slice(0, 3).map((achievement, index) => (
                            <div key={index} className="flex items-start space-x-2">
                              <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-2 flex-shrink-0"></div>
                              <p className="text-gray-300 text-sm leading-relaxed">{achievement}</p>
                            </div>
                          ))}
                          {project.keyAchievements.length > 3 && (
                            <p className="text-gray-500 text-xs">+{project.keyAchievements.length - 3} more achievements</p>
                          )}
                        </div>
                      </div>

                      {/* Technologies Used */}
                      <div>
                        <h4 className="text-white font-bold mb-2 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                          </svg>
                          All Technologies
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {project.technologies.map((tech, index) => (
                            <span key={index} className="bg-amber-500/20 text-amber-300 px-2 py-1 rounded text-xs font-medium">
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Workflow & AI Tooling */}
                      {((project as { tooling?: string[] }).tooling?.length ?? 0) > 0 && (
                        <div>
                          <h4 className="text-white font-bold mb-2 flex items-center">
                            <svg className="w-4 h-4 mr-2 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.091zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                            </svg>
                            Workflow &amp; AI Tooling
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {(project as { tooling?: string[] }).tooling!.map((tool, index) => (
                              <span key={index} className="bg-gradient-to-r from-cyan-500/15 to-blue-500/15 text-cyan-300 px-2 py-1 rounded text-xs font-medium border border-cyan-400/30">
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sub-Projects */}
                      {((project as { subProjects?: SubProject[] }).subProjects?.length ?? 0) > 0 && (
                        <div>
                          <h4 className="text-white font-bold mb-3 flex items-center">
                            <svg className="w-4 h-4 mr-2 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                            </svg>
                            Sub-Projects
                            <span className="ml-2 text-xs font-normal text-gray-400">
                              ({(project as { subProjects?: SubProject[] }).subProjects!.length} streams)
                            </span>
                          </h4>
                          <div className="space-y-3">
                            {(project as { subProjects?: SubProject[] }).subProjects!.map((sub, subIdx) => (
                              <div
                                key={subIdx}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-gradient-to-br from-white/5 to-white/2 border border-amber-400/20 rounded-xl p-4 hover:border-amber-400/40 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0"></div>
                                    <h5 className="text-white font-semibold text-sm leading-tight">{sub.name}</h5>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                                    sub.status === 'Ongoing'
                                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                      : 'bg-white/5 text-gray-400 border border-white/15'
                                  }`}>
                                    {sub.status}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-xs ml-3.5">
                                  <span className="text-amber-300/90 font-medium">{sub.metrics}</span>
                                  <span className="text-gray-500">•</span>
                                  <span className="text-gray-400">{sub.timeline}</span>
                                </div>

                                <div className="flex flex-wrap gap-1.5 mb-3 ml-3.5">
                                  {sub.stack.map((tech, ti) => (
                                    <span
                                      key={ti}
                                      className="bg-slate-700/40 text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-600/30"
                                    >
                                      {tech}
                                    </span>
                                  ))}
                                </div>

                                <ul className="space-y-1.5 ml-3.5">
                                  {sub.highlights.map((h, hi) => (
                                    <li key={hi} className="flex items-start space-x-2">
                                      <div className="w-1 h-1 bg-amber-400/70 rounded-full mt-1.5 flex-shrink-0"></div>
                                      <span className="text-gray-300 text-xs leading-relaxed">{h}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeProject === originalIndex && (
                    <div className="absolute -right-2 top-1/2 transform -translate-y-1/2">
                      <div className="w-4 h-4 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full animate-bounce"></div>
                    </div>
                  )}
                </div>
                )
              })}
          </div>
        </div>
      </section>

      {/* Architecture & Approach Section */}
      <section id="architecture" className="py-20 px-4 sm:px-6 bg-black/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 text-center">Architecture &amp; Approach</h2>
          <p className="text-gray-300 text-center max-w-3xl mx-auto mb-12 leading-relaxed">
            How I architect end-to-end QA stacks — design patterns, layering, and tooling choices.
            Generalized from production work (business logic, scenario names, internal endpoints, and customer-specific data omitted).
          </p>

          {/* Three framework cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">

            {/* Functional Framework */}
            <div className="min-w-0 bg-gradient-to-br from-amber-600/20 to-yellow-600/10 p-6 rounded-2xl border border-amber-400/30 hover:shadow-2xl hover:shadow-amber-500/25 transition-all duration-300">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-xl flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h4M9 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h4M9 17l3-3M21 7l-3-3M21 7v4a2 2 0 01-2 2h-4M21 7l-3 3" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-tight">Functional Automation</h3>
                  <p className="text-amber-300 text-xs">Playwright .NET / C#</p>
                </div>
              </div>
              <div className="space-y-3 text-sm text-gray-300">
                <div>
                  <div className="text-amber-400 font-semibold mb-1 text-xs uppercase tracking-wide">Pattern</div>
                  <p>Page Object Model with HybridFixture base; lazy-loaded POs; fixture lifecycle managed centrally.</p>
                </div>
                <div>
                  <div className="text-amber-400 font-semibold mb-1 text-xs uppercase tracking-wide">Capabilities</div>
                  <p>Cross-browser, multi-environment (4 tiers), 10-locale support, screenshot / video / HAR capture, DB validation via EF Core.</p>
                </div>
                <div>
                  <div className="text-amber-400 font-semibold mb-1 text-xs uppercase tracking-wide">Quality Telemetry</div>
                  <p>Custom KPI tracking: TTFB, LCP, FCP, CLS. CSV / HTML exports for trend analysis.</p>
                </div>
                <div>
                  <div className="text-amber-400 font-semibold mb-1 text-xs uppercase tracking-wide">CI/CD</div>
                  <p>GitLab CI with parallelized execution; Azure Key Vault for secrets; source generator for route constants.</p>
                </div>
                <div className="mt-2 pt-3 border-t border-amber-400/20">
                  <div className="text-amber-400 font-semibold mb-2 text-xs uppercase tracking-wide">Structure</div>
                  <pre className="font-mono text-[11px] leading-relaxed text-gray-400 overflow-x-auto whitespace-pre bg-black/30 rounded-lg p-3">
{`qaatpw/
├── src/
│   ├── Fixtures/      // HybridFixture + TestBase
│   ├── Pages/         // 77 Page Objects (by domain)
│   ├── Tests/         // 49 test classes
│   ├── Helpers/       // Assert · Blazor · DB · Data
│   ├── Workflows/     // End-to-end user journeys
│   ├── Metrics/       // TTFB · LCP · FCP · CLS
│   ├── Config/        // Per-env + Azure Key Vault
│   ├── Data/          // Localization (10 locales)
│   └── Prompts/       // AI workflow templates
└── Tokero.Tests.slnx`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Performance Suite */}
            <div className="min-w-0 bg-gradient-to-br from-yellow-600/20 to-amber-600/10 p-6 rounded-2xl border border-yellow-400/30 hover:shadow-2xl hover:shadow-yellow-500/25 transition-all duration-300">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-xl flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-tight">Performance Suite</h3>
                  <p className="text-amber-300 text-xs">NBomber 6.x · .NET 10</p>
                </div>
              </div>
              <div className="space-y-3 text-sm text-gray-300">
                <div>
                  <div className="text-amber-400 font-semibold mb-1 text-xs uppercase tracking-wide">Scenario Categories</div>
                  <p>API endpoints, endurance soaks, SignalR / WebSocket handshake (independent-circuit), saturation curves.</p>
                </div>
                <div>
                  <div className="text-amber-400 font-semibold mb-1 text-xs uppercase tracking-wide">Infrastructure Layer</div>
                  <p>Client pool management, custom NBomber sinks, auth semaphores, configurable error class taxonomy.</p>
                </div>
                <div>
                  <div className="text-amber-400 font-semibold mb-1 text-xs uppercase tracking-wide">Profile Tiers</div>
                  <p>30+ ready-made profiles: Quick smoke, Progressive ramp, CDN-safe, Standard (origin), Stress / Spike.</p>
                </div>
                <div>
                  <div className="text-amber-400 font-semibold mb-1 text-xs uppercase tracking-wide">Observability</div>
                  <p>Grafana dashboards, Prometheus metrics, Sentry error tracking, pod-distribution tracking for HPA validation.</p>
                </div>
                <div className="mt-2 pt-3 border-t border-yellow-400/20">
                  <div className="text-amber-400 font-semibold mb-2 text-xs uppercase tracking-wide">Structure</div>
                  <pre className="font-mono text-[11px] leading-relaxed text-gray-400 overflow-x-auto whitespace-pre bg-black/30 rounded-lg p-3">
{`perf/
├── Scenarios/
│   ├── Api/         // API endpoint scenarios
│   ├── Endurance/   // Soak · memory leak
│   └── SignalR/     // WebSocket handshake
├── Infrastructure/
│   ├── ClientPools/ // HTTP client mgmt
│   ├── Auth/        // Tokens + semaphores
│   ├── Sinks/       // Custom NBomber sinks
│   ├── Diagnostics/ // Pod + CPU/Mem tracking
│   ├── Grafana/     // Dashboard provisioning
│   └── Sentry/      // Error tracking
├── Profiles/        // 30+ load profiles
├── Dashboard/       // Separate Blazor app
├── TestData/        // Sanitized fixtures
└── Tokero.PerfTests.slnx`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Reporting Platform */}
            <div className="min-w-0 bg-gradient-to-br from-black/30 to-amber-900/10 p-6 rounded-2xl border border-amber-400/30 hover:shadow-2xl hover:shadow-amber-500/25 transition-all duration-300">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-black rounded-xl flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-tight">Reporting Platform</h3>
                  <p className="text-amber-300 text-xs">Blazor Server · .NET 10</p>
                </div>
              </div>
              <div className="space-y-3 text-sm text-gray-300">
                <div>
                  <div className="text-amber-400 font-semibold mb-1 text-xs uppercase tracking-wide">Architecture</div>
                  <p>4-tier solution: Core (zero external deps) / Data (EF Core, repos) / Web (Blazor Server) / Tests.</p>
                </div>
                <div>
                  <div className="text-amber-400 font-semibold mb-1 text-xs uppercase tracking-wide">UI &amp; Charts</div>
                  <p>MudBlazor components, Blazor-ApexCharts for candlestick + trend visualizations, three-zone Duration page.</p>
                </div>
                <div>
                  <div className="text-amber-400 font-semibold mb-1 text-xs uppercase tracking-wide">Storage</div>
                  <p>Dual-provider data layer: SQLite for local dev, PostgreSQL (Supabase) for production — zero schema divergence.</p>
                </div>
                <div>
                  <div className="text-amber-400 font-semibold mb-1 text-xs uppercase tracking-wide">Analytics</div>
                  <p>NUnit XML parsing pipeline, flaky-test detection, duration regression at 10% threshold, configurable data retention.</p>
                </div>
                <div className="mt-2 pt-3 border-t border-amber-400/20">
                  <div className="text-amber-400 font-semibold mb-2 text-xs uppercase tracking-wide">Structure</div>
                  <pre className="font-mono text-[11px] leading-relaxed text-gray-400 overflow-x-auto whitespace-pre bg-black/30 rounded-lg p-3">
{`pulse/
├── TestReportingTool.Core/   // Domain (zero ext deps)
│   ├── Models/
│   ├── Interfaces/
│   ├── Services/
│   ├── Constants/
│   └── Utils/
├── TestReportingTool.Data/   // EF Core + repositories
├── TestReportingTool.Web/    // Blazor Server UI
│   ├── Components/           // MudBlazor + ApexCharts
│   ├── Controllers/
│   └── Services/
├── TestReportingTool.Tests/  // xUnit + Moq
└── TestReportingTool.slnx`}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Two callouts: DB engagement + AI-augmented workflow */}
          <div className="grid md:grid-cols-2 gap-6">

            {/* DB engagement */}
            <div className="min-w-0 bg-white/5 p-6 rounded-2xl border border-white/10">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-amber-600 to-yellow-600 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
                <h3 className="text-lg font-bold text-white">Railway QA Stack (current engagement)</h3>
              </div>
              <div className="space-y-2 text-sm text-gray-300">
                <p><span className="text-amber-400 font-semibold">Karate API regression suite</span> (Java 17) — 264 feature files across 17 microservice domains (billing, train-path, master-data), exercising 23 services.</p>
                <p><span className="text-amber-400 font-semibold">Playwright UI framework</span> (TypeScript) — 22 page objects with separated locator classes, 152 specs / 254 tests, plus typed OpenAPI clients for 44 services.</p>
                <p><span className="text-amber-400 font-semibold">CI integration</span> — GitLab CI: Karate runs a 23-job sequential regression pipeline; reports to GitLab Pages and synced into Jira / XRay.</p>
                <p><span className="text-amber-400 font-semibold">Test data &amp; infra</span> — multi-database setup (PostgreSQL / MySQL / Oracle) with Kubernetes secret injection; 134 SQL scripts plus Excel/JSON fixtures.</p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="text-amber-400 font-semibold mb-2 text-xs uppercase tracking-wide">Representative Structure</div>
                <pre className="font-mono text-[11px] leading-relaxed text-gray-400 overflow-x-auto whitespace-pre bg-black/30 rounded-lg p-3">
{`act-backend-tests/          // Karate API · Java 17
├── src/test/java/
│   ├── karate-config.js    // env switch (tu/abn/e2e/eu) + URLs
│   ├── services/
│   │   ├── BaseTest.java   // parallel run + Cucumber reports
│   │   ├── Run*.java       // 22 JUnit5 runners (by @tag)
│   │   └── 17 domains/     // 264 .feature files
│   └── logback-test.xml    // logging config
├── templates/              // GitLab CI · 23 sequential jobs
│   ├── base_pipeline.yml   // stages · secrets · job templates
│   └── test-env-*.yml      // TU / ABN / E2E triggers
├── scripts/                // xray-post · xray-attachment · merge-xml
└── pom.xml                 // Karate 1.4.1 · JUnit5 · multi-DB drivers

playwright-tests-automation/  // Playwright UI · TypeScript
├── pages/         // 22 page objects (BasePage)
├── locators/      // 17 locator classes (selector-only)
├── clients/       // openapi-fetch client factory
├── generated/     // 12 OpenAPI → TS type files
├── config/        // 7 environments · 44 services
├── helpers/       // fixtures · DB · SQL · multi-user
├── sql/           // 18 reusable SQL scripts
├── data/          // 63 fixtures (xls/xlsx/json/pdf)
├── tests/         // 22 areas · 152 specs · 254 tests
│   ├── auth.setup.ts  // KeyCloak auth project
│   └── …/             // specs by business area
├── templates/     // CI + secret management
└── playwright.config.ts`}
                </pre>
                <p className="text-[10px] text-gray-500 italic mt-2">Real two-repo split (Karate API + Playwright UI); structure condensed, internal names sanitized.</p>
              </div>
            </div>

            {/* AI-Augmented Workflow */}
            <div className="min-w-0 bg-gradient-to-br from-cyan-600/15 to-blue-600/10 p-6 rounded-2xl border border-cyan-400/30">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-white">AI-Augmented Authoring Loop</h3>
              </div>
              <div className="space-y-2 text-sm text-gray-300">
                <p><span className="text-cyan-300 font-semibold">9+ custom Claude Code skills</span> for standardized Page Object &amp; test generation (e.g. /generate-page, /generate-test, /verify-test, /debug-failure).</p>
                <p><span className="text-cyan-300 font-semibold">Playwright MCP</span> integration — agentic UI verification of new tests interactively before commit.</p>
                <p><span className="text-cyan-300 font-semibold">Subagent-driven roles</span> — planner / generator / reviewer separation for higher-quality artifacts.</p>
                <p><span className="text-cyan-300 font-semibold">Plan-first / spec-driven</span> — flow goes specs → executable plans → implementation, keeping tests aligned with intent.</p>
              </div>
              <div className="mt-4 pt-3 border-t border-cyan-400/20">
                <div className="text-cyan-300 font-semibold mb-2 text-xs uppercase tracking-wide">Skill Layout</div>
                <pre className="font-mono text-[11px] leading-relaxed text-gray-400 overflow-x-auto whitespace-pre bg-black/30 rounded-lg p-3">
{`qaatpw/.claude/
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
└── settings.json           // MCP + tool config`}
                </pre>
                <p className="text-[10px] text-gray-500 italic mt-2">9 production skills active in the test repo — Playwright MCP + Supabase MCP wired in.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Skills Section */}
      <section id="skills" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-12 text-center">Technical Skills</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {Object.entries(skills).map(([category, skillList], index) => {
              const colors = [
                { bg: 'from-amber-600/20 to-yellow-600/10', border: 'border-amber-400/30', icon: 'from-amber-500 to-yellow-500', shadow: 'hover:shadow-amber-500/25' },
                { bg: 'from-yellow-600/20 to-amber-600/10', border: 'border-yellow-400/30', icon: 'from-yellow-500 to-amber-500', shadow: 'hover:shadow-yellow-500/25' },
                { bg: 'from-gray-800/40 to-black/20', border: 'border-amber-400/30', icon: 'from-amber-500 to-gray-800', shadow: 'hover:shadow-amber-500/25' },
                { bg: 'from-black/30 to-amber-900/10', border: 'border-yellow-400/30', icon: 'from-yellow-500 to-amber-600', shadow: 'hover:shadow-amber-500/25' },
                { bg: 'from-cyan-600/20 to-blue-600/10', border: 'border-cyan-400/40', icon: 'from-cyan-400 to-blue-500', shadow: 'hover:shadow-cyan-500/30' }
              ];
              const color = colors[index % colors.length];

              const icons = [
                <svg key="icon-0" className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
                <svg key="icon-1" className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
                <svg key="icon-2" className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>,
                <svg key="icon-3" className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
                <svg key="icon-4" className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.091zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/></svg>
              ];

              return (
                <div key={index} className="relative group h-full">
                  <div className={`h-full bg-gradient-to-br ${color.bg} p-6 rounded-2xl border ${color.border} transform transition-all duration-300 hover:scale-105 hover:shadow-2xl ${color.shadow}`}>
                    <div className="relative mb-4">
                      <div className={`w-12 h-12 bg-gradient-to-r ${color.icon} rounded-full flex items-center justify-center shadow-lg mx-auto`}>
                        {icons[index % icons.length]}
                      </div>
                      {index === 0 && (
                        <div className="absolute inset-0 bg-amber-400/20 rounded-full animate-ping mx-auto w-12 h-12"></div>
                      )}
                      {index === 1 && (
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                          <div className="flex space-x-1">
                            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                        </div>
                      )}
                      {index === 2 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full flex items-center justify-center animate-spin" style={{animationDuration: '3s'}}>
                          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        </div>
                      )}
                      {index === 3 && (
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                          <div className="w-6 h-0.5 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full animate-pulse"></div>
                        </div>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-4 text-center">{category}</h3>
                    <div className="space-y-2">
                      {skillList.map((skill, skillIndex) => (
                        <div key={skillIndex} className="flex items-center space-x-2">
                          <div className={`w-2 h-2 bg-gradient-to-r ${color.icon} rounded-full animate-pulse`} style={{animationDelay: `${skillIndex * 0.1}s`}}></div>
                          <span className="text-gray-300 text-sm">{skill}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Certifications Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-12 text-center">Certifications & Learning</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* ISTQB Foundation */}
            <div className="relative group">
              <div className="bg-gradient-to-br from-amber-600/20 to-yellow-600/10 p-6 rounded-2xl border border-amber-400/30 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25">
                <div className="relative mb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full flex items-center justify-center shadow-lg mx-auto">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-2">ISTQB Foundation Level</h3>
                <p className="text-gray-300 text-sm text-center mb-3 leading-relaxed">
                  Certified Tester Foundation Level - Software Testing Fundamentals
                </p>
                <div className="text-center">
                  <div className="text-sm text-amber-400 mb-1 font-medium">Done</div>
                  <p className="text-gray-400 text-xs">Since July 2021</p>
                </div>
              </div>
            </div>

            {/* PSM I Certification */}
            <div className="relative group">
              <div className="bg-gradient-to-br from-yellow-600/20 to-amber-600/10 p-6 rounded-2xl border border-yellow-400/30 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/25">
                <div className="relative mb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full flex items-center justify-center shadow-lg mx-auto">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-2">Professional Scrum Master I</h3>
                <p className="text-gray-300 text-sm text-center mb-3 leading-relaxed">
                  PSM I — Scrum framework fundamentals and Agile delivery practices
                </p>
                <div className="text-center">
                  <div className="text-sm text-amber-400 mb-1 font-medium">Done</div>
                  <p className="text-gray-400 text-xs">Scrum.org certified</p>
                </div>
              </div>
            </div>

            {/* Playwright Certification */}
            <div className="relative group">
              <div className="bg-gradient-to-br from-yellow-600/20 to-amber-600/10 p-6 rounded-2xl border border-yellow-400/30 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/25">
                <div className="relative mb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full flex items-center justify-center shadow-lg mx-auto">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-amber-400/20 rounded-full animate-ping mx-auto w-16 h-16"></div>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-2">Playwright Expert</h3>
                <p className="text-gray-300 text-sm text-center mb-3 leading-relaxed">
                  Advanced E2E testing with TypeScript/.NET and parallel execution
                </p>
                <div className="text-center">
                  <div className="text-sm text-amber-400 mb-1 font-medium">Professional Experience</div>
                  <p className="text-gray-400 text-xs">{playwrightYears}+ years hands-on</p>
                </div>
              </div>
            </div>

            {/* GitLab */}
            <div className="relative group">
              <div className="bg-gradient-to-br from-black/30 to-amber-900/10 p-6 rounded-2xl border border-amber-400/30 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25">
                <div className="relative mb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-black rounded-full flex items-center justify-center shadow-lg mx-auto">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-2">GitLab</h3>
                <p className="text-gray-300 text-sm text-center mb-3 leading-relaxed">
                  CI/CD pipelines, version control, and DevOps practices
                </p>
                <div className="text-center">
                  <div className="text-sm text-amber-400 mb-1 font-medium">Active Usage</div>
                  <p className="text-gray-400 text-xs">Daily workflow</p>
                </div>
              </div>
            </div>

            {/* Kubernetes & Docker */}
            <div className="relative group">
              <div className="bg-gradient-to-br from-gray-800/40 to-black/20 p-6 rounded-2xl border border-amber-400/30 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25">
                <div className="relative mb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-gray-800 rounded-full flex items-center justify-center shadow-lg mx-auto">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6L23 9l-11-6zM18.82 9L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full flex items-center justify-center animate-spin" style={{animationDuration: '3s'}}>
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-2">Container Technologies</h3>
                <p className="text-gray-300 text-sm text-center mb-3 leading-relaxed">
                  Docker containerization and Kubernetes orchestration
                </p>
                <div className="text-center">
                  <div className="text-sm text-amber-400 mb-1 font-medium">Enterprise Level</div>
                  <p className="text-gray-400 text-xs">Production systems</p>
                </div>
              </div>
            </div>

            {/* API Testing */}
            <div className="relative group">
              <div className="bg-gradient-to-br from-amber-600/30 to-yellow-600/10 p-6 rounded-2xl border border-amber-400/30 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25">
                <div className="relative mb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full flex items-center justify-center shadow-lg mx-auto">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-amber-400/30 rounded-full animate-pulse mx-auto w-16 h-16"></div>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-2">API Testing Expert</h3>
                <p className="text-gray-300 text-sm text-center mb-3 leading-relaxed">
                  Karate Framework, Postman, and microservices validation
                </p>
                <div className="text-center">
                  <div className="text-sm text-amber-400 mb-1 font-medium">Professional Experience</div>
                  <p className="text-gray-400 text-xs">{karateYears}+ years hands-on</p>
                </div>
              </div>
            </div>

            {/* Continuous Learning */}
            <div className="relative group lg:col-start-2">
              <div className="bg-gradient-to-br from-black/40 to-yellow-600/10 p-6 rounded-2xl border border-yellow-400/30 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25">
                <div className="relative mb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-black rounded-full flex items-center justify-center shadow-lg mx-auto">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                    <div className="w-8 h-1 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white text-center mb-2">Continuous Learning</h3>
                <p className="text-gray-300 text-sm text-center mb-3 leading-relaxed">
                  Exploring AI testing tools and visual regression testing
                </p>
                <div className="text-center">
                  <div className="text-sm text-amber-400 mb-1 font-medium">Always Growing</div>
                  <p className="text-gray-400 text-xs">Future-focused</p>
                </div>
              </div>
            </div>

          </div>

          {/* Learning Goals */}
          <div className="mt-12 bg-gradient-to-r from-black/40 to-amber-900/20 p-8 rounded-2xl border border-amber-400/30">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">Learning Goals</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <h4 className="text-white font-semibold mb-2">Technical/QA Lead</h4>
                <p className="text-gray-300 text-sm">Advancing toward Tech/QA Lead through strategic test leadership,
                  team mentoring, and enterprise-scale automation frameworks
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                </div>
                <h4 className="text-white font-semibold mb-2">AI-Powered Testing</h4>
                <p className="text-gray-300 text-sm">Machine learning in test automation and predictive quality analytics</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-black rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <h4 className="text-white font-semibold mb-2">Security Testing</h4>
                <p className="text-gray-300 text-sm">Advanced security testing techniques and OWASP methodologies</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-6 bg-black/20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-6 text-center">Let&apos;s Work Together</h2>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto text-center">
            Interested in discussing QA automation opportunities or have questions about testing strategies?
            I&apos;d love to hear from you.
          </p>

          <p className="text-amber-300 text-center max-w-2xl mx-auto mb-12 -mt-8 font-medium">
            Currently wrapping up my engagement with Deutsche Bahn (through October 2026) — available for new roles and contracts from November 2026.
          </p>

          <div className="max-w-lg mx-auto">
            {/* Contact Links */}
            <div className="bg-gradient-to-br from-white/5 to-white/2 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4 text-center">Connect Directly</h3>

                <div className="space-y-4">
                  <a
                    href="https://www.linkedin.com/in/%C8%99erban-andrei-5a14a51a5/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-4 p-4 bg-gradient-to-r from-amber-600/20 to-yellow-600/10 border border-amber-400/30 rounded-lg hover:bg-gradient-to-r hover:from-amber-600/30 hover:to-yellow-600/20 transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-amber-500"
                    aria-label="Connect with me on LinkedIn (opens in new tab)"
                  >
                    <div className="relative">
                      <svg className="w-8 h-8 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
                    </div>
                    <div>
                      <div className="text-white font-semibold">LinkedIn</div>
                      <div className="text-gray-300 text-sm">Professional network</div>
                    </div>
                  </a>

                  <a
                    href="mailto:andre.serban96@gmail.com"
                    className="flex items-center space-x-4 p-4 bg-gradient-to-r from-gray-800/50 to-black/50 border border-amber-400/30 rounded-lg hover:bg-gradient-to-r hover:from-gray-700/60 hover:to-gray-800/60 transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-amber-500"
                    aria-label="Send me an email"
                  >
                    <div className="relative">
                      <svg className="w-8 h-8 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z"/>
                        <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z"/>
                      </svg>
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                      </div>
                    </div>
                    <div>
                      <div className="text-white font-semibold">Email</div>
                      <div className="text-gray-300 text-sm">andre.serban96@gmail.com</div>
                    </div>
                  </a>

                  <a
                    href="https://aserban.ro"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-4 p-4 bg-gradient-to-r from-cyan-600/15 to-blue-600/10 border border-cyan-400/30 rounded-lg hover:bg-gradient-to-r hover:from-cyan-600/25 hover:to-blue-600/20 transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    aria-label="Visit my portfolio site (opens in new tab)"
                  >
                    <div className="relative">
                      <svg className="w-8 h-8 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 010 18M12 3a14.5 14.5 0 000 18" />
                      </svg>
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
                    </div>
                    <div>
                      <div className="text-white font-semibold">Portfolio</div>
                      <div className="text-gray-300 text-sm">aserban.ro</div>
                    </div>
                  </a>
                </div>

              <div className="mt-6 p-4 bg-gradient-to-br from-white/5 to-white/2 rounded-lg border border-white/10">
                <h4 className="text-lg font-bold text-white mb-3">Quick Response Time</h4>
                <p className="text-gray-300 text-sm leading-relaxed">
                  I typically respond to messages within 24 hours. For urgent matters,
                  LinkedIn tends to be the fastest way to reach me.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-400">
            © 2026 Șerban Andrei  ·  <a href="https://aserban.ro" className="hover:text-amber-400 transition-colors">aserban.ro</a>  ·  Built with Next.js and Tailwind CSS.
          </p>
        </div>
      </footer>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-40 bg-gradient-to-r from-amber-600 to-yellow-600 text-black p-3 rounded-full shadow-2xl hover:shadow-amber-500/25 transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black"
          aria-label="Scroll back to top"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
    </div>
  )
}
