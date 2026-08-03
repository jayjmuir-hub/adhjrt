/* tests/test-google-auth.js
   ------------------------------------------------------------------------
   Google sign-in for Organizer/Manager accounts (added 29 Jul 2026). Same
   style as test-accounts.js: these are source-text assertions on the real
   files, not a re-implementation — a change to the real logic is what these
   checks see, same as everywhere else in this repo that checks security-
   critical account code.

   ⚠️ Every value in this file is invented. NEVER build a fixture from a real
   account or a real Google identity.
*/

const path = require('path');
const { readRepo, section, check, eq, summary } = require('./_lib');

function auth() { return readRepo(path.join('netlify', 'functions', '_googleAuth.js')); }
function google() { return readRepo(path.join('netlify', 'functions', 'google-auth.js')); }
function config() { return readRepo(path.join('netlify', 'functions', 'google-config.js')); }
function admin() { return readRepo(path.join('netlify', 'functions', 'accounts-admin.js')); }

section('_googleAuth.js — verifying a Google ID token');
{
  const src = auth();

  check('verifies against OUR OWN client id as the audience, not just any valid Google token',
    /audience:\s*process\.env\.GOOGLE_CLIENT_ID/.test(src),
    'a token minted for a different app must not be accepted here');

  check('refuses when GOOGLE_CLIENT_ID is not set, rather than verifying with an undefined audience',
    /!idToken \|\| !process\.env\.GOOGLE_CLIENT_ID/.test(src));

  check('refuses a token whose email Google has not itself verified',
    /payload\.email_verified === false/.test(src),
    'an unverified email is not proof of who holds this token');

  check('a malformed/expired/wrong-audience token is caught and refused, not thrown',
    /catch \(e\) \{\s*return null;\s*\}/.test(src),
    'a thrown error here would 500 instead of cleanly refusing the sign-in');

  check('requires both a sub and an email in the verified payload',
    /!payload\.sub \|\| !payload\.email/.test(src));
}

section('google-auth.js — matching an existing Google-linked account');
{
  const src = google();

  check('looks up the account by the STORED googleSub, not by email',
    /accounts\.find\(\(a\) => a\.googleSub === identity\.sub\)/.test(src),
    'matching by email instead would let a Google sign-in silently attach to any account with that email');

  check('an unapproved account gets the SAME pending message every other signup path uses',
    /still pending approval from a tournament organizer/.test(src));

  check('a found, approved account gets a session — same helper used for both roles',
    /sessionFor\(existing\)/.test(src));
}

section('google-auth.js — deliberately does NOT auto-link an existing password account');
{
  const src = google();
  check('there is no email-based lookup into existing accounts anywhere in this file',
    !/accounts\.find\(\(a\) => a\.email ===/.test(src),
    'auto-linking by email would trust an email match as proof of identity, which is weaker than the invite-code+approval gate every other account goes through');
}

section('google-auth.js — first-time Google sign-in prompts for an invite code rather than erroring');
{
  const src = google();
  check('no linked account and no invite code yet returns needsSignup, not an error',
    /if \(!inviteCode\) \{[\s\S]{0,200}needsSignup: true/.test(src));
  check('…with a 200, since "no account yet" is an expected first-time state',
    /needsSignup: true, name: identity\.name \}\)\s*\};/.test(src));
}

section('google-auth.js — creating a NEW account via Google uses the same rules as password signup');
{
  const src = google();

  check('an unknown role is refused, same wording as accounts-admin.js',
    /role !== 'organizer' && role !== 'manager'/.test(src));

  check('a manager needs a valid age-group invite code from MANAGER_INVITE_CODES',
    /managerCodesMap\(\)/.test(src) && /Object\.keys\(codes\)\.find\(\(id\) => codes\[id\] === inviteCode\)/.test(src));
  check('…refusing with the same "Incorrect invite code." wording as manager-signup.js',
    /Incorrect invite code\./.test(src));

  check('an organiser needs ORGANIZER_INVITE_CODE, same env var as organizer-signup.js',
    /inviteCode !== process\.env\.ORGANIZER_INVITE_CODE/.test(src));

  /* ⚠️ LOAD-BEARING SINCE 3 AUG 2026. Jay deleted ORGANIZER_INVITE_CODE in
     Netlify, so organiser signup is closed by the ABSENCE of a variable — and
     that only holds while BOTH signup paths refuse on absence, not just on a
     mismatch. organizer-signup.js's half is asserted in test-accounts.js; this
     is the Google half, which had only the mismatch clause pinned and would
     have passed with the absence clause deleted. */
  check('…and refuses on the variable being ABSENT, not just on a mismatch',
    /!process\.env\.ORGANIZER_INVITE_CODE \|\| inviteCode !== process\.env\.ORGANIZER_INVITE_CODE/.test(src),
    'deleting the env var must be enough to shut Google organiser signup off too');

  check('the first-ever organiser is still auto-approved, same bootstrap rule as organizer-signup.js',
    /isFirstOrganizer = role === 'organizer' && !accounts\.some\(\(a\) => a\.role === 'organizer'\)/.test(src));
  check('…and every organiser after that starts pending',
    /approved: role === 'organizer' \? isFirstOrganizer : false/.test(src));
  check('every manager account starts pending regardless of invite code, same as manager-signup.js',
    /approved: role === 'organizer' \? isFirstOrganizer : false/.test(src));

  check('a duplicate username is refused with the exact same message as every other signup path',
    /accounts\.some\(\(a\) => a\.username === uname\)[\s\S]{0,80}That username is already taken\./.test(src));

  check('the created account stores no password — passwordHash is explicitly null, not omitted',
    /passwordHash:\s*null/.test(src));
  check('…and stores the Google identity that created it',
    /googleSub:\s*identity\.sub/.test(src) && /email:\s*identity\.email/.test(src));

  check('an organiser can still set a custom title, same default as organizer-signup.js — not hardcoded to "Organizer"',
    /title:\s*title \|\| 'Organizer'/.test(src));
  const organizerSignupSrc = readRepo(path.join('netlify', 'functions', 'organizer-signup.js'));
  check('…the exact same default wins on a blank title as the password path',
    /title:\s*title \|\| 'Organizer'/.test(organizerSignupSrc));
}

