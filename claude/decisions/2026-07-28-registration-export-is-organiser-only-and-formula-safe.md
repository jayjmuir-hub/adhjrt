# Exporting registrations is organiser-only, carries exactly what the organiser page shows, and never lets a registrant's text become a formula

**Ruling.** The Export CSV button on the organiser page builds the file in the browser from rows the page already holds, filtered as displayed, calling no new endpoint. Registrations reach that page only through `get-registrations.js`, which refuses every role but organiser. Any future server-side export falls under the same rule: organiser-only, nothing beyond what the organiser page shows, never widening access. Every cell starting with `=`, `+`, `-` or `@` gets a leading apostrophe, in `csvSafe` on the organiser page and in `csvCell` in `_snapshot.js`, so a registrant's text opens as text in Excel or Sheets, never as a live formula. This replaces the Sheets-era RAW write mode.

**Why.** The forms are public input, and a formula cell runs when an organiser opens the file. The export holds children's details, so it must never be a wider door than the page it came from.

**Against, and why it lost.** An apostrophe changes the data: a phone number with a leading plus carries a hidden character, and a negative number becomes text. Accepted, since phone numbers are wanted as text and no registration field holds a signed number.

**Where in the code.** `Organizer.dc.html` (`csvSafe`, `exportCsv`), `netlify/functions/_snapshot.js` (`csvCell`), `netlify/functions/get-registrations.js`.
