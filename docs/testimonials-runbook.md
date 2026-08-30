# Testimonials — runbook

Operating instructions for the invite-only testimonials feature. Design rationale lives in
`docs/superpowers/specs/2026-08-28-testimonials-design.md`, as amended by
`2026-08-29-admin-moderation-design.md` (which replaced the email path with an admin page); this
file is only the doing.

**The shape of it in eight lines.** You mint a signed invite link on your laptop and send it by hand
in a LinkedIn DM. The colleague fills in the form on aserban.ro. The submission is written as
`pending/<id>.json` to a **private** GitHub repository, `seradi96/qa-portfolio-pending`, and GitHub
emails you — because you are watching that repository, which is now the only notification there is.
You open `https://aserban.ro/admin` on your phone, type the password once (a signed cookie then
lasts 30 days), and read each pending submission rendered by the same `TestimonialCard` the live site
uses. **Publish** opens a pull request against `src/content/testimonials.json` and deletes the pending
file; you merge from the GitHub mobile app and Vercel deploys in about 90 seconds. **Reject** (after a
one-tap confirmation) deletes the pending file and does nothing else.

One honest change from the old design: a pending submission is now **stored**, in a private
single-reader repository, until you act on it. Rejecting deletes the file but not that repository's
git history. The privacy note on the form no longer promises otherwise — it says the submission sits
in a private store only you can read. Do not re-promise "nothing is stored anywhere" to anyone.

---

## 1. Environment variables

All four are **server-side, Vercel Production only**. Never `NEXT_PUBLIC_`. `npm run postbuild` greps
the build output for all four values and fails the build if one leaks.

| Name | What it is | Where else it must match |
|---|---|---|
| `INVITE_SECRET` | HMAC key for `i1` invite tokens | your local `.env.local` — `npm run invite` signs with it |
| `MOD_SECRET` | HMAC key for the `/admin` session cookie. **Repurposed** — it no longer signs moderation tokens, which no longer exist | nowhere; only the server uses it |
| `ADMIN_PASSWORD` | The `/admin` password. **Generated, 24+ characters** — see §2.3 | nowhere |
| `GITHUB_TOKEN` | Fine-grained PAT over **both** `seradi96/qa-portfolio` (Contents R/W + Pull requests R/W) and the private `seradi96/qa-portfolio-pending` (Contents R/W) | nowhere |

Set them at **Vercel → the project → Settings → Environment Variables**, ticking **Production** only.
Changing a value does not affect deployments that already exist — you must redeploy
(**Deployments → ⋯ on the newest one → Redeploy**) before the change takes effect.

`INVITE_SECRET` is the one value that lives in two places. If `.env.local` and Vercel Production
disagree, every link you mint is rejected with a 403 on the live site and the colleague sees a
"this link isn't valid" screen. Copy it, don't retype it.

**`.env.local` also gates the build itself, not just runtime.** `src/lib/token.ts` asserts
`INVITE_SECRET` and `MOD_SECRET` at module scope and `src/lib/admin-auth.ts` asserts `ADMIN_PASSWORD`
(minimum 24 characters) the same way, and `next build` evaluates route-handler modules while
"Collecting page data" — so `npm run build` fails on a fresh clone with no `.env.local` at all,
before a single page renders. A too-short `ADMIN_PASSWORD` fails it just as loudly, which is the
point: the login must break at build time, not at 11pm:

```
Error: INVITE_SECRET is missing, empty, or shorter than 32 characters...
Error: Failed to collect page data for /api/testimonials/submit
```

Fix: `cp .env.local.example .env.local`, fill in real values. Unsetting a shell variable does **not**
reproduce this — Next reads `.env.local` itself regardless of the shell — the file has to be missing.
This tripped two people into the wrong diagnosis (blaming the shell environment) during Task 10.

---

## 2. One-time setup — all four steps, before the first invite

### 2.1 Create the private pending repository

