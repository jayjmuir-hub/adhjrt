// netlify/functions/get-my-registrations.js
//
// Manager-scoped read of team & player registrations. A signed-in MANAGER
// gets back ONLY the registrations for their own age group. The group is
// taken from their login token, never from anything the browser sends — so
// a manager cannot request another group's children by editing the request.
//
// Organizers (and the special "*" admin-manager) get everything, exactly
// like get-registrations.js. This endpoint simply applies the same
// own-age-group rule the rest of the backend already uses.
//
// Reads the registrations store (Sep 2026; it read two Google Sheets before
// that — see RESTORE.md § Registration store).
const { resolveSession, sessionRefusal, blobStore } = require('./_auth');
/* ⚠️ NO mapClubRow HERE, ON PURPOSE. This endpoint answers teams and players
   only — `clubs` is always the empty array below — and importing the club
   mapper made it look, to anyone reading the imports, as though a manager
   could be served club declarations. Removed rather than left unused: the
   import WAS the misleading part. If clubs are ever wanted here that is a
   deliberate change to what a manager can see, not a one-word edit. */
const { mapTeamRow, mapPlayerRow } = require('./_intake');
const { STORE_NAME, listRecords, shapeForReaders } = require('./_regstore');

// Age-group id -> public name. This MUST mirror AGE_GROUPS in scores-data.js
// and AGE_GROUP_INFO in "Quins JRT.dc.html". The registration form submits
// the NAME (e.g. "U14B Contact"), and submission-created.js writes that name
// straight into the sheet's age-group column. A manager's token carries the
// ID (e.g. "u14b"), so we translate here. Keep in sync if a group is ever
// renamed or added.
const AGE_GROUP_NAME_BY_ID = {
  u6: 'U6 Tag', u7: 'U7 Tag', u8: 'U8 Tag',
  u9: 'U9 Mixed Contact', u10: 'U10 Mixed Contact', u11: 'U11 Mixed Contact',
  u12: 'U12 Mixed Contact', u12g: 'U12G QR', u13: 'U13 Mixed Contact',
  u14b: 'U14B Contact', u14g: 'U14G QR',
  u16b: 'U16B Contact', u16g: 'U16G Contact',
  u18b: 'U18B Contact', u18g: 'U18G Contact',
};

const norm = (s) => String(s || '').trim().toLowerCase();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const sess = await resolveSession(event);
    if (!sess.ok) return sessionRefusal(sess);
    const session = sess.session;

    // From the TOKEN only. Organizers and the "*" admin-manager see every
    // group; an ordinary manager sees exactly one, by age-group NAME.
    const seesEverything = session.role === 'organizer' || session.ageGroupId === '*';
    const allowedName = seesEverything ? null : AGE_GROUP_NAME_BY_ID[session.ageGroupId];
    if (!seesEverything && !allowedName) {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'No age group is set on this account.' }) };
    }

    const store = blobStore(STORE_NAME);
    const [teams, players] = await Promise.all([
      listRecords(store, 'team-registration'),
      listRecords(store, 'player-registration'),
    ]);
    const shaped = shapeForReaders({ teams, players, clubs: [] }, { mapTeamRow, mapPlayerRow });
    const keep = (row) => seesEverything || norm(row.ageGroup) === norm(allowedName);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, scope: allowedName || 'all', teams: shaped.teams.filter(keep), players: shaped.players.filter(keep) }),
    };
  } catch (err) {
    console.error('get-my-registrations error:', err && err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
