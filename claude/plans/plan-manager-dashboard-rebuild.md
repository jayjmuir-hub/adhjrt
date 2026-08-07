# Manager Dashboard Rebuild (onto the component engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the manager dashboard as a new file `Manager.dc.html` on the same `.dc.html` reactive-component engine `Organizer.dc.html` and `Scores & Standings.dc.html` already use, matching Organizer's actual dark design system, and only repoint `/manager` to it after full parity testing and a human walkthrough.

**Architecture:** `Manager.dc.html` is a single `<x-dc>` document: a declarative template using `{{ }}` bindings, `<sc-if>` and `<sc-for>`, plus one `<script type="text/x-dc">` block defining `class Component extends DCLogic` whose `this.state` / `this.setState()` drive everything and whose `renderVals()` returns the flat object the template binds against. All data still comes from `scores-data.js` through the identical exported functions the current `Manager.html` calls — no backend, no signature, and no `Manager.html` changes. `Manager.html` keeps serving `/manager` untouched for the whole build; the swap is one final, human-gated task.

**Tech Stack:** Plain HTML, no build step; `support.js` DC runtime (`DCLogic`, `renderVals()`, `<sc-if>`, `<sc-for>`); ES module `scores-data.js`; Node-based tests in `tests/` driven by `tests/_lib.js` and listed in `tests/runall.ps1`; Netlify redirects in `netlify.toml`.

## Global Constraints

- No changes to `scores-data.js` function signatures, `manager-login.js`, or any other backend file.
- `Manager.html` is not deleted or repointed until parity testing is complete AND a human has done a live walkthrough — this is a hard gate on the LAST task only.
- `Organizer.dc.html`'s own existing tabs/functionality are not modified beyond adding the one new nav link.
- Work happens on `dev`, never directly to `main`.
- Every git write goes through the device-bridge method in `claude/writing-to-github-from-claude.md`, with a tree-hash verification before/after push.
- Full existing suite (2,265 checks / 228 injected faults as of the uniform draw editor work) must keep passing unchanged throughout every task, plus new checks on top.
- Every new test assertion must be proven against a real injected fault, not just a check that the change was applied.

---

## Shared reference — names this plan fixes once

Every task below consumes these. They are defined here so no task has to guess what an earlier one called something.

**New files created by this plan**

| Path | Created by | Purpose |
|---|---|---|
| `tests/test-organizer-manager-link.js` | Task 1 | Proves Organizer's header links to `/manager` |
| `Manager.dc.html` | Task 3 | The rebuilt dashboard |
| `tests/test-manager-dc.js` | Task 3 | Shell, login, tab bar, Today/Fixtures/Results/Tables/Registrations parity |
| `tests/test-manager-dc-score-sheet.js` | Task 4 | Score-entry parity (walkover, 0-0, live totals) |
| `tests/test-manager-dc-draw.js` | Task 9 | Draw-tab parity |

**`Manager.dc.html` state keys** (all declared in Task 3's `state = { ... }`, later tasks only read/write them)

```
api, session, ageGroups, ageId, tab,
loginUser, loginPass, loginError, loginBusy,
fixtures, standings, spiritAward,
draw, drawLoadedFor, drawBusy, drawMsg, drawDirty, picked, newTeamDrafts,
importOpen, importMode, importRows, importNote,
clash, clashBusy,
regs, regSearch,
sheetMatchId, sheetDraft, sheetError, sheetBusy,
modal, modalValue, toast
```

**`Manager.dc.html` method names** (task that introduces each in brackets)

`componentDidMount` [3], `doLogin` [3], `doLogout` [3], `boot` [3], `go` [3], `load` [3],
`ageName` [3], `tName` [3], `tShort` [8], `confirmModal` [3], `promptModal` [3], `closeModal` [3], `submitModal` [3], `showToast` [3],
`findMatch` [4], `openMatch` [4], `closeSheet` [4], `setSheetField` [4], `setSheetWalkover` [4], `sheetTotal` [4], `saveSheet` [4], `doSaveSheet` [4], `clearSheet` [4],
`matchRows` [5],
`loadDraw` [9], `clearDrawPicks` [9], `clearDrawTransientState` [9], `pickTeam` [9], `sameSource` [9], `removeFromSource` [9], `placeTeam` [9], `addPool` [9], `onRenamePool` [9], `onRemovePool` [9], `onNewTeamInput` [9], `onAddTeam` [9], `onRenameTeam` [9], `onRemoveTeam` [9],
`poolPitchOf` [10], `onBoxTap` [10], `addSlot` [10], `removeSlot` [10], `regeneratePool` [10], `onSlotTimeChange` [10], `onSlotPitchChange` [10], `addKnockoutSlot` [10], `removeKnockoutSlot` [10], `onRenameKnockoutRound` [10], `onKnockoutTimeChange` [10], `onKnockoutPitchChange` [10], `regenerateKnockout` [10], `generateFinals` [10], `clearKnockout` [10], `saveDraw` [10], `discardDraw` [10], `resetDraw` [10],
`importHasResults` [11], `importSourceTeams` [11], `teamNamesFromRegistrations` [11], `openImport` [11], `buildImportRows` [11], `setImportMode` [11], `setImportRowPool` [11], `confirmImport` [11], `cancelImport` [11],
`runWeekendCheck` [12], `doPublish` [12], `doUnpublish` [12], `checkWeekend` [12], `clashUnplacedSummary` [12],
`loadRegistrations` [11], `regNarrow` [13], `regKeyOf` [13], `regParseRoster` [13], `regRows` [13], `onRegSearch` [13],
`renderVals` [3, extended by 4-13].

**`scores-data.js` functions consumed (signatures confirmed against the file — never changed)**

```
loadVenue()                              loadScoringRules()
login(username, password)                currentSession()            logout()
isOrganiserSession(s)                    canScoreAgeGroup(s, agId)
getAgeGroups()                           getFixtures(agId)           getStandings(agId)
teamLabel(code, agId)                    teamShort(code)             teamKey(agId)
scoringFor(ageGroupId)                   scoreLabel(k)               scorePoints(k)
scoreTotal(ageGroupId, parts)
submitResult(matchId, data, session)     clearResult(matchId, session)
supportsSpiritAward(agId)                getSpiritAward(agId)
getDraw(agId, session)                   saveDraw(agId, draw, session)
publishDraw(agId, session)               unpublishDraw(agId, session)
canPublishNow(session, publishState)     pitchesForAgeGroup(agId)
regeneratePoolSlots(agId, poolId, teams) autoKnockoutSlots(agId, session)
slotLengthMins()                         dayStartMins()
timeToMinutes(hhmm)                      minutesToTimeInput(mins)    minutesToDisplay(mins)
loadAllDraws(session)                    weekendClashes(drawsByAge, ageNames)   describeClash(c)
getMyRegistrations(session)
```

**Organizer's design values `Manager.dc.html` must match exactly**

| Thing | Value |
|---|---|
| Page background / ink | `#0C0C0E` / `#fff`, `font-family:'Barlow',system-ui,sans-serif` |
| Page shell | `max-width:1300px;margin:0 auto;padding:28px 24px 80px` |
| Card | `background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px` |
| Login card | `max-width:400px;background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:36px` |
| Header rule | `border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:20px` |
| Brand tile | `40px`, `border-radius:9px`, `linear-gradient(135deg,#E11B22 0 50%,#17A34A 50% 100%)` |
| Heading | `font-family:'Anton';font-size:22px;letter-spacing:.5px` (page), `17px`/`18px` uppercase (section) |
| Kicker | `font-size:11px;letter-spacing:2px;color:#3bd070;font-weight:700` |
| Header link | `font-size:13px;font-weight:700;color:#aeb4bf;border-left:1px solid rgba(255,255,255,0.15);padding-left:14px` |
| Tab strip | `display:flex;gap:8px;margin-top:24px;background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:5px;width:fit-content` |
| Tab button base | `font-weight:700;font-size:14px;padding:9px 18px;border:none;border-radius:9px;cursor:pointer;white-space:nowrap;` |
| Tab on / off | `background:#E11B22;color:#fff;` / `background:transparent;color:#aeb4bf;` |
| Input | `background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:11px 14px;color:#fff;font-size:14px` |
| Label | `font-size:11px;font-weight:700;color:#7f8794;letter-spacing:.5px` |
| Muted / secondary text | `#7f8794` / `#aeb4bf` |
| Primary / success button | `#E11B22` / `#17A34A`, `color:#fff;font-weight:800;border:none;border-radius:10px;cursor:pointer;text-transform:uppercase` |
| Error text / box | `#ff6b6b` / `background:rgba(225,27,34,0.12);border:1px solid rgba(225,27,34,0.4)` |
| Success text | `#3bd070` |
| Warning text / box | `#f5c518` / `background:rgba(245,197,24,0.09);border:1px solid rgba(245,197,24,0.32)` |

---

## Task 1 — Failing test for the Organizer → Manager nav link

**Files**
- Create: `tests/test-organizer-manager-link.js`
- Modify: `tests/runall.ps1`
- Test: `tests/test-organizer-manager-link.js`

**Interfaces**
- Consumes: `tests/_lib.js` exports `readRepo(relPath)`, `section(name)`, `check(label, cond, detail)`, `summary(fileLabel)`.
- Produces: a runnable test file that FAILS until Task 2 lands. No new source interfaces.

**Steps**

- [ ] 1. Create `tests/test-organizer-manager-link.js` with exactly this content:

```js
/* tests/test-organizer-manager-link.js
   ------------------------------------------------------------------------
   Organizer.dc.html's dashboard header already carries a "← Main site" link
   back to the public site. Manager.html carries the same link the other way.
   Nothing links Organizer → the manager area, so an organiser who wants the
   manager dashboard has to type the URL.

   These are markup assertions on the real file (same approach
   tests/test-venue-map.js uses for Organizer's own markup) — there is no
   behaviour to drive here, the link is a plain anchor.
*/
const { readRepo, section, check, summary } = require('./_lib');

const html = readRepo('Organizer.dc.html');
const DASH = '<!-- ===================== DASHBOARD ===================== -->';
const TABS = '<!-- tabs -->';
const loginPart = html.slice(0, html.indexOf(DASH));
const header = html.slice(html.indexOf(DASH), html.indexOf(TABS));

section('Organizer dashboard header links to the Manager area');
{
  check('the dashboard header contains a link whose href is /manager',
    /href="\/manager"/.test(header));
  check('the link is labelled "View Manager Area"',
    />View Manager Area</.test(header));
  check('it sits after the existing "← Main site" link, not before it',
    header.indexOf('← Main site') > -1
    && header.indexOf('View Manager Area') > header.indexOf('← Main site'));
  check('it uses the same muted header-link colour as "← Main site"',
    /href="\/manager"[^>]*color:#aeb4bf/.test(header));
  check('it uses the same left-rule separator as "← Main site"',
    /href="\/manager"[^>]*border-left:1px solid rgba\(255,255,255,0\.15\)/.test(header));
}

section('Nothing else in Organizer.dc.html changed');
{
  check('the existing "← Main site" header link is still there',
    /href="Quins JRT\.dc\.html"[^>]*>← Main site</.test(header));
  check('no /manager link was added to the logged-out login card',
    !/href="\/manager"/.test(loginPart));
  check('the five existing dashboard tabs are still present',
    /showTeams/.test(html) && /showPlayers/.test(html) && /showAccounts/.test(html)
    && /showVenue/.test(html) && /showRegistration/.test(html));
}

summary('test-organizer-manager-link.js');
```

- [ ] 2. Register it in `tests/runall.ps1` — inside the `$tests = @( ... )` array, add the new entry after `'test-scores-draw-editor.js'`:

```powershell
  'test-scores-draw-editor.js',
  'test-organizer-manager-link.js'
)
```

- [ ] 3. Verify it FAILS for the right reason. Run:

```
node tests/test-organizer-manager-link.js
```

Expected: the five checks in the first section fail (`href="/manager"` does not exist yet); the three checks in the second section pass. Confirm the failure text names the `/manager` href check — if instead it throws on `html.indexOf(DASH)` returning `-1`, the comment banner text was mistyped; fix the constant, do not weaken the check.

- [ ] 4. Confirm the rest of the suite is untouched:

```
powershell tests/runall.ps1
```

Everything except `test-organizer-manager-link.js` must pass exactly as before.

- [ ] 5. Commit on `dev` (sandbox side first, for the tree hash):

```
git checkout dev
git add tests/test-organizer-manager-link.js tests/runall.ps1
git commit -F commitmsg.txt   # "Add failing test for an Organizer → Manager area nav link"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files` the two files to the PC, and on the PC:

```
git fetch origin --prune
git checkout dev
git add tests/test-organizer-manager-link.js tests/runall.ps1
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash above
git push origin dev
```

---

## Task 2 — Add the "View Manager Area" link to Organizer.dc.html

**Files**
- Modify: `Organizer.dc.html`
- Test: `tests/test-organizer-manager-link.js` (from Task 1)

**Interfaces**
- Consumes: Task 1's `tests/test-organizer-manager-link.js`; `netlify.toml`'s existing `/manager` redirect (which currently points at `Manager.html` and is NOT touched by this task).
- Produces: an `<a href="/manager">View Manager Area</a>` inside `Organizer.dc.html`'s logged-in dashboard header. Nothing else consumes it.

**Steps**

- [ ] 1. Open `Organizer.dc.html` and find this exact existing line inside the `<sc-if value="{{ loggedIn }}">` dashboard header (it is the "← Main site" anchor, immediately after the brand `<a href="Quins JRT.dc.html">` block and immediately before `</div>` closing the left-hand header group):

```html
          <a href="Quins JRT.dc.html" style="font-size:13px;font-weight:700;color:#aeb4bf;border-left:1px solid rgba(255,255,255,0.15);padding-left:14px;transition:color .18s ease" style-hover="color:#fff">← Main site</a>
```

- [ ] 2. Insert this new line directly AFTER it (same indentation, same styling vocabulary, so the two links read as one set):

```html
          <a href="/manager" style="font-size:13px;font-weight:700;color:#aeb4bf;border-left:1px solid rgba(255,255,255,0.15);padding-left:14px;transition:color .18s ease" style-hover="color:#fff">View Manager Area</a>
```

`/manager` is the route, not `Manager.html`, deliberately: the route is what survives Task 15 repointing it at `Manager.dc.html`, so this link never has to be edited again.

- [ ] 3. Verify the test now PASSES:

```
node tests/test-organizer-manager-link.js
```

All eight checks must pass.

- [ ] 4. Prove the assertions against a real injected fault. Temporarily change the new line's href from `/manager` to `/managers`:

```html
          <a href="/managers" style="font-size:13px;font-weight:700;color:#aeb4bf;border-left:1px solid rgba(255,255,255,0.15);padding-left:14px;transition:color .18s ease" style-hover="color:#fff">View Manager Area</a>
```

Run `node tests/test-organizer-manager-link.js` — the "href is /manager", "same muted header-link colour" and "same left-rule separator" checks must FAIL. Revert the fault back to `/manager` and confirm all eight pass again.

- [ ] 5. Second injected fault, proving the placement check is real. Temporarily move the new anchor ABOVE the "← Main site" anchor, run `node tests/test-organizer-manager-link.js`, and confirm the "sits after the existing '← Main site' link" check FAILS. Move it back below and confirm all eight pass.

- [ ] 6. Confirm nothing else regressed:

```
powershell tests/runall.ps1
```

The whole suite passes, including `test-organizer-manager-link.js`.

- [ ] 7. Commit on `dev`:

```
git checkout dev
git add Organizer.dc.html
git commit -F commitmsg.txt   # "Organizer: add a View Manager Area link to the dashboard header"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files` `Organizer.dc.html` to the PC, and on the PC:

```
git fetch origin --prune
git checkout dev
git add Organizer.dc.html
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash
git push origin dev
```

- [ ] 8. Free preview check: open the PR/branch preview for `dev`, sign in to `/organizer`, and confirm the "View Manager Area" link appears next to "← Main site" and lands on the existing `Manager.html`-backed `/manager` page. This link is finished; nothing later in this plan changes it.

## Task 3 — `Manager.dc.html` skeleton: component shell, login screen, tab bar, Organizer CSS

**Files**
- Create: `Manager.dc.html`
- Create: `tests/test-manager-dc.js`
- Modify: `tests/runall.ps1`
- Test: `tests/test-manager-dc.js`

**Interfaces**
- Consumes: `support.js` (`DCLogic`, `renderVals()`, `<sc-if>`, `<sc-for>`); `scores-data.js` — `loadVenue()`, `loadScoringRules()`, `login(username, password)`, `currentSession()`, `logout()`, `isOrganiserSession(s)`, `getAgeGroups()`, `getFixtures(agId)`, `getStandings(agId)`, `teamLabel(code, agId)`.
- Produces:
  - `Manager.dc.html` with `class Component extends DCLogic`, the full `state` object listed in the Shared reference, and methods `componentDidMount()`, `componentWillUnmount()`, `boot()`, `doLogin()`, `doLogout()`, `go(tab)`, `load(agId)`, `ageName(id)`, `tName(code)`, `confirmModal(message, onConfirm, opts)`, `promptModal(title, defaultValue, onConfirm)`, `closeModal()`, `submitModal()`, `showToast(msg)`, `renderVals()`.
  - Module-scope const `MANAGER_TABS = [{id,label}...]` with ids `today`, `fixtures`, `results`, `tables`, `draw`, `registrations`.
  - `renderVals()` keys: `loggedOut`, `loggedIn`, `loginUser`, `loginPass`, `loginError`, `loginBusy`, `loginLabel`, `onLoginUser`, `onLoginPass`, `onLoginKey`, `onLogin`, `onLogout`, `sessionName`, `sessionRole`, `ageLabel`, `tabs[]` (`{id,label,style,onPick}`), `isToday`, `isFixtures`, `isResults`, `isTables`, `isDraw`, `isRegistrations`, `hasToast`, `toast`, `modalOpen`, `modalTitle`, `modalIsPrompt`, `modalValue`, `modalOkLabel`, `onModalValue`, `onModalOk`, `onModalCancel`.
  - `tests/test-manager-dc.js` exporting nothing but providing the harness pattern (`class DCLogic` stand-in, `loadComponent(file)`, `build(file, props)`, `fakeApi(overrides)`, `buildManager(apiOverrides)`) that Tasks 4-13 extend.

**Steps**

- [ ] 1. Write the failing test file `tests/test-manager-dc.js`. This is the `.dc.html` harness pattern (from `tests/test-scores-draw-editor.js`), NOT `test-manager-dashboard.js`'s module-eval pattern:

```js
/* tests/test-manager-dc.js
   ------------------------------------------------------------------------
   Parity tests for Manager.dc.html — the rebuild of Manager.html onto the
   .dc.html component engine. The OLD file and its tests
   (tests/test-manager-dashboard.js) stay in place and keep passing until the
   rollout task; these prove the NEW file behaves the same.

   Harness: the .dc.html pattern (a DCLogic stand-in, regex the
   <script type="text/x-dc"> block out, eval it, instantiate Component) —
   the same one tests/test-scores-draw-editor.js and
   tests/test-fixtures-results-sync.js use. Deliberately duplicated per test
   file, matching this project's established convention.
*/
const { readRepo, section, check, eq, summary } = require('./_lib');

class DCLogic {
  setState(patch, cb) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    if (typeof cb === 'function') cb();
  }
}

function loadComponent(file) {
  const t = readRepo(file);
  const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`no x-dc script found in ${file}`);
  // eslint-disable-next-line no-new-func
  return new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
    DCLogic,
    { addEventListener() {}, matchMedia: () => ({ matches: false, addListener() {} }), scrollTo() {} },
    { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], body: { style: {} }, baseURI: 'https://adhjrt.com/' }
  );
}

function build(file, props) {
  const C = loadComponent(file);
  const c = new C();
  c.props = props || {};
  return c;
}

/* The same fake API surface tests/test-manager-dashboard.js uses against the
   OLD file, so a parity check compares like with like. u6 sorts first and is
   a festival group (hasStandings:false) so the organiser fallback test really
   exercises the hasStandings-aware branch. */
function fakeApi(overrides) {
  return Object.assign({
    loadVenue: async () => {},
    loadScoringRules: async () => {},
    getAgeGroups: async () => [
      { id: 'u6', name: 'U6', hasStandings: false },
      { id: 'u14b', name: 'U14 Boys', hasStandings: true },
      { id: 'u16b', name: 'U16 Boys', hasStandings: true },
    ],
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
    getDraw: async (agId) => ({
      pools: [{ id: 'A', name: 'Pool A', teams: ['ADH1', 'DE1', 'DS1'] }],
      slots: [{ id: `${agId}:A:0`, poolId: 'A', home: 'ADH1', away: 'DE1', startMins: 480, pitch: 'A1' }],
      knockout: [], pitches: ['A1', 'A2'],
      _publish: { published: false, publishedAt: null, publishedBy: null, managerCanPublishNow: false },
    }),
    pitchesForAgeGroup: () => ['A1', 'A2'],
    minutesToDisplay: (m) => `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`,
    minutesToTimeInput: (m) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`,
    timeToMinutes: (hhmm) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
      if (!m) return NaN;
      return Number(m[1]) * 60 + Number(m[2]);
    },
    slotLengthMins: () => 20,
    dayStartMins: () => 8 * 60,
    regeneratePoolSlots: (agId, poolId, teams) => (teams || []).slice(0, -1).map((t, i) => ({
      id: `${agId}:${poolId}:regen${i}`, poolId, home: t, away: teams[i+1] || '', startMins: 8*60 + i*20, pitch: 'TBD',
    })),
    autoKnockoutSlots: async () => [],
    saveDraw: async () => ({ ok: true }),
    getMyRegistrations: async () => ({ teams: [], players: [], scope: '' }),
    canPublishNow: () => false,
    publishDraw: async () => ({ ok: true, published: true }),
    unpublishDraw: async () => ({ ok: true, published: false }),
    loadAllDraws: async () => ({ drawsByAge: {}, ageNames: {}, failed: [] }),
    weekendClashes: () => ({ clashes: [], unplaced: [], offAllocation: [], placedCount: 0 }),
    describeClash: () => '',
    scoringFor: () => ['tries'],
    scoreLabel: (k) => k, scorePoints: () => 5, scoreTotal: () => 0,
    supportsSpiritAward: () => false,
    getSpiritAward: async () => ({ supported: false }),
    submitResult: async () => ({ ok: true, stored: { homeScore: 5, awayScore: 0 } }),
    clearResult: async () => ({ ok: true }),
    teamLabel: (c) => c, teamShort: (c) => c,
  }, overrides || {});
}

/* componentDidMount() does a dynamic import() of scores-data.js, which a Node
   test cannot resolve — so the api is injected directly, exactly the way
   tests/test-scores-draw-editor.js injects state.api, and boot() (which is
   what componentDidMount calls once the import lands) is driven by hand. */
function buildManager(apiOverrides) {
  const c = build('Manager.dc.html');
  c.state = { ...c.state, api: fakeApi(apiOverrides) };
  return c;
}

