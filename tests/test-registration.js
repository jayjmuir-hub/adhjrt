/* tests/test-registration.js
   ------------------------------------------------------------------------
   The registration window: registrationState(), validateSettings(), and the
   promise that the front end and the back end are running the SAME code.

   WHAT THIS FILE IS ACTUALLY GUARDING. The function under test decides whether
   a registration form is open. Getting it wrong in one direction is a phone
   call; getting it wrong in the other is a submission nobody expected, arriving
   after the draw is built, with no age check behind it. So the boundaries are
   tested to the millisecond, and every ambiguous input is asserted to fail
   CLOSED.

   Every assertion here was proven against a deliberately injected fault before
   it was trusted — `node _prove-registration.js` reproduces the lot. That rule
   exists on this project because it has already shipped two tests that passed
   with the real code deleted and a third that matched a comment instead of the
   code. The full fault list, including three assertions that were WRONG when
   first written, is at the bottom of this file.
*/

const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

/* Loaded inside a try, so a module that cannot even be parsed is REPORTED
   rather than crashing the run. A suite that dies on its own require tells you
   only that something is wrong; this one names it, which is what lets the
   fault-injection script confirm the RIGHT thing was named. */
let R = null, loadError = null;
try {
  R = require(path.join(repoRoot(), 'netlify', 'functions', '_registration.js'));
} catch (e) {
  loadError = e;
}

section('The module loads');
check('the registration module loads at all', !!R, loadError && loadError.message);
if (!R) summary('test-registration.js');

const {
  registrationState, validateSettings, registrationWarnings,
  stampFromDate, dateOfStamp, fmtWindowDate, mergeSettings,
  DEFAULT_REGISTRATION, REGISTRATION_MODES,
} = R;

['registrationState', 'validateSettings', 'registrationWarnings', 'stampFromDate',
  'dateOfStamp', 'fmtWindowDate', 'mergeSettings', 'loadRegistration', 'isRealDate',
  'registrationCopy', 'fmtCountdown'].forEach((n) =>
  check(`the module exports ${n}`, typeof R[n] === 'function'));

/* Fixed instants, written as Abu Dhabi stamps so the numbers in this file read
   the same way the stored settings do. Nothing here uses the machine's clock or
   timezone: the suite has to give the same answer on a laptop set to UTC and on
   one set to Gulf Standard Time, which is the entire point of the +04:00 in the
   stored values — and there is a section below that proves it across five. */
const OPENS  = '2026-10-08T00:00:00+04:00';   // Thu 8 Oct 2026, 00:00 Abu Dhabi
const CLOSES = '2026-11-01T23:59:59+04:00';   // Sun 1 Nov 2026, 23:59:59 Abu Dhabi
const OPEN_MS  = Date.parse(OPENS);
const CLOSE_MS = Date.parse(CLOSES);

const W = (over) => ({ opensAt: OPENS, closesAt: CLOSES, mode: 'auto', ...(over || {}) });

/* ====================================================================== */
section('The shared block is genuinely shared');

