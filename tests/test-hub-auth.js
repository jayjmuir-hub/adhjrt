/* tests/test-hub-auth.js
   ------------------------------------------------------------------------
   "Sign in with Quins Club Hub" — netlify/functions/hub-auth.js and the
   verifier in _hubAuth.js, plus the accounts-admin `approve` change that
   gives a hub account its role. Spec: claude/specs/spec-club-hub-sign-in-sep-2026.md

   DRIVEN, NOT GREPPED. Tokens are signed here with a THROWAWAY P-256 key
   generated on every run, and the club hub's JWKS is served from a stub, so
   nothing here touches the network or any real key. The control is a token
   signed by the test key verifying; every fault below is a one-line change
   that must turn that green into red.

   ⚠️ THE JWKS STUB MUST SERVE THE TEST KEY UNDER THE TOKEN'S kid. Serve it
   under any other kid and every check about a valid token passes for the
   wrong reason (unknown key), including the ones that are supposed to prove
   the SIGNATURE is checked.

   ⚠️ Every value here is invented. */

const crypto = require('crypto');
const path = require('path');
const Module = require('module');
const { readRepo, repoRoot, section, check, eq, summary } = require('./_lib');

/* ---- throwaway keys ------------------------------------------------------ */
const GOOD = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const OTHER = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const KID = 'test-kid-not-real-1';
const ISSUER = 'https://lusmshimxdcxpnrktlgz.supabase.co/auth/v1';

