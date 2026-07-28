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
  'scores-data.js',
  'organizer-data.js',
  'Quins JRT.dc.html',
  'Organizer.dc.html',
  path.join('netlify', 'functions', '_registration.js'),
  path.join('netlify', 'functions', '_venue.js'),
  path.join('netlify', 'functions', '_agegroups.js'),
  path.join('netlify', 'functions', '_intake.js'),
  path.join('netlify', 'functions', '_ratelimit.js'),
  path.join('netlify', 'functions', 'submission-created.js'),
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

const REG = path.join('netlify', 'functions', '_registration.js');
const SD = 'scores-data.js';

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
    name: 'blockOfPitch stops normalising case (c4b and C4A become two blocks)',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '  return (m ? m[1] : s).toUpperCase();', '  return (m ? m[1] : s);'),
    expect: ['case is normalised'],
  },
  {
    name: 'the sub-pitch letter is no longer stripped (every pitch its own block)',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html', '  return (m ? m[1] : s).toUpperCase();', '  return s.toUpperCase();'),
    expect: ['D5A is in block D5', 'groups 18 pitches into 9 blocks'],
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
    expect: ['D4A names both groups'],
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
      patch(f, "const { loadAccounts, verifyPassword, sign } = require('./_auth');",
        "const { loadAccounts, verifyPassword, sign, passwordProblem } = require('./_auth');");
      patch(f, "    if (!account || !(await verifyPassword(password || '', account.passwordHash))) {",
        "    if (passwordProblem(password)) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Password too short.' }) };\n    if (!account || !(await verifyPassword(password || '', account.passwordHash))) {");
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
    apply: () => patchPitchModel("2: ['A', 'B'],", "2: ['1', '2'],"),
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
      "mapNameStyle: 'font-weight:900;font-size:14px;", "mapNameStyle: 'font-weight:900;font-size:11px;"),
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
    name: 'USER_ENTERED is put back, so a typed "=" becomes a live formula',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'submission-created.js'),
      "      valueInputOption: 'RAW',", "      valueInputOption: 'USER_ENTERED',"),
    expect: ['still RAW'],
  },
  {
    name: 'a reader grows its own copy of the column order again',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', 'get-registrations.js'),
      "function getAuth() {",
      "const TEAM_FIELDS = ['submittedAt', 'club'];\n\nfunction getAuth() {"),
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
];

/* ------------------------------------------------------------------------ */

let clean = 0, proven = 0;
const problems = [];

console.log('Baseline — the suites must pass on an undamaged copy first.\n');
seed();
['test-registration.js', 'test-registration-panel.js', 'test-venue-map.js', 'test-accounts.js',
 'test-venue-splits.js', 'test-agegroups.js', 'test-intake.js'].forEach((f) => {
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
