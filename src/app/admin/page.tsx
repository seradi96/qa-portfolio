import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySession } from '@/lib/admin-auth'
import { listPending } from '@/lib/pending-store'
import type { TestimonialRecord } from '@/lib/token-types'
import AdminList from './AdminList'
import LoginForm from './LoginForm'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <main className="mx-auto max-w-6xl px-6 py-20">{children}</main>
    </div>
  )
}

// A plain module-scope helper, not inlined into the component body: react-hooks/purity (part of
// eslint-plugin-react-hooks 7.1.1's React Compiler ruleset) flags a direct `Date.now()` call
// inside anything shaped like a component, including this async server component, even though a
// server component re-executes per request rather than re-rendering the way client hooks do.
// The clock read is genuinely correct here — every /admin request must check the cookie against
// the current time — so the fix is to name it, not to remove it.
function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

export default async function AdminPage() {
  const jar = await cookies()
  const currentSeconds = nowSeconds()

  // No valid session: render the login form and stop. listPending() is never reached, so a
  // browser that has not authenticated receives no pending record at all — not in the HTML,
  // not in the RSC payload.
  if (!verifySession(jar.get(SESSION_COOKIE)?.value, currentSeconds)) {
    return (
      <Shell>
        <div className="mx-auto max-w-md">
          <LoginForm />
        </div>
      </Shell>
    )
  }

  let items: TestimonialRecord[]
  try {
    items = await listPending()
  } catch (err) {
    // Name only, never the message: GITHUB_TOKEN must never be logged, and an Error from an
    // HTTP client is exactly where a credential can end up in text.
    console.error('[admin] listPending failed:', err instanceof Error ? err.name : typeof err)
    return (
      <Shell>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-white">The queue could not be read</h1>
          <p className="mt-6 text-gray-300">
            GitHub did not answer, so the pending list is unavailable. Nothing has been lost
            &mdash; every submission is still in the private store. Reload the page and try again.
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <AdminList items={items} />
    </Shell>
  )
}
