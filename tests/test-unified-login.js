/* tests/test-unified-login.js
   ------------------------------------------------------------------------
   The ONE sign-in endpoint, netlify/functions/login.js (Aug 2026,
   claude/specs/spec-unified-login.md). Two halves:

   1. DRIVE IT. Same stub technique as test-functions-load.js, but with a
      populated accounts store and a bcrypt stub that actually discriminates
      — so a real organizer account, a real manager account, a pending one
      and a Google-only one all go through the real handler, and the tokens
      that come back are verified with the real verify(). This is the proof
      that existing accounts of BOTH roles work through the single endpoint.

   2. PIN THE SHAPES. The session and token literals are asserted as
      HARDCODED STRINGS, and the two retired endpoints are asserted GONE.

      ⚠️ This section used to be a parity check against organizer-login.js /
      manager-login.js, which were kept byte-identical and uncalled after the
      unification. They were deleted in their retirement commit (3 Aug 2026),
      so there is nothing left to compare against — and that is fine, because
      the hardcoded literal was always the half that did the work. A parity
      check between two copies passes on a change made to both; only the
      literal catches a change made to the one copy that is left. The session
      shapes are load-bearing downstream (`isOrganiserSession()` reads
      `_role`, manager code reads `ageGroupId`), which is why they are pinned
      by text and not merely exercised.

   ⚠️ Nothing here is a real credential. The hashes are the literal strings
   'hash-orga' etc., the secret is a test value, and the stub bcrypt says
   yes only when password === 'pw-' + username.
*/

const path = require('path');
const Module = require('module');
const fs = require('fs');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

/* ------------------------------------------------------------------ */
/* Stubs — an in-memory blob store so the rate limiter really counts,
   and a bcrypt whose answer depends on its input. */

const ACCOUNTS = [
  { username: 'orga', role: 'organizer', title: 'Registrar', name: 'Orga Person', passwordHash: 'hash-orga', approved: true },
  { username: 'quiet', role: 'organizer', title: '', name: 'Quiet Person', passwordHash: 'hash-quiet', approved: true },
  { username: 'mgr', role: 'manager', ageGroupId: 'u14b', name: 'Mgr Person', passwordHash: 'hash-mgr', approved: true },
  { username: 'pend', role: 'manager', ageGroupId: 'u9', name: 'Pending Person', passwordHash: 'hash-pend', approved: false },
  { username: 'goog', role: 'organizer', name: 'Google Person', passwordHash: null, approved: true, googleSub: 'sub-1' },
];

