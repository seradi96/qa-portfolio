'use client'

import { useEffect, useState } from 'react'
import { decodeModerationUnverified } from '@/lib/token-client'
import { PROJECT_LABELS, isProjectSlug } from '@/lib/projects-meta'
import TestimonialCard from '@/components/TestimonialCard'
import type { Testimonial } from '@/lib/testimonials'
import type { PublishResult } from '@/lib/publish-to-git'

// Both imports above are `import type`, so neither @/lib/testimonials (which pulls in the JSON) nor
// @/lib/publish-to-git (server-only, node fetch to GitHub) reaches this client bundle.

type Intent = 'publish' | 'discard'

type Phase =
  | { kind: 'loading' }
  | { kind: 'no-fragment' }
  | { kind: 'no-decompression' }
  | { kind: 'unreadable' }
  | { kind: 'review'; record: Testimonial; token: string; intent: Intent }
  | { kind: 'discarded' }
  | { kind: 'published'; result: PublishResult; record: Testimonial }

const SITE_TESTIMONIALS_URL = 'https://aserban.ro/#testimonials'

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

function publishErrorMessage(status: number): string {
  if (status === 403) {
    return 'The link did not verify. Either it was altered on the way here, or it was opened from somewhere other than aserban.ro. Nothing was published.'
  }
  if (status === 422) {
    return 'The server re-checked the submission and rejected a field. Nothing was published — publish it by hand from the two fallback links at the bottom of the email.'
  }
  if (status === 502) {
    return 'GitHub refused the write. Nothing was published — try once more, and if it fails again use the two fallback links at the bottom of the email.'
  }
  return `Publishing failed (${status}). Nothing was published — the two fallback links at the bottom of the email still work.`
}

/**
 * Paste-ready follow-up. Deliberately carries no relative time: the record does not store when a
 * pull request merged and neither does the publish response, so any "just now" here would be a
 * guess presented as a fact.
 */
function followUpMessage(record: Testimonial): string {
  const firstName = record.author.name.trim().split(/\s+/)[0]
  return [
    `Hi ${firstName},`,
    '',
    'Your words are up on aserban.ro now — thank you again for writing them, it genuinely means a lot.',
    '',
    'It shows your name, your role and company at the time we worked together, and a link to your LinkedIn, exactly as you approved. If you ever want it changed or taken down, just tell me and it is done, no explanation needed.',
    '',
    'Thanks again,',
    'Andrei',
  ].join('\n')
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied or unavailable. The text stays selectable below, which is
      // the fallback, so there is nothing to recover from here.
    }
  }
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">
          Send this once you have merged the pull request
        </h3>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-300">
        {text}
      </pre>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl">{children}</div>
      </main>
    </div>
  )
}

