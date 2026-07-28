/* tests/test-organizer-grouping.js
   ------------------------------------------------------------------------
   Jay asked (28 Jul 2026): when all clubs are visible and a specific age
   group is selected, are the players/teams in that age group grouped by
   club? And symmetrically, when a specific club is selected across all age
   groups, are that club's entries grouped by age group?

   BEFORE THIS CHANGE, NEITHER: `_filteredTeams()`/`_filteredPlayers()` in
   Organizer.dc.html only filtered — the rows kept whatever order they
   arrived from the sheet in (submission order), so two entries from the
   same club would only land next to each other by coincidence.

   THE FIX IS ONE SORT, NOT TWO. Every row is sorted by club, then by age
   group's real youngest-to-oldest band (not alphabetically — "U12G QR"
   would otherwise sort after "U18B Contact"). When one age group is
   filtered, every visible row already shares it, so the club key is what
   actually orders them: clubs land grouped. When one club is filtered,
   every visible row already shares it, so the age-group key is what
   actually orders them: that club's age groups land grouped, in age order.
   Driven through the real component (`build()`), not by re-implementing the
   sort here, so a change to the real comparator is what these checks see.

   ⚠️ Every field value in this file is invented and obviously so. NEVER build
   a fixture from a real sheet row — this repo is public and those rows are
   children.
*/

const { readRepo, section, check, eq, summary } = require('./_lib');

/* Same minimal framework stand-in test-venue-map.js and
   test-registration-panel.js already use. */
class DCLogic {
  setState(patch, cb) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    if (typeof cb === 'function') cb();
  }
}

function build() {
  const t = readRepo('Organizer.dc.html');
  const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no x-dc script found in Organizer.dc.html');
  // eslint-disable-next-line no-new-func
  const C = new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
    DCLogic,
    { addEventListener() {} },
    { addEventListener() {}, body: { style: {} }, baseURI: 'https://adhjrt.com/', getElementById: () => null }
  );
  const c = new C();
  c.props = {};
  return c;
}

/* A team fixture. submittedAt values are hand-spread so "submission order"
   and "club-alphabetical order" disagree — a sort that accidentally left
   sheet order untouched, or that only partially sorted, would still pass a
   fixture set where the two orders happened to coincide. */
function team(club, ageGroup, teamName, submittedAt) {
  return { club, ageGroup, teamName, submittedAt, preferredPool: '', headCoachName: '', headCoachEmail: '', headCoachMobile: '', managerName: '', managerEmail: '', managerMobile: '', numPlayers: '1', notes: '' };
}
function player(club, ageGroup, playerName, submittedAt) {
  return { club, ageGroup, playerName, submittedAt, dob: '', parentName: '', parentEmail: '', parentMobile: '', emergencyContact: '', emergencyMobile: '', medicalNotes: '', consent: 'Yes', playUpConsent: 'No' };
}

