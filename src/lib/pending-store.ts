/**
 * SERVER ONLY. The pending queue: one JSON file per unreviewed submission, held in a PRIVATE
 * GitHub repository. Zero dependencies: plain fetch against the same REST API, with the same
 * token, that publish-to-git.ts already calls — which is the whole reason this store was chosen
 * over a database. No new account, no new service, no new npm package.
 *
 * Watching that repository on GitHub is what replaces the notification email, so a submission
 * landing here reaches the owner's phone without any code in this file doing anything about it.
 */
import { Buffer } from 'node:buffer'
import { assertSecret } from '@/lib/token'
import { isTestimonial } from '@/lib/testimonials'
import type { TestimonialRecord } from '@/lib/token-types'

// Hardcoded, exactly as OWNER/REPO/BASE_BRANCH are in publish-to-git.ts:19-21, and for the same
// reason: a misconfigured environment variable must not be able to redirect a colleague's
// submission into a repository somebody else controls.
const OWNER = 'seradi96'
const PENDING_REPO = 'qa-portfolio-pending'
const PENDING_DIR = 'pending'
const API = `https://api.github.com/repos/${OWNER}/${PENDING_REPO}`

// The id the submit route mints: randomBytes(9).toString('base64url'), which is exactly 12
// base64url characters. Same shape as ID_RE in testimonials.ts. Checked before an id is ever
// interpolated into a URL path, so `..` and `%2e%2e` cannot reach GitHub's contents API.
const ID_RE = /^[A-Za-z0-9_-]{12}$/

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

/** Returned, not thrown, so call sites can `throw await ghError(...)` and TypeScript sees the
 *  control flow end there. Same helper shape as publish-to-git.ts — deliberately duplicated
 *  rather than shared, because that module's copy is module-private and points at a different
 *  repository; exporting it would widen a file whose surface is intentionally two symbols. */
async function ghError(what: string, res: Response): Promise<Error> {
  const body = await res.text().catch(() => '')
  return new Error(`GitHub ${what} failed: ${res.status} ${res.statusText} ${body.slice(0, 500)}`)
}

/**
 * GitHub hands base64 back wrapped at 60 characters, and the payload is UTF-8. Buffer is the
 * only correct codec here: atob()/btoa() are byte-per-char, so "Șerban" would come back as
 * mojibake and be re-encoded corrupted. This is the same defect class already caught in
 * publish-to-git.ts, and it applies identically to every record that passes through here.
 */
function decodeBase64Utf8(b64: string): string {
  return Buffer.from(b64.replace(/\s+/g, ''), 'base64').toString('utf8')
}

function encodeBase64Utf8(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64')
}

function pathFor(id: string): string {
  return `${PENDING_DIR}/${id}.json`
}

type PendingFile = { text: string; sha: string }

/** `null` on 404 — the ordinary answer for an id already published or rejected. */
async function readFile(token: string, path: string): Promise<PendingFile | null> {
  const res = await fetch(`${API}/contents/${path}`, {
    method: 'GET',
    headers: ghHeaders(token, false),
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw await ghError(`read ${path}`, res)

  const body = (await res.json()) as { content?: unknown; sha?: unknown; encoding?: unknown }
  if (
    typeof body.sha !== 'string' ||
    typeof body.content !== 'string' ||
    body.encoding !== 'base64'
  ) {
    throw new Error(`GitHub returned an unexpected shape for ${path}`)
  }
  return { text: decodeBase64Utf8(body.content), sha: body.sha }
}

/**
 * Drop, never throw: one hand-broken file must not make the whole queue unreadable, which is the
 * same discipline testimonials.ts applies to the published file. The warning is unconditional
 * (not dev-only as it is there) because this runs on Vercel, where the server log is the only
 * place the owner can find out a submission has gone quiet.
 *
 * The validator is imported from testimonials.ts rather than written again here. A second
 * definition of "a valid record" would be free to drift from the first, and this feature already
 * carries one scar from exactly that — `.trim()` and `normalizeText()` disagreeing about what
 * counts as empty. One concept, one function.
 */
function parseRecord(path: string, text: string): TestimonialRecord | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    console.warn(`[pending-store] ${path} is not valid JSON — dropped from the queue`)
    return null
  }
  if (!isTestimonial(parsed)) {
    console.warn(`[pending-store] ${path} is not a well-formed record — dropped from the queue`)
    return null
  }
  return parsed
}

/** Descending string compare — newest / highest first, matching testimonials.ts. */
function descending(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? 1 : -1
}

