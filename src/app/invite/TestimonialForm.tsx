'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CAPS, graphemeCount } from '@/lib/sanitize'
import { PROJECT_LABELS, PROJECT_SLUGS, isProjectSlug, type ProjectSlug } from '@/lib/projects-meta'
import { CONSENT_TEXT_V1 } from '@/lib/consent'
import type { InviteFields } from '@/lib/token-types'

type AnswerKey = 'whatIDid' | 'whatChanged' | 'hiringManager' | 'anythingElse'

type Question = {
  key: AnswerKey
  label: string
  optional: boolean
  cap: number
  help: string
  placeholder?: string
  enterKeyHint?: 'done'
}

/**
 * Spec §13.1, verbatim. The placeholders are load-bearing: the failure mode of a testimonials
 * section is "He was great to work with", and a worked example is the only thing that reliably
 * prevents it. Do not shorten them into hints.
 */
const QUESTIONS: Question[] = [
  {
    key: 'whatIDid',
    label: 'What was Andrei actually doing on the team?',
    optional: true,
    cap: CAPS.whatIDid,
    help: "One line is plenty — how you'd describe his job to someone who wasn't there.",
    placeholder:
      'He owned the end-to-end suite and was the person we pinged when a pipeline went red at 6pm.',
  },
  {
    key: 'whatChanged',
    label: 'What changed because of it?',
    optional: true,
    cap: CAPS.whatChanged,
    help: "The concrete bit. A number if you have one; if you don't, just what got easier, faster, or less painful.",
    placeholder:
      'Regression used to eat two days of manual clicking. After his framework landed it ran overnight and we stopped shipping on Fridays with our fingers crossed.',
  },
  {
    key: 'hiringManager',
    label: 'What would you tell a hiring manager who asked about him?',
    optional: false,
    cap: CAPS.hiringManager,
    help: 'The honest version, caveats included. This is the one people actually read.',
    placeholder:
      "I'd work with him again. He'll push back if he thinks the plan is wrong, which is exactly what you want in a QA lead.",
  },
  {
    key: 'anythingElse',
    label: 'Anything else?',
    optional: true,
    cap: CAPS.anythingElse,
    help: 'A story, a moment, something the questions above missed. Skip it if nothing comes to mind.',
    enterKeyHint: 'done',
  },
]

type Draft = {
  name: string
  role: string
  company: string
  linkedinSlug: string
  projectSlug: ProjectSlug
  whatIDid: string
  whatChanged: string
  hiringManager: string
  anythingElse: string
}

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; message: string; field?: string }
  | { kind: 'sent' }

const OWNER_EMAIL = 'andre.serban96@gmail.com'

const TEXTAREA_CLASS =
  'mt-2 w-full field-sizing-content min-h-24 resize-y rounded-xl border border-white/10 bg-white/5 ' +
  'px-4 py-3 text-base text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 ' +
  'focus:ring-amber-500'

const INPUT_CLASS =
  'mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-gray-100 ' +
  'placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500'

// text-base (16px) on every control is deliberate: iOS Safari zooms the viewport on focus for
// anything smaller, and the zoom does not undo itself when the field blurs.

function initialDraft(fields: InviteFields): Draft {
  return {
    name: fields.name,
    role: fields.role,
    company: fields.company,
    linkedinSlug: '',
    projectSlug: isProjectSlug(fields.projectSlug) ? fields.projectSlug : 'other',
    whatIDid: '',
    whatChanged: '',
    hiringManager: '',
    anythingElse: '',
  }
}

/**
 * Unwraps a pasted profile URL down to the slug so the static "linkedin.com/in/" prefix is not
 * doubled. Module-private on purpose: `extractLinkedinSlug` in @/lib/sanitize is the real
 * validator and it runs server-side, where rejecting is safe. Calling a throwing validator on
 * every keystroke would crash the form halfway through a paste.
 */
