/* tests/test-registrations-admin.js
   The CLI's driver, with a fake Netlify CLI. Spec § 7. */
const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');
const A = require(path.join(repoRoot(), 'tools/registrations-admin.js'));
const R = require(path.join(repoRoot(), 'netlify/functions/_regstore.js'));
const S = require(path.join(repoRoot(), 'netlify/functions/_snapshot.js'));

const T0 = Date.parse('2026-10-03T08:15:42.117Z');
const rec = (form, club, nowMs) => R.buildRecord({ form, row: ['x', club], nowMs: nowMs || T0, club });

function fakeIo(seed, files) {
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
  return {
    m, out,
    async list(store) { return [...m.keys()].sort(); },
    async get(store, key) { return m.has(key) ? m.get(key) : null; },
    async set(store, key, json) { m.set(key, json); },
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

  section('The real io shells out to the Netlify CLI — no token anywhere');
  {
    const src = readRepo('tools/registrations-admin.js');
    check('uses execFileSync("netlify", …)', /execFileSync\(\s*['"]netlify['"]/.test(src));
    check('blobs:list / get / set / delete', ['blobs:list', 'blobs:get', 'blobs:set', 'blobs:delete'].every((c) => src.includes(c)));
    check('never reads a token from the environment or a file', !/BLOBS_TOKEN|NETLIFY_AUTH_TOKEN|token/i.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
    check('store name comes from _regstore', /STORE_NAME/.test(src));
  }
  summary('test-registrations-admin.js');
})();