github.com → **New repository** → owner `seradi96`, name **`qa-portfolio-pending`**, visibility
**Private**. Tick **Add a README file** so the repo is not empty (an empty repo has no default
branch, and the store writes to `main`). Nothing else.

The name is a hardcoded constant in `src/lib/pending-store.ts` — there is no environment variable
for it, deliberately, so a typo cannot send someone's testimonial to a repository you do not own.
If you name it anything else, edit that constant.

You will never open a file in this repo by hand in normal use. It is a queue, not a workspace.

### 2.2 Extend the fine-grained token to both repositories

github.com → **Settings → Developer settings → Personal access tokens → Fine-grained tokens** →
your existing token → **Edit**. Repository access: **Only select repositories** → add
`seradi96/qa-portfolio-pending` alongside `seradi96/qa-portfolio`.

Permissions apply to every selected repository, so the set is the union of what each needs:
**Contents: Read and write** and **Pull requests: Read and write**. Nothing else. (The pending repo
only needs Contents; a fine-grained token cannot grant Pull requests to one repo and not the other,
and the extra grant on a private single-file queue is not worth a second token to avoid.)

A token that reaches `qa-portfolio` but not `qa-portfolio-pending` fails in a specific way: invites
work, the form submits, and the submitter is told it did not save — §9.

### 2.3 Generate `ADMIN_PASSWORD`

```bash
node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"
```

Paste it into Vercel Production and into `.env.local`. Put it in your password manager, because you
will type it on a phone and there is no reset flow.

**Do not choose a memorable one.** There is no rate limiting on `/api/admin/login` and there cannot
usefully be: a Vercel function has no throttle in front of it, and a module-scoped attempt counter
resets on every cold start and is not shared across concurrent lambdas, so an attacker would get an
unlimited parallel guessing budget regardless. Entropy in the password is the entire defence.
`src/lib/admin-auth.ts` refuses to load below 24 characters, so a short one fails the build.

### 2.4 Watch the pending repository — this is the ONLY notification

github.com → `seradi96/qa-portfolio-pending` → **Watch** → **All Activity**. Confirm your GitHub
notification settings actually deliver email (**Settings → Notifications → Email**).

**Nothing fails loudly if you skip this.** The old design pushed the submission into your inbox, so
a delivery failure was visible. Now the submission lands safely in the private repo and simply sits
there unseen; there is no alarm, no retry, and no second channel. Two habits cover the gap: enable
Watch, and open `/admin` yourself a day or two after sending any invite.

### 2.5 Verify the whole loop before inviting a real person

Mint an invite to yourself (§3), submit the form on the live site, then confirm all four:

1. `pending/<id>.json` appears in `seradi96/qa-portfolio-pending`.
2. GitHub emails you about it.
3. `https://aserban.ro/admin` lists it, rendered by the real card.
4. Rejecting it removes the file from the repo.

---

## 3. Mint an invite

```bash
npm run invite -- \
  --name "Maria Popescu" \
  --role "QA Lead" \
  --company "TOKERO" \
  --project tokero \
  --message "You saw the whole thing from the inside — would you write a few lines?"
```

`--project` must be one of `deutsche-bahn`, `tokero`, `dentsply-sirona`, `happy-media`, `other`
(the list is `PROJECT_SLUGS` in `src/lib/projects-meta.ts`). The script prints two things: the URL
(`https://aserban.ro/invite#<token>`, around 229 characters) and a paste-ready LinkedIn DM containing
it. Send the DM by hand. **The application sends no email at all** — GitHub does, because you are
watching the pending repository (§2.4). That is why there are no DNS records, no sending domain and
no email provider to maintain.

Before sending, read the DM once as the recipient would. It should sound like you wrote it, and the
URL should be short enough not to read as phishing.

The link expires **45 days** after minting (`--days` overrides this, including a negative value to
mint an already-expired test link). It is not revocable and it is replayable inside that window:
someone who forwards it can submit again under any name. That is fine — nothing is public until you
approve it, and you verify the attribution against the real LinkedIn profile when you do.

If it fails with a missing `INVITE_SECRET`, that means no `.env.local` — see §1.

