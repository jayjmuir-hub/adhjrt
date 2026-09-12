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
//   Managers            no longer publish at all. Until 8 Sep 2026 a manager
//                       could publish their own group on the two tournament
//                       days; that was removed (spec-draw-rights § 2 — see the
//                       tombstone in publishDenialReason below). Publishing is
//                       the one act that changes what a parent sees, so it is an
//                       organiser's; a manager edits the draft and sends it for
//                       review instead.

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

  /* ⚠️ TOMBSTONE (8 Sep 2026, spec-draw-rights § 2). Until this date a
     manager could publish their own group on the two tournament days:

       if (!isTournamentWindow(now)) return `Managers can publish fixtures on
         the tournament days only (…). Ask a tournament organiser…`;
       return null;

     It existed so that match-day scoring would not sit behind an unpublished
     draw, and that problem was solved on 8 Aug 2026 by letting managers see
     and score an unpublished draw (spec-draft-visibility). What was left was
     the wrong way round: managers blocked in the weeks when a mistake is
     cheap, allowed on the two days when it is most expensive, without being
     able to see the other fourteen groups' pitches. Publishing is the one
     act that changes what a parent sees; it is an organiser's. Managers send
     a draft for review instead (§ 5). `now` stays a parameter and
     isTournamentWindow() stays exported because _drawRights.js uses it. */
  if (session.role === 'manager') {
    return 'Only tournament organisers can publish fixtures. Send your draft for review instead.';
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
