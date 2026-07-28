/* tests/test-intake.js
   ------------------------------------------------------------------------
   The sheet columns: what order a registration is written in, and how it is
   read back.

   WHY THIS FILE EXISTS. Until 28 July 2026 that order was hardcoded THREE
   times, in three files, kept in step by hand:

     netlify/functions/submission-created.js   the writer, a positional array
     netlify/functions/get-registrations.js    TEAM_FIELDS + a positional
                                               destructure in mapPlayerRow
     netlify/functions/get-my-registrations.js the same, duplicated verbatim

   Sub-project 2 adds a column. Doing that against three hand-synced copies is
   how a reader ends up one column out and shows a parent's phone number in the
   emergency-contact box of a sheet full of children's data — and it would look
   right in review, because each file is individually consistent.

   THE ASSERTION THAT MATTERS is the round trip: write a registration with the
   writer, read it back with the reader, get the same thing. That is impossible
   to state at all while the two live in different files, which is the real
   argument for this refactor.

   NOTHING HERE CHANGES BEHAVIOUR. The column order and the shape both readers
   return are pinned below exactly as they already were, because both live
   sheets have rows in them and /organizer already reads those shapes.

   ⚠️ Every field value in this file is invented and obviously so. NEVER build a
   fixture from a real sheet row — this repo is public and those rows are
   children.
*/

const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

const I = require(path.join(repoRoot(), 'netlify', 'functions', '_intake.js'));

/* ====================================================================== */
section('The column order, pinned');

/* THIS IS THE ORDER THE LIVE SHEETS ALREADY HAVE. Both have a header row and
   rows under it, so this is not a preference: changing it shifts every future
   row against everything already there and against the header. Read off
   submission-created.js on 28 Jul 2026, before any of it moved. */
eq('team columns', I.TEAM_COLUMNS, [
  'submittedAt', 'club', 'team-code', 'age-group',
  'head-coach-name', 'head-coach-email', 'head-coach-phone',
  'manager-name', 'manager-email', 'manager-phone',
  'num-players', 'notes', 'players', 'preferred-pool',
]);
eq('fourteen of them', I.TEAM_COLUMNS.length, 14);
eq('…which is what A:N means', I.TEAM_RANGE, 'A:N');

eq('player columns', I.PLAYER_COLUMNS, [
  'submittedAt', 'player-first-name', 'player-last-name', 'dob',
  'club', 'age-group',
  'parent-first-name', 'parent-last-name', 'parent-email', 'parent-phone',
  'emergency-first-name', 'emergency-last-name', 'emergency-phone',
  'medical-notes', 'consent', 'play-up-consent',
]);
eq('sixteen of them', I.PLAYER_COLUMNS.length, 16);
eq('…which is what A:P means', I.PLAYER_RANGE, 'A:P');

/* The range and the column count have to agree or the append writes past the
   end of the range and Google silently drops the overflow. Derived here rather
   than eyeballed, so adding a column and forgetting the range is caught. */
const widthOf = (range) => range.charCodeAt(2) - 'A'.charCodeAt(0) + 1;
eq('the team range is exactly as wide as the team columns', widthOf(I.TEAM_RANGE), I.TEAM_COLUMNS.length);
eq('the player range is exactly as wide as the player columns', widthOf(I.PLAYER_RANGE), I.PLAYER_COLUMNS.length);

/* The dashboard's field names, in the same order, so mapTeamRow is a zip
   rather than fourteen positional guesses. */
eq('the team output names', I.TEAM_OUT, [
  'submittedAt', 'club', 'teamName', 'ageGroup',
  'headCoachName', 'headCoachEmail', 'headCoachMobile',
  'managerName', 'managerEmail', 'managerMobile',
  'numPlayers', 'notes', 'players', 'preferredPool',
]);
eq('one output name per column', I.TEAM_OUT.length, I.TEAM_COLUMNS.length);

/* ====================================================================== */
section('Writing a row');

