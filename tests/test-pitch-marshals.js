/* tests/test-pitch-marshals.js
   ------------------------------------------------------------------------
   Pitch marshals: a per-pitch, per-day link a manager issues; whoever scans
   it scores that pitch. Spec: claude/specs/spec-pitch-marshals-sep-2026.md

   DRIVEN, NOT GREPPED. The real marshal-links, marshal-info, submit-result,
   get-results and get-result-history handlers run against in-memory blob
   stores, with `now` pinned to DEFAULT_VENUE's dates so the day rule is
   tested on the day and off it.

   THE FIVE THAT EARN THEIR KEEP:
   1. A link for Pitch B cannot save a Pitch A match, another group's match,
      or anything the day before or after its day.
   2. Revoke, and Issue new, kill the old link.
   3. A marshal cannot overwrite a score the TABLE set, nor clear anything.
   4. get-results serves NO names to the public — not the username, not the
      marshal, not the Spirit nominees — and every scoring field it did.
   5. Every overwrite keeps the previous entry, twenty deep, for the table.

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
      async get(key, opts) { if (!data.has(key)) return null; const raw = data.get(key); return opts && opts.type === 'json' ? JSON.parse(raw) : raw; },
      async setJSON(key, value) { data.set(key, JSON.stringify(value)); },
      async delete(key) { data.delete(key); },
      async list(o) { const p = (o && o.prefix) || ''; return { blobs: [...data.keys()].filter((k) => k.startsWith(p)).map((key) => ({ key })) }; },
    });
  }
  return stores.get(name);
}
let accountsList = [];
const stubs = {
  '@netlify/blobs': {
    getStore: (arg) => {
      const name = typeof arg === 'string' ? arg : (arg && arg.name);
      if (name === 'accounts') return { async get(key) { return key === 'list' ? accountsList : null; }, async setJSON(key, v) { if (key === 'list') accountsList = v; }, async delete() {}, async list() { return { blobs: [] }; } };
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
const marshal = require(path.join(FN, '_marshal.js'));
const { DEFAULT_VENUE, dayIdOf, setCachedVenue } = require(path.join(FN, '_venue.js'));
const { sign } = require(path.join(FN, '_auth.js'));
const links = require(path.join(FN, 'marshal-links.js'));
const info = require(path.join(FN, 'marshal-info.js'));
const submit = require(path.join(FN, 'submit-result.js'));
const getResults = require(path.join(FN, 'get-results.js'));
const history = require(path.join(FN, 'get-result-history.js'));
const { historyKey } = require(path.join(FN, '_results.js'));

/* A competitive group on day 2, its first pitch, and a second pitch of its own. */
const GROUP = Object.keys(DEFAULT_VENUE.day2.groups).find((g) => !['u6', 'u7'].includes(g) && (DEFAULT_VENUE.day2.groups[g] || []).length >= 2);
const [PITCH_A, PITCH_B] = DEFAULT_VENUE.day2.groups[GROUP];
const DAY = 'day2';
const OTHER_GROUP = Object.keys(DEFAULT_VENUE.day1.groups)[0];
const GST = '+04:00';
const at = (iso, hhmm) => Date.parse(`${iso}T${hhmm}:00${GST}`);
const D2 = DEFAULT_VENUE.day2.date;
/* ⚠️ Anchored at NOON Gulf time, not midnight: midnight Gulf is 20:00 UTC the
   evening before, so a midnight anchor plus a day sliced as UTC gave back the
   SAME calendar date and "the day after" was the day itself. */
const dayAfter = (iso) => new Date(Date.parse(`${iso}T12:00:00${GST}`) + 86400000).toISOString().slice(0, 10);
const dayBefore = (iso) => new Date(Date.parse(`${iso}T12:00:00${GST}`) - 86400000).toISOString().slice(0, 10);
const ON_DAY = at(D2, '10:00');

