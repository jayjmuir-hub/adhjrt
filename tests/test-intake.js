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

/* Top-level await: the rate-limit section drives an async store. Node 22 in
   CommonJS does not allow it, so the whole file runs inside main(). */
async function main() {

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
  /* submission-created.js was the third copy and the WRITER. It is gone as of
     28 Jul 2026 — nothing posts to Netlify Forms any more, so the webhook could
     never fire again. submit-registration.js is the writer now. */
  const writer = norm('submit-registration.js');
  const reader1 = norm('get-registrations.js');
  const reader2 = norm('get-my-registrations.js');

  [['submit-registration.js', writer], ['get-registrations.js', reader1], ['get-my-registrations.js', reader2]]
    .forEach(([name, src]) => {
      check(`${name} asks _intake.js for the columns`, /require\('\.\/_intake'\)/.test(src), 'no require');
      check(`${name} has no TEAM_FIELDS of its own`, !/const TEAM_FIELDS\s*=/.test(src));
    });

  /* The positional destructure is the specific thing that made a column shift
     invisible: sixteen names in square brackets, and nothing checks that the
     sixteen are in the right order. */
  check('nobody destructures a sheet row by position any more',
    !/const \[submittedAt, playerFirst/.test(reader1 + reader2 + writer));
  check('the writer asks _intake.js for the range', /spec\.range|TEAM_RANGE/.test(writer));

  /* RAW is not a style choice and must survive every refactor of this file. A
     leading "=" in a free-text box becomes a live formula in a sheet holding
     children's names, dates of birth and medical notes; IMPORTDATA in that
     formula reads them out to somebody else's server. */
  check('the append is still RAW, not USER_ENTERED', /valueInputOption: 'RAW'/.test(writer));
  check('…and USER_ENTERED has not crept back', !/USER_ENTERED'/.test(writer.replace(/\/\*[\s\S]*?\*\//g, '')));
}

/* ====================================================================== */
section('The allow-list — what may reach the sheet at all');

/* WHY THIS EXISTS. Until the gateway, Netlify Forms decided what a submission
   contained. From the gateway on, the REQUEST BODY decides — and the request
   body is public input to an unauthenticated endpoint that writes rows into a
   sheet holding children's names, dates of birth and medical notes, and sends
   email from admin@adhjrt.com to an address taken out of that same body.

   So: an explicit list of what a form may carry, and anything else is dropped.
   Dropped rather than refused, because a browser extension or a corporate proxy
   adding a field must not cost a coach their registration — but the drop is
   REPORTED, so it can be logged by NAME. Never by value. */

{
  const { clean, dropped } = I.cleanSubmission('team-registration', {
    club: 'Test Club',
    'head-coach-email': 'coach@example.com',
    'not-a-field': 'x',
  });
  check('a known field survives', clean.club === 'Test Club');
  check('another one does too', clean['head-coach-email'] === 'coach@example.com');
  check('an unknown field is dropped', !('not-a-field' in clean));
  eq('…and reported by name so it can be logged', dropped, ['not-a-field']);
  eq('nothing else was invented', Object.keys(clean).length, 2);
}

/* THE TWO THAT MATTER MOST. Both are generated server-side. Accepting either
   from the body would let anyone stamp their own submission time, or claim a
   team code that already belongs to another club — and the team code is what
   the sheet, the draw and the printed pitch flags all key on.

   _intake.js already spreads them after the data so a row builder cannot be
   overridden, but that is a second line of defence. This is the first: they
   never get that far. */
{
  const { clean, dropped } = I.cleanSubmission('team-registration', {
    submittedAt: '1999-01-01T00:00:00.000Z',
    'team-code': 'HACK9',
    'team-name': 'HACK9',
  });
  check('a submitted timestamp never gets in', !('submittedAt' in clean));
  check('a submitted team code never gets in', !('team-code' in clean));
  check('nor the name the email prints it under', !('team-name' in clean));
  eq('all three are reported', dropped.length, 3);
  eq('and nothing at all survived', Object.keys(clean).length, 0);
}

/* A submitted "__proto__" on a plain {} does not become an own property — it
   walks the prototype chain instead, which is a different and worse surprise.
   Nothing here needs a prototype at all. */
{
  const { clean } = I.cleanSubmission('team-registration', JSON.parse('{"__proto__":{"squad":999},"club":"Test Club"}'));
  check('the result has no prototype at all', Object.getPrototypeOf(clean) === null);
  check('a polluting key does not land', clean.squad === undefined);
  check('…and the real field still does', clean.club === 'Test Club');
  check('Object.prototype is untouched', ({}).squad === undefined);
}

/* Each form carries its own fields. A team field on the player form is not a
   near miss to be forgiven — it means the caller has confused the two, and
   writing it would put it in a column that means something else. */
{
  const { clean, dropped } = I.cleanSubmission('player-registration', {
    'medical-notes': 'none', 'head-coach-name': 'wrong form',
  });
  check('a player field survives', clean['medical-notes'] === 'none');
  check('a TEAM field on the player form is dropped', !('head-coach-name' in clean));
  eq('…and reported', dropped, ['head-coach-name']);
}
{
  const { clean } = I.cleanSubmission('team-registration', { dob: '2011-01-01' });
  check('a PLAYER field on the team form is dropped', !('dob' in clean));
}

/* An unknown form is refused outright rather than cleaned to nothing. "We do
   not know what this is" and "this is a valid form with no fields filled in"
   are different answers and the caller has to be able to tell them apart. */
check('an unknown form is refused', I.cleanSubmission('nope', {}) === null);
check('a missing form is refused', I.cleanSubmission(undefined, {}) === null);
check('a null form is refused', I.cleanSubmission(null, {}) === null);
check('a non-string form is refused', I.cleanSubmission(42, {}) === null);
/* Exact match. The gateway must not accept "Team-Registration" as a near miss,
   or two spellings of one form exist and only one of them is tested. */
check('the wrong case is not the same form', I.cleanSubmission('Team-Registration', {}) === null);

/* Junk in the data half must give an empty result, not a throw — this runs on
   a public endpoint and an exception there is a 500 with no explanation. */
eq('null data gives nothing, not a throw', Object.keys(I.cleanSubmission('team-registration', null).clean).length, 0);
eq('a string instead of an object gives nothing', Object.keys(I.cleanSubmission('team-registration', 'x').clean).length, 0);
eq('an array gives nothing', Object.keys(I.cleanSubmission('team-registration', ['club']).clean).length, 0);

/* The honeypot is allowed THROUGH the filter so validation can look at it, but
   it is not a sheet column, so it can never be written. Both halves matter. */
{
  const { clean } = I.cleanSubmission('team-registration', { 'bot-field': '' });
  check('bot-field is allowed through for the honeypot check', 'bot-field' in clean);
  check('…but it is not a team sheet column', I.TEAM_COLUMNS.indexOf('bot-field') < 0);
  check('…nor a player one', I.PLAYER_COLUMNS.indexOf('bot-field') < 0);
  check('…so it can never reach a row', I.teamRow(clean, 'TST1', 'x').indexOf('') >= 0
    && I.teamRow({ 'bot-field': 'caught you' }, 'TST1', 'x').every((c) => c !== 'caught you'));
}

/* ====================================================================== */
section('The allow-list and the columns cannot drift apart');

/* Every field a form accepts must have somewhere to go, and every column
   except the generated ones must be fillable. Either gap is silent: a field
   that is accepted but has no column is thrown away after validation passes,
   and a column with no field is a permanently empty column nobody notices. */
{
  const GENERATED = ['submittedAt', 'team-code'];

  const teamFields = I.FORMS['team-registration'].fields;
  teamFields.forEach((f) => {
    check(`team field "${f}" has a column to go in`, I.TEAM_COLUMNS.indexOf(f) >= 0);
  });
  I.TEAM_COLUMNS.filter((c) => GENERATED.indexOf(c) < 0).forEach((c) => {
    check(`team column "${c}" is a field a coach can fill in`, teamFields.indexOf(c) >= 0);
  });

  const playerFields = I.FORMS['player-registration'].fields;
  playerFields.forEach((f) => {
    check(`player field "${f}" has a column to go in`, I.PLAYER_COLUMNS.indexOf(f) >= 0);
  });
  I.PLAYER_COLUMNS.filter((c) => GENERATED.indexOf(c) < 0).forEach((c) => {
    check(`player column "${c}" is a field somebody can fill in`, playerFields.indexOf(c) >= 0);
  });

  check('the honeypot is not in either field list by accident',
    teamFields.indexOf('bot-field') < 0 && playerFields.indexOf('bot-field') < 0);
  /* Two. The club declaration form was removed on 2 Aug 2026 at Jay's request —
     the button, the modal, the columns, the row builder and the email template
     all went with it. */
  eq('the forms are exactly the two the site submits', Object.keys(I.FORMS).sort(),
    ['player-registration', 'team-registration']);
  check('club-registration is gone, not merely unused',
    I.cleanSubmission('club-registration', { club: 'X' }) === null,
    'an unknown form must be refused by the allow-list, not silently accepted');
}

/* The form names have to be the ones the page actually submits, or the gateway
   refuses every real registration and accepts none. Read out of the page. */
{
  /* The form names have to be the ones the page actually sends, or the gateway
     refuses every real registration and accepts none.

     ⚠️ This check used to look for `'form-name': '<name>'`, which is how the
     page addressed NETLIFY FORMS. Since 28 Jul 2026 it posts
     { form: '<name>', data: {…} } to our own function instead, so the old
     anchor stopped existing — and the baseline run caught it, which is what
     that baseline is for. */
  const page = readRepo('Quins JRT.dc.html').replace(/\r\n/g, '\n');
  Object.keys(I.FORMS).forEach((name) => {
    check(`the page really submits "${name}"`,
      page.indexOf(`this.postRegistration('${name}'`) >= 0, name);
  });
  check('…and no longer addresses Netlify Forms at all', !/'form-name':/.test(page));
}

/* Each form knows which sheet it belongs to, by env var NAME. Never a value. */
eq('teams go to the teams sheet', I.FORMS['team-registration'].sheetEnv, 'GOOGLE_SHEET_ID_TEAMS');
eq('players go to the players sheet', I.FORMS['player-registration'].sheetEnv, 'GOOGLE_SHEET_ID_PLAYERS');
check('the two are not the same sheet',
  I.FORMS['team-registration'].sheetEnv !== I.FORMS['player-registration'].sheetEnv);

/* ====================================================================== */
section('Validation — the rules, server side for the first time');

/* NO NEW RULES HERE. Every one of these is already applied in the browser; the
   point is that until now that was the ONLY place it was applied, so anyone
   editing the page could register a squad of any size for a contact age grade.
   Ages are sub-project 2 and deliberately absent.

   The wording is copied CHARACTER FOR CHARACTER from submitTeam() and
   _playerFormError(), so a coach sees the same sentence whichever side refuses
   — see the agreement section below, which reads it out of the page. */

const V = (form, data) => I.validateSubmission(form, I.cleanSubmission(form, data).clean);
const AG = require(path.join(repoRoot(), 'netlify', 'functions', '_agegroups.js'));
const A_GROUPS = AG.AGE_GROUPS;
const AG_BY_NAME = AG.AGE_GROUP_BY_NAME;

/* A submission with everything filled in. Every value is invented.
   `preferred-pool` must be one of POOL_OPTIONS (A/B/C) since 1 Aug 2026 — it
   used to say 'No preference', which is no longer a pool a coach can ask for
   and is now refused, which would fail every check downstream of this. */
const goodTeam = () => ({
  club: 'Test Club', 'age-group': 'U16B Contact', 'preferred-pool': 'A',
  'head-coach-name': 'A Coach', 'head-coach-email': 'coach@example.com',
  'head-coach-phone': '+971500000000', 'num-players': '2',
  players: JSON.stringify([
    { firstName: 'One', lastName: 'Player', dob: '2011-01-01' },
    { firstName: 'Two', lastName: 'Player', dob: '2011-01-02' },
  ]),
});
const goodPlayer = () => ({
  'player-first-name': 'Test', 'player-last-name': 'Player', dob: '2011-01-01',
  club: 'Test Club', 'age-group': 'U16B Contact',
  'parent-first-name': 'Parent', 'parent-last-name': 'Surname',
  'parent-email': 'parent@example.com', 'parent-phone': '+971500000000',
  'emergency-first-name': 'Emergency', 'emergency-last-name': 'Contact',
  'emergency-phone': '+971500000001',
  consent: 'Yes', 'play-up-consent': 'No',
});

check('a complete team registration is accepted', V('team-registration', goodTeam()).ok === true,
  V('team-registration', goodTeam()).error);
check('a complete player registration is accepted', V('player-registration', goodPlayer()).ok === true,
  V('player-registration', goodPlayer()).error);
check('neither is silently dropped', !V('team-registration', goodTeam()).drop
  && !V('player-registration', goodPlayer()).drop);

/* ---- the preferred pool ----------------------------------------------
   Jay, 1 Aug 2026: D and "No preference" removed, leaving A/B/C.

   ⚠️ THE POINT OF THESE CHECKS is that until this change the server never
   looked at this field's VALUE at all — only that it was non-empty. The
   browser's dropdown was the only thing restricting it, which means it
   restricted nothing. Narrowing the dropdown alone would have been
   cosmetic, and nothing in this suite would have noticed. */
{
  I.POOL_OPTIONS.forEach((p) => {
    const r = V('team-registration', { ...goodTeam(), 'preferred-pool': p });
    check(`pool ${p} is accepted`, r.ok === true, JSON.stringify(r));
  });

  ['D', 'No preference'].forEach((p) => {
    const r = V('team-registration', { ...goodTeam(), 'preferred-pool': p });
    check(`"${p}" is refused server-side, not just hidden from the dropdown`,
      r.ok === false, JSON.stringify(r));
    eq(`…and the field is named so the form can highlight it`, r.field, 'preferred-pool');
  });

  /* Matched EXACTLY, the same way the age group is. A near miss is a client
     we did not write, not a coach mistake. (A stray space is the exception —
     see the trim check below.) */
  ['a', 'Pool A', 'AB', 'B/C', ''].forEach((p) => {
    const r = V('team-registration', { ...goodTeam(), 'preferred-pool': p });
    check(`"${p}" is not quietly accepted as pool A`, r.ok === false, JSON.stringify(r));
  });

  /* Trimmed before matching — a stray space either side is the page's fault,
     not the coach's, and refusing it would be unhelpful noise. */
  check('a padded " B " is trimmed and accepted',
    V('team-registration', { ...goodTeam(), 'preferred-pool': ' B ' }).ok === true);

  /* The player form has no pool field at all. The rule must not leak onto it. */
  check('the player form is unaffected by the pool rule',
    V('player-registration', { ...goodPlayer(), 'preferred-pool': 'D' }).ok === true);

  /* THE TWO COPIES. No build step, so the list is duplicated in the page and
     in _intake.js — same as AGE_GROUP_INFO and DEFAULT_VENUE. This is the
     check that stops them drifting. */
  const POOL_OPTIONS_SERVER = I.POOL_OPTIONS;
  const home = readRepo('Quins JRT.dc.html');
  const m = home.match(/const POOL_OPTIONS = (\[[^\]]*\]);/);
  check('the page declares POOL_OPTIONS', !!m, String(m));
  const clientPools = m ? JSON.parse(m[1].replace(/'/g, '"')) : null;
  eq('the page and the server offer exactly the same pools',
    JSON.stringify(clientPools), JSON.stringify(POOL_OPTIONS_SERVER));
  /* Hardcoded on purpose: the check above derives BOTH sides from the code,
     so a change made in both places at once would sail through it. This one
     does not derive its expectation from the thing under test. */
  eq('…and that list is exactly A, B, C',
    JSON.stringify(POOL_OPTIONS_SERVER), JSON.stringify(['A', 'B', 'C']));

  /* Removed from the page, not merely absent from the constant. Comments are
     stripped first — the constant's own comment explains why the option went,
     and naming it there must not fail this. Same treatment the "October 2026"
     check in test-registration-panel.js already uses. */
  const homeCode = home.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
  check('the page no longer offers "No preference" anywhere',
    !/No preference/.test(homeCode),
    (homeCode.match(/[^\n]{0,60}No preference[^\n]{0,20}/g) || []).join(' | '));

  /* ⚠️ A DRAW CAN STILL HAVE A POOL D, AND THE IMPORT MATCHERS MUST NOT BE
     NARROWED TO MATCH THIS LIST. POOL_OPTIONS is only what a club may ASK for
     on the registration form. A draw can have four pools — the 4-pool
     Cup/Bowl/Plate/Shield bracket depends on it — and a stored preference from
     before this change may still name D. Narrowing either matcher to A-C would
     silently change how those are read.

     ⚠⚠ THE TWO EDITORS DO NOT AGREE, and that is a pre-existing finding, not
     something this change introduced. `Manager.dc.html` was widened to
     /[A-Z]/i during the Manager Dashboard rebuild; `Scores & Standings.dc.html`
     still has the original /[A-D]/i. The "uniform draw editor" project was
     meant to make these two match and did not reach this line. Asserted AS IT
     ACTUALLY IS below rather than quietly fixed, because changing the Scores
     matcher changes how real stored preferences are read and is Jay's call.
     See claude/parked-requests.md.

     ⚠⚠⚠ READ DEFENSIVELY. Neither editor file is in the temp copy
     _prove-registration.js builds — it copies only what the registration path
     needs. A bare readRepo() here throws ENOENT under the prover, which kills
     this whole file and cascades into every fault downstream, making 60-odd
     unrelated faults report as "failed, but not on the named check". That is
     precisely the "a test that throws is not a test that caught something"
     trap in state-of-play.md, and it is why these read through a guard.
     Present in the real suite (always) — absent under the prover (always). */
  const editorSrc = (f) => {
    try { return readRepo(f); } catch (e) { return null; }
  };
  const mgr = editorSrc('Manager.dc.html');
  const sco = editorSrc('Scores & Standings.dc.html');

  if (mgr !== null && sco !== null) {
    check('Manager.dc.html reads a preference with /[A-Z]/i',
      /preferredPool \|\| ''\)\.match\(\/\[A-Z\]\/i\)/.test(mgr));
    check('Scores & Standings.dc.html reads a preference with /[A-D]/i (NOT the same — known gap)',
      /preferredPool \|\| ''\)\.match\(\/\[A-D\]\/i\)/.test(sco));
    check('Manager.dc.html has NOT been narrowed to A-C to match the form\'s new list',
      !/preferredPool \|\| ''\)\.match\(\/\[A-C\]\/i\)/.test(mgr));
    check('Scores & Standings.dc.html has NOT been narrowed to A-C either',
      !/preferredPool \|\| ''\)\.match\(\/\[A-C\]\/i\)/.test(sco));
  }
}

