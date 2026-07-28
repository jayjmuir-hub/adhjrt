# tests/

The automated checks for this site. Plain Node — no framework, no dependencies,
no build step, in keeping with the rest of the repo. Node 18+ is all you need.

```
node tests/test-registration.js          one file
powershell tests/runall.ps1              everything in the list
powershell tests/runall.ps1 -NoProve     everything except the slow fault run
```

Every file finds the clone itself (`_lib.js`), so the same files run on any
machine with a checkout and no path needs editing.

---

## This folder is HALF the suite. The other half is still on one disk.

`C:\Users\jayjm\adhjrt-sim` on **jay-pc** holds thirteen more test files plus
`validate-bindings.js` — **577 checks** — and its own `runall.ps1`. None of it is
in version control anywhere.

That is the problem this folder exists to end, and it is only half ended. Moving
the rest in is a job for a session bridged to jay-pc:

1. **Read every file first and check for real registration data.** This repo is
   **public**. The rehearsal used invented players (the giveaway is the phone
   number `971500000000`), but that has not been verified file by file, and the
   registration sheets hold children's names, dates of birth and medical notes.
   **If any fixture was built from a real sheet row, it does not come in here** —
   say so and stop rather than sanitising quietly.
2. Copy them into this folder.
3. Point each one at the clone. They currently carry hardcoded paths; the
   cheapest fix is to have each `require('./_lib')` and use `repoRoot()` instead.
4. Merge jay-pc's `runall.ps1` list into the one here — it is an **explicit
   list**, so a file that is not named in it never runs again.
5. Drop the out-of-repo fallbacks from `CANDIDATES` in `_lib.js` once nothing
   lives outside the repo.
6. Delete `C:\Users\jayjm\adhjrt-sim` only after all of that passes.

Until step 6, run **both** suites before trusting a change.

---

## The rule that matters more than the count

**Every new assertion is proven against a deliberately injected fault before it
is trusted.** Not a nicety on this project — a habit paid for in real bugs. It
has caught two tests that passed with the real code deleted, a regex that matched
a comment instead of the code, a section check that scanned too wide a block, and
three assertions that were simply wrong about what the code should do.

`_prove-registration.js` is that habit written down. It breaks the real code on
purpose, one fault at a time, on a **copy** of the clone in a temp folder, and
checks not just that a suite fails but that **the check which fails is the one
claiming to guard that behaviour**. A suite that dies with an exception "fails"
for every fault and proves nothing.

Run it after changing either the code under test or the tests themselves. 17
faults, and all 17 have to be caught by name.

---

## Why the site does not serve this folder

`netlify.toml` sets no publish directory, so the repo root *is* the deployed
site — without a rule, these files would be readable at `adhjrt.com/tests/…`.
There is a `/tests/*` redirect returning 404 to stop that. It is tidiness, not
security: the repo is public, so nothing in here should ever be secret in the
first place. See step 1 above.

---

## Files

| File | What it covers |
|---|---|
| `_lib.js` | repo lookup, `check` / `eq` / `section` / `summary` |
| `test-registration.js` | `registrationState`, `validateSettings`, the shared block, dates and timezones — 196 checks |
| `test-registration-panel.js` | the `/organizer` Registration tab, the public register CTA, and both submit handlers driven against a fake fetch — 222 checks |
| `test-venue-map.js` | the Venue & days schematic, the draggable map, and whether the map labels can be read — 349 checks |
| `test-venue-splits.js` | the fifteen main pitches, whole/halves/quarters, and the rule that a group keeps the same **ground** when a split changes — 142 checks |
| `test-agegroups.js` | the fifteen age groups server-side, and the squad caps the gateway will enforce — 59 checks |
| `test-intake.js` | the sheet column order, the round trip between the writer and the two readers, the allow-list, the validation rules, the rate limit, the whole submission flow and the thinness of the function itself — 468 checks |
| `test-functions-load.js` | loads and CALLS every Netlify function, signed out and signed in — the only test that executes them at all — 170 checks |
| `test-accounts.js` | creating manager and organiser logins, password resets, the length floor — 89 checks |
| `_prove-registration.js` | the fault injection. Not a test; a check on the tests. 172 faults, all caught by the named check |
| `runall.ps1` | the explicit list |
