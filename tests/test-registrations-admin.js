/* tests/test-registrations-admin.js
   The CLI's driver, with a fake Netlify CLI. Spec § 7. */
const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');
const A = require(path.join(repoRoot(), 'tools/registrations-admin.js'));
const R = require(path.join(repoRoot(), 'netlify/functions/_regstore.js'));
const S = require(path.join(repoRoot(), 'netlify/functions/_snapshot.js'));

const T0 = Date.parse('2026-10-03T08:15:42.117Z');
const rec = (form, club, nowMs) => R.buildRecord({ form, row: ['x', club], nowMs: nowMs || T0, club });

function fakeIo(seed, files, unreadableKeys, corruptWrites) {
  const m = new Map(Object.entries(seed || {}));
  /* ⚠️ TOMBSTONE: the brief's fakeIo defined `out` twice in one object
     literal — once as the array (`out,` shorthand) and once as the
     `out(line) {}` logging method. JS duplicate-key semantics mean the
     later one silently wins, so `io.out` ended up being the FUNCTION,
     not the array — and the test's own `io.out.some(...)` checks then
     threw `TypeError: io.out.some is not a function` (confirmed by
     running it). Fixed by keeping `out` as one callable function that
     also exposes `.some`, so it satisfies both the driver's
     `io.out(line)` contract and the test's array-style assertions.
     Every check and its label are unchanged from the brief. */
  const lines = [];
  const out = (line) => { lines.push(String(line)); };
  out.some = (pred) => lines.some(pred);
  /* Optional third arg: keys whose get() throws, simulating a transient CLI
     failure (expired login, network blip, a non-JSON line of output) rather
     than a genuinely missing key. Every existing call site omits this and
     keeps behaving exactly as before. */
  const badKeys = new Set(unreadableKeys || []);
  return {
    m, out,
    async list(store) { return [...m.keys()].sort(); },
    async get(store, key) {
      if (badKeys.has(key)) throw new Error('simulated transient read failure: ' + key);
      return m.has(key) ? m.get(key) : null;
    },
    /* Optional fourth arg: when true, set() stores something OTHER than what
       it was handed — the stand-in for `netlify blobs:set` not reading its
       value from stdin. Every existing call site omits it and stores exactly
       what it was given, as before. */
    async set(store, key, json) { m.set(key, corruptWrites ? {} : json); },
    async del(store, key) { m.delete(key); },
    readFile(p) { if (!(p in files)) throw new Error('ENOENT ' + p); return JSON.stringify(files[p]); },
  };
}

const full = { 'team/a': rec('team-registration', 'Abu Dhabi Harlequins'), 'team/b': rec('team-registration', 'Rehearsal Quins'), 'player/a': rec('player-registration', 'Dubai Exiles') };
const snapAll = S.buildSnapshot(Object.entries(full).map(([key, record]) => ({ key, record })), T0 + 60000).machine;
const snapOld = S.buildSnapshot(Object.entries(full).map(([key, record]) => ({ key, record })), T0 - 60000).machine;

