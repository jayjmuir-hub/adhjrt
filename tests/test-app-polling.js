/* tests/test-app-polling.js
   ---------------------------------------------------------------------------
   /app's two timers must do nothing while the page is hidden, and must catch
   up the moment it comes back.

   WHAT WENT WRONG. The match-day app ran a 1-second clock and a 60-second
   API poll with no visibilitychange gate at all (measured: 0 occurrences).
   A PWA installed on a phone and left in a pocket went on requesting fixtures
   and standings every minute, all weekend. Browsers throttle background
   timers; they do not stop them, so this was real requests.

   ⚠️ AND THE OBVIOUS FIX IS WORSE THAN THE BUG. Gating the poll on
   document.hidden and stopping there means a manager who unlocks their phone
   at a pitch reads scores up to a minute stale — where the ungated poll had
   been keeping them fresh. Skipping work while nobody is looking is only safe
   if looking again refreshes IMMEDIATELY. That is why the catch-up has as many
   checks here as the gate does.

   ⚠️ THIS FILE DRIVES THE SHIPPED CALLBACKS, IT DOES NOT GREP THEM. The three
   callback bodies are cut out of app.html and executed with stubs, so the
   assertions are about what gets CALLED, not about which words appear in the
   source. A reformat cannot break these; a real regression cannot pass them.
   That is the lesson from test-google-auth.js, which had 34 of its 40 checks
   as regexes over source on the highest-security surface in the repo.

   ⚠️ COMMENTS ARE STRIPPED BEFORE ANYTHING IS EXTRACTED, AND THAT IS
   LOAD-BEARING. app.html's own comment above these timers contains the words
   setInterval and clearInterval, explaining why the gate is inside the
   callback rather than starting and stopping the intervals. An extractor that
   did not strip comments would find the prose first and drive nothing. This
   is the ninth time in this repo that a comment mentioning a string has been
   indistinguishable from the string.
*/

const { section, check, eq, summary, readRepo } = require('./_lib');

const APP = readRepo('app.html');

/* Strip block comments, and line comments only where they start a line — a
   bare //-strip would eat the second half of every https:// in the file. */
const CODE = APP
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

/* ---------------------------------------------------------------------------
   Cutting a callback body out of the source.

   Naive brace counting is enough here and deliberately so: these three bodies
   are four lines of plain control flow between them, with no object literals,
   no template strings and no braces inside quotes. If that ever stops being
   true, this stops finding them and the "was found" checks below go red —
   which is the correct failure, not a silent one. */
function bodyAt(src, openBrace) {
  let depth = 0;
  for (let i = openBrace; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return { body: src.slice(openBrace + 1, i), end: i };
    }
  }
  return null;
}

/* Every setInterval in the file, as { delay, body }. */
function intervals(src) {
  const out = [];
  const re = /setInterval\(\s*\(\s*\)\s*=>\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const cut = bodyAt(src, src.indexOf('{', m.index + m[0].length - 1));
    if (!cut) continue;
    const tail = src.slice(cut.end + 1, cut.end + 24);
    const delay = (tail.match(/^\s*,\s*(\d+)/) || [])[1];
    out.push({ delay: Number(delay), body: cut.body });
  }
  return out;
}

function listenerBody(src, event) {
  const i = src.indexOf(`addEventListener('${event}'`);
  if (i < 0) return null;
  const brace = src.indexOf('{', i);
  const cut = brace < 0 ? null : bodyAt(src, brace);
  return cut ? cut.body : null;
}

/* ---------------------------------------------------------------------------
   The stub world each body runs in. Everything it can reach is recorded. */
function drive(body, { hidden, phase, sheetOpen }) {
  const calls = { refresh: 0, render: 0, tick: 0, tickCountdown: 0 };
  const fn = new Function(
    'document', 'phase', 'sheetOpen', 'refresh', 'render', 'tickCountdown', 'tick', 'S', 'lastPhase',
    body
  );
  fn(
    { hidden },
    () => phase,
    () => sheetOpen,
    () => { calls.refresh++; },
    () => { calls.render++; },
    () => { calls.tickCountdown++; },
    () => { calls.tick++; return false; },
    { view: 'today' },
    phase
  );
  return calls;
}

