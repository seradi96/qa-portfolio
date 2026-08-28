# Testimonials — runbook

Operating instructions for the invite-only testimonials feature. Design rationale lives in
`docs/superpowers/specs/2026-08-28-testimonials-design.md`; this file is only the doing.

**The shape of it in six lines.** You mint a signed invite link on your laptop and send it by hand in
a LinkedIn DM. The colleague fills in a form on aserban.ro. Nothing is stored anywhere: the submission
is signed, gzipped and mailed to your Gmail, and **that email is the only copy**. From the email you
tap Publish, which opens a pull request against `src/content/testimonials.json`; you merge it from the
GitHub mobile app and Vercel deploys in about 90 seconds. Tapping Discard writes nothing anywhere —
rejection is literally doing nothing, which is why the retention promise in the consent text is true.

---

## 1. Environment variables

All four are **server-side, Vercel Production only**. Never `NEXT_PUBLIC_`. `npm run postbuild` greps
the build output for all four values and fails the build if one leaks.

| Name | What it is | Where else it must match |
|---|---|---|
| `INVITE_SECRET` | HMAC key for `i1` invite tokens | your local `.env.local` — `npm run invite` signs with it |
| `MOD_SECRET` | HMAC key for `m1` moderation tokens | nowhere; only the server uses it |
| `RESEND_API_KEY` | Sends the moderation email | nowhere |
| `GITHUB_TOKEN` | Fine-grained PAT, `seradi96/qa-portfolio` only, Contents R/W + Pull requests R/W | nowhere |

Set them at **Vercel → the project → Settings → Environment Variables**, ticking **Production** only.
Changing a value does not affect deployments that already exist — you must redeploy
(**Deployments → ⋯ on the newest one → Redeploy**) before the change takes effect.

`INVITE_SECRET` is the one value that lives in two places. If `.env.local` and Vercel Production
disagree, every link you mint is rejected with a 403 on the live site and the colleague sees a
"this link isn't valid" screen. Copy it, don't retype it.

**`.env.local` also gates the build itself, not just runtime.** `src/lib/token.ts` asserts
`INVITE_SECRET` and `MOD_SECRET` at module scope, and `next build` evaluates route-handler modules
while "Collecting page data" — so `npm run build` fails on a fresh clone with no `.env.local` at all,
before a single page renders:

```
Error: INVITE_SECRET is missing, empty, or shorter than 32 characters...
Error: Failed to collect page data for /api/testimonials/submit
```

Fix: `cp .env.local.example .env.local`, fill in real values. Unsetting a shell variable does **not**
reproduce this — Next reads `.env.local` itself regardless of the shell — the file has to be missing.
This tripped two people into the wrong diagnosis (blaming the shell environment) during Task 10.

---

## 2. Set up the Gmail filter — mandatory, do it before the first invite

The moderation email is **the only copy of a pending submission**. Nothing is stored server-side.
If one lands in Spam, Gmail deletes it after 30 days and the submission is gone — the only recovery
is asking the colleague to write it again from the same still-valid link, which you will not enjoy
doing. The sender is `onboarding@resend.dev`, a shared Resend sandbox domain used by thousands of
other senders, so its reputation is not yours to control. That is what makes this a hard setup step
rather than a nicety.

In Gmail on desktop:

1. Search box → **Show search options** (the sliders icon).
2. **From:** `onboarding@resend.dev` → **Create filter**.
3. Tick: **Never send it to Spam**, **Always mark it as important**, **Categorize as: Primary**,
   and **Apply the label:** → *New label* → `Testimonials`.
4. **Create filter.**
5. Also add `onboarding@resend.dev` to Contacts — belt and braces on the reputation problem.

Verify it before trusting it: mint an invite to yourself (§3), submit the form, and confirm the mail
arrives in **Primary**, labelled, with the full submission readable in the body without tapping
anything. That readability is the point — triage happens on the lock screen.

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
it. Send the DM by hand. **The application never emails anyone but you** — that is why there are no
DNS records to maintain.

Before sending, read the DM once as the recipient would. It should sound like you wrote it, and the
URL should be short enough not to read as phishing.

The link expires **45 days** after minting (`--days` overrides this, including a negative value to
mint an already-expired test link). It is not revocable and it is replayable inside that window:
someone who forwards it can submit again under any name. That is fine — nothing is public until you
approve it, and you verify the attribution against the real LinkedIn profile when you do.

