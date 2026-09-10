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
  if (!deps.force && !shouldSend(now, open)) return { sent: false, subject: '' };

  let entries = null, failure = null;
  try { entries = await deps.listAll(); } catch (err) { failure = err && err.message ? err.message : String(err); }

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

  const snap = buildSnapshot(entries, now);
  const attachments = [
    { name: `registrations-${fileStamp}.json`, contentType: 'application/json', contentBytes: b64(JSON.stringify(snap.machine)) },
    { name: 'registrations-team.csv', contentType: 'text/csv', contentBytes: b64(snap.csv.team) },
    { name: 'registrations-player.csv', contentType: 'text/csv', contentBytes: b64(snap.csv.player) },
    { name: 'registrations-club.csv', contentType: 'text/csv', contentBytes: b64(snap.csv.club) },
  ];
  /* Counts only in the body. Never a value. */
  const html = `<p>Registrations snapshot taken ${esc(snap.takenAt)}.</p>` +
    `<p>${snap.counts.team} team, ${snap.counts.player} player and ${snap.counts.club} club records` +
    (snap.rehearsal ? ' — <strong>includes REHEARSAL records</strong>' : '') + '.</p>' +
    '<p>The .json attachment is what a restore reads. The .csv files are for reading. ' +
    'Procedure: claude/runbooks/runbook-registrations-restore-and-delete.md.</p>';
  await deps.sendMail({ to: deps.mailFrom, subject: snap.subject, html, attachments });
  return { sent: true, subject: snap.subject, counts: snap.counts };
}

/* Which snapshot records are NOT in the store. Present keys are never in the
   plan, whatever their content — restore adds, it never overwrites. */
function restorePlan(machine, existingKeys) {
  if (!machine || machine.v !== 1 || !Array.isArray(machine.records)) throw new Error('unrecognised snapshot file (expected v 1)');
  const missing = machine.records.filter((r) => r && r.key && !existingKeys.has(r.key));
  return {
    missing,
    present: machine.records.length - missing.length,
    rehearsal: missing.filter((r) => r.record && r.record.rehearsal === true).length,
  };
}

function deletePlan(entries, { rehearsalOnly }) {
  return entries.filter((e) => !rehearsalOnly || e.record.rehearsal === true).map((e) => e.key);
}

/* A delete needs a snapshot at least as new as the newest record, or a copy
   of something is about to not exist. */
function canDelete(machineTakenAt, entries) {
  const t = Date.parse(machineTakenAt);
  const newest = entries.map((e) => e.record.receivedAt).sort().pop() || null;
  if (!Number.isFinite(t)) return { ok: false, newest };
  if (!newest) return { ok: true, newest };
  return { ok: t >= Date.parse(newest), newest };
}

module.exports = { csvCell, buildCsv, buildSnapshot, shouldSend, runSnapshot, restorePlan, deletePlan, canDelete, PREFIX };
