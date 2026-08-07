# Parked requests — the backlog

> Things Jay has asked for. **Do not start building an open item without
> asking him first** — the open ones have questions only he can answer.
>
> This doc sits at the top level of `claude/` alongside `state-of-play.md`
> (current status) and `changelog.md` (history), as a peer of those two.
>
> **Adding to this list is cheap. Please keep it here** rather than growing
> the parked section in `state-of-play.md`.

## Status at a glance — updated 7 Aug 2026

**Two items are open. Item 7 (documents shared with managers) is PARKED BY JAY.
Item 8 (the tournament rules) is DEFERRED BY JAY TO MID-SEPTEMBER 2026 — do not
raise it before then.** The other six are closed.

| # | Item | State |
|---|---|---|
| 1 | Club-level registration | **BACK, 3 Aug, behind a silent link** (`622f0e8`) — and actually WORKING since 4 Aug (`4955a5a`); see below |
| 2 | Hero Register buttons actually register | ✅ Done, live (`a0e9c39`) |
| 3 | Reword "Bring your club" → "Sign up now" | ✅ Done, live (`fa28095`) |
| 4 | Drop pool D and "No preference" | ✅ Done, live (`fa28095`) |
| 5 | The two draw editors read a preference differently | ✅ **Resolved by deletion, 2 Aug** |
| 6 | The `/organizer` Clubs tab | ✅ **BUILT 4 Aug (`42fcad6`)** — was deferred to October; Jay said build it now |
| 7 | **Documents shared with managers** | ⏸️ **SPECCED, PARKED BY JAY 5 Aug — do not raise unprompted** |
| 8 | **The tournament rules for `/rules`** | ⏸️ **DEFERRED BY JAY TO MID-SEPTEMBER 2026 (7 Aug) — do not raise before then** |

---

## 8. The tournament rules — ⏸️ DEFERRED TO MID-SEPTEMBER 2026 (7 Aug 2026)

Jay, 7 Aug 2026: **"mark rules to be uploaded in mid September"**, and, on where
to record it: *"nowhere, just here in your files, so you stop reminding me about
it until then."*

**⚠️ DO NOT RAISE THIS BEFORE MID-SEPTEMBER 2026.** It is not forgotten, it is
not blocked on anything, and it does not need chasing. It has a date. A session
that lists it as an open job before then is nagging him about something he has
already answered — which is the specific thing he asked to stop.

**Nothing in the repo changed and nothing was deployed for this.** No commit, no
credits, no branch. The record is this entry.

⚠️ **THE LIVE PAGE IS ALREADY CONSISTENT WITH MID-SEPTEMBER, WHICH IS WHY IT WAS
LEFT ALONE.** `/rules` says the rules *"will be published on this page before
registration opens in October"*. Mid-September is before October, so that
sentence stays true and there is no public contradiction to fix. **Rewriting it
to say "mid-September" was offered and declined**, and the arguments against it
are worth keeping:

- it costs a **15-credit production deploy** for a wording change nobody has
  complained about;
- `tests/test-about-board.js` pins the string `before registration opens in
  October`, and `tests/_prove-registration.js` has a fault anchored on that exact
  text — so the change is a test edit and a fault repoint as well as a copy edit;
- it converts a promise that cannot go stale into a **dated** one. If the rules
  slip a fortnight the page is publicly wrong, with no warning and no error.

**When the rules do arrive, the change is already scoped** and none of it needs
designing:

1. **In the repo:** replace the single marked block in `rules.html` — the comment
   reads `⚠️ REPLACE THIS BLOCK when the real rules arrive`. **Nothing else on
   that page moves**; the topbar, hero, footer and styling are finished.
2. **Add the "Last updated" line** under the `h1` in the hero at the same time.
   The markup and the `.updated` CSS rule are left in place, commented, in
   `rules.html`, and the live rule can be copied from `legal.html`. ⚠️ **A rules
   page with no date is one nobody can trust mid-tournament.**
3. **Update the two tests** that pin the placeholder: `test-about-board.js`
   (the `Coming soon` badge and the October sentence) and the two faults in
   `_prove-registration.js` anchored on the placeholder text. ⚠️ **Repoint them
   at whatever the rule really is — never delete them.** A fault that cannot be
   injected is a failed run, not a pass.
