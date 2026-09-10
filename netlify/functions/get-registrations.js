// netlify/functions/get-registrations.js
//
// Returns every team, player and club registration for a signed-in
// ORGANIZER. Reads the registrations store (Sep 2026; it read three Google
// Sheets before that — see RESTORE.md § Registration store). The token is
// verified here (_auth.js), so the store is never exposed.
const { resolveSession, sessionRefusal, blobStore } = require('./_auth');
const { mapTeamRow, mapPlayerRow, mapClubRow } = require('./_intake');
const { STORE_NAME, listRecords, shapeForReaders } = require('./_regstore');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const sess = await resolveSession(event);
    if (!sess.ok) return sessionRefusal(sess);
    if (sess.session.role !== 'organizer') {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Only tournament organisers can see every age group’s registrations.' }) };
    }

    const store = blobStore(STORE_NAME);

    /* Clubs FAIL SOFT, as they always have: a declaration is a planning
       nicety; teams and players are the tournament. null = could not read,
       told apart from "nobody has declared yet" by clubsUnavailable. */
    const readClubs = async () => {
      try { return await listRecords(store, 'club-registration'); } catch (err) {
        console.error('get-registrations: clubs unreadable -', err && err.message);
        return null;
      }
    };

    const [teams, players, clubs] = await Promise.all([
      listRecords(store, 'team-registration'),
      listRecords(store, 'player-registration'),
      readClubs(),
    ]);

    const shaped = shapeForReaders({ teams, players, clubs: clubs || [] }, { mapTeamRow, mapPlayerRow, mapClubRow });
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        ...shaped,
        /* ⚠️ Told apart from "no club has declared yet". An empty list and a
           broken store look identical on screen, and the Clubs tab would
           cheerfully report "0 declared" for a tournament where twenty clubs
           had declared — the loading-vs-empty trap the dataError banner
           exists for, one level down. */
        clubsUnavailable: clubs === null,
      }),
    };
  } catch (err) {
    console.error('get-registrations error:', err && err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
