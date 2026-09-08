/* tests/test-draw-rights.js
   ------------------------------------------------------------------------
   Who may change a draw, and when. Spec: claude/specs/spec-draw-rights-sep-2026.md

   DRIVEN, NOT GREPPED. The real save-schedule-override, publish-schedule,
   get-schedule-override and accounts-admin handlers run against in-memory
   blob stores; the rules module is exercised directly with `now` pinned to
   DEFAULT_VENUE's dates, so moving the tournament cannot make these lie; and
   the two pages are built from their real component code.

   THE FOUR THAT EARN THEIR KEEP:
   1. A manager with NO switches cannot save anything (results-only default).
   2. A pools-only manager who changes a kickoff is refused, and one who
      changes only team lists is not — the comparison is against the STORED
      draft, never the client's word.
   3. On the group's own match day a manager is refused and an organiser is
      not; the day before, the manager is fine.
   4. A manager can never publish, any day.

   ⚠️ Every value here is invented. */

const path = require('path');
const Module = require('module');
const { readRepo, repoRoot, section, check, eq, summary } = require('./_lib');

/* ---- stubs -------------------------------------------------------------- */
const stores = new Map();
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
      async list() { return { blobs: [...data.keys()].map((key) => ({ key })) }; },
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
const rights = require(path.join(FN, '_drawRights.js'));
const { DEFAULT_VENUE, dayIdOf } = require(path.join(FN, '_venue.js'));
const { publishDenialReason } = require(path.join(FN, '_publish.js'));
const { sign } = require(path.join(FN, '_auth.js'));
const save = require(path.join(FN, 'save-schedule-override.js'));
const publish = require(path.join(FN, 'publish-schedule.js'));
const getOverride = require(path.join(FN, 'get-schedule-override.js'));
const admin = require(path.join(FN, 'accounts-admin.js'));

/* A group on each day, read from the layout rather than typed. */
const DAY1_GROUP = Object.keys(DEFAULT_VENUE.day1.groups)[0];
const DAY2_GROUP = Object.keys(DEFAULT_VENUE.day2.groups)[0];
const GST = '+04:00';
const at = (isoDate, hhmm) => Date.parse(`${isoDate}T${hhmm}:00${GST}`);
const DAY1 = DEFAULT_VENUE.day1.date, DAY2 = DEFAULT_VENUE.day2.date;
const dayBefore = (iso) => new Date(Date.parse(`${iso}T00:00:00${GST}`) - 86400000).toISOString().slice(0, 10);

const ORG = { role: 'organizer', username: 'orga' };
const mgr = (ag, flags = {}) => ({ role: 'manager', username: 'mgr', ageGroupId: ag, ...flags });
const draft = () => ({
  pools: [{ id: 'A', name: 'Pool A', teams: ['T1', 'T2', 'T3'] }],
  slots: [{ id: 's1', poolId: 'A', home: 'T1', away: 'T2', startMins: 480, pitch: 'A1' }, { id: 's2', poolId: 'A', home: 'T2', away: 'T3', startMins: 500, pitch: 'A1' }],
  knockout: [{ id: 'k1', round: 'Final', home: '', away: '', startMins: 600, pitch: 'A1' }],
});

const seedAccounts = () => {
  accountsList = [
    { username: 'orga', name: 'Orga', role: 'organizer', approved: true, passwordHash: 'hashed:x' },
    { username: 'mgr', name: 'Mgr', role: 'manager', ageGroupId: DAY2_GROUP, approved: true, passwordHash: 'hashed:x' },
    { username: 'mgr1', name: 'Mgr One', role: 'manager', ageGroupId: DAY1_GROUP, approved: true, passwordHash: 'hashed:x' },
  ];
};
const tokenFor = (u) => { const a = accountsList.find((x) => x.username === u); return sign(a.role === 'organizer' ? { username: u, role: 'organizer' } : { username: u, role: 'manager', ageGroupId: a.ageGroupId }); };
const call = (handler, u, body, method = 'POST', qs) => handler({ httpMethod: method, headers: { authorization: `Bearer ${tokenFor(u)}` }, body: body ? JSON.stringify(body) : undefined, queryStringParameters: qs });
const parse = async (res) => ({ status: res.statusCode, ...JSON.parse(res.body || '{}') });
const schedules = () => storeFor('schedules');
const resetStores = () => { stores.clear(); };

