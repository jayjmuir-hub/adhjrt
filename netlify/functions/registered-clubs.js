// netlify/functions/registered-clubs.js
//
// The club list for the PUBLIC sign-up dropdown (JRT-7).
//
// GET (public)
//   -> { ok:true, clubs:[...official names...], now }     normal
//   -> { ok:true, clubs:[], unavailable:true, now }       a store read failed
//
//   Public on purpose, like registration-window.js: the sign-up page needs the
//   list before anyone has signed in, and it carries NO personal data — only the
//   official names of clubs that have BOTH registered AND been named by an
//   organiser. Everything else — unnamed clubs, rehearsals, superseded records,
//   and every contact field, team count and note — is excluded on the server.
//
//   ⚠️ THIS IS THE HIDDEN-UNTIL-NAMED GATE, and it lives HERE, in the join, not
//   in the browser: a caller that skips the page still cannot see an unnamed
//   club. See publicClubNames() in _regstore.js.
//
//   ⚠️ NEVER reuse get-registrations.js for this. That endpoint is organiser-
//   gated and returns clubs ALONGSIDE contact details; the whole reason this is
//   a separate public endpoint is that it reads and returns names only.

const { blobStore } = require('./_auth');
const { STORE_NAME, listRecords, publicClubNames } = require('./_regstore');

const CONFIG_STORE = 'config';
const NAMES_KEY = 'club-names';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed.' });

    /* Both reads fail SOFT and TOGETHER: if either the registrations or the
       official-name map cannot be read, the page keeps its own bundled list, so
       a store blip never empties the dropdown and blocks sign-ups. `unavailable`
       makes the fact visible; the declared names are never returned in its place. */
    let records;
    let names;
    try {
      records = await listRecords(blobStore(STORE_NAME), 'club-registration');
      const rec = await blobStore(CONFIG_STORE).get(NAMES_KEY, { type: 'json' });
      names = (rec && typeof rec === 'object' && rec.names && typeof rec.names === 'object') ? rec.names : {};
    } catch (err) {
      console.error('registered-clubs: store read failed —', err && err.message);
      return json(200, { ok: true, clubs: [], unavailable: true, now: Date.now() });
    }

    return json(200, { ok: true, clubs: publicClubNames(records, names), now: Date.now() });
  } catch (err) {
    console.error('registered-clubs: unexpected —', err && err.message);
    return json(500, { ok: false, error: 'Server error.' });
  }
};
