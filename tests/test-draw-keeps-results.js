/* tests/test-draw-keeps-results.js
   ------------------------------------------------------------------------
   A draw edit must never strand a recorded score (JRT-6 and JRT-26, 11 Sep 2026).
   Ruling: claude/decisions/2026-09-11-draw-edits-keep-results.md

   Results are stored under the match id and carry NO team codes. So a rebuild
   that mints new ids strands the scores already entered (they drop out of the
   table), and one that keeps an id but flips home and away hands a score to
   the wrong side. Three layers, each DRIVEN, not grepped:
     1. regeneratePoolSlots (scores-data.js, the real module): a pairing that
        already has a slot keeps its id AND its old sides.
     2. save-schedule-override.js (the real handler, in-memory blobs): no save
        may remove a scored slot or change a team it named, organisers
        included, and a results read that fails refuses the save.
     3. The Draw tab (Manager.dc.html, the real component, with the real
        rebuild): a rebuild that would drop a scored match is refused before it
        is offered, naming the match.

   ⚠️ Every value here is invented. */

const path = require('path');
const Module = require('module');
const { readRepo, repoRoot, section, check, eq, summary } = require('./_lib');

/* ---- in-memory blob stores (same shape as test-draw-rights.js) ---------- */
const stores = new Map();
let listFails = false; // makes the results store's list() fail, for the 503 case
function storeFor(name) {
  if (!stores.has(name)) {
    const data = new Map();
    stores.set(name, {
      data,
      async get(key, opts) {
        if (!data.has(key)) return null;
        const raw = data.get(key);
        return opts && opts.type === 'json' ? JSON.parse(raw) : raw;
      },
      async setJSON(key, value) { data.set(key, JSON.stringify(value)); },
      async set(key, value) { data.set(key, String(value)); },
      async delete(key) { data.delete(key); },
      /* Honours `prefix`, as the real store does: readGroup lists 'm:<group>:'. */
      async list(opts) {
        if (name === 'results' && listFails) throw new Error('simulated list failure');
        const prefix = (opts && opts.prefix) || '';
        return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
      },
    });
  }
  return stores.get(name);
}
let accountsList = [];
const stubs = {
  '@netlify/blobs': {
    getStore: (arg) => {
      const name = typeof arg === 'string' ? arg : (arg && arg.name);
      if (name === 'accounts') {
        return {
          async get(key) { return key === 'list' ? accountsList : null; },
          async setJSON(key, value) { if (key === 'list') accountsList = value; },
          async delete() {}, async list() { return { blobs: [] }; },
        };
      }
      return storeFor(name);
    },
  },
  bcryptjs: { hashSync: (p) => `hashed:${p}`, compareSync: (p, h) => h === `hashed:${p}`, hash: async (p) => `hashed:${p}`, compare: async (p, h) => h === `hashed:${p}` },
};
const realResolve = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) { return Object.prototype.hasOwnProperty.call(stubs, r) ? 'STUB:' + r : realResolve.call(this, r, ...rest); };
const realLoad = Module._load;
Module._load = function (r, ...rest) { return Object.prototype.hasOwnProperty.call(stubs, r) ? stubs[r] : realLoad.call(this, r, ...rest); };
process.env.SESSION_SECRET = 'test-not-a-real-value';

const FN = path.join(repoRoot(), 'netlify', 'functions');
const { DEFAULT_VENUE } = require(path.join(FN, '_venue.js'));
const { draftKey } = require(path.join(FN, '_publish.js'));
const { sign } = require(path.join(FN, '_auth.js'));
const save = require(path.join(FN, 'save-schedule-override.js'));

async function loadScoresData() {
  const p = path.join(repoRoot(), 'scores-data.js').replace(/\\/g, '/');
  return import(p.startsWith('/') ? `file://${p}` : `file:///${p}`);
}

