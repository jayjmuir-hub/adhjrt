/* tests/test-accounts.js
   ------------------------------------------------------------------------
   Logins: making them, resetting passwords, and the contract between
   Organizer.dc.html and organizer-data.js.

   THE CHECK THAT MATTERS MOST IS THE FIRST ONE, and it exists because two
   whole features were dead on the live site and nothing noticed.

   Organizer.dc.html called `api.resetAccountPassword()` and
   `api.changeMyPassword()`. Neither function existed in organizer-data.js and
   neither action existed in accounts-admin.js. Both dialogs opened, took a new
   password, closed, and did nothing at all — the TypeError was swallowed by the
   dialog's own `.catch()` and reached only the browser console. On screen it
   looked exactly like success. Nobody could reset a password, and nobody could
   have known.

   That is the worst shape a bug can take on this project: silent, and
   indistinguishable from working. So every `api.X` the page calls is now
   checked against what the data layer actually exports, mechanically, and the
   check runs whether or not anyone remembers to think about it.

   Everything else here is the account rules — who can be created, what a
   password has to be, and the fact that raising the floor must not lock out an
   account that already exists.
*/

const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

/* _password.js, not _auth.js: the rule is dependency-free on purpose, and
   _auth.js pulls in bcryptjs, which is installed by Netlify at build time and
   is not in the clone. A test that needs `npm install` first is a test that
   eventually stops being run. */
const AUTH = require(path.join(repoRoot(), 'netlify', 'functions', '_password.js'));

/* ====================================================================== */
section('Every api.* the organiser page calls actually exists');

