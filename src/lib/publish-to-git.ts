/**
 * SERVER ONLY. Publishes an approved testimonial as a branch + pull request.
 * Zero dependencies: plain fetch against the GitHub REST API.
 *
 * Never writes to main. Every application-initiated wrong write — a replayed
 * moderation token, a bug in here — lands as an unmerged pull request with its own
 * Vercel preview instead of on production.
 */
import { Buffer } from 'node:buffer'
import { assertSecret } from '@/lib/token'
import type { TestimonialRecord } from '@/lib/token-types'
import { PROJECT_LABELS, isProjectSlug } from '@/lib/projects-meta'

export type PublishResult =
  | { status: 'already_published' }
  | { status: 'pr_open'; prUrl: string }
  | { status: 'pr_opened'; prUrl: string }

const OWNER = 'seradi96'
const REPO = 'qa-portfolio'
const BASE_BRANCH = 'main'
const FILE_PATH = 'src/content/testimonials.json'
const API = `https://api.github.com/repos/${OWNER}/${REPO}`

function ghHeaders(token: string, withJsonBody: boolean): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'aserban.ro-testimonials',
  }
  if (withJsonBody) h['Content-Type'] = 'application/json'
  return h
}

/** Returned, not thrown, so call sites can `throw await ghError(...)` and TypeScript
 *  sees the control flow end there. `preReadBody` lets a caller that already consumed
 *  the response stream (to inspect the body before deciding whether to throw) hand
 *  that text back in, since a Response body can only be read once. */
async function ghError(what: string, res: Response, preReadBody?: string): Promise<Error> {
  const body = preReadBody ?? (await res.text().catch(() => ''))
  return new Error(`GitHub ${what} failed: ${res.status} ${res.statusText} ${body.slice(0, 500)}`)
}

/**
 * GitHub hands base64 back wrapped at 60 characters, and the payload is UTF-8.
 * Buffer is the only correct codec here: atob()/btoa() are byte-per-char, so
 * "Șerban" would come back as mojibake and be re-encoded corrupted.
 */
function decodeBase64Utf8(b64: string): string {
  return Buffer.from(b64.replace(/\s+/g, ''), 'base64').toString('utf8')
}

function encodeBase64Utf8(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64')
}

type FileOnRef = { entries: unknown[]; sha: string }

async function readFile(token: string, ref: string): Promise<FileOnRef> {
  const res = await fetch(`${API}/contents/${FILE_PATH}?ref=${encodeURIComponent(ref)}`, {
    method: 'GET',
    headers: ghHeaders(token, false),
    cache: 'no-store',
  })
  if (!res.ok) throw await ghError(`read ${FILE_PATH}@${ref}`, res)

  const body = (await res.json()) as { content?: unknown; sha?: unknown; encoding?: unknown }
  if (typeof body.sha !== 'string' || typeof body.content !== 'string' || body.encoding !== 'base64') {
    throw new Error(`GitHub returned an unexpected shape for ${FILE_PATH}@${ref}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(decodeBase64Utf8(body.content))
  } catch {
    throw new Error(`${FILE_PATH}@${ref} is not valid JSON — repair it by hand before publishing`)
  }
  if (!Array.isArray(parsed)) throw new Error(`${FILE_PATH}@${ref} is not a JSON array`)
  return { entries: parsed, sha: body.sha }
}

function containsId(entries: unknown[], id: string): boolean {
  return entries.some(
    (e) => typeof e === 'object' && e !== null && (e as { id?: unknown }).id === id,
  )
}

function publishedAtOf(entry: unknown): string {
  if (typeof entry === 'object' && entry !== null) {
    const v = (entry as { publishedAt?: unknown }).publishedAt
    if (typeof v === 'string') return v
  }
  return '' // a hand-broken entry sorts last rather than crashing the publish
}

/**
 * The file is machine-written: the record goes through JSON.stringify, never a
 * string template. No answer text can break out of its own string literal, so
 * injecting structure into the data file is impossible by construction.
 */
function renderFile(entries: unknown[], record: TestimonialRecord): string {
  const next = [...entries, record]
  next.sort((a, b) => publishedAtOf(b).localeCompare(publishedAtOf(a))) // newest first
  return JSON.stringify(next, null, 2) + '\n'
}

async function putFile(
  token: string,
  branch: string,
  sha: string,
  json: string,
  record: TestimonialRecord,
): Promise<Response> {
  return fetch(`${API}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: ghHeaders(token, true),
    body: JSON.stringify({
      message: `content: add testimonial from ${record.author.name} (${record.author.company})\n\nRecord id: ${record.id}`,
      content: encodeBase64Utf8(json),
      sha,
      branch,
    }),
  })
}

