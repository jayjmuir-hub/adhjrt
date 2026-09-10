// netlify/functions/_snapshot.js
//
// THE SNAPSHOT — what gets emailed to the registrations mailbox, how often,
// and the restore/delete PLANS the command-line tool executes.
// Spec: claude/specs/spec-registration-store-sep-2026.md § 6, § 7.
//
// Two attachments kinds: CSV per form for humans, and ONE machine file
// (every record exactly as stored, with its key) which is the ONLY thing
// restore reads. A spreadsheet reformats cells — a leading + on a phone
// number is the known case — so a restore from the readable columns would
// quietly corrupt what it puts back.
//
// ⚠️ runSnapshot() ALWAYS sends when it decides to run, even when the store
// cannot be read: the email then says FAILED. A snapshot that fails silently
// is not a snapshot.
//
// Dependency-free: the mailer and the store listing are injected.

const { FORMS } = require('./_intake');
const { PREFIX } = require('./_regstore');

/* Quote every cell; double inner quotes; neutralise a leading = + - @ with an
   apostrophe so nothing a registrant typed becomes a live formula in Excel or
   Sheets. The same rule the organiser page's csvSafe() applies. */
function csvCell(v) {
  let s = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

function buildCsv(form, entries) {
  const columns = FORMS[form].columns;
  const lines = [columns.map(csvCell).join(',')];
  for (const e of entries) lines.push(columns.map((_, i) => csvCell(e.record.row[i])).join(','));
  return lines.join('\r\n');
}

const byForm = (entries, form) => entries.filter((e) => e.record.form === form);

function buildSnapshot(entries, nowMs) {
  const takenAt = new Date(nowMs).toISOString();
  const counts = {
    team: byForm(entries, 'team-registration').length,
    player: byForm(entries, 'player-registration').length,
    club: byForm(entries, 'club-registration').length,
  };
  const rehearsal = entries.some((e) => e.record.rehearsal === true);
  const stamp = takenAt.slice(0, 16).replace('T', ' ') + ' UTC';
  const subject = `ADH JRT registrations snapshot ${stamp} — ${counts.team} teams, ${counts.player} players, ${counts.club} clubs` + (rehearsal ? ' — REHEARSAL' : '');
  return {
    takenAt, counts, rehearsal, subject,
    machine: { v: 1, takenAt, records: entries.map((e) => ({ key: e.key, record: e.record })) },
    csv: {
      team: buildCsv('team-registration', byForm(entries, 'team-registration')),
      player: buildCsv('player-registration', byForm(entries, 'player-registration')),
      club: buildCsv('club-registration', byForm(entries, 'club-registration')),
    },
  };
}

/* The function is scheduled HOURLY (netlify.toml). While the window is open
   every run sends; otherwise only the 22:00 UTC run, which is 02:00 in Abu
   Dhabi. */
function shouldSend(nowMs, windowOpen) {
  if (windowOpen) return true;
  return new Date(nowMs).getUTCHours() === 22;
}

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

async function runSnapshot(deps) {
  const now = Number.isFinite(deps.now) ? deps.now : Date.now();
  let open = false;
  try { open = !!(await deps.windowOpen()); } catch (err) { open = false; }
  /* ⚠️ `force` EXISTS FOR THE TESTS AND FOR NOTHING ELSE. There is no
     production caller: snapshot-registrations.js does not pass it, and a
     Netlify SCHEDULED function cannot be invoked over HTTP at all, so nothing
     outside this repo's suite can reach this branch. That is not an oversight
     to be fixed by adding a trigger — a trigger would be a public-ish way to
     make the site dump every registration into an email, and the mailbox is
     the one copy of children's data there is. The consequence is written down
     where it bites: outside the registration window a snapshot arrives once a
     night, at the 22:00 UTC run, so a rehearsal that needs a snapshot between
     two of its steps spans more than one day. See the closing section of
     claude/runbooks/runbook-registrations-restore-and-delete.md. Do not delete
     `force`: tests/_prove-registration.js and test-snapshot.js depend on it. */
  if (!deps.force && !shouldSend(now, open)) return { sent: false, subject: '' };

  /* ⚠️ THE READ AND THE BUILD ARE GUARDED TOGETHER, ON PURPOSE. This used to
     wrap only listAll(), which made the "always emails" promise above narrower
     than it claimed: a store that READ fine but held one malformed record threw
     out of buildCsv and sent nothing — the exact corruption this backup exists
     to survive. Anything that goes wrong before there is a snapshot to attach
     must end up on the FAILED path below, not thrown. */
  let entries = null, snap = null, failure = null, dropped = [];
  try {
    /* listAll() answers `{ entries, dropped }` — see _regstore.js. `dropped`
       is every key that EXISTS in the store but could not be read back as a
       record. Anything but that shape is a contract violation, not data, so
       it takes the FAILED path rather than being guessed at. */
    const listed = await deps.listAll();
    if (!listed || !Array.isArray(listed.entries)) throw new Error('listAll() did not answer { entries, dropped }');
    entries = listed.entries;
    dropped = Array.isArray(listed.dropped) ? listed.dropped : [];
    snap = buildSnapshot(entries, now);
  } catch (err) { failure = err && err.message ? err.message : String(err); }

  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fileStamp = new Date(now).toISOString().replace(/[:.]/g, '-');

  if (failure !== null) {
    const subject = `ADH JRT registrations snapshot FAILED ${new Date(now).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
    await deps.sendMail({
      to: deps.mailFrom, subject,
      html: `<p>The registrations store could not be read, so this snapshot carries no data.</p><p>Error: <code>${esc(failure)}</code></p><p>See claude/runbooks/runbook-registrations-restore-and-delete.md.</p>`,
      attachments: [],
    });
    return { sent: true, subject, error: failure };
  }
  const attachments = [
    { name: `registrations-${fileStamp}.json`, contentType: 'application/json', contentBytes: b64(JSON.stringify(snap.machine)) },
    { name: 'registrations-team.csv', contentType: 'text/csv', contentBytes: b64(snap.csv.team) },
    { name: 'registrations-player.csv', contentType: 'text/csv', contentBytes: b64(snap.csv.player) },
    { name: 'registrations-club.csv', contentType: 'text/csv', contentBytes: b64(snap.csv.club) },
  ];

  /* ⚠️ AN INCOMPLETE BACKUP MUST NOT LOOK LIKE A COMPLETE ONE. `dropped` is
     keys the store HAS but could not be read as records: they are not in the
     attachments, so a restore from this file cannot put them back, and the
     per-form counts in the ordinary subject would simply read one lower with
     no signal at all. This is the sibling of the FAILED path above — the
     store read partly rather than not at all — and it deliberately still
     carries the records it COULD read, because most of a backup beats none.
     The subject keeps the word FAILED so the runbook's "a subject saying
     FAILED needs investigating" rule catches this too. Keys only, never a
     value: a key is `<form>/<stamp>-<rand>`. */
  if (dropped.length > 0) {
    snap.subject = `ADH JRT registrations snapshot INCOMPLETE ${new Date(now).toISOString().slice(0, 16).replace('T', ' ')} UTC` +
      ` — ${dropped.length} record(s) FAILED to read and are NOT in this backup` +
      ` — ${snap.counts.team} teams, ${snap.counts.player} players, ${snap.counts.club} clubs saved` +
      (snap.rehearsal ? ' — REHEARSAL' : '');
  }

  /* Counts only in the body. Never a value. */
  const html = `<p>Registrations snapshot taken ${esc(snap.takenAt)}.</p>` +
    (dropped.length > 0
      ? `<p><strong>⚠️ THIS SNAPSHOT IS INCOMPLETE.</strong> ${dropped.length} record(s) exist in the store but could not be read, ` +
        'so they are NOT in the attachments and a restore from this file cannot put them back. ' +
        `Keys: <code>${esc(dropped.join(', '))}</code>. Investigate before trusting this file for a restore or a delete.</p>`
      : '') +
    `<p>${snap.counts.team} team, ${snap.counts.player} player and ${snap.counts.club} club records` +
    (snap.rehearsal ? ' — <strong>includes REHEARSAL records</strong>' : '') + '.</p>' +
    '<p>The .json attachment is what a restore reads. The .csv files are for reading. ' +
    'Procedure: claude/runbooks/runbook-registrations-restore-and-delete.md.</p>';
  await deps.sendMail({ to: deps.mailFrom, subject: snap.subject, html, attachments });
  return { sent: true, subject: snap.subject, counts: snap.counts, dropped: dropped.length };
}

/* Which snapshot records are NOT in the store. Present keys are never in the
   plan, whatever their content — restore adds, it never overwrites.

   ⚠️ A RECORD WITH NO KEY IS COUNTED SEPARATELY, NOT AS "PRESENT". It cannot
   be missing (there is no key to look for) and it cannot be restored (there is
   no key to write to), so folding it into `present` — which is what
   `records.length - missing.length` used to do — made the tool report a
   fuller restore than actually happened, during the one procedure this whole
   design exists for. `keyless` is surfaced so the CLI can refuse instead of
   proceeding on a snapshot file that is not intact. */
function restorePlan(machine, existingKeys) {
  if (!machine || machine.v !== 1 || !Array.isArray(machine.records)) throw new Error('unrecognised snapshot file (expected v 1)');
  const missing = machine.records.filter((r) => r && r.key && !existingKeys.has(r.key));
  const keyless = machine.records.filter((r) => !r || !r.key).length;
  return {
    missing,
    keyless,
    present: machine.records.length - missing.length - keyless,
    rehearsal: missing.filter((r) => r.record && r.record.rehearsal === true).length,
  };
}

function deletePlan(entries, { rehearsalOnly }) {
  return entries.filter((e) => !rehearsalOnly || e.record.rehearsal === true).map((e) => e.key);
}

/* A delete needs a snapshot at least as new as the newest record, or a copy
   of something is about to not exist.

   ⚠️ A RECORD WITHOUT A USABLE `receivedAt` REFUSES THE WHOLE DELETE. The
   newest-record computation used to sort raw values, so a record whose stamp
   was missing sorted to `undefined`, `newest` came back null, and the "empty
   store, nothing to lose" branch let the delete through — one undated record
   switched the freshness gate off for every OTHER record in the store. A
   record that reads fine but cannot say when it arrived is exactly the case
   where you cannot know whether the snapshot covers it, so it is a refusal.
   `undated` tells the CLI which refusal to print. */
function canDelete(machineTakenAt, entries) {
  const t = Date.parse(machineTakenAt);
  const stamps = entries.map((e) => (e && e.record ? e.record.receivedAt : undefined));
  const usable = stamps.filter((s) => Number.isFinite(Date.parse(s)));
  const undated = stamps.length - usable.length;
  const newest = usable.slice().sort().pop() || null;
  if (!Number.isFinite(t)) return { ok: false, newest, undated };
  if (undated > 0) return { ok: false, newest, undated };
  if (!newest) return { ok: true, newest, undated };
  return { ok: t >= Date.parse(newest), newest };
}

module.exports = { csvCell, buildCsv, buildSnapshot, shouldSend, runSnapshot, restorePlan, deletePlan, canDelete, PREFIX };