{
  const S = '/* ===== REGISTRATION WINDOW — SHARED BLOCK (start) =====';
  const E = '/* ===== REGISTRATION WINDOW — SHARED BLOCK (end) ===== */';
  /* CRLF -> LF before comparing. NOT a softening of the check: git stores both
     files LF-normalised, so the line endings in a working copy are a checkout
     artefact of `core.autocrlf`, not drift in the code. Without this the check
     fails on Windows the moment one of the two files is written by anything
     other than git — which is exactly what happened on 27 Jul 2026, when a file
     arriving over the device bridge with LF endings sat next to a sibling git
     had checked out with CRLF and the two "differed" by one character per line.
     Every real difference still shows. */
  const grab = (rel) => {
    const t = readRepo(rel).replace(/\r\n/g, '\n');
    const i = t.indexOf(S), j = t.indexOf(E);
    return (i < 0 || j < 0) ? null : t.slice(i, j + E.length);
  };
  const server = grab('netlify/functions/_registration.js');
  const client = grab('scores-data.js');

  check('the block exists in netlify/functions/_registration.js', !!server);
  check('the block exists in scores-data.js', !!client);
  /* Character for character, not "roughly the same". A reformatted copy is a
     copy that can be edited alone next time. */
  check('the two copies are character-for-character identical', !!server && server === client,
    server && client && server !== client ? `server ${server.length} chars, client ${client.length}` : '');
  /* A block that shrank to nothing would pass the equality check above while
     testing nothing at all — the exact shape of hollow test this project has
     already been bitten by twice. */
  check('the block is a real block, not an empty one', !!server && server.length > 2000,
    server ? `${server.length} chars` : '');
  check('the shared block carries registrationState', !!server && server.includes('function registrationState('));
  check('the shared block carries validateSettings', !!server && server.includes('function validateSettings('));
  check('the shared block carries registrationWarnings', !!server && server.includes('function registrationWarnings('));
  check('the shared block carries registrationCopy', !!server && server.includes('function registrationCopy('));

  /* The front end must re-export what it shares, or the panel and the homepage
     silently fall back to nothing. */
  const sd = readRepo('scores-data.js');
  const exportBlock = sd.slice(sd.indexOf('export {'), sd.indexOf('export {') + 400);
  ['registrationState', 'registrationCopy', 'fmtCountdown', 'validateSettings',
    'registrationWarnings', 'stampFromDate', 'dateOfStamp', 'fmtWindowDate']
    .forEach((n) => check(`scores-data.js exports ${n}`, new RegExp('\\b' + n + '\\b').test(exportBlock)));

  /* organizer-data.js must FORWARD them rather than growing a third copy. */
  const od = readRepo('organizer-data.js');
  check('organizer-data.js re-exports from scores-data.js, not a third copy',
    /export\s*\{[^}]*registrationState[^}]*\}\s*from\s*'\.\/scores-data\.js'/s.test(od));
  check('organizer-data.js does not define its own registrationState',
    !/function\s+registrationState\s*\(/.test(od));
}

/* ====================================================================== */
section('Defaults, and what an unconfigured site does');

eq('the default is both dates null and mode auto', DEFAULT_REGISTRATION, { opensAt: null, closesAt: null, mode: 'auto' });
eq('the three modes are exactly auto / open / closed', REGISTRATION_MODES, ['auto', 'open', 'closed']);

{
  const st = registrationState(DEFAULT_REGISTRATION, OPEN_MS);
  check('an unconfigured window is CLOSED', st.open === false);
  eq('an unconfigured window reports phase "unset"', st.phase, 'unset');
  check('an unconfigured window is not "forced"', st.forced === false);
}

/* Every shape of junk has to land closed. Anything that fails OPEN here is the
   bug that matters, so they are enumerated rather than sampled. */
[
  ['null settings', null],
  ['undefined settings', undefined],
  ['a string instead of an object', 'open'],
  ['a number instead of an object', 1],
  ['an empty object', {}],
  ['an opening date that is not a date', { opensAt: 'soon', closesAt: CLOSES, mode: 'auto' }],
  ['an opening date that is a number', { opensAt: 1760000000000, closesAt: CLOSES, mode: 'auto' }],
  ['a closing date but no opening date', { opensAt: null, closesAt: CLOSES, mode: 'auto' }],
].forEach(([label, input]) => {
  const st = registrationState(input, OPEN_MS + 1000);
  check(`fails CLOSED: ${label}`, st.open === false, `phase=${st.phase} open=${st.open}`);
});