{
  const stamp = '2026-08-01T09:00:00.000Z';
  const row = I.teamRow({
    club: 'Test Club', 'age-group': 'U16B Contact', 'preferred-pool': 'No preference',
    'head-coach-name': 'A Coach', 'head-coach-email': 'coach@example.com',
    'head-coach-phone': '+971500000000', 'num-players': '15',
  }, 'TST1', stamp);

  eq('one row, fourteen cells', row.length, 14);
  eq('the timestamp leads', row[0], stamp);
  eq('the team code is column 3', row[2], 'TST1');
  /* preferred-pool is LAST, not next to age group where it reads as if it
     belongs. It was added after the sheet already had rows in it. */
  eq('preferred pool is last', row[13], 'No preference');
  eq('a field nobody filled in is an empty string', row[11], '');
  check('every cell is a string', row.every((c) => typeof c === 'string'));

  /* The phone number keeps its + and is stored as text. USER_ENTERED would
     evaluate a leading + as a formula and silently eat the country code —
     that bug has already been fixed once, in submission-created.js. */
  eq('the country code survives', row[6], '+971500000000');
}

{
  const stamp = '2026-08-01T09:00:00.000Z';
  const row = I.playerRow({
    'player-first-name': 'Test', 'player-last-name': 'Player', dob: '2011-01-01',
    club: 'Test Club', 'age-group': 'U16B Contact',
    'parent-email': 'parent@example.com', consent: 'Yes', 'play-up-consent': 'No',
  }, stamp);
  eq('one row, sixteen cells', row.length, 16);
  eq('dob is column 4', row[3], '2011-01-01');
  eq('consent is second from last', row[14], 'Yes');
  eq('play-up consent is last', row[15], 'No');
  check('every cell is a string', row.every((c) => typeof c === 'string'));
}

/* Whatever is handed over is stored EXACTLY, because the append uses RAW. So a
   number or a null must be turned into text here rather than reaching Sheets
   as a number or a blank of a different kind. */
eq('a number becomes text', I.playerRow({ dob: 20110101 }, 'x')[3], '20110101');
eq('null becomes an empty string', I.playerRow({ dob: null }, 'x')[3], '');
eq('undefined becomes an empty string', I.playerRow({}, 'x')[3], '');
eq('false becomes text, not a blank', I.playerRow({ consent: false }, 'x')[14], 'false');
eq('junk data gives a full-width blank row', I.playerRow(null, 'x').length, 16);

/* submittedAt and team-code are GENERATED. If the data object could supply
   them, anyone could stamp their own submission time or claim a team code that
   already belongs to another club. */
eq('a submitted timestamp cannot override the real one',
  I.teamRow({ submittedAt: '1999-01-01' }, 'TST1', '2026-08-01T09:00:00.000Z')[0], '2026-08-01T09:00:00.000Z');
eq('a submitted team code cannot override the generated one',
  I.teamRow({ 'team-code': 'HACK9' }, 'TST1', 'x')[2], 'TST1');

/* ====================================================================== */
section('Reading a row back');

/* Pinned by hand against what get-registrations.js returned BEFORE this
   refactor — first and last names joined with a space, everything else passed
   through, every absent value an empty string rather than undefined. The
   /organizer dashboard reads these exact names. */
{
  const out = I.mapTeamRow([
    '2026-08-01T09:00:00.000Z', 'Test Club', 'TST1', 'U16B Contact',
    'A Coach', 'coach@example.com', '+971500000000',
    'A Manager', 'manager@example.com', '+971500000001',
    '15', 'a note', '[]', 'No preference',
  ]);
  eq('every dashboard field, in the shape /organizer already reads', out, {
    submittedAt: '2026-08-01T09:00:00.000Z',
    club: 'Test Club', teamName: 'TST1', ageGroup: 'U16B Contact',
    headCoachName: 'A Coach', headCoachEmail: 'coach@example.com', headCoachMobile: '+971500000000',
    managerName: 'A Manager', managerEmail: 'manager@example.com', managerMobile: '+971500000001',
    numPlayers: '15', notes: 'a note', players: '[]', preferredPool: 'No preference',
  });
}

