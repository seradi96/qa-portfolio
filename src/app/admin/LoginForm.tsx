'use client'

import { useState, type FormEvent } from 'react'

const BTN_PRIMARY =
  'rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-3 text-base font-semibold text-gray-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-black'

/**
 * 401 is the wrong-password case and gets ONE flat string. It must not vary with the
 * attempt: a message that changes shape tells an attacker which half of the check failed.
 *
 * Everything else is operational. 403 is the hardcoded SITE_ORIGIN guard in the route,
 * which is why signing in on localhost cannot work — see src/lib/token.ts SITE_ORIGIN.
 */
function errorFor(status: number): string {
  if (status === 401) return 'That did not work.'
  if (status === 403) {
    return 'The browser origin was rejected. This page only signs in on https://aserban.ro.'
  }
  if (status === 400) return 'The browser sent something the server could not read. Try again.'
  return `The sign-in did not go through (${status}). Try again.`
}

export default function LoginForm() {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.status === 204) {
        // The Set-Cookie has landed. Reload rather than fetching the queue from here:
        // the server component re-runs, verifies the cookie itself, and does the
        // listPending() call server-side, so pending records never travel to a browser
        // that has not authenticated.
        window.location.reload()
        return
      }
      setError(errorFor(res.status))
      setBusy(false)
    } catch {
      setError('That never reached the server. Try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="card-surface min-w-0 p-6">
      <h1 className="text-2xl font-bold text-white">Sign in</h1>
      <p className="mt-3 text-sm text-gray-400">
        This page lists testimonials waiting for review. It isn&apos;t linked from anywhere on the
        site.
      </p>

      <label htmlFor="admin-password" className="mt-6 block text-sm font-medium text-gray-300">
        Password
      </label>
      <input
        id="admin-password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        disabled={busy}
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder-gray-500 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />

      {error !== null && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className={`${BTN_PRIMARY} mt-6 w-full`}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
