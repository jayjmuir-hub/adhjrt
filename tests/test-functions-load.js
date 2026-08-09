/* tests/test-functions-load.js
   ------------------------------------------------------------------------
   ACTUALLY RUNS EVERY NETLIFY FUNCTION, once, with a minimal event.

   WHY THIS EXISTS — 28 July 2026, and it is the most expensive lesson in this
   repo so far. Extracting the Google client into _sheets.js sliced a range out
   of get-registrations.js that also contained `require('./_auth')` and the
   whole of `readRows()`. The file still parsed. `node --check` passed. Every
   test passed — 1,526 of them — because every check on that file asserted what
   it must NOT contain ("no copy of getAuth()") and nothing asserted what it
   NEEDS. It shipped, and the organiser's Teams and Players tabs went blank.

   A missing require is a ReferenceError at CALL time, not at parse time. The
   only thing that catches it is calling the thing.

   HOW IT RUNS FILES THAT NEED node_modules. A fresh clone has none, which is
   the whole reason the logic lives in dependency-free modules. So this stubs
   the three packages just enough to load: the stubs do nothing and are never
   expected to be reached, because every call below is expected to be REFUSED
   at the auth or method check, long before any network client is used.

   WHAT IT DOES NOT DO. It does not test behaviour — that is what the 1,500
   checks elsewhere are for. It answers one question: does this file survive
   being called at all, or does it collapse into the catch block and return a
   500 that looks to a user exactly like "there is no data".
*/

const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { repoRoot, section, check, eq, summary } = require('./_lib');

const FN_DIR = path.join(repoRoot(), 'netlify', 'functions');

/* ------------------------------------------------------------------ */
/* The stubs. They stand in for the three packages a fresh clone does not have.
   They answer plausibly rather than throwing — see the note on `sheets` below. */