4. **It is a docs-shaped change to one marked block, so it should RIDE WITH
   ANOTHER COMMIT** rather than costing its own 15-credit deploy. It is not
   urgent enough to deploy alone.

⚠️ **The four things listed under "What is already settled" on that page are
stated elsewhere on the site too.** If the real rules contradict any of them,
the contradiction is live in more than one place — grep before assuming the
`/rules` copy is the only one.

**A scheduled task fires on 15 September 2026 to ask Jay for the rules.** It
starts a fresh session, so it carries its own standalone instructions. If this
entry is ever closed early, that task should be deleted with it rather than left
to fire into a finished job.

---

## 7. Documents shared with managers — ⏸️ SPECCED AND PARKED (5 Aug 2026)

Jay, 5 Aug: *"we need a documents section in the manager and organizer view,
organizers would have the option to share documents with managers."*

**A full design exists: `claude/specs/spec-documents.md`. NO CODE WAS WRITTEN.**
The repo is untouched by this; there is no branch, no half-built function and
nothing to clean up.

**Two decisions Jay took before it was parked, and they stand:**

- documents are **TAGGED BY AGE GROUP** — `*` for everyone, or a list of
  groups, and a manager sees only what applies to them;
- files are **UPLOADED IN THE BROWSER into Netlify Blobs**, not linked from
  Google Drive.

**How it was parked.** He asked to narrow it to the organiser side only, then
stopped that too — *"table … don't do that part now"* — and chose to park it
entirely. **Do not raise it unprompted**, the same standing rule as the
`club-manager-page` branch. If he brings it up, the spec is ready to build from.

⚠️ **ONE THING MUST BE CHECKED BEFORE ANY OF IT IS BUILT, and it was the point
work stopped:** the spec's 10 MB upload limit is an ASSUMPTION, not a measured
number. A Netlify function's request body is capped somewhere around 6 MB and a
base64-encoded upload spends that budget faster than the file's own size
suggests — so the real ceiling may be well under 10 MB, and it decides whether
a browser upload through a function is the right shape at all. **Verify it
against Netlify's current documentation first.** An assumed limit written down
as fact is exactly how the "env vars need no deploy" claim survived a week.

**The four questions in the spec are still unanswered** and still gate the
build: documents on the match-day app or not; whether "everyone" ever includes
the public; what happens to files after the tournament; and how deletion is
confirmed.

---

## 6. The `/organizer` Clubs tab — ✅ BUILT AND LIVE (`42fcad6`, 4 Aug 2026)

**Deferred to October on 3 Aug, built on 4 Aug at Jay's "build it now".** The
deferral reasoning was sound and is kept below, because the cost it predicted
is real and has simply been accepted rather than avoided.

**What shipped:** one row per club — declared total, registered total, a
Short / Over / On track badge, and the contact — expandable to a per-age-group
breakdown with mismatching rows tinted. A "show only clubs to chase" filter,
and the flagged count on the tab button itself. Plus a "registered but never
declared" panel, which is where a club that skipped the declaration *and* a
club whose name failed to match both land.

Full design reasoning in `CLAUDE.md` (Clubs tab section) and
`claude/changelog.md`'s entry. The short version of the hard part: **both sides
of the join are free text typed by two different people months apart, and there
is no club id anywhere in the system.**

⚠️ **THE DEFERRAL REASONING WAS RIGHT AND STILL APPLIES.** The Teams sheet is
empty until registration opens in mid-October, so **the registered column reads
zero for every club and every club reads "Short"** until then. The tab is
correct about a world in which nothing has registered; it is just not yet useful.
Jay chose that knowing it. Nothing needs changing in October — real data simply
starts arriving and the numbers start meaning something.

The one thing genuinely lost by building early: the test fixtures are invented
rather than checked against real declarations. They are swept exhaustively (all
fifteen age groups, name pairs both ways) to compensate, but **the first real
reconciliation in October is still worth eyeballing** rather than trusting
outright — particularly whether the club-name normalisation copes with what
clubs actually type.

---

## 1. Club-level registration — BUILT 1 Aug, REMOVED 2 Aug, BACK 3 Aug, WORKING 4 Aug

