#!/usr/bin/env node
/* tools/registrations-admin.js
   ------------------------------------------------------------------------
   Restore or delete registration records, from the command line, on a PC
   where the Netlify CLI is signed in. Spec § 7; procedure in
   claude/runbooks/runbook-registrations-restore-and-delete.md.

   CREDENTIALS. This talks to the store through the Netlify CLI
   (`netlify blobs:…`), which uses the login Jay primed once in a browser.
   There is NO token in this file, in the environment it reads, or in any
   argument. If `netlify` is not signed in or the folder is not linked, the
   CLI says so and this tool stops.

   MODES — always run `check` first:
     check   <snapshot.json>                       compare, write nothing
     restore <snapshot.json> --confirm <N>         add ONLY the N missing records (N = what check printed)
     delete  --rehearsal --snapshot <snapshot.json>            remove rehearsal records
     delete  --all --snapshot <snapshot.json> --confirm ALL    remove everything

   OUTPUT is paths, keys, counts and statuses. Never a record VALUE.
   ------------------------------------------------------------------------ */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { STORE_NAME } = require(path.join(__dirname, '..', 'netlify', 'functions', '_regstore.js'));
const { restorePlan, deletePlan, canDelete } = require(path.join(__dirname, '..', 'netlify', 'functions', '_snapshot.js'));

function flag(argv, name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; }
function has(argv, name) { return argv.indexOf(name) >= 0; }

