/* ============================================================
   ADH JRT — Scores & Standings data layer  (LIVE backend)
   ------------------------------------------------------------
   Every read/write the UI needs goes through the async functions
   exported at the bottom. Manager accounts, match results, and
   sessions are real — accounts self-signup via manager-signup.js
   (gated by an invite code per age group) and are stored server-side
   in Netlify Blobs; results are written via submit-result.js and read
   back (by anyone, including the public Standings page) via
   get-results.js. See those files in netlify/functions/ for the
   one-time setup (MANAGER_INVITE_CODES + SESSION_SECRET env vars).

   THE DRAW (which teams are in which pool, and each match's home/away
   teams + kickoff time + pitch) starts out auto-generated from the
   config below (see buildDefaultDraw) — identical for every visitor
   until someone customizes it. A signed-in manager (their own age
   group) or organizer (any age group) can drag teams into pools and
   match slots and edit times/pitches from the Manager area's Fixture
   Editor; saving persists a full override to Netlify Blobs (via
   save-schedule-override.js), which every reader — including this
   public Standings/Fixtures page and the main site's schedule display
   — then uses instead of the auto-generated version. "Reset" deletes
   the override and reverts to auto-generated.
   ============================================================ */

const STORE_KEY = 'adhjrt_results_v1';   // matchId -> result
const SESSION_KEY = 'adhjrt_session_v1'; // current manager token
const ORG_SESSION_KEY = 'adhjrt_organizer_session'; // organizer-data.js's session key

/* -------- Tournament configuration (pools & teams) --------
   "Build it flexible": age groups, pools, teams and how many
   advance are all data. Fill these in with the real draw later.
   hasStandings:false  → festival age groups (U6/U7), no table.
   This is only ever the STARTING POINT for a pool's team list — once a
   manager/organizer saves a custom draw for an age group, its saved
   pools (which can differ from this) take over everywhere. */
/* -------- Team identity --------
   A team is identified everywhere by its CODE (ADH1, DE1 …) — the same scheme
   netlify/functions/_teams.js assigns at registration. The code is what pools,
   fixtures, standings and brackets store, because it is short enough for a
   phone table and unambiguous when one club enters two teams in an age group
   ("Abu Dhabi Harlequins v Abu Dhabi Harlequins" is meaningless).

   TEAM_NAMES maps a code to the readable name, used wherever there is room —
   match detail, the fixture key, the team filter. Add new clubs here as they
   register; teamLabel() falls back to the raw code if one is missing, so an
   unknown team shows as itself rather than blank. */
const TEAM_NAMES = {
  ADH1: 'Abu Dhabi Harlequins 1',
  DE1:  'Dubai Exiles 1',
  DS1:  'Dubai Sharks 1',
  DH1:  'Dubai Hurricanes 1',
  BAR1: 'Barrelhouse 1',
  AAA1: 'Al Ain Amblers 1',
  DD1:  'Dubai Dragons 1',
  DT1:  'Dubai Tigers 1',
  ADSB1:'Abu Dhabi Small Blacks 1',
};

export function teamLabel(code) {
  return TEAM_NAMES[code] || code || '';
}
/* Mirrors netlify/functions/_scoring.js so the entry forms can build
   themselves. The server re-derives the total from these same rules, so this
   copy only decides which inputs are shown — it can never change a score. */
const SCORE_POINTS = { tries: 5, conversions: 2, penalties: 3, drops: 3 };
const SCORE_LABEL  = { tries: 'Tries', conversions: 'Conversions', penalties: 'Penalties', drops: 'Drop goals' };
const SCORE_BY_AGE = {
  u6:['tries'], u7:['tries'], u8:['tries'], u9:['tries'], u10:['tries'], u11:['tries'],
  u12:['tries','conversions'], u12g:['tries','conversions'], u13:['tries','conversions'],
  u14b:['tries','conversions','penalties','drops'], u14g:['tries','conversions','penalties','drops'],
  u16b:['tries','conversions','penalties','drops'], u16g:['tries','conversions','penalties','drops'],
  u18b:['tries','conversions','penalties','drops'], u18g:['tries','conversions','penalties','drops'],
};
/* Live rules, once fetched, replace the built-in defaults. Fetched on demand
   and cached — a config lookup must never sit between a manager and a score. */
let LIVE_RULES = null;

export async function loadScoringRules() {
  if (LIVE_RULES) return LIVE_RULES;
  const r = await tryFetchJson('/.netlify/functions/scoring-rules');
  if (r.real && r.json && r.json.ok && r.json.rules) LIVE_RULES = r.json.rules;
  else LIVE_RULES = { ...SCORE_BY_AGE };
  return LIVE_RULES;
}

export async function saveScoringRules(rules, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const r = await tryFetchJson('/.netlify/functions/scoring-rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify({ rules }),
  });
  if (r.real && r.json && r.json.ok) { LIVE_RULES = r.json.rules; return { ok: true }; }
  return { ok: false, error: (r.json && r.json.error) || 'Could not save the scoring rules.' };
}

export function scoringFor(ageGroupId) {
  const src = LIVE_RULES || SCORE_BY_AGE;
  return src[ageGroupId] || ['tries','conversions','penalties','drops'];
}
export function allScoreTypes() { return ['tries','conversions','penalties','drops']; }
export function scorePoints(k) { return SCORE_POINTS[k] || 0; }
export function scoreLabel(k) { return SCORE_LABEL[k] || k; }
export function scoreTotal(ageGroupId, parts) {
  return scoringFor(ageGroupId).reduce((sum, k) => {
    const v = Math.max(0, Math.floor(Number((parts || {})[k]) || 0));
    return sum + v * SCORE_POINTS[k];
  }, 0);
}