---

## 4. Review a submission at `/admin`

Open `https://aserban.ro/admin`. First visit on a device shows a single password box; type
`ADMIN_PASSWORD` and you get a signed `admin_session` cookie good for **30 days**
(`HttpOnly; Secure; SameSite=Lax`). After that the page opens straight into the queue.

Each pending submission is rendered by the **real `TestimonialCard`**, the same component the live
site uses, so what you publish is byte-for-byte what ships. Two buttons per submission, both POSTs,
both guarded by the session cookie and by the hardcoded `SITE_ORIGIN` Origin check:

- **Publish** → `POST /api/admin/publish` → re-validates every field, then a branch
  `testimonial/<id>`, a commit, and a pull request against `src/content/testimonials.json`, then
  deletes `pending/<id>.json`. Merge the PR from the GitHub mobile app. Live in ~90 seconds.
- **Reject** → asks "Delete this submission?" once, since it is irreversible from the queue's
  point of view — the file comes out and will not be published. Confirming calls
  `POST /api/admin/reject`, which deletes `pending/<id>.json` and nothing else; as with publish,
  a copy of that record stays in the pending repository's git history until you run the erasure
  procedure in §8.

Re-validation on publish is not redundant: the record has travelled through a store since it was
sanitised, and passing validation once is not proof it is still well-formed. A record that fails it
comes back as a 422 and stays in the queue, untouched.

Tapping Publish twice is safe: the second tap shows "A pull request was already open" (with a note
that it still needs merging) if the first is unmerged, or "Already on the site" once it has been
merged. Publishing is idempotent on the record's `id`.

**Merge each pull request before pressing Publish on the next row.** That is safe only per-record —
across two different rows it is not. Every publish cuts its branch from `main`'s current head and
rewrites the whole of `testimonials.json`, so two Publishes against the same unmerged base produce
two branches that each rewrite the file from the same starting point: the first merges cleanly, the
second conflicts. Nothing is lost — git refuses the bad merge rather than silently dropping a
record — but resolving a real conflict means hand-editing `testimonials.json` inside the merge,
which the GitHub mobile app cannot do. If a second PR shows a conflict, merge the first one, then
either resolve the second on a laptop or close it and press Publish again for that submission once
the first has landed.

An empty queue renders as "Nothing waiting" — the normal state, not an error. Git cannot store an
empty directory, so the store reads a 404 from `GET /contents/pending` and returns `[]`.

Before you merge, do the one check no script can do: click **Verify on LinkedIn** on the card and
confirm it lands on the real person. Slugs are percent-encoded in the wild — this site's own is
`%C8%99erban-andrei-5a14a51a5` — so a broken slug is a genuine failure mode, not a theoretical one.

`/admin` cannot be exercised from `localhost`: its POST routes carry the same absolute `SITE_ORIGIN`
check as the submit route. That is deliberate and unchanged from the original design.

---

## 5. Publish by hand when the API path fails

If Publish returns a 502, or `GITHUB_TOKEN` has expired or been revoked, the submission is not lost:
it is still sitting in the private repo as `pending/<id>.json`, and that file **is** the record, in
exactly the shape `src/content/testimonials.json` stores. The token is a convenience, not a
dependency.

1. Open `https://github.com/seradi96/qa-portfolio-pending/blob/main/pending/<id>.json` and copy the
   whole `{ … }` object.
2. Open `https://github.com/seradi96/qa-portfolio/edit/main/src/content/testimonials.json` and paste
   it into the array. It is an array of objects — mind the comma after the previous entry, and keep
   the newest record anywhere; `src/lib/testimonials.ts` sorts by `publishedAt`.
3. Commit to a new branch, open the pull request, wait for the Vercel preview, merge.
4. **Delete `pending/<id>.json` from the private repo by hand** — the API path would have done this
   for you, and a leftover pending file will show up in `/admin` as if it were still unreviewed.

If you would rather do it on the laptop:

```bash
git switch -c testimonial/<id>
# paste the record into src/content/testimonials.json
npm run build && npm run lint      # postbuild proves the name reached the prerendered HTML
git add src/content/testimonials.json
git commit -m "content: publish testimonial from <Name>"
```

Then push — this repo needs the non-default GitHub identity, because the active `gh` account is
usually `PortivoApp` and a plain `git push` 403s:

```bash
export GH_PUSH_TOKEN=$(gh auth token --user seradi96)
git -c credential.helper= \
    -c credential.helper='!f() { echo username=seradi96; echo "password=${GH_PUSH_TOKEN}"; }; f' \
    push -u origin testimonial/<id>
```

---

## 6. Take a testimonial down

The consent text promises this on request, no reason needed, normally the same day. Honour it.

1. GitHub mobile (or web) → `src/content/testimonials.json` → edit → delete that whole `{ … }` object
   and the comma that joined it.
2. Commit — straight to `main` is fine for a takedown; speed is the promise.
3. Vercel deploys in ~90 seconds. Confirm on aserban.ro.
4. Reply to the person to say it is done.

If it was the last record, the array becomes `[]` and the section **and both nav entries** disappear
by design — the site returns to exactly what it looked like before the feature shipped.

This removes it from the live site, **not from git history**. Say so plainly if they ask. If they want
true erasure, §8.

---

## 7. Rotate a secret

Generate a fresh 256-bit value:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

For all four: set the new value in **Vercel → Settings → Environment Variables → Production**, then
**redeploy** — nothing changes until a new deployment exists.

**`INVITE_SECRET` — the panic button.** Rotating it invalidates **every outstanding invite at once**,
immediately and irreversibly. There is no per-invite revocation and there never will be, because that
would be state. Use it when a link has been forwarded somewhere you did not intend, or when you want
a clean slate. Afterwards, update `.env.local` to the same value and re-mint links for anyone still
mid-write, apologising for the churn.

**`MOD_SECRET` — the other panic button.** It signs the `/admin` session cookie, so rotating it
**signs every admin session out at once, on every device**. That is what you reach for if the phone
you stay logged in on is lost or stolen: rotate, redeploy, and every outstanding cookie is dead
within one deployment. Nothing else is affected — pending submissions are untouched, invites are
untouched, and you simply type the password again next time. It no longer signs moderation tokens;
that family was deleted with the email path.

**`ADMIN_PASSWORD`.** Generate a new one with the §2.3 command, set it in Vercel Production, redeploy,
and update `.env.local`. Rotate it if you ever type it somewhere you should not have, or on a device
you no longer trust. Note that rotating the password does **not** invalidate existing sessions — the
cookie is signed with `MOD_SECRET`, not derived from the password — so if the concern is a device
rather than the secret, rotate `MOD_SECRET` too, or instead.

**`GITHUB_TOKEN` — revoke first, ask questions later.** This is the token that can write to any branch
of `seradi96/qa-portfolio`, `main` included. A leaked token is a site takeover in either git-target
design this feature considered — the branch-and-PR flow buys review of the application's own writes,
not credential containment, because a fine-grained PAT's `Contents: Read & Write` permission is
repository-scoped, with no per-branch grant. It now also exposes every pending submission, because
the same token reaches the private queue. Same acceptance as before, same mitigation: server-side
only, Production only, never logged, revocable in minutes. Containment, not prevention, is the plan:

1. github.com → **Settings → Developer settings → Personal access tokens → Fine-grained tokens** →
   the token → **Revoke**. Do this before anything else; publishing degrades to §5, which still works.
2. **Generate new token** → Repository access: **Only select repositories** → both
   `seradi96/qa-portfolio` **and** `seradi96/qa-portfolio-pending`. Permissions: **Contents: Read and
   write**, **Pull requests: Read and write** (Metadata: Read-only is added for you). Nothing else.
   Set an expiry you will actually notice.
3. Paste into Vercel Production, redeploy, and test with the §4 loop against an invite to yourself.
4. Check `https://github.com/seradi96/qa-portfolio/branches` and the pull request list for anything
   you did not create.

