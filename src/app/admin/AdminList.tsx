'use client'

import { useState } from 'react'
import TestimonialCard from '@/components/TestimonialCard'
import { PROJECT_LABELS, isProjectSlug } from '@/lib/projects-meta'
import type { PublishResult } from '@/lib/publish-to-git'
import type { TestimonialRecord } from '@/lib/token-types'

// PublishResult is an `import type`, so @/lib/publish-to-git — server-only, it calls GitHub
// with GITHUB_TOKEN — is erased at compile time and never reaches this client bundle.
//
// TestimonialCard is imported as a VALUE on purpose. It carries no 'use client' of its own and
// no server imports, so it compiles into this client bundle cleanly. Rendering the real card is
// the entire point of this screen: a second, admin-only preview card would be free to drift, and
// then what the owner approves stops being what ships.

const SITE_TESTIMONIALS_URL = 'https://aserban.ro/#testimonials'

const BTN_PRIMARY =
  'rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-3 text-base font-semibold text-gray-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black'

const BTN_SECONDARY =
  'rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-base font-medium text-gray-300 hover:border-amber-400/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500'

const BTN_CONFIRM =
  'rounded-xl border border-amber-400/50 bg-amber-500/10 px-6 py-3 text-base font-semibold text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500'

const LINK_CTA =
  'mt-4 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-3 text-sm font-semibold text-gray-900 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black'

type RowState = {
  phase: 'idle' | 'confirming' | 'publishing' | 'rejecting' | 'published' | 'rejected'
  result: PublishResult | null
  error: string | null
}

const IDLE: RowState = { phase: 'idle', result: null, error: null }

/** The wire body is `unknown`; narrow it rather than trusting the route's type. */
function asPublishResult(body: unknown): PublishResult | null {
  if (typeof body !== 'object' || body === null) return null
  const r = body as { status?: unknown; prUrl?: unknown }
  if (r.status === 'already_published') return { status: 'already_published' }
  if (r.status === 'pr_open' && typeof r.prUrl === 'string') {
    return { status: 'pr_open', prUrl: r.prUrl }
  }
  if (r.status === 'pr_opened' && typeof r.prUrl === 'string') {
    return { status: 'pr_opened', prUrl: r.prUrl }
  }
  return null
}

/**
 * Every branch states what happened to the PENDING FILE, because that is the thing the reader
 * cannot see. 422 and 502 both leave it untouched — publishTestimonial() runs before
 * deletePending(), so a failed publish deletes nothing.
 */
function publishErrorMessage(status: number): string {
  if (status === 401) {
    return 'The session has expired. Reload the page and sign in again — nothing was published.'
  }
  if (status === 403) {
    return 'The browser origin was rejected, so nothing was published. This page only acts on https://aserban.ro.'
  }
  if (status === 404) {
    return 'That submission is no longer in the pending store. Reload the page — it may already have been published or rejected.'
  }
  if (status === 422) {
    return 'The server re-checked the submission and rejected a field, so nothing was published. The pending file is untouched.'
  }
  if (status === 502) {
    return 'GitHub refused the write. Nothing was published and the pending file is untouched — try again.'
  }
  return `Publishing failed (${status}). Nothing was published — try again.`
}

function rejectErrorMessage(status: number): string {
  if (status === 401) {
    return 'The session has expired. Reload the page and sign in again — nothing was deleted.'
  }
  if (status === 403) {
    return 'The browser origin was rejected, so nothing was deleted. This page only acts on https://aserban.ro.'
  }
  if (status === 404) {
    return 'That submission is no longer in the pending store. Reload the page — it may already have been dealt with.'
  }
  return `Deleting failed (${status}). Nothing was deleted — try again.`
}

/**
 * The three outcomes, with three genuinely different meanings.
 *
 * `already_published` and `pr_open` both read as "already" to a tired eye, and confusing them is
 * expensive in exactly one direction: `already_published` means there is nothing left to do,
 * while `pr_open` means the work is sitting unmerged and the site does NOT have it. So `pr_open`
 * says "still needs merging" in bold rather than leaving it to be inferred.
 *
 * No relative time in any of these strings. Nothing records when a pull request merged, so
 * anything of the "a moment ago" shape would be invented.
 */