/* ---- the A1 ranges ----------------------------------------------------
   Derived from the column counts, never typed. Lived inside the club section
   until that was removed on 2 Aug 2026; kept, because the ceiling it guards
   applies to every sheet. */
{
  /* The A1 range is derived, and colLetter() only reaches Z. */
  [I.TEAM_RANGE, I.PLAYER_RANGE].forEach((r) => {
    check(`range ${r} stays inside A-Z (colLetter breaks past 26 columns)`, /^A:[A-Z]$/.test(r));
  });

  /* The rule must not leak onto the other two forms. */
  check('the team form is unaffected by the declaration rules',
    V('team-registration', goodTeam()).ok === true);
  check('the player form is unaffected too',
    V('player-registration', goodPlayer()).ok === true);
}

/* ---- required fields, one at a time ---------------------------------- */



/* EACH FIELD REMOVED INDIVIDUALLY. A single "everything missing" case passes
   even when only one field is actually being checked, which is exactly the kind
   of hollow test this project has shipped before. */
const TEAM_REQUIRED = ['club', 'age-group', 'preferred-pool', 'head-coach-name', 'head-coach-email'];
TEAM_REQUIRED.forEach((f) => {
  const d = goodTeam(); delete d[f];
  const r = V('team-registration', d);
  check(`a team with no ${f} is refused`, r.ok === false, JSON.stringify(r));
  eq(`…and told which one`, r.field, f);
});
TEAM_REQUIRED.forEach((f) => {
  const d = goodTeam(); d[f] = '   ';
  check(`whitespace does not count as a ${f}`, V('team-registration', d).ok === false);
});

