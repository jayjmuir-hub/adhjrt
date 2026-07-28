/* tests/test-registration-panel.js
   ------------------------------------------------------------------------
   The two screens the registration window drives:

     /organizer  → the Registration tab (dates, mode, live preview)
     /           → the register CTA (pill, blurb, countdown, gated buttons,
                   TEST MODE strip)

   Both are driven THROUGH THE COMPONENT rather than grepped. That distinction
   is the lesson from the pitch-count test on this project: a regex over markup
   proves a string is present, not that the code puts it there. Every phase
   below is produced by actually constructing the component, setting a window
   and a clock on it, and reading what renderVals() hands the template.

   The one thing that IS checked as text is the binding contract — every
   {{ token }} the new markup uses must come back from renderVals(). That has to
   be textual, because a missing binding does not throw: CLAUDE.md records that
   a {{ X }} the component does not return resolves silently to empty, which is
   how the Fixtures→Results link stayed broken.
*/

const fs = require('fs');
const path = require('path');
const { repoRoot, readRepo, section, check, eq, summary } = require('./_lib');

const REG = require(path.join(repoRoot(), 'netlify', 'functions', '_registration.js'));

const OPENS  = '2026-10-08T00:00:00+04:00';
const CLOSES = '2026-11-01T23:59:59+04:00';
const OPEN_MS  = Date.parse(OPENS);
const CLOSE_MS = Date.parse(CLOSES);
const MID_MS   = OPEN_MS + 5 * 86400000;   // comfortably inside the window

/* ------------------------------------------------------------------------
   A minimal stand-in for the framework base class. Only what the components
   actually touch: setState (object or updater form, with the callback), and a
   plain `state` field. Nothing here simulates rendering — renderVals() is a
   pure method and calling it is the whole test. */
class DCLogic {
  setState(patch, cb) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    if (typeof cb === 'function') cb();
  }
}

/* Pulls the x-dc script out of a .dc.html and evaluates it, handing back the
   component class. The script is plain JS with one class in it; nothing at the
   top level of either file touches the DOM, so no document stub is needed. */
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

/* The component's declared initial state, without running componentDidMount —
   which would try to import modules over the network. Class fields are assigned
   in the constructor, so `new C()` is enough. */
function build(file) {
  const C = loadComponent(file);
  const c = new C();
  c.props = {};
  return c;
}

/* Every {{ token }} in a slice of markup, split into the ones renderVals has to
   supply and the ones it must not.

   Three things are deliberately NOT renderVals keys and are filtered out here,
   because counting them would make this check fail on correct markup — and a
   check that fails on correct markup gets deleted rather than fixed:

     hint-placeholder-val="{{ false }}"   an editor hint, not a binding
     hint-placeholder-count="{{ 6 }}"     the same
     <sc-for as="rm">…{{ rm.label }}      rm is the LOOP variable; its root is
                                          not a renderVals key, which is exactly
                                          why validate-bindings.js skips these
                                          by design and why the loop objects are
                                          asserted separately below. */