const blobData = new Map(); // `${store}/${key}` -> value
function installStubs() {
  blobData.set('accounts/list', JSON.parse(JSON.stringify(ACCOUNTS)));
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
      /* Says yes ONLY when the password is 'pw-<username-half-of-the-hash>'.
         A stub that always answers true would pass a handler that never
         checks the password at all. */
      compare: async (pw, hash) => hash === 'hash-' + String(pw).replace(/^pw-/, ''),
      compareSync: (pw, hash) => hash === 'hash-' + String(pw).replace(/^pw-/, ''),
      hash: async () => 'stub', hashSync: () => 'stub',
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

const FN = (f) => path.join(require('./_lib').repoRoot(), 'netlify', 'functions', f);
const { handler } = require(FN('login.js'));
const { verify } = require(FN('_auth.js'));

function post(body, ip) {
  return handler({
    httpMethod: 'POST',
    headers: { 'x-nf-client-connection-ip': ip || '203.0.113.5' },
    body: JSON.stringify(body),
  });
}
const parse = (res) => ({ status: res.statusCode, ...(JSON.parse(res.body || '{}')) });

async function main() {

/* ====================================================================== */
section('One endpoint signs in BOTH roles — driven through the real handler');
{
  const r = parse(await post({ username: 'orga', password: 'pw-orga' }));
  eq('an organizer signs in', r.status, 200);
  eq('…with the organizer session shape', r.session,
    { username: 'orga', name: 'Orga Person', role: 'Registrar', _role: 'organizer' });
  const tok = verify(r.token);
  check('…and a token the backend verifies as organizer', !!tok && tok.role === 'organizer' && tok.username === 'orga',
    JSON.stringify(tok));
  check('…that carries no age group (organizers see everything)', !('ageGroupId' in (tok || {})) || tok.ageGroupId === undefined);
}
{
  const r = parse(await post({ username: 'quiet', password: 'pw-quiet' }));
  eq('a blank organiser title lands as the default, same as organizer-login.js', r.session.role, 'Organizer');
}
{
  const r = parse(await post({ username: 'MGR ', password: 'pw-mgr' }));
  eq('a manager signs in (username trimmed and lowercased)', r.status, 200);
  eq('…with the manager session shape', r.session,
    { username: 'mgr', name: 'Mgr Person', ageGroupId: 'u14b' });
  const tok = verify(r.token);
  check('…and a token carrying role AND age group', !!tok && tok.role === 'manager' && tok.ageGroupId === 'u14b',
    JSON.stringify(tok));
}

/* ====================================================================== */
section('The refusals: wrong password, unknown name, Google-only, pending');
{
  const r = parse(await post({ username: 'orga', password: 'pw-wrong' }));
  eq('a wrong password is a clean 401', r.status, 401);
  eq('…with one non-enumerating message', r.error, 'Incorrect username or password.');

  const r2 = parse(await post({ username: 'nobody', password: 'pw-x' }));
  eq('an unknown username gets the SAME answer — no way to probe who exists',
    [r2.status, r2.error], [401, 'Incorrect username or password.']);

  const r3 = parse(await post({ username: 'goog', password: 'anything' }));
  eq('a Google-only account trying the password form gets the same clean 401, never a 500',
    [r3.status, r3.error], [401, 'Incorrect username or password.']);

  const r4 = parse(await post({ username: 'pend', password: 'pw-pend' }));
  eq('a pending account is told so', r4.status, 403);
  check('…in the same words the old endpoints used', /pending approval from a tournament organizer/.test(r4.error));

  const r5 = await handler({ httpMethod: 'GET', headers: {} });
  eq('GET is refused', r5.statusCode, 405);
}

/* ====================================================================== */
section('Rate limiting: same budget, same shared bucket as the old endpoints');
{
  /* Ten tries per 15 minutes per address — the ELEVENTH from one address is
     refused, while a different address is unaffected. Uses its own IPs so
     the checks above never eat into this bucket. */
  let last = null;
  for (let i = 0; i < 10; i++) last = parse(await post({ username: 'orga', password: 'pw-wrong' }, '198.51.100.7'));
  eq('the tenth attempt still gets a real answer', last.status, 401);
  const eleventh = parse(await post({ username: 'orga', password: 'pw-orga' }, '198.51.100.7'));
  eq('the eleventh is refused even with the RIGHT password', eleventh.status, 429);
  const other = parse(await post({ username: 'orga', password: 'pw-orga' }, '198.51.100.8'));
  eq('a different address is unaffected', other.status, 200);

  /* The bucket KEY mattered most when there were three login endpoints —
     alternating between them would otherwise have bought extra guesses, so
     they all counted into `${ip}:login`. Two of the three are retired now
     and login.js is the only password endpoint left, but the assertion is
     still worth making on it: the bucket name and the budget are what stand
     between a public password check and a script working through an account
     that can read every registrant's name, DOB and medical notes. */
  const uniSrc = readRepo(path.join('netlify', 'functions', 'login.js'));
  check('login.js counts into the :login bucket, kept separate from registrations',
    uniSrc.includes('`${clientIp(event)}:login`'));
  check('…with the 10-per-15-minutes budget',
    uniSrc.includes('{ max: 10, windowMs: 15 * 60 * 1000 }'));
  /* ⚠️ AND A SECOND, PER-ACCOUNT BUCKET, ONLY FAILURES COUNTING (Aug 2026).
     The single connection-wide bucket above was incremented before the password
     was checked, so ten CORRECT sign-ins used up the whole venue's budget — and
     every manager at Zayed Sports City shares one connection address. The
     :login bucket is kept as the sweep backstop with a much higher ceiling.
     Behaviour is proven in test-login-ratelimit.js; these two hold the shape. */
  check('…plus a per-account bucket, so one person cannot lock out the venue',
    uniSrc.includes('`${clientIp(event)}:${uname}:login`'));
  check('…and the counter is only touched on a FAILED attempt',
    /await recordFailure\(/.test(uniSrc) && !/await checkRate\(/.test(uniSrc));
}

/* ====================================================================== */
section('The shapes are pinned by literal, and the retired endpoints stay gone');
{
  const uni = readRepo(path.join('netlify', 'functions', 'login.js'));

  const ORG_SESSION = "{ username: account.username, name: account.name, role: account.title || 'Organizer', _role: 'organizer' }";
  const MGR_SESSION = "{ username: account.username, name: account.name, ageGroupId: account.ageGroupId }";
  const ORG_TOKEN = "sign({ username: account.username, role: 'organizer' })";
  const MGR_TOKEN = "sign({ username: account.username, role: 'manager', ageGroupId: account.ageGroupId })";

  check('the organizer session literal is exactly the shape downstream reads', uni.includes(ORG_SESSION),
    "isOrganiserSession() reads _role — drop it and the Publish button silently disappears");
  check('the manager session literal is exactly the shape downstream reads', uni.includes(MGR_SESSION),
    'manager code reads s.ageGroupId');
  check('the organizer token payload is exact', uni.includes(ORG_TOKEN));
  check('the manager token payload is exact', uni.includes(MGR_TOKEN));

  /* ⚠️ RETIRED 3 Aug 2026, and they must not come back. They were kept
     byte-identical and uncalled through the unification so the old tests
     could pass unchanged; that scaffolding is spent. The repo root IS the
     deployed site and the repo is public, so a resurrected copy is dead
     code published to the world — and worse, a SECOND password endpoint
     with its own rate-limit bucket, which is exactly the extra guess budget
     the shared bucket exists to deny. */
  ['organizer-login.js', 'manager-login.js'].forEach((f) => {
    check(`${f} is retired and has not come back`,
      !fs.existsSync(path.join(repoRoot(), 'netlify', 'functions', f)));
  });

  check('the lookup has NO role filter — that filter is what forced the old fallback chains',
    uni.includes('accounts.find((a) => a.username === uname)')
    && !/a\.username === uname && a\.role/.test(uni));
  check('the Google-account (no passwordHash) guard is present',
    /!account \|\| !account\.passwordHash \|\|/.test(uni));
  check('login.js does NOT check password length — the floor applies when a password is SET',
    !/passwordProblem\(/.test(uni) && !/password\.length/.test(uni),
    'a length check at login locks out every existing short password');
}

restore();
summary('test-unified-login.js');
}

main().catch((e) => { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