/* NOT required on the team form, and must not become so — the browser lets a
   coach submit without them and the server refusing would be a rule the coach
   was never shown. */
['head-coach-phone', 'manager-name', 'manager-email', 'manager-phone', 'notes', 'num-players']
  .forEach((f) => {
    const d = goodTeam(); delete d[f];
    check(`a team with no ${f} is still fine`, V('team-registration', d).ok === true);
  });

const PLAYER_REQUIRED = [
  'player-first-name', 'player-last-name', 'dob', 'club',
  'parent-first-name', 'parent-last-name', 'parent-email',
  'emergency-first-name', 'emergency-last-name', 'emergency-phone',
];
PLAYER_REQUIRED.forEach((f) => {
  const d = goodPlayer(); delete d[f];
  const r = V('player-registration', d);
  check(`a player with no ${f} is refused`, r.ok === false, JSON.stringify(r));
  eq(`…and told which one`, r.field, f);
});

/* ⚠️ AGE GROUP IS NOT REQUIRED ON THE PLAYER FORM. _playerFormError() does not
   ask for it and emptyPlayerForm() starts it blank, so the browser accepts a
   player with none. The server matches that rather than quietly tightening it:
   a rule the coach was never shown is a rule that looks like a bug. Worth
   raising with Jay separately — it is a gap in the form, not in this code. */
{
  const d = goodPlayer(); delete d['age-group'];
  check('a player with no age group is accepted, matching the form', V('player-registration', d).ok === true);
}
{
  const d = goodPlayer(); d['play-up-consent'] = '';
  check('play-up consent is not required on its own', V('player-registration', d).ok === true);
}
{
  const d = goodPlayer(); delete d['parent-phone'];
  check('a parent phone is not required, matching the form', V('player-registration', d).ok === true);
}
{
  const d = goodPlayer(); delete d['medical-notes'];
  check('medical notes are not required', V('player-registration', d).ok === true);
}

/* ---- consent ---------------------------------------------------------- */

['No', '', 'yes', 'true', 'on'].forEach((v) => {
  const d = goodPlayer(); d.consent = v;
  check(`consent "${v}" is not consent`, V('player-registration', d).ok === false, v);
});
{
  const d = goodPlayer(); delete d.consent;
  check('missing consent is not consent', V('player-registration', d).ok === false);
  eq('…and the field named is consent', V('player-registration', d).field, 'consent');
}

/* ---- the age group, when it is there ---------------------------------- */

['U16B contact', 'u16b', 'U16B', 'Under 16 Boys', 'not a group'].forEach((v) => {
  [['team-registration', goodTeam()], ['player-registration', goodPlayer()]].forEach(([form, d]) => {
    d['age-group'] = v;
    const r = V(form, d);
    check(`${form}: "${v}" is not one of the fifteen`, r.ok === false, v);
    check(`…and the message says so`, /age group/i.test(r.error || ''), r.error);
  });
});

/* ---- the squad cap, enforced for the first time ------------------------ */

/* Every invented player's dob is picked to FIT the group under test — the
   squad cap and the age check (sub-project 2, below) are two different rules
   and this section tests the cap only. A fixed dob that happened to suit
   U16B only would silently start failing here the moment the age check
   existed, for a reason this section has nothing to do with. `ageFitDob`
   lands a player at the group's youngest age at the cut-off; group is
   optional so the "roster doesn't even matter" cases (an unrecognised
   age-group, for instance) can still call roster() with no group. */
const ageFitDob = (group) => `${2026 - group.ages[0]}-01-01`;
const roster = (n, group) => JSON.stringify(
  Array.from({ length: n }, (_, i) => ({ firstName: `P${i}`, lastName: 'Player', dob: group ? ageFitDob(group) : '2011-01-01' }))
);

{
  /* U16B is 18, U16G is 12 — different numbers, so a cap read off the wrong
     group cannot pass by coincidence. */
  const u16b = AG_BY_NAME['U16B Contact']; const u16g = AG_BY_NAME['U16G Contact'];
  const at18 = goodTeam(); at18.players = roster(18, u16b);
  check('18 players in U16B is exactly the cap and is allowed', V('team-registration', at18).ok === true,
    V('team-registration', at18).error);

  const over = goodTeam(); over.players = roster(19, u16b);
  const r = V('team-registration', over);
  check('19 is one too many', r.ok === false);
  eq('…and the sentence is the one the browser uses',
    r.error, 'U16B Contact squads are a maximum of 18 players and you have listed 19. Please remove 1.');

  const g = goodTeam(); g['age-group'] = 'U16G Contact'; g.players = roster(13, u16g);
  eq('the cap follows the GROUP, not the biggest number in the tournament',
    V('team-registration', g).error,
    'U16G Contact squads are a maximum of 12 players and you have listed 13. Please remove 1.');

  const g12 = goodTeam(); g12['age-group'] = 'U16G Contact'; g12.players = roster(12, u16g);
  check('12 in U16G is allowed', V('team-registration', g12).ok === true);
  const g13 = goodTeam(); g13['age-group'] = 'U16G Contact'; g13.players = roster(18, u16g);
  check('18 in U16G is NOT allowed, even though 18 is a cap somewhere',
    V('team-registration', g13).ok === false);

  const none = goodTeam(); none.players = roster(0);
  check('an empty roster is allowed — a coach may send names later',
    V('team-registration', none).ok === true);
  const noField = goodTeam(); delete noField.players;
  check('no roster at all is allowed too', V('team-registration', noField).ok === true);
}

/* WHY THERE IS NO SEPARATE ABSOLUTE CEILING. There was one — a flat roster cap
   of 30 — and it was dead code: `age-group` is required on this form and an
   unrecognised one is refused before we get here, so the cap applied is always
   a real group's, and the largest in the tournament is 18. Deleting the branch
   changed no test, which is how it was found.

   So the invariant to assert is the one that actually holds: no roster can get
   past this larger than the biggest squad in the tournament. */
{
  const huge = goodTeam(); huge.players = roster(31, AG_BY_NAME['U16B Contact']);
  check('31 players is refused', V('team-registration', huge).ok === false);
  check('…as is anything over the largest cap in the tournament, in every group',
    A_GROUPS.every((g) => {
      const d = goodTeam(); d['age-group'] = g.name; d.players = roster(g.squad + 1, g);
      return V('team-registration', d).ok === false;
    }));
  check('…while exactly the cap is allowed in every group',
    A_GROUPS.every((g) => {
      const d = goodTeam(); d['age-group'] = g.name; d.players = roster(g.squad, g);
      return V('team-registration', d).ok === true;
    }));
  check('the biggest squad anywhere is 18, so nothing larger can ever be stored',
    Math.max(...A_GROUPS.map((g) => g.squad)) === 18);
  check('an unrecognised group never reaches the cap check at all',
    (() => { const d = goodTeam(); d['age-group'] = 'nope'; d.players = roster(99);
      const r = V('team-registration', d); return r.ok === false && r.field === 'age-group'; })());
}

