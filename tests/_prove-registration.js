/* tests/_prove-registration.js
   ------------------------------------------------------------------------
   NOT part of runall.ps1. This is the thing that makes test-registration.js
   worth running: it breaks the real code on purpose, one fault at a time, and
   checks that the suite NOTICES — and that the check which notices is the one
   that claims to be guarding that behaviour.

   Why this exists as a script rather than as a habit: this project has already
   shipped two tests that passed with the real code deleted, and a third that
   matched a comment instead of the code. A test nobody has watched fail is a
   guess. Run it after changing either the shared block or the suite.

   It works on a COPY of the repo in a temp folder — nothing touches the clone.

   Usage:  node _prove-registration.js
*/

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { repoRoot } = require('./_lib');

const SRC = repoRoot();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'adhjrt-prove-'));

/* Only the files the suite reads. Copying the whole clone would drag in
   node_modules and assets for no gain. */
const NEEDED = [
  'CLAUDE.md',
  /* test-back-office-links.js asserts the /organizer rewrite still exists, so
     the fault that removes it needs this file in the temp copy. */
  'netlify.toml',
  /* test-sponsors.js checks the HSBC placements on the match-day app too. */
  'app.html',
  'scores-data.js',
  'organizer-data.js',
  'Quins JRT.dc.html',
  'Organizer.dc.html',
  'Scores & Standings.dc.html',
  path.join('netlify', 'functions', '_registration.js'),
  path.join('netlify', 'functions', '_venue.js'),
  path.join('netlify', 'functions', '_agegroups.js'),
  path.join('netlify', 'functions', '_intake.js'),
  path.join('netlify', 'functions', '_ratelimit.js'),
  path.join('netlify', 'functions', '_teams.js'),
  path.join('netlify', 'functions', '_sheets.js'),
  path.join('netlify', 'functions', 'submit-registration.js'),
  path.join('netlify', 'functions', '_email.js'),
  path.join('netlify', 'functions', '_results.js'),
  path.join('netlify', 'functions', 'get-results.js'),
  path.join('netlify', 'functions', 'get-schedule-override.js'),
  path.join('netlify', 'functions', 'save-schedule-override.js'),
  path.join('netlify', 'functions', 'publish-schedule.js'),
  path.join('netlify', 'functions', 'scoring-rules.js'),
  path.join('netlify', 'functions', 'submit-result.js'),
  path.join('netlify', 'functions', 'venue-layout.js'),
  path.join('netlify', 'functions', 'registration-window.js'),
  path.join('netlify', 'functions', 'get-registrations.js'),
  path.join('netlify', 'functions', 'get-my-registrations.js'),
  path.join('netlify', 'functions', '_scoring.js'),
  path.join('netlify', 'functions', '_publish.js'),
  path.join('netlify', 'functions', '_password.js'),
  path.join('netlify', 'functions', '_auth.js'),
  path.join('netlify', 'functions', 'accounts-admin.js'),
  path.join('netlify', 'functions', 'organizer-signup.js'),
  path.join('netlify', 'functions', 'manager-signup.js'),
  path.join('netlify', 'functions', 'organizer-login.js'),
  path.join('netlify', 'functions', 'manager-login.js'),
  path.join('netlify', 'functions', '_googleAuth.js'),
  path.join('netlify', 'functions', 'google-auth.js'),
  path.join('netlify', 'functions', 'google-config.js'),
];

/* Copies with the line endings NORMALISED to LF.

   Found the hard way: several faults below are multi-line patches, and on
   Windows git checks these files out with CRLF, so an exact-text find written
   with \n matches nothing and the fault silently "could not be injected". Four
   of them failed that way the first time this ran on cafnet — the suites all
   passed, and the thing checking the suites was quietly doing nothing.

   Normalising here rather than in every find string keeps the fault list
   readable and makes this script give the same answer on any machine. Nothing
   binary is in NEEDED, so reading everything as text is safe. */
function seed() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(path.join(TMP, 'netlify', 'functions'), { recursive: true });
  NEEDED.forEach((rel) => {
    const from = path.join(SRC, rel);
    if (!fs.existsSync(from)) return;
    fs.writeFileSync(path.join(TMP, rel), fs.readFileSync(from, 'utf8').replace(/\r\n/g, '\n'));
  });
}

/* The shared block lives in two files. A fault in it has to be injected into
   both, or the identity check fires first and masks whichever check the fault
   was actually aimed at. Patching one file alone is its own separate fault
   (number 9), which is what proves the identity check. */
function patchShared(find, replace) {
  patch(path.join('netlify', 'functions', '_registration.js'), find, replace);
  patch('scores-data.js', find, replace);
}

/* The pitch model is carried twice as well — the server's copy in _venue.js and
   the front end's in scores-data.js, which needs an answer before any fetch
   lands. test-venue-splits.js compares the two lists, so a fault put into one
   file only trips THAT check and says nothing about the one it was aimed at.
   Same reasoning as patchShared; a separate helper because these are not the
   registration block. */
function patchPitchModel(find, replace) {
  patch(path.join('netlify', 'functions', '_venue.js'), find, replace);
  patch('scores-data.js', find, replace);
}

function patch(rel, find, replace) {
  const p = path.join(TMP, rel);
  const t = fs.readFileSync(p, 'utf8');
  if (!t.includes(find)) throw new Error(`fault could not be injected into ${rel}: text not found\n  ${find}`);
  fs.writeFileSync(p, t.split(find).join(replace));
}

/* Runs one suite against the damaged copy and returns its stdout, whether it
   passed or failed. */