export async function listPending(): Promise<TestimonialRecord[]> {
  const token = assertSecret('GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  const res = await fetch(`${API}/contents/${PENDING_DIR}`, {
    method: 'GET',
    headers: ghHeaders(token, false),
    cache: 'no-store',
  })

  // THE TRAP. Git cannot store an empty directory, so the moment the last pending file is
  // published or rejected the `pending` directory stops existing and this GET returns 404.
  // That is the EMPTY QUEUE, not an error. Treating it as an error breaks the admin page
  // precisely when there is nothing to do, which is most of the time.
  if (res.status === 404) return []
  if (!res.ok) throw await ghError(`list ${PENDING_DIR}`, res)

  const body = (await res.json()) as unknown
  // A directory listing is an array; a single file comes back as an object. If `pending` is
  // somehow a file, that is a broken store, not an empty one.
  if (!Array.isArray(body)) {
    throw new Error(`GitHub returned a file, not a directory, for ${PENDING_DIR}`)
  }

  const ids: string[] = []
  for (const entry of body) {
    if (typeof entry !== 'object' || entry === null) continue
    const e = entry as { type?: unknown; name?: unknown }
    if (e.type !== 'file' || typeof e.name !== 'string' || !e.name.endsWith('.json')) continue
    const id = e.name.slice(0, -'.json'.length)
    if (!ID_RE.test(id)) {
      console.warn(`[pending-store] ${PENDING_DIR}/${e.name} is not a record file — ignored`)
      continue
    }
    ids.push(id)
  }

  // One content GET per entry, sequentially. The listing carries no file contents, and this
  // queue holds single digits of records at a time — at that size a loop is simpler, and
  // easier to read a log from, than anything clever.
  const records: TestimonialRecord[] = []
  for (const id of ids) {
    const path = pathFor(id)
    const file = await readFile(token, path)
    if (file === null) continue // published or rejected between the listing and this read
    const record = parseRecord(path, file.text)
    if (record === null) continue
    if (record.id !== id) {
      console.warn(`[pending-store] ${path} holds id ${record.id} — dropped from the queue`)
      continue
    }
    records.push(record)
  }

  // Newest first, ties broken by id so the order is stable across reloads — the same rule
  // TESTIMONIALS uses, so the admin list and the public section never disagree about order.
  return records.sort(
    (a, b) => descending(a.submittedAt, b.submittedAt) || descending(a.id, b.id),
  )
}

export async function getPending(id: string): Promise<TestimonialRecord | null> {
  // An id of the wrong shape cannot name a file in this store, so it is `null` without a
  // request — and, more to the point, without ever being interpolated into a URL path.
  if (!ID_RE.test(id)) return null
  const token = assertSecret('GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  const path = pathFor(id)
  const file = await readFile(token, path)
  if (file === null) return null
  const record = parseRecord(path, file.text)
  if (record === null || record.id !== id) return null
  return record
}

export async function putPending(record: TestimonialRecord): Promise<void> {
  const token = assertSecret('GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  // Validated on the way in as well as on the way out. isTestimonial checks `id` against the
  // same 12-character base64url rule, which is what makes pathFor(record.id) below safe.
  if (!isTestimonial(record)) {
    throw new Error('putPending refused a record that is not a well-formed testimonial')
  }
  const path = pathFor(record.id)

  // GitHub's contents PUT creates a file when `sha` is absent and updates one when it is
  // present — and rejects the wrong choice with a 422. Reading first makes the write
  // idempotent, so a retried submission overwrites its own file instead of failing.
  const existing = await readFile(token, path)
  const res = await fetch(`${API}/contents/${path}`, {
    method: 'PUT',
    headers: ghHeaders(token, true),
    body: JSON.stringify({
      message: `pending: ${record.author.name} (${record.author.company})\n\nRecord id: ${record.id}`,
      // Machine-written through JSON.stringify, never a string template: no answer text can
      // break out of its own string literal.
      content: encodeBase64Utf8(JSON.stringify(record, null, 2) + '\n'),
      ...(existing === null ? {} : { sha: existing.sha }),
    }),
  })
  if (!res.ok) throw await ghError(`write ${path}`, res)
}

export async function deletePending(id: string): Promise<void> {
  const token = assertSecret('GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  if (!ID_RE.test(id)) throw new Error(`deletePending was given a malformed id: ${id}`)
  const path = pathFor(id)

  // DELETE requires the blob sha of the file as it stands, so there is always a read first.
  // A file that is already gone is a completed delete, not a failure: the owner double-tapping
  // Reject on a slow connection must not see an error for work that succeeded.
  const existing = await readFile(token, path)
  if (existing === null) return

  const res = await fetch(`${API}/contents/${path}`, {
    method: 'DELETE',
    headers: ghHeaders(token, true),
    body: JSON.stringify({ message: `pending: remove ${id}`, sha: existing.sha }),
  })
  if (!res.ok) throw await ghError(`delete ${path}`, res)
}
