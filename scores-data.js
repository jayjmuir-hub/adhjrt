/* ============================================================
   ADH JRT — Scores & Standings data layer  (LIVE backend)
   ------------------------------------------------------------
   Every read/write the UI needs goes through the async functions
   exported at the bottom. Manager accounts, match results, and
   sessions are real — accounts self-signup via manager-signup.js
   (gated by an invite code per age group) and are stored server-side
   in Netlify Blobs; results are written via submit-result.js and read
   back (by anyone, including the public Standings page) via
   get-results.js. See those three files in netlify/functions/ for the
   one-time setup (MANAGER_INVITE_CODES + SESSION_SECRET env vars).

   Everything below this point — age group / pool config, the
   standings/bracket-building math — is pure client-side logic that
   runs the same regardless of backend; only the storage plumbing
   changed.
   ============================================================ */

const STORE_KEY = 'adhjrt_results_v1';   // matchId -> result
const SESSION_KEY = 'adhjrt_session_v1'; // current manager token

/* -------- Tournament configuration (pools & teams) --------
   "Build it flexible": age groups, pools, teams and how many
   advance are all data. Fill these in with the real draw later.
   hasStandings:false  → festival age groups (U6/U7), no table. */
const ALL9 = ['Abu Dhabi Harlequins', 'Dubai Exiles', 'Dubai Sharks', 'Dubai Hurricanes', 'Barrelhouse', 'Al Ain Amblers', 'Dubai Dragons', 'Dubai Tigers', 'Abu Dhabi Small Blacks'];
const twoPools9 = () => [
  { id: 'A', name: 'Pool A', teams: ALL9.slice(0, 5) },
  { id: 'B', name: 'Pool B', teams: ALL9.slice(5) },
];

const AGE_GROUPS = [
  { id: 'u6',  name: 'U6 Tag',           hasStandings: false, pools: [], advance: 0 },
  { id: 'u7',  name: 'U7 Tag',           hasStandings: false, pools: [], advance: 0 },
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

// Age groups using the special double-bracket knockout format (see
// buildU16BBracket) instead of the plain waterfall every other group uses.
const SPECIAL_BRACKET_AGE_IDS = ['u16b', 'u16g'];

/* ---------------- storage helpers (live backend) ----------------
   Results are read from the public get-results Netlify Function, which
   serves whatever's been written to Netlify Blobs by submit-result. */
async function readStore() {
  try {
    const res = await fetch('/.netlify/functions/get-results');
    const json = await res.json();
    return json.ok ? json.results : {};
  } catch (e) { return {}; }
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms)); // small UI-friendly pause

/* ---------------- fixtures (deterministic) ---------------- */
// Round-robin match ids per pool: `${agId}:${poolId}:${i}-${j}` (i<j indices)
function poolFixtures(ag) {
  const out = [];
  (ag.pools || []).forEach((pool) => {
    for (let i = 0; i < pool.teams.length; i++) {
      for (let j = i + 1; j < pool.teams.length; j++) {
        out.push({
          id: `${ag.id}:${pool.id}:${i}-${j}`,
          ageGroupId: ag.id, poolId: pool.id, stage: 'pool',
          home: pool.teams[i], away: pool.teams[j],
        });
      }
    }
  });
  return out;
}

function findAg(id) { return AGE_GROUPS.find((a) => a.id === id); }

