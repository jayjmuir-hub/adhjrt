// netlify/functions/_teams.js
//
// Generates the tournament team code for a registration, e.g. ADH1.
// Not an HTTP endpoint — required by submission-created.js.
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

  const existing = (rows || []).filter(
    (r) => norm(r[1]) === clubKey && norm(r[3]) === ageKey
  ).length;

  return `${prefix}${existing + 1}`;
}

module.exports = { clubPrefix, nextTeamCode, CLUB_PREFIXES };