/* An unrecognised MODE is the one thing that does NOT fail closed, and the
   distinction is worth pinning down rather than leaving to whoever reads the
   code next. The mode is only ever an exception to the dates; a junk exception
   is no exception, which leaves the dates the organiser deliberately set. The
   dates themselves are still fully validated, so nothing is being trusted that
   was not trusted before. (validateSettings refuses an unknown mode at save
   time — this path exists only for a blob edited by hand.) */
{
  const junkMode = { opensAt: OPENS, closesAt: CLOSES, mode: 'yes' };
  check('an unrecognised mode follows the dates instead', registrationState(junkMode, OPEN_MS + 1000).open === true);
  eq('…reported as auto, not echoed back', registrationState(junkMode, OPEN_MS + 1000).mode, 'auto');
  check('…and is not treated as a deliberate override', registrationState(junkMode, OPEN_MS + 1000).forced === false);
  check('…and is still CLOSED outside the dates', registrationState(junkMode, OPEN_MS - 1000).open === false);
  check('an unrecognised mode with no dates is CLOSED',
    registrationState({ opensAt: null, closesAt: null, mode: 'yes' }, OPEN_MS).open === false);
}

/* An unreadable clock is the same class of problem and gets the same answer. */
[['NaN', NaN], ['undefined', undefined], ['a string', 'now'], ['an invalid Date', new Date('nope')]]
  .forEach(([label, now]) => {
    const st = registrationState(W(), now);
    check(`fails CLOSED when now is ${label}`, st.open === false, `phase=${st.phase}`);
  });

/* ====================================================================== */
section('The boundaries, to the millisecond, in auto mode');

{
  const at = (ms) => registrationState(W(), ms);

  eq('one ms before opening: phase before', at(OPEN_MS - 1).phase, 'before');
  check('one ms before opening: closed', at(OPEN_MS - 1).open === false);

  eq('exactly at opening: phase open', at(OPEN_MS).phase, 'open');
  check('exactly at opening: OPEN', at(OPEN_MS).open === true);

  eq('one ms after opening: phase open', at(OPEN_MS + 1).phase, 'open');

  eq('one ms before closing: phase open', at(CLOSE_MS - 1).phase, 'open');
  check('one ms before closing: still OPEN', at(CLOSE_MS - 1).open === true);

  /* Half-open range: the closing instant itself is closed. The same convention
     the weekend clash check uses for touching bookings — one ends 10:00, the
     next starts 10:00, and that is not an overlap. */
  eq('exactly at closing: phase after', at(CLOSE_MS).phase, 'after');
  check('exactly at closing: CLOSED', at(CLOSE_MS).open === false);

  eq('one ms after closing: phase after', at(CLOSE_MS + 1).phase, 'after');

  /* A Date object and its millisecond value must not disagree. */
  eq('a Date and its ms value give the same phase', at(new Date(OPEN_MS)).phase, at(OPEN_MS).phase);
}

/* ====================================================================== */
section('Abu Dhabi time is Abu Dhabi time, wherever the reader is');

