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

/* listAll() answers `{ entries, dropped }` (see _regstore.js). The fakes below
   answer that shape; `listing()` is the tidy way to say "nothing unreadable". */
const listing = (rows) => ({ entries: rows, dropped: [] });

/* A store with @netlify/blobs' shape, so a runSnapshot check can drive the
   REAL _regstore.listAll() instead of handing runSnapshot a pre-built list.
   That is what makes the malformed-record check below prove anything about
   the deployed path — snapshot-registrations.js passes exactly this wiring. */
function fakeStore(seed) {
  const m = new Map(Object.entries(seed || {}));
  return {
    m,
    async get(key) { return m.has(key) ? JSON.parse(JSON.stringify(m.get(key))) : null; },
    async setJSON(key, obj) { m.set(key, JSON.parse(JSON.stringify(obj))); },
    async list({ prefix }) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix || '')).sort().map((key) => ({ key })) }; },
    async delete(key) { m.delete(key); },
  };
}

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
  const r = await S.runSnapshot({ listAll: async () => listing(entries), windowOpen: async () => true, now: T0, sendMail: mailer, mailFrom: 'registrations@adhjrt.com' });
  eq('sent', r.sent, true);
  /* `|| {}` deliberately, here and at every other `sent[0]` below: a fault
     that makes runSnapshot swallow a failure and never call the mailer
     leaves `sent` empty, and `sent[0].anything` would then throw and kill
     the whole file before the checks after it ever ran — the exact trap
     this repo's rule against a test file falling over on a fault describes.
     `s0` is `{}` in that case, so every property read below is undefined
     and the `eq`/`check` reports FAIL like a normal assertion instead. */
  const s0 = sent[0] || {};
  eq('to the tournament mailbox ONLY', s0.to, 'registrations@adhjrt.com');
  eq('two attachments per form set: 3 csv + 1 machine', (s0.attachments || []).length, 4);
  check('machine attachment is JSON named registrations-<stamp>.json', (s0.attachments || []).some((a) => /^registrations-.*\.json$/.test(a.name) && a.contentType === 'application/json'));
  check('csv attachments named per form', ['team', 'player', 'club'].every((f) => (s0.attachments || []).some((a) => a.name === `registrations-${f}.csv`)));
  check('attachment bytes are base64', (s0.attachments || []).every((a) => /^[A-Za-z0-9+/=]+$/.test(a.contentBytes)));
  check('no registration VALUE in the html body', !/Abu Dhabi Harlequins|Dubai Exiles/.test(s0.html));
  check('a complete snapshot never says INCOMPLETE', !/INCOMPLETE/.test(String(s0.subject)) && !/INCOMPLETE/.test(String(s0.html)));

  sent.length = 0;
  const r2 = await S.runSnapshot({ listAll: async () => { throw new Error('blobs down'); }, windowOpen: async () => true, now: T0, sendMail: mailer, mailFrom: 'registrations@adhjrt.com' });
  eq('store unreadable → STILL sends', r2.sent, true);
  const s0b = sent[0] || {};
  check('…and the subject says FAILED', /FAILED/.test(s0b.subject));
  check('…and the body carries the error message', /blobs down/.test(s0b.html));

  sent.length = 0;
  const r3 = await S.runSnapshot({ listAll: async () => listing(entries), windowOpen: async () => false, now: Date.parse('2026-10-03T09:05:00Z'), sendMail: mailer, mailFrom: 'registrations@adhjrt.com' });
  eq('closed window at 09:00 UTC → not this hour', r3.sent, false);
  eq('…and nothing was sent', sent.length, 0);
  /* ⚠️ `force` has NO production caller and there is no way to trigger a
     snapshot by hand — a Netlify scheduled function is not reachable over
     HTTP. It exists for this check and for the prover. See the comment at
     `force` in _snapshot.js, and the closing section of the runbook. */
  const r4 = await S.runSnapshot({ listAll: async () => listing(entries), windowOpen: async () => false, now: Date.parse('2026-10-03T09:05:00Z'), sendMail: mailer, mailFrom: 'registrations@adhjrt.com', force: true });
  eq('force overrides the cadence (for the rehearsal)', r4.sent, true);

  /* ⚠️ REPOINTED. This fixture used to hand runSnapshot a hand-built list
     containing the malformed record, which walked straight past the very
     filter that decides its fate: _regstore.listPrefix() removed such a
     record before buildSnapshot() could ever see it, so on the DEPLOYED path
     the record vanished from the backup with no signal, the counts simply
     read one lower — and this check passed while proving nothing about it.
     It now drives the real listAll() over a fake store, exactly as
     snapshot-registrations.js wires it. */
  sent.length = 0;
  const badStore = fakeStore({
    'team/a': entries[0].record,
    'team/bad': { v: 1, form: 'team-registration', receivedAt: '2026-10-03T08:15:42.117Z', rehearsal: false },
  });
  const r5 = await S.runSnapshot({ listAll: () => R.listAll(badStore), windowOpen: async () => true, now: T0, sendMail: mailer, mailFrom: 'registrations@adhjrt.com' });
  eq('a malformed record found AFTER the read → STILL sends', r5.sent, true);
  const s0c = sent[0] || {};
  check('…and that subject says FAILED too', /FAILED/.test(s0c.subject));
  check('⚠️ …and the subject says INCOMPLETE and names how many it could not read', /INCOMPLETE/.test(String(s0c.subject)) && /\b1 record\(s\) FAILED to read/.test(String(s0c.subject)));
  check('…and the body says a restore from this file cannot put them back', /cannot put them back/.test(String(s0c.html)) && /team\/bad/.test(String(s0c.html)));
  eq('…and the readable record is still attached rather than the backup being abandoned', (s0c.attachments || []).length, 4);
  eq('…and runSnapshot reports the count to its caller for the function log', r5.dropped, 1);
  check('no registration VALUE in the INCOMPLETE body either', !/Abu Dhabi Harlequins|Dubai Exiles/.test(String(s0c.html)));

  /* listAll()'s old bare-array shape is a contract violation, not data: it
     would mean `dropped` is unknowable, so it takes the FAILED path rather
     than being read as "nothing was dropped". */
  sent.length = 0;
  const r6 = await S.runSnapshot({ listAll: async () => entries, windowOpen: async () => true, now: T0, sendMail: mailer, mailFrom: 'registrations@adhjrt.com' });
  eq('listAll answering the wrong shape → still emails', r6.sent, true);
  check('…and says FAILED rather than assuming nothing was dropped', /FAILED/.test(String((sent[0] || {}).subject)));

  section('restorePlan writes only what is MISSING');
  const machine = S.buildSnapshot(entries, T0).machine;
  const plan = S.restorePlan(machine, new Set(['team/a']));
  eq('missing = the two not in the store', plan.missing.map((m) => m.key), ['team/b', 'player/a']);
  eq('present count', plan.present, 1);
  eq('rehearsal count among missing', plan.rehearsal, 1);
  eq('a present key is never in the plan, even if its record differs', S.restorePlan({ ...machine, records: [{ key: 'team/a', record: { ...entries[0].record, row: ['CHANGED'] } }] }, new Set(['team/a'])).missing.length, 0);
  let threw = null; try { S.restorePlan({ v: 99, records: [] }, new Set()); } catch (err) { threw = err; }
  check('an unknown machine-file version is refused', !!threw);

  /* ⚠️ A KEYLESS RECORD IS NOT "PRESENT". It cannot be looked for and cannot
     be written back, so counting it in `present` — which
     `records.length - missing.length` did — reported a fuller restore than
     happened, in the middle of the one procedure this design exists for. */
  {
    const keylessPlan = S.restorePlan({ v: 1, takenAt: '2026-10-03T08:15:42.117Z', records: [{ key: 'team/a', record: entries[0].record }, { record: entries[1].record }] }, new Set(['team/a']));
    eq('⚠️ a record with no key is counted as keyless, not as present', keylessPlan.keyless, 1);
    eq('…and present counts only what is genuinely in the store', keylessPlan.present, 1);
    eq('…and it is never in the missing plan (there is no key to write to)', keylessPlan.missing.length, 0);
    eq('a clean snapshot reports no keyless records', S.restorePlan(machine, new Set()).keyless, 0);
  }

  section('deletePlan and its gate');
  eq('--rehearsal deletes rehearsal records only', S.deletePlan(entries, { rehearsalOnly: true }), ['team/b']);
  eq('--all deletes everything', S.deletePlan(entries, { rehearsalOnly: false }).sort(), ['player/a', 'team/a', 'team/b']);
  eq('canDelete: snapshot at least as new as the newest record → ok', S.canDelete('2026-10-03T08:15:42.117Z', entries).ok, true);
  eq('canDelete: snapshot OLDER than the newest record → refused', S.canDelete('2026-10-03T08:15:42.116Z', entries).ok, false);
  eq('canDelete: empty store → ok', S.canDelete('2020-01-01T00:00:00.000Z', []).ok, true);
  eq('canDelete: junk stamp → refused', S.canDelete('yesterday', entries).ok, false);
  /* ⚠️ ONE UNDATED RECORD USED TO SWITCH THE GATE OFF FOR THE WHOLE STORE.
     `.map(receivedAt).sort().pop()` returned undefined, `newest` came back
     null, and the "empty store, nothing to lose" branch answered ok — so a
     stale snapshot could authorise deleting every OTHER record too. */
  {
    const undated = entries.concat([{ key: 'team/z', record: { ...entries[0].record, receivedAt: undefined } }]);
    eq('⚠️ canDelete: a record with NO receivedAt → refused, however new the snapshot', S.canDelete('2099-01-01T00:00:00.000Z', undated).ok, false);
    eq('…and it says how many records are undated', S.canDelete('2099-01-01T00:00:00.000Z', undated).undated, 1);
    const unparsable = entries.concat([{ key: 'team/z', record: { ...entries[0].record, receivedAt: 'soon' } }]);
    eq('canDelete: an unparsable receivedAt → refused too', S.canDelete('2099-01-01T00:00:00.000Z', unparsable).ok, false);
    eq('canDelete: every record dated and the snapshot newer → still ok', S.canDelete('2099-01-01T00:00:00.000Z', entries).ok, true);
  }

  section('Dependency-free');
  const src = readRepo('netlify/functions/_snapshot.js');
  check('requires no package', !/require\(['"](?!\.\/|crypto|path|fs|os)[^'"]+['"]\)/.test(src));

  section('The scheduled function and the mailer');
  const fn = readRepo('netlify/functions/snapshot-registrations.js');
  check('handler calls runSnapshot', /runSnapshot\(\{/.test(fn));
  check('lists the registrations store', /listAll\(blobStore\(STORE_NAME\)\)/.test(fn));
  check('window comes from _registration', /registrationState\(await loadRegistration\(blobStore\)/.test(fn));
  check('recipient is MAIL_FROM, from the environment', /mailFrom:\s*process\.env\.MAIL_FROM/.test(fn));
  check('never reads a recipient from the request', !/event\.body/.test(fn) && !/JSON\.parse\(/.test(fn));
  const mail = readRepo('netlify/functions/_email.js');
  check('sendMail accepts attachments', /async function sendMail\(\{[^}]*attachments/.test(mail));
  check('…as Graph fileAttachments', /#microsoft\.graph\.fileAttachment/.test(mail));
  const toml = readRepo('netlify.toml');
  check('netlify.toml schedules the function hourly', /\[functions\."snapshot-registrations"\][\s\S]{0,80}schedule\s*=\s*"@hourly"/.test(toml));

  summary('test-snapshot.js');
})();
