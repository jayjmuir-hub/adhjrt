/* tests/test-session-migration.js
   ------------------------------------------------------------------------
   ONE session key, 'adhjrt_session_v2', for both roles (Aug 2026 —
   claude/specs/spec-unified-login.md) — and the migration that means NOBODY
   is signed out by the change. Driven against the REAL scores-data.js
   module (Node imports it fine once localStorage exists), not a re-typed
   copy of the rules.

   ⚠️ Every value here is invented; the tokens are the string 'tok-…'.
*/

const path = require('path');
const { pathToFileURL } = require('url');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

/* A real-enough localStorage. */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};

const V2 = 'adhjrt_session_v2';
const OLD_MGR = 'adhjrt_session_v1';
const OLD_ORG = 'adhjrt_organizer_session';

const ORG_SESSION = { username: 'orga', name: 'Orga Person', role: 'Registrar', _role: 'organizer', token: 'tok-org' };
const MGR_SESSION = { username: 'mgr', name: 'Mgr Person', ageGroupId: 'u14b', token: 'tok-mgr' };

async function main() {
  const api = await import(pathToFileURL(path.join(repoRoot(), 'scores-data.js')).href);

/* ====================================================================== */
section('Migration: an old organizer session moves across, wrapped for callers');
{
  store.clear();
  store.set(OLD_ORG, JSON.stringify(ORG_SESSION));
  const s = api.currentSession();
  eq('the session survives the key change — organizer, all age groups', s,
    { token: 'tok-org', username: 'orga', name: 'Orga Person', ageGroupId: '*', isOrganizer: true });
  eq('the raw organizer session now lives under the ONE key', JSON.parse(store.get(V2)), ORG_SESSION);
  check('both old keys are gone', !store.has(OLD_ORG) && !store.has(OLD_MGR));
}

/* ====================================================================== */
section('Migration: an old manager session moves across as-is');
{
  store.clear();
  store.set(OLD_MGR, JSON.stringify(MGR_SESSION));
  const s = api.currentSession();
  eq('the manager session survives, unwrapped', s, MGR_SESSION);
  check('the old key is gone', !store.has(OLD_MGR));
}

/* ====================================================================== */
section('Both old keys at once: the broader role wins');
{
  store.clear();
  store.set(OLD_MGR, JSON.stringify(MGR_SESSION));
  store.set(OLD_ORG, JSON.stringify(ORG_SESSION));
  const s = api.currentSession();
  check('the organizer session is the one kept — same preference the old app.html encoded',
    !!s && s.isOrganizer === true && s.username === 'orga', JSON.stringify(s));
  check('…and both old keys are cleaned up', !store.has(OLD_ORG) && !store.has(OLD_MGR));
}

/* ====================================================================== */
section('A session already under the new key is never overwritten');
{
  store.clear();
  store.set(V2, JSON.stringify(MGR_SESSION));
  store.set(OLD_ORG, JSON.stringify(ORG_SESSION));
  const s = api.currentSession();
  eq('the v2 session stands', s && s.username, 'mgr');
  eq('…untouched by the stale old-key copy', JSON.parse(store.get(V2)), MGR_SESSION);
}

/* ====================================================================== */
section('Malformed old keys: treated as absent, never a throw, still cleaned');
{
  store.clear();
  store.set(OLD_ORG, '{not json');
  store.set(OLD_MGR, JSON.stringify({ username: 'x' })); // no token — not a session
  let threw = false; let s = null;
  try { s = api.currentSession(); } catch (e) { threw = true; }
  check('no throw', !threw);
  eq('no session invented from garbage', s, null);
  check('the garbage is cleaned up', !store.has(OLD_ORG) && !store.has(OLD_MGR));
}

/* ====================================================================== */
section('logout() clears the new key AND both old ones');
{
  store.clear();
  store.set(V2, JSON.stringify(ORG_SESSION));
  store.set(OLD_MGR, JSON.stringify(MGR_SESSION));
  store.set(OLD_ORG, JSON.stringify(ORG_SESSION));
  api.logout();
  check('nothing survives a sign-out — a stale pre-migration copy cannot resurrect a session',
    !store.has(V2) && !store.has(OLD_MGR) && !store.has(OLD_ORG));
  eq('and currentSession agrees', api.currentSession(), null);
}

/* ====================================================================== */
section('The two data layers agree on the one key, and login posts to the one endpoint');
{
  const sd = readRepo('scores-data.js');
  const od = readRepo('organizer-data.js');
  check('scores-data.js uses adhjrt_session_v2', /const SESSION_KEY = 'adhjrt_session_v2';/.test(sd));
  check('organizer-data.js uses the SAME key', /const SESSION_KEY = 'adhjrt_session_v2';/.test(od));
  check('organizer-data.js imports the ONE migration rather than growing a copy',
    /import \{ migrateSession \} from '\.\/scores-data\.js';/.test(od));
  check('scores-data.js login() posts to the unified endpoint',
    /tryFetchJson\('\/\.netlify\/functions\/login',/.test(sd));
  check('…and its old organizer-login fallback chain is gone',
    !/tryFetchJson\('\/\.netlify\/functions\/organizer-login'/.test(sd)
    && !/tryFetchJson\('\/\.netlify\/functions\/manager-login'/.test(sd));

  const app = readRepo('app.html');
  check('app.html no longer reads the old organizer key by hand',
    !/adhjrt_organizer_session/.test(app));
}

summary('test-session-migration.js');
}

main().catch((e) => { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
