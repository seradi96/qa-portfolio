#!/usr/bin/env node
// Post-build gates. Zero dependencies, runs after `npm run build` via the npm `postbuild` lifecycle.
//
// 1. The home page must still be statically prerendered. SEO visibility and TTFB both rest on it,
//    and nothing else in this repo can catch a regression.
// 2. No server secret may appear anywhere in the shipped bundle.
// 3. When testimonials.json is non-empty, every published author must be in the prerendered HTML —
//    proof the content reached the HTML and not only the client chunks.
//
// The closing line is built from what actually ran, not hardcoded. A check that was SKIPPED
// (a secret not set locally, an empty testimonials store) must never be reported the same way as
// one that ran and came back clean — a guard that claims success for work it didn't do is worse
// than no guard at all. See the "N/M checked" counts folded into the final summary line below.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const failures = []
const notices = []
const fail = (msg) => failures.push(msg)
const note = (msg) => notices.push(msg)

const HOME_HTML = join(ROOT, '.next', 'server', 'app', 'index.html')

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    else if (entry.isFile()) acc.push(full)
  }
  return acc
}

// ---------- 1. the home page is still static ----------
// Read prerender-manifest.json, NOT routes-manifest.json: the latter lists '/' under staticRoutes
// either way, because that field means "no dynamic segments", not "statically rendered".
// Also do NOT try to parse `next build`'s terminal route table (the ○ / vs ƒ / glyphs) — that
// table only exists as stdout from the `next build` process itself, and `postbuild` is a separate
// process that runs after that output is gone, so there is nothing to grep.
let staticSummary = 'static: NOT verified'
const manifestPath = join(ROOT, '.next', 'prerender-manifest.json')
if (!existsSync(manifestPath)) {
  fail('.next/prerender-manifest.json is missing — run `npm run build` first')
  staticSummary = 'static: NOT verified (manifest missing)'
} else {
  let routes = []
  let manifestParsed = true
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    routes = Object.keys(manifest.routes ?? {})
  } catch {
    fail('.next/prerender-manifest.json is not valid JSON')
    manifestParsed = false
  }
  if (!manifestParsed) {
    staticSummary = 'static: NOT verified (manifest unreadable)'
  } else if (routes.length > 0 && !routes.includes('/')) {
    fail(
      "the home page is no longer statically prerendered: '/' is absent from " +
        `.next/prerender-manifest.json routes (found: ${routes.join(', ')}). ` +
        'Something in the `/` import graph went dynamic — cookies(), headers(), searchParams, ' +
        'a `dynamic` export, or an uncached fetch.'
    )
    staticSummary = "static: FAILED — '/' missing from the prerender manifest"
  } else {
    staticSummary = "static: verified — '/' is in the prerender manifest"
  }
}
if (!existsSync(HOME_HTML)) {
  fail('.next/server/app/index.html is missing — the home page produced no prerendered HTML')
  staticSummary += '; index.html missing'
}

// ---------- 2. no secret in the bundle ----------
const SECRET_NAMES = ['INVITE_SECRET', 'MOD_SECRET', 'ADMIN_PASSWORD', 'GITHUB_TOKEN']

