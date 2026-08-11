/* tests/test-draft-visibility.js
   ---------------------------------------------------------------------------
   Managers and organisers can see an unpublished draw. Spec:
   claude/specs/spec-draft-visibility-aug-2026.md.

   THE FAULT THIS GUARDS. getDraw() took a session and served the DRAFT, so the
   fixture editor always worked. getFixtures(), getStandings() and
   getSpiritAward() did not take one at all, so every OTHER view of the same
   draw asked as the public and came back "not published yet" — to the manager
   who had just built it. The score sheet's match list is built from the same
   fetch, so no score could be entered for an unpublished age group either.

   ⚠️ WHY THIS FILE DRIVES THE REAL FUNCTIONS RATHER THAN READING THE SOURCE.
   A source check that finds `getFixtures(agId, session)` proves the session is
   PASSED and nothing whatever about whether the answer is used — a one-line
   fault that ignores it passes every such check ever written (claude/lessons.md,
   "calling the right function is not the same as using its answer"). So the
   sections below stub `fetch` and call the exported functions, asserting a
   value that ONLY the draft carries. The source checks at the bottom are there
   to catch a call site that was missed, which is the one thing driving a single
   function cannot see. */

const path = require('path');
const { section, check, eq, readRepo, repoRoot, summary } = require('./_lib');

async function loadScoresData() {
  const p = path.join(repoRoot(), 'scores-data.js').replace(/\\/g, '/');
  const url = p.startsWith('/') ? `file://${p}` : `file:///${p}`;
  return import(url);
}

/* ---------------------------------------------------------------------------
   A stubbed backend that BEHAVES LIKE get-schedule-override.js.

   ⚠️ THE FIRST VERSION OF THIS STUB RETURNED THE SAME ANSWER WHETHER OR NOT
   THE REQUEST ASKED FOR THE DRAFT, AND THE FAULT PROVER CAUGHT IT. Three faults
   went unnoticed or were caught by the wrong check — including a getFixtures
   that took the session and asked as the public anyway, which is the single
   most likely regression this file exists to stop. With a stub that always
   handed back the draft, "the draft reached the output" was true no matter what
   the code under test did. Textbook: a fixture that gives the same answer with
   and without the fault (claude/lessons.md).

   So this mirrors the endpoint's actual logic. The draft is handed out ONLY
   when the request carries `draft=1` AND an Authorization header AND the caller
   is allowed the group — exactly the three conditions the real handler checks
   before it reads the draft blob. Everything else falls through to the public
   answer, which is what the real one does too.

   Every response is real JSON, which matters: on a 404 or an unparseable body
   scores-data.js falls back to local-backend.js, and that reads
   document.baseURI and would die in Node with a message about the DOM rather
   than about this test. */
function installBackend({ draft = null, published = null, allowDraft = false }, results) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    const auth = !!(opts && opts.headers && opts.headers.Authorization);
    calls.push({ url: u, auth });
    if (!u.includes('get-schedule-override')) {
      return { status: 200, text: async () => JSON.stringify({ ok: true, results: results || {} }) };
    }
    const state = {
      published: !!published,
      publishedAt: null, publishedBy: null, managerCanPublishNow: false,
      awaitingPublication: !published,
    };
    /* The three conditions, in the same order as the real handler. */
    const body = (u.includes('draft=1') && auth && allowDraft)
      ? { ok: true, schedule: draft, isDraft: true, ...state }
      : { ok: true, schedule: published, isDraft: false, ...state };
    return { status: 200, text: async () => JSON.stringify(body) };
  };
  return calls;
}

/* A draft draw whose every field is recognisable, so "the draft reached the
   output" is a claim about CONTENT and not about a boolean. ⚠️ THE PITCH NAME
   AND THE POOL NAME EXIST NOWHERE ELSE IN THE REPO — the auto-generated draw
   uses real pitch ids (D5, C4 …) and pools named "Pool A". If the sample draw
   were served instead of this, every assertion below would fail on the value
   rather than passing on a shrug. */
const DRAFT_PITCH = 'DRAFTPITCH9';
const DRAFT_POOL = 'Draft Pool Zed';
const draftSchedule = () => ({
  pools: [{ id: 'A', name: DRAFT_POOL, teams: ['ADH1', 'ADH2', 'DUB1', 'DUB2'] }],
  slots: [
    { id: 'u14b:A:d1', poolId: 'A', home: 'ADH1', away: 'ADH2', startMins: 480, pitch: DRAFT_PITCH },
    { id: 'u14b:A:d2', poolId: 'A', home: 'DUB1', away: 'DUB2', startMins: 500, pitch: DRAFT_PITCH },
  ],
});

