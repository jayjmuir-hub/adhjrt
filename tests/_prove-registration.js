/* tests/_prove-registration.js
   ------------------------------------------------------------------------
   NOT in runall.ps1's $tests list — it is run as a separate step at the bottom
   of that script, and skipped by `runall.ps1 -NoProve`, because it is slow (a
   node process per fault) and because it is a check on the TESTS, not on the
   site. This is the thing that makes the rest of the suite
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
  /* test-manager-dc-draw.js drives the Manager Dashboard — added Aug 2026
     with the withTeamNames faults. Absent from this list, any test reading it
     dies on ENOENT and takes every later check with it (see the 1 Aug lesson
     in state-of-play). */
  'Manager.dc.html',
  /* test-signin-page.js reads the unified sign-in page. */
  'Signin.dc.html',
  /* Aug 2026 — the unlisted club declaration page. test-intake.js reads it for
     the form name, the age-group list and the silent-link assertions, so
     without it here that whole file dies on ENOENT and its faults report
     "failed, but not on the named check". Second time this trap has been hit
     in one day; the first was _signins.js. */
  'Club.dc.html',
  /* …and the three files the silent-link assertions read to prove it stays
     unlisted: the rewrite that serves it, the sitemap it must be absent from,
     and robots.txt, which must not NAME it (a Disallow would advertise it). */
  'sitemap.xml',
  'robots.txt',
  /* test-design-polish.js (Aug 2026) reads every page including these two,
     plus the share-card asset — the PNG rides through the text-normalising
     copy as garbage bytes, which is fine because only its EXISTENCE is ever
     asserted, never its content. */
  'legal.html',
  '404.html',
  /* The tournament rules page (5 Aug 2026). test-about-board.js reads it for
     the placeholder, the indexability and the pair-with-/legal checks. */
  'rules.html',
  path.join('assets', 'share-card.png'),
  path.join('assets', 'apple-touch-icon.png'),
  /* test-sponsors.js gates its asset-on-disk checks on assets/ EXISTING —
     which it now does in the temp copy (the two entries above created it), so
     the HSBC lockups must ride along too or the baseline fails. Existence
     only, same caveat as above. */
  path.join('assets', 'sponsor-hsbc-white.webp'),
  path.join('assets', 'sponsor-hsbc.webp'),
  /* ⚠️ The supporters grid (4 Aug 2026). test-sponsors.js asserts every file the
     SPONSORS list names EXISTS, and its assets-on-disk gate is flipped TRUE by
     the assets/ folder this script already creates for the HSBC lockups — so
     without these the suite fails on an UNDAMAGED copy and takes every sponsor
     fault with it, reporting them all as "caught" while proving nothing. Same
     trap as _signins.js and Club.dc.html. The rule is: check this list whenever
     a test starts reading new files. */
  path.join('assets', 'sponsor-oak-view-group.webp'),
  path.join('assets', 'sponsor-value-performance.webp'),
  path.join('assets', 'sponsor-ashurst-perkins-coie.webp'),
  path.join('assets', 'sponsor-brighton-college.webp'),
  path.join('assets', 'sponsor-sedbergh.webp'),
  path.join('assets', 'sponsor-beond.webp'),
  path.join('assets', 'sponsor-westminster-construction.webp'),
  path.join('assets', 'sponsor-broadway-malyan.webp'),
  path.join('assets', 'sponsor-mccaffertys.webp'),
  path.join('assets', 'sponsor-bottle-store.webp'),
  path.join('assets', 'sponsor-sportsmans-arms.webp'),
  path.join('assets', 'sponsor-yas-cycles.webp'),
  path.join('assets', 'sponsor-arabian-swim-academy.webp'),
  path.join('assets', 'sponsor-align-health.webp'),
  path.join('assets', 'sponsor-bili-boys.webp'),
  path.join('assets', 'sponsor-anderson-education.webp'),
  path.join('assets', 'sponsor-crompton-partners.webp'),
  path.join('assets', 'sponsor-recover.webp'),
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
  /* Aug 2026 — last sign in. login.js and google-auth.js REQUIRE this, so
     without it here every suite that loads either dies on ENOENT and takes
     its faults with it, reporting them as "failed, but not on the named
     check". Hit for real the moment it was added. */
  path.join('netlify', 'functions', '_signins.js'),
  path.join('netlify', 'functions', 'accounts-admin.js'),
  path.join('netlify', 'functions', 'organizer-signup.js'),
  path.join('netlify', 'functions', 'manager-signup.js'),
  path.join('netlify', 'functions', 'login.js'),
  path.join('netlify', 'functions', 'my-account.js'),
  /* organizer-login.js and manager-login.js were here until they were retired
     on 3 Aug 2026. Do not add them back to satisfy a check — the check that
     asserts they are GONE is satisfied by their absence from this list too,
     and the fault that proves it CREATES one in the damaged copy. */
  path.join('netlify', 'functions', '_googleAuth.js'),
  path.join('netlify', 'functions', 'google-auth.js'),
  path.join('netlify', 'functions', 'google-config.js'),
];

/* ⚠️ THE ABOUT-SECTION PHOTO BOARD (5 Aug 2026). test-about-board.js asserts
   that all four files of every photo set PHOTOS names exist on disk, so without
   them here the suite fails on an UNDAMAGED copy — and a suite that fails
   undamaged reports every one of its faults as "caught" while proving nothing.
   That exact trap has now been hit by _signins.js, Club.dc.html and the
   sponsor logos; the rule is: whenever a test starts reading new files, they
   join this list in the SAME commit.

   Generated rather than written out because it is 44 filenames of pure
   boilerplate, and a hand-typed list would drift from PHOTOS the first time a
   photo is added. Existence is all that is ever asserted, so riding through the
   text-normalising copy as garbage bytes is fine — same caveat as the PNGs
   above. If a check on their CONTENT is ever added, this stops being safe. */
for (let i = 1; i <= 11; i++) {
  const n = (i < 10 ? '0' : '') + i;
  for (const suffix of ['.avif', '-sm.avif', '.webp', '-sm.webp']) {
    NEEDED.push(path.join('assets', 'board', `board-${n}${suffix}`));
  }
}

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
  fs.mkdirSync(path.join(TMP, 'assets'), { recursive: true });
  /* assets/board holds the About-section photos — the folder has to exist
     before NEEDED's entries for it can be written. */
  fs.mkdirSync(path.join(TMP, 'assets', 'board'), { recursive: true });
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
/* The organiser dashboard, patched by the Clubs-tab faults below. */
const ORG = 'Organizer.dc.html';
/* The scores page's header partner mark, verbatim, so the fault that MOVES it
   carries the block exactly - if the markup is edited the injection refuses
   rather than quietly doing nothing. */
const SC_MARK = [
  '      <span style="display:flex;align-items:center;gap:14px;flex:none">',
  '        <span style="width:1px;height:28px;background:rgba(255,255,255,0.18)"></span>',
  '        <img src="assets/sponsor-hsbc-white.webp" alt="HSBC" style="height:18px;width:auto;display:block">',
  '      </span>',
  '',
].join('\n');
const HDR_IMG = '<img src="assets/sponsor-hsbc-white.webp" alt="HSBC" style="height:19px;width:auto;display:block">';
/* ⚠️ THE BAND WAS REMOVED ON 3 AUG 2026 and these two constants are kept for
   the OPPOSITE reason they were written: no fault deletes the band any more —
   one PUTS IT BACK, which is the regression that matters now. Carried verbatim
   so that if the surrounding markup is edited the injection refuses rather than
   quietly doing nothing. */
const BAND_IMG = '<img src="assets/sponsor-hsbc-white.webp" alt="HSBC" style="height:54px;width:auto;max-width:100%;display:block">';
/* The hero lockup, added 3 Aug 2026. Carried verbatim for the same reason as
   everything else in this section: a fault that deletes or moves it must refuse
   to inject if the markup is edited, rather than quietly doing nothing. */