function PublishOutcome({ result }: { result: PublishResult }) {
  if (result.status === 'already_published') {
    return (
      <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-semibold text-white">Already on the site</h3>
        <p className="mt-2 text-sm text-gray-300">
          This testimonial was published before and is live now. There is nothing left to do.
        </p>
        <a
          href={SITE_TESTIMONIALS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CTA}
        >
          See it on the site &rarr;
        </a>
      </div>
    )
  }

  if (result.status === 'pr_open') {
    return (
      <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-semibold text-white">A pull request was already open</h3>
        <p className="mt-2 text-sm text-gray-300">
          Nothing new was created, and{' '}
          <strong className="font-semibold text-amber-200">
            that pull request still needs merging
          </strong>{' '}
          &mdash; this testimonial is not on the site yet. Open it, merge it, and the site updates
          about 90 seconds later.
        </p>
        <a href={result.prUrl} target="_blank" rel="noopener noreferrer" className={LINK_CTA}>
          Open the pull request &rarr;
        </a>
      </div>
    )
  }

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white">Pull request opened</h3>
      <p className="mt-2 text-sm text-gray-300">
        A new pull request now holds this testimonial. Merge it and the site updates about 90
        seconds later. Until then nothing on the live site has changed.
      </p>
      <a href={result.prUrl} target="_blank" rel="noopener noreferrer" className={LINK_CTA}>
        Open the pull request &rarr;
      </a>
    </div>
  )
}