/* The roster arrives as a JSON string. Anything that is not a JSON array is a
   broken client, not a coach mistake, so it says so differently. */
['not json', '{}', '"a string"', '42', 'null'].forEach((v) => {
  const d = goodTeam(); d.players = v;
  const r = V('team-registration', d);
  check(`a squad list of ${v} is refused`, r.ok === false, v);
  check('…and points at admin@adhjrt.com rather than blaming the coach',
    /admin@adhjrt\.com/.test(r.error || ''), r.error);
});
{
  const d = goodTeam(); d.players = '[]';
  check('an empty JSON array is fine', V('team-registration', d).ok === true);
}

/* ---- the roster's dates of birth — sub-project 2, added 28 Jul 2026 ---- */

/* No new rule: this is ageGroupCheck()'s rule (in _agegroups.js, itself a
   copy of _playerAgeCheck()), reused here rather than reimplemented. See
   claude/spec-age-validation.md and claude/plan-age-validation.md. */

const AG_CHECK = AG.ageGroupCheck;
const dobAtCutoffAge = (age) => `${2026 - age}-01-01`;
const players = (list) => JSON.stringify(list);

{
  /* A row with no name at all is never inspected — every roster starts with
     blank rows and none of them may block anything. */
  const d = goodTeam(); d.players = players([{ firstName: '', lastName: '', dob: '' }]);
  check('an untouched blank row is not checked at all', V('team-registration', d).ok === true);
}
{
  /* Confirmed with Jay, 28 Jul 2026: a named row with no date of birth blocks
     the whole squad, the same way the player form requires one. Otherwise a
     coach could leave every dob blank and this project would check nothing. */
  const d = goodTeam(); d.players = players([{ firstName: 'A', lastName: 'Player', dob: '' }]);
  const r = V('team-registration', d);
  check('a named row with no dob is refused', r.ok === false);
  eq('…with a sentence that says so', r.error, 'Please give a date of birth for every named player.');
  eq('…pointing at the roster field', r.field, 'players');

  const onlyLast = goodTeam(); onlyLast.players = players([{ firstName: '', lastName: 'Player', dob: '' }]);
  check('a last-name-only row still counts as named', V('team-registration', onlyLast).ok === false);
}
{
  /* A play-up player — exactly one age group young — passes through. It
     cannot be gated on consent server-side: that is a checkbox a PARENT
     ticks on the player form, and a coach entering a whole squad cannot tick
     it for them. Spec decision 1. */
  const d = goodTeam(); // U16B Contact
  d.players = players([{ firstName: 'Play', lastName: 'Up', dob: dobAtCutoffAge(13) }]); // fits U14B
  const check1 = AG_CHECK(dobAtCutoffAge(13), 'U16B Contact');
  eq('sanity: the shared function agrees this is a play-up case', check1.status, 'playUp');
  eq('a play-up roster is accepted, not refused', V('team-registration', d).ok, true);
}
{
  /* Two or more groups out, or too old: a hard block, same as the player
     form has always had. */
  const d = goodTeam();
  d.players = players([{ firstName: 'Too', lastName: 'Old', dob: dobAtCutoffAge(30) }]);
  const r = V('team-registration', d);
  check('a badly out-of-range player blocks the whole squad', r.ok === false);
  check('…naming the player', /Too Old/.test(r.error || ''), r.error);
  eq('…pointing at the roster field', r.field, 'players');
  /* The core sentence has to be the SAME one ageGroupCheck() produces for the
     identical input — not a hand-typed copy that can drift from it. */
  const expected = AG_CHECK(dobAtCutoffAge(30), 'U16B Contact').message;
  check('…and ends with ageGroupCheck()\'s own sentence, unmodified',
    (r.error || '').endsWith(expected), r.error);
}
{
  /* An unnamed player (row 1) blocks; the SECOND named row is the one
     reported, proving the loop doesn't stop at the first row regardless of
     content — it inspects every named row. */
  const d = goodTeam();
  d.players = players([
    { firstName: 'Fine', lastName: 'Player', dob: dobAtCutoffAge(15) },
    { firstName: 'Bad', lastName: 'Player', dob: dobAtCutoffAge(30) },
  ]);
  const r = V('team-registration', d);
  check('the second row is checked too, not just the first', r.ok === false && /Bad Player/.test(r.error), r.error);
}
{
  /* The boundary sweep from test-agegroups.js, run again but THROUGH
     validateSubmission() — this is what actually proves the two call sites
     agree, not just that each works alone. */
  check('every group’s boundary answer matches ageGroupCheck() when run through validateSubmission()',
    A_GROUPS.every((g) => {
      const lowest = Math.min(...g.ages);
      const dob = dobAtCutoffAge(lowest - 1);
      const expected = AG_CHECK(dob, g.name).status;
      const d = goodTeam(); d['age-group'] = g.name;
      d.players = players([{ firstName: 'P', lastName: 'One', dob }]);
      const r = V('team-registration', d);
      const gotBlocked = r.ok === false && /P One/.test(r.error || '');
      return expected === 'blocked' ? gotBlocked : r.ok === true;
    }));
}

/* ---- the browser and the server say the same sentence, for the age check too ---- */
{
  const page = readRepo('Quins JRT.dc.html').replace(/\r\n/g, '\n');
  /* _playerAgeCheck()'s blocked-message template, pulled out of the page
     rather than retyped — if the wording ever moves in the page this test
     must not need hand-editing to keep matching. */
  const m = /return \{\s*status: 'blocked',\s*message: `([\s\S]*?)`,\s*\};/.exec(page);
  check('the blocked-message template was found in the page', !!m);
  if (m) {
    const d = goodTeam();
    d.players = players([{ firstName: 'Wrong', lastName: 'Age', dob: dobAtCutoffAge(30) }]);
    const r = V('team-registration', d);
    /* Build the expected sentence by substituting the same template's
       placeholders the same way ageGroupCheck() does, and check the server's
       refusal ends with EXACTLY that text. */
    const groupName = 'U16B Contact';
    const info = AG.AGE_GROUP_BY_NAME[groupName];
    const expected = m[1]
      .replace(/\$\{f\.ageGroup\}/g, groupName)
      .replace(/\$\{fmtAges\(info\.ages\)\}/g, AG.fmtAges(info.ages))
      .replace(/\$\{cutoffAge\.years\}/g, '30');
    check('…and the server ends with that exact sentence', (r.error || '').endsWith(expected), `got: ${r.error}\nwant suffix: ${expected}`);
  }
}

/* ---- length caps ------------------------------------------------------ */

eq('a field is capped at 200 characters', I.MAX_FIELD_CHARS, 200);
eq('notes get more room', I.MAX_NOTES_CHARS, 2000);
{
  const at = goodTeam(); at['head-coach-name'] = 'x'.repeat(200);
  check('exactly 200 is allowed', V('team-registration', at).ok === true);
  const over = goodTeam(); over['head-coach-name'] = 'x'.repeat(201);
  const r = V('team-registration', over);
  check('201 is not', r.ok === false);
  eq('…and the field is named', r.field, 'head-coach-name');
  check('…in words a coach can act on', /head coach/i.test(r.error || ''), r.error);
}
{
  const at = goodTeam(); at.notes = 'x'.repeat(2000);
  check('2000 characters of notes are allowed', V('team-registration', at).ok === true);
  const over = goodTeam(); over.notes = 'x'.repeat(2001);
  check('2001 are not', V('team-registration', over).ok === false);
}
{
  const over = goodPlayer(); over['medical-notes'] = 'x'.repeat(2001);
  check('medical notes get the longer allowance too, and a limit',
    V('player-registration', over).ok === false);
  const at = goodPlayer(); at['medical-notes'] = 'x'.repeat(2000);
  check('…2000 of them being fine', V('player-registration', at).ok === true);
}
{
  /* The squad list is JSON and legitimately long, so it has its own ceiling —
     but it still has one. Without it the only limit on a request is the body
     size, and this is a public endpoint.

     lastName and dob are filled in and age-appropriate so this row is refused
     for exactly ONE reason — its length — rather than also tripping the
     roster age check (sub-project 2) for a missing dob, which would make this
     assertion pass even with the real ceiling deleted. */
  const over = goodTeam();
  over.players = JSON.stringify([{ firstName: 'x'.repeat(9000), lastName: 'Player', dob: '2011-01-01' }]);
  check('a squad list cannot be unbounded', V('team-registration', over).ok === false);
}