const TIMERS = intervals(CODE);
const POLL = TIMERS.find((t) => t.delay === 60000) || { body: '' };
const CLOCK = TIMERS.find((t) => t.delay === 1000) || { body: '' };
const VIS = listenerBody(CODE, 'visibilitychange');

/* ====================================================================== */
section('The callbacks were found at all');

/* ⚠️ Without these three, every behavioural check below is driving an empty
   string — which calls nothing, which looks exactly like a perfect gate. */
check('the 60-second poll was found', POLL.body.trim().length > 0);
check('the 1-second clock was found', CLOCK.body.trim().length > 0);
check('⚠️ the visibilitychange handler was found', !!VIS && VIS.trim().length > 0,
  'no handler means no catch-up, which makes the gate worse than no gate');
eq('there are exactly two timers, so a third cannot arrive ungated', TIMERS.length, 2);

/* ====================================================================== */
section('The 60-second poll makes no request while the page is hidden');

eq('hidden, mid-tournament: no request goes out',
  drive(POLL.body, { hidden: true, phase: 'during', sheetOpen: false }).refresh, 0);

/* ⚠️ CONTROL. Without it, "no request while hidden" passes just as well
   against a poll that has been deleted outright. */
eq('visible, mid-tournament: it still polls',
  drive(POLL.body, { hidden: false, phase: 'during', sheetOpen: false }).refresh, 1);

eq('visible but before kick-off: nothing to poll for',
  drive(POLL.body, { hidden: false, phase: 'before', sheetOpen: false }).refresh, 0);
eq('visible, but a score is being typed: the sheet is left alone',
  drive(POLL.body, { hidden: false, phase: 'during', sheetOpen: true }).refresh, 0);

/* ====================================================================== */
section('The 1-second clock does no work while the page is hidden');

eq('hidden: the clock does nothing',
  drive(CLOCK.body, { hidden: true, phase: 'before', sheetOpen: false }).tick, 0);
/* CONTROL, same argument as above. */
eq('visible: the clock still ticks',
  drive(CLOCK.body, { hidden: false, phase: 'before', sheetOpen: false }).tick, 1);

/* ====================================================================== */
section('⚠️ Coming back catches up immediately — the half that makes the gate safe');

{
  const back = drive(VIS || '', { hidden: false, phase: 'during', sheetOpen: false });
  /* THE HEADLINE. A manager unlocking their phone at a pitch must not read a
     minute-old score because we saved a request while they were not looking. */
  eq('⚠️ becoming visible mid-tournament refreshes at once', back.refresh, 1);
  eq('…and the clock is caught up in the same breath', back.tick, 1);
}

{
  /* The event fires on BOTH transitions. Without the early return this runs a
     fetch at the exact moment the page is being backgrounded — the opposite of
     the point, and invisible because it succeeds. */
  const away = drive(VIS || '', { hidden: true, phase: 'during', sheetOpen: false });
  eq('⚠️ the HIDE half of the event does nothing', away.refresh + away.tick, 0);
}

{
  /* A sheet can be open across a hide: open score entry, take a call, come
     back. Refreshing under a half-typed score is exactly what the 60-second
     poll already refuses to do, and the catch-up must refuse it too. */
  const typing = drive(VIS || '', { hidden: false, phase: 'during', sheetOpen: true });
  eq('⚠️ coming back does not refresh under an open sheet', typing.refresh, 0);
  eq('…but the clock is still caught up', typing.tick, 1);
}

{
  const early = drive(VIS || '', { hidden: false, phase: 'before', sheetOpen: false });
  eq('coming back before kick-off does not poll', early.refresh, 0);
  eq('…and still catches the clock up', early.tick, 1);
}

/* ====================================================================== */
section('The gate is inside the callbacks, not a start/stop on visibility');

/* ⚠️ WHY THIS IS A RULE AND NOT A STYLE PREFERENCE. Stopping and restarting
   the intervals means holding handles, and one missed clear leaves a SECOND
   interval running: two poll loops, twice the requests, and nothing on screen
   that looks wrong. A document.hidden test cannot leak however many times
   visibility flips.

   Read from CODE, i.e. comments stripped — app.html's own comment says the
   word clearInterval while explaining why it does not use it. */
check('no interval is ever cleared', !/clearInterval/.test(CODE),
  'a missed clear leaves a second poll loop running, silently');

summary('test-app-polling.js');
