# Admin-page moderation — Design

**Date:** 2026-08-29
**Status:** Approved for planning
**Supersedes:** parts of `2026-08-28-testimonials-design.md` — see §10 for exactly which

Replaces email-based moderation with a private pending store and an admin page.

---

## 1. Why

The shipped design routes a pending submission through a Resend email, which is also the
only copy of it. Setting Resend up proved to be more friction than the owner wants, and a
first live attempt failed on an invalid API key.

The owner asked for an admin page instead. That request has a consequence worth stating
plainly, because it is counter-intuitive: **the email was the storage.** An admin page must
*list* pending submissions, and listing requires storing. So this is not a swap of one
notification channel for another — it introduces a storage layer the original design
deliberately did without.

The original objection to storage does not apply here. It was that a datastore in the
*read path* of the public section fails soft to an empty list, silently deleting the
section from the live site. This store holds only *pending* submissions; published
testimonials still live in git and still reach the page as a module import. A store
outage means "cannot submit or approve right now", never "the testimonials vanished".

## 2. Decisions taken

| # | Decision | Chosen |
|---|---|---|
| 1 | Where a pending submission lives | **A small store, with an admin page to review it** |
| 2 | Which store | **A private GitHub repository** |
| 3 | Admin authentication | **Password once, then a signed cookie** |

Decision 2 is what keeps setup small: the store is read and written through the same
GitHub REST API `publish-to-git.ts` already calls, with the same token, using plain
`fetch`. No new account, no new service, no new npm dependency. The owner creates one
empty private repository, once.

It also restores notification for free. Watching that repository makes GitHub email him
on every new pending file — the job Resend was there to do.

## 3. What is removed

| File | Lines | Reason |
|---|---|---|
| `src/lib/notify.ts` | 134 | No email is sent at all |
| `src/app/moderate/ModeratePanel.tsx` | 426 | Replaced by the admin page |
| `src/app/moderate/page.tsx` | 5 | " |
| `src/app/moderate/layout.tsx` | 7 | " |

Plus, from `src/lib/token.ts`: `signModerationToken`, `verifyModerationToken`,
`MAX_MODERATION_URL_CHARS`, and the gzip path they use. From `src/lib/token-client.ts`:
`decodeModerationUnverified`. From `scripts/token-roundtrip.mjs`: the four
moderation-token and URL-budget assertions.

**This deletes the entire signed-postcard mechanism** — the gzip, the URL budget, the
fragment-based anti-prefetch defence. That machinery existed to carry a submission safely
inside an email link. With no email, it protects nothing.

Worth recording rather than quietly dropping: the URL-budget work took three fix rounds
and found a real defect (a maximal Romanian submission overflowed the budget, and the
trim advice the 413 gave was wrong in every one of 60 trials). Those findings were
correct. They simply no longer have anything to apply to.

## 4. What is kept, untouched

`src/lib/token-types.ts`, `sanitize.ts`, `projects-meta.ts`, `consent.ts`,
`testimonials.ts`, `publish-to-git.ts`, `src/components/TestimonialCard.tsx`,
`TestimonialsSection.tsx`, the whole of `src/app/invite/` including the 663-line form,
`src/app/robots.ts`, `scripts/postbuild-check.mjs`, `scripts/invite.mjs`, and the invite
half of `token.ts`.

Roughly 1,550 lines survive, including every expensive piece. The invite gate, the
sanitiser, the card, and the publish-to-git flow are all unchanged.

## 5. Flow

```
Owner                        Colleague                    Owner's phone
  |                              |                              |
  |-- npm run invite ----------->|                              |
  |   (unchanged)                |                              |
  |                        /invite#<token>                      |
  |                        form, prefilled (unchanged)          |
  |                              |                              |
  |                   POST /api/testimonials/submit             |
  |                   verify invite - sanitize - mint id        |
  |                   write pending/<id>.json to PRIVATE repo   |
  |                              |                              |
  |<-- GitHub notifies (watching the private repo) -------------|
  |                                                             |
  |                        /admin  ->  password once            |
  |                        signed cookie, 30 days               |
  |                        list, each rendered with the REAL    |
  |                        TestimonialCard                      |
  |                                                             |
  |   Approve -> publishTestimonial() opens a PR on the public  |
  |              repo, then deletes pending/<id>.json           |
  |   Reject  -> deletes pending/<id>.json. Nothing remains.    |
  |                                                             |
  |   Merge the PR -> production in ~90 s                       |
```

## 6. The pending store

`src/lib/pending-store.ts`, server-only, plain `fetch`, zero dependencies.

