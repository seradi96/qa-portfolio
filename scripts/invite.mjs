// Mints one invite link and prints the LinkedIn DM to paste with it.
//
//   npm run invite -- --name "Maria Popescu" --role "QA Lead" --company TOKERO \
//                     --project tokero --message "You saw the whole thing from the inside."
//
// Nothing is stored: the signed link IS the invite. Add --days -1 to mint an already-expired
// link, which is how the /invite expiry screen gets tested (manual checklist item 8).
import { existsSync, readFileSync } from 'node:fs'

const ENV_PATH = new URL('../.env.local', import.meta.url)

// A ten-line .env parser instead of dotenv, because this repo has zero runtime dependencies and
// this file is read once, by one person, on one laptop.
function parseEnvFile(text) {
  const out = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    const quoted = value.length >= 2 && (value.startsWith('"') || value.startsWith("'"))
    if (quoted && value.endsWith(value[0])) value = value.slice(1, -1)
    out[key] = value
  }
  return out
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const eq = arg.indexOf('=')
    if (eq !== -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[arg.slice(2)] = 'true'
    } else {
      out[arg.slice(2)] = next
      i += 1
    }
  }
  return out
}

function fail(message) {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

if (!existsSync(ENV_PATH)) {
  fail('No .env.local. Copy .env.local.example to .env.local and fill in INVITE_SECRET and MOD_SECRET.')
}

const env = parseEnvFile(readFileSync(ENV_PATH, 'utf8'))
// Both secrets, not just the invite one: src/lib/token.ts asserts them at module load.
process.env.INVITE_SECRET = process.env.INVITE_SECRET ?? env.INVITE_SECRET
process.env.MOD_SECRET = process.env.MOD_SECRET ?? env.MOD_SECRET

// A .mjs CAN import a .ts module here — Node >= 22.18 strips types natively — so there is no
// duplicated copy of the signing logic to drift. It only works with the explicit .ts extension.
const { PROJECT_LABELS, PROJECT_SLUGS, isProjectSlug } = await import('../src/lib/projects-meta.ts')
const { INVITE_TTL_DAYS, SITE_ORIGIN, signInviteToken, verifyInviteToken } = await import(
  '../src/lib/token.ts'
)

const args = parseArgs(process.argv.slice(2))
const name = args.name ?? ''
const role = args.role ?? ''
const company = args.company ?? ''
const projectSlug = args.project ?? ''
const message =
  args.message ?? 'You saw the whole thing from the inside - would you write a few lines?'
const days = Number(args.days ?? INVITE_TTL_DAYS)

if (!name || !role || !company || !projectSlug) {
  fail(
    'Usage: npm run invite -- --name "Maria Popescu" --role "QA Lead" --company TOKERO ' +
      '--project tokero [--message "..."] [--days 45]',
  )
}
if (!isProjectSlug(projectSlug)) {
  fail(`--project must be one of: ${PROJECT_SLUGS.join(', ')}`)
}
if (!Number.isFinite(days)) {
  fail('--days must be a number')
}

const exp = Math.floor(Date.now() / 1000) + Math.round(days * 86400)
const fields = { v: '1', name, role, company, projectSlug, message, exp }
const secret = process.env.INVITE_SECRET

const token = signInviteToken(fields, secret)
const url = `${SITE_ORIGIN}/invite#${token}`

// A link that does not verify with the same code the route handler runs is worse than no link, so
// mint and verify in one breath rather than hearing about it from a colleague three days later.
const verified = verifyInviteToken(token, secret)
if (verified === null) fail('The minted token did not verify. Do not send this link.')
for (const [key, value] of Object.entries(fields)) {
  if (verified[key] !== value) {
    fail(
      `Round trip changed ${key}: minted ${JSON.stringify(value)}, verified ${JSON.stringify(verified[key])}`,
    )
  }
}

const firstName = name.trim().split(/\s+/)[0]
const projectLabel =
  projectSlug === 'other' ? 'the work we did together' : PROJECT_LABELS[projectSlug]
const expires = new Date(exp * 1000)

console.log(`
Link (${url.length} chars, expires ${expires.toISOString().slice(0, 10)}${days < 0 ? ' — ALREADY EXPIRED' : ''}):

${url}

--- paste into a LinkedIn DM ------------------------------------------------

Hi ${firstName},

I'm adding a short testimonials section to my portfolio (aserban.ro) and I'd love to include something from you about ${projectLabel} — if you're up for it.

The link below is just for you. Four short questions, the last one open-ended; five to ten minutes, and it works fine on a phone. It opens already filled in with your name and role, so mostly you're proof-reading.

What would appear on the site: your name, your role and company at the time we worked together, a link to your LinkedIn, and what you write. Nothing else. Nothing goes live until I've read it, and you can have it taken down later at any point.

Two honest asks: keep it to things that are fine to say publicly — no internal detail — and do check your employer is comfortable with it, since some companies have rules about giving references.

And genuinely, no pressure. If it's a bad time or just not your thing, ignore this and nothing changes between us.

${url} — it expires in ${days} days, tell me if you'd like a fresh one.

Thanks either way,
Andrei

-----------------------------------------------------------------------------
`)