{
  /* The whole reason the stamps carry +04:00. 7 October 2026 at 22:00 UTC is
     already 02:00 on 8 October in Abu Dhabi — so a window opening on 8 October
     Abu Dhabi time is OPEN at that instant, and a browser in London has to
     agree. If these values were built with new Date(2026, 9, 8) they would not. */
  const twoAmAbuDhabi = Date.parse('2026-10-07T22:00:00Z');
  eq('22:00 UTC on 7 Oct is inside the window', registrationState(W(), twoAmAbuDhabi).phase, 'open');

  const justBefore = Date.parse('2026-10-07T19:59:59Z'); // 23:59:59 on the 7th in Abu Dhabi
  eq('19:59:59 UTC on 7 Oct is still before the window', registrationState(W(), justBefore).phase, 'before');

  /* And the display never converts either. */
  eq('fmtWindowDate reads the stamp, not a Date', fmtWindowDate(OPENS), '8 October');
  eq('fmtWindowDate with the year', fmtWindowDate(CLOSES, true), '1 November 2026');
  eq('fmtWindowDate of null is empty', fmtWindowDate(null), '');
  eq('fmtWindowDate of junk is empty', fmtWindowDate('whenever'), '');
  eq('fmtWindowDate refuses month 13', fmtWindowDate('2026-13-01T00:00:00+04:00'), '');

  /* THE CLAIM IN THIS SECTION'S HEADING, ACTUALLY TESTED. Every assertion above
     runs in whatever timezone this machine happens to be set to, so on its own
     it proves nothing about a reader somewhere else — a version of
     fmtWindowDate built on `new Date(stamp).getMonth()` passes ALL of them on a
     UTC box and prints the wrong month to somebody in Los Angeles. That exact
     fault is injected by _prove-registration.js, and these five child processes
     are the only thing that catches it.

     The first-of-the-month stamp is the one that matters: midnight on 1 November
     in Abu Dhabi is still 31 October across half the world. */
  const { execFileSync } = require('child_process');
  const modulePath = path.join(repoRoot(), 'netlify', 'functions', '_registration.js');
  const probe = `
    const R = require(${JSON.stringify(modulePath)});
    const OPENS = ${JSON.stringify(OPENS)}, CLOSES = ${JSON.stringify(CLOSES)};
    const FIRST = '2026-11-01T00:00:00+04:00';
    process.stdout.write(JSON.stringify({
      opens:      R.fmtWindowDate(OPENS),
      closes:     R.fmtWindowDate(CLOSES, true),
      first:      R.fmtWindowDate(FIRST),
      month13:    R.fmtWindowDate('2026-13-01T00:00:00+04:00'),
      dateOf:     R.dateOfStamp(FIRST),
      stamp:      R.stampFromDate('2026-10-08', false),
      atOpen:     R.registrationState({ opensAt: OPENS, closesAt: CLOSES, mode: 'auto' }, Date.parse(OPENS)).phase,
      justBefore: R.registrationState({ opensAt: OPENS, closesAt: CLOSES, mode: 'auto' }, Date.parse(OPENS) - 1).phase,
      pill:       R.registrationCopy({ opensAt: OPENS, closesAt: CLOSES, mode: 'auto' }, Date.parse(OPENS)).pill,
    }));
  `;
  const inTz = (tz) => JSON.parse(execFileSync(process.execPath, ['-e', probe],
    { env: { ...process.env, TZ: tz }, encoding: 'utf8' }));

  const expected = {
    opens: '8 October', closes: '1 November 2026', first: '1 November', month13: '',
    dateOf: '2026-11-01', stamp: OPENS, atOpen: 'open', justBefore: 'before',
    pill: 'REGISTRATION CLOSES 1 NOVEMBER',
  };
  ['UTC', 'Asia/Dubai', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Niue'].forEach((tz) => {
    let got = null;
    try { got = inTz(tz); } catch (e) { check(`the answers can be computed in ${tz}`, false, e.message); return; }
    eq(`every answer is the same in ${tz} (+14 to -11 covered)`, got, expected);
  });
}

/* ====================================================================== */
section('Forcing open and forcing closed');

{
  /* Force open beats the dates in both directions. */
  const early = registrationState(W({ mode: 'open' }), OPEN_MS - 86400000);
  check('force open: OPEN a day before the opening date', early.open === true);
  eq('force open: phase still reports the honest date position', early.phase, 'before');
  check('force open: forced is true', early.forced === true);

  const late = registrationState(W({ mode: 'open' }), CLOSE_MS + 86400000);
  check('force open: OPEN a day after the closing date', late.open === true);
  eq('force open: phase still says after', late.phase, 'after');

  const noDates = registrationState({ opensAt: null, closesAt: null, mode: 'open' }, OPEN_MS);
  check('force open: OPEN with no dates set at all', noDates.open === true);
  eq('force open with no dates: phase unset', noDates.phase, 'unset');

  /* Force closed beats the dates the other way. */
  const mid = registrationState(W({ mode: 'closed' }), OPEN_MS + 86400000);
  check('force closed: CLOSED inside the window', mid.open === false);
  eq('force closed: phase still says open, because the dates do', mid.phase, 'open');
  check('force closed: forced is true', mid.forced === true);

  check('auto is not forced', registrationState(W(), OPEN_MS).forced === false);
  eq('the mode comes back on the result', registrationState(W({ mode: 'closed' }), OPEN_MS).mode, 'closed');
}

