/* tests/test-signin-page.js
   ------------------------------------------------------------------------
   The ONE sign-in page, Signin.dc.html (Aug 2026 —
   claude/specs/spec-unified-login.md): password + Google sign-in, both
   sign-up flows, and role routing — organizer → /organizer, manager →
   /manager, ?next= honoured only from the two-path allow-list and only when
   the role permits it. Driven through the real component; redirects are
   observed by overriding the component's own redirect() seam.

   Also asserted here: /organizer and /manager really do hand their
   signed-out visitors to /signin, and netlify.toml serves the page.

   ⚠️ Every value here is invented.
*/

const { readRepo, section, check, eq, summary } = require('./_lib');

class DCLogic {
  setState(patch, cb) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    if (typeof cb === 'function') cb();
  }
}

function build(props) {
  const t = readRepo('Signin.dc.html');
  const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no x-dc script found in Signin.dc.html');
  // eslint-disable-next-line no-new-func
  const C = new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
    DCLogic,
    { addEventListener() {} },
    { addEventListener() {}, getElementById: () => null, createElement: () => ({}), head: { appendChild() {} }, body: { style: {} }, baseURI: 'https://adhjrt.com/' }
  );
  const c = new C();
  c.props = {};
  return c;
}

const ORG_SESSION = { username: 'orga', name: 'Orga', role: 'Registrar', _role: 'organizer', token: 't1' };
const MGR_SESSION = { username: 'mgr', name: 'Mgr', ageGroupId: 'u14b', token: 't2' };

function spy(c) { const gone = []; c.redirect = (u) => gone.push(u); return gone; }