/* ---- the honeypot ----------------------------------------------------- */

/* ACCEPTED, NOT REFUSED. A bot told "no" tries again with the field blank. A
   bot told "thank you" goes away. Anything that behaves differently for a
   filled honeypot than for a real submission — a different status, a different
   message, a different shape — hands it the answer. */
{
  const d = goodTeam(); d['bot-field'] = 'i am a robot';
  const r = V('team-registration', d);
  check('a filled honeypot is ACCEPTED', r.ok === true);
  check('…but marked to be thrown away', r.drop === true);
  check('…and says nothing that would tell a bot why', !r.error);
}
{
  const d = goodPlayer(); d['bot-field'] = 'x';
  const r = V('player-registration', d);
  check('the player form has one too', r.ok === true && r.drop === true);
}
{
  const d = goodTeam(); d['bot-field'] = '';
  check('an empty honeypot is what a real browser sends', V('team-registration', d).drop !== true);
  const d2 = goodTeam();
  check('…and so is no honeypot at all', V('team-registration', d2).drop !== true);
}
/* A filled honeypot short-circuits BEFORE the other rules, so a bot cannot
   learn the validation rules by filling it and reading the errors back. */
{
  const d = goodTeam(); d['bot-field'] = 'x'; delete d.club; d.players = roster(99);
  const r = V('team-registration', d);
  check('a filled honeypot is accepted even when everything else is wrong', r.ok === true && r.drop === true);
  check('…and still explains nothing', !r.error);
}

/* ---- junk ------------------------------------------------------------- */

check('an unknown form is refused rather than validated', I.validateSubmission('nope', {}).ok === false);
check('no data at all is refused, not thrown on', I.validateSubmission('team-registration', {}).ok === false);
check('null data is refused, not thrown on', I.validateSubmission('team-registration', null).ok === false);

/* ====================================================================== */
section('The browser and the server say the same sentence');

/* THE test-venue-panel.js PATTERN, and it exists because two hand-written
   copies of one rule always drift. If they diverge, a coach either gets a
   refusal the page never warned about, or the page blocks something the server
   would have taken — and neither is debuggable from the outside.

   Read out of the page, not retyped, so a change on either side breaks this. */
{
  const page = readRepo('Quins JRT.dc.html').replace(/\r\n/g, '\n');

  const teamRequiredMsg = "Please fill in club, age group, preferred pool, head coach name and head coach email.";
  check('the page still uses the team required-fields sentence',
    page.indexOf(teamRequiredMsg) >= 0, 'not found in the page');
  const d1 = goodTeam(); delete d1.club;
  eq('…and the server says exactly it', V('team-registration', d1).error, teamRequiredMsg);

  const playerRequiredMsg = "Please fill in the player name, date of birth, club, parent name, parent email and an emergency contact (name and mobile).";
  check('the page still uses the player required-fields sentence',
    page.indexOf(playerRequiredMsg) >= 0, 'not found in the page');
  const d2 = goodPlayer(); delete d2.dob;
  eq('…and the server says exactly it', V('player-registration', d2).error, playerRequiredMsg);

  const consentMsg = "Please read and agree to the Medical Declaration & Consent before submitting.";
  check('the page still uses the consent sentence', page.indexOf(consentMsg) >= 0, 'not found in the page');
  const d3 = goodPlayer(); d3.consent = 'No';
  eq('…and the server says exactly it', V('player-registration', d3).error, consentMsg);

  /* The cap sentence is built from a template on both sides, so the check is
     that the template is still the same shape. */
  const capTemplate = 'squads are a maximum of ${cap} players and you have listed ${f.players.length}. Please remove ${over}.';
  check('the page still builds the cap sentence the same way',
    page.indexOf(capTemplate) >= 0, 'the template moved — the server copy must follow');
}

/* ====================================================================== */
section('Rate limiting');

/* THE THIRD THING NETLIFY FORMS WAS DOING THAT NOBODY CHOSE. Without it the
   gateway is a public endpoint that appends unbounded rows to a sheet of
   children's data and sends unbounded mail from admin@adhjrt.com — and the
   recipient address comes out of the request body, which makes it a relay on
   our own domain.

   ⚠️ IT FAILS OPEN. If the counter store is unavailable the submission is
   ALLOWED. Losing a real registration because a blob read hiccupped is far
   worse than the abuse it would have prevented, and the site password is still
   in front of all of this. That is a deliberate trade and it is asserted. */

const R = require(path.join(repoRoot(), 'netlify', 'functions', '_ratelimit.js'));

/* A store that behaves like a Netlify blob store: get(key,{type:'json'}) and
   setJSON(key, value). `fail` makes every call throw, like an outage. */
function fakeStore(seed, fail) {
  const data = { ...(seed || {}) };
  return {
    calls: 0,
    async get(key) { this.calls += 1; if (fail) throw new Error('store down'); return data[key] === undefined ? null : data[key]; },
    async setJSON(key, v) { if (fail) throw new Error('store down'); data[key] = v; },
    peek(key) { return data[key]; },
  };
}

const T0 = 1790000000000;               // an arbitrary fixed instant
const HOUR = 60 * 60 * 1000;

eq('twenty an hour', R.MAX_PER_WINDOW, 20);
eq('the window is an hour', R.WINDOW_MS, HOUR);
/* A club secretary entering a whole age group by hand is the legitimate heavy
   user. Twenty an hour is far past that and far short of useful abuse. */
check('the limit is comfortably above one age group entered by hand', R.MAX_PER_WINDOW >= 15);

/* ---- counting --------------------------------------------------------- */

{
  const store = fakeStore();
  const seen = [];
  for (let i = 0; i < 25; i += 1) seen.push(await R.checkRate(store, '1.2.3.4', T0));
  check('the first one is allowed', seen[0].ok === true);
  check('the twentieth is allowed', seen[19].ok === true);
  check('the twenty-first is not', seen[20].ok === false);
  check('and neither is anything after it', seen.slice(20).every((r) => r.ok === false));
  eq('exactly twenty got through', seen.filter((r) => r.ok).length, 20);
}

/* A refusal has to tell the caller how long to wait, or the only honest thing
   it can say to a coach is "try again at some point". */
{
  const store = fakeStore();
  for (let i = 0; i < 20; i += 1) await R.checkRate(store, '1.2.3.4', T0);
  const r = await R.checkRate(store, '1.2.3.4', T0 + 60000);   // a minute in
  check('refused', r.ok === false);
  check('…and says how long is left', r.retryAfterSecs > 0);
  eq('…which is the rest of the hour', r.retryAfterSecs, 3540);
  check('the number is whole seconds, not a fraction', Number.isInteger(r.retryAfterSecs));
}

/* ---- the window rolls over -------------------------------------------- */

{
  const store = fakeStore();
  for (let i = 0; i < 20; i += 1) await R.checkRate(store, '1.2.3.4', T0);
  check('blocked at the end of the hour', (await R.checkRate(store, '1.2.3.4', T0 + HOUR - 1)).ok === false);
  check('allowed again the moment the hour is up', (await R.checkRate(store, '1.2.3.4', T0 + HOUR)).ok === true);
  check('…and the count started over, not carried on',
    (await R.checkRate(store, '1.2.3.4', T0 + HOUR + 1)).ok === true);
}

/* THE WINDOW IS ANCHORED TO THE FIRST HIT, NOT THE LAST. A fixed window, not a
   sliding one. Twenty hits all at the same instant cannot tell the two apart —
   which is why the check above did not catch a fault that pushed the start
   forward on every write. Spreading them out is what shows it: with a sliding
   window, continuous traffic means the hour never elapses and an address stays
   blocked for as long as it keeps trying. */
{
  const store = fakeStore();
  for (let i = 0; i < 20; i += 1) await R.checkRate(store, '1.2.3.4', T0 + i * 60000); // one a minute
  /* `|| {}` — a fault that changes the key makes this undefined, and reaching
     into it throws and takes the rest of the file with it. Report, do not die. */
  eq('the window still starts at the FIRST hit', (store.peek('ratelimit/1.2.3.4') || {}).windowStart, T0);
  check('blocked at the twenty-first', (await R.checkRate(store, '1.2.3.4', T0 + 20 * 60000)).ok === false);
  check('…and freed one hour after the FIRST hit, not the last',
    (await R.checkRate(store, '1.2.3.4', T0 + HOUR)).ok === true);
  eq('…and the new window starts then', (store.peek('ratelimit/1.2.3.4') || {}).windowStart, T0 + HOUR);
}

/* A clock that goes backwards — a retry landing on a different instance, or a
   stored window from the future — must not lock somebody out indefinitely. */
{
  const store = fakeStore({ 'ratelimit/1.2.3.4': { count: 20, windowStart: T0 + HOUR * 5 } });
  check('a window stamped in the future is treated as stale, not as a lock-out',
    (await R.checkRate(store, '1.2.3.4', T0)).ok === true);
}

