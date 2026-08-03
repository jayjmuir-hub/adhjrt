/* tests/test-my-account.js
   ------------------------------------------------------------------------
   netlify/functions/my-account.js — self-service for the account you are
   SIGNED IN AS, both roles. Design: claude/specs/spec-my-account.md

   DRIVEN, not read. Every check below runs the real handler against an
   in-memory accounts store with a bcrypt stub that actually discriminates and
   a Google verifier that accepts exactly one token per identity. A text check
   would pass on a guard whose answer is never used; the things that must be
   true here — a manager can do all of this, a body cannot name someone else's
   account, a Google identity cannot end up on two logins — are only knowable
   by running it and then looking at what was STORED.

   THE FOUR THAT EARN THEIR KEEP:

   1. A MANAGER can use every action. The whole point of the endpoint existing
      separately from accounts-admin.js, whose door is organiser-only. A role
      check creeping in here would silently re-break it and look like tidying.
   2. The account acted on comes from the TOKEN. A body naming another user
      must change nothing on that other user.
   3. A Google identity already on another account is refused, AND the other
      account is left untouched — google-auth.js resolves sign-in with find(),
      so a duplicate silently sends one person into the other's login.
   4. Linking over an existing identity is refused rather than replacing it,
      because replacing survives the real owner changing their password.

   ⚠️ Nothing here is a real credential. Hashes are the literal strings
   'hash-<name>', the Google subs are 'sub-<name>', and the stub bcrypt says
   yes only when the password is 'pw-<name>'.
*/

const path = require('path');
const Module = require('module');
const { section, check, eq, summary } = require('./_lib');

const FN = (f) => path.join(require('./_lib').repoRoot(), 'netlify', 'functions', f);

/* ------------------------------------------------------------------ */

const SEED = () => ([
  { username: 'orga', role: 'organizer', title: 'Registrar', name: 'Orga Person', passwordHash: 'hash-orga', approved: true, createdAt: '2026-07-01T00:00:00.000Z' },
  { username: 'mgr', role: 'manager', ageGroupId: 'u14b', name: 'Mgr Person', passwordHash: 'hash-mgr', approved: true, createdAt: '2026-07-02T00:00:00.000Z' },
  { username: 'goog', role: 'manager', ageGroupId: 'u9', name: 'Google Person', passwordHash: null, approved: true, googleSub: 'sub-goog', email: 'g@example.com', createdAt: '2026-07-03T00:00:00.000Z' },
]);

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
      /* Discriminating on purpose. A stub that always says yes would pass a
         handler that never checks the current password at all. */
      compare: async (pw, hash) => !!hash && hash === 'hash-' + String(pw).replace(/^pw-/, ''),
      compareSync: (pw, hash) => !!hash && hash === 'hash-' + String(pw).replace(/^pw-/, ''),
      hash: async (pw) => 'hash-NEW-' + pw,
      hashSync: (pw) => 'hash-NEW-' + pw,
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
    /* Accepts 'tok-<x>' as identity 'sub-<x>' and refuses anything else, so a
       fault deleting the real verification cannot pass unnoticed. */
    if (/_googleAuth(\.js)?$/.test(String(request))) {
      return {
        verifyGoogleIdToken: async (t) => {
          const m = /^tok-(.+)$/.exec(String(t || ''));
          return m ? { sub: 'sub-' + m[1], name: m[1], email: m[1] + '@example.com' } : null;
        },
      };
    }
    return realLoad.call(this, request, ...rest);
  };
  return () => { Module._resolveFilename = realResolve; Module._load = realLoad; };
}

const restore = installStubs();
if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = 'test-not-a-real-secret';

const { handler } = require(FN('my-account.js'));
const { sign } = require(FN('_auth.js'));

const TOKENS = {
  orga: sign({ username: 'orga', role: 'organizer' }),
  mgr: sign({ username: 'mgr', role: 'manager', ageGroupId: 'u14b' }),
  goog: sign({ username: 'goog', role: 'manager', ageGroupId: 'u9' }),
  ghost: sign({ username: 'ghost', role: 'manager', ageGroupId: 'u9' }),
};

function reset() { blobData.set('accounts/list', SEED()); }
const stored = (u) => (blobData.get('accounts/list') || []).find((a) => a.username === u);

const call = (token, method, body) => handler({
  httpMethod: method,
  headers: token ? { authorization: 'Bearer ' + token } : {},
  body: body === undefined ? undefined : JSON.stringify(body),
});
const parse = (res) => ({ status: res.statusCode, ...(JSON.parse(res.body || '{}')) });