export default function AdminList({ items }: { items: TestimonialRecord[] }) {
  // One record keyed by testimonial id. Typed with `| undefined` so the `?? IDLE` below is a
  // real narrowing rather than decoration, and so per-row state needs no mount effect —
  // react-hooks/set-state-in-effect bites the obvious alternative.
  const [rows, setRows] = useState<Record<string, RowState | undefined>>({})

  function patch(id: string, next: RowState) {
    setRows((prev) => ({ ...prev, [id]: next }))
  }

  async function publish(id: string) {
    patch(id, { phase: 'publishing', result: null, error: null })
    try {
      const res = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        patch(id, { phase: 'idle', result: null, error: publishErrorMessage(res.status) })
        return
      }
      const result = asPublishResult(await res.json().catch(() => null))
      if (result === null) {
        patch(id, {
          phase: 'idle',
          result: null,
          error:
            'The server replied with something unreadable. Check GitHub before pressing Publish again — the write may already have gone through.',
        })
        return
      }
      patch(id, { phase: 'published', result, error: null })
    } catch {
      patch(id, {
        phase: 'idle',
        result: null,
        error: 'That never reached the server. Nothing was published — press Publish again.',
      })
    }
  }

  async function reject(id: string) {
    patch(id, { phase: 'rejecting', result: null, error: null })
    try {
      // 204, so there is no body to read.
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        patch(id, { phase: 'idle', result: null, error: rejectErrorMessage(res.status) })
        return
      }
      patch(id, { phase: 'rejected', result: null, error: null })
    } catch {
      patch(id, {
        phase: 'idle',
        result: null,
        error: 'That never reached the server. Nothing was deleted — press Reject again.',
      })
    }
  }

  // An empty queue is the normal state, not a fault. Calm copy, no alert styling, no retry
  // prompt: `GET contents/pending` returning 404 for an empty directory is expected and the
  // store already maps it to an empty list.
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-white">Nothing waiting</h1>
        <p className="mt-6 text-gray-300">
          The pending queue is empty. This is the normal state &mdash; a submission appears here
          as soon as someone finishes the invite form.
        </p>
      </div>
    )
  }

  const settled = items.some((record) => {
    const phase = (rows[record.id] ?? IDLE).phase
    return phase === 'published' || phase === 'rejected'
  })

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold text-white">Waiting for review</h1>
      <p className="mt-4 text-gray-400">
        {items.length === 1
          ? 'One submission is waiting.'
          : `${items.length} submissions are waiting.`}{' '}
        Each card below is the component the live site renders, so what you publish is what ships.
      </p>

      <ul className="mt-10 space-y-12">
        {items.map((record) => {
          const state = rows[record.id] ?? IDLE
          const busy = state.phase === 'publishing' || state.phase === 'rejecting'
          const confirming = state.phase === 'confirming' || state.phase === 'rejecting'
          const done = state.phase === 'published' || state.phase === 'rejected'
          const projectLabel = isProjectSlug(record.projectSlug)
            ? PROJECT_LABELS[record.projectSlug]
            : record.projectSlug

          return (
            <li key={record.id} className="min-w-0">
              <TestimonialCard testimonial={record} />

              <div className="card-surface mt-4 min-w-0 p-5">
                <dl className="space-y-2 text-sm">
                  {/* The slug as plain text, so the person can be checked without leaving the
                      page. The card itself carries the clickable link. */}
                  <div className="flex flex-wrap gap-2">
                    <dt className="text-gray-500">LinkedIn</dt>
                    <dd className="break-all text-gray-300">
                      linkedin.com/in/{record.author.linkedinSlug}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <dt className="text-gray-500">Project</dt>
                    <dd className="text-gray-300">{projectLabel}</dd>
                  </div>
                  {/* An absolute stored date, never a relative one. */}
                  <div className="flex flex-wrap gap-2">
                    <dt className="text-gray-500">Submitted</dt>
                    <dd className="text-gray-300">{record.submittedAt}</dd>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <dt className="text-gray-500">Consent</dt>
                    <dd className="text-gray-300">
                      v{record.consent.version} at {record.consent.at}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <dt className="text-gray-500">Id</dt>
                    <dd className="break-all text-gray-300">{record.id}</dd>
                  </div>
                </dl>

                {state.phase === 'published' && state.result !== null && (
                  <>
                    <PublishOutcome result={state.result} />
                    <p className="mt-3 text-sm text-gray-400">
                      Taken out of the pending store. This card disappears on the next reload.
                    </p>
                  </>
                )}

                {state.phase === 'rejected' && (
                  <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                    <h3 className="text-sm font-semibold text-white">Deleted</h3>
                    <p className="mt-2 text-sm text-gray-300">
                      Removed from the pending store. Nothing was published. A copy stays in that
                      store&apos;s private history &mdash; see the runbook if this person ever asks
                      you to wipe it.
                    </p>
                  </div>
                )}

                {!done && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => publish(record.id)}
                      disabled={busy || confirming}
                      className={BTN_PRIMARY}
                    >
                      {state.phase === 'publishing' ? 'Publishing…' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        patch(record.id, { phase: 'confirming', result: null, error: null })
                      }
                      disabled={busy || confirming}
                      className={BTN_SECONDARY}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {/* Reject never fires on the first click. It is still irreversible from the
                    queue's point of view — the file comes out and won't be published — even
                    though deletePending's Contents API DELETE leaves a copy in the private
                    store's git history, exactly as the /invite privacy note says and runbook §8
                    explains how to erase. */}
                {confirming && (
                  <div className="mt-5 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4">
                    <p className="text-sm text-amber-100">
                      Delete this submission? It comes out of the queue for good and will not be
                      published. A copy stays in that store&apos;s private history &mdash; see the
                      runbook if this person ever asks you to wipe it.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => reject(record.id)}
                        disabled={busy}
                        className={BTN_CONFIRM}
                      >
                        {state.phase === 'rejecting' ? 'Deleting…' : 'Yes, delete it'}
                      </button>
                      <button
                        type="button"
                        onClick={() => patch(record.id, IDLE)}
                        disabled={busy}
                        className={BTN_SECONDARY}
                      >
                        Keep it
                      </button>
                    </div>
                  </div>
                )}

                {state.error !== null && (
                  <p
                    role="alert"
                    className="mt-5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                  >
                    {state.error}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {settled && (
        <div className="mt-12">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={BTN_SECONDARY}
          >
            Refresh the queue
          </button>
        </div>
      )}
    </div>
  )
}
