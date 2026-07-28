// netlify/functions/_teams.js
//
// Generates the tournament team code for a registration, e.g. ADH1.
// Not an HTTP endpoint — required by _intake.js, which the submission
// gateway calls. (It was submission-created.js until 28 Jul 2026.)
//
// The code is <club prefix><number>, where the number counts that club's
// teams WITHIN AN AGE GROUP. So a club entering two U16B sides gets ADH1 and
// ADH2, while their U14B side is also ADH1 — the number only has to separate
// teams that could meet each other.

/* Known clubs get a fixed prefix so it can never drift, even if someone types
   "Abu Dhabi Harlequins RFC" or changes the spacing. Every entry here also
   happens to match the fallback rule below; the map exists to guarantee
   stability, not to express exceptions. */
const CLUB_PREFIXES = {
  'abu dhabi harlequins': 'ADH',
  'dubai exiles': 'DE',
  'dubai tigers': 'DT',
  'dubai sharks': 'DS',
  'dubai warriors': 'DW',
  'dubai hurricanes': 'DH',
  barrelhouse: 'BAR',
};

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/\b(rfc|rugby|football|club|fc)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/* Fallback for clubs not in the map: initials for a multi-word name, or the
   first three letters of a single-word one. Matches how the known clubs were
   derived, so a new club gets a code in the same style automatically. */
function clubPrefix(club) {
  const key = norm(club);
  if (!key) return 'TBC';
  if (CLUB_PREFIXES[key]) return CLUB_PREFIXES[key];

  const words = key.split(' ').filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join('').toUpperCase();
}

/* rows: the existing team sheet rows (arrays, header already stripped).
   Column 1 is Club and column 3 is Age Group — see submission-created.js. */
function nextTeamCode(club, ageGroup, rows) {
  const prefix = clubPrefix(club);
  const clubKey = norm(club);
  const ageKey = norm(ageGroup);

  /* Go one past the HIGHEST number already issued to this club in this age
     group, rather than counting how many rows it has.

     Counting breaks the moment a row is removed. Take a group holding ADH1,
     ADH2 and ADH3: withdraw ADH2 and delete the row, the count drops to 2, and
     the next Harlequins entry is issued ADH3 - which already exists. The team
     code is the team's identity in the draw, the standings, the knockout and
     every match id, so a duplicate silently puts one team in two pools with a
     full set of fixtures in each.

     Reading the number back out of the existing codes also means a code an
     organiser corrected by hand in the sheet is respected, instead of being
     recounted from scratch. */
  const numbers = (rows || [])
    .filter((r) => norm(r[1]) === clubKey && norm(r[3]) === ageKey)
    .map((r) => {
      const m = String(r[2] || '').trim().match(/^([A-Za-z]+)(\d+)$/);
      if (!m || m[1].toUpperCase() !== prefix) return 0;
      return parseInt(m[2], 10) || 0;
    });

  const highest = numbers.length ? Math.max(...numbers) : 0;
  return `${prefix}${highest + 1}`;
}

module.exports = { clubPrefix, nextTeamCode, CLUB_PREFIXES };
