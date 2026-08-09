/* tests/test-google-auth-behaviour.js
   ---------------------------------------------------------------------------
   Drives netlify/functions/google-auth.js and _googleAuth.js for real.

   WHY THIS FILE EXISTS. test-google-auth.js has 40 checks and 34 of them are
   REGEXES OVER SOURCE TEXT; it never calls the handler once. Google sign-in is
   the highest-security surface in this repo — the audience check, the
   googleSub lookup, the invite-code gate, and the rule that decides whether a
   brand-new account is approved. A source-text check there cuts both ways:
   reformatting `(a) => a.googleSub` to `a => a.googleSub` breaks three tests
   without a bug, and any bug that leaves the text intact passes.

   Nothing here is a real credential. The OAuth2Client is stubbed and returns a
   payload this file controls; SESSION_SECRET and GOOGLE_CLIENT_ID are obvious
   non-values. No token, key or identity in this file has ever existed.

   ⚠️ THE STUB MUST DISCRIMINATE. A verifyIdToken that always returns the same
   identity cannot tell "the audience was checked" from "the audience was
   ignored", and every check below would pass against a door with no lock. It
   answers from `googlePayload`, refuses when `audienceShouldFail` is set, and
   both are dials this file turns between calls.
*/

const Module = require('module');
const path = require('path');
const { section, check, eq, summary, repoRoot } = require('./_lib');

/* ---- dials ---- */
let accountsList = [];
let saved = null;                 // what saveAccounts was last handed
let googlePayload = null;         // what Google "returns"
let audienceShouldFail = false;   // make verifyIdToken throw, as a wrong audience does
let signInsRecorded = [];

