// netlify/functions/_drawRights.js
//
// Who may change a draw, and when. Not an HTTP endpoint — required by
// save-schedule-override.js and get-schedule-override.js.
// Spec: claude/specs/spec-draw-rights-sep-2026.md
//
// THE MODEL, IN PLAIN TERMS. Managers default to RESULTS ONLY. Two switches on
// a manager's account, set by an organiser on the Accounts tab, unlock the
// draw editor in two halves:
//
//   drawPools   which teams are in which pool, adding/removing teams, the
//               knockout bracket's team placement — local to one age group.
//   drawTimes   kickoff times and pitches on every slot, and "Regenerate" —
//               the CROSS-GROUP fields, because a pitch is shared across the
//               day and only the organiser's clash check can see all fifteen.
//
// Organisers have both, always. The '*' admin-manager has both when either is
// set. Absent means false, so on the day this ships every existing manager is
// results-only until an organiser flips a switch.
//
// THE FREEZE. From 00:00 Gulf time on a group's own tournament day until the
// tournament ends, a manager cannot save that group's draw at all; the desk
// can. Editing pools on match day used to mint new match ids and orphan the
// results already entered. That was fixed on 11 Sep 2026 (JRT-6): see
// strandedResults below and claude/decisions/2026-09-11-draw-edits-keep-results.md.
// (This line used to cite "RESTORE.md § Draft visibility", a section that never
// existed.) The freeze stays because a manager also cannot see
// the other fourteen groups' pitches. Midnight rather than first kickoff:
// one comparison against DEFAULT_VENUE, the same source as the countdown, and
// a draft with no slots has no kickoff to compare against.
//
// ⚠️ THE COMPARISON IS AGAINST THE STORED DRAFT, NEVER AGAINST ANYTHING THE
// CLIENT SAYS THE OLD VALUE WAS. A client that wanted to cheat would simply
// say the old value was whatever it is sending. If there is no stored draft
// yet, a partial-rights manager is refused: an organiser saves once first
// (decision 2 in the spec).

const { DEFAULT_VENUE, loadVenue, dayIdOf } = require('./_venue');
const { isTournamentWindow } = require('./_publish');
const { blobStore } = require('./_auth');

const GST = '+04:00';
const startOfDayUTC = (isoDate) => Date.parse(`${isoDate}T00:00:00${GST}`);

/* { pools, times } for a resolved session. resolveSession() overlays the
   account's stored flags onto a manager session on every request, so this
   never reads the token payload's word for it. */
function rightsFor(session) {
  if (!session) return { pools: false, times: false };
  if (session.role === 'organizer') return { pools: true, times: true };
  if (session.role !== 'manager') return { pools: false, times: false };
  const pools = session.drawPools === true;
  const times = session.drawTimes === true;
  if (session.ageGroupId === '*' && (pools || times)) return { pools: true, times: true };
  return { pools, times };
}

/* The freeze, for managers only. Returns a sentence or null. `venue` is the
   merged layout (which group plays which day is a back-office setting in the
   blob; the DATES are code). Exposed for tests with `now` injectable. */
function freezeReason(session, ageGroupId, now = Date.now(), venue = DEFAULT_VENUE) {
  if (!session || session.role !== 'manager') return null;
  const dayId = dayIdOf(venue, ageGroupId);
  if (!dayId) return null;
  const dayStart = startOfDayUTC(DEFAULT_VENUE[dayId].date);
  if (now >= dayStart && isTournamentWindow(now)) {
    return 'The draw is locked on match day. Ask the organiser desk to make changes.';
  }
  return null;
}

const NO_RIGHTS = 'Your organisers manage this group’s draw. Ask them if something is wrong.';
const POOLS_ONLY = 'You can change pools and teams, but kickoff times and pitches are set by the organisers.';
const TIMES_ONLY = 'You can change kickoff times and pitches, but pools and teams are set by the organisers.';
const FIRST_DRAFT = 'Ask a tournament organiser to save this group’s draw once, then you can edit it.';

const slotsById = (schedule) => {
  const out = new Map();
  for (const sl of (schedule && Array.isArray(schedule.slots) ? schedule.slots : [])) if (sl && sl.id) out.set(String(sl.id), sl);
  for (const sl of (schedule && Array.isArray(schedule.knockout) ? schedule.knockout : [])) if (sl && sl.id) out.set('ko:' + String(sl.id), sl);
  return out;
};
const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

/* True if any slot's kickoff or pitch differs from the stored draft, or a slot
   was added or removed (a new slot IS a new time and pitch). */
function timesChanged(stored, incoming) {
  const a = slotsById(stored), b = slotsById(incoming);
  if (a.size !== b.size) return true;
  for (const [id, sl] of b) {
    const was = a.get(id);
    if (!was) return true;
    if (!same(was.startMins, sl.startMins) || !same(was.pitch || '', sl.pitch || '')) return true;
  }
  return false;
}