Note the token's expiry date somewhere: when it lapses, Publish starts returning 502 with no other
symptom, and the fallbacks in §5 are what keep you working.

---

## 8. Erase from git history — rare, and it rewrites public history

Deleting a record (§6) removes it from the live site but not from the repository's history. Full
GDPR Article 17 erasure needs a history rewrite. Do this only on an explicit erasure request, and tell
the person it may take a day.

**Understand the cost before you start.** This rewrites every commit after the one that introduced the
record, changes every SHA, requires a force-push to a public repository, breaks every existing clone
and every pull-request reference, and does **not** reach forks or GitHub's cached views of the old
objects — for those you must open a GitHub Support request to purge them.

**Check the private repo too.** If the record ever sat in `seradi96/qa-portfolio-pending` — every
record does, now — then deleting the pending file removed it from the queue but not from that
repository's history. For a true erasure request, run the same `git filter-repo` recipe against
`qa-portfolio-pending` as well, or, far simpler for a queue nobody reads: delete that repository and
create it again empty per §2.1. Nothing in the site depends on its history.

```bash
brew install git-filter-repo

git clone https://github.com/seradi96/qa-portfolio.git qa-portfolio-erase
cd qa-portfolio-erase

# One line per string to erase: the name, the LinkedIn slug, and each answer's text.
cat > /tmp/erase.txt <<'EOF'
literal:Maria Popescu==>REDACTED
literal:maria-popescu-8a41b2==>REDACTED
literal:He owned the end-to-end suite and was the person we pinged when a pipeline went red at 6pm.==>REDACTED
EOF

git filter-repo --replace-text /tmp/erase.txt --force
```

`git filter-repo` deletes the `origin` remote on purpose, so you cannot force-push by reflex. Re-add
it deliberately, then push with the `seradi96` identity:

```bash
git remote add origin https://github.com/seradi96/qa-portfolio.git
export GH_PUSH_TOKEN=$(gh auth token --user seradi96)
git -c credential.helper= \
    -c credential.helper='!f() { echo username=seradi96; echo "password=${GH_PUSH_TOKEN}"; }; f' \
    push --force origin main
```

Afterwards: delete your other local clones and re-clone; confirm Vercel redeployed from the rewritten
head; and open a GitHub Support request asking them to purge cached views of the removed objects.

---

## 9. Symptom → cause

| Symptom | Cause | Fix |
|---|---|---|
| `npm run build` fails with "INVITE_SECRET is missing" on a fresh clone | no `.env.local` | `cp .env.local.example .env.local` and fill in real values — §1 |
| Colleague sees "this link isn't valid" | `.env.local` `INVITE_SECRET` ≠ Vercel Production | Copy the Vercel value into `.env.local`, re-mint |
| "This invite has expired" | past its 45 days | Mint a fresh one |
| Form returns 403 | submitted from a preview deployment, not `https://aserban.ro` | Expected — the Origin check is absolute and has no localhost exemption |
| Form returns 503 | the write to the private pending repo failed | Check `GITHUB_TOKEN` reaches `seradi96/qa-portfolio-pending` (§2.2); the form kept everything they typed, so they can retry |
| No GitHub notification | Watch is not set to All Activity, or GitHub email notifications are off | §2.4 — and check `/admin` directly; the submission is almost certainly there |
| `/admin` shows the password box again | the 30-day session expired, or `MOD_SECRET` was rotated | Type the password again — both are expected, not a fault |
| `/admin` rejects the right password | `ADMIN_PASSWORD` in Vercel Production differs from what you are typing, or the deployment predates the change | Set it in Vercel and **redeploy** — env changes do not reach existing deployments |
| Publish returns 502 | `GITHUB_TOKEN` expired, revoked, or lacking a permission on either repo | §7, and publish by hand via §5 meanwhile |
| Section missing from the live site | `testimonials.json` is `[]`, or every record failed validation and was dropped | `npm run build` and read the `postbuild:` lines |
