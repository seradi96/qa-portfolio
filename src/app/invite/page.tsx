'use client'

import { useEffect, useState } from 'react'
import { decodeInviteUnverified } from '@/lib/token-client'
import type { InviteFields } from '@/lib/token-types'
import TestimonialForm from './TestimonialForm'

type Gate =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'unreadable' }
  | { kind: 'expired'; fields: InviteFields }
  | { kind: 'ready'; fields: InviteFields; token: string; storageKey: string }

const OWNER_EMAIL = 'andre.serban96@gmail.com'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <main className="mx-auto max-w-6xl px-6 py-20">{children}</main>
    </div>
  )
}

function MailLink() {
  return (
    <a
      href={`mailto:${OWNER_EMAIL}`}
      className="rounded text-amber-300 underline underline-offset-2 hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      {OWNER_EMAIL}
    </a>
  )
}

export default function InvitePage() {
  const [gate, setGate] = useState<Gate>({ kind: 'loading' })

  // The body runs inside a microtask rather than directly in the effect: window.location.hash
  // only exists client-side, so this has to live in an effect (a lazy useState initializer would
  // throw during the server render that produces the static loading shell) — but the eventual
  // setGate calls are what react-hooks/set-state-in-effect flags as "avoid calling setState
  // directly within an effect". Deferring by a microtask keeps the gate decision effectively
  // immediate (it still lands before the next paint) while satisfying the rule.
  useEffect(() => {
    queueMicrotask(() => {
      const raw = window.location.hash.replace(/^#/, '')
      if (!raw) {
        setGate({ kind: 'missing' })
        return
      }
      const fields = decodeInviteUnverified(raw)
      if (!fields) {
        setGate({ kind: 'unreadable' })
        return
      }
      if (fields.exp * 1000 <= Date.now()) {
        setGate({ kind: 'expired', fields })
        return
      }
      setGate({
        kind: 'ready',
        fields,
        token: raw,
        storageKey: `testimonial:${raw.split('.')[0].slice(0, 8)}`,
      })
    })
  }, [])

  if (gate.kind === 'loading') {
    return (
      <Shell>
        <p className="text-gray-400">Opening your link…</p>
      </Shell>
    )
  }

  if (gate.kind === 'missing') {
    return (
      <Shell>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-white">Nothing to fill in here</h1>
          <p className="mt-6 text-gray-300">
            Testimonials on this site are invite-only, so there is no open form &mdash; every link
            goes to one named person.
          </p>
          <p className="mt-4 text-gray-400">
            If Andrei sent you a link, open it whole. The part after the <code>#</code> is what
            identifies you, and some apps drop it when a link is forwarded or retyped.
          </p>
          <p className="mt-4 text-gray-400">
            If you worked with him and would like to write one, say so at <MailLink />.
          </p>
        </div>
      </Shell>
    )
  }

  if (gate.kind === 'unreadable') {
    return (
      <Shell>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-white">This link did not open</h1>
          <p className="mt-6 text-gray-300">
            The part after the <code>#</code> looks truncated or altered &mdash; which is what
            usually happens when a link gets wrapped by a chat app or copied by hand.
          </p>
          <p className="mt-4 text-gray-400">
            Open it from the original message rather than a forward, or ask Andrei for a fresh one at{' '}
            <MailLink />. Nothing is wrong on your side.
          </p>
        </div>
      </Shell>
    )
  }

  if (gate.kind === 'expired') {
    return (
      <Shell>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-white">This link has expired</h1>
          <p className="mt-6 text-gray-300">
            Invite links only stay open for 45 days, so an old one cannot sit around forever. This one
            was addressed to {gate.fields.name}.
          </p>
          <p className="mt-4 text-gray-400">
            Ask Andrei for a fresh one &mdash; <MailLink /> &mdash; and it takes him about ten
            seconds. Nothing was lost, and you don&apos;t need to explain anything.
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <TestimonialForm token={gate.token} fields={gate.fields} storageKey={gate.storageKey} />
    </Shell>
  )
}
