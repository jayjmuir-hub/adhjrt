/* tests/test-session-revocation.js
   ---------------------------------------------------------------------------
   Proves resolveSession() in netlify/functions/_auth.js — the check that makes
   Revoke mean something.

   WHAT WENT WRONG, AND WHY THIS FILE EXISTS. Until Aug 2026 every guarded
   endpoint called verify() and stopped there. verify() proves the token was
   signed by us and is under six months old, and CANNOT know the account behind
   it was revoked, rejected, demoted or had its password reset — a token is a
   signed snapshot, and this system keeps no session table. So an organiser
   pressing Revoke changed the accounts blob and nothing else: the revoked
   person's phone kept working for up to 182 days, still reading their age
   group's children's dates of birth and medical notes. A revoked ORGANISER
   could re-approve themselves, which made revocation reversible by the person
   being revoked.

   ⚠️ THESE CHECKS DRIVE THE REAL FUNCTION, not a regex over its source. The
   accounts store is stubbed so the list can be changed between calls — that is
   the only way to test "the token stayed the same and the ANSWER changed",
   which is the whole behaviour.

   ⚠️ THE 503 CHECKS ARE THE ONES THAT WILL ROT FIRST. A blob read that ERRORS
   must never become a 401: a 401 signs a manager out mid-tournament over a
   transient blip and sends them hunting for a password they have not typed
   since August. If someone "simplifies" the try/catch away, only those two
   checks notice.
*/

const Module = require('module');
const { section, check, eq, summary } = require('./_lib');

/* ---- stubs -------------------------------------------------------------- */
/* accountsList and accountsError are the two dials this whole file turns. */
let accountsList = [];
let accountsError = null;