async function main() {

section('One age group selected, all clubs visible — grouped by club');
{
  const c = build();
  c.state = {
    ...c.state,
    teams: [
      team('Zebra RFC', 'U12G QR', 'Z1', '2026-01-05'),
      /* A3 is listed BEFORE A1 here, on purpose, even though A1 was
         submitted earlier (2026-01-01 vs 2026-01-04). JS's Array.sort() is
         stable, so a comparator that gives up on the tie (returns 0) would
         still happen to leave A3 before A1 simply because that is the input
         order — indistinguishable from an explicit submittedAt tiebreak
         unless the input order and the submittedAt order actually disagree,
         as they do here. */
      team('Antelope RFC', 'U12G QR', 'A3', '2026-01-04'), // second Antelope entry in the SAME age group
      team('Antelope RFC', 'U14G QR', 'A2', '2026-01-02'), // different age group — must not appear once filtered
      team('Bison RFC', 'U12G QR', 'B1', '2026-01-03'),
      team('Antelope RFC', 'U12G QR', 'A1', '2026-01-01'),
    ],
    clubFilter: '', ageFilter: 'U12G QR',
  };
  const rows = c._filteredTeams();
  eq('only the filtered age group is shown', rows.length, 4);
  eq('clubs are grouped together, not left in submission order',
    rows.map((r) => r.club), ['Antelope RFC', 'Antelope RFC', 'Bison RFC', 'Zebra RFC']);
  eq('within the same club, submission order is preserved (A1 before A3)',
    rows.filter((r) => r.club === 'Antelope RFC').map((r) => r.teamName), ['A1', 'A3']);
}

section('One club selected, all age groups visible — grouped by age band, youngest first');
{
  const c = build();
  c.state = {
    ...c.state,
    teams: [
      team('Antelope RFC', 'U18B Contact', 'A-old', '2026-01-01'),
      team('Bison RFC', 'U8 Tag', 'B-young', '2026-01-02'), // different club — must not appear once filtered
      team('Antelope RFC', 'U8 Tag', 'A-young', '2026-01-03'),
      team('Antelope RFC', 'U12G QR', 'A-mid', '2026-01-04'),
    ],
    clubFilter: 'Antelope RFC', ageFilter: '',
  };
  const rows = c._filteredTeams();
  eq('only the filtered club is shown', rows.length, 3);
  eq('age groups are grouped in real youngest-to-oldest order, not alphabetically',
    rows.map((r) => r.ageGroup), ['U8 Tag', 'U12G QR', 'U18B Contact']);
  /* If this were a plain string sort, "U12G QR" (starts '1') would land
     before "U18B Contact" (also '1') by coincidence here, but "U8 Tag"
     starts '8' and would wrongly sort AFTER both — this is the case that
     would have caught a naive .sort() with no comparator. */
}

section('Neither filter active — still deterministic (club, then age band)');
{
  const c = build();
  c.state = {
    ...c.state,
    teams: [
      team('Bison RFC', 'U8 Tag', 'B1', '2026-01-01'),
      team('Antelope RFC', 'U18B Contact', 'A1', '2026-01-02'),
      team('Antelope RFC', 'U8 Tag', 'A2', '2026-01-03'),
    ],
    clubFilter: '', ageFilter: '',
  };
  const rows = c._filteredTeams();
  eq('sorted by club, then age band, with no filter active',
    rows.map((r) => `${r.club}/${r.ageGroup}`),
    ['Antelope RFC/U8 Tag', 'Antelope RFC/U18B Contact', 'Bison RFC/U8 Tag']);
}

section('Club name comparison is case-insensitive, matching the rest of the panel');
{
  /* 'apple co' (all lowercase, an early letter) vs 'Zebra RFC' (capitalised,
     a late letter) is the pair that actually discriminates a case-sensitive
     bug: alphabetically "apple" belongs before "Zebra" either way, so a pair
     like "zebra rfc"/"Antelope RFC" would pass under EITHER a correct
     case-insensitive sort or a naive ASCII sort, because 'A' (65) already
     sorts before 'z' (122) in raw code-point order too. Only when the
     lowercase name's first letter is EARLIER in the alphabet than the
     capitalised name's does a bug show: raw ASCII puts every capital letter
     (65-90) before every lowercase letter (97-122), so "Zebra RFC" would
     wrongly sort before "apple co" without case-insensitive comparison. */
  const c = build();
  c.state = {
    ...c.state,
    teams: [
      team('Zebra RFC', 'U8 Tag', 'Z', '2026-01-01'),
      team('apple co', 'U8 Tag', 'lowercase-a', '2026-01-02'),
    ],
    clubFilter: '', ageFilter: '',
  };
  const rows = c._filteredTeams();
  eq('a lowercase club name still sorts alphabetically, not after every capitalised one',
    rows.map((r) => r.teamName), ['lowercase-a', 'Z']);
}

section('The same sort applies to Players, not just Teams');
{
  const c = build();
  c.state = {
    ...c.state,
    players: [
      player('Zebra RFC', 'U12G QR', 'Zed Player', '2026-01-01'),
      player('Antelope RFC', 'U12G QR', 'Ant Player', '2026-01-02'),
    ],
    clubFilter: '', ageFilter: 'U12G QR',
  };
  const rows = c._filteredPlayers();
  eq('players are grouped by club within the filtered age group too',
    rows.map((r) => r.club), ['Antelope RFC', 'Zebra RFC']);
}

section('An unrecognised age-group name sorts last instead of throwing');
{
  const c = build();
  c.state = {
    ...c.state,
    teams: [
      team('Antelope RFC', 'Not A Real Group', 'Weird', '2026-01-01'),
      team('Antelope RFC', 'U8 Tag', 'Normal', '2026-01-02'),
    ],
    clubFilter: 'Antelope RFC', ageFilter: '',
  };
  let rows;
  check('sorting an unknown age-group name does not throw', (() => { try { rows = c._filteredTeams(); return true; } catch (e) { return false; } })());
  eq('the unrecognised group sorts after every real one', rows.map((r) => r.teamName), ['Normal', 'Weird']);
}

section('exportCsv() reads rows through the same sorted method, so the CSV is grouped too');
{
  const c = build();
  c.state = {
    ...c.state,
    tab: 'teams',
    teams: [
      team('Zebra RFC', 'U8 Tag', 'Z', '2026-01-01'),
      team('Antelope RFC', 'U8 Tag', 'A', '2026-01-02'),
    ],
    clubFilter: '', ageFilter: '',
  };
  /* exportCsv() drives a real download (Blob/URL/DOM) this harness doesn't
     stub — checking the source call is enough here without reimplementing a
     browser: the point under test is only that it calls the same sorted
     method, which the section above already proves is sorted correctly. */
  const src = readRepo('Organizer.dc.html');
  check('exportCsv() calls the same _filteredTeams()/_filteredPlayers() the tables use',
    /const rows = tab === 'teams' \? this\._filteredTeams\(\) : this\._filteredPlayers\(\);/.test(src));
}

summary('test-organizer-grouping.js');

}

main();