function run(file) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [path.join(__dirname, file)],
      { env: { ...process.env, ADHJRT_REPO: TMP }, encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status === undefined ? 1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const INTAKE_F = path.join('netlify', 'functions', '_intake.js');
/* The confirmation block from _intake.js, verbatim, so a fault can move it
   rather than duplicate it. If this stops matching, the fault refuses to inject
   and that is a FAILURE of this script, not a pass. */
const MAIL_BLOCK = [
  '  try {',
  '    const result = await d.sendConfirmation(form, data);',
  '    if (result && result.sent) log(`confirmation sent (${result.count} recipient(s))`);',
  "    else log(`confirmation not sent: ${(result && result.reason) || 'unknown'}`);",
  '  } catch (err) {',
  '    log(`confirmation email failed (the registration WAS saved) - ${err && err.message}`);',
  '  }',
].join('\n');

const REG = path.join('netlify', 'functions', '_registration.js');
const SD = 'scores-data.js';

/* ---- the HSBC placements, verbatim ---------------------------------------
   Same discipline as MAIL_BLOCK above: a fault that MOVES a block has to carry
   the block exactly, so that if the markup is edited the injection refuses
   rather than quietly doing nothing. */
const HOME = 'Quins JRT.dc.html';
const HDR_IMG = '<img src="assets/sponsor-hsbc-white.webp" alt="HSBC" style="height:19px;width:auto;display:block">';
const BAND_IMG = '<img src="assets/sponsor-hsbc-white.webp" alt="HSBC" style="height:54px;width:auto;max-width:100%;display:block">';
const BAND_BLOCK = [
  '  <!-- ============ PRINCIPAL PARTNER BAND ============ -->',
  "  <!-- HSBC are the tournament's principal partner, so the mark gets the first",
  '       slot after the fold - its own band, with nothing else competing for the',
  '       eye. It sits BETWEEN the hero and the stat strip deliberately: inside the',
  '       hero it would fight the headline and the two Register buttons, and below',
  '       the stat strip it would be just another row on a long page.',
  '       Same #0C0C0E as the hero above it, so the two read as one block and the',
  "       stat strip's colour is still the first break on the page. -->",
  '  <section id="partner" style="background:#0C0C0E;color:#fff;padding:34px 32px 40px">',
  '    <div style="max-width:1200px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:16px" data-reveal>',
  '      <span style="font-size:11px;letter-spacing:2.4px;color:#3bd070;font-weight:800;text-transform:uppercase">In partnership with</span>',
  '      ' + BAND_IMG,
  '    </div>',
  '  </section>',
  '',
  '',
].join('\n');

const FAULTS = [
  {
    name: 'the opening boundary is made exclusive (t <= o)',
    suite: 'test-registration.js',
    apply: () => patchShared('else if (t < o) phase = \'before\';', 'else if (t <= o) phase = \'before\';'),
    expect: ['exactly at opening'],
  },
  {
    name: 'the closing boundary is made inclusive (t > c)',
    suite: 'test-registration.js',
    apply: () => patchShared('else if (c !== null && t >= c) phase = \'after\';', 'else if (c !== null && t > c) phase = \'after\';'),
    expect: ['exactly at closing'],
  },
  {
    name: 'the unreadable-clock guard is deleted',
    suite: 'test-registration.js',
    apply: () => patchShared('  if (!Number.isFinite(t)) phase = \'unset\';', '  if (false) phase = \'unset\';'),
    expect: ['fails CLOSED when now is'],
  },
  {
    name: 'a closing date with no opening date is allowed to run',
    suite: 'test-registration.js',
    apply: () => patchShared('  else if (o === null) phase = \'unset\';', '  else if (o === null && c === null) phase = \'unset\';'),
    expect: ['closing date with no opening date'],
  },
  {
    name: 'force closed is made to rewrite the phase as well',
    suite: 'test-registration.js',
    apply: () => patchShared(
      "  const open = mode === 'open' ? true : (mode === 'closed' ? false : phase === 'open');",
      "  if (mode === 'closed') phase = 'after';\n  const open = mode === 'open' ? true : (mode === 'closed' ? false : phase === 'open');"),
    expect: ['force closed: phase still says open'],
  },
  {
    name: 'a same-day window is allowed to close before it opens (c < o)',
    suite: 'test-registration.js',
    apply: () => patchShared('  if (o !== null && c !== null && c <= o) {', '  if (o !== null && c !== null && c < o) {'),
    expect: ['closes at the very instant it opens'],
  },
  {
    name: 'the +04:00 offset is dropped from stored stamps',
    suite: 'test-registration.js',
    apply: () => patchShared(
      "  return ymd + (endOfDay ? 'T23:59:59' : 'T00:00:00') + REGISTRATION_TZ_OFFSET;",
      "  return ymd + (endOfDay ? 'T23:59:59' : 'T00:00:00') + 'Z';"),
    expect: ['Abu Dhabi', 'opening date is stored at the START'],
  },
  {
    name: 'the calendar-validity check is removed (31 Feb rolls forward)',
    suite: 'test-registration.js',
    apply: () => patchShared('  if (!isRealDate(ymd)) return null;',
      "  if (typeof ymd !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(ymd)) return null;"),
    expect: ['stampFromDate refuses an impossible day'],
  },
  {
    name: 'validateSettings stops checking the calendar (31 Feb is stored)',
    suite: 'test-registration.js',
    apply: () => patchShared(
      "    if (/^\\d{4}-\\d{2}-\\d{2}/.test(s) && !isRealDate(s.slice(0, 10))) {",
      '    if (false) {'),
    expect: ['refused as a bare date: 31 February', 'refused as a full stamp: 31 February'],
  },
  {
    name: 'the shared block is edited in one file only',
    suite: 'test-registration.js',
    apply: () => patch(SD, "const REGISTRATION_MODES = ['auto', 'open', 'closed'];",
      "const REGISTRATION_MODES = ['auto', 'open', 'closed']; // drifted"),
    expect: ['character-for-character identical'],
  },
  {
    name: 'the whole shared block is emptied in both files',
    suite: 'test-registration.js',
    apply: () => {
      const S = '/* ===== REGISTRATION WINDOW — SHARED BLOCK (start) =====';
      const E = '/* ===== REGISTRATION WINDOW — SHARED BLOCK (end) ===== */';
      [REG, SD].forEach((rel) => {
        const p = path.join(TMP, rel);
        const t = fs.readFileSync(p, 'utf8');
        fs.writeFileSync(p, t.slice(0, t.indexOf(S)) + S + '\n*/\n' + E + t.slice(t.indexOf(E) + E.length));
      });
    },
    expect: ['real block, not an empty one', 'the registration module loads at all'],
  },
  {
    name: 'fmtWindowDate is rewritten to go through a Date object',
    suite: 'test-registration.js',
    apply: () => patchShared(
      "  const name = REGISTRATION_MONTHS[Number(m) - 1];\n  if (!name) return '';",
      "  const name = REGISTRATION_MONTHS[new Date(stamp).getMonth()];\n  if (!name) return '';"),
    expect: ['every answer is the same in'],
  },
  {
    name: 'organizer-data.js grows its own copy of registrationState',
    suite: 'test-registration.js',
    apply: () => patch('organizer-data.js', "export {\n  registrationState,",
      "function registrationState() { return { open: true }; }\nexport {\n  registrationState,"),
    expect: ['does not define its own registrationState'],
  },
  /* ---- the venue schematic ---- */
  {
    /* Replaces an earlier fault that swapped the greedy `.*` for a lazy one.
       That was NOT caught — and it should not have been, because backtracking
       makes the two forms identical when the tail is one anchored letter. The
       code comment claiming otherwise was wrong and has been corrected. This is
       the real fault in the same function. */
    name: 'blockOfPitch stops normalising case (c4b and C4a become two blocks)',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '  return (m ? m[1] : s).toUpperCase();', '  return (m ? m[1] : s);'),
    expect: ['case is normalised'],
  },
  {
    name: 'the sub-pitch letter is no longer stripped (every pitch its own block)',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '  return (m ? m[1] : s).toUpperCase();', '  return s.toUpperCase();'),
    expect: ['D5a is in block D5', 'groups 18 pitches into 9 blocks'],
  },
  {
    name: 'B1 loses its place on the drawing',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', "B1: '2 / 4', ", ''),
    expect: ['block B1 has a place on the drawing'],
  },
  {
    name: 'the C blocks are staggered back above the B row',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', "C4: '2 / 1', C5: '2 / 2', B2: '2 / 3',", "C4: '1 / 6', C5: '1 / 7', B2: '2 / 3',"),
    expect: ['parallel with the B blocks'],
  },
  {
    name: 'the A blocks are moved to the left of the B blocks',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', "B1: '2 / 4', A1: '2 / 5',", "B1: '2 / 5', A1: '2 / 4',"),
    expect: ['right of the B blocks'],
  },
  {
    name: 'two blocks are given the same cell',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', "D1: '1 / 5',", "D1: '1 / 4',"),
    expect: ['no two blocks are placed in the same cell'],
  },
  {
    name: 'a time-share is drawn in the warning colour',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', "              border = '1px solid rgba(255,255,255,0.34)';", "              border = '1px solid #f5c518';"),
    expect: ['NOT in a warning colour'],
  },
  {
    name: 'a shared pitch shows only the first group',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', "              who = users.map((a) => a.toUpperCase()).join(' · ');", '              who = users[0].toUpperCase();'),
    expect: ['D4a names both groups'],
  },
  {
    name: 'unused pitches stop being reported',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '      if (unused.length) {', '      if (false) {'),
    expect: ['named in the notes'],
  },
  {
    name: 'a pitch is silently dropped from its block',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '        byBlock[b].push(p);', '        if (byBlock[b].length < 2) byBlock[b].push(p);'),
    expect: ['every Saturday pitch is drawn exactly once'],
  },
  /* ---- the map view, the lock and the drag ---- */
  {
    name: 'the lock is ignored when a block is grabbed',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '    if (this.state.vLocked) return;\n    if (e && e.preventDefault) e.preventDefault();', '    if (e && e.preventDefault) e.preventDefault();'),
    expect: ['locked: pointing at a block starts no drag', 'locked: the block does not move'],
  },
  {
    name: 'the grab offset is dropped (the block snaps under the cursor)',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '    const offX = (p && at) ? p.x - Number(at.x) : 0;', '    const offX = 0;'),
    expect: ['the grab offset is preserved'],
  },
  {
    name: 'a block can be dragged off the map (clamp removed)',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '  static clampPct(n) { return Math.min(100, Math.max(0, Math.round(n * 10) / 10)); }', '  static clampPct(n) { return Math.round(n * 10) / 10; }'),
    expect: ['clamps to 0,0', 'clampPct floors at 0'],
  },
  {
    name: 'positions stop being rounded (the dirty flag flickers)',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '  static clampPct(n) { return Math.min(100, Math.max(0, Math.round(n * 10) / 10)); }', '  static clampPct(n) { return Math.min(100, Math.max(0, n)); }'),
    expect: ['rounded to a tenth', 'clampPct rounds'],
  },
  {
    name: 'an unmeasurable map is guessed at instead of ignored',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '    if (!r) return null;\n    return { x: ((e.clientX - r.left) / r.width) * 100', '    if (!r) return { x: 50, y: 50 };\n    return { x: ((e.clientX - r.left) / r.width) * 100'),
    expect: ['no pointer position', 'null, not a guess'],
  },
  {
    name: 'the dirty check stops watching the block positions',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', "    return JSON.stringify(venuePositions || {}) !== JSON.stringify(venuePositionsSaved || {});", '    return false;'),
    expect: ['moving a block makes the layout dirty'],
  },
  {
    name: 'Save stops sending the positions',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', 'this.state.api.saveVenue(this.state.venue, this.state.venuePositions || undefined)', 'this.state.api.saveVenue(this.state.venue)'),
    expect: ['Save passes the positions to the data layer'],
  },
  {
    name: 'blocks are anchored by their corner instead of their centre',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', 'transform:translate(-50%,-50%);', ''),
    expect: ['and centred on it'],
  },
  {
    name: 'touch-action is dropped, so dragging on a phone scrolls the page',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', "'cursor:grab;touch-action:none;'", "'cursor:grab;'"),
    expect: ['will not scroll the page instead'],
  },
  {
    name: 'validatePositions stops range-checking',
    suite: 'test-venue-map.js',
    apply: () => patch(path.join('netlify', 'functions', '_venue.js'),
      "    if (x < 0 || x > 100 || y < 0 || y > 100) { errors.push(`\"${key}\" is at ${x}, ${y}",
      "    if (false) { errors.push(`\"${key}\" is at ${x}, ${y}"),
    expect: ['a coordinate past the right edge', 'a negative coordinate'],
  },
  /* ---- logins and passwords ----
     The first two put back the exact bug that was live: a function the page
     calls that does not exist. Both features were dead and silent. */
  {
    name: 'resetAccountPassword disappears from the data layer again',
    suite: 'test-accounts.js',
    apply: () => patch('organizer-data.js', 'export async function resetAccountPassword(', 'async function resetAccountPassword('),
    expect: ['provides api.resetAccountPassword()', 'resetAccountPassword exists'],
  },
  {
    name: 'changeMyPassword disappears from the data layer again',
    suite: 'test-accounts.js',
    apply: () => patch('organizer-data.js', 'export async function changeMyPassword(', 'async function changeMyPassword('),
    expect: ['provides api.changeMyPassword()', 'changeMyPassword exists'],
  },
  {
    name: "the 'password' action is removed from the backend",
    suite: 'test-accounts.js',
    apply: () => patch(path.join('netlify', 'functions', 'accounts-admin.js'), "if (action === 'password') {", 'if (false) {'),
    expect: ["handles action 'password'", "'password' is handled"],
  },
  {
    name: 'changing your own password stops checking the current one',
    suite: 'test-accounts.js',
    apply: () => patch(path.join('netlify', 'functions', 'accounts-admin.js'),
      '        if (!(await verifyPassword(current, all[me].passwordHash))) {',
      '        if (false) {'),
    expect: ['verifies it against the stored hash'],
  },
  {
    name: 'the password floor drops back to 6',
    suite: 'test-accounts.js',
    apply: () => patch(path.join('netlify', 'functions', '_password.js'), 'const MIN_PASSWORD_LENGTH = 10;', 'const MIN_PASSWORD_LENGTH = 6;'),
    expect: ['it is at least 10'],
  },
  {
    name: "the page's copy of the floor is left behind at the old number",
    suite: 'test-accounts.js',
    apply: () => patch('Organizer.dc.html', 'const MIN_PASSWORD_LENGTH = 10;', 'const MIN_PASSWORD_LENGTH = 6;'),
    expect: ['uses the same minimum as the server'],
  },
  {
    /* The one that would lock the whole committee out on the morning somebody
       needed in, because every existing password predates the new floor. */
    name: 'a length check is added to organizer-login.js',
    suite: 'test-accounts.js',
    /* The realistic regression: somebody applies the shared rule "for
       consistency" at the one place it must never be applied, and every account
       whose password predates the new floor stops being able to sign in.

       TWO EARLIER VERSIONS OF THIS FAULT WERE NOT CAUGHT, and both were the
       fault's fault rather than the check's. The first added a harmless
       `p.length` that did not resemble the mistake at all. The second added
       only the IMPORT — and importing without calling really is harmless, so a
       check that fired on it would be wrong. A fault has to be the actual
       mistake, not something adjacent to it. */
    apply: () => {
      const f = path.join('netlify', 'functions', 'organizer-login.js');
      patch(f, "const { loadAccounts, verifyPassword, sign, blobStore } = require('./_auth');",
        "const { loadAccounts, verifyPassword, sign, blobStore, passwordProblem } = require('./_auth');");
      patch(f, "    if (!account || !account.passwordHash || !(await verifyPassword(password || '', account.passwordHash))) {",
        "    if (passwordProblem(password)) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Password too short.' }) };\n    if (!account || !account.passwordHash || !(await verifyPassword(password || '', account.passwordHash))) {");
    },
    expect: ['does NOT check password length'],
  },
  {
    name: 'creating a manager stops requiring an age group',
    suite: 'test-accounts.js',
    apply: () => patch(path.join('netlify', 'functions', 'accounts-admin.js'), "          if (!ageGroupId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'A manager login needs an age group.' }) };", ''),
    expect: ['a manager still needs an age group'],
  },
  {
    name: 'deleting ORGANIZER_INVITE_CODE stops shutting off self-signup',
    suite: 'test-accounts.js',
    apply: () => patch(path.join('netlify', 'functions', 'organizer-signup.js'),
      'if (!process.env.ORGANIZER_INVITE_CODE || inviteCode !== process.env.ORGANIZER_INVITE_CODE) {',
      'if (inviteCode !== process.env.ORGANIZER_INVITE_CODE) {'),
    expect: ['a missing invite code refuses every signup'],
  },
  {
    name: 'the Registration tab stops reading the shared validator',
    suite: 'test-registration-panel.js',
    apply: () => patch('Organizer.dc.html', 'api.validateSettings(', 'this._ownValidate('),
    expect: ['shared validateSettings', 'Registration panel'],
  },
  {
    name: 'the homepage stops gating the Register buttons',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      "    if (this.regState().open) this.openTeamModal();\n    else this.flashToast(this.closedToast('team'));",
      '    this.openTeamModal();'),
    expect: ['Register a team'],
  },
  {
    name: 'the TEST MODE strip is disconnected from forced-open',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html', 'regTestMode: rs.open && rs.forced,', 'regTestMode: false,'),
    expect: ['TEST MODE'],
  },
  {
    name: 'the homepage falls back to OPEN before the fetch lands',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html', "  regState() {\n    const s = this.state.reg;", "  regState() {\n    if (!this.state.reg) return { open: true, phase: 'open', forced: false, mode: 'auto', opensAt: null, closesAt: null };\n    const s = this.state.reg;"),
    expect: ['before the window has loaded'],
  },

  /* ---- the main-pitch / split model ------------------------------------
     Everything below is aimed at one question: can a split change silently
     move an age group off the ground it was given, or rename a surface a
     saved fixture is sitting on. */

  {
    name: 'B2 is put back into the list of main pitches',
    suite: 'test-venue-splits.js',
    apply: () => patchPitchModel("'C1', 'B1', 'A1'", "'C1', 'B1', 'B2', 'A1'"),
    expect: ['B2 is NOT one of ours'],
  },
  {
    name: 'halves are suffixed 1/2 instead of A/B',
    suite: 'test-venue-splits.js',
    apply: () => patchPitchModel("2: ['a', 'b'],", "2: ['1', '2'],"),
    /* The one that matters is the shipped-layout check: renaming a suffix
       renames every surface the site already has fixtures on. */
    expect: ['Saturday derives exactly the shipped surfaces', 'halves get A and B'],
  },
  {
    name: 'a whole pitch is given an A suffix',
    suite: 'test-venue-splits.js',
    apply: () => patchPitchModel("SPLIT_SUFFIXES = { 1: [''],", "SPLIT_SUFFIXES = { 1: ['A'],"),
    expect: ['Saturday derives exactly the shipped surfaces', 'whole keeps the bare name'],
  },
  {
    name: 'a group is given only the first part when a pitch is split',
    suite: 'test-venue-splits.js',
    apply: () => patchPitchModel(
      '    SPLIT_SUFFIXES[after].forEach((suffix) => add(main + suffix));',
      '    add(main + SPLIT_SUFFIXES[after][0]);'),
    expect: ['whole pitch stays whole'],
  },
  {
    name: 'a group loses its allocation entirely when a split changes',
    suite: 'test-venue-splits.js',
    apply: () => patchPitchModel(
      '    SPLIT_SUFFIXES[after].forEach((suffix) => add(main + suffix));',
      '    return;'),
    expect: ['splitting a whole pitch gives both halves'],
  },
  {
    name: 'the panel stops remapping groups when it changes a split',
    suite: 'test-venue-splits.js',
    apply: () => patch('Organizer.dc.html',
      '        nv[dayId].groups[ag] = api.remapGroupPitches(nv[dayId].groups[ag], oldSplits, newSplits);',
      '        nv[dayId].groups[ag] = nv[dayId].groups[ag];'),
    expect: ['keeps the ground it had'],
  },
  {
    name: 'validateVenue trusts the payload’s pitches instead of rebuilding them',
    suite: 'test-venue-splits.js',
    apply: () => patch(path.join('netlify', 'functions', '_venue.js'),
      '    const pitches = derivePitches(splits);',
      '    const pitches = Array.isArray(src.pitches) && src.pitches.length ? src.pitches : derivePitches(splits);'),
    expect: ['corrected, not trusted'],
  },
  {
    name: 'splitsFromPitches rounds an odd surface count DOWN',
    suite: 'test-venue-splits.js',
    apply: () => patch(path.join('netlify', 'functions', '_venue.js'),
      '    out[main] = n <= 1 ? 1 : (n <= 2 ? 2 : 4);',
      '    out[main] = n >= 4 ? 4 : (n >= 2 ? 2 : 1);'),
    expect: ['rounds up rather than dropping'],
  },
  {
    name: 'the age-group rows offer pitches that are not in use that day',
    suite: 'test-venue-splits.js',
    apply: () => patch('Organizer.dc.html',
      '          .filter((main) => Number((v[dayId].splits || {})[main]) > 0)',
      '          .filter(() => true)'),
    expect: ['only pitches in use that day are offered'],
  },
  {
    name: 'the day card stops showing pitches that are not in use',
    suite: 'test-venue-splits.js',
    apply: () => patch('Organizer.dc.html',
      '      const mains = MAINS.map((main) => {',
      '      const mains = MAINS.filter((main) => Number(splits[main]) > 0).map((main) => {'),
    expect: ['all fifteen main pitches show on Saturday', 'C1 shows as not used today'],
  },
  {
    name: 'taking a pitch out of the day stops asking first',
    suite: 'test-venue-splits.js',
    apply: () => patch('Organizer.dc.html',
      '      this.confirmModal(msg, apply, { okLabel: `Remove ${main}`, wide: true });\n      return;',
      '      apply();\n      return;'),
    expect: ['taking a pitch out opens a confirm'],
  },
  {
    name: 'a split change that strands saved fixtures stops warning',
    suite: 'test-venue-splits.js',
    apply: () => patch('Organizer.dc.html',
      '    const used = stranded.reduce((t, nm) => t + (usage[nm] || 0), 0);',
      '    const used = 0;'),
    expect: ['a split with saved matches on it asks first'],
  },
  {
    name: 'the free-text pitch box is put back',
    suite: 'test-venue-splits.js',
    apply: () => patch('Organizer.dc.html',
      '  setPitchSplit(dayId, main, n) {',
      '  addPitch(dayId) { return dayId; }\n\n  setPitchSplit(dayId, main, n) {'),
    expect: ['no addPitch handler remains'],
  },
  {
    name: 'the two DEFAULT_VENUE copies are allowed to drift apart',
    suite: 'test-venue-splits.js',
    apply: () => patch('scores-data.js', "D3: 2, D2: 1, D1: 1", "D3: 1, D2: 1, D1: 1"),
    expect: ['the server and front-end layouts are deep-equal', 'including Saturday splits'],
  },

  /* ---- the map chips being readable -----------------------------------
     Every one of these was possible before 27 Jul 2026 and one of them was
     actually shipped: white text on a see-through chip. */

  {
    name: 'the chip ink goes back to always-white',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html',
      'text-align:center;color:${chipFg};', 'text-align:center;color:#fff;'),
    expect: ['carries dark ink', 'not hard-coded to white'],
  },
  {
    name: 'the chip is made see-through again (the original bug)',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '            ? fills[0]', "            ? fills[0] + 'E0'"),
    expect: ['the chip is opaque'],
  },
  {
    name: 'a time-shared chip picks its ink from the first tint only',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html',
      '  const worst = (ink) => list.reduce((m, t) => Math.min(m, contrastRatio(ink, t)), Infinity);',
      '  const worst = (ink) => contrastRatio(ink, list[0]);'),
    expect: ['time-share chip takes dark ink', 'clears'],
  },
  {
    name: 'the contrast top-up is removed, leaving two tints just short',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html',
      '    for (let step = 1; step <= 8 && contrastRatio(ink, c) < CHIP_MIN_CONTRAST; step += 1) {',
      '    for (let step = 1; step <= 0; step += 1) {'),
    expect: ['clears'],
  },
  {
    name: 'the top-up is applied to every tint instead of only the ones that need it',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '    let c = t;', '    let c = mixHex(t, away, 0.05);'),
    expect: ['is left exactly as it is', 'need no adjustment'],
  },
  {
    name: 'relLuminance drops the sRGB gamma step',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html',
      '    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);',
      '    return c;'),
    /* Note what does NOT catch this: the contrast ratios still clear 4.5,
       because the top-up compensates for the worse ink choice. The damage
       shows as more colours being nudged than need to be — and, directly, as
       mid-grey reading 50% instead of 21.6%. */
    expect: ['the gamma step is applied', 'need no adjustment'],
  },
  {
    name: 'contrastRatio drops the +0.05 offsets, so dark colours score absurdly well',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html',
      '  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);',
      '  return Math.max(la, lb) / Math.min(la, lb);'),
    expect: ['black on white is the maximum ratio', 'white ink on U6 red', 'clears'],
  },
  {
    name: 'the block name on the map shrinks back to 11px',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html',
      "mapNameStyle: 'font-weight:900;font-size:16px;", "mapNameStyle: 'font-weight:900;font-size:11px;"),
    expect: ['the block name is at least 14px'],
  },
  {
    name: 'every chip reports its pitch as whole',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '  return `×${surfaceCount}`;', "  return '×1';"),
    expect: ['is in halves on Saturday, and says so', 'B1 is in quarters'],
  },
  {
    name: 'the tooltip stops saying how the pitch is split',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '${splitLabel(byBlock[b].length)}: ', ''),
    expect: ['the tooltip spells it out'],
  },

  /* ---- the age-group table ---------------------------------------------
     The squad cap is about to be enforced server-side for the first time, so
     the server's copy of the table drifting from the client's stops being
     cosmetic and starts letting oversized squads into a contact age grade. */

  {
    name: "U16B's squad cap is raised on the server only (18 -> 20)",
    suite: 'test-agegroups.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      "{ id: 'u16b', name: 'U16B Contact', ages: [14, 15], format: '12s', squad: 18 },",
      "{ id: 'u16b', name: 'U16B Contact', ages: [14, 15], format: '12s', squad: 20 },"),
    expect: ['U16B Contact squad cap', 'exactly the client table'],
  },
  {
    name: "U16G's squad is 'tidied' to match the boys' group of the same age",
    suite: 'test-agegroups.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      "{ id: 'u16g', name: 'U16G Contact', ages: [14, 15], format: '7s', squad: 12 },",
      "{ id: 'u16g', name: 'U16G Contact', ages: [14, 15], format: '7s', squad: 18 },"),
    expect: ['U16G Contact squad cap', 'exactly the client table'],
  },
  {
    name: 'an unrecognised age group falls back to the SMALLEST cap instead of the largest',
    suite: 'test-agegroups.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      '  return g ? g.squad : MAX_SQUAD_ANY_GROUP;',
      '  return g ? g.squad : 12;'),
    expect: ['falls back to the largest cap'],
  },
  {
    name: 'squadCap is made case-insensitive, so a near-miss quietly resolves',
    suite: 'test-agegroups.js',
    apply: () => {
      const f = path.join('netlify', 'functions', '_agegroups.js');
      patch(f, 'AGE_GROUP_BY_NAME[g.name] = g;', 'AGE_GROUP_BY_NAME[g.name.toLowerCase()] = g;');
      patch(f, "  const g = AGE_GROUP_BY_NAME[typeof name === 'string' ? name : ''];",
        "  const g = AGE_GROUP_BY_NAME[typeof name === 'string' ? name.trim().toLowerCase() : ''];");
    },
    expect: ['the wrong case is not the same group', 'trailing space is not the same group'],
  },
  {
    name: 'an age-group id drifts away from the one the venue layout keys on',
    suite: 'test-agegroups.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      "{ id: 'u12g', name: 'U12G QR',", "{ id: 'u12girls', name: 'U12G QR',"),
    expect: ['is an age group the venue layout knows', 'exactly the client table'],
  },
  {
    name: 'MAX_SQUAD_ANY_GROUP is typed as a constant and left behind',
    suite: 'test-agegroups.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      'const MAX_SQUAD_ANY_GROUP = Math.max(...AGE_GROUPS.map((g) => g.squad));',
      'const MAX_SQUAD_ANY_GROUP = 15;'),
    expect: ['the largest squad anywhere is 18', 'derived from the table'],
  },

  /* ---- the sheet columns ------------------------------------------------
     Every one of these was possible while the order lived in three hand-synced
     copies, and every one of them is silent: no error, no crash, just a sheet
     full of children's details with a column in the wrong place. */

  {
    name: 'preferred-pool is moved next to age group, where it reads as if it belongs',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "  'submittedAt', 'club', 'team-code', 'age-group',\n  'head-coach-name'",
      "  'submittedAt', 'club', 'team-code', 'age-group', 'preferred-pool',\n  'head-coach-name'"),
    expect: ['team columns', 'fourteen of them'],
  },
  {
    name: 'the reader\u2019s output names shift by one against the columns',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "const TEAM_OUT = [\n  'submittedAt', 'club', 'teamName', 'ageGroup',",
      "const TEAM_OUT = [\n  'submittedAt', 'teamName', 'club', 'ageGroup',"),
    expect: ['club survives the round trip', 'the team output names'],
  },
  {
    name: 'a parent\u2019s phone lands in the emergency-contact box (one column out)',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "    parentMobile: col('parent-phone'),",
      "    parentMobile: col('emergency-phone'),"),
    expect: ['the parent phone is the parent phone', 'names are joined'],
  },
  {
    name: 'the emergency contact is built from the parent\u2019s name',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "    emergencyContact: joinName(row, PLAYER_COLUMNS, 'emergency-first-name', 'emergency-last-name'),",
      "    emergencyContact: joinName(row, PLAYER_COLUMNS, 'parent-first-name', 'parent-last-name'),"),
    expect: ['the emergency contact is not the parent', 'names are joined'],
  },
  {
    name: 'a blank cell reaches the sheet as undefined instead of an empty string',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "const cell = (v) => (v === undefined || v === null ? '' : String(v));",
      'const cell = (v) => v;'),
    expect: ['a field nobody filled in is an empty string', 'every cell is a string'],
  },
  {
    name: 'a short row from Sheets gives undefined instead of blanks',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      'const at = (row, i) => cell((Array.isArray(row) ? row : [])[i]);',
      'const at = (row, i) => (Array.isArray(row) ? row : [])[i];'),
    expect: ['a short row still has every field', 'not undefined', 'and the missing ones are blank'],
  },
  {
    name: 'a missing half of a name pair leaves a stray space',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'), '    .filter(Boolean).join(\' \');', "    .join(' ');"),
    expect: ['a name built from nothing is blank', 'first name only', 'last name only'],
  },
  {
    name: 'a column is added but the A1 range is left behind (Sheets drops the overflow)',
    suite: 'test-intake.js',
    /* THE FAULT HAS TO BE THE ACTUAL MISTAKE. Hardcoding the range to 'A:N' on
       its own changes nothing — A:N IS fourteen columns today, so the first
       version of this fault was a no-op and was correctly not caught. The real
       mistake is adding a column and leaving the range behind: the row is then
       fifteen wide, the range is fourteen, and Sheets silently drops the
       fifteenth with no error anywhere. */
    apply: () => {
      patch(path.join('netlify', 'functions', '_intake.js'),
        "const TEAM_RANGE = `A:${colLetter(TEAM_COLUMNS.length)}`;      // A:N",
        "const TEAM_RANGE = 'A:N';");
      patch(path.join('netlify', 'functions', '_intake.js'),
        "  'num-players', 'notes', 'players', 'preferred-pool',\n];",
        "  'num-players', 'notes', 'players', 'preferred-pool', 'new-field',\n];");
    },
    expect: ['exactly as wide as the team columns'],
  },
  {
    name: 'the submitted body is allowed to supply its own team code',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "  return rowFrom(TEAM_COLUMNS, { ...(data || {}), submittedAt, 'team-code': teamCode });",
      "  return rowFrom(TEAM_COLUMNS, { submittedAt, 'team-code': teamCode, ...(data || {}) });"),
    expect: ['a submitted team code cannot override', 'a submitted timestamp cannot override'],
  },
  {
    name: 'a reader grows its own copy of the column order again',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'get-registrations.js'),
      'exports.handler = async (event) => {',
      "const TEAM_FIELDS = ['submittedAt', 'club'];\n\nexports.handler = async (event) => {"),
    expect: ['has no TEAM_FIELDS of its own'],
  },

  /* ---- the allow-list ---------------------------------------------------
     The gateway turns an endpoint Netlify Forms used to guard into a public,
     unauthenticated one that writes children's data to a sheet and sends mail
     from our own domain. This is the filter that decides what it will even
     look at. */

  {
    name: 'the allow-list is removed and every submitted field is kept',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '    if (allowed.indexOf(k) >= 0) clean[k] = src[k];\n    else dropped.push(k);',
      '    clean[k] = src[k];'),
    expect: ['an unknown field is dropped', 'a submitted team code never gets in'],
  },
  {
    name: 'the generated team code becomes something the body can supply',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "      'num-players', 'notes', 'players',\n    ],",
      "      'num-players', 'notes', 'players', 'team-code',\n    ],"),
    expect: ['a submitted team code never gets in'],
  },
  {
    name: 'the clean object gets a prototype back',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '  const clean = Object.create(null);', '  const clean = {};'),
    expect: ['no prototype at all'],
  },
  {
    name: 'an unknown form name is cleaned to nothing instead of refused',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '  if (!spec) return null;',
      '  if (!spec) return { clean: Object.create(null), dropped: [] };'),
    expect: ['an unknown form is refused'],
  },
  {
    name: 'the form name is matched case-insensitively, so two spellings exist',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "  const spec = FORMS[typeof form === 'string' ? form : ''];",
      "  const spec = FORMS[typeof form === 'string' ? form.toLowerCase() : ''];"),
    expect: ['the wrong case is not the same form'],
  },
  {
    name: 'the honeypot is filtered out before validation can look at it',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '  const allowed = spec.fields.concat([HONEYPOT]);', '  const allowed = spec.fields;'),
    expect: ['bot-field is allowed through'],
  },
  {
    name: 'the honeypot is made a real field, so a bot trap becomes a sheet write',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "      'num-players', 'notes', 'players',\n    ],",
      "      'num-players', 'notes', 'players', 'bot-field',\n    ],"),
    expect: ['not in either field list by accident', 'has a column to go in'],
  },
  {
    name: 'a dropped field stops being reported, so nothing can be logged',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'), '    else dropped.push(k);', '    else if (false) dropped.push(k);'),
    expect: ['reported by name so it can be logged', 'all three are reported'],
  },
  {
    name: 'a real column is dropped from the field list, so nobody can ever fill it',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "      'club', 'age-group', 'preferred-pool',", "      'club', 'age-group',"),
    expect: ['is a field a coach can fill in'],
  },
  {
    name: 'a team field is added to the player form, where it has no column',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "      'medical-notes', 'consent', 'play-up-consent',",
      "      'medical-notes', 'consent', 'play-up-consent', 'head-coach-name',"),
    expect: ['has a column to go in', 'a TEAM field on the player form is dropped'],
  },
  {
    name: 'the two forms are pointed at the same sheet',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "    sheetEnv: 'GOOGLE_SHEET_ID_PLAYERS',", "    sheetEnv: 'GOOGLE_SHEET_ID_TEAMS',"),
    expect: ['players go to the players sheet', 'the two are not the same sheet'],
  },

  /* ---- validation -------------------------------------------------------
     The squad cap has never been enforced anywhere but the browser. These are
     the faults that decide whether it now is. */

  {
    name: 'the squad cap stops being checked at all',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'), '    if (roster.length > cap) {', '    if (false) {'),
    expect: ['19 is one too many', 'the sentence is the one the browser uses'],
  },
  {
    name: 'the cap is off by one, so one extra player always gets through',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'), '    if (roster.length > cap) {', '    if (roster.length > cap + 1) {'),
    expect: ['19 is one too many'],
  },
  {
    name: 'the cap is read from the largest group instead of the one submitted',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'), '    const cap = squadCap(groupName);', '    const cap = 18;'),
    expect: ['the cap follows the GROUP', '18 in U16G is NOT allowed'],
  },
  {
    name: 'the cap sentence drifts from the one the browser shows',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      'players and you have listed ${roster.length}. Please remove ${over}.`',
      'players and you have listed ${roster.length}. Please remove ${over} of them.`'),
    expect: ['the sentence is the one the browser uses'],
  },
  {
    name: 'the required-field check passes if ANY one field is filled in',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '    if (!filled(d[f])) return bad(req.message, f);',
      '    if (req.fields.every((x) => !filled(d[x]))) return bad(req.message, f);'),
    expect: ['is refused'],
  },
  {
    name: 'whitespace counts as a filled-in field',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "const filled = (v) => text(v).trim().length > 0;",
      'const filled = (v) => text(v).length > 0;'),
    expect: ['whitespace does not count as a'],
  },
  {
    name: 'the team form starts requiring an age group on the PLAYER form too',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "      'emergency-first-name', 'emergency-last-name', 'emergency-phone',\n    ],\n    message: 'Please fill in the player name",
      "      'emergency-first-name', 'emergency-last-name', 'emergency-phone', 'age-group',\n    ],\n    message: 'Please fill in the player name"),
    expect: ['a player with no age group is accepted'],
  },
  {
    name: 'anything truthy is accepted as medical consent',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "  if (form === 'player-registration' && text(d.consent) !== 'Yes') {",
      "  if (form === 'player-registration' && !filled(d.consent)) {"),
    expect: ['is not consent'],
  },
  {
    name: 'consent stops being checked entirely',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "  if (form === 'player-registration' && text(d.consent) !== 'Yes') {", '  if (false) {'),
    expect: ['is not consent', 'missing consent is not consent'],
  },
  {
    name: 'an unrecognised age group is waved through',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '  if (groupName && !AGE_GROUP_BY_NAME[groupName]) {', '  if (false) {'),
    expect: ['is not one of the fifteen', 'never reaches the cap check'],
  },
  {
    name: 'the age group is matched case-insensitively',
    suite: 'test-intake.js',
    apply: () => {
      patch(path.join('netlify', 'functions', '_agegroups.js'),
        'AGE_GROUP_BY_NAME[g.name] = g;', 'AGE_GROUP_BY_NAME[g.name.toLowerCase()] = g;');
      patch(path.join('netlify', 'functions', '_intake.js'),
        "  const groupName = text(d['age-group']).trim();",
        "  const groupName = text(d['age-group']).trim().toLowerCase();");
    },
    expect: ['is not one of the fifteen'],
  },
  {
    name: 'a squad list that is not an array is accepted',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'), '    if (!Array.isArray(roster)) {', '    if (false) {'),
    expect: ['is refused', 'points at admin@adhjrt.com'],
  },

  /* ---- the roster's dates of birth — sub-project 2, added 28 Jul 2026 ----
     No new rule: this reuses ageGroupCheck() (_agegroups.js), itself a copy
     of _playerAgeCheck(). These faults are aimed at whether it is actually
     WIRED IN — server side, and separately, client side — not at the rule
     itself, which the age-check faults further down already cover. */

  {
    name: 'the missing-dob check on a named roster row is removed',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "      if (!filled(p.dob)) {\n        return bad('Please give a date of birth for every named player.', 'players');\n      }",
      '      if (false) { /* removed */ }'),
    expect: ['a named row with no dob is refused', 'a last-name-only row still counts as named'],
  },
  {
    name: 'a play-up player is blocked server-side instead of let through',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "      if (check.status === 'blocked') {", "      if (check.status !== 'ok') {"),
    expect: ['a play-up roster is accepted, not refused'],
  },
  {
    name: 'the roster age loop is scoped to every row, not just the named ones',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "    const named = roster.filter((p) => p && typeof p === 'object'\n      && (text(p.firstName).trim() || text(p.lastName).trim()));",
      '    const named = roster;'),
    expect: ['an untouched blank row is not checked at all'],
  },
  {
    name: 'the age check stops running server-side at all',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '    for (let i = 0; i < named.length; i++) {\n      const p = named[i];\n      const check = ageGroupCheck(text(p.dob), groupName);',
      '    for (let i = 0; i < 0; i++) {\n      const p = named[i];\n      const check = ageGroupCheck(text(p.dob), groupName);'),
    expect: ['a badly out-of-range player blocks the whole squad'],
  },
  {
    name: 'PREV_GROUP_ID drifts from the client (u16b points at u12 instead of u14b)',
    suite: 'test-agegroups.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      "u16b: 'u14b', u16g: 'u14g',", "u16b: 'u12', u16g: 'u14g',"),
    expect: ['the server carries the same play-up chain', 'U16B Contact: one year younger than the band is a play-up'],
  },
  {
    name: 'the cut-off date drifts by a year, shifting every boundary at once',
    suite: 'test-agegroups.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      'const AGE_GRADE_CUTOFF_DATE = new Date(2026, 7, 31);',
      'const AGE_GRADE_CUTOFF_DATE = new Date(2027, 7, 31);'),
    /* A single boundary case could miss this if it happened to land on a
       group whose neighbour still lines up by coincidence — this is exactly
       why the sweep runs across all fifteen groups rather than one. */
    expect: ['one year older than the band is blocked', 'one year younger than the band is'],
  },
  {
    name: "U6's play-up chain is invented, even though it is the youngest group",
    suite: 'test-agegroups.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      "const PREV_GROUP_ID = {\n  u7: 'u6',", "const PREV_GROUP_ID = {\n  u6: 'u7', u7: 'u6',"),
    expect: ['U6 has no previous group'],
  },
  {
    name: 'the client/server age-message agreement check is fooled by a reworded server sentence',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      'please check the date of birth or select the correct age group.',
      'please check the date of birth or pick a different age group.'),
    expect: ['the server ends with that exact sentence'],
  },
  {
    name: 'the client-side missing-dob gate on the roster is removed',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      "    if (namedRows.some((p) => !p.dob)) {\n      this.setState({ teamError: 'Please give a date of birth for every named player.' });\n      return;\n    }",
      '    if (false) { /* removed */ }'),
    expect: ['a named row missing its dob is caught before any request'],
  },
  {
    name: 'the client-side blocked-row gate on the roster is removed',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      "    if (namedRows.some((p) => this._rosterPlayerAgeCheck(p, f).status === 'blocked')) {",
      "    if (false && namedRows.some((p) => this._rosterPlayerAgeCheck(p, f).status === 'blocked')) {"),
    expect: ['a blocked row is caught before any request'],
  },
  {
    name: 'the client-side roster gate is scoped to EVERY row, so blank rows block a fresh form',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      "    const namedRows = f.players.filter((p) => p.firstName.trim() || p.lastName.trim());",
      '    const namedRows = f.players;'),
    expect: ['an untouched blank row does not block submission'],
  },

  /* ---- the wide (two-year) girls' play-up list — added 28 Jul 2026 -------
     Real case that found this: Mike Yohotu, DOB 1 Sep 2013, registering for
     U14G QR — 12 at the cut-off, one year young, but the one-hop chain (which
     jumps u14g -> u12g, age 11) had no group at 12 and blocked him outright.
     These faults are aimed at the arithmetic itself and at the server/client
     list agreeing, not at the general play-up mechanism above, which the
     older faults already cover. */

  {
    name: 'the server TWO_YEAR_PLAYUP_GROUP_IDS drifts from the client (u18g dropped)',
    suite: 'test-agegroups.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      "const TWO_YEAR_PLAYUP_GROUP_IDS = ['u12g', 'u14g', 'u16g', 'u18g'];",
      "const TWO_YEAR_PLAYUP_GROUP_IDS = ['u12g', 'u14g', 'u16g'];"),
    expect: ['the server carries the same wide play-up group list'],
  },
  {
    name: 'the wide allowance is silently widened to three years young instead of two',
    suite: 'test-agegroups.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      "    if (groupsYoung === 1 || groupsYoung === 2) {",
      "    if (groupsYoung === 1 || groupsYoung === 2 || groupsYoung === 3) {"),
    expect: ['three years younger than the band is blocked (even when wide)'],
  },
  {
    name: 'the wide allowance is narrowed to only two years young, breaking the real one-year Mike Yohotu case',
    suite: 'test-agegroups.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      "    if (groupsYoung === 1 || groupsYoung === 2) {",
      "    if (groupsYoung === 2) {"),
    expect: ['a 12-year-old girl registering for U14G QR is a play-up, not blocked'],
  },
  {
    /* Deliberately NOT caught via the boundary sweep's isWide flag — that
       flag is read straight off A.TWO_YEAR_PLAYUP_GROUP_IDS, so a fault that
       widens the exported list would make the sweep's own "expected" value
       move with it and the fault would sail through unnoticed. Only the
       hardcoded literal-id assertion below is independent of the list this
       fault is damaging. */
    name: 'a non-wide group (U16B Contact) is accidentally given the two-year girls\' allowance',
    suite: 'test-agegroups.js',
    apply: () => patch(path.join('netlify', 'functions', '_agegroups.js'),
      "const TWO_YEAR_PLAYUP_GROUP_IDS = ['u12g', 'u14g', 'u16g', 'u18g'];",
      "const TWO_YEAR_PLAYUP_GROUP_IDS = ['u12g', 'u14g', 'u16g', 'u18g', 'u16b'];"),
    expect: ['u16b is never in the wide play-up list, no matter what the export says'],
  },
  {
    name: 'the client TWO_YEAR_PLAYUP_GROUP_IDS check is removed, so the client falls back to the old one-hop chain for U14G QR',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      "    if (TWO_YEAR_PLAYUP_GROUP_IDS.includes(info.id)) {",
      "    if (false) {"),
    expect: ['a 12-year-old in U14G QR is a play-up on the roster, not blocked'],
  },
  {
    name: 'the client-side wide allowance leaks into a non-wide group (U16B Contact)',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      "const TWO_YEAR_PLAYUP_GROUP_IDS = ['u12g', 'u14g', 'u16g', 'u18g'];",
      "const TWO_YEAR_PLAYUP_GROUP_IDS = ['u12g', 'u14g', 'u16g', 'u18g', 'u16b'];"),
    expect: ['a boy two groups young for U16B Contact is still blocked, not a wide play-up'],
  },

  {
    name: 'the honeypot REFUSES instead of silently accepting, telling a bot it was seen',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '  if (filled(d[HONEYPOT])) return good({ drop: true });',
      "  if (filled(d[HONEYPOT])) return bad('Rejected.', HONEYPOT);"),
    expect: ['a filled honeypot is ACCEPTED', 'marked to be thrown away'],
  },
  {
    name: 'the honeypot is checked LAST, so a bot can read the rules out of the errors',
    suite: 'test-intake.js',
    apply: () => {
      patch(path.join('netlify', 'functions', '_intake.js'),
        '  if (filled(d[HONEYPOT])) return good({ drop: true });\n\n', '');
      patch(path.join('netlify', 'functions', '_intake.js'),
        '  return good();\n}', '  if (filled(d[HONEYPOT])) return good({ drop: true });\n  return good();\n}');
    },
    expect: ['accepted even when everything else is wrong'],
  },
  {
    name: 'the honeypot stops being checked, so the bot trap does nothing',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '  if (filled(d[HONEYPOT])) return good({ drop: true });', ''),
    expect: ['a filled honeypot is ACCEPTED', 'marked to be thrown away'],
  },
  {
    name: 'the length cap is removed',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'), '    if (text(d[f]).length > max) {', '    if (false) {'),
    expect: ['201 is not', '2001 are not'],
  },
  {
    name: 'every field gets the long allowance, so a name can be 2000 characters',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "    const max = LONG_FIELDS.indexOf(f) >= 0 ? MAX_NOTES_CHARS : MAX_FIELD_CHARS;",
      '    const max = MAX_NOTES_CHARS;'),
    expect: ['201 is not'],
  },
  {
    name: 'the squad list loses its own ceiling, so a request is bounded only by body size',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '    if (text(d.players).length > MAX_PLAYERS_CHARS) {', '    if (false) {'),
    expect: ['a squad list cannot be unbounded'],
  },

  /* ---- rate limiting ----------------------------------------------------
     The last of the three things Netlify Forms was doing that nobody chose. */

  {
    name: 'the limit stops being applied, so an address can submit for ever',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_ratelimit.js'), '  if (win.count >= max) {', '  if (false) {'),
    expect: ['the twenty-first is not', 'exactly twenty got through'],
  },
  {
    name: 'the limit is off by one',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_ratelimit.js'), '  if (win.count >= max) {', '  if (win.count > max) {'),
    expect: ['the twenty-first is not', 'exactly twenty got through'],
  },
  {
    name: 'the count is never written back, so nothing ever accumulates',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_ratelimit.js'),
      '    await store.setJSON(key, { count: win.count + 1, windowStart: win.windowStart });',
      '    await store.setJSON(key, { count: win.count, windowStart: win.windowStart });'),
    expect: ['the twenty-first is not', 'exactly twenty got through'],
  },
  {
    name: 'the window start is pushed forward on every hit, so it never rolls over',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_ratelimit.js'),
      '    await store.setJSON(key, { count: win.count + 1, windowStart: win.windowStart });',
      '    await store.setJSON(key, { count: win.count + 1, windowStart: now });'),
    /* A sliding window instead of a fixed one. Twenty hits at the SAME instant
       cannot tell the two apart, which is why the plain rollover check misses
       it — the one that catches it spreads the hits out. */
    expect: ['the window still starts at the FIRST hit', 'freed one hour after the FIRST hit'],
  },
  {
    name: 'the window never expires at all',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_ratelimit.js'),
      '  if (now - windowStart >= WINDOW_MS) return null;', ''),
    expect: ['allowed again the moment the hour is up'],
  },
  {
    name: 'a stored window from the future locks the address out',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_ratelimit.js'), '  if (windowStart > now) return null;', ''),
    expect: ['treated as stale, not as a lock-out'],
  },
  {
    name: 'a store outage FAILS CLOSED, losing real registrations to protect a counter',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_ratelimit.js'),
      "    console.warn('rate limit: could not read the counter, allowing -', err && err.message);\n    return { ok: true, degraded: true };",
      '    return { ok: false, retryAfterSecs: 60 };'),
    expect: ['a store outage ALLOWS the submission', 'no store at all also fails open'],
  },
  {
    name: 'a failed WRITE fails closed, even though the read worked',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_ratelimit.js'),
      "    console.warn('rate limit: could not record the submission, allowing -', err && err.message);\n    return { ok: true, degraded: true };",
      '    return { ok: false, retryAfterSecs: 60 };'),
    expect: ['a failed write still allows the submission'],
  },
  {
    name: 'every address shares one bucket',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_ratelimit.js'), '  return `ratelimit/${safe}`;', "  return 'ratelimit/all';"),
    expect: ['one address being noisy does not block another', 'because every slash is replaced', 'counter is stored under a ratelimit/ key'],
  },
  {
    name: 'a missing address SKIPS the check, making "send no address" the way round it',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_ratelimit.js'),
      "  const safe = raw.replace(/[^0-9a-zA-Z.:_-]/g, '_').slice(0, 60) || 'unknown';",
      "  if (!raw) return '';\n  const safe = raw.replace(/[^0-9a-zA-Z.:_-]/g, '_').slice(0, 60);"),
    expect: ['an empty address gets one shared bucket', 'a missing address is still counted'],
  },
  {
    name: 'the address is used as a raw key, so a header can write where it likes',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_ratelimit.js'),
      "  const safe = raw.replace(/[^0-9a-zA-Z.:_-]/g, '_').slice(0, 60) || 'unknown';",
      "  const safe = raw.slice(0, 60) || 'unknown';"),
    expect: ['every slash is replaced', 'no key can contain a slash'],
  },
  {
    name: 'a refusal stops saying how long to wait',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_ratelimit.js'),
      '    return { ok: false, retryAfterSecs: Math.max(1, Math.ceil(left / 1000)) };',
      '    return { ok: false };'),
    expect: ['says how long is left', 'which is the rest of the hour'],
  },

  /* ---- the whole flow ---------------------------------------------------
     The order these happen in is the design. Most of these faults leave every
     individual rule working perfectly and still break the thing. */

  {
    name: 'the registration window stops being checked at all',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '  if (!open) {', '  if (false) {'),
    expect: ['a submission outside the window is refused'],
  },
  {
    name: 'an unreadable registration window FAILS OPEN, taking late entries',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "    log(`registration window unreadable, refusing - ${err && err.message}`);\n    return { status: 403, body: { ok: false, error: 'Registration is not open at the moment. Please email admin@adhjrt.com.' } };",
      '    open = true;'),
    expect: ['an unreadable window refuses rather than guessing'],
  },
  {
    name: 'the rate limit is checked but its answer is ignored',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'), '  if (!rate.ok) {', '  if (false) {'),
    expect: ['a rate-limited submission is refused'],
  },
  {
    name: 'the honeypot writes the row anyway',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "  if (verdict.drop) {\n    log('accepted and discarded: honeypot');\n    return { status: 200, body: { ok: true } };\n  }", ''),
    expect: ['nothing was written', 'a bot does not make us read'],
  },
  {
    name: 'the honeypot is answered AFTER the window is read, so a bot can make us do I/O',
    suite: 'test-intake.js',
    apply: () => {
      patch(path.join('netlify', 'functions', '_intake.js'),
        "  if (verdict.drop) {\n    log('accepted and discarded: honeypot');\n    return { status: 200, body: { ok: true } };\n  }\n", '');
      patch(path.join('netlify', 'functions', '_intake.js'),
        "  /* 5. THE TEAM CODE",
        "  if (verdict.drop) {\n    log('accepted and discarded: honeypot');\n    return { status: 200, body: { ok: true } };\n  }\n\n  /* 5. THE TEAM CODE");
    },
    expect: ['a bot does not make us read the registration window'],
  },
  {
    name: 'the honeypot replies differently from a real success, telling a bot it was seen',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "    return { status: 200, body: { ok: true } };\n  }\n\n  /* 4. THE REGISTRATION WINDOW",
      "    return { status: 200, body: { ok: true, discarded: true } };\n  }\n\n  /* 4. THE REGISTRATION WINDOW"),
    expect: ['the body is the same shape as a real success'],
  },
  {
    name: 'a failed sheet write is reported as a success',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '    return { status: 500, body: { ok: false, error: NOT_SAVED } };',
      '    return { status: 200, body: { ok: true } };'),
    expect: ['a failed write is a 500, not a quiet success'],
  },
  {
    name: 'a failed sheet write still sends a confirmation, so the coach stops chasing it',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '    return { status: 500, body: { ok: false, error: NOT_SAVED } };',
      '    await d.sendConfirmation(form, data);\n    return { status: 500, body: { ok: false, error: NOT_SAVED } };'),
    expect: ['no confirmation is sent for something that was not saved'],
  },
  {
    name: 'a failed sheet write is not parked, so the registration is simply gone',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '    try { await d.parkFailed(form, data, err && err.message); } catch (e2) {',
      '    try { if (false) await d.parkFailed(form, data, err && err.message); } catch (e2) {'),
    expect: ['parked so it can be replayed'],
  },
  {
    name: 'a failed confirmation email is allowed to fail the whole submission',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '    log(`confirmation email failed (the registration WAS saved) - ${err && err.message}`);',
      '    return { status: 500, body: { ok: false, error: NOT_SAVED } };'),
    expect: ['a failed email is still a success'],
  },
  {
    name: 'the confirmation is sent BEFORE the row is written',
    suite: 'test-intake.js',
    /* A genuine REORDER, not an extra send — an extra send is caught by the
       "exactly one email" checks and would say nothing about ordering. The
       whole confirmation block is lifted out and put back above the append. */
    apply: () => {
      const BLOCK = MAIL_BLOCK;
      patch(INTAKE_F, BLOCK, '');
      patch(INTAKE_F, '  /* 6. THE ROW. This is the record. */', BLOCK + '\n  /* 6. THE ROW. This is the record. */');
    },
    expect: ['the row is written before the email is sent'],
  },
  {
    name: 'the team code never reaches the mailer, so the email omits it',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'), "    data['team-name'] = teamCode;", ''),
    expect: ['the mailer is told the team code'],
  },
  {
    name: 'a failed numbering read costs the whole registration',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '    } catch (err) {\n      log(`could not read the teams sheet for numbering - ${err && err.message}`);\n    }',
      '    } catch (err) {\n      throw err;\n    }'),
    expect: ['a failed numbering read does not cost the registration'],
  },
  {
    name: 'a dropped field stops being logged, so nothing is ever noticed',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '  if (cleaned.dropped.length) log(`dropped unknown field(s): ${cleaned.dropped.join(\', \')}`);', ''),
    expect: ['a dropped field IS logged, by name'],
  },
  {
    name: 'a log line starts carrying the submitted value as well as the field name',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "    log(`refused: ${verdict.field || 'validation'}`);",
      "    log(`refused: ${verdict.field || 'validation'} = ${cleaned.clean[verdict.field]}`);"),
    expect: ['no registration data is logged'],
  },
  {
    name: 'the parked copy is logged instead of stored',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      '    log(`sheet append failed, parking the submission - ${err && err.message}`);',
      '    log(`sheet append failed, parking the submission - ${JSON.stringify(data)}`);'),
    expect: ['no registration data is logged'],
  },

  /* ---- the function stays thin ------------------------------------------
     submit-registration.js cannot be loaded by a test — it requires googleapis
     and a fresh clone has no node_modules. So the only thing worth guarding is
     that it never grows a decision, because a rule there is a rule nothing can
     check. */

  {
    name: 'the function grows its own validation instead of asking _intake.js',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'submit-registration.js'),
      '    const config = blobStore(\'config\');',
      "    if (!validateSubmission) { /* noop */ }\n    const config = blobStore('config');"),
    expect: ['does not decide anything itself'],
  },
  {
    name: 'the function builds its own sheet row',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'submit-registration.js'),
      '      appendRow: async (form, row) => {',
      '      appendRow: async (form, row) => {\n        row = teamRow({}, \'X\', \'Y\');'),
    expect: ['nor build a sheet row by hand'],
  },
  {
    name: 'the rate-limit bucket is taken from a caller-supplied header',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'submit-registration.js'),
      "const clientIp = (event) => (event.headers || {})['x-nf-client-connection-ip'] || '';",
      "const clientIp = (event) => (event.headers || {})['x-forwarded-for'] || '';"),
    expect: ['comes from Netlify', 'not from x-forwarded-for'],
  },
  {
    name: 'the body size limit moves to after the parse, so a megabyte is parsed first',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'submit-registration.js'),
      "    const raw = event.body || '';\n    if (Buffer.byteLength(raw, event.isBase64Encoded ? 'base64' : 'utf8') > MAX_BODY_BYTES) {\n      return json(400, { ok: false, error: 'That submission is too large. Please email admin@adhjrt.com.' });\n    }\n",
      "    const raw = event.body || '';\n"),
    expect: ['the body is measured at all', 'BEFORE it is parsed', 'against the limit'],
  },
  {
    name: 'a CORS header is added, opening the endpoint to any site',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'submit-registration.js'),
      "  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },",
      "  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },"),
    expect: ['no CORS header'],
  },
  {
    name: 'replies become cacheable',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'submit-registration.js'), "'Cache-Control': 'no-store'", "'Cache-Control': 'max-age=60'"),
    expect: ['every reply is no-store'],
  },
  {
    name: 'the append goes back to USER_ENTERED, making a typed "=" a live formula',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'submit-registration.js'), "          valueInputOption: 'RAW',", "          valueInputOption: 'USER_ENTERED',"),
    expect: ['the append is RAW', 'USER_ENTERED has not crept back'],
  },
  {
    name: 'the catch-all logs the whole event',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'submit-registration.js'),
      "    console.error('submit-registration error:', err && err.message);",
      "    console.error('submit-registration error:', event, err && err.message);"),
    expect: ['never the event or the body', 'logs the message only'],
  },
  {
    name: 'the parked submission loses its own namespace',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'submit-registration.js'), '`failed-submissions/${stamp}-${suffix}`', '`${stamp}-${suffix}`'),
    expect: ['parked under its own key'],
  },
  {
    name: 'the warning about what the dead-letter blob holds is deleted',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'submit-registration.js'), "⚠️ THIS BLOB HOLDS CHILDREN'S PERSONAL DATA.", 'Note:'),
    expect: ['says out loud what that blob contains'],
  },
  {
    name: 'a reader is given the WRITING scope',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'get-registrations.js'),
      '    const auth = getReadAuth();', '    const auth = getAuth();'),
    expect: ['uses the read-only auth', 'not the writing one'],
  },
  {
    name: 'the read-only scope is widened to read-write',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_sheets.js'),
      "    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],",
      "    scopes: ['https://www.googleapis.com/auth/spreadsheets'],"),
    expect: ['it really is read-only'],
  },
  {
    name: 'the private-key quote repair is dropped',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_sheets.js'), '    k = k.slice(1, -1);', ''),
    expect: ['quote-stripping repair survived'],
  },
  {
    name: 'a reader grows its own copy of getAuth again',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'get-registrations.js'),
      'exports.handler = async (event) => {',
      'function getAuth() { return null; }\n\nexports.handler = async (event) => {'),
    expect: ['has no copy of getAuth()'],
  },

  /* ---- the page and the gateway -----------------------------------------
     The distinction between "we do not know" and "you are wrong" is the whole
     reason the gateway is worth having on the client side. */

  {
    name: 'the page goes back to posting at Netlify Forms',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      "      res = await fetch('/.netlify/functions/submit-registration', {",
      "      res = await fetch('/', {"),
    expect: ['posts to our own function'],
  },
  {
    name: 'a refusal is shown as a generic connection message',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      '        teamError: e.message || NETWORK_MESSAGE,', '        teamError: NETWORK_MESSAGE,'),
    expect: ['shown what the SERVER said', 'NOT told to check their connection'],
  },
  {
    name: 'the player form does the same',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      '        playerError: e.message || NETWORK_MESSAGE,', '        playerError: NETWORK_MESSAGE,'),
    expect: ['closed window is shown in the server'],
  },
  {
    name: 'the form is cleared on a refusal, so the coach retypes everything',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      '        teamError: e.message || NETWORK_MESSAGE,\n      });',
      '        teamError: e.message || NETWORK_MESSAGE,\n        teamForm: emptyTeamForm(),\n      });'),
    expect: ['form is kept so it can be fixed'],
  },
  {
    name: 'ok:false in a 200 is treated as a success',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      '    if (!res.ok || !payload.ok) {', '    if (!res.ok) {'),
    expect: ['ok:false in a 200 is still a refusal'],
  },
  {
    name: 'a network failure is reported as a refusal, so "try again" is never offered',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      '      throw new SubmitError(NETWORK_MESSAGE, true);\n    }\n    /* A body that will not parse',
      "      throw new SubmitError('Something went wrong.', false);\n    }\n    /* A body that will not parse"),
    expect: ['dead connection says try again', 'does not claim the entry was registered'],
  },
  {
    name: 'an unparseable reply is treated as a refusal instead of a lost connection',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      '    if (!payload) throw new SubmitError(NETWORK_MESSAGE, true);', ''),
    expect: ['unparseable reply is treated as a network failure', 'gateway error page is a network failure'],
  },
  {
    name: 'the team code never reaches the success screen',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      "      teamCode: (result && result.teamCode) || '',", "      teamCode: '',"),
    expect: ['the team code the server issued'],
  },
  {
    name: 'the client-side checks are dropped, so every mistake costs a round trip',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      "      this.setState({ teamError: 'Please fill in club, age group, preferred pool, head coach name and head coach email.' });\n      return;",
      "      this.setState({ teamError: 'Please fill in club, age group, preferred pool, head coach name and head coach email.' });"),
    expect: ['caught before any request'],
  },
  {
    name: 'the form-name field is put back in the body',
    suite: 'test-registration-panel.js',
    apply: () => patch('Quins JRT.dc.html',
      "      result = await this.postRegistration('team-registration', {\n        club: effClub(f),",
      "      result = await this.postRegistration('team-registration', {\n        'form-name': 'team-registration',\n        club: effClub(f),"),
    expect: ['no form-name field left over'],
  },

  /* ---- the functions actually run ---------------------------------------
     THE ONE THAT SHIPPED. 28 Jul 2026: extracting the Google client sliced a
     range out of get-registrations.js that also took `require('./_auth')` and
     the whole of readRows(). It parsed, node --check passed, all 1,526 checks
     passed — and the organiser's Teams and Players tabs went blank on
     production, because a ReferenceError inside the handler became a 500 and a
     500 looks exactly like "there is no data". */

  {
    name: 'a reader loses its _auth require (the bug that actually shipped)',
    suite: 'test-functions-load.js',
    apply: () => patch(path.join('netlify', 'functions', 'get-registrations.js'),
      "const { verify, getBearerToken } = require('./_auth');\n", ''),
    expect: ['refuses cleanly rather than returning 500', 'answers an unauthenticated read with 401'],
  },
  {
    name: 'a reader loses a function its handler calls (the other half of it)',
    suite: 'test-functions-load.js',
    apply: () => {
      const f = path.join('netlify', 'functions', 'get-registrations.js');
      patch(f, 'async function readRows(auth, spreadsheetId, columns) {\n  const sheets = sheetsClient(auth);',
        'async function unusedReadRows(auth, spreadsheetId, columns) {\n  const sheets = sheetsClient(auth);');
    },
    /* NOT caught by anything unauthenticated: a 401 comes back long before
       readRows is reached. What catches it is the signed-in section, which is
       the only reason that section exists. */
    expect: ['does not throw when it is actually allowed to run', 'answers a signed-in read with 200'],

  },
  {
    name: 'a shared module loses a require, taking every caller down with it',
    suite: 'test-functions-load.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "const { checkRate } = require('./_ratelimit');", ''),
    expect: ['loads'],
  },
  {
    name: 'a function stops exporting a handler',
    suite: 'test-functions-load.js',
    apply: () => patch(path.join('netlify', 'functions', 'submit-registration.js'),
      'exports.handler = async (event) => {', 'const notTheHandler = async (event) => {'),
    expect: ['exports a handler'],
  },

  /* ---- the play-up highlight in the confirmation email — added 28 Jul 2026,
     alongside the wide girls' play-up allowance. Nothing tested _email.js's
     templates before test-email.js existed, so these faults are aimed at
     whether the highlight is actually there, not at some pre-existing rule. */

  {
    name: 'the play-up flag is read from the wrong field, so it never fires',
    suite: 'test-email.js',
    apply: () => patch(path.join('netlify', 'functions', '_email.js'),
      "const playingUp = d['play-up-consent'] === 'Yes';",
      "const playingUp = d['play-up'] === 'Yes';"),
    expect: ['the age group row is suffixed'],
  },
  {
    name: 'the play-up check is inverted, so a normal registration is highlighted and a real one is not',
    suite: 'test-email.js',
    apply: () => patch(path.join('netlify', 'functions', '_email.js'),
      "const playingUp = d['play-up-consent'] === 'Yes';",
      "const playingUp = d['play-up-consent'] !== 'Yes';"),
    expect: ['no play-up wording leaks in when consent is "No"', 'the age group is shown plain'],
  },
  {
    name: 'the age-group row stops mentioning "(playing up)"',
    suite: 'test-email.js',
    apply: () => patch(path.join('netlify', 'functions', '_email.js'),
      "row('Age group', playingUp ? `${d['age-group']} (playing up)` : d['age-group']),",
      "row('Age group', d['age-group']),"),
    expect: ['the age group row is suffixed'],
  },
  {
    name: 'the closing paragraph never distinguishes the play-up case',
    suite: 'test-email.js',
    apply: () => patch(path.join('netlify', 'functions', '_email.js'),
      "  const closing = playingUp\n    ? `We have noted that ${player ? esc(player) : 'this player'} is registered to play up an age group, with your consent as parent/guardian. Nothing further is needed from you now. Pool draws, kick-off times and pitch allocations are published closer to the tournament, and we will be in touch before the weekend. If anything above looks wrong — including the play-up — just reply to this email.`\n    : 'Nothing further is needed from you now. Pool draws, kick-off times and pitch allocations are published closer to the tournament, and we will be in touch before the weekend. If anything above looks wrong, just reply to this email.';",
      "  const closing = 'Nothing further is needed from you now. Pool draws, kick-off times and pitch allocations are published closer to the tournament, and we will be in touch before the weekend. If anything above looks wrong, just reply to this email.';"),
    expect: ['the closing paragraph names the player as playing up'],
  },

  /* ---- the Teams/Players tables grouping by club and age group — added
     28 Jul 2026, in answer to Jay asking whether filtering by one age group
     groups the rows by club, and filtering by one club groups the rows by
     age group. Neither did until this change; these faults are aimed at the
     sort actually running and at the age-band ordering being real, not
     alphabetical. */

  {
    name: 'the sort is removed from _filteredTeams(), so teams go back to raw sheet order',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      "      return true;\n    }).sort(byClubThenAgeGroup);\n  }\n  _filteredPlayers() {",
      "      return true;\n    });\n  }\n  _filteredPlayers() {"),
    expect: ['clubs are grouped together, not left in submission order'],
  },
  {
    name: 'the sort is removed from _filteredPlayers() only, so the two tables disagree',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      "      return true;\n    }).sort(byClubThenAgeGroup);\n  }\n\n  renderVals() {",
      "      return true;\n    });\n  }\n\n  renderVals() {"),
    expect: ['players are grouped by club within the filtered age group too'],
  },
  {
    name: 'the age-group order table is swapped for a plain alphabetical string sort',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      "  const aAge = AGE_GROUP_ORDER[a.ageGroup] ?? 999;\n  const bAge = AGE_GROUP_ORDER[b.ageGroup] ?? 999;\n  if (aAge !== bAge) return aAge - bAge;",
      "  const aAge = String(a.ageGroup || ''), bAge = String(b.ageGroup || '');\n  if (aAge !== bAge) return aAge < bAge ? -1 : 1;"),
    expect: ['age groups are grouped in real youngest-to-oldest order, not alphabetically'],
  },
  {
    /* NOT `localeCompare()` with no options — Node's default locale already
       sorts case-insensitively at the primary level, so dropping just the
       `{ sensitivity: 'base' }` option is a no-op fault, caught nothing the
       first time this was written. The fault has to actually switch to raw
       code-point comparison, where every capital letter (65-90) sorts before
       every lowercase one (97-122) regardless of the real alphabet. */
    name: 'the club comparison stops being case-insensitive (falls back to raw code-point order)',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      "  const clubCmp = String(a.club || '').localeCompare(String(b.club || ''), undefined, { sensitivity: 'base' });",
      "  const aClub = String(a.club || ''), bClub = String(b.club || '');\n  const clubCmp = aClub < bClub ? -1 : aClub > bClub ? 1 : 0;"),
    expect: ['a lowercase club name still sorts alphabetically, not after every capitalised one'],
  },
  {
    name: 'ties within the same club and age group are left unstable instead of falling back to submission order',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      "  if (aAge !== bAge) return aAge - bAge;\n  // Same club, same age group: keep submission order stable rather than\n  // leaving it to the sort algorithm's whim.\n  return String(a.submittedAt || '').localeCompare(String(b.submittedAt || ''));",
      "  if (aAge !== bAge) return aAge - bAge;\n  return 0;"),
    expect: ['within the same club, submission order is preserved (A1 before A3)'],
  },
  /* ---- the club sub-header rows on those same tables — added 28 Jul 2026
     after Jay looked at three sorted players from two clubs and could not
     tell they were grouped at all. groupRowsByClub() turns the flat sorted
     list into [{ club, count, rows }], and the template renders one header
     row per group instead of one flat list of <tr>s. */

  {
    name: 'groupRowsByClub() stops starting a new group when the club changes, so everything lands in one group',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      '    if (!current || current.club !== r.club) {',
      '    if (!current) {'),
    expect: ['teams are split into one group per club, in the order clubs first appear'],
  },
  {
    name: 'the teams table template stops showing the count next to the club name in its header row',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      '<sc-for list="{{ teamGroups }}" as="g" hint-placeholder-count="2">\n                <tr>\n                  <td colspan="12" style="padding:10px 14px;background:rgba(225,27,34,0.08);border-top:1px solid rgba(255,255,255,0.1);font-size:12px;font-weight:800;letter-spacing:.5px;color:#ff8a8a;text-transform:uppercase">{{ g.club }} ({{ g.count }})</td>',
      '<sc-for list="{{ teamGroups }}" as="g" hint-placeholder-count="2">\n                <tr>\n                  <td colspan="12" style="padding:10px 14px;background:rgba(225,27,34,0.08);border-top:1px solid rgba(255,255,255,0.1);font-size:12px;font-weight:800;letter-spacing:.5px;color:#ff8a8a;text-transform:uppercase">{{ g.club }}</td>'),
    expect: ['the teams table template actually renders a club header row per group'],
  },
  {
    name: 'the players table template stops showing the count next to the club name in its header row',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      '<sc-for list="{{ playerGroups }}" as="g" hint-placeholder-count="2">\n                <tr>\n                  <td colspan="12" style="padding:10px 14px;background:rgba(225,27,34,0.08);border-top:1px solid rgba(255,255,255,0.1);font-size:12px;font-weight:800;letter-spacing:.5px;color:#ff8a8a;text-transform:uppercase">{{ g.club }} ({{ g.count }})</td>',
      '<sc-for list="{{ playerGroups }}" as="g" hint-placeholder-count="2">\n                <tr>\n                  <td colspan="12" style="padding:10px 14px;background:rgba(225,27,34,0.08);border-top:1px solid rgba(255,255,255,0.1);font-size:12px;font-weight:800;letter-spacing:.5px;color:#ff8a8a;text-transform:uppercase">{{ g.club }}</td>'),
    expect: ['the players table template actually renders a club header row per group'],
  },
  {
    name: 'groupRowsByClub() stops counting past the group\'s first row (count frozen at 1)',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      '      current = { club: r.club, count: 0, rows: [] };\n      groups.push(current);\n    }\n    current.count += 1;',
      '      current = { club: r.club, count: 1, rows: [] };\n      groups.push(current);\n    }'),
    expect: ['the first group carries a count of the rows inside it', 'that one group holds both rows'],
  },

  /* ---- CSV export turning phone numbers into formulas — added 28 Jul 2026
     after Jay reported phone numbers showing as equations when he opened the
     exported CSV. Every stored phone number starts with "+", which Excel and
     Google Sheets both read as the start of a formula in a CSV cell. */

  {
    name: 'csvSafe() stops guarding a leading "+" (and friends), so phone numbers go back to being read as formulas',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      "  static csvSafe(v) {\n    const s = String(v || '');\n    return /^[=+\\-@]/.test(s) ? \"'\" + s : s;\n  }",
      "  static csvSafe(v) {\n    return String(v || '');\n  }"),
    expect: ['a phone number starting with + is prefixed so it is not read as a formula'],
  },
  {
    name: 'exportCsv() stops routing cell values through csvSafe() at all',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      "lines.push(vals.map((v) => '\"' + Component.csvSafe(v).replace(/\"/g, '\"\"') + '\"').join(','));",
      "lines.push(vals.map((v) => '\"' + String(v || '').replace(/\"/g, '\"\"') + '\"').join(','));"),
    expect: ['exportCsv() actually runs every cell through csvSafe(), not just the raw value'],
  },

  /* Squad list — Teams table "click to expand" (added 28 Jul 2026).
     parseRoster() is the one thing standing between a raw, coach-typed JSON
     cell and the Teams table — it has to survive malformed/missing/non-array
     input without throwing, or one bad row takes down the whole table. */
  {
    name: 'parseRoster() stops guarding against malformed JSON, so one bad players cell throws and takes down the whole Teams table',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      "  static parseRoster(playersJson) {\n    if (!playersJson) return [];\n    let arr;\n    try {\n      arr = JSON.parse(playersJson);\n    } catch (e) {\n      return [];\n    }\n    if (!Array.isArray(arr)) return [];",
      "  static parseRoster(playersJson) {\n    if (!playersJson) return [];\n    let arr;\n    arr = JSON.parse(playersJson);\n    if (!Array.isArray(arr)) return [];"),
    expect: ['malformed JSON returns an empty roster, not a thrown error'],
  },
  {
    name: 'parseRoster() stops checking Array.isArray(), so a stray non-array JSON value (e.g. a plain object) is treated as a roster',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      "    if (!Array.isArray(arr)) return [];\n    return arr.map((p) => {",
      "    return arr.map((p) => {"),
    expect: ['valid JSON that is not an array (e.g. a stray object) returns an empty roster'],
  },
  {
    name: 'parseRoster() stops falling back to "(no name)" for a nameless roster entry, so it silently prints a blank line instead',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      "      return { name: name || '(no name)', dob: (p && p.dob) || '—' };",
      "      return { name: name, dob: (p && p.dob) || '—' };"),
    expect: ['a roster entry with no name at all is still listed, not silently dropped'],
  },
  {
    name: 'renderVals() stops flagging hasRoster from the parsed roster, so a team with a saved squad list gets no expand button',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      "        rosterCount: roster.length,\n        hasRoster: roster.length > 0,",
      "        rosterCount: roster.length,\n        hasRoster: false,"),
    expect: ['a team with a saved roster is flagged hasRoster so the table shows a toggle button'],
  },
  {
    name: 'toggleTeamExpand() stops toggling closed again, so once opened a team\'s roster can never be collapsed',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      "  toggleTeamExpand(teamName) {\n    const { expandedTeam } = this.state;\n    this.setState({ expandedTeam: expandedTeam === teamName ? '' : teamName });\n  }",
      "  toggleTeamExpand(teamName) {\n    this.setState({ expandedTeam: teamName });\n  }"),
    expect: ["clicking an already-open team's toggle collapses it again (toggle, not one-way)"],
  },

  /* RETIRED 2 Aug 2026. A fault here removed the top-nav Organizer link to
     prove the 28 Jul check that required it. Jay has since asked for the
     sign-ins to live at the bottom only, so the link is gone on purpose and
     the check it proved has gone with it. The replacement faults are at the
     end of this list, under test-back-office-links.js — including the same
     link CREEPING BACK, which is now the mistake worth catching. */

  /* Google sign-in (added 29 Jul 2026). */
  {
    name: '_googleAuth.js stops checking the audience, so a token minted for a different app would verify here too',
    suite: 'test-google-auth.js',
    apply: () => patch(path.join('netlify', 'functions', '_googleAuth.js'),
      'const ticket = await getClient().verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });',
      'const ticket = await getClient().verifyIdToken({ idToken });'),
    expect: ['verifies against OUR OWN client id as the audience, not just any valid Google token'],
  },
  {
    name: '_googleAuth.js stops refusing an unverified email',
    suite: 'test-google-auth.js',
    apply: () => patch(path.join('netlify', 'functions', '_googleAuth.js'),
      "    if (payload.email_verified === false) return null;\n",
      ''),
    expect: ['refuses a token whose email Google has not itself verified'],
  },
  {
    name: 'google-auth.js starts matching an existing account by email instead of googleSub',
    suite: 'test-google-auth.js',
    apply: () => patch(path.join('netlify', 'functions', 'google-auth.js'),
      "const existing = accounts.find((a) => a.googleSub === identity.sub);",
      "const existing = accounts.find((a) => a.email === identity.email);"),
    expect: ['looks up the account by the STORED googleSub, not by email'],
  },
  {
    name: 'google-auth.js stops refusing a duplicate username when signing up via Google',
    suite: 'test-google-auth.js',
    apply: () => patch(path.join('netlify', 'functions', 'google-auth.js'),
      "    if (accounts.some((a) => a.username === uname)) {\n      return { statusCode: 409, body: JSON.stringify({ ok: false, error: 'That username is already taken.' }) };\n    }\n",
      ''),
    expect: ['a duplicate username is refused with the exact same message as every other signup path'],
  },
  {
    name: 'google-auth.js leaves passwordHash undefined instead of an explicit null on a Google-created account',
    suite: 'test-google-auth.js',
    apply: () => patch(path.join('netlify', 'functions', 'google-auth.js'),
      "      passwordHash: null, // signed in with Google, not a password — see verifyPassword callers, none of which this account ever reaches\n",
      ''),
    expect: ['the created account stores no password — passwordHash is explicitly null, not omitted'],
  },
  {
    name: 'accounts-admin.js stops stripping googleSub from the account listing',
    suite: 'test-google-auth.js',
    apply: () => patch(path.join('netlify', 'functions', 'accounts-admin.js'),
      "accounts.map(({ passwordHash, googleSub, ...rest }) => ({ ...rest, signInMethod: googleSub ? 'Google' : 'Password' })),",
      "accounts.map(({ passwordHash, ...rest }) => ({ ...rest, signInMethod: rest.googleSub ? 'Google' : 'Password' })),"),
    expect: ['googleSub is stripped from the listing the same way passwordHash is'],
  },
  {
    name: 'google-auth.js goes back to hardcoding every Google-created organiser’s title, ignoring a custom one',
    suite: 'test-google-auth.js',
    apply: () => patch(path.join('netlify', 'functions', 'google-auth.js'),
      "...(role === 'manager' ? { ageGroupId } : { title: title || 'Organizer' }),",
      "...(role === 'manager' ? { ageGroupId } : { title: 'Organizer' }),"),
    expect: ['an organiser can still set a custom title, same default as organizer-signup.js — not hardcoded to "Organizer"'],
  },
  {
    name: 'onScoresAgeChange loses its same-id guard, re-reloading a group that hasn’t changed',
    suite: 'test-fixtures-results-sync.js',
    apply: () => patch('Quins JRT.dc.html',
      "        if (!id || id === this.state.fxSelectedId) return;\n",
      "        if (!id) return;\n"),
    expect: ['picking the SAME age group elsewhere is a no-op', '…and does not needlessly reload the schedule'],
  },
  {
    name: 'onScoresAgeChange stops checking the id against fxAgeGroups, adopting anything handed to it',
    suite: 'test-fixtures-results-sync.js',
    apply: () => patch('Quins JRT.dc.html',
      "        const grp = (this.state.fxAgeGroups || []).find((a) => a.id === id);\n        if (!grp) return;\n",
      "        const grp = (this.state.fxAgeGroups || []).find((a) => a.id === id);\n"),
    expect: ['an id the Fixtures section does not recognise is ignored, not adopted'],
  },
  {
    name: 'the public Results tab stops reporting its own pick upward at all',
    suite: 'test-fixtures-results-sync.js',
    apply: () => patch('Scores & Standings.dc.html',
      "      onSelect: () => this.setState({ selectedAgeId: a.id }, () => {\n        this.loadPublic();\n        if (typeof this.props.onAgeChange === 'function') this.props.onAgeChange(a.id);\n      }),",
      "      onSelect: () => this.setState({ selectedAgeId: a.id }, () => {\n        this.loadPublic();\n      }),"),
    expect: ['…and reports the pick upward through onAgeChange, exactly once'],
  },
  {
    name: 'the public Results tab calls onAgeChange unconditionally, throwing on the standalone /scores page',
    suite: 'test-fixtures-results-sync.js',
    apply: () => patch('Scores & Standings.dc.html',
      "        if (typeof this.props.onAgeChange === 'function') this.props.onAgeChange(a.id);",
      "        this.props.onAgeChange(a.id);"),
    expect: ['clicking a tab on the standalone /scores page (no onAgeChange prop) does not throw'],
  },
  {
    name: 'loadEditor loses its ageChanged guard, re-firing onAgeChange on every editor reload',
    suite: 'test-fixtures-results-sync.js',
    apply: () => patch('Scores & Standings.dc.html',
      "    if (ageChanged && typeof this.props.onAgeChange === 'function') this.props.onAgeChange(agId);",
      "    if (typeof this.props.onAgeChange === 'function') this.props.onAgeChange(agId);"),
    expect: ['reloading the SAME age group (a save, a publish, a regenerate...) does not fire again'],
  },
  {
    name: 'loadEditor stops reporting a manager/organiser’s age group upward at all',
    suite: 'test-fixtures-results-sync.js',
    apply: () => patch('Scores & Standings.dc.html',
      "    if (ageChanged && typeof this.props.onAgeChange === 'function') this.props.onAgeChange(agId);\n",
      ''),
    expect: ['a manager landing on their own age group reports it upward'],
  },
  {
    name: 'runSimulateTournament’s pass-1 isFinal filter is inverted, so pass 1 no longer walks over the double-bracket semis',
    suite: 'test-simulate-tournament.js',
    apply: () => patch('Scores & Standings.dc.html',
      "      for (const slot of knockout) {\n        if (isFinal(slot.id) || !slot.home || !slot.away) continue;\n        const data = { walkover: 'home', ...spiritData(ag.id, ag.name, slot.home, slot.away) };\n        const r = await api.submitResult(slot.id, data, session);\n        if (r && r.ok) { knockoutGames++; spiritLog[slot.id] = { data, home: slot.home, away: slot.away }; } else failed++;\n      }\n\n      // Pass 2:",
      "      for (const slot of knockout) {\n        if (!isFinal(slot.id) || !slot.home || !slot.away) continue;\n        const data = { walkover: 'home', ...spiritData(ag.id, ag.name, slot.home, slot.away) };\n        const r = await api.submitResult(slot.id, data, session);\n        if (r && r.ok) { knockoutGames++; spiritLog[slot.id] = { data, home: slot.home, away: slot.away }; } else failed++;\n      }\n\n      // Pass 2:"),
    expect: ['pass 1 walked over the semis'],
  },
  {
    name: 'runSimulateTournament’s second knockout pass (the regenerate + walk-the-finals block) is deleted, so no group ever gets its finals scored',
    suite: 'test-simulate-tournament.js',
    apply: () => patch('Scores & Standings.dc.html',
      "      // Pass 2: regenerate now the semis have winners — this is what fills in\n"
      + "      // the finals for a double-bracket group — save it, and walk those over.\n"
      + "      this.setState({ simProgress: `${ag.name} — finals…` });\n"
      + "      knockout = await api.autoKnockoutSlots(ag.id, session);\n"
      + "      saved = await api.saveDraw(ag.id, this.withTeamNames({ ...draw, knockout }), session);\n"
      + "      if (!saved || !saved.ok) failed++;\n"
      + "      for (const slot of knockout) {\n"
      + "        if (!isFinal(slot.id) || !slot.home || !slot.away) continue;\n"
      + "        const data = { walkover: 'home', ...spiritData(ag.id, ag.name, slot.home, slot.away) };\n"
      + "        const r = await api.submitResult(slot.id, data, session);\n"
      + "        if (r && r.ok) { knockoutGames++; spiritLog[slot.id] = { data, home: slot.home, away: slot.away }; } else failed++;\n"
      + "      }\n\n",
      ''),
    expect: ['CUP was seeded straight from pool winners and walked over', '…and only THEN did pass 2 walk over the finals, fed from the semi winners/losers'],
  },
  {
    name: 'runSimulateTournament stops special-casing festival groups (U6/U7), so it tries to score matches the API refuses',
    suite: 'test-simulate-tournament.js',
    apply: () => patch('Scores & Standings.dc.html',
      "      // Festival groups (U6/U7): no standings, no knockout, no scores allowed\n"
      + "      // by the API at all — just publish whatever draw they have.\n"
      + "      if (!ag.hasStandings) {\n"
      + "        const res = await api.publishDraw(ag.id, session);\n"
      + "        if (res && res.ok) published++;\n"
      + "        else if (!(res && /nothing to publish|save a draw/i.test(res.error || ''))) failed++;\n"
      + "        continue;\n"
      + "      }\n\n",
      ''),
    expect: ['pools/knockout/published counts are exact, not just non-zero, and nothing failed'],
  },
  {
    name: 'onSimulateTournament loses its typed-word check, running on ANY input to the confirm dialog',
    suite: 'test-simulate-tournament.js',
    apply: () => patch('Scores & Standings.dc.html',
      "        if (typed.trim().toUpperCase() !== 'SIMULATE') {\n"
      + "          this.setState({ simMsg: `Not run — you typed \"${typed.trim()}\" rather than SIMULATE.` });\n"
      + "          return;\n"
      + "        }\n"
      + "        this.runSimulateTournament();",
      "        this.runSimulateTournament();"),
    expect: ['a near-miss is refused, not run'],
  },
  {
    name: 'onSimulateTournament loses the tournament-day guard, so it can be pressed on 7-8 November',
    suite: 'test-simulate-tournament.js',
    apply: () => patch('Scores & Standings.dc.html',
      "  onSimulateTournament() {\n    if (this.isTournamentDayNow()) return;\n    this.promptModal(",
      "  onSimulateTournament() {\n    this.promptModal("),
    expect: ['on a real tournament day, pressing Simulate does not even open the confirm dialog'],
  },
  {
    name: 'runResetSimulation stops clearing the generated knockout, leaving a reset tournament with a stale bracket',
    suite: 'test-simulate-tournament.js',
    apply: () => patch('Scores & Standings.dc.html',
      "        if (draw) {\n"
      + "          const saved = await api.saveDraw(ag.id, this.withTeamNames({ ...draw, knockout: [] }), session);\n"
      + "          if (!saved || !saved.ok) failed++;\n"
      + "        }",
      "        if (draw) {\n"
      + "          /* knockout clear intentionally skipped */\n"
      + "        }"),
    expect: ['u9\'s saved draw had its knockout cleared'],
  },

  /* ---- HSBC / sponsors (test-sponsors.js) ------------------------------- */

  {
    name: 'an unconfirmed company is named as a sponsor again',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'More partners will be announced here before the tournament.',
      'More partners, including Transguard Group, will be announced here before the tournament.'),
    expect: ['does not name "Transguard Group"'],
  },
  {
    name: 'a sponsorNames list is put back',
    suite: 'test-sponsors.js',
    /* Deliberately holds a name that is NOT on the unconfirmed list, so the
       only thing that can catch it is the check on the list itself. A fault
       using a real name would be caught by the name checks and prove nothing
       about this one. */
    apply: () => patch(HOME, '    const sp = this.state.statsP;',
      "    const sponsorNames = ['Nobody In Particular'];\n    const sp = this.state.statsP;"),
    expect: ['sponsorNames list is gone'],
  },
  {
    name: 'renderVals returns a sponsors list again',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '      standingsPreview: [1, 2, 3, 4, 5, 6],',
      '      standingsPreview: [1, 2, 3, 4, 5, 6],\n      sponsors: [],'),
    expect: ['no longer returns a sponsors list'],
  },
  {
    name: 'the marquee keyframes come back',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '  @keyframes fadeIn{from{opacity:0}to{opacity:1}}',
      '  @keyframes fadeIn{from{opacity:0}to{opacity:1}}\n  @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}'),
    expect: ['marquee keyframes are gone'],
  },
  {
    name: 'the band is switched to the black-wordmark logo (invisible on the dark page)',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'src="assets/sponsor-hsbc-white.webp" alt="HSBC" style="height:54px',
      'src="assets/sponsor-hsbc.webp" alt="HSBC" style="height:54px'),
    expect: ['uses the white lockup, not the black one'],
  },
  {
    name: 'one of the three placements loses its logo',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, BAND_IMG, ''),
    expect: ['three HSBC images on the page'],
  },
  {
    name: 'the header mark is unwrapped, so space-between spreads it into the bar',
    suite: 'test-sponsors.js',
    apply: () => {
      patch(HOME, '      <div style="display:flex;align-items:center;gap:16px;min-width:0">\n        <a href="#top"', '        <a href="#top"');
      patch(HOME, '        </span>\n      </div>\n      <!-- Shown only under 760px', '        </span>\n      <!-- Shown only under 760px');
    },
    expect: ['exactly three direct children'],
  },
  {
    name: 'the header mark is made a link off the site',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, HDR_IMG, '<a href="https://www.hsbc.ae">' + HDR_IMG + '</a>'),
    expect: ['header mark is not a link'],
  },
  {
    name: 'the narrow-screen hide loses its !important (inline display:flex wins, silently)',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '.hdr-partner{display:none!important}', '.hdr-partner{display:none}'),
    expect: ['carries !important'],
  },
  {
    name: 'the narrow-screen hide is deleted entirely',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '  @media(max-width:800px){ .hdr-partner{display:none!important} }', ''),
    expect: ['own hide rule'],
  },
  {
    /* The tempting tidy-up: fold the rule into the 760 block with the rest of
       the header's mobile CSS. It looks right and it puts a second line back
       into a sticky header between 850 and 950px. */
    name: 'the hide is "tidied" into the 760px nav breakpoint',
    suite: 'test-sponsors.js',
    apply: () => {
      patch(HOME, '  @media(max-width:800px){ .hdr-partner{display:none!important} }\n\n', '');
      patch(HOME, '    .hdr-nav{display:none!important}', '    .hdr-nav{display:none!important}\n    .hdr-partner{display:none!important}');
    },
    expect: ['hides at 800px', 'does not repeat the hide'],
  },
  {
    name: 'the partner band is moved BELOW the stat strip',
    suite: 'test-sponsors.js',
    apply: () => {
      patch(HOME, BAND_BLOCK, '');
      patch(HOME, '  <!-- ============ ABOUT ============ -->', BAND_BLOCK + '  <!-- ============ ABOUT ============ -->');
    },
    expect: ['band sits ABOVE the stat strip'],
  },
  {
    name: 'the band label is reworded away from what Jay chose',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '>In partnership with<', '>Our sponsors<'),
    expect: ['In partnership with'],
  },
  {
    name: 'the band logo loses its narrow-screen bound',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'style="height:54px;width:auto;max-width:100%;display:block"',
      'style="height:54px;width:auto;display:block"'),
    expect: ['bounded on a narrow screen'],
  },
  {
    name: 'the "coming soon" badge is put back above a confirmed partner',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '>Principal partner</div>', '>Principal partner</div><span>Coming soon</span>'),
    expect: ['coming soon'],
  },
  {
    name: 'the page goes back to claiming "hundreds of" players',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'thousands of young players, two unforgettable days', 'hundreds of young players, two unforgettable days'),
    expect: ['hundreds of'],
  },
  {
    name: 'the stat strip quietly drops to a figure the copy no longer matches',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "statPlayers: Math.round(3000 * sp) + '+',", "statPlayers: Math.round(300 * sp) + '+',"),
    expect: ['still advertises 3000+'],
  },
  {
    name: 'the get-in-touch invitation stops being a mail link',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'junior rugby? <a href="mailto:admin@adhjrt.com"', 'junior rugby? <a href="#"'),
    expect: ['get-in-touch invitation is kept'],
  },

  /* ---- HSBC on /app and /scores (test-sponsors.js) ---------------------- */

  {
    name: 'the app header mark is switched to the black-wordmark logo',
    suite: 'test-sponsors.js',
    apply: () => patch('app.html', '<img src="/assets/sponsor-hsbc-white.webp" alt="HSBC">',
      '<img src="/assets/sponsor-hsbc.webp" alt="HSBC">'),
    expect: ['app HSBC image', 'uses the white lockup'],
  },
  {
    name: 'the app More-tab partner block is deleted',
    suite: 'test-sponsors.js',
    apply: () => patch('app.html', '    <div class="sec-t">Principal partner</div>\n', ''),
    expect: ['Principal partner heading', 'HSBC logo follows it'],
  },
  {
    name: 'the app header mark becomes a link off the app',
    suite: 'test-sponsors.js',
    apply: () => patch('app.html', '        <img src="/assets/sponsor-hsbc-white.webp" alt="HSBC">',
      '        <a href="https://www.hsbc.ae"><img src="/assets/sponsor-hsbc-white.webp" alt="HSBC"></a>'),
    expect: ['app header mark is not a link'],
  },
  {
    name: 'the app header hide rule is deleted, wrapping a fixed header on a small phone',
    suite: 'test-sponsors.js',
    apply: () => patch('app.html', '@media(max-width:359px){ .hdr-partner{display:none} }', ''),
    expect: ['own hide rule', 'hides below 360px'],
  },
  {
    /* THE ONE THAT MATTERS. Remove the gate and the homepage shows the logo
       twice — once under the hero, once inside the embedded scores widget. */
    name: 'the scores band loses its embedded gate, doubling the logo on the homepage',
    suite: 'test-sponsors.js',
    apply: () => patch('Scores & Standings.dc.html', '      <sc-if value="{{ showPartner }}" hint-placeholder-val="{{ true }}">\n', '      <sc-if value="{{ true }}" hint-placeholder-val="{{ true }}">\n'),
    expect: ['wrapped in a showPartner gate'],
  },
  {
    name: 'showPartner stops reading the embedded prop, so the gate can never close',
    suite: 'test-sponsors.js',
    apply: () => patch('Scores & Standings.dc.html', '      showPartner: !this.props.embedded,', '      showPartner: true,'),
    expect: ['derived from the embedded prop'],
  },
  {
    name: 'the homepage stops declaring its scores widget embedded',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '<dc-import name="Scores & Standings" embedded="1"', '<dc-import name="Scores & Standings"'),
    expect: ['dc-import declares itself embedded'],
  },
  {
    /* dc props are strings. embedded="" is falsy, so the gate opens and the
       logo doubles — while the attribute is still visibly there in the markup,
       which is what makes this one worth catching separately. */
    name: 'the embedded attribute is emptied, which reads as present but is not',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '<dc-import name="Scores & Standings" embedded="1"', '<dc-import name="Scores & Standings" embedded=""'),
    expect: ['embedded value is non-empty'],
  },
  {
    name: 'the app copy drifts back to "hundreds of" players',
    suite: 'test-sponsors.js',
    apply: () => patch('app.html', 'reason thousands of young players get two full days', 'reason hundreds of young players get two full days'),
    expect: ['app does not claim "hundreds of"'],
  },

  /* ---- back-office links (test-back-office-links.js) -------------------- */

  {
    name: 'the Organizer link creeps back into the top nav',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '        <a href="#sponsors" style="color:#EDEDED;font-weight:600;font-size:15px">Sponsors</a>\n',
      '        <a href="#sponsors" style="color:#EDEDED;font-weight:600;font-size:15px">Sponsors</a>\n        <a href="/organizer" style="color:#8a8f99;font-weight:600;font-size:14px">Organizer</a>\n'),
    expect: ['no /organizer link in the nav', 'exactly seven links'],
  },
  {
    name: 'the Organizer link comes back as a RAW FILENAME, which /organizer checks would miss',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '        <a href="#sponsors" style="color:#EDEDED;font-weight:600;font-size:15px">Sponsors</a>\n',
      '        <a href="#sponsors" style="color:#EDEDED;font-weight:600;font-size:15px">Sponsors</a>\n        <a href="Organizer.dc.html" style="color:#8a8f99;font-weight:600;font-size:14px">Organizer</a>\n'),
    expect: ['no raw Organizer.dc.html link in the nav', 'exactly seven links'],
  },
  {
    /* The over-deletion the absence checks alone would not notice. */
    name: 'a public nav link is deleted along with the back-office ones',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '        <a href="#venue" style="color:#EDEDED;font-weight:600;font-size:15px">Venue</a>\n', ''),
    expect: ['still has Venue', 'exactly seven links'],
  },
  {
    name: 'a back-office link is put half way up the page instead of the footer',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '  <!-- ============ SPONSORS ============ -->',
      '  <div><a href="/manager">Manager</a></div>\n  <!-- ============ SPONSORS ============ -->'),
    expect: ['above the footer'],
  },
  {
    name: 'the "Manager dashboard" duplicate returns to the Explore column',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '          <a href="/app" style="color:#8a8f99">Match-day app</a>\n',
      '          <a href="/app" style="color:#8a8f99">Match-day app</a>\n          <a href="/manager" style="color:#8a8f99">Manager dashboard</a>\n'),
    expect: ['exactly one /manager link in the footer', 'Manager dashboard'],
  },
  {
    name: 'the labels drift back towards the old "login" wording',
    suite: 'test-back-office-links.js',
    apply: () => {
      patch(HOME, '>Quins Organizer &rarr;<'.replace('&rarr;', '→'), '>Organizer login →<');
      patch(HOME, '>Quins Age Group Manager →<', '>Manager login →<');
    },
    expect: ['labelled "Quins Organizer"', 'old "Organizer login" wording is gone'],
  },
  {
    name: 'the footer organiser link reverts to the raw filename',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '<a href="/organizer" style="color:#EDEDED;font-weight:700', '<a href="Organizer.dc.html" style="color:#EDEDED;font-weight:700'),
    expect: ['exactly one /organizer link in the footer', 'raw Organizer.dc.html href survives'],
  },
  {
    /* The rewrite is what makes the clean URL resolve at all. Delete it and
       both footer links still look perfect in the markup. */
    name: 'the /organizer rewrite is removed from netlify.toml, orphaning the clean URL',
    suite: 'test-back-office-links.js',
    apply: () => patch('netlify.toml', '  from = "/organizer"', '  from = "/organiser"'),
    expect: ['netlify.toml still rewrites'],
  },
  {
    /* Measured: without this the row overflows its own box by 136px at 390px
       wide and half the second pill is off the screen, unreachable. */
    name: 'the footer bar loses flex-wrap, clipping the manager pill off a phone screen',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, 'border-top:1px solid rgba(255,255,255,0.08);font-size:13px;display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between',
      'border-top:1px solid rgba(255,255,255,0.08);font-size:13px;display:flex;justify-content:space-between'),
    expect: ['bar wraps rather than clipping'],
  },
  {
    name: 'the pills lose nowrap, stranding the arrow on its own line',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, 'letter-spacing:.3px;white-space:nowrap;transition:background .18s ease', 'letter-spacing:.3px;transition:background .18s ease'),
    expect: ['not break before its arrow'],
  },
];