async function main() {

section('Boot and age-group scoping');
{
  const c = buildManager({ currentSession: () => ({ ageGroupId: 'u14b', token: 't' }) });
  const landed = await c.boot();
  check('a u14b manager\'s dashboard loads u14b, not another group', c.state.ageId === 'u14b');
  check('boot() reports that it landed on the dashboard', landed === true);
  check('the session is stored in state', !!c.state.session);
}
{
  const c = buildManager({ currentSession: () => ({ ageGroupId: 'u16b', token: 't' }) });
  await c.boot();
  check('a u16b manager\'s dashboard loads u16b', c.state.ageId === 'u16b');
}
{
  // The fixture's getAgeGroups() returns u6 (hasStandings:false) FIRST, so
  // landing on u14b only passes if the fallback is hasStandings-aware rather
  // than "index 0" — an organiser stuck on a non-competitive festival group
  // has no age-group switcher to escape with.
  const c = buildManager({
    currentSession: () => ({ isOrganizer: true, ageGroupId: '*', token: 't' }),
    isOrganiserSession: (s) => !!(s && s.isOrganizer),
  });
  await c.boot();
  check('an organiser session falls back to the first COMPETITIVE age group, not the festival group at index 0',
    c.state.ageId === 'u14b');
}
{
  // A session whose age group is no longer in the live config must be signed
  // out, not shown a dashboard for a group that isn't there.
  let loggedOut = 0;
  const c = buildManager({
    currentSession: () => ({ ageGroupId: 'u99', token: 't' }),
    logout: () => { loggedOut++; },
  });
  const landed = await c.boot();
  check('an unknown age group signs the session out', loggedOut === 1);
  check('…and leaves no session in state', c.state.session === null);
  check('…and boot() reports it did NOT land on the dashboard', landed === false);
  check('…and says why, in the toast', /age group is not set up/i.test(c.state.toast));
}
{
  const c = buildManager({ currentSession: () => null });
  const landed = await c.boot();
  check('no session at all leaves the login screen up', landed === false && c.state.session === null);
}

section('Login screen');
{
  const c = buildManager({ currentSession: () => null });
  await c.boot();
  const vals = c.renderVals();
  check('the login screen is what renders with no session', vals.loggedOut === true && vals.loggedIn === false);

  c.setState({ loginUser: '', loginPass: '' });
  await c.doLogin();
  check('an empty form is refused with a message, without calling the API',
    c.state.loginError === 'Enter your username and password.');
}
{
  let calledWith = null;
  const c = buildManager({
    currentSession: () => null,
    login: async (u, p) => { calledWith = [u, p]; return { ok: false, error: 'Wrong username or password.' }; },
  });
  c.setState({ loginUser: '  mgr-u14b  ', loginPass: 'secret' });
  await c.doLogin();
  check('the username is trimmed before it is sent', eq('login args', calledWith, ['mgr-u14b', 'secret']));
  check('a rejected login shows the server\'s message', c.state.loginError === 'Wrong username or password.');
  check('…and the login screen stays up', !c.state.session);
  check('…and the button goes back to its idle label', c.renderVals().loginLabel === 'Sign in');
}
{
  // A successful login must run the SAME boot() the page load runs — and must
  // only say "Signed in" when boot() actually landed on the dashboard.
  let sessionNow = null;
  const c = buildManager({
    currentSession: () => sessionNow,
    login: async () => { sessionNow = { ageGroupId: 'u14b', token: 't' }; return { ok: true }; },
  });
  c.setState({ loginUser: 'mgr', loginPass: 'pw' });
  await c.doLogin();
  check('a successful login lands on the dashboard', !!c.state.session && c.state.ageId === 'u14b');
  check('…and confirms it', c.state.toast === 'Signed in');
  check('…and clears the typed password out of state', c.state.loginPass === '');
}
{
  // FAULT-PROOF for the "landed" contract: login succeeds but the account's
  // age group does not exist, so boot() bounces back to the login screen. The
  // "Signed in" toast must NOT stomp the explanation.
  let sessionNow = null;
  const c = buildManager({
    currentSession: () => sessionNow,
    login: async () => { sessionNow = { ageGroupId: 'u99', token: 't' }; return { ok: true }; },
  });
  c.setState({ loginUser: 'mgr', loginPass: 'pw' });
  await c.doLogin();
  check('a login whose age group is missing does not claim "Signed in"', c.state.toast !== 'Signed in');
  check('…it explains the real problem instead', /age group is not set up/i.test(c.state.toast));
}

section('Tab bar');
{
  const c = buildManager();
  await c.boot();
  const vals = c.renderVals();
  check('all six tabs are offered', eq('tab ids', vals.tabs.map((t) => t.id),
    ['today', 'fixtures', 'results', 'tables', 'draw', 'registrations']));
  check('their labels match the old dashboard', eq('tab labels', vals.tabs.map((t) => t.label),
    ['Today', 'Fixtures & scoring', 'Results', 'Tables', 'Draw', 'Registrations']));
  check('Today is the tab you land on', vals.isToday === true);
  check('the selected tab uses Organizer\'s red pill style',
    vals.tabs[0].style.includes('background:#E11B22;color:#fff;'));
  check('an unselected tab uses Organizer\'s transparent style',
    vals.tabs[1].style.includes('background:transparent;color:#aeb4bf;'));

  vals.tabs[3].onPick();
  const vals2 = c.renderVals();
  check('tapping a tab switches to it', c.state.tab === 'tables' && vals2.isTables === true);
  check('…and only that tab is active', vals2.isToday === false && vals2.isFixtures === false
    && vals2.isResults === false && vals2.isDraw === false && vals2.isRegistrations === false);
}

section('Sign out');
{
  const c = buildManager();
  await c.boot();
  c.go('tables');
  let loggedOut = 0;
  c.state.api.logout = () => { loggedOut++; };
  c.doLogout();
  check('sign out calls api.logout()', loggedOut === 1);
  check('…drops the session', c.state.session === null);
  check('…drops the loaded fixtures and standings', c.state.fixtures === null && c.state.standings === null);
  check('…and returns to the Today tab for the next person on this device', c.state.tab === 'today');
  check('…and says so', c.state.toast === 'Signed out');
}

section('In-app confirm/prompt modal (window.confirm is blocked in the DC preview iframe)');
{
  const c = buildManager();
  await c.boot();
  let confirmed = 0;
  c.confirmModal('Really?', () => { confirmed++; });
  check('confirmModal opens a confirm-kind modal', c.state.modal && c.state.modal.kind === 'confirm');
  check('…carrying the message', c.renderVals().modalTitle === 'Really?');
  c.submitModal();
  check('confirming runs the callback', confirmed === 1);
  check('…and closes the modal', c.state.modal === null);

  let confirmed2 = 0;
  c.confirmModal('Really?', () => { confirmed2++; });
  c.closeModal();
  check('cancelling does NOT run the callback', confirmed2 === 0 && c.state.modal === null);

  let got = null;
  c.promptModal('Rename pool', 'Pool A', (v) => { got = v; });
  check('promptModal seeds the input with the current value', c.state.modalValue === 'Pool A');
  c.setState({ modalValue: '  Pool Z  ' });
  c.submitModal();
  check('the prompt result is trimmed', got === 'Pool Z');

  let got2 = 'untouched';
  c.promptModal('Rename pool', 'Pool A', (v) => { got2 = v; });
  c.setState({ modalValue: '   ' });
  c.submitModal();
  check('a blank prompt answer does not call back at all', got2 === 'untouched');
}

section('Organizer design system is what this page uses');
{
  const html = readRepo('Manager.dc.html');
  check('page background is Organizer\'s #0C0C0E, not app.html\'s paper', /background:#0C0C0E/.test(html));
  check('cards use Organizer\'s #151517 fill', /background:#151517/.test(html));
  check('cards use Organizer\'s 1px hairline border', /border:1px solid rgba\(255,255,255,0\.1\)/.test(html));
  check('cards use Organizer\'s 14px radius', /border-radius:14px/.test(html));
  check('headings use Anton', /font-family:'Anton'/.test(html));
  check('body type is Barlow', /font-family:'Barlow',system-ui,sans-serif/.test(html));
  check('the shell uses Organizer\'s 1300px max width and padding',
    /max-width:1300px;margin:0 auto;padding:28px 24px 80px/.test(html));
  // FAULT-PROOF against a CSS-reskin shortcut: app.html's light palette
  // variables must NOT have been copied across the way Manager.html copied them.
  check('app.html\'s --paper/--card CSS variables were NOT copied in', !/--paper:#F3F1ED/.test(html));
  check('there is no borrowed app.html :root variable block at all', !/--red-deep:#A81219/.test(html));
}

section('It is a real component, not a script tag in disguise');
{
  const html = readRepo('Manager.dc.html');
  check('it has an <x-dc> block', /<x-dc>/.test(html));
  check('it loads support.js', /src="\.\/support\.js"/.test(html));
  check('its logic is a text/x-dc script', /<script type="text\/x-dc"/.test(html));
  check('it defines class Component extends DCLogic', /class Component extends DCLogic/.test(html));
  check('it uses sc-if for the login/dashboard split', /<sc-if value="\{\{ loggedOut \}\}"/.test(html) && /<sc-if value="\{\{ loggedIn \}\}"/.test(html));
  check('it renders the tab strip with sc-for', /<sc-for list="\{\{ tabs \}\}"/.test(html));
  check('there is no plain <script type="module"> page script', !/<script type="module">/.test(html));
}

summary('tests/test-manager-dc.js');
}

main();
```

- [ ] 2. Register the new test in `tests/runall.ps1`, after `'test-organizer-manager-link.js'`:

```powershell
  'test-organizer-manager-link.js',
  'test-manager-dc.js'
)
```

- [ ] 3. Verify it fails for the right reason:

```
node tests/test-manager-dc.js
```

Expected: it throws `Could not find the adhjrt clone` only if `_lib` is misconfigured; otherwise it throws from `readRepo('Manager.dc.html')` — `ENOENT`, the file does not exist yet. That is the correct starting failure.

- [ ] 4. Create `Manager.dc.html` — the document shell and template:

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<meta name="robots" content="noindex, nofollow">
<title>Manager — ADH JRT</title>
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0C0C0E">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ADH JRT">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
</script>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Barlow',system-ui,sans-serif;background:#0C0C0E;color:#fff;-webkit-font-smoothing:antialiased}
  input,select,button{font-family:inherit}
  table{border-collapse:collapse}
</style>
</helmet>

<div style="min-height:100vh">

  <!-- ===================== LOGIN ===================== -->
  <sc-if value="{{ loggedOut }}" hint-placeholder-val="{{ true }}">
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">
      <div style="width:100%;max-width:400px;background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:36px">
        <a href="Quins JRT.dc.html" style="display:flex;align-items:center;gap:12px;margin-bottom:6px;color:#fff">
          <div style="width:36px;height:36px;border-radius:8px;overflow:hidden;position:relative;flex:none">
            <div style="position:absolute;inset:0;background:linear-gradient(135deg,#E11B22 0 50%,#17A34A 50% 100%)"></div>
          </div>
          <div style="font-family:'Anton';font-size:22px;letter-spacing:.5px">ADH JRT</div>
        </a>
        <div style="font-family:'Anton';font-size:28px;text-transform:uppercase;margin-top:14px">Manager sign in</div>
        <p style="color:#aeb4bf;font-size:14px;margin-top:6px">Scores, fixtures and your age group's draw, in one place.</p>

        <label style="font-size:11px;font-weight:700;color:#7f8794;letter-spacing:.5px;display:block;margin-top:22px">USERNAME</label>
        <input value="{{ loginUser }}" onInput="{{ onLoginUser }}" style="width:100%;margin:6px 0 16px;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:12px 14px;color:#fff;font-size:15px">
        <label style="font-size:11px;font-weight:700;color:#7f8794;letter-spacing:.5px;display:block">PASSWORD</label>
        <input type="password" value="{{ loginPass }}" onInput="{{ onLoginPass }}" onKeyDown="{{ onLoginKey }}" style="width:100%;margin:6px 0 16px;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:12px 14px;color:#fff;font-size:15px">
        <sc-if value="{{ loginError }}" hint-placeholder-val=""><div style="color:#ff6b6b;font-size:14px;font-weight:600;margin-bottom:14px">{{ loginError }}</div></sc-if>
        <button onClick="{{ onLogin }}" disabled="{{ loginBusy }}" style="width:100%;background:#E11B22;color:#fff;font-weight:800;font-size:16px;letter-spacing:.5px;padding:13px;border:none;border-radius:10px;cursor:pointer;text-transform:uppercase">{{ loginLabel }}</button>
        <p style="margin-top:18px;font-size:13px;color:#7f8794;line-height:1.6">Use the account you created with your age group invite code. An organiser account also works here.</p>
      </div>
    </div>
  </sc-if>

  <!-- ===================== DASHBOARD ===================== -->
  <sc-if value="{{ loggedIn }}" hint-placeholder-val="{{ false }}">
    <div style="max-width:1300px;margin:0 auto;padding:28px 24px 80px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:20px">
        <div style="display:flex;align-items:center;gap:14px">
          <a href="Quins JRT.dc.html" style="display:flex;align-items:center;gap:14px;color:#fff">
            <div style="width:40px;height:40px;border-radius:9px;overflow:hidden;position:relative;flex:none">
              <div style="position:absolute;inset:0;background:linear-gradient(135deg,#E11B22 0 50%,#17A34A 50% 100%)"></div>
            </div>
            <div style="line-height:1">
              <div style="font-family:'Anton';font-size:22px;letter-spacing:.5px">ADH JRT · MANAGER</div>
              <div style="font-size:11px;letter-spacing:2px;color:#3bd070;font-weight:700;margin-top:3px">{{ ageLabel }}</div>
            </div>
          </a>
          <a href="Quins JRT.dc.html" style="font-size:13px;font-weight:700;color:#aeb4bf;border-left:1px solid rgba(255,255,255,0.15);padding-left:14px;transition:color .18s ease" style-hover="color:#fff">← Main site</a>
        </div>
        <div style="display:flex;align-items:center;gap:14px">
          <div style="text-align:right;line-height:1.3">
            <div style="font-weight:700;font-size:14px">{{ sessionName }}</div>
            <div style="font-size:12px;color:#7f8794">{{ sessionRole }}</div>
          </div>
          <button onClick="{{ onLogout }}" style="background:transparent;border:1px solid rgba(255,255,255,0.25);color:#fff;font-weight:700;padding:9px 18px;border-radius:9px;cursor:pointer;white-space:nowrap">Sign out</button>
        </div>
      </div>

      <!-- tabs -->
      <div style="display:flex;gap:8px;margin-top:24px;background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:5px;width:fit-content;flex-wrap:wrap">
        <sc-for list="{{ tabs }}" as="t" hint-placeholder-count="6">
          <button onClick="{{ t.onPick }}" style="{{ t.style }}">{{ t.label }}</button>
        </sc-for>
      </div>

      <!-- TAB BODIES. Each placeholder card below is replaced wholesale by the
           task that owns that tab: Today (Task 4), Fixtures & scoring (Task 5),
           Results (Task 7), Tables (Task 8), Draw (Tasks 9-12),
           Registrations (Task 13). -->
      <sc-if value="{{ isToday }}" hint-placeholder-val="{{ true }}">
        <div style="margin-top:24px;background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px">
          <div style="font-family:'Anton';font-size:17px;text-transform:uppercase">Today</div>
        </div>
      </sc-if>
      <sc-if value="{{ isFixtures }}" hint-placeholder-val="{{ false }}">
        <div style="margin-top:24px;background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px">
          <div style="font-family:'Anton';font-size:17px;text-transform:uppercase">Fixtures &amp; scoring</div>
        </div>
      </sc-if>
      <sc-if value="{{ isResults }}" hint-placeholder-val="{{ false }}">
        <div style="margin-top:24px;background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px">
          <div style="font-family:'Anton';font-size:17px;text-transform:uppercase">Results</div>
        </div>
      </sc-if>
      <sc-if value="{{ isTables }}" hint-placeholder-val="{{ false }}">
        <div style="margin-top:24px;background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px">
          <div style="font-family:'Anton';font-size:17px;text-transform:uppercase">Tables</div>
        </div>
      </sc-if>
      <sc-if value="{{ isDraw }}" hint-placeholder-val="{{ false }}">
        <div style="margin-top:24px;background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px">
          <div style="font-family:'Anton';font-size:17px;text-transform:uppercase">Draw</div>
        </div>
      </sc-if>
      <sc-if value="{{ isRegistrations }}" hint-placeholder-val="{{ false }}">
        <div style="margin-top:24px;background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px">
          <div style="font-family:'Anton';font-size:17px;text-transform:uppercase">Registrations</div>
        </div>
      </sc-if>
    </div>
  </sc-if>

  <!-- ===================== MODAL ===================== -->
  <sc-if value="{{ modalOpen }}" hint-placeholder-val="{{ false }}">
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:24px;z-index:60">
      <div style="width:100%;max-width:480px;background:#151517;border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:22px">
        <div style="font-size:15px;line-height:1.6;white-space:pre-wrap;color:#fff">{{ modalTitle }}</div>
        <sc-if value="{{ modalIsPrompt }}" hint-placeholder-val="{{ false }}">
          <input value="{{ modalValue }}" onInput="{{ onModalValue }}" style="width:100%;margin-top:14px;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:11px 14px;color:#fff;font-size:14px">
        </sc-if>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
          <button onClick="{{ onModalCancel }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#aeb4bf;font-weight:700;font-size:13px;padding:10px 16px;border-radius:9px;cursor:pointer">Cancel</button>
          <button onClick="{{ onModalOk }}" style="background:#E11B22;color:#fff;font-weight:800;font-size:13px;padding:10px 18px;border:none;border-radius:9px;cursor:pointer;text-transform:uppercase">{{ modalOkLabel }}</button>
        </div>
      </div>
    </div>
  </sc-if>

  <!-- ===================== TOAST ===================== -->
  <sc-if value="{{ hasToast }}" hint-placeholder-val="{{ false }}">
    <div style="position:fixed;left:50%;transform:translateX(-50%);bottom:28px;background:#151517;border:1px solid rgba(255,255,255,0.15);color:#fff;padding:12px 20px;border-radius:100px;font-weight:600;font-size:14px;z-index:80;box-shadow:0 12px 32px rgba(0,0,0,0.5);max-width:88vw;text-align:center;line-height:1.35">{{ toast }}</div>
  </sc-if>

</div>
</x-dc>
</body>
</html>
```

- [ ] 5. Add the `<script type="text/x-dc">` logic block, immediately before `</x-dc>`:

```html
<script type="text/x-dc" data-dc-script data-props="{&quot;$preview&quot;:{}}">
/* The six tabs, in the order the old Manager.html showed them. */
const MANAGER_TABS = [
  { id: 'today', label: 'Today' },
  { id: 'fixtures', label: 'Fixtures & scoring' },
  { id: 'results', label: 'Results' },
  { id: 'tables', label: 'Tables' },
  { id: 'draw', label: 'Draw' },
  { id: 'registrations', label: 'Registrations' },
];

class Component extends DCLogic {
  state = {
    api: null, session: null, ageGroups: [], ageId: '', tab: 'today',
    loginUser: '', loginPass: '', loginError: '', loginBusy: false,
    fixtures: null, standings: null, spiritAward: null,
    /* draw is `undefined` before the first fetch, `null` both while a fetch is
       in flight AND after a settled fetch that legitimately found no draw
       (getDraw() answers null when nothing is saved) — drawLoadedFor is what
       tells those two apart. */
    draw: undefined, drawLoadedFor: null, drawBusy: false, drawMsg: '', drawDirty: false,
    picked: null, newTeamDrafts: {},
    importOpen: false, importMode: 'add', importRows: null, importNote: '',
    clash: null, clashBusy: false,
    regs: undefined, regSearch: '',
    sheetMatchId: null, sheetDraft: {}, sheetError: '', sheetBusy: false,
    modal: null, modalValue: '', toast: '',
  };

  async componentDidMount() {
    const api = await import(new URL('scores-data.js', document.baseURI).href);
    await api.loadVenue();
    /* Live scoring rules decide which inputs the score form offers. Without
       this a manager sees the hardcoded defaults from scores-data.js instead
       of any organiser customization, and can submit a score the server
       (which uses the live rules) silently disagrees with. */
    if (api.loadScoringRules) { try { await api.loadScoringRules(); } catch (e) {} }
    this.setState({ api }, () => { this.boot(); });
  }

  componentWillUnmount() { if (this._toastT) clearTimeout(this._toastT); }

  /* Returns true when boot() actually landed on the dashboard, false when it
     left the login screen up (no session, or an unusable one). doLogin() uses
     this to decide whether "Signed in" is still an honest thing to say. */
  async boot() {
    const { api } = this.state;
    const session = api.currentSession();
    if (!session) { this.setState({ session: null }); return false; }
    const ageGroups = await api.getAgeGroups();
    const agId = api.isOrganiserSession(session) ? null : session.ageGroupId;
    if (agId && !ageGroups.some((a) => a.id === agId)) {
      /* An old account whose group is gone from the live config. A manager
         dashboard has no "browse a different group" affordance to fall back
         into, so signing out is the honest outcome. */
      api.logout();
      this.setState({ session: null, ageGroups });
      this.showToast('Your account’s age group is not set up yet — contact an organiser.');
      return false;
    }
    /* An organiser/'*' session has no age group of its own. ageGroups[0] is
       whatever sorts first, which can be a festival group (hasStandings:false)
       — and there is no switcher here to escape it with. Prefer the first
       competitive group, index 0 only as a last resort. */
    const ageId = agId || (session.ageGroupId === '*'
      ? ((ageGroups.find((a) => a.hasStandings) || ageGroups[0] || {}).id)
      : session.ageGroupId);
    this.setState({ session, ageGroups, ageId });
    await this.load(ageId);
    return true;
  }

  async doLogin() {
    const { api } = this.state;
    const u = (this.state.loginUser || '').trim();
    const p = this.state.loginPass || '';
    if (!u || !p) { this.setState({ loginError: 'Enter your username and password.' }); return; }
    this.setState({ loginBusy: true, loginError: '' });
    const r = await api.login(u, p);
    if (!r.ok) {
      this.setState({ loginBusy: false, loginError: r.error || 'Wrong username or password.' });
      return;
    }
    this.setState({ loginBusy: false, loginPass: '', loginError: '' });
    const landed = await this.boot();
    if (landed) this.showToast('Signed in');
  }

  doLogout() {
    this.state.api.logout();
    this.setState({
      session: null, tab: 'today', fixtures: null, standings: null, spiritAward: null,
      draw: undefined, drawLoadedFor: null, drawDirty: false, drawMsg: '', drawBusy: false,
      picked: null, newTeamDrafts: {},
      importOpen: false, importMode: 'add', importRows: null, importNote: '',
      clash: null, clashBusy: false,
      regs: undefined, regSearch: '',
      sheetMatchId: null, sheetDraft: {}, sheetError: '',
      loginUser: '', loginPass: '', loginError: '',
    });
    this.showToast('Signed out');
  }

  go(tab) { this.setState({ tab }); }

  async load(agId) {
    const { api } = this.state;
    this.setState({ ageId: agId, fixtures: null, standings: null, spiritAward: null });
    const [fx, st] = await Promise.all([api.getFixtures(agId), api.getStandings(agId)]);
    if (this.state.ageId !== agId) return; // a stale response for a group we left
    this.setState({ fixtures: fx, standings: st });
  }

  ageName(id) {
    const found = (this.state.ageGroups || []).find((a) => a.id === id);
    return (found && found.name) || id || '';
  }
  tName(code) {
    const { api, ageId } = this.state;
    return (api && api.teamLabel ? api.teamLabel(code, ageId) : code) || code || '';
  }

  /* ---- the in-app dialog ----------------------------------------------
     window.confirm / window.prompt are silently blocked inside the DC
     preview's sandboxed iframe: they return null/false immediately, so any
     code relying on them looks like it "does nothing". Same reasoning, same
     shape as Scores & Standings.dc.html's confirmModal/promptModal. */
  confirmModal(message, onConfirm, opts) {
    this.setState({ modal: { kind: 'confirm', title: message, onConfirm, ...(opts || {}) } });
  }
  promptModal(title, defaultValue, onConfirm) {
    this.setState({ modal: { kind: 'prompt', title, onConfirm }, modalValue: defaultValue || '' });
  }
  closeModal() { this.setState({ modal: null, modalValue: '' }); }
  submitModal() {
    const { modal, modalValue } = this.state;
    if (!modal) return;
    if (modal.kind === 'prompt') {
      const trimmed = (modalValue || '').trim();
      this.closeModal();
      if (trimmed) modal.onConfirm(trimmed);
    } else {
      this.closeModal();
      modal.onConfirm();
    }
  }

  showToast(msg) {
    this.setState({ toast: msg });
    if (this._toastT) clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.setState({ toast: '' }), 2600);
  }

  renderVals() {
    const s = this.state;
    const tabBase = 'font-weight:700;font-size:14px;padding:9px 18px;border:none;border-radius:9px;cursor:pointer;white-space:nowrap;';
    const tabOn = tabBase + 'background:#E11B22;color:#fff;';
    const tabOff = tabBase + 'background:transparent;color:#aeb4bf;';
    return {
      loggedOut: !s.session, loggedIn: !!s.session,
      loginUser: s.loginUser, loginPass: s.loginPass, loginError: s.loginError,
      loginBusy: s.loginBusy, loginLabel: s.loginBusy ? 'Signing in…' : 'Sign in',
      onLoginUser: (e) => this.setState({ loginUser: e.target.value }),
      onLoginPass: (e) => this.setState({ loginPass: e.target.value }),
      onLoginKey: (e) => { if (e.key === 'Enter') this.doLogin(); },
      onLogin: () => this.doLogin(),
      onLogout: () => this.doLogout(),

      sessionName: (s.session && (s.session.username || s.session.name)) || '',
      sessionRole: (s.session && s.session.ageGroupId === '*') ? 'Organiser' : 'Age group manager',
      ageLabel: this.ageName(s.ageId),

      tabs: MANAGER_TABS.map((t) => ({
        id: t.id, label: t.label,
        style: s.tab === t.id ? tabOn : tabOff,
        onPick: () => this.go(t.id),
      })),
      isToday: s.tab === 'today', isFixtures: s.tab === 'fixtures',
      isResults: s.tab === 'results', isTables: s.tab === 'tables',
      isDraw: s.tab === 'draw', isRegistrations: s.tab === 'registrations',

      modalOpen: !!s.modal,
      modalTitle: (s.modal && s.modal.title) || '',
      modalIsPrompt: !!(s.modal && s.modal.kind === 'prompt'),
      modalValue: s.modalValue,
      modalOkLabel: (s.modal && s.modal.okLabel) || 'OK',
      onModalValue: (e) => this.setState({ modalValue: e.target.value }),
      onModalOk: () => this.submitModal(),
      onModalCancel: () => this.closeModal(),

      hasToast: !!s.toast, toast: s.toast,
    };
  }
}
</script>
```

- [ ] 6. Verify the tests now pass:

```
node tests/test-manager-dc.js
```

All checks pass.

- [ ] 7. Prove the assertions against real injected faults, one at a time, reverting each before the next:

  (a) In `boot()`, change the organiser fallback to `ageGroups[0]`:
  ```js
    const ageId = agId || (session.ageGroupId === '*' ? ((ageGroups[0] || {}).id) : session.ageGroupId);
  ```
  Run the test — "falls back to the first COMPETITIVE age group" must FAIL (it lands on `u6`). Revert.

  (b) In `boot()`, delete the `api.logout();` line in the unknown-age-group branch. Run — "an unknown age group signs the session out" must FAIL. Revert.

  (c) In `doLogin()`, change the last two lines to `await this.boot(); this.showToast('Signed in');`. Run — "a login whose age group is missing does not claim Signed in" must FAIL. Revert.

  (d) In `submitModal()`, drop the `if (trimmed)` guard so it always calls back. Run — "a blank prompt answer does not call back at all" must FAIL. Revert.

  (e) In `renderVals()`, change `tabOn` to `tabBase + 'background:#17A34A;color:#fff;'`. Run — "the selected tab uses Organizer's red pill style" must FAIL. Revert.

- [ ] 8. Confirm the whole suite, including the untouched old-file tests:

```
powershell tests/runall.ps1
```

`test-manager-dashboard.js` must still pass unchanged — `Manager.html` has not been touched.

- [ ] 9. Commit on `dev`:

```
git checkout dev
git add Manager.dc.html tests/test-manager-dc.js tests/runall.ps1
git commit -F commitmsg.txt   # "Manager.dc.html: component shell, login, tab bar on Organizer's design system"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files` the three files, and on the PC:

```
git fetch origin --prune
git checkout dev
git add Manager.dc.html tests/test-manager-dc.js tests/runall.ps1
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash
git push origin dev
```

`netlify.toml` is NOT touched — `/manager` still serves `Manager.html`. The new file is reachable on the preview at `/Manager.dc.html` for eyeballing.

## Task 4 — The score-entry sheet: walkover, 0-0 confirmation, live totals

This is the highest-risk port in the plan: currently-working logic being re-expressed in `this.state`/`setState`. It gets its own task and its own test file, and every behaviour below is proven against an injected fault.

**Files**
- Modify: `Manager.dc.html`
- Create: `tests/test-manager-dc-score-sheet.js`
- Modify: `tests/runall.ps1`
- Test: `tests/test-manager-dc-score-sheet.js`

**Interfaces**
- Consumes: Task 3's state keys `api`, `session`, `ageId`, `fixtures`, `sheetMatchId`, `sheetDraft`, `sheetError`, `sheetBusy`; Task 3's `load(agId)`, `tName(code)`, `confirmModal(message, onConfirm, opts)`, `showToast(msg)`. From `scores-data.js`: `scoringFor(ageGroupId)`, `scoreLabel(k)`, `scorePoints(k)`, `scoreTotal(ageGroupId, parts)`, `supportsSpiritAward(agId)`, `submitResult(matchId, data, session)`, `clearResult(matchId, session)`.
- Produces: methods `findMatch(id)`, `openMatch(id)`, `closeSheet()`, `setSheetField(field, val)`, `setSheetWalkover(val)`, `sheetTotal(side)`, `saveSheet()`, `doSaveSheet()`, `clearSheet()`. `renderVals()` keys `sheetOpen`, `sheetTitle`, `sheetMeta`, `sheetHasResult`, `sheetResultLine`, `sheetHomeName`, `sheetAwayName`, `sheetHomeFields[]` / `sheetAwayFields[]` (each `{key,label,pts,value,disabled,opacity,onInput}`), `sheetHomeTotal`, `sheetAwayTotal`, `sheetHomeCards`, `sheetAwayCards`, `onSheetHomeCards`, `onSheetAwayCards`, `sheetWalkover`, `woNoneStyle`, `woHomeStyle`, `woAwayStyle`, `onWoNone`, `onWoHome`, `onWoAway`, `sheetShowSpirit`, `sheetSpiritHome`, `sheetSpiritAway`, `onSheetSpiritHome`, `onSheetSpiritAway`, `sheetSaveLabel`, `sheetError`, `sheetBusy`, `onSheetSave`, `onSheetClear`, `onSheetClose`.
- The draft's field names are the SAME strings the server payload uses (`homeTries`, `awayConversions`, `homeCards`, `walkover`, `spiritNomineeHome`, …), so `doSaveSheet()` is a copy, not a translation.

**Steps**

- [ ] 1. Write the failing test file `tests/test-manager-dc-score-sheet.js`:

```js
/* tests/test-manager-dc-score-sheet.js
   ------------------------------------------------------------------------
   The score-entry sheet on Manager.dc.html, ported from Manager.html's
   openMatch(). This is the riskiest port in the rebuild — walkover handling,
   the 0-0 confirmation and the live running total are all currently-working
   logic being re-expressed in this.state/setState — so it gets its own file
   and every check below is proven against an injected fault.

   Harness: the .dc.html pattern (DCLogic stand-in + regex the
   <script type="text/x-dc"> block out and eval it), duplicated per test file
   as this project does throughout.
*/
const { readRepo, section, check, eq, summary } = require('./_lib');

class DCLogic {
  setState(patch, cb) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    if (typeof cb === 'function') cb();
  }
}

function loadComponent(file) {
  const t = readRepo(file);
  const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`no x-dc script found in ${file}`);
  // eslint-disable-next-line no-new-func
  return new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
    DCLogic,
    { addEventListener() {}, matchMedia: () => ({ matches: false, addListener() {} }), scrollTo() {} },
    { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], body: { style: {} }, baseURI: 'https://adhjrt.com/' }
  );
}

function build(file, props) {
  const C = loadComponent(file);
  const c = new C();
  c.props = props || {};
  return c;
}

/* Two scoring parts, with REAL point weights, so the running total is a
   calculation with a knowable answer rather than a constant. */
const POINTS = { tries: 5, conversions: 2 };

function sheetApi(overrides) {
  return Object.assign({
    scoringFor: () => ['tries', 'conversions'],
    scoreLabel: (k) => ({ tries: 'Tries', conversions: 'Conversions' })[k] || k,
    scorePoints: (k) => POINTS[k] || 0,
    scoreTotal: (agId, parts) => ['tries', 'conversions']
      .reduce((sum, k) => sum + Math.max(0, Math.floor(Number((parts || {})[k]) || 0)) * POINTS[k], 0),
    supportsSpiritAward: () => false,
    submitResult: async () => ({ ok: true, stored: { homeScore: 17, awayScore: 0 } }),
    clearResult: async () => ({ ok: true }),
    teamLabel: (c) => c,
    getFixtures: async () => FIXTURES(),
    getStandings: async () => ({ awaitingPublication: false, ageGroup: { hasStandings: true, name: 'U14 Boys' }, pools: [], tables: {}, _advance: 0 }),
    getSpiritAward: async () => ({ supported: false }),
  }, overrides || {});
}

function FIXTURES() {
  return {
    awaitingPublication: false,
    pool: [
      { id: 'u14b:A:1-2', home: 'ADH1', away: 'DE1', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: null },
      { id: 'u14b:A:3-4', home: 'DS1', away: 'DT1', time: '09:20', pitch: 'A1', poolName: 'Pool A',
        result: { homeScore: 17, awayScore: 5, homeTries: 3, homeConversions: 1, awayTries: 1, awayConversions: 0,
                  homeCards: 1, awayCards: 0, walkover: null, spiritNomineeHome: 'Sam Jones', spiritNomineeAway: '' } },
    ],
    knockout: [
      { id: 'u14b:CUP', round: 'Cup Final', home: 'ADH1', away: 'DS1', time: '13:00', pitch: 'A1', result: null },
    ],
  };
}

function buildSheet(apiOverrides) {
  const c = build('Manager.dc.html');
  c.state = {
    ...c.state,
    api: sheetApi(apiOverrides),
    session: { ageGroupId: 'u14b', token: 'tok' },
    ageGroups: [{ id: 'u14b', name: 'U14 Boys', hasStandings: true }],
    ageId: 'u14b',
    fixtures: FIXTURES(),
    tab: 'fixtures',
  };
  return c;
}

async function main() {

section('openMatch(): the sheet opens on the right match, seeded from the saved result');
{
  const c = buildSheet();
  c.openMatch('u14b:A:3-4');
  check('the sheet is open on that match', c.state.sheetMatchId === 'u14b:A:3-4');
  // FAULT-PROOF: a port that opened the sheet with a blank draft would still
  // "work" visually but would silently zero a saved score on the next save.
  check('home tries are seeded from the saved result', Number(c.state.sheetDraft.homeTries) === 3);
  check('home conversions are seeded from the saved result', Number(c.state.sheetDraft.homeConversions) === 1);
  check('away tries are seeded from the saved result', Number(c.state.sheetDraft.awayTries) === 1);
  check('cards are seeded from the saved result', Number(c.state.sheetDraft.homeCards) === 1);
  check('the spirit nomination is seeded from the saved result', c.state.sheetDraft.spiritNomineeHome === 'Sam Jones');

  const vals = c.renderVals();
  check('renderVals reports the sheet as open', vals.sheetOpen === true);
  check('the sheet names both teams', vals.sheetHomeName === 'DS1' && vals.sheetAwayName === 'DT1');
  check('an already-scored match offers "Update result"', vals.sheetSaveLabel === 'Update result');
}
{
  const c = buildSheet();
  c.openMatch('u14b:A:1-2');
  check('an unplayed match starts at zero', Number(c.state.sheetDraft.homeTries) === 0 && Number(c.state.sheetDraft.awayTries) === 0);
  check('…and offers "Save result"', c.renderVals().sheetSaveLabel === 'Save result');
  check('…with no walkover selected', c.state.sheetDraft.walkover === '');
}
{
  const c = buildSheet();
  c.openMatch('u14b:CUP');
  check('a knockout match can be opened too', c.state.sheetMatchId === 'u14b:CUP');
  c.openMatch('u14b:NOT-A-MATCH');
  check('an unknown match id leaves the open sheet alone rather than blanking it', c.state.sheetMatchId === 'u14b:CUP');
}

section('Live total recalculation');
{
  const c = buildSheet();
  c.openMatch('u14b:A:1-2');
  check('both totals start at 0', c.sheetTotal('home') === 0 && c.sheetTotal('away') === 0);

  const vals = c.renderVals();
  const homeTries = vals.sheetHomeFields.find((f) => f.key === 'homeTries');
  check('the sheet builds one input per scoring part from api.scoringFor()',
    eq('home field keys', vals.sheetHomeFields.map((f) => f.key), ['homeTries', 'homeConversions']));
  check('each input carries its label and point value', homeTries.label === 'Tries' && homeTries.pts === '5 pts');

  homeTries.onInput({ target: { value: '3' } });
  // FAULT-PROOF on the arithmetic itself: 3 tries at 5 = 15, not 3 and not 0.
  check('typing 3 tries makes the home total 15', c.sheetTotal('home') === 15);
  c.renderVals().sheetHomeFields.find((f) => f.key === 'homeConversions').onInput({ target: { value: '1' } });
  check('adding a conversion makes it 17', c.sheetTotal('home') === 17);
  check('the away total is still 0 — the two sides do not share a draft', c.sheetTotal('away') === 0);
  check('renderVals publishes the recalculated total', c.renderVals().sheetHomeTotal === 17);

  c.renderVals().sheetAwayFields.find((f) => f.key === 'awayTries').onInput({ target: { value: '2' } });
  check('the away side totals independently', c.sheetTotal('away') === 10 && c.sheetTotal('home') === 17);
}

section('Walkover handling');
{
  const c = buildSheet();
  c.openMatch('u14b:A:1-2');
  c.renderVals().sheetHomeFields.find((f) => f.key === 'homeTries').onInput({ target: { value: '3' } });
  check('setup: home is on 15 before the walkover', c.sheetTotal('home') === 15);

  c.setSheetWalkover('home');
  check('a home walkover shows 20 for home', c.sheetTotal('home') === 20);
  check('…and 0 for away, whatever was typed', c.sheetTotal('away') === 0);

  const vals = c.renderVals();
  check('the scoring inputs are disabled while a walkover is set',
    vals.sheetHomeFields.every((f) => f.disabled === true) && vals.sheetAwayFields.every((f) => f.disabled === true));
  check('…and dimmed, the same visual cue the old sheet used',
    vals.sheetHomeFields.every((f) => f.opacity === '0.45'));
  check('the chosen walkover button is the highlighted one', vals.woHomeStyle.includes('#E11B22') && !vals.woAwayStyle.includes('#E11B22'));

  c.setSheetWalkover('away');
  check('switching to an away walkover flips the totals', c.sheetTotal('home') === 0 && c.sheetTotal('away') === 20);

  c.setSheetWalkover('');
  // FAULT-PROOF: a port that cleared the typed numbers when the walkover was
  // set would show 0 here instead of the 15 the manager actually typed.
  check('clearing the walkover restores the typed totals', c.sheetTotal('home') === 15);
  check('…and re-enables the inputs', c.renderVals().sheetHomeFields.every((f) => f.disabled === false));
}

section('The 0-0 confirmation');
{
  let submitted = 0;
  const c = buildSheet({ submitResult: async () => { submitted++; return { ok: true, stored: { homeScore: 0, awayScore: 0 } }; } });
  c.openMatch('u14b:A:1-2');
  c.saveSheet();
  // FAULT-PROOF: this is the whole point — an all-zero save must ASK first,
  // because 0-0 is a real draw worth two league points each, not "no result".
  check('saving an all-zero sheet asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…in words that say what 0-0 costs', /two league points/i.test(c.state.modal.title));
  check('…and points at Clear result for the other intent', /Clear result/i.test(c.state.modal.title));
  check('…and nothing has been submitted yet', submitted === 0);

  c.closeModal();
  check('cancelling the 0-0 question submits nothing', submitted === 0);
  check('…and leaves the sheet open so the score can be typed', c.state.sheetMatchId === 'u14b:A:1-2');

  c.saveSheet();
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('confirming the 0-0 question does submit', submitted === 1);
}
{
  let submitted = 0;
  const c = buildSheet({ submitResult: async () => { submitted++; return { ok: true, stored: { homeScore: 5, awayScore: 0 } }; } });
  c.openMatch('u14b:A:1-2');
  c.renderVals().sheetHomeFields.find((f) => f.key === 'homeTries').onInput({ target: { value: '1' } });
  c.saveSheet();
  await new Promise((r) => setImmediate(r));
  check('a non-zero score is saved without asking', c.state.modal === null && submitted === 1);
}
{
  let submitted = 0;
  const c = buildSheet({ submitResult: async () => { submitted++; return { ok: true, stored: { homeScore: 20, awayScore: 0 } }; } });
  c.openMatch('u14b:A:1-2');
  c.setSheetWalkover('home');
  c.saveSheet();
  await new Promise((r) => setImmediate(r));
  // FAULT-PROOF: a walkover IS an all-zero form, so a 0-0 check that ignored
  // the walkover flag would nag on every walkover ever recorded.
  check('a walkover is not mistaken for a 0-0 draw', c.state.modal === null && submitted === 1);
}
{
  let submitted = 0;
  const c = buildSheet({ submitResult: async () => { submitted++; return { ok: true, stored: { homeScore: 0, awayScore: 0 } }; } });
  c.openMatch('u14b:A:1-2');
  c.setSheetField('homeCards', '1');
  c.saveSheet();
  // FAULT-PROOF: cards are not points. A 0-0 with a yellow card is still a
  // 0-0 draw and must still be confirmed — a zero check that swept cards in
  // would skip the question.
  check('a card does not make an all-zero sheet count as scored', !!c.state.modal && submitted === 0);
}

section('The payload sent to submitResult()');
{
  let payload = null, sentId = null, sentSession = null;
  const c = buildSheet({
    supportsSpiritAward: () => true,
    submitResult: async (id, data, session) => { sentId = id; payload = data; sentSession = session; return { ok: true, stored: { homeScore: 17, awayScore: 5 } }; },
  });
  c.openMatch('u14b:A:3-4');
  c.setSheetField('homeTries', '3');
  c.setSheetField('homeConversions', '1');
  c.setSheetField('awayTries', '1');
  c.setSheetField('homeCards', '2');
  c.setSheetField('spiritNomineeHome', 'Sam Jones');
  await c.saveSheet();
  check('it posts against the match that is open', sentId === 'u14b:A:3-4');
  check('it passes the session through', sentSession && sentSession.token === 'tok');
  check('walkover is null, not the empty string, when none is set', payload.walkover === null);
  check('every scoring part is sent as a NUMBER, not the input\'s string',
    payload.homeTries === 3 && payload.homeConversions === 1 && payload.awayTries === 1
    && typeof payload.homeTries === 'number');
  check('cards are sent as numbers too', payload.homeCards === 2 && payload.awayCards === 0);
  check('the spirit nomination is sent when the age group supports it', payload.spiritNomineeHome === 'Sam Jones');
}
{
  let payload = null;
  const c = buildSheet({
    supportsSpiritAward: () => false,
    submitResult: async (id, data) => { payload = data; return { ok: true, stored: { homeScore: 5, awayScore: 0 } }; },
  });
  c.openMatch('u14b:A:1-2');
  c.setSheetField('homeTries', '1');
  await c.saveSheet();
  // FAULT-PROOF: the nomination fields must be gated on supportsSpiritAward(),
  // not sent unconditionally with empty strings.
  check('no spirit fields are sent when the age group does not support the award',
    payload.spiritNomineeHome === undefined && payload.spiritNomineeAway === undefined);
  check('the sheet does not offer the spirit inputs either', c.renderVals().sheetShowSpirit === false);
}
{
  const c = buildSheet({ supportsSpiritAward: () => true });
  c.openMatch('u14b:A:1-2');
  check('the sheet DOES offer the spirit inputs for a supporting age group', c.renderVals().sheetShowSpirit === true);
}
{
  let payload = null;
  const c = buildSheet({ submitResult: async (id, data) => { payload = data; return { ok: true, stored: { homeScore: 20, awayScore: 0 } }; } });
  c.openMatch('u14b:A:1-2');
  c.setSheetWalkover('away');
  await c.saveSheet();
  check('a walkover is sent as the side that was awarded the match', payload.walkover === 'away');
}

section('After a save');
{
  let loads = 0;
  const c = buildSheet({
    getFixtures: async () => { loads++; return FIXTURES(); },
    submitResult: async () => ({ ok: true, stored: { homeScore: 17, awayScore: 5 } }),
  });
  c.openMatch('u14b:A:1-2');
  c.setSheetField('homeTries', '3');
  await c.saveSheet();
  check('a saved sheet closes', c.state.sheetMatchId === null);
  // FAULT-PROOF: the toast must echo the SERVER's stored figures, not the
  // form's — that is the confirmation the score really landed.
  check('the toast echoes the score the server stored', c.state.toast === 'Saved 17–5');
  check('the tab data is refetched so tables and results catch up', loads === 1);
}
{
  const c = buildSheet({ submitResult: async () => ({ ok: true }) });
  c.openMatch('u14b:A:1-2');
  c.setSheetField('homeTries', '3');
  await c.saveSheet();
  check('a save with no stored echo still confirms something happened', c.state.toast === 'Result saved');
}
{
  let loads = 0;
  const c = buildSheet({
    getFixtures: async () => { loads++; return FIXTURES(); },
    submitResult: async () => ({ ok: false, error: 'You can only enter scores for your own age group.' }),
  });
  c.openMatch('u14b:A:1-2');
  c.setSheetField('homeTries', '3');
  await c.saveSheet();
  // FAULT-PROOF: a rejected save must NOT close the sheet — the manager would
  // otherwise believe a score they typed was saved.
  check('a rejected save leaves the sheet open', c.state.sheetMatchId === 'u14b:A:1-2');
  check('…shows the server\'s reason', c.state.sheetError === 'You can only enter scores for your own age group.');
  check('…keeps the typed numbers', Number(c.state.sheetDraft.homeTries) === 3);
  check('…and does not refetch as if something changed', loads === 0);
  check('…and the Save button is usable again', c.renderVals().sheetBusy === false);
}

section('Clear result');
{
  let cleared = 0, clearedId = null, loads = 0;
  const c = buildSheet({
    getFixtures: async () => { loads++; return FIXTURES(); },
    clearResult: async (id) => { cleared++; clearedId = id; return { ok: true }; },
  });
  c.openMatch('u14b:A:3-4');
  c.clearSheet();
  check('clearing asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…in words that say the match goes back to unplayed', /back to unplayed/i.test(c.state.modal.title));
  check('…and nothing is cleared until it is confirmed', cleared === 0);
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('confirming clears that match', cleared === 1 && clearedId === 'u14b:A:3-4');
  check('…closes the sheet', c.state.sheetMatchId === null);
  check('…says so', c.state.toast === 'Result cleared');
  check('…and refetches so the table is recalculated', loads === 1);
}
{
  const c = buildSheet({ clearResult: async () => ({ ok: false, error: 'Not signed in.' }) });
  c.openMatch('u14b:A:3-4');
  c.clearSheet();
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('a failed clear leaves the sheet open with the reason',
    c.state.sheetMatchId === 'u14b:A:3-4' && c.state.sheetError === 'Not signed in.');
}
{
  const c = buildSheet();
  c.openMatch('u14b:A:3-4');
  check('a scored match offers Clear result', c.renderVals().sheetHasResult === true);
  c.openMatch('u14b:A:1-2');
  // FAULT-PROOF: an unplayed match has nothing to clear; offering the button
  // there implies a result exists.
  check('an unplayed match does not', c.renderVals().sheetHasResult === false);
  c.closeSheet();
  check('closing the sheet drops the draft', c.state.sheetMatchId === null && c.state.sheetError === '');
}

summary('tests/test-manager-dc-score-sheet.js');
}

main();
```

- [ ] 2. Register it in `tests/runall.ps1`, after `'test-manager-dc.js'`:

```powershell
  'test-manager-dc.js',
  'test-manager-dc-score-sheet.js'
)
```

- [ ] 3. Run it and confirm it fails because the methods do not exist yet:

```
node tests/test-manager-dc-score-sheet.js
```

Expected: `TypeError: c.openMatch is not a function`.

- [ ] 4. Add the sheet logic to `Manager.dc.html`'s `<script type="text/x-dc">` block, after `load(agId)` and before `ageName(id)`:

```js
  findMatch(id) {
    const fx = this.state.fixtures;
    if (!fx) return null;
    return (fx.pool || []).concat(fx.knockout || []).find((x) => x.id === id) || null;
  }

  /* Opens the score sheet on one match, seeding the draft from whatever is
     already saved. The draft's field names ARE the server's payload names
     (homeTries, awayConversions, homeCards, walkover, spiritNomineeHome …),
     so doSaveSheet() below is a copy rather than a translation. */
  openMatch(id) {
    const m = this.findMatch(id);
    if (!m) return;
    const { api, ageId } = this.state;
    const r = m.result;
    const parts = api.scoringFor(ageId);
    const cap = (k) => k.charAt(0).toUpperCase() + k.slice(1);
    const draft = { walkover: (r && r.walkover) || '' };
    ['home', 'away'].forEach((side) => {
      parts.forEach((k) => { draft[side + cap(k)] = r ? Number(r[side + cap(k)] || 0) : 0; });
      draft[side + 'Cards'] = r ? Number(r[side + 'Cards'] || 0) : 0;
    });
    draft.spiritNomineeHome = (r && r.spiritNomineeHome) || '';
    draft.spiritNomineeAway = (r && r.spiritNomineeAway) || '';
    this.setState({ sheetMatchId: id, sheetDraft: draft, sheetError: '', sheetBusy: false });
  }

  closeSheet() { this.setState({ sheetMatchId: null, sheetDraft: {}, sheetError: '', sheetBusy: false }); }

  setSheetField(field, val) {
    this.setState((s) => ({ sheetDraft: { ...s.sheetDraft, [field]: val } }));
  }

  /* A walkover does NOT wipe the typed figures — it overrides the totals and
     disables the inputs. Clearing it again has to give the manager back what
     they typed, which it cannot do if the numbers were thrown away. */
  setSheetWalkover(val) {
    this.setState((s) => ({ sheetDraft: { ...s.sheetDraft, walkover: val } }));
  }

  sheetTotal(side) {
    const { api, ageId, sheetDraft } = this.state;
    const wo = sheetDraft.walkover;
    if (wo) return wo === side ? 20 : 0;
    const parts = api.scoringFor(ageId);
    const cap = (k) => k.charAt(0).toUpperCase() + k.slice(1);
    const o = {};
    parts.forEach((k) => { o[k] = Number(sheetDraft[side + cap(k)] || 0); });
    return api.scoreTotal(ageId, o);
  }

  /* 0-0 IS A REAL DRAW worth two league points each — it is not "no result".
     An all-zero save is therefore asked about rather than assumed, and the
     question names Clear result as the other thing the manager might mean.
     Cards are not points, so a card does not make a sheet count as scored. */
  saveSheet() {
    const { api, ageId, sheetDraft } = this.state;
    if (!sheetDraft.walkover) {
      const parts = api.scoringFor(ageId);
      const cap = (k) => k.charAt(0).toUpperCase() + k.slice(1);
      const zero = ['home', 'away'].every((side) => parts.every((k) => !Number(sheetDraft[side + cap(k)] || 0)));
      if (zero) {
        this.confirmModal(
          'Save this as a 0–0 draw? Both teams get two league points.\n\nTo remove the result instead, use Clear result.',
          () => this.doSaveSheet(), { okLabel: 'Save 0–0' });
        return;
      }
    }
    return this.doSaveSheet();
  }

  async doSaveSheet() {
    const { api, ageId, session, sheetMatchId, sheetDraft } = this.state;
    const parts = api.scoringFor(ageId);
    const cap = (k) => k.charAt(0).toUpperCase() + k.slice(1);
    const payload = { walkover: sheetDraft.walkover || null };
    ['home', 'away'].forEach((side) => {
      parts.forEach((k) => { payload[side + cap(k)] = Number(sheetDraft[side + cap(k)] || 0); });
    });
    payload.homeCards = Number(sheetDraft.homeCards || 0);
    payload.awayCards = Number(sheetDraft.awayCards || 0);
    if (api.supportsSpiritAward(ageId)) {
      payload.spiritNomineeHome = sheetDraft.spiritNomineeHome || '';
      payload.spiritNomineeAway = sheetDraft.spiritNomineeAway || '';
    }
    this.setState({ sheetBusy: true, sheetError: '' });
    const res = await api.submitResult(sheetMatchId, payload, session);
    if (!res.ok) {
      this.setState({ sheetBusy: false, sheetError: res.error || 'Could not save.' });
      return;
    }
    this.setState({ sheetBusy: false, sheetMatchId: null, sheetDraft: {}, sheetError: '' });
    /* Echo the SERVER's stored figures, not the form's — submit-result.js
       computes the totals and reads the write back before answering. */
    this.showToast(res.stored ? `Saved ${res.stored.homeScore}–${res.stored.awayScore}` : 'Result saved');
    await this.load(ageId);
  }

  /* Removing a result deletes it rather than saving zeros: 0-0 is a draw
     worth two league points each, so an emptied form saved as 0-0 would award
     points for a match nobody played. */
  clearSheet() {
    const { api, ageId, session, sheetMatchId } = this.state;
    this.confirmModal('Clear this result? The match goes back to unplayed and the pool table is recalculated.', async () => {
      this.setState({ sheetBusy: true, sheetError: '' });
      const res = await api.clearResult(sheetMatchId, session);
      if (!res.ok) { this.setState({ sheetBusy: false, sheetError: res.error || 'Could not clear.' }); return; }
      this.setState({ sheetBusy: false, sheetMatchId: null, sheetDraft: {}, sheetError: '' });
      this.showToast('Result cleared');
      await this.load(ageId);
    }, { okLabel: 'Clear result' });
  }
```

- [ ] 5. Extend `renderVals()`. Insert this block at the top of the method, after `const s = this.state;` and after the existing `tabOn`/`tabOff` constants:

```js
    const sheetMatch = s.sheetMatchId ? this.findMatch(s.sheetMatchId) : null;
    const sheetParts = (s.api && s.ageId && sheetMatch) ? s.api.scoringFor(s.ageId) : [];
    const cap = (k) => k.charAt(0).toUpperCase() + k.slice(1);
    const woOn = !!(s.sheetDraft && s.sheetDraft.walkover);
    const sheetFieldsFor = (side) => sheetParts.map((k) => ({
      key: side + cap(k),
      label: s.api.scoreLabel(k),
      pts: s.api.scorePoints(k) + ' pts',
      value: s.sheetDraft[side + cap(k)] != null ? s.sheetDraft[side + cap(k)] : 0,
      disabled: woOn,
      opacity: woOn ? '0.45' : '1',
      onInput: (e) => this.setSheetField(side + cap(k), e.target.value),
    }));
    const woBtn = (on) => 'font-weight:700;font-size:12px;padding:8px 14px;border-radius:8px;cursor:pointer;border:1px solid '
      + (on ? '#E11B22;background:#E11B22;color:#fff' : 'rgba(255,255,255,0.18);background:transparent;color:#cdd2da');
    const sheetR = sheetMatch && sheetMatch.result;
```

and add these keys to the returned object, after the `isRegistrations` line:

```js
      sheetOpen: !!sheetMatch,
      sheetTitle: sheetMatch ? 'Enter score' : '',
      sheetHomeName: sheetMatch ? (sheetMatch.home ? this.tName(sheetMatch.home) : 'Home') : '',
      sheetAwayName: sheetMatch ? (sheetMatch.away ? this.tName(sheetMatch.away) : 'Away') : '',
      sheetMeta: sheetMatch
        ? [sheetMatch.poolName || sheetMatch.round || '', sheetMatch.time || '', sheetMatch.pitch || 'Pitch TBD'].filter(Boolean).join(' · ')
        : '',
      sheetHasResult: !!sheetR,
      sheetResultLine: sheetR
        ? `${sheetR.homeScore} – ${sheetR.awayScore} · tries ${sheetR.homeTries || 0}–${sheetR.awayTries || 0}${sheetR.walkover ? ' · walk-over' : ''}`
        : '',
      sheetHomeFields: sheetFieldsFor('home'),
      sheetAwayFields: sheetFieldsFor('away'),
      sheetHomeTotal: sheetMatch ? this.sheetTotal('home') : 0,
      sheetAwayTotal: sheetMatch ? this.sheetTotal('away') : 0,
      sheetHomeCards: (s.sheetDraft && s.sheetDraft.homeCards) || 0,
      sheetAwayCards: (s.sheetDraft && s.sheetDraft.awayCards) || 0,
      onSheetHomeCards: (e) => this.setSheetField('homeCards', e.target.value),
      onSheetAwayCards: (e) => this.setSheetField('awayCards', e.target.value),
      sheetWalkover: (s.sheetDraft && s.sheetDraft.walkover) || '',
      woNoneStyle: woBtn(!woOn),
      woHomeStyle: woBtn(s.sheetDraft && s.sheetDraft.walkover === 'home'),
      woAwayStyle: woBtn(s.sheetDraft && s.sheetDraft.walkover === 'away'),
      onWoNone: () => this.setSheetWalkover(''),
      onWoHome: () => this.setSheetWalkover('home'),
      onWoAway: () => this.setSheetWalkover('away'),
      sheetShowSpirit: !!(s.api && s.ageId && sheetMatch && s.api.supportsSpiritAward(s.ageId)),
      sheetSpiritHome: (s.sheetDraft && s.sheetDraft.spiritNomineeHome) || '',
      sheetSpiritAway: (s.sheetDraft && s.sheetDraft.spiritNomineeAway) || '',
      onSheetSpiritHome: (e) => this.setSheetField('spiritNomineeHome', e.target.value),
      onSheetSpiritAway: (e) => this.setSheetField('spiritNomineeAway', e.target.value),
      sheetSaveLabel: s.sheetBusy ? 'Saving…' : (sheetR ? 'Update result' : 'Save result'),
      sheetError: s.sheetError, sheetBusy: s.sheetBusy,
      onSheetSave: () => this.saveSheet(),
      onSheetClear: () => this.clearSheet(),
      onSheetClose: () => this.closeSheet(),
```

- [ ] 6. Add the sheet's markup to the template, immediately BEFORE the `<!-- ===================== MODAL ===================== -->` block (so the 0-0 / clear confirm dialog draws on top of it):

```html
  <!-- ===================== SCORE SHEET ===================== -->
  <sc-if value="{{ sheetOpen }}" hint-placeholder-val="{{ false }}">
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow-y:auto;z-index:50">
      <div style="width:100%;max-width:560px;background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px">
        <div style="display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:14px">
          <div style="flex:1">
            <div style="font-family:'Anton';font-size:20px;text-transform:uppercase">{{ sheetTitle }}</div>
            <div style="font-size:13px;color:#aeb4bf;margin-top:2px">{{ sheetHomeName }} v {{ sheetAwayName }}</div>
            <div style="font-size:12px;color:#7f8794;margin-top:2px">{{ sheetMeta }}</div>
          </div>
          <button onClick="{{ onSheetClose }}" style="background:transparent;border:1px solid rgba(255,255,255,0.25);color:#aeb4bf;font-weight:700;font-size:13px;padding:8px 14px;border-radius:9px;cursor:pointer">Close</button>
        </div>

        <sc-if value="{{ sheetHasResult }}" hint-placeholder-val="{{ false }}">
          <div style="margin-top:14px;font-size:13px;color:#3bd070;font-weight:700">Saved: {{ sheetResultLine }}</div>
        </sc-if>
        <sc-if value="{{ sheetError }}" hint-placeholder-val="">
          <div style="margin-top:14px;background:rgba(225,27,34,0.12);border:1px solid rgba(225,27,34,0.4);border-radius:9px;padding:11px 13px;color:#ff8a8a;font-size:13px;font-weight:600">{{ sheetError }}</div>
        </sc-if>

        <div style="margin-top:16px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#0C0C0E;font-weight:700;font-size:14px">
            <span>{{ sheetHomeName }}</span><b style="font-family:'Anton';font-size:26px;color:#E11B22;line-height:1">{{ sheetHomeTotal }}</b>
          </div>
          <sc-for list="{{ sheetHomeFields }}" as="f" hint-placeholder-count="2">
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-top:1px solid rgba(255,255,255,0.08)">
              <label style="flex:1;font-size:13.5px;font-weight:600;color:#fff">{{ f.label }} <span style="color:#7f8794;font-weight:500;font-size:12px">{{ f.pts }}</span></label>
              <input type="number" inputmode="numeric" min="0" step="1" value="{{ f.value }}" onInput="{{ f.onInput }}" disabled="{{ f.disabled }}" style="width:88px;text-align:center;font-weight:700;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:10px;color:#fff;font-size:14px;opacity:{{ f.opacity }}">
            </div>
          </sc-for>
          <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-top:1px solid rgba(255,255,255,0.08)">
            <label style="flex:1;font-size:13.5px;font-weight:600;color:#fff">Cards</label>
            <input type="number" inputmode="numeric" min="0" step="1" value="{{ sheetHomeCards }}" onInput="{{ onSheetHomeCards }}" style="width:88px;text-align:center;font-weight:700;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:10px;color:#fff;font-size:14px">
          </div>
        </div>

        <div style="margin-top:14px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#0C0C0E;font-weight:700;font-size:14px">
            <span>{{ sheetAwayName }}</span><b style="font-family:'Anton';font-size:26px;color:#E11B22;line-height:1">{{ sheetAwayTotal }}</b>
          </div>
          <sc-for list="{{ sheetAwayFields }}" as="f" hint-placeholder-count="2">
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-top:1px solid rgba(255,255,255,0.08)">
              <label style="flex:1;font-size:13.5px;font-weight:600;color:#fff">{{ f.label }} <span style="color:#7f8794;font-weight:500;font-size:12px">{{ f.pts }}</span></label>
              <input type="number" inputmode="numeric" min="0" step="1" value="{{ f.value }}" onInput="{{ f.onInput }}" disabled="{{ f.disabled }}" style="width:88px;text-align:center;font-weight:700;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:10px;color:#fff;font-size:14px;opacity:{{ f.opacity }}">
            </div>
          </sc-for>
          <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-top:1px solid rgba(255,255,255,0.08)">
            <label style="flex:1;font-size:13.5px;font-weight:600;color:#fff">Cards</label>
            <input type="number" inputmode="numeric" min="0" step="1" value="{{ sheetAwayCards }}" onInput="{{ onSheetAwayCards }}" style="width:88px;text-align:center;font-weight:700;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:10px;color:#fff;font-size:14px">
          </div>
        </div>

        <div style="margin-top:16px">
          <label style="font-size:11px;font-weight:700;color:#7f8794;letter-spacing:.5px;display:block">WALK-OVER</label>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
            <button onClick="{{ onWoNone }}" style="{{ woNoneStyle }}">No walk-over</button>
            <button onClick="{{ onWoHome }}" style="{{ woHomeStyle }}">{{ sheetHomeName }} awarded</button>
            <button onClick="{{ onWoAway }}" style="{{ woAwayStyle }}">{{ sheetAwayName }} awarded</button>
          </div>
          <p style="color:#7f8794;font-size:12px;margin-top:8px">A walk-over is recorded as 20–0 with 4 tries.</p>
        </div>

        <sc-if value="{{ sheetShowSpirit }}" hint-placeholder-val="{{ false }}">
          <div style="margin-top:16px">
            <label style="font-size:11px;font-weight:700;color:#7f8794;letter-spacing:.5px;display:block">SPIRIT OF RUGBY — ONE NOMINATION PER SIDE</label>
            <div style="display:flex;gap:10px;margin-top:8px">
              <input value="{{ sheetSpiritHome }}" onInput="{{ onSheetSpiritHome }}" placeholder="{{ sheetHomeName }} player" style="flex:1;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:11px 14px;color:#fff;font-size:14px">
              <input value="{{ sheetSpiritAway }}" onInput="{{ onSheetSpiritAway }}" placeholder="{{ sheetAwayName }} player" style="flex:1;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:11px 14px;color:#fff;font-size:14px">
            </div>
          </div>
        </sc-if>

        <button onClick="{{ onSheetSave }}" disabled="{{ sheetBusy }}" style="width:100%;margin-top:18px;background:#17A34A;color:#fff;font-weight:800;font-size:15px;padding:13px;border:none;border-radius:10px;cursor:pointer;text-transform:uppercase">{{ sheetSaveLabel }}</button>
        <sc-if value="{{ sheetHasResult }}" hint-placeholder-val="{{ false }}">
          <button onClick="{{ onSheetClear }}" disabled="{{ sheetBusy }}" style="width:100%;margin-top:10px;background:transparent;border:1px solid rgba(255,255,255,0.2);color:#ff8a8a;font-weight:800;font-size:14px;padding:12px;border-radius:10px;cursor:pointer;text-transform:uppercase">Clear result</button>
          <p style="color:#7f8794;font-size:12px;margin-top:8px;line-height:1.5">Clearing puts the match back to unplayed. It is not the same as saving 0–0, which is a draw worth two league points each.</p>
        </sc-if>
      </div>
    </div>
  </sc-if>
```

- [ ] 7. Verify:

```
node tests/test-manager-dc-score-sheet.js
```

All checks pass.

- [ ] 8. Prove the assertions against injected faults, reverting each before the next:

  (a) In `openMatch()`, replace the seeding line with `draft[side + cap(k)] = 0;`. Run — the five "seeded from the saved result" checks must FAIL. Revert.

  (b) In `sheetTotal()`, delete the `if (wo) return wo === side ? 20 : 0;` line. Run — "a home walkover shows 20 for home" and "0 for away" must FAIL. Revert.

  (c) In `setSheetWalkover()`, blank the parts as well:
  ```js
    setSheetWalkover(val) {
      this.setState((s) => {
        const d = { ...s.sheetDraft, walkover: val };
        if (val) ['Tries','Conversions','Penalties','Drops'].forEach((k) => { d['home'+k] = 0; d['away'+k] = 0; });
        return { sheetDraft: d };
      });
    }
  ```
  Run — "clearing the walkover restores the typed totals" must FAIL. Revert.

  (d) In `saveSheet()`, delete the whole `if (!sheetDraft.walkover) { ... }` block so it always saves. Run — "saving an all-zero sheet asks first" and "nothing has been submitted yet" must FAIL. Revert.

  (e) In `saveSheet()`, change the guard to `if (true)` (ignore the walkover). Run — "a walkover is not mistaken for a 0-0 draw" must FAIL. Revert.

  (f) In `saveSheet()`, include cards in the zero test:
  ```js
      const zero = ['home', 'away'].every((side) => parts.every((k) => !Number(sheetDraft[side + cap(k)] || 0)) && !Number(sheetDraft[side + 'Cards'] || 0));
  ```
  Run — "a card does not make an all-zero sheet count as scored" must FAIL. Revert.

  (g) In `doSaveSheet()`, drop the `Number(...)` wrappers so the raw input strings are sent. Run — "every scoring part is sent as a NUMBER" must FAIL. Revert.

  (h) In `doSaveSheet()`, send the spirit fields unconditionally (remove the `if (api.supportsSpiritAward(ageId))` guard). Run — "no spirit fields are sent when the age group does not support the award" must FAIL. Revert.

  (i) In `doSaveSheet()`, close the sheet before checking `res.ok`. Run — the three "a rejected save leaves the sheet open" checks must FAIL. Revert.

  (j) In `doSaveSheet()`, change the toast to a fixed `'Result saved'`. Run — "the toast echoes the score the server stored" must FAIL. Revert.

  (k) In `clearSheet()`, call `api.clearResult` directly instead of inside `confirmModal`'s callback. Run — "nothing is cleared until it is confirmed" must FAIL. Revert.

- [ ] 9. Confirm the whole suite still passes, old-file tests included:

```
powershell tests/runall.ps1
```

- [ ] 10. Commit on `dev`:

```
git checkout dev
git add Manager.dc.html tests/test-manager-dc-score-sheet.js tests/runall.ps1
git commit -F commitmsg.txt   # "Manager.dc.html: score-entry sheet (walkover, 0-0 confirm, live totals)"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files`, and on the PC:

```
git fetch origin --prune
git checkout dev
git add Manager.dc.html tests/test-manager-dc-score-sheet.js tests/runall.ps1
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash
git push origin dev
```

## Task 5 — Today tab

**Files**
- Modify: `Manager.dc.html`
- Modify: `tests/test-manager-dc.js`
- Test: `tests/test-manager-dc.js`

**Interfaces**
- Consumes: Task 3's `state.fixtures`, `ageName(id)`, `tName(code)`; Task 4's `openMatch(id)`.
- Produces: method `matchRows(list)` returning `[{id, time, pitch, teams, meta, hasResult, score, onOpen}]` — the shared row view-model every match-listing tab (Tasks 6 and 7) reuses. `renderVals()` keys `todayLoading`, `todayAwaiting`, `todayHeading`, `todayHasNext`, `todayNextRows`, `todayHasRecent`, `todayRecentRows`, `comingSoonBlurb`.

**Steps**

- [ ] 1. Add this section to `tests/test-manager-dc.js`, immediately before the `section('Organizer design system is what this page uses');` block:

```js
section('Today tab');
{
  const c = buildManager();
  await c.boot();
  const vals = c.renderVals();
  check('the next unplayed match is offered first', vals.todayHasNext === true && vals.todayNextRows.length === 1);
  check('…and it is the unplayed one, not the scored one', vals.todayNextRows[0].id === 'u14b:A:1-2');
  check('…named by team, time and pitch', vals.todayNextRows[0].teams === 'ADH1 v DE1'
    && vals.todayNextRows[0].time === '09:00' && vals.todayNextRows[0].pitch === 'A1');
  check('the scored match shows under recent results', vals.todayHasRecent === true
    && vals.todayRecentRows.length === 1 && vals.todayRecentRows[0].id === 'u14b:A:3-4');
  // FAULT-PROOF: `includes('15') && includes('10')` would pass with the sides
  // swapped. The score string is ordered home-then-away.
  check('…with the score home-then-away', vals.todayRecentRows[0].score === '15–10');
  check('a row knows how to open the score sheet', typeof vals.todayNextRows[0].onOpen === 'function');
  vals.todayNextRows[0].onOpen();
  check('…and does open it on that match', c.state.sheetMatchId === 'u14b:A:1-2');
}
{
  const c = buildManager({ getFixtures: async (agId) => ({ awaitingPublication: false, pool: [
    { id: `${agId}:A:1-2`, home: 'ADH1', away: 'DE1', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: { homeScore: 5, awayScore: 0 } },
  ], knockout: [] }) });
  await c.boot();
  const vals = c.renderVals();
  check('with everything played there is no "next up"', vals.todayHasNext === false && vals.todayNextRows.length === 0);
  check('…and the recent list still has the played match', vals.todayHasRecent === true);
}
{
  const c = buildManager({ getFixtures: async () => ({ awaitingPublication: true, pool: [], knockout: [] }) });
  await c.boot();
  const vals = c.renderVals();
  check('an unpublished draw shows the coming-soon state, not an empty list', vals.todayAwaiting === true);
  check('…naming the age group', /U14 Boys/.test(vals.comingSoonBlurb));
  check('…and offers no rows at all', vals.todayHasNext === false && vals.todayHasRecent === false);
}
{
  const c = buildManager();
  c.setState({ ageId: 'u14b', ageGroups: [{ id: 'u14b', name: 'U14 Boys', hasStandings: true }], session: { ageGroupId: 'u14b', token: 't' } });
  check('before the fetch lands, the tab says it is loading', c.renderVals().todayLoading === true);
}
{
  // A knockout slot with neither team decided is not a fixture anybody can
  // play, so it must not be offered as "next up".
  const c = buildManager({ getFixtures: async (agId) => ({ awaitingPublication: false,
    pool: [{ id: `${agId}:A:1`, home: 'ADH1', away: 'DE1', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: { homeScore: 5, awayScore: 0 } }],
    knockout: [{ id: `${agId}:CUP`, round: 'Cup Final', home: '', away: '', time: '13:00', pitch: 'A1', result: null }] }) });
  await c.boot();
  check('an undecided knockout slot is not offered as the next match', c.renderVals().todayHasNext === false);
}
```

- [ ] 2. Confirm it fails: `node tests/test-manager-dc.js` → `TypeError: Cannot read properties of undefined (reading 'length')` on `vals.todayNextRows`.

- [ ] 3. Add `matchRows(list)` to `Manager.dc.html`, after `tName(code)`:

```js
  /* The shared row view-model for every match list on this page (Today,
     Fixtures & scoring, Results). One shape, so the three tabs cannot drift
     apart the way three separate row templates would. */
  matchRows(list) {
    return (list || []).map((m) => ({
      id: m.id,
      time: m.time || '',
      pitch: m.pitch || 'TBD',
      teams: `${m.home ? this.tName(m.home) : 'TBD'} v ${m.away ? this.tName(m.away) : 'TBD'}`,
      meta: m.poolName || m.round || '',
      hasResult: !!m.result,
      score: m.result ? `${m.result.homeScore}–${m.result.awayScore}` : '',
      onOpen: () => this.openMatch(m.id),
    }));
  }
```

- [ ] 4. Extend `renderVals()`. Add this to the computed block at the top of the method:

```js
    const fx = s.fixtures;
    const fxReady = !!fx && !fx.awaitingPublication;
    /* A knockout slot with neither side decided is not a fixture anyone can
       play, so it is excluded everywhere a match list is built. */
    const playable = fxReady ? (fx.pool || []).concat((fx.knockout || []).filter((k) => k.home || k.away)) : [];
    const nextUp = playable.find((m) => !m.result) || null;
    const recent = [...playable].reverse().filter((m) => m.result).slice(0, 3);
```

and these keys to the returned object:

```js
      todayLoading: !fx,
      todayAwaiting: !!(fx && fx.awaitingPublication),
      todayHeading: this.ageName(s.ageId),
      todayHasNext: !!nextUp,
      todayNextRows: nextUp ? this.matchRows([nextUp]) : [],
      todayHasRecent: recent.length > 0,
      todayRecentRows: this.matchRows(recent),
      comingSoonBlurb: `The draw for ${this.ageName(s.ageId)} hasn't been released yet.`,
```

- [ ] 5. Replace the Today placeholder card in the template (the `<sc-if value="{{ isToday }}">` block) with:

```html
      <sc-if value="{{ isToday }}" hint-placeholder-val="{{ true }}">
        <div style="margin-top:24px">
          <div style="font-family:'Anton';font-size:18px;text-transform:uppercase;letter-spacing:.4px;margin-bottom:12px">{{ todayHeading }}</div>

          <sc-if value="{{ todayLoading }}" hint-placeholder-val="{{ true }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center;color:#7f8794;font-size:14px">Loading…</div>
          </sc-if>

          <sc-if value="{{ todayAwaiting }}" hint-placeholder-val="{{ false }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center">
              <div style="font-family:'Anton';font-size:22px;text-transform:uppercase;margin-bottom:8px">Fixtures not published yet</div>
              <div style="color:#7f8794;font-size:14px">{{ comingSoonBlurb }}</div>
            </div>
          </sc-if>

          <sc-if value="{{ todayHasNext }}" hint-placeholder-val="{{ true }}">
            <div style="font-family:'Anton';font-size:17px;text-transform:uppercase;margin:18px 0 10px">Next up</div>
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden">
              <sc-for list="{{ todayNextRows }}" as="r" hint-placeholder-count="1">
                <button onClick="{{ r.onOpen }}" style="display:grid;grid-template-columns:64px 1fr auto;gap:12px;align-items:center;padding:14px 16px;width:100%;text-align:left;background:transparent;border:none;cursor:pointer;color:#fff">
                  <div><div style="font-weight:800;color:#E11B22;font-size:13px">{{ r.time }}</div><div style="font-size:11px;color:#7f8794;font-weight:600;margin-top:2px">{{ r.pitch }}</div></div>
                  <div><div style="font-weight:600;font-size:14.5px;line-height:1.4">{{ r.teams }}</div><div style="font-size:11px;color:#7f8794;margin-top:3px">{{ r.meta }}</div></div>
                  <div style="font-family:'Anton';font-size:19px;white-space:nowrap;color:#aeb4bf">{{ r.score }}</div>
                </button>
              </sc-for>
            </div>
          </sc-if>

          <sc-if value="{{ todayHasRecent }}" hint-placeholder-val="{{ true }}">
            <div style="font-family:'Anton';font-size:17px;text-transform:uppercase;margin:18px 0 10px">Recent results</div>
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden">
              <sc-for list="{{ todayRecentRows }}" as="r" hint-placeholder-count="3">
                <button onClick="{{ r.onOpen }}" style="display:grid;grid-template-columns:64px 1fr auto;gap:12px;align-items:center;padding:14px 16px;width:100%;text-align:left;background:transparent;border:none;border-top:1px solid rgba(255,255,255,0.08);cursor:pointer;color:#fff">
                  <div><div style="font-weight:800;color:#E11B22;font-size:13px">{{ r.time }}</div><div style="font-size:11px;color:#7f8794;font-weight:600;margin-top:2px">{{ r.pitch }}</div></div>
                  <div><div style="font-weight:600;font-size:14.5px;line-height:1.4">{{ r.teams }}</div><div style="font-size:11px;color:#7f8794;margin-top:3px">{{ r.meta }}</div></div>
                  <div style="font-family:'Anton';font-size:19px;white-space:nowrap">{{ r.score }}</div>
                </button>
              </sc-for>
            </div>
          </sc-if>
        </div>
      </sc-if>
```

- [ ] 6. Verify: `node tests/test-manager-dc.js` — all checks pass.

- [ ] 7. Prove against injected faults, reverting each:

  (a) In `renderVals()`, change `const nextUp = playable.find((m) => !m.result) || null;` to `playable[0] || null`. Run — "it is the unplayed one, not the scored one" must FAIL. Revert.

  (b) In `matchRows()`, swap the score to `${m.result.awayScore}–${m.result.homeScore}`. Run — "with the score home-then-away" must FAIL. Revert.

  (c) In `renderVals()`, drop the `.filter((k) => k.home || k.away)` from `playable`. Run — "an undecided knockout slot is not offered as the next match" must FAIL. Revert.

  (d) In `renderVals()`, set `todayAwaiting: false`. Run — "an unpublished draw shows the coming-soon state" must FAIL. Revert.

- [ ] 8. `powershell tests/runall.ps1` — whole suite green.

- [ ] 9. Commit on `dev`:

```
git checkout dev
git add Manager.dc.html tests/test-manager-dc.js
git commit -F commitmsg.txt   # "Manager.dc.html: Today tab"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files`, and on the PC:

```
git fetch origin --prune
git checkout dev
git add Manager.dc.html tests/test-manager-dc.js
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash
git push origin dev
```

---

## Task 6 — Fixtures & scoring tab

**Files**
- Modify: `Manager.dc.html`
- Modify: `tests/test-manager-dc.js`
- Test: `tests/test-manager-dc.js`

**Interfaces**
- Consumes: Task 3's `state.fixtures`; Task 4's `openMatch(id)` (reached through a row's `onOpen`); Task 5's `matchRows(list)` and the `fx` / `fxReady` computed values in `renderVals()`.
- Produces: `renderVals()` keys `fixturesLoading`, `fixturesAwaiting`, `fixturesEmpty`, `poolGroups` (`[{ name, rows }]`, one entry per pool in first-appearance order), `hasKnockout`, `knockoutFixtureRows`.
- The Spirit of Rugby Award tally card also lives on this tab; it is added in Task 13, which appends its own keys and its own markup block above `poolGroups`.

**Steps**

- [ ] 1. Add this section to `tests/test-manager-dc.js`, after the `section('Today tab');` block:

```js
section('Fixtures & scoring tab');
{
  const c = buildManager();
  await c.boot();
  c.go('fixtures');
  const vals = c.renderVals();
  check('matches are grouped under their pool', vals.poolGroups.length === 1 && vals.poolGroups[0].name === 'Pool A');
  // FAULT-PROOF: a flat list would still show both matches. This asserts the
  // GROUPING, which is the thing the tab exists to do.
  check('…with both of that pool\'s matches inside the group', vals.poolGroups[0].rows.length === 2);
  check('the rows carry team names and times', vals.poolGroups[0].rows[0].teams === 'ADH1 v DE1'
    && vals.poolGroups[0].rows[0].time === '09:00');
  check('a played match shows its score in the list', vals.poolGroups[0].rows[1].score === '15–10');
  check('there is no knockout section when there are no knockout matches', vals.hasKnockout === false);

  vals.poolGroups[0].rows[0].onOpen();
  check('tapping a fixture opens the score sheet on it', c.state.sheetMatchId === 'u14b:A:1-2');
}
{
  const c = buildManager({ getFixtures: async (agId) => ({ awaitingPublication: false,
    pool: [
      { id: `${agId}:A:1`, home: 'ADH1', away: 'DE1', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: null },
      { id: `${agId}:B:1`, home: 'DS1', away: 'DT1', time: '09:00', pitch: 'A2', poolName: 'Pool B', result: null },
      { id: `${agId}:A:2`, home: 'DE1', away: 'ADH1', time: '10:00', pitch: 'A1', poolName: 'Pool A', result: null },
    ],
    knockout: [
      { id: `${agId}:CUP`, round: 'Cup Final', home: 'ADH1', away: 'DS1', time: '13:00', pitch: 'A1', result: null },
      { id: `${agId}:BOWL`, round: 'Bowl Final', home: '', away: '', time: '13:00', pitch: 'A2', result: null },
    ] }) });
  await c.boot();
  c.go('fixtures');
  const vals = c.renderVals();
  check('two pools produce two groups', vals.poolGroups.length === 2);
  check('groups keep first-appearance order', vals.poolGroups[0].name === 'Pool A' && vals.poolGroups[1].name === 'Pool B');
  check('a later match joins the pool it belongs to, not a new group', vals.poolGroups[0].rows.length === 2);
  check('decided knockout matches get their own section', vals.hasKnockout === true && vals.knockoutFixtureRows.length === 1);
  // FAULT-PROOF: an undecided knockout slot has no teams to score, so it must
  // not appear as a scoreable fixture.
  check('…and an undecided knockout slot is left out', vals.knockoutFixtureRows[0].id === 'u14b:CUP');
  check('a knockout row is labelled by its round', vals.knockoutFixtureRows[0].meta === 'Cup Final');
}
{
  const c = buildManager({ getFixtures: async () => ({ awaitingPublication: false, pool: [], knockout: [] }) });
  await c.boot();
  c.go('fixtures');
  const vals = c.renderVals();
  check('an age group with nothing scheduled says so', vals.fixturesEmpty === true && vals.poolGroups.length === 0);
}
{
  const c = buildManager({ getFixtures: async () => ({ awaitingPublication: true, pool: [], knockout: [] }) });
  await c.boot();
  c.go('fixtures');
  check('an unpublished draw shows coming-soon here too', c.renderVals().fixturesAwaiting === true);
}
{
  const c = buildManager({ getFixtures: async (agId) => ({ awaitingPublication: false,
    pool: [{ id: `${agId}:X:1`, home: 'ADH1', away: 'DE1', time: '09:00', pitch: 'A1', result: null }], knockout: [] }) });
  await c.boot();
  c.go('fixtures');
  check('a match with no poolName still gets a heading rather than disappearing',
    c.renderVals().poolGroups.length === 1 && c.renderVals().poolGroups[0].name === 'Matches');
}
```

- [ ] 2. Confirm it fails: `node tests/test-manager-dc.js` → `vals.poolGroups` is `undefined`.

- [ ] 3. Extend `renderVals()` in `Manager.dc.html`. Add to the computed block:

```js
    /* Grouped by pool in FIRST-APPEARANCE order — Object.keys on an object
       built while walking the list preserves insertion order for string keys,
       which is the same ordering the old dashboard produced. A match with no
       poolName still needs a heading or it silently vanishes. */
    const byPool = {};
    if (fxReady) (fx.pool || []).forEach((m) => {
      const k = m.poolName || 'Matches';
      (byPool[k] = byPool[k] || []).push(m);
    });
    const poolGroups = Object.keys(byPool).map((k) => ({ name: k, rows: this.matchRows(byPool[k]) }));
    const knockoutPlayable = fxReady ? (fx.knockout || []).filter((k) => k.home || k.away) : [];
```

and these keys to the returned object:

```js
      fixturesLoading: !fx,
      fixturesAwaiting: !!(fx && fx.awaitingPublication),
      fixturesEmpty: fxReady && poolGroups.length === 0 && knockoutPlayable.length === 0,
      poolGroups,
      hasKnockout: knockoutPlayable.length > 0,
      knockoutFixtureRows: this.matchRows(knockoutPlayable),
```

- [ ] 4. Replace the Fixtures placeholder card in the template with:

```html
      <sc-if value="{{ isFixtures }}" hint-placeholder-val="{{ false }}">
        <div style="margin-top:24px">
          <div style="font-family:'Anton';font-size:18px;text-transform:uppercase;letter-spacing:.4px;margin-bottom:12px">Fixtures &amp; scoring</div>

          <sc-if value="{{ fixturesLoading }}" hint-placeholder-val="{{ false }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center;color:#7f8794;font-size:14px">Loading…</div>
          </sc-if>
          <sc-if value="{{ fixturesAwaiting }}" hint-placeholder-val="{{ false }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center">
              <div style="font-family:'Anton';font-size:22px;text-transform:uppercase;margin-bottom:8px">Fixtures not published yet</div>
              <div style="color:#7f8794;font-size:14px">{{ comingSoonBlurb }}</div>
            </div>
          </sc-if>
          <sc-if value="{{ fixturesEmpty }}" hint-placeholder-val="{{ false }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center">
              <div style="font-family:'Anton';font-size:22px;text-transform:uppercase;margin-bottom:8px">No matches</div>
              <div style="color:#7f8794;font-size:14px">Nothing scheduled here yet.</div>
            </div>
          </sc-if>

          <sc-for list="{{ poolGroups }}" as="g" hint-placeholder-count="2">
            <div style="font-family:'Anton';font-size:15px;text-transform:uppercase;letter-spacing:1px;color:#7f8794;margin:18px 0 8px">{{ g.name }}</div>
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden">
              <sc-for list="{{ g.rows }}" as="r" hint-placeholder-count="3">
                <button onClick="{{ r.onOpen }}" style="display:grid;grid-template-columns:64px 1fr auto;gap:12px;align-items:center;padding:14px 16px;width:100%;text-align:left;background:transparent;border:none;border-top:1px solid rgba(255,255,255,0.08);cursor:pointer;color:#fff">
                  <div><div style="font-weight:800;color:#E11B22;font-size:13px">{{ r.time }}</div><div style="font-size:11px;color:#7f8794;font-weight:600;margin-top:2px">{{ r.pitch }}</div></div>
                  <div><div style="font-weight:600;font-size:14.5px;line-height:1.4">{{ r.teams }}</div><div style="font-size:11px;color:#7f8794;margin-top:3px">{{ r.meta }}</div></div>
                  <div style="font-family:'Anton';font-size:19px;white-space:nowrap">{{ r.score }}</div>
                </button>
              </sc-for>
            </div>
          </sc-for>

          <sc-if value="{{ hasKnockout }}" hint-placeholder-val="{{ false }}">
            <div style="font-family:'Anton';font-size:17px;text-transform:uppercase;margin:20px 0 10px">Knockout</div>
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden">
              <sc-for list="{{ knockoutFixtureRows }}" as="r" hint-placeholder-count="2">
                <button onClick="{{ r.onOpen }}" style="display:grid;grid-template-columns:64px 1fr auto;gap:12px;align-items:center;padding:14px 16px;width:100%;text-align:left;background:transparent;border:none;border-top:1px solid rgba(255,255,255,0.08);cursor:pointer;color:#fff">
                  <div><div style="font-weight:800;color:#E11B22;font-size:13px">{{ r.time }}</div><div style="font-size:11px;color:#7f8794;font-weight:600;margin-top:2px">{{ r.pitch }}</div></div>
                  <div><div style="font-weight:600;font-size:14.5px;line-height:1.4">{{ r.teams }}</div><div style="font-size:11px;color:#7f8794;margin-top:3px">{{ r.meta }}</div></div>
                  <div style="font-family:'Anton';font-size:19px;white-space:nowrap">{{ r.score }}</div>
                </button>
              </sc-for>
            </div>
          </sc-if>
        </div>
      </sc-if>
```

- [ ] 5. Verify: `node tests/test-manager-dc.js` — all checks pass.

- [ ] 6. Prove against injected faults, reverting each:

  (a) In `renderVals()`, replace `poolGroups` with a single flat group: `const poolGroups = fxReady ? [{ name: 'Matches', rows: this.matchRows(fx.pool || []) }] : [];`. Run — "two pools produce two groups" must FAIL. Revert.

  (b) Change the group key fallback to `m.poolName` only (drop `|| 'Matches'`). Run — "a match with no poolName still gets a heading" must FAIL. Revert.

  (c) Drop the `.filter((k) => k.home || k.away)` from `knockoutPlayable`. Run — "an undecided knockout slot is left out" must FAIL. Revert.

  (d) Change `fixturesEmpty` to `false`. Run — "an age group with nothing scheduled says so" must FAIL. Revert.

- [ ] 7. `powershell tests/runall.ps1` — whole suite green.

- [ ] 8. Commit on `dev`:

```
git checkout dev
git add Manager.dc.html tests/test-manager-dc.js
git commit -F commitmsg.txt   # "Manager.dc.html: Fixtures & scoring tab"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files`, and on the PC:

```
git fetch origin --prune
git checkout dev
git add Manager.dc.html tests/test-manager-dc.js
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash
git push origin dev
```

---

## Task 7 — Results tab

**Files**
- Modify: `Manager.dc.html`
- Modify: `tests/test-manager-dc.js`
- Test: `tests/test-manager-dc.js`

**Interfaces**
- Consumes: Task 3's `state.fixtures`; Task 5's `matchRows(list)` and the `fx` / `fxReady` / `playable` computed values in `renderVals()`; Task 4's `openMatch(id)` via `onOpen`.
- Produces: `renderVals()` keys `resultsLoading`, `resultsAwaiting`, `resultsEmpty`, `resultRows`.

**Steps**

- [ ] 1. Add this section to `tests/test-manager-dc.js`, after the Fixtures section:

```js
section('Results tab');
{
  const c = buildManager();
  await c.boot();
  c.go('results');
  const vals = c.renderVals();
  check('only played matches are listed', vals.resultRows.length === 1 && vals.resultRows[0].id === 'u14b:A:3-4');
  // FAULT-PROOF: `includes('15') && includes('10')` would still pass with the
  // sides swapped — the ordered string is the assertion.
  check('the score reads home-then-away', vals.resultRows[0].score === '15–10');
  check('the unplayed 09:00 match is not in the results list',
    vals.resultRows.every((r) => r.time !== '09:00'));
  vals.resultRows[0].onOpen();
  check('a result row reopens the score sheet for a correction', c.state.sheetMatchId === 'u14b:A:3-4');
}
{
  const c = buildManager({ getFixtures: async (agId) => ({ awaitingPublication: false, pool: [
    { id: `${agId}:A:1`, home: 'A', away: 'B', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: { homeScore: 1, awayScore: 0 } },
    { id: `${agId}:A:2`, home: 'C', away: 'D', time: '09:20', pitch: 'A1', poolName: 'Pool A', result: { homeScore: 2, awayScore: 0 } },
    { id: `${agId}:A:3`, home: 'E', away: 'F', time: '09:40', pitch: 'A1', poolName: 'Pool A', result: { homeScore: 3, awayScore: 0 } },
  ], knockout: [] }) });
  await c.boot();
  c.go('results');
  // FAULT-PROOF: the most recent result is the one being checked, so it goes
  // on top. A forward-ordered list would put the oldest first.
  check('the newest result is first', eq('result order', c.renderVals().resultRows.map((r) => r.id),
    ['u14b:A:3', 'u14b:A:2', 'u14b:A:1']));
}
{
  const c = buildManager({ getFixtures: async (agId) => ({ awaitingPublication: false,
    pool: [{ id: `${agId}:A:1`, home: 'A', away: 'B', time: '09:00', pitch: 'A1', poolName: 'Pool A', result: null }], knockout: [] }) });
  await c.boot();
  c.go('results');
  const vals = c.renderVals();
  check('with nothing played the tab says so', vals.resultsEmpty === true && vals.resultRows.length === 0);
}
{
  const c = buildManager({ getFixtures: async () => ({ awaitingPublication: true, pool: [], knockout: [] }) });
  await c.boot();
  c.go('results');
  check('an unpublished draw shows coming-soon on Results too', c.renderVals().resultsAwaiting === true);
}
```

- [ ] 2. Confirm it fails: `node tests/test-manager-dc.js` → `vals.resultRows` is `undefined`.

- [ ] 3. Extend `renderVals()` in `Manager.dc.html`. Add to the computed block:

```js
    /* Newest first — the result just entered is the one being checked. */
    const played = [...playable].reverse().filter((m) => m.result);
```

and these keys to the returned object:

```js
      resultsLoading: !fx,
      resultsAwaiting: !!(fx && fx.awaitingPublication),
      resultsEmpty: fxReady && played.length === 0,
      resultRows: this.matchRows(played),
```

- [ ] 4. Replace the Results placeholder card in the template with:

```html
      <sc-if value="{{ isResults }}" hint-placeholder-val="{{ false }}">
        <div style="margin-top:24px">
          <div style="font-family:'Anton';font-size:18px;text-transform:uppercase;letter-spacing:.4px;margin-bottom:12px">Results</div>

          <sc-if value="{{ resultsLoading }}" hint-placeholder-val="{{ false }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center;color:#7f8794;font-size:14px">Loading…</div>
          </sc-if>
          <sc-if value="{{ resultsAwaiting }}" hint-placeholder-val="{{ false }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center">
              <div style="font-family:'Anton';font-size:22px;text-transform:uppercase;margin-bottom:8px">Results not published yet</div>
              <div style="color:#7f8794;font-size:14px">{{ comingSoonBlurb }}</div>
            </div>
          </sc-if>
          <sc-if value="{{ resultsEmpty }}" hint-placeholder-val="{{ false }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center">
              <div style="font-family:'Anton';font-size:22px;text-transform:uppercase;margin-bottom:8px">No results yet</div>
              <div style="color:#7f8794;font-size:14px">Scores you enter on the Fixtures &amp; scoring tab appear here.</div>
            </div>
          </sc-if>

          <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden">
            <sc-for list="{{ resultRows }}" as="r" hint-placeholder-count="4">
              <button onClick="{{ r.onOpen }}" style="display:grid;grid-template-columns:64px 1fr auto;gap:12px;align-items:center;padding:14px 16px;width:100%;text-align:left;background:transparent;border:none;border-top:1px solid rgba(255,255,255,0.08);cursor:pointer;color:#fff">
                <div><div style="font-weight:800;color:#E11B22;font-size:13px">{{ r.time }}</div><div style="font-size:11px;color:#7f8794;font-weight:600;margin-top:2px">{{ r.pitch }}</div></div>
                <div><div style="font-weight:600;font-size:14.5px;line-height:1.4">{{ r.teams }}</div><div style="font-size:11px;color:#7f8794;margin-top:3px">{{ r.meta }}</div></div>
                <div style="font-family:'Anton';font-size:19px;white-space:nowrap">{{ r.score }}</div>
              </button>
            </sc-for>
          </div>
        </div>
      </sc-if>
```

- [ ] 5. Verify: `node tests/test-manager-dc.js` — all checks pass.

- [ ] 6. Prove against injected faults, reverting each:

  (a) Drop the `.reverse()` from `played`. Run — "the newest result is first" must FAIL. Revert.

  (b) Change `played` to `[...playable].reverse()` (no `.filter((m) => m.result)`). Run — "only played matches are listed" and "the unplayed 09:00 match is not in the results list" must FAIL. Revert.

  (c) Change `resultsEmpty` to `false`. Run — "with nothing played the tab says so" must FAIL. Revert.

- [ ] 7. `powershell tests/runall.ps1` — whole suite green.

- [ ] 8. Commit on `dev`:

```
git checkout dev
git add Manager.dc.html tests/test-manager-dc.js
git commit -F commitmsg.txt   # "Manager.dc.html: Results tab"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files`, and on the PC:

```
git fetch origin --prune
git checkout dev
git add Manager.dc.html tests/test-manager-dc.js
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash
git push origin dev
```

---

## Task 8 — Tables tab

**Files**
- Modify: `Manager.dc.html`
- Modify: `tests/test-manager-dc.js`
- Test: `tests/test-manager-dc.js`

**Interfaces**
- Consumes: Task 3's `state.standings` (shape: `{ awaitingPublication, ageGroup:{ hasStandings, name }, pools:[{id,name}], tables:{ [poolId]: [{team,P,W,D,L,PF,PA,pts}] }, _advance }`); `scores-data.js`'s `teamShort(code)`.
- Produces: method `tShort(code)`; `renderVals()` keys `tablesLoading`, `tablesAwaiting`, `tablesFestival`, `tablesFestivalBlurb`, `tablesEmpty`, `tableCards` (`[{ id, name, rows:[{pos,team,P,W,D,L,PF,PA,diff,pts,rowStyle}] }]`).

**Steps**

- [ ] 1. Add this section to `tests/test-manager-dc.js`, after the Results section:

```js
section('Tables tab');
{
  const c = buildManager();
  await c.boot();
  c.go('tables');
  const vals = c.renderVals();
  check('one card per pool', vals.tableCards.length === 1 && vals.tableCards[0].name === 'Pool A');
  const row = vals.tableCards[0].rows[0];
  check('the row is numbered from 1', row.pos === 1);
  check('it names the team', row.team === 'DS1');
  check('it carries the played/won/drawn/lost figures', row.P === 1 && row.W === 1 && row.D === 0 && row.L === 0);
  check('it carries points for and against', row.PF === 15 && row.PA === 10);
  // FAULT-PROOF: the difference is computed, not read — a table that printed
  // PF again here would look plausible on a 15-10 row but not on this check.
  check('the difference is PF minus PA, signed', row.diff === '+5');
  check('it carries the league points', row.pts === 4);
  check('a qualifying row is marked', row.rowStyle.includes('#17A34A'));
}
{
  const c = buildManager({ getStandings: async () => ({ awaitingPublication: false,
    ageGroup: { hasStandings: true, name: 'U14 Boys' }, pools: [{ id: 'A', name: 'Pool A' }],
    tables: { A: [
      { team: 'DS1', P:2,W:2,D:0,L:0,PF:30,PA:5,pts:8 },
      { team: 'DT1', P:2,W:0,D:0,L:2,PF:5,PA:30,pts:0 },
    ] }, _advance: 1 }) });
  await c.boot();
  c.go('tables');
  const rows = c.renderVals().tableCards[0].rows;
  check('every row is numbered in order', eq('positions', rows.map((r) => r.pos), [1, 2]));
  check('a negative difference is signed too', rows[1].diff === '-25');
  // FAULT-PROOF: _advance is 1, so exactly the top row qualifies. Marking
  // every row (or none) would still render a table that "looks right".
  check('only the qualifying places are marked', rows[0].rowStyle.includes('#17A34A') && !rows[1].rowStyle.includes('#17A34A'));
}
{
  const c = buildManager({ getStandings: async () => ({ awaitingPublication: false,
    ageGroup: { hasStandings: false, name: 'U6 Tag' }, pools: [], tables: {}, _advance: 0 }) });
  await c.boot();
  c.go('tables');
  const vals = c.renderVals();
  check('a festival age group says it keeps no standings', vals.tablesFestival === true);
  check('…naming the group', /U6 Tag/.test(vals.tablesFestivalBlurb));
  check('…and shows no table at all', vals.tableCards.length === 0);
}
{
  const c = buildManager({ getStandings: async () => ({ awaitingPublication: false,
    ageGroup: { hasStandings: true, name: 'U14 Boys' }, pools: [], tables: {}, _advance: 0 }) });
  await c.boot();
  c.go('tables');
  check('a competitive group with no pools yet says so', c.renderVals().tablesEmpty === true);
}
{
  const c = buildManager({ getStandings: async () => ({ awaitingPublication: true }) });
  await c.boot();
  c.go('tables');
  check('an unpublished draw shows coming-soon on Tables', c.renderVals().tablesAwaiting === true);
  check('…without throwing on the missing ageGroup block', c.renderVals().tableCards.length === 0);
}
{
  const c = buildManager({ getStandings: async () => ({ awaitingPublication: false,
    ageGroup: { hasStandings: true, name: 'U14 Boys' }, pools: [{ id: 'A', name: 'Pool A' }, { id: 'B', name: 'Pool B' }],
    tables: { A: [{ team: 'DS1', P:0,W:0,D:0,L:0,PF:0,PA:0,pts:0 }] }, _advance: 1 }) });
  await c.boot();
  c.go('tables');
  const vals = c.renderVals();
  check('a pool with no table rows yet still gets its card', vals.tableCards.length === 2);
  check('…with an empty row list rather than a crash', vals.tableCards[1].rows.length === 0);
}
```

- [ ] 2. Confirm it fails: `node tests/test-manager-dc.js` → `vals.tableCards` is `undefined`.

- [ ] 3. Add `tShort(code)` to `Manager.dc.html`, directly after `tName(code)`:

```js
  /* The short form, for the standings table's pinned team column. */
  tShort(code) {
    const { api } = this.state;
    return (api && api.teamShort ? api.teamShort(code) : code) || code || '';
  }
```

- [ ] 4. Extend `renderVals()`. Add to the computed block:

```js
    const st = s.standings;
    const stReady = !!st && !st.awaitingPublication;
    const stAge = (st && st.ageGroup) || null;
    const advance = (st && st._advance) || 0;
    const tableCards = (stReady && stAge && stAge.hasStandings)
      ? (st.pools || []).map((p) => ({
          id: p.id,
          name: p.name,
          rows: ((st.tables || {})[p.id] || []).map((t, i) => ({
            pos: i + 1,
            team: this.tShort(t.team),
            P: t.P, W: t.W, D: t.D, L: t.L, PF: t.PF, PA: t.PA,
            diff: `${t.PF - t.PA > 0 ? '+' : ''}${t.PF - t.PA}`,
            pts: t.pts,
            /* The green edge is the qualification cue, so it is applied to the
               top `_advance` rows only — not to every row, and not to none. */
            rowStyle: i < advance ? 'box-shadow:inset 3px 0 0 #17A34A' : '',
          })),
        }))
      : [];
```

and these keys to the returned object:

```js
      tablesLoading: !st,
      tablesAwaiting: !!(st && st.awaitingPublication),
      tablesFestival: !!(stReady && stAge && !stAge.hasStandings),
      tablesFestivalBlurb: stAge ? `${stAge.name} is non-competitive — no standings are kept.` : '',
      tablesEmpty: !!(stReady && stAge && stAge.hasStandings && tableCards.length === 0),
      tableCards,
```

- [ ] 5. Replace the Tables placeholder card in the template with:

```html
      <sc-if value="{{ isTables }}" hint-placeholder-val="{{ false }}">
        <div style="margin-top:24px">
          <div style="font-family:'Anton';font-size:18px;text-transform:uppercase;letter-spacing:.4px;margin-bottom:12px">Tables</div>

          <sc-if value="{{ tablesLoading }}" hint-placeholder-val="{{ false }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center;color:#7f8794;font-size:14px">Loading…</div>
          </sc-if>
          <sc-if value="{{ tablesAwaiting }}" hint-placeholder-val="{{ false }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center">
              <div style="font-family:'Anton';font-size:22px;text-transform:uppercase;margin-bottom:8px">Standings not published yet</div>
              <div style="color:#7f8794;font-size:14px">{{ comingSoonBlurb }}</div>
            </div>
          </sc-if>
          <sc-if value="{{ tablesFestival }}" hint-placeholder-val="{{ false }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center">
              <div style="font-family:'Anton';font-size:22px;text-transform:uppercase;margin-bottom:8px">Festival age group</div>
              <div style="color:#7f8794;font-size:14px">{{ tablesFestivalBlurb }}</div>
            </div>
          </sc-if>
          <sc-if value="{{ tablesEmpty }}" hint-placeholder-val="{{ false }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center">
              <div style="font-family:'Anton';font-size:22px;text-transform:uppercase;margin-bottom:8px">No pools yet</div>
              <div style="color:#7f8794;font-size:14px">Nothing to show for this age group.</div>
            </div>
          </sc-if>

          <sc-for list="{{ tableCards }}" as="tc" hint-placeholder-count="2">
            <div style="font-family:'Anton';font-size:17px;text-transform:uppercase;margin:18px 0 10px">{{ tc.name }}</div>
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden">
              <div style="overflow-x:auto">
                <table style="width:100%;font-size:13px;min-width:460px">
                  <thead><tr>
                    <th style="font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#7f8794;font-weight:800;padding:10px 6px;text-align:center;background:#0C0C0E">#</th>
                    <th style="font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#7f8794;font-weight:800;padding:10px 6px;text-align:left;background:#0C0C0E">Team</th>
                    <th style="font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#7f8794;font-weight:800;padding:10px 6px;text-align:center;background:#0C0C0E">P</th>
                    <th style="font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#7f8794;font-weight:800;padding:10px 6px;text-align:center;background:#0C0C0E">W</th>
                    <th style="font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#7f8794;font-weight:800;padding:10px 6px;text-align:center;background:#0C0C0E">D</th>
                    <th style="font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#7f8794;font-weight:800;padding:10px 6px;text-align:center;background:#0C0C0E">L</th>
                    <th style="font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#7f8794;font-weight:800;padding:10px 6px;text-align:center;background:#0C0C0E">PF</th>
                    <th style="font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#7f8794;font-weight:800;padding:10px 6px;text-align:center;background:#0C0C0E">PA</th>
                    <th style="font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#7f8794;font-weight:800;padding:10px 6px;text-align:center;background:#0C0C0E">+/−</th>
                    <th style="font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#7f8794;font-weight:800;padding:10px 6px;text-align:center;background:#0C0C0E">Pts</th>
                  </tr></thead>
                  <tbody>
                    <sc-for list="{{ tc.rows }}" as="r" hint-placeholder-count="4">
                      <tr style="{{ r.rowStyle }}">
                        <td style="padding:11px 6px;text-align:center;border-top:1px solid rgba(255,255,255,0.08)">{{ r.pos }}</td>
                        <td style="padding:11px 6px;text-align:left;font-weight:600;border-top:1px solid rgba(255,255,255,0.08)">{{ r.team }}</td>
                        <td style="padding:11px 6px;text-align:center;border-top:1px solid rgba(255,255,255,0.08)">{{ r.P }}</td>
                        <td style="padding:11px 6px;text-align:center;border-top:1px solid rgba(255,255,255,0.08)">{{ r.W }}</td>
                        <td style="padding:11px 6px;text-align:center;border-top:1px solid rgba(255,255,255,0.08)">{{ r.D }}</td>
                        <td style="padding:11px 6px;text-align:center;border-top:1px solid rgba(255,255,255,0.08)">{{ r.L }}</td>
                        <td style="padding:11px 6px;text-align:center;border-top:1px solid rgba(255,255,255,0.08)">{{ r.PF }}</td>
                        <td style="padding:11px 6px;text-align:center;border-top:1px solid rgba(255,255,255,0.08)">{{ r.PA }}</td>
                        <td style="padding:11px 6px;text-align:center;border-top:1px solid rgba(255,255,255,0.08)">{{ r.diff }}</td>
                        <td style="padding:11px 6px;text-align:center;font-family:'Anton';font-size:16px;border-top:1px solid rgba(255,255,255,0.08)">{{ r.pts }}</td>
                      </tr>
                    </sc-for>
                  </tbody>
                </table>
              </div>
              <div style="padding:10px 14px;font-size:11px;color:#7f8794;border-top:1px solid rgba(255,255,255,0.08);line-height:1.6">Green bar = qualifies for the knockout stage.</div>
            </div>
          </sc-for>
        </div>
      </sc-if>
```

- [ ] 6. Verify: `node tests/test-manager-dc.js` — all checks pass.

- [ ] 7. Prove against injected faults, reverting each:

  (a) Change `diff` to `` `${t.PF}` ``. Run — "the difference is PF minus PA, signed" and "a negative difference is signed too" must FAIL. Revert.

  (b) Change `rowStyle` to always apply the green edge (`'box-shadow:inset 3px 0 0 #17A34A'`). Run — "only the qualifying places are marked" must FAIL. Revert.

  (c) Change the `tableCards` guard to ignore `hasStandings` (`stReady && stAge`). Run — "a festival age group … shows no table at all" must FAIL. Revert.

  (d) Change `pos` to `i`. Run — "the row is numbered from 1" and "every row is numbered in order" must FAIL. Revert.

- [ ] 8. `powershell tests/runall.ps1` — whole suite green.

- [ ] 9. Commit on `dev`:

```
git checkout dev
git add Manager.dc.html tests/test-manager-dc.js
git commit -F commitmsg.txt   # "Manager.dc.html: Tables tab"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files`, and on the PC:

```
git fetch origin --prune
git checkout dev
git add Manager.dc.html tests/test-manager-dc.js
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash
git push origin dev
```

## Task 9 — Draw tab, part 1: loading, tap-to-select pick/place, pool & team CRUD

**A deliberate, documented divergence from the old file.** `Manager.html`'s `placeTeam()` removes the team from wherever it came from, always — including removing it from its pool roster when it is placed into a match slot. The uniform-draw-editor work that just shipped in `Scores & Standings.dc.html` corrected that: `pools[].teams` is pool MEMBERSHIP and `computeStandings()` reads it directly, so a team placed into a match slot or a knockout box must STAY in its pool roster, or it silently disappears from the public standings. `Manager.dc.html` adopts the corrected behaviour. The old file and its old assertion (`test-manager-dashboard.js`: "team removed from the pool it came from") keep passing untouched until Task 15 removes them; Task 14 records this as the one intentional behaviour difference in the whole rebuild.

**Files**
- Modify: `Manager.dc.html`
- Create: `tests/test-manager-dc-draw.js`
- Modify: `tests/runall.ps1`
- Test: `tests/test-manager-dc-draw.js`

**Interfaces**
- Consumes: Task 3's `state.draw`, `drawLoadedFor`, `drawDirty`, `drawMsg`, `picked`, `newTeamDrafts`, `clash`, `importRows`, `importOpen`, `importMode`, `tab`, `ageId`, `session`; Task 3's `go(tab)` and `load(agId)` (both REPLACED here), `confirmModal`, `promptModal`, `tName`. From `scores-data.js`: `getDraw(agId, session)`.
- Produces: methods `loadDraw(agId)`, `clearDrawPicks()`, `clearDrawTransientState()`, `pickTeam(team, from)`, `sameSource(a, b)`, `removeFromSource(draw, from)`, `placeTeam(dest)`, `addPool()`, `onRenamePool(poolId)`, `onRemovePool(poolId)`, `onNewTeamInput(poolId, val)`, `onAddTeam(poolId)`, `onRenameTeam(poolId, oldName)`, `onRemoveTeam(poolId, team)`; replaced `go(tab)` and `load(agId)`.
- Source/destination shape used everywhere in the Draw tab: `{ kind: 'pool', poolId }` | `{ kind: 'slot', slotId, side }` | `{ kind: 'knockout', slotId, side }`, where `side` is `'home'` or `'away'`. `state.picked` is `{ team, from }` or `null`.
- `renderVals()` keys: `drawLoading`, `drawMissing`, `drawDirty`, `drawMsg`, `poolCards` (`[{ id, name, teamChips:[{name,label,chipStyle,onPick,onRename,onRemove}], onZoneClick, newTeamValue, onNewTeamInput, onAddTeam, onRenamePool, onRemovePool }]`).

**Steps**

- [ ] 1. Create `tests/test-manager-dc-draw.js`:

```js
/* tests/test-manager-dc-draw.js
   ------------------------------------------------------------------------
   The Draw tab on Manager.dc.html. Same .dc.html harness as
   tests/test-scores-draw-editor.js (DCLogic stand-in + regex the
   <script type="text/x-dc"> block out and eval it), duplicated per test file
   as this project does throughout.

   ONE INTENTIONAL DIFFERENCE FROM Manager.html, asserted here on purpose:
   pools[].teams is pool MEMBERSHIP (computeStandings reads it directly), so
   placing a team into a match slot or knockout box does NOT remove it from
   its pool roster. Manager.html removed it, which is the bug the uniform
   draw editor fixed in Scores & Standings.dc.html.
*/
const { readRepo, section, check, eq, summary } = require('./_lib');

class DCLogic {
  setState(patch, cb) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    if (typeof cb === 'function') cb();
  }
}

function loadComponent(file) {
  const t = readRepo(file);
  const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`no x-dc script found in ${file}`);
  // eslint-disable-next-line no-new-func
  return new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
    DCLogic,
    { addEventListener() {}, matchMedia: () => ({ matches: false, addListener() {} }), scrollTo() {} },
    { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], body: { style: {} }, baseURI: 'https://adhjrt.com/' }
  );
}

function build(file, props) {
  const C = loadComponent(file);
  const c = new C();
  c.props = props || {};
  return c;
}

function freshDraw() {
  return {
    pools: [
      { id: 'A', name: 'Pool A', teams: ['ADH1', 'DS1'] },
      { id: 'B', name: 'Pool B', teams: ['DE1'] },
    ],
    slots: [
      { id: 'sA1', poolId: 'A', home: 'ADH1', away: '', startMins: 480, pitch: 'A1' },
      { id: 'sB1', poolId: 'B', home: '', away: '', startMins: 480, pitch: 'A2' },
    ],
    knockout: [
      { id: 'u14b:CUP', round: 'Cup Final', home: '', away: '', startMins: 600, pitch: 'A1' },
    ],
    pitches: ['A1', 'A2'],
    _publish: { published: false, publishedAt: null, publishedBy: null, managerCanPublishNow: false },
  };
}

function drawApi(overrides) {
  return Object.assign({
    getDraw: async () => freshDraw(),
    saveDraw: async () => ({ ok: true }),
    publishDraw: async () => ({ ok: true, published: true }),
    unpublishDraw: async () => ({ ok: true, published: false }),
    canPublishNow: () => false,
    autoKnockoutSlots: async () => [],
    regeneratePoolSlots: (agId, poolId, teams) => (teams || []).slice(0, -1).map((t, i) => ({
      id: `${agId}:${poolId}:regen${i}`, poolId, home: t, away: teams[i + 1] || '', startMins: 8 * 60 + i * 20, pitch: 'TBD',
    })),
    pitchesForAgeGroup: () => ['A1', 'A2'],
    minutesToTimeInput: (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
    minutesToDisplay: (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`,
    timeToMinutes: (hhmm) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
      if (!m) return NaN;
      return Number(m[1]) * 60 + Number(m[2]);
    },
    slotLengthMins: () => 20,
    dayStartMins: () => 8 * 60,
    loadAllDraws: async () => ({ drawsByAge: {}, ageNames: {}, failed: [] }),
    weekendClashes: () => ({ clashes: [], unplaced: [], offAllocation: [], placedCount: 0 }),
    describeClash: () => '',
    isOrganiserSession: (s) => !!(s && s.isOrganizer),
    getMyRegistrations: async () => ({ teams: [], players: [], scope: '' }),
    getFixtures: async () => ({ awaitingPublication: false, pool: [], knockout: [] }),
    getStandings: async () => ({ awaitingPublication: false, ageGroup: { hasStandings: true, name: 'U14 Boys' }, pools: [], tables: {}, _advance: 0 }),
    getSpiritAward: async () => ({ supported: false }),
    supportsSpiritAward: () => false,
    teamLabel: (c) => c, teamShort: (c) => c,
  }, overrides || {});
}

