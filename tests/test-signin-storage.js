/* tests/test-signin-storage.js
   ---------------------------------------------------------------------------
   A blocked session save is a sign-in FAILURE, not a silent success (JRT-8).

   The manager who "could not sign in on iPad" is the reason this exists. The
   session save (localStorage.setItem) used to be unguarded on every sign-in
   path, while every READ of it was wrapped — so in Safari Private Browsing,
   where setItem throws, the sign-in threw out of the click handler and the
   button just sat on "Signing in…", with nothing to tell the person why.

   Driven against the REAL scores-data.js (Node imports it fine once localStorage
   and fetch exist), not a re-typed copy of the rule. Every value is invented.
*/

const path = require('path');
const { pathToFileURL } = require('url');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

const SESSION_KEY = 'adhjrt_session_v2';
const store = new Map();
let THROW_ON_SET = false;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    if (THROW_ON_SET) throw new Error('QuotaExceededError (simulated Private Browsing)');
    store.set(k, String(v));
  },
  removeItem: (k) => { store.delete(k); },
};

/* Every sign-in function posts through tryFetchJson -> fetch. Stub fetch to
   APPROVE, so the ONLY thing left to decide the outcome is whether the save
   succeeds — which is exactly what this file is about. */
const FETCH_JSON = { ok: true, session: { username: 'mgr', name: 'Mgr', ageGroupId: 'u14b' }, token: 'tok-invented' };
globalThis.fetch = async () => ({ status: 200, text: async () => JSON.stringify(FETCH_JSON) });

async function main() {
  const api = await import(pathToFileURL(path.join(repoRoot(), 'scores-data.js')).href);
  const MSG = /blocking sign-in/i;

  section('⚠️ A blocked save fails LOUDLY on every sign-in path (JRT-8)');
  const paths = [
    ['hubAuth', () => api.hubAuth('tok')],
    ['login', () => api.login('mgr', 'pw')],
    ['signup', () => api.signup({ name: 'M', title: 'T', username: 'mgr', password: 'pw', inviteCode: 'x' })],
  ];
  for (const [name, callFn] of paths) {
    store.clear();
    THROW_ON_SET = true;
    let res = null;
    let threw = null;
    try { res = await callFn(); } catch (e) { threw = e; }
    THROW_ON_SET = false;
    check(`${name}: a blocked save does not throw out of the call`, !threw, threw && String(threw));
    check(`${name}: …it returns ok:false`, !!res && res.ok === false, JSON.stringify(res));
    check(`${name}: …with a Private-Browsing-aware message`, !!res && MSG.test(res.error || ''), res && res.error);
    check(`${name}: …and leaves nothing half-written behind`, !store.has(SESSION_KEY));
  }

  section('CONTROL: when storage works, sign-in succeeds and actually persists');
  {
    store.clear();
    THROW_ON_SET = false;
    const r = await api.hubAuth('tok');
    check('hubAuth succeeds when the save works', !!r && r.ok === true, JSON.stringify(r));
    check('…and the session is actually written', store.has(SESSION_KEY));
  }

  section('The write guard matches the reads, and the message reaches the screen');
  {
    const sd = readRepo('scores-data.js');
    check('a persistSession helper guards the write', /function persistSession\(session\)/.test(sd));
    check('all three sign-in paths route their save through it',
      (sd.match(/if \(!persistSession\(session\)\) return \{ ok: false, error: STORAGE_BLOCKED_MSG \};/g) || []).length === 3);
    /* CONTROL: the only remaining raw write is the one INSIDE persistSession. */
    check('no raw setItem(SESSION_KEY, session) survives outside the helper',
      (sd.match(/localStorage\.setItem\(SESSION_KEY, JSON\.stringify\(session\)\);/g) || []).length === 1);
    /* The Club Hub sign-in (the manager's actual path) shows the returned error,
       so the storage message is not just returned — it is seen. */
    const signin = readRepo('Signin.dc.html');
    check('the Club Hub sign-in surfaces res.error to the user', /hubError: res\.error/.test(signin));
  }

  summary('test-signin-storage.js');
}

main().catch((e) => { console.log('FATAL: ' + (e && (e.stack || e))); process.exit(1); });
