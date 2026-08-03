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
const { signInMethodOf } = require(FN('_auth.js'));

section('signInMethodOf() — ONE copy, and it can say Both');
{
  /* ⚠️ DRIVEN, not grepped. accounts-admin.js's listing used to derive this
     field for itself as `googleSub ? 'Google' : 'Password'`, which cannot ever
     return 'Both' — so a password login with Google linked was reported as
     "Google only" by the very listing the account card reads in other-person
     mode. Harmless while nothing displayed it; the card displays it as one of
     five facts about a person, and linking made 'Both' an ordinary state. Both
     files now call this one function. */
  eq('a password-only account', signInMethodOf({ passwordHash: 'h' }), 'Password');
  eq('a Google-only account', signInMethodOf({ googleSub: 'g' }), 'Google');
  eq('BOTH, once a password login has Google linked',
    signInMethodOf({ passwordHash: 'h', googleSub: 'g' }), 'Both');
  eq('a missing account does not throw', signInMethodOf(null), 'Password');
  eq('…nor an empty one', signInMethodOf({}), 'Password');
}


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

/* ======================================================================
   THE CARD ITSELF, on both pages.

   The endpoint above is only half of it. These sections DRIVE the two real
   components — a source grep cannot see that Link Google is hidden in
   other-person mode, only that a string is present somewhere. */

class DCLogic {
  setState(patch, cb) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    if (typeof cb === 'function') cb();
  }
}

function buildPage(file) {
  const { readRepo } = require('./_lib');
  const t = readRepo(file);
  const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no x-dc script in ' + file);
  // eslint-disable-next-line no-new-func
  const C = new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
    DCLogic,
    { addEventListener() {}, google: undefined },
    { addEventListener() {}, body: { style: {} }, baseURI: 'https://adhjrt.com/', getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } }
  );
  const c = new C();
  c.props = {};
  return c;
}

/* A fake account layer that RECORDS its calls. Discriminating on purpose:
   changeMyPassword refuses unless it is given exactly the two arguments the
   card should send, so a card that sent a username as well, or dropped the
   current password, fails instead of quietly passing. */
function accountApi(overrides) {
  const calls = [];
  const api = Object.assign({
    calls,
    myAccount: async () => { calls.push(['myAccount', ...arguments]); return { ok: true, account: { name: 'Pat Tester', username: 'pat', role: 'manager', ageGroupId: 'u14b', approved: true, createdAt: '2026-07-02T00:00:00.000Z', signInMethod: 'Password' } }; },
    changeMyPassword: async (...a) => { calls.push(['changeMyPassword', ...a]); return { ok: true }; },
    linkGoogle: async (...a) => { calls.push(['linkGoogle', ...a]); return { ok: true, account: { name: 'Pat Tester', username: 'pat', role: 'manager', ageGroupId: 'u14b', approved: true, createdAt: '2026-07-02T00:00:00.000Z', signInMethod: 'Both' } }; },
    googleClientId: async () => 'client-id.apps.googleusercontent.com',
    resetAccountPassword: async (...a) => { calls.push(['resetAccountPassword', ...a]); return { ok: true }; },
    approveAccount: async (...a) => { calls.push(['approveAccount', ...a]); return { ok: true }; },
    rejectAccount: async (...a) => { calls.push(['rejectAccount', ...a]); return { ok: true }; },
    revokeAccount: async (...a) => { calls.push(['revokeAccount', ...a]); return { ok: true }; },
    listAccounts: async () => ({ ok: true, accounts: [] }),
    /* renderVals() on both pages touches a lot of the data layer that has
       nothing to do with this card. These are the no-op stand-ins that let it
       run; none of them is what any assertion here is about. */
    canPublishNow: () => false,
    isOrganiserSession: (x) => !!(x && x.isOrganizer),
    canScoreAgeGroup: () => true,
    teamLabel: (code) => code,
    minutesToDisplay: (m) => String(m),
    minutesToTimeInput: (m) => String(m),
    pitchesForAgeGroup: () => [],
    scoringRules: () => ({}),
    registrationCopy: () => ({}),
    venueDays: () => [],
  }, overrides || {});
  return api;
}