/* ---- the Manager page harness (same as test-manager-dc-draw.js) --------- */
class DCLogic {
  setState(patch, cb) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    if (typeof cb === 'function') cb();
  }
}
function buildPage() {
  const t = readRepo('Manager.dc.html');
  const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no x-dc script found in Manager.dc.html');
  // eslint-disable-next-line no-new-func
  const C = new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
    DCLogic,
    { addEventListener() {}, matchMedia: () => ({ matches: false, addListener() {} }), scrollTo() {} },
    { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], body: { style: {} }, baseURI: 'https://adhjrt.com/' }
  );
  const c = new C();
  c.props = {};
  return c;
}

/* ---- the server fixtures ------------------------------------------------ */
const G = Object.keys(DEFAULT_VENUE.day2.groups)[0];
const ID = (n) => `${G}:A:${n}`;
const KO = `${G}:CUP`;
const storedDraw = () => ({
  pools: [{ id: 'A', name: 'Pool A', teams: ['T1', 'T2', 'T3'] }],
  slots: [
    { id: ID(0), poolId: 'A', home: 'T1', away: 'T2', startMins: 480, pitch: 'A1' },
    { id: ID(1), poolId: 'A', home: 'T2', away: 'T3', startMins: 500, pitch: 'A1' },
    { id: ID(2), poolId: 'A', home: 'T1', away: 'T3', startMins: 520, pitch: 'A1' },
  ],
  knockout: [{ id: KO, round: 'Cup Final', home: '', away: '', startMins: 600, pitch: 'A1' }],
});
const schedules = () => storeFor('schedules');
const results = () => storeFor('results');
const score = (id) => results().setJSON(`m:${id}`, { homeScore: 12, awayScore: 5, homeTries: 2, awayTries: 1, submittedAt: 'x' });
const clearScore = (id) => results().setJSON(`m:${id}`, { cleared: true, clearedAt: 'x' });
const draftNow = async () => schedules().get(draftKey(G), { type: 'json' });
async function seed() {
  stores.clear(); listFails = false;
  accountsList = [{ username: 'orga', name: 'Orga', role: 'organizer', approved: true, passwordHash: 'hashed:x' }];
  await schedules().setJSON(draftKey(G), storedDraw());
}
const orgToken = () => sign({ username: 'orga', role: 'organizer' });
async function saveAsOrganiser(body) {
  const res = await save.handler({ httpMethod: 'POST', headers: { authorization: `Bearer ${orgToken()}` }, body: JSON.stringify({ ageGroupId: G, ...body }) });
  return { status: res.statusCode, ...JSON.parse(res.body || '{}') };
}
const without = (draw, id) => ({ ...draw, slots: draw.slots.filter((s) => s.id !== id) });