async function main() {

/* ====================================================================== */
section('GET returns your own account, and never a secret');
{
  reset();
  const r = parse(await call(TOKENS.mgr, 'GET'));
  eq('a MANAGER can read their own account', r.status, 200);
  eq('…and it is theirs, taken from the token', r.account.username, 'mgr');
  eq('…with the age group', r.account.ageGroupId, 'u14b');
  eq('…and the sign-in method', r.account.signInMethod, 'Password');

  const body = JSON.stringify(r);
  check('the response carries NO passwordHash', !/passwordHash/.test(body), body.slice(0, 200));
  check('…and NO googleSub — an internal Google id the caller has no use for',
    !/googleSub/.test(body) && !/sub-/.test(body), body.slice(0, 200));

  const o = parse(await call(TOKENS.orga, 'GET'));
  eq('an organiser reads their own too', o.account.username, 'orga');
  eq('…with their title', o.account.title, 'Registrar');

  const g = parse(await call(TOKENS.goog, 'GET'));
  eq('a Google-created account reports Google', g.account.signInMethod, 'Google');

  eq('signed out is refused', parse(await call(null, 'GET')).status, 401);
  eq('a token for an account that no longer exists is a 404, not a 500',
    parse(await call(TOKENS.ghost, 'GET')).status, 404);
}

/* ====================================================================== */
section('Changing your own password — a MANAGER can, and the current one is required');
{
  reset();
  const ok = parse(await call(TOKENS.mgr, 'POST', { action: 'password', currentPassword: 'pw-mgr', password: 'a-long-enough-one' }));
  eq('a manager changes their own password', ok.status, 200);
  eq('…and the stored hash really changed', stored('mgr').passwordHash, 'hash-NEW-a-long-enough-one');
  check('…and it is stamped', !!stored('mgr').passwordChangedAt);

  reset();
  const wrong = parse(await call(TOKENS.mgr, 'POST', { action: 'password', currentPassword: 'pw-nope', password: 'a-long-enough-one' }));
  eq('a WRONG current password is refused', wrong.status, 401);
  eq('…and nothing was written', stored('mgr').passwordHash, 'hash-mgr');

  reset();
  const missing = parse(await call(TOKENS.mgr, 'POST', { action: 'password', password: 'a-long-enough-one' }));
  eq('no current password at all is refused — a session alone must not be enough', missing.status, 400);
  eq('…and nothing was written', stored('mgr').passwordHash, 'hash-mgr');

  reset();
  const short = parse(await call(TOKENS.mgr, 'POST', { action: 'password', currentPassword: 'pw-mgr', password: 'short' }));
  eq('the shared password floor applies — this is a password being SET', short.status, 400);
  eq('…and nothing was written', stored('mgr').passwordHash, 'hash-mgr');

  /* A Google-only account has no hash at all. Foreseeable, so it must answer,
     not throw. */
  reset();
  const noHash = parse(await call(TOKENS.goog, 'POST', { action: 'password', currentPassword: 'anything', password: 'a-long-enough-one' }));
  eq('a Google-only account gets a clean 401, not a 500', noHash.status, 401);

  reset();
  eq('signed out cannot change a password', parse(await call(null, 'POST', { action: 'password', currentPassword: 'pw-mgr', password: 'a-long-enough-one' })).status, 401);
  eq('…and nothing was written', stored('mgr').passwordHash, 'hash-mgr');
}

/* ====================================================================== */
section('Linking Google — the account is the one in the TOKEN, never the body');
{
  reset();
  const r = parse(await call(TOKENS.mgr, 'POST', { action: 'linkGoogle', idToken: 'tok-mgrgoogle' }));
  eq('a MANAGER can link their own Google account', r.status, 200);
  eq('…and it is stored on them', stored('mgr').googleSub, 'sub-mgrgoogle');
  eq('…and the card now says Both', r.account.signInMethod, 'Both');
  check('…the response still leaks no googleSub', !/googleSub|sub-/.test(JSON.stringify(r)));

  /* ⚠️ THE ONE THAT MATTERS MOST. */
  reset();
  const spoof = parse(await call(TOKENS.mgr, 'POST', { action: 'linkGoogle', idToken: 'tok-x', username: 'orga', account: 'orga', role: 'organizer' }));
  eq('a body naming somebody else still succeeds — for the CALLER', spoof.status, 200);
  eq('…the caller got the identity', stored('mgr').googleSub, 'sub-x');
  eq('…and the named account was untouched', stored('orga').googleSub, undefined);

  reset();
  const bad = parse(await call(TOKENS.mgr, 'POST', { action: 'linkGoogle', idToken: 'not-a-real-token' }));
  eq('an unverifiable Google token is refused', bad.status, 401);
  eq('…and nothing was written', stored('mgr').googleSub, undefined);

  reset();
  eq('signed out cannot link', parse(await call(null, 'POST', { action: 'linkGoogle', idToken: 'tok-x' })).status, 401);
  eq('…and nothing was written', stored('mgr').googleSub, undefined);
}

/* ====================================================================== */
section('One Google identity, one login');
{
  reset();
  const taken = parse(await call(TOKENS.mgr, 'POST', { action: 'linkGoogle', idToken: 'tok-goog' }));
  eq('an identity already on another account is refused', taken.status, 409);
  eq('…the caller did not get it', stored('mgr').googleSub, undefined);
  eq('…AND the other account still has it', stored('goog').googleSub, 'sub-goog');

  /* Refuse, do not replace: replacing survives the owner changing their
     password, so a stolen session becomes permanent. */
  reset();
  await call(TOKENS.mgr, 'POST', { action: 'linkGoogle', idToken: 'tok-first' });
  const second = parse(await call(TOKENS.mgr, 'POST', { action: 'linkGoogle', idToken: 'tok-second' }));
  eq('linking a DIFFERENT identity over an existing one is refused', second.status, 409);
  eq('…and the original survives', stored('mgr').googleSub, 'sub-first');

  const again = parse(await call(TOKENS.mgr, 'POST', { action: 'linkGoogle', idToken: 'tok-first' }));
  eq('re-linking the SAME identity is a no-op success, so a retry is harmless', again.status, 200);
  eq('…still the same identity', stored('mgr').googleSub, 'sub-first');
}

/* ====================================================================== */
section('And google-auth.js then actually signs that person in');
{
  /* Asserting the stored field proves the write, not the outcome. This drives
     the REAL google-auth handler afterwards, which is the thing the whole
     feature exists for. */
  reset();
  await call(TOKENS.mgr, 'POST', { action: 'linkGoogle', idToken: 'tok-newlink' });

  const googleAuth = require(FN('google-auth.js')).handler;
  const res = parse(await googleAuth({
    httpMethod: 'POST',
    headers: { 'x-nf-client-connection-ip': '198.51.100.77' },
    body: JSON.stringify({ idToken: 'tok-newlink' }),
  }));
  eq('signing in with the newly linked Google account works', res.status, 200);
  eq('…and it is the right person', res.session && res.session.username, 'mgr');
  eq('…with their age group intact', res.session && res.session.ageGroupId, 'u14b');
  check('…and it did NOT ask them to sign up', !res.needsSignup, JSON.stringify(res));
}

/* ====================================================================== */
section('Unknown actions and wrong methods');
{
  reset();
  eq('an unknown action is refused', parse(await call(TOKENS.mgr, 'POST', { action: 'delete-everything' })).status, 400);
  eq('an action-less POST is refused', parse(await call(TOKENS.mgr, 'POST', {})).status, 400);
  eq('DELETE is not served', (await call(TOKENS.mgr, 'DELETE')).statusCode, 405);
}

/* ====================================================================== */
section('accounts-admin.js stays organiser-only — the other-people actions are not self-service');
{
  const { readRepo } = require('./_lib');
  const admin = readRepo(path.join('netlify', 'functions', 'accounts-admin.js'));
  check('its door is still requireOrganizer',
    /const session = requireOrganizer\(event\);/.test(admin),
    'a My account card on /manager is exactly what would tempt someone to relax this');
  check('…and requireOrganizer still checks the role',
    /session && session\.role === 'organizer' \? session : null/.test(admin));
  check('the account listing still strips passwordHash AND googleSub',
    /accounts\.map\(\(\{ passwordHash, googleSub, \.\.\.rest \}\)/.test(admin),
    'the card is now what renders this listing');

  /* changeMine moved here with its subject — two ways to change your own
     password is two rules that drift. */
  check('changeMine is gone from accounts-admin.js — it lives here now',
    !/changeMine/.test(admin.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')),
    'absence checked on the CODE, not the comments');
}

restore();
summary('test-my-account.js');
}

main().catch((e) => { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