/* A component already signed in, already on the Draw tab, with the draw
   loaded — the state every Draw-tab test starts from. */
function buildDraw(apiOverrides) {
  const c = build('Manager.dc.html');
  c.state = {
    ...c.state,
    api: drawApi(apiOverrides),
    session: { ageGroupId: 'u14b', token: 'tok' },
    ageGroups: [{ id: 'u14b', name: 'U14 Boys', hasStandings: true }],
    ageId: 'u14b',
    tab: 'draw',
    draw: freshDraw(),
    drawLoadedFor: 'u14b',
    fixtures: { awaitingPublication: false, pool: [], knockout: [] },
  };
  return c;
}

function pool(c, id) { return c.state.draw.pools.find((p) => p.id === id); }
function slot(c, id) { return c.state.draw.slots.find((s) => s.id === id); }
function ko(c, id) { return (c.state.draw.knockout || []).find((s) => s.id === id); }

async function main() {

section('loadDraw(): fetching, loading state, and the empty state');
{
  let asked = null;
  const c = buildDraw({ getDraw: async (agId, session) => { asked = [agId, session && session.token]; return freshDraw(); } });
  c.setState({ draw: undefined, drawLoadedFor: null });
  check('before the fetch the tab reports it is loading', c.renderVals().drawLoading === true);
  await c.loadDraw('u14b');
  check('getDraw is called for this age group, with the session', eq('getDraw args', asked, ['u14b', 'tok']));
  check('the draw lands in state', c.state.draw && c.state.draw.pools.length === 2);
  check('…and is marked as loaded for this age group', c.state.drawLoadedFor === 'u14b');
  check('a freshly loaded draw is not dirty', c.state.drawDirty === false);
}
{
  const c = buildDraw({ getDraw: async () => null });
  c.setState({ draw: undefined, drawLoadedFor: null });
  await c.loadDraw('u14b');
  // FAULT-PROOF: state.draw is null BOTH while a fetch is in flight and after
  // a settled fetch that found nothing. drawLoadedFor is what tells them
  // apart — without it, "no draw saved yet" renders as a permanent spinner.
  check('a settled fetch that found no draw shows the empty state, not a spinner',
    c.renderVals().drawMissing === true && c.renderVals().drawLoading === false);
}
{
  const c = buildDraw();
  c.setState({ tab: 'today', draw: undefined, drawLoadedFor: null });
  c.go('draw');
  await new Promise((r) => setImmediate(r));
  check('switching to the Draw tab loads the draw', c.state.drawLoadedFor === 'u14b');
}
{
  let fetches = 0;
  const c = buildDraw({ getDraw: async () => { fetches++; return freshDraw(); } });
  c.setState({ tab: 'today' });
  c.go('draw');
  await new Promise((r) => setImmediate(r));
  check('an already-loaded draw is not refetched on every visit', fetches === 0);
}

section('pickTeam(): select and deselect');
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  check('picking a team records it', c.state.picked && c.state.picked.team === 'DS1');
  check('…with its source', c.state.picked.from.kind === 'pool' && c.state.picked.from.poolId === 'A');
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  check('tapping the same team in the same place again deselects', c.state.picked === null);
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.pickTeam('ADH1', { kind: 'slot', slotId: 'sA1', side: 'home' });
  // FAULT-PROOF: a toggle that ignored the identity would deselect here
  // instead of switching, leaving the manager with nothing in hand.
  check('picking a different team replaces the pick rather than toggling it off',
    c.state.picked && c.state.picked.team === 'ADH1' && c.state.picked.from.kind === 'slot');
}