/** `sha` is the blob sha of the file as it stands on `branch`. A 409 means it went
 *  stale between our read and our write; re-read the branch and try exactly once more. */
async function putFileWithRetry(
  token: string,
  branch: string,
  sha: string,
  json: string,
  record: TestimonialRecord,
): Promise<void> {
  const first = await putFile(token, branch, sha, json, record)
  if (first.ok) return
  if (first.status !== 409) throw await ghError(`write ${FILE_PATH} on ${branch}`, first)

  const fresh = await readFile(token, branch)
  if (containsId(fresh.entries, record.id)) return // the racing write was this record
  const second = await putFile(
    token,
    branch,
    fresh.sha,
    renderFile(fresh.entries, record),
    record,
  )
  if (!second.ok) throw await ghError(`write ${FILE_PATH} on ${branch} (retry)`, second)
}

/** `null` when the ref does not exist. Ids are base64url, so `heads/testimonial/<id>`
 *  never needs escaping and can never produce `..` or a trailing `.lock`. */
async function readRefSha(token: string, ref: string): Promise<string | null> {
  const res = await fetch(`${API}/git/ref/${ref}`, {
    method: 'GET',
    headers: ghHeaders(token, false),
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw await ghError(`read ref ${ref}`, res)

  const body = (await res.json()) as { object?: { sha?: unknown } }
  const sha = body.object?.sha
  if (typeof sha !== 'string') throw new Error(`GitHub returned an unexpected shape for ref ${ref}`)
  return sha
}

/**
 * `true` if this call created the ref, `false` if it already existed (absorbed as a 422 —
 * the same double-tap `openOrFindPullRequest` already tolerates on `/pulls`).
 *
 * The status code alone can't tell that apart from a real bug: `POST /git/refs` returns 422
 * for several distinct validation failures — a malformed ref name, a sha that doesn't resolve
 * to a commit, AND an already-existing ref all come back as 422. Only the response body's
 * message distinguishes "someone beat you to it" from "this request is actually broken", so
 * match on that, not on the status, and let every other 422 (and every other status) still
 * throw with the step named.
 */
async function createRef(token: string, ref: string, sha: string): Promise<boolean> {
  const res = await fetch(`${API}/git/refs`, {
    method: 'POST',
    headers: ghHeaders(token, true),
    body: JSON.stringify({ ref, sha }),
  })
  if (res.ok) return true

  if (res.status === 422) {
    const bodyText = await res.text().catch(() => '')
    let message: unknown
    try {
      message = (JSON.parse(bodyText) as { message?: unknown }).message
    } catch {
      message = undefined
    }
    if (typeof message === 'string' && /already exists/i.test(message)) return false
    throw await ghError(`create ref ${ref}`, res, bodyText)
  }

  throw await ghError(`create ref ${ref}`, res)
}

async function findOpenPullRequest(token: string, branch: string): Promise<string | null> {
  const query = new URLSearchParams({ state: 'open', head: `${OWNER}:${branch}`, per_page: '1' })
  const res = await fetch(`${API}/pulls?${query.toString()}`, {
    method: 'GET',
    headers: ghHeaders(token, false),
    cache: 'no-store',
  })
  if (!res.ok) throw await ghError(`list pull requests for ${branch}`, res)

  const body = (await res.json()) as unknown
  if (!Array.isArray(body) || body.length === 0) return null
  const url = (body[0] as { html_url?: unknown }).html_url
  return typeof url === 'string' ? url : null
}

function pullRequestBody(record: TestimonialRecord): string {
  const { author, answers } = record
  const label = isProjectSlug(record.projectSlug)
    ? PROJECT_LABELS[record.projectSlug]
    : record.projectSlug

  const lines: string[] = [
    `**${author.name}** — ${author.role}, ${author.company} (at the time)`,
    '',
    `Project: ${label}`,
    `LinkedIn: https://www.linkedin.com/in/${author.linkedinSlug}`,
    `Submitted ${record.submittedAt} · consent v${record.consent.version} at ${record.consent.at}`,
    '',
    '### To a hiring manager',
    answers.hiringManager,
  ]
  if (answers.whatChanged.trim() !== '') {
    lines.push('', '### What changed because of it', answers.whatChanged)
  }
  if (answers.whatIDid.trim() !== '') {
    lines.push('', '### What I was doing on the team', answers.whatIDid)
  }
  if (answers.anythingElse.trim() !== '') {
    lines.push('', '### Anything else', answers.anythingElse)
  }
  lines.push('', `Record id: \`${record.id}\``, '', 'Merging this publishes it to aserban.ro.')
  return lines.join('\n')
}

async function openOrFindPullRequest(
  token: string,
  branch: string,
  record: TestimonialRecord,
): Promise<PublishResult> {
  const res = await fetch(`${API}/pulls`, {
    method: 'POST',
    headers: ghHeaders(token, true),
    body: JSON.stringify({
      title: `Testimonial: ${record.author.name} (${record.author.company})`,
      body: pullRequestBody(record),
      head: branch,
      base: BASE_BRANCH,
    }),
  })

  if (res.ok) {
    const body = (await res.json()) as { html_url?: unknown }
    if (typeof body.html_url !== 'string') {
      throw new Error('GitHub opened the pull request but returned no html_url')
    }
    return { status: 'pr_opened', prUrl: body.html_url }
  }

  // 422 is GitHub refusing a second pull request for the same head branch. On a
  // phone the likely cause is a double tap, so answer with the one that exists
  // instead of a 502. Never an error, never a duplicate.
  if (res.status === 422) {
    const open = await findOpenPullRequest(token, branch)
    if (open !== null) return { status: 'pr_open', prUrl: open }
  }
  throw await ghError(`open pull request for ${branch}`, res)
}

/**
 * The branch already exists — either it was there before this call started, or a concurrent
 * call (a double tap: the owner taps Publish, sees nothing happen over a slow connection, taps
 * again) just created it while this one was mid-flight. Either way, converge on the same
 * outcome rather than erroring: reuse an open pull request if there is one; otherwise finish
 * writing the record — idempotently, `putFileWithRetry` already tolerates a racing write of
 * the same id — and open one.
 */
async function finishOnExistingBranch(
  token: string,
  branch: string,
  record: TestimonialRecord,
): Promise<PublishResult> {
  const open = await findOpenPullRequest(token, branch)
  if (open !== null) return { status: 'pr_open', prUrl: open }

  // A branch with no open pull request: a previous call died between creating the ref and
  // opening the pull request, the pull request was closed by hand, or — the fresh-record case
  // — a racing call only just created the branch and hasn't written the file yet. Finish the
  // job on the branch that is already there.
  const onBranch = await readFile(token, branch)
  if (!containsId(onBranch.entries, record.id)) {
    await putFileWithRetry(
      token,
      branch,
      onBranch.sha,
      renderFile(onBranch.entries, record),
      record,
    )
  }
  return openOrFindPullRequest(token, branch, record)
}

/**
 * Idempotent in two places: an id already on main is `already_published`, and an
 * existing branch returns its open pull request instead of opening a second one.
 * A third race — two calls both passing the branch-existence check before either has
 * created it — is absorbed at `createRef`'s 422 and converges on the same path.
 * The caller stamps `record.publishedAt` before calling — this module writes the
 * record it is given, verbatim.
 */
export async function publishTestimonial(record: TestimonialRecord): Promise<PublishResult> {
  const token = assertSecret('GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  const branch = `testimonial/${record.id}`

  const base = await readFile(token, BASE_BRANCH)
  if (containsId(base.entries, record.id)) return { status: 'already_published' }

  const existingBranch = await readRefSha(token, `heads/${branch}`)
  if (existingBranch !== null) {
    return finishOnExistingBranch(token, branch, record)
  }

  const mainHead = await readRefSha(token, `heads/${BASE_BRANCH}`)
  if (mainHead === null) throw new Error(`GitHub has no ref heads/${BASE_BRANCH}`)
  const created = await createRef(token, `refs/heads/${branch}`, mainHead)
  if (!created) {
    // Lost the race: another call created the branch between our readRefSha check above and
    // this createRef call. This call has written nothing — converge on the same outcome the
    // winner will reach (or already has), instead of throwing a 502 for a publish that is
    // actually succeeding.
    return finishOnExistingBranch(token, branch, record)
  }

  // The branch was just cut from main, so main's blob sha is the branch's blob sha.
  await putFileWithRetry(token, branch, base.sha, renderFile(base.entries, record), record)

  return openOrFindPullRequest(token, branch, record)
}
