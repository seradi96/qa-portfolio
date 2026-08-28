import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { QA_CAREER_START, getYearsSince } from "@/lib/career";

const yearsInTech = getYearsSince(QA_CAREER_START);

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://aserban.ro"),
  title: "Șerban Andrei - Senior QA Automation Engineer & Test Architect",
  description: `Senior QA Automation Engineer & Test Architect. ${yearsInTech}+ years in tech. Currently automation lead for Deutsche Bahn's SAP ERP railway system at Heaven Solutions (Karate API, Playwright UI) through October 2026, after concluding a senior engagement as sole QA architect at TOKERO (Playwright .NET, NBomber, Blazor reporting) in August 2026. AI-augmented QA practitioner. Available from November 2026.`,
  keywords: [
    "QA Automation Engineer",
    "Test Architect",
    "Test Automation",
    "Playwright",
    "Karate API",
    "NBomber",
    "Selenium",
    "API Testing",
    "CI/CD",
    "TypeScript",
    "C#",
    ".NET",
    "Java",
    "Blazor",
    "Quality Assurance",
    "Software Testing",
    "Test Frameworks",
    "AI-Augmented QA",
    "Claude Code",
    "Playwright MCP"
  ],
  authors: [{ name: "Șerban Andrei", url: "https://aserban.ro" }],
  creator: "Șerban Andrei",
  publisher: "Șerban Andrei",
  robots: "index, follow",
  alternates: {
    canonical: "https://aserban.ro"
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://aserban.ro",
    siteName: "Șerban Andrei - QA Portfolio",
    title: "Șerban Andrei - Senior QA Automation Engineer & Test Architect",
    description: "Senior QA Automation Engineer & Test Architect. Automation lead for Deutsche Bahn at Heaven Solutions through October 2026, after a senior engagement as sole QA architect at TOKERO. AI-augmented QA practitioner — available from November 2026.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Șerban Andrei - QA Automation Engineer Portfolio"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Șerban Andrei - Senior QA Automation Engineer & Test Architect",
    description: "Senior QA Automation Engineer & Test Architect. AI-augmented QA practitioner — available for new engagements from November 2026.",
    images: ["/og-image.jpg"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#b45309"
};

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://aserban.ro/#person",
  name: "Șerban Andrei",
  alternateName: "Andrei Șerban",
  jobTitle: "Senior QA Automation Engineer & Test Architect",
  email: "mailto:andre.serban96@gmail.com",
  url: "https://aserban.ro",
  image: "https://aserban.ro/og-image.jpg",
  description:
    "Senior QA Automation Engineer & Test Architect. Automation lead for Deutsche Bahn's SAP ERP Integrated Railway Management System at Heaven Solutions through October 2026, after concluding a senior engagement as sole architect of the QA stack at TOKERO in August 2026. AI-augmented QA practitioner using Claude Code, MCP integrations, and spec-driven automation. Available for new engagements from November 2026.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Iași",
    addressCountry: "RO"
  },
  nationality: {
    "@type": "Country",
    name: "Romania"
  },
  sameAs: [
    "https://www.linkedin.com/in/șerban-andrei-5a14a51a5"
  ],
  worksFor: [
    {
      "@type": "Organization",
      name: "Heaven Solutions",
      url: "https://www.heavensolutions.com"
    }
  ],
  knowsAbout: [
    "QA Automation",
    "Test Architecture",
    "Playwright",
    "Playwright .NET",
    "Karate API",
    "NBomber",
    "Selenium WebDriver",
    "C# / .NET",
    "Java",
    "TypeScript",
    "Blazor Server",
    "AI-Augmented QA",
    "Claude Code",
    "Model Context Protocol (MCP)",
    "GitLab CI/CD",
    "Kubernetes",
    "Performance Testing",
    "API Testing",
    "BDD",
    "Cucumber",
    "Shift-Left Testing",
    "Root Cause Analysis"
  ],
  hasCredential: [
    {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "certification",
      name: "ISTQB Certified Tester Foundation Level (CTFL)",
      recognizedBy: {
        "@type": "Organization",
        name: "ISTQB / Brightest"
      }
    },
    {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "certification",
      name: "Professional Scrum Master I (PSM I)",
      recognizedBy: {
        "@type": "Organization",
        name: "Scrum.org"
      }
    }
  ],
  alumniOf: [
    {
      "@type": "CollegeOrUniversity",
      name: '"Gheorghe Asachi" Technical University of Iași',
      url: "https://ieeia.tuiasi.ro"
    },
    {
      "@type": "Organization",
      name: "TOKERO Crypto Exchange",
      url: "https://tokero.com"
    }
  ],
  knowsLanguage: [
    { "@type": "Language", name: "Romanian", alternateName: "ro" },
    { "@type": "Language", name: "English", alternateName: "en" },
    { "@type": "Language", name: "French", alternateName: "fr" }
  ]
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Șerban Andrei — QA Portfolio",
  url: "https://aserban.ro",
  author: { "@id": "https://aserban.ro/#person" },
  inLanguage: "en-US",
  description:
    "Portfolio of Șerban Andrei — Senior QA Automation Engineer & Test Architect. Architecture, design patterns, and AI-augmented QA workflows."
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
