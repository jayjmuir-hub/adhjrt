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
];

/* ------------------------------------------------------------------------ */

let clean = 0, proven = 0;
const problems = [];

console.log('Baseline — the suites must pass on an undamaged copy first.\n');
seed();
['test-registration.js', 'test-registration-panel.js', 'test-venue-map.js', 'test-accounts.js',
 'test-venue-splits.js'].forEach((f) => {
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
