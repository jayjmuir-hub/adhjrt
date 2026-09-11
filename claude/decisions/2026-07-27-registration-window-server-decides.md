# One registration window, in Abu Dhabi time, gates the public forms: the browser decides what to show and the server decides what to accept

**Ruling.** One setting controls registration: `opensAt`, `closesAt`, and a mode — `auto`, `open` or `closed` — edited in the back office, no deploy. Dates carry `+04:00`. Missing, unparseable or impossible dates and failed fetches resolve to closed. `open` applies the mode first and the dates second. A forced-open form shows a TEST MODE strip. Server and client share one byte-identical block — state, validator, warnings, wording — re-exported by the back office. The gateway refuses a team or player submission outside the window. The declaration form is exempt at both ends: it collects planning numbers before registration opens, and its secret link key, checked earlier in the gateway, is the stronger gate.

**Why.** The dates will move, and moving them must not cost a deploy. Anyone can change their own clock, so only the server counts.

**Against, and why it lost.** A date plus an on/off switch is simpler, but the two can disagree. Gating the declaration form too is more uniform, but left it unusable until its numbers stopped mattering. Extending that exemption to the public forms would open registration early; a fault test guards against it.

**Replaces.** The hardcoded `registrationOpen` prop.

**Where in the code.** `netlify/functions/_registration.js`, `netlify/functions/_intake.js`, `scores-data.js`, `organizer-data.js`, `netlify/functions/registration-window.js`, `tests/test-registration.js`, `tests/test-registration-panel.js`.