export default function ModeratePanel() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // DELIBERATE WORKAROUND — do not delete without reading this.
  //
  // This component genuinely renders on the server: page.tsx statically prerenders it as the
  // "nothing to act on" shell that a link scanner sees, so — like src/app/invite/page.tsx before
  // it — a lazy useState initializer cannot read window.location.hash (there is no window during
  // that render), and the decode itself is async on top, so the initializer could not finish the
  // job even on the client. Both branches force this into an effect.
  //
  // But calling setPhase directly, synchronously, in the effect body is exactly what
  // react-hooks/set-state-in-effect flags ("avoid calling setState directly within an effect"),
  // and every early-return branch below (no-fragment, no-decompression) does exactly that. So the
  // whole body runs inside a queueMicrotask instead: the setPhase calls still land before the next
  // paint, so there is no visible delay, but they are no longer *synchronous within the effect* as
  // far as the linter's static analysis is concerned. `cancelled` is checked at the top of the
  // microtask too, so a fast unmount (React 19 StrictMode double-invoking this effect in dev)
  // can't have a stale first run overwrite state set up by the second.
  //
  // If you are removing this queueMicrotask wrapper because it looks like pointless boilerplate:
  // it is not. Removing it will fail `npm run lint` (react-hooks/set-state-in-effect) and block
  // the build. See src/app/invite/page.tsx for the sibling case this mirrors.
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      const hash = window.location.hash.replace(/^#/, '')
      if (!hash) {
        setPhase({ kind: 'no-fragment' })
        return
      }
      const params = new URLSearchParams(hash)
      const token = params.get('t')
      // The a= intent only decides which button is the thumb-height primary. It never acts on its own.
      const intent: Intent = params.get('a') === 'discard' ? 'discard' : 'publish'
      if (!token) {
        setPhase({ kind: 'no-fragment' })
        return
      }
      if (typeof DecompressionStream === 'undefined') {
        setPhase({ kind: 'no-decompression' })
        return
      }
      // decodeModerationUnverified re-derives `t` itself via URLSearchParams, so it takes the
      // whole fragment (`hash`), not the bare `token` extracted above for the POST body — passing
      // the bare token here makes URLSearchParams find no `t=` key and the decode silently return
      // null for every valid link. Confirmed against scripts/token-roundtrip.mjs's own fixture
      // calls, which pass `a=discard&t=${token}` / `#a=publish&t=${token}`, never a bare token.
      decodeModerationUnverified(hash)
        .then((record) => {
          if (cancelled) return
          setPhase(record ? { kind: 'review', record, token, intent } : { kind: 'unreadable' })
        })
        .catch(() => {
          if (!cancelled) setPhase({ kind: 'unreadable' })
        })
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function publish(token: string, record: Testimonial) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/testimonials/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token }),
      })
      if (!res.ok) {
        setError(publishErrorMessage(res.status))
        setBusy(false)
        return
      }
      const result = asPublishResult(await res.json().catch(() => null))
      if (!result) {
        setError(
          'The server replied with something unreadable. Check GitHub before tapping again — the write may already have gone through.',
        )
        setBusy(false)
        return
      }
      setPhase({ kind: 'published', result, record })
    } catch {
      setError('That never reached the server. Nothing was published — tap Publish again.')
      setBusy(false)
    }
  }

  if (phase.kind === 'loading') {
    return (
      <Shell>
        <p className="text-gray-400">Unpacking the submission…</p>
      </Shell>
    )
  }

  if (phase.kind === 'no-fragment') {
    return (
      <Shell>
        <h1 className="text-3xl font-bold text-white">Nothing to review</h1>
        <p className="mt-6 text-gray-300">
          This page only does something when it is opened from a link in a notification email. The
          submission travels in the part of the URL after the <code>#</code>, which never leaves the
          browser and never reaches the server.
        </p>
        <p className="mt-4 text-gray-400">
          Opening <code>/moderate</code> on its own is meant to look exactly like this &mdash; a link
          scanner that fetches the URL gets this page and nothing to act on.
        </p>
      </Shell>
    )
  }

  if (phase.kind === 'no-decompression') {
    return (
      <Shell>
        <h1 className="text-3xl font-bold text-white">This browser cannot open it</h1>
        <p className="mt-6 text-gray-300">
          The submission is unpacked in the browser with <code>DecompressionStream</code>, which this
          browser does not have.
        </p>
        <p className="mt-4 text-gray-400">
          Open the same link in Chrome, Safari 16.4 or later, or Firefox 113 or later &mdash; or use
          the two manual links at the bottom of the email, which need no JavaScript at all.
        </p>
      </Shell>
    )
  }

  if (phase.kind === 'unreadable') {
    return (
      <Shell>
        <h1 className="text-3xl font-bold text-white">This link did not open</h1>
        <p className="mt-6 text-gray-300">
          The part after the <code>#</code> is the whole submission, and it looks truncated or
          altered. Mail apps sometimes wrap long links across a line.
        </p>
        <p className="mt-4 text-gray-400">
          Open the link from the original email rather than a forward, or use the two manual links at
          the bottom of that email. Nothing was published.
        </p>
      </Shell>
    )
  }

  if (phase.kind === 'discarded') {
    // Discard called no endpoint. Rejecting genuinely is doing nothing — and this single
    // instruction is the entire mechanism behind the retention promise, so it stands alone with
    // nothing to distract from it.
    return (
      <Shell>
        <h1 className="text-3xl font-bold text-white">Nothing was published.</h1>
        <p className="mt-6 text-lg text-gray-200">
          Now delete this email &mdash; it is the only remaining copy.
        </p>
      </Shell>
    )
  }

  if (phase.kind === 'published') {
    const { result } = phase
    if (result.status === 'already_published') {
      return (
        <Shell>
          <h1 className="text-3xl font-bold text-white">Already published &mdash; it&apos;s on the site.</h1>
          <a
            href={SITE_TESTIMONIALS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 text-base font-semibold text-gray-900 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black"
          >
            See it →
          </a>
        </Shell>
      )
    }
    if (result.status === 'pr_open') {
      return (
        <Shell>
          <h1 className="text-3xl font-bold text-white">Pull request already open.</h1>
          <a
            href={result.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 text-base font-semibold text-gray-900 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black"
          >
            Open it →
          </a>
        </Shell>
      )
    }
    return (
      <Shell>
        <h1 className="text-3xl font-bold text-white">Pull request opened.</h1>
        <p className="mt-6 text-gray-300">
          Review it, merge it, and it is live about 90 seconds later.
        </p>
        <a
          href={result.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 text-base font-semibold text-gray-900 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black"
        >
          Open the pull request →
        </a>
        <div className="mt-10">
          <CopyBlock text={followUpMessage(phase.record)} />
        </div>
      </Shell>
    )
  }

  const { record, token, intent } = phase
  const projectLabel = isProjectSlug(record.projectSlug)
    ? PROJECT_LABELS[record.projectSlug]
    : record.projectSlug

  const publishButton = (
    <button
      type="button"
      onClick={() => publish(token, record)}
      disabled={busy}
      className={
        intent === 'publish'
          ? 'w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 text-base font-semibold text-gray-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black'
          : 'w-full rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-base font-medium text-gray-300 hover:border-amber-400/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500'
      }
    >
      {busy ? 'Publishing…' : 'Publish it'}
    </button>
  )

  const discardButton = (
    <button
      type="button"
      onClick={() => setPhase({ kind: 'discarded' })}
      disabled={busy}
      className={
        intent === 'discard'
          ? 'w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 text-base font-semibold text-gray-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black'
          : 'w-full rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-base font-medium text-gray-300 hover:border-amber-400/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500'
      }
    >
      Discard
    </button>
  )

  return (
    <Shell>
      <h1 className="text-3xl font-bold text-white">Review before it goes anywhere</h1>
      <p className="mt-4 text-gray-400">
        Nothing has been published. This is the same card component the live site renders, so what
        you approve is what ships.
      </p>

      <div className="mt-8 min-w-0">
        <TestimonialCard testimonial={record} />
      </div>

      <dl className="mt-8 space-y-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <dt className="text-gray-500">Project</dt>
          <dd className="text-gray-300">{projectLabel}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-gray-500">Submitted</dt>
          <dd className="text-gray-300">{record.submittedAt}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-gray-500">LinkedIn</dt>
          <dd className="break-all text-gray-300">linkedin.com/in/{record.author.linkedinSlug}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-gray-500">Consent</dt>
          <dd className="text-gray-300">
            v{record.consent.version} at {record.consent.at}
          </dd>
        </div>
      </dl>

      {error && (
        <p
          role="alert"
          className="mt-8 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          {error}
        </p>
      )}

      <div className="mt-10 space-y-4">
        {intent === 'discard' ? discardButton : publishButton}
        {intent === 'discard' ? publishButton : discardButton}
        <p className="text-center text-sm text-gray-500">
          Discard sends nothing to the server. Publish opens a pull request &mdash; it does not change
          the live site until you merge it.
        </p>
      </div>
    </Shell>
  )
}