/* ---- one bucket per IP ------------------------------------------------- */

{
  const store = fakeStore();
  for (let i = 0; i < 20; i += 1) await R.checkRate(store, '1.2.3.4', T0);
  check('one address being noisy does not block another',
    (await R.checkRate(store, '5.6.7.8', T0)).ok === true);
  check('…and the noisy one is still blocked', (await R.checkRate(store, '1.2.3.4', T0)).ok === false);
}

/* No IP at all shares ONE bucket rather than skipping the check. Skipping would
   make "send no IP header" the way round the limit. */
{
  const store = fakeStore();
  for (let i = 0; i < 20; i += 1) await R.checkRate(store, '', T0);
  check('a missing address is still counted', (await R.checkRate(store, '', T0)).ok === false);
  check('…and null is the same bucket', (await R.checkRate(store, null, T0)).ok === false);
  check('…while a real address is unaffected', (await R.checkRate(store, '1.2.3.4', T0)).ok === true);
}

/* The key is namespaced, because this store also holds the venue layout, the
   registration window and the block positions. */
{
  const store = fakeStore();
  await R.checkRate(store, '1.2.3.4', T0);
  check('the counter is stored under a ratelimit/ key', !!store.peek('ratelimit/1.2.3.4'), Object.keys(store).join());
  check('…and nothing else was written',
    Object.keys(store.peek('ratelimit/1.2.3.4') || {}).sort().join() === 'count,windowStart');
}

/* An address is not a free-form key — it comes from a request header. A store
   this shared holds the venue layout and the registration window too, so a
   header containing a slash must not be able to write to a key of its choosing. */
{
  const store = fakeStore();
  await R.checkRate(store, '../../venue', T0);
  check('a slashed address cannot escape the namespace', store.peek('venue') === undefined);
  check('…nor write outside ratelimit/ at all',
    Object.keys(store.peek('ratelimit/.._.._venue') || {}).length === 2, R.keyFor('../../venue'));
  /* Dots survive because they are legitimate in an address; only the slashes
     are replaced, and without a slash ".." cannot traverse anything. */
  eq('…because every slash is replaced', R.keyFor('../../venue'), 'ratelimit/.._.._venue');
  check('no key can contain a slash after the prefix',
    ['../../x', 'a/b', '\\\\srv\\share', 'a?b=c', 'a b'].every((v) => R.keyFor(v).indexOf('/', 'ratelimit/'.length) < 0));
  eq('a normal IPv4 address is left alone', R.keyFor('1.2.3.4'), 'ratelimit/1.2.3.4');
  eq('an IPv6 address survives too', R.keyFor('2001:db8::1'), 'ratelimit/2001:db8::1');
  eq('an empty address gets one shared bucket', R.keyFor(''), 'ratelimit/unknown');
  eq('…and so does junk', R.keyFor(null), 'ratelimit/unknown');
  check('a very long header cannot make a very long key', R.keyFor('x'.repeat(500)).length < 80);
}

/* ---- failing open ------------------------------------------------------ */

/* These cases deliberately break the store, and _ratelimit.js deliberately
   warns when that happens. Left alone that is over a hundred lines of expected
   noise in every run — and a real FAIL buried in expected noise is a FAIL
   nobody reads. Silenced only for this block, and restored after. */
const realWarn = console.warn;
console.warn = () => {};

{
  const store = fakeStore({}, true);
  const r = await R.checkRate(store, '1.2.3.4', T0);
  check('a store outage ALLOWS the submission', r.ok === true);
  check('…and says it could not count', r.degraded === true);
  check('…without pretending to know a retry time', !r.retryAfterSecs);
}
{
  const r = await R.checkRate(null, '1.2.3.4', T0);
  check('no store at all also fails open', r.ok === true && r.degraded === true);
}
{
  /* A write that fails after a successful read must not refuse either — the
     count is lost, which is the same cost as the outage above. */
  const store = {
    async get() { return { count: 1, windowStart: T0 }; },
    async setJSON() { throw new Error('write failed'); },
  };
  check('a failed write still allows the submission', (await R.checkRate(store, '1.2.3.4', T0)).ok === true);
}
{
  /* Junk in the stored value is the same as no value — start a fresh window
     rather than throwing on a shape nobody wrote.

     ⚠️ NO INJECTED FAULT FOR THESE. Removing either shape guard in readWindow()
     is observationally identical: a non-object gives `undefined.count` -> NaN,
     which the finite check already rejects, and a numeric string coerces to the
     same comparison result. They are belt and braces for readability, not
     load-bearing, and a fault for them would be something adjacent to a mistake
     rather than the mistake — which this project has already learned not to
     write. The guards that ARE load-bearing (the expiry and the future-stamp
     check) each have one. */
  const store = fakeStore({ 'ratelimit/1.2.3.4': 'not an object' });
  check('junk in the store starts a fresh window', (await R.checkRate(store, '1.2.3.4', T0)).ok === true);
  const store2 = fakeStore({ 'ratelimit/1.2.3.4': { count: 'lots', windowStart: 'whenever' } });
  check('…as does a value of the wrong shape', (await R.checkRate(store2, '1.2.3.4', T0)).ok === true);
}

console.warn = realWarn;
/* Proof the silencing was scoped and did not leave the suite deaf: a later
   fault that warns must still be visible on the console. */
check('console.warn is restored afterwards', console.warn === realWarn);

/* ====================================================================== */
section('handleSubmission — the whole flow, with nothing real attached');

/* Every dependency is injected, so this drives the ACTUAL order of operations
   without a Google client, a mailer or a blob store. That is not a testing
   convenience: a fresh clone has no node_modules, so anything requiring
   googleapis cannot be loaded by a test at all. submit-registration.js is a
   thin adapter that builds the real ones and calls this. */

function deps(over) {
  const calls = { appended: [], mailed: [], parked: [], logs: [] };
  const base = {
    now: T0,
    ip: '1.2.3.4',
    rateStore: fakeStore(),
    loadRegistration: async () => ({ opensAt: null, closesAt: null, mode: 'open' }),
    registrationState: (settings) => ({ open: settings.mode !== 'closed', phase: 'open', mode: settings.mode }),
    readTeamsSheet: async () => [],
    appendRow: async (form, row) => { calls.appended.push({ form, row }); },
    sendConfirmation: async (form, data) => { calls.mailed.push({ form, data }); return { sent: true, count: 1 }; },
    parkFailed: async (form, data, err) => { calls.parked.push({ form, data, err }); },
    log: (m) => { calls.logs.push(String(m)); },
  };
  return { d: { ...base, ...(over || {}) }, calls };
}

/* handleSubmission must NEVER reject. It runs behind a public HTTP handler, and
   a rejection there is a 500 with no explanation and nothing logged. A thrown
   error is turned into a reportable result here rather than being allowed to
   kill the file — otherwise a fault that makes it throw looks "caught" while
   every check after it silently never runs. */
const H = (body, over) => {
  const { d, calls } = deps(over);
  return I.handleSubmission(body, d)
    .then((r) => ({ r, calls }))
    .catch((err) => ({ r: { status: 'THREW', body: { error: String(err && err.message) } }, calls, threw: true }));
};

/* `|| {}` on every calls.x[0] below. A fault that stops a row being appended
   makes these undefined, and reaching in throws — which kills the file and
   means every check after it silently never runs. The count check above is the
   one that should report it. */

/* ---- the happy path ---------------------------------------------------- */

{
  const { r, calls } = await H({ form: 'team-registration', data: goodTeam() });
  eq('a good team registration is accepted', r.status, 200);
  check('…and says so', r.body.ok === true);
  eq('exactly one row was appended', calls.appended.length, 1);
  eq('…to the team sheet', (calls.appended[0] || {}).form, 'team-registration');
  eq('exactly one email was sent', calls.mailed.length, 1);
  eq('nothing was parked', calls.parked.length, 0);
  check('the team code comes back to the coach', typeof r.body.teamCode === 'string' && r.body.teamCode.length > 0);

  /* THE ROW MUST BE WHAT THE READERS EXPECT. If handleSubmission built its own
     array the writer and the readers would be back to disagreeing, which is the
     whole thing Task 2 ended. */
  eq('the row is the one teamRow() builds', ((calls.appended[0] || {}).row || []).length, I.TEAM_COLUMNS.length);
  eq('…with the generated code in the code column',
    ((calls.appended[0] || {}).row || [])[I.TEAM_COLUMNS.indexOf('team-code')], r.body.teamCode);
  check('…and a real timestamp in the first',
    /^\d{4}-\d{2}-\d{2}T/.test(((calls.appended[0] || {}).row || [])[0]), ((calls.appended[0] || {}).row || [])[0]);

  /* The email template prints the team code, so it has to be on the data by
     the time the mailer sees it. */
  eq('the mailer is told the team code', ((calls.mailed[0] || {}).data || {})['team-name'], r.body.teamCode);
}

