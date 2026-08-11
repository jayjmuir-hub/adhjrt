/* tests/test-session-refusal.js
   ---------------------------------------------------------------------------
   Being signed out by the server. Spec:
   claude/specs/spec-session-refusal-aug-2026.md

   WHAT WENT WRONG. Nothing turned a refusal into a signed-out state. logout()
   was called by the Sign out button and by nothing else, and currentSession()
   hands back a session whenever a token STRING is in localStorage — it never
   asks whether that token is still any good. Found on production: an account
   was revoked and then deleted outright, and /manager went on rendering for
   roughly fifteen refreshes while every request behind it was refused.

   ⚠️ THE CHECK THAT MATTERS IS NOT "IT SIGNS OUT ON A REFUSAL". That passes
   just as well against code that signs out on EVERYTHING — which would throw a
   manager out for touching an organiser-only feature, and throw fifteen of
   them out at a pitch when the account store blips. The discriminating checks
   are the ones below that require the session to SURVIVE:

     403 + wrong role     stays signed in
     503 + store outage   stays signed in
     403 + revoked        signed out      <- same status code as the first

   A status code cannot tell the first and third apart. That is the entire
   reason the marker exists, and why nothing reads the sentence instead: the
   wording is meant to be improvable, and test-unified-login.js had to be
   rewritten once for pinning an exact refusal string.
*/

const Module = require('module');
const path = require('path');
const fs = require('fs');
const { section, check, eq, summary, readRepo, repoRoot } = require('./_lib');

const FN = path.join(repoRoot(), 'netlify', 'functions');

/* ---------------------------------------------------------------------------
   The stub world. Same approach as test-functions-load.js: a fresh clone has
   no node_modules, and the stubs answer PLAUSIBLY rather than throwing —
   a throwing stub turns every authenticated call into a 500 and hides the very
   faults this file exists to catch. */
let ACCOUNTS = [];
let THROW_ON_READ = false;
let SAVED = null;

const stubs = {
  '@netlify/blobs': {
    getStore: () => ({
      get: async (key) => {
        if (THROW_ON_READ) throw new Error('simulated store outage');
        return key === 'list' ? ACCOUNTS : null;
      },
      set: async () => {}, setJSON: async (k, v) => { SAVED = v; },
      list: async () => ({ blobs: [] }), delete: async () => {},
    }),
  },
  'google-auth-library': { OAuth2Client: function () { return { verifyIdToken: async () => ({ getPayload: () => ({}) }) }; } },
  bcryptjs: {
    hashSync: (s) => 'hashed:' + s, compareSync: (a, b) => b === 'hashed:' + a,
    compare: async (a, b) => b === 'hashed:' + a, hash: async (s) => 'hashed:' + s,
  },
};
const realLoad = Module._load;
Module._load = function (request) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
  return realLoad.apply(this, arguments);
};

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-not-a-real-one';
process.env.BLOBS_SITE_ID = process.env.BLOBS_SITE_ID || 'x';
process.env.BLOBS_TOKEN = process.env.BLOBS_TOKEN || 'x';

const { sign } = require(path.join(FN, '_auth.js'));
const myAccount = require(path.join(FN, 'my-account.js'));
const accountsAdmin = require(path.join(FN, 'accounts-admin.js'));

const MGR = { username: 'a-manager', role: 'manager', ageGroupId: 'u16b', approved: true, name: 'M', createdAt: '2026-08-11' };
const token = () => sign({ username: 'a-manager', role: 'manager', ageGroupId: 'u16b' });
const ev = () => ({ httpMethod: 'GET', headers: { authorization: 'Bearer ' + token() } });

async function call(handler) {
  let res;
  /* ⚠️ Wrapped. A fault that makes a handler throw must fail the check that
     names it, not kill the process and take every later check with it. */
  try { res = await handler(ev()); } catch (e) { return { status: 0, body: {}, threw: String(e && e.message) }; }
  let body = {};
  try { body = JSON.parse(res.body) || {}; } catch (e) { /* not JSON */ }
  return { status: res.statusCode, body };
}

/* ====================================================================== */
section('The server marks a finished session, and only a finished session');

