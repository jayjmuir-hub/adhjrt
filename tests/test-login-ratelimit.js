/* tests/test-login-ratelimit.js
   ---------------------------------------------------------------------------
   Proves the login rate limit in netlify/functions/login.js and the
   peek/record/forget primitives in _ratelimit.js.

   WHAT WENT WRONG. One bucket, keyed on the connection address alone,
   incremented by checkRate() BEFORE the password was looked at:

       const rate = await checkRate(store, `${ip}:login`, ...)   // max 10 / 15 min
       if (!rate.ok) return tooManyResponse(rate);

   Two consequences, and the second is the one that would have shown up on the
   day. Every manager at Zayed Sports City shares one
   x-nf-client-connection-ip, so ONE budget of ten covered the entire venue —
   and because the counter went up before the password was checked, ten CORRECT
   sign-ins exhausted it exactly as fast as ten wrong ones. The eleventh manager
   to arrive on the morning of 7 November could not sign in, first attempt,
   correct password, for fifteen minutes.

   "FIFTEEN MANAGERS SIGN IN AND ALL FIFTEEN GET IN" is the check this file was
   written for, and it does fail against the old code. ⚠️ BUT IT ONLY GUARDS
   HALF THE FIX, and I only found that out by injecting the other half: put the
   bucket back to connection-wide and all fifteen STILL get in, because nothing
   increments a counter on success any more. The scenario is really a test of
   "successes cost nothing", not of "the bucket is per account".

   The per-account half is guarded by 'mgr2 on the same wifi is unaffected' —
   one manager exhausting their own budget while the person beside them signs in
   normally. Both checks are load-bearing and neither substitutes for the other.

   ⚠️ THE STORE MUST BE SHARED ACROSS CALLS. A fresh store per request makes
   every rate-limit test pass no matter what the code does, because nothing is
   ever counted twice. The fake below is created once per scenario and handed to
   every call in it.
*/

const Module = require('module');
const path = require('path');
const { section, check, eq, summary, repoRoot } = require('./_lib');

/* ---- stubs -------------------------------------------------------------- */
let accountsList = [];
let store = null;          /* the shared config store — see the warning above */

function makeStore() {
  const data = new Map();
  return {
    data,
    async get(key) { return data.has(key) ? JSON.parse(data.get(key)) : null; },
    async setJSON(key, value) { data.set(key, JSON.stringify(value)); },
    async delete(key) { data.delete(key); },
    async list() { return { blobs: [] }; },
  };
}

const stubs = {
  '@netlify/blobs': {
    getStore: (arg) => {
      const name = typeof arg === 'string' ? arg : (arg && arg.name);
      if (name === 'accounts') {
        return {
          async get(key) { return key === 'list' ? accountsList : null; },
          async setJSON() {}, async delete() {}, async list() { return { blobs: [] }; },
        };
      }
      if (name === 'config') return store;
      /* signins and anything else — a black hole is fine, recordSignIn fails
         open by design. */
      return { async get() { return null; }, async setJSON() {}, async delete() {}, async list() { return { blobs: [] }; } };
    },
  },
  /* ⚠️ compare() answers by COMPARING, not by always saying false. A stub that
     always fails cannot tell "the right password was refused" from "the wrong
     password was refused", and every check about successful sign-in below would
     pass against a completely broken door. The hash here is just the password
     with a marker on it. */
  bcryptjs: {
    hashSync: (p) => `hashed:${p}`, compareSync: (p, h) => h === `hashed:${p}`,
    hash: async (p) => `hashed:${p}`, compare: async (p, h) => h === `hashed:${p}`,
  },
};

const realResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) return 'STUB:' + request;
  return realResolve.call(this, request, ...rest);
};
const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
  return realLoad.call(this, request, ...rest);
};

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-not-a-real-value';

const FN = path.join(repoRoot(), 'netlify', 'functions');
const login = require(path.join(FN, 'login.js'));
const RL = require(path.join(FN, '_ratelimit.js'));

