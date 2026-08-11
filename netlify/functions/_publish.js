// netlify/functions/_publish.js
//
// Draft/published handling for age-group fixtures. Not an HTTP endpoint —
// required by the schedule functions.
//
// WHY THIS EXISTS
// Before this, saving a draw published it instantly: one manager nudging a
// team in the fixture editor changed what every parent saw. Now there are two
// copies of each age group's draw in the "schedules" blob store:
//
//   <ageGroupId>       the DRAFT — what managers and organisers edit
//   pub:<ageGroupId>   the PUBLISHED copy — the only thing the public reads
//
// An age group with no published copy falls back to the auto-generated draw,
// exactly as an untouched age group always did. So nothing a manager types is
// public until somebody deliberately publishes it.
//
// WHO CAN PUBLISH
//   Organisers          any age group, any time.
//   Managers            their own age group, but ONLY on the tournament days.
//                       The idea is that fixtures are released centrally
//                       beforehand, and once the weekend starts the people at
//                       the pitch can push changes out themselves without
//                       chasing an organiser.
//
// Times are Gulf Standard Time (UTC+4, no daylight saving), so the window is
// simply the two tournament dates in local terms.

const { DEFAULT_VENUE } = require('./_venue');

/* ⚠️ DERIVED FROM THE VENUE, NOT WRITTEN OUT AGAIN. This was two hand-computed
   UTC timestamps with the arithmetic explained in a comment:

     start: Date.UTC(2026, 10, 6, 20, 0, 0),   // 7 Nov 00:00 +04:00
     end:   Date.UTC(2026, 10, 8, 20, 0, 0),   // end of the 8th

   which is a SECOND copy of when the tournament is, in a different unit, three
   directories away from the first. Moving the tournament from 7–8 to 14–15
   November (11 Aug 2026) meant every visible date could be updated correctly
   and this window left behind — and nothing a parent or an organiser looks at
   would show it. The failure surfaces on the morning of day one, when a manager
   at a pitch is told they may only publish on the tournament days, on the
   tournament day. There is no back office switch for it either.

   So it is computed from the same DEFAULT_VENUE the rest of the site reads.
   Gulf Standard Time is UTC+4 with no daylight saving, so a calendar date maps
   to a fixed instant and the window is simply [start of day one, end of day
   two). The end is day two's midnight plus 24h rather than day two's date + 1,
   so a tournament whose two days are not adjacent still closes on day two. */
const GST = '+04:00';
const startOfDayUTC = (isoDate) => Date.parse(`${isoDate}T00:00:00${GST}`);
const DAY_MS = 24 * 60 * 60 * 1000;

const TOURNAMENT_DAYS_UTC = {
  start: startOfDayUTC(DEFAULT_VENUE.day1.date),
  end: startOfDayUTC(DEFAULT_VENUE.day2.date) + DAY_MS,
};

const draftKey = (ageGroupId) => ageGroupId;
const publishedKey = (ageGroupId) => `pub:${ageGroupId}`;

function isTournamentWindow(now = Date.now()) {
  return now >= TOURNAMENT_DAYS_UTC.start && now < TOURNAMENT_DAYS_UTC.end;
}

/* True only in the run-up. Used to decide whether an unpublished age group
   shows "coming soon" or falls back to the auto-generated draw — deliberately
   "before the start" rather than "outside the window", so the fallback stays
   in place once the tournament has begun and afterwards, instead of an
   already-played age group reverting to a coming-soon message. */
function isBeforeTournament(now = Date.now()) {
  return now < TOURNAMENT_DAYS_UTC.start;
}

/* Returns null if allowed, or a human-readable reason if not. Callers turn a
   reason into a 403 — the wording is shown to the person, so it explains the
   rule rather than just refusing. */
function publishDenialReason(session, ageGroupId, now = Date.now()) {
  if (!session) return 'Not signed in.';

  if (session.role === 'organizer') return null;

  if (session.role === 'manager') {
    const ownGroup = session.ageGroupId === '*' || session.ageGroupId === ageGroupId;
    if (!ownGroup) return 'You can only publish fixtures for your own age group.';
    if (!isTournamentWindow(now)) {
      /* Names the days rather than spelling them out a third time — the wording
         follows the layout, so it cannot tell a manager the wrong date. */
      return `Managers can publish fixtures on the tournament days only (${DEFAULT_VENUE.day1.label} and ${DEFAULT_VENUE.day2.label} 2026). Ask a tournament organiser to publish before then.`;
    }
    return null;
  }

  return 'You do not have permission to publish fixtures.';
}

module.exports = {
  draftKey,
  publishedKey,
  isTournamentWindow,
  isBeforeTournament,
  publishDenialReason,
  TOURNAMENT_DAYS_UTC,
};