export function teamKey() {
  return Object.keys(TEAM_NAMES).map((c) => ({ code: c, name: TEAM_NAMES[c] }));
}

const ALL9 = ['ADH1', 'DE1', 'DS1', 'DH1', 'BAR1', 'AAA1', 'DD1', 'DT1', 'ADSB1'];
const twoPools9 = () => [
  { id: 'A', name: 'Pool A', teams: ALL9.slice(0, 5) },
  { id: 'B', name: 'Pool B', teams: ALL9.slice(5) },
];

const AGE_GROUPS = [
  { id: 'u6',  name: 'U6 Tag',           hasStandings: false, advance: 0, pools: [{ id: 'A', name: 'Festival Pool', teams: [...ALL9] }] },
  { id: 'u7',  name: 'U7 Tag',           hasStandings: false, advance: 0, pools: [{ id: 'A', name: 'Festival Pool', teams: [...ALL9] }] },
  { id: 'u8',  name: 'U8 Tag',           hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u9',  name: 'U9 Mixed Contact', hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u10', name: 'U10 Mixed Contact', hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u11', name: 'U11 Mixed Contact', hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u12', name: 'U12 Mixed Contact', hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u12g', name: 'U12G QR',          hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u13', name: 'U13 Mixed Contact', hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u14b', name: 'U14B Contact',     hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u14g', name: 'U14G QR',          hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u16b', name: 'U16B Contact',     hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u16g', name: 'U16G Contact',     hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u18b', name: 'U18B Contact',     hasStandings: true, advance: 4, pools: twoPools9() },
  { id: 'u18g', name: 'U18G Contact',     hasStandings: true, advance: 4, pools: twoPools9() },
];

const WALKOVER_SCORE = 20; // walk-over recorded as 20-0

// Age groups old enough for the Spirit of Rugby Award (U14 and up) — each
// match lets the manager nominate one player; nominations tally across the
// whole age group, and once every real match has a submitted result the
// player(s) with the most nominations are the award winner(s).
const SPIRIT_AWARD_AGE_IDS = ['u14b', 'u14g', 'u16b', 'u16g', 'u18b', 'u18g'];

// Age groups using the special double-bracket knockout format (see
// buildU16BBracket) instead of the plain waterfall every other group uses.
const SPECIAL_BRACKET_AGE_IDS = ['u16b', 'u16g'];

// Age groups that use the reduced festival schedule (see
// orderFestivalNoBackToBack) instead of a full round robin.
const FESTIVAL_AGE_IDS = ['u6', 'u7'];

/* ---------------- storage helpers (live backend, with local fallback) ----------------
   See local-backend.js for why/how the fallback works — same pattern as
   organizer-data.js. */
let localBackendPromise = null;
function local() {
  if (!localBackendPromise) localBackendPromise = import(new URL('local-backend.js', document.baseURI).href);
  return localBackendPromise;
}
async function tryFetchJson(url, opts) {
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    try { return { real: true, json: JSON.parse(text) }; } catch (e) { return { real: false }; }
  } catch (e) {
    return { real: false };
  }
}

async function readStore() {
  const r = await tryFetchJson('/.netlify/functions/get-results');
  if (r.real) return r.json.ok ? r.json.results : {};
  return (await local()).getResults();
}

/* Returns the full publish state, not just the draw:
     { schedule, awaitingPublication, published, publishedAt, publishedBy,
       managerCanPublishNow }

   Public callers get the PUBLISHED draw only. `awaitingPublication` is true
   when nothing has been published for this age group — in which case readers
   must show "coming soon" and must NOT fall back to the auto-generated draw,
   which is sample data a parent could not tell apart from real fixtures.

   Passing a session asks for the DRAFT instead, for the fixture editor. */
async function fetchOverrideState(agId, session) {
  const draft = session && session.token ? '&draft=1' : '';
  const opts = session && session.token
    ? { headers: { Authorization: `Bearer ${session.token}` } }
    : undefined;

  const r = await tryFetchJson(
    `/.netlify/functions/get-schedule-override?age=${encodeURIComponent(agId)}${draft}`,
    opts
  );

  if (r.real && r.json && r.json.ok) {
    return {
      schedule: r.json.schedule || null,
      awaitingPublication: !!r.json.awaitingPublication,
      published: !!r.json.published,
      publishedAt: r.json.publishedAt || null,
      publishedBy: r.json.publishedBy || null,
      managerCanPublishNow: !!r.json.managerCanPublishNow,
      isDraft: !!r.json.isDraft,
    };
  }

  /* Local fallback (see local-backend.js) has no publish concept, so treat a
     saved override as published — it keeps offline development usable. */
  const schedule = await (await local()).getScheduleOverride(agId);
  return {
    schedule: schedule || null,
    awaitingPublication: !schedule,
    published: !!schedule,
    publishedAt: null,
    publishedBy: null,
    managerCanPublishNow: true,
    isDraft: false,
  };
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms)); // small UI-friendly pause

function findAg(id) { return AGE_GROUPS.find((a) => a.id === id); }

