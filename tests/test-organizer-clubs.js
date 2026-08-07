/* tests/test-organizer-clubs.js
   ------------------------------------------------------------------------
   The Clubs tab on /organizer (Aug 2026) — club declarations reconciled
   against the teams that actually registered.

   THE TAB ANSWERS ONE QUESTION AND EVERYTHING HERE SERVES IT:

       WHO SAID THEY WOULD SEND THREE AND HAS ONLY SENT TWO?

   ⚠️ THE JOIN IS ON FREE TEXT TYPED BY TWO DIFFERENT PEOPLE, MONTHS APART.
   A club contact types the club name once, on the declaration. A coach types
   it again on every team registration. There is no club id anywhere in the
   system to join on. So the reconciliation normalises both sides — and a
   normaliser is the kind of code that is quietly wrong for a year, because
   its failures look like ordinary numbers rather than errors.

   That is why the normalisation is driven against real name pairs BOTH ways
   here: names that must MEET ("Dubai Exiles" / "dubai exiles rfc") and names
   that must NOT ("RC Sharks" must not become "Sharks"). A normaliser that is
   too eager merges two clubs into one and reports a number that is wrong and
   plausible — strictly worse than one that fails to match, which shows up as
   "registered but never declared" and is visible.

   The behaviour checks DRIVE the real component out of Organizer.dc.html
   (same pattern as test-organizer-tournament.js) rather than grepping the
   source: a source check cannot see a loop that stops at the first age group,
   a total that double-counts, or a filter that hides the wrong rows.

   ⚠️ Every fixture here is invented. Never build one from real data — this
   tab reads a sheet holding club contact names, emails and phone numbers.
*/

const { readRepo, section, check, eq, summary } = require('./_lib');

class DCLogic {
  setState(patch, cb) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    if (typeof cb === 'function') cb();
  }
}

/* Returns the component AND the two pure functions, so the normaliser can be
   driven directly instead of only through a rendered table. Both live inside
   the page's x-dc closure — there is no build step and no module to import. */
function load() {
  const t = readRepo('Organizer.dc.html');
  const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no x-dc script found in Organizer.dc.html');
  // eslint-disable-next-line no-new-func
  return new Function('DCLogic', 'window', 'document',
    m[1] + '\n;return { Component, normaliseClubName, reconcileClubs, MANAGER_AGE_GROUPS };')(
    DCLogic,
    { addEventListener() {} },
    { addEventListener() {}, body: { style: {} }, baseURI: 'https://adhjrt.com/', getElementById: () => null }
  );
}

const M = load();

function build(state) {
  const c = new M.Component();
  c.props = {};
  c.state = { ...c.state, ...(state || {}) };
  return c;
}
/* renderVals() is what the markup actually sees. Driving THAT rather than
   clubVals() directly is deliberate: a value computed correctly and then not
   returned is the single most common way this page breaks, and it is
   invisible to any check that calls the helper by hand. */
const vals = (state) => build(state).renderVals();

/* A declaration row in the shape mapClubRow() produces. */
const decl = (club, counts, extra) => ({
  submittedAt: '2026-08-01T09:00:00.000Z',
  club,
  contactName: 'A Person', contactEmail: 'a@b.com', contactPhone: '971500000000',
  notes: '',
  ...(counts || {}),
  ...(extra || {}),
});
/* A team row in the shape mapTeamRow() produces — only the two fields the
   reconciliation reads. */
const team = (club, ageGroup) => ({ club, ageGroup });