/* ====================================================================== */
section('/manager — the card, on a page that had no account UI at all');
{
  const c = buildPage('Manager.dc.html');
  const api = accountApi();
  c.state = { ...c.state, api, ageGroups: [{ id: 'u14b', name: 'U14B Contact' }] };
  await c.openAccount();

  const v = c.renderVals();
  check('opening it fetches your own account', v.acctOpen === true && v.acctLoaded === true);
  eq('the name and username are shown', [v.acctName, v.acctUsername], ['Pat Tester', 'pat']);
  /* The id is not what anybody calls it. */
  eq('the role reads in words, with the age group NAME not its id',
    v.acctRoleLabel, 'Age-group manager · U14B Contact');
  eq('the sign-in method is in words too', v.acctSignInMethod, 'Password only');
  check('member since is a real date, not "Invalid Date"', /2026/.test(v.acctMemberSince));
  check('nothing is still shown as loading once it has arrived', v.acctLoading === false);
}
{
  /* Loading and failed must not render the same — the design audit went
     through the whole site removing exactly this. */
  const c = buildPage('Manager.dc.html');
  c.state = { ...c.state, api: accountApi({ myAccount: async () => ({ ok: false, error: 'Not signed in.' }) }) };
  const before = (() => { c.setState({ acctOpen: true, acct: undefined }); return c.renderVals(); })();
  check('while the fetch is in flight the card says loading', before.acctLoading === true && before.acctLoaded === false);
  await c.openAccount();
  const after = c.renderVals();
  check('once it has failed it says so instead of loading forever',
    after.acctLoading === false && after.acctLoaded === false && after.acctLoadError === 'Not signed in.');
}
{
  const c = buildPage('Manager.dc.html');
  const api = accountApi();
  c.state = { ...c.state, api, ageGroups: [] };
  await c.openAccount();
  c.setState({ acctCurrent: 'old-password-1', acctNew: 'new-password-1' });
  await c.doChangeMyPassword();
  const call = api.calls.find((x) => x[0] === 'changeMyPassword');
  eq('changing your password sends the current one and the new one', call.slice(1), ['old-password-1', 'new-password-1']);
  /* ⚠️ The whole security property of the endpoint. */
  eq('…and NOTHING else — no username rides along', call.length, 3);
  check('a success message is shown and the fields are cleared',
    c.state.acctSuccess === 'Password changed.' && c.state.acctCurrent === '' && c.state.acctNew === '');
}
{
  const c = buildPage('Manager.dc.html');
  const api = accountApi();
  c.state = { ...c.state, api, ageGroups: [] };
  await c.openAccount();
  c.setState({ acctCurrent: 'old-password-1', acctNew: 'short' });
  await c.doChangeMyPassword();
  check('a too-short new password is refused before anything is sent',
    !api.calls.some((x) => x[0] === 'changeMyPassword') && /at least/.test(c.state.acctError));
  c.setState({ acctCurrent: '', acctNew: 'new-password-1', acctError: '' });
  await c.doChangeMyPassword();
  check('…and so is a missing current password',
    !api.calls.some((x) => x[0] === 'changeMyPassword') && /current password/i.test(c.state.acctError));
}
{
  const c = buildPage('Manager.dc.html');
  const api = accountApi();
  c.state = { ...c.state, api, ageGroups: [] };
  await c.openAccount();
  c.setState({ acctGoogleClientId: 'cid' });
  check('Link Google is offered to a password-only account', c.renderVals().acctCanLinkGoogle === true);
  await c.onAccountGoogleCredential({ credential: 'google-id-token' });
  const call = api.calls.find((x) => x[0] === 'linkGoogle');
  eq('the credential is passed straight to linkGoogle', call.slice(1), ['google-id-token']);
  check('…and the card now says both methods work',
    c.renderVals().acctSignInMethod === 'Password and Google');
  /* The server REFUSES to replace an identity, so the button would only ever
     produce an error once one is attached. */
  check('Link Google disappears once it is linked', c.renderVals().acctCanLinkGoogle === false);
}
{
  /* GOOGLE_CLIENT_ID not set in Netlify — googleClientId() answers null, the
     same signal /signin uses to decide Google sign-in exists at all. */
  const c = buildPage('Manager.dc.html');
  c.state = { ...c.state, api: accountApi({ googleClientId: async () => null }), ageGroups: [] };
  await c.openAccount();
  check('with no Google client id configured, no link button is offered',
    c.renderVals().acctCanLinkGoogle === false,
    'the same clientId===null rule /signin uses to decide Google exists at all');
  check('…and the rest of the card still works — linking is an enhancement only',
    c.renderVals().acctLoaded === true && c.renderVals().acctUsername === 'pat');
}