section('placeTeam(): moves, and the dedup rule');
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.placeTeam({ kind: 'pool', poolId: 'B' });
  check('a pool-to-pool move leaves the old pool', !pool(c, 'A').teams.includes('DS1'));
  check('…and joins the new one', pool(c, 'B').teams.includes('DS1'));
  check('the pick clears after a successful place', c.state.picked === null);
  check('…and the draw is marked unsaved', c.state.drawDirty === true);
}
{
  const c = buildDraw();
  c.pickTeam('ADH1', { kind: 'slot', slotId: 'sA1', side: 'home' });
  c.placeTeam({ kind: 'slot', slotId: 'sB1', side: 'home' });
  // FAULT-PROOF: this is the dedup rule. A place that only wrote the
  // destination would leave ADH1 in BOTH slots.
  check('a slot-to-slot move clears the old slot', slot(c, 'sA1').home === '');
  check('…and fills the new one', slot(c, 'sB1').home === 'ADH1');
}
{
  const c = buildDraw();
  c.pickTeam('ADH1', { kind: 'slot', slotId: 'sA1', side: 'home' });
  c.placeTeam({ kind: 'slot', slotId: 'sA1', side: 'away' });
  check('moving within one slot clears the side it left', slot(c, 'sA1').home === '');
  check('…and sets the side it landed on', slot(c, 'sA1').away === 'ADH1');
}
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.placeTeam({ kind: 'slot', slotId: 'sB1', side: 'away' });
  // FAULT-PROOF, and the one intentional difference from Manager.html:
  // pools[].teams is MEMBERSHIP. computeStandings() reads it directly, so a
  // team that vanished from its pool here would vanish from the public
  // standings table too.
  check('placing a pool team into a match slot leaves it in its pool roster', pool(c, 'A').teams.includes('DS1'));
  check('…and it lands in the slot', slot(c, 'sB1').away === 'DS1');
}
{
  const c = buildDraw();
  c.pickTeam('DE1', { kind: 'pool', poolId: 'B' });
  c.placeTeam({ kind: 'knockout', slotId: 'u14b:CUP', side: 'home' });
  check('placing a pool team into a knockout box leaves it in its pool roster', pool(c, 'B').teams.includes('DE1'));
  check('…and it lands in the knockout box', ko(c, 'u14b:CUP').home === 'DE1');

  c.pickTeam('DE1', { kind: 'knockout', slotId: 'u14b:CUP', side: 'home' });
  c.placeTeam({ kind: 'knockout', slotId: 'u14b:CUP', side: 'away' });
  check('moving within one knockout slot clears the old side', ko(c, 'u14b:CUP').home === '');
  check('…and sets the new side', ko(c, 'u14b:CUP').away === 'DE1');
}
{
  const c = buildDraw();
  c.pickTeam('ADH1', { kind: 'slot', slotId: 'sA1', side: 'home' });
  c.placeTeam({ kind: 'pool', poolId: 'B' });
  check('a slot-picked team moved into a pool leaves its old pool', !pool(c, 'A').teams.includes('ADH1'));
  check('…joins the new pool', pool(c, 'B').teams.includes('ADH1'));
  check('…and vacates the slot it was sitting in', slot(c, 'sA1').home === '');
}
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.placeTeam({ kind: 'slot', slotId: 'sA1', side: 'home' }); // sA1.home currently holds ADH1
  check('placing onto an occupied box overwrites it', slot(c, 'sA1').home === 'DS1');
  check('…and the displaced team is simply no longer in that box', slot(c, 'sA1').away === '');
}
{
  const c = buildDraw();
  c.placeTeam({ kind: 'pool', poolId: 'B' });
  check('placing with nothing picked changes nothing', eq('Pool B untouched', pool(c, 'B').teams, ['DE1']));
  check('…and does not mark the draw unsaved', c.state.drawDirty === false);

  const c2 = buildDraw();
  c2.setState({ draw: null, picked: { team: 'X', from: { kind: 'pool', poolId: 'A' } } });
  c2.placeTeam({ kind: 'pool', poolId: 'A' });
  check('placing with no draw loaded does not throw', true);
}

section('Pool CRUD');
{
  const c = buildDraw();
  c.addPool();
  check('adding a pool adds exactly one', c.state.draw.pools.length === 3);
  // FAULT-PROOF: the id must be the first UNUSED letter, not "next after the
  // last one" — deleting B and adding again has to reuse B, not skip to D.
  check('…with the first unused letter as its id', c.state.draw.pools[2].id === 'C');
  check('…named after it', c.state.draw.pools[2].name === 'Pool C');
  check('…and empty', c.state.draw.pools[2].teams.length === 0);
  check('…and the draw is marked unsaved', c.state.drawDirty === true);
}
{
  const c = buildDraw();
  c.onRemovePool('B');
  c.submitModal();
  c.addPool();
  check('a freed letter is reused rather than skipped', c.state.draw.pools.map((p) => p.id).includes('B'));
}
{
  const c = buildDraw();
  c.onRenamePool('A');
  check('renaming a pool asks for the new name', !!c.state.modal && c.state.modal.kind === 'prompt');
  check('…seeded with the current name', c.state.modalValue === 'Pool A');
  c.setState({ modalValue: 'Pool Alpha' });
  c.submitModal();
  check('…and applies it', pool(c, 'A').name === 'Pool Alpha');
  check('…marking the draw unsaved', c.state.drawDirty === true);
}
{
  const c = buildDraw();
  c.onRemovePool('A');
  check('deleting a pool asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…and nothing is deleted until it is confirmed', c.state.draw.pools.length === 2);
  c.submitModal();
  check('confirming removes the pool', c.state.draw.pools.length === 1 && !pool(c, 'A'));
  // FAULT-PROOF: a pool's match slots belong to it. Leaving them behind gives
  // orphan fixtures for a pool that no longer exists.
  check('…and its match slots go with it', !slot(c, 'sA1'));
  check('…leaving other pools\' slots alone', !!slot(c, 'sB1'));
}
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.onRemovePool('A');
  c.submitModal();
  // FAULT-PROOF: a team still "in hand" from a pool that no longer exists can
  // be dropped into a surviving pool a moment later, resurrecting it.
  check('deleting a pool clears a pick taken from its roster', c.state.picked === null);
}
{
  const c = buildDraw();
  // DE1 belongs to Pool B but is sitting in a Pool A slot — so this isolates
  // the SLOT-ownership guard from the roster guard.
  c.pickTeam('DE1', { kind: 'pool', poolId: 'B' });
  c.placeTeam({ kind: 'slot', slotId: 'sA1', side: 'away' });
  c.pickTeam('DE1', { kind: 'slot', slotId: 'sA1', side: 'away' });
  c.onRemovePool('A');
  c.submitModal();
  check('deleting a pool also clears a pick taken from one of ITS match slots', c.state.picked === null);
}
{
  const c = buildDraw();
  c.pickTeam('DE1', { kind: 'pool', poolId: 'B' });
  c.onRemovePool('A');
  c.submitModal();
  // FAULT-PROOF the other way: an unconditional clear would wipe a perfectly
  // valid pick belonging to a pool that was not touched.
  check('deleting an unrelated pool leaves the pick alone', c.state.picked && c.state.picked.team === 'DE1');
}

section('Team CRUD');
{
  const c = buildDraw();
  c.onNewTeamInput('A', 'NEW1');
  check('the new-team box keeps what was typed, per pool', c.state.newTeamDrafts.A === 'NEW1');
  c.onAddTeam('A');
  check('adding puts the team in that pool', pool(c, 'A').teams.includes('NEW1'));
  check('…and empties the box for the next one', !c.state.newTeamDrafts.A);
  check('…and marks the draw unsaved', c.state.drawDirty === true);

  c.onNewTeamInput('A', '   ');
  c.onAddTeam('A');
  check('adding blank whitespace adds nothing', pool(c, 'A').teams.length === 3);
  c.onNewTeamInput('A', 'NEW1');
  c.onAddTeam('A');
  check('adding a team already in that pool does not duplicate it',
    pool(c, 'A').teams.filter((t) => t === 'NEW1').length === 1);
}
{
  const c = buildDraw();
  c.onRenameTeam('A', 'ADH1');
  check('renaming a team asks for the new name', !!c.state.modal && c.state.modal.kind === 'prompt');
  c.setState({ modalValue: 'ADHX' });
  c.submitModal();
  check('the roster carries the new name', pool(c, 'A').teams.includes('ADHX') && !pool(c, 'A').teams.includes('ADH1'));
  // FAULT-PROOF: a rename that only touched the roster would leave the match
  // slot pointing at a team name nothing else knows about.
  check('…and so does every match slot that named it', slot(c, 'sA1').home === 'ADHX');
}
{
  const c = buildDraw();
  c.pickTeam('ADH1', { kind: 'pool', poolId: 'A' });
  c.onRenameTeam('A', 'ADH1');
  c.setState({ modalValue: 'ADHX' });
  c.submitModal();
  // FAULT-PROOF: the pick held the OLD name, so placing it afterwards would
  // resurrect the pre-rename team alongside the renamed one.
  check('renaming the picked team clears the pick', c.state.picked === null);
}
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.onRenameTeam('A', 'ADH1');
  c.setState({ modalValue: 'ADHX' });
  c.submitModal();
  check('renaming a different team leaves the pick alone', c.state.picked && c.state.picked.team === 'DS1');
}
{
  const c = buildDraw();
  c.onRemoveTeam('A', 'ADH1');
  check('removing a team asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…and nothing is removed until it is confirmed', pool(c, 'A').teams.includes('ADH1'));
  c.submitModal();
  check('confirming takes it out of the pool', !pool(c, 'A').teams.includes('ADH1'));
  check('…and blanks it out of any match slot that named it', slot(c, 'sA1').home === '');
}
{
  const c = buildDraw();
  c.pickTeam('ADH1', { kind: 'pool', poolId: 'A' });
  c.onRemoveTeam('A', 'ADH1');
  c.submitModal();
  check('removing the picked team clears the pick', c.state.picked === null);

  const c2 = buildDraw();
  c2.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c2.onRemoveTeam('A', 'ADH1');
  c2.submitModal();
  check('removing a different team leaves the pick alone', c2.state.picked && c2.state.picked.team === 'DS1');
}

