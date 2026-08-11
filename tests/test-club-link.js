/* tests/test-club-link.js
   ---------------------------------------------------------------------------
   The Club invite link box on /organizer.
   Spec: claude/specs/spec-club-invite-link.md

   ⚠️ THE HEADLINE RISK IS A LEAK, NOT A BUG. The stored link carries
   CLUB_FORM_KEY, which is the only thing protecting the club form — the page
   being unlisted is not protection, because this repo is public and the path is
   readable in the source. This endpoint is modelled on registration-window.js,
   whose GET is deliberately PUBLIC, and copying that shape wholesale would have
   published the key to anybody who asked. So the first thing driven here is
   that a signed-out and a manager caller are refused on GET as well as POST.

   ⚠️ AND THE KEY MUST NEVER COME BACK IN A RESPONSE. Asserted with a
   distinctive value set in the environment and swept for down every path,
   including the refusals and the error paths — the same discipline as the
   registration gateway's "no field value may reach a log".
*/

const Module = require('module');
const path = require('path');
const { section, check, eq, summary, readRepo, repoRoot } = require('./_lib');

const FN = path.join(repoRoot(), 'netlify', 'functions');

let SAVED = null;
let THROW_ON_READ = false;

const stubs = {
  '@netlify/blobs': {
    getStore: () => ({
      get: async () => { if (THROW_ON_READ) throw new Error('simulated outage'); return SAVED; },
      setJSON: async (k, v) => { SAVED = v; },
      set: async () => {},
      delete: async () => { SAVED = null; },
      list: async () => ({ blobs: [] }),
    }),
  },
  'google-auth-library': { OAuth2Client: function () { return { verifyIdToken: async () => ({ getPayload: () => ({}) }) }; } },
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

/* ⚠️ A DISTINCTIVE SENTINEL, so "the key did not leak" cannot pass by the value
   being something that would not show up anyway (like '' or 'test'). */
const REAL_KEY = 'SENTINEL-club-key-9d3f7a';
process.env.CLUB_FORM_KEY = REAL_KEY;

const GOOD = 'https://adhjrt.com/register-club?k=' + REAL_KEY;
const WRONG = 'https://adhjrt.com/register-club?k=an-old-rotated-key';

/* ⚠️ accounts must answer: resolveSession re-reads the account behind every
   token, so a null list means "this login no longer exists" and everything
   401s — which would make every check below pass for the wrong reason. */
const ACCOUNTS = [
  { username: 'org', role: 'organizer', approved: true, name: 'O', createdAt: '2026-08-01' },
  { username: 'mgr', role: 'manager', ageGroupId: 'u16b', approved: true, name: 'M', createdAt: '2026-08-01' },
];
stubs['@netlify/blobs'].getStore = (name) => ({
  /* ⚠️ THE OUTAGE IS SCOPED TO THIS CARD'S OWN KEY, and the first version was
     not. Throwing for every key took the ACCOUNTS read down too, so
     resolveSession answered 503 long before club-link was reached — and the
     check "a store outage still answers 200" failed against code that was
     behaving correctly. A fault has to be aimed at the thing under test. */
  get: async (key) => {
    if (key === 'list') return ACCOUNTS;
    if (THROW_ON_READ) throw new Error('simulated outage');
    return SAVED;
  },
  setJSON: async (k, v) => { SAVED = v; },
  set: async () => {},
  delete: async () => { SAVED = null; },
  list: async () => ({ blobs: [] }),
});

const { sign } = require(path.join(FN, '_auth.js'));
const fn = require(path.join(FN, 'club-link.js'));

const ORG = sign({ username: 'org', role: 'organizer' });
const MGR = sign({ username: 'mgr', role: 'manager', ageGroupId: 'u16b' });

async function call(method, token, body) {
  const ev = { httpMethod: method, headers: token ? { authorization: 'Bearer ' + token } : {}, body: body ? JSON.stringify(body) : null };
  let res;
  try { res = await fn.handler(ev); } catch (e) { return { status: 0, json: {}, raw: 'THREW: ' + e.message }; }
  let json = {};
  try { json = JSON.parse(res.body) || {}; } catch (e) { /* not json */ }
  return { status: res.statusCode, json, raw: res.body || '' };
}

const seen = [];   // every response body, for the leak sweep at the end

async function drive(method, token, body) {
  const r = await call(method, token, body);
  seen.push(r.raw);
  return r;
}

/* ====================================================================== */
section('⚠️ Organiser-only on BOTH methods — this one holds a secret');

(async () => {
  {
    const g = await drive('GET', null);
    const p = await drive('POST', null, { link: GOOD });
    check('signed out cannot READ the link', g.status === 401 || g.status === 403, String(g.status));
    check('signed out cannot WRITE it', p.status === 401 || p.status === 403, String(p.status));
  }
  {
    /* ⚠️ THE ONE THAT MATTERS. registration-window.js — the endpoint this is
       modelled on — answers a PUBLIC GET, and copying that would have handed
       the club key to every manager. */
    const g = await drive('GET', MGR);
    const p = await drive('POST', MGR, { link: GOOD });
    eq('⚠️ a MANAGER cannot read the link', g.status, 403);
    eq('…nor write it', p.status, 403);
  }
  {
    /* CONTROL. Without it, every refusal above is also satisfied by an endpoint
       that refuses everybody, which would prove nothing at all. */
    SAVED = null;
    const g = await drive('GET', ORG);
    eq('CONTROL: an organiser CAN read it', g.status, 200);
    check('…and it is empty to begin with', g.json.link === '' && g.json.status === 'empty');
  }

  /* ====================================================================== */
  section('The four states the card reports');

  {
    SAVED = null;
    const r = await drive('GET', ORG);
    eq('nothing saved reads as empty', r.json.status, 'empty');
  }
  {
    const r = await drive('POST', ORG, { link: GOOD });
    eq('a link matching the live key saves', r.status, 200);
    eq('…and reports working', r.json.status, 'working');
  }
  {
    /* ⚠️ THE DRIFT THIS CARD EXISTS FOR. The key now lives in two places, and
       rotating it in Netlify leaves the saved link LOOKING fine while dead. */
    const r = await drive('POST', ORG, { link: WRONG });
    eq('a link with a rotated key is still ACCEPTED', r.status, 200);
    eq('⚠️ …but reported as stale, not silently fine', r.json.status, 'stale');
  }
  {
    /* Not a broken link — the form is switched off at the Netlify end, which is
       the deliberate off switch. Calling it "no longer works" sends somebody
       looking for the wrong problem. */
    process.env.CLUB_FORM_KEY = '';
    const r = await drive('GET', ORG);
    eq('⚠️ an unset CLUB_FORM_KEY reads as OFF, not as stale', r.json.status, 'off');
    process.env.CLUB_FORM_KEY = REAL_KEY;
  }

  /* ====================================================================== */
  section('Saving, refusing and clearing');

  {
    const r = await drive('POST', ORG, { link: 'not a link' });
    eq('junk is refused', r.status, 400);
    const empty = await drive('POST', ORG, { link: '   ' });
    /* ⚠️ An empty box is NOT a way to clear it — Clear is its own action, so
       emptying the field by accident and pressing Save cannot wipe it. */
    eq('⚠️ an empty save is refused rather than treated as a clear', empty.status, 400);
    check('…and the stored link survives it', !!(SAVED && SAVED.link));
  }
  {
    const r = await drive('POST', ORG, { clear: true });
    eq('clear succeeds', r.status, 200);
    eq('…and empties the store', SAVED, null);
  }
  {
    await drive('POST', ORG, { link: GOOD });
    THROW_ON_READ = true;
    const r = await drive('GET', ORG);
    THROW_ON_READ = false;
    /* Fails SOFT on read: a card that cannot load must not take the Clubs tab
       down with it — the tab's real job is the declared-vs-registered table. */
    eq('a store outage still answers 200', r.status, 200);
    eq('…reporting nothing saved rather than erroring', r.json.status, 'empty');
  }

  /* ====================================================================== */
  section('⚠️ The key itself never comes back in a response');

  {
    /* Swept over EVERY response captured above — successes, refusals and
       errors alike. The link legitimately contains the key when an organiser
       reads it back, which is the point of the card, so that one case is
       excluded explicitly rather than by the sweep being loose. */
    const leaked = seen.filter((raw) => {
      if (!raw) return false;
      const body = (() => { try { return JSON.parse(raw); } catch (e) { return null; } })();
      if (body && typeof body.link === 'string' && body.link.includes(REAL_KEY)) {
        /* Allowed: the organiser reading back the link they saved. Strip it and
           check nothing ELSE in the response carries the key. */
        return JSON.stringify({ ...body, link: '' }).includes(REAL_KEY);
      }
      return raw.includes(REAL_KEY);
    });
    check(`CONTROL: responses were actually captured (${seen.length})`, seen.length > 8);
    check('⚠️ no response echoes CLUB_FORM_KEY outside the saved link itself',
      leaked.length === 0, leaked.slice(0, 2).join(' | '));
  }

  /* ====================================================================== */
  section('The page and the data layer agree');

  {
    const ORGP = readRepo('Organizer.dc.html');
    const OD = readRepo('organizer-data.js');
    ['clubLink', 'saveClubLink', 'clearClubLink'].forEach((f) => {
      check(`organizer-data exports ${f}()`, new RegExp('export async function ' + f + '\\b').test(OD));
    });
    check('the card is rendered on the Clubs tab', /Club invite link/.test(ORGP));
    /* ⚠️ Loaded when the tab OPENS, not at boot: it is an authenticated read of
       a secret, and fetching it on every /organizer load would put the club key
       on the wire for organisers who never open this tab. */
    check('⚠️ it loads when the tab is opened, not on every page load',
      /showClubs: \(\) => \{ this\.setState\(\{ tab: 'clubs' \}\); this\.loadClubLink\(\); \}/.test(ORGP));
    check('the input has an accessible name', /aria-label="Club invite link"/.test(ORGP));
    /* Every {{ X }} the card uses must come back from renderVals, or it
       resolves silently to empty — the binding trap already recorded. */
    ['clubLinkShown', 'clubLinkStatusText', 'clubLinkStatusColour', 'clubLinkEditing',
      'clubLinkReading', 'clubLinkDraft', 'clubLinkSaveLabel', 'clubLinkHasSaved'].forEach((b) => {
      check(`renderVals returns ${b}`, new RegExp('\\b' + b + ':').test(ORGP));
    });
  }

  summary('test-club-link.js');
})();