(async () => {
  /* ==================================================================== */
  section('⚠️ rightsFor: results-only by default, two switches, organisers everything');
  {
    eq('no session: nothing', JSON.stringify(rights.rightsFor(null)), JSON.stringify({ pools: false, times: false }));
    eq('a manager with no switches: nothing', JSON.stringify(rights.rightsFor(mgr('u9'))), JSON.stringify({ pools: false, times: false }));
    eq('drawPools alone', JSON.stringify(rights.rightsFor(mgr('u9', { drawPools: true }))), JSON.stringify({ pools: true, times: false }));
    eq('drawTimes alone', JSON.stringify(rights.rightsFor(mgr('u9', { drawTimes: true }))), JSON.stringify({ pools: false, times: true }));
    eq('a string "true" is not a right', JSON.stringify(rights.rightsFor(mgr('u9', { drawPools: 'true' }))), JSON.stringify({ pools: false, times: false }));
    eq('an organiser has both', JSON.stringify(rights.rightsFor(ORG)), JSON.stringify({ pools: true, times: true }));
    eq('the * admin-manager gets both when either is set', JSON.stringify(rights.rightsFor(mgr('*', { drawTimes: true }))), JSON.stringify({ pools: true, times: true }));
    eq('…and nothing when neither is', JSON.stringify(rights.rightsFor(mgr('*'))), JSON.stringify({ pools: false, times: false }));
  }

  /* ==================================================================== */
  section('⚠️ The freeze: midnight of the group\'s OWN day, managers only, pinned to DEFAULT_VENUE');
  {
    check('control: the two sample groups are on different days', dayIdOf(DEFAULT_VENUE, DAY1_GROUP) === 'day1' && dayIdOf(DEFAULT_VENUE, DAY2_GROUP) === 'day2');
    const m2 = mgr(DAY2_GROUP, { drawPools: true, drawTimes: true });
    check('a day-2 manager is FREE on day 1 (they may be watching)', rights.freezeReason(m2, DAY2_GROUP, at(DAY1, '10:00')) === null);
    check('…and free at 23:59 the night before their day', rights.freezeReason(m2, DAY2_GROUP, at(dayBefore(DAY2), '23:59')) === null);
    check('⚠️ …and frozen at 00:00 on their day', /locked on match day/.test(rights.freezeReason(m2, DAY2_GROUP, at(DAY2, '00:00')) || ''));
    check('…and at 07:00 with a genuine late withdrawal', /locked on match day/.test(rights.freezeReason(m2, DAY2_GROUP, at(DAY2, '07:00')) || ''));
    const m1 = mgr(DAY1_GROUP, { drawPools: true, drawTimes: true });
    check('a day-1 manager is frozen on day 1', /locked/.test(rights.freezeReason(m1, DAY1_GROUP, at(DAY1, '09:00')) || ''));
    check('…and still frozen on day 2 (the tournament has not ended)', /locked/.test(rights.freezeReason(m1, DAY1_GROUP, at(DAY2, '09:00')) || ''));
    check('…and free again the day after the tournament', rights.freezeReason(m1, DAY1_GROUP, at(DAY2, '09:00') + 86400000) === null);
    check('⚠️ an organiser is never frozen', rights.freezeReason(ORG, DAY1_GROUP, at(DAY1, '09:00')) === null);
    check('a group on neither day is never frozen', rights.freezeReason(mgr('u99'), 'u99', at(DAY1, '09:00')) === null);
  }

  /* ==================================================================== */
  section('⚠️ saveDenialReason: compared against the STORED draft');
  {
    const before = at(dayBefore(DAY1), '12:00');
    const stored = draft();
    const pOnly = mgr(DAY2_GROUP, { drawPools: true });
    const tOnly = mgr(DAY2_GROUP, { drawTimes: true });
    const both = mgr(DAY2_GROUP, { drawPools: true, drawTimes: true });
    const none = mgr(DAY2_GROUP);

    check('organiser: never refused', rights.saveDenialReason(ORG, DAY2_GROUP, { stored, incoming: draft(), now: before }) === null);
    check('⚠️ no switches: refused with the organisers-manage sentence', rights.saveDenialReason(none, DAY2_GROUP, { stored, incoming: draft(), now: before }) === rights.NO_RIGHTS);
    check('both switches: allowed', rights.saveDenialReason(both, DAY2_GROUP, { stored, incoming: draft(), now: before }) === null);
    check('both switches on match day: the freeze wins', /locked/.test(rights.saveDenialReason(both, DAY2_GROUP, { stored, incoming: draft(), now: at(DAY2, '09:00') }) || ''));

    let inc = draft(); inc.slots[0].startMins = 495;
    eq('⚠️ pools-only changing ONE kickoff is refused', rights.saveDenialReason(pOnly, DAY2_GROUP, { stored, incoming: inc, now: before }), rights.POOLS_ONLY);
    inc = draft(); inc.slots[1].pitch = 'B2';
    eq('pools-only changing a pitch is refused', rights.saveDenialReason(pOnly, DAY2_GROUP, { stored, incoming: inc, now: before }), rights.POOLS_ONLY);
    inc = draft(); inc.knockout[0].startMins = 660;
    eq('pools-only changing a knockout kickoff is refused', rights.saveDenialReason(pOnly, DAY2_GROUP, { stored, incoming: inc, now: before }), rights.POOLS_ONLY);
    inc = draft(); inc.slots.push({ id: 's3', poolId: 'A', home: 'T1', away: 'T3', startMins: 520, pitch: 'A1' });
    eq('pools-only adding a slot (a new time) is refused', rights.saveDenialReason(pOnly, DAY2_GROUP, { stored, incoming: inc, now: before }), rights.POOLS_ONLY);
    inc = draft(); inc.pools[0].teams.push('T4');
    check('⚠️ pools-only changing only the team list is ALLOWED', rights.saveDenialReason(pOnly, DAY2_GROUP, { stored, incoming: inc, now: before }) === null);
    inc = draft(); inc.slots[0].home = 'T3';
    check('pools-only swapping a pairing is allowed', rights.saveDenialReason(pOnly, DAY2_GROUP, { stored, incoming: inc, now: before }) === null);
    inc = draft(); inc.knockout[0].home = 'T1';
    check('pools-only placing a team in the bracket is allowed', rights.saveDenialReason(pOnly, DAY2_GROUP, { stored, incoming: inc, now: before }) === null);
    eq('pools-only reset is refused', rights.saveDenialReason(pOnly, DAY2_GROUP, { stored, reset: true, now: before }), rights.POOLS_ONLY);
    eq('⚠️ pools-only with NO stored draft: ask an organiser to save once', rights.saveDenialReason(pOnly, DAY2_GROUP, { stored: null, incoming: draft(), now: before }), rights.FIRST_DRAFT);

    inc = draft(); inc.pools[0].teams.push('T4');
    eq('times-only changing a team list is refused', rights.saveDenialReason(tOnly, DAY2_GROUP, { stored, incoming: inc, now: before }), rights.TIMES_ONLY);
    inc = draft(); inc.slots[0].away = 'T3';
    eq('times-only changing a pairing is refused', rights.saveDenialReason(tOnly, DAY2_GROUP, { stored, incoming: inc, now: before }), rights.TIMES_ONLY);
    inc = draft(); inc.slots[0].startMins = 495; inc.slots[1].pitch = 'B2';
    check('times-only changing kickoffs and pitches is allowed', rights.saveDenialReason(tOnly, DAY2_GROUP, { stored, incoming: inc, now: before }) === null);
    inc = draft(); inc.pools[0].name = 'Pool Z';
    eq('times-only renaming a pool is refused', rights.saveDenialReason(tOnly, DAY2_GROUP, { stored, incoming: inc, now: before }), rights.TIMES_ONLY);
  }

  /* ==================================================================== */
  section('⚠️ save-schedule-override: the rule is enforced by the handler, against the blob');
  {
    resetStores(); seedAccounts();
    await schedules().setJSON(DAY2_GROUP, draft());

    let r = await parse(await call(save.handler, 'mgr', { ageGroupId: DAY2_GROUP, schedule: draft() }));
    eq('⚠️ a manager with no switches is 403', r.status, 403);
    eq('…with the organisers-manage sentence', r.error, rights.NO_RIGHTS);
    eq('…and the draft is untouched', JSON.stringify(await schedules().get(DAY2_GROUP, { type: 'json' })), JSON.stringify(draft()));

    accountsList[1].drawPools = true;
    let inc = draft(); inc.slots[0].startMins = 495;
    r = await parse(await call(save.handler, 'mgr', { ageGroupId: DAY2_GROUP, schedule: inc }));
    eq('⚠️ pools-only changing a kickoff is 403 — read from the ACCOUNT, not the token', r.status, 403);
    eq('…with the pools-only sentence', r.error, rights.POOLS_ONLY);
    inc = draft(); inc.pools[0].teams.push('T4');
    r = await parse(await call(save.handler, 'mgr', { ageGroupId: DAY2_GROUP, schedule: inc }));
    eq('pools-only changing teams is 200', r.status, 200);
    eq('…and stored', (await schedules().get(DAY2_GROUP, { type: 'json' })).pools[0].teams.length, 4);
    r = await parse(await call(save.handler, 'mgr', { ageGroupId: DAY2_GROUP, reset: true }));
    eq('pools-only reset is 403', r.status, 403);
    check('…and the draft survives', !!(await schedules().get(DAY2_GROUP, { type: 'json' })));

    /* A forged token claiming rights: the account says no. */
    accountsList[1].drawPools = false;
    const forged = sign({ username: 'mgr', role: 'manager', ageGroupId: DAY2_GROUP, drawPools: true, drawTimes: true });
    r = await parse(await save.handler({ httpMethod: 'POST', headers: { authorization: `Bearer ${forged}` }, body: JSON.stringify({ ageGroupId: DAY2_GROUP, schedule: draft() }) }));
    eq('⚠️ a token that CLAIMS both rights is still refused when the account has none', r.status, 403);

    r = await parse(await call(save.handler, 'orga', { ageGroupId: DAY2_GROUP, schedule: draft() }));
    eq('an organiser saves fine', r.status, 200);
    r = await parse(await call(save.handler, 'orga', { ageGroupId: DAY2_GROUP, reset: true }));
    eq('…and resets fine', r.status, 200);
    accountsList[1].drawPools = true;
    r = await parse(await call(save.handler, 'mgr', { ageGroupId: DAY2_GROUP, schedule: draft() }));
    eq('pools-only with no stored draft: 403, organiser saves first', r.status, 403);
    eq('…with that sentence', r.error, rights.FIRST_DRAFT);
    r = await parse(await call(save.handler, 'mgr', { ageGroupId: DAY2_GROUP, schedule: { pools: 'no' } }));
    eq('an invalid payload is still 400 before any rights check', r.status, 400);
  }

  /* ==================================================================== */
  section('⚠️ Publishing is organiser-only, any day');
  {
    const both = mgr(DAY2_GROUP, { drawPools: true, drawTimes: true });
    check('control: an organiser may publish', publishDenialReason(ORG, DAY2_GROUP, at(DAY2, '09:00')) === null);
    check('⚠️ a manager on a tournament day may NOT', /Only tournament organisers/.test(publishDenialReason(both, DAY2_GROUP, at(DAY2, '09:00')) || ''));
    check('…nor the week before', /Only tournament organisers/.test(publishDenialReason(both, DAY2_GROUP, at(dayBefore(DAY1), '09:00')) || ''));
    check('…nor the * admin-manager', /Only tournament organisers/.test(publishDenialReason(mgr('*', { drawPools: true, drawTimes: true }), DAY2_GROUP, at(DAY2, '09:00')) || ''));
    check('…and the sentence points at review', /review/.test(publishDenialReason(both, DAY2_GROUP) || ''));

    resetStores(); seedAccounts();
    await schedules().setJSON(DAY2_GROUP, draft());
    accountsList[1].drawPools = true; accountsList[1].drawTimes = true;
    let r = await parse(await call(publish.handler, 'mgr', { ageGroupId: DAY2_GROUP, action: 'publish' }));
    eq('publish-schedule refuses a manager with 403', r.status, 403);
    check('…and nothing was published', !(await schedules().get(`pub:${DAY2_GROUP}`, { type: 'json' })));
    r = await parse(await call(publish.handler, 'orga', { ageGroupId: DAY2_GROUP, action: 'publish' }));
    eq('…while an organiser publishes', r.status, 200);

    /* ⚠️ UNDER A TOURNAMENT-DAY CLOCK, or this check cannot discriminate:
       today's clock is outside the window, so the OLD rule
       (isTournamentWindow()) answers false too and restoring it would pass. */
    const realNow = Date.now;
    Date.now = () => at(DAY2, '09:00');
    let pub;
    try { pub = await parse(await call(getOverride.handler, 'mgr', null, 'GET', { age: DAY2_GROUP, draft: '1' })); } finally { Date.now = realNow; }
    eq('get-schedule-override says managerCanPublishNow is false — even ON a tournament day', pub.managerCanPublishNow, false);
    check('…and under that clock the manager\'s own group is frozen', pub.rights && pub.rights.frozen === true, JSON.stringify(pub.rights));
    pub = await parse(await call(getOverride.handler, 'mgr', null, 'GET', { age: DAY2_GROUP, draft: '1' }));
    check('…and hands a signed-in caller their rights', pub.rights && pub.rights.pools === true && pub.rights.times === true && pub.rights.frozen === false, JSON.stringify(pub.rights));
    accountsList[1].drawPools = false; accountsList[1].drawTimes = false;
    const pub2 = await parse(await call(getOverride.handler, 'mgr', null, 'GET', { age: DAY2_GROUP, draft: '1' }));
    check('…which follow the account on the next request, no sign-out', pub2.rights && pub2.rights.pools === false && pub2.rights.times === false);
    const pubOrg = await parse(await call(getOverride.handler, 'orga', null, 'GET', { age: DAY2_GROUP, draft: '1' }));
    check('…and an organiser gets both', pubOrg.rights && pubOrg.rights.pools && pubOrg.rights.times);
    const anon = await parse(await getOverride.handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { age: DAY2_GROUP } }));
    check('the public answer carries no rights', !('rights' in anon));
  }

  /* ==================================================================== */
  section('⚠️ accounts-admin drawRights: organiser-only, managers only, both flags every time');
  {
    resetStores(); seedAccounts();
    let r = await parse(await call(admin.handler, 'orga', { action: 'drawRights', username: 'mgr', drawPools: true }));
    eq('an organiser sets pools on', r.status, 200);
    eq('…stored true', accountsList[1].drawPools, true);
    eq('…and the unsent flag is stored false, not left undefined', accountsList[1].drawTimes, false);
    eq('…stamped by whom', accountsList[1].drawRightsChangedBy, 'orga');
    r = await parse(await call(admin.handler, 'orga', { action: 'drawRights', username: 'mgr', drawPools: 'yes', drawTimes: 1 }));
    eq('truthy non-booleans are NOT rights', accountsList[1].drawPools === false && accountsList[1].drawTimes === false, true);
    r = await parse(await call(admin.handler, 'orga', { action: 'drawRights', username: 'orga', drawPools: true }));
    eq('⚠️ setting a right on an ORGANISER is 400', r.status, 400);
    r = await parse(await call(admin.handler, 'mgr', { action: 'drawRights', username: 'mgr', drawPools: true }));
    eq('⚠️ a manager cannot grant themselves a right', r.status, 403);
    eq('…and nothing changed', accountsList[1].drawPools, false);

    const list = await parse(await call(admin.handler, 'orga', null, 'GET'));
    const me = (list.accounts || []).find((a) => a.username === 'mgr') || {};
    check('the listing carries the two flags', 'drawPools' in me && 'drawTimes' in me);
  }

  /* ==================================================================== */
  section('⚠️ The Draw tab renders against the server\'s rights, never its own');
  {
    class DCLogic { setState(patch, cb) { const p = typeof patch === 'function' ? patch(this.state) : patch; this.state = { ...this.state, ...p }; if (typeof cb === 'function') cb(); } }
    const load = (file) => {
      const t = readRepo(file);
      const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
      // eslint-disable-next-line no-new-func
      return new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
        DCLogic,
        { addEventListener() {}, matchMedia: () => ({ matches: false, addListener() {} }), scrollTo() {}, google: undefined },
        { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], createElement: () => ({}), head: { appendChild() {} }, body: { style: {} }, baseURI: 'https://adhjrt.com/' }
      );
    };
    const M = load('Manager.dc.html');
    const fixture = (r) => ({
      pools: [{ id: 'A', name: 'Pool A', teams: ['ADH1', 'DS1'] }],
      slots: [{ id: 'sA1', poolId: 'A', home: 'ADH1', away: '', startMins: 480, pitch: 'A1' }],
      knockout: [], pitches: ['A1'],
      _publish: { published: false, publishedAt: null, publishedBy: null, managerCanPublishNow: false },
      _rights: r,
    });
    const saves = [];
    const api = {
      getDraw: async () => null, saveDraw: async (...a) => { saves.push(a); return { ok: true }; },
      publishDraw: async () => ({ ok: true }), unpublishDraw: async () => ({ ok: true }), canPublishNow: () => false,
      autoKnockoutSlots: async () => [], regeneratePoolSlots: () => [], pitchesForAgeGroup: () => ['A1'],
      minutesToTimeInput: (m) => String(m), timeToMinutes: (s) => Number(s), teamLabel: (c) => c,
      getMyRegistrations: async () => [], isOrganiserSession: (x) => !!(x && x.ageGroupId === '*'), canScoreAgeGroup: () => true,
      scoringRules: () => ({}), venueDays: () => [], registrationCopy: () => ({}), getFixtures: async () => ({ pool: [], knockout: [] }),
    };
    const page = (r, session) => {
      const c = new M(); c.props = {};
      c.state = { ...c.state, api, session: session || { ageGroupId: 'u14b', token: 't' }, ageGroups: [{ id: 'u14b', name: 'U14 Boys', hasStandings: true }], ageId: 'u14b', tab: 'draw', draw: fixture(r), drawLoadedFor: 'u14b', fixtures: { awaitingPublication: false, pool: [], knockout: [] } };
      saves.length = 0;
      return c;
    };
    const NONE = { pools: false, times: false, frozen: false, frozenNote: '' };
    const POOLS = { pools: true, times: false, frozen: false, frozenNote: '' };
    const TIMES = { pools: false, times: true, frozen: false, frozenNote: '' };
    const BOTH = { pools: true, times: true, frozen: false, frozenNote: '' };
    const FROZEN = { pools: true, times: true, frozen: true, frozenNote: 'The draw is locked on match day. Ask the organiser desk to make changes.' };

    let c = page(NONE); let v = c.renderVals();
    check('⚠️ no rights: the tab says the organisers manage the draw', /organisers manage/i.test(v.drawLockedNote), v.drawLockedNote);
    check('…read-only, no Save', v.drawReadOnly === true && v.drawCanSave === false);
    c.pickTeam('ADH1', { kind: 'pool', poolId: 'A' });
    check('…picking a team does nothing', c.state.picked === null);
    c.onSlotTimeChange('sA1', '500');
    eq('…changing a time does nothing', c.state.draw.slots[0].startMins, 480);
    await c.saveDraw();
    eq('…and Save never reaches the server', saves.length, 0);

    c = page(POOLS); v = c.renderVals();
    check('pools-only: the note says times are the organisers\'', /kickoff times and pitches are set by the organisers/i.test(v.drawLockedNote), v.drawLockedNote);
    check('…Save is offered, Regenerate is not', v.drawCanSave === true && v.drawCanTimes === false);
    c.pickTeam('ADH1', { kind: 'pool', poolId: 'A' });
    check('…picking a team works', !!c.state.picked);
    c.onSlotTimeChange('sA1', '500');
    eq('⚠️ …but changing a kickoff is refused on the page', c.state.draw.slots[0].startMins, 480);
    check('…with the pools-only sentence in drawMsg', /kickoff times and pitches are set by the organisers/i.test(c.state.drawMsg));

    c = page(TIMES); v = c.renderVals();
    c.onSlotTimeChange('sA1', '500');
    eq('times-only: changing a kickoff works', c.state.draw.slots[0].startMins, 500);
    c.pickTeam('ADH1', { kind: 'pool', poolId: 'A' });
    check('…but picking a team is refused', !c.state.picked);

    c = page(BOTH); v = c.renderVals();
    eq('both: no note', v.drawLockedNote, '');
    check('…everything offered', v.drawCanSave && v.drawCanTimes && v.drawCanPools);

    c = page(FROZEN); v = c.renderVals();
    check('⚠️ frozen: the match-day sentence, read-only', /locked on match day/.test(v.drawLockedNote) && v.drawReadOnly === true);
    c.pickTeam('ADH1', { kind: 'pool', poolId: 'A' });
    check('…picking does nothing on match day', !c.state.picked);

    c = page(null, { ageGroupId: '*', token: 't', isOrganizer: true }); v = c.renderVals();
    check('an organiser before the draft answers is unrestricted', v.drawLockedNote === '' && v.drawCanSave === true);
    c = page(null); v = c.renderVals();
    check('a manager before the draft answers is read-only (what the server would say)', v.drawReadOnly === true);
    check('the publish note names organisers and review', /Only tournament organisers/.test(v.publishBlockedNote) && /review/.test(v.publishBlockedNote));
    check('the Draw tab markup carries the note box', /drawLockedNote/.test(readRepo('Manager.dc.html')));

    /* The Accounts card: two switches on a manager, none on an organiser. */
    const O = load('Organizer.dc.html');
    const rightsCalls = [];
    const oapi = {
      setDrawRights: async (u, f) => { rightsCalls.push([u, f]); return { ok: true, drawPools: !!f.drawPools, drawTimes: !!f.drawTimes }; },
      approveAccount: async () => ({ ok: true }), rejectAccount: async () => ({ ok: true }), revokeAccount: async () => ({ ok: true }), listAccounts: async () => ({ ok: true, accounts: [] }),
      canPublishNow: () => false, isOrganiserSession: (x) => !!(x && x.isOrganizer), canScoreAgeGroup: () => true, teamLabel: (x) => x,
      minutesToDisplay: (m) => String(m), minutesToTimeInput: (m) => String(m), pitchesForAgeGroup: () => [], scoringRules: () => ({}), registrationCopy: () => ({}), venueDays: () => [],
    };
    const o = new O(); o.props = {};
    o.state = { ...o.state, api: oapi, tab: 'accounts', accounts: [
      { username: 'orga', name: 'Orga', role: 'organizer', approved: true },
      { username: 'mgr', name: 'Mgr', role: 'manager', ageGroupId: 'u14b', approved: true, drawPools: false, drawTimes: false },
    ] };
    o.openOtherAccount('mgr');
    let ov = o.renderVals();
    check('a manager\'s card shows the switches, both off', ov.acctIsManagerAcct === true && ov.acctDrawPools === false && ov.acctDrawTimes === false);
    await ov.onToggleDrawPools({ target: { checked: true } });
    eq('⚠️ ticking pools sends BOTH flags, pools on', JSON.stringify(rightsCalls[0]), JSON.stringify(['mgr', { drawPools: true, drawTimes: false }]));
    ov = o.renderVals();
    check('…and the card reflects the server\'s answer', ov.acctDrawPools === true && ov.acctDrawTimes === false);
    check('…and so does the list', o.state.accounts.find((a) => a.username === 'mgr').drawPools === true);
    await ov.onToggleDrawTimes({ target: { checked: true } });
    eq('ticking times keeps pools on', JSON.stringify(rightsCalls[1]), JSON.stringify(['mgr', { drawPools: true, drawTimes: true }]));
    o.openOtherAccount('orga');
    ov = o.renderVals();
    check('⚠️ an organiser\'s card shows no switches', ov.acctIsManagerAcct === false);
    o.openMyAccount && o.setState({ acctSubject: '' });
    check('the card markup carries both switch labels', /Edit pools and teams/.test(readRepo('Organizer.dc.html')) && /Edit kickoff times and pitches/.test(readRepo('Organizer.dc.html')));
  }

  summary('test-draw-rights.js');
})().catch((e) => { console.error(e); process.exit(1); });