/* ====================================================================== */
section('Dates set half-way, and a window that could never open');

{
  const openOnly = { opensAt: OPENS, closesAt: null, mode: 'auto' };
  eq('opening date with no closing date: open once it starts', registrationState(openOnly, CLOSE_MS + 1e9).phase, 'open');
  check('…and it stays open indefinitely', registrationState(openOnly, CLOSE_MS + 1e9).open === true);
  eq('…and it is still shut before it starts', registrationState(openOnly, OPEN_MS - 1).phase, 'before');

  /* A closing date on its own is an incomplete configuration, and the safe
     reading of it is "not open yet", not "open until November". */
  const closeOnly = { opensAt: null, closesAt: CLOSES, mode: 'auto' };
  eq('closing date with no opening date: unset', registrationState(closeOnly, OPEN_MS).phase, 'unset');
  check('…and CLOSED', registrationState(closeOnly, OPEN_MS).open === false);

  /* closesAt before opensAt is refused at save time, but the pure function must
     still not produce nonsense if one reaches it — a blob edited by hand, say. */
  const backwards = { opensAt: CLOSES, closesAt: OPENS, mode: 'auto' };
  [OPEN_MS - 1, OPEN_MS, (OPEN_MS + CLOSE_MS) / 2, CLOSE_MS, CLOSE_MS + 1].forEach((t) => {
    check('a backwards window is never open, at ' + new Date(t).toISOString(),
      registrationState(backwards, t).open === false, `phase=${registrationState(backwards, t).phase}`);
  });
}

/* ====================================================================== */
section('validateSettings — what the server will and will not store');

