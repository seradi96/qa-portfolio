#!/usr/bin/env node
// Post-build gates. Zero dependencies, runs after `npm run build` via the npm `postbuild` lifecycle.
//
// 1. The home page must still be statically prerendered. SEO visibility and TTFB both rest on it,
//    and nothing else in this repo can catch a regression.
// 2. No server secret may appear anywhere in the shipped bundle.
// 3. When testimonials.json is non-empty, the newest author must be in the prerendered HTML —
//    proof the content reached the HTML and not only the client chunks.

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
const manifestPath = join(ROOT, '.next', 'prerender-manifest.json')
if (!existsSync(manifestPath)) {
  fail('.next/prerender-manifest.json is missing — run `npm run build` first')
} else {
  let routes = []
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    routes = Object.keys(manifest.routes ?? {})
  } catch {
    fail('.next/prerender-manifest.json is not valid JSON')
  }
  if (routes.length > 0 && !routes.includes('/')) {
    fail(
      "the home page is no longer statically prerendered: '/' is absent from " +
        `.next/prerender-manifest.json routes (found: ${routes.join(', ')}). ` +
        'Something in the `/` import graph went dynamic — cookies(), headers(), searchParams, ' +
        'a `dynamic` export, or an uncached fetch.'
    )
  }
}
if (!existsSync(HOME_HTML)) {
  fail('.next/server/app/index.html is missing — the home page produced no prerendered HTML')
}

// ---------- 2. no secret in the bundle ----------
const SECRET_NAMES = ['INVITE_SECRET', 'MOD_SECRET', 'RESEND_API_KEY', 'GITHUB_TOKEN']

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
const bundleFiles = [
  ...walk(join(ROOT, '.next', 'static')),
  ...walk(join(ROOT, '.next', 'server', 'app')),
]
const bundle = bundleFiles.map((file) => ({ file, buf: readFileSync(file) }))

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
  for (const { file, buf } of bundle) {
    if (buf.includes(value)) {
      fail(`${name} appears verbatim in ${relative(ROOT, file)} — a server secret reached the client bundle`)
      break
    }
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
const storePath = join(ROOT, 'src', 'content', 'testimonials.json')
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
    const newest = usable.slice().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0]
    const name = newest.author.name
    // React escapes & < > " ' in text nodes; compare against both forms.
    const escaped = name
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
    const html = readFileSync(HOME_HTML, 'utf8')
    if (!html.includes(name) && !html.includes(escaped)) {
      fail(
        `"${name}" (newest record in src/content/testimonials.json) is not in ` +
          '.next/server/app/index.html — the testimonials reached the client bundle only, ' +
          'so Google and LLM crawlers cannot see them'
      )
    } else {
      note(`prerendered HTML contains the newest testimonial author ("${name}")`)
    }
  } else {
    note('src/content/testimonials.json is empty — content check skipped')
  }
}

// ---------- report ----------
for (const n of notices) console.log(`postbuild: note: ${n}`)
if (failures.length > 0) {
  for (const f of failures) console.error(`postbuild: FAIL: ${f}`)
  console.error(`postbuild: ${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('postbuild: OK — home page static, no secrets in the bundle, content in the HTML')