/* ---------------- the draw: pools + match slots ----------------
   A "draw" is { pools:[{id,name,teams}], slots:[{id,poolId,home,away,startMins,pitch}] }.
   Slots are sorted by startMins wherever they're displayed — so editing
   a slot's time is all it takes to reorder it; there's no separate
   manual "order" to keep in sync.

   Each match: two 7-min halves + 3-min half-time + 3 min to next kick-off
   = a 20-minute slot, starting at 8:00am. Games are ordered greedily,
   always preferring the pairing whose two teams have rested longest; if
   every remaining game would repeat a team from the immediately previous
   slot, a rest slot is inserted so no team ever plays twice with zero
   break. This is only used to seed the STARTING slot list — once saved,
   an override's slots are just plain data. */
const SLOT_MINS = 20; // 7 + 3 + 7 + 3
const DAY_START_MINS = 8 * 60; // 8:00am

function orderNoBackToBack(teams) {
  const remaining = [];
  for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) remaining.push([teams[i], teams[j]]);
  return scheduleNoBackToBack(remaining, teams);
}

// U6/U7 are non-competitive festivals — instead of a full round robin
// (every team plays every other team once), each team plays a fixed 4
// matches. Teams are arranged in a circle and paired with their 1st and
// 2nd nearest neighbors on each side (a "circulant" pairing) — this gives
// every team exactly 4 opponents with no repeats, using far fewer total
// matches than a full round robin.
const FESTIVAL_MATCHES_PER_TEAM = 4;
function buildFestivalPairs(teams) {
  const n = teams.length;
  const half = Math.floor(FESTIVAL_MATCHES_PER_TEAM / 2);
  const seen = new Set();
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let d = 1; d <= half; d++) {
      const j = (i + d) % n;
      if (i === j) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([teams[i], teams[j]]);
    }
  }
  return pairs;
}
function orderFestivalNoBackToBack(teams) {
  return scheduleNoBackToBack(buildFestivalPairs(teams), teams);
}

// Shared greedy scheduler: given a flat list of [home,away] pairings and
// the full team list, orders them into slots — always preferring the
// pairing whose two teams have rested longest; if every remaining game
// would repeat a team from the immediately previous slot, inserts an
// empty rest slot instead of forcing a back-to-back match.
function scheduleNoBackToBack(pairsList, teams) {
  let remaining = pairsList.slice();
  const lastPlayedAt = {}; teams.forEach((t) => (lastPlayedAt[t] = -Infinity));
  const seq = []; // slot -> [home,away] or null (rest)
  let slot = 0;
  while (remaining.length) {
    const prev = slot > 0 ? seq[slot - 1] : null;
    const clashes = (g) => prev && (g[0] === prev[0] || g[0] === prev[1] || g[1] === prev[0] || g[1] === prev[1]);
    const candidates = remaining.filter((g) => !clashes(g));
    if (!candidates.length) { seq.push(null); slot++; continue; }
    candidates.sort((a, b) => {
      const restA = Math.min(slot - lastPlayedAt[a[0]], slot - lastPlayedAt[a[1]]);
      const restB = Math.min(slot - lastPlayedAt[b[0]], slot - lastPlayedAt[b[1]]);
      return restB - restA;
    });
    const g = candidates[0];
    seq.push(g);
    lastPlayedAt[g[0]] = slot; lastPlayedAt[g[1]] = slot;
    remaining = remaining.filter((x) => x !== g);
    slot++;
  }
  return seq;
}