/* One venue address, shared by everyone on the wifi — the whole point. */
const VENUE_IP = '92.0.0.7';

const post = (username, password, ip = VENUE_IP) => login.handler({
  httpMethod: 'POST',
  headers: { 'x-nf-client-connection-ip': ip },
  body: JSON.stringify({ username, password }),
});

const manager = (n) => ({
  username: `mgr${n}`, name: `Manager ${n}`, role: 'manager', ageGroupId: 'u16b',
  approved: true, passwordHash: `hashed:right-${n}`,
});

(async () => {
  /* ==================================================================== */
  section('Tournament morning — fifteen managers, one wifi, one address');

  {
    store = makeStore();
    accountsList = Array.from({ length: 15 }, (_, i) => manager(i + 1));

    const codes = [];
    for (let i = 1; i <= 15; i++) codes.push((await post(`mgr${i}`, `right-${i}`)).statusCode);

    /* ⚠️ THE CHECK THIS FILE EXISTS FOR. Against the old code, managers 11-15
       got 429 here — correct password, first attempt, refused. */
    eq('all fifteen get in', codes.filter((c) => c === 200).length, 15);
    check('and not one is told "too many attempts"', !codes.includes(429), JSON.stringify(codes));
  }

  {
    store = makeStore();
    accountsList = [manager(1)];
    /* A correct password must cost NOTHING, however many times it is used. */
    for (let i = 0; i < 40; i++) await post('mgr1', 'right-1');
    eq('forty correct sign-ins in a row still work', (await post('mgr1', 'right-1')).statusCode, 200);
    eq('and nothing was counted against the connection', store.data.size, 0);
  }

  /* ==================================================================== */
  section('A wrong password still costs — per account');

  {
    store = makeStore();
    accountsList = [manager(1), manager(2)];

    for (let i = 0; i < 10; i++) await post('mgr1', 'wrong');
    eq('the eleventh wrong password for mgr1 is refused', (await post('mgr1', 'wrong')).statusCode, 429);
    eq('…and so is the CORRECT one, once locked', (await post('mgr1', 'right-1')).statusCode, 429);

    /* ⚠️ THE OTHER HALF OF THE LOCKOUT BUG. One person fumbling must not take
       the manager standing next to them down with it. */
    eq('mgr2 on the same wifi is unaffected', (await post('mgr2', 'right-2')).statusCode, 200);
  }

  {
    store = makeStore();
    accountsList = [manager(1)];
    for (let i = 0; i < 4; i++) await post('mgr1', 'wrong');
    eq('four fumbles then the right password works', (await post('mgr1', 'right-1')).statusCode, 200);
    /* Forgiving: the slate is wiped, not merely paused. Without this a manager
       walks around all morning four mistakes deep. */
    for (let i = 0; i < 9; i++) await post('mgr1', 'wrong');
    eq('…and the count started again from zero', (await post('mgr1', 'right-1')).statusCode, 200);
  }

  /* ==================================================================== */
  section('The connection backstop catches a username sweep');

  {
    store = makeStore();
    accountsList = [manager(1)];
    /* Nobody guessing ONE password trips this; someone working through a list
       of usernames does, because each name gets its own per-account bucket. */
    let refusedAt = 0;
    for (let i = 1; i <= 80 && !refusedAt; i++) {
      if ((await post(`nobody${i}`, 'guess')).statusCode === 429) refusedAt = i;
    }
    check('a sweep of unknown usernames is eventually refused', refusedAt > 0 && refusedAt <= 60,
      `refused at attempt ${refusedAt}`);
    check('…but not before the per-account limit would have (10)', refusedAt > 10, `refused at ${refusedAt}`);

    /* ⚠️ AND KNOWING ONE CORRECT PASSWORD MUST NOT RESET IT. forget() clears
       the per-account bucket only; if it cleared the connection bucket too, a
       sweep could be laundered by signing in correctly every 49 guesses.

       ⚠️ THIS HAS TO BE MEASURED BEFORE THE BLOCK, NOT AFTER IT. My first
       version signed in correctly once the connection was ALREADY blocked and
       asserted a 429 — which passes whatever forget() does, because the peek
       refuses the request before forget is ever reached. Injecting "forget also
       clears the connection bucket" proved it: zero checks went red. The
       laundering has to be attempted from BELOW the threshold, where the
       successful sign-in genuinely runs. */
    store = makeStore();
    accountsList = [manager(1)];
    for (let i = 1; i <= 49; i++) await post(`nobody${i}`, 'guess');   // connection: 49 of 50
    eq('a correct sign-in still works at 49 failures', (await post('mgr1', 'right-1')).statusCode, 200);
    await post('nobody50', 'guess');                                   // connection: 50 — full
    eq('and did NOT launder the sweep — the 51st is still refused',
      (await post('nobody51', 'guess')).statusCode, 429);
  }

  /* ==================================================================== */
  section('Timing — an unknown username must not answer faster than a real one');

  {
    /* Source-level, because the stubbed bcrypt cannot show a timing gap. What
       is asserted is that the short-circuit is GONE: verifyPassword has to be
       called before the `!account` test, against a fallback hash. */
    const src = require('fs').readFileSync(path.join(FN, 'login.js'), 'utf8');
    check('a dummy hash exists to compare against', /DUMMY_HASH\s*=\s*'\$2[aby]\$/.test(src));
    const verifyAt = src.indexOf('await verifyPassword(');
    const guardAt = src.indexOf('if (!account || !account.passwordHash');
    check('bcrypt runs BEFORE the account test, not inside it',
      verifyAt !== -1 && guardAt !== -1 && verifyAt < guardAt, `verify ${verifyAt}, guard ${guardAt}`);
    check('…and the old short-circuiting chain is gone',
      !/!account \|\| !account\.passwordHash \|\| !\(await verifyPassword/.test(src));
  }

  /* ==================================================================== */
  section('peek / record / forget, directly');

  {
    const s = makeStore();
    const OPTS = { max: 3, windowMs: 60000 };
    const now = Date.now();
    eq('peek allows when nothing is stored', (await RL.peekRate(s, 'a', now, OPTS)).ok, true);
    eq('…and peeking does NOT count', s.data.size, 0);

    for (let i = 0; i < 3; i++) await RL.recordFailure(s, 'a', now, OPTS);
    eq('three failures fill a max-3 bucket', (await RL.peekRate(s, 'a', now, OPTS)).ok, false);
    check('and a retry-after is offered', (await RL.peekRate(s, 'a', now, OPTS)).retryAfterSecs > 0);

    await RL.forget(s, 'a');
    eq('forget clears it', (await RL.peekRate(s, 'a', now, OPTS)).ok, true);

    /* The window rolls over on its own. */
    for (let i = 0; i < 3; i++) await RL.recordFailure(s, 'b', now, OPTS);
    eq('a filled bucket is clear again after the window', (await RL.peekRate(s, 'b', now + 60001, OPTS)).ok, true);
  }

  {
    /* ⚠️ FAILS OPEN, like every other use of this module. A hiccuping blob read
       must not cost somebody their sign-in on the one morning it matters. */
    const broken = {
      async get() { throw new Error('simulated'); },
      async setJSON() { throw new Error('simulated'); },
      async delete() { throw new Error('simulated'); },
    };
    const r = await RL.peekRate(broken, 'a', Date.now(), { max: 1, windowMs: 60000 });
    check('an unreadable counter allows', r.ok === true && r.degraded === true);
    let threw = false;
    try { await RL.recordFailure(broken, 'a', Date.now()); await RL.forget(broken, 'a'); } catch (e) { threw = true; }
    check('and recording/clearing never throws at the caller', !threw);
  }

  Module._resolveFilename = realResolve;
  Module._load = realLoad;
  summary('test-login-ratelimit.js');
})();