// npm does not load .env.local, and `postbuild` is a separate process from `next build`, so read the
// file directly — otherwise this gate is dead weight on the machine where the secrets actually live.
function loadEnvLocal() {
  const out = {}
  const path = join(ROOT, '.env.local')
  if (!existsSync(path)) return out
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const envLocal = loadEnvLocal()
// Every directory .next actually serves to a browser: the static chunks/CSS/media, the app-router
// prerendered HTML/RSC payloads, and the pages-router-style fallback error pages Next still emits
// (server/pages/404.html, 500.html) even in an app-router-only project like this one.
//
// Deliberately NOT scanned, and why each is out of scope:
//   .next/server/chunks (incl. chunks/ssr) — server-only compiled code, executed by the Node
//     process and never returned as an HTTP response body.
//   .next/build, .next/cache, .next/diagnostics — build tooling output and cache, never shipped.
//   .next/types — generated TypeScript route types, not runtime output at all.
//   the top-level .next/server/*.json / *.js manifests (pages-manifest.json,
//     middleware-manifest.json, server-reference-manifest.json, …) — read by the Next.js server
//     process itself to route requests, not sent to a browser.
// If a future Next.js version starts serving one of those directly, this comment is the place to
// notice and widen the scan.
const bundleFiles = [
  ...walk(join(ROOT, '.next', 'static')),
  ...walk(join(ROOT, '.next', 'server', 'app')),
  ...walk(join(ROOT, '.next', 'server', 'pages')),
]
const bundle = bundleFiles.map((file) => ({ file, buf: readFileSync(file) }))

// Literal-substring match only: this catches a secret pasted or interpolated verbatim into a
// bundle file. It does NOT catch a transformed copy — base64/hex/URL-encoded, re-cased, reversed,
// or split across concatenated string literals. That gap is accepted as proportionate for a
// four-secret, zero-dependency script; if an encoded leak ever needs catching here, reach for a
// real secret scanner (gitleaks / trufflehog) rather than growing this one into one.
let secretsChecked = 0
let secretsFound = 0
for (const name of SECRET_NAMES) {
  const value = process.env[name] ?? envLocal[name]
  if (!value) {
    note(`${name} is not set here — leak check skipped (it runs on Vercel, where it is set)`)
    continue
  }
  if (value.length < 8) {
    note(`${name} is shorter than 8 characters — too short to grep for without false positives`)
    continue
  }
  secretsChecked += 1
  for (const { file, buf } of bundle) {
    if (buf.includes(value)) {
      fail(`${name} appears verbatim in ${relative(ROOT, file)} — a server secret reached the client bundle`)
      secretsFound += 1
      break
    }
  }
}
const secretsSkipped = SECRET_NAMES.length - secretsChecked
let secretsSummary
if (secretsChecked === 0) {
  secretsSummary = `secrets: 0/${SECRET_NAMES.length} checked (not set in this environment)`
} else {
  secretsSummary = `secrets: ${secretsChecked}/${SECRET_NAMES.length} checked, ` +
    (secretsFound > 0 ? `${secretsFound} FOUND in the bundle` : 'none found')
  if (secretsSkipped > 0) {
    secretsSummary += ` (${secretsSkipped} skipped — not set in this environment)`
  }
}

for (const file of walk(join(ROOT, 'src'))) {
  if (readFileSync(file, 'utf8').includes('NEXT_PUBLIC_')) {
    fail(
      `${relative(ROOT, file)} references NEXT_PUBLIC_ — this project has no public env vars, ` +
        'and anything prefixed that way is inlined into the client bundle'
    )
  }
}

// ---------- 3. testimonial content reached the prerendered HTML ----------
// Checks every published record, not just the newest — a rendering regression that only breaks an
// older testimonial (still on the page, further down) would otherwise pass unnoticed.
function escapeForHtml(name) {
  // React escapes & < > " ' in text nodes; compare against both the raw and escaped forms.
  return name
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

const storePath = join(ROOT, 'src', 'content', 'testimonials.json')
let contentSummary = 'content: skipped (no store file)'
if (existsSync(storePath) && existsSync(HOME_HTML)) {
  let records = []
  try {
    records = JSON.parse(readFileSync(storePath, 'utf8'))
  } catch {
    fail('src/content/testimonials.json is not valid JSON')
  }
  const usable = (Array.isArray(records) ? records : []).filter(
    (r) =>
      r && typeof r.publishedAt === 'string' && r.author && typeof r.author.name === 'string'
  )
  if (usable.length > 0) {
    const html = readFileSync(HOME_HTML, 'utf8')
    const missing = usable
      .map((r) => r.author.name)
      .filter((name) => !html.includes(name) && !html.includes(escapeForHtml(name)))
    if (missing.length > 0) {
      fail(
        `${missing.length}/${usable.length} testimonial author(s) not in .next/server/app/index.html: ` +
          `${missing.map((n) => `"${n}"`).join(', ')} — the testimonials reached the client bundle ` +
          'only, so Google and LLM crawlers cannot see them'
      )
      contentSummary = `content: FAILED — ${missing.length}/${usable.length} author(s) missing from prerendered HTML`
    } else {
      note(`prerendered HTML contains all ${usable.length} published testimonial author(s)`)
      contentSummary = `content: verified in prerendered HTML (${usable.length}/${usable.length} author(s))`
    }
  } else {
    note('src/content/testimonials.json is empty — content check skipped')
    contentSummary = 'content: skipped (store empty)'
  }
} else if (existsSync(storePath) && !existsSync(HOME_HTML)) {
  contentSummary = 'content: skipped (no prerendered HTML to check against)'
}

// ---------- report ----------
for (const n of notices) console.log(`postbuild: note: ${n}`)
if (failures.length > 0) {
  for (const f of failures) console.error(`postbuild: FAIL: ${f}`)
  console.error(`postbuild: ${failures.length} check(s) failed`)
  process.exit(1)
}
console.log(`postbuild: OK — ${staticSummary}; ${secretsSummary}; ${contentSummary}`)
