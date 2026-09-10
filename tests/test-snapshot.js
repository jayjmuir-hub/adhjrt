/* tests/test-snapshot.js
   The emailed snapshot, its cadence, and the restore/delete PLANS the CLI
   tool runs. Spec § 6, § 7. */
const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');
const S = require(path.join(repoRoot(), 'netlify/functions/_snapshot.js'));
const R = require(path.join(repoRoot(), 'netlify/functions/_regstore.js'));
const I = require(path.join(repoRoot(), 'netlify/functions/_intake.js'));

const T0 = Date.parse('2026-10-03T08:15:42.117Z');
const teamRow = (club, code, age) => I.teamRow({ club, 'age-group': age, 'team-name': code, notes: '=HYPERLINK("x")' }, code, new Date(T0).toISOString());
const e = (key, form, club, extra) => ({ key, record: R.buildRecord({ form, row: form === 'team-registration' ? teamRow(club, 'X1', 'U9 Mixed Contact') : ['a', club], nowMs: T0, club, ...(extra || {}) }) });

const entries = [
  e('team/a', 'team-registration', 'Abu Dhabi Harlequins'),
  e('team/b', 'team-registration', 'Rehearsal Quins'),
  e('player/a', 'player-registration', 'Dubai Exiles'),
];

section('CSV cells are spreadsheet-safe');
eq('plain', S.csvCell('abc'), '"abc"');
eq('inner quotes doubled', S.csvCell('a"b'), '"a""b"');
eq('leading = is neutralised', S.csvCell('=1+1'), '"\'=1+1"');
eq('leading + is neutralised (phone numbers)', S.csvCell('+971500000000'), '"\'+971500000000"');
eq('leading - and @ too', [S.csvCell('-x'), S.csvCell('@x')], ['"\'-x"', '"\'@x"']);
eq('null is empty', S.csvCell(null), '""');