(async () => {
  const api = await loadScoresData();

  /* =======================================================================
     1. viewModeOf — the derivation itself, all four answers.
     ======================================================================= */
  section('viewModeOf derives the four view modes');
  {
    const f = api.viewModeOf;
    check('viewModeOf is exported from scores-data.js', typeof f === 'function');

    eq('a published copy, no draft rights → published',
      f({ isDraft: false, awaitingPublication: false, schedule: { pools: [] } }), 'published');
    eq('nothing published, no draft rights → none',
      f({ isDraft: false, awaitingPublication: true, schedule: null }), 'none');
    eq('draft rights AND a draft → draft',
      f({ isDraft: true, awaitingPublication: true, schedule: { pools: [] } }), 'draft');
    eq('draft rights, no draft saved → sample',
      f({ isDraft: true, awaitingPublication: true, schedule: null }), 'sample');

    /* ⚠️ THE AUTHORISATION CASE, AND IT IS THE REASON THE DISCRIMINATOR IS
       THE SERVER'S isDraft RATHER THAN "a session exists".
       get-schedule-override.js hands out isDraft ONLY when it verified the
       token and hasAgeGroupAccess() passed; a manager asking for somebody
       else's age group falls through to the published answer with isDraft
       false. So this shape — a real session, refused by the server — MUST read
       as 'none', not as a draft view.

       A client-side `!!session` test would put every manager into a draft view
       for all fifteen groups, with schedule empty because the server withheld
       it, i.e. a SAMPLE badge over placeholder clubs presented as that group's
       own work. ⚠️ And it would pass a hand-check by an organiser, who has
       access to everything and would never see the broken case. */
    eq('a session the server REFUSED the draft to → none, not draft',
      f({ isDraft: false, awaitingPublication: true, schedule: null }), 'none');
    eq('…and when that group IS published, they get the published view',
      f({ isDraft: false, awaitingPublication: false, schedule: { pools: [] } }), 'published');

    /* Defensive, because a failed fetch upstream can hand this a nullish
       state and "coming soon" is the safe answer. */
    eq('a missing state reads as none', f(null), 'none');
    eq('an undefined state reads as none', f(undefined), 'none');
  }

  /* =======================================================================
     2. getFixtures — driven, four ways, asserting CONTENT.
     ======================================================================= */
  section('getFixtures serves the draft to a session and nothing to the public');
  {
    // --- the public, with nothing published ---
    installBackend({ draft: draftSchedule(), published: null, allowDraft: true });
    const pub = await api.getFixtures('u14b');
    check('public + unpublished → awaitingPublication', pub.awaitingPublication === true);
    eq('public + unpublished → view none', pub.view, 'none');
    eq('public + unpublished → no pool matches', (pub.pool || []).length, 0);
    /* ⚠️ NOTE WHAT THAT JUST PROVED. A draft EXISTS and the backend WOULD hand
       it over — the public reader simply never asks, so it does not leak. That
       is a stronger claim than running it against an empty store, where "no
       fixtures" is true for the boring reason. */

    // --- a signed-in manager, draft served ---
    const calls = installBackend({ draft: draftSchedule(), published: null, allowDraft: true });
    const draft = await api.getFixtures('u14b', { token: 'tok' });
    eq('session + draft → view draft', draft.view, 'draft');
    check('session + draft → not awaitingPublication', !draft.awaitingPublication);
    check('session + draft → pool matches are returned', (draft.pool || []).length === 2,
      'got ' + (draft.pool || []).length);
    /* ⚠️ THE CONTENT ASSERTION. This is what a "the session was passed" check
       cannot make: the pitch and pool names come from the DRAFT and appear
       nowhere in the auto-generated draw, so this fails if the answer is
       thrown away and the sample used instead. */
    check('the DRAFT’s own pitch reached the output',
      (draft.pool || []).every((m) => m.pitch === DRAFT_PITCH),
      JSON.stringify((draft.pool || []).map((m) => m.pitch)));
    check('the DRAFT’s own pool name reached the output',
      (draft.pool || []).every((m) => m.poolName === DRAFT_POOL),
      JSON.stringify((draft.pool || []).map((m) => m.poolName)));
    /* The request itself: draft=1 AND a Bearer header. Both are needed — the
       endpoint checks the token before it looks at the flag. */
    const schedCall = calls.find((c) => c.url.includes('get-schedule-override'));
    check('the request asked for draft=1', !!schedCall && schedCall.url.includes('draft=1'),
      schedCall ? schedCall.url : 'no call');
    check('the request carried an Authorization header', !!schedCall && schedCall.auth);

    // --- a signed-in manager, no draft saved: the SAMPLE draw ---
    installBackend({ draft: null, published: null, allowDraft: true });
    const sample = await api.getFixtures('u14b', { token: 'tok' });
    eq('session + no draft → view sample', sample.view, 'sample');
    check('session + no draft → the auto draw is returned', (sample.pool || []).length > 0);
    check('the sample draw is NOT the draft’s content',
      (sample.pool || []).every((m) => m.pitch !== DRAFT_PITCH));

    /* --- the authorisation case, end to end. A real session, a draft that
       exists, and a backend that REFUSES this caller the draft. Must read
       exactly like the public. --- */
    installBackend({ draft: draftSchedule(), published: null, allowDraft: false });
    const refused = await api.getFixtures('u14b', { token: 'tok' });
    eq('a session the server refused → view none', refused.view, 'none');
    eq('a session the server refused → no fixtures leak', (refused.pool || []).length, 0);

    // --- published, with no session at all ---
    installBackend({ draft: null, published: draftSchedule(), allowDraft: false });
    const live = await api.getFixtures('u14b');
    eq('public + published → view published', live.view, 'published');
    check('public + published → the published draw is served', (live.pool || []).length === 2);
  }

  /* =======================================================================
     3. getStandings — the same four ways, again on content.
     ======================================================================= */
  section('getStandings serves the draft to a session and nothing to the public');
  {
    installBackend({ draft: draftSchedule(), published: null, allowDraft: true });
    const pub = await api.getStandings('u14b');
    check('public + unpublished → awaitingPublication', pub.awaitingPublication === true);
    eq('public + unpublished → view none', pub.view, 'none');
    eq('public + unpublished → no pools', (pub.pools || []).length, 0);
    eq('public + unpublished → no tables', Object.keys(pub.tables || {}).length, 0);

    installBackend({ draft: draftSchedule(), published: null, allowDraft: true });
    const draft = await api.getStandings('u14b', { token: 'tok' });
    eq('session + draft → view draft', draft.view, 'draft');
    check('session + draft → pools are returned', (draft.pools || []).length === 1);
    /* Content again: the pool NAME is the draft's, and a table was actually
       computed for it rather than an empty object handed back. */
    eq('the DRAFT’s pool name reached the standings', (draft.pools || []).map((p) => p.name), [DRAFT_POOL]);
    check('a table was computed for the draft’s pool',
      Array.isArray((draft.tables || {}).A) && draft.tables.A.length === 4,
      JSON.stringify(Object.keys(draft.tables || {})));

    installBackend({ draft: null, published: null, allowDraft: true });
    const sample = await api.getStandings('u14b', { token: 'tok' });
    eq('session + no draft → view sample', sample.view, 'sample');
    check('session + no draft → the auto draw’s pools are returned', (sample.pools || []).length > 0);

    installBackend({ draft: draftSchedule(), published: null, allowDraft: false });
    const refused = await api.getStandings('u14b', { token: 'tok' });
    eq('a session the server refused → view none', refused.view, 'none');
    eq('a session the server refused → no tables leak', Object.keys(refused.tables || {}).length, 0);
  }

  /* =======================================================================
     4. getSpiritAward inherits it, because it is derived from getFixtures.
     ======================================================================= */
  section('getSpiritAward threads the session through to getFixtures');
  {
    /* u16b is in SPIRIT_AWARD_AGE_IDS; the award is derived from getFixtures,
       so without the session the tally was empty for an unpublished group even
       to the manager who owns it. `totalMatches > 0` is the discriminating
       value — it is 0 on the public path and cannot be faked by the session
       merely being passed. */
    installBackend({ draft: draftSchedule(), published: null, allowDraft: true });
    const pub = await api.getSpiritAward('u16b');
    eq('public + unpublished → no matches counted', pub.totalMatches, 0);

    installBackend({ draft: draftSchedule(), published: null, allowDraft: true });
    const staff = await api.getSpiritAward('u16b', { token: 'tok' });
    check('session + draft → matches are counted', staff.totalMatches > 0, 'got ' + staff.totalMatches);
  }

  /* =======================================================================
     5. Every call site. What driving one function cannot see is a caller that
        was missed — and a caller that MUST NOT pass a session.
     ======================================================================= */
  section('the session is threaded at every call site, and withheld at the public ones');
  {
    const mgr = readRepo('Manager.dc.html');
    check('/manager getFixtures passes the session',
      mgr.includes('api.getFixtures(agId, session)'));
    check('/manager getStandings passes the session',
      mgr.includes('api.getStandings(agId, session)'));
    check('/manager getSpiritAward passes the session',
      mgr.includes('api.getSpiritAward(agId, session)'));
    /* ⚠️ THE DESTRUCTURE IS THE LOAD-BEARING LINE and it is asserted
       separately, because all three calls above can read perfectly while
       `session` is undefined in that scope — which is a silent revert to the
       public view, with no error anywhere.

       ⚠️ AND IT IS ANCHORED TO load() BY ITS FOLLOWING LINE, WHICH IT WAS NOT
       AT FIRST. `const { api, session } = this.state;` appears in more than one
       method of this file — loadDraw() has its own — so a bare search for that
       string passed happily while load()'s copy had been stripped back to
       `{ api }`. The fault prover caught it: the fault went in and nothing went
       red. `keepDraw` is unique to load(), so it is what pins this to the right
       method (claude/lessons.md, "an anchor shared by two call sites proves
       neither"). */
    check('/manager load() destructures session out of state',
      /const \{ api, session \} = this\.state;\s*\n\s*const keepDraw = this\.state\.drawDirty;/.test(mgr));

    const app = readRepo('app.html');
    /* Four sites: load(), loadFollowData(), and two in refresh(). Counted, not
       spot-checked — "everywhere X appears" needs the count written in, or a
       fifth call site added later is uncovered (claude/lessons.md, "both is
       not a number"). */
    const appSites = (app.match(/api\.get(?:Fixtures|Standings)\([^)]*S\.session[^)]*\)/g) || []).length;
    eq('/app passes S.session at all six of its fetch calls', appSites, 6);
    check('/app has no getFixtures call left without a session',
      !/api\.getFixtures\((?:agId|id|bid|aid)\)/.test(app));
    check('/app has no getStandings call left without a session',
      !/api\.getStandings\((?:agId|id|bid|aid)\)/.test(app));

    const org = readRepo('Organizer.dc.html');
    check('/organizer getFixtures passes the session',
      org.includes('api.getFixtures(agId, session)'));
    check('/organizer getStandings passes the session',
      org.includes('api.getStandings(agId, session)'));
    check('/organizer loadFixturesView destructures session out of state',
      /loadFixturesView\(agId\) \{[\s\S]{0,200}const \{ api, session \} = this\.state;/.test(org));

    /* ⚠️ AND THE PUBLIC PAGES MUST STAY BLIND. /scores is purely public and a
       parent must never see a draft; the homepage's getSchedule() has no
       session parameter at all. This is a NEGATIVE check, so it is paired with
       a positive one on the same file — an empty result is not proof of
       absence (claude/lessons.md). */
    const scores = readRepo('Scores & Standings.dc.html');
    check('CONTROL: /scores really does call getStandings', scores.includes('api.getStandings('));
    check('/scores calls getStandings with the age id ALONE',
      scores.includes('api.getStandings(selectedAgeId)'));
    check('/scores passes no session to getStandings',
      !/api\.getStandings\([^)]*session[^)]*\)/.test(scores));

    const home = readRepo('Quins JRT.dc.html');
    check('CONTROL: the homepage really does call getSchedule', home.includes('fxApi.getSchedule('));
    check('the homepage passes no session to getSchedule',
      !/getSchedule\([^)]*session[^)]*\)/.test(home));

    const sd = readRepo('scores-data.js');
    check('getSchedule() still takes the age id alone — it is the public path',
      /export async function getSchedule\(agId\) \{/.test(sd));
  }

  /* =======================================================================
     6. The marker. Three surfaces carry the same two sentences.
     ======================================================================= */
  section('the unpublished marker says the same thing on all three surfaces');
  {
    const mgr = readRepo('Manager.dc.html');
    const app = readRepo('app.html');
    const org = readRepo('Organizer.dc.html');

    const DRAFT_TITLE = 'Draft — not published';
    const SAMPLE_TITLE = 'Sample draw — not real fixtures';

    [['Manager.dc.html', mgr], ['app.html', app], ['Organizer.dc.html', org]].forEach(([name, src]) => {
      check(name + ' carries the draft title', src.includes(DRAFT_TITLE));
      check(name + ' carries the sample title', src.includes(SAMPLE_TITLE));
      /* ⚠️ THE WORDING IS THE GUARD, NOT THE COLOUR. The sample view renders
         the auto-generated draw, whose team names are INVENTED — and while the
         real draw is outstanding that is what most age groups return. An amber
         edge cannot say that, so the sentence has to, and it is asserted. */
      check(name + ' says the sample team names are invented',
        /team names are invented/.test(src));
      check(name + ' says the public cannot see the sample draw',
        /Nothing here is visible to the public/.test(src));
    });

    /* ⚠️ A marker that renders for a PUBLISHED draw would tell every parent on
       /app that real fixtures are a draft. app.html's viewNote() is the only
       one of the three that runs on a public page, so its early return is
       asserted by shape rather than by hoping. */
    check('app.html viewNote() returns nothing for any mode but draft/sample',
      /function viewNote\(view\)\{\s*\n\s*if \(view !== 'draft' && view !== 'sample'\) return '';/.test(app));
  }

  /* =======================================================================
     7. The /organizer tab is READ-ONLY, and that is a claim worth pinning.
     ======================================================================= */
  section('the /organizer Fixtures & tables tab writes nothing');
  {
    const org = readRepo('Organizer.dc.html');

    check('organizer-data.js re-exports getFixtures, getStandings and teamShort',
      /export \{ getFixtures, getStandings, teamShort \} from '\.\/scores-data\.js';/
        .test(readRepo('organizer-data.js')));
    check('the tab button exists', org.includes('onClick="{{ showFixturesView }}"'));
    check('the tab panel exists', org.includes('value="{{ isFixturesView }}"'));

    /* The panel's markup, sliced between its own opening comment and the venue
       tab that follows it, then stripped of comments — this repo documents the
       traps it avoids, so an absence check on raw source matches its own
       warnings (claude/lessons.md, fourth time). */
    const a = org.indexOf('<!-- Fixtures & tables tab');
    const b = org.indexOf('<!-- venue & days tab', a);
    check('the panel was found', a > -1 && b > a);
    const panel = org.slice(a, b).replace(/<!--[\s\S]*?-->/g, '');
    check('CONTROL: the panel really does contain the age selector',
      panel.includes('onChange="{{ onFxvAge }}"'));
    ['saveDraw', 'publishDraw', 'unpublishDraw', 'submitResult', 'clearResult', 'onSave', 'onPublish']
      .forEach((w) => check('the panel does not call ' + w, !panel.includes(w)));

    /* The loader re-checks the age id after its await, the same guard
       loadDraw() on /manager needs and for the same reason: the selector stays
       live while the fetch is in flight, so a response for a group the
       organiser has left must not paint over the one they moved to. */
    check('loadFixturesView re-checks the age id after the await',
      /if \(this\.state\.fxvAgeId !== agId\) return; \/\/ a newer pick won the race/.test(org));
    /* "could not load" and "nothing drawn yet" are different facts. Third time
       this page has needed the distinction — docs and clubs were the others. */
    check('a failed fetch is told apart from an empty draw',
      org.includes('fxvUnavailable') && org.includes('Could not load'));
  }

  /* =======================================================================
     8. Signing out of /app must drop the DATA, not just the session.
     ======================================================================= */
  section('signing out of /app cannot leave a draft on screen');
  {
    const app = readRepo('app.html');

    /* ⚠️ SLICED TO THE SIGNOUT BRANCH. Every string below exists elsewhere in
       this file — `S.fixtures = null` is in load(), `load(` is everywhere — so
       searching the whole file would pass against a signout branch that does
       none of it. Anchored between its own guard and the next branch. */
    /* ⚠️ REPOINTED 11 Aug 2026, AND IT NOW COVERS MORE THAN IT DID. The
       clearing used to be written inline in the signout branch, so this slice
       ran from that branch to the next one. There are now TWO ways back to the
       public view — pressing Sign out, and the SERVER ending the session — and
       both go through dropToPublic(), so the slice follows the work rather
       than the caller. Every assertion below is unchanged and now guards both
       routes at once; a second inline copy that forgot one line is exactly
       what moving it prevents. */
    const a = app.indexOf('function dropToPublic(');
    const b = app.indexOf('function act(', a);
    check('the drop-to-public helper was found', a > -1 && b > a);
    const branch = app.slice(a, b);
    check('CONTROL: the branch really is the signout one', branch.includes('api.logout()'));

    /* Both entry points must actually reach it, or the helper is dead code and
       every check below is asserting things about a function nobody calls. */
    check('the Sign out button goes through it',
      /if \(a === 'signout'\) \{ dropToPublic\(/.test(app));
    check('⚠️ and so does the server ending the session',
      /api\.onSessionEnded\(\(\) => dropToPublic\(/.test(app),
      'without this, a revoked phone keeps its draft on screen');

    /* The defect this guards: before the draft-visibility change these caches
       could only hold PUBLISHED fixtures, so clearing the session and
       re-rendering was enough. Now they may hold a draft, and a re-render with
       no refetch left it on screen wearing "you can see this because you are
       signed in" for whoever held the phone next. */
    check('signout clears the fixtures cache', /S\.fixtures\s*=\s*null/.test(branch));
    check('signout clears the standings cache', /S\.standings\s*=\s*null/.test(branch));
    /* followFx is a SEPARATE cache — that is what lets Today survive browsing
       another age group — so it has to be cleared by name or the Today tab keeps
       the draft after the other tabs have dropped it. */
    check('signout clears the followFx cache too', /S\.followFx\s*=\s*null/.test(branch));
    check('signout refetches as the public', /\bload\(/.test(branch));
    check('…and reloads the followed group when it is not the one on screen',
      /loadFollowData\(\)/.test(branch));

    /* ⚠️ ORDER IS PART OF THE FIX. Clearing after the render shows the draft for
       a frame. Asserted by position, not by presence — both orderings contain
       both strings. */
    check('the caches are cleared BEFORE the render, not after',
      branch.indexOf('S.fixtures = null') < branch.indexOf('render()'),
      'clear@' + branch.indexOf('S.fixtures = null') + ' render@' + branch.indexOf('render()'));
    check('the session is dropped before the refetch, so the refetch is public',
      branch.indexOf('S.session = null') < branch.indexOf('load('),
      'session@' + branch.indexOf('S.session = null') + ' load@' + branch.indexOf('load('));
  }

  /* =======================================================================
     9. The /organizer tab must not open on a group that keeps no table.
     ======================================================================= */
  section('the /organizer fixtures tab opens on a group that has a table');
  {
    const org = readRepo('Organizer.dc.html');
    const a = org.indexOf('openFixturesView() {');
    const b = org.indexOf('async loadFixturesView(', a);
    check('openFixturesView was found', a > -1 && b > a);
    const fn = org.slice(a, b);

    /* ⚠️ THE DEFECT: MANAGER_AGE_GROUPS[0] is u6, a festival group with
       hasStandings:false, so the first open rendered "Festival age group — no
       standings are kept" and read like a broken tab. */
    check('the first open picks a group with a table rather than index 0',
      /\.find\(\(a\) => a\.hasStandings\)/.test(fn));
    check('CONTROL: the function really does still reference the age-group list',
      fn.includes('MANAGER_AGE_GROUPS'));
    /* MANAGER_AGE_GROUPS is kept only as the FLOOR, so a failed fetch still
       opens the tab on something. If it became the primary pick again this
       passes while the bug is back — hence the positive check above. */
    check('MANAGER_AGE_GROUPS[0] survives as the fallback',
      /MANAGER_AGE_GROUPS\[0\]/.test(fn));
    /* ⚠️ AND THE FESTIVAL IDS MUST NOT BE COPIED HERE. They live in
       scores-data.js / _scoring.js; a third copy is how the pitch model and the
       registration rules each went wrong once. Paired with a control, because an
       absence check on its own proves nothing. */
    check('the festival ids are NOT hardcoded into this function',
      !/'u6'|"u6"|'u7'|"u7"/.test(fn));
    check('CONTROL: this file does mention u6 elsewhere, so the search works',
      /'u6'/.test(org));
  }

})().then(() => summary('test-draft-visibility.js')).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
