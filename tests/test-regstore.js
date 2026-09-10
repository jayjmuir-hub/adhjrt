/* tests/test-regstore.js
   The registration STORE — one write-once record per submission.
   Spec: claude/specs/spec-registration-store-sep-2026.md § 3, § 5. */
const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

const R = require(path.join(repoRoot(), 'netlify/functions/_regstore.js'));
const I = require(path.join(repoRoot(), 'netlify/functions/_intake.js'));

/* A fake with exactly the four calls the module uses, in @netlify/blobs' shape. */
function fakeStore(seed) {
  const m = new Map(Object.entries(seed || {}));
  return {
    m,
    async get(key, opts) { return m.has(key) ? JSON.parse(JSON.stringify(m.get(key))) : null; },
    async setJSON(key, obj) { m.set(key, JSON.parse(JSON.stringify(obj))); },
    async list({ prefix }) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix || '')).sort().map((key) => ({ key })) }; },
    async delete(key) { m.delete(key); },
  };
}

const T0 = Date.parse('2026-10-03T08:15:42.117Z');
const teamRow = (club, code, age) => I.teamRow({ club, 'age-group': age, 'team-name': code }, code, new Date(T0).toISOString());

section('Keys');
{
  const k = R.makeKey('player-registration', T0, 'k3f9qa');
  eq('key is <prefix>/<safe stamp>-<rand>', k, 'player/2026-10-03T08-15-42-117Z-k3f9qa');
  check('the stamp has no colon or dot (blob keys, Windows files)', !/[:.]/.test(k.split('/')[1]));
  const a = R.makeKey('team-registration', T0), b = R.makeKey('team-registration', T0);
  check('two keys in the same instant differ', a !== b);
  check('team prefix', a.startsWith('team/'));
  eq('club prefix', R.makeKey('club-registration', T0, 'abcdef').split('/')[0], 'club');
  check('keys sort in arrival order', R.makeKey('team-registration', T0, 'zzzzzz') < R.makeKey('team-registration', T0 + 1000, 'aaaaaa'));
}

section('Rehearsal flag');
{
  check('"Rehearsal Quins" is a rehearsal', R.isRehearsal('Rehearsal Quins'));
  check('case-insensitive', R.isRehearsal('rehearsal quins'));
  check('"Rehearsals FC" is NOT (whole word)', !R.isRehearsal('Rehearsals FC'));
  check('a real club is not', !R.isRehearsal('Abu Dhabi Harlequins'));
  check('empty is not', !R.isRehearsal(''));
  const rec = R.buildRecord({ form: 'team-registration', row: teamRow('Rehearsal Quins', 'REH1', 'U12 Mixed Contact'), nowMs: T0, club: 'Rehearsal Quins' });
  eq('record carries the flag', rec.rehearsal, true);
}

section('The record');
{
  const row = teamRow('Abu Dhabi Harlequins', 'ADH1', 'U12 Mixed Contact');
  const rec = R.buildRecord({ form: 'team-registration', row, nowMs: T0, club: 'Abu Dhabi Harlequins' });
  eq('format version 1', rec.v, 1);
  eq('form', rec.form, 'team-registration');
  eq('receivedAt is the server clock, ISO', rec.receivedAt, '2026-10-03T08:15:42.117Z');
  eq('row is the SHEET column order, untouched', rec.row, row);
  eq('the club column is where TEAM_COLUMNS says', rec.row[I.TEAM_COLUMNS.indexOf('club')], 'Abu Dhabi Harlequins');
  eq('not a rehearsal', rec.rehearsal, false);
  check('no supersedes unless given', !('supersedes' in rec));
  const fix = R.buildRecord({ form: 'team-registration', row, nowMs: T0, club: 'Abu Dhabi Harlequins', supersedes: 'team/x' });
  eq('supersedes is kept when given', fix.supersedes, 'team/x');
}