async function main() {

/* ====================================================================== */
section('Routing by role: destFor() and the ?next= allow-list');
{
  const c = build();
  c._next = '';
  eq('an organizer with no next lands on /organizer', c.destFor(ORG_SESSION), '/organizer');
  eq('a manager with no next lands on /manager', c.destFor(MGR_SESSION), '/manager');
  c._next = '/manager';
  eq('an organizer asked for /manager goes there (the switcher makes it theirs too)', c.destFor(ORG_SESSION), '/manager');
  c._next = '/organizer';
  eq('a manager asked for /organizer is routed to /manager instead — /organizer would only 403 them',
    c.destFor(MGR_SESSION), '/manager');
  c._next = 'https://evil.example/phish';
  eq('an arbitrary next URL is refused for an organizer', c.destFor(ORG_SESSION), '/organizer');
  eq('…and for a manager', c.destFor(MGR_SESSION), '/manager');
  c._next = '/scores';
  eq('even a same-site path outside the allow-list is refused', c.destFor(ORG_SESSION), '/organizer');
}

/* ====================================================================== */
section('Password sign-in: one call, then the role decides the landing page');
{
  let calledWith = null;
  const c = build();
  const gone = spy(c);
  c._next = '';
  c.state = { ...c.state, api: { login: async (u, p) => { calledWith = [u, p]; return { ok: true, session: { ...ORG_SESSION, isOrganizer: true, ageGroupId: '*' } }; } } };
  c.setState({ loginUser: '  orga  ', loginPass: 'pw' });
  await c.doLogin();
  eq('the username is trimmed before it is sent', calledWith, ['orga', 'pw']);
  eq('an organizer lands on /organizer', gone, ['/organizer']);
  eq('the typed password is cleared out of state', c.state.loginPass, '');
}
{
  const c = build();
  const gone = spy(c);
  c._next = '';
  c.state = { ...c.state, api: { login: async () => ({ ok: true, session: MGR_SESSION }) } };
  c.setState({ loginUser: 'mgr', loginPass: 'pw' });
  await c.doLogin();
  eq('a manager lands on /manager', gone, ['/manager']);
}
{
  const c = build();
  const gone = spy(c);
  c.state = { ...c.state, api: { login: async () => ({ ok: false, error: 'Incorrect username or password.' }) } };
  c.setState({ loginUser: 'x', loginPass: 'y' });
  await c.doLogin();
  eq('a refusal shows the server\'s own sentence and goes nowhere',
    [c.state.loginError, gone.length], ['Incorrect username or password.', 0]);

  c.setState({ loginUser: '', loginPass: '' });
  let apiCalled = false;
  c.state.api.login = async () => { apiCalled = true; return { ok: false }; };
  await c.doLogin();
  check('an empty form is refused without calling the API',
    c.state.loginError === 'Enter your username and password.' && !apiCalled);
}

/* ====================================================================== */
section('Signup: the role picker decides which invite-code gate is called');
{
  const calls = [];
  const c = build();
  const gone = spy(c);
  c._next = '';
  c.state = { ...c.state, api: { signup: async (args) => { calls.push(args); return { ok: true, session: MGR_SESSION }; } } };
  c.setState({ authMode: 'signup', signupRole: 'manager', signupName: 'Pat Tester', signupPass: 'longpassword1', signupCode: 'CODE-U14B' });
  await c.doSignup();
  eq('a manager signup posts role manager with the derived username',
    [calls[0].role, calls[0].username, calls[0].name], ['manager', 'pat.tester', 'Pat Tester']);
  eq('…and an immediately-approved account is routed by its role', gone, ['/manager']);
}
{
  /* ⚠️ REPOINTED, Aug 2026. This used to set signupRole:'organizer' by hand
     and assert the payload carried it — an assertion the shipped page can no
     longer reach, because ORGANIZER_INVITE_CODE was deleted from Netlify and
     the role picker went with it. A check driving a state the UI cannot
     produce proves nothing about what anyone can actually do, so what is
     asserted now is the CLOSURE itself. The pending-view behaviour it also
     covered is kept, driven through the manager path that still exists. */
  const calls = [];
  const c = build();
  spy(c);
  c.state = { ...c.state, api: { signup: async (args) => { calls.push(args); return { ok: true, pending: true, message: 'Needs approval.' }; } } };
  c.setState({ authMode: 'signup', signupName: 'Sam Helper', signupPass: 'longpassword1', signupCode: 'CODE-U9' });
  await c.doSignup();
  eq('signup can only ever ask for a manager account now', calls[0].role, 'manager');
  check('a pending signup shows the Account created view, not a redirect',
    c.state.signupPending === true && c.renderVals().isSignupPendingView === true);
  eq('…headed "Account created" — the invite-code form really did create it', c.renderVals().signupPendingTitle, 'Account created');
}
{
  /* The Club Hub door's pending answer (9 Sep 2026). Jay: after two people
     used it, "it sends them back to the login page which doesn't look any
     different, the second time they do it, it seems to work". The panel was
     the same card headed "Account created", which the person had not done;
     it now says what happens next, in the heading and in the server's
     sentence. The template must read the heading from state, or the hub
     path and the invite-code path cannot differ. */
  const c = build();
  spy(c);
  const api = { hubAuth: async () => ({ ok: false, pending: true, message: 'Your Club Hub sign-in worked, and a tournament organiser has been told. Press the button again once they give you a role.' }) };
  await c.finishHubSignIn(api, 'a.b.c');
  const vs = c.renderVals();
  const src = readRepo('Signin.dc.html');
  check('componentDidMount hands a #hub_token to finishHubSignIn (the seam this test drives)',
    /const hubToken = this\.hubTokenFromUrl\(\);\s*\n\s*if \(hubToken\) await this\.finishHubSignIn\(api, hubToken\);/.test(src));
  check('a pending hub sign-in shows the pending panel, not the bare form', vs.isSignupPendingView === true && vs.isLoginMode !== true);
  eq('…headed "Nearly there", not "Account created"', vs.signupPendingTitle, 'Nearly there');
  check('…with the server\'s sentence naming the next step', /organiser has been told/.test(vs.signupPendingMessage) && /again/.test(vs.signupPendingMessage));
  const tpl = readRepo('Signin.dc.html').replace(/<!--[\s\S]*?-->/g, '');
  check('the template reads the heading from state rather than hard-coding it', /\{\{ signupPendingTitle \}\}/.test(tpl) && !/>Account created</.test(tpl));
}
{
  /* The closure, asserted on the page source rather than on state — this is
     what a person can actually click. */
  const src = readRepo('Signin.dc.html');
  const code = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  check('no role picker survives on either signup view',
    !/onRoleOrganizer/.test(code) && !/onRoleManager/.test(code) && !/roleOrganizerStyle/.test(code));
  check('…nor the role blurb that switched with it', !/roleBlurb/.test(code));
  check('…nor the organiser-only title inputs', !/onSignupTitle/.test(code) && !/onGoogleTitle/.test(code));
  check('the invite-code label no longer switches — it is always the age-group one',
    /signupCodeLabel: 'AGE GROUP INVITE CODE'/.test(code) && !/ADMIN INVITE CODE/.test(code));
  check('signupRole is fixed at manager and has no setter',
    /signupRole: 'manager'/.test(code) && !/signupRole: 'organizer'/.test(code));
  /* The word must not creep back into what the page offers. Checked on the
     code with comments stripped, because the comments explain at length WHY
     organiser signup is closed and must be free to say so. */
  check('the page never offers "Organiser" as something to sign up as',
    !/>Organiser</.test(code));
}
{
  /* The dedupe-retry: same 409 loop the old pages used. */
  let n = 0;
  const c = build();
  spy(c);
  c.state = { ...c.state, api: { signup: async (args) => { n++; return n < 3 ? { ok: false, error: 'That username is already taken.' } : { ok: true, session: MGR_SESSION, username: args.username }; } } };
  c.setState({ authMode: 'signup', signupRole: 'manager', signupName: 'Pat Tester', signupPass: 'x', signupCode: 'c' });
  await c.doSignup();
  eq('a taken username retries with a numbered variant until it lands', n, 3);
}

/* ====================================================================== */
section('Already signed in: straight through, no form');
{
  const src = readRepo('Signin.dc.html');
  check('componentDidMount routes an existing session before showing anything',
    /const session = api\.currentSession\(\);\s*\n\s*if \(session\) \{ this\.redirect\(this\.destFor\(session\)\); return; \}/.test(src));
}

/* ====================================================================== */
section('The pages around it: rewrites and hand-offs');
{
  const toml = readRepo('netlify.toml');
  check('netlify.toml serves /signin', /from = "\/signin"\s*\n\s*to = "\/Signin\.dc\.html"/.test(toml));

  const org = readRepo('Organizer.dc.html');
  /* Anchored on the BOOT path specifically — doLogout() also redirects to
     /signin, so a loose match would pass with the boot hand-off deleted. */
  check('/organizer redirects its signed-out visitors to /signin, carrying next',
    /else this\.redirect\('\/signin\?next=\/organizer'\);/.test(org));
  check('…and its shell links there too for when scripted navigation is blocked',
    /href="\/signin\?next=\/organizer"/.test(org));
  const orgCode = org.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  check('no login form remains on /organizer', !/loginPass/.test(orgCode) && !/doLogin/.test(orgCode));
  /* Google sign-in AND the account card's Link Google went on 8 Sep 2026
     (spec-club-hub-sign-in § 4) — nothing Google-shaped may remain. */
  check('no Google machinery of any kind remains on /organizer',
    !/googleAuth\s*\(|google-signin-btn|renderGoogleButton|renderAccountGoogleButton|account-google-btn|\.linkGoogle\(|accounts\.google\.com/.test(orgCode));

  const mgr = readRepo('Manager.dc.html');
  /* Same anchoring: boot()'s no-session path, not doLogout()'s. */
  check('/manager redirects its signed-out visitors to /signin, carrying next',
    /this\.setState\(\{ session: null \}\);\s*\n\s*this\.redirect\('\/signin\?next=\/manager'\);/.test(mgr));
  check('…and sign-out hands over to /signin as well',
    /doLogout\(\) \{[\s\S]{0,700}?this\.redirect\('\/signin\?next=\/manager'\);/.test(mgr));

  const mgrCode = mgr.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  check('no Google machinery of any kind remains on /manager',
    !/googleAuth\s*\(|google-signin-btn|renderGoogleButton|renderAccountGoogleButton|account-google-btn|\.linkGoogle\(|accounts\.google\.com/.test(mgrCode));
  check('…nor on /signin itself',
    !/googleAuth\s*\(|google-signin-btn|renderGoogleButton|accounts\.google\.com|google-code/.test(readRepo('Signin.dc.html').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')));
}

summary('test-signin-page.js');
}

main().catch((e) => { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