let jwksKeys = [{ ...GOOD.publicKey.export({ format: 'jwk' }), kid: KID, alg: 'ES256', use: 'sig' }];
let jwksFetches = 0;
global.fetch = async (url) => {
  jwksFetches += 1;
  if (!String(url).includes('/.well-known/jwks.json')) return { ok: false, status: 404 };
  return { ok: true, status: 200, json: async () => ({ keys: jwksKeys }) };
};

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const NOW = Date.now();
function mint(claims = {}, { key = GOOD.privateKey, kid = KID, alg = 'ES256' } = {}) {
  const header = b64u({ alg, kid, typ: 'JWT' });
  const payload = b64u({
    iss: ISSUER, aud: 'authenticated', role: 'authenticated',
    exp: Math.floor(NOW / 1000) + 3600, iat: Math.floor(NOW / 1000),
    sub: 'hub-sub-not-real-1', email: 'Nobody.Real@example.com',
    user_metadata: { full_name: 'Nobody Real', email_verified: true },
    ...claims,
  });
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${header}.${payload}.${sig}`;
}

/* ---- stubs -------------------------------------------------------------- */
let accountsList = [];
let saved = null;
let signInsRecorded = [];
let configStore = null;
function makeStore() {
  const data = new Map();
  return {
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
          async setJSON(key, value) { if (key === 'list') { saved = value; accountsList = value; } },
          async delete() {}, async list() { return { blobs: [] }; },
        };
      }
      if (name === 'config') return configStore;
      if (name === 'signins') {
        return { async get() { return null; }, async setJSON(key) { signInsRecorded.push(key); }, async delete() {}, async list() { return { blobs: [] }; } };
      }
      return { async get() { return null; }, async setJSON() {}, async delete() {}, async list() { return { blobs: [] }; } };
    },
  },
  bcryptjs: {
    hashSync: (p) => `hashed:${p}`, compareSync: (p, h) => h === `hashed:${p}`,
    hash: async (p) => `hashed:${p}`, compare: async (p, h) => h === `hashed:${p}`,
  },
};
const realResolve = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) {
  return Object.prototype.hasOwnProperty.call(stubs, r) ? 'STUB:' + r : realResolve.call(this, r, ...rest);
};
const realLoad = Module._load;
Module._load = function (r, ...rest) {
  return Object.prototype.hasOwnProperty.call(stubs, r) ? stubs[r] : realLoad.call(this, r, ...rest);
};
process.env.SESSION_SECRET = 'test-not-a-real-value';

const FN = path.join(repoRoot(), 'netlify', 'functions');
const hubAuth = require(path.join(FN, '_hubAuth.js'));
const { handler } = require(path.join(FN, 'hub-auth.js'));
const admin = require(path.join(FN, 'accounts-admin.js'));
const { verify, sign, signInMethodOf } = require(path.join(FN, '_auth.js'));

const reset = () => {
  accountsList = []; saved = null; signInsRecorded = []; configStore = makeStore();
  jwksKeys = [{ ...GOOD.publicKey.export({ format: 'jwk' }), kid: KID, alg: 'ES256', use: 'sig' }];
  jwksFetches = 0;
  hubAuth._resetCacheForTests();
};
const post = (body, ip = '203.0.113.9') => handler({ httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': ip }, body: JSON.stringify(body) });
const parse = async (res) => ({ status: res.statusCode, ...JSON.parse(res.body || '{}') });
const v = (token, opts) => hubAuth.verifyHubToken(token, { now: NOW, ...opts });

(async () => {
  /* ==================================================================== */
  section('⚠️ The verifier refuses what it should — driven with real signatures');
  {
    reset();
    const good = await v(mint());
    check('control: a token signed by the club hub key verifies', good.ok === true, JSON.stringify(good));
    eq('…and yields the sub', good.payload && good.payload.sub, 'hub-sub-not-real-1');
    eq('…and the email, lower-cased', good.payload && good.payload.email, 'nobody.real@example.com');
    eq('…and the display name', good.payload && good.payload.name, 'Nobody Real');

    const other = await v(mint({}, { key: OTHER.privateKey }));
    eq('⚠️ a token signed by a DIFFERENT key is refused', other.ok, false);
    eq('…for its signature', other.reason, 'signature');

    const tampered = (() => { const [h, p, s] = mint().split('.'); return `${h}.${b64u({ ...JSON.parse(Buffer.from(p, 'base64url')), sub: 'someone-else' })}.${s}`; })();
    eq('⚠️ a token whose payload was edited after signing is refused', (await v(tampered)).reason, 'signature');

    eq('wrong issuer is refused', (await v(mint({ iss: 'https://nnlfjbnoiyqcvxwbwsjf.supabase.co/auth/v1' }))).reason, 'issuer');
    eq('wrong audience is refused', (await v(mint({ aud: 'anon' }))).reason, 'audience');
    eq('an array audience that includes authenticated is accepted', (await v(mint({ aud: ['authenticated', 'x'] }))).ok, true);
    eq('an expired token is refused', (await v(mint({ exp: Math.floor(NOW / 1000) - 1 }))).reason, 'expired');
    eq('a token with no exp is refused', (await v(mint({ exp: undefined }))).reason, 'expired');
    eq('an anonymous session is refused', (await v(mint({ is_anonymous: true }))).reason, 'anonymous');
    eq('a service_role token is refused', (await v(mint({ role: 'service_role' }))).reason, 'role');
    eq('no email is refused', (await v(mint({ email: '' }))).reason, 'no-email');
    eq('an explicitly unconfirmed email is refused', (await v(mint({ user_metadata: { email_verified: false } }))).reason, 'unconfirmed');
    eq('a non-ES256 header is refused', (await v(mint({}, { alg: 'HS256' }))).reason, 'alg');
    eq('garbage is refused, not thrown', (await v('not.a.token')).ok, false);
    eq('nothing is refused, not thrown', (await v(undefined)).ok, false);
  }

  /* ==================================================================== */
  section('⚠️ Key rotation: an unknown kid refetches the JWKS exactly once');
  {
    reset();
    await v(mint());
    eq('the first verify fetched the JWKS once', jwksFetches, 1);
    await v(mint());
    eq('a second verify with a known kid did not refetch', jwksFetches, 1);
    const unknown = await v(mint({}, { kid: 'rotated-kid-not-real' }));
    eq('an unknown kid is refused', unknown.reason, 'unknown-key');
    eq('…after exactly one refetch', jwksFetches, 2);
    /* Now the hub really has rotated: serve the new kid and the next verify passes. */
    jwksKeys = [{ ...GOOD.publicKey.export({ format: 'jwk' }), kid: 'rotated-kid-not-real', alg: 'ES256', use: 'sig' }];
    eq('once the JWKS carries the new kid, the token verifies', (await v(mint({}, { kid: 'rotated-kid-not-real' }))).ok, true);
  }

  /* ==================================================================== */
  section('⚠️ The door: hub-auth.js');
  {
    reset();
    let r = await parse(await post({ hubToken: mint({}, { key: OTHER.privateKey }) }));
    eq('a token the verifier refuses is 401', r.status, 401);
    check('…with one sentence that names no reason', /could not be verified/.test(r.error) && !/signature|issuer|expired/i.test(r.error), r.error);
    eq('…and no account was created', saved, null);

    reset();
    r = await parse(await post({ hubToken: mint() }));
    eq('first sign-in through the hub is 403 pending', r.status, 403);
    eq('…flagged pending', r.pending, true);
    check('…and a pending account was created', Array.isArray(saved) && saved.length === 1, JSON.stringify(saved));
    const a = (saved || [])[0] || {};
    eq('…keyed by hubSub', a.hubSub, 'hub-sub-not-real-1');
    eq('…with role null', a.role, null);
    eq('…not approved', a.approved, false);
    eq('…source hub', a.source, 'hub');
    eq('…email stored lower-cased', a.email, 'nobody.real@example.com');
    eq('…username from the email local part', a.username, 'nobody.real');
    check('…no passwordHash', !('passwordHash' in a));
    eq('…and no sign-in was recorded for a pending account', signInsRecorded.length, 0);

    r = await parse(await post({ hubToken: mint() }));
    eq('a second sign-in while pending is still 403', r.status, 403);
    eq('…and did not create a duplicate', accountsList.length, 1);

    /* Approve with a role, then sign in for real. */
    accountsList[0].approved = true; accountsList[0].role = 'manager'; accountsList[0].ageGroupId = 'u16b';
    r = await parse(await post({ hubToken: mint() }));
    eq('an approved hub account gets a session', r.status, 200);
    eq('…shaped like login.js\'s manager session', JSON.stringify(r.session), JSON.stringify({ username: 'nobody.real', name: 'Nobody Real', ageGroupId: 'u16b' }));
    const payload = verify(r.token);
    eq('…with a token signed by the tournament site carrying the role', payload && payload.role, 'manager');
    eq('…and the age group', payload && payload.ageGroupId, 'u16b');
    eq('…and a sign-in was recorded', signInsRecorded.length, 1);

    /* Approved but somehow still roleless — belt and braces. */
    accountsList[0].role = null;
    r = await parse(await post({ hubToken: mint() }));
    eq('approved with no role is still pending, never a session', r.status, 403);
  }

  /* ==================================================================== */
  section('⚠️ Matching is on hubSub, never on email');
  {
    reset();
    accountsList = [{ username: 'jane', name: 'Jane', role: 'manager', ageGroupId: 'u14b', approved: true, email: 'nobody.real@example.com', passwordHash: 'hashed:x' }];
    const r = await parse(await post({ hubToken: mint() }));
    eq('⚠️ a matching EMAIL on a password account does not sign in', r.status, 403);
    eq('…it creates a separate pending hub account', accountsList.length, 2);
    /* `|| {}` so a fault that stops the account being created fails THIS
       check rather than throwing and taking every later check with it. */
    eq('…with a de-duplicated username', (accountsList[1] || {}).username, 'nobody.real');
    check('…and the password account is untouched', !accountsList[0].hubSub);

    reset();
    accountsList = [{ username: 'nobody.real', name: 'x', role: 'organizer', approved: true, passwordHash: 'hashed:x' }];
    await post({ hubToken: mint() });
    eq('a taken username gets a numeric suffix', (accountsList[1] || {}).username, 'nobody.real2');
  }

  /* ==================================================================== */
  section('⚠️ Only failures count, against the connection bucket, 50 per window');
  {
    reset();
    for (let i = 0; i < 60; i += 1) await post({ hubToken: mint() });
    eq('sixty CORRECT sign-ins from one address all get through', (await parse(await post({ hubToken: mint() }))).status, 403);
    reset();
    for (let i = 0; i < 50; i += 1) await post({ hubToken: 'junk' });
    eq('fifty failures then a good token is refused (429)', (await parse(await post({ hubToken: mint() }))).status, 429);
    eq('…but a different address is unaffected', (await parse(await post({ hubToken: mint() }, '198.51.100.7'))).status, 403);
  }

  /* ==================================================================== */
  section('⚠️ accounts-admin approve gives a hub account its role');
  {
    const orgToken = sign({ username: 'orga', role: 'organizer' });
    const call = (body) => admin.handler({ httpMethod: 'POST', headers: { authorization: `Bearer ${orgToken}` }, body: JSON.stringify(body) });
    const fresh = () => {
      reset();
      accountsList = [
        { username: 'orga', name: 'Orga', role: 'organizer', approved: true, passwordHash: 'hashed:x' },
        { username: 'nobody.real', name: 'Nobody Real', role: null, approved: false, source: 'hub', hubSub: 'hub-sub-not-real-1', email: 'nobody.real@example.com' },
        { username: 'old.mgr', name: 'Old', role: 'manager', ageGroupId: 'u12', approved: false, passwordHash: 'hashed:x' },
      ];
    };

    fresh();
    let r = await parse(await call({ action: 'approve', username: 'nobody.real' }));
    eq('approving a roleless account with no role is 400', r.status, 400);
    eq('…and it stays unapproved', accountsList[1].approved, false);

    fresh();
    r = await parse(await call({ action: 'approve', username: 'nobody.real', role: 'manager' }));
    eq('manager with no age group is 400', r.status, 400);
    fresh();
    r = await parse(await call({ action: 'approve', username: 'nobody.real', role: 'manager', ageGroupId: 'u99' }));
    eq('manager with an unknown age group is 400', r.status, 400);
    fresh();
    r = await parse(await call({ action: 'approve', username: 'nobody.real', role: 'referee' }));
    eq('an unknown role is 400', r.status, 400);

    fresh();
    r = await parse(await call({ action: 'approve', username: 'nobody.real', role: 'manager', ageGroupId: 'u16b' }));
    eq('manager + valid age group approves', r.status, 200);
    eq('…role set', accountsList[1].role, 'manager');
    eq('…age group set', accountsList[1].ageGroupId, 'u16b');
    eq('…approved', accountsList[1].approved, true);
    eq('…stamped by whom', accountsList[1].roleGivenBy, 'orga');

    fresh();
    r = await parse(await call({ action: 'approve', username: 'nobody.real', role: 'organizer', title: 'Registrar' }));
    eq('organiser approves with a title', r.status, 200);
    eq('…role organizer', accountsList[1].role, 'organizer');
    eq('…title kept', accountsList[1].title, 'Registrar');

    /* The server side of the same repair: approved + roleless takes a role. */
    fresh();
    accountsList[1].approved = true;
    r = await parse(await call({ action: 'approve', username: 'nobody.real', role: 'organizer' }));
    eq('an already-approved roleless account can still be given a role', r.status, 200);
    eq('…and gets it', accountsList[1].role, 'organizer');

    fresh();
    r = await parse(await call({ action: 'approve', username: 'old.mgr', role: 'organizer' }));
    eq('an invite-code account that already has a role approves as before', r.status, 200);
    eq('⚠️ …and a role in the payload does NOT change it', accountsList[2].role, 'manager');

    /* The listing strips hubSub and reports the method. */
    fresh();
    const list = await parse(await admin.handler({ httpMethod: 'GET', headers: { authorization: `Bearer ${orgToken}` } }));
    const hub = (list.accounts || []).find((x) => x.username === 'nobody.real') || {};
    check('the listing never carries hubSub', !('hubSub' in hub), JSON.stringify(hub));
    eq('…and shows the sign-in method as Club Hub', hub.signInMethod, 'Club Hub');
    eq('…and the email', hub.email, 'nobody.real@example.com');
    eq('signInMethodOf says Club Hub for a hub account', signInMethodOf({ hubSub: 'x' }), 'Club Hub');
  }

  /* ==================================================================== */
  section('Static: the three sessionFor copies agree, and no dependency crept in');
  {
    const grab = (rel) => {
      /* CRLF on a Windows checkout, LF in a sandbox — the comparison is about
         the code, not the line endings. */
      const t = readRepo(rel).replace(/\r\n/g, '\n');
      const m = t.match(/function sessionFor\(account\) \{[\s\S]*?\n\}/);
      return m ? m[0] : '';
    };
    const login = grab('netlify/functions/login.js');
    check('login.js has sessionFor', login.length > 0);
    eq('⚠️ hub-auth.js\'s sessionFor is character-for-character login.js\'s', grab('netlify/functions/hub-auth.js'), login);
    eq('…and so is google-auth.js\'s', grab('netlify/functions/google-auth.js'), login);

    const hubSrc = readRepo('netlify/functions/_hubAuth.js') + readRepo('netlify/functions/hub-auth.js');
    const requires = [...hubSrc.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]);
    check('hub-auth requires only ./_ modules and Node built-ins', requires.every((r) => r.startsWith('./_') || r === 'crypto'), requires.join(', '));
    check('the issuer is pinned to the club hub project', hubSrc.includes("'lusmshimxdcxpnrktlgz'"));
    check('…and does not come from an environment variable', !/process\.env\.\w*(HUB|SUPABASE)/.test(hubSrc));
    check('a failed verification names no reason to the caller', /could not be verified/.test(readRepo('netlify/functions/hub-auth.js')));
  }

  /* ==================================================================== */
  section('⚠️ The Accounts tab: a hub account is approved WITH a role, from the row');
  {
    /* Drives the real /organizer component the way test-my-account.js does. */
    class DCLogic {
      setState(patch, cb) {
        const p = typeof patch === 'function' ? patch(this.state) : patch;
        this.state = { ...this.state, ...p };
        if (typeof cb === 'function') cb();
      }
    }
    const t = readRepo('Organizer.dc.html');
    const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
    check('Organizer.dc.html has its x-dc script', !!m);
    // eslint-disable-next-line no-new-func
    const C = new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
      DCLogic,
      { addEventListener() {}, google: undefined },
      { addEventListener() {}, body: { style: {} }, baseURI: 'https://adhjrt.com/', getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } }
    );
    const calls = [];
    let approveAnswer = { ok: true };
    const api = {
      approveAccount: async (...a) => { calls.push(a); return approveAnswer; },
      rejectAccount: async () => ({ ok: true }), revokeAccount: async () => ({ ok: true }),
      listAccounts: async () => ({ ok: true, accounts: [] }),
      canPublishNow: () => false, isOrganiserSession: (x) => !!(x && x.isOrganizer), canScoreAgeGroup: () => true,
      teamLabel: (c) => c, minutesToDisplay: (v) => String(v), minutesToTimeInput: (v) => String(v),
      pitchesForAgeGroup: () => [], scoringRules: () => ({}), registrationCopy: () => ({}), venueDays: () => [],
    };
    const fresh = () => {
      const c = new C(); c.props = {};
      c.state = { ...c.state, api, tab: 'accounts', accounts: [
        { username: 'hub.person', name: 'Hub Person', role: null, approved: false, source: 'hub', email: 'hub.person@example.com', signInMethod: 'Club Hub', createdAt: '2026-09-01T00:00:00.000Z' },
        { username: 'code.person', name: 'Code Person', role: 'manager', ageGroupId: 'u9', approved: false, signInMethod: 'Password', createdAt: '2026-09-01T00:00:00.000Z' },
      ] };
      calls.length = 0; approveAnswer = { ok: true };
      return c;
    };
    const row = (c, u) => c.renderVals().pendingAccounts.find((a) => a.username === u);

    let c = fresh();
    let hub = row(c, 'hub.person'), code = row(c, 'code.person');
    check('the hub account row offers the role picker', hub && hub.needsRole === true);
    check('…and an invite-code account row does not', code && code.needsRole === false);
    eq('…the hub row names the email, not "Manager · undefined"', hub.roleLabel, 'Club Hub · hub.person@example.com');
    eq('…defaulting to manager', hub.roleChoice, 'manager');
    check('…with the age-group list to choose from', Array.isArray(hub.ageOptions) && hub.ageOptions.some((g) => g.id === 'u16b'));

    await hub.onApprove();
    eq('⚠️ Approve with no age group chosen sends NOTHING to the server', calls.length, 0);
    check('…and says so above the list', /choose an age group/i.test(c.renderVals().acctApproveError), c.renderVals().acctApproveError);

    hub.onAgeChoice({ target: { value: 'u16b' } });
    hub = row(c, 'hub.person') || {}; /* || {} so a fault cannot make this file fall over */
    eq('the age choice is remembered on the row', hub.ageChoice, 'u16b');
    await hub.onApprove();
    eq('Approve then sends role + age group', JSON.stringify(calls[0]), JSON.stringify(['hub.person', { role: 'manager', ageGroupId: 'u16b' }]));
    eq('…and the error clears', c.renderVals().acctApproveError, '');

    c = fresh();
    hub = row(c, 'hub.person') || {}; /* || {} so a fault cannot make this file fall over */
    hub.onRoleChoice({ target: { value: 'organizer' } });
    hub = row(c, 'hub.person') || {}; /* || {} so a fault cannot make this file fall over */
    eq('choosing Organiser hides the age-group picker', hub.roleIsManager, false);
    await hub.onApprove();
    eq('…and Approve sends role organizer with no age group', JSON.stringify(calls[0]), JSON.stringify(['hub.person', { role: 'organizer' }]));

    c = fresh();
    await row(c, 'code.person').onApprove();
    eq('⚠️ an invite-code account is approved exactly as before — username only', JSON.stringify(calls[0]), JSON.stringify(['code.person']));

    c = fresh();
    approveAnswer = { ok: false, error: 'Unknown age group.' };
    row(c, 'hub.person').onAgeChoice({ target: { value: 'u16b' } });
    await row(c, 'hub.person').onApprove();
    eq('a server refusal is shown above the list', c.renderVals().acctApproveError, 'Unknown age group.');

    /* ⚠️ Approved-but-roleless (what the OLD production page did on 8 Sep):
       still listed as pending, with the picker, and never among the approved. */
    c = fresh();
    c.state.accounts.push({ username: 'stuck.person', name: 'Stuck Person', role: null, approved: true, source: 'hub', email: 'stuck@example.com', signInMethod: 'Club Hub', createdAt: '2026-09-08T00:00:00.000Z' });
    const vs = c.renderVals();
    const stuck = vs.pendingAccounts.find((a) => a.username === 'stuck.person') || {};
    check('⚠️ an APPROVED account with no role is listed as pending, with the picker', stuck.needsRole === true, JSON.stringify(vs.pendingAccounts.map((a) => a.username)));
    check('…and not among the approved accounts', !vs.approvedAccounts.some((a) => a.username === 'stuck.person'));
    check('…and the Pending section shows even when it is the only one', (() => { const c2 = fresh(); c2.state.accounts = [{ username: 'stuck.person', name: 'S', role: null, approved: true }]; return c2.renderVals().hasPending === true; })());
    stuck.onAgeChoice({ target: { value: 'u16b' } });
    await (row(c, 'stuck.person') || {}).onApprove();
    eq('…and Approve sends the role for it', JSON.stringify(calls[0]), JSON.stringify(['stuck.person', { role: 'manager', ageGroupId: 'u16b' }]));

    /* The account card hides Approve for a roleless hub account and points at the list. */
    c = fresh();
    c.openOtherAccount('hub.person');
    let v = c.renderVals();
    check('the card for a hub account without a role hides Approve', v.acctNeedsRole === true && v.acctCanApproveHere === false);
    c.openOtherAccount('code.person');
    v = c.renderVals();
    check('…and still offers it for an invite-code account', v.acctNeedsRole === false && v.acctCanApproveHere === true);
    check('the card markup carries the pointer sentence', /Choose a role in the Pending list/.test(t));
    check('the pending row markup carries the two selects', /aria-label="Role"/.test(t) && /aria-label="Age group"/.test(t));
  }

  summary('test-hub-auth.js');
})().catch((e) => { console.error(e); process.exit(1); });