/* The real io: every call is one Netlify CLI invocation. */
function netlifyIo() {
  const run = (args, input) => execFileSync('netlify', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
  return {
    async list(store) {
      const raw = run(['blobs:list', store, '--json']);
      const parsed = JSON.parse(raw);
      return (Array.isArray(parsed) ? parsed : parsed.blobs || []).map((b) => (typeof b === 'string' ? b : b.key)).sort();
    },
    async get(store, key) {
      /* No catch here on purpose. A failed read must be LOUD: every key this
         is ever called with came from list(), so a genuine not-found should
         not happen — a throw here means something is actually wrong (expired
         login, network blip, a non-JSON line of CLI output), and loadEntries()
         below is the only place allowed to decide what that means. */
      let raw;
      try { raw = run(['blobs:get', store, key]); }
      catch (e) { throw new Error(`could not read "${key}" from the store: ${e && e.message}`); }
      try { return JSON.parse(raw); }
      catch (e) { throw new Error(`unparsable record for "${key}": ${e && e.message}`); }
    },
    async set(store, key, json) { run(['blobs:set', store, key], JSON.stringify(json)); },
    async del(store, key) { run(['blobs:delete', store, key]); },
    readFile(p) { return fs.readFileSync(p, 'utf8'); },
    out(line) { console.log(line); },
  };
}

/* Existence comes from list(), never from a successful get(). A key that
   failed to read still EXISTS — it is just unreadable right now — so `keys`
   (everything list() returned) is the set restorePlan must use to decide
   what is missing. `entries` is only the ones we could actually read, for
   printing counts and for delete's freshness gate. `unreadable` is every key
   that threw or came back without a usable record.row; the caller in
   runTool() must refuse whenever it is non-empty rather than silently
   proceeding on a partial picture — see runTool(). */
async function loadEntries(io) {
  const keys = await io.list(STORE_NAME);
  const entries = [];
  const unreadable = [];
  for (const key of keys) {
    try {
      const record = await io.get(STORE_NAME, key);
      if (record && Array.isArray(record.row)) entries.push({ key, record });
      else unreadable.push(key); /* read succeeded but came back unusable */
    } catch (err) {
      unreadable.push(key); /* per-key catch: one bad key must not abort the rest */
    }
  }
  return { keys, entries, unreadable };
}

function readSnapshot(io, p) {
  if (!p) throw new Error('a snapshot file path is required');
  const machine = JSON.parse(io.readFile(p));
  if (!machine || machine.v !== 1 || !Array.isArray(machine.records)) {
    /* Same gate as every other refusal in this tool: exit 2, not the
       generic-error exit 1 this used to fall through to. */
    const err = new Error('not a v1 snapshot file: ' + p);
    err.refused = true;
    throw err;
  }
  return machine;
}

async function runTool(argv, io) {
  const mode = argv[0];
  try {
    if (mode === 'check' || mode === 'restore') {
      const machine = readSnapshot(io, argv[1]);
      const { keys, entries, unreadable } = await loadEntries(io);
      if (unreadable.length > 0) {
        io.out(`REFUSED: ${unreadable.length} record(s) in the store could not be read: ${unreadable.join(', ')}. Nothing written — a partial read of the store is not enough to trust a missing/present count or a restore.`);
        return 2;
      }
      /* The existing-key set MUST come from `keys` (everything list() found),
         not from `entries` (only what we could read) — a key that exists but
         is unreadable must still count as existing, never as missing. */
      const plan = restorePlan(machine, new Set(keys));
      io.out(`snapshot taken: ${machine.takenAt}   records in snapshot: ${machine.records.length}`);
      io.out(`store: ${entries.length} record(s)`);
      io.out(`missing: ${plan.missing.length}   present: ${plan.present}   rehearsal: ${plan.rehearsal} (among missing)`);
      if (mode === 'check') { io.out('check only — nothing written'); return 0; }

      const confirm = flag(argv, '--confirm');
      if (confirm === undefined || Number(confirm) !== plan.missing.length) {
        io.out(`REFUSED: restore needs --confirm ${plan.missing.length} (the missing count check printed). Nothing written.`);
        return 2;
      }
      for (const m of plan.missing) {
        /* Add only. A key that exists is never touched, and the plan already excluded them. */
        await io.set(STORE_NAME, m.key, m.record);
        io.out(`restored ${m.key}`);
      }
      io.out(`done: ${plan.missing.length} record(s) restored`);
      return 0;
    }

    if (mode === 'delete') {
      const rehearsalOnly = has(argv, '--rehearsal');
      const all = has(argv, '--all');
      if (rehearsalOnly === all) { io.out('REFUSED: say exactly one of --rehearsal or --all'); return 2; }
      const snapPath = flag(argv, '--snapshot');
      if (!snapPath) { io.out('REFUSED: --snapshot <file> is required — a delete needs a copy first'); return 2; }
      const machine = readSnapshot(io, snapPath);
      const { entries, unreadable } = await loadEntries(io);
      if (unreadable.length > 0) {
        io.out(`REFUSED: ${unreadable.length} record(s) in the store could not be read: ${unreadable.join(', ')}. Nothing deleted — an unreadable newest record could let a stale snapshot through the freshness gate.`);
        return 2;
      }
      const gate = canDelete(machine.takenAt, entries);
      if (!gate.ok) { io.out(`REFUSED: snapshot ${machine.takenAt} is older than the newest record ${gate.newest}. Take a fresh snapshot first.`); return 2; }
      if (all && flag(argv, '--confirm') !== 'ALL') { io.out('REFUSED: --all needs --confirm ALL (upper case)'); return 2; }
      const keys = deletePlan(entries, { rehearsalOnly });
      io.out(`deleting ${keys.length} ${rehearsalOnly ? 'rehearsal' : ''} record(s)`);
      for (const k of keys) { await io.del(STORE_NAME, k); io.out(`deleted ${k}`); }
      io.out(`done: ${keys.length} deleted`);
      return 0;
    }

    io.out('usage: check <snap.json> | restore <snap.json> --confirm <N> | delete --rehearsal|--all --snapshot <snap.json> [--confirm ALL]');
    return 2;
  } catch (err) {
    if (err && err.refused) { io.out(`REFUSED: ${err.message}`); return 2; }
    io.out(`ERROR: ${err && err.message}`);
    return 1;
  }
}

module.exports = { runTool, netlifyIo, loadEntries };

if (require.main === module) {
  runTool(process.argv.slice(2), netlifyIo()).then((code) => process.exit(code));
}