section('renderVals(): pool cards are tap-wired');
{
  const c = buildDraw();
  const vals = c.renderVals();
  check('one card per pool', vals.poolCards.length === 2 && vals.poolCards[0].name === 'Pool A');
  const chip = vals.poolCards[0].teamChips.find((ch) => ch.name === 'ADH1');
  check('a chip exposes onPick, not a drag handler', typeof chip.onPick === 'function' && chip.onDragStart === undefined);
  check('an unpicked chip uses the neutral fill', !chip.chipStyle.includes('#17A34A'));
  chip.onPick();
  check('tapping the chip arms it', c.state.picked && c.state.picked.team === 'ADH1');
  const picked = c.renderVals().poolCards[0].teamChips.find((ch) => ch.name === 'ADH1');
  check('…and it re-renders green', picked.chipStyle.includes('#17A34A'));

  c.renderVals().poolCards[1].onZoneClick({ currentTarget: 'zone', target: 'zone' });
  check('tapping the destination pool\'s empty area places it there', pool(c, 'B').teams.includes('ADH1'));
  check('…and clears the pick', c.state.picked === null);
}
{
  const c = buildDraw();
  const vals = c.renderVals();
  vals.poolCards[0].teamChips[0].onPick();
  vals.poolCards[0].onZoneClick({ currentTarget: 'zone', target: 'a-chip-inside-it' });
  // FAULT-PROOF: a click that bubbled up from a chip must not ALSO count as a
  // drop on the zone, or every pick instantly places itself.
  check('a click that bubbled up from a child does not also place', c.state.picked !== null);
}
{
  const c = buildDraw();
  const chip = c.renderVals().poolCards[0].teamChips[0];
  let renameStopped = false, removeStopped = false;
  chip.onRename({ stopPropagation: () => { renameStopped = true; } });
  check('the chip\'s rename button stops the click bubbling into a pick', renameStopped);
  c.closeModal();
  chip.onRemove({ stopPropagation: () => { removeStopped = true; } });
  check('the chip\'s remove button does too', removeStopped);
}

section('Transient Draw state does not outlive what it referred to');
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.setState({ drawMsg: 'Saved as a draft. Use Publish to make it public.', clash: { clashes: [] }, importRows: [{ code: 'X' }] });
  c.go('today');
  // FAULT-PROOF: a stale "Saved as a draft" banner or clash result reappearing
  // the next time the Draw tab is opened tells the manager something happened
  // that did not.
  check('leaving the Draw tab clears the pick', c.state.picked === null);
  check('…the last message', c.state.drawMsg === '');
  check('…the clash result', c.state.clash === null);
  check('…and the import rows', c.state.importRows === null);
}
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.setState({ drawMsg: 'Saved as a draft. Use Publish to make it public.' });
  c.doLogout();
  check('signing out clears the pick', c.state.picked === null);
  check('…and the last message', c.state.drawMsg === '');
}
{
  const c = buildDraw();
  c.pickTeam('DS1', { kind: 'pool', poolId: 'A' });
  c.setState({ drawMsg: 'x', clash: { clashes: [] }, importRows: [{ code: 'X' }] });
  await c.load('u14b');
  check('a reload after a score save clears the pick', c.state.picked === null);
  check('…the message', c.state.drawMsg === '');
  check('…the clash result', c.state.clash === null);
  check('…and the import rows', c.state.importRows === null);
}
{
  const c = buildDraw();
  c.addPool();
  const poolsBefore = c.state.draw.pools.length;
  await c.load('u14b');
  // FAULT-PROOF: load() runs after every score save. Throwing away an unsaved
  // draw edit at that moment loses work the manager was never warned about.
  check('an unsaved Draw edit survives a reload triggered elsewhere',
    c.state.draw && c.state.draw.pools.length === poolsBefore);
  check('…and is still flagged unsaved', c.state.drawDirty === true);
  check('…and the tab says so', c.renderVals().drawDirty === true);
}

summary('tests/test-manager-dc-draw.js');
}

main();
```

- [ ] 2. Register it in `tests/runall.ps1`, after `'test-manager-dc-score-sheet.js'`:

```powershell
  'test-manager-dc-score-sheet.js',
  'test-manager-dc-draw.js'
)
```

- [ ] 3. Confirm it fails: `node tests/test-manager-dc-draw.js` → `TypeError: c.loadDraw is not a function`.

- [ ] 4. In `Manager.dc.html`, REPLACE the whole of `go(tab)` and `load(agId)` with these versions:

```js
  go(tab) {
    const s = this.state;
    const leavingDraw = s.tab === 'draw' && tab !== 'draw';
    this.setState({ tab });
    if (leavingDraw) this.clearDrawTransientState();
    if (tab === 'draw' && s.drawLoadedFor !== s.ageId && !s.drawDirty) this.loadDraw(s.ageId);
  }

  async load(agId) {
    const { api } = this.state;
    const keepDraw = this.state.drawDirty;
    /* load() runs after every score save and clear. Throwing away an
       in-progress Draw edit at that moment destroys work nobody warned the
       manager about, so a dirty draft is carried through. There is no
       age-group switcher on this page for that to race against. */
    this.setState((s) => ({
      ageId: agId, fixtures: null, standings: null, spiritAward: null,
      draw: keepDraw ? s.draw : undefined,
      drawLoadedFor: keepDraw ? s.drawLoadedFor : null,
    }));
    this.clearDrawTransientState();
    const [fx, st] = await Promise.all([api.getFixtures(agId), api.getStandings(agId)]);
    if (this.state.ageId !== agId) return; // a stale response for a group we left
    this.setState({ fixtures: fx, standings: st });
    if (this.state.tab === 'draw' && !this.state.drawDirty) await this.loadDraw(agId);
  }
```

- [ ] 5. Add the Draw-tab loading and pick/place methods after `load(agId)`:

```js
  async loadDraw(agId) {
    const { api, session } = this.state;
    this.setState({ draw: null, drawDirty: false }); // a fresh fetch IS the clean baseline
    this.clearDrawPicks();
    const draw = await api.getDraw(agId, session);
    if (this.state.ageId !== agId) return; // stale response guard, same as load()
    this.setState({ draw, drawLoadedFor: agId });
  }

  /* Split in two on purpose. clearDrawPicks() is safe to call from loadDraw(),
     which is also the last step of saveDraw()/doPublish()/doUnpublish()/
     resetDraw() — each of which has just set drawMsg to the sentence the
     manager is meant to read. Clearing drawMsg there would wipe it before it
     was ever painted. clearDrawTransientState() layers drawMsg on top, for the
     places where there is no such message to protect: load(), leaving the tab,
     and signing out. */
  clearDrawPicks() {
    this.setState({ picked: null, clash: null, importRows: null, importOpen: false, importMode: 'add' });
  }
  clearDrawTransientState() {
    this.clearDrawPicks();
    this.setState({ drawMsg: '' });
  }

  /* Tap-to-select, then tap-to-place. This page is phone-primary and HTML5
     drag-and-drop is unreliable on touch, so there is no dragging anywhere in
     this editor. Tapping the same team in the same place again deselects. */
  pickTeam(team, from) {
    const p = this.state.picked;
    if (p && p.team === team && this.sameSource(p.from, from)) this.setState({ picked: null });
    else this.setState({ picked: { team, from } });
  }
  sameSource(a, b) {
    if (!a || !b || a.kind !== b.kind) return false;
    if (a.kind === 'pool') return a.poolId === b.poolId;
    return a.slotId === b.slotId && a.side === b.side;
  }
  /* Vacates the match slot or knockout side a pick came from. Pool rosters are
     deliberately NOT touched here — see placeTeam(). */
  removeFromSource(draw, from) {
    if (from.kind === 'slot') {
      const sl = (draw.slots || []).find((x) => x.id === from.slotId);
      if (sl) sl[from.side] = '';
    } else if (from.kind === 'knockout') {
      const sl = (draw.knockout || []).find((x) => x.id === from.slotId);
      if (sl) sl[from.side] = '';
    }
  }
  placeTeam(dest) {
    const { picked, draw } = this.state;
    if (!picked || !draw) return;
    const { team, from } = picked;
    const next = JSON.parse(JSON.stringify(draw));
    // The origin box is always vacated, so a team can never sit in two match
    // slots at once — that was the drag-and-drop editor's original bug.
    this.removeFromSource(next, from);
    if (dest.kind === 'pool') {
      /* pools[].teams is pool MEMBERSHIP — computeStandings() reads it
         directly — so moving a team between pools removes it from the old
         one, but placing it into a match slot or knockout box (below) does
         not touch any roster. */
      next.pools = (next.pools || []).map((p) => ({ ...p, teams: (p.teams || []).filter((t) => t !== team) }));
      const p = next.pools.find((x) => x.id === dest.poolId);
      if (p && !p.teams.includes(team)) p.teams.push(team);
    } else if (dest.kind === 'slot') {
      const sl = (next.slots || []).find((x) => x.id === dest.slotId);
      if (sl) sl[dest.side] = team;
    } else if (dest.kind === 'knockout') {
      const sl = (next.knockout || []).find((x) => x.id === dest.slotId);
      if (sl) sl[dest.side] = team;
    }
    this.setState({ draw: next, picked: null, drawDirty: true });
  }
```

- [ ] 6. Add the pool and team CRUD methods after `placeTeam(dest)`:

```js
  addPool() {
    this.setState((s) => {
      const used = (s.draw.pools || []).map((p) => p.id);
      let nextChar = 'A';
      for (let i = 0; i < 26; i += 1) {
        const ch = String.fromCharCode(65 + i);
        if (used.indexOf(ch) < 0) { nextChar = ch; break; }
      }
      return {
        draw: { ...s.draw, pools: [...(s.draw.pools || []), { id: nextChar, name: `Pool ${nextChar}`, teams: [] }] },
        drawDirty: true,
      };
    });
  }

  onRenamePool(poolId) {
    const p = (this.state.draw.pools || []).find((x) => x.id === poolId);
    if (!p) return;
    this.promptModal('Rename pool', p.name, (next) => {
      if (next === p.name) return;
      this.setState((s) => ({
        draw: { ...s.draw, pools: (s.draw.pools || []).map((x) => (x.id === poolId ? { ...x, name: next } : x)) },
        drawDirty: true,
      }));
    });
  }

  onRemovePool(poolId) {
    this.confirmModal('Delete this pool? This removes all its teams and match slots.', () => {
      this.setState((s) => {
        const removed = (s.draw.pools || []).find((p) => p.id === poolId);
        const removedTeams = new Set((removed && removed.teams) || []);
        const removedSlotIds = new Set((s.draw.slots || []).filter((sl) => sl.poolId === poolId).map((sl) => sl.id));
        /* A pick must not outlive the pool it belonged to — neither one taken
           from its roster nor one taken from one of its match slots, because
           either could be dropped into a surviving pool a moment later. */
        const stale = !!(s.picked && (
          removedTeams.has(s.picked.team)
          || (s.picked.from.kind === 'slot' && removedSlotIds.has(s.picked.from.slotId))
        ));
        return {
          draw: {
            ...s.draw,
            pools: (s.draw.pools || []).filter((p) => p.id !== poolId),
            slots: (s.draw.slots || []).filter((sl) => sl.poolId !== poolId),
          },
          picked: stale ? null : s.picked,
          drawDirty: true,
        };
      });
    }, { okLabel: 'Delete pool' });
  }

  onNewTeamInput(poolId, val) {
    this.setState((s) => ({ newTeamDrafts: { ...s.newTeamDrafts, [poolId]: val } }));
  }

  onAddTeam(poolId) {
    const name = String((this.state.newTeamDrafts || {})[poolId] || '').trim();
    if (!name) return;
    this.setState((s) => ({
      draw: {
        ...s.draw,
        pools: (s.draw.pools || []).map((p) => (p.id === poolId && p.teams.indexOf(name) < 0
          ? { ...p, teams: [...p.teams, name] } : p)),
      },
      newTeamDrafts: { ...s.newTeamDrafts, [poolId]: '' },
      drawDirty: true,
    }));
  }

  onRenameTeam(poolId, oldName) {
    this.promptModal('Rename team', oldName, (next) => {
      if (next === oldName) return;
      this.setState((s) => ({
        draw: {
          ...s.draw,
          pools: (s.draw.pools || []).map((p) => (p.id === poolId
            ? { ...p, teams: p.teams.map((t) => (t === oldName ? next : t)) } : p)),
          /* Every match slot naming the old team follows it, or the slot ends
             up pointing at a team no roster contains. */
          slots: (s.draw.slots || []).map((sl) => ({
            ...sl,
            home: sl.home === oldName ? next : sl.home,
            away: sl.away === oldName ? next : sl.away,
          })),
          knockout: (s.draw.knockout || []).map((sl) => ({
            ...sl,
            home: sl.home === oldName ? next : sl.home,
            away: sl.away === oldName ? next : sl.away,
          })),
        },
        // The pick held the OLD name — placing it afterwards would resurrect it.
        picked: (s.picked && s.picked.team === oldName) ? null : s.picked,
        drawDirty: true,
      }));
    });
  }

  onRemoveTeam(poolId, team) {
    this.confirmModal(`Remove ${team} from this pool? Any match slots featuring them will show "Tap to place" until reassigned.`, () => {
      this.setState((s) => ({
        draw: {
          ...s.draw,
          pools: (s.draw.pools || []).map((p) => (p.id === poolId ? { ...p, teams: p.teams.filter((t) => t !== team) } : p)),
          slots: (s.draw.slots || []).map((sl) => ({
            ...sl,
            home: sl.home === team ? '' : sl.home,
            away: sl.away === team ? '' : sl.away,
          })),
        },
        picked: (s.picked && s.picked.team === team) ? null : s.picked,
        drawDirty: true,
      }));
    }, { okLabel: 'Remove team' });
  }
```

- [ ] 7. Extend `renderVals()`. Add to the computed block:

```js
    const d = s.draw;
    const chipBase = 'display:inline-flex;align-items:center;gap:6px;border-radius:100px;padding:8px 8px 8px 14px;font-size:13px;font-weight:700;margin:3px;cursor:pointer;border:1px solid ';
    const chipOff = chipBase + 'rgba(255,255,255,0.15);background:#0C0C0E;color:#fff;';
    const chipOn = chipBase + '#0F7A36;background:#17A34A;color:#fff;';
    const poolCards = d ? (d.pools || []).map((p) => ({
      id: p.id,
      name: p.name,
      teamChips: (p.teams || []).map((t) => ({
        name: t,
        label: this.tName(t),
        chipStyle: (s.picked && s.picked.team === t && s.picked.from.kind === 'pool' && s.picked.from.poolId === p.id) ? chipOn : chipOff,
        onPick: () => this.pickTeam(t, { kind: 'pool', poolId: p.id }),
        onRename: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.onRenameTeam(p.id, t); },
        onRemove: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.onRemoveTeam(p.id, t); },
      })),
      /* Only a click on the zone ITSELF places — a click that bubbled up from
         a chip inside it is that chip's business. */
      onZoneClick: (e) => { if (!e || e.target === e.currentTarget) this.placeTeam({ kind: 'pool', poolId: p.id }); },
      newTeamValue: (s.newTeamDrafts || {})[p.id] || '',
      onNewTeamInput: (e) => this.onNewTeamInput(p.id, e.target.value),
      onAddTeam: () => this.onAddTeam(p.id),
      onRenamePool: () => this.onRenamePool(p.id),
      onRemovePool: () => this.onRemovePool(p.id),
    })) : [];
```

and these keys to the returned object:

```js
      drawLoading: s.draw === undefined || (s.draw === null && s.drawLoadedFor !== s.ageId),
      drawMissing: s.draw === null && s.drawLoadedFor === s.ageId,
      drawDirty: s.drawDirty,
      drawMsg: s.drawMsg,
      poolCards,
      onAddPool: () => this.addPool(),
```

- [ ] 8. Replace the Draw placeholder card in the template with this (Tasks 10-12 append their own blocks inside the same `<sc-if value="{{ isDraw }}">`):

```html
      <sc-if value="{{ isDraw }}" hint-placeholder-val="{{ false }}">
        <div style="margin-top:24px">
          <div style="font-family:'Anton';font-size:18px;text-transform:uppercase;letter-spacing:.4px;margin-bottom:12px">Draw</div>

          <sc-if value="{{ drawLoading }}" hint-placeholder-val="{{ false }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center;color:#7f8794;font-size:14px">Loading…</div>
          </sc-if>
          <sc-if value="{{ drawMissing }}" hint-placeholder-val="{{ false }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center">
              <div style="font-family:'Anton';font-size:22px;text-transform:uppercase;margin-bottom:8px">No draw yet</div>
              <div style="color:#7f8794;font-size:14px">Nothing to edit for {{ ageLabel }}.</div>
            </div>
          </sc-if>

          <sc-for list="{{ poolCards }}" as="p" hint-placeholder-count="2">
            <div style="display:flex;align-items:center;gap:10px;margin:18px 0 10px;flex-wrap:wrap">
              <div style="font-family:'Anton';font-size:17px;text-transform:uppercase">{{ p.name }}</div>
              <button onClick="{{ p.onRenamePool }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#aeb4bf;font-weight:700;font-size:11px;padding:5px 12px;border-radius:8px;cursor:pointer">Rename</button>
              <button onClick="{{ p.onRemovePool }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#ff8a8a;font-weight:700;font-size:11px;padding:5px 12px;border-radius:8px;cursor:pointer">Delete</button>
            </div>
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px">
              <div onClick="{{ p.onZoneClick }}" style="min-height:48px;padding:10px;background:#0C0C0E;border:1.5px dashed rgba(255,255,255,0.15);border-radius:10px;display:flex;flex-wrap:wrap;align-items:flex-start">
                <sc-for list="{{ p.teamChips }}" as="ch" hint-placeholder-count="4">
                  <span onClick="{{ ch.onPick }}" style="{{ ch.chipStyle }}">{{ ch.label }}
                    <button onClick="{{ ch.onRename }}" aria-label="Rename" style="background:transparent;border:none;color:inherit;font-size:13px;padding:2px 4px;cursor:pointer">✎</button>
                    <button onClick="{{ ch.onRemove }}" aria-label="Remove" style="background:transparent;border:none;color:inherit;font-size:13px;padding:2px 4px;cursor:pointer">×</button>
                  </span>
                </sc-for>
              </div>
              <div style="display:flex;gap:8px;margin-top:12px">
                <input value="{{ p.newTeamValue }}" onInput="{{ p.onNewTeamInput }}" placeholder="New team name" style="flex:1;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:11px 14px;color:#fff;font-size:14px">
                <button onClick="{{ p.onAddTeam }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;font-weight:700;font-size:13px;padding:11px 16px;border-radius:9px;cursor:pointer;white-space:nowrap">+ Add</button>
              </div>
            </div>
          </sc-for>

          <button onClick="{{ onAddPool }}" style="margin:16px 0;background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;font-weight:800;font-size:13px;padding:12px 18px;border-radius:10px;cursor:pointer;text-transform:uppercase">+ Add pool</button>
        </div>
      </sc-if>
```

- [ ] 9. Verify: `node tests/test-manager-dc-draw.js` — all checks pass.

- [ ] 10. Prove against injected faults, reverting each:

  (a) In `placeTeam()`, delete the `this.removeFromSource(next, from);` line. Run — "a slot-to-slot move clears the old slot" and "moving within one slot clears the side it left" must FAIL. Revert.

  (b) In `placeTeam()`, strip the team from every pool unconditionally (move the `next.pools = ...filter...` line above the `if (dest.kind === 'pool')`). Run — "placing a pool team into a match slot leaves it in its pool roster" and the knockout equivalent must FAIL. Revert.

  (c) In `addPool()`, replace the first-unused-letter loop with `String.fromCharCode(65 + used.length)`. Run — "a freed letter is reused rather than skipped" must FAIL. Revert.

  (d) In `onRemovePool()`, drop the `removedSlotIds` half of the `stale` test. Run — "deleting a pool also clears a pick taken from one of ITS match slots" must FAIL. Revert.

  (e) In `onRemovePool()`, make `stale` unconditionally `true`. Run — "deleting an unrelated pool leaves the pick alone" must FAIL. Revert.

  (f) In `onRenameTeam()`, stop rewriting `slots`. Run — "so does every match slot that named it" must FAIL. Revert.

  (g) In `onRenameTeam()`, always clear the pick (`picked: null`). Run — "renaming a different team leaves the pick alone" must FAIL. Revert.

  (h) In `load()`, set `draw: undefined, drawLoadedFor: null` unconditionally (ignore `keepDraw`). Run — "an unsaved Draw edit survives a reload triggered elsewhere" must FAIL. Revert.

  (i) In `renderVals()`, change `onZoneClick` to place unconditionally. Run — "a click that bubbled up from a child does not also place" must FAIL. Revert.

  (j) In `renderVals()`, set `drawMissing: false`. Run — "a settled fetch that found no draw shows the empty state" must FAIL. Revert.

- [ ] 11. `powershell tests/runall.ps1` — whole suite green, including the untouched `test-manager-dashboard.js`.

- [ ] 12. Commit on `dev`:

```
git checkout dev
git add Manager.dc.html tests/test-manager-dc-draw.js tests/runall.ps1
git commit -F commitmsg.txt   # "Manager.dc.html: Draw tab pick/place and pool/team editing"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files`, and on the PC:

```
git fetch origin --prune
git checkout dev
git add Manager.dc.html tests/test-manager-dc-draw.js tests/runall.ps1
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash
git push origin dev
```

## Task 10 — Draw tab, part 2: match-slot editor, knockout builder, save / discard / regenerate

**Files**
- Modify: `Manager.dc.html`
- Modify: `tests/test-manager-dc-draw.js`
- Test: `tests/test-manager-dc-draw.js`

**Interfaces**
- Consumes: Task 9's `state.draw`, `drawDirty`, `picked`, `pickTeam(team, from)`, `placeTeam(dest)`, `loadDraw(agId)`, `clearDrawPicks()`, and the `poolCards` mapping in `renderVals()`; Task 3's `confirmModal`, `promptModal`, `tName`; Task 3's `state.fixtures` for the knockout gating. From `scores-data.js`: `slotLengthMins()`, `dayStartMins()`, `timeToMinutes(hhmm)`, `minutesToTimeInput(mins)`, `pitchesForAgeGroup(agId)`, `regeneratePoolSlots(agId, poolId, teams)`, `autoKnockoutSlots(agId, session)`, `saveDraw(agId, draw, session)`.
- Produces: methods `poolPitchOf(poolId, draw)`, `onBoxTap(kind, slotId, side, team)`, `addSlot(poolId)`, `removeSlot(slotId)`, `regeneratePool(poolId)`, `onSlotTimeChange(slotId, hhmm)`, `onSlotPitchChange(slotId, val)`, `addKnockoutSlot()`, `removeKnockoutSlot(slotId)`, `onRenameKnockoutRound(slotId)`, `onKnockoutTimeChange(slotId, hhmm)`, `onKnockoutPitchChange(slotId, val)`, `regenerateKnockout()`, `generateFinals()`, `clearKnockout()`, `saveDraw()`, `discardDraw()`, `resetDraw()`.
- Extends each `poolCards[]` entry with `slotRows[]` (`{id,time,onTimeChange,pitch,pitchOptions,onPitchChange,homeLabel,awayLabel,homeStyle,awayStyle,onHomeClick,onAwayClick,onRemove}`), `onAddSlot`, `onRegeneratePool`. Adds `renderVals()` keys `knockoutRows[]` (same row shape plus `round` and `onRenameRound`), `hasKnockoutRows`, `canGenerateKnockout`, `canGenerateFinals`, `showPoolScoresHint`, `showPlaySemisHint`, `drawBusy`, `onAddKnockout`, `onRegenerateKnockout`, `onGenerateFinals`, `onClearKnockout`, `onSaveDraw`, `onDiscardDraw`, `onResetDraw`.

**Steps**

- [ ] 1. Add these sections to `tests/test-manager-dc-draw.js`, immediately before `summary('tests/test-manager-dc-draw.js');`:

```js
section('Match-slot editor');
{
  const c = buildDraw();
  const before = c.state.draw.slots.length;
  c.addSlot('A');
  check('adding a slot adds exactly one', c.state.draw.slots.length === before + 1);
  const added = c.state.draw.slots[c.state.draw.slots.length - 1];
  check('…to the pool it was added from', added.poolId === 'A');
  check('…starting empty', !added.home && !added.away);
  // FAULT-PROOF: a new slot must go AFTER the pool's last one, a slot length
  // later — not on top of it, and not at the start of the day.
  check('…one slot length after that pool\'s last match', added.startMins === 480 + 20);
  check('…on the pitch that pool is already using', added.pitch === 'A1');
  check('…and the draw is marked unsaved', c.state.drawDirty === true);

  c.removeSlot(added.id);
  check('removing a slot takes it back out', c.state.draw.slots.length === before);
}
{
  const c = buildDraw();
  // Pool B's only slot is on A2, so a second one must follow that pitch, not A1.
  c.addSlot('B');
  const added = c.state.draw.slots[c.state.draw.slots.length - 1];
  check('a pool on a different pitch keeps that pitch', added.pitch === 'A2');
}
{
  const c = buildDraw();
  c.setState({ draw: { ...c.state.draw, slots: c.state.draw.slots.map((sl) => (sl.poolId === 'A' ? { ...sl, pitch: 'A2' } : sl)) } });
  c.addSlot('A');
  const added = c.state.draw.slots[c.state.draw.slots.length - 1];
  check('a pool whose slots disagree about the pitch falls back to TBD rather than guessing', added.pitch === 'TBD' || added.pitch === 'A2');
}
{
  const c = buildDraw();
  c.onSlotTimeChange('sA1', '09:40');
  check('a new time is stored in minutes', slot(c, 'sA1').startMins === 9 * 60 + 40);
  c.onSlotTimeChange('sA1', 'not-a-time');
  // FAULT-PROOF: a NaN startMins sorts unpredictably and breaks the public
  // fixture list's own time sort, so garbage is refused rather than stored.
  check('an unparseable time is refused, keeping the last good one', slot(c, 'sA1').startMins === 9 * 60 + 40);
  c.onSlotPitchChange('sA1', 'A2');
  check('a pitch change is stored', slot(c, 'sA1').pitch === 'A2');
}
{
  const c = buildDraw();
  c.regeneratePool('A');
  check('regenerating a pool asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…warning that scores go with the old slots', /scores already entered/i.test(c.state.modal.title));
  check('…and changes nothing until confirmed', !!slot(c, 'sA1'));
  c.submitModal();
  check('confirming replaces that pool\'s slots', !slot(c, 'sA1') && c.state.draw.slots.some((sl) => sl.poolId === 'A'));
  // FAULT-PROOF: regenerating one pool must not touch another pool's slots.
  check('…and leaves the other pool\'s slots alone', !!slot(c, 'sB1'));
  check('…keeping the pitch the pool was already on', c.state.draw.slots.filter((sl) => sl.poolId === 'A').every((sl) => sl.pitch === 'A1'));
}

section('Match-slot boxes are tap-wired');
{
  const c = buildDraw();
  let rows = c.renderVals().poolCards[0].slotRows;
  const rowA1 = rows.find((r) => r.id === 'sA1');
  check('slot rows are sorted by start time', rows[0].id === 'sA1');
  check('a box exposes onHomeClick, not a drop handler', typeof rowA1.onHomeClick === 'function' && rowA1.onDropHome === undefined);
  check('the occupied side shows its team', rowA1.homeLabel === 'ADH1');
  check('the empty side invites a tap', rowA1.awayLabel === 'Tap to place');

  rowA1.onHomeClick();
  check('tapping a filled box with nothing picked arms it',
    c.state.picked && c.state.picked.team === 'ADH1' && c.state.picked.from.kind === 'slot');
  check('…and it re-renders green', c.renderVals().poolCards[0].slotRows.find((r) => r.id === 'sA1').homeStyle.includes('#17A34A'));

  c.renderVals().poolCards[1].slotRows.find((r) => r.id === 'sB1').onAwayClick();
  check('tapping another box while armed places there', slot(c, 'sB1').away === 'ADH1');
  check('…and vacates the old box', slot(c, 'sA1').home === '');
  check('…and clears the pick', c.state.picked === null);

  c.renderVals().poolCards[0].slotRows.find((r) => r.id === 'sA1').onHomeClick();
  // FAULT-PROOF: an empty box with nothing in hand has nothing to pick up —
  // arming an empty string would let a blank be "placed" over a real team.
  check('tapping an empty box with nothing picked does nothing', c.state.picked === null);
}

section('Knockout builder');
{
  const c = buildDraw();
  const before = c.state.draw.knockout.length;
  c.addKnockoutSlot();
  check('adding a knockout match adds one', c.state.draw.knockout.length === before + 1);
  const added = c.state.draw.knockout[c.state.draw.knockout.length - 1];
  check('…starting empty', !added.home && !added.away);
  check('…with an editable label', added.round === 'New knockout match');
  check('…after the last knockout match', added.startMins === 600 + 20);

  c.onRenameKnockoutRound(added.id);
  check('renaming a knockout label asks first', !!c.state.modal && c.state.modal.kind === 'prompt');
  c.setState({ modalValue: 'Semi 1' });
  c.submitModal();
  check('…and applies it', ko(c, added.id).round === 'Semi 1');

  c.onKnockoutTimeChange(added.id, '11:30');
  check('a knockout time change is stored', ko(c, added.id).startMins === 11 * 60 + 30);
  c.onKnockoutTimeChange(added.id, 'rubbish');
  check('an unparseable knockout time is refused', ko(c, added.id).startMins === 11 * 60 + 30);
  c.onKnockoutPitchChange(added.id, 'A2');
  check('a knockout pitch change is stored', ko(c, added.id).pitch === 'A2');

  c.removeKnockoutSlot(added.id);
  check('removing a knockout match takes it out', c.state.draw.knockout.length === before);
}
{
  const c = buildDraw();
  const row = c.renderVals().knockoutRows.find((r) => r.id === 'u14b:CUP');
  check('a knockout row is labelled by its round', row.round === 'Cup Final');
  c.renderVals().poolCards[0].teamChips.find((ch) => ch.name === 'DS1').onPick();
  row.onHomeClick();
  check('a team picked from a pool lands in a knockout box', ko(c, 'u14b:CUP').home === 'DS1');
  check('…and stays in its pool roster', pool(c, 'A').teams.includes('DS1'));
}
{
  let autoCalls = 0;
  const c = buildDraw({ autoKnockoutSlots: async () => { autoCalls++; return [
    { id: 'u14b:CUP', round: 'Cup Final', home: 'DS1', away: 'DT1', startMins: 600, pitch: 'TBD' },
  ]; } });
  c.regenerateKnockout();
  check('regenerating the bracket asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…and calls nothing until confirmed', autoCalls === 0);
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('confirming asks the API to re-seed from live standings', autoCalls === 1);
  check('…and the bracket is replaced by what came back',
    c.state.draw.knockout.length === 1 && c.state.draw.knockout[0].home === 'DS1');
  check('…marking the draw unsaved', c.state.drawDirty === true);
}
{
  const c = buildDraw({ autoKnockoutSlots: async () => [
    { id: 'u14b:CUP', round: 'Cup Final', home: 'DS1', away: 'DT1', startMins: 600, pitch: 'TBD' },
    { id: 'u14b:SEMI1', round: 'Semi 1', home: 'X', away: 'Y', startMins: 540, pitch: 'TBD' },
  ] });
  c.setState({ draw: { ...c.state.draw, knockout: [
    { id: 'u14b:SEMI1', round: 'Semi 1', home: 'ADH1', away: 'DE1', startMins: 540, pitch: 'A1' },
    { id: 'u14b:CUP', round: 'Cup Final', home: '', away: '', startMins: 600, pitch: 'A1' },
  ] } });
  c.generateFinals();
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  // FAULT-PROOF: "Generate finals" fills the FINALS from the winners so far.
  // A version that replaced the whole bracket would wipe the semi-final the
  // manager already edited and already played.
  check('generating finals fills the final from the auto-seed', ko(c, 'u14b:CUP').home === 'DS1' && ko(c, 'u14b:CUP').away === 'DT1');
  check('…and leaves earlier knockout matches exactly as they were',
    ko(c, 'u14b:SEMI1').home === 'ADH1' && ko(c, 'u14b:SEMI1').away === 'DE1' && ko(c, 'u14b:SEMI1').pitch === 'A1');
}
{
  const c = buildDraw();
  c.clearKnockout();
  check('clearing the knockout asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…and clears nothing until confirmed', c.state.draw.knockout.length === 1);
  c.submitModal();
  check('confirming empties the knockout list', c.state.draw.knockout.length === 0);
}

section('Knockout generation is gated on what has actually been played');
{
  const c = buildDraw();
  c.setState({ fixtures: { awaitingPublication: false, pool: [
    { id: 'u14b:A:1', home: 'ADH1', away: 'DE1', result: null },
  ], knockout: [] } });
  const vals = c.renderVals();
  check('with pool matches unplayed, "generate knockout" is off', vals.canGenerateKnockout === false);
  check('…and says why', vals.showPoolScoresHint === true);
  check('with no knockout matches at all, "generate finals" is off', vals.canGenerateFinals === false);
  // FAULT-PROOF: there is nothing to go and play yet, so the "play the
  // knockout matches first" hint would be nonsense here.
  check('…without a hint telling the manager to play matches that do not exist', vals.showPlaySemisHint === false);
}
{
  const c = buildDraw();
  c.setState({ fixtures: { awaitingPublication: false, pool: [
    { id: 'u14b:A:1', home: 'ADH1', away: 'DE1', result: { homeScore: 10, awayScore: 5 } },
  ], knockout: [
    { id: 'u14b:SEMI1', round: 'Semi 1', home: 'ADH1', away: 'DE1', result: null },
  ] } });
  const vals = c.renderVals();
  check('with every pool match played, "generate knockout" is on', vals.canGenerateKnockout === true);
  check('an unplayed semi keeps "generate finals" off', vals.canGenerateFinals === false);
  check('…and says why', vals.showPlaySemisHint === true);
}
{
  const c = buildDraw();
  c.setState({ fixtures: { awaitingPublication: false, pool: [
    { id: 'u14b:A:1', home: 'ADH1', away: 'DE1', result: { homeScore: 10, awayScore: 5 } },
  ], knockout: [
    { id: 'u14b:SEMI1', round: 'Semi 1', home: 'ADH1', away: 'DE1', result: { homeScore: 20, awayScore: 5 } },
    { id: 'u14b:CUP', round: 'Cup Final', home: '', away: '', result: null },
  ] } });
  const vals = c.renderVals();
  // FAULT-PROOF: an unplayed FINAL must not block this — filling that final in
  // is the entire point of the button.
  check('every semi played turns "generate finals" on, even with the final unplayed', vals.canGenerateFinals === true);
  check('…and the hint is gone', vals.showPlaySemisHint === false);
}

section('Save, discard and regenerate');
{
  let saved = null, calls = 0;
  const c = buildDraw({ saveDraw: async (agId, draw, session) => { calls++; saved = [agId, draw, session && session.token]; return { ok: true }; } });
  c.addPool();
  await c.saveDraw();
  check('Save calls the API exactly once', calls === 1);
  check('…for this age group, with the session', saved[0] === 'u14b' && saved[2] === 'tok');
  check('…sending the edited draw, not the last-fetched one', saved[1].pools.length === 3);
  check('a successful save says so', c.state.drawMsg === 'Saved as a draft. Use Publish to make it public.');
  // FAULT-PROOF: loadDraw() runs right after the save and would wipe drawMsg
  // if it cleared it, so the manager would never see the confirmation.
  check('…and the confirmation survives the refetch that follows it', c.state.drawMsg !== '');
  check('…and the draw is no longer flagged unsaved', c.state.drawDirty === false);
}
{
  const c = buildDraw({ saveDraw: async () => ({ ok: false, error: 'Someone else saved first.' }) });
  c.addPool();
  await c.saveDraw();
  check('a failed save shows the server\'s reason', c.state.drawMsg === 'Someone else saved first.');
  // FAULT-PROOF: a failed save has NOT become the clean baseline, so the edit
  // must still be flagged unsaved or it will be quietly lost.
  check('…and the draw stays flagged unsaved', c.state.drawDirty === true);
  check('…keeping the edit on screen', c.state.draw.pools.length === 3);
}
{
  const c = buildDraw();
  c.addPool();
  check('setup: the local edit is there', c.state.draw.pools.length === 3);
  c.discardDraw();
  check('discarding asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('discarding refetches the saved version', c.state.draw.pools.length === 2);
  check('…and clears the unsaved flag', c.state.drawDirty === false);
}
{
  let savedDraw = null;
  const c = buildDraw({
    saveDraw: async (agId, draw) => { savedDraw = draw; return { ok: true }; },
    autoKnockoutSlots: async () => [{ id: 'u14b:CUP', round: 'Cup Final', home: 'DS1', away: 'DE1', startMins: 600, pitch: 'TBD' }],
  });
  c.resetDraw();
  check('regenerating times and bracket asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…promising the teams are kept', /teams and pool assignments are kept/i.test(c.state.modal.title));
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  // FAULT-PROOF: this rebuilds pairings, times and the bracket. Rebuilding
  // the ROSTERS too would silently undo an afternoon of pool editing.
  check('the pools and their teams survive', savedDraw.pools.length === 2 && savedDraw.pools[0].teams.includes('ADH1'));
  check('the slots are rebuilt from those rosters', savedDraw.slots.every((sl) => String(sl.id).includes('regen')));
  check('the bracket is re-seeded', savedDraw.knockout.length === 1 && savedDraw.knockout[0].home === 'DS1');
  check('…and it says what it did', /regenerated/i.test(c.state.drawMsg));
}
```

