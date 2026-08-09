/* tests/test-homepage-dates.js
   ---------------------------------------------------------------------------
   The homepage must not disagree with the venue layout about WHEN the
   tournament is, or which day an age group plays.

   WHAT WENT WRONG. Three facts were written out by hand in Quins JRT.dc.html —
   the countdown target, each group's Saturday/Sunday in AGE_GROUP_CARDS, and
   startDate/endDate in the JSON-LD — while /app, /scores and the back office
   all read the same facts from the venue layout, which an organiser can edit in
   the panel. So moving a group between days updated everywhere EXCEPT the
   homepage, silently. The homepage is the page a parent lands on first.

   ⚠️ AND THE FILE ALREADY KNEW. The comment above AGE_GROUP_CARDS says the
   table "has to be edited to match — the test is what catches it", and names a
   test-venue.js that does not exist. A test named in a comment is not a test.

   THREE DIFFERENT MECHANISMS, BECAUSE THE THREE FACTS ARE NOT ALIKE:

     countdown + day split   →  now DERIVED from the layout at runtime, with the
                                written-down values as the fallback.
     JSON-LD startDate       →  CANNOT be derived. It is read by crawlers that
                                do not run JavaScript, which is the whole reason
                                it was moved into the real <head>. So it stays
                                hardcoded and this file PINS it to the default
                                layout instead.

   ⚠️ THE JSON-LD PIN IS THE WEAKER GUARANTEE AND IS LABELLED AS SUCH. It
   catches the dates drifting from DEFAULT_VENUE. It CANNOT catch an organiser
   changing the dates in the back office — nothing static can. If the tournament
   ever moves, the JSON-LD must be edited by hand, and this test is what will
   remind whoever does it.
*/

const path = require('path');
const { section, check, eq, summary, readRepo, repoRoot } = require('./_lib');

const HOME = readRepo('Quins JRT.dc.html');
const { DEFAULT_VENUE } = require(path.join(repoRoot(), 'netlify', 'functions', '_venue.js'));

/* Comments in this file discuss the very strings being searched for — the trap
   that has caught half a dozen checks in this repo. Strip them. */
const CODE = HOME.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

/* ====================================================================== */
section('The countdown target comes from the layout, with a written-down fallback');

check('the fallback target is still present', /this\.target = new Date\('([^']+)'\)/.test(CODE));

{
  const m = CODE.match(/this\.target = new Date\('([^']+)'\)\.getTime\(\)/);
  const hard = m ? m[1] : '';
  /* ⚠️ The hardcoded first-frame value must equal day one of the DEFAULT
     layout, or the countdown shows one date for a moment and then jumps. */
  check('the fallback target is day one of the default layout',
    hard.startsWith(DEFAULT_VENUE.day1.date), `${hard} vs ${DEFAULT_VENUE.day1.date}`);
  check('…at 04:00Z, which is 08:00 in Abu Dhabi', /T04:00:00Z/.test(hard), hard);
}

/* The half that actually fixes the bug: the target is REASSIGNED from the
   fetched layout. Without this the fallback is the only value there is. */
check('⚠️ the target is re-derived from the fetched layout',
  /Date\.parse\(`\$\{venue\.day1\.date\}T04:00:00Z`\)/.test(CODE),
  'without this the countdown is hardcoded again');
check('…and only when the parse succeeded',
  /if \(Number\.isFinite\(t\)\) this\.target = t;/.test(CODE),
  'an unparseable date must leave the fallback standing, not produce NaN');

/* ====================================================================== */
section('The Saturday/Sunday split comes from the layout too');

check('⚠️ the day split asks the layout, not the hardcoded string',
  /this\.dayOfCard\(g\) === 'day1'/.test(CODE) && /this\.dayOfCard\(g\) === 'day2'/.test(CODE),
  "filtering on g.day === 'Saturday' is the bug");
check('…and the old direct filter is gone',
  !/g\.day === 'Saturday'\)\.map/.test(CODE) && !/g\.day === 'Sunday'\)\.map/.test(CODE));

check('dayOfCard prefers the live layout', /const live = this\.state\.liveDayOf/.test(CODE));
check('…and falls back to the written-down day', /return g\.day === 'Sunday' \? 'day2' : 'day1';/.test(CODE));
check('liveDayOf starts null, so the fallback applies before the fetch lands',
  /liveDayOf: null,/.test(CODE));
check('⚠️ it is populated from isDayOne(), the same function /app and /scores use',
  /api\.isDayOne\(g\.age\.toLowerCase\(\)\)/.test(CODE),
  'a second implementation of "which day" is a second thing to drift');

/* ⚠️ A per-card try/catch, so ONE unknown id cannot empty the whole map and
   silently move every group to Saturday. */
check('a failure for one group does not take the rest with it',
  /catch \(e\) \{ \/\* leave it out; the card keeps its written-down day \*\//.test(HOME));

/* ====================================================================== */
section('The written-down table still agrees with the default layout');

{
  /* Even with the runtime fix, the fallback table is what a visitor sees if
     /venue-layout is unreachable — so it has to be right on its own. */
  const cards = [...HOME.matchAll(/\{ age: '([^']+)'[^}]*?day: '([^']+)'/g)]
    .map((m) => ({ id: m[1].toLowerCase(), day: m[2] }));
  check(`the card table was found (${cards.length} groups)`, cards.length === 15, String(cards.length));

  const layoutDay = (id) => {
    if ((DEFAULT_VENUE.day1.groups || {})[id]) return 'Saturday';
    if ((DEFAULT_VENUE.day2.groups || {})[id]) return 'Sunday';
    return null;
  };
  /* ⚠️ CONTROL. If the layout lists none of them, every comparison below is
     null === null and the section passes having checked nothing. */
  check('the default layout lists these age groups',
    cards.filter((c) => layoutDay(c.id)).length === cards.length,
    cards.filter((c) => !layoutDay(c.id)).map((c) => c.id).join(',') || 'all found');

  cards.forEach((c) => {
    eq(`${c.id} is on the same day in both`, c.day, layoutDay(c.id));
  });
}

/* ====================================================================== */
section('⚠️ The JSON-LD dates are pinned — they CANNOT be derived');

{
  /* Structured data is read by crawlers that do not execute JavaScript. That is
     precisely why it lives in the literal <head>, and precisely why it cannot
     be filled in from a fetch. Hardcoded is correct here; unpinned is not. */
  const ld = (HOME.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  check('the JSON-LD block was found', !!ld);
  const data = ld ? JSON.parse(ld) : {};
  check('…and parses as JSON', !!data['@type'], 'a broken block is worse than none — crawlers drop it silently');

  eq('startDate matches day one of the default layout', data.startDate, DEFAULT_VENUE.day1.date);
  eq('endDate matches day two', data.endDate, DEFAULT_VENUE.day2.date);

  /* ⚠️ AND THIS IS THE LIMIT OF WHAT IT PROVES. It cannot see the back office.
     If the tournament moves, the JSON-LD needs a human edit — this check is
     what makes that impossible to forget, not a substitute for it. */
  check('the file says the JSON-LD is deliberately static',
    /CANNOT be derived|do not run JavaScript|not execute JavaScript/i.test(HOME),
    'the reason it is hardcoded has to be written where somebody will find it');
}

summary('test-homepage-dates.js');