function fmtTime(totalMins) {
  let h = Math.floor(totalMins / 60), m = totalMins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
// 24h "HH:MM" for <input type="time">.
function fmtTime24(totalMins) {
  const h = Math.floor(totalMins / 60) % 24, m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function parseTime24(hhmm) {
  const [h, m] = String(hhmm || '08:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function poolSlots(prefix, teams, useFestivalFormat) {
  const seq = useFestivalFormat ? orderFestivalNoBackToBack(teams) : orderNoBackToBack(teams);
  return seq
    .map((g, idx) => (g ? { id: `${prefix}:${idx}`, home: g[0], away: g[1], startMins: DAY_START_MINS + idx * SLOT_MINS, pitch: 'TBD' } : null))
    .filter(Boolean);
}

function buildDefaultDraw(ag) {
  const pools = (ag.pools || []).map((p) => ({ id: p.id, name: p.name, teams: [...p.teams] }));
  const slots = [];
  const useFestivalFormat = FESTIVAL_AGE_IDS.includes(ag.id);
  pools.forEach((p) => {
    poolSlots(`${ag.id}:${p.id}`, p.teams, useFestivalFormat).forEach((s) => slots.push({ ...s, poolId: p.id }));
  });
  return { pools, slots };
}

// Resolves the effective draw for an age group: a saved override if one
// exists, else the deterministic default built from AGE_GROUPS config.
async function resolveDraw(ag, override) {
  if (override && Array.isArray(override.pools) && Array.isArray(override.slots)) return override;
  return buildDefaultDraw(ag);
}

function slotsForPool(draw, poolId) {
  return draw.slots.filter((s) => s.poolId === poolId).sort((a, b) => a.startMins - b.startMins);
}

/* ---------------- standings engine ---------------- */
// Applies: league points (4 win/walkover, 2 draw, 0 loss/no-show),
// then tie-breaks: margin → points-for → head-to-head(2) →
// least-conceded → mini-league(3+) → coin-toss flag.
function computeStandings(draw, store) {
  const rows = {};
  draw.pools.forEach((pool) => {
    rows[pool.id] = {};
    pool.teams.forEach((t) => {
      rows[pool.id][t] = { team: t, P: 0, W: 0, D: 0, L: 0, PF: 0, PA: 0, tries: 0, cards: 0, pts: 0 };
    });
  });

  draw.slots.forEach((fx) => {
    const res = store[fx.id];
    if (!res || res.homeScore == null || res.awayScore == null) return;
    const poolRows = rows[fx.poolId]; if (!poolRows) return;
    const h = poolRows[fx.home], a = poolRows[fx.away];
    if (!h || !a) return;
    let hs = Number(res.homeScore), as = Number(res.awayScore);
    if (res.walkover === 'home') { hs = WALKOVER_SCORE; as = 0; }
    if (res.walkover === 'away') { hs = 0; as = WALKOVER_SCORE; }
    h.P++; a.P++;
    h.PF += hs; h.PA += as; a.PF += as; a.PA += hs;
    h.tries += Number(res.homeTries || 0); a.tries += Number(res.awayTries || 0);
    h.cards += Number(res.homeCards || 0); a.cards += Number(res.awayCards || 0);
    if (res.walkover === 'home' || (res.walkover == null && hs > as)) { h.W++; a.L++; h.pts += 4; }
    else if (res.walkover === 'away' || (res.walkover == null && as > hs)) { a.W++; h.L++; a.pts += 4; }
    else { h.D++; a.D++; h.pts += 2; a.pts += 2; }
  });

  // head-to-head / mini-league margin between a subset of teams
  const miniStat = (teams, pool) => {
    const s = {}; teams.forEach((t) => (s[t] = { PF: 0, PA: 0, pts: 0 }));
    draw.slots.forEach((fx) => {
      if (fx.poolId !== pool) return;
      if (!teams.includes(fx.home) || !teams.includes(fx.away)) return;
      const r = store[fx.id]; if (!r || r.homeScore == null) return;
      let hs = Number(r.homeScore), as = Number(r.awayScore);
      if (r.walkover === 'home') { hs = WALKOVER_SCORE; as = 0; }
      if (r.walkover === 'away') { hs = 0; as = WALKOVER_SCORE; }
      s[fx.home].PF += hs; s[fx.home].PA += as; s[fx.away].PF += as; s[fx.away].PA += hs;
      if (hs > as) s[fx.home].pts += 4; else if (as > hs) s[fx.away].pts += 4; else { s[fx.home].pts += 2; s[fx.away].pts += 2; }
    });
    return s;
  };

  const tables = {};
  draw.pools.forEach((pool) => {
    let list = Object.values(rows[pool.id]).map((r) => ({ ...r, margin: r.PF - r.PA }));
    list.sort((x, y) => (y.pts - x.pts) || (y.margin - x.margin) || (y.PF - x.PF) || (x.PA - y.PA));

    // resolve remaining exact ties (pts,margin,PF,PA all equal) within groups
    const out = []; let i = 0;
    while (i < list.length) {
      let j = i; while (j + 1 < list.length && ['pts', 'margin', 'PF', 'PA'].every((k) => list[j + 1][k] === list[i][k])) j++;
      const group = list.slice(i, j + 1);
      if (group.length > 1) {
        const mini = miniStat(group.map((g) => g.team), pool.id);
        group.sort((x, y) => {
          if (group.length === 2) { // head-to-head (count-back)
            const d = (mini[y.team].pts - mini[x.team].pts); if (d) return d;
          }
          const mm = (mini[y.team].PF - mini[y.team].PA) - (mini[x.team].PF - mini[x.team].PA);
          if (mm) return mm;
          const mf = mini[y.team].PF - mini[x.team].PF; if (mf) return mf;
          return mini[x.team].PA - mini[y.team].PA;
        });
        // still identical → coin toss
        group.forEach((g, k) => { if (k > 0 && g.P > 0 && ['pts', 'margin', 'PF', 'PA'].every((key) => group[k][key] === group[k - 1][key])) g.coinToss = true; });
      }
      out.push(...group); i = j + 1;
    }
    tables[pool.id] = out.map((r, idx) => ({ ...r, rank: idx + 1 }));
  });
  return tables;
}

/* ---------------- knockout generation ---------------- */
// Waterfall format: rank 1 in every pool plays off for the Cup, rank 2s
// for the Bowl, rank 3s for the Plate, rank 4s for the Shield. Each final
// is a single cross-pool match — no semis. A 5th-place team (odd pool
// sizes) sits out of the knockouts entirely.
function makeWrap(store) {
  return (id, home, away) => {
    const r = store[id] || {};
    let winner = null;
    if (r.homeScore != null && r.awayScore != null && home && away) {
      let hs = Number(r.homeScore), as = Number(r.awayScore);
      if (r.walkover === 'home') { hs = WALKOVER_SCORE; as = 0; } if (r.walkover === 'away') { hs = 0; as = WALKOVER_SCORE; }
      winner = hs >= as ? home : away;
    }
    return { id, stage: 'knockout', home, away, result: r.homeScore != null ? r : null, winner };
  };
}
function loserOf(m) {
  if (!m.winner || !m.home || !m.away) return null;
  return m.winner === m.home ? m.away : m.home;
}

// Flattens whichever bracket format this age group uses into a plain,
// editable list of knockout slots — the auto-seeded STARTING POINT for
// the Fixture Editor's "Knockout stage" section, and what every reader
// falls back to until a manager/organizer saves a custom override (see
// resolveKnockout).
function computeAutoKnockout(ag, draw, tables, store) {
  let maxEndMins = DAY_START_MINS;
  draw.slots.forEach((s) => { if (s.startMins + SLOT_MINS > maxEndMins) maxEndMins = s.startMins + SLOT_MINS; });

  if (SPECIAL_BRACKET_AGE_IDS.includes(ag.id)) {
    const db = buildU16BBracket(ag, draw, tables, store);
    const order = [
      { round: 'Top Bracket — Semi-Final 1', g: db.top.sf1 },
      { round: 'Top Bracket — Semi-Final 2', g: db.top.sf2 },
      { round: 'Bottom Bracket — Semi-Final 1', g: db.bottom.sf1 },
      { round: 'Bottom Bracket — Semi-Final 2', g: db.bottom.sf2 },
      { round: 'Cup Final', g: db.top.cup },
      { round: 'Bowl Final', g: db.top.bowl },
      { round: 'Plate Final', g: db.bottom.plate },
      { round: 'Shield Final', g: db.bottom.shield },
    ];
    return order.map((o, idx) => ({ id: o.g.id, round: o.round, home: o.g.home || '', away: o.g.away || '', startMins: maxEndMins + idx * SLOT_MINS, pitch: 'TBD' }));
  }

  const rounds = buildBracket(ag, draw, tables, store);
  const flat = rounds.flatMap((r) => r.games.map((g) => ({ round: r.round, g })));
  return flat.map((o, idx) => ({ id: o.g.id, round: o.round, home: o.g.home || '', away: o.g.away || '', startMins: maxEndMins + idx * SLOT_MINS, pitch: 'TBD' }));
}

// A saved override's `knockout` array (if present) takes over completely —
// same override philosophy as pools/slots. Otherwise auto-seeded from live
// standings, exactly like before this feature existed.
function resolveKnockout(ag, draw, override, tables, store) {
  if (override && Array.isArray(override.knockout)) return override.knockout;
  return computeAutoKnockout(ag, draw, tables, store);
}

function buildBracket(ag, draw, tables, store) {
  const pools = draw.pools || [];
  const wrap = makeWrap(store);

  // Pool standings aren't final (and finalists aren't real) until every
  // pool-stage fixture for this age group has a result — until then the
  // finals show as TBD v TBD rather than guessing from a 0-played table.
  const poolsComplete = draw.slots.every((fx) => store[fx.id] && store[fx.id].homeScore != null) && draw.slots.length > 0;

  if (pools.length === 2) {
    const A = tables[pools[0].id] || [];
    const B = tables[pools[1].id] || [];
    const tiers = [
      { name: 'Cup Final', code: 'CUP', rank: 0 },
      { name: 'Bowl Final', code: 'BOWL', rank: 1 },
      { name: 'Plate Final', code: 'PLATE', rank: 2 },
      { name: 'Shield Final', code: 'SHIELD', rank: 3 },
    ];
    const rounds = [];
    tiers.forEach((t) => {
      const home = poolsComplete ? (A[t.rank] && A[t.rank].team) : null;
      const away = poolsComplete ? (B[t.rank] && B[t.rank].team) : null;
      if (!poolsComplete && !(A[t.rank] || B[t.rank])) return; // tier doesn't exist at all (pool too small)
      rounds.push({ round: t.name, games: [wrap(`${ag.id}:${t.code}`, home, away)] });
    });
    return rounds;
  }

  // fallback for a single-pool age group: straight semis + final
  const t = tables[pools[0] ? pools[0].id : null] || [];
  const seeds = [];
  if (poolsComplete) for (let k = 0; k < Math.min(ag.advance, t.length); k++) seeds.push(t[k] && t[k].team);
  if (seeds.length >= 4) {
    const sf1 = wrap(`${ag.id}:SF1`, seeds[0], seeds[3]);
    const sf2 = wrap(`${ag.id}:SF2`, seeds[1], seeds[2]);
    const fin = wrap(`${ag.id}:FINAL`, sf1.winner, sf2.winner);
    return [{ round: 'Semi-finals', games: [sf1, sf2] }, { round: 'Final', games: [fin] }];
  } else if (seeds.length >= 2) {
    return [{ round: 'Final', games: [wrap(`${ag.id}:FINAL`, seeds[0], seeds[1])] }];
  }
  return [];
}

/* ---------------- Double-bracket special format ----------------
   Instead of the plain waterfall used by most age groups, the age groups
   in SPECIAL_BRACKET_AGE_IDS run two 4-team knockout brackets: the top 2
   finishers from each pool form the "Top Bracket" (semis → winners meet
   in the Cup Final, losers meet in the Bowl Final); the next 2 from each
   pool form the "Bottom Bracket" (semis → winners meet in the Plate
   Final, losers meet in the Shield Final). A pool's 5th-place team sits
   out. Semis are seeded cross-pool (A1 v B2, B1 v A2, etc.) to avoid an
   immediate pool-stage rematch. */
function buildU16BBracket(ag, draw, tables, store) {
  const wrap = makeWrap(store);
  const pools = draw.pools || [];
  const A = tables[pools[0] ? pools[0].id : null] || [];
  const B = tables[pools[1] ? pools[1].id : null] || [];
  const poolsComplete = draw.slots.every((fx) => store[fx.id] && store[fx.id].homeScore != null) && draw.slots.length > 0;
  const nameAt = (arr, i) => (poolsComplete && arr[i]) ? arr[i].team : null;

  const tsf1 = wrap(`${ag.id}:TSF1`, nameAt(A, 0), nameAt(B, 1)); // A1 v B2
  const tsf2 = wrap(`${ag.id}:TSF2`, nameAt(B, 0), nameAt(A, 1)); // B1 v A2
  const cup = wrap(`${ag.id}:CUP`, tsf1.winner, tsf2.winner);
  const bowl = wrap(`${ag.id}:BOWL`, loserOf(tsf1), loserOf(tsf2));

  const bsf1 = wrap(`${ag.id}:BSF1`, nameAt(A, 2), nameAt(B, 3)); // A3 v B4
  const bsf2 = wrap(`${ag.id}:BSF2`, nameAt(B, 2), nameAt(A, 3)); // B3 v A4
  const plate = wrap(`${ag.id}:PLATE`, bsf1.winner, bsf2.winner);
  const shield = wrap(`${ag.id}:SHIELD`, loserOf(bsf1), loserOf(bsf2));

  return { poolsComplete, top: { sf1: tsf1, sf2: tsf2, cup, bowl }, bottom: { sf1: bsf1, sf2: bsf2, plate, shield } };
}

/* ================= EXPORTED ASYNC API ================= */

export async function getAgeGroups() {
  await delay(60);
  return AGE_GROUPS.map(({ id, name, hasStandings }) => ({ id, name, hasStandings }));
}

// Public match-day timetable, shown on the main site (Quins JRT.dc.html).
export async function getSchedule(agId) {
  await delay(60);
  const ag = findAg(agId);
  if (!ag || !(ag.pools || []).length) return null;
  const state = await fetchOverrideState(agId);
  // Nothing published yet — the caller shows "coming soon" rather than a draw.
  if (state.awaitingPublication) return { awaitingPublication: true, pools: [], knockout: [] };
  const override = state.schedule;
  const draw = await resolveDraw(ag, override);

  const pools = draw.pools.map((p) => {
    const slots = slotsForPool(draw, p.id);
    const games = slots.map((s) => ({ home: s.home, away: s.away, time: fmtTime(s.startMins), pitch: s.pitch || 'TBD' }));
    return { id: p.id, name: p.name, games };
  });

  // Every age group that keeps standings (i.e. not the U6/U7 non-competitive
  // festivals) gets its knockout stage pre-listed here — the special
  // double-bracket format for SPECIAL_BRACKET_AGE_IDS (see
  // buildU16BBracket), or the plain Cup/Bowl/Plate/Shield waterfall
  // (buildBracket) for everyone else. A manager/organizer's saved override
  // (if any) always takes over via resolveKnockout.
  let knockout = null;
  if (ag.hasStandings) {
    const store = await readStore();
    const tables = computeStandings(draw, store);
    const slots = resolveKnockout(ag, draw, override, tables, store);
    knockout = slots.map((s) => ({ label: s.round, home: s.home || 'TBD', away: s.away || 'TBD', time: fmtTime(s.startMins), pitch: s.pitch || 'TBD' }));
  }

  return { ageGroup: { id: ag.id, name: ag.name }, pools, knockout };
}

export async function getStandings(agId) {
  await delay(80);
  const ag = findAg(agId); if (!ag) return null;
  const [store, state] = await Promise.all([readStore(), fetchOverrideState(agId)]);
  if (state.awaitingPublication) {
    return {
      ageGroup: { id: ag.id, name: ag.name, hasStandings: ag.hasStandings },
      awaitingPublication: true,
      _advance: ag.advance, pools: [], tables: {}, bracket: [], doubleBracket: null,
    };
  }
  const override = state.schedule;
  const draw = await resolveDraw(ag, override);
  const tables = ag.hasStandings ? computeStandings(draw, store) : {};
  const isSpecial = SPECIAL_BRACKET_AGE_IDS.includes(ag.id);
  const bracket = ag.hasStandings && !isSpecial ? buildBracket(ag, draw, tables, store) : [];
  const doubleBracket = ag.hasStandings && isSpecial ? buildU16BBracket(ag, draw, tables, store) : null;
  return { ageGroup: { id: ag.id, name: ag.name, hasStandings: ag.hasStandings }, _advance: ag.advance, pools: draw.pools || [], tables, bracket, doubleBracket };
}

export function supportsSpiritAward(agId) {
  return SPIRIT_AWARD_AGE_IDS.includes(agId);
}

// Tally of Spirit of Rugby Award nominations for one age group. Only
// counts "real" matches (both teams decided — TBD knockout slots don't
// count) that have a submitted result with a nominee attached. Once every
// real match for the age group has a result, `complete` is true and
// `winners` lists the player(s) with the most nominations (a tie produces
// more than one winner).
export async function getSpiritAward(agId) {
  if (!SPIRIT_AWARD_AGE_IDS.includes(agId)) return { supported: false };
  const fixtures = await getFixtures(agId);
  const all = [...fixtures.pool, ...fixtures.knockout];
  const real = all.filter((fx) => fx.home && fx.away);
  const totalMatches = real.length;
  const playedMatches = real.filter((fx) => fx.result && fx.result.homeScore != null).length;
  const complete = totalMatches > 0 && playedMatches === totalMatches;

  const counts = {};
  const teams = {}; // nominee name -> team they were nominated for (from the fixture)
  real.forEach((fx) => {
    if (!fx.result) return;
    [
      [fx.result.spiritNomineeHome, fx.home],
      [fx.result.spiritNomineeAway, fx.away],
    ].forEach(([name, team]) => {
      if (!name) return;
      const key = name.trim();
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
      if (!teams[key]) teams[key] = team;
    });
  });
  const tally = Object.entries(counts)
    .map(([name, count]) => ({ name, count, team: teams[name] || '' }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const topCount = tally.length ? tally[0].count : 0;
  const winners = complete && topCount > 0 ? tally.filter((t) => t.count === topCount).map((t) => ({ name: t.name, team: t.team })) : [];

  return { supported: true, totalMatches, playedMatches, complete, tally, winners };
}

export async function getFixtures(agId) {
  await delay(80);
  const ag = findAg(agId); if (!ag) return [];
  const [store, state] = await Promise.all([readStore(), fetchOverrideState(agId)]);
  if (state.awaitingPublication) return { awaitingPublication: true, pool: [], knockout: [] };
  const override = state.schedule;
  const draw = await resolveDraw(ag, override);
  const pool = draw.slots.map((fx) => ({
    ...fx, ageGroupId: ag.id, stage: 'pool',
    poolName: (draw.pools.find((p) => p.id === fx.poolId) || {}).name,
    time: fmtTime(fx.startMins), result: store[fx.id] || null,
  })).sort((a, b) => a.startMins - b.startMins);
  const tables = computeStandings(draw, store);
  const knockoutSlots = resolveKnockout(ag, draw, override, tables, store);
  const knockout = knockoutSlots.map((s) => ({
    id: s.id, stage: 'knockout', round: s.round,
    home: s.home || null, away: s.away || null,
    pitch: s.pitch || 'TBD',
    result: store[s.id] || null,
  }));
  return { pool, knockout };
}

/* -------- Fixture Editor (drag teams into pools/slots, edit times) --------
   Only available to a signed-in manager (their own age group, or the
   "admin" invite code) or an organizer (any age group) — enforced again
   server-side in save-schedule-override.js. */
export async function getDraw(agId, session) {
  const ag = findAg(agId); if (!ag) return null;
  // Editor works on the draft, so pass the session through.
  const [store, state] = await Promise.all([readStore(), fetchOverrideState(agId, session)]);
  const override = state.schedule;
  const draw = await resolveDraw(ag, override);
  const tables = computeStandings(draw, store);
  const knockout = resolveKnockout(ag, draw, override, tables, store);
  // Deep copy so the editor can freely mutate its working draft.
  return JSON.parse(JSON.stringify({
    pools: draw.pools, slots: draw.slots, knockout,
    _publish: {
      published: state.published,
      publishedAt: state.publishedAt,
      publishedBy: state.publishedBy,
      managerCanPublishNow: state.managerCanPublishNow,
    },
  }));
}

// Recomputes what the knockout stage would auto-seed to RIGHT NOW from
// live standings, ignoring any saved knockout override — used by the
// editor's "Regenerate from standings" button.
export async function autoKnockoutSlots(agId, session) {
  const ag = findAg(agId); if (!ag) return [];
  const [store, state] = await Promise.all([readStore(), fetchOverrideState(agId, session)]);
  const override = state.schedule;
  const draw = await resolveDraw(ag, override);
  const tables = computeStandings(draw, store);
  return JSON.parse(JSON.stringify(computeAutoKnockout(ag, draw, tables, store)));
}

export function regeneratePoolSlots(agId, poolId, teams) {
  return poolSlots(`${agId}:${poolId}:new${Date.now()}`, teams, FESTIVAL_AGE_IDS.includes(agId)).map((s) => ({ ...s, poolId }));
}

export function timeToMinutes(hhmm) { return parseTime24(hhmm); }
export function minutesToTimeInput(mins) { return fmtTime24(mins); }
export function minutesToDisplay(mins) { return fmtTime(mins); }

export async function saveDraw(agId, draw, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const payload = { pools: draw.pools, slots: draw.slots, knockout: draw.knockout };
  const r = await tryFetchJson('/.netlify/functions/save-schedule-override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify({ ageGroupId: agId, schedule: payload }),
  });
  if (r.real) return r.json;
  return (await local()).saveScheduleOverride(session.token, agId, payload, false);
}

/* -------- Publishing --------
   Saving a draw only writes the draft. These two are what put fixtures in
   front of parents, and take them back down again.

   Permission is re-checked server-side in publish-schedule.js: organisers any
   time, managers only on the tournament days (7-8 Nov 2026) and only for
   their own age group. The UI uses canPublishNow() to decide whether to show
   the button as enabled, but the server is the authority. */
export async function publishDraw(agId, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const r = await tryFetchJson('/.netlify/functions/publish-schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify({ ageGroupId: agId, action: 'publish' }),
  });
  if (r.real) return r.json;
  return { ok: false, error: 'Publishing needs the live site.' };
}

export async function unpublishDraw(agId, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const r = await tryFetchJson('/.netlify/functions/publish-schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify({ ageGroupId: agId, action: 'unpublish' }),
  });
  if (r.real) return r.json;
  return { ok: false, error: 'Publishing needs the live site.' };
}

/* Cosmetic only — mirrors the server rule so the UI can explain itself
   before the user clicks. publishState comes from getDraw()._publish. */
export function canPublishNow(session, publishState) {
  if (!session) return false;
  if (isOrganizerSession(session)) return true;
  return !!(publishState && publishState.managerCanPublishNow);
}

/* An organiser session reaches this file in more than one shape depending on
   where it came from: currentSession() above builds { isOrganizer: true } from
   the organizer app's stored session, while organizer-login.js returns an
   object carrying _role (and `role` holding their job title, not a role name).
   Check all of them — missing one silently hides the Publish button, which is
   exactly what happened the first time. The server re-checks properly from the
   signed token, so this is only about what the UI offers. */
function isOrganizerSession(session) {
  if (!session) return false;
  return !!(
    session.isOrganizer ||
    session._role === 'organizer' ||
    session.role === 'organizer'
  );
}

export async function resetDraw(agId, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const r = await tryFetchJson('/.netlify/functions/save-schedule-override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify({ ageGroupId: agId, reset: true }),
  });
  if (r.real) return r.json;
  return (await local()).saveScheduleOverride(session.token, agId, null, true);
}

// Manager sign-in. Backed by netlify/functions/manager-login.js — an
// account created via signup() below, stored server-side in Netlify Blobs.
export async function login(username, password) {
  const r = await tryFetchJson('/.netlify/functions/manager-login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = r.real ? r.json : (await local()).managerLogin({ username, password });
  if (json.ok) {
    const session = { ...json.session, token: json.token };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, session };
  }
  // If these were actually organizer credentials (they clicked the wrong
  // login), sign them in as an organizer — the scores page fully supports an
  // organizer session (all-age-group access), so there's nothing to redirect.
  const ro = await tryFetchJson('/.netlify/functions/organizer-login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const ojson = ro.real ? ro.json : (await local()).organizerLogin({ username, password });
  if (ojson.ok) {
    const orgSession = { ...ojson.session, token: ojson.token };
    localStorage.setItem(ORG_SESSION_KEY, JSON.stringify(orgSession));
    return { ok: true, session: { token: ojson.token, username: orgSession.username, name: orgSession.name, ageGroupId: '*', isOrganizer: true } };
  }
  return { ok: false, error: json.error || 'Wrong username or password.' };
}

// Manager self-signup. Which age group the account is tied to is decided
// entirely by which invite code was entered (see manager-signup.js) — no
// dropdown, so a manager can't accidentally sign up for the wrong group.
export async function signup({ name, username, password, inviteCode }) {
  const r = await tryFetchJson('/.netlify/functions/manager-signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, username, password, inviteCode }),
  });
  const json = r.real ? r.json : (await local()).managerSignup({ name, username, password, inviteCode });
  if (json.ok && json.pending) return { ok: true, pending: true, message: json.message };
  if (json.ok) {
    const session = { ...json.session, token: json.token };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, session };
  }
  return { ok: false, error: json.error || 'Could not create account.' };
}