(async () => {
  {
    ACCOUNTS = [{ ...MGR }]; THROW_ON_READ = false;
    const r = await call(myAccount.handler);
    /* CONTROL FIRST. Without it every "no marker" reading below is also
       satisfied by a harness that cannot authenticate at all. */
    eq('CONTROL: a normal approved account is let in', r.status, 200);
    check('…and carries no signed-out marker', r.body.sessionEnded === undefined);
  }
  {
    ACCOUNTS = [{ ...MGR, approved: false, sessionsValidFrom: Date.now() }];
    const r = await call(myAccount.handler);
    eq('a REVOKED account is refused', r.status, 403);
    check('…and IS marked as a finished session', r.body.sessionEnded === true,
      'without the marker the browser never signs anybody out');
  }
  {
    ACCOUNTS = [{ ...MGR, sessionsValidFrom: Date.now() + 60000 }];
    const r = await call(myAccount.handler);
    eq('a token older than the account cut-off is refused', r.status, 401);
    check('…and IS marked', r.body.sessionEnded === true);
  }
  {
    ACCOUNTS = [];
    const r = await call(myAccount.handler);
    eq('a DELETED account is refused', r.status, 401);
    check('…and IS marked', r.body.sessionEnded === true);
  }

  /* ====================================================================== */
  section('⚠️ The two refusals that must NOT sign anybody out');

  {
    ACCOUNTS = [{ ...MGR }]; THROW_ON_READ = true;
    const r = await call(myAccount.handler);
    THROW_ON_READ = false;
    eq('a store outage answers 503', r.status, 503);
    /* Signing fifteen managers out at a pitch because a blob read hiccupped is
       far worse than the bug this whole file is about. Fail open. */
    check('⚠️ a store outage does NOT end the session', r.body.sessionEnded === undefined,
      'a blob blip on tournament morning must never sign the committee out');
  }
  {
    ACCOUNTS = [{ ...MGR }];
    const r = await call(accountsAdmin.handler);
    eq('a manager on an organiser-only endpoint is refused with 403', r.status, 403);
    check('⚠️ …but is NOT signed out — they are legitimately signed in',
      r.body.sessionEnded === undefined,
      'pressing the wrong button must not log you out');
  }
  {
    /* THE PAIR THAT PROVES THE MARKER EARNS ITS KEEP: same endpoint, same
       status code, opposite outcome. Nothing reading the status could tell
       these apart, which is why the client is forbidden from trying. */
    ACCOUNTS = [{ ...MGR, approved: false, sessionsValidFrom: Date.now() }];
    const r = await call(accountsAdmin.handler);
    eq('a REVOKED manager on the same endpoint also gets 403', r.status, 403);
    check('⚠️ …and this one IS signed out, on the identical status code',
      r.body.sessionEnded === true);
  }

  /* ====================================================================== */
  section('Every endpoint refuses through the ONE shared builder');

  {
    /* Nine hand-rolled copies is how the sheet columns, the pitch model and the
       registration rules each went wrong. A missed copy here fails SILENTLY:
       that endpoint alone never signs anybody out and nothing looks wrong. */
    const FILES = ['accounts-admin.js', 'documents.js', 'get-my-registrations.js',
      'get-registrations.js', 'my-account.js', 'registration-window.js',
      'save-schedule-override.js', 'scoring-rules.js', 'submit-result.js',
      'venue-layout.js'];

    let seen = 0;
    const missing = [];
    const handRolled = [];
    FILES.forEach((f) => {
      let src;
      try { src = fs.readFileSync(path.join(FN, f), 'utf8'); } catch (e) { missing.push(f); return; }
      seen++;
      if (!/sessionRefusal\(/.test(src)) handRolled.push(`${f}: never calls sessionRefusal`);
      /* The shapes that were there before — rebuilding the body by hand is
         exactly what lets the marker go missing on one endpoint. */
      if (/statusCode:\s*(auth|sess)\.status/.test(src)) handRolled.push(`${f}: still hand-rolls the response`);
      if (/return (fail|json)\((auth|sess)\.status/.test(src)) handRolled.push(`${f}: still hand-rolls the response`);
    });

    /* ⚠️ CONTROL. Every check in this block is a sweep, and a sweep over zero
       files passes. This is the ENOENT trap the prover's NEEDED list exists
       for — the files must be in the temp copy or this proves nothing. */
    eq(`every endpoint file was found and read (${seen})`, seen, FILES.length);
    check('none is missing from the checkout', missing.length === 0, missing.join(', '));
    check('⚠️ every one refuses through the shared builder',
      handRolled.length === 0, handRolled.join('\n      '));
  }

  /* ====================================================================== */
  section('The browser acts on the marker, and on nothing else');

  {
    /* Cut noteSessionEnded out of scores-data.js and RUN it, rather than
       grepping for words. Same technique as test-app-polling.js. */
    const SD = readRepo('scores-data.js');
    const at = SD.indexOf('export function noteSessionEnded(');
    const open = at < 0 ? -1 : SD.indexOf('{', at);
    let body = '';
    if (open > -1) {
      let depth = 0;
      for (let i = open; i < SD.length; i++) {
        if (SD[i] === '{') depth++;
        else if (SD[i] === '}') { depth--; if (depth === 0) { body = SD.slice(open + 1, i); break; } }
      }
    }
    check('noteSessionEnded was found and cut out', body.trim().length > 0,
      'everything below drives an empty string otherwise, which calls nothing and looks perfect');

    function drive(parsed, { pathname = '/manager', handler = null } = {}) {
      const calls = { logout: 0, replacedWith: '', handler: 0 };
      const fn = new Function('parsed', 'logout', 'sessionEndedHandler', 'location', body || '');
      fn(
        parsed,
        () => { calls.logout++; },
        handler ? () => { calls.handler++; } : null,
        { pathname, replace: (u) => { calls.replacedWith = u; } }
      );
      return calls;
    }

    {
      const r = drive({ ok: false, sessionEnded: true });
      eq('a marked refusal clears the stored session', r.logout, 1);
      check('…and sends the person to sign in, saying why',
        /^\/signin\?signedout=1$/.test(r.replacedWith), r.replacedWith || '(no redirect)');
    }
    {
      /* THE DISCRIMINATING ONE. This is the body a manager gets for touching
         an organiser-only feature: ok:false, an error, and no marker. */
      const r = drive({ ok: false, error: 'Only tournament organisers can manage accounts.' });
      eq('⚠️ an unmarked refusal does NOT clear the session', r.logout, 0);
      eq('…and does not redirect', r.replacedWith, '');
    }
    {
      const r = drive({ ok: false, error: 'Could not check your sign-in just now. Please try again.' });
      eq('⚠️ a store-outage refusal does NOT sign the person out', r.logout, 0);
    }
    {
      const r = drive({ ok: true, results: {} });
      eq('an ordinary successful reply does nothing', r.logout, 0);
      eq('…and does not redirect', r.replacedWith, '');
    }
    {
      /* ⚠️ Without the pathname guard, a refusal answered ON /signin redirects
         to /signin, which asks again, for ever. */
      const r = drive({ ok: false, sessionEnded: true }, { pathname: '/signin' });
      eq('on /signin itself the session is still cleared', r.logout, 1);
      eq('⚠️ …but it does NOT redirect to itself', r.replacedWith, '');
    }
    {
      /* /app registers its own behaviour rather than navigating away. */
      const r = drive({ ok: false, sessionEnded: true }, { handler: true });
      eq('a registered handler is used instead', r.handler, 1);
      eq('…and the default redirect is skipped', r.replacedWith, '');
      eq('…but the session is cleared either way', r.logout, 1);
    }
  }

  /* ====================================================================== */
  section('Both data layers apply the rule, and /signin explains itself');

  {
    const SD = readRepo('scores-data.js');
    const OD = readRepo('organizer-data.js');

    check('scores-data applies it inside the one fetch helper',
      /noteSessionEnded\(parsed\);/.test(SD),
      'in a caller instead, a caller that forgot would silently never sign anybody out');
    check('organizer-data applies it too', /noteSessionEnded\(parsed\);/.test(OD));
    /* ⚠️ Imported, never reimplemented — organizer-data already carries a
       second copy of tryFetchJson, and a second copy of the RULE would drift,
       silently, on the one dashboard that manages accounts. */
    check('⚠️ …by importing the one copy, not growing a second',
      /import \{[^}]*\bnoteSessionEnded\b[^}]*\} from '\.\/scores-data\.js';/.test(OD)
      && !/function noteSessionEnded\b/.test(OD));

    const SI = readRepo('Signin.dc.html');
    check('/signin reads the signed-out flag', /params\.get\('signedout'\) === '1'/.test(SI));
    check('…and says so rather than showing a bare form',
      /You have been signed out\. Please sign in again\./.test(SI));
  }

  /* ====================================================================== */
  section('⚠️ Revoked is its own state, not the absence of approval');

  {
    /* WHY: the pending queue is `!approved`, and revoke set exactly that — so
       a revoked person appeared among new signups, under an Approve button
       that reinstates them and a Reject button that DELETES their record.
       Jay pressed the delete by accident tidying the row his own revocation
       had just made. */
    const ORG = { username: 'the-organiser', role: 'organizer', approved: true, name: 'O', createdAt: '2026-08-01' };
    const oToken = sign({ username: 'the-organiser', role: 'organizer' });
    const post = (body) => ({ httpMethod: 'POST', headers: { authorization: 'Bearer ' + oToken }, body: JSON.stringify(body) });
    const find = (u) => (SAVED || []).find((a) => a.username === u) || {};

    {
      ACCOUNTS = [{ ...ORG }, { ...MGR }];
      SAVED = null;
      let res;
      try { res = await accountsAdmin.handler(post({ action: 'revoke', username: 'a-manager' })); } catch (e) { res = { statusCode: 0 }; }
      eq('CONTROL: an organiser may revoke', res.statusCode, 200);
      const a = find('a-manager');
      check('revoking clears approval', a.approved === false);
      check('⚠️ …and records WHEN, so revoked can be told from never-approved',
        typeof a.revokedAt === 'string' && a.revokedAt.length > 0,
        'without this the person lands in the queue of new signups');
      check('…and still stamps the session cut-off', typeof a.sessionsValidFrom === 'number');
    }
    {
      /* Restoring is the same 'approve' action — that is what un-revoking IS. */
      ACCOUNTS = [{ ...ORG }, { ...MGR, approved: false, sessionsValidFrom: 1754900000000, revokedAt: '2026-08-11T09:00:00.000Z' }];
      SAVED = null;
      try { await accountsAdmin.handler(post({ action: 'approve', username: 'a-manager' })); } catch (e) {}
      const a = find('a-manager');
      check('restoring re-approves', a.approved === true);
      check('…and takes the revoked mark off', a.revokedAt === undefined);
      /* ⚠️ THE ONE THAT MATTERS. Restoring must not resurrect the tokens the
         revocation killed — they signed out for a reason. */
      eq('⚠️ …but does NOT resurrect their old sessions', a.sessionsValidFrom, 1754900000000);
    }
  }

  {
    const ORGP = readRepo('Organizer.dc.html');

    /* ⚠️ BOTH ENDS. "It is not in the pending queue" passes just as well
       against an account that has vanished from the page altogether. */
    check('⚠️ the pending queue excludes revoked accounts',
      /pendingAccounts: s\.accounts\.filter\(\(a\) => !a\.approved && !a\.revokedAt\)/.test(ORGP),
      'this is the filter that put a revoked person among new signups');
    check('⚠️ …and they appear in a Revoked list instead',
      /revokedAccounts: s\.accounts\.filter\(\(a\) => !a\.approved && a\.revokedAt\)/.test(ORGP));
    check('the count beside the queue excludes them too',
      /pendingCount: s\.accounts\.filter\(\(a\) => !a\.approved && !a\.revokedAt\)\.length/.test(ORGP),
      'a queue reading "1 waiting" with nothing in it is the same bug, quieter');
    check('the Revoked section is rendered', /<sc-for list="\{\{ revokedAccounts \}\}"/.test(ORGP));

    /* The two actions are named for what they do, and the destructive one asks
       first — naming the person, which is what turns "clear this stray row"
       back into a decision. */
    check('restoring is offered', />Restore access</.test(ORGP));
    check('⚠️ deleting a revoked account asks first',
      /doPurgeAccount\(username, name\) \{[\s\S]{0,200}confirmModal\(/.test(ORGP),
      'doReject deletes immediately — that is the click that was pressed by accident');
    check('…and the dialog names the person',
      /Delete \$\{name \|\| username\} permanently\?/.test(ORGP));
    check('…and the revoked row routes through it, not straight to doReject',
      /onPurge: \(\) => this\.doPurgeAccount\(a\.username, a\.name\)/.test(ORGP));
  }

  summary('test-session-refusal.js');
})();
