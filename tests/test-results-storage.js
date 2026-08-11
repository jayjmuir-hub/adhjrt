/* tests/test-results-storage.js
   ---------------------------------------------------------------------------
   Proves netlify/functions/_results.js — the storage layer under every match
   score — and the two defects an Aug 2026 code review found in the layout it
   replaced.

   WHAT WENT WRONG. Results were one blob per AGE GROUP, read-modify-written:
   read the group, change one entry, write the whole group back.

     (a) A FAILED READ DESTROYED THE GROUP. readGroup swallowed the error and
         returned the (empty) legacy slice; the caller wrote that back as the
         whole group. Fourteen U16B results, one blob timeout while saving the
         fifteenth, and the blob became {match15}. The verifier checked only its
         OWN entry, so it passed and the manager saw a green tick.

     (b) TWO WRITERS BOTH GOT A GREEN TICK. A reads, B reads, A writes, A
         verifies OK, B writes, B verifies OK — and A's score no longer exists.

   ⚠️ THE FAKE STORE IS THE POINT OF THIS FILE. Both defects are about what
   happens between a read and a write, so they cannot be reached by any test
   that cannot make a read fail on demand or interleave two writers. The store
   below is small and dumb deliberately: a Map, plus two dials (`failReads`,
   `failList`). Anything cleverer would be a second implementation to be wrong.

   ⚠️ THE INTERLEAVING TEST MUST INTERLEAVE. `await A; await B` is two writers
   taking turns and passes against the old code as happily as the new. The test
   below drives the sequence by hand in the exact order that lost a score.
*/

const { section, check, eq, summary } = require('./_lib');
const path = require('path');
const { repoRoot } = require('./_lib');
const R = require(path.join(repoRoot(), 'netlify', 'functions', '_results.js'));

