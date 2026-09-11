# A club may request pool A, B or C on the registration form, but a draw may still have a pool D

**Ruling.** The team registration form offers pools A, B and C; the gateway refuses any other value by checking it against `POOL_OPTIONS` in `_intake.js`. The homepage form carries a second copy of the list, and `test-intake.js` fails if the two drift. There is no No preference option. If requiring a pool proves wrong, make the field optional; never restore No preference. The list governs only what a club may ask for. An organiser can still create and fill pool D in the draw editor, which the four-pool Cup, Bowl, Plate and Shield bracket needs, so neither the draw editor nor `prefOf()` is narrowed to match.

**Why.** A dropdown alone restricts nothing, since anyone editing the page can send any string; the server check makes the list real. An empty optional field says what No preference said, without a special value every reader must handle.

**Against, and why it lost.** Offering D on the form would match the draw editor exactly. It lost because a club's request is only a preference and the organiser seats the pools. The mismatch is intended; this card exists so it is not tidied away.

**Where in the code.** `netlify/functions/_intake.js` (`POOL_OPTIONS`), `Quins JRT.dc.html`, `Manager.dc.html` (`prefOf`), `tests/test-intake.js`.