/* ---------------- standings engine ---------------- */
// Applies: league points (4 win/walkover, 2 draw, 0 loss/no-show),
// then tie-breaks: margin → points-for → head-to-head(2) →
// least-conceded → mini-league(3+) → coin-toss flag.
function computeStandings(ag, store) {
  const rows = {};
  (ag.pools || []).forEach((pool) => {
    rows[pool.id] = {};
    pool.teams.forEach((t) => {
      rows[pool.id][t] = { team: t, P: 0, W: 0, D: 0, L: 0, PF: 0, PA: 0, tries: 0, cards: 0, pts: 0 };
    });
  });

  poolFixtures(ag).forEach((fx) => {
    const res = store[fx.id];
    if (!res || res.homeScore == null || res.awayScore == null) return;
    const h = rows[fx.poolId][fx.home], a = rows[fx.poolId][fx.away];
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
  const miniStat = (teams, store, pool) => {
    const s = {}; teams.forEach((t) => (s[t] = { PF: 0, PA: 0, pts: 0 }));
    poolFixtures(ag).forEach((fx) => {
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
  (ag.pools || []).forEach((pool) => {
    let list = Object.values(rows[pool.id]).map((r) => ({ ...r, margin: r.PF - r.PA }));
    list.sort((x, y) => (y.pts - x.pts) || (y.margin - x.margin) || (y.PF - x.PF) || (x.PA - y.PA));

    // resolve remaining exact ties (pts,margin,PF,PA all equal) within groups
    const out = []; let i = 0;
    while (i < list.length) {
      let j = i; while (j + 1 < list.length && ['pts', 'margin', 'PF', 'PA'].every((k) => list[j + 1][k] === list[i][k])) j++;
      const group = list.slice(i, j + 1);
      if (group.length > 1) {
        const mini = miniStat(group.map((g) => g.team), store, pool.id);
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

/* ---------------- pool schedule (no team back-to-back) ----------------
   Each match: two 7-min halves + 3-min half-time + 3 min to next kick-off
   = a 20-minute slot, kicking off at 8:00am on the pool's (TBD) pitch.
   Games are ordered greedily, always preferring the pairing whose two
   teams have rested longest; if every remaining game would repeat a team
   from the immediately previous slot (mathematically unavoidable for a
   4-team pool at some point), a single empty rest slot is inserted on
   that pitch before the next kick-off — so no team ever plays twice
   with zero break between. */
const SLOT_MINS = 20; // 7 + 3 + 7 + 3
const DAY_START_MINS = 8 * 60; // 8:00am

function orderNoBackToBack(teams) {
  let remaining = [];
  for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) remaining.push([teams[i], teams[j]]);
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

export async function getSchedule(agId) {
  await delay(60);
  const ag = findAg(agId);
  if (!ag || !ag.hasStandings || !(ag.pools || []).length) return null;
  let maxEndMins = DAY_START_MINS;
  const pools = ag.pools.map((p) => {
    const seq = orderNoBackToBack(p.teams);
    const games = seq
      .map((g, idx) => (g ? { home: g[0], away: g[1], time: fmtTime(DAY_START_MINS + idx * SLOT_MINS), pitch: 'TBD' } : null))
      .filter(Boolean);
    const endMins = DAY_START_MINS + seq.length * SLOT_MINS; // includes any inserted rest slots
    if (endMins > maxEndMins) maxEndMins = endMins;
    return { id: p.id, name: p.name, games };
  });

  // Age groups in SPECIAL_BRACKET_AGE_IDS run the special double-bracket
  // knockout stage (see buildU16BBracket) — generate its kickoff times
  // back-to-back in 20-minute slots, starting once the last pool match
  // anywhere wraps up.
  let knockout = null;
  if (SPECIAL_BRACKET_AGE_IDS.includes(ag.id)) {
    const store = await readStore();
    const tables = computeStandings(ag, store);
    const db = buildU16BBracket(ag, tables, store);
    const order = [
      { label: 'Top Bracket — Semi-Final 1', g: db.top.sf1 },
      { label: 'Top Bracket — Semi-Final 2', g: db.top.sf2 },
      { label: 'Bottom Bracket — Semi-Final 1', g: db.bottom.sf1 },
      { label: 'Bottom Bracket — Semi-Final 2', g: db.bottom.sf2 },
      { label: 'Cup Final', g: db.top.cup },
      { label: 'Bowl Final', g: db.top.bowl },
      { label: 'Plate Final', g: db.bottom.plate },
      { label: 'Shield Final', g: db.bottom.shield },
    ];
    knockout = order.map((o, idx) => ({
      label: o.label,
      home: o.g.home || 'TBD', away: o.g.away || 'TBD',
      time: fmtTime(maxEndMins + idx * SLOT_MINS),
      pitch: 'TBD',
    }));
  }

  return { ageGroup: { id: ag.id, name: ag.name }, pools, knockout };
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

function buildBracket(ag, tables, store) {
  const pools = ag.pools || [];
  const wrap = makeWrap(store);

  // Pool standings aren't final (and finalists aren't real) until every
  // pool-stage fixture for this age group has a result — until then the
  // finals show as TBD v TBD rather than guessing from a 0-played table.
  const poolsComplete = poolFixtures(ag).every((fx) => store[fx.id] && store[fx.id].homeScore != null) && poolFixtures(ag).length > 0;

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
  const seeds = poolsComplete ? [] : [];
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
function buildU16BBracket(ag, tables, store) {
  const wrap = makeWrap(store);
  const pools = ag.pools || [];
  const A = tables[pools[0] ? pools[0].id : null] || [];
  const B = tables[pools[1] ? pools[1].id : null] || [];
  const poolsComplete = poolFixtures(ag).every((fx) => store[fx.id] && store[fx.id].homeScore != null) && poolFixtures(ag).length > 0;
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

export async function getStandings(agId) {
  await delay(80);
  const ag = findAg(agId); if (!ag) return null;
  const store = await readStore();
  const tables = ag.hasStandings ? computeStandings(ag, store) : {};
  const isSpecial = SPECIAL_BRACKET_AGE_IDS.includes(ag.id);
  const bracket = ag.hasStandings && !isSpecial ? buildBracket(ag, tables, store) : [];
  const doubleBracket = ag.hasStandings && isSpecial ? buildU16BBracket(ag, tables, store) : null;
  return { ageGroup: { id: ag.id, name: ag.name, hasStandings: ag.hasStandings }, _advance: ag.advance, pools: ag.pools || [], tables, bracket, doubleBracket };
}

export async function getFixtures(agId) {
  await delay(80);
  const ag = findAg(agId); if (!ag) return [];
  const store = await readStore();
  const pool = poolFixtures(ag).map((fx) => ({ ...fx, poolName: (ag.pools.find((p) => p.id === fx.poolId) || {}).name, result: store[fx.id] || null }));
  const tables = computeStandings(ag, store);
  let knockout;
  if (SPECIAL_BRACKET_AGE_IDS.includes(ag.id)) {
    const db = buildU16BBracket(ag, tables, store);
    knockout = [
      { ...db.top.sf1, round: 'Top Bracket — Semi-Final 1' },
      { ...db.top.sf2, round: 'Top Bracket — Semi-Final 2' },
      { ...db.top.cup, round: 'Cup Final' },
      { ...db.top.bowl, round: 'Bowl Final' },
      { ...db.bottom.sf1, round: 'Bottom Bracket — Semi-Final 1' },
      { ...db.bottom.sf2, round: 'Bottom Bracket — Semi-Final 2' },
      { ...db.bottom.plate, round: 'Plate Final' },
      { ...db.bottom.shield, round: 'Shield Final' },
    ];
  } else {
    knockout = buildBracket(ag, tables, store).flatMap((r) => r.games.map((g) => ({ ...g, round: r.round })));
  }
  return { pool, knockout };
}

// Manager sign-in. Backed by netlify/functions/manager-login.js — an
// account created via signup() below, stored server-side in Netlify Blobs.
export async function login(username, password) {
  try {
    const res = await fetch('/.netlify/functions/manager-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    if (json.ok) {
      const session = { ...json.session, token: json.token };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return { ok: true, session };
    }
    return { ok: false, error: json.error || 'Wrong username or password.' };
  } catch (e) {
    return { ok: false, error: 'Could not reach the server. Try again.' };
  }
}

// Manager self-signup. Which age group the account is tied to is decided
// entirely by which invite code was entered (see manager-signup.js) — no
// dropdown, so a manager can't accidentally sign up for the wrong group.
export async function signup({ name, username, password, inviteCode }) {
  try {
    const res = await fetch('/.netlify/functions/manager-signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password, inviteCode }),
    });
    const json = await res.json();
    if (json.ok) {
      const session = { ...json.session, token: json.token };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return { ok: true, session };
    }
    return { ok: false, error: json.error || 'Could not create account.' };
  } catch (e) {
    return { ok: false, error: 'Could not reach the server. Try again.' };
  }
}

export function currentSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
}
export function logout() { localStorage.removeItem(SESSION_KEY); }

// Submits one match result. Backed by netlify/functions/submit-result.js,
// which re-verifies the manager's token and age-group ownership server-side
// before writing — the checks here are just for instant UI feedback.
export async function submitResult(matchId, data, session) {
  if (!session || !session.token) return { ok: false, error: 'Not signed in.' };
  const agId = matchId.split(':')[0];
  if (session.ageGroupId !== '*' && session.ageGroupId !== agId) return { ok: false, error: 'You can only enter scores for your own age group.' };
  try {
    const res = await fetch('/.netlify/functions/submit-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
      body: JSON.stringify({ matchId, data }),
    });
    const json = await res.json();
    return json;
  } catch (e) {
    return { ok: false, error: 'Could not reach the server. Try again.' };
  }
}