(async () => {
  const sd = await loadScoresData();
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

  /* ==================================================================== */
  section('regeneratePoolSlots: a pairing that already has a slot keeps it');
  {
    const teams = ['T1', 'T2', 'T3', 'T4'];
    const first = sd.regeneratePoolSlots('u14b', 'A', teams, []);
    check('control: with no existing slots it builds a fresh schedule, every id new',
      first.length === 6 && first.every((s) => /^u14b:A:new\d+:\d+$/.test(s.id)), JSON.stringify(first.map((s) => s.id)));

    /* Stable, recognisable ids stand in for the ones a saved draw holds. */
    const existing = first.map((s, i) => ({ ...s, id: `u14b:A:old${i}` }));
    const again = sd.regeneratePoolSlots('u14b', 'A', teams, existing);
    check('a rebuild with the same teams keeps every slot id', sameSet(again.map((s) => s.id), existing.map((s) => s.id)),
      JSON.stringify(again.map((s) => s.id)));
    check('…and every slot keeps its own sides',
      again.every((s) => { const o = existing.find((x) => x.id === s.id); return o && o.home === s.home && o.away === s.away; }));

    /* ⚠️ The case that matters most: the stored slot has the pairing the
       OTHER way round from how the rebuild would schedule it. Keeping the id
       but taking the rebuild's sides would hand the score to the wrong team. */
    const flipped = existing.map((s, i) => (i === 0 ? { ...s, home: s.away, away: s.home } : s));
    const r = sd.regeneratePoolSlots('u14b', 'A', teams, flipped).find((s) => s.id === flipped[0].id);
    check('⚠️ a pairing the rebuild would schedule the other way round keeps its OLD home and away',
      !!r && r.home === flipped[0].home && r.away === flipped[0].away, JSON.stringify(r));

    const five = sd.regeneratePoolSlots('u14b', 'A', [...teams, 'T5'], existing);
    const oldIds = existing.map((s) => s.id);
    const withT5 = five.filter((s) => s.home === 'T5' || s.away === 'T5');
    check('a new team keeps every old slot and gets new ids for its own pairings',
      oldIds.every((id) => five.some((s) => s.id === id)) && withT5.length === 4 && withT5.every((s) => !oldIds.includes(s.id)));
    check('…and no id is used twice', new Set(five.map((s) => s.id)).size === five.length);

    const three = sd.regeneratePoolSlots('u14b', 'A', ['T1', 'T2', 'T3'], existing);
    const keptIds = existing.filter((s) => s.home !== 'T4' && s.away !== 'T4').map((s) => s.id);
    check('a removed team\'s pairings are dropped and the rest keep their ids', sameSet(three.map((s) => s.id), keptIds),
      JSON.stringify(three.map((s) => s.id)));

    const otherPool = [{ id: 'u14b:B:old9', poolId: 'B', home: 'T1', away: 'T2', startMins: 480, pitch: 'A2' }];
    check('another pool\'s slot is never borrowed',
      !sd.regeneratePoolSlots('u14b', 'A', teams, otherPool).some((s) => s.id === 'u14b:B:old9'));
  }

  /* ==================================================================== */
  section('⚠️ save-schedule-override: no save may strand a recorded score');
  {
    await seed(); await score(ID(0));
    let r = await saveAsOrganiser({ schedule: without(storedDraw(), ID(0)) });
    eq('⚠️ an organiser save that drops a scored match is refused (409)', r.status, 409);
    check('…naming the match', /T1 v T2/.test(r.error || ''), r.error);
    eq('…and the stored draft is untouched', JSON.stringify(await draftNow()), JSON.stringify(storedDraw()));

    const swapped = storedDraw(); swapped.slots[0] = { ...swapped.slots[0], home: 'T2', away: 'T1' };
    r = await saveAsOrganiser({ schedule: swapped });
    eq('⚠️ keeping a scored slot\'s id but swapping its teams is refused', r.status, 409);

    const moved = without(storedDraw(), ID(1)); moved.slots[0] = { ...moved.slots[0], startMins: 700, pitch: 'A2' };
    r = await saveAsOrganiser({ schedule: moved });
    eq('moving a scored match to a new time and pitch, and dropping an unscored one, is allowed', r.status, 200);

    await seed(); await score(ID(0));
    r = await saveAsOrganiser({ reset: true });
    eq('clearing the draft (reset) while a match has a score is refused', r.status, 409);
    check('…and the draft survives', !!(await draftNow()));

    await clearScore(ID(0));
    r = await saveAsOrganiser({ schedule: without(storedDraw(), ID(0)) });
    eq('once the score is cleared, the same save goes through', r.status, 200);

    await seed(); await score(KO);
    const filled = storedDraw(); filled.knockout[0] = { ...filled.knockout[0], home: 'T1', away: 'T2' };
    r = await saveAsOrganiser({ schedule: filled });
    eq('a scored knockout placeholder may have its teams filled in', r.status, 200);
    const noKo = storedDraw(); delete noKo.knockout;
    r = await saveAsOrganiser({ schedule: noKo });
    eq('dropping a scored saved knockout slot is refused', r.status, 409);

    await seed();
    r = await saveAsOrganiser({ schedule: { pools: storedDraw().pools, slots: [] } });
    eq('control: with no scores recorded, dropping every match is allowed', r.status, 200);

    await seed(); await score(ID(0)); listFails = true;
    r = await saveAsOrganiser({ schedule: storedDraw() });
    eq('⚠️ a results read that fails refuses the save (503), never "nothing recorded"', r.status, 503);
    eq('…and the draft is untouched', JSON.stringify(await draftNow()), JSON.stringify(storedDraw()));
    listFails = false;
  }

  /* ==================================================================== */
  section('The Draw tab: a rebuild keeps scored matches, or refuses before it is offered');
  {
    const base = sd.regeneratePoolSlots('u14b', 'A', ['T1', 'T2', 'T3'], [])
      .map((s, i) => ({ ...s, id: `u14b:A:old${i}`, pitch: 'A1' }));
    const api = {
      getDraw: async () => null, saveDraw: async () => ({ ok: true }), autoKnockoutSlots: async () => [],
      regeneratePoolSlots: sd.regeneratePoolSlots,
      minutesToDisplay: (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`,
      minutesToTimeInput: (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
      timeToMinutes: () => NaN, slotLengthMins: () => 20, dayStartMins: () => 480,
      pitchesForAgeGroup: () => ['A1'], canPublishNow: () => false, isOrganiserSession: () => false,
      getMyRegistrations: async () => ({ teams: [], players: [], scope: '' }), teamLabel: (c) => c, teamShort: (c) => c,
    };
    const pageWith = (teams, slots, scoredId) => {
      const c = buildPage();
      c.state = {
        ...c.state, api, session: { ageGroupId: 'u14b', token: 'tok' },
        ageGroups: [{ id: 'u14b', name: 'U14 Boys', hasStandings: true }], ageId: 'u14b', tab: 'draw',
        draw: { pools: [{ id: 'A', name: 'Pool A', teams }], slots, knockout: [], pitches: ['A1'],
          _publish: { published: false }, _rights: { pools: true, times: true, frozen: false, frozenNote: '' } },
        drawLoadedFor: 'u14b', modal: null, drawMsg: '',
        fixtures: { awaitingPublication: false, pool: slots.map((s) => ({ ...s, stage: 'pool', result: s.id === scoredId ? { homeScore: 12, awayScore: 5 } : null })), knockout: [] },
      };
      return c;
    };

    const scored = base[0];
    let c = pageWith(['T1', 'T2', 'T3'], base, scored.id);
    c.regeneratePool('A');
    check('with nothing to lose, the rebuild still asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
    c.submitModal();
    const after = c.state.draw.slots.find((s) => s.id === scored.id);
    check('⚠️ the Draw tab\'s rebuild keeps the scored match\'s id and teams',
      !!after && after.home === scored.home && after.away === scored.away, JSON.stringify(c.state.draw.slots.map((s) => s.id)));

    const withT3 = base.find((s) => s.home === 'T3' || s.away === 'T3');
    c = pageWith(['T1', 'T2'], base, withT3.id);
    c.regeneratePool('A');
    check('⚠️ a rebuild that would drop a scored match is refused before it is offered',
      !(c.state.modal && c.state.modal.kind === 'confirm') && /Not regenerated/.test(c.state.drawMsg || ''), c.state.drawMsg);
    check('…naming the match', (c.state.drawMsg || '').includes(`${withT3.home} v ${withT3.away}`), c.state.drawMsg);
    check('…and nothing changed', sameSet(c.state.draw.slots.map((s) => s.id), base.map((s) => s.id)));

    c = pageWith(['T1', 'T2'], base, withT3.id);
    c.resetDraw();
    check('Regenerate all refuses the same way',
      !(c.state.modal && c.state.modal.kind === 'confirm') && /Not regenerated/.test(c.state.drawMsg || ''), c.state.drawMsg);
  }

  summary('test-draw-keeps-results.js');
})();
