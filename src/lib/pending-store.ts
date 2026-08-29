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
import { ID_RE, descending, isTestimonial } from '@/lib/testimonials'
import type { TestimonialRecord } from '@/lib/token-types'

// Hardcoded, exactly as OWNER/REPO/BASE_BRANCH are in publish-to-git.ts:19-21, and for the same
// reason: a misconfigured environment variable must not be able to redirect a colleague's
// submission into a repository somebody else controls.
const OWNER = 'seradi96'
const PENDING_REPO = 'qa-portfolio-pending'
const PENDING_DIR = 'pending'
const API = `https://api.github.com/repos/${OWNER}/${PENDING_REPO}`

// ID_RE is imported, not redefined: it is the id the submit route mints — randomBytes(9)
// .toString('base64url'), exactly 12 base64url characters — and it is checked before an id is
// ever interpolated into a URL path, so `..` and `%2e%2e` cannot reach GitHub's contents API.
// A second copy of this regex would be free to drift from testimonials.ts's, the same risk the
// isTestimonial import below already avoids.

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
 *  repository; exporting it would widen a file whose surface is intentionally two symbols.
 *  `preReadBody` lets a caller that already consumed the response stream (to inspect the body
 *  before deciding whether to throw) hand that text back in, since a Response body can only be
 *  read once — same reason publish-to-git.ts's copy takes the same parameter. */
async function ghError(what: string, res: Response, preReadBody?: string): Promise<Error> {
  const body = preReadBody ?? (await res.text().catch(() => ''))
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

/**
 * Only listPending's 404 branch calls this. A 404 on the directory listing is ambiguous between
 * two states, and this one extra request is what tells them apart: the queue is genuinely empty
 * (THE TRAP below — git cannot store an empty directory), or the store itself is unreachable —
 * the repository does not exist, it was renamed, or the fine-grained token's repository list no
 * longer includes it (GitHub answers 404 rather than 403 there, so as not to confirm to an
 * unauthorized caller that a private repo exists). getPending, putPending and deletePending never
 * call this: each of them reads or writes a FILE path, where a 404 already means exactly "the
 * file is gone" — a correct, self-contained outcome this check must not touch.
 *
 * Cost: one extra request, made only when the directory listing already read as empty, on a page
 * the owner opens a handful of times a year. That is the right trade for not telling him the
 * queue is empty when the store is actually broken.
 */
async function assertRepoIsReachable(token: string): Promise<void> {
  const res = await fetch(API, {
    method: 'GET',
    headers: ghHeaders(token, false),
    cache: 'no-store',
  })
  if (res.status === 200) return
  throw new Error(
    `pending store unreachable: GET ${OWNER}/${PENDING_REPO} answered ${res.status} ` +
      `${res.statusText}, not 200 — the repository is missing, renamed, or invisible to this ` +
      'token, so the pending directory\'s earlier 404 cannot be trusted as "queue is empty".',
  )
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
  // That is the EMPTY QUEUE, not an error — but a 404 here is also what a missing, renamed, or
  // invisible-to-the-token repository looks like, and this function cannot tell those apart on
  // its own. assertRepoIsReachable makes the one extra request that can.
  if (res.status === 404) {
    await assertRepoIsReachable(token)
    return []
  }
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

/**
 * Absorbs exactly the two outcomes that mean "the file is already gone", and throws every other
 * non-2xx (a revoked-token 403 included) with its step named.
 *
 * - 404: the path no longer exists — GitHub cannot find anything to delete.
 * - 409 whose message reports a sha mismatch: our sha is stale. The only way a sha we just read
 *   can be stale by the time this request lands is that the file has since been deleted (or
 *   replaced) by someone else — in this store, that "someone else" is a second, overlapping
 *   deletePending call. The message is checked, not just the status, because a 409 is GitHub's
 *   generic conflict code and this function must not swallow a different kind of conflict under
 *   the same number.
 *
 * Both cover the CONCURRENT double-tap: two calls both pass deletePending's readFile check with
 * the same sha before either DELETE fires, so only one DELETE can actually remove the file — the
 * other's sha is now stale against a path that no longer exists. This is distinct from the
 * SEQUENTIAL double-tap, which deletePending's own readFile already absorbs before this function
 * is ever called.
 */
async function deleteFileTolerant(token: string, path: string, sha: string): Promise<void> {
  const res = await fetch(`${API}/contents/${path}`, {
    method: 'DELETE',
    headers: ghHeaders(token, true),
    body: JSON.stringify({ message: `pending: remove ${path}`, sha }),
  })
  if (res.ok) return
  if (res.status === 404) return // the path is already gone — the same end state as success

  if (res.status === 409) {
    const bodyText = await res.text().catch(() => '')
    let message: unknown
    try {
      message = (JSON.parse(bodyText) as { message?: unknown }).message
    } catch {
      message = undefined
    }
    // GitHub's message for this exact case reads like "<path> does not match <sha>...". Matched
    // on text, not just the 409 status, the same discipline publish-to-git.ts's createRef uses
    // to tell "already exists" apart from every other reason its endpoint can answer 422.
    if (typeof message === 'string' && /does not match/i.test(message)) return
    throw await ghError(`delete ${path}`, res, bodyText)
  }

  throw await ghError(`delete ${path}`, res)
}

export async function deletePending(id: string): Promise<void> {
  const token = assertSecret('GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  if (!ID_RE.test(id)) throw new Error(`deletePending was given a malformed id: ${id}`)
  const path = pathFor(id)

  // DELETE requires the blob sha of the file as it stands, so there is always a read first.
  //
  // SEQUENTIAL double-tap (the owner taps Reject twice on a slow connection): the second call's
  // readFile sees the 404 the first call's DELETE produced, and returns here — a completed
  // delete, not a failure.
  const existing = await readFile(token, path)
  if (existing === null) return

  // CONCURRENT double-tap: both calls' readFile can complete, with the same sha, before either
  // DELETE fires. deleteFileTolerant is what makes the loser of that race see success too — see
  // its own doc comment for exactly which two outcomes it treats as "already gone" and why
  // nothing else is absorbed the same way.
  await deleteFileTolerant(token, path, existing.sha)
}