function installStubs() {
  const stubs = {
    googleapis: {
      google: {
        auth: { JWT: function JWT() { return {}; } },
        /* Answers with a plausible EMPTY sheet — a tab called Sheet1 and a
           header row and nothing else. It returns rather than throws because
           of what that makes possible: an authenticated call can run the
           handler all the way through, which is the only way to reach code
           that sits behind the auth check. A throwing stub would turn every
           authenticated call into a 500 and hide exactly the faults this file
           exists to catch. */
        sheets: () => ({
          spreadsheets: {
            get: async () => ({ data: { sheets: [{ properties: { title: 'Sheet1' } }] } }),
            values: {
              get: async () => ({ data: { values: [['header']] } }),
              append: async () => ({ data: {} }),
            },
          },
        }),
      },
    },
    '@netlify/blobs': {
      /* list() included because get-results.js calls it and warns loudly when
         it is missing. A stub gap that prints a warning on every run is noise,
         and noise is where a real failure hides. */
      /* ⚠️ THE ACCOUNTS STORE MUST ANSWER, and it did not have to before Aug
         2026. A signed token used to be the whole of the door, so a stub that
         answered null to everything was enough to get past it. resolveSession()
         now re-reads the account behind every token — which is the entire point
         of that change — so a null accounts list means "this login no longer
         exists" and every authenticated check below 401s.

         ⚠️ These two accounts must stay in step with the sign() payloads
         further down (`test-organiser`, `test-manager`/u16b). A token whose
         username is not in this list is now correctly refused, so a mismatch
         here reads as a broken door rather than as a broken fixture. */
      getStore: (arg) => {
        const name = typeof arg === 'string' ? arg : (arg && arg.name);
        return {
          get: async (key) => {
            if (name === 'accounts' && key === 'list') {
              return [
                { username: 'test-organiser', role: 'organizer', approved: true, name: 'Test Organiser' },
                { username: 'test-manager', role: 'manager', ageGroupId: 'u16b', approved: true, name: 'Test Manager' },
              ];
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
    /* google-auth-library — added with Google sign-in support. verifyIdToken
       answers with a plausible-but-fake identity rather than throwing, for
       the same reason the sheets stub above returns instead of throws: a
       throwing stub would turn every call into a 500 and hide exactly the
       faults this file exists to catch. Nothing here is a real Google
       identity — google-auth.js's OWN checks (googleSub match, invite code)
       are what this file is verifying survive being called at all. */
    'google-auth-library': {
      OAuth2Client: function OAuth2Client() {
        return {
          verifyIdToken: async () => ({
            getPayload: () => ({ sub: 'stub-sub', email: 'stub@example.com', name: 'Stub Name', email_verified: true }),
          }),
        };
      },
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

/* Env vars must EXIST or a function may fail for a reason that has nothing to
   do with the code. Obvious non-values — nothing here is a real secret and
   nothing reaches a real service. */
['SESSION_SECRET', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
  'GOOGLE_SHEET_ID_TEAMS', 'GOOGLE_SHEET_ID_PLAYERS', 'MS_TENANT_ID', 'MS_CLIENT_ID',
  'MS_CLIENT_SECRET', 'MAIL_FROM', 'GOOGLE_CLIENT_ID'].forEach((k) => { if (!process.env[k]) process.env[k] = 'test-not-a-real-value'; });

/* ====================================================================== */
section('Every function file loads');

const files = fs.readdirSync(FN_DIR)
  .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
  .sort();

check('there are functions to check', files.length > 5, String(files.length));

const loaded = {};
files.forEach((f) => {
  let mod = null;
  try {
    delete require.cache[require.resolve(path.join(FN_DIR, f))];
    mod = require(path.join(FN_DIR, f));
  } catch (err) {
    check(`${f} loads`, false, err && err.message);
    return;
  }
  check(`${f} loads`, true);
  check(`${f} exports a handler`, typeof mod.handler === 'function');
  loaded[f] = mod;
});

/* The shared modules too — they have no handler, but a broken require in one
   of them takes every caller down with it. */
fs.readdirSync(FN_DIR).filter((f) => f.startsWith('_') && f.endsWith('.js')).sort().forEach((f) => {
  try {
    delete require.cache[require.resolve(path.join(FN_DIR, f))];
    require(path.join(FN_DIR, f));
    check(`${f} loads`, true);
  } catch (err) {
    check(`${f} loads`, false, err && err.message);
  }
});

/* ====================================================================== */
section('Every function survives being CALLED');

/* THE CHECK THAT WOULD HAVE CAUGHT IT. Loading a file proves its requires
   resolve. It does not prove the handler body can run — a function called
   inside the handler that nobody imported is fine until the moment it is
   reached.

   Every call below is made with NO credentials, so the honest answer is a 401,
   a 403 or a 405. A 500 means the handler fell into its own catch block, which
   from the outside is indistinguishable from "there is no data" — which is
   exactly how blank Teams and Players tabs shipped. */
const EVENTS = {
  GET: { httpMethod: 'GET', headers: {}, queryStringParameters: {}, body: null },
  POST: { httpMethod: 'POST', headers: {}, queryStringParameters: {}, body: '{}' },
};

async function callIt(f, mod, method) {
  try {
    const res = await mod.handler({ ...EVENTS[method] });
    return { status: res && res.statusCode, body: res && res.body };
  } catch (err) {
    return { threw: err && err.message };
  }
}

(async () => {
  for (const f of Object.keys(loaded)) {
    for (const method of ['GET', 'POST']) {
      const r = await callIt(f, loaded[f], method);
      check(`${f} (${method}) does not throw out of the handler`, !r.threw, r.threw);
      /* 500 is the tell. Something inside blew up and the catch turned it into
         a shrug. Any deliberate refusal is fine. */
      check(`${f} (${method}) refuses cleanly rather than returning 500`,
        r.status !== 500, `status ${r.status}: ${String(r.body).slice(0, 160)}`);
      check(`${f} (${method}) answers at all`, typeof r.status === 'number', JSON.stringify(r).slice(0, 120));
    }
  }

  /* ==================================================================== */
  section('The two readers can actually read');

  /* Named individually because these are the two that broke, and because
     "get-registrations returns 500" is the exact symptom Jay reported: the
     Teams and Players tabs empty, with no error anywhere a user could see. */
  for (const f of ['get-registrations.js', 'get-my-registrations.js']) {
    const mod = loaded[f];
    check(`${f} is one of the files under test`, !!mod);
    if (!mod) continue;
    const r = await callIt(f, mod, 'GET');
    eq(`${f} answers an unauthenticated read with 401, not 500`, r.status, 401);
    check(`${f} says why`, /not signed in/i.test(String(r.body)), String(r.body).slice(0, 160));
  }

  /* ==================================================================== */
  section('Past the front door — the handler body actually runs');

  /* WHY THIS SECTION IS NECESSARY. Everything above stops at the auth check,
     so it never reaches a single line of what these functions are FOR. A
     function the handler calls but nobody declared is fine right up until it
     is reached — and it is only reached after signing in.

     Found by injecting exactly that fault: renaming readRows() was NOT caught
     by any unauthenticated check, because a 401 comes back long before it
     matters. So these calls carry a real, correctly-signed organiser session,
     minted with the same sign() the login functions use. */
  const { sign } = require(path.join(FN_DIR, '_auth.js'));
  const token = sign({ username: 'test-organiser', role: 'organizer' });
  const authed = (method) => ({ ...EVENTS[method], headers: { authorization: `Bearer ${token}` } });

  for (const f of ['get-registrations.js', 'get-my-registrations.js']) {
    const mod = loaded[f];
    if (!mod) { check(`${f} is under test`, false); continue; }
    let res = null, threw = null;
    try { res = await mod.handler(authed('GET')); } catch (err) { threw = err && err.message; }
    check(`${f} does not throw when it is actually allowed to run`, !threw, threw);
    eq(`${f} answers a signed-in read with 200`, res && res.statusCode, 200);
    let parsed = null;
    try { parsed = JSON.parse((res && res.body) || 'null'); } catch (e) { parsed = null; }
    check(`${f} returns a readable body`, !!parsed && parsed.ok === true,
      String(res && res.body).slice(0, 200));
    check(`${f} returns a list of teams`, !!parsed && Array.isArray(parsed.teams));
    check(`${f} returns a list of players`, !!parsed && Array.isArray(parsed.players));
    /* The stub sheet has a header row and nothing under it, so the honest
       answer is two empty lists — not undefined, and not a crash. */
    eq(`${f}: an empty sheet gives no teams`, parsed && parsed.teams && parsed.teams.length, 0);
    eq(`${f}: an empty sheet gives no players`, parsed && parsed.players && parsed.players.length, 0);
  }

  /* The organiser-only endpoints must still refuse a MANAGER, and that branch
     is also behind the front door. */
  {
    const mtoken = sign({ username: 'test-manager', role: 'manager', ageGroupId: 'u16b' });
    const mev = { ...EVENTS['GET'], headers: { authorization: `Bearer ${mtoken}` } };
    const res = await loaded['get-registrations.js'].handler(mev);
    /* 403, not 401. It was 401 until Aug 2026 because one condition covered
       both "no session" and "wrong role" — so a signed-in manager was told
       "Not signed in", which is false and sends them to re-enter a password
       that will not help. Now the two are separate: resolveSession answers the
       first, the role check answers the second. ⚠️ 401 here again would mean
       the two have been re-merged. */
    eq('get-registrations.js refuses a manager', res && res.statusCode, 403);
    const res2 = await loaded['get-my-registrations.js'].handler(mev);
    check('get-my-registrations.js lets a manager in', res2 && res2.statusCode === 200,
      String(res2 && res2.statusCode));
  }

  restore();
  summary('test-functions-load.js');
})();