section('⚠️ Write once — the rule everything else leans on');
{
  const s = fakeStore();
  const rec = R.buildRecord({ form: 'player-registration', row: ['a'], nowMs: T0, club: 'X' });
  (async () => {
    R.writeOnce(s, 'player/k1', rec).then(async () => {
      eq('a fresh key is written', (await s.get('player/k1')).form, 'player-registration');
      let threw = null;
      try { await R.writeOnce(s, 'player/k1', { ...rec, row: ['CHANGED'] }); } catch (e) { threw = e; }
      check('a second write to the same key is REFUSED', !!threw && /exists/.test(threw.message));
      eq('…and the stored record is unchanged', (await s.get('player/k1')).row, ['a']);
      check('the module exposes no update/overwrite call', !('update' in R) && !('overwrite' in R) && !('set' in R));

      /* ---- listing ---- */
      const s2 = fakeStore();
      const older = R.buildRecord({ form: 'team-registration', row: teamRow('Abu Dhabi Harlequins', 'ADH1', 'U12 Mixed Contact'), nowMs: T0, club: 'Abu Dhabi Harlequins' });
      const newer = R.buildRecord({ form: 'team-registration', row: teamRow('Abu Dhabi Harlequins', 'ADH1', 'U12 Mixed Contact'), nowMs: T0 + 5000, club: 'Abu Dhabi Harlequins', supersedes: 'team/a' });
      const other = R.buildRecord({ form: 'team-registration', row: teamRow('Dubai Exiles', 'DEX1', 'U12 Mixed Contact'), nowMs: T0 + 1000, club: 'Dubai Exiles' });
      const pl = R.buildRecord({ form: 'player-registration', row: ['p'], nowMs: T0, club: 'Dubai Exiles' });
      await R.writeOnce(s2, 'team/a', older);
      await R.writeOnce(s2, 'team/b', other);
      await R.writeOnce(s2, 'team/c', newer);
      await R.writeOnce(s2, 'player/a', pl);

      const teams = await R.listRecords(s2, 'team-registration');
      eq('listRecords hides the SUPERSEDED record and keeps the rest, in key order', teams.map((e) => e.key), ['team/b', 'team/c']);
      eq('listRecords is per form', (await R.listRecords(s2, 'player-registration')).map((e) => e.key), ['player/a']);
      eq('listAll returns EVERY record including superseded (the snapshot needs them)', (await R.listAll(s2)).map((e) => e.key).sort(), ['player/a', 'team/a', 'team/b', 'team/c']);

      /* ---- numbering ---- */
      const rows = await R.teamRowsForNumbering(s2);
      eq('numbering rows are live team rows only, sheet shape', rows.length, 2);
      eq('…positions match what _teams.nextTeamCode reads (club at 1, code at 2, age at 3)', [rows[0][1], rows[0][2], rows[0][3]], ['Dubai Exiles', 'DEX1', 'U12 Mixed Contact']);

      /* ---- reader shaping ---- */
      const shaped = R.shapeForReaders(
        { teams: await R.listRecords(s2, 'team-registration'), players: await R.listRecords(s2, 'player-registration'), clubs: [] },
        { mapTeamRow: I.mapTeamRow, mapPlayerRow: I.mapPlayerRow, mapClubRow: I.mapClubRow });
      eq('teams shaped through the shared mapper', shaped.teams.map((t) => t.teamName), ['DEX1', 'ADH1']);
      eq('a non-rehearsal row has no marker', shaped.teams[0].rehearsal, false);
      const s3 = fakeStore();
      await R.writeOnce(s3, 'team/r', R.buildRecord({ form: 'team-registration', row: teamRow('Rehearsal Quins', 'REH1', 'U9 Mixed Contact'), nowMs: T0, club: 'Rehearsal Quins' }));
      const shaped3 = R.shapeForReaders({ teams: await R.listRecords(s3, 'team-registration'), players: [], clubs: [] }, { mapTeamRow: I.mapTeamRow, mapPlayerRow: I.mapPlayerRow, mapClubRow: I.mapClubRow });
      eq('a rehearsal row carries rehearsal: true for the organiser page', shaped3.teams[0].rehearsal, true);

      section('Dependency-free');
      const src = readRepo('netlify/functions/_regstore.js');
      check('requires no package (only ./ siblings and node built-ins)',
        !/require\(['"](?!\.\/|crypto|path|fs|os)[^'"]+['"]\)/.test(src));

      section('The front door writes the store, not a sheet');
      const door = readRepo('netlify/functions/submit-registration.js');
      check('requires _regstore', /require\(['"]\.\/_regstore['"]\)/.test(door));
      check('opens the registrations store by name', /blobStore\(STORE_NAME\)/.test(door));
      check('appendRow writes through writeOnce', /appendRow:[\s\S]*?writeOnce\(/.test(door));
      check('appendRow builds the record with the club for the rehearsal flag', /buildRecord\(\{[^}]*club/.test(door));
      check('readTeamsSheet counts store records', /readTeamsSheet:[\s\S]*?teamRowsForNumbering\(/.test(door));
      check('no sheet write remains on the front door', !/values\.append/.test(door));
      check('no sheet read remains on the front door', !/values\.get/.test(door));
      check('the dead letter (parkFailed) is untouched', /parkFailed:[\s\S]*?failed-submissions\//.test(door));

      section('The readers read the store, in the same shape');
      for (const f of ['get-registrations.js', 'get-my-registrations.js']) {
        const src = readRepo('netlify/functions/' + f);
        check(`${f} requires _regstore`, /require\(['"]\.\/_regstore['"]\)/.test(src));
        check(`${f} lists live records`, /listRecords\(/.test(src));
        check(`${f} shapes through the shared mappers`, /shapeForReaders\(/.test(src));
        check(`${f} no longer reads a sheet`, !/sheetsClient|firstSheetName|GOOGLE_SHEET_ID/.test(src));
        check(`${f} still resolves the session first`, /resolveSession\(event\)/.test(src));
      }
      const org = readRepo('netlify/functions/get-registrations.js');
      check('organiser reader still refuses non-organisers', /role !== 'organizer'/.test(org));
      check('organiser reader still answers clubsUnavailable', /clubsUnavailable/.test(org));
      const mine = readRepo('netlify/functions/get-my-registrations.js');
      check('manager reader still filters by the TOKEN age group, not the request', /session\.ageGroupId/.test(mine) && !/event\.body[\s\S]*ageGroup/.test(mine));

      summary('test-regstore.js');
    });
  })();
}