/* ------------------------------------------------------------------------ */

let clean = 0, proven = 0;
const problems = [];

console.log('Baseline — the suites must pass on an undamaged copy first.\n');
seed();
['test-registration.js', 'test-registration-panel.js', 'test-venue-map.js', 'test-accounts.js',
 'test-venue-splits.js', 'test-agegroups.js', 'test-intake.js',
 'test-functions-load.js', 'test-email.js', 'test-organizer-grouping.js', 'test-google-auth.js',
 'test-fixtures-results-sync.js', 'test-simulate-tournament.js', 'test-sponsors.js', 'test-back-office-links.js'].forEach((f) => {
  if (!fs.existsSync(path.join(__dirname, f))) return;
  const r = run(f);
  if (r.code === 0) { clean++; console.log('  clean pass  ' + f); }
  else { problems.push(`${f} does not pass on an undamaged copy`); console.log('  BASELINE FAIL  ' + f + '\n' + r.out); }
});

console.log('\nInjecting faults one at a time.\n');
FAULTS.forEach((f, i) => {
  if (!fs.existsSync(path.join(__dirname, f.suite))) { console.log(`  ${i + 1}. skipped (no ${f.suite}) — ${f.name}`); return; }
  seed();
  /* A fault that cannot be injected is a FAILURE of this script, not a pass.
     It means the code moved and this file did not follow — so the check it was
     meant to exercise has not been exercised by anything. */
  try { f.apply(); } catch (e) { problems.push(`fault ${i + 1} could not be injected (the code moved and this script did not follow): ${e.message}`); console.log(`  ${i + 1}. COULD NOT INJECT — ${f.name}\n     ${e.message}`); return; }

  const r = run(f.suite);
  if (r.code === 0) {
    problems.push(`fault ${i + 1} (${f.name}) was NOT caught by ${f.suite}`);
    console.log(`  ${i + 1}. NOT CAUGHT  — ${f.name}`);
    return;
  }
  /* Failing is not enough: the check that failed has to be the one that claims
     to guard this behaviour. A suite that collapses with an exception "fails"
     for every fault and proves nothing. */
  const named = f.expect.some((frag) => r.out.includes(frag));
  if (!named) {
    problems.push(`fault ${i + 1} (${f.name}) failed, but not on any of: ${f.expect.join(' | ')}`);
    console.log(`  ${i + 1}. caught, WRONG CHECK — ${f.name}`);
    console.log(r.out.split('\n').filter((l) => l.includes('FAIL')).slice(0, 4).map((l) => '        ' + l).join('\n'));
    return;
  }
  proven++;
  console.log(`  ${i + 1}. caught — ${f.name}`);
});

fs.rmSync(TMP, { recursive: true, force: true });

console.log(`\n${proven}/${FAULTS.length} faults caught by the named check; ${clean} suite(s) clean on an undamaged copy.`);
if (problems.length) {
  console.log('\nPROBLEMS:');
  problems.forEach((p) => console.log('  • ' + p));
  process.exit(1);
}
process.exit(0);