{
  const { r, calls } = await H({ form: 'player-registration', data: goodPlayer() });
  eq('a good player registration is accepted', r.status, 200);
  eq('one row', calls.appended.length, 1);
  eq('…to the player sheet', (calls.appended[0] || {}).form, 'player-registration');
  eq('one email', calls.mailed.length, 1);
  check('no team code for a player', r.body.teamCode === undefined);
  eq('the row is the one playerRow() builds', ((calls.appended[0] || {}).row || []).length, I.PLAYER_COLUMNS.length);
}

/* ---- the order things happen in ---------------------------------------- */

/* Rate limit FIRST: it is the only thing standing between a public endpoint and
   an unbounded number of sheet writes and emails, so it must not sit behind
   anything that costs money or a round trip. */
{
  const store = fakeStore();
  for (let i = 0; i < 20; i += 1) await R.checkRate(store, '1.2.3.4', T0);
  const { r, calls } = await H({ form: 'team-registration', data: goodTeam() }, { rateStore: store });
  eq('a rate-limited submission is refused', r.status, 429);
  eq('nothing was written', calls.appended.length, 0);
  eq('nothing was emailed', calls.mailed.length, 0);
  check('…and it says when to try again', r.body.retryAfterSecs > 0);
  check('…in words a coach can act on', /try again/i.test(r.body.error || ''), r.body.error);
}
{
  /* Fail-open reaches all the way out: a broken counter must not cost a
     registration. Silenced the same way as the rate-limit block above — the
     warning is expected here, and expected noise is where a real FAIL hides. */
  const quiet = console.warn; console.warn = () => {};
  const { r, calls } = await H({ form: 'team-registration', data: goodTeam() },
    { rateStore: fakeStore({}, true) });
  console.warn = quiet;
  eq('a broken counter still lets a registration through', r.status, 200);
  eq('…and it is written', calls.appended.length, 1);
}

/* An unknown form is refused before anything else happens. */
{
  const { r, calls } = await H({ form: 'not-a-form', data: {} });
  eq('an unknown form is a 400', r.status, 400);
  eq('nothing written', calls.appended.length, 0);
}
['', null, undefined, 42].forEach(async (f) => {
  const { r } = await H({ form: f, data: {} });
  eq(`a form of "${String(f)}" is a 400`, r.status, 400);
});
{
  const { r } = await H(null);
  eq('no body at all is a 400', r.status, 400);
  const { r: r2 } = await H('a string');
  eq('a string body is a 400', r2.status, 400);
}

/* ---- the honeypot ------------------------------------------------------ */

/* INDISTINGUISHABLE FROM SUCCESS. Same status, same body shape. A different
   status, a different message or a different set of keys hands the bot the
   answer and it comes back with the field blank. */
{
  const d = goodPlayer(); d['bot-field'] = 'i am a robot';
  const { r, calls } = await H({ form: 'player-registration', data: d });
  eq('a bot gets 200', r.status, 200);
  check('…and ok: true', r.body.ok === true);
  eq('nothing was written', calls.appended.length, 0);
  eq('nothing was emailed', calls.mailed.length, 0);
  const real = await H({ form: 'player-registration', data: goodPlayer() });
  eq('the body is the same shape as a real success',
    Object.keys(r.body).sort().join(), Object.keys(real.r.body).sort().join());
}
{
  /* And it never reaches the window read, so a bot cannot even make us do I/O. */
  let reads = 0;
  const d = goodTeam(); d['bot-field'] = 'x';
  const { calls } = await H({ form: 'team-registration', data: d },
    { loadRegistration: async () => { reads += 1; return { mode: 'open' }; } });
  eq('a bot does not make us read the registration window', reads, 0);
  eq('…nor the teams sheet', calls.appended.length, 0);
}

/* ---- validation -------------------------------------------------------- */

{
  const d = goodTeam(); delete d.club;
  const { r, calls } = await H({ form: 'team-registration', data: d });
  eq('an invalid submission is a 400', r.status, 400);
  eq('…with the coach-facing sentence', r.body.error,
    'Please fill in club, age group, preferred pool, head coach name and head coach email.');
  eq('…and the field, so the page can point at it', r.body.field, 'club');
  eq('nothing written', calls.appended.length, 0);
  eq('nothing emailed', calls.mailed.length, 0);
}
{
  const d = goodTeam(); d.players = roster(19);
  const { r } = await H({ form: 'team-registration', data: d });
  eq('an oversized squad is refused by the SERVER now', r.status, 400);
  eq('…with the browser’s own sentence', r.body.error,
    'U16B Contact squads are a maximum of 18 players and you have listed 19. Please remove 1.');
}

/* ---- the registration window ------------------------------------------- */

/* This is sub-project 3's remaining "three lines". registrationState() was
   built, shared with the front end and tested at every boundary in July; all
   that was ever missing was somewhere to call it from. */
{
  const { r, calls } = await H({ form: 'team-registration', data: goodTeam() },
    { loadRegistration: async () => ({ mode: 'closed' }) });
  eq('a submission outside the window is refused', r.status, 403);
  check('…in words', /not open/i.test(r.body.error || ''), r.body.error);
  eq('nothing written', calls.appended.length, 0);
  eq('nothing emailed', calls.mailed.length, 0);
}
{
  /* Forcing the window open has to let a real test registration through end to
     end, or it is not a test. */
  const { r, calls } = await H({ form: 'team-registration', data: goodTeam() },
    { loadRegistration: async () => ({ mode: 'open' }) });
  eq('forced open lets a real submission through', r.status, 200);
  eq('…and it is written', calls.appended.length, 1);
}
{
  /* A window that cannot be read must FAIL CLOSED. Unlike the rate limiter:
     there, allowing costs nothing; here, allowing means accepting registrations
     after the squads were supposed to be fixed. */
  const { r, calls } = await H({ form: 'team-registration', data: goodTeam() },
    { loadRegistration: async () => { throw new Error('blobs down'); } });
  eq('an unreadable window refuses rather than guessing', r.status, 403);
  eq('nothing written', calls.appended.length, 0);
}

/* ---- the team code ----------------------------------------------------- */

{
  const { r, threw } = await H({ form: 'team-registration', data: goodTeam() },
    { readTeamsSheet: async () => { throw new Error('sheet read failed'); } });
  check('a failed numbering read does not throw out of handleSubmission', !threw, r.body.error);
  eq('a failed numbering read does not cost the registration', r.status, 200);
  check('…and a code is still issued', typeof r.body.teamCode === 'string' && r.body.teamCode.length > 0);
}
/* Nothing a dependency can do may turn into a rejection. */
{
  const throwers = ['appendRow', 'sendConfirmation', 'parkFailed', 'loadRegistration', 'readTeamsSheet'];
  for (const name of throwers) {
    const { threw } = await H({ form: 'team-registration', data: goodTeam() },
      { [name]: async () => { throw new Error('boom'); } });
    check(`a throwing ${name} does not reject`, !threw);
  }
  const { threw } = await H({ form: 'team-registration', data: goodTeam() },
    { registrationState: () => { throw new Error('boom'); } });
  check('a throwing registrationState does not reject', !threw);
}

/* ---- when the sheet write fails ---------------------------------------- */

{
  const { r, calls } = await H({ form: 'player-registration', data: goodPlayer() },
    { appendRow: async () => { throw new Error('sheets down'); } });
  eq('a failed write is a 500, not a quiet success', r.status, 500);
  check('…and tells the coach nothing has been registered',
    /nothing has been registered/i.test(r.body.error || ''), r.body.error);
  check('…and where to go', /admin@adhjrt\.com/.test(r.body.error || ''));
  eq('the submission is parked so it can be replayed', calls.parked.length, 1);
  /* NO EMAIL. A confirmation for a registration that is not in the sheet is
     worse than no confirmation: the coach stops chasing it. */
  eq('no confirmation is sent for something that was not saved', calls.mailed.length, 0);
}

/* ---- when the email fails ---------------------------------------------- */

{
  const { r, calls } = await H({ form: 'player-registration', data: goodPlayer() },
    { sendConfirmation: async () => { throw new Error('graph down'); } });
  eq('a failed email is still a success', r.status, 200);
  eq('…because the row is the record, and it is there', calls.appended.length, 1);
  eq('…and nothing is parked, because nothing was lost', calls.parked.length, 0);
}
{
  const { r } = await H({ form: 'player-registration', data: goodPlayer() },
    { sendConfirmation: async () => ({ sent: false, reason: 'no template' }) });
  eq('a mailer that declines is still a success', r.status, 200);
}
{
  /* Order matters: the row first, always. A mail failure must never make a
     caller retry into a duplicate row. */
  const order = [];
  await H({ form: 'player-registration', data: goodPlayer() }, {
    appendRow: async () => { order.push('append'); },
    sendConfirmation: async () => { order.push('mail'); return { sent: true }; },
  });
  eq('the row is written before the email is sent', order.join(), 'append,mail');
}

/* ---- nothing about a registration reaches a log ------------------------ */

