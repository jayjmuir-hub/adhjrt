# Manager Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give tournament managers (one login per age group) a dedicated, decluttered dashboard page at `/manager`, carrying the exact scoring/fixtures/results/tables functionality they already have inside `/app` today, without touching `/app` itself.

**Architecture:** A new standalone page, `Manager.html`, following `app.html`'s own architecture — plain `<script type="module">`, no build step, importing the *same* `scores-data.js` functions `app.html` already calls (`getFixtures`, `getStandings`, `submitResult`, `clearResult`, `scoringFor`, `teamLabel`, `teamShort`, `teamKey`, `login`, `currentSession`). It is **not** built with the `.dc.html` custom component engine that `Organizer.dc.html` and `Scores & Standings.dc.html` use — see the note under Task 3 for why, and note that "styled like Organizer" in the approved spec means the *visual* language (tab bar, larger touch targets/text), not the templating technology.

**Tech Stack:** Vanilla JS ES module (same as `app.html`), the existing `scores-data.js` client data layer (unchanged), the existing `manager-login.js` Netlify function (unchanged). No new backend code, no schema changes.

## Global Constraints

- `/app.html` is not modified by this plan. Zero lines change in that file.
- No new Netlify functions, no changes to `manager-login.js`, `submit-result.js`, or any backend file.
- Every new test assertion must be proven against a real injected fault (patch the actual logic, confirm the check fails, revert) — a check that only confirms code exists or that a value was applied is not acceptable, per this project's own "mistakes worth remembering" log.
- Full existing suite (2,012 checks / 228 injected faults as of 30 Jul 2026, `tests/runall.ps1`) must still pass unchanged after every task.
- Repo write path: work on `dev`, never `main` directly. Use the device bridge (`SendUserFile` + `device_commit_files`) to get changes onto Jay's `cafnet` PC, verify with `git write-tree`/SHA-256 matching the sandbox before any commit, per `claude/writing-to-github-from-claude.md`. Sandbox git can read but never push.
- `[skip ci]` on any commit that is docs-only. This plan's commits are not docs-only.
- Plain-language, per-platform check-ins with Jay ("In GitHub: …", "In Netlify: …") happen at task boundaries described in Task 10 — Jay is a non-developer.

---

### Task 1: Extract shared session-permission helpers into `scores-data.js`

**Why this is first:** `app.html` currently defines `isOrganiser(s)` and `canScore(s, agId)` as local functions with no exports and no tests — this project has zero test coverage of `app.html` today. `Manager.html` needs the exact same two checks (a manager may only ever see/score their own age group; an organiser or the `'*'` admin-manager account sees everything). Duplicating the logic in a second file risks it drifting out of step, and neither copy would be testable in isolation. Moving both into `scores-data.js` — which the test suite already imports — makes them shared, testable, and used identically by both pages.

**Files:**
- Modify: `scores-data.js` (add two exports, near `currentSession`/`logout` around line 1731)
- Modify: `app.html:443` (`isOrganiser`) and `app.html:459-460` (`canScore`) — replace local definitions with calls into `api.*`
- Test: `tests/test-session-permissions.js` (new)

**Interfaces:**
- Produces: `export function isOrganiserSession(s)` — same logic as `app.html`'s current `isOrganiser`: `!!(s && (s.isOrganizer || s._role === 'organizer' || s.role === 'organizer'))`.
- Produces: `export function canScoreAgeGroup(s, agId)` — same logic as `app.html`'s current `canScore`: `!s ? false : (isOrganiserSession(s) || s.ageGroupId === '*' || s.ageGroupId === agId)`.
- Consumed by: Task 3 (login gating) and Task 5 (score-entry gating) in `Manager.html`, and by `app.html` itself after this task (no behaviour change there).

- [ ] **Step 1: Write the failing test**

Create `tests/test-session-permissions.js`:

```js
/* tests/test-session-permissions.js
   Proves isOrganiserSession() and canScoreAgeGroup() in scores-data.js —
   the shared gating logic both app.html and the new Manager.html rely on to
   stop a manager scoring outside their own age group. Extracted from
   app.html's own local isOrganiser/canScore (see that file's history) so it
   is shared and testable instead of duplicated.
*/
const { section, check, summary } = require('./_lib');

// scores-data.js is an ES module; load just the two pure functions under
// test via a lightweight extraction, same approach test-venue-splits.js
// uses for other pure exports in this same file — avoids dragging in the
// whole module's fetch-backed surface for a synchronous logic check.
const fs = require('fs');
const path = require('path');
const { repoRoot } = require('./_lib');
const src = fs.readFileSync(path.join(repoRoot(), 'scores-data.js'), 'utf8');

function extractFn(name) {
  const re = new RegExp(`export function ${name}\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`${name} not found in scores-data.js`);
  // eslint-disable-next-line no-new-func
  return new Function(`${m[0]}\nreturn ${name};`)();
}

const isOrganiserSession = extractFn('isOrganiserSession');
const canScoreAgeGroup = extractFn('canScoreAgeGroup');

section('isOrganiserSession()');
check('null session is not an organiser', isOrganiserSession(null) === false);
check('plain manager session is not an organiser', isOrganiserSession({ ageGroupId: 'u14b' }) === false);
check('isOrganizer:true flag is an organiser', isOrganiserSession({ isOrganizer: true }) === true);
check('role:"organizer" is an organiser', isOrganiserSession({ role: 'organizer' }) === true);

section('canScoreAgeGroup()');
check('no session cannot score', canScoreAgeGroup(null, 'u14b') === false);
check('manager can score own age group', canScoreAgeGroup({ ageGroupId: 'u14b' }, 'u14b') === true);
check('manager CANNOT score a different age group', canScoreAgeGroup({ ageGroupId: 'u14b' }, 'u16b') === false);
check('admin manager ("*") can score any age group', canScoreAgeGroup({ ageGroupId: '*' }, 'u16b') === true);
check('organiser can score any age group', canScoreAgeGroup({ isOrganizer: true, ageGroupId: null }, 'u16b') === true);

