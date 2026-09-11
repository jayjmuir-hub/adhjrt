# A club declaration is planning information only, reachable through a keyed link

**Ruling.** A club declares once how many teams it brings to each age group. The declaration creates no teams and no team codes; each team still registers its own squad. The organiser sees declared and registered counts side by side, and the difference is shown, never enforced. The form is not linked from the public page. It is served at an unlisted path and refused unless the request carries `CLUB_FORM_KEY`. That check runs after the allow-list and before validation, the window, numbering, storage or email. With the variable unset, the form is off.

**Why.** Pools and pitches need numbers weeks before teams register. A cap would turn away a genuine late team, and generated teams would put phantoms in the draw.

**Against, and why it lost.** A public button was removed because a club that declares can believe it has entered. The keyed link keeps the planning data without a public invitation. The repo is public, so an unlisted path hides nothing; only the key protects the form.

**Replaces.** The public "Register your club" button and modal.

**Where in the code.** `netlify/functions/_intake.js`, `Club.dc.html`, `netlify.toml`, `Organizer.dc.html`, `tests/test-intake.js`, `tests/test-organizer-clubs.js`.