/* ---- the fake store ------------------------------------------------------ */
function makeStore() {
  const data = new Map();
  return {
    data,
    failReads: false,
    failList: false,
    async get(key) {
      if (this.failReads) throw new Error('simulated read failure');
      return data.has(key) ? JSON.parse(data.get(key)) : null;
    },
    async setJSON(key, value) { data.set(key, JSON.stringify(value)); },
    async delete(key) { data.delete(key); },
    async list({ prefix } = {}) {
      if (this.failList) throw new Error('simulated list failure');
      return { blobs: [...data.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((key) => ({ key })) };
    },
  };
}

const result = (n) => ({ homeScore: n, awayScore: 0, submittedAt: `2026-11-14T10:0${n}:00.000Z` });

(async () => {
  /* ==================================================================== */
  section('One match writes one key — nothing else can be inside it');

  {
    const s = makeStore();
    await R.writeMatch(s, 'u16b:pool:1', result(1));
    await R.writeMatch(s, 'u16b:pool:2', result(2));
    eq('two matches are two blobs', s.data.size, 2);
    check('keyed by match, not by group', s.data.has('m:u16b:pool:1') && s.data.has('m:u16b:pool:2'));
    const all = await R.readGroup(s, 'u16b');
    eq('and both read back', Object.keys(all).sort().join(','), 'u16b:pool:1,u16b:pool:2');
  }

  /* ==================================================================== */
  section('Defect (a) — a failed read must never be mistaken for "no data"');

  {
    const s = makeStore();
    await R.writeMatch(s, 'u16b:pool:1', result(1));
    s.failReads = true;
    let threw = false;
    try { await R.readMatch(s, 'u16b:pool:1'); } catch (e) { threw = true; }
    check('readMatch THROWS rather than answering null', threw);
  }

  {
    const s = makeStore();
    await R.writeMatch(s, 'u16b:pool:1', result(1));
    s.failList = true;
    let threw = false;
    try { await R.readGroup(s, 'u16b'); } catch (e) { threw = true; }
    check('a failed LIST throws too — "I could not ask" is not "there is nothing"', threw);
  }

  {
    /* The scenario in full: fourteen stored, the fifteenth saved while reads
       are failing. Under the old layout this replaced the group with one entry.
       Now the write touches only its own key and the other fourteen cannot be
       reached by it, failing reads or not. */
    const s = makeStore();
    for (let i = 1; i <= 14; i++) await R.writeMatch(s, `u16b:pool:${i}`, result(i));
    await R.writeMatch(s, 'u16b:pool:15', result(15));
    const after = await R.readGroup(s, 'u16b');
    eq('saving the 15th leaves all 15 present', Object.keys(after).length, 15);
    check('and the 14 earlier ones are untouched', !!after['u16b:pool:1'] && !!after['u16b:pool:14']);
  }

  /* ==================================================================== */
  section('Defect (b) — two managers scoring the same group, interleaved');

  {
    /* ⚠️ HAND-SEQUENCED. This is A-reads, B-reads, A-writes, B-writes — the
       order in which the old code lost A's score and told both people it had
       saved. Nothing here awaits one save fully before starting the other. */
    const s = makeStore();
    const aRead = await R.readGroup(s, 'u16b');
    const bRead = await R.readGroup(s, 'u16b');
    eq('both managers start from the same empty group', Object.keys(aRead).length + Object.keys(bRead).length, 0);

    await R.writeMatch(s, 'u16b:pool:1', result(1));   // manager A saves match 1
    await R.writeMatch(s, 'u16b:pool:2', result(2));   // manager B saves match 2

    const after = await R.readGroup(s, 'u16b');
    eq('BOTH results survive', Object.keys(after).length, 2);
    eq("A's score is still there", after['u16b:pool:1'].homeScore, 1);
    eq("B's score is still there", after['u16b:pool:2'].homeScore, 2);
  }

  {
    /* Concurrently, not in sequence — same expectation. */
    const s = makeStore();
    await Promise.all([
      R.writeMatch(s, 'u16b:pool:1', result(1)),
      R.writeMatch(s, 'u16b:pool:2', result(2)),
      R.writeMatch(s, 'u16b:pool:3', result(3)),
    ]);
    eq('three concurrent saves keep three results', Object.keys(await R.readGroup(s, 'u16b')).length, 3);
  }

  {
    /* Two people on the SAME match is last-write-wins, and that is correct —
       one match has one score. Asserted so nobody "fixes" it later. */
    const s = makeStore();
    await R.writeMatch(s, 'u16b:pool:1', result(1));
    await R.writeMatch(s, 'u16b:pool:1', result(9));
    eq('the same match twice keeps the LAST score', (await R.readMatch(s, 'u16b:pool:1')).homeScore, 9);
  }

  /* ==================================================================== */
  section('Age groups cannot read each other');

  {
    const s = makeStore();
    await R.writeMatch(s, 'u12:pool:1', result(1));
    await R.writeMatch(s, 'u12g:pool:1', result(2));
    /* ⚠️ THE TRAILING COLON. A prefix of 'm:u12' matches 'm:u12g:…' too, which
       would hand U12G's scores to U12. This pair is the only thing watching it. */
    eq('u12 sees only its own match', Object.keys(await R.readGroup(s, 'u12')).join(','), 'u12:pool:1');
    eq('u12g sees only its own match', Object.keys(await R.readGroup(s, 'u12g')).join(','), 'u12g:pool:1');
  }

  /* ==================================================================== */
  section('Clearing writes a tombstone, because deleting would resurrect');

  {
    /* A result recorded under the OLD group layout, then cleared. If clearing
       merely deleted the per-match key, the next read would fall back to the
       group blob and bring it straight back. */
    const s = makeStore();
    await s.setJSON('ag:u16b', { 'u16b:pool:1': result(1) });
    eq('the legacy group result is visible first', Object.keys(await R.readGroup(s, 'u16b')).length, 1);

    await R.clearMatch(s, 'u16b:pool:1');
    check('a tombstone was written, not a delete', s.data.has('m:u16b:pool:1'));
    eq('and the match reads as absent', await R.readMatch(s, 'u16b:pool:1'), null);
    eq('…including in the group view', Object.keys(await R.readGroup(s, 'u16b')).length, 0);
    eq('…and in the public view', Object.keys(await R.readAll(s)).length, 0);
  }

  {
    const s = makeStore();
    await R.writeMatch(s, 'u16b:pool:1', result(1));
    await R.clearMatch(s, 'u16b:pool:1');
    eq('clearing a per-match result also hides it', await R.readMatch(s, 'u16b:pool:1'), null);
    await R.writeMatch(s, 'u16b:pool:1', result(7));
    eq('and re-entering a score after a clear works', (await R.readMatch(s, 'u16b:pool:1')).homeScore, 7);
  }

  /* ==================================================================== */
  section('The three layouts, in the documented order of authority');

  {
    const s = makeStore();
    await s.setJSON('all', { 'u16b:pool:1': result(1), 'u16b:pool:2': result(2), 'u9:pool:1': result(3) });
    eq('layout 1 alone is served', Object.keys(await R.readAll(s)).length, 3);

    await s.setJSON('ag:u16b', { 'u16b:pool:1': result(4) });
    let all = await R.readAll(s);
    eq('a group blob supersedes the legacy slice for that group', all['u16b:pool:1'].homeScore, 4);
    check('…and replaces it rather than merging', !all['u16b:pool:2']);
    eq('…leaving other groups on the legacy blob', all['u9:pool:1'].homeScore, 3);

    await R.writeMatch(s, 'u16b:pool:1', result(5));
    all = await R.readAll(s);
    eq('a per-match blob supersedes the group blob', all['u16b:pool:1'].homeScore, 5);
    eq('…and does not disturb other groups', all['u9:pool:1'].homeScore, 3);

    /* ⚠️ ASSERTED THROUGH readGroup TOO, NOT ONLY readAll. Found by injecting
       `else if (!merged[matchId])` into readGroup — which makes the OLD group
       blob win over a freshly saved score — and watching all 32 checks pass,
       because every supersession check above went through readAll. Two callers,
       two merges; a test of one says nothing about the other. This is what a
       manager sees on their own dashboard after editing a migrated result. */
    const grp = await R.readGroup(s, 'u16b');
    eq('…and readGroup agrees with readAll about which wins', grp['u16b:pool:1'].homeScore, 5);
    eq('…including for a match only the group blob has', grp['u16b:pool:2'], undefined);
  }

  {
    /* No migration runs on deploy, so this is the ordinary state for weeks:
       old results in the old place, new ones beside them. */
    const s = makeStore();
    await s.setJSON('all', { 'u16b:pool:1': result(1) });
    await R.writeMatch(s, 'u16b:pool:2', result(2));
    const all = await R.readAll(s);
    eq('an unmigrated result and a new one are both served', Object.keys(all).length, 2);
    check('the old one is untouched on disk', s.data.has('all'));
  }

  /* ==================================================================== */
  section('The public reader stays forgiving — a blank table is worse than a stale one');

  {
    const s = makeStore();
    await s.setJSON('all', { 'u16b:pool:1': result(1) });
    await R.writeMatch(s, 'u16b:pool:2', result(2));
    s.failList = true;
    const all = await R.readAll(s);
    /* ⚠️ DELIBERATELY THE OPPOSITE RULE TO THE WRITE PATH. Serving a stale
        score is recoverable; storing over a real one is not. */
    eq('a list failure still serves what could be read', Object.keys(all).length, 1);
    check('and it is the older layout that survives', !!all['u16b:pool:1']);
  }

  summary('test-results-storage.js');
})();