/* True if pools (ids, names, team lists) or any slot's pairing differs. */
function poolsChanged(stored, incoming) {
  const norm = (s) => (s && Array.isArray(s.pools) ? s.pools : []).map((p) => ({ id: p.id, name: p.name, teams: Array.isArray(p.teams) ? p.teams : [] }));
  if (!same(norm(stored), norm(incoming))) return true;
  const a = slotsById(stored), b = slotsById(incoming);
  if (a.size !== b.size) return true;
  for (const [id, sl] of b) {
    const was = a.get(id);
    if (!was) return true;
    if (!same(was.home || '', sl.home || '') || !same(was.away || '', sl.away || '') || !same(was.poolId, sl.poolId)) return true;
  }
  return false;
}

/* strandedResults(stored, incoming, recorded) -> the stored slots that have a
   recorded result and would not survive `incoming` (JRT-6 and JRT-26,
   11 Sep 2026).

   Results are stored under the match id and carry NO team codes, so a scored
   slot survives only if `incoming` still has a slot with the SAME id, and
   keeps every team the stored slot already named. Its time and pitch may
   change. A side that was blank in the stored slot (a knockout placeholder
   waiting for standings) may be filled in. Pool slots and saved knockout
   slots are both checked.
     - `incoming` null means the draft is being cleared (reset).
     - A knockout list missing from `incoming` drops the saved one, so a
       scored saved knockout slot counts as stranded.
     - `recorded` is readGroup()'s map; cleared results are already absent.
   It applies to organisers too: this is data loss, not permission. The
   deliberate route is to clear the score first (result history keeps it). */
function strandedResults(stored, incoming, recorded) {
  const has = (id) => !!recorded && Object.prototype.hasOwnProperty.call(recorded, String(id));
  const index = (list) => {
    const m = new Map();
    for (const sl of Array.isArray(list) ? list : []) if (sl && sl.id != null) m.set(String(sl.id), sl);
    return m;
  };
  const out = [];
  const sweep = (was, nowList, kind) => {
    const now = index(nowList);
    for (const sl of Array.isArray(was) ? was : []) {
      if (!sl || sl.id == null || !has(sl.id)) continue;
      const keep = now.get(String(sl.id));
      const moved = !keep
        || (sl.home && (keep.home || '') !== sl.home)
        || (sl.away && (keep.away || '') !== sl.away);
      if (moved) out.push({ id: String(sl.id), kind, home: sl.home || '', away: sl.away || '', startMins: sl.startMins });
    }
  };
  sweep(stored && stored.slots, incoming && incoming.slots, 'pool');
  sweep(stored && stored.knockout, incoming && incoming.knockout, 'knockout');
  return out;
}

const hhmm = (m) => (Number.isFinite(m) ? `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` : '');

/* The sentence the Draw tab shows. Names up to five matches by team code and
   kickoff so the desk knows which scores to clear. */
function strandedMessage(list) {
  const named = list.slice(0, 5)
    .map((s) => `${s.home || 'TBD'} v ${s.away || 'TBD'}${hhmm(s.startMins) ? ' at ' + hhmm(s.startMins) : ''}`)
    .join('; ');
  const more = list.length > 5 ? ` and ${list.length - 5} more` : '';
  const what = list.length === 1 ? 'a match that already has a score' : `${list.length} matches that already have scores`;
  return `Nothing was saved: this would remove or change ${what} (${named}${more}). If that is really intended, clear those scores first, then save again.`;
}

/* saveDenialReason(session, ageGroupId, { stored, incoming, reset, now, venue })
   -> null when the save may proceed, else the sentence to show. Organisers
   are never refused here (hasAgeGroupAccess is the caller's job). */
function saveDenialReason(session, ageGroupId, opts = {}) {
  if (!session) return 'Not signed in.';
  if (session.role === 'organizer') return null;
  const frozen = freezeReason(session, ageGroupId, opts.now, opts.venue);
  if (frozen) return frozen;
  const r = rightsFor(session);
  if (!r.pools && !r.times) return NO_RIGHTS;
  if (r.pools && r.times) return null;
  /* Partial rights from here. */
  if (opts.reset) return r.pools ? POOLS_ONLY : TIMES_ONLY;
  if (!opts.stored) return FIRST_DRAFT;
  if (!r.times && timesChanged(opts.stored, opts.incoming)) return POOLS_ONLY;
  if (!r.pools && poolsChanged(opts.stored, opts.incoming)) return TIMES_ONLY;
  return null;
}

/* What the Draw tab shows a signed-in caller, computed here so the page never
   derives a right for itself. */
async function rightsView(session, ageGroupId, now = Date.now()) {
  const r = rightsFor(session);
  let frozen = null;
  try {
    /* ⚠️ loadVenue takes the store FACTORY — it is how every reader of the
       layout finds the saved groups-per-day. Called bare it throws, the catch
       below falls back to the code's layout, and a group an organiser has
       MOVED to the other day would be frozen on the wrong one. */
    frozen = freezeReason(session, ageGroupId, now, await loadVenue(blobStore));
  } catch (e) {
    frozen = freezeReason(session, ageGroupId, now, DEFAULT_VENUE);
  }
  return { pools: r.pools, times: r.times, frozen: !!frozen, frozenNote: frozen || '' };
}

module.exports = { rightsFor, freezeReason, saveDenialReason, rightsView, timesChanged, poolsChanged, strandedResults, strandedMessage, NO_RIGHTS, POOLS_ONLY, TIMES_ONLY, FIRST_DRAFT };