{
  const page = readRepo('Organizer.dc.html');
  const data = readRepo('organizer-data.js');

  /* What the page asks for. */
  const called = [...new Set([...page.matchAll(/\bapi\.([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))].sort();

  /* What the data layer provides — its own functions plus anything it
     re-exports from scores-data.js, which is a real provision and must count. */
  const own = [...data.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  const reExported = [...data.matchAll(/^export\s*\{([\s\S]*?)\}\s*from/gm)]
    .flatMap((m) => m[1].split(',').map((x) => x.trim()).filter(Boolean));
  const provided = new Set([...own, ...reExported]);

  check('the page really does call some api functions', called.length > 15, String(called.length));
  check('the data layer really does export some', provided.size > 15, String(provided.size));

  called.forEach((fn) =>
    check(`organizer-data.js provides api.${fn}()`, provided.has(fn),
      'called in Organizer.dc.html and not exported — this is exactly how the two password features died'));

  /* The two that were missing, named individually so a regression reads
     unmistakably rather than as one of a list of thirty. */
  check('resetAccountPassword exists (was missing, silently)', provided.has('resetAccountPassword'));
  check('changeMyPassword exists (was missing, silently)', provided.has('changeMyPassword'));
}

/* ====================================================================== */
section('The backend has an action behind each of those calls');

{
  const admin = readRepo(path.join('netlify', 'functions', 'accounts-admin.js'));
  const data = readRepo('organizer-data.js');

  /* A data-layer function that posts an action nothing handles is the same
     silent failure one layer further down. */
  const actionsSent = [...new Set([...data.matchAll(/action:\s*'([a-zA-Z]+)'/g)].map((m) => m[1]))].sort();
  check('the data layer sends some actions', actionsSent.length >= 5, actionsSent.join(','));
  actionsSent.forEach((a) =>
    check(`accounts-admin.js handles action '${a}'`, new RegExp(`action === '${a}'`).test(admin) || new RegExp(`'${a}'`).test(admin),
      `sent by organizer-data.js, not handled`));

  ['create', 'password', 'changeMine', 'approve', 'reject', 'revoke'].forEach((a) =>
    check(`'${a}' is handled`, new RegExp(`action === '${a}'`).test(admin)));
}

/* ====================================================================== */
section('The password floor');

{
  check('there is one minimum, defined in _password.js', typeof AUTH.MIN_PASSWORD_LENGTH === 'number');
  check('_auth.js re-exports it, so old imports still work', /require\('\.\/_password'\)/.test(readRepo(path.join('netlify', 'functions', '_auth.js'))));
  check('it is at least 10', AUTH.MIN_PASSWORD_LENGTH >= 10, String(AUTH.MIN_PASSWORD_LENGTH));
  /* Not a nicety: an organiser reads every registration, and a manager reads
     their own group's in full including medical notes. Both reach children's
     data, so both get the same floor. */
  check('a short password is refused', !!AUTH.passwordProblem('short'));
  check('an empty password is refused', !!AUTH.passwordProblem(''));
  check('a non-string is refused', !!AUTH.passwordProblem(undefined) && !!AUTH.passwordProblem(null) && !!AUTH.passwordProblem(12345678901));
  check('a long enough password is accepted', AUTH.passwordProblem('x'.repeat(AUTH.MIN_PASSWORD_LENGTH)) === null);
  check('the refusal says what is needed', /at least 10 characters/.test(AUTH.passwordProblem('a')), AUTH.passwordProblem('a'));

  /* The number is written down twice — once server-side as the authority, once
     in the page so the form can complain before sending. A client floor LOWER
     than the server's means Create goes ahead and bounces off a 400 with the
     password already typed. */
  const page = readRepo('Organizer.dc.html');
  const inPage = Number((page.match(/const MIN_PASSWORD_LENGTH = (\d+);/) || [])[1]);
  eq('the page uses the same minimum as the server', inPage, AUTH.MIN_PASSWORD_LENGTH);
  check('no 6-character rule is left anywhere in the page',
    !/at least 6 characters/.test(page) && !/length < 6\b/.test(page),
    (page.match(/.{0,40}(at least 6 characters|length < 6).{0,20}/g) || []).join(' | '));

  /* Every place a password is SET enforces it. */
  ['organizer-signup.js', 'manager-signup.js', 'accounts-admin.js'].forEach((f) => {
    const src = readRepo(path.join('netlify', 'functions', f));
    check(`${f} uses the shared rule`, /passwordProblem\(/.test(src));
    check(`${f} has no 6-character rule of its own`, !/length < 6\b/.test(src));
  });

  /* AND NO LOGIN DOES. Raising the floor must never lock out an account whose
     password predates it — that would take the whole committee out on the
     morning somebody needed to get in. */
  ['organizer-login.js', 'manager-login.js'].forEach((f) => {
    const src = readRepo(path.join('netlify', 'functions', f));
    check(`${f} does NOT check password length`, !/passwordProblem\(/.test(src) && !/password\.length/.test(src),
      'a length check at login would lock out every existing short password');
  });
}

/* ====================================================================== */
section('Creating a login — manager or organiser');

{
  const admin = readRepo(path.join('netlify', 'functions', 'accounts-admin.js'));

  check('create accepts a role', /payload\.role/.test(admin));
  check('…defaulting to manager, so old callers still mean what they meant', /payload\.role \|\| 'manager'/.test(admin));
  check('an unknown role is refused', /role !== 'manager' && role !== 'organizer'/.test(admin));

  /* The age group is the ONLY thing scoping a manager away from every other
     group's registrations, and the signed token carries it. */
  check('a manager still needs an age group', /A manager login needs an age group/.test(admin));
  check('the age group is still validated against the real list', /VALID_AGE_GROUP_IDS\.has\(ageGroupId\)/.test(admin));
  check('an organiser does not need one', /if \(role === 'manager'\) \{[\s\S]{0,200}ageGroupId/.test(admin));
  check('an organiser gets a title instead', /account\.title = /.test(admin));
  check('an organiser account carries no ageGroupId', /if \(role === 'manager'\) account\.ageGroupId = ageGroupId;/.test(admin));

  check('created accounts are approved immediately', /approved: true/.test(admin));
  check('…and record who made them', /createdBy: session\.username/.test(admin));
  check('a duplicate username is still refused', /That username is already taken/.test(admin));

  /* Organiser-only, still. */
  check('every action still requires an organiser session', /const session = requireOrganizer\(event\);/.test(admin));
  check('…checked from the signed token, not the request', /session\.role === 'organizer'/.test(admin));
}

/* ====================================================================== */
section('Resetting a password, and changing your own');

{
  const admin = readRepo(path.join('netlify', 'functions', 'accounts-admin.js'));

  // Someone else's: the organiser session is the authority.
  check("'password' sets the hash, never a plain password", /accounts\[idx\]\.passwordHash = await hashPassword\(payload\.password\)/.test(admin));
  check('…and records who did it', /passwordChangedBy = session\.username/.test(admin));
  check('…and refuses a short one', /if \(action === 'password'\) \{[\s\S]{0,200}passwordProblem/.test(admin));
  check('…on an account that must exist', /Account not found/.test(admin));

  /* Your own: the CURRENT password is required and checked. A stolen session
     must not be enough to lock the real owner out of their own account. */
  check("'changeMine' requires the current password", /Enter your current password/.test(admin));
  check('…and verifies it against the stored hash', /await verifyPassword\(current, all\[me\]\.passwordHash\)/.test(admin));
  check('…refusing if it is wrong', /That is not your current password/.test(admin));
  check('…and only ever changes your OWN account', /a\.username === session\.username/.test(admin));
  check('…refusing a short new one', /if \(action === 'changeMine'\) \{[\s\S]{0,700}passwordProblem\(next\)/.test(admin));

  /* Nothing is emailed, and the organiser is told to say so. */
  const page = readRepo('Organizer.dc.html');
  check('the page says the password is not emailed', /not emailed/i.test(page));
}

/* ====================================================================== */
section('Self-signup can be switched off without a code change');

{
  const src = readRepo(path.join('netlify', 'functions', 'organizer-signup.js'));

  /* THE POINT OF BEING ABLE TO CREATE AN ORGANISER IN THE BACK OFFICE. Once
     every organiser is made that way, ORGANIZER_INVITE_CODE can be deleted in
     Netlify and this function refuses every signup on its own — no deploy, no
     edit. That closes the shared code (one for everybody, no expiry, no way to
     revoke it for one person, no record of who used it) AND the
     first-organiser-auto-approved bootstrap in the same move. */
  check('a missing invite code refuses every signup',
    /!process\.env\.ORGANIZER_INVITE_CODE \|\| inviteCode !== process\.env\.ORGANIZER_INVITE_CODE/.test(src),
    'deleting the env var must be enough to shut self-signup off');
  check('…with a 401, not a pass-through', /statusCode: 401[\s\S]{0,80}Incorrect invite code/.test(src));

  /* The bootstrap still exists while the variable does, so it stays documented
     rather than forgotten. */
  check('the auto-approve bootstrap is still only for the FIRST organiser',
    /const isFirstOrganizer = !accounts\.some\(\(a\) => a\.role === 'organizer'\)/.test(src));
  check('…and everyone else starts pending', /approved: isFirstOrganizer/.test(src));
}

/* ======================================================================
   FAULTS THIS FILE WAS PROVEN AGAINST — `node tests/_prove-registration.js`.
   Each is caught by the named check:

     * resetAccountPassword deleted from organizer-data.js
         -> "organizer-data.js provides api.resetAccountPassword()"
     * changeMyPassword deleted
         -> "organizer-data.js provides api.changeMyPassword()"
     * the 'password' action removed from accounts-admin.js
         -> "accounts-admin.js handles action 'password'"
     * changeMine no longer verifying the current password
         -> "verifies it against the stored hash"
     * the password floor dropped back to 6
         -> "it is at least 10"
     * the page's copy of the floor left behind at 6
         -> "the page uses the same minimum as the server"
     * a length check added to organizer-login.js
         -> "organizer-login.js does NOT check password length"
     * create no longer requiring an age group for a manager
         -> "a manager still needs an age group"

   The first two are the ones this file exists for. Both were REAL — shipped,
   live, and silent — and both were found by reading the code rather than by
   anything failing, which is the whole argument for the mechanical check.
   ====================================================================== */

summary('test-accounts.js');