{
  const out = I.mapPlayerRow([
    '2026-08-01T09:00:00.000Z', 'Test', 'Player', '2011-01-01',
    'Test Club', 'U16B Contact',
    'Parent', 'Surname', 'parent@example.com', '+971500000000',
    'Emergency', 'Contact', '+971500000001',
    'none', 'Yes', 'No',
  ]);
  eq('names are joined, the rest passes through', out, {
    submittedAt: '2026-08-01T09:00:00.000Z',
    playerName: 'Test Player',
    dob: '2011-01-01', club: 'Test Club', ageGroup: 'U16B Contact',
    parentName: 'Parent Surname',
    parentEmail: 'parent@example.com', parentMobile: '+971500000000',
    emergencyContact: 'Emergency Contact', emergencyMobile: '+971500000001',
    medicalNotes: 'none', consent: 'Yes', playUpConsent: 'No',
  });
}

/* A short row is what Sheets returns when the last cells are blank — it does
   not pad. Every one of those has to come back as '' rather than undefined, or
   the dashboard renders the word "undefined" in a column. */
{
  const short = I.mapTeamRow(['2026-08-01T09:00:00.000Z', 'Test Club']);
  eq('a short row still has every field', Object.keys(short).length, 14);
  eq('…and the missing ones are blank', short.preferredPool, '');
  check('…not undefined', short.notes === '');

  const shortP = I.mapPlayerRow(['2026-08-01T09:00:00.000Z']);
  eq('a short player row too', shortP.playUpConsent, '');
  eq('…and a name built from nothing is blank, not " "', shortP.playerName, '');
}
eq('an empty row does not throw', I.mapTeamRow([]).club, '');
eq('junk does not throw', I.mapPlayerRow(null).dob, '');

/* One half of a name pair present must not leave a stray space. */
eq('first name only', I.mapPlayerRow(['', 'Test', ''])
  .playerName, 'Test');
eq('last name only', I.mapPlayerRow(['', '', 'Player'])
  .playerName, 'Player');

/* ====================================================================== */
section('The round trip — the thing three separate copies could never state');

/* Write it, read it back, get it out again. This is the check that fails the
   moment the writer and the readers disagree by one column, and it could not
   exist while they lived in different files. */
{
  const stamp = '2026-08-01T09:00:00.000Z';
  const submitted = {
    club: 'Test Club', 'age-group': 'U16B Contact', 'preferred-pool': 'Pool A',
    'head-coach-name': 'A Coach', 'head-coach-email': 'coach@example.com',
    'head-coach-phone': '+971500000000',
    'manager-name': 'A Manager', 'manager-email': 'manager@example.com',
    'manager-phone': '+971500000001',
    'num-players': '15', notes: 'a note', players: '[]',
  };
  const back = I.mapTeamRow(I.teamRow(submitted, 'TST1', stamp));
  eq('club survives the round trip', back.club, submitted.club);
  eq('age group survives', back.ageGroup, submitted['age-group']);
  eq('preferred pool survives — the column most likely to shift', back.preferredPool, submitted['preferred-pool']);
  eq('the coach phone does not end up in the manager phone', back.headCoachMobile, submitted['head-coach-phone']);
  eq('…and the manager phone stays the manager phone', back.managerMobile, submitted['manager-phone']);
  eq('the generated code comes back as teamName', back.teamName, 'TST1');
  eq('the generated timestamp comes back', back.submittedAt, stamp);
  eq('notes are not the squad list', back.notes, 'a note');
  eq('…and the squad list is not the notes', back.players, '[]');
}

