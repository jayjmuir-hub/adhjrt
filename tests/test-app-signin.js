/* tests/test-app-signin.js
   ------------------------------------------------------------------------
   The /app sign-in sheet (JRT-29, 11 Sep 2026).

   The bug this file exists for: when the unified login refused a password,
   signIn() in app.html "retried" through orgApi.login(). organizer-data.js has
   not exported a login function since the two-endpoint chain was retired, so
   the retry was a call to undefined. A wrong password threw a TypeError out of
   the click handler, and the "Wrong username or password" message never
   appeared - the button just sat on "Signing in…".

   ⚠️ THIS FILE DRIVES THE SHIPPED HANDLER, IT DOES NOT GREP IT. The Sign in
   button's onclick body is cut out of app.html and run with stubs. The stub
   for orgApi is built from what organizer-data.js REALLY exports, so a call to
   a function that module does not have fails here exactly as it fails on a
   phone. A stub that simply included login() would pass against the very bug
   this file is here to catch.

   Same extraction approach as test-app-polling.js: comments are stripped
   first, because app.html's comments quote code. */

const { section, check, eq, summary, readRepo } = require('./_lib');

const APP = readRepo('app.html');
const ORG = readRepo('organizer-data.js');

/* Block comments, and line comments only where they start a line - a bare
   //-strip would eat the second half of every https:// in the file. */
const strip = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

const CODE = strip(APP);

/* Naive brace counting, as in test-app-polling.js. The handler has no braces
   inside its strings; if it ever does, the "was found" check goes red, which
   is the correct failure rather than a silent one. */
function bodyAt(src, openBrace) {
  let depth = 0;
  for (let i = openBrace; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(openBrace + 1, i);
    }
  }
  return null;
}

const OPENER = "$('lgo').onclick = async () => {";
const at = CODE.indexOf(OPENER);
const HANDLER = at < 0 ? null : bodyAt(CODE, at + OPENER.length - 1);

/* ---------------------------------------------------------------------------
   What organizer-data.js actually exports - its own functions, and the names
   it re-exports from scores-data.js in `export { ... } from` blocks. */
function exportNames(src) {
  const code = strip(src);
  const names = new Set();
  for (const m of code.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) names.add(m[1]);
  for (const m of code.matchAll(/export\s*\{([^}]*)\}/g)) {
    m[1].split(',').map((s) => s.trim()).filter(Boolean)
      .forEach((s) => names.add(s.split(/\s+as\s+/).pop().trim()));
  }
  return names;
}
const ORG_EXPORTS = exportNames(ORG);

/* ---------------------------------------------------------------------------
   Run the handler once, in a world where everything it can reach is recorded. */
async function press({ username, password, loginResult }) {
  const els = {
    lu: { value: username },
    lp: { value: password },
    loginErr: { innerHTML: '' },
  };
  const rec = { apiLogin: [], orgCalls: [], released: 0, closed: 0, toasts: [], renders: 0, loads: [] };

  const api = { login: async (u, p) => { rec.apiLogin.push([u, p]); return loginResult; } };
  const orgApi = {};
  ORG_EXPORTS.forEach((n) => { orgApi[n] = async () => { rec.orgCalls.push(n); return { ok: false }; }; });

  const S = { ageGroups: [{ id: 'u10b' }], session: null };
  const fn = new Function(
    '$', 'busy', 'api', 'orgApi', 'S', 'resolveSession', 'closeSheet', 'load', 'render', 'toast',
    'return (async () => {' + HANDLER + '})();'
  );

  let threw = null;
  try {
    await fn(
      (id) => els[id],
      () => () => { rec.released++; },
      api,
      orgApi,
      S,
      () => ({ username, ageGroupId: '*' }),
      () => { rec.closed++; },
      async (ag) => { rec.loads.push(ag); },
      () => { rec.renders++; },
      (msg) => { rec.toasts.push(msg); }
    );
  } catch (e) { threw = e; }
  return { els, rec, threw, S };
}

(async () => {
  section('The handler and the stub it runs against');
  check('the Sign in handler was found in app.html', !!HANDLER);
  /* Controls for the export parser: an empty or broken parse would make the
     orgApi stub empty, and every "does not throw" below would then be proving
     nothing about organizer-data.js. These three are known to be exported. */
  check('the organizer-data.js export list was read (logout, currentSession, getVenue found)',
    ['logout', 'currentSession', 'getVenue'].every((n) => ORG_EXPORTS.has(n)),
    [...ORG_EXPORTS].join(', '));
  check('the organizer-data.js export list is plausibly complete (over 20 names)', ORG_EXPORTS.size > 20,
    String(ORG_EXPORTS.size));
  if (!HANDLER) return summary('test-app-signin.js');

  section('A wrong password shows the refusal');
  const bad = await press({
    username: ' coach ', password: 'not-the-password',
    loginResult: { ok: false, error: 'Incorrect username or password.' },
  });
  check('a wrong password does not throw out of the handler', !bad.threw, bad.threw && String(bad.threw));
  check('a wrong password shows the refusal',
    /Wrong username or password/.test(bad.els.loginErr.innerHTML), bad.els.loginErr.innerHTML);
  eq('a refusal releases the Sign in button', bad.rec.released, 1);
  eq('a refusal closes nothing and toasts nothing', [bad.rec.closed, bad.rec.toasts], [0, []]);
  eq('the unified login is asked once, with the username trimmed', bad.rec.apiLogin, [['coach', 'not-the-password']]);
  eq('no organizer-data.js function is called on a refusal', bad.rec.orgCalls, []);

  section('A correct password signs in (control: the handler is not simply refusing everything)');
  const good = await press({ username: 'coach', password: 'right', loginResult: { ok: true } });
  check('a correct password does not throw', !good.threw, good.threw && String(good.threw));
  eq('a correct password signs in: the sheet closes and says so', [good.rec.closed, good.rec.toasts], [1, ['Signed in']]);
  check('a correct password shows no refusal', good.els.loginErr.innerHTML === '', good.els.loginErr.innerHTML);

  summary('test-app-signin.js');
})();