const stubs = {
  '@netlify/blobs': {
    getStore: (arg) => {
      const name = typeof arg === 'string' ? arg : (arg && arg.name);
      return {
        get: async (key) => {
          if (name === 'accounts' && key === 'list') {
            if (accountsError) throw new Error(accountsError);
            return accountsList;
          }
          return null;
        },
        setJSON: async () => {},
        delete: async () => {},
        list: async () => ({ blobs: [] }),
      };
    },
  },
  bcryptjs: {
    hashSync: () => 'stub', compareSync: () => false,
    hash: async () => 'stub', compare: async () => false,
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

const path = require('path');
const { repoRoot } = require('./_lib');
const auth = require(path.join(repoRoot(), 'netlify', 'functions', '_auth.js'));
const { sign, resolveSession, optionalSession } = auth;

const evt = (token) => ({ headers: token ? { authorization: `Bearer ${token}` } : {} });

/* ⚠️ A THROW MUST FAIL THE CHECK THAT WAS WATCHING, not kill the file. Found by
   injecting the removal of the `!account` guard: resolveSession then read
   .approved off undefined, the process died on the spot, and the run failed
   with a stack trace instead of with "a rejected account is refused". That is
   the right VERDICT reached the wrong way — the prover's rule is that the check
   which claims to guard a behaviour is the one that has to go red. Turning a
   throw into a status nothing equals keeps every eq() below honest. */
async function resolve(event) {
  try { return await resolveSession(event); }
  catch (err) { return { ok: false, status: 'THREW: ' + (err && err.message), error: String(err) }; }
}

const APPROVED_MANAGER = { username: 'jo', role: 'manager', ageGroupId: 'u16b', approved: true };
const APPROVED_ORGANISER = { username: 'sam', role: 'organizer', approved: true };

/* ====================================================================== */
section('The ordinary case still works');

accountsList = [APPROVED_MANAGER, APPROVED_ORGANISER];
accountsError = null;
const managerToken = sign({ username: 'jo', role: 'manager', ageGroupId: 'u16b' });
const organiserToken = sign({ username: 'sam', role: 'organizer' });

(async () => {
  let r = await resolve(evt(managerToken));
  check('an approved manager is let in', r.ok === true, JSON.stringify(r));
  eq('and keeps their age group', r.ok && r.session.ageGroupId, 'u16b');
  eq('and their role', r.ok && r.session.role, 'manager');

  r = await resolve(evt(organiserToken));
  check('an approved organiser is let in', r.ok === true, JSON.stringify(r));
  eq('an organiser carries no age group', r.ok && r.session.ageGroupId, '');

  /* ------------------------------------------------------------------ */
  section('Revoke — the same token, a different answer');

  /* ⚠️ THE TOKEN IS NOT RE-MINTED between these calls. That is the point: the
     token was valid a line ago and is refused now, with nothing about it
     changed. A test that signed a fresh token here would prove nothing. */
  accountsList = [{ ...APPROVED_MANAGER, approved: false }, APPROVED_ORGANISER];
  r = await resolve(evt(managerToken));
  check('a revoked manager is refused', r.ok === false, JSON.stringify(r));
  eq('and told so with 403, not "not signed in"', r.status, 403);
  check('and the message points at an organiser', /organizer/i.test(r.error || ''), r.error);

  accountsList = [{ ...APPROVED_MANAGER, approved: false, sessionsValidFrom: Date.now() + 60000 },
    APPROVED_ORGANISER];
  r = await resolve(evt(managerToken));
  check('a revoked manager stays refused once the clock is stamped too', r.ok === false);

  /* ------------------------------------------------------------------ */
  section('Reject — the account is gone, so the token is too');

  accountsList = [APPROVED_ORGANISER];
  r = await resolve(evt(managerToken));
  check('a rejected (deleted) account is refused', r.ok === false, JSON.stringify(r));
  eq('with 401 — there is nothing left to be approved', r.status, 401);

  /* ------------------------------------------------------------------ */
  section('A revoked ORGANISER cannot re-approve themselves');

  /* The escalation that made revocation reversible: accounts-admin.js's door
     used to be verify() + role check, so a revoked organiser still opened it
     and could set their own approved flag back to true. */
  accountsList = [{ ...APPROVED_ORGANISER, approved: false }];
  r = await resolve(evt(organiserToken));
  check('a revoked organiser is refused', r.ok === false, JSON.stringify(r));
  eq('with 403', r.status, 403);

  /* ------------------------------------------------------------------ */
  section('Password reset ends the old sessions');

  const beforeReset = sign({ username: 'jo', role: 'manager', ageGroupId: 'u16b' });
  await new Promise((res) => setTimeout(res, 5));
  accountsList = [{ ...APPROVED_MANAGER, sessionsValidFrom: Date.now() }, APPROVED_ORGANISER];
  r = await resolve(evt(beforeReset));
  check('a token minted before the reset is refused', r.ok === false, JSON.stringify(r));
  eq('with 401 and a plain "sign in again"', r.status, 401);

  const afterReset = sign({ username: 'jo', role: 'manager', ageGroupId: 'u16b' });
  r = await resolve(evt(afterReset));
  check('a token minted after the reset is let in', r.ok === true, JSON.stringify(r));

  /* ------------------------------------------------------------------ */
  section('Demotion takes effect without waiting for the token to age out');

  /* Role and age group are re-derived from the ACCOUNT. The token below still
     says u16b and always will; the account is what moved. */
  accountsList = [{ ...APPROVED_MANAGER, ageGroupId: 'u12' }, APPROVED_ORGANISER];
  r = await resolve(evt(managerToken));
  eq('a manager moved to another age group carries the NEW one', r.ok && r.session.ageGroupId, 'u12');

  accountsList = [{ username: 'sam', role: 'manager', ageGroupId: 'u12', approved: true }];
  r = await resolve(evt(organiserToken));
  eq('an organiser demoted to manager is no longer an organiser', r.ok && r.session.role, 'manager');

  /* ------------------------------------------------------------------ */
  section('Accounts that predate this change are not signed out');

  /* sessionsValidFrom is absent on every account created before Aug 2026, so a
     missing stamp must read as "no stamp" or the whole committee is signed out
     the moment this deploys.
     ⚠️ THESE TWO DO NOT GUARD THE `|| 0` — I injected that removal and they
     both still passed, because Number(undefined) is NaN and `x < NaN` is
     already false. What they DO catch is the mutation that actually looks
     tempting: a live default such as `Number(...) || Date.now()`, which reads
     almost the same and refuses every request ever made. Kept for that, and
     labelled so nobody mistakes them for proof of the `|| 0`. */
  accountsList = [APPROVED_MANAGER, APPROVED_ORGANISER];
  r = await resolve(evt(managerToken));
  check('an account with no sessionsValidFrom is let in', r.ok === true, JSON.stringify(r));

  accountsList = [{ ...APPROVED_MANAGER, sessionsValidFrom: 'not-a-number' }, APPROVED_ORGANISER];
  r = await resolve(evt(managerToken));
  check('a junk sessionsValidFrom is treated as no stamp, not as now', r.ok === true, JSON.stringify(r));

  /* ------------------------------------------------------------------ */
  section('A store that CANNOT be read fails closed, but says "try again"');

  accountsList = [APPROVED_MANAGER, APPROVED_ORGANISER];
  accountsError = 'blob store unreachable';
  r = await resolve(evt(managerToken));
  check('a failed accounts read does NOT let the request through', r.ok === false, JSON.stringify(r));
  eq('and answers 503, never 401', r.status, 503);
  check('with a message that says try again rather than sign in',
    /try again/i.test(r.error || '') && !/sign in\b/i.test(r.error || ''), r.error);

  /* ------------------------------------------------------------------ */
  section('optionalSession downgrades instead of erroring');

  /* The deliberate asymmetry: endpoints where the public gets an answer too
     must not 503 over a blob blip — they fall back to the public view. */
  r = await optionalSession(evt(managerToken));
  check('a failed read gives null (answer as the public), not a throw', r === null);

  accountsError = null;
  accountsList = [{ ...APPROVED_MANAGER, approved: false }];
  r = await optionalSession(evt(managerToken));
  check('a revoked token gives null', r === null);

  accountsList = [APPROVED_MANAGER];
  r = await optionalSession(evt(managerToken));
  check('an approved token gives the session', r && r.username === 'jo', JSON.stringify(r));

  /* ------------------------------------------------------------------ */
  section('The old failure modes are still refused');

  accountsList = [APPROVED_MANAGER];
  r = await resolve(evt(null));
  eq('no token at all is 401', r.status, 401);
  r = await resolve(evt('rubbish'));
  eq('a malformed token is 401', r.status, 401);
  r = await resolve(evt(managerToken + 'x'));
  eq('a tampered signature is 401', r.status, 401);

  Module._resolveFilename = realResolve;
  Module._load = realLoad;
  summary('test-session-revocation.js');
})();
