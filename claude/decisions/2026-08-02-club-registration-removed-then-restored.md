# Club-level registration was removed, then brought back behind a silent link

_Moved out of `RESTORE.md` on 7 Aug 2026. It is the record of a decision that
was made, reversed, and made again — history, not how the code behaves._


**Jay asked for the "Register your club" feature to be removed entirely**, and
it was — the button, the modal, the whole `club-registration` form. It had
shipped on 1 Aug (`1cdc521`), was live on `adhjrt.com`, and never worked,
because `GOOGLE_SHEET_ID_CLUBS` was never set.

Removed from all four files that referenced it: the button and modal in
`Quins JRT.dc.html`; `CLUB_COLUMNS`, `CLUB_OUT`, `CLUB_RANGE`, `clubRow`,
`mapClubRow`, `clubCountKey`, `MAX_TEAMS_PER_GROUP`, the `FORMS` entry, the
validation branch and the `handleSubmission` branch in `_intake.js`;
`clubEmail()` and its dispatch in `_email.js` (along with the `AGE_GROUPS`
import that then had no other caller); and the club assertions in
`test-intake.js`.

⚠️ **`club-registration` is now an UNKNOWN FORM, and that is the real guarantee.**
`cleanSubmission()` returns `null` for it, so the gateway refuses it before
anything else — there is no half-removed path where the button is gone but the
endpoint still accepts a POST. `test-intake.js` asserts exactly that, and
asserts `FORMS` holds exactly the two remaining forms, hardcoded, so a third
arriving unnoticed fails.

**What was deliberately NOT touched:** the `club` FIELD on the team and player
forms (a registration names its club — unrelated), and the Teams/Players
grouping-by-club in `/organizer`.

**Two inert leftovers outside the repo**, harmless and Jay's to clear whenever:
a Google Sheet called *Club Registrations*, and `GOOGLE_SHEET_ID_CLUBS` in
Netlify. Nothing reads either any more.

⚠️ **A related design exists and is PARKED, not pending** —
`claude/specs/spec-club-manager-page.md`, a Google-login club page on branch
`club-manager-page`. Jay decided against it the same day. Do not raise it and
do not treat this removal as a step towards it.

