/* tests/test-registered-clubs.js
   ---------------------------------------------------------------------------
   The PUBLIC club list for the sign-up dropdown — netlify/functions/registered-clubs.js (JRT-7).

   ⚠️ THE HEADLINE RISK IS A PII LEAK. Each club-registration record carries the
   declaring club's contact name, email and phone, its notes, and its per-age
   team counts. This endpoint must return ONLY the official names of clubs that
   have BOTH registered AND been named by an organiser. A distinctive sentinel is
   planted in every personal field of a real record and swept for down EVERY path
   — success, empty, store-outage and the 405 — exactly the discipline
   test-club-link.js uses for CLUB_FORM_KEY. The fault that reuses the raw record
   (the realistic "just return the rows" mistake) must turn a sentinel up.

   ⚠️ AND IT IS THE HIDDEN-UNTIL-NAMED GATE. A registered club with no official
   name, a rehearsal, or a superseded declaration must NEVER appear. This is
   enforced HERE, on the server, not in the browser.
*/

const Module = require('module');
const path = require('path');
const { section, check, eq, summary, repoRoot } = require('./_lib');

const FN = path.join(repoRoot(), 'netlify', 'functions');

/* ⚠️ A distinctive sentinel in EVERY personal field, so "no PII leaked" cannot
   pass by the value being something that would not show up anyway. */
const SENT = {
  contact: 'SENTINEL-contact-name-a1',
  email: 'SENTINEL-email-b2',
  phone: 'SENTINEL-phone-c3',
  notes: 'SENTINEL-notes-d4',
  count: '9271',
};

let REG = {};       // key -> stored club-registration record
let NAMES = null;   // the 'config' store's 'club-names' blob, or null
let THROW_REG = false;
let THROW_CFG = false;

const stubs = {
  '@netlify/blobs': {
    getStore: (arg) => {
      const name = (typeof arg === 'string') ? arg : (arg && arg.name);
      if (name === 'config') {
        return {
          get: async (k) => { if (THROW_CFG) throw new Error('config outage'); return k === 'club-names' ? NAMES : null; },
          setJSON: async () => {}, set: async () => {}, delete: async () => {}, list: async () => ({ blobs: [] }),
        };
      }
      // the 'registrations' store
      return {
        list: async ({ prefix }) => {
          if (THROW_REG) throw new Error('registrations outage');
          return { blobs: Object.keys(REG).filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
        },
        get: async (key) => { if (THROW_REG) throw new Error('registrations outage'); return REG[key] || null; },
        setJSON: async () => {}, set: async () => {}, delete: async () => {},
      };
    },
  },
  bcryptjs: { hash: async (s) => 'h:' + s, compare: async () => false, hashSync: (s) => 'h:' + s, compareSync: () => false },
};
const realLoad = Module._load;
Module._load = function (request) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
  return realLoad.apply(this, arguments);
};

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-not-a-real-one';
process.env.BLOBS_SITE_ID = 'x';
process.env.BLOBS_TOKEN = 'x';

const { buildRecord } = require(path.join(FN, '_regstore.js'));
const { clubRow } = require(path.join(FN, '_intake.js'));
const fn = require(path.join(FN, 'registered-clubs.js'));

/* A real stored record — the row goes through the real clubRow() so the column
   order (club at index 1) is exactly what production writes, and every personal
   field carries its sentinel. `supersedes` optional. */
function clubRec(club, supersedes) {
  const data = {
    club,
    'contact-name': SENT.contact,
    'contact-email': SENT.email,
    'contact-phone': SENT.phone,
    notes: SENT.notes,
    'teams-u12g': SENT.count,
  };
  return buildRecord({
    form: 'club-registration',
    row: clubRow(data, '2026-10-01T00:00:00.000Z'),
    nowMs: Date.parse('2026-10-01T00:00:00.000Z'),
    club,
    supersedes,
  });
}

const seen = []; // every response body, for the leak sweep
async function drive(method) {
  const res = await fn.handler({ httpMethod: method });
  seen.push(res.body || '');
  let json = {};
  try { json = JSON.parse(res.body) || {}; } catch (e) { /* not json */ }
  return { status: res.statusCode, json, raw: res.body || '' };
}