const stubs = {
  '@netlify/blobs': {
    getStore: (arg) => {
      const name = typeof arg === 'string' ? arg : (arg && arg.name);
      return {
        async get(key) {
          if (name === 'accounts' && key === 'list') return accountsList;
          return null;
        },
        async setJSON(key, v) {
          if (name === 'accounts' && key === 'list') { saved = v; accountsList = v; }
          if (name === 'signins') signInsRecorded.push(key);
        },
        async delete() {}, async list() { return { blobs: [] }; },
      };
    },
  },
  bcryptjs: { hash: async () => 'stub', compare: async () => false, hashSync: () => 'stub', compareSync: () => false },
  'google-auth-library': {
    OAuth2Client: function OAuth2Client(clientId) {
      return {
        verifyIdToken: async ({ idToken, audience }) => {
          if (!idToken || idToken === 'bad-token') throw new Error('Invalid token signature');

          /* ⚠️ THIS MODELS THE REAL LIBRARY, AND THE FIRST VERSION DID NOT.
             It used to throw whenever the caller's `audience` was not our
             client id — so injecting "stop pinning the audience" made EVERY
             sign-in fail, and the check that claims to guard it
             ("a token for a different client id is refused") went on passing,
             because it expects null and got null. The fault was caught by
             twenty-three other checks and not by the one that names it.

             What unpinning ACTUALLY does is remove the restriction: google-auth-
             library only enforces an audience when one is REQUIRED, so a token
             minted for someone else's site is then ACCEPTED. That is the
             vulnerability, and this is what it looks like. */
          const tokenMintedFor = audienceShouldFail
            ? 'some-other-site.apps.googleusercontent.com'
            : process.env.GOOGLE_CLIENT_ID;
          if (audience && audience !== tokenMintedFor) throw new Error('Wrong recipient, payload audience != requiredAudience');
          return { getPayload: () => googlePayload };
        },
      };
    },
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
process.env.GOOGLE_CLIENT_ID = 'test-not-a-real-client-id.apps.googleusercontent.com';
process.env.MANAGER_INVITE_CODES = JSON.stringify({ u16b: 'test-not-a-real-code-u16b', '*': 'test-not-a-real-admin-code' });
delete process.env.ORGANIZER_INVITE_CODE;   // deleted in Netlify on purpose — see RESTORE.md

const FN = path.join(repoRoot(), 'netlify', 'functions');
const { handler } = require(path.join(FN, 'google-auth.js'));
const { verifyGoogleIdToken } = require(path.join(FN, '_googleAuth.js'));
const { verify } = require(path.join(FN, '_auth.js'));

const IDENTITY = { sub: 'google-sub-not-real-1', email: 'nobody@example.com', name: 'Nobody Real', email_verified: true };
const reset = () => {
  accountsList = []; saved = null; signInsRecorded = [];
  googlePayload = { ...IDENTITY }; audienceShouldFail = false;
};
const post = (body) => handler({ httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': '203.0.113.9' }, body: JSON.stringify(body) });
const parse = async (res) => ({ status: res.statusCode, ...JSON.parse(res.body || '{}') });

(async () => {
  /* ==================================================================== */
  section('⚠️ The token verifier refuses what it should — driven, not grepped');

  {
    reset();
    check('a valid token yields an identity', !!(await verifyGoogleIdToken('good-token')));

    audienceShouldFail = true;
    eq('⚠️ a token for a DIFFERENT client id is refused', await verifyGoogleIdToken('good-token'), null);
    audienceShouldFail = false;

    eq('a malformed token is refused', await verifyGoogleIdToken('bad-token'), null);
    eq('no token at all is refused', await verifyGoogleIdToken(''), null);

    /* Google can issue a token for an email it has not itself verified. */
    googlePayload = { ...IDENTITY, email_verified: false };
    eq('⚠️ an UNVERIFIED email is refused', await verifyGoogleIdToken('good-token'), null);

    googlePayload = { sub: 'x', name: 'No Email' };
    eq('a payload with no email is refused', await verifyGoogleIdToken('good-token'), null);

    googlePayload = { email: 'nobody@example.com' };
    eq('a payload with no subject is refused', await verifyGoogleIdToken('good-token'), null);

    /* ⚠️ NEVER THROWS. A thrown error here would 500 instead of cleanly
       refusing, and a 500 is indistinguishable from the site being broken. */
    let threw = false;
    googlePayload = null;
    try { await verifyGoogleIdToken('good-token'); } catch (e) { threw = true; }
    check('it never throws, however broken the payload', !threw);
  }

  /* ==================================================================== */
  section('Signing in with an account that already exists');

  {
    reset();
    accountsList = [{ username: 'sam', role: 'organizer', title: 'Registrar', name: 'Sam', approved: true, googleSub: IDENTITY.sub }];
    const r = await parse(await post({ idToken: 'good-token' }));
    eq('an approved organiser is signed in', r.status, 200);
    /* ⚠️ ASSERTED BEFORE ANYTHING READS r.session. Injecting "look the
       account up by email instead of googleSub" made this branch return
       needsSignup, and the file died on `r.session._role` of undefined —
       zero named checks red, a stack trace instead of a verdict. */
    check('…and a session came back at all', !!r.session, JSON.stringify(r).slice(0, 160));
    eq('…with the organiser session shape', (r.session || {})._role, 'organizer');
    const tok = verify(r.token);
    check('…and a token the backend verifies', !!tok && tok.role === 'organizer' && tok.username === 'sam', JSON.stringify(tok));
    check('…and the sign-in was stamped', signInsRecorded.length > 0);
  }
  {
    reset();
    accountsList = [{ username: 'jo', role: 'manager', ageGroupId: 'u16b', name: 'Jo', approved: true, googleSub: IDENTITY.sub }];
    const r = await parse(await post({ idToken: 'good-token' }));
    eq('an approved manager is signed in', r.status, 200);
    check('…and a session came back at all', !!r.session, JSON.stringify(r).slice(0, 160));
    const tok = verify(r.token);
    check('…carrying role AND age group', !!tok && tok.role === 'manager' && tok.ageGroupId === 'u16b', JSON.stringify(tok));
  }
  {
    reset();
    accountsList = [{ username: 'pending', role: 'manager', ageGroupId: 'u16b', name: 'P', approved: false, googleSub: IDENTITY.sub }];
    const r = await parse(await post({ idToken: 'good-token' }));
    eq('a PENDING account is refused', r.status, 403);
    check('…and told to wait for an organiser', /pending approval/i.test(r.error || ''), r.error);
    eq('…and no sign-in was stamped', signInsRecorded.length, 0);
  }
  {
    /* ⚠️ THE LOOKUP IS BY googleSub, NOT BY EMAIL. Matching on email would let
       anyone who controls an address take over the account that used it. */
    reset();
    accountsList = [{ username: 'sam', role: 'organizer', name: 'Sam', approved: true, googleSub: 'a-different-sub', email: IDENTITY.email }];
    const r = await parse(await post({ idToken: 'good-token' }));
    check('⚠️ a matching EMAIL with a different Google subject does NOT sign in',
      r.needsSignup === true, JSON.stringify(r).slice(0, 160));
  }

  /* ==================================================================== */
  section('First time through — the invite code is the gate');

  {
    reset();
    const r = await parse(await post({ idToken: 'good-token' }));
    eq('no account yet, no code: asked to sign up', r.needsSignup, true);
    eq('…which is not an error', r.status, 200);
    check('…and nothing was written', saved === null);
  }
  {
    reset();
    const r = await parse(await post({ idToken: 'good-token', role: 'manager', username: 'newmgr', inviteCode: 'wrong-code' }));
    eq('a WRONG manager invite code is refused', r.status, 401);
    check('…and no account was created', saved === null, JSON.stringify(saved));
  }
  {
    reset();
    const r = await parse(await post({ idToken: 'good-token', role: 'manager', username: 'newmgr', inviteCode: 'test-not-a-real-code-u16b' }));
    eq('the right code creates the account', r.status, 200);
    eq('⚠️ …but it lands PENDING, not signed in', r.pending, true);
    check('…with no token', !r.token, JSON.stringify(r).slice(0, 120));
    const made = (saved || []).find((a) => a.username === 'newmgr');
    check('…and it was stored', !!made);
    eq('…bound to the age group the code names', made && made.ageGroupId, 'u16b');
    eq('…approved: false', made && made.approved, false);
    /* A Google account has no password, and must never get one by accident. */
    eq('⚠️ …with a null passwordHash', made && made.passwordHash, null);
    eq('…and the Google subject recorded', made && made.googleSub, IDENTITY.sub);
  }
  {
    /* ⚠️ ORGANIZER_INVITE_CODE IS DELETED IN NETLIFY ON PURPOSE — its absence
       is what closes organiser self-signup. "Fixing" the missing variable
       re-opens the door. */
    reset();
    const r = await parse(await post({ idToken: 'good-token', role: 'organizer', username: 'neworg', inviteCode: 'anything' }));
    eq('⚠️ an organiser signup is refused while the env var is absent', r.status, 401);
    check('…and no account was created', saved === null);
  }
  {
    reset();
    accountsList = [{ username: 'taken', role: 'manager', ageGroupId: 'u12', approved: true, googleSub: 'someone-else' }];
    const r = await parse(await post({ idToken: 'good-token', role: 'manager', username: 'TAKEN', inviteCode: 'test-not-a-real-code-u16b' }));
    eq('a username already in use is refused', r.status, 409);
  }
  {
    reset();
    const r = await parse(await post({ idToken: 'good-token', role: 'spectator', username: 'x', inviteCode: 'test-not-a-real-code-u16b' }));
    eq('a role that is neither manager nor organiser is refused', r.status, 400);
  }

  /* ==================================================================== */
  section('⚠️ A bad token never reaches the account store');

  {
    reset();
    const r = await parse(await post({ idToken: 'bad-token', role: 'manager', username: 'sneaky', inviteCode: 'test-not-a-real-code-u16b' }));
    eq('an unverifiable token is refused', r.status, 401);
    check('…before any account is created', saved === null, JSON.stringify(saved));
  }
  {
    reset();
    audienceShouldFail = true;
    const r = await parse(await post({ idToken: 'good-token', role: 'manager', username: 'sneaky2', inviteCode: 'test-not-a-real-code-u16b' }));
    eq('⚠️ a token minted for another site is refused', r.status, 401);
    check('…and creates nothing', saved === null);
  }

  Module._resolveFilename = realResolve;
  Module._load = realLoad;
  summary('test-google-auth-behaviour.js');
})();