async function main() {

section('The normaliser — names that MUST meet');
{
  const n = M.normaliseClubName;
  const same = (a, b) => check(`"${a}" and "${b}" are the same club`, n(a) === n(b), `${n(a)} vs ${n(b)}`);
  same('Dubai Exiles', 'dubai exiles');
  same('Dubai Exiles', '  Dubai   Exiles  ');
  same('Dubai Exiles', 'Dubai Exiles RFC');
  same('Dubai Exiles', 'Dubai Exiles rufc');
  same('Dubai Exiles', 'Dubai Exiles Rugby Club');
  same('Dubai Exiles', 'Dubai Exiles Rugby Football Club');
  same('Abu Dhabi Harlequins', 'Abu-Dhabi Harlequins');
  same("St George's", 'St Georges');
  /* Punctuation becomes a SPACE, not nothing — otherwise "St.Georges" collapses
     to one word while "St Georges" stays two, and they stop matching. */
  same('St.Georges', 'St Georges');
  same('Genève Rugby', 'Geneve Rugby');
}

section('The normaliser — names that MUST NOT meet');
{
  const n = M.normaliseClubName;
  const diff = (a, b) => check(`"${a}" and "${b}" stay different clubs`, n(a) !== n(b), `both became "${n(a)}"`);
  /* ⚠️ THE EAGER-NORMALISER TRAP. A blanket strip of "rc"/"fc" anywhere would
     turn "RC Sharks" into "Sharks" and merge two real clubs into one — a wrong
     number that looks completely plausible. The suffix rule is anchored to the
     END of the name for exactly this reason. */
  diff('RC Sharks', 'Sharks');
  diff('Al Ain FC Juniors', 'Al Ain Juniors');
  diff('Dubai Exiles', 'Dubai Hurricanes');
  diff('Abu Dhabi Harlequins', 'Abu Dhabi Saracens');
  /* Two different clubs that merely share a word must not collapse. */
  diff('Dubai Sharks', 'Sharks');

  /* Stripped at most once — "Exiles RFC RFC" is not a real club, but the rule
     must be bounded rather than looping a name down to nothing. */
  check('the suffix strip does not run away', M.normaliseClubName('Rugby Club') !== '');

  /* Empty and rubbish inputs must not throw — both sheets are free text. */
  eq('a missing name normalises to empty, not a crash', M.normaliseClubName(undefined), '');
  eq('…and null too', M.normaliseClubName(null), '');
}

section('Declared vs registered, per age group');
{
  const clubs = [decl('Dubai Exiles', { u12: '3', u16b: '1' })];
  const teams = [
    team('Dubai Exiles', 'U12 Mixed Contact'),
    team('dubai exiles rfc', 'U12 Mixed Contact'),
    team('Dubai Exiles', 'U16B Contact'),
  ];
  const v = vals({ tab: 'clubs', clubs, teams });
  eq('one club row', v.clubRows.length, 1);
  const r = v.clubRows[0];
  eq('declared total is the sum of the boxes', r.declaredTotal, 4);
  /* ⚠️ Counted across NAME VARIANTS. If the normaliser were bypassed this would
     read 2, and 2 is a believable number — which is the whole danger. */
  eq('registered total counts every name variant', r.registeredTotal, 3);
  eq('…and it is flagged Short', r.statusLabel, 'Short');

  const u12 = r.groups.find((g) => g.name === 'U12 Mixed Contact');
  eq('U12 declared', u12.declared, 3);
  eq('U12 registered', u12.registered, 2);
  const u16 = r.groups.find((g) => g.name === 'U16B Contact');
  eq('U16B declared', u16.declared, 1);
  eq('U16B registered', u16.registered, 1);
  check('the matching group is not flagged', !/rgba\(166,38,38/.test(u16.rowStyle));
  check('the mismatching group is flagged', /rgba\(166,38,38/.test(u12.rowStyle));

  /* Fifteen rows of "0 / 0" per club is noise, and the expandable row is only
     useful if what it opens is short enough to read. */
  eq('only age groups with something in them are listed', r.groups.length, 2);
}

section('Short, Over and On track');
{
  const clubs = [
    decl('Short Club', { u12: '3' }),
    decl('Over Club', { u12: '1' }),
    decl('Exact Club', { u12: '2' }),
  ];
  const teams = [
    team('Short Club', 'U12 Mixed Contact'),
    team('Over Club', 'U12 Mixed Contact'), team('Over Club', 'U12 Mixed Contact'),
    team('Exact Club', 'U12 Mixed Contact'), team('Exact Club', 'U12 Mixed Contact'),
  ];
  const v = vals({ tab: 'clubs', clubs, teams });
  const by = Object.fromEntries(v.clubRows.map((r) => [r.club, r]));
  eq('a club that sent fewer than it said reads Short', by['Short Club'].statusLabel, 'Short');
  /* Jay, 4 Aug: over-registering flags too. More teams than planned still
     changes pools, pitches and the draw — a "nice problem" is still a problem
     the draw has to absorb. */
  eq('a club that sent MORE than it said reads Over', by['Over Club'].statusLabel, 'Over');
  eq('a club that matches reads On track', by['Exact Club'].statusLabel, 'On track');
  check('On track is green, not red', /0E6B33/.test(by['Exact Club'].statusStyle));
  check('Short is red', /A62626/.test(by['Short Club'].statusStyle));
  check('Over is red too', /A62626/.test(by['Over Club'].statusStyle));

  eq('the tab button counts only the clubs worth chasing', v.flaggedClubCount, 2);
  check('…and only shows the count when there is something to chase', v.hasFlaggedClubs === true);
}

section('Right totals, wrong totals');
{
  const clubs = [decl('A', { u12: '2' }), decl('B', { u12: '1', u14b: '2' })];
  const teams = [team('A', 'U12 Mixed Contact'), team('B', 'U14B Contact')];
  const v = vals({ tab: 'clubs', clubs, teams });
  eq('clubs declared', v.clubsDeclaredCount, 2);
  eq('teams declared, summed across every club and group', v.clubsDeclaredTeams, 5);
  eq('teams registered', v.clubsRegisteredTeams, 2);
}

section('⚠️ Registered but never declared');
{
  /* Half the answer, not a leftover. A club that registers without declaring is
     invisible to a declared-clubs-only view — AND this is where a club whose
     name failed to normalise lands, so a bad match shows up as an odd row
     rather than as a club that silently under-registered. */
  const clubs = [decl('Dubai Exiles', { u12: '1' })];
  const teams = [
    team('Dubai Exiles', 'U12 Mixed Contact'),
    team('Al Ain Amblers', 'U14B Contact'),
    team('Al Ain Amblers', 'U16B Contact'),
  ];
  const v = vals({ tab: 'clubs', clubs, teams });
  eq('the undeclared club is surfaced', v.clubsUnmatched.length, 1);
  eq('…by name', v.clubsUnmatched[0].club, 'Al Ain Amblers');
  eq('…with its team count', v.clubsUnmatched[0].registeredTotal, 2);
  check('…and the panel is shown', v.hasClubsUnmatched === true);
  /* It must NOT be quietly folded into a declared club's numbers. */
  eq('the declared club is unaffected', v.clubRows[0].registeredTotal, 1);
  /* An undeclared club is something to chase too. */
  eq('undeclared clubs count towards the chase list', v.flaggedClubCount, 1);
}

section('The age-group join goes through the one list');
{
  /* ⚠️ The teams sheet stores the age group by DISPLAY NAME ("U16B Contact");
     a declaration stores counts by ID ("u16b"). Joined through
     MANAGER_AGE_GROUPS rather than a second hardcoded mapping. Swept over ALL
     FIFTEEN, because a mapping that covers the head of the list and not the
     tail is the exact shape of the club-count bug this project already had. */
  M.MANAGER_AGE_GROUPS.forEach((g) => {
    const v = vals({
      tab: 'clubs',
      clubs: [decl('C', { [g.id]: '1' })],
      teams: [team('C', g.name)],
    });
    const row = v.clubRows[0];
    eq(`${g.name} reconciles to itself`, row.statusLabel, 'On track');
    eq(`…and lands in the right group row`, (row.groups[0] || {}).registered, 1);
  });

  /* An age group nobody recognises must still count towards the club's total —
     a team that exists is a team that exists, and dropping it would make a club
     look short for a reason nobody could see. */
  const v = vals({
    tab: 'clubs',
    clubs: [decl('C', { u12: '1' })],
    teams: [team('C', 'U99 Nonsense'), team('C', 'U12 Mixed Contact')],
  });
  eq('an unknown age group still counts in the club total', v.clubRows[0].registeredTotal, 2);
  eq('…and reads as Over rather than vanishing', v.clubRows[0].statusLabel, 'Over');
}

section('Blank, zero and rubbish in the declaration boxes');
{
  /* The club form says "leave a group blank if you are not entering it", so
     blank and "0" are the same declaration. Neither may become NaN in a total. */
  const v = vals({
    tab: 'clubs',
    clubs: [decl('C', { u12: '', u13: '0', u14b: 'abc', u16b: '2' })],
    teams: [],
  });
  const r = v.clubRows[0];
  eq('blank, zero and rubbish all count as none declared', r.declaredTotal, 2);
  check('…and the total is a real number', Number.isFinite(r.declaredTotal));
  eq('…and empty groups are not listed', r.groups.length, 1);
}

section('Three states, not two');
{
  /* ⚠️ "Still loading", "the sheet is unreadable" and "nobody has declared yet"
     are different sentences. Showing the last for either of the first two is
     the loading-vs-empty bug this codebase has been bitten by three times —
     most recently the light-mode audit that passed against blank pages. */
  const loading = vals({ tab: 'clubs', clubs: [], teams: [], dataLoading: true });
  check('while loading, it does not claim nobody has declared', loading.clubsEmpty === false);

  const broken = vals({ tab: 'clubs', clubs: [], teams: [], clubsUnavailable: true });
  check('an unreadable sheet says so', broken.clubsUnavailable === true);
  check('…and does not also claim nobody has declared', broken.clubsEmpty === false);
  check('…and shows no table', broken.clubsHaveRows === false);

  const empty = vals({ tab: 'clubs', clubs: [], teams: [] });
  check('genuinely empty says nobody has declared', empty.clubsEmpty === true);

  const full = vals({ tab: 'clubs', clubs: [decl('C', { u12: '1' })], teams: [] });
  check('with declarations, the table shows', full.clubsHaveRows === true);
  check('…and the empty message does not', full.clubsEmpty === false);
}

section('The chase-list filter');
{
  const clubs = [decl('Short Club', { u12: '3' }), decl('Exact Club', { u12: '1' })];
  const teams = [team('Exact Club', 'U12 Mixed Contact')];

  const off = vals({ tab: 'clubs', clubs, teams });
  eq('off by default, every club shows', off.clubRows.length, 2);
  check('…and the button offers to narrow', /Show only/.test(off.clubsFilterLabel));

  const on = vals({ tab: 'clubs', clubs, teams, clubsOnlyFlagged: true });
  eq('on, only the clubs to chase show', on.clubRows.length, 1);
  eq('…and it is the right one', on.clubRows[0].club, 'Short Club');
  check('…and the button says it is filtering', /Showing only/.test(on.clubsFilterLabel));
  /* A filtered view that hides everything must not read as "nothing declared" —
     that sentence would be a lie with two declarations on file. */
  const allGood = vals({
    tab: 'clubs', clubsOnlyFlagged: true,
    clubs: [decl('Exact Club', { u12: '1' })],
    teams: [team('Exact Club', 'U12 Mixed Contact')],
  });
  check('a filter that hides everything says so in its own words', allGood.clubsNoneFlagged === true);
  check('…and does NOT claim nobody has declared', allGood.clubsEmpty === false);
}

section('Expanding a club');
{
  const clubs = [decl('A', { u12: '1' }), decl('B', { u12: '1' })];
  const c = build({ tab: 'clubs', clubs, teams: [] });
  let v = c.renderVals();
  check('nothing is expanded to start with', v.clubRows.every((r) => !r.expanded));
  v.clubRows[0].onToggle();
  v = c.renderVals();
  check('clicking opens that club', v.clubRows[0].expanded === true);
  check('…and only that club', v.clubRows[1].expanded === false);
  check('…and the label flips', /Hide/.test(v.clubRows[0].toggleLabel));
  v.clubRows[0].onToggle();
  v = c.renderVals();
  check('clicking again closes it', c.renderVals().clubRows[0].expanded === false);
}

section('The tab exists and is wired');
{
  const src = readRepo('Organizer.dc.html');
  check('there is a Clubs tab button', /showClubs \}\}" style="\{\{ tabClubsStyle \}\}">Clubs/.test(src));
  const c = build({});
  c.renderVals().showClubs();
  eq('clicking it selects the clubs tab', c.state.tab, 'clubs');
  check('the tab panel is gated on isClubs', /<sc-if value="\{\{ isClubs \}\}"/.test(src));
}

section('The tab bar is grouped, in Jay’s order');
{
  /* ⚠️ NOTHING GUARDED TAB ORDER UNTIL 7 AUG 2026. The check above it —
     "there is a Clubs tab button" — matches wherever that button sits, so it
     survives any reorder and cannot catch one. The bar was regrouped at Jay's
     request into three labelled blocks, and without this the next edit to that
     markup silently puts it back with nobody the wiser.

     ⚠️ THE ORDER IS ASSERTED BY POSITION, NOT BY PRESENCE. "All seven buttons
     exist" passes against the old flat row, i.e. against the very thing this
     replaced. What is asserted is the INDEX of each button's handler in the
     source, which is the only thing that changes when somebody shuffles them. */
  const src = readRepo('Organizer.dc.html');

  /* The tab bar only — sliced so a handler named again further down the file
     (a panel's own button, say) cannot satisfy a position check up here. */
  const barStart = src.indexOf('<!-- tabs');
  const barEnd = src.indexOf('<!-- 30 Jul:', barStart);
  check('the tab bar was found', barStart > -1 && barEnd > barStart);

  /* ⚠️ COMMENTS STRIPPED BEFORE ANY OF THIS IS COUNTED, AND THAT IS NOT
     housekeeping — it was caught by this very check on its first run. The
     block comment above the bar EXPLAINS the separator and therefore contains
     the string "align-self:stretch", so counting the rules found THREE where
     the markup has two. This repo documents the traps it avoids, which makes
     every absence-or-count check on its source vulnerable to matching its own
     warning. Written down here for the fourth time; hit anyway. */
  const bar = src.slice(barStart, barEnd).replace(/<!--[\s\S]*?-->/g, '');

  const ORDER = ['showClubs', 'showTeams', 'showPlayers',
                 'showTournament', 'showVenue', 'showRegistration', 'showDocuments',
                 'showAccounts'];

  const at = (h) => bar.indexOf('onClick="{{ ' + h + ' }}"');
  ORDER.forEach((h) => check('the bar carries ' + h, at(h) > -1));

  /* Strictly increasing positions === exactly this order. A pairwise sweep,
     not a spot check on the first and last — a swap in the middle passes
     "Clubs is first and Accounts is last" perfectly. */
  let ordered = true;
  for (let i = 1; i < ORDER.length; i++) if (at(ORDER[i]) < at(ORDER[i - 1])) ordered = false;
  check('the seven tabs are in Jay’s order, left to right', ordered,
    ORDER.map((h) => h + '@' + at(h)).join(' '));

  /* ⚠️ THE COUNT IS ASSERTED TOO. A ninth tab added without a decision about
     which group it belongs to would slot in anywhere and pass the order sweep,
     because the sweep only knows about the ones it names. Same lesson as the
     age-group picker: when a rule is "everywhere X appears", write the COUNT
     into the check.

     ⚠️ IT WENT 7 -> 8 ON 7 AUG 2026 WHEN DOCUMENTS LANDED, AND THAT IS THE
     CHECK WORKING RATHER THAN AN OBSTACLE. The number moved in the same
     commit as the tab, with the new handler added to ORDER above. If you are
     reading this because the check just failed: only change the number if
     you have ALSO added the handler to ORDER. Changing it on its own deletes
     the only thing guarding tab order and leaves a check that still looks
     like coverage. */
  const buttons = (bar.match(/onClick="\{\{ show/g) || []).length;
  eq('there are exactly eight tabs', buttons, 8);

  /* The three group labels, each read as its own claim. "A label exists"
     would pass on a bar that had lost two of them. */
  ['Registrations', 'Tournament configuration', 'Site admin'].forEach((label) => {
    check('the group label "' + label + '" is on the bar',
      bar.indexOf('>' + label + '</div>') > -1);
  });

  /* Two separators, three groups. Asserted because a missing rule is exactly
     the kind of thing that looks fine on a wide screen and reads as one long
     undifferentiated row on a laptop. */
  const seps = (bar.match(/align-self:stretch/g) || []).length;
  eq('there are two break marks between the three groups', seps, 2);

  /* ⚠️ CLUBS IS LEFTMOST AND TEAMS IS STILL THE DEFAULT — asserted from BOTH
     ends, because "Clubs is first" and "Clubs opens" are different claims and
     somebody tidying one into the other is the predictable next change. */
  eq('the default tab is still Teams', build({}).state.tab, 'teams');
}

section('The declarations reach the page at all');
{
  /* The three halves that have to agree, asserted where they can be READ
     rather than trusted: the function returns clubs, the data layer passes
     them through, and loadData stores them. */
  const fn = readRepo('netlify/functions/get-registrations.js');
  check('the function reads the clubs sheet', /GOOGLE_SHEET_ID_CLUBS/.test(fn));
  check('…through the shared range and mapper, not a hand-written copy',
    /CLUB_RANGE/.test(fn) && /mapClubRow/.test(fn));
  check('…and returns them', /clubs:/.test(fn));
  /* ⚠️ FAILS SOFT, alone among the three sheets. Club declarations are a
     planning nicety; teams and players are the tournament. A missing or
     unshared clubs sheet must not cost an organiser their Teams table. */
  check('an unreadable clubs sheet does not take Teams and Players with it',
    /clubsUnavailable/.test(fn) && /return null;/.test(fn));

  const data = readRepo('organizer-data.js');
  check('the data layer passes clubs through', /clubs: r\.json\.clubs \|\| \[\]/.test(data));
  check('…and defaults them, so an older deployed function cannot crash the tab',
    /clubs: \[\]/.test(data));

  const page = readRepo('Organizer.dc.html');
  check('loadData stores the declarations', /clubs: data\.clubs \|\| \[\]/.test(page));
  check('…and the unavailable flag with them', /clubsUnavailable: !!data\.clubsUnavailable/.test(page));
}

section('Nothing here invents a second copy of anything');
{
  const src = readRepo('Organizer.dc.html');
  /* The age-group list, the ids and the display names all come from
     MANAGER_AGE_GROUPS. A second list would drift, and drift here means a
     club's teams landing under no age group at all. */
  /* Bounded to the function's OWN body — a fixed character slice ran past the
     closing brace into unrelated code and reported a hardcoded id that was not
     there. A check that reads more than its subject is a check about something
     else. */
  const recStart = src.indexOf('function reconcileClubs');
  /* Comments stripped: the explanatory comment quotes "u16b" by name to
     describe the id-vs-display-name join, and a comment about an id is not a
     hardcoded id. Same house rule the wordmark checks hit. */
  const recBody = src.slice(recStart, src.indexOf('\n}', recStart))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  check('the reconciliation reads MANAGER_AGE_GROUPS', /MANAGER_AGE_GROUPS/.test(recBody));
  check('…and does not hardcode age-group ids of its own',
    !/['"]u12g['"]/.test(recBody) && !/['"]u16b['"]/.test(recBody));
}

summary('test-organizer-clubs.js');
}

main().catch((e) => { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