summary('test-session-permissions.js');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test-session-permissions.js`
Expected: FAIL with `isOrganiserSession not found in scores-data.js` (the functions don't exist yet).

- [ ] **Step 3: Add the two functions to `scores-data.js`**

Insert immediately before `export function currentSession() {` (around line 1720):

```js
// Shared session-permission checks. Used by app.html and Manager.html so
// "can this signed-in person score this age group" has exactly one
// definition, not two copies that can quietly drift apart. An organiser or
// the '*' admin-manager account can act on any age group; a normal manager
// only their own.
export function isOrganiserSession(s) {
  return !!(s && (s.isOrganizer || s._role === 'organizer' || s.role === 'organizer'));
}
export function canScoreAgeGroup(s, agId) {
  return !s ? false : (isOrganiserSession(s) || s.ageGroupId === '*' || s.ageGroupId === agId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/test-session-permissions.js`
Expected: `test-session-permissions.js: 9/9 checks passed`

- [ ] **Step 5: Prove each check against an injected fault**

For each of the 9 checks, temporarily edit `scores-data.js`'s two new functions to break the specific behaviour that check guards (e.g. change `s.ageGroupId === agId` to `true` and confirm "manager CANNOT score a different age group" fails), re-run the test, confirm it fails, then revert. Record the pass/fail pairs — this is what makes the test a real verification per this project's standing rule, not a check that only confirms the code was applied.

- [ ] **Step 6: Update `app.html` to use the shared functions instead of its own copies**

In `app.html`, replace:

```js
const isOrganiser = (s) => !!(s && (s.isOrganizer || s._role === 'organizer' || s.role === 'organizer'));
```

with:

```js
const isOrganiser = api.isOrganiserSession;
```

and replace:

```js
const canScore = (s, agId) =>
  !s ? false : (isOrganiser(s) || s.ageGroupId === '*' || s.ageGroupId === agId);
```

with:

```js
const canScore = api.canScoreAgeGroup;
```

- [ ] **Step 7: Confirm `app.html` behaviour is unchanged**

This project has no automated test of `app.html` today (confirmed by grepping `tests/` for any reference to `app.html` — there is none), so this step is a manual smoke check rather than an automated one: open `/app` in the sandbox's Playwright/headless Chromium against a local preview, sign in as a test manager account, confirm score entry still works and a non-manager still sees "No result yet" on an unscored match. Note in the commit message that `app.html`'s behaviour is unchanged, backed by this manual check, since no automated regression test exists for it yet.

- [ ] **Step 8: Run the full suite**

Run: `powershell -ExecutionPolicy Bypass -File tests\runall.ps1` (or the sandbox's equivalent Node invocation of each file)
Expected: all existing files still pass unchanged (2,012/2,012), plus the new 9/9.

- [ ] **Step 9: Add the new test file to `tests/runall.ps1`**

In the `$tests = @(...)` array, add `'test-session-permissions.js'` (alphabetically near `test-simulate-tournament.js`/`test-registration.js` grouping is fine — the array order doesn't matter functionally).

- [ ] **Step 10: Commit**

Follow the device-bridge write path in `claude/writing-to-github-from-claude.md` (SHA-256 match sandbox vs `cafnet` before committing). Commit message: something like "Extract shared isOrganiserSession/canScoreAgeGroup into scores-data.js, ahead of the Manager dashboard build."

---

### Task 2: Add the `/manager` route

**Files:**
- Modify: `netlify.toml`

**Interfaces:**
- Produces: the route `/manager` resolving to `/Manager.html`, in the same style as the three existing redirects.
- Consumed by: Task 3 onward — nothing works end-to-end until this exists, but it can be added even before `Manager.html` exists (Netlify will 404 the target file until Task 3 lands, which is fine on a `dev`-only branch).

- [ ] **Step 1: Add the redirect**

In `netlify.toml`, immediately after the existing `/app` redirect block (around line 19-21):

```toml
[[redirects]]
  from = "/manager"
  to = "/Manager.html"
```

- [ ] **Step 2: Confirm no existing redirect collides**

Check `netlify.toml` for any existing rule matching `/manager*` (there is none as of this plan — the closest is `/manager-login`-style function paths, which live under `/.netlify/functions/` and are untouched by this).

- [ ] **Step 3: Commit**

Small, isolated commit: "Add /manager route (target page built in the next commit)." This can be combined with Task 3's commit instead if you'd rather not ship a route with no page behind it, even on `dev` — either is fine since `dev` never deploys to `main` on its own.

---

### Task 3: `Manager.html` — page shell and login screen

**Why not `.dc.html`:** `Organizer.dc.html` and `Scores & Standings.dc.html` are built on a custom reactive component engine (`support.js`, `<script type="text/x-dc">`, `{{ }}` bindings, `sc-if`/`sc-for`). `app.html` is a plain HTML page with a `<script type="module">` — no custom engine, no build step. Rewriting the score-entry flow (walkover handling, the 0–0 confirmation, live total recalculation) into the `.dc.html` engine would mean re-implementing logic that is already live and working, for no functional gain, and directly against this build's own rationale (built separately, at low risk, reusing proven logic unchanged). `Manager.html` therefore follows `app.html`'s own architecture. "Styled like Organizer" from the approved spec is satisfied by matching its visual language (tab bar instead of bottom nav, larger text/touch targets), not by adopting its templating technology.

**Files:**
- Create: `Manager.html`
- Test: covered in Task 9 (one combined test file for the whole page, written after all tabs exist — see that task for why)

**Interfaces:**
- Consumes: `api.login(username, password)`, `api.currentSession()`, `api.logout()`, `api.isOrganiserSession(session)`, `api.getAgeGroups()`, `api.loadVenue()` — all from `scores-data.js`, all unchanged (the first two of the above five were touched in Task 1, but only their internals moved, not their signatures).
- Produces: a `<div id="managerRoot">` shell with a login form when signed out, and (once signed in) the tab-bar chrome that Tasks 4-7 render into.

- [ ] **Step 1: Copy the reusable shell from `app.html`**

Start `Manager.html` from `app.html`'s `<head>` block verbatim (fonts, manifest, meta tags) but with:
- `<title>ADH JRT — Manager Dashboard</title>`
- `<meta name="description" content="Manager dashboard for the Abu Dhabi Harlequins Junior Rugby Tournament.">`

- [ ] **Step 2: Write the login-screen CSS**

Reuse `app.html`'s existing `:root` palette variables and `.card`/`.btn`/`.field`/`.err` classes verbatim (they're already styled correctly and tested-by-use in `app.html`'s own sign-in sheet). Add an Organizer-style full-page login wrapper instead of a bottom sheet:

```css
.mgr-login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.mgr-login-card{width:100%;max-width:380px;background:var(--card);border-radius:var(--radius);
  box-shadow:var(--shadow);padding:32px 26px;border:1px solid var(--line)}
.mgr-login-k{font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
  color:var(--green);margin-bottom:6px}
.mgr-login-h{font-family:'Anton';font-size:26px;text-transform:uppercase;margin-bottom:22px}
```

- [ ] **Step 3: Write the login markup and boot logic**

```html
<body>
<div id="managerRoot"></div>
<div class="toast" id="toast"></div>

<script type="module">
"use strict";
const api = await import('/scores-data.js');
await api.loadVenue();

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function toast(msg){
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(()=>t.classList.remove('on'), 2600);
}

const S = { session: null, ageGroups: [], view: 'today', fixtures: null, standings: null };

function renderLogin(){
  $('managerRoot').innerHTML = `<div class="mgr-login"><div class="mgr-login-card">
    <div class="mgr-login-k">Manager sign in</div>
    <div class="mgr-login-h">ADH JRT</div>
    <div id="loginErr"></div>
    <div class="field"><label>Username</label><input id="lu" autocomplete="username" autocapitalize="none"></div>
    <div class="field"><label>Password</label><input id="lp" type="password" autocomplete="current-password"></div>
    <button class="btn btn-p" id="lgo">Sign in</button>
    <p class="muted" style="margin-top:16px;font-size:13px;line-height:1.6">
      Use the account you created with your age group invite code. An organiser
      account also works here.</p>
  </div></div>`;
  $('lgo').onclick = async () => {
    const u = $('lu').value.trim(), p = $('lp').value;
    if (!u || !p) { $('loginErr').innerHTML = '<div class="err">Enter your username and password.</div>'; return; }
    $('lgo').textContent = 'Signing in…';
    const r = await api.login(u, p);
    if (r.ok) {
      S.session = api.currentSession();
      await boot();
      toast('Signed in');
    } else {
      $('loginErr').innerHTML = `<div class="err">${esc(r.error || 'Wrong username or password.')}</div>`;
      $('lgo').textContent = 'Sign in';
    }
  };
}

async function boot(){
  S.session = api.currentSession();
  if (!S.session) { renderLogin(); return; }
  S.ageGroups = await api.getAgeGroups();
  const agId = api.isOrganiserSession(S.session) ? null : S.session.ageGroupId;
  if (agId && !S.ageGroups.some(a => a.id === agId)) {
    // A signed-in session whose age group no longer exists in the live
    // config (e.g. an old test account) — sign out rather than show a
    // dashboard for a group that isn't there. Mirrors app.html's own
    // fallback-to-first-age-group behaviour, but a manager dashboard has no
    // "browse a different group" affordance to fall back into, so signing
    // out is the honest outcome instead of silently picking a random one.
    api.logout(); S.session = null; renderLogin();
    toast('Your account’s age group is not set up yet — contact an organiser.');
    return;
  }
  renderDashboard(agId); // agId is null for an organiser/admin session; Task 4 handles that
}

boot();
</script>
</body>
```

- [ ] **Step 4: Manual check in a local preview**

Run the site locally (or via a Netlify branch deploy), open `/manager`, confirm: signed out shows the login card centred on the page (not a bottom sheet); a wrong password shows the existing error text; a correct manager login clears the form (verified once `renderDashboard` exists in Task 4 — for now confirm it doesn't throw, since `renderDashboard` isn't defined until the next task).

- [ ] **Step 5: Commit**

Note in the commit message that `renderDashboard` is a stub completed in the next task — or hold this commit and combine with Task 4 if you'd rather not commit an intentionally-incomplete function. Either is fine on `dev`.

---

### Task 4: Today tab

**Files:**
- Modify: `Manager.html` (add `renderDashboard`, tab-bar markup/CSS, `viewToday`)

**Interfaces:**
- Consumes: `api.getFixtures(agId)` (shape: `{ awaitingPublication, pool: [...], knockout: [...] }`, each match `{ id, home, away, time, pitch, poolName, round, result, startMins }`), `api.teamLabel(code, agId)`, `api.dayOfAgeGroup`, `api.isDayOne`, `api.dayLabelOfAgeGroup` — all unchanged from `scores-data.js`.
- Produces: `S.view` state machine (`'today' | 'fixtures' | 'results' | 'tables'`), `go(view)`, a tab bar the later tasks' tabs plug into the same way.

- [ ] **Step 1: Tab bar markup and CSS, Organizer-style**

```css
.mgr-shell{max-width:960px;margin:0 auto;min-height:100vh}
.mgr-tabs{position:sticky;top:0;z-index:40;background:var(--ink);display:flex;gap:4px;
  padding:14px 16px 0;overflow-x:auto}
.mgr-tabs button{padding:12px 20px;border-radius:10px 10px 0 0;font-weight:800;font-size:15px;
  color:#aeb4bf;white-space:nowrap;letter-spacing:.3px}
.mgr-tabs button.on{background:var(--paper);color:var(--ink)}
.mgr-main{padding:20px 16px 60px}
```

This deliberately does not reuse `app.html`'s `.tabbar`/bottom-nav CSS at all — it's the one piece of `app.html` explicitly NOT carried over, per the approved spec ("a tab bar, not `/app`'s bottom mobile-app nav").

- [ ] **Step 2: `renderDashboard` and tab wiring**

```js
const MGR_TABS = [
  { id:'today', label:'Today' },
  { id:'fixtures', label:'Fixtures & scoring' },
  { id:'results', label:'Results' },
  { id:'tables', label:'Tables' },
];

function renderDashboard(agId){
  S.ageId = agId || (S.session.ageGroupId === '*' ? (S.ageGroups[0] || {}).id : S.session.ageGroupId);
  $('managerRoot').innerHTML = `<div class="mgr-shell">
    <nav class="mgr-tabs" id="mgrTabs"></nav>
    <main class="mgr-main" id="mgrMain"></main>
  </div>`;
  buildTabs();
  load(S.ageId);
}

function buildTabs(){
  $('mgrTabs').innerHTML = MGR_TABS.map(t =>
    `<button data-go="${t.id}" class="${S.view===t.id?'on':''}">${esc(t.label)}</button>`).join('');
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
}
function go(v){ S.view = v; buildTabs(); render(); window.scrollTo(0,0); }

async function load(agId){
  S.ageId = agId; S.fixtures = null; S.standings = null;
  render();
  const [fx, st] = await Promise.all([api.getFixtures(agId), api.getStandings(agId)]);
  if (S.ageId !== agId) return;
  S.fixtures = fx; S.standings = st;
  render();
}

function render(){
  $('mgrMain').innerHTML = S.view === 'today' ? viewToday()
    : S.view === 'fixtures' ? viewFixtures()
    : S.view === 'results' ? viewResults()
    : viewTables();
  wire();
}
function wire(){
  document.querySelectorAll('[data-match]').forEach(b => b.onclick = () => openMatch(b.dataset.match));
}
```

- [ ] **Step 3: `viewToday` — reuse `app.html`'s "jump to next unscored match" shape**

This is a scoped-down version of `app.html`'s `viewToday`/`followCard` (no countdown hero, no "before the day" filler content — a manager doesn't need the public-facing tournament-info blurb, they need to know what's next):

```js
function ageName(id){ return (S.ageGroups.find(a => a.id === id) || {}).name || id; }
const tName = (code) => (api.teamLabel ? api.teamLabel(code, S.ageId) : code) || code || '';

function matchRow(m){
  const r = m.result;
  return `<button class="mrow" data-match="${esc(m.id)}">
    <div><div class="mtime">${esc(m.time || '')}</div><div class="mpitch">${esc(m.pitch || 'TBD')}</div></div>
    <div><div class="mteams">${esc(m.home ? tName(m.home) : 'TBD')} <span class="muted">v</span> ${esc(m.away ? tName(m.away) : 'TBD')}</div>
      <div class="mmeta">${esc(m.poolName || m.round || '')}</div></div>
    <div>${r ? `<span class="mscore">${r.homeScore}&ndash;${r.awayScore}</span>` : ICON.chev}</div>
  </button>`;
}

function viewToday(){
  const fx = S.fixtures;
  const head = `<div class="sec-t">${esc(ageName(S.ageId))}</div>`;
  if (!fx) return head + `<div class="card"><div class="spin">Loading…</div></div>`;
  if (fx.awaitingPublication) return head + comingSoon('Fixtures');
  const all = (fx.pool || []).concat((fx.knockout || []).filter(k => k.home || k.away));
  const next = all.find(m => !m.result);
  const recent = [...all].reverse().filter(m => m.result).slice(0, 3);
  const nextCard = next
    ? `<div class="sec-t">Next up</div><div class="card">${matchRow(next)}</div>`
    : `<div class="card"><div class="empty"><b>All matches played</b><div>Nothing left to score in ${esc(ageName(S.ageId))}.</div></div></div>`;
  const recentCard = recent.length
    ? `<div class="sec-t">Recent results</div><div class="card">${recent.map(matchRow).join('')}</div>` : '';
  return head + nextCard + recentCard;
}

function comingSoon(what){
  return `<div class="card"><div class="empty">
    <b>${esc(what)} not published yet</b>
    <div>The draw for ${esc(ageName(S.ageId))} hasn't been released yet.</div>
  </div></div>`;
}

const ICON = { chev: '<svg class="chev" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>' };
```

Add the `.mrow`/`.mtime`/`.mpitch`/`.mteams`/`.mmeta`/`.mscore`/`.chev`/`.sec-t`/`.card`/`.empty` CSS classes from `app.html` verbatim (lines 96-149 of `app.html`) — these are pure presentational styles with no logic, safe to copy as-is.

- [ ] **Step 4: Stub the other three view functions so nothing throws**

```js
function viewFixtures(){ return '<div class="card"><div class="spin">Coming in the next task…</div></div>'; }
function viewResults(){ return viewFixtures(); }
function viewTables(){ return viewFixtures(); }
function openMatch(id){ /* Task 5 */ }
```

(These get replaced in Tasks 5-7 — keep this task's diff reviewable on its own rather than landing four tabs at once.)

- [ ] **Step 5: Manual check**

Sign in as a test manager, confirm the Today tab shows the next unscored match (or "All matches played"), confirm the other three tab buttons switch the active tab highlight without erroring.

- [ ] **Step 6: Commit**

---

### Task 5: Fixtures & scoring tab

**Why this merges two of `app.html`'s tabs into one:** per the approved spec, a manager only opens Fixtures in order to score them — `app.html`'s split (browse Fixtures in one tab, tap into a sign-in-gated score sheet) existed because `app.html` also serves signed-out public visitors who can't score anything. `Manager.html` has no signed-out state past the login screen, so there's nothing to gate.

**Files:**
- Modify: `Manager.html` (`viewFixtures`, `openMatch`, score-entry sheet markup/wiring)

**Interfaces:**
- Consumes: `api.canScoreAgeGroup(session, agId)` (Task 1), `api.scoringFor(agId)`, `api.scoreLabel(k)`, `api.scorePoints(k)`, `api.scoreTotal(agId, parts)`, `api.submitResult(matchId, data, session)`, `api.clearResult(matchId, session)`, `api.loadScoringRules()` — all unchanged from `scores-data.js`.
- Produces: the completed `viewFixtures()` and `openMatch(id)`, replacing Task 4's stubs.

- [ ] **Step 1: Add the sheet markup to the page shell**

`Manager.html` needs a bottom-sheet host, same as `app.html`'s (`.sheet-scrim`/`.sheet`), for the score-entry form. Add to the body, alongside `#managerRoot`:

```html
<div class="sheet-scrim" id="scrim"></div>
<div class="sheet" id="sheet" role="dialog" aria-modal="true">
  <div class="grip"></div>
  <div class="sheet-head"><h3 id="sheetTitle">—</h3>
    <button class="x" id="sheetClose" aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>
  <div class="sheet-body" id="sheetBody"></div>
</div>
```

Copy the `.sheet-scrim`/`.sheet`/`.grip`/`.sheet-head`/`.x`/`.sheet-body`/`.scoreblock`/`.sb-head`/`.sb-row`/`.sb-pts`/`.sb-in`/`.field`/`.err`/`.btn`/`.btn-g`/`.btn-o` CSS from `app.html` verbatim (lines 205-239 of `app.html`) — same reasoning as Task 4 Step 3, pure presentational rules.

```js
function openSheet(title, html){
  $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html;
  $('sheet').classList.add('on'); $('scrim').classList.add('on');
}
function closeSheet(){ $('sheet').classList.remove('on'); $('scrim').classList.remove('on'); }
$('sheetClose').onclick = closeSheet; $('scrim').onclick = closeSheet;
```

- [ ] **Step 2: `viewFixtures`, grouped by pool same as `app.html`**

```js
function viewFixtures(){
  const fx = S.fixtures;
  const head = `<div class="sec-t">Fixtures</div>`;
  if (!fx) return head + `<div class="card"><div class="spin">Loading…</div></div>`;
  if (fx.awaitingPublication) return head + comingSoon('Fixtures');
  const byPool = {};
  (fx.pool || []).forEach(m => { const k = m.poolName || 'Matches'; (byPool[k] = byPool[k] || []).push(m); });
  const groups = Object.keys(byPool).map(k =>
    `<div class="pool-h">${esc(k)}</div>${byPool[k].map(matchRow).join('')}`).join('');
  const ko = (fx.knockout || []).filter(k => k.home || k.away);
  return head
    + `<div class="card">${groups || '<div class="empty"><b>No matches</b><div>Nothing scheduled here yet.</div></div>'}</div>`
    + (ko.length ? `<div class="sec-t">Knockout</div><div class="card">${ko.map(matchRow).join('')}</div>` : '');
}
```

Add `.pool-h` CSS from `app.html:283-284`, verbatim.

- [ ] **Step 3: `openMatch` — score entry, adapted from `app.html:1013-1120`**

This is the highest-risk piece of logic in the whole build (walkover math, live totals, the 0–0 confirmation), so it is lifted close to verbatim from `app.html`, with the public-facing "you're not signed in, here's a read-only view" branch removed (every viewer of `Manager.html` is signed in and, for their own age group, can always score — that's the one branch `app.html` needs that this page never does):

```js
function openMatch(id){
  const m = findMatch(id); if (!m) return;
  const r = m.result;
  const head = `<div class="card" style="margin-bottom:16px">
      <div class="row"><div><b>${esc(m.home?tName(m.home):'TBD')} v ${esc(m.away?tName(m.away):'TBD')}</b>
        <small>${esc(m.poolName||m.round||'')} &middot; ${esc(m.time||'')} &middot; ${esc(m.pitch||'Pitch TBD')}</small></div></div>
      ${r ? `<div class="row"><div><b style="font-family:'Anton';font-size:26px">${r.homeScore} &ndash; ${r.awayScore}</b>
        <small>Tries ${r.homeTries||0}&ndash;${r.awayTries||0}${r.walkover?' &middot; walk-over':''}</small></div></div>` : ''}
    </div>`;

  const parts = api.scoringFor(S.ageId);
  const sideInputs = (side, label) => `
    <div class="scoreblock">
      <div class="sb-head"><span>${esc(label)}</span><b id="tot-${side}">0</b></div>
      ${parts.map(k => `
        <div class="sb-row">
          <label for="${side}-${k}">${esc(api.scoreLabel(k))} <span class="sb-pts">${api.scorePoints(k)} pts</span></label>
          <input id="${side}-${k}" class="sb-in" type="number" inputmode="numeric" min="0" step="1"
                 value="${r ? (r[side + k.charAt(0).toUpperCase() + k.slice(1)] || 0) : 0}">
        </div>`).join('')}
    </div>`;

  openSheet('Enter score', head + `<div id="scErr"></div>
    ${sideInputs('home', m.home ? tName(m.home) : 'Home')}
    ${sideInputs('away', m.away ? tName(m.away) : 'Away')}
    <div class="field" style="margin-top:4px"><label>Walk-over</label><select id="wo">
      <option value="">No walk-over</option>
      <option value="home" ${r&&r.walkover==='home'?'selected':''}>${esc(m.home?tName(m.home):'Home')} awarded the match</option>
      <option value="away" ${r&&r.walkover==='away'?'selected':''}>${esc(m.away?tName(m.away):'Away')} awarded the match</option>
    </select><p class="muted" style="font-size:12px;margin-top:6px">A walk-over is recorded as 20&ndash;0 with 4 tries.</p></div>
    <button class="btn btn-g" id="sgo">${r?'Update result':'Save result'}</button>
    ${r ? `<button class="btn btn-o" id="sclr" style="margin-top:10px;color:#c0392b">Clear result</button>
      <p class="muted" style="font-size:12px;margin-top:8px;line-height:1.5">Clearing puts the match back to unplayed. It is not the same as saving 0&ndash;0, which is a draw worth two league points each.</p>` : ''}`);

  const readSide = (side) => {
    const o = {};
    parts.forEach(k => { o[k] = Number(($(`${side}-${k}`) || {}).value || 0); });
    return o;
  };
  const recalc = () => {
    const wo = $('wo').value;
    ['home','away'].forEach(side => {
      const t = wo ? (wo === side ? 20 : 0) : api.scoreTotal(S.ageId, readSide(side));
      $('tot-' + side).textContent = t;
    });
    const off = !!$('wo').value;
    parts.forEach(k => ['home','away'].forEach(side => {
      const el = $(`${side}-${k}`); if (el) { el.disabled = off; el.style.opacity = off ? .45 : 1; }
    }));
  };
  parts.forEach(k => ['home','away'].forEach(side => {
    const el = $(`${side}-${k}`); if (el) el.oninput = recalc;
  }));
  $('wo').onchange = recalc;
  recalc();

  if (r && $('sclr')) $('sclr').onclick = async () => {
    if (!confirm('Clear this result? The match goes back to unplayed and the pool table is recalculated.')) return;
    $('sclr').textContent = 'Clearing…';
    const res = await api.clearResult(m.id, S.session);
    if (res.ok) { closeSheet(); toast('Result cleared'); await load(S.ageId); }
    else { $('scErr').innerHTML = `<div class="err">${esc(res.error||'Could not clear.')}</div>`; $('sclr').textContent = 'Clear result'; }
  };

  $('sgo').onclick = async () => {
    const wo = $('wo').value;
    if (!wo) {
      const zero = ['home','away'].every(side => parts.every(k => !Number(($(`${side}-${k}`)||{}).value || 0)));
      if (zero && !confirm('Save this as a 0–0 draw? Both teams get two league points.\n\nTo remove the result instead, use Clear result.')) {
        return;
      }
    }
    $('sgo').textContent = 'Saving…';
    const payload = { walkover: wo || null };
    ['home','away'].forEach(side => parts.forEach(k => {
      payload[side + k.charAt(0).toUpperCase() + k.slice(1)] = Number(($(`${side}-${k}`)||{}).value || 0);
    }));
    const res = await api.submitResult(m.id, payload, S.session);
    if (res.ok) {
      closeSheet();
      toast(res.stored ? `Saved ${res.stored.homeScore}–${res.stored.awayScore}` : 'Result saved');
      await load(S.ageId);
    }
    else { $('scErr').innerHTML = `<div class="err">${esc(res.error||'Could not save.')}</div>`; $('sgo').textContent='Save result'; }
  };
}

function findMatch(id){
  const fx = S.fixtures; if (!fx) return null;
  return (fx.pool || []).concat(fx.knockout || []).find(x => x.id === id) || null;
}
```

- [ ] **Step 4: Manual check against a real match**

Sign in as a test manager for an age group with published fixtures. Enter a score, save, confirm the toast shows the server's own echoed figures (not just the form's), confirm Clear result puts it back to unplayed, confirm a 0–0 save prompts the confirmation, confirm a walkover disables the score inputs and shows 20–0.

- [ ] **Step 5: Commit**

---

### Task 6: Results tab

**Files:**
- Modify: `Manager.html` (`viewResults`)

**Interfaces:**
- Consumes: same `S.fixtures` shape already loaded by Task 4's `load()`.
- Produces: completed `viewResults()`, replacing Task 4's stub.

- [ ] **Step 1: Implement, scoped down from `app.html:792-820` (no team filter — a manager has no "my team" to filter by)**

```js
function viewResults(){
  const fx = S.fixtures;
  const head = `<div class="sec-t">Results</div>`;
  if (!fx) return head + `<div class="card"><div class="spin">Loading…</div></div>`;
  if (fx.awaitingPublication) return head + comingSoon('Results');
  const all = (fx.pool || []).concat((fx.knockout || []).filter(k => k.home || k.away));
  const played = all.filter(m => m.result).reverse();
  if (!played.length) return head + `<div class="card"><div class="empty">
      <b>No results yet</b><div>Scores you enter on the Fixtures &amp; scoring tab appear here.</div>
    </div></div>`;
  return head + `<div class="card">${played.map(matchRow).join('')}</div>`;
}
```

- [ ] **Step 2: Manual check**

Confirm played matches show most-recent-first, unplayed ones don't appear, and the empty state shows before any scores exist.

- [ ] **Step 3: Commit**

---

### Task 7: Tables tab

**Files:**
- Modify: `Manager.html` (`viewTables`)

**Interfaces:**
- Consumes: `S.standings` (shape: `{ awaitingPublication, ageGroup: { hasStandings, name }, pools: [{ id, name }], tables: { [poolId]: [{ team, P, W, D, L, PF, PA, pts }] }, _advance }`), `api.teamShort(code)` — unchanged from `scores-data.js`.
- Produces: completed `viewTables()`, replacing Task 4's stub.

- [ ] **Step 1: Implement, adapted from `app.html:848-872` (no "highlight my team" row — no followed team on this page)**

```js
function viewTables(){
  const st = S.standings;
  const head = `<div class="sec-t">Tables</div>`;
  if (!st) return head + `<div class="card"><div class="spin">Loading…</div></div>`;
  if (st.awaitingPublication) return head + comingSoon('Standings');
  if (!st.ageGroup.hasStandings) return head +
    `<div class="card"><div class="empty"><b>Festival age group</b>
     <div>${esc(st.ageGroup.name)} is non-competitive — no standings are kept.</div></div></div>`;
  const pools = st.pools || [];
  if (!pools.length) return head +
    `<div class="card"><div class="empty"><b>No pools yet</b><div>Nothing to show for this age group.</div></div></div>`;
  const adv = st._advance || 0;
  return head + pools.map(p => {
    const rows = st.tables[p.id] || [];
    return `<div class="sec-t">${esc(p.name)}</div><div class="card"><div class="tscroll"><table>
      <thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>PF</th><th>PA</th><th>+/&minus;</th><th>Pts</th></tr></thead>
      <tbody>${rows.map((t,i) => `<tr class="${i<adv?'q':''}">
        <td>${i+1}</td><td>${esc(tShort(t.team))}</td><td>${t.P}</td><td>${t.W}</td><td>${t.D}</td><td>${t.L}</td>
        <td>${t.PF}</td><td>${t.PA}</td><td>${t.PF-t.PA>0?'+':''}${t.PF-t.PA}</td><td class="pts">${t.pts}</td></tr>`).join('')}</tbody></table></div>
      <div class="legend">Green bar = qualifies for the knockout stage.</div>
    </div>`;
  }).join('');
}
const tShort = (code) => (api.teamShort ? api.teamShort(code) : code) || code || '';
```

Add the `.tscroll`/`table`/`th`/`td`/`.pts`/`.legend`/`tr.q` CSS from `app.html:154-196` verbatim, including the narrow-phone PF/PA-hiding media query — a manager reads this on the same pitch-side phone a public visitor does.

- [ ] **Step 2: Manual check**

Confirm a two-pool age group shows both tables, the qualifying-line green bar appears at the right row count, and a narrow-viewport check (Playwright, per this project's own established layout-verification pattern) confirms PF/PA hide below 430px same as `app.html`.

- [ ] **Step 3: Commit**

---

### Task 8: Prove the whole page against injected faults

**Why this is its own task, after all four tabs exist:** testing `Manager.html` tab-by-tab would mean re-extracting and re-mocking the module script four times. One combined test file, written once all the real logic exists, is simpler and matches how `test-fixtures-results-sync.js` tests a whole component rather than one method at a time.

**Files:**
- Create: `tests/test-manager-dashboard.js`
- Modify: `tests/runall.ps1` (add the new file to `$tests`)

**Interfaces:**
- Consumes: `Manager.html`'s `<script type="module">` body, extracted the same way `test-fixtures-results-sync.js` extracts `<script type="text/x-dc">` (see that file's `loadComponent()`), adapted for the `module` script type and a `fakeScoresApi()`-style mock of `scores-data.js`'s exports (`getFixtures`, `getStandings`, `login`, `currentSession`, `isOrganiserSession`, `canScoreAgeGroup`, `scoringFor`, `scoreLabel`, `scorePoints`, `scoreTotal`, `submitResult`, `clearResult`, `teamLabel`, `teamShort`, `getAgeGroups`, `loadVenue`, `logout`).

- [ ] **Step 1: Write the extraction + mock harness**

```js
/* tests/test-manager-dashboard.js
   Proves Manager.html's age-group scoping and tab content against real
   injected faults — not just that the markup renders. Same
   extract-and-drive approach test-fixtures-results-sync.js uses for the
   .dc.html components, adapted for Manager.html's plain <script
   type="module"> (see Manager.html's own header comment for why it isn't
   a .dc.html component).
*/
const { readRepo, section, check, summary } = require('./_lib');

function extractModuleScript(){
  const t = readRepo('Manager.html');
  const m = t.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no <script type="module"> found in Manager.html');
  return m[1];
}

function fakeApi(overrides){
  return Object.assign({
    loadVenue: async () => {},
    getAgeGroups: async () => [{ id: 'u14b', name: 'U14 Boys', hasStandings: true }, { id: 'u16b', name: 'U16 Boys', hasStandings: true }],
    login: async () => ({ ok: true }),
    currentSession: () => ({ ageGroupId: 'u14b', username: 'test-u14b', token: 'tok' }),
    logout: () => {},
    isOrganiserSession: (s) => !!(s && s.isOrganizer),
    canScoreAgeGroup: (s, agId) => !s ? false : (s.isOrganizer || s.ageGroupId === '*' || s.ageGroupId === agId),
    getFixtures: async (agId) => ({ awaitingPublication: false, pool: [
      { id: `${agId}:A:1-2`, home: 'ADH1', away: 'DE1', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: null },
      { id: `${agId}:A:3-4`, home: 'DS1', away: 'DT1', time: '09:20', pitch: 'A1', poolName: 'Pool A', result: { homeScore: 15, awayScore: 10, homeTries: 3, awayTries: 2 } },
    ], knockout: [] }),
    getStandings: async () => ({ awaitingPublication: false, ageGroup: { hasStandings: true, name: 'U14 Boys' },
      pools: [{ id: 'A', name: 'Pool A' }], tables: { A: [{ team: 'DS1', P:1,W:1,D:0,L:0,PF:15,PA:10,pts:4 }] }, _advance: 1 }),
    scoringFor: () => ['tries'],
    scoreLabel: (k) => k, scorePoints: () => 5, scoreTotal: () => 0,
    submitResult: async () => ({ ok: true, stored: { homeScore: 5, awayScore: 0 } }),
    clearResult: async () => ({ ok: true }),
    teamLabel: (c) => c, teamShort: (c) => c,
  }, overrides || {});
}

// A minimal DOM stand-in — enough for the module's $()/innerHTML pattern to
// run without throwing, same spirit as test-fixtures-results-sync.js's
// window/document stubs.
function makeDom(){
  const store = {};
  return {
    getElementById: (id) => store[id] || (store[id] = { innerHTML:'', textContent:'', value:'', classList:{ add(){}, remove(){}, contains:()=>false }, style:{}, onclick:null, oninput:null, onchange:null }),
    addEventListener(){}, querySelectorAll: () => [], body: { style: {} }, baseURI: 'https://adhjrt.com/',
  };
}

async function loadWithApi(apiOverrides){
  const src = extractModuleScript();
  const fake = fakeApi(apiOverrides);
  const doc = makeDom();
  const win = { addEventListener(){}, matchMedia: () => ({ matches:false, addListener(){} }), scrollTo(){}, confirm: () => true };
  // eslint-disable-next-line no-new-func
  const fn = new Function('document', 'window', 'importApi', 'confirm',
    src.replace("await import('/scores-data.js')", 'importApi')
       .replace('"use strict";', '"use strict";\nwindow.__test = {};') +
    '\nwindow.__test = { S, viewToday, viewFixtures, viewResults, viewTables, boot, load, openMatch, findMatch };');
  await fn(doc, win, fake, win.confirm);
  return { doc, win };
}
```

- [ ] **Step 2: Write the checks**

```js
(async () => {
  section('Age-group scoping');
  {
    const { win } = await loadWithApi({ currentSession: () => ({ ageGroupId: 'u14b', token: 't' }) });
    await win.__test.boot();
    check('a u14b manager\'s dashboard loads u14b, not another group', win.__test.S.ageId === 'u14b');
  }
  {
    const { win } = await loadWithApi({ currentSession: () => ({ ageGroupId: 'u16b', token: 't' }) });
    await win.__test.boot();
    check('a u16b manager\'s dashboard loads u16b', win.__test.S.ageId === 'u16b');
  }

  section('Today tab');
  {
    const { win } = await loadWithApi();
    await win.__test.boot();
    const html = win.__test.viewToday();
    check('shows the unplayed match as next up', html.includes('Next up') && html.includes('ADH1'));
  }

  section('Fixtures tab groups by pool');
  {
    const { win } = await loadWithApi();
    await win.__test.boot();
    const html = win.__test.viewFixtures();
    check('shows the pool heading', html.includes('Pool A'));
    check('shows both pool matches', (html.match(/mrow/g) || []).length === 2);
  }

  section('Results tab shows only played matches');
  {
    const { win } = await loadWithApi();
    await win.__test.boot();
    const html = win.__test.viewResults();
    check('shows the played match score', html.includes('15') && html.includes('10'));
    check('does not show the unplayed match as a result row', !html.includes('09:00'));
  }

  section('Tables tab');
  {
    const { win } = await loadWithApi();
    await win.__test.boot();
    const html = win.__test.viewTables();
    check('shows the pool table', html.includes('Pool A') && html.includes('DS1'));
  }

  summary('test-manager-dashboard.js');
})();
```

- [ ] **Step 3: Run and fix any harness issues**

Run: `node tests/test-manager-dashboard.js`
This is the step most likely to need iteration — the extraction/mock approach needs to actually match how `Manager.html`'s script is structured after Tasks 3-7 land. Expected once stable: all checks passing.

- [ ] **Step 4: Prove each check against a real injected fault**

For each check, edit the real logic in `Manager.html` to break exactly what that check claims to guard, confirm the test fails, revert. Concretely:
- "a u14b manager's dashboard loads u14b, not another group": temporarily hardcode `agId` in `boot()` to always use `S.ageGroups[0].id` regardless of session — confirm the u16b-manager check now fails.
- "shows the unplayed match as next up": temporarily change `viewToday`'s `all.find(m => !m.result)` to `all.find(m => m.result)` — confirm it now shows the wrong match.
- "does not show the unplayed match as a result row": temporarily remove the `.filter(m => m.result)` in `viewResults` — confirm the unplayed match's time now leaks into the list.
- Repeat for the remaining checks, following the same pattern already established in `_prove-registration.js` and documented in `claude/state-of-play.md`'s "mistakes worth remembering".

- [ ] **Step 5: Add to `runall.ps1`**

Add `'test-manager-dashboard.js'` to the `$tests` array.

- [ ] **Step 6: Run the full suite**

Confirm all pre-existing files still pass (2,012/2,012 + the two new files' checks), and `_prove-registration.js` still reports 228/228.

- [ ] **Step 7: Commit**

---

### Task 9: Sanity checks that don't fit a Node test — real device/viewport verification

**Files:** none changed — this is verification only.

- [ ] **Step 1: Headless Chromium screenshot at desktop and phone widths**

Following this project's own established pattern for layout-dependent changes ("build a standalone HTML reproduction... screenshot it with Playwright/headless Chromium... at both a normal desktop width AND a phone width" — `claude/state-of-play.md`), render `/manager` (signed in as a test manager, via a local preview or the pushed `dev` branch's Netlify deploy preview) at 1280px and 390px. Confirm the tab bar doesn't overflow, the score-entry sheet is usable one-handed on the narrow width, and the Tables tab's PF/PA columns hide below 430px same as `/app`'s.

- [ ] **Step 2: Confirm `/app` is untouched**

Diff `app.html` against `origin/dev` before this branch's work started (excluding Task 1's `isOrganiser`/`canScore` change, which is the one deliberate, behaviour-preserving edit to that file). Confirm nothing else in `app.html` moved.

- [ ] **Step 3: SHA-256/tree-hash verification, sandbox vs `cafnet`**

Per `claude/writing-to-github-from-claude.md`: before any commit lands, confirm every changed/created file (`scores-data.js`, `app.html`, `netlify.toml`, `Manager.html`, `tests/test-session-permissions.js`, `tests/test-manager-dashboard.js`, `tests/runall.ps1`) hashes identically between the sandbox and Jay's `cafnet` PC.

---

### Task 10: Push to `dev`, Jay's review, and rollout

This task has no code changes — it's the review/rollout checkpoint, written in plain language for Jay per this project's convention.

- [ ] **Step 1: In GitHub — push everything to `dev`** (free, no credits). Confirm the full test suite passed on both the sandbox and the `cafnet` PC first.

- [ ] **Step 2: In GitHub — show Jay the diff** (a compare link, same pattern as the `design/team-codes-everywhere` branch: `github.com/jayjmuir-hub/adhjrt/compare/main...dev`) and a plain-language summary of what changed: a new page at `/manager`, nothing removed from `/app`, one small shared-logic move in `scores-data.js` that doesn't change how `/app` behaves.

- [ ] **Step 3: In Netlify — Jay tries the real `/manager` page** on the `dev` branch's deploy (or a PR preview, same free-preview pattern already used elsewhere on this project) using a real or test manager account. Checklist to hand him: sign in works; Today shows the next match; Fixtures & scoring lets him enter and save a score; Results shows it; Tables recomputes; Clear result works; nothing on `/app` looks different from before.

- [ ] **Step 4: In GitHub — once Jay says merge, fast-forward `dev` into `main`** (`git checkout main && git merge --ff-only dev && git push origin main`), the standard 15-credit push, same as every other merge on this project. Confirm the tree hash matches before and after.

- [ ] **Step 5: Update the project docs.** Write a `claude/state-of-play.md` entry (and a `claude/changelog.md` entry with the full build/verification detail) recording: `/manager` merged and live, `/app`'s manager sign-in still present and untouched, and that removing it from `/app`'s More tab is a deliberate, separate, not-yet-scheduled follow-up per the approved spec.