const HERO_IMG = '<img src="assets/sponsor-hsbc-white.webp" alt="HSBC" style="height:128px;width:auto;max-width:100%;display:block">';
const HERO_LABEL = '<span style="font-size:11px;letter-spacing:2.4px;color:#3bd070;font-weight:800;text-transform:uppercase;white-space:nowrap">In partnership with</span>';
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
    /* THE TAB BAR — regrouped 7 Aug 2026 at Jay's request. Nothing asserted
       its order before that date: the pre-existing "there is a Clubs tab
       button" check matches wherever that button sits, so it survives any
       shuffle. These five faults are the whole guard. */
    name: 'the tab order reverts - Clubs falls back behind Teams',
    suite: 'test-organizer-clubs.js',
    apply: () => patch('Organizer.dc.html',
      '<button onClick="{{ showClubs }}" style="{{ tabClubsStyle }}">Clubs',
      '<button onClick="{{ showNothing }}" style="{{ tabClubsStyle }}">Clubs'),
    expect: ['the bar carries showClubs'],
  },
  {
    /* the swap is in the MIDDLE on purpose. A fault that moved the FIRST or
       LAST tab would be caught by a lazy "Clubs is first, Accounts is last"
       check; this one is only caught by the pairwise sweep, which is why the
       sweep exists rather than two spot checks. */
    name: 'Venue & days and Tournament swap inside their group',
    suite: 'test-organizer-clubs.js',
    apply: () => patch('Organizer.dc.html',
      '<button onClick="{{ showTournament }}" style="{{ tabTournamentStyle }}">Tournament</button>',
      '<button onClick="{{ showZzTournament }}" style="{{ tabTournamentStyle }}">Tournament</button>'),
    expect: ['the bar carries showTournament'],
  },
  {
    name: 'a group label is dropped - the middle block loses its name',
    suite: 'test-organizer-clubs.js',
    apply: () => patch('Organizer.dc.html',
      '>Tournament configuration</div>', '></div>'),
    expect: ['Tournament configuration'],
  },
  {
    /* A missing rule looks fine on a wide screen and reads as one long
       undifferentiated row on a laptop - no error anywhere. */
    name: 'one of the two break marks is removed',
    suite: 'test-organizer-clubs.js',
    apply: () => patch('Organizer.dc.html',
      '<div style="width:1px;background:rgba(0,0,0,0.13);align-self:stretch;margin:0 6px"></div>',
      '<div></div>'),
    expect: ['two break marks'],
  },
  {
    /* THE TIDY-UP THAT LOOKS RIGHT. Clubs is leftmost, so making it the
       landing tab reads as consistency - and it is not what Jay chose. Until
       October the Clubs tab shows 0 registered for every club. */
    name: 'the default tab follows the leftmost button to Clubs',
    suite: 'test-organizer-clubs.js',
    apply: () => patch('Organizer.dc.html',
      "tab: 'teams', search: '',", "tab: 'clubs', search: '',"),
    expect: ['the default tab is still Teams'],
  },
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
    apply: () => patch('Organizer.dc.html', "              border = '1px solid rgba(0,0,0,0.34)';", "              border = '1px solid #8F6400';"),
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
    /* Repointed 3 Aug 2026. organizer-data.js used to DEFINE changeMyPassword;
       it re-exports it from scores-data.js now that my-account.js serves both
       roles. Same guarantee, new shape: drop it from the re-export list and the
       page calls an api.* that does not exist, which is exactly the silent
       failure test-accounts.js was written for. */
    apply: () => patch('organizer-data.js',
      "export { myAccount, changeMyPassword, linkGoogle } from './scores-data.js';",
      "export { myAccount, linkGoogle } from './scores-data.js';"),
    expect: ['provides api.changeMyPassword()', 'changeMyPassword exists'],
  },
  {
    name: "the 'password' action is removed from the backend",
    suite: 'test-accounts.js',
    apply: () => patch(path.join('netlify', 'functions', 'accounts-admin.js'), "if (action === 'password') {", 'if (false) {'),
    expect: ["handles action 'password'", "'password' is handled"],
  },
  /* "changing your own password stops checking the current one" was HERE until
     3 Aug 2026, injecting into accounts-admin.js. Its subject moved to
     my-account.js with the changeMine action, so the fault moved with it —
     see "my-account.js stops verifying the current password", which injects
     the same mistake where the code now lives and is caught by
     test-my-account.js DRIVING it rather than reading the source. A fault left
     pointing at a file its subject has left is a failed run, not a pass. */
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
    name: 'a length check is added to login.js (was organizer-login.js before its retirement)',
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
      /* Repointed 3 Aug 2026 with its subject: organizer-login.js was retired,
         but the RULE it guarded is alive on login.js, which is now the only
         password endpoint that could make this mistake. A fault deleted along
         with its file would have taken real coverage with it. */
      const f = path.join('netlify', 'functions', 'login.js');
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
    /* The twin of the organizer-signup.js fault above, for the Google path.
       Since 3 Aug 2026 organiser signup is closed by the ABSENCE of
       ORGANIZER_INVITE_CODE, and that only holds while BOTH paths refuse on
       absence. This half had only its mismatch clause pinned. */
    name: 'google-auth.js stops refusing organiser signup when ORGANIZER_INVITE_CODE is absent',
    suite: 'test-google-auth.js',
    apply: () => patch(path.join('netlify', 'functions', 'google-auth.js'),
      'if (!process.env.ORGANIZER_INVITE_CODE || inviteCode !== process.env.ORGANIZER_INVITE_CODE) {',
      'if (inviteCode !== process.env.ORGANIZER_INVITE_CODE) {'),
    expect: ['refuses on the variable being ABSENT'],
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
     Two generations of this. Before 27 Jul 2026: white text on a
     see-through tinted chip (shipped). 27 Jul - 2 Aug: computed ink ON the
     tint — WCAG-clean and still hard to read. Since 2 Aug the chip is an
     opaque white card with constant dark ink and an outlined swatch of the
     exact tint per group; the ink-picking machinery is deleted, and these
     faults guard the new design instead. */

  {
    name: 'the chip body goes translucent again (the original bug, third attempt)',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html',
      "          chipBg = '#FFFFFF';", "          chipBg = 'rgba(255,255,255,0.72)';"),
    expect: ['the chip body is opaque white'],
  },
  {
    name: 'the chip ink goes back to being keyed off the tint',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html',
      "          chipFg = '#1A1C1F';", '          chipFg = blockTints[0];'),
    expect: ['the ink is the constant page ink'],
  },
  {
    name: 'the swatch loses its exact tint, collapsing every group to one grey',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html',
      "background:${AGE_TINT[ag] || '#5A626E'};border:1px solid rgba(0,0,0,0.35)",
      "background:#5A626E;border:1px solid rgba(0,0,0,0.35)"),
    expect: ['the swatch carries the EXACT tint'],
  },
  {
    name: 'the swatch outline is removed, so the pale tints vanish on the white card',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html',
      "background:${AGE_TINT[ag] || '#5A626E'};border:1px solid rgba(0,0,0,0.35)",
      "background:${AGE_TINT[ag] || '#5A626E'}"),
    expect: ['outlined so pale tints register'],
  },
  {
    name: 'the age-group code is drawn in the tint again',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html',
      "            codeStyle: 'font-size:14px;font-weight:800;letter-spacing:.3px;color:#1A1C1F',",
      "            codeStyle: `font-size:14px;font-weight:800;letter-spacing:.3px;color:${AGE_TINT[ag] || '#5A626E'}`,"),
    expect: ['the code is constant dark ink, never the tint'],
  },
  {
    name: 'a shared block collapses back to one swatch',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html',
      '          mapGroups: blockUsers.map((ag) => ({',
      '          mapGroups: blockUsers.slice(0, 1).map((ag) => ({'),
    expect: ['a shared block carries two swatches'],
  },
  {
    name: 'the schematic label goes back to tint-on-tint ink',
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html',
      "              who = users[0].toUpperCase(); whoColor = '#1A1C1F';",
      '              who = users[0].toUpperCase(); whoColor = tints[0];'),
    expect: ['the label ink is the dark page ink, never the tint'],
  },
  {
    name: "the schematic time-share label goes back to the dark-mode era's light grey",
    suite: 'test-venue-map.js',
    apply: () => patch('Organizer.dc.html',
      "              whoColor = '#1A1C1F';  /* was #e7eaef",
      "              whoColor = '#e7eaef';  /* was #e7eaef"),
    expect: ['the shared label is dark ink too'],
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
      '    if (!open) {', '    if (false) {'),
    expect: ['a submission outside the window is refused'],
  },
  {
    name: 'an unreadable registration window FAILS OPEN, taking late entries',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "      log(`registration window unreadable, refusing - ${err && err.message}`);\n      return { status: 403, body: { ok: false, error: 'Registration is not open at the moment. Please email admin@adhjrt.com.' } };",
      '      open = true;'),
    expect: ['an unreadable window refuses rather than guessing'],
  },
  /* ---- the supporters grid (test-sponsors.js, 4 Aug 2026) --------------- */

  {
    name: 'a supporter is dropped without anybody noticing',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "  { name: 'Align Health',                           file: 'assets/sponsor-align-health.webp',           h: 40, light: true, url: 'https://alignhealth.ae/' },\n", ''),
    expect: ['eighteen confirmed supporters'],
  },
  {
    /* A mistyped filename is a broken image on the live site that reports
       nothing, anywhere — the exact shape of the crest reference that once
       killed every social share preview. */
    name: 'a logo filename is mistyped, so the image silently 404s',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "file: 'assets/sponsor-sedbergh.webp'", "file: 'assets/sponsor-sedburgh.webp'"),
    expect: ['has its logo file on disk'],
  },
  {
    /* ⚠️ A raw download dropped in unprocessed. The .webp conversion is WHERE
       the white treatment happened; a .png means somebody skipped it, and a
       dark logo on #0C0C0E vanishes while reporting no error. The HSBC lesson,
       one section down the page. */
    name: 'a raw .png is dropped in, skipping the white conversion',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "file: 'assets/sponsor-beond.webp'", "file: 'assets/sponsor-beond.png'"),
    expect: ['processed .webp'],
  },
  {
    /* The list returned and never bound — invisible to any check that only
       reads the data, which is why this suite drives the markup too. */
    name: 'the grid stops looping over the sponsors list',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '<sc-for list="{{ sponsors }}" as="s"', '<sc-for list="{{ nothing }}" as="s"'),
    expect: ['loops over the sponsors list'],
  },
  {
    name: 'the grid stops binding the logo file',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'src="{{ s.file }}"', 'src="assets/sponsor-hsbc-white.webp"'),
    expect: ['binds both the file and the name'],
  },
  {
    /* ⚠️ The tidy-up that demotes the tournament's only confirmed PARTNER into
       a row of supporters. Warned about in CLAUDE.md since 2 Aug. */
    name: 'HSBC is folded into the supporters grid, losing the hierarchy',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "  { name: 'Oak View Group',",
      "  { name: 'HSBC', file: 'assets/sponsor-hsbc-white.webp', h: 44, url: 'https://www.hsbc.ae/' },\n  { name: 'Oak View Group',"),
    expect: ['eighteen confirmed supporters'],
  },
  {
    /* ⚠️ REPOINTED 5 Aug. This used to inject a half-added Recover — a name
       with no file behind it — while Recover's artwork was still pending. It
       has since arrived, so the fault's subject stopped existing. The RULE is
       alive, so the fault follows it: a sponsor named on the page whose file
       reference has been lost. */
    name: 'a sponsor is named with no file behind it',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "file: 'assets/sponsor-align-health.webp'", "file: ''"),
    expect: ['eighteen confirmed supporters'],
  },
  {
    name: 'the grid label is changed so it reads as one flat wall with HSBC',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '>With the support of<', '>Principal partner<'),
    expect: ['sits BELOW HSBC'],
  },
  {
    name: 'the grid stops lazy-loading, so fourteen logos block the fold',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, ' loading="lazy" style="max-height:', ' style="max-height:'),
    expect: ['lazy loading'],
  },

  /* ---- per-logo sizing in the grid (test-sponsors.js, 5 Aug 2026) ------- */

  {
    /* ⚠️ THE BUG THAT SHIPPED IN THE FIRST DRAFT and was caught only by looking
       at a render: one fixed height for fourteen logos whose aspect ratios span
       1.1:1 to 11.5:1. height + max-width squashes the wide ones and the square
       ones come out the size of a postage stamp. */
    name: 'the grid goes back to one fixed height for every logo',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'style="max-height:{{ s.h }}px;max-width:100%;width:auto;height:auto;object-fit:contain',
      'style="height:44px;max-width:100%;width:auto;object-fit:contain'),
    expect: ['binds the per-logo height'],
  },
  {
    /* The heights are still in the data but the markup ignores them - the
       "returned and never bound" failure, one level down from the sc-for. */
    name: 'the markup stops using the per-logo height it is given',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'max-height:{{ s.h }}px', 'max-height:44px'),
    expect: ['binds the per-logo height'],
  },
  {
    /* object-fit dropped: the clamp then distorts instead of fitting. */
    name: 'object-fit is dropped, so a clamped logo stretches',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, ';object-fit:contain;display:block">', ';display:block">'),
    expect: ['object-fit:contain'],
  },
  {
    /* A height taller than the tile: the logo is clipped by the flex box and
       the row grows unevenly. 68 is the ceiling for a reason. */
    name: 'a logo is given a height that does not fit the tile',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "h: 51, url:", "h: 96, url:"),
    expect: ['height inside the tile'],
  },
  {
    /* ⚠️ THE LAZY FIX. Somebody hits the "not all the same number" check and
       flattens the list to one value with a couple of outliers - or, as here,
       levels the widest mark UP to match the rest, which is the distortion
       coming straight back. */
    name: 'the widest mark is levelled up to match the others',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "sponsor-brighton-college.webp',       h: 35,", "sponsor-brighton-college.webp',       h: 55,"),
    expect: ['widest mark'],
  },
  {
    /* ⚠️ rel="noopener" dropped from a target="_blank" link. REVERSE TABNABBING:
       the opened page gets a live window.opener handle and can navigate THIS
       tab anywhere — and the tab it would redirect is the one a parent is
       registering a child in. It looks like tidying an attribute nobody reads. */
    name: 'a new-tab sponsor link loses rel="noopener"',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'target="_blank" rel="noopener noreferrer"\n                 aria-label',
      'target="_blank"\n                 aria-label'),
    expect: ['carries rel="noopener"'],
  },
  {
    /* A sponsor left with a placeholder link — the tile looks finished and goes
       nowhere. */
    name: 'a sponsor URL is left as a placeholder',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "url: 'https://yascycles.com/'", "url: '#'"),
    expect: ['links somewhere'],
  },
  {
    /* ⚠️ The copy-paste slip: the row is complete, the link works, and it opens
       the wrong company. Nothing about it looks broken. */
    name: 'two sponsors end up pointing at the same website',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "url: 'https://recover.ae/'", "url: 'https://alignhealth.ae/'"),
    expect: ['every sponsor URL is distinct'],
  },
  {
    /* http, not https — a mixed-content warning on a page parents register on. */
    name: 'a sponsor link drops to http',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "url: 'https://anderson.ae/'", "url: 'http://anderson.ae/'"),
    expect: ['over https'],
  },
  {
    /* ⚠️ The header mark made a link — the rule it breaks is about the STICKY
       header: a tap target that leaves the site follows a visitor down every
       page, including a parent part way through the registration form. */
    name: 'the sticky header HSBC mark is turned into a link',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '<img src="assets/sponsor-hsbc-white.webp" alt="HSBC" style="height:19px;width:auto;display:block">',
      '<a href="https://www.hsbc.ae/"><img src="assets/sponsor-hsbc-white.webp" alt="HSBC" style="height:19px;width:auto;display:block"></a>'),
    expect: ['header HSBC mark is still NOT a link'],
  },
  {
    /* The click target shrunk back to the logo — on a phone a tile that only
       responds in its middle reads as broken. */
    name: 'the sponsor link stops filling its tile',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'justify-content:center;width:100%;height:100%;text-decoration:none',
      'justify-content:center;text-decoration:none'),
    expect: ['whole tile'],
  },
  {
    /* ⚠️ The sponsors-section lockup quietly shrunk back. The mark is still
       there, so nothing looks broken — and the tournament's only confirmed
       partner is smaller than it was with nobody the wiser. */
    name: 'the sponsors-section HSBC lockup shrinks back to 64px',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'alt="HSBC" style="height:96px', 'alt="HSBC" style="height:64px'),
    expect: ['placements are 19px, 128px and 96px'],
  },
  {
    /* ⚠️ Crompton no longer leads, so the alternation starts on the wrong foot.
       Jay asked for it first on 5 Aug. */
    name: 'Crompton is moved out of the first slot',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME,
      "  { name: 'Crompton Partners Estate Agents',        file: 'assets/sponsor-crompton-partners.webp',      h: 54, light: true, url: 'https://cromptonpartners.com/' },\n  { name: 'Oak View Group',",
      "  { name: 'Oak View Group',"),
    expect: ['Crompton leads the list'],
  },
  {
    /* ⚠️ The alternation broken by a reorder that looks like tidying — grouping
       the white boxes together, which is exactly what somebody would do. */
    name: 'the list is regrouped so the tiles stop alternating',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME,
      "  { name: 'Oak View Group',                         file: 'assets/sponsor-oak-view-group.webp',         h: 51, url: 'https://www.oakviewgroup.com/' },\n  { name: 'Brighton College Abu Dhabi',             file: 'assets/sponsor-brighton-college.webp',       h: 35, light: true, url: 'https://www.brightoncollege.ae/' },",
      "  { name: 'Brighton College Abu Dhabi',             file: 'assets/sponsor-brighton-college.webp',       h: 35, light: true, url: 'https://www.brightoncollege.ae/' },\n  { name: 'Oak View Group',                         file: 'assets/sponsor-oak-view-group.webp',         h: 51, url: 'https://www.oakviewgroup.com/' },"),
    expect: ['the tiles alternate'],
  },
  {
    /* ⚠️ Back to a grid, which leaves the last row hanging on the left. There
       is no grid property that centres an incomplete final row. */
    name: 'the supporters grid goes back to CSS grid, orphaning the last row',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'display:flex;flex-wrap:wrap;justify-content:center;gap:14px',
      'display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px'),
    expect: ['last row is centred'],
  },
  {
    /* ⚠️ Broadway Malyan slid back to the TAGLINE lockup — which is a real file
       of theirs, so nothing about it looks wrong, and their NAME disappears
       from the page again. The height is the only thing a source test can see
       it by: 11.5:1 needed 26, the wordmark is 5.4:1 at 36. */
    name: 'Broadway Malyan goes back to the tagline lockup',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "sponsor-broadway-malyan.webp',        h: 36,", "sponsor-broadway-malyan.webp',        h: 26,"),
    expect: ['sized for the wordmark'],
  },
  {
    /* ⚠️ Bili Boys "corrected" to the height the formula gives for its ratio.
       It is the one file stored at native size (154x90) because that is all
       the artwork there is, so 64 is a blurrier logo, not a bigger one. */
    name: 'the small-source Bili Boys logo is scaled up to the formula height',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "sponsor-bili-boys.webp',              h: 52,", "sponsor-bili-boys.webp',              h: 64,"),
    expect: ['90px source is not stretched'],
  },
  {
    /* The exception tidied into looking like every other row - which is how an
       exception spreads by imitation. */
    /* ⚠️ REPOINTED 5 Aug, when the grid stopped recolouring anything: Bili Boys
       is no longer "the exception to the white treatment", it is the one logo
       that is already a box. The reason moved with it. */
    name: 'the reason Bili Boys stays on the dark tile is tidied away',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'badge with its own opaque cream ground', 'logo'),
    expect: ['stays on the dark tile is written down'],
  },
  {
    /* Bili Boys quietly dropped again, which is the state the page was in for
       a day and the thing Jay noticed. */
    name: 'Bili Boys is dropped from the supporters list',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "  { name: 'Bili Boys Biltong',                      file: 'assets/sponsor-bili-boys.webp',              h: 52, url: 'https://www.biliboys.ae/' },\n", ''),
    expect: ['eighteen confirmed supporters', 'Bili Boys is on the page'],
  },
  {
    /* ⚠️ REPOINTED 5 Aug. This guarded Anderson's red while the grid recoloured
       logos; nothing is recoloured now, so the rule it protects has become the
       WHITE-BOX RULE ITSELF. "Why is this one white and that one not?" is the
       question a later session asks, and an unwritten answer gets replaced by
       somebody's eye. */
    name: 'the white-box rule is deleted, leaving the flags unexplained',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'The flag is assigned by MEASUREMENT, not taste', 'The flag is set per logo'),
    expect: ['white-box rule is recorded'],
  },
  {
    name: 'Anderson is dropped from the supporters list',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "  { name: 'Anderson Executive Development Centre',  file: 'assets/sponsor-anderson-education.webp',     h: 41, light: true, url: 'https://anderson.ae/' },\n", ''),
    expect: ['eighteen confirmed supporters', 'Anderson is on the page'],
  },
  {
    /* ⚠️ A white box spreading to a logo that reads perfectly well on the dark
       tile — the lazy fix, and it puts a bright rectangle in the band for no
       reason. Yas Mena Cycles is the worst case: it exists ONLY as a white
       file, so a white box would erase it outright. */
    name: 'a white box spreads to a logo that only exists as a white file',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "sponsor-yas-cycles.webp',             h: 65,", "sponsor-yas-cycles.webp',             h: 65, light: true,"),
    expect: ['nine sponsors get a white box', 'yas-cycles stays on the dark tile'],
  },
  {
    /* A white box removed: Crompton's navy keyhole goes back to being invisible
       on #151517, reporting no error anywhere. */
    name: 'a white box is dropped, hiding a dark-ink logo',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "h: 54, light: true, url:", "h: 54, url:"),
    expect: ['nine sponsors get a white box'],
  },
  {
    /* The tile goes back to one hardcoded colour — which looks like a tidy-up
       and silently un-does the exception. */
    name: 'the tile hardcodes one background colour again',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'background:{{ s.bg }};border:1px solid {{ s.edge }}',
      'background:#151517;border:1px solid rgba(255,255,255,0.08)'),
    expect: ['tile binds the colour rather than hardcoding one'],
  },
  {
    /* The border left dark on a white tile: a white box with a black hairline
       reads as a broken image rather than a card. */
    name: 'the tile border stops following the tile colour',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'border:1px solid {{ s.edge }}', 'border:1px solid rgba(255,255,255,0.08)'),
    expect: ['border follows'],
  },
  {
    /* The squarest marks pushed back down to the crowd. This is the postage
       stamp bug, and it is invisible to every check that only counts rows. */
    name: "the near-square marks are shrunk back to the pack",
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "sponsor-sportsmans-arms.webp',        h: 68,", "sponsor-sportsmans-arms.webp',        h: 35,"),
    expect: ['squarest marks'],
  },

  /* ---- the club form's window exemption (4 Aug 2026) -------------------- */

  {
    /* The exemption removed: the silent link goes back to being unusable until
       the day it stops being useful. This is the bug that shipped on 1 Aug and
       survived a removal and a restoration before anyone tried the link. */
    name: 'the club declaration is dragged back under the registration window',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "  if (form !== 'club-registration') {", '  if (true) {'),
    expect: ['a club declaration is accepted with a closed window'],
  },
  {
    /* ⚠️ THE ONE THAT MATTERS. "Why is one form special-cased?" is a reasonable
       question and this is the wrong answer to it: exempting all three opens
       registration for the entire tournament months early, silently, and every
       other check still passes. */
    name: 'the exemption is widened to every form, opening registration months early',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "  if (form !== 'club-registration') {", '  if (false) {'),
    expect: ['a TEAM registration is still refused with a closed window'],
  },
  {
    /* Inverted rather than removed — the club form gated and the public ones
       exempt. Reads as a plausible typo and is the worst of both. */
    name: 'the exemption is inverted, gating the club form and freeing the public ones',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "  if (form !== 'club-registration') {", "  if (form === 'club-registration') {"),
    expect: ['a club declaration is accepted with a closed window'],
  },
  {
    /* The exemption made to swallow the key check too — "the club form does not
       need the gates" taken one step too far. That would make the unlisted form
       fully public. The key check sits EARLIER, so this fault moves it inside
       the exempted branch to prove the two are independent. */
    name: 'the club key check is folded into the window exemption, making the form public',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "  if (form === 'club-registration' && !clubKeyOk(b.clubKey)) {",
      "  if (false && form === 'club-registration' && !clubKeyOk(b.clubKey)) {"),
    expect: ['a club declaration with no key is still refused'],
  },
  {
    /* The window READ left in place on a path that has already decided it does
       not care — a blob round trip bought for nothing, on the one endpoint
       where latency is a public-facing cost. */
    name: 'the window is still read for a club declaration, then ignored',
    suite: 'test-intake.js',
    apply: () => patch(path.join('netlify', 'functions', '_intake.js'),
      "  if (form !== 'club-registration') {\n    let open = false;\n    try {\n      open = !!d.registrationState(await d.loadRegistration(), now).open;",
      "  {\n    let open = false;\n    try {\n      open = !!d.registrationState(await d.loadRegistration(), now).open;\n      if (form === 'club-registration') open = true;"),
    expect: ['the window is not read at all for a club declaration'],
  },
  /* ---- the Clubs tab (test-organizer-clubs.js, Aug 2026) ---------------- */

  {
    /* ⚠️ THE EAGER-NORMALISER. Un-anchoring the suffix strip turns "RC Sharks"
       into "Sharks" and merges two real clubs into one — a wrong number that
       looks entirely plausible, which is worse than a failed match. */
    name: 'the club-name suffix strip is un-anchored, merging different clubs',
    suite: 'test-organizer-clubs.js',
    apply: () => patch(ORG, "const CLUB_SUFFIX_RE = /\\s+(rugby football club|rugby club|rufc|rfc|rc|fc)$/;",
      "const CLUB_SUFFIX_RE = /\\s*(rugby football club|rugby club|rufc|rfc|rc|fc)\\s*/;"),
    expect: ['stay different clubs'],
  },
  {
    /* The opposite failure: no normalisation at all, so "Dubai Exiles RFC"
       stops being "Dubai Exiles" and every club looks short. */
    name: 'club names stop being normalised, so every name variant misses',
    suite: 'test-organizer-clubs.js',
    apply: () => patch(ORG, "  v = v.replace(CLUB_SUFFIX_RE, '').trim();\n  return v;",
      '  return v;'),
    expect: ['are the same club'],
  },
  {
    /* Apostrophes back to spaces — "St George's" becomes "st george s". Found
       by the test on the first run, not by inspection. */
    name: 'apostrophes become spaces again, splitting a club from itself',
    suite: 'test-organizer-clubs.js',
    apply: () => patch(ORG, "  v = v.replace(/['\\u2019]/g, '');\n", ''),
    expect: ['are the same club'],
  },
  {
    name: 'the declared total stops summing across age groups',
    suite: 'test-organizer-clubs.js',
    apply: () => patch(ORG, '      declaredTotal += dec;', '      declaredTotal = dec;'),
    expect: ['declared total is the sum of the boxes'],
  },
  {
    /* Over-registration silently unflagged — Jay asked for it flagged, and a
       club sending MORE than it planned still changes pools and pitches. */
    name: 'only under-registration is flagged, so extra teams go unnoticed',
    suite: 'test-organizer-clubs.js',
    apply: () => patch(ORG, '      flagged: declaredTotal !== got.total || flaggedGroups > 0,',
      '      flagged: declaredTotal > got.total,'),
    expect: ['reads Over'],
  },
  {
    /* The half of the answer that is easiest to drop, because the tab still
       looks complete without it — and it is where a failed name match lands. */
    name: 'clubs that registered without declaring are dropped',
    suite: 'test-organizer-clubs.js',
    apply: () => patch(ORG, '    if (matched.has(key)) return;', '    return;'),
    expect: ['the undeclared club is surfaced'],
  },
  {
    /* An unrecognised age-group name dropped from the club total: the club
       looks short for a reason nobody can see on the screen. */
    name: 'a team in an unrecognised age group stops counting at all',
    suite: 'test-organizer-clubs.js',
    apply: () => patch(ORG, '    c.total += 1;\n    const id = idByName[t.ageGroup];',
      '    const id = idByName[t.ageGroup];\n    if (!id) return;\n    c.total += 1;'),
    expect: ['an unknown age group still counts in the club total'],
  },
  {
    /* ⚠️ The loading-vs-empty trap, one level down. An unreadable sheet reading
       as "nobody has declared yet" is a confident lie in a tab whose entire job
       is to be trusted about numbers. */
    name: 'an unreadable clubs sheet reads as "nobody has declared yet"',
    suite: 'test-organizer-clubs.js',
    apply: () => patch(ORG, '      clubsEmpty: !s.clubsUnavailable && !s.dataLoading && rec.rows.length === 0 && rec.unmatched.length === 0,',
      '      clubsEmpty: rec.rows.length === 0 && rec.unmatched.length === 0,'),
    expect: ['does not also claim nobody has declared'],
  },
  {
    /* The chase-list filter hiding everything, then the empty message claiming
       nothing was ever declared. */
    name: 'a filter that hides every row claims nothing was declared',
    suite: 'test-organizer-clubs.js',
    apply: () => patch(ORG, '      clubsNoneFlagged: s.clubsOnlyFlagged && rec.rows.length > 0 && shown.length === 0,',
      '      clubsNoneFlagged: false,'),
    expect: ['a filter that hides everything says so in its own words'],
  },
  {
    name: 'the chase-list filter stops filtering',
    suite: 'test-organizer-clubs.js',
    apply: () => patch(ORG, '    const shown = s.clubsOnlyFlagged ? rec.rows.filter((r) => r.flagged) : rec.rows;',
      '    const shown = rec.rows;'),
    expect: ['only the clubs to chase show'],
  },
  {
    /* Expanding one club expanding all of them — the "keyed by nothing" bug. */
    name: 'expanding one club expands every club',
    suite: 'test-organizer-clubs.js',
    apply: () => patch(ORG, '        expanded: s.expandedClub === r.club,', '        expanded: !!s.expandedClub,'),
    expect: ['and only that club'],
  },
  {
    /* ⚠️ The clubs sheet made fail-HARD like the other two, so a missing
       GOOGLE_SHEET_ID_CLUBS costs an organiser their Teams and Players tables
       as well. The "why is this one different?" tidy-up. */
    name: 'the clubs sheet is made fail-hard, taking Teams and Players with it',
    suite: 'test-organizer-clubs.js',
    apply: () => patch(path.join('netlify', 'functions', 'get-registrations.js'),
      '        console.error(\'get-registrations: clubs sheet unreadable -\', err && err.message);\n        return null;                                     // null = could not read',
      '        throw err;'),
    expect: ['does not take Teams and Players with it'],
  },
  {
    /* The reconciliation growing its own age-group list. It would drift, and
       drift here means a club's teams landing under no age group at all. */
    name: 'the reconciliation grows its own age-group id list',
    suite: 'test-organizer-clubs.js',
    apply: () => patch(ORG, '  const idByName = Object.fromEntries(MANAGER_AGE_GROUPS.map((g) => [g.name, g.id]));',
      "  const idByName = { 'U12 Mixed Contact': 'u12', 'U16B Contact': 'u16b' };"),
    expect: ['reconciles to itself'],
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
  /* ---- the Tournament tab (test-organizer-tournament.js) ----------------
     The bulk publish moved here from the old /scores Manager area. The
     dangerous regressions are the quiet ones: a loop that stops early, a
     skip-detection that stops matching the server's wording, a binding that
     silently resolves to empty. */

  {
    name: 'the Publish-all loop is truncated to the first age group',
    suite: 'test-organizer-tournament.js',
    apply: () => patch('Organizer.dc.html',
      '      let published = 0, skipped = 0, failed = 0;\n      for (const ag of MANAGER_AGE_GROUPS) {',
      '      let published = 0, skipped = 0, failed = 0;\n      for (const ag of MANAGER_AGE_GROUPS.slice(0, 1)) {'),
    expect: ['every age group is published, tail included'],
  },
  {
    name: 'the Unpublish-all loop is truncated to the first age group',
    suite: 'test-organizer-tournament.js',
    apply: () => patch('Organizer.dc.html',
      '      let done = 0, failed = 0;\n      for (const ag of MANAGER_AGE_GROUPS) {',
      '      let done = 0, failed = 0;\n      for (const ag of MANAGER_AGE_GROUPS.slice(0, 1)) {'),
    expect: ['every age group is unpublished, tail included'],
  },
  {
    name: 'the skipped-group detection stops matching the server\'s wording',
    suite: 'test-organizer-tournament.js',
    apply: () => patch('Organizer.dc.html',
      "        else if (res && /nothing to publish|save a draw/i.test(res.error || '')) skipped++;",
      "        else if (res && /this wording never comes back/i.test(res.error || '')) skipped++;"),
    expect: ['a group with no saved draw is counted as skipped'],
  },
  {
    name: 'the Tournament tab button is deleted from the markup',
    suite: 'test-organizer-tournament.js',
    apply: () => patch('Organizer.dc.html',
      '        <button onClick="{{ showTournament }}" style="{{ tabTournamentStyle }}">Tournament</button>\n', ''),
    expect: ['the Tournament tab button exists'],
  },
  {
    name: 'the onPublishAll binding is dropped from renderVals, so the button silently does nothing',
    suite: 'test-organizer-tournament.js',
    apply: () => patch('Organizer.dc.html',
      '      onPublishAll: () => this.onPublishAll(),\n', ''),
    expect: ['renderVals returns onPublishAll'],
  },
  {
    name: 'the publish re-export is removed from organizer-data.js',
    suite: 'test-organizer-tournament.js',
    apply: () => patch('organizer-data.js',
      "export { publishDraw, unpublishDraw } from './scores-data.js';", ''),
    expect: ['publishDraw is re-exported from scores-data.js'],
  },

  {
    name: 'the never-empty scoring guard is deleted, so a group can be left scoring nothing',
    suite: 'test-organizer-tournament.js',
    apply: () => patch('Organizer.dc.html',
      "      return { scoringDraft: { ...(st.scoringDraft || {}), [ag]: next.length ? next : ['tries'] }, scoringMsg: '' };",
      "      return { scoringDraft: { ...(st.scoringDraft || {}), [ag]: next }, scoringMsg: '' };"),
    expect: ['unticking the last box falls back to tries'],
  },
  {
    name: 'saving posts the WHOLE scoring draft instead of the selected group',
    suite: 'test-organizer-tournament.js',
    apply: () => patch('Organizer.dc.html',
      '    const res = await api.saveScoringRules({ [tournAgeId]: list }, session);',
      '    const res = await api.saveScoringRules(scoringDraft, session);'),
    expect: ['only the selected age group is sent'],
  },
  {
    name: 'the Tournament tab stops loading the stored scoring rules on open',
    suite: 'test-organizer-tournament.js',
    apply: () => patch('Organizer.dc.html',
      '    if (!this.state.scoringLoaded && this.state.api && this.state.api.loadScoringRules) {',
      '    if (false) {'),
    expect: ['loads the stored scoring rules exactly once'],
  },
  {
    name: 'the age-group picker is deleted from the scoring card',
    suite: 'test-organizer-tournament.js',
    apply: () => patch('Organizer.dc.html',
      '<select value="{{ tournAgeId }}" onChange="{{ onTournAge }}"', '<select value="{{ tournAgeId }}"'),
    expect: ['the tab\'s age-group picker'],
  },
  {
    name: 'the scoring re-exports are removed from organizer-data.js',
    suite: 'test-organizer-tournament.js',
    apply: () => patch('organizer-data.js',
      'export {\n  loadScoringRules, saveScoringRules, scoringFor, allScoreTypes, scoreLabel, scorePoints,\n} from \'./scores-data.js\';', ''),
    expect: ['saveScoringRules is re-exported from scores-data.js'],
  },

  /* ---- /manager: teamNames rebuilt on every save (test-manager-dc-draw.js)
     The withTeamNames rule ported from the old /scores editor. The quiet
     regressions: the wrap dropped from either save site, the merge order
     flipped so a stale stored name beats the sheet, the map blanked instead
     of merged, or the fetch-if-never-loaded skipped so the rule only fires
     for someone who opened the import first. */

  {
    name: 'saveDraw() stops wrapping the draw in withTeamNames',
    suite: 'test-manager-dc-draw.js',
    apply: () => patch('Manager.dc.html',
      'const res = await api.saveDraw(ageId, this.withTeamNames(this.state.draw), session);',
      'const res = await api.saveDraw(ageId, this.state.draw, session);'),
    expect: ['a multi-side club is numbered'],
  },
  {
    name: 'the merge order is flipped so a stale stored name beats the registrations',
    suite: 'test-manager-dc-draw.js',
    apply: () => patch('Manager.dc.html',
      'return { ...draw, teamNames: { ...(draw.teamNames || {}), ...derived } };',
      'return { ...draw, teamNames: { ...derived, ...(draw.teamNames || {}) } };'),
    expect: ['derived names WIN over a stale stored name'],
  },
  {
    name: 'the merge becomes a replacement, blanking names the registrations do not know',
    suite: 'test-manager-dc-draw.js',
    apply: () => patch('Manager.dc.html',
      'return { ...draw, teamNames: { ...(draw.teamNames || {}), ...derived } };',
      'return { ...draw, teamNames: derived };'),
    expect: ['a stored name the registrations do not know survives the merge'],
  },
  {
    name: 'saveDraw() stops fetching registrations that were never loaded',
    suite: 'test-manager-dc-draw.js',
    apply: () => patch('Manager.dc.html',
      '    await this.ensureRegsForNames();\n    const res = await api.saveDraw',
      '    const res = await api.saveDraw'),
    expect: ['saveDraw fetches the registrations when they were never loaded'],
  },
  {
    name: 'resetDraw() loses the withTeamNames wrap, so a regenerate drops the rule',
    suite: 'test-manager-dc-draw.js',
    apply: () => patch('Manager.dc.html',
      '      const next = this.withTeamNames({ ...draw, slots: freshSlots, knockout: freshKnockout });',
      '      const next = { ...draw, slots: freshSlots, knockout: freshKnockout };'),
    expect: ['a regenerated draw carries the derived names too'],
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
      '<sc-for list="{{ teamGroups }}" as="g" hint-placeholder-count="2">\n                <tr>\n                  <td colspan="12" style="padding:10px 14px;background:rgba(225,27,34,0.08);border-top:1px solid rgba(0,0,0,0.1);font-size:12px;font-weight:800;letter-spacing:.5px;color:#A62626;text-transform:uppercase">{{ g.club }} ({{ g.count }})</td>',
      '<sc-for list="{{ teamGroups }}" as="g" hint-placeholder-count="2">\n                <tr>\n                  <td colspan="12" style="padding:10px 14px;background:rgba(225,27,34,0.08);border-top:1px solid rgba(0,0,0,0.1);font-size:12px;font-weight:800;letter-spacing:.5px;color:#A62626;text-transform:uppercase">{{ g.club }}</td>'),
    expect: ['the teams table template actually renders a club header row per group'],
  },
  {
    name: 'the players table template stops showing the count next to the club name in its header row',
    suite: 'test-organizer-grouping.js',
    apply: () => patch('Organizer.dc.html',
      '<sc-for list="{{ playerGroups }}" as="g" hint-placeholder-count="2">\n                <tr>\n                  <td colspan="12" style="padding:10px 14px;background:rgba(225,27,34,0.08);border-top:1px solid rgba(0,0,0,0.1);font-size:12px;font-weight:800;letter-spacing:.5px;color:#A62626;text-transform:uppercase">{{ g.club }} ({{ g.count }})</td>',
      '<sc-for list="{{ playerGroups }}" as="g" hint-placeholder-count="2">\n                <tr>\n                  <td colspan="12" style="padding:10px 14px;background:rgba(225,27,34,0.08);border-top:1px solid rgba(0,0,0,0.1);font-size:12px;font-weight:800;letter-spacing:.5px;color:#A62626;text-transform:uppercase">{{ g.club }}</td>'),
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
  /* ⚠️ REPOINTED Aug 2026, not dropped: the RULE (the listing shows a readable
     sign-in method and never a raw googleSub) is still alive, but the
     derivation moved out to _auth.js's signInMethodOf(). */
  {
    name: 'accounts-admin.js stops stripping googleSub from the account listing',
    suite: 'test-google-auth.js',
    apply: () => patch(path.join('netlify', 'functions', 'accounts-admin.js'),
      "accounts.map(({ passwordHash, googleSub, ...rest }) => ({ ...rest, signInMethod: signInMethodOf({ passwordHash, googleSub }), lastSignInAt: signIns[rest.username] || null })),",
      "accounts.map(({ passwordHash, ...rest }) => ({ ...rest, signInMethod: 'Password', lastSignInAt: null })),"),
    expect: ['googleSub is stripped from the listing the same way passwordHash is'],
  },
  {
    /* The exact bug the shared helper was created to end: a local derivation
       that cannot ever return 'Both', so a password login with Google linked
       reads as "Google only" on the card. */
    name: 'accounts-admin.js goes back to deriving signInMethod for itself',
    suite: 'test-google-auth.js',
    apply: () => patch(path.join('netlify', 'functions', 'accounts-admin.js'),
      "signInMethod: signInMethodOf({ passwordHash, googleSub })",
      "signInMethod: googleSub ? 'Google' : 'Password'"),
    expect: ['it is NOT derived locally', 'a human-readable sign-in method is shown instead'],
  },
  {
    name: "signInMethodOf() loses the Both case, so a linked password login reads as Google only",
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', '_auth.js'),
      "  if (a.passwordHash && a.googleSub) return 'Both';",
      "  if (false) return 'Both';"),
    expect: ['BOTH, once a password login has Google linked'],
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
      "      onSelect: () => this.setState({ selectedAgeId: a.id, standings: null }, () => {\n        this.loadPublic();\n        if (typeof this.props.onAgeChange === 'function') this.props.onAgeChange(a.id);\n      }),",
      "      onSelect: () => this.setState({ selectedAgeId: a.id, standings: null }, () => {\n        this.loadPublic();\n      }),"),
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
    name: 'runSimulateTournament’s pass-1 isFinal filter is inverted, so pass 1 no longer walks over the double-bracket semis',
    suite: 'test-simulate-tournament.js',
    apply: () => patch('Organizer.dc.html',
      "      for (const slot of knockout) {\n        if (isFinal(slot.id) || !slot.home || !slot.away) continue;\n        const data = { walkover: 'home', ...spiritData(ag.id, ag.name, slot.home, slot.away) };\n        const r = await api.submitResult(slot.id, data, session);\n        if (r && r.ok) { knockoutGames++; spiritLog[slot.id] = { data, home: slot.home, away: slot.away }; } else failed++;\n      }\n\n      // Pass 2:",
      "      for (const slot of knockout) {\n        if (!isFinal(slot.id) || !slot.home || !slot.away) continue;\n        const data = { walkover: 'home', ...spiritData(ag.id, ag.name, slot.home, slot.away) };\n        const r = await api.submitResult(slot.id, data, session);\n        if (r && r.ok) { knockoutGames++; spiritLog[slot.id] = { data, home: slot.home, away: slot.away }; } else failed++;\n      }\n\n      // Pass 2:"),
    expect: ['pass 1 walked over the semis'],
  },
  {
    name: 'runSimulateTournament’s second knockout pass (the regenerate + walk-the-finals block) is deleted, so no group ever gets its finals scored',
    suite: 'test-simulate-tournament.js',
    apply: () => patch('Organizer.dc.html',
      "      // Pass 2: regenerate now the semis have winners, save, walk the finals.\n"
      + "      this.setState({ simProgress: `${ag.name} — finals…` });\n"
      + "      knockout = await api.autoKnockoutSlots(ag.id, session);\n"
      + "      saved = await api.saveDraw(ag.id, this.simWithTeamNames(ag.name, { ...draw, knockout }), session);\n"
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
    apply: () => patch('Organizer.dc.html',
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
    apply: () => patch('Organizer.dc.html',
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
    apply: () => patch('Organizer.dc.html',
      "  onSimulateTournament() {\n    if (this.isTournamentDayNow()) return;\n    this.promptModal(",
      "  onSimulateTournament() {\n    this.promptModal("),
    expect: ['on a real tournament day, pressing Simulate does not even open the confirm dialog'],
  },
  {
    name: 'runResetSimulation stops clearing the generated knockout, leaving a reset tournament with a stale bracket',
    suite: 'test-simulate-tournament.js',
    apply: () => patch('Organizer.dc.html',
      "        if (draw) {\n"
      + "          const saved = await api.saveDraw(ag.id, this.simWithTeamNames(ag.name, { ...draw, knockout: [] }), session);\n"
      + "          if (!saved || !saved.ok) failed++;\n"
      + "        }",
      "        if (draw) {\n"
      + "          /* knockout clear intentionally skipped */\n"
      + "        }"),
    expect: ['u9\'s saved draw had its knockout cleared'],
  },

  /* ---- the light/dark split (test-light-mode.js) ------------------------- */

  {
    name: 'the organizer page body reverts to the dark surface',
    suite: 'test-light-mode.js',
    apply: () => patch('Organizer.dc.html',
      'body{font-family:\'Barlow\',system-ui,sans-serif;background:#F3F2EF;color:#1A1C1F;',
      'body{font-family:\'Barlow\',system-ui,sans-serif;background:#0C0C0E;color:#1A1C1F;'),
    expect: ['no dark page surface remains'],
  },
  {
    name: 'a dark card creeps back into the signin page',
    suite: 'test-light-mode.js',
    apply: () => patch('Signin.dc.html',
      '<div style="width:100%;max-width:400px;background:#FFFFFF;',
      '<div style="width:100%;max-width:400px;background:#151517;'),
    expect: ['no dark card surface remains'],
  },
  {
    name: 'the public scores page quietly goes light',
    suite: 'test-light-mode.js',
    apply: () => {
      const p = 'Scores & Standings.dc.html';
      const rel = path.join(TMP, p);
      const src = fs.readFileSync(rel, 'utf8');
      fs.writeFileSync(rel, src.split('#0C0C0E').join('#F3F2EF'));
    },
    expect: ['still carries the dark page surface'],
  },

  /* ---- the /signin page (test-signin-page.js) ---------------------------- */

  {
    name: 'the next allow-list is widened to any same-site path — an open-redirect foothold',
    suite: 'test-signin-page.js',
    apply: () => patch('Signin.dc.html',
      "    const allowed = next === '/organizer' || next === '/manager';",
      "    const allowed = typeof next === 'string' && next.startsWith('/');"),
    expect: ['even a same-site path outside the allow-list is refused'],
  },
  {
    name: 'a manager\'s next=/organizer is honoured, landing them on a page that 403s every read',
    suite: 'test-signin-page.js',
    apply: () => patch('Signin.dc.html',
      "    if (isOrg) return allowed ? next : '/organizer';\n    return '/manager';",
      "    if (allowed) return next;\n    return isOrg ? '/organizer' : '/manager';"),
    expect: ['a manager asked for /organizer is routed to /manager instead'],
  },
  {
    name: 'the role routing collapses to /organizer for everyone',
    suite: 'test-signin-page.js',
    apply: () => patch('Signin.dc.html',
      "    if (isOrg) return allowed ? next : '/organizer';\n    return '/manager';",
      "    return allowed ? next : '/organizer';"),
    expect: ['a manager with no next lands on /manager'],
  },
  {
    name: 'an already-signed-in visitor is shown the form instead of being routed through',
    suite: 'test-signin-page.js',
    apply: () => patch('Signin.dc.html',
      "    const session = api.currentSession();\n    if (session) { this.redirect(this.destFor(session)); return; }",
      "    "),
    expect: ['componentDidMount routes an existing session'],
  },
  {
    name: '/organizer stops handing signed-out visitors to /signin',
    suite: 'test-signin-page.js',
    apply: () => patch('Organizer.dc.html',
      "    else this.redirect('/signin?next=/organizer');",
      "    "),
    expect: ['/organizer redirects its signed-out visitors to /signin'],
  },
  {
    name: '/manager stops handing signed-out visitors to /signin',
    suite: 'test-signin-page.js',
    apply: () => patch('Manager.dc.html',
      "      this.redirect('/signin?next=/manager');\n      return false;",
      "      return false;"),
    expect: ['/manager redirects its signed-out visitors to /signin'],
  },
  {
    name: 'the /signin rewrite is dropped from netlify.toml, orphaning every hand-off',
    suite: 'test-signin-page.js',
    apply: () => patch('netlify.toml',
      '[[redirects]]\n  from = "/signin"\n  to = "/Signin.dc.html"\n  status = 200\n', ''),
    expect: ['netlify.toml serves /signin'],
  },
  /* ⚠️ REPOINTED Aug 2026. This used to prove that the ROLE PICKER's choice
     reached the payload. The picker is gone — ORGANIZER_INVITE_CODE was
     deleted from Netlify, so an organiser signup can only ever be refused —
     and the rule that replaced it is that signup can ONLY ask for a manager.
     A fault whose subject is deleted must be repointed if the rule it guarded
     is still alive somewhere; here it moved rather than died. */
  {
    name: 'the signup stops sending a role at all',
    suite: 'test-signin-page.js',
    apply: () => patch('Signin.dc.html',
      "      res = await api.signup({ role: signupRole, name: signupName, title: signupTitle, username, password: signupPass, inviteCode: signupCode });",
      "      res = await api.signup({ name: signupName, title: signupTitle, username, password: signupPass, inviteCode: signupCode });"),
    expect: ['signup can only ever ask for a manager account now'],
  },
  {
    name: 'the Organiser option creeps back onto the signup role picker',
    suite: 'test-signin-page.js',
    apply: () => patch('Signin.dc.html',
      '      <label style="font-size:12px;font-weight:700;color:#5A626E;letter-spacing:.5px;display:block;margin-top:18px">YOUR NAME</label>',
      '      <div style="display:flex;gap:8px"><button onClick="{{ onRoleManager }}">Age-group manager</button><button onClick="{{ onRoleOrganizer }}">Organiser</button></div>\n      <label style="font-size:12px;font-weight:700;color:#5A626E;letter-spacing:.5px;display:block;margin-top:18px">YOUR NAME</label>'),
    expect: ['no role picker survives on either signup view', 'the page never offers "Organiser" as something to sign up as'],
  },
  {
    name: 'the invite-code label goes back to switching between admin and age group',
    suite: 'test-signin-page.js',
    apply: () => patch('Signin.dc.html',
      "      signupCodeLabel: 'AGE GROUP INVITE CODE',",
      "      signupCodeLabel: s.signupRole === 'organizer' ? 'ADMIN INVITE CODE' : 'AGE GROUP INVITE CODE',"),
    expect: ['the invite-code label no longer switches'],
  },

  /* ---- the silent club link (test-intake.js) ---------------------------- */
  {
    /* ⚠️ THE ONE THAT MATTERS. Without the gate the unlisted page is the only
       thing standing between a public endpoint and anyone who read the repo —
       and the repo is public. */
    name: 'the club form key check is removed, so the unlisted page is the only guard',
    suite: 'test-intake.js',
    apply: () => patch(INTAKE_F,
      "  if (form === 'club-registration' && !clubKeyOk(b.clubKey)) {",
      '  if (false) {'),
    expect: ['a wrong key is refused with 403'],
  },
  {
    /* ⚠️ FAILING OPEN HERE IS THE OPPOSITE OF THE RATE LIMITER'S CORRECT
       BEHAVIOUR, and looks like consistency. An absent variable must refuse,
       or the form is wide open the moment somebody removes it in Netlify. */
    name: 'the key check fails OPEN when CLUB_FORM_KEY is unset',
    suite: 'test-intake.js',
    apply: () => patch(INTAKE_F,
      "  if (!expected) return false;",
      '  if (!expected) return true;'),
    expect: ['with the variable UNSET, even an empty key is refused'],
  },
  {
    name: 'the key becomes a prefix match, so a partial key gets in',
    suite: 'test-intake.js',
    apply: () => patch(INTAKE_F,
      "  return String(supplied || '') === expected;",
      '  return expected.indexOf(String(supplied || "")) === 0;'),
    expect: ['a prefix of the key is not'],
  },
  {
    /* The tidy-up that looks like consistency and shuts registration for every
       club in the tournament. */
    name: 'the key gate is widened to every form, locking the public ones',
    suite: 'test-intake.js',
    apply: () => patch(INTAKE_F,
      "  if (form === 'club-registration' && !clubKeyOk(b.clubKey)) {",
      '  if (!clubKeyOk(b.clubKey)) {'),
    expect: ['a TEAM registration needs no key'],
  },
  {
    /* Moved BELOW validation and the window, so a caller without the key can
       still make us read the registration settings and run every rule. */
    name: 'the key is checked only after the row has already been written',
    suite: 'test-intake.js',
    apply: () => patch(INTAKE_F,
      "  if (form === 'club-registration' && !clubKeyOk(b.clubKey)) {\n    /* Never log the supplied value, and do not say whether the variable is\n       unset or the key merely wrong — those are the same answer to a caller. */\n    log('refused: club form key');",
      "  if (form === 'club-registration' && !clubKeyOk(b.clubKey) && false) {\n    log('refused: club form key');"),
    expect: ['a wrong key is refused with 403', 'and writes nothing'],
  },
  {
    name: 'the refusal starts logging the key that was tried',
    suite: 'test-intake.js',
    apply: () => patch(INTAKE_F,
      "    log('refused: club form key');",
      "    log('refused: club form key ' + b.clubKey);"),
    expect: ['the refusal never logs the key that was tried'],
  },
  {
    name: 'clubKey is added to the club form fields, so it can reach the sheet',
    suite: 'test-intake.js',
    apply: () => patch(INTAKE_F,
      "    fields: CLUB_COLUMNS.filter((c) => c !== 'submittedAt'),",
      "    fields: CLUB_COLUMNS.filter((c) => c !== 'submittedAt').concat('clubKey'),"),
    expect: ['clubKey is not one of the club form fields'],
  },
  {
    name: 'the club page is added to the sitemap, so it gets indexed',
    suite: 'test-intake.js',
    apply: () => patch('sitemap.xml',
      '</urlset>',
      '  <url><loc>https://adhjrt.com/register-club</loc></url>\n</urlset>'),
    expect: ['it is NOT in the sitemap'],
  },
  {
    name: 'the club page loses its noindex tag',
    suite: 'test-intake.js',
    apply: () => patch('Club.dc.html',
      '<meta name="robots" content="noindex, nofollow">',
      '<meta name="robots" content="index, follow">'),
    expect: ['the page carries noindex'],
  },
  {
    /* The obvious-looking way to hide a page, which advertises it instead —
       robots.txt is public. */
    name: 'robots.txt gets a Disallow that advertises the path',
    suite: 'test-intake.js',
    apply: () => patch('robots.txt',
      'Allow: /',
      'Allow: /\nDisallow: /register-club'),
    expect: ['robots.txt does not name it'],
  },
  {
    name: 'the club form creeps back onto the public homepage',
    suite: 'test-intake.js',
    apply: () => patch('Quins JRT.dc.html',
      "  async postRegistration(form, data) {",
      "  async submitClubAgain() { return this.postRegistration('club-registration', {}); }\n\n  async postRegistration(form, data) {"),
    expect: ['the homepage does not carry the club form'],
  },
  {
    name: 'the club page drops an age group, so one cannot be declared at all',
    suite: 'test-intake.js',
    apply: () => patch('Club.dc.html',
      "  { id: 'u12g', name: 'U12G QR' },",
      ''),
    expect: ['every real age group has a box on the page'],
  },
  {
    name: 'the club page reorders its groups alphabetically',
    suite: 'test-intake.js',
    apply: () => patch('Club.dc.html',
      "const CLUB_GROUPS = [\n  { id: 'u6', name: 'U6 Tag' }, { id: 'u7', name: 'U7 Tag' }, { id: 'u8', name: 'U8 Tag' },",
      "const CLUB_GROUPS = [\n  { id: 'u7', name: 'U7 Tag' }, { id: 'u6', name: 'U6 Tag' }, { id: 'u8', name: 'U8 Tag' },"),
    expect: ['in the same real-age order, not alphabetical'],
  },
  {
    name: 'the club page builds its count keys with a different prefix',
    suite: 'test-intake.js',
    apply: () => patch('Club.dc.html',
      "for (const g of CLUB_GROUPS) data['teams-' + g.id] = String(s.counts[g.id] || '').trim();",
      "for (const g of CLUB_GROUPS) data['team-' + g.id] = String(s.counts[g.id] || '').trim();"),
    expect: ['the page builds its count keys the same way the server does'],
  },

  /* ---- last sign in (test-my-account.js) -------------------------------- */
  {
    /* ⚠️ THE STORAGE DECISION, AS A FAULT. Moving the stamp onto the account
       record is the "tidier" version of this feature and it is the wrong one:
       the accounts list is one blob rewritten whole with no compare-and-set,
       so a write on every login races an organiser approving somebody. The
       concurrency check is what catches it. */
    name: 'the sign-in stamp is moved onto the account record, racing the accounts blob',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', '_signins.js'),
      "    await blobStore(STORE).setJSON(keyFor(username), {",
      "    const all = await require('./_auth').loadAccounts();\n    const i = all.findIndex((a) => a.username === username);\n    if (i !== -1) { all[i].lastSignInAt = whenIso || new Date().toISOString(); await require('./_auth').saveAccounts(all); }\n    await blobStore(STORE).setJSON(keyFor(username), {"),
    expect: ['four sign-ins added NO further write to the accounts list', 'the accounts list is byte-unchanged by signing in'],
  },
  {
    name: 'every account shares one sign-in key, so signing in moves everybody',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', '_signins.js'),
      "  return raw.replace(/[^0-9a-zA-Z._-]/g, '_').slice(0, 60) || 'unknown';",
      "  return 'last';"),
    expect: ['one person signing in does not move anybody else'],
  },
  {
    name: 'the username stops being sanitised, so it can pick its own blob key',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', '_signins.js'),
      "  return raw.replace(/[^0-9a-zA-Z._-]/g, '_').slice(0, 60) || 'unknown';",
      "  return raw.slice(0, 60) || 'unknown';"),
    expect: ['a username with a slash cannot pick its own key'],
  },
  {
    /* ⚠️ Stamping before the password check would let anyone move somebody
       else's "last signed in" just by guessing at their username. */
    name: 'login.js stamps the sign-in BEFORE checking the password',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', 'login.js'),
      "    const account = accounts.find((a) => a.username === uname);",
      "    const account = accounts.find((a) => a.username === uname);\n    if (account) await recordSignIn(account.username);"),
    expect: ['and records nothing'],
  },
  {
    name: 'login.js stamps a PENDING account that was refused a session',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', 'login.js'),
      "    if (!account.approved) {",
      "    if (!account.approved) {\n      await recordSignIn(account.username);"),
    expect: ['and records nothing — it did not sign in'],
  },
  {
    name: 'the Google door stops recording, so half the sign-ins go unseen',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', 'google-auth.js'),
      "      await recordSignIn(existing.username);",
      "      await Promise.resolve();"),
    expect: ['and is recorded the same way'],
  },
  {
    name: 'my-account.js stops carrying the stamp to your own card',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', 'my-account.js'),
      "      const lastSignInAt = await readSignIn(all[me].username);",
      "      const lastSignInAt = null;"),
    expect: ['your own account carries the stamp'],
  },
  {
    name: "accounts-admin.js stops carrying it, so nobody else's card can show it",
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', 'accounts-admin.js'),
      "lastSignInAt: signIns[rest.username] || null",
      "lastSignInAt: null"),
    expect: ['the organiser listing carries it too'],
  },
  {
    /* A date with no time cannot answer "did they get in this morning?", which
       is the only question this line exists for. */
    name: 'the card drops the time and shows the date alone',
    suite: 'test-my-account.js',
    apply: () => patch('Manager.dc.html',
      "    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })\n      + ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });",
      "    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });"),
    expect: ['did they get in this morning'],
  },
  {
    /* "Never" is a claim about what we hold. An unparseable stamp rendering as
       "Invalid Date" would be the visible version of the same mistake. */
    name: 'an unreadable stamp renders as Invalid Date instead of Never',
    suite: 'test-my-account.js',
    apply: () => patch('Manager.dc.html',
      "    if (isNaN(d.getTime())) return 'Never';",
      "    if (isNaN(d.getTime())) return String(iso);"),
    expect: ['and so does an unparseable one'],
  },
  {
    name: 'the organiser card stops showing Never for a manager who never got in',
    suite: 'test-my-account.js',
    apply: () => patch('Organizer.dc.html',
      "      acctLastSignIn: this.fmtAcctDateTime(s.acct && s.acct.lastSignInAt),",
      "      acctLastSignIn: this.fmtAcctDateTime((s.acct && s.acct.lastSignInAt) || s.acct && s.acct.createdAt),"),
    expect: ['Never for a manager who has never signed in'],
  },

  /* ---- the My account card (test-my-account.js) ------------------------- */
  {
    /* ⚠️ THE ONE THAT MATTERS. Widening this gate to cover other-person mode
       would let an organiser attach their OWN Google identity to somebody
       else's login — the takeover google-auth.js's googleSub-only lookup
       exists to prevent. */
    name: "the Link Google gate on /organizer loses its 'this is my own account' clause",
    suite: 'test-my-account.js',
    apply: () => patch('Organizer.dc.html',
      "acctCanLinkGoogle: !!(!s.acctSubject && s.acctGoogleClientId && s.acct && s.acct.signInMethod === 'Password'),",
      "acctCanLinkGoogle: !!(s.acctGoogleClientId && s.acct && s.acct.signInMethod === 'Password'),"),
    expect: ['LINK GOOGLE IS ABSENT from somebody'],
  },
  {
    /* The second guard, provable on its own because the test calls the
       handler directly and so bypasses the view-model gate above. Two guards,
       two faults — a guard nothing can catch alone is a guard too many. */
    name: 'the credential handler stops refusing in other-person mode',
    suite: 'test-my-account.js',
    apply: () => patch('Organizer.dc.html',
      '    if (this.state.acctSubject) return;',
      '    if (false) return;'),
    expect: ['the credential handler refuses outright in that mode'],
  },
  {
    /* The account acted on must come from the TOKEN. A username in the body
       is the thing my-account.js has no code path to read — and the card must
       not start sending one either. */
    name: '/manager starts sending a username with its own password change',
    suite: 'test-my-account.js',
    apply: () => patch('Manager.dc.html',
      '    const res = await api.changeMyPassword(acctCurrent, acctNew);',
      '    const res = await api.changeMyPassword(acctCurrent, acctNew, this.state.session && this.state.session.username);'),
    expect: ['no username rides along'],
  },
  {
    name: '/manager loses the client-side password floor, so Save bounces off a 400',
    suite: 'test-my-account.js',
    apply: () => patch('Manager.dc.html',
      '    if (acctNew.length < MIN_PASSWORD_LENGTH) {',
      '    if (false) {'),
    expect: ['a too-short new password is refused before anything is sent'],
  },
  {
    name: 'the card stops telling "still loading" apart from "the fetch failed"',
    suite: 'test-my-account.js',
    apply: () => patch('Manager.dc.html',
      '      acctLoading: s.acctOpen && s.acct === undefined,',
      '      acctLoading: false,'),
    expect: ['while the fetch is in flight the card says loading'],
  },
  {
    name: 'Link Google keeps being offered after an identity is already attached',
    suite: 'test-my-account.js',
    apply: () => patch('Manager.dc.html',
      "      acctCanLinkGoogle: !!(s.acctGoogleClientId && s.acct && s.acct.signInMethod === 'Password'),",
      '      acctCanLinkGoogle: !!(s.acctGoogleClientId && s.acct),'),
    expect: ['Link Google disappears once it is linked'],
  },
  {
    /* accounts-admin.js is organiser-only and stays that way. The card now
       living on /manager is exactly the change that might tempt someone to
       relax it. */
    name: '/manager grows an organiser-only accounts-admin call',
    suite: 'test-my-account.js',
    apply: () => patch('Manager.dc.html',
      '  async openAccount() {',
      '  async revokeSomeone(u) { return this.state.api.revokeAccount(u); }\n\n  async openAccount() {'),
    expect: ['never calls api.revokeAccount'],
  },
  {
    name: 'organizer-data.js stops re-exporting the Google client id the link button needs',
    suite: 'test-accounts.js',
    apply: () => patch('organizer-data.js',
      "export { googleClientId } from './scores-data.js';",
      "// export { googleClientId } from './scores-data.js';"),
    expect: ['organizer-data.js provides api.googleClientId()'],
  },
  {
    name: 'the age group on the card reverts to its raw id instead of its name',
    suite: 'test-my-account.js',
    apply: () => patch('Manager.dc.html',
      "        : ('Age-group manager · ' + (this.ageName(s.acct.ageGroupId) || s.acct.ageGroupId || ''))),",
      "        : ('Age-group manager · ' + (s.acct.ageGroupId || ''))),"),
    expect: ['the age group NAME not its id'],
  },
  {
    name: 'the old change-password dropdown is restored alongside the card on /organizer',
    suite: 'test-my-account.js',
    apply: () => patch('Organizer.dc.html',
      '      acctOpen: s.acctOpen,\n      acctIsMe:',
      '      showChangePwd: s.showChangePwd,\n      onToggleChangePwd: () => this.onToggleChangePwd(),\n      acctOpen: s.acctOpen,\n      acctIsMe:'),
    expect: ['the old change-password dropdown is gone from /organizer'],
  },

  /* ---- one session key + migration (test-session-migration.js) ---------- */

  {
    name: 'the migration preference flips, demoting an organizer who also holds a manager session',
    suite: 'test-session-migration.js',
    apply: () => patch('scores-data.js',
      '  const winner = read(OLD_ORG_SESSION_KEY) || read(OLD_MANAGER_SESSION_KEY);',
      '  const winner = read(OLD_MANAGER_SESSION_KEY) || read(OLD_ORG_SESSION_KEY);'),
    expect: ['the organizer session is the one kept'],
  },
  {
    name: 'the migration stops cleaning the old keys up',
    suite: 'test-session-migration.js',
    apply: () => patch('scores-data.js',
      "  try { localStorage.removeItem(OLD_ORG_SESSION_KEY); } catch (e) {}\n  try { localStorage.removeItem(OLD_MANAGER_SESSION_KEY); } catch (e) {}\n}",
      "}"),
    expect: ['both old keys are gone'],
  },
  {
    name: 'currentSession stops migrating, silently signing out everyone on an old key',
    suite: 'test-session-migration.js',
    apply: () => patch('scores-data.js',
      'export function currentSession() {\n  migrateSession();',
      'export function currentSession() {'),
    expect: ['the session survives the key change'],
  },
  {
    name: 'logout() stops clearing the old keys, so a stale copy can resurrect a session',
    suite: 'test-session-migration.js',
    apply: () => patch('scores-data.js',
      "export function logout() {\n  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}\n  try { localStorage.removeItem(OLD_MANAGER_SESSION_KEY); } catch (e) {}\n  try { localStorage.removeItem(OLD_ORG_SESSION_KEY); } catch (e) {}\n}",
      "export function logout() {\n  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}\n}"),
    expect: ['nothing survives a sign-out'],
  },
  {
    name: 'a garbage old key becomes a throw instead of an absent session',
    suite: 'test-session-migration.js',
    apply: () => patch('scores-data.js',
      "  const read = (key) => {\n    try {\n      const raw = localStorage.getItem(key);\n      const v = raw ? JSON.parse(raw) : null;\n      return v && v.token ? v : null;\n    } catch (e) { return null; }\n  };",
      "  const read = (key) => {\n    const raw = localStorage.getItem(key);\n    const v = raw ? JSON.parse(raw) : null;\n    return v && v.token ? v : null;\n  };"),
    expect: ['no throw'],
  },
  {
    name: 'scores-data login() regains a per-role endpoint, resurrecting the fallback chain',
    suite: 'test-session-migration.js',
    apply: () => patch('scores-data.js',
      "  const r = await tryFetchJson('/.netlify/functions/login', {",
      "  const r = await tryFetchJson('/.netlify/functions/manager-login', {"),
    expect: ['posts to the unified endpoint'],
  },
  {
    name: 'organizer-data drifts onto its own session key again',
    suite: 'test-session-migration.js',
    apply: () => patch('organizer-data.js',
      "const SESSION_KEY = 'adhjrt_session_v2';",
      "const SESSION_KEY = 'adhjrt_organizer_session_v2';"),
    expect: ['organizer-data.js uses the SAME key'],
  },

  /* ---- the unified login endpoint (test-unified-login.js) --------------- */

  {
    name: 'login.js grows a role filter back, locking one role out of the single endpoint',
    suite: 'test-unified-login.js',
    apply: () => patch(path.join('netlify', 'functions', 'login.js'),
      "const account = accounts.find((a) => a.username === uname);",
      "const account = accounts.find((a) => a.username === uname && a.role === 'manager');"),
    expect: ['an organizer signs in'],
  },
  {
    name: 'login.js loses the Google-account (no passwordHash) guard',
    suite: 'test-unified-login.js',
    apply: () => patch(path.join('netlify', 'functions', 'login.js'),
      "if (!account || !account.passwordHash || !(await verifyPassword(password || '', account.passwordHash))) {",
      "if (!account || !(await verifyPassword(password || '', account.passwordHash))) {"),
    expect: ['the Google-account (no passwordHash) guard is present'],
  },
  {
    name: 'login.js grows a password-length check, locking out every pre-floor password',
    suite: 'test-unified-login.js',
    apply: () => patch(path.join('netlify', 'functions', 'login.js'),
      "    const { username, password } = JSON.parse(event.body || '{}');",
      "    const { username, password } = JSON.parse(event.body || '{}');\n    if ((password || '').length < 10) return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Incorrect username or password.' }) };"),
    expect: ['login.js does NOT check password length', 'an organizer signs in'],
  },
  {
    name: 'login.js moves to its own rate bucket, buying attackers a second guess budget',
    suite: 'test-unified-login.js',
    apply: () => patch(path.join('netlify', 'functions', 'login.js'),
      'const rate = await checkRate(blobStore(\'config\'), `${clientIp(event)}:login`,',
      'const rate = await checkRate(blobStore(\'config\'), `${clientIp(event)}:signin`,'),
    expect: ['login.js counts into the :login bucket'],
  },
  {
    name: 'login.js stops checking approval, signing pending accounts straight in',
    suite: 'test-unified-login.js',
    apply: () => patch(path.join('netlify', 'functions', 'login.js'),
      "    if (!account.approved) {\n      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Your account is still pending approval from a tournament organizer.' }) };\n    }\n",
      ""),
    expect: ['a pending account is told so'],
  },
  {
    name: 'the organizer session shape drifts (loses _role), breaking isOrganiserSession downstream',
    suite: 'test-unified-login.js',
    apply: () => patch(path.join('netlify', 'functions', 'login.js'),
      "session: { username: account.username, name: account.name, role: account.title || 'Organizer', _role: 'organizer' },",
      "session: { username: account.username, name: account.name, role: account.title || 'Organizer' },"),
    expect: ['with the organizer session shape', 'the organizer session literal is exactly the shape downstream reads'],
  },

  /* ---- my-account.js: self-service for BOTH roles (3 Aug 2026) ----------
     Design: claude/specs/spec-my-account.md. The endpoint exists separately
     from accounts-admin.js precisely so a manager can reach it, and it writes
     to an account chosen by the TOKEN. Both of those are one edit away from
     being silently undone. */
  {
    name: 'my-account.js grows an organiser-only door, so a manager cannot reach their own account again',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', 'my-account.js'),
      "  const session = verify(getBearerToken(event));\n  if (!session) return fail(401, 'Not signed in.');",
      "  const session = verify(getBearerToken(event));\n  if (!session || session.role !== 'organizer') return fail(401, 'Not signed in.');"),
    expect: ['a MANAGER can read their own account'],
  },
  {
    /* The takeover. A username in the body must never choose the account. */
    name: 'my-account.js takes the account from the request body instead of the signed token',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', 'my-account.js'),
      "    const me = all.findIndex((a) => a.username === session.username);",
      "    const bodyName = (() => { try { return (JSON.parse(event.body || '{}').username || '').trim().toLowerCase(); } catch (e) { return ''; } })();\n    const me = all.findIndex((a) => a.username === (bodyName || session.username));"),
    expect: ['the named account was untouched'],
  },
  {
    /* Two logins resolving to one Google identity: google-auth.js uses find(),
       so one person silently lands in the other's account. */
    name: 'my-account.js stops checking whether the Google identity is already on another login',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', 'my-account.js'),
      "      if (clash !== -1 && clash !== me) {\n        return fail(409, 'That Google account is already linked to a different login.');\n      }\n",
      ""),
    expect: ['an identity already on another account is refused'],
  },
  {
    /* Replace-instead-of-refuse: a stolen session becomes permanent, surviving
       the real owner changing their password. */
    name: 'my-account.js REPLACES an existing Google identity instead of refusing',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', 'my-account.js'),
      "      if (all[me].googleSub) {\n        return fail(409, 'This login already has a different Google account linked. Ask a tournament organizer.');\n      }\n",
      ""),
    expect: ['linking a DIFFERENT identity over an existing one is refused'],
  },
  {
    name: 'my-account.js stops verifying the current password, so a borrowed laptop is a takeover',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', 'my-account.js'),
      "      if (!all[me].passwordHash || !(await verifyPassword(current, all[me].passwordHash))) {",
      "      if (false) {"),
    expect: ['a WRONG current password is refused'],
  },
  {
    name: 'my-account.js leaks the password hash and the Google id back to the browser',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', 'my-account.js'),
      "function publicView(a) {\n  return {",
      "function publicView(a) {\n  return {\n    passwordHash: a.passwordHash,\n    googleSub: a.googleSub,"),
    expect: ['the response carries NO passwordHash'],
  },
  {
    name: 'the shared password floor stops applying when you change your own password',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', 'my-account.js'),
      "      const pwErr = passwordProblem(next);\n      if (pwErr) return fail(400, pwErr);",
      "      const pwErr = null;\n      if (pwErr) return fail(400, pwErr);"),
    expect: ['the shared password floor applies'],
  },
  {
    name: 'accounts-admin.js grows changeMine back, so two rules can drift apart',
    suite: 'test-my-account.js',
    apply: () => patch(path.join('netlify', 'functions', 'accounts-admin.js'),
      "      const username = payload.username;",
      "      if (action === 'changeMine') { return { statusCode: 200, body: JSON.stringify({ ok: true }) }; }\n      const username = payload.username;"),
    expect: ['changeMine is gone from accounts-admin.js'],
  },

  /* ---- the retired per-role endpoints stay retired (3 Aug 2026) ---------
     A deletion is only permanent if something notices it being undone. The
     repo root IS the deployed site and the repo is public, so a resurrected
     endpoint is dead code published to the world — and a second password
     endpoint would come with its own rate-limit bucket, handing back exactly
     the extra guess budget the shared bucket exists to deny. These two write
     the file into the damaged copy rather than patching it, because there is
     no longer anything there to patch. */
  {
    name: 'organizer-login.js is resurrected, putting a second password endpoint back on a public site',
    suite: 'test-unified-login.js',
    apply: () => fs.writeFileSync(
      path.join(TMP, 'netlify', 'functions', 'organizer-login.js'),
      "exports.handler = async () => ({ statusCode: 405, body: 'Method not allowed' });\n"),
    expect: ['organizer-login.js is retired and has not come back'],
  },
  {
    name: 'manager-login.js is resurrected',
    suite: 'test-unified-login.js',
    apply: () => fs.writeFileSync(
      path.join(TMP, 'netlify', 'functions', 'manager-login.js'),
      "exports.handler = async () => ({ statusCode: 405, body: 'Method not allowed' });\n"),
    expect: ['manager-login.js is retired and has not come back'],
  },

  /* ---- google-auth.js and login.js must mint the SAME session -----------
     These two patch login.js, not google-auth.js, and that is the point: the
     shape check used to compare google-auth.js against the retired
     organizer-login.js / manager-login.js, and was repointed at login.js on
     3 Aug 2026. If it had quietly become a one-sided check on google-auth.js
     alone, a drift in the PASSWORD path would sail past it — which is the
     half a Google-signed-in organiser would never notice. */
  {
    name: 'login.js hardcodes the organiser title, so a Google organiser and a password organiser get different sessions',
    suite: 'test-google-auth.js',
    apply: () => patch(path.join('netlify', 'functions', 'login.js'),
      "session: { username: account.username, name: account.name, role: account.title || 'Organizer', _role: 'organizer' },",
      "session: { username: account.username, name: account.name, role: 'Organizer', _role: 'organizer' },"),
    expect: ['organiser session fields match login.js'],
  },
  {
    name: 'login.js renames ageGroupId in the manager session, so the two sign-in doors disagree',
    suite: 'test-google-auth.js',
    apply: () => patch(path.join('netlify', 'functions', 'login.js'),
      "session: { username: account.username, name: account.name, ageGroupId: account.ageGroupId },",
      "session: { username: account.username, name: account.name, ageGroup: account.ageGroupId },"),
    expect: ['manager session fields match login.js'],
  },

  /* ---- the invite codes are rate limited now (3 Aug 2026) ---------------
     Until this shipped, ORGANIZER_INVITE_CODE took unlimited guesses from an
     anonymous POST, and an organiser account reads every registrant's DOB and
     medical notes. Each of the three ways to guess gets its own fault, plus
     the two mistakes that would leave the guard looking present while doing
     nothing: a per-endpoint bucket (alternate and the budget triples) and a
     caller-supplied address header (pick your own bucket). */
  {
    name: 'organizer-signup.js loses its rate limit, so ORGANIZER_INVITE_CODE takes unlimited guesses again',
    suite: 'test-signup-ratelimit.js',
    apply: () => patch(path.join('netlify', 'functions', 'organizer-signup.js'),
      "    const rate = await checkSignupRate(blobStore('config'), event, Date.now());\n    if (!rate.ok) return tooManyResponse(rate);\n", ''),
    expect: ['organizer-signup.js: the eleventh is refused'],
  },
  {
    name: 'manager-signup.js loses its rate limit',
    suite: 'test-signup-ratelimit.js',
    apply: () => patch(path.join('netlify', 'functions', 'manager-signup.js'),
      "    const rate = await checkSignupRate(blobStore('config'), event, Date.now());\n    if (!rate.ok) return tooManyResponse(rate);\n", ''),
    expect: ['manager-signup.js: the eleventh is refused'],
  },
  {
    name: "google-auth.js's signup branch loses its rate limit",
    suite: 'test-signup-ratelimit.js',
    apply: () => patch(path.join('netlify', 'functions', 'google-auth.js'),
      "    const rate = await checkSignupRate(blobStore('config'), event, Date.now());\n    if (!rate.ok) return tooManyResponse(rate);\n", ''),
    expect: ['google-auth.js (signup branch): the eleventh is refused'],
  },
  {
    /* The guard still reads as present at every call site — this is the shape
       that looks fixed in review and is not. */
    name: 'manager-signup.js takes its own rate bucket, so alternating endpoints buys a fresh budget',
    suite: 'test-signup-ratelimit.js',
    apply: () => {
      const f = path.join('netlify', 'functions', 'manager-signup.js');
      patch(f, "const { checkSignupRate, tooManyResponse } = require('./_ratelimit');",
        "const { checkSignupRate, checkRate, tooManyResponse } = require('./_ratelimit');");
      patch(f, "const rate = await checkSignupRate(blobStore('config'), event, Date.now());",
        "const rate = await checkRate(blobStore('config'), ((event.headers || {})['x-nf-client-connection-ip'] || '') + ':signup-manager', Date.now(), { max: 10, windowMs: 900000 });");
    },
    expect: ['and at manager-signup.js, which never had ten of its own'],
  },
  {
    /* The realistic tidy-up: "why is this halfway down the handler?" Because
       above that line the request is a SIGN-IN, and fifteen managers on one
       venue wifi share an address on tournament morning. */
    name: "google-auth.js's rate limit is tidied up to the top of the handler, locking managers out of Google sign-in",
    suite: 'test-signup-ratelimit.js',
    apply: () => {
      const f = path.join('netlify', 'functions', 'google-auth.js');
      patch(f, "    const rate = await checkSignupRate(blobStore('config'), event, Date.now());\n    if (!rate.ok) return tooManyResponse(rate);\n", '');
      patch(f, "    const body = JSON.parse(event.body || '{}');",
        "    const rate = await checkSignupRate(blobStore('config'), event, Date.now());\n    if (!rate.ok) return tooManyResponse(rate);\n    const body = JSON.parse(event.body || '{}');");
    },
    expect: ['but a SIGN-IN from the same address is still answered'],
  },
  {
    name: 'the signup bucket starts trusting x-forwarded-for, so a caller can pick its own bucket',
    suite: 'test-signup-ratelimit.js',
    apply: () => patch(path.join('netlify', 'functions', '_ratelimit.js'),
      "return `${(event && event.headers || {})['x-nf-client-connection-ip'] || ''}:signup`;",
      "return `${(event && event.headers || {})['x-forwarded-for'] || (event && event.headers || {})['x-nf-client-connection-ip'] || ''}:signup`;"),
    expect: ['x-forwarded-for is ignored'],
  },
  {
    name: 'the signup budget is widened to a number no guessing script would ever reach',
    suite: 'test-signup-ratelimit.js',
    apply: () => patch(path.join('netlify', 'functions', '_ratelimit.js'),
      'const SIGNUP_RATE_OPTS = { max: 10, windowMs: 15 * 60 * 1000 };',
      'const SIGNUP_RATE_OPTS = { max: 10000, windowMs: 15 * 60 * 1000 };'),
    expect: ['ten per fifteen minutes'],
  },

  /* ---- /scores is purely public now (test-scores-public.js) ------------- */

  {
    name: 'the festival filter is dropped, offering U6/U7 tabs that can only say "no standings"',
    suite: 'test-scores-public.js',
    apply: () => patch('Scores & Standings.dc.html',
      'const publicAgeGroups = s.ageGroups.filter((a) => a.hasStandings);',
      'const publicAgeGroups = s.ageGroups;'),
    expect: ['festival groups are hidden from the public tabs'],
  },
  {
    name: 'the footer\'s Manager sign-in pointer is deleted',
    suite: 'test-scores-public.js',
    apply: () => patch('Scores & Standings.dc.html',
      '<a href="/manager" style="color:#7f8794;font-size:12.5px;font-weight:700;letter-spacing:.3px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,0.18)" style-hover="color:#cdd2da !important">Manager sign-in &rarr;</a>',
      ''),
    expect: ['the footer carries a Manager sign-in link to /manager'],
  },
  {
    name: 'an unpublished group\'s tables render anyway (sample data reaching parents)',
    suite: 'test-scores-public.js',
    apply: () => patch('Scores & Standings.dc.html',
      "showTables: !!(st && st.ageGroup.hasStandings && !st.awaitingPublication),",
      "showTables: !!(st && st.ageGroup.hasStandings),"),
    expect: ['suppresses the tables'],
  },
  {
    name: 'a session read creeps back into the public page',
    suite: 'test-scores-public.js',
    apply: () => patch('Scores & Standings.dc.html',
      "    this.setState({ api, ageGroups, selectedAgeId: linked ? propAge : (firstComp && firstComp.id) }, () => {",
      "    this.setState({ api, ageGroups, session: api.currentSession(), selectedAgeId: linked ? propAge : (firstComp && firstComp.id) }, () => {"),
    expect: ['never reads a session'],
  },
  {
    name: 'the team key\'s open/closed state stops being bound',
    suite: 'test-scores-public.js',
    apply: () => patch('Scores & Standings.dc.html',
      '      showTeamKey: s.showTeamKey, onToggleTeamKey: () => this.toggleTeamKey(),',
      '      onToggleTeamKey: () => this.toggleTeamKey(),'),
    expect: ['the team key renders and toggles'],
  },

  /* ---- signed-in routes point at /manager (test-organizer-manager-link.js) */

  {
    name: 'the app\'s More-tab tools link reverts to /scores',
    suite: 'test-organizer-manager-link.js',
    apply: () => patch('app.html',
      "  if (a === 'tools')   { location.href = '/manager'; return; }",
      "  if (a === 'tools')   { location.href = '/scores'; return; }"),
    expect: ['tools row goes to /manager'],
  },
  {
    /* The fallback (and its redirect) were deleted whole with the unified
       sign-in page; the danger now is the chain quietly coming back. */
    name: 'a manager-login fallback creeps back into organizer-data.js',
    suite: 'test-organizer-manager-link.js',
    apply: () => patch('organizer-data.js',
      "export function currentSession() {",
      "export async function loginFallback(username, password) {\n  const rm = await tryFetchJson('/.netlify/functions/manager-login', { method: 'POST' });\n  if (rm.real && rm.json.ok) return { ok: true, redirect: '/manager' };\n  return { ok: false };\n}\n\nexport function currentSession() {"),
    expect: ['carries no login fallback at all any more'],
  },

  /* ---- HSBC / sponsors (test-sponsors.js) ------------------------------- */

  {
    /* ⚠️ REPOINTED 4 Aug 2026. Its old anchor was the "More partners will be
       announced" placeholder copy, which went when the real grid arrived. The
       RULE is unchanged and is the most important one in this file — an
       unconfirmed company named as a sponsor is a commercial problem — so the
       fault moved to where names now live rather than being deleted with the
       copy it happened to sit in. */
    name: 'an unconfirmed company is added to the supporters list',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, "  { name: 'Align Health',",
      "  { name: 'Transguard Group', file: 'assets/sponsor-transguard.webp' },\n  { name: 'Align Health',"),
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
    /* ⚠️ REPOINTED, not deleted. It used to prove renderVals returned NO
       sponsors list, because the one it had held nineteen unconfirmed names.
       It now returns a CONFIRMED one, so the fault that matters is that list
       being swapped for an inline literal the UNCONFIRMED sweep and the count
       check cannot see. */
    name: 'the sponsors list is inlined, escaping the SPONSORS constant',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '      sponsors: SPONSORS.map((s) => ({', '      sponsors: [].map((s) => ({'),
    expect: ['returns the confirmed sponsors list'],
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
    apply: () => patch(HOME, 'src="assets/sponsor-hsbc-white.webp" alt="HSBC" style="height:96px',
      'src="assets/sponsor-hsbc.webp" alt="HSBC" style="height:96px'),
    expect: ['uses the white lockup, not the black one'],
  },
  {
    name: 'the sponsors-section placement loses its logo',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '<img src="assets/sponsor-hsbc-white.webp" alt="HSBC" style="height:96px;width:auto;max-width:100%;display:block;margin:0 auto">', ''),
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
    apply: () => patch(HOME, '  @media(max-width:900px){ .hdr-partner{display:none!important} }', ''),
    expect: ['own hide rule'],
  },
  {
    /* The tempting tidy-up: fold the rule into the 760 block with the rest of
       the header's mobile CSS. It looks right and it puts a second line back
       into a sticky header between 850 and 950px. */
    name: 'the hide is "tidied" into the 760px nav breakpoint',
    suite: 'test-sponsors.js',
    apply: () => {
      patch(HOME, '  @media(max-width:900px){ .hdr-partner{display:none!important} }\n\n', '');
      patch(HOME, '    .hdr-nav{display:none!important}', '    .hdr-nav{display:none!important}\n    .hdr-partner{display:none!important}');
    },
    expect: ['hides at 900px', 'does not repeat the hide'],
  },
  {
    /* ⚠️ THE REGRESSION THAT MATTERS NOW: the band COMES BACK. Its own comment
       argued HSBC deserved "the first slot after the fold, with nothing else
       competing for the eye" — a good argument that somebody will make again,
       not knowing the 128px hero lockup is the answer to it. Two of them a few
       hundred pixels apart is exactly what Jay removed. */
    name: 'the partner band is put back between the hero and the stat strip',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '  <!-- ============ STAT STRIP', BAND_BLOCK + '  <!-- ============ STAT STRIP'),
    expect: ['the partner band is gone'],
  },
  {
    /* Sneakier: the band comes back somewhere else on the page, so a check
       that only asked about its POSITION would have passed. This one asserts
       the section does not exist at all, anywhere. */
    name: 'the band creeps back in lower down the page instead',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '  <!-- ============ ABOUT ============ -->', BAND_BLOCK + '  <!-- ============ ABOUT ============ -->'),
    expect: ['the partner band is gone'],
  },
  {
    /* The band's 54px lockup on its own, with no <section> wrapper — the
       "I'll just keep the logo" version of putting it back. */
    name: 'the band\'s 54px lockup is re-added without its section',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '  <!-- ============ STAT STRIP',
      '  <div>' + BAND_IMG + '</div>\n  <!-- ============ STAT STRIP'),
    expect: ['no 54px lockup survives'],
  },
  {
    /* The tombstone is what stops the band being re-added out of ignorance.
       Deleting it looks like tidying a comment. */
    name: 'the tombstone explaining the removal is tidied away',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '  <!-- ============ PRINCIPAL PARTNER BAND — REMOVED 3 Aug 2026 ============ -->\n', ''),
    expect: ['left a tombstone'],
  },

  /* ---- the hero lockup, added 3 Aug 2026 (test-sponsors.js) -------------- */

  {
    name: 'the hero lockup is dropped',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, HERO_IMG, ''),
    expect: ['three HSBC images on the page'],
  },
  {
    /* The obvious "tidy-up": the two Register buttons appear twice on this
       page, so a later editor moves the mark down beside the other pair. That
       section's background is OUR red and the lockup's hexagon is HSBC red —
       it would vanish, and nothing would report an error. */
    name: 'the lockup is moved to the RED Sign up now section, where the hexagon vanishes',
    suite: 'test-sponsors.js',
    apply: () => {
      patch(HOME, HERO_IMG, '');
      patch(HOME, '      <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(0,0,0,0.22)',
        '      ' + HERO_IMG + '\n      <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(0,0,0,0.22)');
    },
    expect: ['RED Sign up now section has no HSBC lockup'],
  },
  {
    /* The row was two buttons and never needed a wrap rule. With a third item
       on it, dropping the rule overflows a phone — and an overflowing hero is
       the first thing anybody sees. */
    name: 'the hero button row loses its wrap rule',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'margin-top:38px;align-items:center;flex-wrap:wrap;animation',
      'margin-top:38px;align-items:center;animation'),
    expect: ['hero button row wraps'],
  },
  {
    name: 'the hero lockup is shrunk to the header mark\'s size',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, HERO_IMG, HERO_IMG.replace('height:128px', 'height:19px')),
    expect: ['the size Jay asked for'],
  },
  {
    name: 'the hero lockup is switched to the black-wordmark logo',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, HERO_IMG, HERO_IMG.replace('sponsor-hsbc-white.webp', 'sponsor-hsbc.webp')),
    expect: ['uses the white lockup'],
  },
  {
    name: 'the hero lockup loses the class that its wrap rule targets',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '<div class="hero-partner" style="display:flex;flex-direction:column;gap:10px',
      '<div style="display:flex;flex-direction:column;gap:10px'),
    expect: ['addressable by class'],
  },
  {
    /* The tempting tidy-up, and the same trap as .hdr-partner: the block is
       styled inline, so a rule without !important loses and does nothing. */
    name: 'the wrapped-line divider rule loses its !important',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '.hero-partner{border-left:0!important;padding-left:0!important;margin-left:0!important}',
      '.hero-partner{border-left:0;padding-left:0;margin-left:0}'),
    expect: ['carries !important'],
  },
  {
    name: 'the divider is dropped on a wrapped line but the indent is left behind',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '.hero-partner{border-left:0!important;padding-left:0!important;margin-left:0!important}',
      '.hero-partner{border-left:0!important}'),
    expect: ['along with the indent'],
  },
  {
    /* A fixed margin looks equivalent in a diff and is not: it drifts with the
       button labels and stops being the halfway point Jay asked for. */
    name: 'the centring is turned back into a fixed margin',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'gap:10px;margin-left:auto;margin-right:auto;padding-left:34px',
      'gap:10px;margin-left:40px;padding-left:34px'),
    expect: ['horizontally centred in the space left'],
  },
  {
    /* ONE CHARACTER, and it silently reverts to the version Jay rejected:
       margin-left:auto alone pins the block hard against the right edge. */
    name: 'the right-hand auto margin is dropped, pinning it to the far right again',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'margin-left:auto;margin-right:auto;padding-left:34px',
      'margin-left:auto;padding-left:34px'),
    expect: ['horizontally centred in the space left'],
  },
  {
    /* The measured value. 800 was the OLD number and it was already wrong —
       the header overflowed horizontally from ~875px down with the mark
       showing, on the short wordmark too. */
    name: 'the partner-mark hide is put back to the 800px that was already too low',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '@media(max-width:900px){ .hdr-partner{display:none!important} }',
      '@media(max-width:800px){ .hdr-partner{display:none!important} }'),
    expect: ['hides at 900px'],
  },
  {
    name: 'the hero label is reworded away from what Jay chose',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, HERO_LABEL, HERO_LABEL.replace('In partnership with', 'Our sponsors')),
    expect: ['In partnership with'],
  },
  {
    /* ⚠️ At 128px the lockup is ~510px wide — wider than a phone. This rule
       used to live on the band's logo; the band is gone, so it lives here, and
       without it a narrow screen CROPS the mark instead of shrinking it. */
    name: 'the hero lockup loses its narrow-screen bound',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, 'style="height:128px;width:auto;max-width:100%;display:block"',
      'style="height:128px;width:auto;display:block"'),
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
    name: 'the showPartner gate is reinstated, hiding the mark on the homepage again',
    suite: 'test-sponsors.js',
    apply: () => patch('Scores & Standings.dc.html', SC_MARK,
      '      <sc-if value="{{ showPartner }}">\n' + SC_MARK + '      </sc-if>\n'),
    expect: ['NOT behind a showPartner gate'],
  },
  {
    name: 'the component starts reading an embedded prop again',
    suite: 'test-sponsors.js',
    apply: () => patch('Scores & Standings.dc.html', '      isPublic: true,',
      '      showPartner: !this.props.embedded,\n      isPublic: true,'),
    expect: ['takes no `embedded` prop', 'NOT behind a showPartner gate'],
  },
  {
    name: 'the homepage suppresses the widget mark with an embedded attribute',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '<dc-import name="Scores & Standings" age=', '<dc-import name="Scores & Standings" embedded="1" age='),
    expect: ['does not suppress it'],
  },
  {
    /* The space-between trap: moved out of the brand group it becomes a third
       direct child of the header row and gets spread into the middle of the
       bar, between the wording and the Standings/Manager toggle. */
    name: 'the scores header mark is moved out of the brand group',
    suite: 'test-sponsors.js',
    apply: () => {
      patch('Scores & Standings.dc.html', SC_MARK, '');
      /* The Standings/Manager-area toggle that used to be the row's second
         child was deleted with the Manager area (Aug 2026), so "a third
         child" is now simply a sibling appended after the brand group,
         before the header row closes. */
      patch('Scores & Standings.dc.html',
        '    </div>\n  </div>\n\n  <!-- ===================== PUBLIC ===================== -->',
        '    </div>\n' + SC_MARK + '  </div>\n\n  <!-- ===================== PUBLIC ===================== -->');
    },
    expect: ['not a third child of the header row'],
  },
  {
    name: 'the scores header mark becomes a link off the site',
    suite: 'test-sponsors.js',
    apply: () => patch('Scores & Standings.dc.html', '<img src="assets/sponsor-hsbc-white.webp" alt="HSBC" style="height:18px',
      '<a href="https://www.hsbc.ae"><img src="assets/sponsor-hsbc-white.webp" alt="HSBC" style="height:18px'),
    expect: ['scores header mark is not a link'],
  },
  {
    name: 'the old scores band is put back under the header, duplicating the mark',
    suite: 'test-sponsors.js',
    /* ⚠️ ANCHOR REPOINTED 6 Aug 2026 — it hung off the flat age-tab row's
       wrapper div, and the picker was regrouped into day blocks, so the text
       no longer existed and the fault could not be injected. A fault that
       cannot be injected is a FAILED RUN, not a pass. The rule is unchanged
       and still load-bearing: an HSBC band directly above the age-group picker
       duplicates the mark already in the header. Repointed to the picker's new
       opening, which is what "above the picker" has always really meant. */
    apply: () => patch('Scores & Standings.dc.html', '      <div style="margin-bottom:28px">\n        <sc-for list="{{ ageDayBlocks }}"',
      '      <div><span>In partnership with</span><img src="assets/sponsor-hsbc-white.webp" alt="HSBC"></div>\n      <div style="margin-bottom:28px">\n        <sc-for list="{{ ageDayBlocks }}"'),
    expect: ['band above the age-group pills is gone', 'one HSBC image on the scores page'],
  },
  {
    name: 'the app copy drifts back to "hundreds of" players',
    suite: 'test-sponsors.js',
    apply: () => patch('app.html', 'reason thousands of young players get two full days', 'reason hundreds of young players get two full days'),
    expect: ['app does not claim "hundreds of"'],
  },

  /* ---- back-office links (test-back-office-links.js) -------------------- */

  {
    /* A VISIBLE back-office link in the bar — the thing the 3 Aug design
       still forbids. The two sanctioned nav sign-ins are display:none. */
    name: 'a visible Organizer link creeps back into the top nav bar',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '          <a href="#sponsors" style="color:#EDEDED;font-weight:600;font-size:15px">Sponsors</a>\n',
      '          <a href="#sponsors" style="color:#EDEDED;font-weight:600;font-size:15px">Sponsors</a>\n          <a href="/organizer" style="color:#8a8f99;font-weight:600;font-size:14px">Organizer</a>\n'),
    expect: ['exactly nine links'],
  },
  {
    name: 'the nav sign-ins lose display:none and appear on the desktop bar',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '<a href="/organizer" style="display:none;color:#8a8f99',
      '<a href="/organizer" style="color:#8a8f99'),
    expect: ['hidden from the desktop bar'],
  },
  {
    name: 'the nav sign-in comes back as a RAW FILENAME, which /organizer checks would miss',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '<a href="/organizer" style="display:none;color:#8a8f99',
      '<a href="Organizer.dc.html" style="display:none;color:#8a8f99'),
    expect: ['no raw Organizer.dc.html link anywhere'],
  },
  {
    /* The over-deletion the absence checks alone would not notice. */
    name: 'a public nav link is deleted along with the back-office ones',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '          <a href="#venue" style="color:#EDEDED;font-weight:600;font-size:15px">Venue</a>\n', ''),
    expect: ['still has Venue', 'exactly nine links'],
  },
  {
    name: 'a back-office link is put half way up the page, outside header and footer',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '  <!-- ============ SPONSORS ============ -->',
      '  <div><a href="/manager">Manager</a></div>\n  <!-- ============ SPONSORS ============ -->'),
    expect: ['between the header and the footer'],
  },
  {
    /* Jay's words: "functional, not just jump to bottom". A dropdown entry
       that scrolls to the footer instead of going to the sign-in page is the
       exact regression this batch exists to prevent. */
    name: 'the dropdown organiser entry becomes a jump to the footer instead of a real sign-in link',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME,
      '<a href="/organizer" style="display:block;padding:9px 12px;border-radius:8px;color:#EDEDED;font-weight:600;font-size:14px;white-space:nowrap"',
      '<a href="#top" onclick="document.querySelector(\'footer\').scrollIntoView()" style="display:block;padding:9px 12px;border-radius:8px;color:#EDEDED;font-weight:600;font-size:14px;white-space:nowrap"'),
    expect: ['dropdown links straight to /organizer'],
  },
  {
    name: 'the dropdown loses its menuOpen gate and becomes a permanent panel',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '<sc-if value="{{ menuOpen }}" hint-placeholder-val="{{ false }}">',
      '<sc-if value="{{ loggedInNever }}" hint-placeholder-val="{{ true }}">'),
    expect: ['gated on menuOpen'],
  },
  {
    name: 'the click-away listener is never registered, so only the button closes the menu',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, "    document.addEventListener('click', this.menuAwayHandler);\n", ''),
    expect: ['closes the menu from anywhere on the page'],
  },
  {
    name: 'the click-away listener stops ignoring the dropdown itself, closing the menu it just opened',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, "      if (e.target && e.target.closest && e.target.closest('.hdr-menu')) return;\n", ''),
    expect: ['leaves clicks inside .hdr-menu'],
  },
  {
    name: 'the click-away listener leaks past unmount',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, "    if (this.menuAwayHandler) document.removeEventListener('click', this.menuAwayHandler);\n", ''),
    expect: ['removed on unmount'],
  },
  {
    name: 'the word "Menu" creeps back onto the icon button',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '>{{ menuToggleIcon }}</button>', '>Menu {{ menuToggleIcon }}</button>'),
    expect: ['menu icon alone, not a word'],
  },
  {
    name: 'a section link is dropped from the dropdown',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME,
      '              <a href="#venue" style="display:block;padding:9px 12px;border-radius:8px;color:#EDEDED;font-weight:600;font-size:14px" style-hover="background:rgba(255,255,255,0.08)">Venue</a>\n', ''),
    expect: ['the dropdown offers Venue'],
  },
  {
    name: 'the SIGN IN divider heading is dropped, mixing sign-ins in with the sections',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '>SIGN IN</div>', '></div>'),
    expect: ['own SIGN IN heading'],
  },
  {
    name: 'the phone panel rule stops forcing links visible, so the hidden sign-ins never appear',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME,
      '.hdr-row[data-nav-open="true"] .hdr-nav a{font-size:16px!important;padding:11px 4px!important;display:block!important}',
      '.hdr-row[data-nav-open="true"] .hdr-nav a{font-size:16px!important;padding:11px 4px!important}'),
    expect: ['forces every nav link visible'],
  },
  {
    name: 'the Menu dropdown stays visible on phones, doubling the hamburger',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '    .hdr-menu{display:none!important}\n', ''),
    expect: ['Menu dropdown is hidden at phone width'],
  },
  {
    name: 'the open phone panel loses the hdr-right width rule and renders as a narrow column',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '    .hdr-row[data-nav-open="true"] .hdr-right{width:100%!important}\n', ''),
    expect: ['hdr-right wrapper full width'],
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
    expect: ['exactly one /organizer link in the footer', 'no raw Organizer.dc.html link anywhere'],
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

  /* ---- the design-audit fixes (test-design-polish.js, Aug 2026) ---------- */
  {
    /* The exact bug that shipped: six of seven pages pointed at a folder that
       never existed, so add-to-home-screen fell back to a page screenshot. */
    name: 'a page\'s apple-touch-icon points back at the /assets/icons/ folder that does not exist',
    suite: 'test-design-polish.js',
    apply: () => patch('Manager.dc.html',
      '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">',
      '<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">'),
    expect: ['Manager.dc.html: apple-touch-icon is /assets/apple-touch-icon.png'],
  },
  {
    name: 'a light-page date input goes back to color-scheme:dark (invisible picker icon)',
    suite: 'test-design-polish.js',
    apply: () => patch('Organizer.dc.html',
      'value="{{ rOpensDate }}" onInput="{{ onRegOpensDate }}" style="width:100%;margin-top:6px;background:#F3F2EF;border:1px solid rgba(0,0,0,0.15);border-radius:9px;padding:11px 14px;color:#1A1C1F;font-size:14px;color-scheme:light"',
      'value="{{ rOpensDate }}" onInput="{{ onRegOpensDate }}" style="width:100%;margin-top:6px;background:#F3F2EF;border:1px solid rgba(0,0,0,0.15);border-radius:9px;padding:11px 14px;color:#1A1C1F;font-size:14px;color-scheme:dark"'),
    expect: ['Organizer.dc.html: no date/time input still carries color-scheme:dark'],
  },
  {
    name: 'the Organizer confirm button goes back to near-black ink on brand red',
    suite: 'test-design-polish.js',
    apply: () => patch('Organizer.dc.html',
      'onClick="{{ onModalConfirm }}" style="background:#E11B22;border:none;color:#fff;',
      'onClick="{{ onModalConfirm }}" style="background:#E11B22;border:none;color:#1A1C1F;'),
    expect: ['white-on-red like every other red button'],
  },
  {
    name: 'the /scores pool table goes back to overflow:hidden, amputating the points columns on phones',
    suite: 'test-design-polish.js',
    apply: () => patch('Scores & Standings.dc.html',
      'overflow-x:auto;overflow-y:hidden;border:1px solid rgba(255,255,255,0.1);border-radius:14px',
      'overflow:hidden;border:1px solid rgba(255,255,255,0.1);border-radius:14px'),
    expect: ['scrolls sideways instead of amputating'],
  },
  {
    name: 'the awards grid goes back to four rigid columns',
    suite: 'test-design-polish.js',
    apply: () => patch('Scores & Standings.dc.html',
      'grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:18px',
      'grid-template-columns:repeat(4,1fr);gap:18px'),
    expect: ['awards grid wraps on narrow screens'],
  },
  {
    name: 'tapping a pill stops clearing the stale table (previous group renders under the new pill)',
    suite: 'test-design-polish.js',
    apply: () => patch('Scores & Standings.dc.html',
      'onSelect: () => this.setState({ selectedAgeId: a.id, standings: null }, () => {',
      'onSelect: () => this.setState({ selectedAgeId: a.id }, () => {'),
    expect: ['clears the previous group\'s table in the same setState'],
  },
  {
    name: 'the app sheet loses its dvh cap (iOS toolbar hides the Close button again)',
    suite: 'test-design-polish.js',
    apply: () => patch('app.html', 'max-height:92vh;max-height:92dvh;', 'max-height:92vh;'),
    expect: ['dvh cap so iOS Safari cannot hide'],
  },
  {
    name: 'a native confirm() dialog sneaks back into the app',
    suite: 'test-design-polish.js',
    apply: () => patch('app.html',
      "askInSheet('Clear this result? The match goes back to unplayed and the pool table is recalculated.', 'Clear result', 'btn-p', doClear)",
      "(confirm('Clear this result?') && doClear())"),
    expect: ['no native confirm() dialogs remain'],
  },
  {
    /* The pre-audit behaviour: a rejected fetch left the tab on "Loading…"
       forever — the check must notice the flag being dropped, because on
       screen the difference only shows when the stadium wifi drops. */
    name: 'the app stops flagging a failed fetch, freezing on "Loading…" again',
    suite: 'test-design-polish.js',
    apply: () => patch('app.html',
      '  } catch (e) {\n    if (S.browseId !== agId) return;\n    S.loadError = true;\n  }',
      '  } catch (e) {\n    if (S.browseId !== agId) return;\n  }'),
    expect: ['sets loadError instead of leaving "Loading…" forever'],
  },
  {
    name: '/signin stops announcing the password field to password managers',
    suite: 'test-design-polish.js',
    apply: () => patch('Signin.dc.html', 'name="password" autocomplete="current-password" ', ''),
    expect: ['password field is announced'],
  },
  {
    name: 'the double Google error comes back (same sentence twice on the login view)',
    suite: 'test-design-polish.js',
    apply: () => patch('Signin.dc.html',
      "this.setState({ googleBusy: false, googleError: res.error || 'Could not sign in with Google.' });",
      "this.setState({ googleBusy: false, googleError: res.error || 'Could not sign in with Google.', loginError: res.error || 'Could not sign in with Google.' });"),
    expect: ['ONE error, not the same sentence twice'],
  },
  {
    name: 'a page loses its :focus-visible ring',
    suite: 'test-design-polish.js',
    apply: () => patch('Signin.dc.html',
      '  a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #E11B22;outline-offset:2px}\n',
      ''),
    expect: ['Signin.dc.html: keyboard focus is visible'],
  },
  {
    name: 'a page\'s disabled buttons go back to looking exactly like live ones',
    suite: 'test-design-polish.js',
    apply: () => patch('Manager.dc.html', '  button:disabled{opacity:.45;cursor:not-allowed}\n', ''),
    expect: ['Manager.dc.html: disabled buttons look disabled'],
  },
  {
    name: '/scores loses tabular figures and the score columns go ragged again',
    suite: 'test-design-polish.js',
    apply: () => patch('Scores & Standings.dc.html', ';font-variant-numeric:tabular-nums}', '}'),
    expect: ['lines its score columns up'],
  },
  {
    name: '"Open in maps" goes back to the bare Google Maps homepage',
    suite: 'test-design-polish.js',
    apply: () => patch(HOME,
      'href="https://www.google.com/maps/search/?api=1&amp;query=Zayed+Sports+City+Abu+Dhabi" target="_blank" rel="noopener"',
      'href="https://maps.google.com"'),
    expect: ['goes to Zayed Sports City'],
  },
  {
    name: 'anchor jumps hide section headings under the sticky header again',
    suite: 'test-design-polish.js',
    apply: () => patch(HOME, '  section[id]{scroll-margin-top:80px}\n', ''),
    expect: ['anchor jumps clear the sticky header'],
  },
  {
    name: 'a fourth ad-hoc green sneaks back in',
    suite: 'test-design-polish.js',
    apply: () => patch(HOME, 'color:#3bd070">SAT 7', 'color:#22c55e">SAT 7'),
    expect: ['one light green tint'],
  },
  /* ---- the wordmark (test-design-polish.js, 3 Aug 2026) ----------------- */

  {
    name: 'the homepage header reverts to the shortened AD HARLEQUINS',
    suite: 'test-design-polish.js',
    apply: () => patch(HOME, ';white-space:nowrap">ABU DHABI HARLEQUINS</span>', '">AD HARLEQUINS</span>'),
    expect: ['no shortened AD HARLEQUINS wordmark is left behind'],
  },
  {
    /* The likely half-job: rename the one Jay pointed at and miss the other. */
    name: 'the homepage FOOTER is left on the old wordmark',
    suite: 'test-design-polish.js',
    apply: () => patch(HOME, "font-size:20px\">ABU DHABI HARLEQUINS</span>", "font-size:20px\">AD HARLEQUINS</span>"),
    expect: ['no shortened AD HARLEQUINS wordmark is left behind', 'both the header and the footer'],
  },
  {
    name: 'legal.html is left behind on the old wordmark',
    suite: 'test-design-polish.js',
    apply: () => patch('legal.html', '<b>ABU DHABI HARLEQUINS</b>', '<b>AD HARLEQUINS</b>'),
    expect: ['no shortened AD HARLEQUINS wordmark is left behind'],
  },
  {
    /* Twenty characters in a STICKY header. Without nowrap it breaks to two
       lines and a quarter of a phone screen goes to the header. */
    name: 'the header wordmark loses its nowrap',
    suite: 'test-design-polish.js',
    apply: () => patch(HOME, "letter-spacing:.5px;white-space:nowrap\">ABU DHABI HARLEQUINS", "letter-spacing:.5px\">ABU DHABI HARLEQUINS"),
    expect: ['cannot wrap to a second line'],
  },

  {
    name: 'the age-card band labels shrink back to 7.5px',
    suite: 'test-design-polish.js',
    apply: () => patch(HOME, '.fmt-grp-band{font-size:10px', '.fmt-grp-band{font-size:7.5px'),
    expect: ['band labels are readable'],
  },
  {
    name: 'the homepage og:image goes back to the bare square crest',
    suite: 'test-design-polish.js',
    apply: () => patch(HOME,
      '<meta property="og:image" content="https://adhjrt.com/assets/share-card.png">',
      '<meta property="og:image" content="https://adhjrt.com/assets/crest.png">'),
    expect: ['og:image is the rendered share card'],
  },
  {
    name: 'the 404 page goes light, off-brand',
    suite: 'test-design-polish.js',
    apply: () => patch('404.html', 'background:#0C0C0E', 'background:#ffffff'),
    expect: ['404 page is branded dark'],
  },
  {
    name: 'the age-group filter goes back to alphabetical order (U6-U9 dumped after U18)',
    suite: 'test-design-polish.js',
    apply: () => patch('Organizer.dc.html',
      ".sort((a, b) => (AGE_GROUP_ORDER[a] ?? 999) - (AGE_GROUP_ORDER[b] ?? 999) || String(a).localeCompare(String(b)));",
      '.sort();'),
    expect: ['real age order, not alphabetical'],
  },
  {
    name: 'the Organizer tab bar loses flex-wrap, dragging narrow windows into horizontal scroll',
    suite: 'test-design-polish.js',
    apply: () => patch('Organizer.dc.html',
      'border-radius:12px;padding:5px;width:fit-content;flex-wrap:wrap;max-width:100%',
      'border-radius:12px;padding:5px;width:fit-content'),
    expect: ['tab bar wraps'],
  },

  /* ---- the venue Reset clears assignments (test-venue-splits.js, 2 Aug) -- */
  {
    name: 'the venue Reset goes back to posting to the server',
    suite: 'test-venue-splits.js',
    apply: () => patch('Organizer.dc.html',
      '  reallyResetVenue() {\n    this.setState((s) => {',
      '  reallyResetVenue() {\n    this.state.api.resetVenue();\n    this.setState((s) => {'),
    expect: ['NOTHING was posted to the server'],
  },
  {
    name: 'the venue Reset starts wiping the splits and surfaces too, not just assignments',
    suite: 'test-venue-splits.js',
    apply: () => patch('Organizer.dc.html',
      "        if (day && day.groups) Object.keys(day.groups).forEach((g) => { day.groups[g] = []; });",
      "        if (day && day.groups) Object.keys(day.groups).forEach((g) => { day.groups[g] = []; });\n        if (day) { day.splits = {}; day.pitches = []; }"),
    expect: ['the splits are untouched'],
  },
  {
    name: 'the venue Reset deletes group membership instead of emptying it, knocking groups off their day',
    suite: 'test-venue-splits.js',
    apply: () => patch('Organizer.dc.html',
      "Object.keys(day.groups).forEach((g) => { day.groups[g] = []; });",
      "Object.keys(day.groups).forEach((g) => { delete day.groups[g]; });"),
    expect: ['every group KEEPS its day'],
  },
  {
    name: 'the venue Reset writes through to the saved copy, skipping Save entirely',
    suite: 'test-venue-splits.js',
    apply: () => patch('Organizer.dc.html',
      "      return { venue: v, vError: '', vSuccess: '' };",
      "      return { venue: v, venueSaved: this.cloneVenue(v), vError: '', vSuccess: '' };"),
    expect: ['Save is how it goes live'],
  },
  {
    name: 'the 2025 running-order blurb creeps back into a day hint',
    suite: 'test-venue-splits.js',
    apply: () => patch('Organizer.dc.html',
      "A pitch left on Not used just is not part of today.'\n          :",
      "A pitch left on Not used just is not part of today. 2025’s running order: D5, D4 and D3 in halves.'\n          :"),
    expect: ['mentions 2025'],
  },
  {
    name: 'the server-posting resetVenue export returns to the data layer',
    suite: 'test-venue-splits.js',
    apply: () => patch('organizer-data.js',
      "/* resetVenue() was deleted 2 Aug 2026",
      "export async function resetVenue() { return { ok: false }; }\n/* resetVenue() was deleted 2 Aug 2026"),
    expect: ['gone from the data layer'],
  },
  {
    name: 'the Reset confirm collapses to a generic "Are you sure?"',
    suite: 'test-venue-splits.js',
    apply: () => patch('Organizer.dc.html',
      "      'Clear every age group’s pitch assignment, on both days?\\n\\nDays and pitch splits are kept, and each group stays on its day — only which pitches it gets is cleared. Nothing is saved until you press Save.',",
      "      'Are you sure?',"),
    expect: ['says what it clears and what it keeps'],
  },
  {
    name: 'the Reset confirm button goes back to a label that does not say what it does',
    suite: 'test-venue-splits.js',
    apply: () => patch('Organizer.dc.html',
      "      { okLabel: 'Clear assignments', wide: true }",
      "      { wide: true }"),
    expect: ['its button says what it does'],
  },

  /* ---- the Manager-area batch, 3 Aug 2026 (Jay's seven-item list) -------- */
  {
    name: 'the Today tab creeps back into MANAGER_TABS',
    suite: 'test-manager-dc.js',
    apply: () => patch('Manager.dc.html', "const MANAGER_TABS = [\n  { id: 'fixtures', label: 'Fixtures & scoring' },",
      "const MANAGER_TABS = [\n  { id: 'today', label: 'Today' },\n  { id: 'fixtures', label: 'Fixtures & scoring' },"),
    expect: ['all five tabs are offered'],
  },
  {
    name: 'the landing tab drifts off Fixtures & scoring',
    suite: 'test-manager-dc.js',
    apply: () => patch('Manager.dc.html', "ageId: '', tab: 'fixtures',", "ageId: '', tab: 'tables',"),
    expect: ['Fixtures & scoring is the tab you land on'],
  },
  {
    name: 'sign-out stops resetting the tab for the next person',
    suite: 'test-manager-dc.js',
    apply: () => patch('Manager.dc.html', "      session: null, tab: 'fixtures', fixtures: null,",
      "      session: null, fixtures: null,"),
    expect: ['returns to the landing tab'],
  },
  {
    /* The structural half of the removal: a leftover isToday reference is a
       template block waiting to render blank. */
    name: 'an isToday remnant survives in the script',
    suite: 'test-manager-dc.js',
    apply: () => patch('Manager.dc.html', 'class Component extends DCLogic {',
      'const isTodayLegacy = false;\nclass Component extends DCLogic {'),
    expect: ['no isToday block survives'],
  },
  {
    name: 'the View organizer area link is dropped from the header',
    suite: 'test-manager-dc.js',
    apply: () => patch('Manager.dc.html',
      '            <a href="/organizer" style="font-size:13px;font-weight:700;color:#454D58;border-left:1px solid rgba(0,0,0,0.15);padding-left:14px;transition:color .18s ease" style-hover="color:#1A1C1F">View organizer area</a>\n', ''),
    expect: ['links back to the organizer area'],
  },
  {
    /* The gate is the privacy line: a manager must never see a door into the
       organizer area. */
    name: 'the organizer-area link is moved OUTSIDE the organiser gate, showing it to managers',
    suite: 'test-manager-dc.js',
    apply: () => {
      patch('Manager.dc.html',
        '            <a href="/organizer" style="font-size:13px;font-weight:700;color:#454D58;border-left:1px solid rgba(0,0,0,0.15);padding-left:14px;transition:color .18s ease" style-hover="color:#1A1C1F">View organizer area</a>\n          </sc-if>',
        '          </sc-if>\n          <a href="/organizer" style="font-size:13px;font-weight:700;color:#454D58;border-left:1px solid rgba(0,0,0,0.15);padding-left:14px;transition:color .18s ease" style-hover="color:#1A1C1F">View organizer area</a>');
    },
    expect: ['leaks outside the organiser gate'],
  },
  {
    name: 'the "Viewing as" label on the age switcher is dropped',
    suite: 'test-manager-dc.js',
    apply: () => patch('Manager.dc.html', '>Viewing as</span>', '></span>'),
    expect: ['labels the age switcher "Viewing as"'],
  },
  {
    /* The card's whole point: an unscored match invites the tap, a scored one
       shows what landed. A statusLine that ignores the result prints the
       invitation on top of a saved score. */
    name: 'statusLine stops looking at the result and says "Click to score" on everything',
    suite: 'test-manager-dc.js',
    apply: () => patch('Manager.dc.html',
      "      statusLine: m.result ? `${m.result.homeScore}–${m.result.awayScore}` : 'Click to score',",
      "      statusLine: 'Click to score',"),
    expect: ['a scored match shows the score home-then-away instead'],
  },
  {
    name: 'statusStyle stops distinguishing a score from the invitation',
    suite: 'test-manager-dc.js',
    apply: () => patch('Manager.dc.html',
      "      statusStyle: m.result\n        ? \"font-family:'Anton';font-size:19px;color:#1A1C1F;white-space:nowrap\"\n        : 'font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#0E6B33;white-space:nowrap',",
      "      statusStyle: 'font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#0E6B33;white-space:nowrap',"),
    expect: ['in the Anton score style'],
  },
  {
    name: 'the pool card grid collapses back into a full-width stack',
    suite: 'test-manager-dc.js',
    apply: () => patch('Manager.dc.html',
      '            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px">\n              <sc-for list="{{ g.rows }}"',
      '            <div style="display:block">\n              <sc-for list="{{ g.rows }}"'),
    expect: ['renders two card grids'],
  },
  {
    name: 'the Results list is quietly rebuilt onto some other template',
    suite: 'test-manager-dc.js',
    apply: () => patch('Manager.dc.html', 'grid-template-columns:64px 1fr auto', 'grid-template-columns:60px 1fr auto'),
    expect: ['survives only on Results'],
  },
  {
    /* Jay's item 5, in reverse: the home nominee input wanders out of the
       home box. Rebinding it to the away draft moves the onSheetSpiritHome
       anchor past the away Cards row. */
    name: 'the home spirit input is swapped into the away box',
    suite: 'test-manager-dc-score-sheet.js',
    apply: () => {
      patch('Manager.dc.html',
        '<input value="{{ sheetSpiritHome }}" onInput="{{ onSheetSpiritHome }}" placeholder="{{ sheetHomeName }} player"',
        '<input value="{{ sheetSpiritHome }}" onInput="{{ onSheetSpiritHomeMoved }}" placeholder="{{ sheetHomeName }} player"');
      patch('Manager.dc.html',
        '<input value="{{ sheetSpiritAway }}" onInput="{{ onSheetSpiritAway }}" placeholder="{{ sheetAwayName }} player"',
        '<input value="{{ sheetSpiritAway }}" onInput="{{ onSheetSpiritAway }}" data-legacy="{{ onSheetSpiritHome }}" placeholder="{{ sheetAwayName }} player"');
    },
    expect: ['directly after the home Cards row'],
  },
  {
    name: 'one team box loses its sheetShowSpirit gate',
    suite: 'test-manager-dc-score-sheet.js',
    apply: () => patch('Manager.dc.html', '>WALK-OVER</label>', '>WALK-OVER {{ sheetShowSpirit }}</label>'),
    expect: ['its own sheetShowSpirit gate'],
  },
  {
    name: 'the old bottom-of-sheet spirit block returns',
    suite: 'test-manager-dc-score-sheet.js',
    apply: () => patch('Manager.dc.html',
      '<p style="max-width:70ch;color:#5A626E;font-size:12px;margin-top:8px">A walk-over is recorded as 20–0 with 4 tries.</p>',
      '<p style="max-width:70ch;color:#5A626E;font-size:12px;margin-top:8px">A walk-over is recorded as 20–0 with 4 tries.</p><label>SPIRIT OF RUGBY — ONE NOMINATION PER SIDE</label>'),
    expect: ['old bottom block'],
  },
  {
    name: 'the home nominee placeholder stops naming the home team',
    suite: 'test-manager-dc-score-sheet.js',
    apply: () => patch('Manager.dc.html', 'placeholder="{{ sheetHomeName }} player" style="width:100%',
      'placeholder="Player name" style="width:100%'),
    expect: ['home input is labelled with the home team'],
  },
  {
    /* The wrapper is what keeps the header row at three children so
       space-between pins the nav+menu pair hard right. */
    name: 'the hdr-right wrapper is renamed away, orphaning the header structure checks',
    suite: 'test-sponsors.js',
    apply: () => patch(HOME, '<div class="hdr-right" style="display:flex;align-items:center;gap:20px;min-width:0">',
      '<div class="hdr-wrap" style="display:flex;align-items:center;gap:20px;min-width:0">'),
    expect: ['third child is the hdr-right wrapper'],
  },

  /* ---- the About-section photo ring (test-about-board.js, 5 Aug 2026) ----

     The first fault here is the real bug this suite was written for: the
     component engine's encodeCase() rewrites " camelCase=" into a kebab-case
     attribute name ANYWHERE in the file, <script> bodies included, and the
     copy of the script it mounts into <head> then fails to parse. It shipped
     live and the page still looked right, which is the whole problem. */
  {
    name: 'a camelCase assignment goes back into an inline script (encodeCase mangles it, head copy throws)',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'var at=0, onscreen=true, timer=null;',
      'var at=0, turning=false, timer=null, onScreen=true;'),
    expect: ['no inline script assigns to a camelCase name'],
  },
  {
    /* Renaming the flag without renaming its readers: the sweep stays clean,
       so only the positive checks can catch this. That is why they exist. */
    name: 'the screen-visibility flag is renamed and the timer gate is orphaned',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'if(!onscreen||document.hidden)return;', 'if(!document.hidden)return;'),
    expect: ['it gates the timer'],
  },
  {
    name: 'PANELS changes without the CSS ring radius moving with it',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'var CARDS  = 6;', 'var PANELS = 10;'),
    expect: ['every slot from -1 upwards has a row in the table'],
  },
  {
    name: 'the CSS glide length drifts away from the script TURN',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '--glide: 600ms;', '--turn:900ms;'),
    expect: ['--glide and the script GLIDE are the same number'],
  },
  {
    name: 'PHOTOS is raised without the photo files being added',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'var PHOTOS = 11;', 'var PHOTOS = 12;'),
    expect: ['board files named by PHOTOS exist on disk'],
  },
  {
    /* Without sizes the browser assumes the image fills the viewport and always
       takes the 960px file. Nothing errors; the section just costs double. */
    name: 'the sizes attribute is dropped from the panel builder',
    suite: 'test-about-board.js',
    apply: () => patch(HOME,
      "a.sizes=w.sizes='(min-width:1461px) 380px, 26vw';",
      "a.sizes=w.sizes='100vw';"),
    expect: ['sizes string appears three times'],
  },
  {
    /* ⚠️ REPOINTED with its check. The phone clause in `sizes` is gone (the
       section is hidden there, so the builder cannot run), and this fault used
       to move it. What it really guards is the stacked override drifting off
       the hide's breakpoint, so it moves that instead. */
    name: 'the stacked --pw override drifts off the hide breakpoint',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '  .about-photo{--cw:clamp(170px, 62vw, 400px);--focal:50%;margin-right:0;border-radius:12px}',
      '  }\n@media (max-width:700px){\n  .about-photo{--cw:clamp(170px, 62vw, 400px);--focal:50%;margin-right:0;border-radius:12px}'),
    expect: ['lives in that same 760px block'],
  },
  {
    /* ⚠️ THE ONE THIS WHOLE CHANGE EXISTS FOR. Hiding it in CSS alone leaves a
       phone downloading every photo in a section it cannot see - measured at 16
       requests before the picture was fenced. The fault removes the fence. */
    name: 'the phone source is dropped, so a hidden section still downloads photos',
    suite: 'test-about-board.js',
    apply: () => patch(HOME,
      '<source media="(max-width:760px)" srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">\n', ''),
    expect: ['costs no request'],
  },
  {
    name: 'the real sources lose their min-width fence, so phones fall through to a photo',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, ' media="(min-width:761px)" sizes="(min-width:1461px) 380px', ' sizes="(min-width:1200px) 394px'),
    expect: ['fenced ABOVE the breakpoint'],
  },
  {
    name: 'the hide is put on the box instead of the grid cell, leaving dead space',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '  .about-media{display:none}', '  .about-photo{display:none}'),
    expect: ['whole grid cell is hidden'],
  },
  {
    name: 'the cell loses the class the hide rule selects',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '<div class="about-media" style="position:relative" data-reveal>',
      '<div style="position:relative" data-reveal>'),
    expect: ['actually carries that class'],
  },
  {
    name: 'build() stops checking whether the host is on screen at all',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '        if(!host.getClientRects().length) return;\n', ''),
    expect: ['refuses a host with no client rects'],
  },
  {
    /* Flagging a hidden host as built is the same class of bug as flagging it
       on entry: the scan skips it for ever and a phone turned sideways never
       gets a ring. */
    name: 'a hidden host is flagged built, so it is never revisited',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '        if(!host.getClientRects().length) return;',
      '        if(!host.getClientRects().length) { host.__built=1; return; }'),
    expect: ['does NOT flag it built'],
  },
  {
    /* The positional version, which silently downgraded the front panel from
       AVIF to WebP the moment a source was inserted above it. */
    name: 'point() goes back to addressing the sources by index',
    suite: 'test-about-board.js',
    /* ⚠️ The first version of this fault only changed the DECLARATION and left
       the type loop below it intact, which reassigned both variables correctly
       - a no-op, reported as "not caught" rather than passing. The whole
       lookup has to go, or the fault is not a fault. */
    apply: () => patch(HOME,
      "      var s=pic.getElementsByTagName('source'), avif=null, webp=null, j;\n" +
      "      for(j=0;j<s.length;j++){\n" +
      "        if(s[j].type==='image/avif') avif=s[j];\n" +
      "        else if(s[j].type==='image/webp') webp=s[j];\n" +
      "      }\n",
      "      var s=pic.getElementsByTagName('source'), avif=s[0], webp=s[1];\n"),
    expect: ['finds the sources by TYPE'],
  },
  /* ---- the header nav: hover, current section, condensed bar (5 Aug 2026) -- */
  {
    /* ⚠️ THE BUG JAY REPORTED: "the header buttons continue to shimmer forever
       after being pressed". A touch device applies :hover on tap and never
       removes it, so an infinite animation runs until you touch something
       else. Measured still running 3.4s after a tap. */
    name: 'the nav sweep goes back to looping for ever',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "animation:holoSweep .9s ease-out 1 forwards",
      "animation:holoShift 2.2s ease-in-out infinite"),
    expect: ['sweep runs once'],
  },
  {
    /* The one-way keyframe turned back into a there-and-back one: it would
       finish where it started, leaving a bright band parked on the item. */
    name: 'holoSweep is made to return to where it started',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '@keyframes holoSweep{from{background-position:0% 0%}to{background-position:140% 140%}}',
      '@keyframes holoSweep{from{background-position:0% 0%}to{background-position:0% 0%}}'),
    expect: ['one-way, unlike the looping holoShift'],
  },
  {
    /* ⚠️ The whole point of the fix. Outside the pointer query, a tap on a
       tablet leaves the pill and the shimmer applied indefinitely. */
    name: 'a hover rule escapes the pointer query and sticks after a tap',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "    .hdr-nav a:hover::after{transform:scaleX(1)}\n  }",
      "  }\n  .hdr-nav a:hover::after{transform:scaleX(1)}"),
    expect: ['NO hover rule escaped it'],
  },
  {
    /* Focus is not a hover effect. Inside the query, a keyboard user with no
       pointer loses the outline entirely - taking it from the people who need
       it most. */
    name: 'the focus outline is swept inside the pointer query with the hover rules',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "  .hdr-nav a:focus-visible{outline:2px solid #3bd070;outline-offset:2px}",
      "  @media (hover:hover){.hdr-nav a:focus-visible{outline:2px solid #3bd070;outline-offset:2px}}"),
    expect: ['focus outline is outside the pointer query'],
  },
  {
    name: 'the nav stops reusing the shared gradient recipe',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, ".hdr-nav a:hover::before{opacity:.85;animation:holoSweep",
      ".hdr-nav a:hover::before{opacity:.85;animation:navGlow"),
    expect: ['times its own sweep'],
  },
  {
    name: 'the underline runs edge to edge instead of matching the pill',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, ".hdr-nav a::after{content:\"\";position:absolute;left:11px;right:11px;bottom:4px;",
      ".hdr-nav a::after{content:\"\";position:absolute;left:0px;right:0px;bottom:4px;"),
    expect: ['inset to the pill padding'],
  },
  {
    /* One section dropped from the current-section rules is one nav link that
       never marks - and nothing about the page looks wrong. */
    name: 'a section is dropped from the current-section underline',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '  html[data-sec="venue"]    .hdr-nav a[href="#venue"]::after,\n', ''),
    expect: ['underline covers #venue'],
  },
  {
    /* ⚠️ The one that matters most. A class on the link is destroyed the next
       time the engine re-renders the body, and the underline silently stops
       following you down the page. */
    name: 'the current section is written onto the link instead of <html>',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "          if(found) document.documentElement.setAttribute('data-sec', found);",
      "          if(found) document.querySelector('.hdr-nav a').classList.add('current');"),
    expect: ['writes the section to <html>'],
  },
  {
    name: 'the condensed class is written onto the header instead of <html>',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "          document.documentElement.classList.toggle('hdr-tight', wanttight);",
      "          document.querySelector('header').classList.toggle('hdr-tight', wanttight);"),
    expect: ['same for the condensed class'],
  },
  {
    /* ⚠️ THE BUG THIS BLOCK SHIPPED WITH FIRST TIME. Without !important the
       class goes on, the DOM reads correctly, and the bar does not move one
       pixel, because every property it overrides is set inline. */
    name: 'a condensed rule loses its !important and is beaten by the inline style',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'html.hdr-tight .hdr-row{padding:7px 32px!important}',
      'html.hdr-tight .hdr-row{padding:7px 32px}'),
    expect: ['beats the inline style'],
  },
  {
    /* A partner mark quietly shrinking is the same class of failure as one
       quietly vanishing, and test-sponsors.js pins it at 19px. */
    name: 'the condensed bar shrinks the HSBC mark along with everything else',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '    html.hdr-tight .hdr-partner-div{height:24px!important}',
      '    html.hdr-tight .hdr-partner-div{height:24px!important}\n    html.hdr-tight .hdr-partner img{height:15px!important}'),
    expect: ['no condensed rule touches the HSBC mark'],
  },
  {
    name: 'the condensed rules escape their 761px floor and hit the phone bar',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '  @media (min-width:761px){\n    html.hdr-tight .hdr-row',
      '  @media (min-width:1px){\n    html.hdr-tight .hdr-row'),
    expect: ['scoped to 761px and up'],
  },
  {
    name: 'the scroll handler loses its frame throttle',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "      if(ticking) return;\n      ticking = true;\n      window.requestAnimationFrame(measure);",
      "      measure();"),
    expect: ['throttled to one frame'],
  },
  {
    name: 'the scroll handler writes to the DOM on every single event',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '        if(wanttight !== tight){', '        if(true){'),
    expect: ['only writes when the answer changes'],
  },
  {
    name: 'the scroll listener stops being passive',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "    window.addEventListener('scroll', onscroll, {passive:true});",
      "    window.addEventListener('scroll', onscroll);"),
    expect: ['registered passive'],
  },
  {
    /* The sections do not exist on the first pass - the engine renders the body
       after first paint - so a one-shot measure marks nothing, for ever. */
    name: 'the header stops re-measuring after the engine re-renders',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "    var n=0, iv=setInterval(function(){ measure(); if(++n>40) clearInterval(iv); },500);\n  })();\n\n  /* Registers the service worker", "  })();\n\n  /* Registers the service worker"),
    expect: ['re-measures after the engine re-renders'],
  },
  {
    name: 'the pill and underline are left on inside the phone panel',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '  .hdr-row[data-nav-open="true"] .hdr-nav a::before,\n  .hdr-row[data-nav-open="true"] .hdr-nav a::after{display:none}', ''),
    expect: ['decorations come off inside the open phone panel'],
  },

  {
    /* ⚠️ REPOINTED, in the same commit that broke it. The wordmark check in
       test-design-polish.js anchored on `<span style=` with the style attribute
       FIRST; the header wordmark gained a class in front of it when the bar
       learned to condense, so the anchor matched nothing and the suite failed on
       an UNDAMAGED copy - which drops the clean-baseline count and makes every
       one of that suite's faults meaningless. The rule is unchanged and still
       load-bearing, so this fault follows it to the content anchor. */
    name: 'the header wordmark can wrap to a second line inside the sticky bar',
    suite: 'test-design-polish.js',
    apply: () => patch(HOME, 'class="hdr-wordmark" style="font-family:\'Anton\';font-size:19px;letter-spacing:.5px;white-space:nowrap"',
      'class="hdr-wordmark" style="font-family:\'Anton\';font-size:19px;letter-spacing:.5px"'),
    expect: ['cannot wrap to a second line'],
  },

  {
    /* The nav gap going back to 24px puts 154px of pill padding on top of the
       old spacing and the sticky header scrolls sideways from ~1015px down. */
    name: 'the nav gap goes back to its pre-pill value and the header overflows',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '  .hdr-nav{gap:2px!important}', '  .hdr-nav{gap:24px!important}'),
    expect: ['nav gap came down'],
  },
  {
    name: 'the tight 761-900px band is dropped, restoring a live overflow',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '    .hdr-nav a{padding:7px 6px 9px}', '    .hdr-nav a{padding:7px 11px 9px}'),
    expect: ['band tightens the pill further'],
  },
  {
    /* ⚠️ The band rule moved above the base rule loses silently - same
       specificity, earlier in the file. It looks completely correct. */
    name: 'the band rule is moved above the base rule, where it does nothing',
    suite: 'test-about-board.js',
    apply: () => patch(HOME,
      '  .hdr-nav a{position:relative;display:inline-block;padding:7px 11px 9px;',
      '  @media (min-width:761px) and (max-width:900px){\n    .hdr-nav a{padding:7px 6px 9px}\n  }\n  .hdr-nav a{position:relative;display:inline-block;padding:7px 11px 9px;'),
    expect: ['sits BELOW the base'],
  },

  {
    /* Proves the nav-count check reads the CODE and not the prose. Without the
       CSS-comment strip this fault is indistinguishable from a real second nav,
       and the suite reports a failure that nobody can act on. */
    name: 'a second real <nav> appears on the homepage',
    suite: 'test-back-office-links.js',
    apply: () => patch(HOME, '      <div class="hdr-menu" style="position:relative;flex:none">',
      '      <nav class="hdr-extra"></nav>\n      <div class="hdr-menu" style="position:relative;flex:none">'),
    expect: ['exactly one nav element'],
  },

  {
    /* The bug Jay reported on the header, in the place it came FROM. Measured
       still shimmering and tilted 2.5s after a tap on a 390px viewport. */
    name: 'the age-group cards lose their pointer gate and stick on touch again',
    suite: 'test-about-board.js',
    apply: () => patch(HOME,
      "  @media (hover:hover){\n    .fmt-grp:hover{transform:perspective(400px)",
      "  @media (min-width:1px){\n    .fmt-grp:hover{transform:perspective(400px)"),
    expect: ['age-group cards', 'behind (hover:hover)'],
  },
  {
    /* The worst of them: a tap opens the modal AND leaves the button lit up,
       tilted and shimmering behind it. */
    name: 'the Register buttons lose their pointer gate',
    suite: 'test-about-board.js',
    apply: () => patch(HOME,
      "  @media (hover:hover){\n    .reg-btn:hover{transform:perspective(400px)",
      "  @media (min-width:1px){\n    .reg-btn:hover{transform:perspective(400px)"),
    expect: ['Register buttons', 'behind (hover:hover)'],
  },
  {
    /* ⚠️ Gating is not an excuse to drop the effect. A mouse must still get it -
       otherwise "fixed on touch" quietly means "deleted everywhere". */
    name: 'the card shimmer is deleted rather than gated',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "    .fmt-grp:hover .holo{opacity:.7;animation:holoShift 2.2s ease-in-out infinite}\n", ""),
    expect: ['still shimmer for a real pointer'],
  },
  {
    /* A new component grows a hover effect outside the gate - which is exactly
       how this bug spread from the cards to the header in the first place. */
    name: 'a new hover effect is added outside the pointer gate',
    suite: 'test-about-board.js',
    /* ⚠️ REPOINTED: the anchor was the rules button's old outline styling,
       which was replaced when it took the .reg-btn treatment. The RULE this
       guards - a new hover effect must not be added outside the pointer gate -
       is unchanged, so the fault follows it to a stable line rather than being
       deleted with the CSS it happened to sit next to. */
    apply: () => patch(HOME, '  .rules-btn{text-decoration:none}',
      '  .spon-tile:hover{transform:translateY(-3px)}\n  .rules-btn{text-decoration:none}'),
    expect: ['moves or animates is behind'],
  },

  /* ---- the age-group picker, both surfaces (6 Aug 2026) -----------------
     Grouping the picker by day is the first thing in a year that has made a
     written-out list of age groups tempting again — which is exactly how U12G
     and both U18 groups once went live on the wrong day. The first two faults
     below are that regression, from both ends. */
  {
    name: 'the picker declares its own list of Saturday age groups again',
    suite: 'test-age-group-picker.js',
    apply: () => patch('app.html', 'function pills(){',
      "const SATURDAY = ['u6','u7','u8','u9','u10','u11','u12','u12g'];\nfunction pills(){"),
    expect: ['declares no age-group list next to a day'],
  },
  {
    /* ⚠️ THE OTHER END, AND THE ONE THAT MATTERS. A call to isDayOne() proves
       nothing about whether its ANSWER is used, so the sweep above is paired
       with a driven check: move a group between days and it must move block. */
    name: 'the day answer is ignored, so every group lands in one block',
    suite: 'test-age-group-picker.js',
    apply: () => patch('app.html', '    const list = (S.ageGroups || []).filter(a => isSat(a.id) === sat);',
      '    const list = (S.ageGroups || []).filter(() => sat);'),
    expect: ['U9 above the Sunday heading and U12G below it', 'draws a Saturday block and a Sunday block'],
  },
  {
    /* The split is the FIRST space. On the last space "U9 Mixed Contact"
       becomes band "U9 Mixed" — which still renders, still looks like a chip,
       and is wrong on every multi-word format. */
    name: 'the label is split on the last space instead of the first',
    suite: 'test-age-group-picker.js',
    apply: () => patch('app.html', "  const i = t.indexOf(' ');\n  return i < 0 ? { band: t, fmt: '' }",
      "  const i = t.lastIndexOf(' ');\n  return i < 0 ? { band: t, fmt: '' }"),
    expect: ['puts the band in its own element'],
  },
  {
    /* A future group with no space in its name must keep its whole name as the
       band. Swapped round it renders a chip with an empty first line. */
    name: 'a name with no space loses its band instead of keeping it',
    suite: 'test-age-group-picker.js',
    apply: () => patch('app.html', "  return i < 0 ? { band: t, fmt: '' } :",
      "  return i < 0 ? { band: '', fmt: t } :"),
    expect: ['keeps the whole string as the band'],
  },
  {
    /* Back to the thing Jay actually complained about: a horizontal strip with
       most of the list off the right edge and no scrollbar to say so. */
    name: 'the chips stop wrapping and go back to a hidden horizontal scroller',
    suite: 'test-age-group-picker.js',
    /* ⚠️ ANCHOR REPOINTED 6 Aug 2026 — the chips moved behind `.ag-day.open`
       when the blocks became collapsible, so the old flat rule was gone. The
       rule is unchanged and is the original complaint: the chips must WRAP,
       never scroll sideways behind a hidden scrollbar. */
    apply: () => patch('app.html', '.ag-day.open .ag-chips{display:flex;flex-wrap:wrap;gap:7px;padding:2px 0 13px}',
      '.ag-day.open .ag-chips{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:7px;padding:2px 0 13px}'),
    expect: ['the chips wrap instead'],
  },
  {
    /* ⚠️ Red for day one, GREEN for day two. Both are asserted, or "it goes
       red" passes on a picker that has quietly lost the second colour — and
       the day coding is half the reason for grouping at all. */
    name: 'a selected day-two chip on /scores goes red like day one',
    suite: 'test-age-group-picker.js',
    apply: () => patch('Scores & Standings.dc.html',
      "          ? { ...t, style: t.style.replace(/#E11B22;background:#E11B22/, '#17A34A;background:#17A34A') }",
      '          ? { ...t }'),
    expect: ['selected day-two chip is green, not red'],
  },
  {
    /* ⚠️ The duplicate day line comes back. dayTag() printed the same sentence
       the block heading now carries, 30px lower — the HSBC-band mistake in
       miniature. Restored as a caller, which is the realistic regression: the
       function is easy to re-add from git history and the call site is one
       template literal. */
    name: 'the day is said twice again — dayTag returns under the picker',
    suite: 'test-age-group-picker.js',
    apply: () => patch('app.html',
      '  const head = `<div class="sec-t">Fixtures</div>${pills()}${teamKeyButton()}`;',
      '  function dayTag(a){ return a ? `<div class="daytag">${esc(api.dayLabelOfAgeGroup(a))}</div>` : ""; }\n'
      + '  const head = `<div class="sec-t">Fixtures</div>${pills()}${dayTag(S.browseId)}${teamKeyButton()}`;'),
    expect: ['dayTag() is gone from the match-day app', 'nothing still calls it'],
  },
  {
    /* ⚠️ THE OTHER HALF, AND THE REASON THE REMOVAL IS A TIDY-UP RATHER THAN A
       LOSS. The rule is "say the day ONCE", not "never say it" — so deleting
       it from the block heading as well must fail, or the absence check above
       would be satisfied by a picker that had lost the day entirely. */
    name: 'the day disappears from the picker altogether, not just from the duplicate',
    suite: 'test-age-group-picker.js',
    /* ⚠️ ANCHOR REPOINTED 6 Aug 2026 — the heading gained a badge and a caret
       when the blocks became collapsible, so the old one-line literal no
       longer existed. The rule is unchanged: emptying the heading must fail,
       or "dayTag is gone" is satisfied by the day vanishing altogether. */
    apply: () => patch('app.html',
      '      + `<span class="ag-d">${esc(label)}</span>${badge}`',
      '      + `<span class="ag-d"></span>${badge}`'),
    expect: ['the day is still on screen, in the block heading'],
  },
  {
    /* A deletion with no trace is an invitation to re-add it — and the next
       person to build a horizontal row will rediscover the problem this one
       solved. */
    name: 'the deleted pill-centring helper loses its tombstone',
    suite: 'test-age-group-picker.js',
    apply: () => patch('app.html', '/* ⚠️ TOMBSTONE - centreActivePill() lived here', '/* Nothing to see here'),
    expect: ['recorded, not silently dropped'],
  },

  /* ---- the picker collapses, and there are THREE of them (6 Aug 2026) ---
     The first version of this work covered /app and /scores and shipped, while
     the homepage Fixtures section kept its flat list — so one page carried two
     pickers that disagreed. These faults exist so the third can never be the
     forgotten one again, and so the accordion cannot quietly stop working. */
  {
    /* ⚠️ The obvious "consistency" tidy-up, and it is wrong. /scores drops U6
       and U7 because a STANDINGS tab for them can only say "no standings are
       kept". The homepage picker is for FIXTURES, which they do have. */
    name: 'the homepage picker drops the festival groups to match /scores',
    suite: 'test-age-group-picker.js',
    apply: () => patch('Quins JRT.dc.html',
      '      const list = (this.state.fxAgeGroups || []).filter((a) => !!(fxApiRef && fxApiRef.isDayOne(a.id)) === isDay1);',
      "      const list = (this.state.fxAgeGroups || []).filter((a) => a.id !== 'u6' && a.id !== 'u7').filter((a) => !!(fxApiRef && fxApiRef.isDayOne(a.id)) === isDay1);"),
    expect: ['keeps the festival groups'],
  },
  {
    /* Both blocks open again — the wall of chips this replaced. */
    name: 'both day blocks open at once, so nothing is actually collapsed',
    suite: 'test-age-group-picker.js',
    apply: () => patch('app.html', '    const isopen = open === day;', '    const isopen = true;'),
    expect: ['exactly ONE day open'],
  },
  {
    /* ⚠️ THE WHOLE SAFETY OF COLLAPSING. Open a FIXED day and half the readers
       arrive looking at a list that does not contain their own group, with
       theirs hidden behind a heading — worse than the wall of chips. */
    name: 'the open day is fixed to day one instead of following the pick',
    suite: 'test-age-group-picker.js',
    apply: () => patch('app.html', '  return isSat(S.browseId) ? 1 : 2;', '  return 1;'),
    expect: ['and day two for U12G'],
  },
  {
    /* Tapping a heading stops doing anything: the accordion becomes decoration. */
    name: 'the pinned day is ignored, so the headings are not really clickable',
    suite: 'test-age-group-picker.js',
    apply: () => patch('app.html', '  if (S.agopen === 1 || S.agopen === 2) return S.agopen;', ''),
    expect: ['pinning a day overrides'],
  },
  {
    /* ⚠️ THE OTHER HALF OF THE PIN. Stored WITH the selection it was made
       under, so a new pick releases it. A pin that outlived the pick would
       strand a reader on a day their group is not on. */
    name: 'the pinned day outlives the pick that was made after it',
    suite: 'test-age-group-picker.js',
    apply: () => patch('Scores & Standings.dc.html',
      '    const pinned = (s.agPin && s.agPin.sel === s.selectedAgeId) ? s.agPin.day : null;',
      '    const pinned = s.agPin ? s.agPin.day : null;'),
    expect: ['releases the pin'],
  },
  {
    /* ⚠️ A closed day that holds the pick must say so, or opening the other day
       hides the selection and the picker starts lying about where you are. */
    name: 'a closed day stops naming the pick it is hiding',
    suite: 'test-age-group-picker.js',
    apply: () => patch('app.html', '    const badge = (!isopen && holds) ?',
      '    const badge = (false && holds) ?'),
    expect: ['closed day holding the pick names it'],
  },

  /* ---- switching age group while a write is in flight (6 Aug 2026) ------
     Found by audit, not by a report. Only an organiser sees the switcher and
     it is never disabled, so every captured-ageId-then-await path on the Draw
     tab can land its reload on a group the organiser has already left. */
  {
    /* THE BUG ITSELF. Without the entry guard, loadDraw() still ran its
       opening setState, so a reload aimed at the OLD group blanked the draw
       for the NEW one and cleared its drawDirty — losing unsaved edits with
       no confirm, and leaving the next switch unable to warn either. */
    name: 'a reload for the group just left wipes the draft on the group now on screen',
    suite: 'test-manager-dc-draw.js',
    apply: () => patch('Manager.dc.html',
      '    if (this.state.ageId !== agId) return;\n    const { api, session } = this.state;',
      '    const { api, session } = this.state;'),
    expect: ['draft the organiser is actually editing survives', 'keeps its unsaved changes'],
  },
  {
    /* ⚠️ THE OTHER HALF, AND IT IS THE ONE THAT MAKES THE FIX A FIX RATHER
       THAN A DELETION. "Return early" would satisfy every check above by
       never reloading anything at all, so the ordinary path — a reload for
       the group you ARE on — has to be asserted too. */
    name: 'the reload guard is inverted, so the group you are on never refreshes',
    suite: 'test-manager-dc-draw.js',
    apply: () => patch('Manager.dc.html',
      '    if (this.state.ageId !== agId) return;\n    const { api, session } = this.state;',
      '    if (this.state.ageId === agId) return;\n    const { api, session } = this.state;'),
    expect: ['reload for the CURRENT group still fetches'],
  },
  {
    /* A confirm that is never asked. Structural checks cannot see this — the
       handler still exists, it just stops gating on anything. */
    name: 'switching age group stops asking about an unsaved draft',
    suite: 'test-manager-dc-draw.js',
    apply: () => patch('Manager.dc.html', '    if (s.drawDirty) {\n      this.confirmModal(',
      '    if (false) {\n      this.confirmModal('),
    expect: ['unsaved draft is asked about before anything moves'],
  },
  {
    /* ⚠️ Dropping the draft is not tidiness — load()'s keepDraw carry-through
       exists for the save/clear case and would otherwise attach one age
       group's unsaved edits to another age group's data. */
    name: 'the discarded draft is not cleared, so it rides across to the new age group',
    suite: 'test-manager-dc-draw.js',
    apply: () => patch('Manager.dc.html',
      "      this.setState({ draw: undefined, drawLoadedFor: null, drawDirty: false, drawMsg: '' });",
      "      this.setState({ draw: undefined, drawLoadedFor: null, drawMsg: '' });"),
    expect: ['dropped, not carried across'],
  },
  {
    /* Re-picking the group you are already on would otherwise throw away a
       dirty draft — or ask about it — for a switch that is not a switch. */
    name: 're-picking the current age group is treated as a real switch',
    suite: 'test-manager-dc-draw.js',
    apply: () => patch('Manager.dc.html', '    if (!agId || agId === s.ageId) return;',
      '    if (!agId) return;'),
    expect: ['re-picking the group you are already on does nothing'],
  },

  /* ---- the same rule, swept across every page (6 Aug 2026) --------------
     The three below prove the SITE-WIDE sweep in test-design-polish.js, which
     the homepage's own sweep above cannot: it reads 'Quins JRT.dc.html' and
     nothing else. Each is injected into a DIFFERENT file, so no single anchor
     covers two of them and a sweep that quietly stopped reading one page still
     fails. */
  {
    /* The back office is where a manager taps on a phone at a tournament, and
       nothing has ever checked its hover rules. A lift on tap is the exact
       shape of the bug Jay reported on the header. */
    name: 'the back-office buttons grow a lift on hover with no pointer gate',
    suite: 'test-design-polish.js',
    apply: () => patch('Manager.dc.html',
      '  button:hover:not(:disabled){filter:brightness(0.94)}',
      '  button:hover:not(:disabled){filter:brightness(0.94);transform:translateY(-2px)}'),
    expect: ['moves or animates outside (hover:hover)'],
  },
  {
    /* ⚠️ ON rules.html SPECIFICALLY, because it is one of the two files NOT in
       ALL_PAGES. If the sweep ever falls back to that list instead of its own,
       this fault stops being caught and nothing else would say so. */
    name: 'the rules page grows a hover effect that moves, outside the gate',
    suite: 'test-design-polish.js',
    apply: () => patch('rules.html',
      '  .back:hover{background:rgba(255,255,255,0.18);text-decoration:none}',
      '  .back:hover{background:rgba(255,255,255,0.18);text-decoration:none;transform:translateY(-2px)}'),
    expect: ['moves or animates outside (hover:hover)'],
  },
  {
    /* ⚠️ THE SWEEP CANNOT CATCH THIS ONE, WHICH IS WHY THE NAMED CHECK EXISTS.
       app.html's hover rules are colour-only, so removing their pointer gate
       makes nothing "loud" and the sweep stays green — the gate would simply
       stop existing, silently, on the one page outside the homepage that has
       one. Rewritten rather than deleted so the block still parses. */
    name: 'the match-day app\'s hover rules lose their pointer gate',
    suite: 'test-design-polish.js',
    apply: () => patch('app.html', '@media(hover:hover){', '@media(pointer:fine){'),
    expect: ['stay behind a pointer gate'],
  },

  {
    name: 'the ring box goes back to cream while the rest stays dark',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '.about-photo{position:relative;border-radius:18px;overflow:hidden;\n  background:#0C0C0E;',
      '.about-photo{position:relative;border-radius:18px;overflow:hidden;\n  background:#F3F1ED;'),
    expect: ['the box is on #0C0C0E'],
  },
  {
    name: 'the 3D scene behind the panels goes back to cream',
    suite: 'test-about-board.js',
    /* ⚠️ ANCHOR REPOINTED — the rule gained touch-action when the ring became
       a carousel, so the whole-rule literal could no longer be injected. */
    apply: () => patch(HOME, 'perspective:1200px;background:#0C0C0E;\n  outline:none}',
      'perspective:1200px;background:#F3F1ED;\n  outline:none}'),
    expect: ['the 3D scene is on #0C0C0E', 'same colour as each other'],
  },
  {
    /* ⚠️ THE ONE THAT WAS ACTUALLY FORGOTTEN when this change was made. The
       panel's own background shows only while its photo is still decoding, so
       a screenshot taken a second later looks perfect - and a panel left cream
       against a black box flashes as a pale rectangle that reads as a broken
       image. */
    name: 'the panel keeps a cream background, flashing pale before its photo loads',
    suite: 'test-about-board.js',
    /* ⚠️ ANCHOR REPOINTED with the ring's angle comment, which went when the
       cards stopped being seated on a cylinder. The rule is unchanged: the
       card's own background is the one that gets forgotten. */
    /* ⚠️ ANCHOR REPOINTED AGAIN — the comment it hung off went with the drag.
       It now hangs off the box-shadow warning, which is the most permanent
       thing in this file. */
    apply: () => patch(HOME, '  background:#0C0C0E}\n\n/* ⚠️ DO NOT ADD A box-shadow',
      '  background:#F3F1ED}\n\n/* ⚠️ DO NOT ADD A box-shadow'),
    expect: ['the card is on #0C0C0E', 'same colour as each other'],
  },
  {
    name: 'the record of the cream-vs-black reversal is tidied away',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "IT IS DARK AGAIN (#0C0C0E), reversed at Jay's request", 'It is dark'),
    expect: ['argument for cream are both recorded'],
  },

  /* ---- the tournament rules page ---------------------------------------- */
  {
    name: 'the /rules rewrite is removed, so the button 404s',
    suite: 'test-about-board.js',
    apply: () => patch('netlify.toml', '  from = "/rules"\n  to = "/rules.html"\n  status = 200',
      '  from = "/rules-old"\n  to = "/rules.html"\n  status = 200'),
    expect: ['served at /rules'],
  },
  {
    name: 'the About section loses its rules button',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '<a href="/rules" class="reg-btn rules-btn"', '<a href="#about" class="reg-btn rules-btn"'),
    expect: ['About section links to it'],
  },
  {
    /* Dropping .reg-btn is how a fourth definition of "a button on this site"
       gets born, and the three then drift apart invisibly. */
    name: 'the rules button stops wearing the Register buttons\' class',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '<a href="/rules" class="reg-btn rules-btn"', '<a href="/rules" class="rules-btn"'),
    expect: ['wears the Register buttons'],
  },
  {
    name: 'the rules button grows to match the hero pair and competes with them',
    suite: 'test-about-board.js',
    /* ⚠️ ANCHOR REPOINTED 6 Aug 2026 — it carried the old #17A34A glow, which
       this branch changed to red, so the fault could no longer be injected.
       A fault that cannot be injected is a failed run, not a pass. It now
       anchors on the size alone, which is what it was always about. */
    apply: () => patch(HOME, 'font-size:14px;padding:13px 26px', 'font-size:18px;padding:13px 26px'),
    expect: ['smaller than the Register buttons'],
  },
  {
    /* ⚠️ Without the fit-content wrapper the auto margin centres on the whole
       text column, which measured 91px right of the pair's centre at 1400px -
       visibly wrong, and exactly what Jay asked to have fixed. */
    name: 'the centring wrapper is removed, so the button centres on the column',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '      <div style="width:fit-content">\n        <div style="display:flex;gap:36px;margin-top:36px">',
      '      <div>\n        <div style="display:flex;gap:36px;margin-top:36px">'),
    expect: ['wrapper that shrinks to the pair'],
  },
  {
    name: 'the auto margin is dropped and the button falls back to the left edge',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'margin:30px auto 0;display:flex', 'margin:30px 0 0;display:flex'),
    expect: ['centred with margin auto'],
  },
  {
    /* Indexable ON PURPOSE - it is the opposite of the club form. */
    name: 'the rules page is made noindex, so nobody can find it by searching',
    suite: 'test-about-board.js',
    apply: () => patch('rules.html', '<meta name="robots" content="all">',
      '<meta name="robots" content="noindex, nofollow">'),
    expect: ['rules page is indexable'],
  },
  {
    name: 'the rules page drops out of the sitemap',
    suite: 'test-about-board.js',
    apply: () => patch('sitemap.xml', '    <loc>https://adhjrt.com/rules</loc>', '    <loc>https://adhjrt.com/rules-x</loc>'),
    expect: ['is in the sitemap'],
  },
  {
    /* A placeholder that does not say WHEN is a shrug, and a coach reading it
       wonders whether the tournament is organised. */
    name: 'the coming-soon copy stops saying when the rules will arrive',
    suite: 'test-about-board.js',
    apply: () => patch('rules.html', 'before registration opens in October', 'in due course'),
    expect: ['says when the rules will be there'],
  },
  {
    name: 'the instruction telling the next person what to replace is tidied away',
    suite: 'test-about-board.js',
    apply: () => patch('rules.html', 'REPLACE THIS BLOCK when the real rules arrive', 'Placeholder'),
    expect: ['replace-this-block instruction'],
  },
  {
    name: 'the resize re-scan is dropped, stranding a rotated phone',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "      window.addEventListener('resize', function(){", "      (function(){"),
    expect: ['resize re-scan'],
  },
  {
    /* box-shadow inside a backface-visibility:hidden element in a preserve-3d
       scene stops the panels painting their photos at all. No error anywhere. */
    name: 'a box-shadow creeps back onto the ring panels',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '.jrtb-p img{width:100%',
      '.jrtb-p{box-shadow:0 10px 30px rgba(0,0,0,.4)}\n.jrtb-p img{width:100%'),
    expect: ['no box-shadow on .jrtb-p'],
  },
  {
    /* overflow / opacity / filter on the ring flattens preserve-3d and the
       cylinder collapses into a flat horizontal squash. */
    name: 'overflow is put on .jrtb-ring, flattening preserve-3d',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '.jrtb-track{position:absolute;inset:0;transform-style:preserve-3d}',
      '.jrtb-track{position:absolute;inset:0;overflow:hidden;transform-style:preserve-3d}'),
    expect: ['no overflow / opacity / filter on .jrtb-track'],
  },
  {
    /* Chrome treats rotateY past 180deg as back-facing, so the whole left-hand
       side of the ring silently stops painting. */
    name: 'panel angles go back to 0..360 and the left half of the ring stops painting',
    suite: 'test-about-board.js',
    /* ⚠️ REPOINTED WITH ITS SUBJECT. The ring normalised angles because Chrome
       stops painting past 180deg; the carousel has no angles to normalise, but
       the hazard survives — backface-visibility is what turned an unpainted
       card into an invisible one rather than a mirrored one. */
    apply: () => patch(HOME, '  overflow:hidden;border-radius:8px;',
      '  overflow:hidden;border-radius:8px;backface-visibility:hidden;'),
    expect: ['no card is hidden by backface-visibility'],
  },
  {
    /* The flag on entry is what left the host marked built when it was not, so
       the re-scanning loop skipped it for ever. */
    name: 'build() goes back to flagging success on entry',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '      if(host.__built)return;\n      try{',
      '      if(host.__built)return;\n      host.__built=1;\n      try{'),
    expect: ['flags success only AFTER the cards are placed'],
  },
  {
    /* Find-it-once worked from a local file and did nothing deployed, because
       the engine re-renders the body after first paint. */
    name: 'the boot loop goes back to find-it-once',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '      var n=0, iv=setInterval(function(){ scan(); if(++n>40) clearInterval(iv); },500);', ''),
    expect: ['boot loop keeps re-scanning'],
  },
  {
    /* ⚠️ REPOINTED TWICE NOW, AND STILL THE SAME RULE. It began on the About
       badge's own row, moved to the footer crest on 5 Aug when that row was
       deleted, and the RULE it guards has now inverted rather than died: the
       holed shield is legitimate in exactly one place — paired with the bat in
       the About section — and nowhere else. A shield in the FOOTER is still a
       crest with a piece missing, and there is no bat there to fill it. */
    name: 'the holed crest-shield is used somewhere the bat cannot fill it',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '<img src="assets/crest.png" alt="Abu Dhabi Harlequins crest" style="width:100%',
      '<img src="assets/crest-shield.png" alt="Abu Dhabi Harlequins crest" style="width:100%'),
    expect: ['the holed shield appears ONCE'],
  },
  {
    /* The crest was removed from this section deliberately and the tombstone
       says so. Putting it back is the tidy-up somebody makes without reading. */
    /* ⚠️ INVERTED WITH ITS SUBJECT, NOT DELETED. On `main` this injected a
       crest into a section that must not have one. Here the section SHOULD have
       one — so the fault becomes a SECOND crest, the complete one, which is the
       two-bats bug arriving by a different door than swapping the badge. */
    name: 'a second, complete crest creeps into the About section',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '<div style="font-weight:800;letter-spacing:2px;color:#E11B22;font-size:14px;text-transform:uppercase;margin-bottom:16px">About the festival</div>',
      '<img src="assets/crest.png" alt="crest" style="width:96px;height:96px"><div style="font-weight:800;letter-spacing:2px;color:#E11B22;font-size:14px;text-transform:uppercase;margin-bottom:16px">About the festival</div>'),
    expect: ['NOT the complete crest'],
  },
  {
    /* ⚠️ REPOINTED, SAME RULE: a decision must carry its argument. On `main`
       that was the tombstone for the removed crest. Here it is the note
       recording the argument AGAINST putting it back — that a badge over
       rotating photos read as a sticker. Losing that is how the same debate
       gets had twice with nobody remembering the first round. */
    name: 'the argument against the crest being here is tidied away',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'RECORDED AGAINST ITSELF', 'A note'),
    expect: ['the argument against putting it back survives'],
  },
  {
    /* ⚠️ THE ONE THAT MATTERS. Widening the photo column again without moving
       --pw with it puts a 394px panel in a 646px box - adrift in empty space -
       or, in the other direction, a 480px panel in a 533px box, which runs the
       photos almost edge to edge. Neither errors. */
    name: 'the About grid is re-proportioned without --pw following it',
    suite: 'test-about-board.js',
    /* ⚠️ REPOINTED. The grid no longer drives the card width — the carousel
       bleeds past the column instead — but the section's max-width and padding
       ARE what the bleed formula is derived from, so re-proportioning them
       without redoing the formula is the same class of silent mistake. */
    apply: () => patch(HOME, 'max-width:1200px;margin:0 auto;padding:100px 32px;display:grid;grid-template-columns:1fr 1fr;gap:70px',
      'max-width:1320px;margin:0 auto;padding:100px 48px;display:grid;grid-template-columns:1fr 1fr;gap:70px'),
    expect: ['still 1200px wide with 32px padding'],
  },
  {
    /* --pw moves and `sizes` is left behind: every visitor downloads a file
       bigger than they need and nothing anywhere reports it. */
    name: 'the CSS panel width drifts away from the sizes attribute',
    suite: 'test-about-board.js',
    /* ⚠️ REPOINTED. --pw is --cw now and the drift it guards is identical: the
       CSS card width moving while `sizes` stays behind, so every visitor
       downloads a bigger file than they need and nothing reports it. */
    apply: () => patch(HOME, '--cw: clamp(190px, 26vw, 380px);',
      '--cw: clamp(190px, 32vw, 460px);'),
    expect: ['breakpoint is where the vw term actually reaches the cap'],
  },
  {
    /* The heading was cut to 52px once already, as a consequence of a photo
       resize rather than as a decision about the words. */
    name: 'the About heading is shrunk back to 52px',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "font-size:clamp(34px,5.5vw,66px);line-height:0.95;text-transform:uppercase;color:#0C0C0E;margin:0\">Rugby the way it should be",
      "font-size:clamp(30px,4.4vw,52px);line-height:0.95;text-transform:uppercase;color:#0C0C0E;margin:0\">Rugby the way it should be"),
    expect: ['back to its original clamp'],
  },
  {
    name: 'the dead .m-crestrow rule is left behind after the crest goes',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '/* Anyone who has asked their OS to cut animation',
      '.m-crestrow{flex-direction:column}\n/* Anyone who has asked their OS to cut animation'),
    expect: ['dead .m-crestrow rule is still gone'],
  },
  {
    /* The rule that pointed at itself. Netlify DROPS a self-referential
       redirect, so the 404 was never applied and the file was served with a
       plain 200 for months while the comment above it said otherwise. */
    name: 'the /tests/* 404 rule points at itself again, so Netlify drops it',
    suite: 'test-about-board.js',
    apply: () => patch('netlify.toml', '  from = "/tests/*"\n  to = "/404.html"',
      '  from = "/tests/*"\n  to = "/tests/:splat"'),
    expect: ['target is NOT itself'],
  },
  {
    name: 'the /tools/* 404 rule loses its 404 status',
    suite: 'test-about-board.js',
    apply: () => patch('netlify.toml', '  from = "/tools/*"\n  to = "/404.html"\n  status = 404',
      '  from = "/tools/*"\n  to = "/404.html"\n  status = 200'),
    expect: ['it returns 404'],
  },

  /* ---- the master manager code's key name (test-accounts.js, 5 Aug 2026) ----

     A documentation bug that failed CLOSED and so could never announce itself:
     both setup instructions said to call the master key "admin", while the
     all-groups test in _auth.js is `ageGroupId === '*'`. Following the docs
     minted a manager scoped to a group that does not exist. */
  {
    name: 'the setup comment goes back to offering "admin" as the master key',
    suite: 'test-accounts.js',
    apply: () => patch(path.join('netlify', 'functions', 'manager-signup.js'),
      '..., "*":"quins-master-2026"}', '..., "admin":"quins-master-2026"}'),
    expect: ['no longer offers "admin"'],
  },
  {
    /* The other direction: the sentinel moves and the instruction does not. */
    name: 'the all-groups sentinel in _auth.js stops being an asterisk',
    suite: 'test-accounts.js',
    apply: () => patch(path.join('netlify', 'functions', '_auth.js'),
      "session.ageGroupId === '*'", "session.ageGroupId === 'admin'"),
    expect: ['sentinel in _auth.js is a literal asterisk'],
  },
  {
    /* And the anchor that makes the two above mean anything. */
    name: 'the age group stops being derived from the matched key name',
    suite: 'test-accounts.js',
    apply: () => patch(path.join('netlify', 'functions', 'manager-signup.js'),
      'const ageGroupId = Object.keys(codes).find((id) => codes[id] === inviteCode);',
      'const ageGroupId = (event.headers && event.headers["x-age-group"]) || null;'),
    expect: ['derives the age group from the matched KEY NAME'],
  },

  /* ---- doc claims that give instructions (test-doc-claims.js) ------------
     A wrong sentence in CLAUDE.md does not fail, does not error, and is only
     discovered by somebody acting on it. Five have been found this way. These
     faults are the only thing standing between the corrections and a quiet
     revert. */

  {
    /* THE ONE THIS SUITE WAS BUILT FOR. Restoring the false advice as live
       text, by demoting its tombstone marker. The SENTENCE IS UNCHANGED — only
       its context moves — which is precisely why presence and absence checks
       both pass here and only the position check catches it. */
    name: 'the false "look at branch builds for credits" advice is restored as live text',
    suite: 'test-doc-claims.js',
    apply: () => patch('CLAUDE.md', 'THIS PARAGRAPH USED TO END', 'Worth remembering'),
    expect: ['sits INSIDE its tombstone, not standing as advice'],
  },
  {
    /* The quieter revert: keep the tombstone, delete the reasoning. A verdict
       with no argument behind it gets overturned by the next person who
       re-derives the wrong answer from the same true premise. */
    name: 'the tombstone keeps the verdict but loses the reason',
    suite: 'test-doc-claims.js',
    apply: () => patch('CLAUDE.md', 'A branch build\ncannot move the credit number, because it does not cost any.',
      'This is no longer accurate.'),
    expect: ['with the reason, not just the verdict'],
  },
  {
    /* The figure itself going wrong. */
    name: 'a branch deploy is documented as costing credits after all',
    suite: 'test-doc-claims.js',
    apply: () => patch('CLAUDE.md', '| **Branch deploy / Deploy Preview** | **0 — free** |',
      '| **Branch deploy / Deploy Preview** | **15 each** |'),
    expect: ['recorded as costing ZERO, explicitly'],
  },
  {
    /* ⚠️ THE DRIFT FAULT, and the reason those two checks are DERIVED rather
       than pinned to 15. This edits ONE of the two copies of the production
       cost. A pair of checks that each asserted "15" would both still pass on
       the other copy and report green while the file contradicted itself. */
    name: 'the two copies of the production deploy cost drift apart',
    suite: 'test-doc-claims.js',
    apply: () => patch('CLAUDE.md', '| **Production deploy** | **15 each** |',
      '| **Production deploy** | **10 each** |'),
    expect: ['two copies of the production cost agree'],
  },
  {
    /* Overclaiming in the other direction: "free" with nothing qualifying it.
       Bandwidth and requests ARE metered, and a correction that quietly
       overstates its case is the next thing somebody has to correct. */
    name: 'the credit correction drops the meters that are NOT free',
    suite: 'test-doc-claims.js',
    apply: () => patch('CLAUDE.md', 'Compute is 10 credits per GB-hour, bandwidth 20 per GB',
      'Nothing else is metered'),
    expect: ['so "free" is not overclaimed'],
  },
  {
    /* The security half. Losing this turns a live finding back into tidiness. */
    name: 'the warning that a branch deploy outlives its branch is tidied away',
    suite: 'test-doc-claims.js',
    apply: () => patch('CLAUDE.md', 'AND A BRANCH DEPLOY OUTLIVES ITS BRANCH', 'A note on branch deploys'),
    expect: ['warning is recorded'],
  },
  {
    /* Keeping the warning but dropping WHY it matters — which is the only part
       that distinguishes "untidy" from "the production rate limit is
       bypassable by changing the hostname". */
    name: 'the branch-deploy warning loses the fact that it reads production data',
    suite: 'test-doc-claims.js',
    apply: () => patch('CLAUDE.md', 'read the SAME environment variables and the SAME Blobs stores as\nproduction',
      'run in their own context'),
    expect: ['same env vars and the same stores as production'],
  },
  {
    /* Recording a partial fix as a fix is how the next person stops looking. */
    name: 'restricting branch deploys to dev is written up as if it closed the hole',
    suite: 'test-doc-claims.js',
    apply: () => patch('CLAUDE.md', 'Restricting branch\ndeploys to `dev` stops the NEXT one; it does not retract one already published.',
      'Restricting branch deploys to `dev` fixes this.'),
    expect: ['not retracting what is published'],
  },
  {
    /* The measurement lesson. Deleting this is how the same false all-clear
       gets reported again. */
    name: 'the no-baseline lesson is dropped from the doc',
    suite: 'test-doc-claims.js',
    apply: () => patch('CLAUDE.md', '**A 404 with no before-reading proves nothing.**',
      'Check the URL afterwards.'),
    expect: ['no-baseline trap is recorded'],
  },
  {
    /* The source. A figure nobody can re-check is how the 401 test survived
       the password being switched off. */
    name: 'the credit figures lose their source link',
    suite: 'test-doc-claims.js',
    apply: () => patch('CLAUDE.md', 'https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/',
      '(from the Netlify pricing page)'),
    expect: ['cite Netlify'],
  },
  /* ---- the Compare branch: crest + bat restored, red glow ---------------
     These faults exist because this branch REVERSES two live assertions. A
     reversed check that nobody breaks on purpose is a check nobody has proven,
     and the two failure modes here both render perfectly and look finished. */

  {
    /* ⚠️ THE ONE THAT SHIPPED FOR REAL, in the other direction. crest.png has a
       bat printed on it; with the flying bat present that is TWO bats, one of
       them motionless. Nothing errors. */
    name: 'the About badge becomes the complete crest, putting two bats on screen',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '<img class="cbase" src="assets/crest-shield.png"',
      '<img class="cbase" src="assets/crest.png"'),
    expect: ['it is the SHIELD, the one with the bat-shaped hole'],
  },
  {
    /* ⚠️ AND THE MIRROR OF IT — the bug that DID go live on 5 Aug. Remove the
       bat and the shield is a crest with a hole in it, sitting there looking
       like artwork until somebody notices. This is why the pairing is asserted
       both ways rather than just "is the shield present". */
    name: 'the bat is removed but the holed shield is left behind',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '<div class="cf"><div class="cfl"><img class="bflat" src="assets/crest-bat.png" alt=""><img class="breal" src="assets/crest-bat-real.png" alt=""></div></div>', ''),
    expect: ['stand or fall together'],
  },
  {
    /* ⚠️ THE BOOT BUG, INJECTED. Swapping the re-scan for the find-it-once
       pattern the mothballed script used. Works from a local file, dead on the
       deployed site — the exact bug the photo board shipped with. */
    name: 'the bat script reverts to the find-it-once boot that is dead when deployed',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'var t=setInterval(function(){ scan(); if(++tries>40) clearInterval(t); },500);',
      'var mo=new MutationObserver(function(){ scan(); mo.disconnect(); }); mo.observe(document.documentElement,{childList:true,subtree:true});'),
    expect: ['RE-SCANS rather than finding the element once'],
  },
  {
    /* The other half of the same lesson: a flag set on entry marks a
       half-built element as done and the re-scan skips it for ever. */
    name: 'the armed flag goes back to being set on entry',
    suite: 'test-about-board.js',
    /* ⚠️ THE EXPECTATION MOVED, AND THAT IS THE FINDING. This was first
       expected to trip "set AFTER the observer is attached" — and it does not,
       because adding an assignment on entry leaves the later one in place and
       the position check still matches. The prover reported "caught, WRONG
       CHECK", which is exactly the distinction it exists to make: the fault was
       caught, but by luck rather than by the check claiming to guard it. The
       count check is the one that actually discriminates. */
    apply: () => patch(HOME, '      if(host.__armed) return;\n', '      if(host.__armed) return;\n      host.__armed=1;\n'),
    expect: ['assigned exactly once'],
  },
  {
    /* ⚠️ THE SILENT ONE. Losing the clip does not break the animation — it
       adds a horizontal scrollbar to the whole page when the bat is at the far
       end of its flight, and nothing anywhere reports it. */
    name: 'the flight path stops being clipped, so the bat can scroll the page sideways',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '.cstage{position:absolute;top:-30px;left:-30px;width:calc(100% + 30px);height:calc(100% + 30px);overflow:hidden;pointer-events:none;z-index:6}',
      '.cstage{position:absolute;top:-30px;left:-30px;width:calc(100% + 30px);height:calc(100% + 30px);pointer-events:none;z-index:2}'),
    expect: ['clipped by .cstage'],
  },
  {
    /* Freezing is not hiding: parked mid-flight the bat sits out over the
       photos looking like a stray image. */
    name: 'reduced motion freezes the bat mid-flight instead of hiding it',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '.crest-anim .cf,.crest-anim .cfl,.crest-anim .breal{animation:none;opacity:0}',
      '.crest-anim .cf,.crest-anim .cfl,.crest-anim .breal{animation:none}'),
    expect: ['by hiding, not just by freezing mid-flight'],
  },
  {
    /* ⚠️ THE DRIFT FAULT for the glow, and the reason that check is DERIVED.
       This moves the rules button to a DIFFERENT red — still red, still not
       green, so a check asserting "is it reddish" would pass. Only requiring
       it to equal Register-a-team's own value catches it. */
    name: 'the rules button drifts to its own red instead of the brand one',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'class="reg-btn rules-btn" style="--glow:#E11B22',
      'class="reg-btn rules-btn" style="--glow:#C41230'),
    expect: ['SAME red as Register a team'],
  },
  {
    /* And the straight revert, back to the green Jay asked to change. */
    name: 'the rules button glow reverts to green',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'class="reg-btn rules-btn" style="--glow:#E11B22',
      'class="reg-btn rules-btn" style="--glow:#17A34A'),
    expect: ['NOT the Register-player green'],
  },

  /* ---- the condense loop, the bat cadence, the two drop-downs ------------ */

  {
    /* ⚠️ THE BUG ITSELF, PUT BACK. One threshold instead of two is the whole
       fault: the bar's own 18px height change then carries scrollY back across
       it, via the browser's scroll anchoring, once per frame for ever. */
    name: 'the condensing bar goes back to a single threshold and self-oscillates',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'var TIGHT_OFF = 56;', 'var TIGHT_OFF = 90;'),
    expect: ['gap is wider than the height change'],
  },
  {
    /* ⚠️ THE HALF FIX, which is the one somebody would actually write. Both
       constants stay, so a check that merely counted them passes — but the
       condition only reads one, so the loop is entirely back. */
    name: 'both thresholds are declared but the condition only uses one',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'var wanttight = (tight === null) ? (y > TIGHT_ON)\n                      : (tight ? (y > TIGHT_OFF) : (y > TIGHT_ON));',
      'var wanttight = y > TIGHT_ON;'),
    expect: ['condition actually reads BOTH thresholds'],
  },
  {
    /* A gap narrower than the 18px the header actually moves. Still two
       thresholds, still hysteresis-shaped, still broken. */
    name: 'the hysteresis gap is narrowed below the header height change',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'var TIGHT_OFF = 56;', 'var TIGHT_OFF = 78;'),
    expect: ['gap is wider than the height change'],
  },
  {
    /* ⚠️ THE DRIFT FAULT for the bat, and why the durations are compared to
       each other rather than to 30. One animation left behind means the wings
       flap while the bat is parked on the crest. */
    name: 'the wing flap is left on the old clock while the flight slows down',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'animation:batflap 30s', 'animation:batflap 13s'),
    expect: ['flight and the wing flap run on the same clock'],
  },
  {
    /* ⚠️ "LONGER" IS NOT "LESS OFTEN". This stretches the ORIGINAL 13s
       keyframes over 30s: the duration check passes, all three agree, and the
       bat drifts across the screen in slow motion for the whole cycle. Only
       the dead-air check catches it. */
    name: 'the bat is slowed to a crawl instead of flying less often',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '18.633%{transform:translate(0%,0%) rotate(0deg) scale(1)}100%{transform:translate(0,0) rotate(0deg) scale(1)}',
      '43%{transform:translate(0%,0%) rotate(0deg) scale(1)}80%{transform:translate(300%,-18%) rotate(16deg) scale(0.9)}100%{transform:translate(0,0) rotate(0deg) scale(1)}'),
    expect: ['home well before the cycle ends'],
  },
  {
    /* The obvious wrong instinct, and it renders as nothing at all. */
    name: 'the desktop menu is given a transition instead of an animation',
    suite: 'test-about-board.js',
    /* ⚠️ ANCHOR REPOINTED — it carried the .18s timing that was replaced when
       the animation was made perceptible. A fault that cannot be injected is a
       failed run, not a pass. */
    apply: () => patch(HOME, '.hdr-menu-panel{animation:hdrMenuIn .42s cubic-bezier(.16,1,.3,1) both;transform-origin:top right}',
      '.hdr-menu-panel{transition:opacity .42s ease,transform .42s ease;transform-origin:top right}'),
    expect: ['animates rather than transitions'],
  },
  {
    /* The class comes off the markup and the CSS is orphaned - nothing errors,
       the menu just opens flat again. */
    name: 'the desktop panel loses the class that drives its animation',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '<div onClick="{{ closeMenu }}" class="hdr-menu-panel"', '<div onClick="{{ closeMenu }}"'),
    expect: ['carries the class that drives it'],
  },
  {
    /* ⚠️ THE ONE THAT HURTS DESKTOP. Moving the animation off the open-state
       selector onto .hdr-nav makes the nav re-run it every time the engine
       re-renders the header - which it does after first paint, more than once
       - so a desktop that never opens this panel gets a flickering nav. */
    name: 'the phone panel animation is moved onto .hdr-nav and fires on every re-render',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '  .hdr-nav{gap:2px!important}', '  .hdr-nav{gap:2px!important;animation:hdrPanelIn .2s ease-out both}'),
    expect: ['scoped to the OPEN attribute'],
  },
  {
    /* ⚠️ `both` holds the FROM state. Killing the animation without resetting
       opacity and transform leaves the panel invisible and shifted - a menu
       that never opens, for exactly the people who asked for less motion. */
    /* ⚠️ REPOINTED. The old fault removed an `opacity:1!important` that no
       longer exists — the reduced-motion path is a fade now, not a snap. The
       rule it guards is unchanged: somebody who asked for less motion must
       still SEE the menu open. This restores the version Jay could not see. */
    name: 'reduced motion goes back to killing the animation outright',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '      animation:hdrFadeOnly .2s ease both!important;transform:none!important}',
      '      animation:none!important;opacity:1!important;transform:none!important}'),
    expect: ['appear — as a fade'],
  },
  {
    /* ⚠️ THE FAULT THAT MATTERS MOST HERE: back to the timing Jay could not
       see. It runs, it completes, every other check in the block passes, and
       the feature is not there as far as a human is concerned. */
    name: 'the menu animation is shortened back to a duration nobody can perceive',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '.hdr-menu-panel{animation:hdrMenuIn .42s', '.hdr-menu-panel{animation:hdrMenuIn .18s'),
    expect: ['long enough to be seen'],
  },
  {
    /* The other half: keep the duration, shrink the travel to the 8px that was
       invisible. Duration checks pass; nothing moves enough to notice. */
    name: 'the panels travel 8px again, which reads as no movement',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '@keyframes hdrPanelIn{from{opacity:0;transform:translateY(-20px)}',
      '@keyframes hdrPanelIn{from{opacity:0;transform:translateY(-4px)}'),
    expect: ['travel far enough to register'],
  },
  {
    /* And the opposite failure: so long that a header re-render lands in the
       middle of it and the open visibly stutters. */
    name: 'the open animation is stretched long enough for a re-render to interrupt it',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '.hdr-menu-panel{animation:hdrMenuIn .42s', '.hdr-menu-panel{animation:hdrMenuIn 1.2s'),
    expect: ['long enough to be interrupted by a re-render'],
  },
  {
    /* ⚠️ The other half of the reduced-motion rule: keep the fade but let the
       movement back in. That is the actual accessibility failure — somebody
       who asked not to be moved gets slid 22px anyway — and it renders
       perfectly, so nothing else would catch it. */
    name: 'reduced motion keeps the fade but lets the movement back in',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '@keyframes hdrFadeOnly{from{opacity:0}to{opacity:1}}',
      '@keyframes hdrFadeOnly{from{opacity:0;transform:translateY(-22px)}to{opacity:1;transform:none}}'),
    expect: ['fade keyframe moves nothing at all'],
  },
  {
    /* Animating height would move the sticky header mid-animation - which is
       the feedback loop this same commit fixed, arriving by another door. */
    name: 'the open animation is changed to move height instead of transform',
    suite: 'test-about-board.js',
    /* ⚠️ ANCHOR REPOINTED — the travel distance changed from 6px to 14px when
       the animation was made perceptible. */
    apply: () => patch(HOME, '@keyframes hdrPanelIn{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:none}}',
      '@keyframes hdrPanelIn{from{opacity:0;height:0}to{opacity:1;height:auto}}'),
    expect: ['opacity and transform only'],
  },

  /* ---- the coverflow carousel (6 Aug 2026) ------------------------------ */

  {
    /* ⚠️⚠️ THE MOST DANGEROUS EDIT ON THE PAGE. The box is sized to finish
       exactly at the viewport edge; a bleed that overshoots puts a horizontal
       scrollbar on EVERY page of the site, and it is invisible until somebody
       happens to look at the right width. This is the "tidied into a round
       number" version. */
    name: 'the bleed is simplified to a fixed value and overshoots the viewport',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'margin-right: calc(-1 * max(32px, (100vw - var(--sbw, 0px)) / 2 - 568px));',
      'margin-right: -200px;'),
    expect: ['bleeds to the right edge with the derived formula'],
  },
  {
    /* The other half: the formula stays, and the section it was derived FROM
       moves. Nothing about the bleed line looks wrong; it is simply now
       describing a section that no longer exists. */
    name: 'the section is re-proportioned without the bleed formula following it',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'max-width:1200px;margin:0 auto;padding:100px 32px;display:grid;grid-template-columns:1fr 1fr;gap:70px',
      'max-width:1320px;margin:0 auto;padding:100px 48px;display:grid;grid-template-columns:1fr 1fr;gap:70px'),
    expect: ['still 1200px wide with 32px padding'],
  },
  {
    /* ⚠️ THE 8px THAT SHIPPED. Dropping the scrollbar term is the "simpler"
       version of this line and it overshoots the content edge by half a
       scrollbar on every Windows browser - invisible locally, because headless
       Chromium has overlay scrollbars, and invisible live because an ancestor
       clips it. */
    name: 'the bleed stops subtracting the scrollbar and overshoots by half of it',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'max(32px, (100vw - var(--sbw, 0px)) / 2 - 568px)', 'max(32px, 50vw - 568px)'),
    expect: ['with the scrollbar subtracted'],
  },
  {
    /* The formula stays and the number it needs stops arriving. */
    name: 'the scrollbar width stops being published to the CSS',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "    window.addEventListener('resize', sbw, {passive:true});\n    window.addEventListener('load', sbw);", ''),
    expect: ['recomputed on resize'],
  },
  {
    /* ⚠️ THE SECOND HALF OF THE SAME BUG, AND THE ONE THAT SHIPPED. The
       measurement is taken, once, before the page is long enough to have a
       scrollbar - so it publishes 0 and never corrects. Everything else about
       the line is right and the overshoot is fully back. */
    name: 'the scrollbar is measured once and a stale 0 is never corrected',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "      try{ new ResizeObserver(sbw).observe(document.documentElement); }catch(e){}", ''),
    expect: ['a first measurement of 0 sits there for ever'],
  },
  {
    name: 'the right-hand corners are rounded again, against the edge of the screen',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'border-radius:18px 0 0 18px;', 'border-radius:18px;'),
    expect: ['right-hand corners are square'],
  },



  {
    /* ⚠️ THE BUG THIS SUITE ACTUALLY CAUGHT WHILE BEING WRITTEN. slotof()
       folds into -1..CARDS-2, so CARDS-2+1 is a slot that cannot occur and
       restock() never fires: the carousel shows the same six photos for ever
       and the other five never appear. Nothing errors, nothing looks broken,
       and you would only notice by counting. */
    name: 'restocking targets a slot that cannot occur, so five photos never appear',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '        var STAGE = CARDS - 2;', '        var STAGE = CARDS - 2 + 1;'),
    expect: ['restocks at the staging slot, not one past it'],
  },
  {
    /* The staging slot is only safe to repoint in because nobody can see it. */
    name: 'the staging slot gains opacity, so photos visibly flip on the far side',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "op:0.00, away:1.0, zi:7 }", "op:0.30, away:1.0, zi:7 }"),
    expect: ['staging slot is fully transparent'],
  },
  {
    /* A slot with no row keeps whatever transform it last had and parks itself
       on top of the hero - and it renders perfectly. */
    name: 'a slot loses its row in the table and a card parks on top of the hero',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "      '3':  { x: 1.62, ry:-58, z:-400, sc:0.72, op:0.32, away:0.8, zi:8 },\n", ''),
    expect: ['every slot from -1 upwards has a row in the table'],
  },
  {
    /* Past 90 a card is edge-on; past 180 Chrome stops painting it at all,
       which is how the ring lost its entire left-hand side. */
    name: 'a card is rotated past 90 degrees, where Chrome stops painting it',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, "'3':  { x: 1.62, ry:-58,", "'3':  { x: 1.62, ry:-118,"),
    expect: ['rotated past 90'],
  },
  {
    /* ⚠️ REDUCED MOTION MUST STOP THE AUTO-ADVANCE AND NOTHING ELSE. This
       removes the gate, so somebody who asked for less motion gets a carousel
       turning on its own every six seconds. */
    /* ⚠️ THE FAULT THIS SECTION EXISTS FOR, AND IT IS THE VERSION THAT WAS
       CORRECT UNTIL THE ARROW KEYS WENT. Putting reduced motion back in the
       gate looks like an accessibility improvement and is the opposite: with
       no controls left, it strands that visitor on photo 1 for ever and the
       section silently becomes one static image. */
    name: 'reduced motion is put back in the gate and strands the visitor on photo 1',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '          if(!onscreen||document.hidden)return;',
      "          var slowmo = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;\n          if(slowmo||!onscreen||document.hidden)return;"),
    expect: ['reduced motion is NOT in the auto-advance gate'],
  },
  {
    /* And the other half: the cut is what makes keeping the timer defensible.
       Lose it and a reduced-motion visitor gets the full 600ms glide. */
    name: 'the glide is no longer cut short under reduced motion',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '  .jrtb-p{transition-duration:1ms}', '  .jrtb-p{transition-duration:600ms}'),
    expect: ['drops the glide to a cut instead'],
  },
  {
    name: 'the record of why reduced motion keeps advancing is tidied away',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'a visitor on photo 1 FOR EVER', 'a visitor on photo 1 briefly'),
    expect: ['the reasoning survives'],
  },
  {
    /* A focusable element with nothing to operate is a dead stop in the tab
       order — worse than no focus at all. */
    name: 'the scene becomes focusable again with nothing left to operate',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '          <div class="jrtb-scene">', '          <div class="jrtb-scene" tabindex="0">'),
    expect: ['not focusable, so it is not a dead stop'],
  },

  {
    /* ⚠️ THE TOMBSTONE, not tidiness. Drag was removed on 6 Aug and
       touch-action:pan-y went with it — correctly, since there is no gesture
       left to steal. But if drag ever returns and that rule does not return
       WITH it, a horizontal drag swallows vertical scrolling and traps a
       finger inside the box, invisibly on any desktop. The note is the only
       thing standing between the next person and repeating it. */
    name: 'the warning about what drag took with it is tidied away',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'IF DRAG EVER COMES BACK, THIS COMES BACK IN THE SAME CHANGE', 'It was removed'),
    expect: ['note about what drag took with it survives'],
  },
  {
    /* CSS that selects nothing reads as if something still uses it, and the
       next person keeps it alive on that basis. */
    name: 'the dead .dragging rule is left behind after the drag goes',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '.jrtb-p img{width:100%;height:100%;object-fit:cover;display:block;',
      '.jrtb.dragging .jrtb-p{transition:none}\n.jrtb-p img{width:100%;height:100%;object-fit:cover;display:block;'),
    expect: ['nothing is left behind pointing at a drag'],
  },



  {
    /* Stacked, the box is already full width; a negative right margin there
       pushes it past the screen edge on every phone. */
    name: 'the stacked layout keeps the bleed and overflows every phone',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '--focal:50%;margin-right:0;border-radius:12px}', '--focal:50%;border-radius:12px}'),
    expect: ['cancels the bleed'],
  },

  /* ---- the three-sided border and the single flight (6 Aug 2026) -------- */

  {
    /* The whole point of the ask: no line hanging in the scrollbar gutter. */
    name: 'the gradient border grows a fourth side, on the edge that runs off screen',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '  padding:3px 0 3px 3px;', '  padding:3px;'),
    expect: ['NO band on the right'],
  },
  {
    /* ⚠️ VERY VISIBLE, AND NOTHING WOULD FAIL. Without the composite the
       gradient is not a border at all — it fills the box and the photos
       disappear behind a coloured slab. */
    name: 'the mask composite goes and the gradient fills the whole box',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '  mask-composite:exclude;\n}', '}'),
    expect: ['masked so only the band survives'],
  },
  {
    /* border-image is the obvious one-liner and it cuts a square corner across
       the 18px rounding. */
    name: 'the border stops following the rounded corner',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '  border-radius:inherit;\n  padding:3px 0 3px 3px;', '  padding:3px 0 3px 3px;'),
    expect: ['following the rounded corner'],
  },
  {
    /* ⚠️⚠️ THE LAYERING FAULT, AND THE ONE WORTH THE MOST. Removing
       isolation:isolate lets the border's z-index 50 escape into the page's
       stacking context, where it beats the crest at 6 — so the border paints
       OVER the Quins logo, which is the exact thing Jay asked to prevent. The
       numbers still look sensible; only the context changed. */
    name: 'the photo box stops isolating and the border paints over the crest',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '  isolation:isolate;\n}', '}'),
    expect: ['isolates its own stacking context'],
  },
  {
    /* And the mirror: the crest dropped below the box. */
    name: 'the crest is dropped behind the photo box',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'pointer-events:none;z-index:6}', 'pointer-events:none;z-index:0}'),
    expect: ['crest outranks the whole box'],
  },
  {
    /* A border under the cards is a border you see flicker as they swing past. */
    name: 'the border drops below the carousel cards',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'inset:0;z-index:50;pointer-events:none;', 'inset:0;z-index:2;pointer-events:none;'),
    expect: ['outranks every carousel card'],
  },
  {
    name: 'the bat goes back to looping for ever',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'animation:batfly 30s cubic-bezier(.45,.05,.4,1) .5s 1 forwards',
      'animation:batfly 30s cubic-bezier(.45,.05,.4,1) .5s infinite'),
    expect: ['none of them loops'],
  },
  {
    /* ⚠️ ONE LEFT LOOPING IS WORSE THAN ALL THREE: wings flapping on a bat that
       has landed. */
    name: 'the wing flap keeps looping after the flight has stopped',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, 'animation:batflap 30s ease-in-out .5s 1 forwards',
      'animation:batflap 30s ease-in-out .5s infinite'),
    expect: ['none of them loops'],
  },
  {
    /* Looks fine today only because 0% and 100% happen to agree. */
    name: 'the bat stops holding its final frame',
    suite: 'test-about-board.js',
    apply: () => patch(HOME, '.5s 1 forwards;animation-play-state:paused}\n  .crest-anim .cfl',
      '.5s 1;animation-play-state:paused}\n  .crest-anim .cfl'),
    expect: ['holds its final frame'],
  },

  {
    /* ⚠️ THE COVER FAULT. Section 5 asserts the FOUR earlier corrections that
       had nothing holding them in place. This re-introduces the dead preview
       host as a live instruction — the exact bug that cost a round of 404s —
       while leaving its tombstone elsewhere intact, so a naive "is the dead
       host mentioned" check passes. Only the per-mention flag test catches it. */
    name: 'the dead preview host creeps back as a live instruction',
    suite: 'test-doc-claims.js',
    apply: () => patch('CLAUDE.md', '### 5. The tests',
      'Preview a branch at https://<branch>--serene-gingersnap-1d0eb6.netlify.app\n\n### 5. The tests'),
    expect: ['every mention of the dead host is flagged as dead'],
  },
];

/* ------------------------------------------------------------------------ */

let clean = 0, proven = 0;
const problems = [];

/* ⚠️ DERIVED FROM THE FAULTS, NOT WRITTEN OUT — changed 3 Aug 2026, after a
   new suite silently skipped its own baseline.

   This was a hardcoded list, a second explicit list beside runall.ps1's, and
   a new test file did not join it by itself. That is not a tidiness problem.
   The baseline is the thing that makes every "caught" below mean anything: a
   suite that fails on an UNDAMAGED copy fails for every fault too, so all of
   its faults report caught while proving nothing. test-signup-ratelimit.js
   arrived with seven faults and no baseline entry, and the run said
   381/381 — the count that was supposed to be reassuring.

   Deriving it means the two lists cannot drift: every suite any fault names
   is baselined, always. The floor below is the hardcoded half — a derived
   list that quietly became empty would otherwise report zero problems and a
   clean bill of health. */
const BASELINE = [...new Set(FAULTS.map((f) => f.suite))].sort();

console.log('Baseline — the suites must pass on an undamaged copy first.\n');
seed();
if (BASELINE.length < 20) problems.push(`the baseline list collapsed to ${BASELINE.length} suite(s) — it should cover every suite the faults name`);
BASELINE.forEach((f) => {
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
