# Spec — the Club invite link box

_11 August 2026. Jay: "i want an editable box named Club Invite Link in the club
registration section above clubs declared vs registered, then i can put the link
in there, should have an edit and save button"._

## What it is

A card at the top of `/organizer` → **Clubs**, above *Clubs — declared vs
registered*. It holds the silent club-registration link so it is somewhere
findable instead of in one person's sent mail.

Read mode shows the link with **Edit**. Edit mode shows a text box with **Save**
and **Cancel**.

## ⚠️ It holds a secret, and that decides most of the design

The link is `https://adhjrt.com/register-club?k=<CLUB_FORM_KEY>`. The key is
the *only* thing protecting that form: the page being unlisted is not
protection, because this repo is public and the path is visible in the source.

So:

- **GET is organiser-only, unlike `registration-window`'s GET, which is
  public.** Copying that endpoint wholesale is the obvious mistake and it would
  publish the key to anybody who asked. The two look alike and must not be made
  consistent.
- **`CLUB_FORM_KEY` itself is never returned, logged, or echoed in an error.**
  The endpoint answers with the stored link and a boolean.
- **The store is `config`, key `club-link`** — the same store as the venue
  layout and the registration window, all organiser-gated.

## ⚠️ The failure this exists to prevent: silent drift

The key now lives in **two** places — Netlify's environment variable and this
blob. They can disagree, and the way they disagree is the dangerous one:
**rotate the key in Netlify and the saved link keeps looking fine while being
dead.** Jay emails it to twenty clubs and finds out when they cannot submit.

So the card does not merely store a string. `GET` compares the `k` in the
stored link against `process.env.CLUB_FORM_KEY` and reports:

| state | shown as |
|---|---|
| key matches | **Working** |
| key does not match | **This link no longer works — the key has been rotated** |
| `CLUB_FORM_KEY` unset | **The club form is switched off** |
| nothing saved | the empty box, no claim either way |

⚠️ **The comparison happens on the SERVER**, which is the only place that knows
the real key. A client-side check would need the key sent to the browser, which
is the thing being avoided.

⚠️ **"Working" means the key matches, not that the form accepted anything.** It
cannot see a deploy that has not run — an env-var change does not reach the
running functions until one, proven twice on 4 Aug. Worth saying in the UI in
one line rather than implying more than it knows.

## Decisions, with the arguments against

1. **Store the whole link, not just the key.** Storing the key alone and
   assembling the URL would be tidier and is worse: the thing Jay wants to copy
   is a link, and a builder is one more place for the path to drift from
   `netlify.toml`.
2. **No masking.** The point is to copy it, and the page is already
   organiser-only and already shows children's medical notes. Dots with a
   reveal button would be security theatre on a page that has none elsewhere.
3. **Validation on save is deliberately loose** — it must look like our
   `/register-club` path and carry a `k`. It does NOT refuse a wrong key,
   because refusing would make the endpoint an oracle for guessing keys and
   because a wrong key is a state the card is designed to *report*, not
   prevent.
   ⚠️ Accepted consequence: an organiser can save a link with a bad key and be
   told it is bad. That is the intended behaviour, not a gap.
4. **Clear is a separate action from Save**, so emptying the box by accident and
   pressing Save cannot wipe it silently.

## What this is NOT

- Not a way to change `CLUB_FORM_KEY`. Rotating the key stays a Netlify job
  followed by a deploy. The card reports drift; it cannot fix it.
- Not a public endpoint. Nothing here is reachable signed out.

## Verification

- Drive the handler signed out, as a manager, and as an organiser — the first
  two refused on **both** GET and POST, which is where the registration-window
  shape would have leaked it.
- Assert the response never contains the env var's value, with a distinctive
  key set, down every path including the error paths.
- Drive all four validity states, including `CLUB_FORM_KEY` unset.
- ⚠️ Assert the UI calls only functions the data layer exports — the sweep in
  `test-accounts.js` exists because two features once shipped calling data-layer
  functions that did not exist, and failed silently.