{
  const ok = validateSettings({ opensAt: '2026-10-08', closesAt: '2026-11-01', mode: 'auto' });
  check('a pair of bare calendar dates is accepted', ok.ok === true, (ok.errors || []).join(' '));
  eq('the opening date is stored at the START of its day, Abu Dhabi', ok.settings && ok.settings.opensAt, OPENS);
  eq('the closing date is stored at the END of its day, Abu Dhabi', ok.settings && ok.settings.closesAt, CLOSES);
  eq('the mode is carried through', ok.settings && ok.settings.mode, 'auto');

  const stamps = validateSettings({ opensAt: OPENS, closesAt: CLOSES, mode: 'open' });
  check('full stamps are accepted unchanged', stamps.ok === true);
  eq('…and stored exactly as sent', stamps.settings && stamps.settings.opensAt, OPENS);

  const empty = validateSettings({ opensAt: '', closesAt: null, mode: 'auto' });
  check('empty and null dates are accepted', empty.ok === true, (empty.errors || []).join(' '));
  eq('…and stored as null, not as an empty string', empty.settings, { opensAt: null, closesAt: null, mode: 'auto' });

  eq('a missing mode defaults to auto', (validateSettings({ opensAt: null, closesAt: null }).settings || {}).mode, 'auto');

  /* The hard errors. Each is asserted to carry a REASON, because the whole
     contract is "refused with the reason shown, not silently coerced". */
  [
    ['a date that does not parse', { opensAt: 'october', closesAt: null, mode: 'auto' }],
    ['a closing date that does not parse', { opensAt: '2026-10-08', closesAt: 'later', mode: 'auto' }],
    ['a mode outside the three', { opensAt: null, closesAt: null, mode: 'sometimes' }],
    ['closing before opening', { opensAt: '2026-11-01', closesAt: '2026-10-08', mode: 'auto' }],
    ['closing the day before opening', { opensAt: '2026-10-08', closesAt: '2026-10-07', mode: 'auto' }],
    ['a date that is a number', { opensAt: 20261008, closesAt: null, mode: 'auto' }],
    ['nothing at all', null],
  ].forEach(([label, input]) => {
    const r = validateSettings(input);
    check(`refused: ${label}`, r.ok === false, JSON.stringify(r.settings || r));
    check(`refused with a reason: ${label}`,
      r.ok === false && r.errors.length > 0 && typeof r.errors[0] === 'string' && r.errors[0].length > 10);
    check(`nothing is stored when refused: ${label}`, r.settings === undefined);
  });

  /* IMPOSSIBLE DATES. This is the check that caught a real bug while this file
     was being written: Date.parse() ACCEPTS '2026-02-31T00:00:00+04:00' and
     rolls it forward to 3 March, so "well-shaped and it parses" was letting a
     day that does not exist through as a real one — registration would have
     opened three days after the date on the poster. Same trap composeDob()
     closes on the player form, same reason. */
  [
    ['31 February', '2026-02-31'],
    ['29 February in a non-leap year', '2026-02-29'],
    ['31 April', '2026-04-31'],
    ['31 June', '2026-06-31'],
    ['the 32nd of anything', '2026-10-32'],
    ['day zero', '2026-10-00'],
    ['month 13', '2026-13-01'],
    ['month zero', '2026-00-10'],
  ].forEach(([label, ymd]) => {
    const bare = validateSettings({ opensAt: ymd, closesAt: null, mode: 'auto' });
    check(`refused as a bare date: ${label}`, bare.ok === false, JSON.stringify(bare.settings));
    /* And refused when it arrives as a FULL stamp, which skips the bare-date
       branch entirely — the path the first version of the fix missed. */
    const full = validateSettings({ opensAt: `${ymd}T00:00:00+04:00`, closesAt: null, mode: 'auto' });
    check(`refused as a full stamp: ${label}`, full.ok === false, JSON.stringify(full.settings));
    check(`never silently rolled forward: ${label}`, !bare.settings && !full.settings);
  });

  /* 29 February in a year that HAS one is a real day and must still work. A
     validity check that refused everything would pass every assertion above. */
  const leap = validateSettings({ opensAt: '2028-02-29', closesAt: null, mode: 'auto' });
  check('29 February 2028 is a real day and is accepted', leap.ok === true, (leap.errors || []).join(' '));
  eq('…and stored as itself', leap.settings && leap.settings.opensAt, '2028-02-29T00:00:00+04:00');
  check('31 December is accepted', validateSettings({ opensAt: '2026-12-31', closesAt: null, mode: 'auto' }).ok === true);
  check('1 January is accepted', validateSettings({ opensAt: '2027-01-01', closesAt: null, mode: 'auto' }).ok === true);

  /* isRealDate directly, since stampFromDate now leans on it. */
  check('isRealDate: 31 Feb is not a day', R.isRealDate('2026-02-31') === false);
  check('isRealDate: 29 Feb 2028 is a day', R.isRealDate('2028-02-29') === true);
  check('isRealDate: 28 Feb 2026 is a day', R.isRealDate('2026-02-28') === true);
  check('isRealDate: 30 November is a day', R.isRealDate('2026-11-30') === true);
  check('isRealDate: 31 November is not', R.isRealDate('2026-11-31') === false);
  check('isRealDate: junk is not', R.isRealDate('tomorrow') === false);
  check('isRealDate: null is not', R.isRealDate(null) === false);
  eq('stampFromDate refuses an impossible day', stampFromDate('2026-02-31', false), null);

  /* A window that opens and closes on the SAME day is legal — closesAt is the
     end of its day and opensAt the start, so there are 24 usable hours. */
  const sameDay = validateSettings({ opensAt: '2026-10-08', closesAt: '2026-10-08', mode: 'auto' });
  check('opening and closing on the same day is allowed', sameDay.ok === true, (sameDay.errors || []).join(' '));
  check('…and that day is actually open at midday',
    registrationState(sameDay.settings, Date.parse('2026-10-08T12:00:00+04:00')).open === true);

  /* A window of ZERO length is not. Bare dates can never produce one, so this
     can only arrive as a pair of identical full stamps — which is exactly why
     it needs its own assertion: the same-day case above passes whether the rule
     is `c <= o` or the weaker `c < o`, and only this one tells them apart. */
  const zero = validateSettings({ opensAt: OPENS, closesAt: OPENS, mode: 'auto' });
  check('a window that closes at the very instant it opens is refused', zero.ok === false, JSON.stringify(zero.settings));
  check('…with a reason', zero.ok === false && /never be open/i.test(zero.errors.join(' ')), JSON.stringify(zero.errors));
  /* And one second of window is enough — the rule must not be over-broad. */
  const oneSecond = validateSettings({ opensAt: OPENS, closesAt: '2026-10-08T00:00:01+04:00', mode: 'auto' });
  check('a one-second window is allowed', oneSecond.ok === true, (oneSecond.errors || []).join(' '));
}

