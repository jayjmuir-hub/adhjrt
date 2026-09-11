# The registration page keeps a refusal and a network failure apart

**Ruling.** `postRegistration()` throws a `SubmitError` with `isNetwork` set when the fetch fails or the reply cannot be parsed. It throws one without `isNetwork`, carrying the server's own sentence, when the status is not OK or the body says `ok: false`, even inside a 200. Only an explicit `ok: true` counts as success.

**Why.** A refusal means the entry arrived and is wrong, so the coach should fix it; telling them to try again would repeat the refusal for good. A network failure means nobody knows whether it arrived, so the coach should try again. An unparseable body means something other than the function answered, such as a proxy or a password page. The old lenient version told clubs their entry was received when the network had dropped, and would have said the same if every submission returned 404.

**Against, and why it lost.** Leniency made sense when nothing downstream could tell success from failure. The gateway now answers with an explicit `ok` and a sentence written for a coach, and leniency would throw that away.

**Where in the code.** `Quins JRT.dc.html` (`postRegistration`, `SubmitError`), `tests/test-registration-panel.js`.