(async () => {
  section('check writes nothing and reports counts');
  {
    const io = fakeIo({ 'team/a': full['team/a'] }, { 'snap.json': snapAll });
    const code = await A.runTool(['check', 'snap.json'], io);
    eq('exit 0', code, 0);
    check('reports missing 2', io.out.some((l) => /missing:\s*2/.test(l)));
    check('reports present 1', io.out.some((l) => /present:\s*1/.test(l)));
    check('reports rehearsal 1', io.out.some((l) => /rehearsal:\s*1/.test(l)));
    eq('store untouched', io.m.size, 1);
    check('no record VALUE printed', !io.out.some((l) => /Dubai Exiles|Harlequins/.test(l)));
  }

  section('restore needs the count check printed, and adds only what is missing');
  {
    const io = fakeIo({ 'team/a': { ...full['team/a'], row: ['KEEP'] } }, { 'snap.json': snapAll });
    eq('no --confirm → refused, exit 2', await A.runTool(['restore', 'snap.json'], io), 2);
    eq('wrong --confirm → refused', await A.runTool(['restore', 'snap.json', '--confirm', '5'], io), 2);
    eq('store still untouched', io.m.size, 1);
    eq('right --confirm → exit 0', await A.runTool(['restore', 'snap.json', '--confirm', '2'], io), 0);
    eq('the two missing were written', [...io.m.keys()].sort(), ['player/a', 'team/a', 'team/b']);
    eq('⚠️ the present record was NOT overwritten', io.m.get('team/a').row, ['KEEP']);
    eq('running it again is harmless (0 missing)', await A.runTool(['restore', 'snap.json', '--confirm', '0'], io), 0);
  }

  section('⚠️ restore reads every write BACK — the real write path has never run against the real CLI');
  {
    /* netlifyIo().set() hands the value to `netlify blobs:set` on STDIN. The
       Netlify CLI is not a dependency of this repo and the suite drives this
       fake, so nothing has ever proven the CLI reads stdin at all. If it does
       not, restore writes an empty blob at exactly the key that was missing —
       and because restore is add-only, that key counts as PRESENT for ever
       and a second, correct restore skips it permanently. So the tool reads
       each write back and stops on the first mismatch. */
    const io = fakeIo({}, { 'snap.json': snapAll }, [], true);
    const code = await A.runTool(['restore', 'snap.json', '--confirm', '3'], io);
    eq('a write that stores something else → refused, exit 2', code, 2);
    check('…and it names the key it stopped at', io.out.some((l) => /REFUSED.*reading it back did not return what was written/.test(l) && /team\/a/.test(l)));
    check('…and it STOPPED rather than writing the rest', io.m.size === 1);
    check('…and no record VALUE was printed', !io.out.some((l) => /Dubai Exiles|Harlequins/.test(l)));
    check('…and no "restored" line claimed success', !io.out.some((l) => /^restored /.test(l)));
  }

  section('a snapshot file with a keyless record refuses instead of over-reporting');
  {
    /* A record with no key can neither be found in the store nor written
       back, so folding it into `present` reported a fuller restore than
       happened — during the exact procedure this tool exists for. */
    const holed = { ...snapAll, records: snapAll.records.concat([{ record: full['team/a'] }]) };
    let io = fakeIo(full, { 'holed.json': holed });
    eq('check refuses, exit 2', await A.runTool(['check', 'holed.json'], io), 2);
    check('…and says the snapshot file is not intact', io.out.some((l) => /REFUSED.*have no key/.test(l)));
    io = fakeIo({}, { 'holed.json': holed });
    eq('restore refuses too', await A.runTool(['restore', 'holed.json', '--confirm', '3'], io), 2);
    eq('…and nothing was written', io.m.size, 0);
  }

  section('a record with no receivedAt refuses a delete rather than disabling the freshness gate');
  {
    /* The undated record made canDelete() answer "nothing to lose" for the
       WHOLE store, so a stale snapshot could authorise deleting every other
       record with it. */
    const undated = { ...full, 'team/z': { ...full['team/a'], receivedAt: undefined } };
    const io = fakeIo(undated, { 'snap.json': snapAll });
    eq('delete refuses, exit 2', await A.runTool(['delete', '--all', '--snapshot', 'snap.json', '--confirm', 'ALL'], io), 2);
    check('…and says the freshness gate cannot tell', io.out.some((l) => /REFUSED.*no usable receivedAt/.test(l)));
    eq('…and nothing was deleted', io.m.size, 4);
  }

  section('delete: rehearsal scope, ALL word, and the snapshot gate');
  {
    let io = fakeIo(full, { 'snap.json': snapAll, 'old.json': snapOld });
    eq('no --snapshot → refused', await A.runTool(['delete', '--rehearsal'], io), 2);
    eq('snapshot OLDER than newest record → refused', await A.runTool(['delete', '--rehearsal', '--snapshot', 'old.json'], io), 2);
    eq('store untouched so far', io.m.size, 3);
    eq('--rehearsal with a fresh snapshot → exit 0', await A.runTool(['delete', '--rehearsal', '--snapshot', 'snap.json'], io), 0);
    eq('only the rehearsal record is gone', [...io.m.keys()].sort(), ['player/a', 'team/a']);

    io = fakeIo(full, { 'snap.json': snapAll });
    eq('--all without --confirm ALL → refused', await A.runTool(['delete', '--all', '--snapshot', 'snap.json'], io), 2);
    eq('--all with --confirm all (lower case) → refused', await A.runTool(['delete', '--all', '--snapshot', 'snap.json', '--confirm', 'all'], io), 2);
    eq('still 3', io.m.size, 3);
    eq('--all --confirm ALL → exit 0', await A.runTool(['delete', '--all', '--snapshot', 'snap.json', '--confirm', 'ALL'], io), 0);
    eq('empty', io.m.size, 0);
    eq('neither scope flag → refused', await A.runTool(['delete', '--snapshot', 'snap.json'], fakeIo(full, { 'snap.json': snapAll })), 2);
  }

  section('an unreadable record refuses instead of proceeding on a partial picture');
  {
    /* team/b exists (it is in list()) but its get() throws — a stand-in for
       an expired CLI login, a network blip, or a non-JSON line of CLI
       output. The old code caught that inside get() and returned null,
       which made loadEntries() build a store picture with team/b silently
       missing. */
    let io = fakeIo(full, { 'snap.json': snapAll }, ['team/b']);
    let code = await A.runTool(['check', 'snap.json'], io);
    eq('an unreadable record makes check refuse, exit 2', code, 2);
    check('…and says how many it could not read', io.out.some((l) => /REFUSED.*\b1\b.*could not be read/.test(l) && l.includes('team/b')));

    io = fakeIo(full, { 'snap.json': snapAll }, ['team/b']);
    const before = JSON.stringify([...io.m.entries()].sort());
    code = await A.runTool(['restore', 'snap.json', '--confirm', '0'], io);
    eq('an unreadable record makes restore refuse rather than overwrite', code, 2);
    const after = JSON.stringify([...io.m.entries()].sort());
    eq('…and nothing was written', after, before);

    io = fakeIo(full, { 'snap.json': snapAll }, ['team/b']);
    code = await A.runTool(['delete', '--rehearsal', '--snapshot', 'snap.json'], io);
    eq('an unreadable record makes delete refuse', code, 2);
  }

  section('a key that failed to read still counts as existing — discriminates against building the existing-set from `entries`');
  {
    /* team/a is transiently unreadable on this one call: it is in `keys`
       (from list()) but NOT in `entries` (loadEntries() could not read it).
       The bug this guards: an existing-set built from `entries` would call
       team/a MISSING and let a restore write over a live record. */
    const io = fakeIo(full, { 'snap.json': snapAll }, ['team/a']);
    const { keys, entries, unreadable } = await A.loadEntries(io);
    check('team/a is in keys (list() saw it)', keys.includes('team/a'));
    check('team/a is NOT in entries (the read failed)', !entries.some((e) => e.key === 'team/a'));
    check('team/a is reported unreadable', unreadable.includes('team/a'));

    const fixedPlan = S.restorePlan(snapAll, new Set(keys));
    const buggyPlan = S.restorePlan(snapAll, new Set(entries.map((e) => e.key)));
    /* This label must fail if runTool is put back to building its existing-set
       from `entries` instead of `keys` — so it asserts BOTH the correct
       outcome (using keys) AND that runTool's own source is actually wired
       that way, not just that _snapshot.js's restorePlan works when fed the
       right input by hand. */
    const wiredFromKeys = /restorePlan\(machine,\s*new Set\(keys\)\)/.test(readRepo('tools/registrations-admin.js'));
    check('a key that failed to read still counts as existing', !fixedPlan.missing.some((r) => r.key === 'team/a') && wiredFromKeys);
    check('…proof: an existing-set built from entries instead would wrongly call it missing', buggyPlan.missing.some((r) => r.key === 'team/a'));
  }

  section('a snapshot that is not v1 refuses uniformly, exit 2');
  {
    const io = fakeIo(full, { 'bad.json': { v: 2, records: [] } });
    const code = await A.runTool(['check', 'bad.json'], io);
    eq('a snapshot file that is not v1 refuses with 2, not 1', code, 2);
    check('message wording is unchanged', io.out.some((l) => /not a v1 snapshot file: bad\.json/.test(l)));
  }

  section('The real io shells out to the Netlify CLI — no token anywhere');
  {
    const src = readRepo('tools/registrations-admin.js');
    check('starts the CLI through cliInvocation()', /execFileSync\(c\.file, c\.argv/.test(src));
    check('blobs:list / get / set / delete', ['blobs:list', 'blobs:get', 'blobs:set', 'blobs:delete'].every((c) => src.includes(c)));
    check('never reads a token from the environment or a file', !/BLOBS_TOKEN|NETLIFY_AUTH_TOKEN|token/i.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
    check('store name comes from _regstore', /STORE_NAME/.test(src));
  }
  section('The real io works on Windows, and uses the CLI the way the CLI works');
  {
    /* Found on the first real run: every call failed "spawnSync netlify
       ENOENT" on Windows, because npm installs the CLI as netlify.cmd;
       blobs:set takes its value from --input or an argument, never stdin; and
       blobs:delete prompts unless given --force. The rest of this file drives
       a fake io, so none of the three could ever show up in it. */
    const lin = A.cliInvocation(['blobs:list', 'registrations', '--json'], 'linux');
    eq('off Windows the CLI is run directly, with no shell', lin.file, 'netlify');
    eq('…and the arguments untouched', JSON.stringify(lin.argv), JSON.stringify(['blobs:list', 'registrations', '--json']));

    const key = 'club/2026-09-11T03-19-28-069Z-f758f5';
    const win = A.cliInvocation(['blobs:get', 'registrations', key], 'win32');
    const line = win.argv[win.argv.length - 1];
    check('on Windows it goes through cmd.exe to netlify.cmd', /cmd(\.exe)?$/i.test(win.file) && line.includes('"netlify.cmd"'), win.file);
    check('…with every argument quoted', line.includes('"blobs:get"') && line.includes(`"${key}"`), line);
    check('…passed verbatim, so Node does not re-escape the quotes', win.verbatim === true);
    let threw = false;
    try { A.cliInvocation(['blobs:get', 'registrations', 'x" & calc & "'], 'win32'); } catch (e) { threw = true; }
    check('an argument cmd.exe could re-parse is refused, not passed', threw);

    const fs = require('fs');
    const calls = [];
    let seenValue = null, seenPath = null;
    const io = A.netlifyIo((args, input) => {
      calls.push({ args, input });
      const i = args.indexOf('--input');
      if (i >= 0) { seenPath = args[i + 1]; seenValue = fs.readFileSync(seenPath, 'utf8'); }
      return '';
    });
    const value = { v: 1, form: 'club-registration', row: ['a', 'Rehearsal X'], rehearsal: true };
    await io.set('registrations', 'club/k1', value);
    const set = calls[0] || { args: [] };
    check('blobs:set passes the value through --input, not stdin',
      set.args[0] === 'blobs:set' && set.args.includes('--input') && set.input === undefined);
    eq('…and that file holds exactly the record', seenValue, JSON.stringify(value));
    check('…and the temp file is gone afterwards', !!seenPath && !fs.existsSync(seenPath), String(seenPath));
    check('…and it was written outside the repo',
      !!seenPath && !path.resolve(seenPath).toLowerCase().startsWith(path.resolve(repoRoot()).toLowerCase()), String(seenPath));
    check('…and the value is never on the command line',
      !set.args.some((a) => a.includes('Rehearsal X')));
    await io.del('registrations', 'club/k1');
    const del = calls[1] || { args: [] };
    check('blobs:delete passes --force, so it cannot stop at a prompt', del.args[0] === 'blobs:delete' && del.args.includes('--force'));
  }

  summary('test-registrations-admin.js');
})();