/* THE CHECK THAT STOPS A FUTURE EDIT LOGGING A CHILD'S MEDICAL NOTES. Every
   field carries a unique sentinel; no log line may contain any of it, down
   every path including the failures. */
{
  const SENTINEL = 'ZZSENTINELZZ';
  /* ⚠️ ONLY THE FREE-TEXT FIELDS. The first version of this poisoned every
     field including `age-group`, `dob` and `consent` — which made the
     submission fail VALIDATION every time, so it never reached the write, the
     mailer or the parking, and the check quietly proved nothing. It passed
     against a fault that logged the entire submission as JSON. Found by
     injecting that fault. */
  const KEEP_VALID = ['age-group', 'dob', 'consent', 'play-up-consent', 'preferred-pool'];
  const poison = (o) => {
    const out = { ...o };
    Object.keys(out).forEach((k) => {
      if (typeof out[k] === 'string' && KEEP_VALID.indexOf(k) < 0) out[k] = SENTINEL + k;
    });
    return out;
  };
  /* Prove the poisoned submission is still ACCEPTED, or the paths below are
     not the paths they claim to be. */
  {
    const { r } = await H({ form: 'player-registration', data: poison(goodPlayer()) });
    eq('the poisoned submission still gets all the way through', r.status, 200);
  }
  const paths = [
    ['a success', {}],
    ['a failed write', { appendRow: async () => { throw new Error('x'); } }],
    ['a failed email', { sendConfirmation: async () => { throw new Error('x'); } }],
    ['a closed window', { loadRegistration: async () => ({ mode: 'closed' }) }],
    ['an unreadable window', { loadRegistration: async () => { throw new Error('x'); } }],
    ['a failed numbering read', { readTeamsSheet: async () => { throw new Error('x'); } }],
  ];
  for (const [name, over] of paths) {
    const { calls } = await H({ form: 'player-registration', data: poison(goodPlayer()) }, over);
    const leaked = calls.logs.filter((l) => l.indexOf(SENTINEL) >= 0);
    check(`no registration data is logged on ${name}`, leaked.length === 0, leaked[0]);
  }
  /* A REFUSAL is its own path, and the one most likely to grow a "helpful"
     log line carrying the offending value. It needs a field that is PRESENT
     and invalid — a missing field has no value to leak. */
  {
    const d2 = poison(goodPlayer());
    d2['medical-notes'] = (SENTINEL + '-').repeat(300);        // over the 2000 cap
    const { r, calls } = await H({ form: 'player-registration', data: d2 });
    eq('…and that path really is a refusal', r.status, 400);
    eq('…on the field we made too long', r.body.field, 'medical-notes');
    const leaked = calls.logs.filter((l) => l.indexOf(SENTINEL) >= 0);
    check('no registration data is logged on a refusal', leaked.length === 0, leaked[0]);
  }

  /* And an unknown field is logged by NAME, which is the whole point of
     cleanSubmission reporting the drop. */
  const d = poison(goodPlayer()); d['some-unknown-field'] = SENTINEL + 'value';
  const { calls } = await H({ form: 'player-registration', data: d });
  check('a dropped field IS logged, by name',
    calls.logs.some((l) => l.indexOf('some-unknown-field') >= 0), calls.logs.join(' | '));
  check('…but never its value',
    !calls.logs.some((l) => l.indexOf(SENTINEL) >= 0), calls.logs.join(' | '));
}

/* ====================================================================== */
section('The function itself stays thin');

/* submit-registration.js CANNOT BE LOADED BY A TEST. It requires googleapis,
   and a fresh clone has no node_modules. That is exactly why it must contain no
   decisions — a rule added there is a rule nothing can check.

   So these are text checks, and they are narrow on purpose: they assert the
   SPLIT holds, not what the file does. What it does is handleSubmission's job
   and has 400 checks against it. */
{
  const fn = readRepo(path.join('netlify', 'functions', 'submit-registration.js')).replace(/\r\n/g, '\n');
  const code = fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  check('it hands off to handleSubmission', /handleSubmission\(/.test(code));
  check('…and does not decide anything itself', !/validateSubmission|cleanSubmission|checkRate|squadCap/.test(code));
  check('…nor build a sheet row by hand', !/teamRow|playerRow/.test(code));
  check('…nor carry its own copy of the columns', !/submittedAt.*age-group/.test(code));

  check('POST only', /event\.httpMethod !== 'POST'/.test(code));
  check('…and anything else is a 405', /405/.test(code));
  /* The GUARD, not the constant. A first version of this looked for
     'MAX_BODY_BYTES' before 'JSON.parse' — which the const declaration at the
     top satisfies all on its own, so deleting the actual check passed. */
  check('the body is measured at all', /Buffer\.byteLength\(/.test(code));
  check('…against the limit', /> MAX_BODY_BYTES/.test(code));
  check('…and BEFORE it is parsed',
    code.indexOf('Buffer.byteLength(') >= 0
    && code.indexOf('Buffer.byteLength(') < code.indexOf('JSON.parse'));
  check('…and an oversized body is refused rather than trimmed',
    /> MAX_BODY_BYTES[\s\S]{0,140}return json\(400/.test(code));
  check('a body that will not parse is a 400, not a crash', /catch[\s\S]{0,120}400/.test(code));

  /* The rate-limit bucket must come from Netlify's own header. x-forwarded-for
     is caller-supplied, so anyone could pick their own bucket. */
  check('the address comes from Netlify’s header', /x-nf-client-connection-ip/.test(code));
  check('…and not from x-forwarded-for', !/x-forwarded-for/i.test(code));

  check('every reply is no-store', /'Cache-Control': 'no-store'/.test(code));
  check('there is no CORS header — same origin only',
    !/Access-Control-Allow/i.test(code));

  /* RAW is load-bearing and has been fixed once already. */
  check('the append is RAW', /valueInputOption: 'RAW'/.test(code));
  check('…and USER_ENTERED has not crept back', !/USER_ENTERED/.test(code));

  /* The dead letter has to be namespaced and flagged, because of what is in it. */
  check('a failed submission is parked under its own key', /failed-submissions\//.test(code));
  check('…and the file says out loud what that blob contains',
    /CHILDREN'S PERSONAL DATA/i.test(fn), 'the warning comment is missing');

  /* The catch-all must not log the submission. */
  check('the catch-all logs the message only', /console\.error\([^)]*err && err\.message/.test(code));
  check('…and never the event or the body',
    !/console\.(error|log)\([^)]*\b(event|body|raw)\b/.test(code));

  check('the log helper passes a string through, nothing structured',
    /log: \(message\) =>/.test(code));
}

/* ====================================================================== */
section('The Google client lives in one place now');

/* privateKey(), getAuth() and firstSheetName() were written out THREE times,
   and the gateway would have made it four. The private-key repair is the kind
   of thing you fix once, at 2am, and must never fix again in a copy somebody
   forgot about. */
{
  const users = ['get-registrations.js', 'get-my-registrations.js', 'submit-registration.js'];
  users.forEach((f) => {
    const src = readRepo(path.join('netlify', 'functions', f)).replace(/\r\n/g, '\n');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    check(`${f} has no copy of privateKey()`, !/function privateKey\(/.test(code));
    check(`${f} has no copy of getAuth()`, !/function getAuth\(/.test(code));
    check(`${f} has no copy of firstSheetName()`, !/async function firstSheetName\(/.test(code));
    check(`${f} does not reach for googleapis directly`, !/require\('googleapis'\)/.test(code));
    check(`${f} asks _sheets.js instead`, /require\('\.\/_sheets'\)/.test(code));
  });

  const sheets = readRepo(path.join('netlify', 'functions', '_sheets.js')).replace(/\r\n/g, '\n');
  check('_sheets.js is where they live', /function privateKey\(/.test(sheets)
    && /function getAuth\(/.test(sheets) && /async function firstSheetName\(/.test(sheets));
  /* The readers get a narrower scope than the writer, so a bug in a reader
     cannot write to a sheet full of children's data. */
  check('there is a read-only auth as well as a writing one', /function getReadAuth\(/.test(sheets));
  check('…and it really is read-only', /spreadsheets\.readonly/.test(sheets));
  check('…while the writer is not', /'https:\/\/www\.googleapis\.com\/auth\/spreadsheets'/.test(sheets));
  const readers = ['get-registrations.js', 'get-my-registrations.js'];
  readers.forEach((f) => {
    const code = readRepo(path.join('netlify', 'functions', f)).replace(/\r\n/g, '\n');
    check(`${f} uses the read-only auth`, /getReadAuth\(\)/.test(code));
    check(`…and not the writing one`, !/[^d]getAuth\(\)/.test(code));
  });
  /* The private-key repair itself. Both breakages were real. */
  check('the quote-stripping repair survived the move', /k\.slice\(1, -1\)/.test(sheets));
  check('the newline repair survived too', /replace\(\/\\\\n\/g, '\\n'\)/.test(sheets));
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

}

main().then(() => summary('test-intake.js'));