/* ====================================================================== */
section('stampFromDate / dateOfStamp round-trip');

eq('a date becomes the start of its day', stampFromDate('2026-10-08', false), OPENS);
eq('…or the end of it', stampFromDate('2026-11-01', true), CLOSES);
eq('a non-date is refused', stampFromDate('8 October 2026', false), null);
eq('an empty string is refused', stampFromDate('', false), null);
eq('a null is refused', stampFromDate(null, false), null);
eq('a stamp goes back to its own calendar date', dateOfStamp(OPENS), '2026-10-08');
eq('…including the closing one, which is late in the day', dateOfStamp(CLOSES), '2026-11-01');
eq('junk goes back to an empty string', dateOfStamp('later'), '');
eq('null goes back to an empty string', dateOfStamp(null), '');
eq('the round trip is stable', dateOfStamp(stampFromDate('2026-12-31', true)), '2026-12-31');

/* ====================================================================== */
section('mergeSettings — a half-written blob still gives a usable answer');

eq('nothing saved gives the defaults', mergeSettings(null), DEFAULT_REGISTRATION);
eq('junk saved gives the defaults', mergeSettings('open'), DEFAULT_REGISTRATION);
eq('a blob with only a mode keeps it', mergeSettings({ mode: 'open' }), { opensAt: null, closesAt: null, mode: 'open' });
eq('a blob with an unknown mode falls back to auto', mergeSettings({ mode: 'maybe' }).mode, 'auto');
eq('a blob with empty-string dates normalises them to null', mergeSettings({ opensAt: '', closesAt: '' }),
  { opensAt: null, closesAt: null, mode: 'auto' });
check('merging does not mutate the shared default object',
  DEFAULT_REGISTRATION.mode === 'auto' && DEFAULT_REGISTRATION.opensAt === null);

/* ====================================================================== */
section('registrationWarnings — advisory, never blocking');

{
  const has = (list, fragment) => list.some((w) => w.toLowerCase().includes(fragment));

  check('no dates: says so', has(registrationWarnings(DEFAULT_REGISTRATION, OPEN_MS), 'no dates set'));
  check('closing date only: says registration stays closed',
    has(registrationWarnings({ opensAt: null, closesAt: CLOSES, mode: 'auto' }, OPEN_MS), 'no opening date'));
  check('no closing date: says it stays open',
    has(registrationWarnings({ opensAt: OPENS, closesAt: null, mode: 'auto' }, OPEN_MS), 'stays open'));
  check('force open: warns, and mentions the TEST MODE strip',
    has(registrationWarnings(W({ mode: 'open' }), OPEN_MS), 'test mode'));
  check('force closed: warns', has(registrationWarnings(W({ mode: 'closed' }), OPEN_MS), 'force closed'));
  check('after the closing date in auto: says the page now says closed',
    has(registrationWarnings(W(), CLOSE_MS + 1), 'closing date has passed'));
  check('a healthy fully-set window mid-run warns about nothing',
    registrationWarnings(W(), OPEN_MS + 86400000).length === 0,
    JSON.stringify(registrationWarnings(W(), OPEN_MS + 86400000)));
}

/* ====================================================================== */
section('The function that decides is pure');

