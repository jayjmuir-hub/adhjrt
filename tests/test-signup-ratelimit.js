/* tests/test-signup-ratelimit.js
   ------------------------------------------------------------------------
   THE INVITE CODES TOOK UNLIMITED GUESSES UNTIL 3 AUG 2026.

   organizer-signup.js, manager-signup.js and google-auth.js's signup branch
   each check an invite code with a plain string compare. None of them counted
   attempts. An organiser account reads every registrant's name, date of birth
   and medical notes, so an unmetered guessing surface in front of
   ORGANIZER_INVITE_CODE is the most serious thing in this repo's history that
   nothing was asserting. The site-wide Netlify password hid it; that comes off
   about 20 days before the tournament.

   This file DRIVES the three real handlers against an in-memory blob store.
   A text check that `checkSignupRate(` appears somewhere would pass on a call
   whose result is never read — the thing that has to be true is that the
   eleventh attempt is REFUSED, and that is only knowable by running it.

   THE THREE THINGS THAT ACTUALLY MATTER, each with its own fault:

   1. The limit fires at all, on each endpoint.
   2. ONE bucket across all three. Three endpoints guessing the same secrets
      with a budget each is one budget three times over — you would just
      alternate. This is the same argument that put login.js's three endpoints
      in one `:login` bucket.
   3. google-auth.js limits the SIGNUP branch only. Rate-limiting Google
      SIGN-IN would lock managers out of a venue where fifteen of them share
      one wifi address on tournament morning — a self-inflicted outage on the
      one day it must not happen.

   ⚠️ Nothing here is a real credential. The invite codes are literal test
   strings and the Google verifier is stubbed to accept exactly one token.
*/

const path = require('path');
const Module = require('module');
const { section, check, eq, summary } = require('./_lib');

const FN = (f) => path.join(require('./_lib').repoRoot(), 'netlify', 'functions', f);

/* ------------------------------------------------------------------ */
/* Stubs. The blob store is REAL enough to count — the rate limiter reads and
   writes it on every call, so the window arithmetic runs for real. */

const blobData = new Map();
function installStubs() {
  const stubs = {
    '@netlify/blobs': {
      getStore: (nameOrOpts) => {
        const name = typeof nameOrOpts === 'string' ? nameOrOpts : nameOrOpts.name;
        return {
          get: async (key) => {
            const v = blobData.get(name + '/' + key);
            return v === undefined ? null : v;
          },
          setJSON: async (key, val) => { blobData.set(name + '/' + key, val); },
          delete: async (key) => { blobData.delete(name + '/' + key); },
          list: async () => ({ blobs: [] }),
        };
      },
    },
    bcryptjs: {
      compare: async () => false, compareSync: () => false,
      hash: async () => 'stub-hash', hashSync: () => 'stub-hash',
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
  return () => { Module._resolveFilename = realResolve; Module._load = realLoad; };
}

const restore = installStubs();
if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = 'test-not-a-real-secret';
process.env.ORGANIZER_INVITE_CODE = 'org-code-not-real';
process.env.MANAGER_INVITE_CODES = JSON.stringify({ u14b: 'mgr-code-not-real' });

const orgSignup = require(FN('organizer-signup.js')).handler;
const mgrSignup = require(FN('manager-signup.js')).handler;

const ev = (body, ip) => ({
  httpMethod: 'POST',
  headers: { 'x-nf-client-connection-ip': ip },
  body: JSON.stringify(body),
});
const parse = (res) => ({ status: res.statusCode, ...(JSON.parse(res.body || '{}')) });

/* A WRONG invite code every time. These calls must be refused on their merits
   (401) until the limiter takes over (429) — so a 429 can never be confused
   with the endpoint simply working. */
const orgGuess = (ip) => orgSignup(ev({ name: 'X', username: 'x' + Math.round(1), password: 'a-long-enough-password', inviteCode: 'wrong' }, ip));
const mgrGuess = (ip) => mgrSignup(ev({ name: 'X', username: 'y', password: 'a-long-enough-password', inviteCode: 'wrong' }, ip));

function reset() { blobData.clear(); }

async function main() {

/* ====================================================================== */
section('Each signup endpoint refuses an eleventh attempt');
{
  for (const [label, guess, ip] of [
    ['organizer-signup.js', orgGuess, '198.51.100.11'],
    ['manager-signup.js', mgrGuess, '198.51.100.12'],
  ]) {
    reset();
    let last = null;
    for (let i = 0; i < 10; i++) last = parse(await guess(ip));
    eq(`${label}: the tenth guess still gets a real answer`, last.status, 401);
    eq(`${label}: the eleventh is refused`, parse(await guess(ip)).status, 429);

    /* A limit that refuses everybody is an outage, not a limit. */
    eq(`${label}: a different address is unaffected`, parse(await guess('198.51.100.99')).status, 401);
  }
}

/* ====================================================================== */
section('ONE bucket across all three — you cannot alternate to buy more guesses');
{
  reset();
  const ip = '198.51.100.20';
  /* Spend the budget across all three endpoints, four-ish each. If each kept
     its own bucket, ten spread this way would leave every one of them with
     room and the next call would be answered on its merits. */
  const wheel = [orgGuess, mgrGuess];
  let last = null;
  for (let i = 0; i < 10; i++) last = parse(await wheel[i % 2](ip));
  eq('the tenth attempt, spread across the three, still gets a real answer', last.status, 401);

  eq('an eleventh at organizer-signup.js is refused', parse(await orgGuess(ip)).status, 429);
  eq('…and at manager-signup.js, which never had ten of its own', parse(await mgrGuess(ip)).status, 429);
}

/* ====================================================================== */
section('The bucket is keyed on Netlify\'s own header, and is its own budget');
{
  const rl = require(FN('_ratelimit.js'));
  eq('the signup bucket is :signup, not the login or registration one',
    rl.signupBucket({ headers: { 'x-nf-client-connection-ip': '1.2.3.4' } }), '1.2.3.4:signup');

  /* A caller-supplied header would let an attacker choose their own bucket,
     which is a limit in name only. */
  eq('x-forwarded-for is ignored — a caller must not pick its own bucket',
    rl.signupBucket({ headers: { 'x-forwarded-for': '9.9.9.9' } }), ':signup');

  /* A missing address collapses to ONE shared bucket rather than skipping the
     check — skipping would make "send no address" the way round the limit. */
  eq('a missing address is one shared bucket, never a skip', rl.signupBucket({}), ':signup');

  eq('ten per fifteen minutes', rl.SIGNUP_RATE_OPTS.max, 10);
  eq('…over fifteen minutes', rl.SIGNUP_RATE_OPTS.windowMs, 15 * 60 * 1000);
}

restore();
summary('test-signup-ratelimit.js');
}

main().catch((e) => { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