const M1 = `${GROUP}:A:0-1`, M2 = `${GROUP}:A:0-2`, MB = `${GROUP}:A:1-2`, KO = `${GROUP}:CUP`;
const published = () => ({
  schedule: {
    pools: [{ id: 'A', name: 'Pool A', teams: ['T1', 'T2', 'T3'] }],
    slots: [
      { id: M1, poolId: 'A', home: 'T1', away: 'T2', startMins: 480, pitch: PITCH_A },
      { id: M2, poolId: 'A', home: 'T1', away: 'T3', startMins: 500, pitch: PITCH_A },
      { id: MB, poolId: 'A', home: 'T2', away: 'T3', startMins: 480, pitch: PITCH_B },
    ],
    knockout: [{ id: KO, round: 'Cup Final', home: 'T1', away: 'T2', startMins: 600, pitch: PITCH_A }],
    teamNames: { T1: 'Team One', T2: 'Team Two', T3: 'Team Three' },
  },
  publishedAt: '2026-11-01T00:00:00.000Z', publishedBy: 'orga',
});

const seed = () => {
  stores.clear();
  setCachedVenue(null);
  accountsList = [
    { username: 'orga', name: 'Orga', role: 'organizer', approved: true, passwordHash: 'hashed:x' },
    { username: 'mgr', name: 'Mgr', role: 'manager', ageGroupId: GROUP, approved: true, passwordHash: 'hashed:x' },
    { username: 'other', name: 'Other', role: 'manager', ageGroupId: OTHER_GROUP, approved: true, passwordHash: 'hashed:x' },
  ];
  /* ⚠️ The OTHER group has a published slot with the SAME id shape on the SAME
     pitch name, so "another group's match" can only be refused by the
     age-group check — not by "not in the published draw" or the pitch check.
     Without this the fault that drops the group check passed unnoticed. */
  const other = published();
  other.schedule.slots = [{ id: `${OTHER_GROUP}:A:0-1`, poolId: 'A', home: 'T1', away: 'T2', startMins: 480, pitch: PITCH_A }];
  other.schedule.knockout = [];
  return Promise.all([
    storeFor('schedules').setJSON(`pub:${GROUP}`, published()),
    storeFor('schedules').setJSON(`pub:${OTHER_GROUP}`, other),
  ]);
};
const tokenFor = (u) => { const a = accountsList.find((x) => x.username === u); return sign(a.role === 'organizer' ? { username: u, role: 'organizer' } : { username: u, role: 'manager', ageGroupId: a.ageGroupId }); };
const asUser = (handler, u, body, method = 'POST', qs) => handler({ httpMethod: method, headers: { authorization: `Bearer ${tokenFor(u)}` }, body: body ? JSON.stringify(body) : undefined, queryStringParameters: qs });
const asToken = (handler, token, body, method = 'POST', qs) => handler({ httpMethod: method, headers: { authorization: `Bearer ${token}`, 'x-nf-client-connection-ip': '203.0.113.9' }, body: body ? JSON.stringify(body) : undefined, queryStringParameters: qs });
const parse = async (res) => ({ status: res.statusCode, ...JSON.parse(res.body || '{}') });

/* Pin the clock for handlers that read Date.now() themselves. */
const realNow = Date.now;
const withClock = async (t, fn) => { Date.now = () => t; try { return await fn(); } finally { Date.now = realNow; } };

const score = (name, extra = {}) => ({ homeTries: 2, awayTries: 1, homeCards: 0, awayCards: 0, walkover: null, marshalName: name, ...extra });