/* Google sign-in and password sign-in must mint the SAME session, or which
   door somebody came through starts to matter to every downstream reader.
   This compared google-auth.js against organizer-login.js / manager-login.js
   until those were retired on 3 Aug 2026; it compares against login.js now —
   which is strictly better, because login.js is the live password endpoint
   and those two were dead code by then. Both halves are asserted, so a drift
   in EITHER file fails this. */
section('google-auth.js — session shape matches the password endpoint (login.js) exactly');
{
  const src = google();
  const passwordLogin = readRepo(path.join('netlify', 'functions', 'login.js'));

  check('organiser session fields match login.js',
    /session: \{ username: account\.username, name: account\.name, role: account\.title \|\| 'Organizer', _role: 'organizer' \}/.test(src)
    && /\{ username: account\.username, name: account\.name, role: account\.title \|\| 'Organizer', _role: 'organizer' \}/.test(passwordLogin));

  check('manager session fields match login.js',
    /session: \{ username: account\.username, name: account\.name, ageGroupId: account\.ageGroupId \}/.test(src)
    && /\{ username: account\.username, name: account\.name, ageGroupId: account\.ageGroupId \}/.test(passwordLogin));

  check('the signed token payload matches login.js for organisers',
    /sign\(\{ username: account\.username, role: 'organizer' \}\)/.test(src)
    && /sign\(\{ username: account\.username, role: 'organizer' \}\)/.test(passwordLogin));
  check('the signed token payload matches login.js for managers',
    /sign\(\{ username: account\.username, role: 'manager', ageGroupId: account\.ageGroupId \}\)/.test(src)
    && /sign\(\{ username: account\.username, role: 'manager', ageGroupId: account\.ageGroupId \}\)/.test(passwordLogin));
}

section('google-config.js — the client id is handed out, nothing else is');
{
  const src = config();
  check('only GET is served', /event\.httpMethod !== 'GET'/.test(src));
  check('returns the client id from the env var, defaulting to null rather than undefined/leaking an error',
    /clientId: process\.env\.GOOGLE_CLIENT_ID \|\| null/.test(src));
  check('the response body has no other fields that could leak account data',
    !/accounts|passwordHash|googleSub|email/.test(src));
}

section('accounts-admin.js — the Accounts tab never receives a raw googleSub');
{
  const src = admin();
  check('googleSub is stripped from the listing the same way passwordHash is',
    /accounts\.map\(\(\{ passwordHash, googleSub, \.\.\.rest \}\)/.test(src));
  check('a human-readable sign-in method is shown instead',
    /signInMethod: googleSub \? 'Google' : 'Password'/.test(src));
}

/* ======================================================================
   FAULTS THIS FILE WAS PROVEN AGAINST — `node tests/_prove-registration.js`.
   Each is caught by the named check:

     * audience check dropped from verifyIdToken
         -> "verifies against OUR OWN client id as the audience..."
     * email_verified === false no longer refused
         -> "refuses a token whose email Google has not itself verified"
     * account lookup switched from googleSub to email
         -> "looks up the account by the STORED googleSub, not by email"
     * duplicate-username check removed
         -> "a duplicate username is refused with the exact same message..."
     * passwordHash left undefined instead of explicit null
         -> "the created account stores no password..."
   ====================================================================== */

summary('test-google-auth.js');