Repository: `seradi96/qa-portfolio-pending`, private, created once by the owner. The name
is a **hardcoded module constant**, exactly as `OWNER`/`REPO`/`BASE_BRANCH` already are in
`publish-to-git.ts:19-21`, and for the same reason: a misconfigured environment variable
must not be able to redirect submissions to a repository somebody else controls.

Path within it: `pending/<id>.json`, one file per submission, holding the exact
`TestimonialRecord` the submit route built.

```ts
export async function listPending(): Promise<TestimonialRecord[]>
export async function getPending(id: string): Promise<TestimonialRecord | null>
export async function putPending(record: TestimonialRecord): Promise<void>
export async function deletePending(id: string): Promise<void>
```

Endpoints, all with `Authorization: Bearer`, `Accept: application/vnd.github+json`,
`X-GitHub-Api-Version: 2022-11-28`:

- list — `GET /repos/{o}/{r}/contents/pending`, then one `GET` per entry for its content
- put — `PUT /repos/{o}/{r}/contents/pending/{id}.json`
- delete — `DELETE /repos/{o}/{r}/contents/pending/{id}.json`, requires the file's `sha`

**Git cannot store an empty directory.** With nothing pending, `GET contents/pending`
returns **404**, which the store must treat as an empty list, never as an error. Getting
this wrong makes the admin page break precisely when there is nothing to do, which is
most of the time.

Records are read back through the same validator the loader uses, and a malformed file is
**dropped from the list with a logged warning** rather than throwing — the same
drop-not-throw discipline as `testimonials.ts`, for the same reason: one bad file must not
make the whole queue unreadable.

`isTestimonial` is currently module-private in `src/lib/testimonials.ts` (that file exports
only `Testimonial` and `TESTIMONIALS`). **Export it**, and have both the loader and the
pending store call the one function. Duplicating it would create a second definition of
what a valid record is, and this design already carries one lesson about two layers
disagreeing on the same concept — the earlier `.trim()` versus `normalizeText()` split over
what counts as empty.

Base64 handling uses `Buffer`, never `atob`/`btoa`, so a Romanian name survives the round
trip. This is the defect class that was caught in `publish-to-git.ts` and it applies
identically here.

## 7. Admin authentication

`src/lib/admin-auth.ts`, server-only.

A single `ADMIN_PASSWORD` environment variable. `POST /api/admin/login` compares it with
`crypto.timingSafeEqual` after a length check, and on success sets:

```
Cookie: admin_session=<expiryUnixSeconds>.<base64url(HMAC-SHA256(MOD_SECRET, "s1." + expiry))>
        HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
```

`MOD_SECRET` is reused as the session-signing key — it is free now that moderation tokens
are gone — so **no new secret is introduced**. Verification re-derives the HMAC, compares
timing-safe, and rejects an expired stamp. Rotating `MOD_SECRET` invalidates every session
at once, which is the panic button if a device is lost.

**`ADMIN_PASSWORD` must be a generated high-entropy string of at least 24 characters, not
a memorable one.** This is load-bearing and replaces rate limiting: a login endpoint on
Vercel has no throttle, a module-scoped counter is theatre because it resets on every cold
start and is not shared across concurrent lambdas, and a 24-character random password is
not brute-forceable regardless. The runbook must say this, and the check must be a
**module-scope assertion**, matching `assertSecret`'s existing pattern — so a short or
missing password fails `npm run build` during "Collecting page data" rather than surfacing
as a broken login at 11pm. That behaviour is already established and documented in
CLAUDE.md; this simply joins it.

## 8. The admin page

`/admin` is a server component. It reads the cookie:

- no valid cookie → renders a small `'use client'` login form posting to `/api/admin/login`
- valid cookie → fetches the pending list and renders each entry with the **real
  `TestimonialCard`**, so what the owner approves is byte-for-byte what ships — the same
  property the moderation screen had

Two actions per entry, both POST routes guarded by the cookie and by the hardcoded
`SITE_ORIGIN` check:

- `POST /api/admin/publish` — `{ id }` → re-validate every field, `publishTestimonial()`,
  then `deletePending(id)`. Returns the existing `PublishResult` so the three outcomes
  (`pr_opened`, `pr_open`, `already_published`) keep their distinct copy.
- `POST /api/admin/reject` — `{ id }` → `deletePending(id)` and nothing else.

Re-validation on publish stays, for the same reason it existed before: the record has
travelled through a store since it was sanitised, and passing validation once is not proof
it is still well-formed.

Buttons disable while a request is in flight. `/admin` is `noindex` and added to
`robots.ts`'s disallow list beside `/invite`.