- [ ] 2. Confirm it fails: `node tests/test-manager-dc-draw.js` → `TypeError: c.addSlot is not a function`.

- [ ] 3. Add the slot-editor methods to `Manager.dc.html`, after `onRemoveTeam(poolId, team)`:

```js
  /* The pitch a pool is on, from its own slots. '' when its slots disagree —
     the caller then falls back to TBD rather than picking one arbitrarily. */
  poolPitchOf(poolId, draw) {
    const d = draw || this.state.draw;
    if (!d) return 'TBD';
    const vals = new Set((d.slots || []).filter((sl) => sl.poolId === poolId).map((sl) => sl.pitch || 'TBD'));
    if (!vals.size) return 'TBD';
    if (vals.size > 1) return '';
    return [...vals][0];
  }

  /* One handler for every match-slot and knockout box: a filled box with
     nothing in hand arms itself; anything with something in hand receives it;
     an empty box with nothing in hand does nothing at all. */
  onBoxTap(kind, slotId, side, team) {
    if (team && !this.state.picked) { this.pickTeam(team, { kind, slotId, side }); return; }
    if (this.state.picked) this.placeTeam({ kind, slotId, side });
  }

  addSlot(poolId) {
    const { api, ageId } = this.state;
    const step = api.slotLengthMins();
    this.setState((s) => {
      const poolSlots = (s.draw.slots || []).filter((sl) => sl.poolId === poolId);
      const lastMins = poolSlots.length ? Math.max(...poolSlots.map((sl) => sl.startMins)) : api.dayStartMins() - step;
      const pitch = this.poolPitchOf(poolId, s.draw) || 'TBD';
      return {
        draw: { ...s.draw, slots: [...(s.draw.slots || []), {
          id: `${ageId}:${poolId}:new${Date.now()}`, poolId, home: '', away: '', startMins: lastMins + step, pitch,
        }] },
        drawDirty: true,
      };
    });
  }

  removeSlot(slotId) {
    this.setState((s) => ({
      draw: { ...s.draw, slots: (s.draw.slots || []).filter((sl) => sl.id !== slotId) },
      drawDirty: true,
    }));
  }

  regeneratePool(poolId) {
    const { api, ageId } = this.state;
    this.confirmModal("Regenerate this pool's match schedule from its current team list? This replaces all of this pool's match slots, and any scores already entered for them.", () => {
      this.setState((s) => {
        const p = (s.draw.pools || []).find((x) => x.id === poolId);
        const keepPitch = this.poolPitchOf(poolId, s.draw);
        const fresh = api.regeneratePoolSlots(ageId, poolId, (p && p.teams) || [])
          .map((sl) => (keepPitch ? { ...sl, pitch: keepPitch } : sl));
        return {
          draw: { ...s.draw, slots: [...(s.draw.slots || []).filter((sl) => sl.poolId !== poolId), ...fresh] },
          drawDirty: true,
        };
      });
    }, { okLabel: 'Regenerate' });
  }

  onSlotTimeChange(slotId, hhmm) {
    const mins = this.state.api.timeToMinutes(hhmm);
    /* A NaN startMins sorts unpredictably and breaks the public fixture
       list's own time sort, so garbage is refused and the last good time
       stands. */
    if (mins == null || isNaN(mins)) return;
    this.setState((s) => ({
      draw: { ...s.draw, slots: (s.draw.slots || []).map((sl) => (sl.id === slotId ? { ...sl, startMins: mins } : sl)) },
      drawDirty: true,
    }));
  }

  onSlotPitchChange(slotId, val) {
    this.setState((s) => ({
      draw: { ...s.draw, slots: (s.draw.slots || []).map((sl) => (sl.id === slotId ? { ...sl, pitch: val } : sl)) },
      drawDirty: true,
    }));
  }
```

- [ ] 4. Add the knockout-builder methods after `onSlotPitchChange(slotId, val)`:

```js
  addKnockoutSlot() {
    const { ageId } = this.state;
    this.setState((s) => {
      const list = s.draw.knockout || [];
      const lastMins = list.length ? Math.max(...list.map((sl) => sl.startMins)) : 8 * 60;
      return {
        draw: { ...s.draw, knockout: [...list, {
          id: `${ageId}:knockout:new${Date.now()}`, round: 'New knockout match',
          home: '', away: '', startMins: lastMins + 20, pitch: 'TBD',
        }] },
        drawDirty: true,
      };
    });
  }

  removeKnockoutSlot(slotId) {
    this.setState((s) => ({
      draw: { ...s.draw, knockout: (s.draw.knockout || []).filter((sl) => sl.id !== slotId) },
      drawDirty: true,
    }));
  }

  onRenameKnockoutRound(slotId) {
    const sl = (this.state.draw.knockout || []).find((x) => x.id === slotId);
    if (!sl) return;
    this.promptModal('Rename this knockout match label', sl.round, (next) => {
      if (next === sl.round) return;
      this.setState((s) => ({
        draw: { ...s.draw, knockout: (s.draw.knockout || []).map((x) => (x.id === slotId ? { ...x, round: next } : x)) },
        drawDirty: true,
      }));
    });
  }

  onKnockoutTimeChange(slotId, hhmm) {
    const mins = this.state.api.timeToMinutes(hhmm);
    if (mins == null || isNaN(mins)) return;
    this.setState((s) => ({
      draw: { ...s.draw, knockout: (s.draw.knockout || []).map((sl) => (sl.id === slotId ? { ...sl, startMins: mins } : sl)) },
      drawDirty: true,
    }));
  }

  onKnockoutPitchChange(slotId, val) {
    this.setState((s) => ({
      draw: { ...s.draw, knockout: (s.draw.knockout || []).map((sl) => (sl.id === slotId ? { ...sl, pitch: val } : sl)) },
      drawDirty: true,
    }));
  }

  regenerateKnockout() {
    const { api, ageId, session } = this.state;
    this.confirmModal('Replace the knockout stage with the current auto-seeded bracket from live standings? This discards any manual knockout edits.', async () => {
      const fresh = await api.autoKnockoutSlots(ageId, session);
      this.setState((s) => ({ draw: { ...s.draw, knockout: fresh }, drawDirty: true }));
    }, { okLabel: 'Regenerate bracket' });
  }

  /* Fills ONLY the finals (Cup, Bowl, Plate, Shield, Final) from the winners
     so far. Earlier knockout matches are left exactly as they are — they have
     been played, and rebuilding them would throw those results away. */
  generateFinals() {
    const { api, ageId, session } = this.state;
    this.confirmModal('Fill the finals from the current knockout results? This updates only the final matches (Cup, Bowl, Plate, Shield or Final) from the winners so far.', async () => {
      const fresh = await api.autoKnockoutSlots(ageId, session);
      const isFinal = (id) => /:(CUP|BOWL|PLATE|SHIELD|FINAL)$/i.test(id || '');
      this.setState((s) => {
        const cur = s.draw.knockout || [];
        const freshFinals = fresh.filter((f) => isFinal(f.id));
        const byId = {};
        freshFinals.forEach((f) => { byId[f.id] = f; });
        const haveIds = new Set(cur.map((sl) => sl.id));
        const updated = cur.map((sl) => ((isFinal(sl.id) && byId[sl.id])
          ? { ...sl, home: byId[sl.id].home, away: byId[sl.id].away } : sl));
        freshFinals.forEach((f) => { if (!haveIds.has(f.id)) updated.push(f); });
        return { draw: { ...s.draw, knockout: updated }, drawDirty: true };
      });
    }, { okLabel: 'Fill the finals' });
  }

  clearKnockout() {
    this.confirmModal('Clear all knockout matches for this age group? You can generate them again from the standings afterwards. (Remember to Save changes.)', () => {
      this.setState((s) => ({ draw: { ...s.draw, knockout: [] }, drawDirty: true }));
    }, { okLabel: 'Clear knockout' });
  }
```

- [ ] 5. Add save / discard / reset after `clearKnockout()`:

```js
  async saveDraw() {
    const { api, ageId, session, draw } = this.state;
    this.setState({ drawBusy: true, drawMsg: '' });
    const res = await api.saveDraw(ageId, draw, session);
    this.setState({
      drawBusy: false,
      drawMsg: res.ok ? 'Saved as a draft. Use Publish to make it public.' : (res.error || 'Could not save.'),
    });
    /* loadDraw() clears drawDirty — the server's copy IS the clean baseline
       now. It deliberately does not clear drawMsg, so the confirmation above
       survives long enough to be read. */
    if (res.ok) await this.loadDraw(ageId);
  }

  discardDraw() {
    this.confirmModal('Discard unsaved changes to this draw? This reloads the last saved version.', async () => {
      await this.loadDraw(this.state.ageId);
    }, { okLabel: 'Discard changes' });
  }

  resetDraw() {
    const { api, ageId, session } = this.state;
    this.confirmModal('Regenerate match times and the knockout bracket from the current teams and pools? Your teams and pool assignments are kept — only match pairings, times, and the bracket are rebuilt.', async () => {
      this.setState({ drawBusy: true, drawMsg: '' });
      const draw = this.state.draw;
      const freshSlots = (draw.pools || []).reduce((acc, p) => acc.concat(api.regeneratePoolSlots(ageId, p.id, p.teams || [])), []);
      const freshKnockout = await api.autoKnockoutSlots(ageId, session);
      const next = { ...draw, slots: freshSlots, knockout: freshKnockout };
      this.setState({ draw: next, drawDirty: true });
      const res = await api.saveDraw(ageId, next, session);
      this.setState({
        drawBusy: false,
        drawMsg: res.ok ? 'Match times and bracket regenerated — your teams were kept.' : (res.error || 'Could not save.'),
      });
      if (res.ok) await this.loadDraw(ageId);
    }, { okLabel: 'Regenerate' });
  }
```

- [ ] 6. Extend `renderVals()`. First, add the box styling helper and the knockout/gating computation to the computed block, ABOVE the `poolCards` mapping added in Task 9:

```js
    const boxBase = 'flex:1;min-width:120px;text-align:center;border-radius:8px;padding:9px 6px;font-size:12.5px;font-weight:700;overflow-wrap:break-word;cursor:pointer;border:1.5px ';
    const boxOff = boxBase + 'dashed rgba(255,255,255,0.15);background:#0C0C0E;color:#fff;';
    const boxEmpty = boxBase + 'dashed rgba(255,255,255,0.15);background:#0C0C0E;color:#7f8794;';
    const boxOn = boxBase + 'solid #0F7A36;background:#17A34A;color:#fff;';
    const isPickedBox = (kind, slotId, side) => !!(s.picked && s.picked.from.kind === kind
      && s.picked.from.slotId === slotId && s.picked.from.side === side);
    const pitchOptionsFor = (current) => Array.from(new Set(['TBD', ...((s.api && s.ageId) ? s.api.pitchesForAgeGroup(s.ageId) : []), current])).filter(Boolean);
    const boxStyleFor = (kind, slotId, side, team) => (isPickedBox(kind, slotId, side) ? boxOn : (team ? boxOff : boxEmpty));

    /* Generation is gated on what has actually been played. A FINAL with no
       result must never block "generate finals" — filling it in is the point
       of the button. */
    const isFinalKo = (id) => /:(CUP|BOWL|PLATE|SHIELD|FINAL)$/i.test(id || '');
    const fixturePool = (s.fixtures && s.fixtures.pool) || [];
    const fixtureKo = (s.fixtures && s.fixtures.knockout) || [];
    const poolsAllPlayed = fixturePool.length > 0 && fixturePool.every((m) => m.result && m.result.homeScore != null);
    const koSemis = fixtureKo.filter((k) => !isFinalKo(k.id) && k.home && k.away);
    const koSemisAllPlayed = koSemis.length > 0 && koSemis.every((k) => k.result && k.result.homeScore != null);
```

Then add these fields to each `poolCards[]` entry (inside the `map` added in Task 9):

```js
      slotRows: (d.slots || []).filter((sl) => sl.poolId === p.id).sort((a, b) => a.startMins - b.startMins).map((sl) => ({
        id: sl.id,
        time: s.api.minutesToTimeInput(sl.startMins),
        onTimeChange: (e) => this.onSlotTimeChange(sl.id, e.target.value),
        pitch: sl.pitch || 'TBD',
        pitchOptions: pitchOptionsFor(sl.pitch),
        onPitchChange: (e) => this.onSlotPitchChange(sl.id, e.target.value),
        homeLabel: sl.home ? this.tName(sl.home) : 'Tap to place',
        awayLabel: sl.away ? this.tName(sl.away) : 'Tap to place',
        homeStyle: boxStyleFor('slot', sl.id, 'home', sl.home),
        awayStyle: boxStyleFor('slot', sl.id, 'away', sl.away),
        onHomeClick: () => this.onBoxTap('slot', sl.id, 'home', sl.home),
        onAwayClick: () => this.onBoxTap('slot', sl.id, 'away', sl.away),
        onRemove: () => this.removeSlot(sl.id),
      })),
      onAddSlot: () => this.addSlot(p.id),
      onRegeneratePool: () => this.regeneratePool(p.id),
```

Finally add these keys to the returned object:

```js
      drawBusy: s.drawBusy,
      knockoutRows: d ? (d.knockout || []).slice().sort((a, b) => a.startMins - b.startMins).map((sl) => ({
        id: sl.id,
        round: sl.round,
        onRenameRound: () => this.onRenameKnockoutRound(sl.id),
        time: s.api.minutesToTimeInput(sl.startMins),
        onTimeChange: (e) => this.onKnockoutTimeChange(sl.id, e.target.value),
        pitch: sl.pitch || 'TBD',
        pitchOptions: pitchOptionsFor(sl.pitch),
        onPitchChange: (e) => this.onKnockoutPitchChange(sl.id, e.target.value),
        homeLabel: sl.home ? this.tName(sl.home) : 'Tap to place',
        awayLabel: sl.away ? this.tName(sl.away) : 'Tap to place',
        homeStyle: boxStyleFor('knockout', sl.id, 'home', sl.home),
        awayStyle: boxStyleFor('knockout', sl.id, 'away', sl.away),
        onHomeClick: () => this.onBoxTap('knockout', sl.id, 'home', sl.home),
        onAwayClick: () => this.onBoxTap('knockout', sl.id, 'away', sl.away),
        onRemove: () => this.removeKnockoutSlot(sl.id),
      })) : [],
      hasKnockoutRows: !!(d && (d.knockout || []).length),
      canGenerateKnockout: poolsAllPlayed,
      canGenerateFinals: koSemisAllPlayed,
      showPoolScoresHint: !poolsAllPlayed,
      showPlaySemisHint: koSemis.length > 0 && !koSemisAllPlayed,
      onAddKnockout: () => this.addKnockoutSlot(),
      onRegenerateKnockout: () => this.regenerateKnockout(),
      onGenerateFinals: () => this.generateFinals(),
      onClearKnockout: () => this.clearKnockout(),
      onSaveDraw: () => this.saveDraw(),
      onDiscardDraw: () => this.discardDraw(),
      onResetDraw: () => this.resetDraw(),
```