function stripLinkedinUrl(raw: string): string {
  let v = raw.trim()
  v = v.replace(/^https?:\/\//i, '')
  v = v.replace(/^([a-z0-9-]+\.)*linkedin\.com\//i, '')
  v = v.replace(/^in\//i, '')
  v = v.split(/[?#]/)[0]
  v = v.replace(/\/+$/, '')
  return v
}

function mergeDraft(base: Draft, raw: unknown): Draft | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const str = (key: string, fallback: string): string =>
    typeof r[key] === 'string' ? (r[key] as string) : fallback
  return {
    name: str('name', base.name),
    role: str('role', base.role),
    company: str('company', base.company),
    linkedinSlug: str('linkedinSlug', base.linkedinSlug),
    projectSlug: isProjectSlug(r.projectSlug) ? r.projectSlug : base.projectSlug,
    whatIDid: str('whatIDid', base.whatIDid),
    whatChanged: str('whatChanged', base.whatChanged),
    hiringManager: str('hiringManager', base.hiringManager),
    anythingElse: str('anythingElse', base.anythingElse),
  }
}

function sameAsPrefill(draft: Draft, fields: InviteFields): boolean {
  const base = initialDraft(fields)
  return (
    draft.name === base.name &&
    draft.role === base.role &&
    draft.company === base.company &&
    draft.linkedinSlug === base.linkedinSlug &&
    draft.projectSlug === base.projectSlug &&
    draft.whatIDid === '' &&
    draft.whatChanged === '' &&
    draft.hiringManager === '' &&
    draft.anythingElse === ''
  )
}

function readErrorBody(body: unknown): { field?: string; message?: string } {
  if (typeof body !== 'object' || body === null) return {}
  const r = body as { field?: unknown; message?: unknown; error?: unknown }
  // /api/testimonials/submit is internally consistent, not uniform: 422 sends
  // { field, message } (route.ts's FieldError branch), every other rejection sends { error }.
  // Reading `message` first and falling back to `error` is what makes the server's own wording
  // reach the submitter instead of always falling through to the generic copy below.
  const message =
    typeof r.message === 'string' ? r.message : typeof r.error === 'string' ? r.error : undefined
  return {
    field: typeof r.field === 'string' ? r.field : undefined,
    message,
  }
}

function messageForStatus(status: number, fromServer: string | undefined): string {
  if (status === 403) {
    return 'This link did not verify. It can get truncated when a link is forwarded or retyped. Ask Andrei for a fresh one and paste it in — everything you wrote is still on this page.'
  }
  if (status === 410) {
    return 'This invite expired while the page was open. Nothing you wrote is lost — ask Andrei for a fresh link and it will still be here.'
  }
  if (status === 422) {
    return fromServer ?? 'One of the fields came back rejected. Have a look and try again.'
  }
  if (status === 400) {
    return 'Something did not make it across intact. Try tapping Send once more.'
  }
  if (status === 503) {
    return 'This did not save, so Andrei has not seen it yet. Nothing was lost — wait a moment and tap Send again.'
  }
  return `Something went wrong at Andrei's end (${status}). Nothing was lost — try again in a minute, or email ${OWNER_EMAIL}.`
}

function SoftCounter({ value, cap }: { value: string; cap: number }) {
  const used = graphemeCount(value)
  const near = used >= Math.ceil(cap * 0.85)
  const over = used > cap
  return (
    <span
      aria-hidden={!near}
      className={
        'text-xs tabular-nums transition-opacity duration-200 ' +
        (near ? 'opacity-100 ' : 'opacity-0 ') +
        (over ? 'text-amber-300' : 'text-gray-500')
      }
    >
      {used} / {cap}
    </span>
  )
}

/**
 * Reads a previously-saved draft for this invite, if any. Called exactly once, from a lazy
 * useState initializer in the component below — TestimonialForm only ever mounts client-side
 * (page.tsx never constructs it until the gate has already resolved to 'ready', itself a
 * client-only transition happening inside a useEffect), so there is no SSR pass to reconcile
 * and no hydration-mismatch risk in reading localStorage here. That is what makes a plain lazy
 * initializer the right tool, unlike the gate in page.tsx, which does render on the server (as
 * the static loading shell) and genuinely needs the effect-deferred read.
 */
function loadStoredDraft(fields: InviteFields, storageKey: string): { draft: Draft; restored: boolean } {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored) {
      const merged = mergeDraft(initialDraft(fields), JSON.parse(stored))
      if (merged && !sameAsPrefill(merged, fields)) {
        return { draft: merged, restored: true }
      }
    }
  } catch {
    // Private-mode Safari throws on localStorage access. Autosave is a convenience; never fatal.
  }
  return { draft: initialDraft(fields), restored: false }
}

export default function TestimonialForm({
  token,
  fields,
  storageKey,
}: {
  token: string
  fields: InviteFields
  storageKey: string
}) {
  // Computed via lazy useState initializers, synchronously, during the first render — see
  // loadStoredDraft's comment for why that is safe here. Two separate calls (one per state)
  // rather than a single memoized read: a ref read during render trips react-hooks/refs
  // ("accessing ref.current during render can cause your component not to update as expected"),
  // even for a ref that is only ever assigned once before the first paint. loadStoredDraft is
  // pure and cheap — one small localStorage read plus a JSON.parse, done at most twice, only on
  // mount, never again — so paying that twice is a better trade than fighting the linter over a
  // pattern it no longer allows.
  const [draft, setDraft] = useState<Draft>(() => loadStoredDraft(fields, storageKey).draft)
  const [consent, setConsent] = useState(false)
  // Consent is deliberately NOT restored: ticking the box is the act of consenting, and a box
  // that arrives pre-ticked from last week is not one.
  const [restored, setRestored] = useState<boolean>(() => loadStoredDraft(fields, storageKey).restored)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  // Skips the autosave effect's very first invocation (mount), so opening the page and never
  // typing anything never schedules a write — restored or not, the draft on mount is already
  // final (see loadStoredDraft above), so there is nothing to persist yet. A ref, not state:
  // mutating it inside the effect is fine, only *setState* directly in an effect trips the lint
  // rule below.
  const mountedRef = useRef(false)

  // Autosave, 400 ms debounced.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(draft))
      } catch {
        // Same private-mode Safari case. Typing must never break because storage is unavailable.
      }
    }, 400)
    return () => window.clearTimeout(id)
  }, [draft, storageKey])

  const setField = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  function startFresh() {
    setDraft(initialDraft(fields))
    setConsent(false)
    setRestored(false)
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }

  function fail(message: string, field?: string) {
    setStatus({ kind: 'error', message, field })
    if (field) {
      const el = document.getElementById(field)
      if (el) {
        el.focus()
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status.kind === 'sending') return

    if (!draft.name.trim()) return fail('Your name is missing.', 'name')
    if (!draft.role.trim()) return fail('Your role at the time is missing.', 'role')
    if (!draft.company.trim()) return fail('Your company at the time is missing.', 'company')
    if (!draft.linkedinSlug.trim()) {
      return fail(
        'The LinkedIn link is the part that makes this verifiable to a stranger, so it is the one identity field I do need.',
        'linkedinSlug',
      )
    }
    if (!draft.hiringManager.trim()) {
      return fail(
        'Just the hiring-manager question — that one I do need. Any length is fine.',
        'hiringManager',
      )
    }
    for (const q of QUESTIONS) {
      const over = graphemeCount(draft[q.key]) - q.cap
      if (over > 0) {
        return fail(
          `That answer is ${over} character${over === 1 ? '' : 's'} over what fits. Trim it and it will go.`,
          q.key,
        )
      }
    }
    if (!consent) return fail('Tick the box above and it goes.', 'consent')

    setStatus({ kind: 'sending' })
    try {
      const res = await fetch('/api/testimonials/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          projectSlug: draft.projectSlug,
          name: draft.name,
          role: draft.role,
          company: draft.company,
          linkedinSlug: draft.linkedinSlug,
          answers: {
            whatIDid: draft.whatIDid,
            whatChanged: draft.whatChanged,
            hiringManager: draft.hiringManager,
            anythingElse: draft.anythingElse,
          },
          consent: true,
        }),
      })
      if (res.ok) {
        // The draft is deliberately left in localStorage: the thank-you screen tells them this
        // link stays open, and coming back to a blank form would make that a lie.
        setStatus({ kind: 'sent' })
        return
      }
      const parsed = readErrorBody(await res.json().catch(() => null))
      fail(messageForStatus(res.status, parsed.message), parsed.field)
    } catch {
      fail(
        'That did not reach the server. Check the connection and tap Send again — nothing you wrote is lost.',
      )
    }
  }

  if (status.kind === 'sent') {
    const written = QUESTIONS.filter((q) => draft[q.key].trim().length > 0)
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-white">Sent. Thank you &mdash; genuinely.</h1>

        <div className="mt-8 space-y-6">
          {written.map((q) => (
            <div key={q.key} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold text-amber-300">{q.label}</div>
              <p dir="auto" className="mt-2 whitespace-pre-wrap text-gray-200">
                {draft[q.key]}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-4 text-gray-400">
          <p>
            Andrei reads these himself, usually within a day. Nothing goes public until he approves it.
          </p>
          <p>Spotted a typo? This link stays open &mdash; just come back to it.</p>
          <p>
            Changed your mind later? Write to{' '}
            <a
              href={`mailto:${OWNER_EMAIL}`}
              className="rounded text-amber-300 underline underline-offset-2 hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {OWNER_EMAIL}
            </a>{' '}
            and it comes down. No explanation needed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold text-white">A few words about working together</h1>

      <p className="mt-6 text-gray-300">
        Andrei wrote:{' '}
        <span dir="auto" className="italic text-amber-200">
          &quot;{fields.message}&quot;
        </span>
      </p>
      <p className="mt-4 text-gray-400">
        Four questions, the last one open-ended. Five to ten minutes. It saves as you type, so you can
        stop and come back.
      </p>

      {restored && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <span>Picked up where you left off.</span>
          <button
            type="button"
            onClick={startFresh}
            className="rounded underline underline-offset-2 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            Start fresh
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-10 space-y-10">
        <fieldset className="min-w-0 space-y-6">
          <legend className="text-sm font-semibold text-gray-400">
            Not right? Fix anything here.
          </legend>

          <div className="min-w-0">
            <label htmlFor="name" className="block text-sm font-semibold text-white">
              Your name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={draft.name}
              onChange={(e) => setField('name', e.target.value)}
              autoComplete="name"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              className={INPUT_CLASS}
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="role" className="block text-sm font-semibold text-white">
              Your role at the time
            </label>
            <input
              id="role"
              name="role"
              type="text"
              value={draft.role}
              onChange={(e) => setField('role', e.target.value)}
              autoComplete="organization-title"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              className={INPUT_CLASS}
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="company" className="block text-sm font-semibold text-white">
              Your company at the time
            </label>
            <input
              id="company"
              name="company"
              type="text"
              value={draft.company}
              onChange={(e) => setField('company', e.target.value)}
              autoComplete="organization"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              className={INPUT_CLASS}
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="linkedinSlug" className="block text-sm font-semibold text-white">
              Your LinkedIn
            </label>
            <p id="linkedinSlug-help" className="mt-1 text-sm text-gray-400">
              Paste the whole profile address if that is easier &mdash; it gets trimmed for you.
            </p>
            {/* The visible focus ring sits on the wrapper via focus-within, because the prefix and
                the input are one control to a reader even though they are two elements. */}
            <div className="mt-2 flex items-stretch overflow-hidden rounded-xl border border-white/10 bg-white/5 focus-within:ring-2 focus-within:ring-amber-500">
              <span className="select-none px-3 py-3 text-base text-gray-500">linkedin.com/in/</span>
              <input
                id="linkedinSlug"
                name="linkedinSlug"
                type="text"
                inputMode="url"
                value={draft.linkedinSlug}
                onChange={(e) => setField('linkedinSlug', stripLinkedinUrl(e.target.value))}
                aria-describedby="linkedinSlug-help"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                className="min-w-0 flex-1 bg-transparent py-3 pr-4 text-base text-gray-100 placeholder:text-gray-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="min-w-0">
            <label htmlFor="projectSlug" className="block text-sm font-semibold text-white">
              Which project did we work on together?
            </label>
            <select
              id="projectSlug"
              name="projectSlug"
              value={draft.projectSlug}
              onChange={(e) =>
                setField('projectSlug', isProjectSlug(e.target.value) ? e.target.value : 'other')
              }
              className={`${INPUT_CLASS} appearance-none`}
            >
              {PROJECT_SLUGS.map((slug) => (
                <option key={slug} value={slug} className="bg-gray-900 text-gray-100">
                  {PROJECT_LABELS[slug]}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <div className="space-y-10">
          {QUESTIONS.map((q) => (
            <div key={q.key} className="min-w-0">
              <label htmlFor={q.key} className="block text-sm font-semibold text-white">
                {q.label}{' '}
                <span className="font-normal text-gray-500">
                  {q.optional ? '(optional)' : '(required)'}
                </span>
              </label>
              <p id={`${q.key}-help`} className="mt-1 text-sm text-gray-400">
                {q.help}
              </p>
              <textarea
                id={q.key}
                name={q.key}
                rows={3}
                dir="auto"
                value={draft[q.key]}
                onChange={(e) => setField(q.key, e.target.value)}
                placeholder={q.placeholder}
                aria-describedby={`${q.key}-help`}
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck={true}
                enterKeyHint={q.enterKeyHint}
                className={TEXTAREA_CLASS}
              />
              {/* No maxLength: it silently swallows the characters past the cap while the person is
                  still typing, with no explanation. A soft counter that fades in at 85% instead. */}
              <div className="mt-1 flex justify-end">
                <SoftCounter value={draft[q.key]} cap={q.cap} />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <label
            htmlFor="consent"
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <input
              id="consent"
              name="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {/* Rendered from the constant, not retyped: consent.version is only an honest record of
                what was agreed if the sentence shown is provably the sentence archived. */}
            <span className="text-sm leading-relaxed text-gray-300">{CONSENT_TEXT_V1}</span>
          </label>

          <div className="space-y-4 text-sm leading-relaxed text-gray-400">
            <p>
              <strong className="text-gray-300">Who&apos;s asking</strong> &mdash; Andrei Șerban, Iași,
              Romania, {OWNER_EMAIL}. This site is personal; there is no company behind it.
            </p>
            <p>
              <strong className="text-gray-300">What gets published</strong> &mdash; your name, your
              role and company at the time we worked together, your LinkedIn link, and your answers
              above. Nothing else.
            </p>
            <p>
              <strong className="text-gray-300">What I don&apos;t collect</strong> &mdash; I&apos;m
              not asking for your email, and I don&apos;t record your IP address. The site uses
              Vercel&apos;s cookie-free visit counter, which logs that a page was opened, from which
              country, and on what kind of browser and device &mdash; never who you are.
            </p>
            <p>
              <strong className="text-gray-300">Why I&apos;m allowed to</strong> &mdash; because
              you&apos;re saying yes, and for no other reason. Saying no costs you nothing.
            </p>
            <p>
              <strong className="text-gray-300">Where it lives</strong> &mdash; until I publish it,
              your submission sits in a private store only I can read. If I publish it, it goes into
              this site&apos;s public repository. If I don&apos;t, I delete it from that store. A copy
              stays in that store&apos;s private history, which nobody but me can see &mdash; ask me
              and I will wipe that too.
            </p>
            <p>
              <strong className="text-gray-300">Your say</strong> &mdash; ask me to correct it or take
              it down, any time, no reason needed; normally the same day. If you think I&apos;ve
              handled this badly you can complain to ANSPDCP (dataprotection.ro).
            </p>
          </div>

          {status.kind === 'error' && (
            <p role="alert" className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {status.message}
            </p>
          )}

          <button
            type="submit"
            disabled={status.kind === 'sending'}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-4 text-base font-semibold text-gray-900 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black"
          >
            {status.kind === 'sending' ? 'Sending…' : 'Send it to Andrei'}
          </button>
        </div>
      </form>
    </div>
  )
}
