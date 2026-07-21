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

const TOURNAMENT_DAYS_UTC = {
  // 7 Nov 2026 00:00 +04:00  ->  6 Nov 2026 20:00 UTC
  start: Date.UTC(2026, 10, 6, 20, 0, 0),
  // 9 Nov 2026 00:00 +04:00  ->  8 Nov 2026 20:00 UTC (end of the 8th)
  end: Date.UTC(2026, 10, 8, 20, 0, 0),
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
      return 'Managers can publish fixtures on the tournament days only (7–8 November 2026). Ask a tournament organiser to publish before then.';
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