(async () => {
  /* ==================================================================== */
  section('⚠️ Issue, list, revoke: per pitch, own group, festival refused, token shown once');
  {
    await seed();
    check('control: the sample group is on day 2 with two pitches', dayIdOf(DEFAULT_VENUE, GROUP) === 'day2' && PITCH_A && PITCH_B && PITCH_A !== PITCH_B, `${GROUP} ${PITCH_A} ${PITCH_B}`);
    let r = await parse(await asUser(links.handler, 'mgr', null, 'GET', { ageGroupId: GROUP }));
    eq('a manager lists their pitches', r.status, 200);
    eq('…every pitch the group holds, none issued yet', JSON.stringify((r.links || []).map((l) => [l.pitch, l.live])), JSON.stringify(DEFAULT_VENUE.day2.groups[GROUP].map((p) => [p, false])));
    check('…with the day named', /\d/.test(r.dayLabel || ''));

    r = await parse(await asUser(links.handler, 'other', { action: 'issue', ageGroupId: GROUP, pitch: PITCH_A }));
    eq('⚠️ another group\'s manager cannot issue for this group', r.status, 403);
    r = await parse(await asUser(links.handler, 'mgr', { action: 'issue', ageGroupId: GROUP, pitch: 'Nowhere' }));
    eq('a pitch the group does not hold is 400', r.status, 400);
    r = await parse(await asUser(links.handler, 'mgr', { action: 'issue', ageGroupId: 'u6', pitch: 'x' }));
    check('a festival group is refused (or not theirs)', r.status === 400 || r.status === 403);

    r = await parse(await asUser(links.handler, 'mgr', { action: 'issue', ageGroupId: GROUP, pitch: PITCH_A }));
    eq('the manager issues Pitch A', r.status, 200);
    check('…and gets the token and a fragment URL once', typeof r.token === 'string' && /#marshal=/.test(r.url), r.url);
    const tokenA1 = r.token;
    const list = await parse(await asUser(links.handler, 'mgr', null, 'GET', { ageGroupId: GROUP }));
    const a = (list.links || []).find((l) => l.pitch === PITCH_A) || {};
    check('the listing says Pitch A is live and by whom', a.live === true && a.issuedBy === 'mgr');
    check('⚠️ …and never carries the token', !JSON.stringify(list).includes(tokenA1));
    const rec = await storeFor('marshals').get(`${GROUP}:${DAY}:${PITCH_A}`, { type: 'json' });
    check('…nor does the store', rec && !JSON.stringify(rec).includes(tokenA1));

    const v1 = await withClock(ON_DAY, () => marshal.verifyMarshal({ headers: { authorization: `Bearer ${tokenA1}` } }));
    check('the token verifies on its day', v1.ok === true && v1.marshal.pitch === PITCH_A, JSON.stringify(v1));
    const before = await withClock(at(dayBefore(D2), '23:59'), () => marshal.verifyMarshal({ headers: { authorization: `Bearer ${tokenA1}` } }));
    eq('⚠️ …not the night before', before.reason, 'not-today');
    const after = await withClock(at(dayAfter(D2), '00:00'), () => marshal.verifyMarshal({ headers: { authorization: `Bearer ${tokenA1}` } }));
    eq('…not the day after', after.reason, 'not-today');
    const sess = await withClock(ON_DAY, () => marshal.verifyMarshal({ headers: { authorization: `Bearer ${tokenFor('mgr')}` } }));
    eq('a session token is not a marshal token', sess.reason, 'not-marshal');

    r = await parse(await asUser(links.handler, 'mgr', { action: 'issue', ageGroupId: GROUP, pitch: PITCH_A }));
    const tokenA2 = r.token;
    const old = await withClock(ON_DAY, () => marshal.verifyMarshal({ headers: { authorization: `Bearer ${tokenA1}` } }));
    eq('⚠️ Issue new kills the old link', old.reason, 'reissued');
    check('…and the new one works', (await withClock(ON_DAY, () => marshal.verifyMarshal({ headers: { authorization: `Bearer ${tokenA2}` } }))).ok === true);
    r = await parse(await asUser(links.handler, 'orga', { action: 'revoke', ageGroupId: GROUP, pitch: PITCH_A }));
    eq('an organiser revokes', r.status, 200);
    const rev = await withClock(ON_DAY, () => marshal.verifyMarshal({ headers: { authorization: `Bearer ${tokenA2}` } }));
    eq('⚠️ …and the link is dead', rev.reason, 'revoked');
    const list2 = await parse(await asUser(links.handler, 'mgr', null, 'GET', { ageGroupId: GROUP }));
    check('…which the listing shows', ((list2.links || []).find((l) => l.pitch === PITCH_A) || {}).revokedAt);
  }

  /* ==================================================================== */
  section('⚠️ marshal-info: that pitch\'s published matches, first names only');
  {
    await seed();
    const tokA = (await parse(await asUser(links.handler, 'mgr', { action: 'issue', ageGroupId: GROUP, pitch: PITCH_A }))).token;
    let r = await withClock(ON_DAY, async () => parse(await asToken(info.handler, tokA, null, 'GET')));
    eq('info answers on the day', r.status, 200);
    eq('…with that pitch\'s matches only, kickoff order', JSON.stringify(r.matches.map((m) => m.id)), JSON.stringify([M1, M2, KO]));
    check('…named for the group and the day', /\S/.test(r.ageGroupName) && /\d/.test(r.dayLabel));
    check('…with team names to show', r.teamNames && r.teamNames.T1 === 'Team One');
    eq('…and nothing scored yet', JSON.stringify(r.scoredBy), '{}');
    r = await withClock(at(dayBefore(D2), '12:00'), async () => parse(await asToken(info.handler, tokA, null, 'GET')));
    eq('the day before: 401 with the one sentence', r.status, 401);
    check('…', /no longer live/.test(r.error));
    r = await withClock(ON_DAY, async () => parse(await asToken(info.handler, tokenFor('mgr'), null, 'GET')));
    eq('a session token is refused here', r.status, 401);
  }

  /* ==================================================================== */
  section('⚠️ Saving as a marshal: pitch, group, name, precedence, no clear, day');
  {
    await seed();
    const tokA = (await parse(await asUser(links.handler, 'mgr', { action: 'issue', ageGroupId: GROUP, pitch: PITCH_A }))).token;
    const tokB = (await parse(await asUser(links.handler, 'mgr', { action: 'issue', ageGroupId: GROUP, pitch: PITCH_B }))).token;
    const save = (tok, id, body, t = ON_DAY) => withClock(t, async () => parse(await asToken(submit.handler, tok, { matchId: id, data: body })));

    let r = await save(tokA, M1, score('Sam'));
    eq('a marshal saves a match on their pitch', r.status, 200, JSON.stringify(r));
    let stored = await storeFor('results').get(`m:${M1}`, { type: 'json' });
    check('…stamped marshal, first name, pitch', stored.enteredBy && stored.enteredBy.kind === 'marshal' && stored.enteredBy.name === 'Sam' && stored.enteredBy.pitch === PITCH_A, JSON.stringify(stored.enteredBy));
    check('…and submittedBy names the pitch, not a username', stored.submittedBy === `marshal:${PITCH_A}`);
    check('…score computed by the server', stored.homeScore > 0 && stored.awayScore >= 0);

    r = await save(tokB, M1, score('Ali'));
    eq('⚠️ a Pitch B link cannot save a Pitch A match', r.status, 403);
    check('…and says which pitch it is on', new RegExp(PITCH_A).test(r.error), r.error);
    r = await save(tokA, `${OTHER_GROUP}:A:0-1`, score('Sam'));
    eq('⚠️ …nor another group\'s match', r.status, 403);
    r = await save(tokA, `${GROUP}:Z:9-9`, score('Sam'));
    eq('…nor a match not in the published draw', r.status, 403);
    r = await save(tokA, M2, score(''));
    eq('⚠️ no name: 400', r.status, 400);
    r = await save(tokA, M2, { clear: true, marshalName: 'Sam' });
    eq('⚠️ a marshal cannot clear', r.status, 403);
    r = await save(tokA, M1, score('Priya', { homeTries: 3 }));
    eq('a marshal may overwrite a marshal\'s score', r.status, 200);
    stored = await storeFor('results').get(`m:${M1}`, { type: 'json' });
    eq('…and the name is now theirs', stored.enteredBy.name, 'Priya');
    const hist = await storeFor('results').get(historyKey(M1), { type: 'json' });
    check('⚠️ …and the previous entry is in the history', Array.isArray(hist) && hist.length === 1 && hist[0].enteredBy.name === 'Sam', JSON.stringify(hist));

    r = await withClock(ON_DAY, async () => parse(await asUser(submit.handler, 'mgr', { matchId: M1, data: { homeTries: 1, awayTries: 1 } })));
    eq('the table overwrites', r.status, 200);
    stored = await storeFor('results').get(`m:${M1}`, { type: 'json' });
    check('…stamped manager with the username', stored.enteredBy.kind === 'manager' && stored.enteredBy.username === 'mgr');
    r = await save(tokA, M1, score('Sam'));
    eq('⚠️ a marshal cannot overwrite the TABLE\'s score', r.status, 403);
    check('…and is told to ask the table', /age-group table/.test(r.error));
    r = await save(tokA, KO, score('Sam'));
    eq('a knockout match on the pitch saves too', r.status, 200);
    r = await save(tokA, M2, score('Sam'), at(dayBefore(D2), '12:00'));
    eq('⚠️ the day before: refused as not live', r.status, 401);
    r = await save(tokA, M2, score('Sam'), at(dayAfter(D2), '09:00'));
    eq('…and the day after', r.status, 401);

    /* Twenty deep. */
    for (let i = 0; i < 25; i += 1) await save(tokA, M2, score(`M${i}`, { homeTries: i % 5 }));
    const h2 = await storeFor('results').get(historyKey(M2), { type: 'json' });
    eq('⚠️ history keeps exactly twenty', (h2 || []).length, 20);
    eq('…newest first', (((h2 || [])[0] || {}).enteredBy || {}).name, 'M23');

    /* Rate limit: 30 per ten minutes per link. */
    await seed();
    const tokR = (await parse(await asUser(links.handler, 'mgr', { action: 'issue', ageGroupId: GROUP, pitch: PITCH_A }))).token;
    let last;
    for (let i = 0; i < 31; i += 1) last = await save(tokR, M1, score('Loop'));
    eq('the 31st save in ten minutes is 429', last.status, 429);
  }

  /* ==================================================================== */
  section('⚠️ get-results: the public gets scores only; the table gets everything');
  {
    await seed();
    await storeFor('results').setJSON(`m:${M1}`, { homeScore: 10, awayScore: 5, homeTries: 2, awayTries: 1, homeCards: 0, awayCards: 1, walkover: null, submittedAt: '2026-11-08T06:00:00.000Z', submittedBy: 'mgr', spiritNomineeHome: 'A Child', spiritNomineeAway: 'Another Child', enteredBy: { kind: 'marshal', name: 'Sam', pitch: PITCH_A } });
    await storeFor('results').setJSON(historyKey(M1), [{ homeScore: 1 }]);
    const pub = await parse(await getResults.handler({ httpMethod: 'GET', headers: {} }));
    const p = (pub.results || {})[M1] || {};
    eq('control: the public gets the score', p.homeScore, 10);
    check('…and the tries and cards', p.homeTries === 2 && p.awayCards === 1);
    check('⚠️ …but no username', !('submittedBy' in p));
    check('⚠️ …no marshal name', !('enteredBy' in p));
    check('⚠️ …no Spirit nominees', !('spiritNomineeHome' in p) && !('spiritNomineeAway' in p));
    check('…and the history is not a phantom match', !Object.keys(pub.results).some((k) => k.startsWith('hist:')));
    const priv = await parse(await asUser(getResults.handler, 'mgr', null, 'GET'));
    const q = (priv.results || {})[M1] || {};
    check('a manager session gets the nominees and who entered it', q.spiritNomineeHome === 'A Child' && q.enteredBy && q.enteredBy.name === 'Sam');
    const orgv = await parse(await asUser(getResults.handler, 'orga', null, 'GET'));
    check('…so does an organiser', ((orgv.results || {})[M1] || {}).enteredBy);
    const tokA = (await parse(await asUser(links.handler, 'mgr', { action: 'issue', ageGroupId: GROUP, pitch: PITCH_A }))).token;
    const asM = await withClock(ON_DAY, async () => parse(await asToken(getResults.handler, tokA, null, 'GET')));
    check('⚠️ a marshal token gets the PUBLIC shape', !((asM.results || {})[M1] || {}).enteredBy);
    check('the allow-list is positive: a field added later is private by default', !getResults.PUBLIC_FIELDS.includes('enteredBy') && getResults.PUBLIC_FIELDS.includes('homeScore'));
  }

  /* ==================================================================== */
  section('⚠️ get-result-history: the table only, own group only');
  {
    await seed();
    await storeFor('results').setJSON(`m:${M1}`, { homeScore: 10, awayScore: 5, enteredBy: { kind: 'manager', name: 'mgr', username: 'mgr' } });
    await storeFor('results').setJSON(historyKey(M1), [{ homeScore: 7, awayScore: 5, enteredBy: { kind: 'marshal', name: 'Sam', pitch: PITCH_A } }]);
    let r = await parse(await asUser(history.handler, 'mgr', null, 'GET', { matchId: M1 }));
    eq('the manager reads the history', r.status, 200);
    check('…current and previous', r.current.homeScore === 10 && r.history[0].enteredBy.name === 'Sam');
    r = await parse(await asUser(history.handler, 'other', null, 'GET', { matchId: M1 }));
    eq('another group\'s manager cannot', r.status, 403);
    const tokA = (await parse(await asUser(links.handler, 'mgr', { action: 'issue', ageGroupId: GROUP, pitch: PITCH_A }))).token;
    r = await withClock(ON_DAY, async () => parse(await asToken(history.handler, tokA, null, 'GET', { matchId: M1 })));
    check('⚠️ a marshal token is refused', r.status === 401 || r.status === 403);
  }

  /* ==================================================================== */
  section('Static: the app, the tab, the encoder');
  {
    const app = readRepo('app.html');
    check('app.html reads #marshal= from the fragment', /marshal=\(\[\^&\]\+\)/.test(app));
    check('…and wipes it from the address bar', /history\.replaceState/.test(app));
    check('…asks the name on the score sheet', /id="pmname"/.test(app));
    check('…sends marshalName with the score', /marshalName: name/.test(app));
    check('…and never clears an interval (test-app-polling\'s rule)', !/clearInterval/.test(app.replace(/\/\*[\s\S]*?\*\//g, '')));
    check('…offers Leave pitch mode', /Leave pitch mode/.test(app));
    const mgr = readRepo('Manager.dc.html');
    check('the Pitch marshals tab exists', /id: 'marshals', label: 'Pitch marshals'/.test(mgr));
    check('…loads /qr.js on demand', /s\.src = '\/qr\.js'/.test(mgr));
    check('…prints a pitch sheet with the four instructions', /Scan this with your phone/.test(mgr) && /Type your first name/.test(mgr));
    const qr = readRepo('qr.js');
    check('qr.js is the vendored MIT encoder with its provenance', /Kazuhiko Arase/.test(qr) && /MIT/.test(qr) && /VENDORED/.test(qr));
    check('…self-contained: no require, fetch or XHR', !/\brequire\(|fetch\(|XMLHttpRequest/.test(qr));
    check('scores-data has the marshal calls', /export async function marshalInfo/.test(readRepo('scores-data.js')) && /export function issueMarshalLink/.test(readRepo('scores-data.js')));
  }

  summary('test-pitch-marshals.js');
})().catch((e) => { console.error(e); process.exit(1); });