// Reads whichever session is present — a manager session from this page,
// OR (so an organizer doesn't have to sign in twice) an Organizer session
// from Organizer.dc.html. Organizers get full (ageGroupId:'*') access,
// same as the master admin manager account, re-verified server-side from
// the token's own role either way.
export function currentSession() {
  try {
    const mgr = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (mgr && mgr.token) return mgr;
  } catch (e) {}
  try {
    const org = JSON.parse(localStorage.getItem(ORG_SESSION_KEY));
    if (org && org.token) return { token: org.token, username: org.username, name: org.name, ageGroupId: '*', isOrganizer: true };
  } catch (e) {}
  return null;
}
export function logout() { localStorage.removeItem(SESSION_KEY); }

// Registrations for the signed-in manager's OWN age group (teams + players,
// including medical notes and emergency contacts — a manager is responsible
// for player safety in their group). The server (get-my-registrations.js)
// decides the group from the login token, so this can only ever return the
// caller's own group; organizers and the '*' admin-manager get every group.
export async function getMyRegistrations(session) {
  session = session || currentSession();
  if (!session || !session.token) return { teams: [], players: [], scope: '' };
  const r = await tryFetchJson('/.netlify/functions/get-my-registrations', {
    headers: { 'Authorization': `Bearer ${session.token}` },
  });
  if (r.real) {
    return r.json.ok
      ? { teams: r.json.teams || [], players: r.json.players || [], scope: r.json.scope || '' }
      : { teams: [], players: [], scope: '' };
  }
  // Local preview fallback: filter the shared sample down to this manager's
  // group so the screen still demonstrates before the site is deployed.
  try {
    const sample = (await local()).sampleRegistrations();
    if (!session.ageGroupId || session.ageGroupId === '*') return { ...sample, scope: 'all' };
    const name = (AGE_GROUPS.find((a) => a.id === session.ageGroupId) || {}).name || '';
    const keep = (row) => String(row.ageGroup || '').trim().toLowerCase() === name.toLowerCase();
    return { teams: (sample.teams || []).filter(keep), players: (sample.players || []).filter(keep), scope: name };
  } catch (e) { return { teams: [], players: [], scope: '' }; }
}

// Submits one match result. Backed by netlify/functions/submit-result.js,
// which re-verifies the signed-in manager/organizer's age-group access
// server-side before writing — the check here is just for instant UI
// feedback.
/* Removes a result entirely, so the match goes back to unplayed. Distinct
   from saving 0-0, which is a real draw worth two league points each. */
export async function clearResult(matchId, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const r = await tryFetchJson('/.netlify/functions/submit-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify({ matchId, data: { clear: true } }),
  });
  if (r.real) return r.json;
  return (await local()).submitResult(session.token, matchId, { clear: true });
}

export async function submitResult(matchId, data, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const agId = matchId.split(':')[0];
  if (session.ageGroupId !== '*' && session.ageGroupId !== agId) return { ok: false, error: 'You can only enter scores for your own age group.' };
  const r = await tryFetchJson('/.netlify/functions/submit-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
    body: JSON.stringify({ matchId, data }),
  });
  if (r.real) return r.json;
  return (await local()).submitResult(session.token, matchId, data);
}