If it fails with a missing `INVITE_SECRET`, that means no `.env.local` — see §1.

---

## 4. Review a submission

The email carries the whole submission in plain text plus two links:

- `https://aserban.ro/moderate#a=publish&t=…`
- `https://aserban.ro/moderate#a=discard&t=…`

Both merely open the page — **no GET in this feature changes anything**, which is why mail scanners
prefetching your links cannot approve a testimonial by accident. The page reads the token from the
URL fragment (which never leaves the browser), gunzips it, and renders the record through the exact
same `TestimonialCard` the live site uses, so what you see is what ships.

- **Publish** → POSTs to `/api/testimonials/publish` → a branch `testimonial/<id>`, a commit, and a
  pull request. Merge it from the GitHub mobile app. Live in ~90 seconds.
- **Discard** → calls nothing at all. Then **delete the email** — the screen says so, because that
  email is the last remaining copy.

Tapping Publish twice is safe: the second tap says "Pull request already open", and after the merge
it says "Already published". Publishing is idempotent on the record's `id`.

Before you merge, do the one check no script can do: click **Verify on LinkedIn** on the preview card
and confirm it lands on the real person. Slugs are percent-encoded in the wild — this site's own is
`%C8%99erban-andrei-5a14a51a5` — so a broken slug is a genuine failure mode, not a theoretical one.

---

## 5. Publish by hand when the API path fails

If Publish returns a 502, or `GITHUB_TOKEN` has expired or been revoked, the same email contains two
fallbacks: a prefilled GitHub editor URL, and the exact JSON record as a paste-ready block. The token
is a convenience, not a dependency.

1. Open the GitHub editor link from the email (or navigate to
   `https://github.com/seradi96/qa-portfolio/edit/main/src/content/testimonials.json`).
2. Paste the JSON record into the array. It is an array of objects — mind the comma after the
   previous entry, and keep the newest record anywhere; `src/lib/testimonials.ts` sorts by
   `publishedAt`.
3. Commit to a new branch, open the pull request, wait for the Vercel preview, merge.

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

**`MOD_SECRET`.** Rotating it invalidates every moderation email you have not yet acted on — those
submissions become unpublishable and the colleague has to resubmit. Clear your inbox of pending
testimonials before rotating, or accept that cost.

**`RESEND_API_KEY`.** resend.com → **API keys** → revoke the old key, create a new one with **Sending
access** only, paste into Vercel, redeploy. A stale key means submissions return 503 and the form keeps
everything the colleague typed — they can retry once you have fixed it, so this failure is recoverable.

**`GITHUB_TOKEN` — revoke first, ask questions later.** This is the token that can write to any branch
of `seradi96/qa-portfolio`, `main` included. A leaked token is a site takeover in either git-target
design this feature considered — the branch-and-PR flow buys review of the application's own writes,
not credential containment, because a fine-grained PAT's `Contents: Read & Write` permission is
repository-scoped, with no per-branch grant. That risk is accepted rather than solved. Containment,
not prevention, is the plan:

1. github.com → **Settings → Developer settings → Personal access tokens → Fine-grained tokens** →
   the token → **Revoke**. Do this before anything else; publishing degrades to §5, which still works.
2. **Generate new token** → Repository access: **Only select repositories** → `seradi96/qa-portfolio`.
   Permissions: **Contents: Read and write**, **Pull requests: Read and write** (Metadata: Read-only is
   added for you). Nothing else. Set an expiry you will actually notice.
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
| Form returns 413 | answers exceed the URL budget | Ask for a shorter answer; the error says roughly how much |
| Form returns 503 | Resend rejected the send | Check `RESEND_API_KEY`; the form has kept everything they typed, so they can retry |
| No email at all | Spam, or Resend's 100/day ceiling | §2; check resend.com's logs |
| Publish returns 502 | `GITHUB_TOKEN` expired, revoked, or lacking a permission | §7, and publish by hand via §5 meanwhile |
| Moderate page is blank | no JavaScript, or a browser without `DecompressionStream` | Use Chrome 80+/Safari 16.4+/Firefox 113+, or §5 |
| Section missing from the live site | `testimonials.json` is `[]`, or every record failed validation and was dropped | `npm run build` and read the `postbuild:` lines |
