import type { Testimonial } from '@/lib/testimonials'
import { PROJECT_LABELS, isProjectSlug } from '@/lib/projects-meta'

export default function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const { author, answers, projectSlug } = testimonial

  const hiringManager = answers.hiringManager.trim()
  const whatChanged = answers.whatChanged.trim()
  const whatIDid = answers.whatIDid.trim()
  const anythingElse = answers.anythingElse.trim()
  const hasDetails = whatIDid.length > 0 || anythingElse.length > 0

  // The loader already guarantees a valid slug; the narrowing is only so TypeScript will
  // index PROJECT_LABELS, whose key type is ProjectSlug while the record field is `string`.
  const projectLabel = isProjectSlug(projectSlug) ? PROJECT_LABELS[projectSlug] : projectSlug

  // Host is a SOURCE LITERAL and the record stores a slug, never a URL. React 19's
  // sanitizeURL blocks only `javascript:` — `data:`, `vbscript:`, `blob:` and a plain
  // `https://evil.com` all pass through untouched. Reconstructing the href here makes a
  // phishing link structurally impossible instead of dependent on correct URL parsing.
  const linkedinHref = `https://www.linkedin.com/in/${author.linkedinSlug}`

  return (
    <article className="card-surface p-6 flex flex-col h-full min-w-0">
      {/* Amber quote glyph. Inline SVG on purpose: no Heroicon covers it, and no emoji. */}
      <svg
        className="w-8 h-8 text-amber-400 mb-4 shrink-0"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M7.5 5.5H4.2A1.2 1.2 0 0 0 3 6.7v4.1c0 .7.5 1.2 1.2 1.2h2.2c0 2-1 3.3-3 3.9v2.6c3.6-.8 5.6-3.4 5.6-7.4V6.7c0-.7-.5-1.2-1.2-1.2H7.5zM18.8 5.5h-3.3a1.2 1.2 0 0 0-1.2 1.2v4.1c0 .7.5 1.2 1.2 1.2h2.2c0 2-1 3.3-3 3.9v2.6c3.6-.8 5.6-3.4 5.6-7.4V6.7c0-.7-.5-1.2-1.2-1.2z" />
      </svg>

      {/* dir="auto" on every field carrying someone else's words — a Romanian or Arabic
          submission must not be forced LTR. whitespace-pre-line keeps the paragraph breaks
          the sanitizer deliberately preserved (it collapses runs of 3+ newlines, not all). */}
      <blockquote dir="auto" className="text-lg text-gray-200 leading-relaxed whitespace-pre-line">
        {hiringManager}
      </blockquote>

      {whatChanged.length > 0 && (
        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80 mb-1">
            What changed
          </h4>
          <p dir="auto" className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
            {whatChanged}
          </p>
        </div>
      )}

      {/* Native <details>: zero JS, keyboard-accessible. Not rendered at all when both of
          its answers are empty — no empty disclosure triangle to click. */}
      {hasDetails && (
        <details className="mt-5">
          <summary className="cursor-pointer text-sm text-gray-400 hover:text-amber-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded">
            Read the rest
          </summary>
          <div className="mt-3 space-y-4">
            {whatIDid.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80 mb-1">
                  What I was doing on the team
                </h4>
                <p dir="auto" className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                  {whatIDid}
                </p>
              </div>
            )}
            {anythingElse.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80 mb-1">
                  Anything else
                </h4>
                <p dir="auto" className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                  {anythingElse}
                </p>
              </div>
            )}
          </div>
        </details>
      )}

      <footer className="mt-6 pt-5 border-t border-white/10">
        <div dir="auto" className="text-amber-300 font-semibold">
          {author.name}
        </div>
        {/* Role and company AS AT the collaboration — the qualifier is what stops this
            reading as a current corporate endorsement, and it never goes stale. */}
        <div dir="auto" className="text-sm text-gray-400">
          {author.role}, {author.company}{' '}
          <span className="text-gray-500">&mdash; at the time</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* Same badge classes as the project tech chips (page.tsx:1007), verbatim. */}
          <span className="bg-amber-500/20 text-amber-300 px-2 py-1 rounded text-xs font-medium">
            {projectLabel}
          </span>
          <a
            href={linkedinHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-amber-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
            aria-label={`Verify ${author.name} on LinkedIn (opens in new tab)`}
          >
            {/* Same 24x24 LinkedIn path the Contact section uses (page.tsx:1681). */}
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Verify on LinkedIn
          </a>
        </div>
      </footer>
    </article>
  )
}