{
  /* No hidden clock, no cached answer, no mutation of the caller's object.
     These are the properties that make every assertion above meaningful — a
     function that read Date.now() internally could pass all of them and still
     be untestable at the boundary. */
  const input = W();
  const before = JSON.stringify(input);
  registrationState(input, OPEN_MS);
  registrationState(input, CLOSE_MS);
  check('it does not mutate the settings it is given', JSON.stringify(input) === before);

  eq('the same inputs give the same answer',
    registrationState(W(), OPEN_MS + 5), registrationState(W(), OPEN_MS + 5));

  const src = readRepo('netlify/functions/_registration.js');
  const S = '/* ===== REGISTRATION WINDOW — SHARED BLOCK (start) =====';
  const E = '/* ===== REGISTRATION WINDOW — SHARED BLOCK (end) ===== */';
  const block = src.slice(src.indexOf(S), src.indexOf(E));
  /* Strip comments before looking for a clock, or the prose above the function
     ("no clock of its own") matches and the check passes on its own
     documentation — exactly the failure that made a regex match a comment
     instead of the code once before on this project. */
  const code = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check('the shared block reads no clock of its own',
    !/Date\.now\s*\(/.test(code) && !/new Date\s*\(\s*\)/.test(code),
    (code.match(/Date\.now\s*\(|new Date\s*\(\s*\)/g) || []).join(' '));
  check('the shared block does no fetching', !/fetch\s*\(/.test(code));
  check('the shared block touches no storage', !/localStorage|blobStore|setJSON/.test(code));
}

/* ======================================================================
   FAULTS THIS FILE WAS PROVEN AGAINST

   `node _prove-registration.js` reproduces all of it. That script breaks the
   real code on purpose, one fault at a time, on a COPY of the clone, and checks
   not only that the suite fails but that the check which fails is the one
   claiming to guard that behaviour — a suite that dies with an exception
   "fails" for every fault and proves nothing.

   Twelve faults are aimed at this file and all twelve are caught by name:

     1.  t < o relaxed to t <= o             -> "exactly at opening" fails
     2.  t >= c relaxed to t > c             -> "exactly at closing" fails
     3.  the !Number.isFinite(t) guard gone  -> the four "fails CLOSED when now
                                                is ..." checks fail
     4.  the o === null guard weakened       -> "closing date with no opening
                                                date" fails open
     5.  force closed made to rewrite phase  -> "force closed: phase still says
                                                open" fails
     6.  c <= o relaxed to c < o             -> "closes at the very instant it
                                                opens" is wrongly accepted
     7.  the +04:00 offset dropped           -> "stored at the START of its day"
                                                and the cross-timezone checks fail
     8.  isRealDate gone from stampFromDate  -> "stampFromDate refuses an
                                                impossible day" fails
     9.  isRealDate gone from validateSettings -> the 31 February checks fail.
                                                Two separate faults, because the
                                                two call sites are independent on
                                                purpose and breaking one leaves
                                                the other still refusing
     10. the block edited in ONE file        -> the identity check fails
     11. the block emptied in BOTH files     -> "the registration module loads at
                                                all" fails, rather than the run
                                                dying on its own require
     12. fmtWindowDate rerouted through a Date -> ONLY the cross-timezone checks
                                                fail. It passes every other
                                                assertion in this file on a UTC
                                                machine, which is precisely why
                                                those five child processes exist

   THREE ASSERTIONS HERE WERE WRONG WHEN FIRST WRITTEN and were corrected
   against the code rather than the other way round. Worth recording, because
   the temptation each time was to "fix" the code to match the test:

     * "an unrecognised mode fails closed" — it does not, and should not. A junk
       mode is a junk exception to the dates, so the dates stand. It now has its
       own block rather than being lumped in with the junk inputs.
     * "31 February is refused" — it was NOT. Date.parse accepts it and rolls it
       forward to 3 March. isRealDate exists BECAUSE this assertion failed.
     * "the same-day check catches c <= o" — it did not distinguish c <= o from
       c < o, because a bare same-day pair spans 24 hours. The zero-length case
       had to be added before that rule was guarded by anything at all.
   ====================================================================== */

summary('test-registration.js');