(async () => {
  section('The four states, and the CONTROL that it is deliberately PUBLIC');
  {
    REG = {}; NAMES = null;
    const r = await drive('GET');
    /* CONTROL: unlike club-link.js (organiser-gated), this GET is PUBLIC — a
       signed-out caller gets 200, because a club list is a public fact. */
    eq('a signed-out GET is answered (public), not refused', r.status, 200);
    eq('nothing registered reads as an empty list', JSON.stringify(r.json.clubs), '[]');
    eq('…and not unavailable', r.json.unavailable, undefined);
  }

  section('⚠️ Hidden-until-named, rehearsals and supersedes — the gate');
  {
    REG = {
      'club/1': clubRec('Dubai Sharks'),          // named
      'club/2': clubRec('DUBAI SHARKS RFC'),      // same club (suffix), named -> MERGES
      'club/3': clubRec('City Rugby'),            // registered, NOT named -> hidden
      'club/4': clubRec('Rehearsal Falcons'),     // rehearsal, even if named -> hidden
      'club/5': clubRec('Old Name'),              // superseded by club/6 -> hidden
      'club/6': clubRec('Alba Thistle', 'club/5'),// supersedes club/5, named
    };
    NAMES = { names: {
      'dubai sharks': 'Dubai Sharks',
      'rehearsal falcons': 'Falcons',
      'old name': 'Should Not Appear',
      'alba thistle': 'Alba Thistle',
    } };
    const r = await drive('GET');
    eq('only registered AND named clubs appear, sorted',
      JSON.stringify(r.json.clubs), JSON.stringify(['Alba Thistle', 'Dubai Sharks']));
    check('⚠️ an unnamed registered club (City Rugby) is HIDDEN', !r.raw.includes('City'));
    check('⚠️ a rehearsal (Falcons) is HIDDEN even though it is named', !r.raw.includes('Falcons'));
    check('⚠️ a superseded declaration is HIDDEN (its name never appears)', !r.raw.includes('Should Not Appear'));
    check('two spellings of one club MERGE to a single entry',
      r.json.clubs.filter((c) => c === 'Dubai Sharks').length === 1);
  }

  section('⚠️ Names only — no contact detail, count or note ever crosses');
  {
    /* Swept over EVERY captured body so far — successes and the empty state.
       CONTROL: an official name IS present, so an endpoint returning [] cannot
       pass this vacuously. Searched one term at a time (no alternation). */
    const leaks = [SENT.contact, SENT.email, SENT.phone, SENT.notes, SENT.count]
      .filter((s) => seen.some((raw) => raw.includes(s)));
    check(`CONTROL: bodies were captured (${seen.length})`, seen.length >= 2);
    check('CONTROL: an official name IS returned, so the sweep is not vacuous',
      seen.some((raw) => raw.includes('Dubai Sharks')));
    check('⚠️ no contact name / email / phone / notes / team count is ever in a body',
      leaks.length === 0, leaks.slice(0, 2).join(' | '));
    /* And the RAW declared name is never echoed — it is a lookup key, discarded. */
    check('⚠️ a declared name is never echoed (only the official name is)',
      !seen.some((raw) => raw.includes('DUBAI SHARKS RFC') || raw.includes('City Rugby')));
  }

  section('Fails SOFT on a store outage — an empty list, never the declared names');
  {
    REG = {
      'club/1': clubRec('Dubai Sharks'),
      'club/3': clubRec('City Rugby'),
    };
    NAMES = { names: { 'dubai sharks': 'Dubai Sharks' } };

    THROW_REG = true;
    const a = await drive('GET');
    THROW_REG = false;
    eq('a registrations outage still answers 200', a.status, 200);
    eq('…reporting nothing rather than erroring', JSON.stringify(a.json.clubs), '[]');
    eq('…and flags it unavailable', a.json.unavailable, true);
    check('⚠️ …and does NOT fall back to declared names', !a.raw.includes('City') && !a.raw.includes('SENTINEL'));

    THROW_CFG = true;
    const b = await drive('GET');
    THROW_CFG = false;
    eq('a config (names) outage also answers 200 unavailable', b.status, 200);
    eq('…empty', JSON.stringify(b.json.clubs), '[]');
    check('…no PII on the outage path either', ![SENT.contact, SENT.email, SENT.phone].some((s) => b.raw.includes(s)));
  }

  section('Method and shape');
  {
    const r = await drive('POST');
    eq('a POST is refused 405 (this endpoint only reads)', r.status, 405);
    /* Final leak sweep including the 405 and outage bodies. */
    const leaks = [SENT.contact, SENT.email, SENT.phone, SENT.notes]
      .filter((s) => seen.some((raw) => raw.includes(s)));
    check('⚠️ still no PII across EVERY path, 405 and outage included', leaks.length === 0, leaks.join(' | '));
  }

  section('The page and the data layer agree (wiring)');
  {
    const { readRepo } = require('./_lib');
    const SD = readRepo('scores-data.js');
    const HOME = readRepo('Quins JRT.dc.html');
    check('scores-data.js exports loadClubs()', /export async function loadClubs\(\)/.test(SD));
    check('loadClubs caches only a NON-EMPTY list (so a failure can retry)',
      /if \(list\.length\) LIVE_CLUBS = list;/.test(SD));
    /* Strip HTML comments first so tombstones quoting __other__/CLUB_NAMES do not
       false-match; pair the negative with a positive control. */
    const home = HOME.replace(/<!--[\s\S]*?-->/g, '');
    check('the sign-up page fetches the club list (refreshClubs -> api.loadClubs)',
      /api\.loadClubs\(\)/.test(home));
    check('the dropdown binds the fetched state.clubs with a CLUB_NAMES fallback',
      /clubOptions: \(this\.state\.clubs && this\.state\.clubs\.length\) \? this\.state\.clubs : CLUB_NAMES/.test(home));
    check('CONTROL: CLUB_NAMES still exists as the outage fallback (never deleted)',
      /const CLUB_NAMES = \[/.test(home));
    check('⚠️ the free-text "Other" club option is GONE from both forms',
      !/value="__other__"/.test(home));
    check('CONTROL: the club <select> is still there (only its escape hatch went)',
      /onChange="\{\{ onTeamClub \}\}"/.test(home));
  }

  summary('test-registered-clubs.js');
})();