{
  const stamp = '2026-08-01T09:00:00.000Z';
  const submitted = {
    'player-first-name': 'Test', 'player-last-name': 'Player', dob: '2011-01-01',
    club: 'Test Club', 'age-group': 'U16B Contact',
    'parent-first-name': 'Parent', 'parent-last-name': 'Surname',
    'parent-email': 'parent@example.com', 'parent-phone': '+971500000000',
    'emergency-first-name': 'Emergency', 'emergency-last-name': 'Contact',
    'emergency-phone': '+971500000001',
    'medical-notes': 'none', consent: 'Yes', 'play-up-consent': 'No',
  };
  const back = I.mapPlayerRow(I.playerRow(submitted, stamp));
  eq('the date of birth survives', back.dob, submitted.dob);
  /* THE ONE THAT WOULD ACTUALLY HURT. A one-column shift here puts a parent's
     phone number in the emergency-contact box, and the sheet is what somebody
     rings from at a tournament. */
  eq('the parent phone is the parent phone', back.parentMobile, submitted['parent-phone']);
  eq('the emergency phone is the emergency phone', back.emergencyMobile, submitted['emergency-phone']);
  eq('the emergency contact is not the parent', back.emergencyContact, 'Emergency Contact');
  eq('…and the parent is not the emergency contact', back.parentName, 'Parent Surname');
  eq('medical notes survive', back.medicalNotes, 'none');
  eq('consent survives', back.consent, 'Yes');
  eq('play-up consent is not consent', back.playUpConsent, 'No');
}

/* ====================================================================== */
section('The three copies are down to one');

{
  const norm = (f) => readRepo(path.join('netlify', 'functions', f)).replace(/\r\n/g, '\n');
  const writer = norm('submission-created.js');
  const reader1 = norm('get-registrations.js');
  const reader2 = norm('get-my-registrations.js');

  [['submission-created.js', writer], ['get-registrations.js', reader1], ['get-my-registrations.js', reader2]]
    .forEach(([name, src]) => {
      check(`${name} asks _intake.js for the columns`, /require\('\.\/_intake'\)/.test(src), 'no require');
      check(`${name} has no TEAM_FIELDS of its own`, !/const TEAM_FIELDS\s*=/.test(src));
    });

  /* The positional destructure is the specific thing that made a column shift
     invisible: sixteen names in square brackets, and nothing checks that the
     sixteen are in the right order. */
  check('nobody destructures a sheet row by position any more',
    !/const \[submittedAt, playerFirst/.test(reader1 + reader2 + writer));
  check('the writer no longer builds a positional array by hand',
    !/values = \[\[\s*\n?\s*submittedAt,/.test(writer));
  check('the writer asks for the range too', /I\.TEAM_RANGE|TEAM_RANGE/.test(writer));

  /* RAW is not a style choice and must survive every refactor of this file. A
     leading "=" in a free-text box becomes a live formula in a sheet holding
     children's names, dates of birth and medical notes; IMPORTDATA in that
     formula reads them out to somebody else's server. */
  check('the append is still RAW, not USER_ENTERED', /valueInputOption: 'RAW'/.test(writer));
  check('…and USER_ENTERED has not crept back', !/USER_ENTERED'/.test(writer.replace(/\/\*[\s\S]*?\*\//g, '')));
}

/* ======================================================================
   FAULTS THIS FILE WAS PROVEN AGAINST — `node tests/_prove-registration.js`:

     * preferred-pool moved next to age group -> "team columns"
     * a cell left as undefined instead of ''  -> "every cell is a string"
     * the reader's output names shifted by one-> the round-trip checks
     * mapTeamRow reading row[i+1]             -> "club survives the round trip"
     * a name pair joined in the wrong order   -> "the emergency contact is not
                                                  the parent"
     * a short row giving undefined            -> "a short row still has every
                                                  field"
     * the range left at A:N with 15 columns   -> "exactly as wide as"
     * USER_ENTERED put back                   -> "still RAW"
   ====================================================================== */

summary('test-intake.js');