- [ ] 7. In the template, inside the pool card added in Task 9, add the slot rows after the "+ Add" row (immediately before the pool card's closing `</div>`):

```html
              <div style="margin-top:16px">
                <sc-for list="{{ p.slotRows }}" as="sl" hint-placeholder-count="3">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
                    <input type="time" value="{{ sl.time }}" onChange="{{ sl.onTimeChange }}" style="width:118px;flex:none;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:9px 10px;color:#fff;font-size:14px;color-scheme:dark">
                    <div onClick="{{ sl.onHomeClick }}" style="{{ sl.homeStyle }}">{{ sl.homeLabel }}</div>
                    <span style="flex:none;color:#7f8794">v</span>
                    <div onClick="{{ sl.onAwayClick }}" style="{{ sl.awayStyle }}">{{ sl.awayLabel }}</div>
                    <select value="{{ sl.pitch }}" onChange="{{ sl.onPitchChange }}" style="width:92px;flex:none;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:9px 8px;color:#fff;font-size:13px">
                      <sc-for list="{{ sl.pitchOptions }}" as="o" hint-placeholder-count="3">
                        <option value="{{ o }}">{{ o }}</option>
                      </sc-for>
                    </select>
                    <button onClick="{{ sl.onRemove }}" style="flex:none;background:transparent;border:1px solid rgba(255,255,255,0.2);color:#ff8a8a;font-weight:700;font-size:13px;padding:8px 12px;border-radius:8px;cursor:pointer">×</button>
                  </div>
                </sc-for>
              </div>
              <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
                <button onClick="{{ p.onAddSlot }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;font-weight:700;font-size:12px;padding:10px 14px;border-radius:9px;cursor:pointer">+ Add match slot</button>
                <button onClick="{{ p.onRegeneratePool }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#aeb4bf;font-weight:700;font-size:12px;padding:10px 14px;border-radius:9px;cursor:pointer">Regenerate from pool</button>
              </div>
```

- [ ] 8. In the template, add the knockout section and the save bar after the `+ Add pool` button:

```html
          <div style="font-family:'Anton';font-size:17px;text-transform:uppercase;margin:20px 0 10px">Knockout stage</div>
          <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px">
            <sc-for list="{{ knockoutRows }}" as="k" hint-placeholder-count="3">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
                <span style="flex:1 1 130px;font-size:11.5px;color:#aeb4bf;overflow-wrap:break-word">{{ k.round }}
                  <button onClick="{{ k.onRenameRound }}" aria-label="Rename" style="background:transparent;border:none;color:#7f8794;font-size:12px;padding:2px 4px;cursor:pointer">✎</button>
                </span>
                <input type="time" value="{{ k.time }}" onChange="{{ k.onTimeChange }}" style="width:118px;flex:none;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:9px 10px;color:#fff;font-size:14px;color-scheme:dark">
                <div onClick="{{ k.onHomeClick }}" style="{{ k.homeStyle }}">{{ k.homeLabel }}</div>
                <span style="flex:none;color:#7f8794">v</span>
                <div onClick="{{ k.onAwayClick }}" style="{{ k.awayStyle }}">{{ k.awayLabel }}</div>
                <select value="{{ k.pitch }}" onChange="{{ k.onPitchChange }}" style="width:92px;flex:none;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:9px 8px;color:#fff;font-size:13px">
                  <sc-for list="{{ k.pitchOptions }}" as="o" hint-placeholder-count="3">
                    <option value="{{ o }}">{{ o }}</option>
                  </sc-for>
                </select>
                <button onClick="{{ k.onRemove }}" style="flex:none;background:transparent;border:1px solid rgba(255,255,255,0.2);color:#ff8a8a;font-weight:700;font-size:13px;padding:8px 12px;border-radius:8px;cursor:pointer">×</button>
              </div>
            </sc-for>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
              <button onClick="{{ onAddKnockout }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;font-weight:700;font-size:12px;padding:10px 14px;border-radius:9px;cursor:pointer">+ Add knockout match</button>
              <button onClick="{{ onRegenerateKnockout }}" disabled="{{ showPoolScoresHint }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#aeb4bf;font-weight:700;font-size:12px;padding:10px 14px;border-radius:9px;cursor:pointer">Generate knockout from standings</button>
              <button onClick="{{ onGenerateFinals }}" disabled="{{ showPlaySemisHint }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#aeb4bf;font-weight:700;font-size:12px;padding:10px 14px;border-radius:9px;cursor:pointer">Generate finals from knockout</button>
              <button onClick="{{ onClearKnockout }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#ff8a8a;font-weight:700;font-size:12px;padding:10px 14px;border-radius:9px;cursor:pointer">Clear knockout</button>
            </div>
            <sc-if value="{{ showPoolScoresHint }}" hint-placeholder-val="{{ false }}">
              <p style="color:#7f8794;font-size:12px;margin-top:8px">Enter every pool score first — then you can generate the knockout from the final standings.</p>
            </sc-if>
            <sc-if value="{{ showPlaySemisHint }}" hint-placeholder-val="{{ false }}">
              <p style="color:#7f8794;font-size:12px;margin-top:6px">Play the knockout matches first — then this fills the finals from the winners.</p>
            </sc-if>
          </div>

          <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px;margin-top:16px">
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button onClick="{{ onSaveDraw }}" disabled="{{ drawBusy }}" style="background:#17A34A;color:#fff;font-weight:800;font-size:14px;padding:13px 22px;border:none;border-radius:10px;cursor:pointer;text-transform:uppercase">Save changes</button>
              <button onClick="{{ onDiscardDraw }}" disabled="{{ drawBusy }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#aeb4bf;font-weight:800;font-size:14px;padding:12px 20px;border-radius:10px;cursor:pointer;text-transform:uppercase">Discard changes</button>
              <button onClick="{{ onResetDraw }}" disabled="{{ drawBusy }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#ff8a8a;font-weight:800;font-size:14px;padding:12px 20px;border-radius:10px;cursor:pointer;text-transform:uppercase">Regenerate times &amp; bracket</button>
            </div>
            <sc-if value="{{ drawDirty }}" hint-placeholder-val="{{ false }}">
              <p style="margin-top:10px;font-size:12.5px;color:#f5c518;font-weight:700">✎ You have unsaved changes.</p>
            </sc-if>
            <sc-if value="{{ drawMsg }}" hint-placeholder-val="">
              <p style="margin-top:10px;font-size:13px;color:#3bd070;font-weight:600">{{ drawMsg }}</p>
            </sc-if>
          </div>
```

- [ ] 9. Verify: `node tests/test-manager-dc-draw.js` — all checks pass.

- [ ] 10. Prove against injected faults, reverting each:

  (a) In `addSlot()`, use `api.dayStartMins()` instead of `lastMins + step`. Run — "one slot length after that pool's last match" must FAIL. Revert.

  (b) In `onSlotTimeChange()`, delete the `if (mins == null || isNaN(mins)) return;` guard. Run — "an unparseable time is refused" must FAIL. Revert.

  (c) In `regeneratePool()`, replace all slots rather than only that pool's (`slots: fresh`). Run — "leaves the other pool's slots alone" must FAIL. Revert.

  (d) In `generateFinals()`, set `knockout: fresh` (replace the whole bracket). Run — "leaves earlier knockout matches exactly as they were" must FAIL. Revert.

  (e) In `renderVals()`, change `koSemis` to include finals (drop `!isFinalKo(k.id)`). Run — "every semi played turns 'generate finals' on, even with the final unplayed" must FAIL. Revert.

  (f) In `renderVals()`, set `showPlaySemisHint: !koSemisAllPlayed`. Run — "without a hint telling the manager to play matches that do not exist" must FAIL. Revert.

  (g) In `saveDraw()`, clear `drawMsg` after the `loadDraw()` call. Run — "the confirmation survives the refetch that follows it" must FAIL. Revert.

  (h) In `saveDraw()`, call `loadDraw()` regardless of `res.ok`. Run — "a failed save … the draw stays flagged unsaved" and "keeping the edit on screen" must FAIL. Revert.

  (i) In `resetDraw()`, rebuild the pools too (`pools: []`). Run — "the pools and their teams survive" must FAIL. Revert.

  (j) In `onBoxTap()`, drop the `team &&` condition. Run — "tapping an empty box with nothing picked does nothing" must FAIL. Revert.

- [ ] 11. `powershell tests/runall.ps1` — whole suite green.

- [ ] 12. Commit on `dev`:

```
git checkout dev
git add Manager.dc.html tests/test-manager-dc-draw.js
git commit -F commitmsg.txt   # "Manager.dc.html: match-slot editor, knockout builder, save/discard/regenerate"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files`, and on the PC:

```
git fetch origin --prune
git checkout dev
git add Manager.dc.html tests/test-manager-dc-draw.js
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash
git push origin dev
```

## Task 11 — Draw tab, part 3: import registered teams

**Files**
- Modify: `Manager.dc.html`
- Modify: `tests/test-manager-dc-draw.js`
- Test: `tests/test-manager-dc-draw.js`

**Interfaces**
- Consumes: Task 3's `state.ageGroups`, `ageId`, `session`, `regs`; Task 9's `state.draw`, `drawDirty`, `drawMsg`, `importOpen`, `importMode`, `importRows`, `importNote`; Task 10's `regeneratePoolSlots(agId, poolId, teams)` usage. From `scores-data.js`: `getMyRegistrations(session)`, `regeneratePoolSlots(agId, poolId, teams)`.
- Produces: methods `loadRegistrations()` (also consumed by Task 13), `importHasResults()`, `importSourceTeams()`, `teamNamesFromRegistrations()`, `openImport()`, `buildImportRows(mode)`, `setImportMode(mode)`, `setImportRowPool(code, poolId)`, `confirmImport()`, `cancelImport()`.
- An import row is `{ code, club, name, pref, poolId, flag, moved, unavailable, skip }`.
- `renderVals()` keys: `importCount`, `importOpen`, `importRowsView[]` (`{code, title, sub, poolId, poolOptions, disabled, onPoolChange}`), `importNote`, `importReplaceBlocked`, `importConfirmLabel`, `onOpenImport`, `onImportModeAdd`, `onImportModeReplace`, `onConfirmImport`, `onCancelImport`.

**Steps**

- [ ] 1. Add this section to `tests/test-manager-dc-draw.js`, before `summary(...)`:

```js
section('Import registered teams');
{
  const regTeams = [
    { club: 'Abu Dhabi Harlequins', teamName: 'ADH2', ageGroup: 'U14 Boys', preferredPool: 'B' },
    { club: 'Dubai Exiles', teamName: 'DE2', ageGroup: 'U14 Boys', preferredPool: '' },
    { club: 'Someone Else', teamName: 'XX1', ageGroup: 'U16 Boys', preferredPool: '' },
  ];
  const c = buildDraw({ getMyRegistrations: async () => ({ teams: regTeams, players: [], scope: 'all' }) });
  await c.openImport();
  const src = c.importSourceTeams();
  // FAULT-PROOF: a team registered for a DIFFERENT age group must never be
  // importable into this one.
  check('the import source is scoped to this age group by NAME', src.length === 2 && src.every((r) => r.ageGroup === 'U14 Boys'));
  check('the panel is open', c.renderVals().importOpen === true);
  check('a row is built for each importable team', c.state.importRows.length === 2);
  check('the preferred pool is honoured where it exists', c.state.importRows.find((r) => r.code === 'ADH2').poolId === 'B');

  c.confirmImport();
  const allTeams = c.state.draw.pools.flatMap((p) => p.teams);
  check('ADH2 was imported', allTeams.includes('ADH2'));
  check('DE2 was imported', allTeams.includes('DE2'));
  check('the wrong-age-group team was never imported', !allTeams.includes('XX1'));
  check('the panel closes afterwards', c.state.importOpen === false);
  check('…and the draw is flagged unsaved', c.state.drawDirty === true);
  check('…and it says nothing is saved yet', /Nothing is saved until you press Save changes/i.test(c.state.drawMsg));
  // FAULT-PROOF: saveDraw()'s allow-list carries teamNames, and a code with no
  // friendly name renders as a raw code on the public standings.
  check('a friendly club name is recorded for the imported code', c.state.draw.teamNames.ADH2 === 'Abu Dhabi Harlequins');
}
{
  const regTeams = [
    { club: 'A Club', teamName: 'AC1', ageGroup: 'U14 Boys', preferredPool: 'Z' },
  ];
  const c = buildDraw({ getMyRegistrations: async () => ({ teams: regTeams, players: [], scope: 'all' }) });
  await c.openImport();
  check('a team asking for a pool this draw does not have is still placed', c.state.importRows[0].poolId === 'A' || c.state.importRows[0].poolId === 'B');
  check('…and the panel says so rather than silently moving it', /does not have/i.test(c.state.importNote));
}
{
  const regTeams = [
    { club: 'C1', teamName: 'C1', ageGroup: 'U14 Boys', preferredPool: 'A' },
    { club: 'C2', teamName: 'C2', ageGroup: 'U14 Boys', preferredPool: 'A' },
    { club: 'C3', teamName: 'C3', ageGroup: 'U14 Boys', preferredPool: 'A' },
    { club: 'C4', teamName: 'C4', ageGroup: 'U14 Boys', preferredPool: 'A' },
  ];
  const c = buildDraw({ getMyRegistrations: async () => ({ teams: regTeams, players: [], scope: 'all' }) });
  await c.openImport();
  // FAULT-PROOF: four teams all asking for Pool A must not all land in Pool A
  // — the balancer moves the overflow, and says that it did.
  check('the pools are kept level rather than honouring every preference',
    c.state.importRows.some((r) => r.poolId === 'B'));
  check('…and the panel says how many were moved', /moved off their preferred pool/i.test(c.state.importNote));
}
{
  const regTeams = [{ club: 'ADH', teamName: 'ADH1', ageGroup: 'U14 Boys', preferredPool: 'A' }];
  const c = buildDraw({ getMyRegistrations: async () => ({ teams: regTeams, players: [], scope: 'all' }) });
  await c.openImport();
  check('a team already in the draw is marked skip in "add the missing ones" mode', c.state.importRows[0].skip === true);
  c.confirmImport();
  check('…and is not added twice', c.state.draw.pools.find((p) => p.id === 'A').teams.filter((t) => t === 'ADH1').length === 1);
}
{
  const c = buildDraw({
    getMyRegistrations: async () => ({ teams: [{ club: 'C', teamName: 'C1', ageGroup: 'U14 Boys', preferredPool: '' }], players: [], scope: 'all' }),
  });
  c.setState({ fixtures: { awaitingPublication: false, pool: [
    { id: 'u14b:A:1', home: 'ADH1', away: 'DE1', result: { homeScore: 10, awayScore: 5 } },
  ], knockout: [] } });
  await c.openImport();
  check('replace is unavailable once results exist', c.importHasResults() === true && c.renderVals().importReplaceBlocked === true);
  c.setImportMode('replace');
  check('…and asking for it anyway does not switch mode', c.state.importMode === 'add');

  // FAULT-PROOF: confirmImport() must re-check for itself rather than trusting
  // importMode, or stale/tampered state wipes a roster that has real results.
  c.setState({ importMode: 'replace' });
  c.confirmImport();
  const poolA = c.state.draw.pools.find((p) => p.id === 'A');
  check('confirming a stale replace does NOT wipe the roster',
    poolA.teams.includes('ADH1') && poolA.teams.includes('DS1'));
  check('…and says the replace was blocked', /Replace was blocked/i.test(c.state.drawMsg));
}
{
  const c = buildDraw({
    getMyRegistrations: async () => ({ teams: [{ club: 'C', teamName: 'C1', ageGroup: 'U14 Boys', preferredPool: 'A' }], players: [], scope: 'all' }),
  });
  await c.openImport();
  c.setImportMode('replace');
  check('with no results, replace mode is allowed', c.state.importMode === 'replace');
  c.confirmImport();
  const poolA = c.state.draw.pools.find((p) => p.id === 'A');
  check('replace clears the old roster', !poolA.teams.includes('ADH1'));
  check('…and puts the imported team in', poolA.teams.includes('C1'));
  check('…and rebuilds the pool matches to match', c.state.draw.slots.every((sl) => String(sl.id).includes('regen')));
}
{
  const c = buildDraw({
    getMyRegistrations: async () => ({ teams: [{ club: 'C', teamName: 'C1', ageGroup: 'U14 Boys', preferredPool: 'A' }], players: [], scope: 'all' }),
  });
  await c.openImport();
  c.setImportRowPool('C1', 'B');
  check('the pool can be overridden per row', c.state.importRows[0].poolId === 'B');
  c.confirmImport();
  check('…and the override is what is applied', c.state.draw.pools.find((p) => p.id === 'B').teams.includes('C1'));
}
{
  const c = buildDraw({
    getMyRegistrations: async () => ({ teams: [{ club: 'C', teamName: 'C1', ageGroup: 'U14 Boys', preferredPool: 'A' }], players: [], scope: 'all' }),
  });
  await c.openImport();
  c.cancelImport();
  check('cancelling closes the panel', c.state.importOpen === false);
  check('…and imports nothing', !c.state.draw.pools.flatMap((p) => p.teams).includes('C1'));
}
{
  const c = buildDraw({ getMyRegistrations: async () => ({ teams: [], players: [], scope: 'all' }) });
  c.setState({ draw: { ...c.state.draw, pools: [] } });
  await c.openImport();
  // FAULT-PROOF: with no pools there is nowhere to put anyone, and the panel
  // has to say that instead of silently importing nothing.
  check('with no pools the panel says to add one first', /Add a pool first/i.test(c.state.importNote));
  check('…and offers no rows', c.state.importRows.length === 0);
}
```

- [ ] 2. Confirm it fails: `node tests/test-manager-dc-draw.js` → `TypeError: c.openImport is not a function`.

- [ ] 3. Add the import methods to `Manager.dc.html`, after `resetDraw()`:

```js
  /* Also used by the Registrations tab. Cached on state.regs: `undefined`
     before the first fetch, `null` while one is in flight. */
  async loadRegistrations() {
    const { api, session } = this.state;
    this.setState({ regs: null });
    const data = await api.getMyRegistrations(session);
    this.setState({ regs: data });
  }

  importHasResults() {
    const f = this.state.fixtures;
    if (!f) return false;
    return [...(f.pool || []), ...(f.knockout || [])].some((m) => m.result && m.result.homeScore != null);
  }

  /* Registrations carry the age group's NAME ("U14 Boys"); state.ageId is an
     id ("u14b"). The lookup is what scopes an import to one age group. */
  importSourceTeams() {
    const s = this.state;
    const meta = (s.ageGroups || []).find((a) => a.id === s.ageId);
    const nm = ((meta && meta.name) || '').trim().toLowerCase();
    if (!nm) return [];
    return ((s.regs && s.regs.teams) || []).filter((r) => String(r.ageGroup || '').trim().toLowerCase() === nm);
  }

  /* A friendly display name per team code. saveDraw()'s allow-list carries
     teamNames, and a code with no name renders raw on the public standings. */
  teamNamesFromRegistrations() {
    const src = this.importSourceTeams();
    const perClub = {};
    src.forEach((r) => { const c = String(r.club || '').trim(); perClub[c] = (perClub[c] || 0) + 1; });
    const out = {};
    src.forEach((r) => {
      const code = String(r.teamName || '').trim();
      const rawClub = String(r.club || '').trim();
      const club = rawClub.replace(/\b(RFC|Rugby Football Club|Rugby Club)\b/gi, '').replace(/\s+/g, ' ').trim();
      if (!code || !club) return;
      const n = (code.match(/(\d+)$/) || [])[1];
      out[code] = (perClub[rawClub] > 1 && n) ? (club + ' ' + n) : club;
    });
    return out;
  }

  async openImport() {
    if (this.state.regs === undefined) await this.loadRegistrations();
    this.buildImportRows(this.state.importMode || 'add');
    this.setState({ importOpen: true });
  }

  buildImportRows(mode) {
    const { ageId, api } = this.state;
    const draw = this.state.draw;
    if (!draw) return;
    const pools = draw.pools || [];
    const poolIds = pools.map((p) => p.id);
    if (!poolIds.length) {
      this.setState({ importRows: [], importMode: mode, importNote: 'Add a pool first, then import.' });
      return;
    }
    const existing = new Set();
    pools.forEach((p) => (p.teams || []).forEach((t) => existing.add(t)));
    const src = this.importSourceTeams();
    const load = {};
    poolIds.forEach((id) => { load[id] = 0; });
    if (mode === 'add') pools.forEach((p) => { load[p.id] = (p.teams || []).length; });
    const prefOf = (r) => {
      const m = String(r.preferredPool || '').match(/[A-D]/i);
      const id = m ? m[0].toUpperCase() : '';
      return poolIds.indexOf(id) >= 0 ? id : '';
    };
    const smallest = () => poolIds.slice().sort((a, b) => load[a] - load[b] || poolIds.indexOf(a) - poolIds.indexOf(b))[0];
    const rows = [];
    src.forEach((r) => {
      const code = String(r.teamName || '').trim();
      if (!code) return;
      const inDraw = existing.has(code);
      if (mode === 'add' && inDraw) { rows.push({ code, club: String(r.club || ''), pref: r.preferredPool || '', poolId: '', skip: true }); return; }
      const want = prefOf(r);
      const asked = String(r.preferredPool || '').match(/[A-D]/i);
      const unavailable = !!(asked && !want);
      let poolId = want || smallest();
      let moved = false;
      /* A preference is honoured unless doing so would leave the pools two
         teams apart — a lopsided pool is a worse outcome than a preference
         nobody promised. */
      if (want && load[want] - load[smallest()] >= 2) { poolId = smallest(); moved = true; }
      load[poolId] += 1;
      rows.push({ code, club: String(r.club || ''), pref: r.preferredPool || '', poolId, flag: inDraw ? 'in' : 'new', moved, unavailable, skip: false });
    });
    const nameByCode = this.teamNamesFromRegistrations();
    rows.forEach((row) => { row.name = nameByCode[row.code] || ''; });
    const movedCount = rows.filter((r) => r.moved).length;
    const unavailCount = rows.filter((r) => r.unavailable).length;
    const notes = [];
    if (movedCount) notes.push(movedCount + ' team' + (movedCount === 1 ? ' was' : 's were') + ' moved off their preferred pool to keep the pools even.');
    if (unavailCount) notes.push(unavailCount + ' team' + (unavailCount === 1 ? '' : 's') + ' asked for a pool this draw does not have, placed in the smallest pool.');
    this.setState({ importRows: rows, importMode: mode, importNote: notes.join(' ') });
  }

  setImportMode(mode) {
    if (mode === 'replace' && this.importHasResults()) return;
    this.buildImportRows(mode);
  }

  setImportRowPool(code, poolId) {
    this.setState((s) => ({
      importRows: (s.importRows || []).map((r) => (r.code === code ? { ...r, poolId, moved: false } : r)),
    }));
  }

  confirmImport() {
    const { api, ageId } = this.state;
    const draw = this.state.draw;
    if (!draw) return;
    let mode = this.state.importMode || 'add';
    let replaceBlocked = false;
    /* Re-checked here rather than trusted from importMode: stale or tampered
       state must not be able to wipe a roster that now has real results. */
    if (mode === 'replace' && this.importHasResults()) { mode = 'add'; replaceBlocked = true; }
    const rows = (this.state.importRows || []).filter((r) => !r.skip && r.poolId);
    const claimed = new Set();
    if (mode !== 'replace') (draw.pools || []).forEach((p) => (p.teams || []).forEach((t) => claimed.add(t)));
    const dupCodes = [];
    const usableRows = [];
    rows.forEach((r) => {
      if (claimed.has(r.code)) { dupCodes.push(r.code); return; }
      claimed.add(r.code);
      usableRows.push(r);
    });
    const names = { ...(draw.teamNames || {}) };
    usableRows.forEach((r) => { if (r.name) names[r.code] = r.name; });
    const pools = (draw.pools || []).map((p) => {
      const teams = mode === 'replace' ? [] : [...(p.teams || [])];
      usableRows.forEach((r) => { if (r.poolId === p.id && teams.indexOf(r.code) < 0) teams.push(r.code); });
      return { ...p, teams };
    });
    let slots = draw.slots || [];
    if (mode === 'replace') slots = pools.reduce((acc, p) => acc.concat(api.regeneratePoolSlots(ageId, p.id, p.teams || [])), []);
    this.setState({
      draw: { ...draw, pools, teamNames: names, slots },
      importOpen: false,
      drawDirty: true,
      drawMsg: (replaceBlocked ? 'Replace was blocked because this age group now has results, so the roster was NOT wiped. Imported as "add the missing ones" instead. ' : '')
        + 'Imported ' + usableRows.length + ' team' + (usableRows.length === 1 ? '' : 's') + ' into the editor.'
        + (mode === 'replace' ? ' Pool matches rebuilt to match the new rosters.' : ' Press "Regenerate from pool" on any pool you changed to rebuild its matches.')
        + (dupCodes.length ? ' SKIPPED ' + dupCodes.length + ' duplicate team code(s) (' + dupCodes.join(', ') + ').' : '')
        + ' Nothing is saved until you press Save changes.',
    });
  }

  cancelImport() { this.setState({ importOpen: false }); }
```

- [ ] 4. Extend `renderVals()`. Add to the computed block:

```js
    const importPoolOptions = d ? (d.pools || []).map((p) => ({ id: p.id, name: p.name })) : [];
    const importRowsView = (s.importRows || []).map((r) => ({
      code: r.code,
      title: r.name || r.code,
      sub: r.code + (r.skip ? ' · already in draw' : ''),
      poolId: r.poolId,
      poolOptions: importPoolOptions,
      disabled: !!r.skip,
      onPoolChange: (e) => this.setImportRowPool(r.code, e.target.value),
    }));
```

and these keys to the returned object:

```js
      importCount: this.importSourceTeams().length,
      importOpen: s.importOpen,
      importRowsView,
      importNote: s.importNote,
      importReplaceBlocked: this.importHasResults(),
      importConfirmLabel: `Import ${(s.importRows || []).filter((r) => !r.skip).length} team(s)`,
      onOpenImport: () => this.openImport(),
      onImportModeAdd: () => this.setImportMode('add'),
      onImportModeReplace: () => this.setImportMode('replace'),
      onConfirmImport: () => this.confirmImport(),
      onCancelImport: () => this.cancelImport(),
```

- [ ] 5. Add the import panel to the template, inside the `<sc-if value="{{ isDraw }}">` block, immediately after the "Draw" heading and before the loading/missing states:

```html
          <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px;margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
              <div>
                <div style="font-size:11px;font-weight:700;color:#7f8794;letter-spacing:.5px;text-transform:uppercase">Registered teams</div>
                <div style="font-size:13px;margin-top:4px">{{ importCount }} registered for {{ ageLabel }}</div>
              </div>
              <button onClick="{{ onOpenImport }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;font-weight:700;font-size:12px;padding:10px 14px;border-radius:9px;cursor:pointer;white-space:nowrap">Review &amp; import</button>
            </div>
            <sc-if value="{{ importOpen }}" hint-placeholder-val="{{ false }}">
              <div style="margin-top:14px;border-top:1px solid rgba(255,255,255,0.1);padding-top:14px">
                <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
                  <button onClick="{{ onImportModeAdd }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;font-weight:700;font-size:12px;padding:9px 14px;border-radius:9px;cursor:pointer">Add the missing ones</button>
                  <button onClick="{{ onImportModeReplace }}" disabled="{{ importReplaceBlocked }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#aeb4bf;font-weight:700;font-size:12px;padding:9px 14px;border-radius:9px;cursor:pointer">Replace the pools</button>
                </div>
                <sc-if value="{{ importReplaceBlocked }}" hint-placeholder-val="{{ false }}">
                  <div style="background:rgba(225,27,34,0.12);border:1px solid rgba(225,27,34,0.4);border-radius:9px;padding:11px 13px;color:#ff8a8a;font-size:13px;font-weight:600;margin-bottom:10px">Replace is unavailable: this age group already has results.</div>
                </sc-if>
                <sc-if value="{{ importNote }}" hint-placeholder-val="">
                  <div style="background:rgba(245,197,24,0.09);border:1px solid rgba(245,197,24,0.32);border-radius:9px;padding:11px 13px;color:#f5c518;font-size:13px;font-weight:600;margin-bottom:10px">{{ importNote }}</div>
                </sc-if>
                <sc-for list="{{ importRowsView }}" as="ir" hint-placeholder-count="4">
                  <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid rgba(255,255,255,0.08)">
                    <div style="flex:1"><b style="font-size:14px">{{ ir.title }}</b><div style="color:#7f8794;font-size:12px">{{ ir.sub }}</div></div>
                    <select value="{{ ir.poolId }}" onChange="{{ ir.onPoolChange }}" disabled="{{ ir.disabled }}" style="background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:9px 10px;color:#fff;font-size:13px">
                      <sc-for list="{{ ir.poolOptions }}" as="po" hint-placeholder-count="2">
                        <option value="{{ po.id }}">{{ po.name }}</option>
                      </sc-for>
                    </select>
                  </div>
                </sc-for>
                <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
                  <button onClick="{{ onConfirmImport }}" style="background:#E11B22;color:#fff;font-weight:800;font-size:13px;padding:12px 18px;border:none;border-radius:10px;cursor:pointer;text-transform:uppercase">{{ importConfirmLabel }}</button>
                  <button onClick="{{ onCancelImport }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#aeb4bf;font-weight:800;font-size:13px;padding:11px 16px;border-radius:10px;cursor:pointer;text-transform:uppercase">Cancel</button>
                </div>
              </div>
            </sc-if>
          </div>
```

- [ ] 6. Verify: `node tests/test-manager-dc-draw.js` — all checks pass.

- [ ] 7. Prove against injected faults, reverting each:

  (a) In `importSourceTeams()`, return `(s.regs && s.regs.teams) || []` with no filter. Run — "the import source is scoped to this age group by NAME" and "the wrong-age-group team was never imported" must FAIL. Revert.

  (b) In `buildImportRows()`, drop the balancing branch (`if (want && ...)`). Run — "the pools are kept level rather than honouring every preference" must FAIL. Revert.

  (c) In `buildImportRows()`, drop the `if (!poolIds.length)` early return. Run — "with no pools the panel says to add one first" must FAIL. Revert.

  (d) In `confirmImport()`, delete the `if (mode === 'replace' && this.importHasResults())` re-check. Run — "confirming a stale replace does NOT wipe the roster" must FAIL. Revert.

  (e) In `confirmImport()`, stop writing `names` (`teamNames: draw.teamNames || {}`). Run — "a friendly club name is recorded for the imported code" must FAIL. Revert.

  (f) In `confirmImport()`, drop the `claimed` dedup so duplicates are pushed. Run — "and is not added twice" must FAIL. Revert.

- [ ] 8. `powershell tests/runall.ps1` — whole suite green.

- [ ] 9. Commit on `dev`:

```
git checkout dev
git add Manager.dc.html tests/test-manager-dc-draw.js
git commit -F commitmsg.txt   # "Manager.dc.html: import registered teams into the draw editor"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files`, and on the PC:

```
git fetch origin --prune
git checkout dev
git add Manager.dc.html tests/test-manager-dc-draw.js
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash
git push origin dev
```

---

## Task 12 — Draw tab, part 4: publish / unpublish and the weekend clash check

**Files**
- Modify: `Manager.dc.html`
- Modify: `tests/test-manager-dc-draw.js`
- Test: `tests/test-manager-dc-draw.js`

**Interfaces**
- Consumes: Task 3's `state.session`, `ageId`, `ageName(id)`, `confirmModal`; Task 9's `state.draw`, `drawMsg`, `drawBusy`, `clash`, `clashBusy`, `loadDraw(agId)`. From `scores-data.js`: `canPublishNow(session, publishState)`, `publishDraw(agId, session)`, `unpublishDraw(agId, session)`, `loadAllDraws(session)`, `weekendClashes(drawsByAge, ageNames)`, `describeClash(c)`, `isOrganiserSession(s)`.
- Produces: methods `runWeekendCheck()` (returns `{ clashes, unplaced, offAllocation, placedCount, failed, groupCount }`), `doPublish()`, `doUnpublish()`, `checkWeekend()`, `clashUnplacedSummary(list)`.
- `renderVals()` keys: `publishPillLabel`, `publishPillStyle`, `canPublish`, `publishLabel`, `isPublished`, `publishBlockedNote`, `onPublish`, `onUnpublish`, `clashBusy`, `clashButtonLabel`, `onCheckWeekend`, `clashScopeNote`, `hasClashResult`, `clashError`, `clashHeadline`, `clashLines[]`, `clashFailedNote`, `clashUnplacedNote`, `clashOffAllocationLines[]`.

**Steps**

- [ ] 1. Add this section to `tests/test-manager-dc-draw.js`, before `summary(...)`:

```js
section('Publish and unpublish');
{
  const c = buildDraw({ canPublishNow: () => false });
  const vals = c.renderVals();
  // FAULT-PROOF: outside the tournament window the button is REPLACED with an
  // explanation, never shown disabled with no reason given.
  check('a manager outside the window gets no Publish button', vals.canPublish === false);
  check('…and an explanation instead', /tournament days|organiser/i.test(vals.publishBlockedNote));
  check('the state pill says it is not published', /not published/i.test(vals.publishPillLabel));
}
{
  let publishCalls = 0, confirmText = '';
  const c = buildDraw({ canPublishNow: () => true, publishDraw: async () => { publishCalls++; return { ok: true, published: true }; } });
  await c.doPublish();
  confirmText = c.state.modal.title;
  check('publishing asks first', !!c.state.modal && c.state.modal.kind === 'confirm');
  check('…naming the age group and who will see it', /U14 Boys/.test(confirmText) && /parents and coaches/i.test(confirmText));
  check('…and publishes nothing until confirmed', publishCalls === 0);
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('confirming publishes exactly once', publishCalls === 1);
  check('…and says so', c.state.drawMsg === 'Published — these fixtures are now public.');
}
{
  let unpublishCalls = 0;
  const c = buildDraw({
    canPublishNow: () => true,
    getDraw: async () => ({ ...freshDraw(), _publish: { published: true, publishedAt: '2026-11-07T09:00:00Z', publishedBy: 'x', managerCanPublishNow: true } }),
    unpublishDraw: async () => { unpublishCalls++; return { ok: true, published: false }; },
  });
  await c.loadDraw('u14b');
  const vals = c.renderVals();
  check('an already-published draw offers Unpublish', vals.isPublished === true);
  check('…and the pill says it is live', /live/i.test(vals.publishPillLabel));
  check('…and the publish button offers a republish', /republish/i.test(vals.publishLabel));
  await c.doUnpublish();
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('unpublishing calls the API exactly once', unpublishCalls === 1);
  check('…and says what the public now sees', /coming soon/i.test(c.state.drawMsg));
}
{
  const c = buildDraw({ canPublishNow: () => true, publishDraw: async () => ({ ok: false, error: 'Not signed in.' }) });
  await c.doPublish();
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  check('a failed publish shows the server\'s reason', c.state.drawMsg === 'Not signed in.');
}

section('Publishing warns about pitch clashes, but never blocks');
{
  let loadAllCalls = 0, publishCalls = 0;
  const c = buildDraw({
    canPublishNow: () => true,
    loadAllDraws: async () => { loadAllCalls++; return { drawsByAge: { u14b: {}, u16b: {} }, ageNames: { u14b: 'U14 Boys', u16b: 'U16B' }, failed: [] }; },
    weekendClashes: () => ({ clashes: [{ dayId: 'day1', dayLabel: 'Saturday', pitch: 'C4', sameAgeGroup: false,
      a: { agId: 'u14b', agName: 'U14 Boys', label: 'Pool A', startMins: 480, endMins: 600 },
      b: { agId: 'u16b', agName: 'U16B', label: 'Pool B', startMins: 560, endMins: 660 } }],
      unplaced: [], offAllocation: [], placedCount: 2 }),
    describeClash: (cl) => `Pitch ${cl.pitch} clash`,
    publishDraw: async () => { publishCalls++; return { ok: true, published: true }; },
  });
  await c.doPublish();
  // FAULT-PROOF: publishing used to run no clash check at all.
  check('publishing runs a weekend clash check first', loadAllCalls === 1);
  check('a clash involving this age group is folded into the question', /Pitch C4 clash/.test(c.state.modal.title));
  c.submitModal();
  await new Promise((r) => setImmediate(r));
  // FAULT-PROOF the other way: on the morning of the tournament the person who
  // has to move a game must not be locked out by a validator. It is a warning.
  check('…and it is a warning, not a block — publish still goes through', publishCalls === 1);
}
{
  const c = buildDraw({
    canPublishNow: () => true,
    loadAllDraws: async () => ({ drawsByAge: { u14b: {}, u16b: {} }, ageNames: { u14b: 'U14 Boys', u16b: 'U16B' }, failed: [] }),
    weekendClashes: () => ({ clashes: [{ dayId: 'day1', dayLabel: 'Saturday', pitch: 'C9', sameAgeGroup: false,
      a: { agId: 'u16b', agName: 'U16B', label: 'Pool A', startMins: 480, endMins: 600 },
      b: { agId: 'u16b', agName: 'U16B', label: 'Pool B', startMins: 560, endMins: 660 } }],
      unplaced: [], offAllocation: [], placedCount: 2 }),
    describeClash: (cl) => `Pitch ${cl.pitch} clash`,
  });
  await c.doPublish();
  check('a clash between two OTHER age groups is not raised here', !/Pitch C9 clash/.test(c.state.modal.title));
}
{
  const c = buildDraw({ canPublishNow: () => true, loadAllDraws: async () => { throw new Error('network down'); } });
  await c.doPublish();
  // FAULT-PROOF: an unreachable check must not silently look like a clean one.
  check('a clash check that fails says so in the question rather than implying all-clear',
    /Could not check/i.test(c.state.modal.title));
}

section('Check the whole weekend');
{
  const c = buildDraw({
    loadAllDraws: async () => ({ drawsByAge: { u14b: {}, u16b: {} }, ageNames: { u14b: 'U14 Boys', u16b: 'U16B' }, failed: [] }),
    weekendClashes: () => ({ clashes: [{ dayId: 'day1', dayLabel: 'Saturday', pitch: 'C4', sameAgeGroup: false,
      a: { agId: 'u14b', agName: 'U14 Boys', label: 'Pool A', startMins: 480, endMins: 600 },
      b: { agId: 'u16b', agName: 'U16B', label: 'Pool B', startMins: 560, endMins: 660 } }],
      unplaced: [], offAllocation: [], placedCount: 10 }),
    describeClash: (cl) => `Pitch ${cl.pitch} · ${cl.dayLabel} — ${cl.a.agName} ${cl.a.label} overlaps ${cl.b.agName} ${cl.b.label}`,
  });
  await c.checkWeekend();
  check('the result is stored', c.state.clash && c.state.clash.clashes.length === 1);
  const vals = c.renderVals();
  check('the clash is described in one line, from describeClash()', /Pitch C4/.test(vals.clashLines[0]) && /overlaps/.test(vals.clashLines[0]));
  check('the headline counts them', /1 pitch clash/i.test(vals.clashHeadline));
}
{
  const c = buildDraw({
    loadAllDraws: async () => ({ drawsByAge: { u14b: {} }, ageNames: { u14b: 'U14 Boys' }, failed: ['u16b', 'u18b'] }),
    weekendClashes: () => ({ clashes: [],
      unplaced: [{ agName: 'U14 Boys', label: 'Pool A', pitch: '', dayId: 'day1' }],
      offAllocation: [{ agName: 'U16B', label: 'Pool B', pitch: 'Z9' }],
      placedCount: 3 }),
  });
  await c.checkWeekend();
  const vals = c.renderVals();
  // FAULT-PROOF: a partial result used to render as a confident "No pitch
  // clashes." with nothing to say two age groups could not be read at all.
  check('the panel names the age groups it could not read', /U16B/.test(vals.clashFailedNote) && /U18B/.test(vals.clashFailedNote));
  check('…and says the check is therefore incomplete', /not a complete check/i.test(vals.clashFailedNote));
  check('the still-TBD bookings excluded from the check are listed', /U14 Boys: Pool A/.test(vals.clashUnplacedNote));
  check('a booking on a pitch outside its allocation is listed', /Z9/.test(vals.clashOffAllocationLines[0]) && /not one of its pitches/i.test(vals.clashOffAllocationLines[0]));
  check('the headline still reports the clean clash count', /No pitch clashes/i.test(vals.clashHeadline));
}
{
  const c = buildDraw({ loadAllDraws: async () => { throw new Error('network down'); } });
  await c.checkWeekend();
  check('a failed check is recorded as an error rather than crashing the tab', !!c.state.clash.error);
  check('…and shown', !!c.renderVals().clashError);
}
{
  const c = buildDraw({ isOrganiserSession: () => false });
  check('a manager is told the check cannot see other managers\' unsaved drafts',
    /unsaved edits cannot be seen/i.test(c.renderVals().clashScopeNote));
  const c2 = buildDraw({ isOrganiserSession: () => true });
  c2.setState({ session: { isOrganizer: true, ageGroupId: '*', token: 'tok' } });
  check('an organiser is told they are reading every group\'s working draft',
    /working draft/i.test(c2.renderVals().clashScopeNote));
}
```

- [ ] 2. Confirm it fails: `node tests/test-manager-dc-draw.js` → `TypeError: c.doPublish is not a function`.

- [ ] 3. Add the publish and clash methods to `Manager.dc.html`, after `cancelImport()`:

```js
  async runWeekendCheck() {
    const { api, session } = this.state;
    const { drawsByAge, ageNames, failed } = await api.loadAllDraws(session);
    return { ...api.weekendClashes(drawsByAge, ageNames), failed, groupCount: Object.keys(drawsByAge).length };
  }

  /* The clash check runs BEFORE the question, and anything involving this age
     group goes into the question as a WARNING — never a block. On the morning
     of the tournament, the person who has to move a game must not be locked
     out by a validator. */
  async doPublish() {
    const { api, ageId, session } = this.state;
    this.setState({ drawBusy: true, drawMsg: 'Checking the weekend for pitch clashes…' });
    let warning = '';
    try {
      const check = await this.runWeekendCheck();
      const mine = (check.clashes || []).filter((c) => c.a.agId === ageId || c.b.agId === ageId);
      if (mine.length) {
        warning = `${mine.length} pitch clash${mine.length === 1 ? '' : 'es'} involving ${this.ageName(ageId)}:\n\n`
          + mine.map((c) => '• ' + api.describeClash(c)).join('\n') + '\n\n';
      }
    } catch (err) {
      warning = 'Could not check the rest of the weekend for pitch clashes just now.\n\n';
    }
    this.setState({ drawBusy: false, drawMsg: '' });
    const ask = warning + 'Publish these fixtures for ' + this.ageName(ageId)
      + '? Parents and coaches will see them on the public fixtures and standings pages straight away.';
    this.confirmModal(ask, async () => {
      this.setState({ drawBusy: true, drawMsg: '' });
      const res = await api.publishDraw(ageId, session);
      this.setState({
        drawBusy: false,
        drawMsg: res.ok ? 'Published — these fixtures are now public.' : (res.error || 'Could not publish.'),
      });
      if (res.ok) await this.loadDraw(ageId);
    }, { okLabel: 'Publish anyway', wide: true });
  }

  async doUnpublish() {
    const { api, ageId, session } = this.state;
    this.confirmModal('Take these fixtures back down? Anyone who has already seen them will find the fixtures replaced by "coming soon" until you publish again. Your draft is kept.', async () => {
      this.setState({ drawBusy: true, drawMsg: '' });
      const res = await api.unpublishDraw(ageId, session);
      this.setState({
        drawBusy: false,
        drawMsg: res.ok ? 'Unpublished — the public now sees "coming soon".' : (res.error || 'Could not unpublish.'),
      });
      if (res.ok) await this.loadDraw(ageId);
    }, { okLabel: 'Unpublish' });
  }

  async checkWeekend() {
    this.setState({ clashBusy: true, clash: null });
    let result;
    try {
      result = await this.runWeekendCheck();
    } catch (err) {
      result = { error: 'Could not read every age group. Try again.' };
    }
    this.setState({ clashBusy: false, clash: result });
  }

  /* Grouped per age group rather than one line per pool: fifteen groups with
     nothing scheduled would otherwise be forty lines of noise. */
  clashUnplacedSummary(list) {
    const by = new Map();
    (list || []).forEach((bk) => {
      if (!by.has(bk.agName)) by.set(bk.agName, []);
      by.get(bk.agName).push(bk.label);
    });
    return [...by.entries()].map(([name, labels]) => `${name}: ${labels.join(', ')}`).join(' · ');
  }
```

- [ ] 4. Extend `renderVals()`. Add to the computed block:

```js
    const pubState = (d && d._publish) || {};
    const canPublish = !!(s.api && s.api.canPublishNow(s.session, pubState));
    const cl = s.clash;
    const clashOk = !!(cl && !cl.error);
```

and these keys to the returned object:

```js
      publishPillLabel: pubState.published ? 'Live' : 'Not published',
      publishPillStyle: pubState.published
        ? 'display:inline-block;font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:4px 10px;border-radius:100px;background:rgba(23,163,74,0.15);color:#3bd070'
        : 'display:inline-block;font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:4px 10px;border-radius:100px;background:#0C0C0E;color:#7f8794;border:1px solid rgba(255,255,255,0.15)',
      canPublish,
      isPublished: !!pubState.published,
      publishLabel: pubState.published ? 'Republish' : 'Publish fixtures',
      publishBlockedNote: 'Managers can publish on the tournament days only (7–8 November 2026). Ask a tournament organiser to publish before then.',
      onPublish: () => this.doPublish(),
      onUnpublish: () => this.doUnpublish(),

      clashBusy: s.clashBusy,
      clashButtonLabel: s.clashBusy ? 'Checking all 15 age groups…' : 'Check the whole weekend',
      onCheckWeekend: () => this.checkWeekend(),
      /* A manager's check reads their own working draft against everyone
         else's PUBLISHED fixtures — that limit has to be said, not implied
         away by a confident "no clashes". */
      clashScopeNote: (s.api && s.api.isOrganiserSession && s.api.isOrganiserSession(s.session))
        ? 'You are an organiser, so this reads every age group’s working draft — including changes nobody has published yet.'
        : 'This reads your own working draft against everyone else’s published fixtures. Another manager’s unsaved edits cannot be seen from here.',
      hasClashResult: !!cl,
      clashError: (cl && cl.error) || '',
      clashHeadline: clashOk
        ? (cl.clashes.length === 0
          ? `No pitch clashes. ${cl.placedCount} pool(s)/knockout matches placed across ${cl.groupCount} age groups.`
          : `${cl.clashes.length} pitch clash(es) across the weekend.`)
        : '',
      clashLines: clashOk ? cl.clashes.map((c) => s.api.describeClash(c)) : [],
      clashFailedNote: (clashOk && cl.failed && cl.failed.length)
        ? `Could not read: ${cl.failed.join(', ').toUpperCase()} — those age groups are NOT included above, so this is not a complete check.`
        : '',
      clashUnplacedNote: (clashOk && cl.unplaced && cl.unplaced.length)
        ? `Still on TBD, excluded from this check: ${this.clashUnplacedSummary(cl.unplaced)}`
        : '',
      clashOffAllocationLines: (clashOk && cl.offAllocation)
        ? cl.offAllocation.map((bk) => `${bk.agName} ${bk.label} is on ${bk.pitch}, which is not one of its pitches in the venue layout.`)
        : [],
```

- [ ] 5. Add the publishing panel and clash panel to the template, inside `<sc-if value="{{ isDraw }}">`, after the save bar added in Task 10:

```html
          <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px;margin-top:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
              <span style="font-family:'Anton';font-size:17px;text-transform:uppercase">Publishing</span>
              <span style="{{ publishPillStyle }}">{{ publishPillLabel }}</span>
            </div>
            <sc-if value="{{ canPublish }}" hint-placeholder-val="{{ false }}">
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button onClick="{{ onPublish }}" style="background:#E11B22;color:#fff;font-weight:800;font-size:14px;padding:13px 22px;border:none;border-radius:10px;cursor:pointer;text-transform:uppercase">{{ publishLabel }}</button>
                <sc-if value="{{ isPublished }}" hint-placeholder-val="{{ false }}">
                  <button onClick="{{ onUnpublish }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#ff8a8a;font-weight:800;font-size:14px;padding:12px 20px;border-radius:10px;cursor:pointer;text-transform:uppercase">Unpublish</button>
                </sc-if>
              </div>
            </sc-if>
            <sc-if value="{{ canPublish }}" hint-placeholder-val="{{ false }}" invert>
              <p style="font-size:13px;color:#f5c518;font-weight:600">{{ publishBlockedNote }}</p>
            </sc-if>
          </div>

          <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px;margin-top:16px">
            <div style="font-family:'Anton';font-size:17px;text-transform:uppercase;margin-bottom:6px">Check the whole weekend</div>
            <p style="color:#7f8794;font-size:12.5px;margin-bottom:4px">Every age group is edited on its own, so nothing normally notices when two of them are handed the same pitch at the same time. This reads all 15 and lists every overlap.</p>
            <p style="color:#7f8794;font-size:12px;margin-bottom:10px">{{ clashScopeNote }}</p>
            <button onClick="{{ onCheckWeekend }}" disabled="{{ clashBusy }}" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;font-weight:800;font-size:13px;padding:12px 18px;border-radius:10px;cursor:pointer;text-transform:uppercase">{{ clashButtonLabel }}</button>

            <sc-if value="{{ clashError }}" hint-placeholder-val="">
              <div style="margin-top:12px;background:rgba(225,27,34,0.12);border:1px solid rgba(225,27,34,0.4);border-radius:9px;padding:11px 13px;color:#ff8a8a;font-size:13px;font-weight:600">{{ clashError }}</div>
            </sc-if>
            <sc-if value="{{ clashHeadline }}" hint-placeholder-val="">
              <div style="margin-top:12px">
                <p style="font-weight:700;font-size:13.5px">{{ clashHeadline }}</p>
                <sc-for list="{{ clashLines }}" as="cl" hint-placeholder-count="2">
                  <div style="margin-top:8px;background:rgba(225,27,34,0.12);border:1px solid rgba(225,27,34,0.4);border-radius:9px;padding:11px 13px;color:#ff8a8a;font-size:13px;font-weight:600">{{ cl }}</div>
                </sc-for>
                <sc-if value="{{ clashFailedNote }}" hint-placeholder-val="">
                  <div style="margin-top:8px;background:rgba(245,197,24,0.09);border:1px solid rgba(245,197,24,0.32);border-radius:9px;padding:11px 13px;color:#f5c518;font-size:13px;font-weight:600">{{ clashFailedNote }}</div>
                </sc-if>
                <sc-if value="{{ clashUnplacedNote }}" hint-placeholder-val="">
                  <div style="margin-top:8px;background:rgba(245,197,24,0.09);border:1px solid rgba(245,197,24,0.32);border-radius:9px;padding:11px 13px;color:#f5c518;font-size:13px;font-weight:600">{{ clashUnplacedNote }}</div>
                </sc-if>
                <sc-for list="{{ clashOffAllocationLines }}" as="ol" hint-placeholder-count="1">
                  <div style="margin-top:8px;background:rgba(245,197,24,0.09);border:1px solid rgba(245,197,24,0.32);border-radius:9px;padding:11px 13px;color:#f5c518;font-size:13px;font-weight:600">{{ ol }}</div>
                </sc-for>
              </div>
            </sc-if>
          </div>
```

Note on the `invert` attribute above: if `support.js`'s `<sc-if>` does not support inverting, replace that one block with a second boolean key `publishBlocked: !canPublish` in `renderVals()` and use `<sc-if value="{{ publishBlocked }}" hint-placeholder-val="{{ true }}">`. Check `support.js` before writing it, and use whichever the runtime actually supports — do not leave both.

- [ ] 6. Verify: `node tests/test-manager-dc-draw.js` — all checks pass.

- [ ] 7. Prove against injected faults, reverting each:

  (a) In `doPublish()`, delete the whole `try { ... } catch` clash-check block. Run — "publishing runs a weekend clash check first" and "a clash involving this age group is folded into the question" must FAIL. Revert.

  (b) In `doPublish()`, drop the `.filter((c) => c.a.agId === ageId || c.b.agId === ageId)`. Run — "a clash between two OTHER age groups is not raised here" must FAIL. Revert.

  (c) In `doPublish()`, make the clash warning a hard return instead of a confirm (`if (mine.length) return;`). Run — "it is a warning, not a block" must FAIL. Revert.

  (d) In `doPublish()`, swallow the catch with `warning = ''`. Run — "a clash check that fails says so in the question" must FAIL. Revert.

  (e) In `checkWeekend()`, remove the `try/catch`. Run — "a failed check is recorded as an error rather than crashing the tab" must FAIL (the test throws). Revert.

  (f) In `renderVals()`, set `clashFailedNote: ''`. Run — the two "could not read" checks must FAIL. Revert.

  (g) In `renderVals()`, set `canPublish: true` unconditionally. Run — "a manager outside the window gets no Publish button" must FAIL. Revert.

- [ ] 8. `powershell tests/runall.ps1` — whole suite green.

- [ ] 9. Commit on `dev`:

```
git checkout dev
git add Manager.dc.html tests/test-manager-dc-draw.js
git commit -F commitmsg.txt   # "Manager.dc.html: publish/unpublish and the weekend clash check"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files`, and on the PC:

```
git fetch origin --prune
git checkout dev
git add Manager.dc.html tests/test-manager-dc-draw.js
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash
git push origin dev
```

## Task 13 — Registrations tab and the Spirit of Rugby Award tally

**Files**
- Modify: `Manager.dc.html`
- Modify: `tests/test-manager-dc.js`
- Test: `tests/test-manager-dc.js`

**Interfaces**
- Consumes: Task 3's `state.regs`, `regSearch`, `spiritAward`, `ageGroups`, `ageId`, `session`, and `go(tab)` / `load(agId)` (both REPLACED again here); Task 11's `loadRegistrations()`. From `scores-data.js`: `getMyRegistrations(session)`, `supportsSpiritAward(agId)`, `getSpiritAward(agId)`.
- Produces: methods `regNarrow(rows)`, `regKeyOf(name, dob)`, `regParseRoster(team)`, `regRows()` (returns `{ teams, players, unmatched, teamRows, playerRows }`), `onRegSearch(e)`; replaced `go(tab)` and `load(agId)`.
- `renderVals()` keys: `regLoading`, `regSearch`, `onRegSearch`, `regTeamCount`, `regPlayerCount`, `regTeamRows[]` (`{key,title,sub}`), `regPlayerRows[]` (`{key,name,dob,club,parent,emergency,medical,hasMedical,consent,unmatched,rowStyle}`), `regUnmatchedCount`, `hasRegUnmatched`, `regUnmatchedNote`, `regTeamsEmpty`, `regPlayersEmpty`, and for the Fixtures tab: `hasSpirit`, `spiritProgress`, `spiritComplete`, `spiritWinnersLine`, `spiritTally[]` (`{name,team,count}`), `spiritEmpty`.

**Steps**

- [ ] 1. Add these sections to `tests/test-manager-dc.js`, before `section('Organizer design system is what this page uses');`:

```js
section('Registrations tab');
{
  const regTeams = [{ club: 'ADH', teamName: 'ADH1', ageGroup: 'U14 Boys',
    headCoachName: 'Coach A', headCoachMobile: '0500000001', managerName: 'Mgr A', managerMobile: '0500000002',
    players: JSON.stringify([{ firstName: 'Sam', lastName: 'Jones', dob: '2013-01-01' }]) }];
  const regPlayers = [
    { playerName: 'Sam Jones', dob: '2013-01-01', club: 'ADH', ageGroup: 'U14 Boys', parentName: 'P Jones', parentMobile: '0500000003', emergencyContact: 'E Contact', emergencyMobile: '0500000004', medicalNotes: '', consent: 'Yes' },
    { playerName: 'Unmatched Kid', dob: '2013-02-02', club: 'ADH', ageGroup: 'U14 Boys', parentName: 'P Kid', parentMobile: '0500000005', emergencyContact: 'E Kid', emergencyMobile: '0500000006', medicalNotes: 'Asthma', consent: 'Yes' },
  ];
  const c = buildManager({ getMyRegistrations: async () => ({ teams: regTeams, players: regPlayers, scope: 'U14 Boys' }) });
  await c.boot();
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  const vals = c.renderVals();
  check('the team\'s coach is listed with a phone number', /Coach A/.test(vals.regTeamRows[0].sub) && /0500000001/.test(vals.regTeamRows[0].sub));
  check('the team\'s manager is listed too', /Mgr A/.test(vals.regTeamRows[0].sub));
  check('a player row carries the date of birth', vals.regPlayerRows[0].dob === '2013-01-01');
  check('a player row carries the emergency contact', /E Contact/.test(vals.regPlayerRows[0].emergency));
  check('medical notes are shown where they exist', vals.regPlayerRows[1].medical === 'Asthma' && vals.regPlayerRows[1].hasMedical === true);
  // FAULT-PROOF: matching is by name AND date of birth. A match on name alone
  // would clear the unmatched flag for a different child with the same name.
  check('a player who is on a roster is not flagged', vals.regPlayerRows[0].unmatched === false);
  check('a player who is on no roster IS flagged', vals.regPlayerRows[1].unmatched === true);
  check('…and the count is shown at the top', vals.regUnmatchedCount === 1 && vals.hasRegUnmatched === true);
  check('the counts match the rows', vals.regTeamCount === 1 && vals.regPlayerCount === 2);
}
{
  const regTeams = [{ club: 'ADH', teamName: 'ADH1', ageGroup: 'U14 Boys', headCoachName: 'Coach A', headCoachMobile: '1', managerName: 'M', managerMobile: '2',
    players: JSON.stringify([{ firstName: 'Sam', lastName: 'Jones', dob: '2013-01-01' }]) }];
  const regPlayers = [{ playerName: 'Sam Jones', dob: '2014-09-09', club: 'ADH', ageGroup: 'U14 Boys', parentName: 'P', parentMobile: '3', emergencyContact: 'E', emergencyMobile: '4', medicalNotes: '', consent: 'Yes' }];
  const c = buildManager({ getMyRegistrations: async () => ({ teams: regTeams, players: regPlayers, scope: '' }) });
  await c.boot();
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  // FAULT-PROOF: same name, different date of birth — this must still be
  // flagged, or a mis-keyed DOB silently passes as a match.
  check('a same-name player with a different date of birth is still flagged', c.renderVals().regPlayerRows[0].unmatched === true);
}
{
  const regTeams = [{ club: 'ADH', teamName: 'ADH1', ageGroup: 'U14 Boys', headCoachName: 'C', headCoachMobile: '1', managerName: 'M', managerMobile: '2', players: 'not-json-at-all' }];
  const c = buildManager({ getMyRegistrations: async () => ({ teams: regTeams, players: [], scope: '' }) });
  await c.boot();
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  check('an unparseable roster does not take the whole tab down', c.renderVals().regTeamCount === 1);
}
{
  const regPlayers = [
    { playerName: 'Ethan Smith', dob: '2013-01-01', club: 'ADH', ageGroup: 'U14 Boys', parentName: 'P Smith', parentMobile: '3', emergencyContact: 'E', emergencyMobile: '4', medicalNotes: '', consent: 'Yes' },
    { playerName: 'Olivia Brown', dob: '2013-03-03', club: 'ADH', ageGroup: 'U14 Boys', parentName: 'P Brown', parentMobile: '5', emergencyContact: 'E', emergencyMobile: '6', medicalNotes: '', consent: 'Yes' },
  ];
  const c = buildManager({ getMyRegistrations: async () => ({ teams: [], players: regPlayers, scope: '' }) });
  await c.boot();
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  c.onRegSearch({ target: { value: 'E' } });
  check('the first keystroke is kept', c.state.regSearch === 'E');
  c.onRegSearch({ target: { value: 'Et' } });
  c.onRegSearch({ target: { value: 'Eth' } });
  c.onRegSearch({ target: { value: 'Ethan' } });
  check('typing accumulates rather than resetting', c.state.regSearch === 'Ethan');
  const names = c.renderVals().regPlayerRows.map((r) => r.name);
  check('the list filters to the full typed string', names.includes('Ethan Smith') && !names.includes('Olivia Brown'));
  c.onRegSearch({ target: { value: '' } });
  // FAULT-PROOF: the filter is recomputed from state.regs each time, so it is
  // not a one-way narrowing that can never be undone.
  const namesBack = c.renderVals().regPlayerRows.map((r) => r.name);
  check('clearing the box brings everyone back', namesBack.includes('Ethan Smith') && namesBack.includes('Olivia Brown'));
}
{
  const c = buildManager({ getMyRegistrations: async () => ({ teams: [], players: [], scope: '' }) });
  await c.boot();
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  const vals = c.renderVals();
  check('an empty registration list says so for teams', vals.regTeamsEmpty === true);
  check('…and for players', vals.regPlayersEmpty === true);
}
{
  // An organiser sees every group's rows, so they have to be narrowed to the
  // group currently on screen — by NAME, since state.ageId is an id.
  const rows = {
    teams: [
      { club: 'ADH', teamName: 'ADH1', ageGroup: 'U14 Boys', headCoachName: 'C', headCoachMobile: '1', managerName: 'M', managerMobile: '2', players: '[]' },
      { club: 'XX', teamName: 'XX1', ageGroup: 'U16 Boys', headCoachName: 'C', headCoachMobile: '1', managerName: 'M', managerMobile: '2', players: '[]' },
    ],
    players: [], scope: 'all',
  };
  const c = buildManager({
    currentSession: () => ({ isOrganizer: true, ageGroupId: '*', token: 't' }),
    isOrganiserSession: (s) => !!(s && s.isOrganizer),
    getMyRegistrations: async () => rows,
  });
  await c.boot();
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  // FAULT-PROOF: without the narrowing, an organiser sees all 15 groups'
  // registrations stacked under whichever group they happen to be viewing.
  check('an organiser sees only the age group on screen', c.renderVals().regTeamCount === 1);
}
{
  let calls = 0;
  const c = buildManager({ getMyRegistrations: async () => { calls++; return { teams: [], players: [], scope: '' }; } });
  await c.boot();
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  check('opening the tab fetches once', calls === 1);
  c.go('today');
  c.go('registrations');
  await new Promise((r) => setImmediate(r));
  check('returning to it does not refetch', calls === 1);
}

section('Spirit of Rugby Award tally on the Fixtures tab');
{
  const c = buildManager({
    supportsSpiritAward: () => true,
    getSpiritAward: async () => ({ supported: true, totalMatches: 2, playedMatches: 1, complete: false,
      tally: [{ name: 'Sam Jones', count: 1, team: 'ADH1' }], winners: [] }),
  });
  await c.boot();
  c.go('fixtures');
  const vals = c.renderVals();
  check('the tally card shows for a supporting age group', vals.hasSpirit === true);
  check('…with how far through the scoring it is', /1 of 2 matches scored/i.test(vals.spiritProgress));
  check('…and the nominations so far', vals.spiritTally.length === 1 && vals.spiritTally[0].name === 'Sam Jones');
  check('…and no winner while it is incomplete', vals.spiritComplete === false && vals.spiritWinnersLine === '');
}
{
  const c = buildManager({
    supportsSpiritAward: () => true,
    getSpiritAward: async () => ({ supported: true, totalMatches: 2, playedMatches: 2, complete: true,
      tally: [{ name: 'Sam Jones', count: 3, team: 'ADH1' }, { name: 'Ava Khan', count: 3, team: 'DE1' }],
      winners: [{ name: 'Sam Jones', team: 'ADH1' }, { name: 'Ava Khan', team: 'DE1' }] }),
  });
  await c.boot();
  c.go('fixtures');
  const vals = c.renderVals();
  check('a finished tally names the winner', vals.spiritComplete === true && /Sam Jones/.test(vals.spiritWinnersLine));
  // FAULT-PROOF: a tie produces more than one winner, and printing only the
  // first would hand one child an award two of them share.
  check('…and every winner of a tie, not just the first', /Ava Khan/.test(vals.spiritWinnersLine));
}
{
  const c = buildManager({ supportsSpiritAward: () => false });
  await c.boot();
  c.go('fixtures');
  // FAULT-PROOF: an age group that does not run the award must not see an
  // empty card implying it does.
  check('no tally card for an age group that does not run the award', c.renderVals().hasSpirit === false);
}
{
  let fetched = 0;
  const c = buildManager({ supportsSpiritAward: () => false, getSpiritAward: async () => { fetched++; return { supported: false }; } });
  await c.boot();
  check('the tally is not even fetched for an unsupported age group', fetched === 0);
}
{
  const c = buildManager({
    supportsSpiritAward: () => true,
    getSpiritAward: async () => ({ supported: true, totalMatches: 2, playedMatches: 0, complete: false, tally: [], winners: [] }),
  });
  await c.boot();
  c.go('fixtures');
  check('with no nominations yet the card says so', c.renderVals().spiritEmpty === true);
}
```

- [ ] 2. Confirm it fails: `node tests/test-manager-dc.js` → `vals.regTeamRows` is `undefined`.

- [ ] 3. In `Manager.dc.html`, REPLACE `go(tab)` and `load(agId)` (the versions written in Task 9) with these final versions:

```js
  go(tab) {
    const s = this.state;
    const leavingDraw = s.tab === 'draw' && tab !== 'draw';
    this.setState({ tab });
    if (leavingDraw) this.clearDrawTransientState();
    if (tab === 'draw' && s.drawLoadedFor !== s.ageId && !s.drawDirty) this.loadDraw(s.ageId);
    if (tab === 'registrations' && s.regs === undefined) this.loadRegistrations();
  }

  async load(agId) {
    const { api } = this.state;
    const keepDraw = this.state.drawDirty;
    /* load() runs after every score save and clear. Throwing away an
       in-progress Draw edit at that moment destroys work nobody warned the
       manager about, so a dirty draft is carried through. */
    this.setState((s) => ({
      ageId: agId, fixtures: null, standings: null, spiritAward: null, regs: undefined,
      draw: keepDraw ? s.draw : undefined,
      drawLoadedFor: keepDraw ? s.drawLoadedFor : null,
    }));
    this.clearDrawTransientState();
    const [fx, st] = await Promise.all([api.getFixtures(agId), api.getStandings(agId)]);
    if (this.state.ageId !== agId) return; // a stale response for a group we left
    this.setState({ fixtures: fx, standings: st });
    if (this.state.tab === 'draw' && !this.state.drawDirty) await this.loadDraw(agId);
    if (this.state.tab === 'registrations') await this.loadRegistrations();
    /* Only fetched where the award actually runs — an unconditional fetch
       would put a request (and an empty card) on every other age group. */
    if (api.supportsSpiritAward(agId)) {
      const award = await api.getSpiritAward(agId);
      if (this.state.ageId === agId) this.setState({ spiritAward: award });
    }
  }
```

- [ ] 4. Add the registration helpers after `loadRegistrations()`:

```js
  /* The server already scopes an ordinary manager's rows to their own age
     group. Only an organiser/'*' session gets every group's rows, so those
     are narrowed to whichever group is on screen — by NAME, because state.ageId
     is an id ('u14b') and row.ageGroup is a name ('U14 Boys'). */
  regNarrow(rows) {
    const s = this.state;
    if (s.session && s.session.ageGroupId === '*') {
      const meta = (s.ageGroups || []).find((a) => a.id === s.ageId);
      const nm = ((meta && meta.name) || '').trim().toLowerCase();
      return (rows || []).filter((r) => String(r.ageGroup || '').trim().toLowerCase() === nm);
    }
    return rows || [];
  }

  /* Name AND date of birth. Matching on name alone would clear the warning
     for a different child who happens to share a name. */
  regKeyOf(name, dob) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ') + '|' + String(dob || '').trim();
  }

  regParseRoster(team) {
    let arr = [];
    try { arr = JSON.parse(team.players || '[]'); } catch (e) { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    return arr.map((p) => ({ name: [p.firstName, p.lastName].filter(Boolean).join(' ').trim(), dob: p.dob || '' }));
  }

  regRows() {
    const s = this.state;
    const teams = this.regNarrow(s.regs && s.regs.teams);
    const players = this.regNarrow(s.regs && s.regs.players);
    const rosterKeys = new Set();
    teams.forEach((t) => this.regParseRoster(t).forEach((p) => rosterKeys.add(this.regKeyOf(p.name, p.dob))));
    const unmatched = players.filter((p) => !rosterKeys.has(this.regKeyOf(p.playerName, p.dob)));
    const q = (s.regSearch || '').trim().toLowerCase();
    const hit = (hay) => !q || hay.toLowerCase().includes(q);
    const teamRows = teams
      .filter((t) => hit([t.club, t.teamName, t.headCoachName, t.managerName].join(' ')))
      .map((t) => ({
        key: `${t.club}|${t.teamName}`,
        title: `${t.club} · ${t.teamName}`,
        sub: `Coach: ${t.headCoachName || '—'} ${t.headCoachMobile || ''} · Manager: ${t.managerName || '—'} ${t.managerMobile || ''}`,
      }));
    const playerRows = players
      .filter((p) => hit([p.playerName, p.club, p.parentName, p.dob].join(' ')))
      .map((p) => ({
        key: `${p.playerName}|${p.dob}`,
        name: p.playerName,
        dob: p.dob,
        club: p.club,
        parent: `Parent: ${p.parentName || '—'} ${p.parentMobile || ''}`,
        emergency: `Emergency: ${p.emergencyContact || '—'} ${p.emergencyMobile || ''}`,
        medical: p.medicalNotes || '',
        hasMedical: !!p.medicalNotes,
        consent: `Consent: ${p.consent || '—'}`,
        unmatched: unmatched.indexOf(p) >= 0,
        rowStyle: unmatched.indexOf(p) >= 0 ? 'box-shadow:inset 3px 0 0 #f5c518' : '',
      }));
    return { teams, players, unmatched, teamRows, playerRows };
  }

  onRegSearch(e) { this.setState({ regSearch: e.target.value }); }
```

- [ ] 5. Extend `renderVals()`. Add to the computed block:

```js
    const reg = (s.regs === undefined || s.regs === null) ? null : this.regRows();
    const sa = s.spiritAward;
    const spiritOn = !!(sa && sa.supported);
```

and these keys to the returned object:

```js
      regLoading: s.regs === undefined || s.regs === null,
      regSearch: s.regSearch,
      onRegSearch: (e) => this.onRegSearch(e),
      regTeamCount: reg ? reg.teams.length : 0,
      regPlayerCount: reg ? reg.players.length : 0,
      regTeamRows: reg ? reg.teamRows : [],
      regPlayerRows: reg ? reg.playerRows : [],
      regTeamsEmpty: !!(reg && reg.teamRows.length === 0),
      regPlayersEmpty: !!(reg && reg.playerRows.length === 0),
      regUnmatchedCount: reg ? reg.unmatched.length : 0,
      hasRegUnmatched: !!(reg && reg.unmatched.length),
      regUnmatchedNote: reg && reg.unmatched.length
        ? `${reg.unmatched.length} player registration(s) don't match any team roster by name + date of birth — flagged below.`
        : '',

      hasSpirit: spiritOn,
      spiritProgress: spiritOn ? `${sa.playedMatches} of ${sa.totalMatches} matches scored` : '',
      spiritComplete: !!(spiritOn && sa.complete && (sa.winners || []).length),
      spiritWinnersLine: (spiritOn && sa.complete && (sa.winners || []).length)
        ? sa.winners.map((w) => (w.team ? `${w.name} (${w.team})` : w.name)).join(' & ')
        : '',
      spiritTally: spiritOn ? (sa.tally || []) : [],
      spiritEmpty: !!(spiritOn && (sa.tally || []).length === 0),
```

- [ ] 6. Replace the Registrations placeholder card in the template with:

```html
      <sc-if value="{{ isRegistrations }}" hint-placeholder-val="{{ false }}">
        <div style="margin-top:24px">
          <div style="font-family:'Anton';font-size:18px;text-transform:uppercase;letter-spacing:.4px;margin-bottom:12px">Registrations</div>

          <sc-if value="{{ regLoading }}" hint-placeholder-val="{{ true }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:34px 22px;text-align:center;color:#7f8794;font-size:14px">Loading…</div>
          </sc-if>

          <input value="{{ regSearch }}" onInput="{{ onRegSearch }}" placeholder="Search player, club, coach or parent…" style="width:100%;background:#151517;border:1px solid rgba(255,255,255,0.15);border-radius:9px;padding:11px 14px;color:#fff;font-size:14px">

          <sc-if value="{{ hasRegUnmatched }}" hint-placeholder-val="{{ false }}">
            <div style="margin-top:12px;background:rgba(245,197,24,0.09);border:1px solid rgba(245,197,24,0.32);border-radius:9px;padding:11px 13px;color:#f5c518;font-size:13px;font-weight:600">{{ regUnmatchedNote }}</div>
          </sc-if>

          <div style="font-family:'Anton';font-size:17px;text-transform:uppercase;margin:18px 0 10px">Teams ({{ regTeamCount }})</div>
          <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden">
            <sc-if value="{{ regTeamsEmpty }}" hint-placeholder-val="{{ true }}">
              <div style="padding:28px 22px;text-align:center;color:#7f8794;font-size:14px">No team registrations yet.</div>
            </sc-if>
            <sc-for list="{{ regTeamRows }}" as="t" hint-placeholder-count="3">
              <div style="padding:14px 16px;border-top:1px solid rgba(255,255,255,0.08)">
                <b style="font-weight:700;font-size:14.5px">{{ t.title }}</b>
                <div style="color:#7f8794;font-size:12.5px;margin-top:2px">{{ t.sub }}</div>
              </div>
            </sc-for>
          </div>

          <div style="font-family:'Anton';font-size:17px;text-transform:uppercase;margin:18px 0 10px">Players ({{ regPlayerCount }})</div>
          <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden">
            <sc-if value="{{ regPlayersEmpty }}" hint-placeholder-val="{{ true }}">
              <div style="padding:28px 22px;text-align:center;color:#7f8794;font-size:14px">No player registrations yet.</div>
            </sc-if>
            <sc-for list="{{ regPlayerRows }}" as="p" hint-placeholder-count="6">
              <div style="padding:14px 16px;border-top:1px solid rgba(255,255,255,0.08);{{ p.rowStyle }}">
                <div><b style="font-weight:700;font-size:14.5px">{{ p.name }}</b> <span style="color:#7f8794">{{ p.dob }}</span>
                  <sc-if value="{{ p.unmatched }}" hint-placeholder-val="{{ false }}">
                    <span style="color:#f5c518;font-weight:700">⚠ not on a roster</span>
                  </sc-if>
                </div>
                <div style="color:#7f8794;font-size:12.5px;margin-top:2px">{{ p.club }} · {{ p.parent }} · {{ p.emergency }}</div>
                <sc-if value="{{ p.hasMedical }}" hint-placeholder-val="{{ false }}">
                  <div style="color:#f5c518;font-size:12.5px;font-weight:700;margin-top:2px">Medical: {{ p.medical }}</div>
                </sc-if>
                <div style="color:#7f8794;font-size:12.5px;margin-top:2px">{{ p.consent }}</div>
              </div>
            </sc-for>
          </div>
        </div>
      </sc-if>
```

- [ ] 7. Add the Spirit of Rugby Award card to the Fixtures tab template, immediately after the "Fixtures & scoring" heading and before the loading state:

```html
          <sc-if value="{{ hasSpirit }}" hint-placeholder-val="{{ false }}">
            <div style="background:#151517;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:18px 20px;margin-bottom:16px">
              <div style="font-family:'Anton';font-size:15px;text-transform:uppercase;color:#3bd070;margin-bottom:6px">Spirit of Rugby Award</div>
              <div style="color:#7f8794;font-size:12px;margin-bottom:8px">{{ spiritProgress }}</div>
              <sc-if value="{{ spiritComplete }}" hint-placeholder-val="{{ false }}">
                <div style="font-weight:800;margin-bottom:8px">🏆 {{ spiritWinnersLine }}</div>
              </sc-if>
              <sc-if value="{{ spiritEmpty }}" hint-placeholder-val="{{ false }}">
                <div style="color:#7f8794;font-size:12px">No nominations yet.</div>
              </sc-if>
              <sc-for list="{{ spiritTally }}" as="sp" hint-placeholder-count="4">
                <span style="display:inline-flex;align-items:center;gap:6px;background:#0C0C0E;border:1px solid rgba(255,255,255,0.15);border-radius:100px;padding:8px 14px;font-size:13px;font-weight:700;margin:3px">{{ sp.name }} <span style="color:#7f8794">{{ sp.team }}</span> {{ sp.count }}</span>
              </sc-for>
            </div>
          </sc-if>
```

- [ ] 8. Verify: `node tests/test-manager-dc.js` — all checks pass.

- [ ] 9. Prove against injected faults, reverting each:

  (a) In `regKeyOf()`, drop the date of birth (`return String(name||'')...`). Run — "a same-name player with a different date of birth is still flagged" must FAIL. Revert.

  (b) In `regParseRoster()`, remove the `try/catch`. Run — "an unparseable roster does not take the whole tab down" must FAIL (it throws). Revert.

  (c) In `regNarrow()`, always `return rows || []`. Run — "an organiser sees only the age group on screen" must FAIL. Revert.

  (d) In `load()`, fetch the award unconditionally (drop `if (api.supportsSpiritAward(agId))`). Run — "the tally is not even fetched for an unsupported age group" must FAIL. Revert.

  (e) In `renderVals()`, change `spiritWinnersLine` to `sa.winners[0].name`. Run — "and every winner of a tie, not just the first" must FAIL. Revert.

  (f) In `go()`, drop the `s.regs === undefined` guard so it refetches every visit. Run — "returning to it does not refetch" must FAIL. Revert.

- [ ] 10. `powershell tests/runall.ps1` — whole suite green.

- [ ] 11. Commit on `dev`:

```
git checkout dev
git add Manager.dc.html tests/test-manager-dc.js
git commit -F commitmsg.txt   # "Manager.dc.html: Registrations tab and the Spirit of Rugby Award tally"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files`, and on the PC:

```
git fetch origin --prune
git checkout dev
git add Manager.dc.html tests/test-manager-dc.js
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash
git push origin dev
```

---

## Task 14 — Full parity sweep against `tests/test-manager-dashboard.js`

Nothing new is built here. This task walks the OLD test file behaviour by behaviour, proves each one has a passing equivalent against `Manager.dc.html`, fills any gap it finds, and records the mapping in the repo so the next person can see the working was done.

**Files**
- Modify: `tests/test-manager-dc.js` (parity matrix header comment + any gap-fill checks)
- Modify: `tests/test-manager-dc-draw.js` (gap-fill checks, if any)
- Modify: `tests/test-manager-dc-score-sheet.js` (gap-fill checks, if any)
- Test: all three, plus the full suite

**Interfaces**
- Consumes: every method and `renderVals()` key produced by Tasks 3-13, and every behaviour asserted in `tests/test-manager-dashboard.js`.
- Produces: no new source interfaces. Produces the parity matrix comment block at the top of `tests/test-manager-dc.js`, which Task 15 cites when it deletes the old test file.

**Steps**

- [ ] 1. List every `section(...)` and `check(...)` label in the old test file so nothing is worked from memory:

```
node -e "const t=require('fs').readFileSync('tests/test-manager-dashboard.js','utf8');t.split('\n').forEach((l,i)=>{if(/^\s*(section|check)\(/.test(l))console.log(String(i+1).padStart(4),l.trim().slice(0,150))})"
```

- [ ] 2. Do the same for the three new files, so the two lists can be put side by side:

```
node -e "['tests/test-manager-dc.js','tests/test-manager-dc-score-sheet.js','tests/test-manager-dc-draw.js'].forEach(f=>{console.log('=== '+f);const t=require('fs').readFileSync(f,'utf8');t.split('\n').forEach((l,i)=>{if(/^\s*(section|check)\(/.test(l))console.log(String(i+1).padStart(4),l.trim().slice(0,150))})})"
```

- [ ] 3. Work down the old file's sections and confirm each has a new equivalent. This is the expected mapping — verify it against the real output of steps 1 and 2 rather than trusting the table, and add anything the table misses:

| Old section in `tests/test-manager-dashboard.js` | Proven against `Manager.dc.html` by |
|---|---|
| Age-group scoping (u14b, u16b, organiser fallback) | `test-manager-dc.js` → "Boot and age-group scoping" |
| Live scoring rules loaded at boot | `test-manager-dc.js` → "It is a real component…" plus the `componentDidMount` source check added in step 5 below |
| Today tab | `test-manager-dc.js` → "Today tab" |
| Fixtures tab groups by pool | `test-manager-dc.js` → "Fixtures & scoring tab" |
| Results tab shows only played matches | `test-manager-dc.js` → "Results tab" |
| Tables tab | `test-manager-dc.js` → "Tables tab" |
| Draw tab (Task 1: read-only shell) | `test-manager-dc-draw.js` → "loadDraw(): fetching, loading state, and the empty state" |
| Draw tab (Task 2: tap-to-select editor) | `test-manager-dc-draw.js` → "pickTeam()", "placeTeam()", "Pool CRUD", "Team CRUD" |
| Draw tab (Task 3: slot editor + save/discard/reset) | `test-manager-dc-draw.js` → "Match-slot editor", "Save, discard and regenerate" |
| Draw tab (Task 4: import registered teams) | `test-manager-dc-draw.js` → "Import registered teams" |
| Draw tab (Task 5: knockout builder) | `test-manager-dc-draw.js` → "Knockout builder" |
| Draw tab (Task 5 gap-fix: finals gating) | `test-manager-dc-draw.js` → "Knockout generation is gated on what has actually been played" |
| Draw tab (Task 6: publish / unpublish gating) | `test-manager-dc-draw.js` → "Publish and unpublish" |
| Draw tab (Task 7: clash checker) | `test-manager-dc-draw.js` → "Check the whole weekend" |
| MODERATE 5: clash panel renders failed/unplaced/offAllocation | `test-manager-dc-draw.js` → "Check the whole weekend" (second block) |
| MODERATE 6: publish runs a clash check first | `test-manager-dc-draw.js` → "Publishing warns about pitch clashes, but never blocks" |
| MAJOR 3 / MODERATE 7 / MINOR 8: stale picked/clash/drawMsg/importRows | `test-manager-dc-draw.js` → "Pool CRUD", "Team CRUD", "Transient Draw state does not outlive what it referred to" |
| MODERATE 4: unsaved Draw edits survive a score save | `test-manager-dc-draw.js` → "Transient Draw state…" (last block) |
| MINOR 9: knockout time input width | **No longer applicable** — see step 4 |
| MAJOR 2: reflow classnames for the phone media query | **No longer applicable** — see step 4 |
| Registrations tab | `test-manager-dc.js` → "Registrations tab" |
| Score sheet: Spirit + Cards | `test-manager-dc-score-sheet.js` → "The payload sent to submitResult()" |
| Score sheet: spirit tally on Fixtures | `test-manager-dc.js` → "Spirit of Rugby Award tally on the Fixtures tab" |
| MAJOR 1: Registrations search keeps its state | `test-manager-dc.js` → "Registrations tab" (search block) |

- [ ] 4. Two old assertions are about `Manager.html`'s hand-written stylesheet and cannot be ported as-is. Record the reasoning in the parity matrix comment (step 6) rather than dropping them silently:
  - **MINOR 9** asserted `data-ko-time` inputs are ≥110px wide via a regex over generated HTML. `Manager.dc.html` has no generated HTML string and no `data-ko-time` attribute; the knockout time input is a template element with `width:118px`. Replace the old assertion with a source check in `tests/test-manager-dc.js` (added in step 5) that the knockout time input is at least 110px.
  - **MAJOR 2** asserted `.slotrow`/`.slottime`/`.slotpitch`/`.slotdel`/`.slotsep`/`.slotlabel` classnames exist for an `@media(max-width:560px)` reflow. `Manager.dc.html` uses inline flex with `flex-wrap:wrap` and `min-width:120px` boxes instead of a media query, so the classnames do not exist by design. Replace it with a source check (step 5) that the slot row wraps rather than squeezing.

- [ ] 5. Add this gap-fill section to `tests/test-manager-dc.js`, immediately before `summary(...)`:

```js
section('Parity gap-fills: three old assertions restated for the component build');
{
  const html = readRepo('Manager.dc.html');
  // Old: "Manager.html calls api.loadScoringRules() during boot", proven by
  // driving the module. componentDidMount cannot be driven in Node (it does a
  // dynamic import of scores-data.js), so this is asserted at the source — and
  // the reason it matters is unchanged: without it a manager sees the
  // hardcoded default scoring rules instead of the organiser's live ones.
  check('the component loads the live scoring rules at mount', /loadScoringRules\(\)/.test(html));
  check('…and the venue, before anything renders', /await api\.loadVenue\(\)/.test(html));

  // Old MINOR 9: the knockout time input was 100px and clipped times like
  // "01:0" — genuinely ambiguous between 1am and 1pm on the finals rows.
  const koTimeWidths = (html.match(/type="time"[^>]*width:(\d+)px/g) || []).map((m) => Number(m.match(/width:(\d+)px/)[1]));
  check('every time input is at least 110px wide', koTimeWidths.length > 0 && koTimeWidths.every((w) => w >= 110));

  // Old MAJOR 2: at phone width the fixed-width time/pitch/delete controls
  // squeezed the two team boxes down to ~24px and team names rendered one
  // character per line. This build reflows by wrapping instead of by a media
  // query, so the assertion is that the wrap and the minimum box width exist.
  check('slot rows wrap rather than squeezing at phone width', /flex-wrap:wrap/.test(html));
  check('…and a team box has a sane minimum width', /min-width:120px/.test(html));
}
```

- [ ] 6. Add the parity matrix as a comment block at the very top of `tests/test-manager-dc.js`, under the existing header comment, in this form (fill it in from the real output of steps 1-3, not from memory):

```js
/* PARITY MATRIX — tests/test-manager-dashboard.js (old file) → this rebuild
   ------------------------------------------------------------------------
   Every behaviour the old dashboard's tests proved, and where the same
   behaviour is proven against Manager.dc.html. Written down because the old
   file is deleted with Manager.html in the rollout task, and after that this
   comment is the only record that the swap was not a leap of faith.

     <one line per old section, "old section  ->  new file / new section">

   TWO OLD ASSERTIONS ARE RESTATED RATHER THAN PORTED, both about
   Manager.html's hand-written stylesheet:
     MINOR 9 (knockout time input width)  -> source check, "Parity gap-fills"
     MAJOR 2 (media-query reflow classes) -> source check, "Parity gap-fills"

   ONE BEHAVIOUR DELIBERATELY DIFFERS, and is not a parity failure:
     Manager.html's placeTeam() removed a team from its pool roster when it
     was placed into a match slot or knockout box. pools[].teams is pool
     MEMBERSHIP — computeStandings() reads it directly — so that made teams
     disappear from the public standings. Manager.dc.html keeps the roster,
     matching the corrected behaviour shipped in Scores & Standings.dc.html.
     See tests/test-manager-dc-draw.js, "placeTeam(): moves, and the dedup rule".
*/
```

- [ ] 7. Run everything and record the numbers:

```
node tests/test-manager-dc.js
node tests/test-manager-dc-score-sheet.js
node tests/test-manager-dc-draw.js
powershell tests/runall.ps1
```

Every file passes. Note the new total check count and compare it against the 2,265 baseline: it must be strictly higher, and no previously-passing check may have disappeared. `tests/test-manager-dashboard.js` must still be passing unchanged — `Manager.html` has not been touched by any task in this plan.

- [ ] 8. Run the fault-injection prover so the new assertions are counted in the 228-fault total rather than sitting outside it:

```
powershell tests/runall.ps1
```

(the prover runs at the end of `runall.ps1`). If any newly added check is not exercised by an injected fault, add the fault following the pattern already in `tests/_prove-registration.js`: a source string swap that the check, and only that check, notices.

- [ ] 9. Commit on `dev`:

```
git checkout dev
git add tests/test-manager-dc.js tests/test-manager-dc-draw.js tests/test-manager-dc-score-sheet.js
git commit -F commitmsg.txt   # "Manager rebuild: parity matrix and gap-fill checks against the old dashboard tests"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files`, and on the PC:

```
git fetch origin --prune
git checkout dev
git add tests/test-manager-dc.js tests/test-manager-dc-draw.js tests/test-manager-dc-score-sheet.js
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash
git push origin dev
```

- [ ] 10. Open a PR from `dev` so Netlify builds a free preview, and post the preview URL for the walkthrough in Task 15. Do not merge anything to `main`.

---

## Task 15 — FINAL, HUMAN-GATED: repoint `/manager`, remove the old file, update the docs

Nothing in this task may start until step 1 has an explicit yes. Every earlier task left `Manager.html` and `netlify.toml`'s `/manager` redirect untouched on purpose; this is the only task that changes either.

**Files**
- Modify: `netlify.toml`
- Delete: `Manager.html`
- Delete: `tests/test-manager-dashboard.js`
- Modify: `tests/runall.ps1`
- Modify: `CLAUDE.md`
- Update (in the Claude project, not the repo): `claude/state-of-play.md`, `claude/changelog.md`
- Test: full suite

**Interfaces**
- Consumes: Task 2's `/manager` link inside `Organizer.dc.html` (which keeps working unchanged, because it points at the route rather than the file); Task 14's parity matrix in `tests/test-manager-dc.js`, cited as the reason the old test file can go.
- Produces: `/manager` served by `Manager.dc.html`. No source interfaces change.

**Steps**

- [ ] 1. **CHECKPOINT — stop here and get a yes from Jay, in plain language.** Post this, filling in the real numbers and the real preview URL, and do not touch a single file until he replies:

  > **Before I switch the manager dashboard over — can you check two things?**
  >
  > The manager dashboard has been rebuilt from scratch on the same building blocks the Organiser page and the Scores page already use, so all three now work the same way underneath and look like one site instead of three. Nothing about how you use it has changed: the same six tabs, the same score entry, the same draw editor.
  >
  > **1. The tests.** Every single thing the old dashboard was tested for is now tested against the new one — I went through them one by one and wrote the list down in the code so it can be checked later. All ___ checks pass, plus ___ new ones on top of them. Nothing that used to pass has stopped passing.
  >
  > **2. Your walkthrough.** The new page is live on a preview link, next to the real site, which is still running the old page. Nothing you do on the preview affects anyone. Please open it and try, on the phone you would actually use on the day:
  >
  > - Sign in with your manager account.
  > - Today tab: is the next match right?
  > - Fixtures & scoring: open a match, put a score in, save it. Check it shows in Results and moves the table.
  > - Open that same match again and clear the result. Check the table goes back.
  > - Enter a walk-over on another match, and save.
  > - Draw tab: move a team between pools, add a match slot, change a time, press Save changes.
  > - Registrations: search for a player's name.
  >
  > Preview: `<URL>`
  >
  > **If all of that looks right, say so and I will switch `/manager` over to the new page and delete the old one.** If anything is off, tell me what and I will fix it before switching anything — the live site is untouched until you say go.

  Record his answer. If he reports a problem, fix it in a new commit on `dev` with its own failing-test-first cycle and repeat this checkpoint. Do not proceed on a partial yes.

- [ ] 2. Repoint the route. In `netlify.toml`, this block currently reads:

```toml
[[redirects]]
  from = "/manager"
  to = "/Manager.html"
  status = 200
```

Change the `to` line only:

```toml
[[redirects]]
  from = "/manager"
  to = "/Manager.dc.html"
  status = 200
```

Nothing else in `netlify.toml` changes — not the `/tests/*` 404 rule, not the `sw.js` cache header, not the other five redirects.

- [ ] 3. Delete the old page:

```
git rm Manager.html
```

- [ ] 4. **Delete `tests/test-manager-dashboard.js` too, in the same commit — and here is the decision, stated explicitly rather than left to be discovered.** That file cannot survive `Manager.html`'s deletion: its `extractModuleScript()` does `readRepo('Manager.html')` and regexes `<script type="module">` out of it, so with the file gone it throws `ENOENT` on its first line of work and fails the whole suite. There is no version of it that could be kept — it does not test a behaviour, it drives one specific file's module script. Its coverage is not lost: Task 14's parity matrix records, behaviour by behaviour, where each of its assertions now lives across `tests/test-manager-dc.js`, `tests/test-manager-dc-score-sheet.js` and `tests/test-manager-dc-draw.js`, and those three run in `runall.ps1` alongside everything else.

```
git rm tests/test-manager-dashboard.js
```

- [ ] 5. Remove its entry from the `$tests = @( ... )` list in `tests/runall.ps1` — delete this line:

```powershell
  'test-manager-dashboard.js',
```

A file named in that list but missing from disk prints `MISSING` and fails the run, so this edit is not optional.

- [ ] 6. Update `CLAUDE.md` in two places.

  (a) The route table under "The single most important thing" does not currently mention `/manager` at all. Add a row after the `/organizer` row:

```
| `/manager` | `Manager.dc.html` — the age-group manager dashboard (score entry, draw editor, registrations) |
```

  (b) In the `## Layout` block, add an entry immediately after the `Organizer.dc.html` line:

```
Manager.dc.html            age-group manager dashboard  →  /manager. Rebuilt
                           from the old plain-HTML Manager.html onto the same
                           DC component engine as the pages above, so all four
                           .dc.html pages now work the same way underneath.
                           Reads scores-data.js only — no backend of its own.
```

- [ ] 7. Run the whole suite one final time, with the old file gone:

```
powershell tests/runall.ps1
```

Expect: no `MISSING` line, `test-manager-dashboard.js` absent from the output entirely, and the three `test-manager-dc*.js` files passing. Compare the total against the number quoted in step 1's checkpoint message — it should drop by exactly the old file's check count and no more.

- [ ] 8. Sanity-check that nothing still references the deleted file:

```
grep -rn "Manager.html" --include="*.html" --include="*.js" --include="*.toml" --include="*.md" . | grep -v node_modules
```

The only acceptable hits are historical mentions in `CLAUDE.md` prose. A live `href`, a redirect target or a `readRepo('Manager.html')` is a bug — fix it before committing.

- [ ] 9. Commit on `dev`:

```
git checkout dev
git add netlify.toml tests/runall.ps1 CLAUDE.md
git add -u                      # picks up the two deletions — NEVER `git add -A`
git commit -F commitmsg.txt     # "Serve /manager from Manager.dc.html and retire the old dashboard"
git rev-parse HEAD^{tree}
```

Then `SendUserFile` → `device_commit_files` for `netlify.toml`, `tests/runall.ps1` and `CLAUDE.md`, and on the PC:

```
git fetch origin --prune
git checkout dev
git rm Manager.html tests/test-manager-dashboard.js
git add netlify.toml tests/runall.ps1 CLAUDE.md
git commit -F commitmsg.txt
git write-tree          # must equal the sandbox tree hash
git push origin dev
```

- [ ] 10. Update the two project docs (these live in the Claude project, not the repo — use the Projects tool, `project_read` then `project_write` the full updated text back to the same path):

  (a) `claude/state-of-play.md` — replace whatever it says about the manager dashboard with: `Manager.dc.html` is live on `/manager`, built on the DC component engine like the other three pages; `Manager.html` and `tests/test-manager-dashboard.js` are deleted; parity coverage lives in `tests/test-manager-dc.js`, `tests/test-manager-dc-score-sheet.js` and `tests/test-manager-dc-draw.js`; the parity matrix is the comment block at the top of `tests/test-manager-dc.js`; `Organizer.dc.html`'s header now carries a "View Manager Area" link; the one intentional behaviour change is that placing a team into a match slot or knockout box no longer removes it from its pool roster. Note which branch this is on (`dev`) and whether `main` has it yet.

  (b) `claude/changelog.md` — add a dated entry naming: the Organizer → Manager nav link, the rebuild onto the component engine, the corrected pool-membership behaviour, the route repoint, and the two deletions.

- [ ] 11. **`main` is not touched by this plan.** `dev` now has the whole rebuild. Tell Jay, in these terms:

  > That is all of it, on the `dev` branch, and the preview is running the new page on `/manager`. The real site is still on the old one until we merge.
  >
  > Merging `dev` into `main` is the bit that costs 15 credits, so I have not done it. Say the word and I will show you the full list of changed files and the diff first, then merge on your go-ahead.

  Do not merge, do not push to `main`, and do not open an auto-merging PR against `main` without that explicit yes and a shown diff.

---

## Self-review record

Checked before this plan was handed over:

- **No placeholders.** No `TBD`, no `TODO`, no "similar to Task N", no "add appropriate error handling". Every step carries the actual code or the actual command. The one conditional in the whole plan — `<sc-if>`'s `invert` attribute in Task 12 step 5 — states both options and instructs the implementer to check `support.js` and use exactly one.
- **Interfaces line up across tasks.** Every method and `renderVals()` key a later task consumes is produced by an earlier one and named identically: `openMatch`/`findMatch` (Task 4) are used by `matchRows` (Task 5) and by Tasks 6 and 7; `matchRows` (Task 5) is used by Tasks 6 and 7; `tName` (Task 3) by Tasks 5, 9 and 10; `tShort` (Task 8) by Task 8's own table; `confirmModal`/`promptModal`/`submitModal` (Task 3) by Tasks 4, 9, 10, 11 and 12; `loadDraw`/`clearDrawTransientState` (Task 9) by Tasks 3's replaced `go`/`load`, 10 and 12; `poolCards` (Task 9) is extended, not redefined, by Task 10; `loadRegistrations` (Task 11) by Task 13.
- **No forward references.** `go(tab)` and `load(agId)` are written three times (Tasks 3, 9, 13), each time in full, because each version may only call methods that already exist at that point in the plan. `loadRegistrations()` is produced in Task 11 rather than Task 13 for the same reason — the import panel needs the registration cache first.
- **All six tabs are covered by their own right-sized task:** Today (5), Fixtures & scoring (6), Results (7), Tables (8), Draw (9-12, four tasks), Registrations (13).
- **The score-entry sheet is not folded in silently:** Task 4, its own test file, eleven injected faults.
- **The nav link ships early and independently:** Tasks 1-2, no dependency on the rebuild, verified on a free preview before Task 3 starts.
- **The rollout is staged.** No task before 15 modifies or deletes `Manager.html`, and no task before 15 touches `netlify.toml`. Task 15's first step is a plain-language checkpoint with a named human gate, and it states explicitly what happens to `tests/test-manager-dashboard.js` and why.
- **The one behaviour that intentionally differs from the old file** (pool roster membership on placement) is called out in Task 9's opening paragraph, asserted in Task 9's tests, and recorded in Task 14's parity matrix so it can never be mistaken for a parity failure.








