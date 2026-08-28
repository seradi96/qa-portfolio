/**
 * SERVER ONLY. The single outbound notification: one plain-text email to the owner.
 *
 * Plain text, never HTML. That is not a style choice — an HTML body would put
 * third-party free text inside markup, which means an escaping function, which
 * means a bug in that function is stored XSS in the owner's mail client. Plain
 * text deletes that entire surface: there is nothing to escape.
 */
import { assertSecret, SITE_ORIGIN } from '@/lib/token'
import type { TestimonialRecord } from '@/lib/token-types'
import { PROJECT_LABELS, isProjectSlug } from '@/lib/projects-meta'

/** Resend's sandbox sender. Delivers only to the Resend account's own signup
 *  address, which is exactly and only OWNER_EMAIL. Zero DNS records, permanently. */
const FROM = 'onboarding@resend.dev'
const OWNER_EMAIL = 'andre.serban96@gmail.com'
const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const GITHUB_EDIT_URL =
  'https://github.com/seradi96/qa-portfolio/edit/main/src/content/testimonials.json'

/**
 * We hand Resend JSON, so we are not writing SMTP headers ourselves — but Resend
 * writes them from these values. A CR or LF inside the subject folds into a new
 * header there, so strip both from every interpolated value.
 */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function projectLabel(slug: string): string {
  return isProjectSlug(slug) ? PROJECT_LABELS[slug] : slug
}

function buildSubject(record: TestimonialRecord): string {
  const name = headerSafe(record.author.name)
  const role = headerSafe(record.author.role)
  const company = headerSafe(record.author.company)
  return `${name} (${role}, ${company}) — testimonial ready to review`
}

function buildBody(record: TestimonialRecord, moderationToken: string): string {
  const { author, answers } = record
  const publishUrl = `${SITE_ORIGIN}/moderate#a=publish&t=${moderationToken}`
  const discardUrl = `${SITE_ORIGIN}/moderate#a=discard&t=${moderationToken}`

  const lines: string[] = [
    author.name,
    `${author.role}, ${author.company} (at the time)`,
    `Project: ${projectLabel(record.projectSlug)}`,
    '',
  ]

  // Form order, not card order: this is a read of what the person actually wrote.
  // A blank optional answer is skipped label and all — an empty heading is noise
  // on a lock screen, and the point of this body is triage with zero taps.
  const blocks: ReadonlyArray<readonly [string, string]> = [
    ['WHAT I WAS DOING ON THE TEAM', answers.whatIDid],
    ['WHAT CHANGED BECAUSE OF IT', answers.whatChanged],
    ['TO A HIRING MANAGER', answers.hiringManager],
    ['ANYTHING ELSE', answers.anythingElse],
  ]
  for (const [label, value] of blocks) {
    if (value.trim() === '') continue
    lines.push(label, value, '')
  }

  lines.push(
    `LinkedIn: linkedin.com/in/${author.linkedinSlug}`,
    `Submitted ${record.submittedAt} · consent v${record.consent.version} at ${record.consent.at}`,
    '',
    '------------------------------------------------------------',
    '',
    'PUBLISH IT',
    publishUrl,
    '',
    'DISCARD IT',
    discardUrl,
    '',
    'Both links just open the page. Nothing changes until you tap again there.',
    '',
    '------------------------------------------------------------',
    '',
    'If the site is down, publish it by hand:',
    '',
    '1. Open',
    `   ${GITHUB_EDIT_URL}`,
    '',
    '2. Paste this object into the array, first:',
    '',
    JSON.stringify(record, null, 2),
    '',
    '3. Commit it to a new branch and merge that branch.',
    '',
    'To discard by hand: delete this email. It is the only copy.',
    '',
  )

  return lines.join('\n')
}

/**
 * Throws on any non-2xx, with the response body in the message. The submit route
 * turns that throw into a 503 that keeps every typed answer on screen and asks the
 * submitter to press send again — the email IS the commit point, so a failed send
 * must never look like a success.
 */
export async function sendModerationEmail(
  record: TestimonialRecord,
  moderationToken: string,
): Promise<void> {
  const apiKey = assertSecret('RESEND_API_KEY', process.env.RESEND_API_KEY)

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [OWNER_EMAIL],
      subject: buildSubject(record),
      text: buildBody(record, moderationToken),
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    // res.text() cannot leak the key: it is a request header, never echoed back.
    const body = await res.text().catch(() => '')
    throw new Error(`Resend send failed: ${res.status} ${res.statusText} ${body.slice(0, 500)}`)
  }
}