## 9. Environment and setup

| Variable | Purpose |
|---|---|
| `INVITE_SECRET` | HMAC key for invite tokens (unchanged) |
| `MOD_SECRET` | **Repurposed**: signs the admin session cookie |
| `GITHUB_TOKEN` | Now scoped to **two** repositories: the public site and the private pending store |
| `ADMIN_PASSWORD` | Generated, 24+ characters |

`RESEND_API_KEY` is removed. The count stays at four.

Manual setup, once: create the private repository; extend the fine-grained token to cover
both repos with Contents Read & Write plus Pull requests Read & Write on the public one;
set Watch → All Activity on the private repo so GitHub notifies on new submissions.

## 10. What this supersedes in the original spec

Sections 8 (notification email), 9 (moderation and the anti-prefetch defence), 7.1 (the
gzip URL-budget table), and the moderation half of 6 are **withdrawn**. Sections 5 (data
model), 7 (submission, except its final step), 10 (publishing by branch and pull request),
11 (how data reaches the page), 12 (section and card), 13.1–13.2 and 13.5–13.6 (form,
consent and public copy) all stand unchanged.

The **consent text does not change.** `CONSENT_TEXT_V1` covers publication only and says
nothing about where a submission is held, so `CONSENT_VERSION` stays 1 and no re-consent
is needed. What changes is the privacy note, which is Article 13 information rather than
consent, and which currently reads:

> **Where it lives** — until you approve nothing is stored anywhere; your submission
> arrives in my personal Gmail so I can read it. If I publish it, it goes into this site's
> public repository. If I don't, I delete the email and nothing remains.

It becomes:

> **Where it lives** — until I publish it, your submission sits in a private store only I
> can read. If I publish it, it goes into this site's public repository. If I don't, I
> delete it from that store. A copy stays in that store's private history, which nobody but
> me can see — ask me and I will wipe that too.

**Corrected after review.** The first draft of this paragraph ended "I delete it and nothing
remains", and this section called that "shorter, and still true". It was not true, and §11 five
lines below said so in the same breath — it stated that the deleted content survives in the private
repo's git history and that "the privacy note no longer promises otherwise", when the note's literal
words were exactly that promise. Two halves of one document contradicting each other, and the wrong
half shipped as live Article 13 text.

`deletePending` issues a Contents API DELETE, which removes the file from the tip of the private
repository. It does not rewrite that repository's history. The wording above says so in language
somebody who does not use git will follow, names who can see the history, and offers the wipe on
request — which is their Article 17 right, and is what makes the paragraph reassuring rather than
alarming. Anyone editing it later must keep all three of those properties.

## 11. Residual risks, accepted

- **A pending submission is now stored.** It sits in a private repository until acted on.
  Rejection deletes the file, but the deleted content remains in that private repo's git
  history. It is private and single-reader, and the privacy note no longer promises
  otherwise — but the old design's "rejection writes nothing at all" property is genuinely
  gone and cannot be recovered alongside an admin page.
- **`ADMIN_PASSWORD` is the whole gate.** No second factor, no rate limiting. Bounded by
  requiring a generated 24+ character value, which is the trade being made deliberately.
- **`GITHUB_TOKEN` now reaches two repositories.** A leak was already a site takeover; it
  now also exposes pending submissions. Same acceptance as before, same mitigation:
  server-side only, Production only, never logged, revocable in minutes.
- **No notification if GitHub watching is misconfigured.** Unlike the email design, nothing
  fails loudly — a submission simply sits unseen. The runbook must make enabling Watch a
  named setup step, and the owner should check `/admin` after sending an invite regardless.
- **`/admin` cannot be exercised on localhost**, because of the same hardcoded `SITE_ORIGIN`
  check the other routes use. Consistent with the existing design, and the same
  uncommitted-edit workaround applies.

## 12. Verification

`npm run check:tokens` loses four assertions and gains coverage of the admin session
token, which is genuinely testable: sign, verify, tamper, expire, wrong-domain, and an
empty-secret assertion mirroring the invite token's. Net roughly neutral.

`npm run postbuild` keeps all three gates. Its secret scan drops `RESEND_API_KEY` and adds
`ADMIN_PASSWORD`.

Manual, before any real colleague is invited: submit through `/invite`, confirm the file
appears in the private repo, confirm GitHub notifies, open `/admin` on a phone, confirm the
card renders identically to the public one, reject one and confirm the file is gone,
approve one and confirm the pull request opens and the pending file is deleted, then merge
and confirm the section appears.