/* ====================================================================== */
section('/organizer — the same card, and the line between the two modes');
{
  const c = buildPage('Organizer.dc.html');
  const api = accountApi();
  c.state = { ...c.state, api, accounts: [] };
  await c.openMyAccount();
  c.setState({ acctGoogleClientId: 'cid' });
  const v = c.renderVals();
  check('your own account opens in "me" mode', v.acctIsMe === true && v.acctIsOther === false);
  eq('…titled as yours', v.acctHeading, 'My account');
  check('…with Link Google offered', v.acctCanLinkGoogle === true);
}
{
  const c = buildPage('Organizer.dc.html');
  const api = accountApi();
  /* Deliberately a password-only, approved account with the client id present
     — every OTHER condition for the link button is satisfied, so the only
     thing that can be suppressing it is the mode. */
  c.state = { ...c.state, api, accounts: [
    { username: 'mgr', name: 'Mgr Person', role: 'manager', ageGroupId: 'u14b', approved: true, createdAt: '2026-07-02T00:00:00.000Z', signInMethod: 'Password' },
  ], acctGoogleClientId: 'cid' };
  c.openOtherAccount('mgr');
  const v = c.renderVals();
  check('a row opens that person in other-person mode', v.acctIsOther === true && v.acctIsMe === false);
  eq('…titled neutrally, not "My account"', v.acctHeading, 'Account');
  eq('…showing their details', [v.acctName, v.acctUsername], ['Mgr Person', 'mgr']);
  eq('…with their role in words', v.acctRoleLabel, 'Age-group manager · U14B Contact');

  /* ⚠️ THE ONE THAT MATTERS. An organiser attaching a Google identity to
     somebody else's login would be attaching their OWN — exactly the takeover
     google-auth.js's googleSub-only lookup exists to prevent. Every other
     condition for the button is true here, so this can only be failing on the
     mode itself. */
  check('LINK GOOGLE IS ABSENT from somebody else’s account', v.acctCanLinkGoogle === false);
}
{
  /* Defence in depth: even if the button were somehow rendered, the handler
     refuses. Two guards, and this one is provable on its own because the
     view-model guard is bypassed by calling the handler directly. */
  const c = buildPage('Organizer.dc.html');
  const api = accountApi();
  c.state = { ...c.state, api, accounts: [
    { username: 'mgr', name: 'Mgr Person', role: 'manager', ageGroupId: 'u14b', approved: true, signInMethod: 'Password' },
  ] };
  c.openOtherAccount('mgr');
  await c.onAccountGoogleCredential({ credential: 'google-id-token' });
  check('…and the credential handler refuses outright in that mode',
    !api.calls.some((x) => x[0] === 'linkGoogle'));
}
{
  const c = buildPage('Organizer.dc.html');
  const api = accountApi();
  c.state = { ...c.state, api, accounts: [
    { username: 'mgr', name: 'Mgr Person', role: 'manager', ageGroupId: 'u14b', approved: true, signInMethod: 'Password' },
    { username: 'newbie', name: 'New Person', role: 'manager', ageGroupId: 'u9', approved: false, signInMethod: 'Password' },
  ], acctGoogleClientId: 'cid' };

  c.openOtherAccount('newbie');
  let v = c.renderVals();
  check('a pending account is flagged as awaiting approval', v.acctIsPending === true && v.acctIsApproved === false);
  v.onAcctApprove();
  eq('Approve acts on THAT person', api.calls.find((x) => x[0] === 'approveAccount').slice(1), ['newbie']);

  c.openOtherAccount('mgr');
  v = c.renderVals();
  check('an approved account offers Revoke instead', v.acctIsApproved === true && v.acctIsPending === false);
  v.onAcctRevoke();
  eq('Revoke acts on THAT person too', api.calls.find((x) => x[0] === 'revokeAccount').slice(1), ['mgr']);
}
{
  const c = buildPage('Organizer.dc.html');
  c.state = { ...c.state, api: accountApi(), accounts: [] };
  c.openOtherAccount('ghost');
  check('a username no longer in the list says so rather than rendering blanks',
    c.renderVals().acctLoaded === false && /no longer/.test(c.renderVals().acctLoadError));
}

/* ====================================================================== */
section('The two copies of the card cannot drift on WHAT they call');
{
  const { readRepo } = require('./_lib');
  const org = readRepo('Organizer.dc.html');
  const mgr = readRepo('Manager.dc.html');
  const strip = (t) => t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const o = strip(org), m = strip(mgr);

  /* There is no build step and no shared component system, so the card's
     MARKUP is a second copy by design. Its DATA LAYER is not: both pages call
     the same three functions out of scores-data.js. */
  for (const fn of ['myAccount', 'changeMyPassword', 'linkGoogle']) {
    check(`/organizer calls api.${fn}`, new RegExp('\\.' + fn + '\\(').test(o));
    check(`/manager calls api.${fn}`, new RegExp('\\.' + fn + '\\(').test(m));
  }
  check('organizer-data.js re-exports them rather than reimplementing',
    /export \{ myAccount, changeMyPassword, linkGoogle \} from '\.\/scores-data\.js';/.test(readRepo('organizer-data.js')));
  check('…and the Google client id the link button needs, which it did not before',
    /export \{ googleClientId \} from '\.\/scores-data\.js';/.test(readRepo('organizer-data.js')));

  /* ⚠️ accounts-admin.js is organiser-only and stays that way. The card now
     living on /manager is exactly the change that might tempt someone to
     relax it, so /manager is asserted to reach NONE of those actions. */
  for (const fn of ['resetAccountPassword', 'approveAccount', 'rejectAccount', 'revokeAccount', 'listAccounts']) {
    check(`/manager never calls api.${fn} — those are organiser powers`,
      !new RegExp('\\.' + fn + '\\(').test(m));
  }
  check('/organizer does have them', /\.resetAccountPassword\(/.test(o) && /\.revokeAccount\(/.test(o));

  /* The header dropdown that only changed a password is gone from /organizer,
     replaced by the card — checked on the code, not the comments explaining it. */
  check('the old change-password dropdown is gone from /organizer',
    !/showChangePwd/.test(o) && !/onToggleChangePwd/.test(o));
  check('…and both pages open the card from their header',
    /onOpenMyAccount/.test(o) && /onOpenAccount/.test(m));
}

restore();
summary('test-my-account.js');
}

main().catch((e) => { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