Built and shipped 1 Aug (`1cdc521`), **removed entirely on 2 Aug** at Jay's
request (`91080a2`), and **restored on 3 Aug** (`622f0e8`) when he asked for a
link he could email to clubs that does not appear anywhere on adhjrt.com.

The restoration was a **reverse apply of `91080a2`'s `_intake.js`/`_email.js`
half**, not a rewrite, so the columns, row builder, mappers, validation and
club email are byte-identical to what shipped on 1 Aug. The homepage modal
stayed deleted — the form is its own unlisted page at `/register-club`, and a
test asserts the club form has not crept back onto the public page.

⚠️ **The page being unlisted is NOT what protects it** — this repo is public and
its root is the deployed site. `CLUB_FORM_KEY` is. Full reasoning in
`CLAUDE.md`'s club section and in `claude/changelog.md`.

⚠️ **AND IT COULD NEVER HAVE WORKED UNTIL 4 AUG.** The club form was subject to
the REGISTRATION WINDOW, which does not open until 8 October — so the silent
link could not be used until the exact moment it stopped being useful. It rode
in on 1 Aug with the gateway reuse and nobody asked. Found the first time Jay
actually used the link, fixed in `4955a5a`, verified live. See the changelog.

**The leftovers are no longer leftovers:** the *Club Registrations* sheet is
live again and `GOOGLE_SHEET_ID_CLUBS` is doing real work. Two small jobs remain
for Jay and are tracked in `state-of-play.md`'s Jobs for Jay: delete the
"DIAGNOSTIC DELETE ME" verification row, and rotate `CLUB_FORM_KEY` (its value
was pasted into a chat during the 4 Aug diagnosis).

The related **club youth manager page** (branch `club-manager-page`, 13
commits, never merged) stays **parked at Jay's request** — do not raise it, and
do not treat any of this as a step towards it. A silent link is the opposite of
a login: he wanted no club sign-in, and this gives him none.

---

## 2. Hero Register buttons actually register — ✅ LIVE (`a0e9c39`)

The two hero buttons were `<a href="#register">` — they scrolled you down to
a second pair that did the real work. They now call the same handlers the
lower pair already used, so the window gating, the refusal wording and the
modal all stay in one place. **The lower pair is unchanged, as asked.** The
existing `ctaToast` now also renders under the hero buttons, because it was
only drawn inside `#register` — so a click on a "Coming Soon" button at the
top would have produced no visible answer at all.

---

## 3. Reword "Bring your club" — ✅ LIVE (`fa28095`)

Jay picked **"Sign up now"** from three options and chose to reword the body
copy too. The body copy is not in the page — it comes from
`registrationCopy()` in the SHARED BLOCK — so it changed in
`_registration.js` AND `scores-data.js`, kept byte-for-byte identical. The
`/organizer` preview reads the same function and followed automatically.

---

## 4. Remove pool D and "No preference" — ✅ LIVE (`fa28095`)

A/B/C only. ⚠️ **The important half was server-side and did not exist:**
`preferred-pool` was only ever checked for being non-empty, so the dropdown
was the only thing restricting it — which means it restricted nothing.
Narrowing the dropdown alone would have been cosmetic.

**A draw can still have a pool D** — confirmed with Jay first; this is only
what a club may *ask* for, and the 4-pool bracket depends on pool D existing.

⚠️ **Consequence:** the field is still mandatory, so every club must now name
a pool — there is no way to say "don't care". If that turns out wrong in
practice the fix is to make the field **optional**, not to restore "No
preference".

---

## 5. The two draw editors read a pool preference differently — ✅ RESOLVED BY DELETION (2 Aug)

Found while building item 4: `Manager.dc.html` matched a stored preference
with `/[A-Z]/i` while `Scores & Standings.dc.html` matched with `/[A-D]/i` —
two different wrong answers to the same stored string.

**Resolved on 2 Aug by the `unify-back-office` merge (`fc6ae59`): the
`/scores` Manager area — and with it the second editor and its matcher — was
deleted whole.** `/manager`'s `/[A-Z]/i` is the only matcher left, and no
reading rule changed, so no stored preference is read differently than
before. `test-intake.js` asserts the surviving pattern.