function tokensIn(markup) {
  const loopVars = new Set([...markup.matchAll(/<sc-for\b[^>]*\bas="([^"]+)"/g)].map((m) => m[1]));
  const cleaned = markup.replace(/hint-placeholder-(?:val|count)="[^"]*"/g, '');
  const raw = [...cleaned.matchAll(/\{\{\s*([A-Za-z_$][\w$]*)(\.[\w$]+)?\s*\}\}/g)];
  const plain = new Set(), scoped = new Map();
  raw.forEach(([, root, prop]) => {
    if (prop || loopVars.has(root)) {
      if (!scoped.has(root)) scoped.set(root, new Set());
      if (prop) scoped.get(root).add(prop.slice(1));
    } else plain.add(root);
  });
  return { plain: [...plain], scoped, loopVars };
}

function slice(file, from, to) {
  const t = readRepo(file);
  const i = t.indexOf(from), j = t.indexOf(to, i + 1);
  if (i < 0 || j < 0) throw new Error(`could not slice ${file} between\n  ${from}\nand\n  ${to}`);
  return t.slice(i, j);
}

/* ======================================================================== */
section('The Registration tab exists and is wired to the shared rules');

const ORG = 'Organizer.dc.html';
let orgVals = null, org = null;

try {
  const src = readRepo(ORG);

  check('there is a Registration tab button', /onClick="\{\{ showRegistration \}\}"/.test(src));
  check('…styled by its own tab style binding', /style="\{\{ tabRegistrationStyle \}\}"/.test(src));
  check('…and a panel gated on isRegistration', /<sc-if value="\{\{ isRegistration \}\}"/.test(src));
  check('opening the tab loads the window', /showRegistration:[\s\S]{0,200}?loadRegistrationWindow\(\)/.test(src));
  check('regVals is spread into renderVals', /\.\.\.this\.regVals\(s\)/.test(src));

  /* THE POINT OF THE WHOLE DESIGN. The panel must be asking the server's own
     validator, not re-deriving the rules. If this check ever fails, Save can go
     green on something the server will refuse — which is the exact failure
     test-venue-panel.js was written to catch on the venue panel, and the reason
     that second implementation was not repeated here. */
  check('the Registration panel calls the shared validateSettings, not a local copy',
    /api\.validateSettings\(/.test(src));
  check('…and the shared registrationCopy for its preview',
    /api\.registrationCopy\(/.test(src));
  check('…and the shared registrationWarnings',
    /api\.registrationWarnings\(/.test(src));

  /* No hand-rolled date arithmetic anywhere in this file. A single Date.parse
     or a hand-built ISO string here is the beginning of the second copy. */
  const script = src.slice(src.indexOf('<script type="text/x-dc"'));
  const code = script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check('the Registration panel writes no date rules of its own',
    !/Date\.parse\(/.test(code) && !/T00:00:00/.test(code) && !/\+04:00/.test(code),
    (code.match(/Date\.parse\(|T00:00:00|\+04:00/g) || []).join(' '));

  /* organizer-data.js has to actually forward the three functions the panel
     calls, or every one of them is undefined at runtime. */
  const od = readRepo('organizer-data.js');
  ['validateSettings', 'registrationCopy', 'registrationWarnings', 'stampFromDate', 'dateOfStamp', 'fmtWindowDate']
    .forEach((n) => check(`organizer-data.js forwards ${n}`, new RegExp('\\b' + n + '\\b').test(od)));
  check('organizer-data.js has a getRegistrationWindow', /export async function getRegistrationWindow/.test(od));
  check('organizer-data.js has a saveRegistrationWindow', /export async function saveRegistrationWindow/.test(od));
  check('organizer-data.js has a resetRegistrationWindow', /export async function resetRegistrationWindow/.test(od));
} catch (e) {
  check('the organiser page could be read', false, e.message);
}

/* ======================================================================== */
section('Driving the Registration panel');

/* The api the panel is handed. The date functions are the REAL ones, straight
   off the server module — so this exercises the same code the browser will get
   through organizer-data.js's re-export. Only the network calls are stubbed. */
const fakeApi = (over) => ({
  validateSettings: REG.validateSettings,
  registrationCopy: REG.registrationCopy,
  registrationWarnings: REG.registrationWarnings,
  stampFromDate: REG.stampFromDate,
  dateOfStamp: REG.dateOfStamp,
  fmtWindowDate: REG.fmtWindowDate,
  currentSession: () => null,
  getRegistrations: async () => ({ teams: [], players: [] }),
  listAccounts: async () => [],
  ...(over || {}),
});

function panel(reg, saved, now, apiOver) {
  const c = build(ORG);
  c.state = {
    ...c.state,
    api: fakeApi(apiOver),
    tab: 'registration',
    reg: reg ? { ...reg } : null,
    regSaved: saved === undefined ? (reg ? { ...reg } : null) : (saved ? { ...saved } : null),
    regNow: now,
    rLoaded: true,
  };
  return { c, vals: c.renderVals() };
}

try {
  const good = { opensAt: OPENS, closesAt: CLOSES, mode: 'auto' };

  {
    const { vals } = panel(good, good, MID_MS);
    check('the tab reports itself as selected', vals.isRegistration === true);
    check('no problems on a valid window', vals.rHasProblems === false, JSON.stringify(vals.rProblems));
    check('Save is disabled when nothing has changed', vals.rSaveDisabled === true);
    eq('…and says so', vals.rSaveLabel, 'Saved');
    eq('the opening date goes back into the date box', vals.rOpensDate, '2026-10-08');
    eq('the closing date goes back into the date box', vals.rClosesDate, '2026-11-01');
    check('the opening date is echoed with its weekday spelled out', /Thursday 8 October 2026/.test(vals.rOpensEcho), vals.rOpensEcho);
    check('…and the time of day it takes effect', /00:00/.test(vals.rOpensEcho), vals.rOpensEcho);
    check('the closing date is echoed as the END of that day', /Closes 23:59/.test(vals.rClosesEcho), vals.rClosesEcho);
    check('…with its weekday too', /Sunday 1 November 2026/.test(vals.rClosesEcho), vals.rClosesEcho);
    check('there are exactly three modes to choose from', vals.rModes.length === 3);
    check('every mode offers a label, a description and a handler',
      vals.rModes.every((m) => m.label && m.desc && typeof m.onPick === 'function'));
  }

  /* An empty date is a meaningful value — "undecided" — and must be shown as
     such rather than as a blank box that looks like a bug. */
  {
    const { vals } = panel({ opensAt: null, closesAt: null, mode: 'auto' }, null, MID_MS);
    eq('an unset opening date shows an empty box', vals.rOpensDate, '');
    check('…and says in words that registration is closed', /stays closed/i.test(vals.rOpensEcho), vals.rOpensEcho);
    check('…in the warning colour, not the normal one', vals.rOpensEchoColor === '#f5c518');
    check('an unset closing date says it stays open', /stays open/i.test(vals.rClosesEcho), vals.rClosesEcho);
    check('the panel warns that no dates are set', vals.rHasWarnings === true);
    check('…but does not block saving over it', vals.rHasProblems === false);
  }

  /* The rule the server refuses on. Save must go grey with the reason on
     screen, not bounce off a 400 with nothing to read. */
  {
    const backwards = { opensAt: CLOSES, closesAt: OPENS, mode: 'auto' };
    const { vals } = panel(backwards, { opensAt: null, closesAt: null, mode: 'auto' }, MID_MS);
    check('a backwards window is reported as a problem', vals.rHasProblems === true);
    check('…with the server\'s own wording', /closing date is on or before/i.test((vals.rProblems || []).join(' ')), JSON.stringify(vals.rProblems));
    check('…and Save is disabled', vals.rSaveDisabled === true);
    /* The identity that makes the whole approach worth it: what the panel calls
       a problem is literally what the server calls an error. */
    const server = REG.validateSettings(backwards);
    eq('the panel\'s problems ARE the server\'s errors', vals.rProblems, server.errors);
  }

  /* Editing: dates in, mode picked, dirty tracking. */
  {
    const { c } = panel({ opensAt: null, closesAt: null, mode: 'auto' }, { opensAt: null, closesAt: null, mode: 'auto' }, MID_MS);
    check('nothing is dirty to start with', c.renderVals().rSaveDisabled === true);

    c.setRegDate('opensAt', '2026-10-08', false);
    eq('picking an opening date stores the START of that day, Abu Dhabi', c.state.reg.opensAt, OPENS);
    check('…and Save comes alive', c.renderVals().rSaveDisabled === false);

    c.setRegDate('closesAt', '2026-11-01', true);
    eq('picking a closing date stores the END of that day', c.state.reg.closesAt, CLOSES);

    c.setRegDate('closesAt', '', true);
    eq('clearing a date sets it back to null, not an empty string', c.state.reg.closesAt, null);

    c.setRegMode('open');
    eq('picking a mode stores it', c.state.reg.mode, 'open');
    const vals = c.renderVals();
    check('the chosen mode is the one shown as selected',
      vals.rModes.filter((m) => m.style.includes('#17A34A')).length === 1);
    check('force open raises a warning', /force open/i.test((vals.rWarnings || []).join(' ')), JSON.stringify(vals.rWarnings));
  }

  /* An edit must clear a stale "Saved" message — the same bug runClear() had,
     where the only thing telling you the outcome was wiped by a refresh. */
  {
    const { c } = panel({ opensAt: null, closesAt: null, mode: 'auto' }, { opensAt: null, closesAt: null, mode: 'auto' }, MID_MS);
    c.setState({ rSuccess: 'Saved. The public page follows this now — no deploy needed.' });
    c.setRegMode('closed');
    eq('editing clears a stale success message', c.state.rSuccess, '');
  }

  /* The preview. It is drawn from the WORKING copy, so it shows the effect of a
     change before it is saved — and says that is what it is doing. */
  {
    const saved = { opensAt: null, closesAt: null, mode: 'auto' };
    const edited = { opensAt: OPENS, closesAt: CLOSES, mode: 'auto' };
    const { vals } = panel(edited, saved, MID_MS);
    check('the preview shows the unsaved working copy', vals.rPreviewUnsaved === true);
    check('…and says the window is open, from the unsaved dates', /CLOSES 1 NOVEMBER/.test(vals.rPreviewPill), vals.rPreviewPill);

    const clean = panel(edited, edited, MID_MS).vals;
    check('once saved it stops calling itself a preview', clean.rPreviewUnsaved === false);
  }

  /* And the preview cannot say something different from the public page,
     because it is the same call. This is asserted, not assumed. */
  [
    ['before', { opensAt: OPENS, closesAt: CLOSES, mode: 'auto' }, OPEN_MS - 86400000],
    ['open', { opensAt: OPENS, closesAt: CLOSES, mode: 'auto' }, MID_MS],
    ['after', { opensAt: OPENS, closesAt: CLOSES, mode: 'auto' }, CLOSE_MS + 1],
    ['unset', { opensAt: null, closesAt: null, mode: 'auto' }, MID_MS],
    ['forced open', { opensAt: OPENS, closesAt: CLOSES, mode: 'open' }, OPEN_MS - 86400000],
    ['forced closed', { opensAt: OPENS, closesAt: CLOSES, mode: 'closed' }, MID_MS],
  ].forEach(([label, settings, now]) => {
    const { vals } = panel(settings, settings, now);
    const truth = REG.registrationCopy(settings, now);
    eq(`the preview pill matches the public pill (${label})`, vals.rPreviewPill, truth.pill);
    eq(`the preview blurb matches the public blurb (${label})`, vals.rPreviewBlurb, truth.blurb);
    check(`the preview flags TEST MODE exactly when the page does (${label})`, vals.rPreviewTestMode === truth.testMode);
  });
} catch (e) {
  check('the Registration panel could be driven', false, e.stack || e.message);
}

/* ======================================================================== */
section('Every {{ token }} the Registration panel uses is returned');

try {
  const markup = slice(ORG, '<!-- registration window tab -->', '<!-- filters -->');
  const { plain, scoped } = tokensIn(markup);
  check('the panel markup was found and has bindings', plain.length > 10, `${plain.length} tokens`);

  const { vals } = panel({ opensAt: OPENS, closesAt: CLOSES, mode: 'auto' }, null, MID_MS);
  plain.forEach((t) => check(`renderVals returns {{ ${t} }}`, Object.prototype.hasOwnProperty.call(vals, t)));

  /* Loop-scoped bindings. validate-bindings.js skips these by design — the root
     is an sc-for variable — so this is the only thing checking them. */
  const loopSource = { rp: vals.rProblems, rw: vals.rWarnings, rm: vals.rModes };
  scoped.forEach((props, root) => {
    const list = loopSource[root];
    check(`the sc-for list for "${root}" is a real list`, Array.isArray(list) || list === undefined);
  });
  (scoped.get('rm') ? [...scoped.get('rm')] : []).forEach((p) => {
    check(`every mode card carries ${p}`, (vals.rModes || []).length > 0 && vals.rModes.every((m) => p in m));
  });
} catch (e) {
  check('the panel bindings could be checked', false, e.stack || e.message);
}

/* ======================================================================== */
section('The public register CTA — all four phases, driven through the page');

const HOME = 'Quins JRT.dc.html';

/* The homepage reads the window through this.state.fxApi, which is the loaded
   scores-data.js module. Handing it the server module gives it the same
   functions the browser gets — that equivalence is what test-registration.js
   guarantees character for character. */
function home(reg, now) {
  const c = build(HOME);
  c.state = { ...c.state, fxApi: REG, reg: reg ? { ...reg } : null, regNow: now };
  return c;
}
function homeVals(reg, now) { return home(reg, now).renderVals(); }

try {
  const win = { opensAt: OPENS, closesAt: CLOSES, mode: 'auto' };

  /* --- before --- */
  {
    const v = homeVals(win, OPEN_MS - 12 * 86400000);
    check('before: closed', v.registrationOpen === false && v.registrationClosed === true);
    check('before: the pill names the opening date', /OPENS 8 OCTOBER/.test(v.regPill), v.regPill);
    check('before: the paragraph names it too', /opens on 8 October/.test(v.regBlurb), v.regBlurb);
    check('before: there is a countdown', v.regHasCountdown === true);
    eq('before: the countdown reads in whole days', v.regOpensIn, 'in 12 days');
    check('before: no TEST MODE strip', v.regTestMode === false);
    check('before: no year is printed in the pill (it is obvious)', !/2026/.test(v.regPill), v.regPill);
  }

  /* --- open: the pill is a DEADLINE, which is what a coach needs --- */
  {
    const v = homeVals(win, MID_MS);
    check('open: open', v.registrationOpen === true && v.registrationClosed === false);
    check('open: the pill is the closing date, not "now open"', /CLOSES 1 NOVEMBER/.test(v.regPill), v.regPill);
    check('open: the paragraph gives the deadline', /closes at the end of 1 November/.test(v.regBlurb), v.regBlurb);
    check('open: the countdown is gone', v.regHasCountdown === false);
    check('open: no TEST MODE strip when it opened on its own dates', v.regTestMode === false);
    check('open: the modal note carries the deadline', /1 November/.test(v.regFormNote), v.regFormNote);
  }

  /* An open window with no closing date still has to say something sensible. */
  {
    const v = homeVals({ opensAt: OPENS, closesAt: null, mode: 'auto' }, MID_MS);
    check('open with no closing date: falls back to "now open"', /NOW OPEN/.test(v.regPill), v.regPill);
    check('…and the modal note does not invent a deadline', !/closes/i.test(v.regFormNote), v.regFormNote);
  }

  /* --- after: say what happened, do not show a dead form --- */
  {
    const v = homeVals(win, CLOSE_MS + 1000);
    check('after: closed', v.registrationOpen === false);
    check('after: the pill says closed', /CLOSED/.test(v.regPill), v.regPill);
    check('after: the paragraph says when', /closed at the end of 1 November/.test(v.regBlurb), v.regBlurb);
    check('after: no countdown to an opening that has been and gone', v.regHasCountdown === false);
  }

  /* --- unset: no dates yet --- */
  {
    const v = homeVals({ opensAt: null, closesAt: null, mode: 'auto' }, MID_MS);
    check('unset: closed', v.registrationOpen === false);
    check('unset: the pill promises no date it does not have', /OPENS SOON/.test(v.regPill), v.regPill);
    check('unset: no month is named', !/OCTOBER|NOVEMBER/.test(v.regPill), v.regPill);
    check('unset: no countdown', v.regHasCountdown === false);
  }

  /* --- forced open: the TEST MODE strip --- */
  {
    const v = homeVals({ ...win, mode: 'open' }, OPEN_MS - 30 * 86400000);
    check('forced open: the form is open', v.registrationOpen === true);
    check('the TEST MODE strip shows when the window is forced open', v.regTestMode === true);
  }
  {
    const v = homeVals({ ...win, mode: 'closed' }, MID_MS);
    check('forced closed: the form is shut inside the dates', v.registrationOpen === false);
    check('forced closed: the pill does not claim it opens soon', !/OPENS SOON/.test(v.regPill), v.regPill);
    check('forced closed: it says it is closed', /IS CLOSED/.test(v.regPill), v.regPill);
    check('forced closed: no TEST MODE strip (that is for OPEN sessions)', v.regTestMode === false);
  }

  /* --- the failure direction that matters --- */
  {
    const v = homeVals(null, MID_MS);
    check('the page is CLOSED before the window has loaded', v.registrationOpen === false);
    check('…and shows the Coming Soon ribbons', v.registrationClosed === true);

    const c = build(HOME);
    c.state = { ...c.state, fxApi: null, reg: null, regNow: MID_MS };
    check('…and CLOSED if scores-data.js never loaded at all', c.regState().open === false);
    check('…without throwing', typeof c.renderVals().regPill === 'string');
  }

  /* --- the buttons --- */
  {
    const src = readRepo(HOME);
    check('Register a team is gated on the window being open',
      /onClickRegisterTeam\(\)\s*\{\s*if \(this\.regState\(\)\.open\) this\.openTeamModal\(\);/.test(src));
    check('Register a player is gated on the window being open',
      /onClickRegisterPlayer\(\)\s*\{\s*if \(this\.regState\(\)\.open\) this\.openPlayerModal\(\);/.test(src));

    /* Driven, not just read: a shut page must not open the modal, and an open
       page must. */
    const shut = home(null, MID_MS);
    shut.onClickRegisterTeam();
    check('a shut page does not open the team modal', !shut.state.teamModalOpen);
    check('…and explains itself in the toast', typeof shut.state.ctaToast === 'string' && shut.state.ctaToast.length > 10, shut.state.ctaToast);

    const shutSoon = home(win, OPEN_MS - 86400000);
    shutSoon.onClickRegisterPlayer();
    check('a not-yet-open page names the opening date in the toast', /8 October/.test(shutSoon.state.ctaToast), shutSoon.state.ctaToast);

    const live = home(win, MID_MS);
    live.onClickRegisterTeam();
    check('an open page opens the team modal', live.state.teamModalOpen === true);
    const live2 = home(win, MID_MS);
    live2.onClickRegisterPlayer();
    check('an open page opens the player modal', live2.state.playerModalOpen === true);
  }

  /* --- the hardcoded date is gone, and so is the second lever --- */
  {
    const src = readRepo(HOME);
    check('the hardcoded "October 2026" copy is gone from the page',
      !/October 2026/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')),
      (src.match(/[^>]{0,40}October 2026[^<]{0,40}/g) || []).join(' | '));
    check('the registrationOpen editor prop is retired',
      !/registrationOpen&quot;/.test(src));
    check('nothing reads this.props.registrationOpen any more',
      !/this\.props\.registrationOpen/.test(src));
    check('the window is fetched on load', /loadRegistrationWindow\(\)/.test(src));
    check('the clock feeding it ticks with the countdown', /regNow: now,/.test(src));
  }

  /* --- it changes over on its own, on a page nobody reloaded --- */
  {
    const c = home(win, OPEN_MS - 1);
    check('one ms before opening the page is shut', c.renderVals().registrationOpen === false);
    c.tick = c.tick; // (kept explicit: the real tick reads the wall clock)
    c.setState({ regNow: OPEN_MS });
    check('one tick later, at the opening instant, it is open', c.renderVals().registrationOpen === true);
    check('…and the pill has changed to the deadline', /CLOSES/.test(c.renderVals().regPill));
    c.setState({ regNow: CLOSE_MS });
    check('and at the closing instant it shuts again', c.renderVals().registrationOpen === false);
  }
} catch (e) {
  check('the homepage could be driven', false, e.stack || e.message);
}

/* ======================================================================== */
section('Every {{ token }} the register CTA uses is returned');

try {
  const markup = slice(HOME, '<!-- ============ REGISTER CTA ============ -->', '<!-- ============ SPONSORS ============ -->');
  const { plain } = tokensIn(markup);
  const v = homeVals({ opensAt: OPENS, closesAt: CLOSES, mode: 'auto' }, OPEN_MS - 86400000);
  check('the CTA markup was found and has bindings', plain.length > 3, `${plain.length} tokens`);
  plain.forEach((t) => check(`renderVals returns {{ ${t} }}`, Object.prototype.hasOwnProperty.call(v, t)));

  /* And the new bindings specifically, since a slice that silently matched
     nothing would make every check above vacuous. */
  ['regPill', 'regBlurb', 'regTestMode', 'regHasCountdown', 'regOpensIn']
    .forEach((t) => check(`the CTA actually uses {{ ${t} }}`, markup.includes('{{ ' + t + ' }}')));
} catch (e) {
  check('the CTA bindings could be checked', false, e.stack || e.message);
}

/* ======================================================================== */
section('Every {{ token }} the team roster row uses is returned (sub-project 2)');

try {
  const markup = slice(HOME,
    '<label style="font-size:12px;font-weight:700;color:#7f8794;letter-spacing:.5px">PLAYERS</label>',
    '<input value="" style="position:absolute;left:-9999px" tabIndex="-1" aria-hidden="true">');
  const { plain, scoped } = tokensIn(markup);
  check('the roster markup was found and has bindings', plain.length > 2, `${plain.length} tokens`);

  const c = build('Quins JRT.dc.html');
  c.state = { ...c.state, teamForm: { ...c.state.teamForm, ageGroup: 'U16B Contact',
    players: [{ firstName: 'A', lastName: 'Player', dob: '2011-01-01', dobDay: '1', dobMonth: '01', dobYear: '2011' }] } };
  const vals = c.renderVals();
  plain.forEach((t) => check(`renderVals returns {{ ${t} }}`, Object.prototype.hasOwnProperty.call(vals, t)));

  /* The loop-scoped ones — validate-bindings.js skips these by design, same as
     the Registration panel's rp/rw/rm above, so this is the only thing
     checking a roster row actually carries what the markup asks of it. */
  check('teamPlayerRows is a real list', Array.isArray(vals.teamPlayerRows) && vals.teamPlayerRows.length === 1);
  (scoped.get('p') ? [...scoped.get('p')] : []).forEach((prop) => {
    check(`every roster row carries p.${prop}`, prop in vals.teamPlayerRows[0]);
  });
  /* And the dropdown option lists the row's selects read from — reused from
     the player form, not a second copy. */
  ['dobDayOptions', 'dobMonthOptions', 'dobYearOptions'].forEach((t) =>
    check(`renderVals returns {{ ${t} }} for the roster dropdowns too`, Array.isArray(vals[t]) && vals[t].length > 0));
} catch (e) {
  check('the roster row bindings could be checked', false, e.stack || e.message);
}

/* ======================================================================== */
section('fmtCountdown reads like a person wrote it');

eq('two weeks out', REG.fmtCountdown(14 * 86400000), 'in 14 days');
eq('two days out', REG.fmtCountdown(2 * 86400000), 'in 2 days');
eq('inside 48 hours it says tomorrow rather than "in 1 day"', REG.fmtCountdown(30 * 3600000), 'tomorrow');
eq('six hours out', REG.fmtCountdown(6 * 3600000), 'in 6 hours');
eq('one hour out', REG.fmtCountdown(3600000), 'in 1 hour');
eq('forty minutes out', REG.fmtCountdown(40 * 60000), 'in 40 minutes');
eq('thirty seconds out', REG.fmtCountdown(30000), 'in 30 seconds');
eq('already open: nothing', REG.fmtCountdown(0), '');
eq('in the past: nothing', REG.fmtCountdown(-5000), '');
eq('not a number: nothing', REG.fmtCountdown(null), '');
check('it rounds DOWN, so 47 hours is never "in 2 days"', REG.fmtCountdown(47 * 3600000) === 'tomorrow');

/* ======================================================================
   FAULTS THIS FILE WAS PROVEN AGAINST — `node _prove-registration.js`.
   Five are aimed at this file, and each is caught by the named check:

     • the panel stops calling the shared validateSettings
         → "the Registration panel calls the shared validateSettings"
     • organizer-data.js grows its own copy of registrationState
         → "organizer-data.js does not define its own registrationState"
     • the Register buttons stop being gated on the window
         → "Register a team is gated on the window being open"
     • the TEST MODE strip is disconnected from forced-open
         → "the TEST MODE strip shows when the window is forced open"
     • the homepage falls back to OPEN before the fetch lands
         → "the page is CLOSED before the window has loaded"

   The fourth of those is the one that matters most. It is the difference
   between a page that fails to a shut form and a page that fails to an open
   one, and it is invisible in normal use — the fetch is fast, so the wrong
   version looks identical to the right one on every machine anyone would test
   it on.

   Two of this file's checks were also written wrong first: the {{ token }}
   extractor counted `hint-placeholder-val="{{ false }}"` and bare sc-for loop
   variables as bindings, so it failed on correct markup. A check that fails on
   correct markup gets deleted rather than fixed, so it is filtered properly now
   and the reason is written above tokensIn().
   ====================================================================== */

/* ====================================================================== */
/* From here down the checks drive async submit handlers, so they live inside
   main(). Node 22 in CommonJS has no top-level await. */
async function main() {

section('Submitting: the page and the gateway');

/* WHAT CHANGED ON 28 JULY 2026. Both forms used to POST to '/' and Netlify
   Forms caught them before any of our code ran — so there was nowhere to stand
   and refuse one. They now post JSON to our own function, and the reply carries
   a sentence written for a coach.

   THE DISTINCTION THAT MATTERS is between a refusal and a network failure.
   A refusal means "we received this and it is wrong" — show what we said, and
   keep the form so it can be fixed. A network failure means "we do not know
   whether we received it" — tell them to try again. Telling a coach to check
   their connection when the real answer is "that squad is one player over"
   sends them round in circles for ever. */

/* Drives a real submit handler against a fake fetch. Returns what the page
   ended up showing. */
async function submitWith(fetchImpl, which, formPatch) {
  const c = build('Quins JRT.dc.html');
  const g = (typeof globalThis !== 'undefined') ? globalThis : global;
  const realFetch = g.fetch;
  g.fetch = fetchImpl;
  try {
    if (which === 'team') {
      c.state = { ...c.state, teamForm: { ...c.state.teamForm,
        club: 'Test Club', ageGroup: 'U16B Contact', preferredPool: 'No preference',
        headCoachName: 'A Coach', headCoachEmail: 'coach@example.com',
        headCoachPhone: '', managerName: '', managerEmail: '', managerPhone: '',
        numPlayers: '2', notes: '', players: [], ...(formPatch || {}) } };
      await c.submitTeam();
    } else {
      c.state = { ...c.state, playerForm: { ...c.state.playerForm,
        playerFirstName: 'Test', playerLastName: 'Player', dob: '2011-01-01',
        club: 'Test Club', ageGroup: '',
        parentFirstName: 'Parent', parentLastName: 'Surname',
        parentEmail: 'parent@example.com', parentPhone: '',
        emergencyFirstName: 'Emergency', emergencyLastName: 'Contact',
        emergencyPhone: '500000000', medicalNotes: '',
        consent: true, playUpConsent: false, ...(formPatch || {}) } };
      await c.submitPlayer();
    }
  } finally { g.fetch = realFetch; }
  return c.state;
}

const okReply = (body) => async () => ({ ok: true, status: 200, json: async () => ({ ok: true, ...(body || {}) }) });
const refusal = (error, status) => async () => ({ ok: false, status: status || 400, json: async () => ({ ok: false, error }) });
const dead = () => { throw new TypeError('Failed to fetch'); };

/* ---- where it posts ---------------------------------------------------- */

{
  let seen = null;
  await submitWith(async (url, opts) => { seen = { url, opts }; return { ok: true, status: 200, json: async () => ({ ok: true, teamCode: 'TST1' }) }; }, 'team');
  eq('it posts to our own function, not to Netlify Forms',
    seen && seen.url, '/.netlify/functions/submit-registration');
  eq('…by POST', seen.opts.method, 'POST');
  eq('…as JSON', seen.opts.headers['Content-Type'], 'application/json');
  const sent = JSON.parse(seen.opts.body);
  eq('…naming the form in the body', sent.form, 'team-registration');
  check('…with the fields under data', sent.data && sent.data.club === 'Test Club');
  check('…and no form-name field left over from Netlify Forms',
    !('form-name' in sent.data), Object.keys(sent.data).join());
  check('the page no longer posts to the site root at all',
    !/fetch\('\/'/.test(readRepo('Quins JRT.dc.html')));
}

/* ---- a success --------------------------------------------------------- */

{
  const st = await submitWith(okReply({ teamCode: 'TST1' }), 'team');
  check('the success screen shows', st.teamSubmitted === true);
  check('…with no error', !st.teamError);
  eq('…and the team code the server issued', st.teamCode, 'TST1');
  check('…and the form is cleared', st.teamForm.club === '');
  check('the submitting flag is put back', st.teamSubmitting === false);
}
{
  const st = await submitWith(okReply(), 'player');
  check('a player submission succeeds too', st.playerSubmitted === true);
  check('…and the form is cleared', st.playerForm.playerFirstName === '');
}

/* ---- a refusal --------------------------------------------------------- */

{
  const msg = 'U16B Contact squads are a maximum of 18 players and you have listed 19. Please remove 1.';
  const st = await submitWith(refusal(msg), 'team');
  eq('the coach is shown what the SERVER said', st.teamError, msg);
  check('…and is NOT told to check their connection',
    !/connection/i.test(st.teamError), st.teamError);
  check('the success screen does not show', st.teamSubmitted !== true);
  /* THE ONE THAT WOULD HURT. Clearing the form on a refusal means the coach
     retypes fifteen players to fix one. */
  eq('…and the form is kept so it can be fixed', st.teamForm.club, 'Test Club');
}
{
  const st = await submitWith(refusal('Registration is not open at the moment. Please email admin@adhjrt.com.', 403), 'player');
  check('a closed window is shown in the server’s words',
    /not open/i.test(st.playerError), st.playerError);
  check('…and the player form is kept', st.playerForm.playerFirstName === 'Test');
  check('…and the error survives a field edit', st.playerSendFailed === true);
}
{
  /* A 200 carrying ok:false is still a refusal. Only reading res.ok would miss
     it, and the old code read nothing at all. */
  const st = await submitWith(async () => ({ ok: true, status: 200, json: async () => ({ ok: false, error: 'Nope.' }) }), 'team');
  eq('ok:false in a 200 is still a refusal', st.teamError, 'Nope.');
  check('…and not a success', st.teamSubmitted !== true);
}

/* ---- a network failure ------------------------------------------------- */

{
  const st = await submitWith(dead, 'team');
  check('a dead connection says try again', /try again|Check your connection/i.test(st.teamError), st.teamError);
  check('…and does not claim the entry was registered',
    /nothing has been registered/i.test(st.teamError), st.teamError);
  check('the success screen does not show', st.teamSubmitted !== true);
  check('…and the form is kept', st.teamForm.club === 'Test Club');
}
{
  /* A reply that is not JSON means something answered instead of our function —
     a proxy, a captive portal, the platform password page. That is "we do not
     know", not "you are wrong". */
  const st = await submitWith(async () => ({ ok: true, status: 200, json: async () => { throw new Error('not json'); } }), 'team');
  check('an unparseable reply is treated as a network failure',
    /nothing has been registered/i.test(st.teamError), st.teamError);
}
{
  const st = await submitWith(async () => ({ ok: false, status: 502, json: async () => { throw new Error('html'); } }), 'team');
  check('a gateway error page is a network failure too',
    /nothing has been registered/i.test(st.teamError), st.teamError);
}

/* ---- the client checks still run first --------------------------------- */

/* They are not redundant. They give instant feedback without a round trip, and
   the server is the authority, not the replacement. */
{
  let called = false;
  const st = await submitWith(async () => { called = true; return { ok: true, status: 200, json: async () => ({ ok: true }) }; },
    'team', { club: '' });
  check('an obviously incomplete form is caught before any request', called === false);
  check('…and says so', !!st.teamError);
}

/* ---- the markup ---------------------------------------------------------- */

{
  const page = readRepo('Quins JRT.dc.html').replace(/\r\n/g, '\n');
  check('the Netlify Forms encoder is gone', !/function encodeFormData/.test(page));
  check('…and nothing still calls it', !/encodeFormData\(/.test(page));
  check('the network message exists once, as a constant', (page.match(/const NETWORK_MESSAGE/g) || []).length === 1);
  check('SubmitError carries the distinction', /class SubmitError/.test(page) && /isNetwork/.test(page));
  const c = build('Quins JRT.dc.html');
  c.state = { ...c.state, teamSubmitted: true, teamCode: 'TST1' };
  const vals = c.renderVals();
  eq('the team code is a binding the page can show', vals.teamCode, 'TST1');
  check('…and is only shown when there is one', vals.teamHasCode === true);
  const c2 = build('Quins JRT.dc.html');
  eq('…with nothing shown before a submission', c2.renderVals().teamHasCode, false);
}

/* ---- sub-project 2: the roster's ages, driven through the real component ---- */

/* No new rule: _rosterPlayerAgeCheck() reuses _playerAgeCheck() (see
   claude/spec-age-validation.md, claude/plan-age-validation.md), so this
   drives the actual page code rather than a re-implementation of the rule. */
const rosterDobAtCutoffAge = (age) => `${2026 - age}-01-01`;
{
  const dobAtCutoffAge = rosterDobAtCutoffAge;

  /* A blank, untouched row must never show a false alarm — every roster
     starts with several of them. */
  const c = build('Quins JRT.dc.html');
  c.state = { ...c.state, teamForm: { ...c.state.teamForm, ageGroup: 'U16B Contact',
    players: [{ firstName: '', lastName: '', dob: '', dobDay: '', dobMonth: '', dobYear: '' }] } };
  const row = c.renderVals().teamPlayerRows[0];
  check('an untouched row shows nothing', !row.ageBlockedMessage && !row.agePlayUpMessage && !row.missingDob, JSON.stringify(row));
}
{
  /* A named row with an impossible date shows "doesn't exist", not the
     missing-dob message — the two must not both fire on the same row. */
  const c = build('Quins JRT.dc.html');
  c.state = { ...c.state, teamForm: { ...c.state.teamForm, ageGroup: 'U16B Contact',
    players: [{ firstName: 'A', lastName: 'Player', dob: '', dobDay: '31', dobMonth: '02', dobYear: '2011' }] } };
  const row = c.renderVals().teamPlayerRows[0];
  check('31 February shows as impossible', row.dobImpossible === true);
  check('…not as a missing dob', row.missingDob === false);
}
{
  /* A named row with a play-up dob is flagged amber, not blocked, and the
     message names the group it actually fits. */
  const c = build('Quins JRT.dc.html');
  c.state = { ...c.state, teamForm: { ...c.state.teamForm, ageGroup: 'U16B Contact',
    players: [{ firstName: 'Play', lastName: 'Up', dob: rosterDobAtCutoffAge(13), dobDay: '1', dobMonth: '01', dobYear: '2013' }] } };
  const row = c.renderVals().teamPlayerRows[0];
  check('a play-up row is flagged, not blocked', !row.ageBlockedMessage && !!row.agePlayUpMessage, JSON.stringify(row));
  check('…naming U14B Contact', /U14B Contact/.test(row.agePlayUpMessage), row.agePlayUpMessage);
}
{
  /* A named row two groups out is blocked, red, on the row. */
  const c = build('Quins JRT.dc.html');
  c.state = { ...c.state, teamForm: { ...c.state.teamForm, ageGroup: 'U16B Contact',
    players: [{ firstName: 'Too', lastName: 'Old', dob: rosterDobAtCutoffAge(30), dobDay: '1', dobMonth: '01', dobYear: '1996' }] } };
  const row = c.renderVals().teamPlayerRows[0];
  check('an out-of-range row is blocked', !!row.ageBlockedMessage && !row.agePlayUpMessage, JSON.stringify(row));
}

/* ---- the submit-time gate ---- */

{
  /* A named row with no dob is caught before any request — same pattern the
     "obviously incomplete form" check above uses. */
  let called = false;
  const st = await submitWith(async () => { called = true; return { ok: true, status: 200, json: async () => ({ ok: true }) }; },
    'team', { ageGroup: 'U16B Contact', players: [{ firstName: 'A', lastName: 'Player', dob: '', dobDay: '', dobMonth: '', dobYear: '' }] });
  check('a named row missing its dob is caught before any request', called === false);
  eq('…with the missing-dob sentence', st.teamError, 'Please give a date of birth for every named player.');
}
{
  /* A blocked row is caught before any request; the generic message points at
     the row, matching _playerFormError()'s "resolve the age group mismatch
     below" pattern rather than repeating the row's own sentence twice. */
  let called = false;
  const st = await submitWith(async () => { called = true; return { ok: true, status: 200, json: async () => ({ ok: true }) }; },
    'team', { ageGroup: 'U16B Contact', players: [{ firstName: 'Too', lastName: 'Old', dob: '1996-01-01' }] });
  check('a blocked row is caught before any request', called === false);
  eq('…with the generic pointer sentence', st.teamError, 'Please resolve the age issues flagged below before submitting.');
}
{
  /* A play-up row is NOT gated — the coach cannot consent for a parent, so
     the squad still submits. This is the check that most directly proves
     spec decision 1 actually holds in the client code, not just the server. */
  let called = false;
  const st = await submitWith(async () => { called = true; return { ok: true, status: 200, json: async () => ({ ok: true, teamCode: 'TST1' }) }; },
    'team', { ageGroup: 'U16B Contact', players: [{ firstName: 'Play', lastName: 'Up', dob: '2013-01-01' }] });
  check('a play-up row is allowed through to the server', called === true);
  check('…and the squad actually submits', st.teamSubmitted === true, st.teamError);
}
{
  /* An UNTOUCHED blank row (never given a name) must never block a squad that
     is otherwise complete — every roster starts with one. */
  let called = false;
  const st = await submitWith(async () => { called = true; return { ok: true, status: 200, json: async () => ({ ok: true, teamCode: 'TST1' }) }; },
    'team', { ageGroup: 'U16B Contact', players: [{ firstName: '', lastName: '', dob: '', dobDay: '', dobMonth: '', dobYear: '' }] });
  check('an untouched blank row does not block submission', called === true, st.teamError);
}

}

main().then(() => summary('test-registration-panel.js'));