section('buildCsv');
{
  const csv = S.buildCsv('team-registration', entries.filter((x) => x.record.form === 'team-registration'));
  const lines = csv.split('\r\n');
  eq('header row is the sheet column order', lines[0], I.TEAM_COLUMNS.map((c) => '"' + c + '"').join(','));
  eq('one line per record', lines.length, 3);
  check('the formula in notes is neutralised in the file', /"'=HYPERLINK/.test(csv));
}

section('buildSnapshot');
{
  const snap = S.buildSnapshot(entries, T0);
  eq('takenAt', snap.takenAt, '2026-10-03T08:15:42.117Z');
  eq('counts per form', snap.counts, { team: 2, player: 1, club: 0 });
  eq('rehearsal flag when any record is a rehearsal', snap.rehearsal, true);
  eq('machine file carries EVERY entry with its key', snap.machine.records.map((r) => r.key), ['team/a', 'team/b', 'player/a']);
  eq('machine file version', snap.machine.v, 1);
  check('subject names date, counts and REHEARSAL', /2026-10-03 08:15 UTC/.test(snap.subject) && /2 teams, 1 players, 0 clubs/.test(snap.subject) && /REHEARSAL$/.test(snap.subject));
  eq('no REHEARSAL when none', /REHEARSAL/.test(S.buildSnapshot([entries[0]], T0).subject), false);
  check('csv for all three forms', typeof snap.csv.team === 'string' && typeof snap.csv.player === 'string' && typeof snap.csv.club === 'string');
}

section('Cadence');
{
  const at = (h) => Date.parse(`2026-10-03T${String(h).padStart(2, '0')}:05:00Z`);
  check('window open → every hour sends', [0, 7, 13, 22].every((h) => S.shouldSend(at(h), true)));
  check('window closed → only the 22:00 UTC hour (02:00 Abu Dhabi)', S.shouldSend(at(22), false) && !S.shouldSend(at(21), false) && !S.shouldSend(at(9), false));
}

section('⚠️ runSnapshot ALWAYS emails — a silent failure is not a snapshot');
(async () => {
  const sent = [];
  const mailer = async (m) => { sent.push(m); return { sent: true, count: 1 }; };
  const r = await S.runSnapshot({ listAll: async () => entries, windowOpen: async () => true, now: T0, sendMail: mailer, mailFrom: 'registrations@adhjrt.com' });
  eq('sent', r.sent, true);
  eq('to the tournament mailbox ONLY', sent[0].to, 'registrations@adhjrt.com');
  eq('two attachments per form set: 3 csv + 1 machine', sent[0].attachments.length, 4);
  check('machine attachment is JSON named registrations-<stamp>.json', sent[0].attachments.some((a) => /^registrations-.*\.json$/.test(a.name) && a.contentType === 'application/json'));
  check('csv attachments named per form', ['team', 'player', 'club'].every((f) => sent[0].attachments.some((a) => a.name === `registrations-${f}.csv`)));
  check('attachment bytes are base64', sent[0].attachments.every((a) => /^[A-Za-z0-9+/=]+$/.test(a.contentBytes)));
  check('no registration VALUE in the html body', !/Abu Dhabi Harlequins|Dubai Exiles/.test(sent[0].html));

  sent.length = 0;
  const r2 = await S.runSnapshot({ listAll: async () => { throw new Error('blobs down'); }, windowOpen: async () => true, now: T0, sendMail: mailer, mailFrom: 'registrations@adhjrt.com' });
  eq('store unreadable → STILL sends', r2.sent, true);
  check('…and the subject says FAILED', /FAILED/.test(sent[0].subject));
  check('…and the body carries the error message', /blobs down/.test(sent[0].html));

  sent.length = 0;
  const r3 = await S.runSnapshot({ listAll: async () => entries, windowOpen: async () => false, now: Date.parse('2026-10-03T09:05:00Z'), sendMail: mailer, mailFrom: 'registrations@adhjrt.com' });
  eq('closed window at 09:00 UTC → not this hour', r3.sent, false);
  eq('…and nothing was sent', sent.length, 0);
  const r4 = await S.runSnapshot({ listAll: async () => entries, windowOpen: async () => false, now: Date.parse('2026-10-03T09:05:00Z'), sendMail: mailer, mailFrom: 'registrations@adhjrt.com', force: true });
  eq('force overrides the cadence (for the rehearsal)', r4.sent, true);

  section('restorePlan writes only what is MISSING');
  const machine = S.buildSnapshot(entries, T0).machine;
  const plan = S.restorePlan(machine, new Set(['team/a']));
  eq('missing = the two not in the store', plan.missing.map((m) => m.key), ['team/b', 'player/a']);
  eq('present count', plan.present, 1);
  eq('rehearsal count among missing', plan.rehearsal, 1);
  eq('a present key is never in the plan, even if its record differs', S.restorePlan({ ...machine, records: [{ key: 'team/a', record: { ...entries[0].record, row: ['CHANGED'] } }] }, new Set(['team/a'])).missing.length, 0);
  let threw = null; try { S.restorePlan({ v: 99, records: [] }, new Set()); } catch (err) { threw = err; }
  check('an unknown machine-file version is refused', !!threw);

  section('deletePlan and its gate');
  eq('--rehearsal deletes rehearsal records only', S.deletePlan(entries, { rehearsalOnly: true }), ['team/b']);
  eq('--all deletes everything', S.deletePlan(entries, { rehearsalOnly: false }).sort(), ['player/a', 'team/a', 'team/b']);
  eq('canDelete: snapshot at least as new as the newest record → ok', S.canDelete('2026-10-03T08:15:42.117Z', entries).ok, true);
  eq('canDelete: snapshot OLDER than the newest record → refused', S.canDelete('2026-10-03T08:15:42.116Z', entries).ok, false);
  eq('canDelete: empty store → ok', S.canDelete('2020-01-01T00:00:00.000Z', []).ok, true);
  eq('canDelete: junk stamp → refused', S.canDelete('yesterday', entries).ok, false);

  section('Dependency-free');
  const src = readRepo('netlify/functions/_snapshot.js');
  check('requires no package', !/require\(['"](?!\.\/|crypto|path|fs|os)[^'"]+['"]\)/.test(src));

  summary('test-snapshot.js');
})();
