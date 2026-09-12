/* tests/test-save-club-names.js
   ---------------------------------------------------------------------------
   The organiser's OFFICIAL club names — netlify/functions/save-club-names.js (JRT-7).
   This WRITES the list the public dropdown reads, so it is organiser-only on
   every method (the public read is registered-clubs.js, tested separately).

   ⚠️ THE TWO-WAY REFUSAL. A dead/invalid session goes through sessionRefusal
   (carrying sessionEnded, so the client signs out); a signed-in NON-organiser
   (a manager) gets a plain 403 with NO sessionEnded, so a manager is refused
   without being logged out. The fault that routes the wrong-role case through
   sessionRefusal must make the "no sessionEnded" check fail.

   ⚠️ VALIDATE, DON'T COERCE, and CLEAR IS ITS OWN ACTION — the same doctrine as
   club-link.js: a blank Save is refused, never treated as a delete.
*/

const Module = require('module');
const path = require('path');
const { section, check, eq, summary, repoRoot, readRepo } = require('./_lib');

const FN = path.join(repoRoot(), 'netlify', 'functions');

let SAVED = null;          // the 'club-names' blob
let THROW_ON_WRITE = false;

/* resolveSession re-reads the account behind every token, so ACCOUNTS must
   answer or every call 401s and the checks pass for the wrong reason. */
const ACCOUNTS = [
  { username: 'org', role: 'organizer', approved: true, name: 'O', createdAt: '2026-08-01' },
  { username: 'mgr', role: 'manager', ageGroupId: 'u16b', approved: true, name: 'M', createdAt: '2026-08-01' },
];

const stubs = {
  '@netlify/blobs': {
    getStore: () => ({
      get: async (key) => {
        if (key === 'list') return ACCOUNTS;   // the accounts store, for resolveSession
        return SAVED;                            // the 'club-names' blob
      },
      setJSON: async (k, v) => { if (THROW_ON_WRITE) throw new Error('write outage'); SAVED = v; },
      set: async () => {},
      delete: async () => { SAVED = null; },
      list: async () => ({ blobs: [] }),
    }),
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

const { sign } = require(path.join(FN, '_auth.js'));
const fn = require(path.join(FN, 'save-club-names.js'));

const ORG = sign({ username: 'org', role: 'organizer' });
const MGR = sign({ username: 'mgr', role: 'manager', ageGroupId: 'u16b' });

async function call(method, token, body) {
  const ev = { httpMethod: method, headers: token ? { authorization: 'Bearer ' + token } : {}, body: body ? JSON.stringify(body) : null };
  const res = await fn.handler(ev);
  let json = {};
  try { json = JSON.parse(res.body) || {}; } catch (e) { /* not json */ }
  return { status: res.statusCode, json, raw: res.body || '' };
}

(async () => {
  section('⚠️ Organiser-only on both methods, and the two-way refusal');
  {
    SAVED = null;
    const go = await call('GET', null);
    const po = await call('POST', null, { club: 'X', officialName: 'X' });
    check('signed out cannot read', go.status === 401 || go.status === 403, String(go.status));
    check('signed out cannot write', po.status === 401 || po.status === 403, String(po.status));

    const gm = await call('GET', MGR);
    const pm = await call('POST', MGR, { club: 'X', officialName: 'X' });
    eq('a MANAGER cannot read', gm.status, 403);
    eq('…nor write', pm.status, 403);
    /* ⚠️ The deliberate split: a wrong-role refusal is NOT a session-ended one. */
    check('⚠️ the manager 403 does NOT carry sessionEnded (it is not a logout)',
      !gm.raw.includes('sessionEnded') && !pm.raw.includes('sessionEnded'));

    /* CONTROL — without it every refusal above is also satisfied by an endpoint
       that refuses everybody. */
    const g = await call('GET', ORG);
    eq('CONTROL: an organiser CAN read it', g.status, 200);
    check('…and it starts empty', JSON.stringify(g.json.names) === '{}' && g.json.rev === 0);
  }

  section('Set, normalise-keyed, and the single-key merge');
  {
    SAVED = null;
    const a = await call('POST', ORG, { club: 'Dubai Sharks', officialName: 'Dubai Sharks', rev: 0 });
    eq('an organiser names a club', a.status, 200);
    eq('…keyed by the NORMALISED declared name', a.json.names['dubai sharks'], 'Dubai Sharks');
    eq('…and the rev bumps to 1', a.json.rev, 1);

    const b = await call('POST', ORG, { club: 'City RFC', officialName: 'City', rev: 1 });
    eq('a second club names without clobbering the first', b.status, 200);
    const g = await call('GET', ORG);
    eq('…both survive (single-key merge, not whole-map replace)',
      JSON.stringify(Object.keys(g.json.names).sort()), JSON.stringify(['city', 'dubai sharks']));
    eq('…rev now 2', g.json.rev, 2);
  }

  section('⚠️ Validate, do not coerce; and injection guards');
  {
    SAVED = { v: 1, rev: 5, names: { keep: 'Keep' }, savedAt: '', savedBy: '' };
    const bad = (body) => call('POST', ORG, { club: 'Some Club', rev: 5, ...body });
    eq('a numeric officialName is refused, not coerced', (await bad({ officialName: 7 })).status, 400);
    eq('an array officialName is refused', (await bad({ officialName: ['x'] })).status, 400);
    eq('an object officialName is refused', (await bad({ officialName: { a: 1 } })).status, 400);
    eq('a blank officialName is refused (use Clear)', (await bad({ officialName: '   ' })).status, 400);
    eq('a leading = (formula) is refused', (await bad({ officialName: '=SUM(A1)' })).status, 400);
    eq('a leading + is refused', (await bad({ officialName: '+1' })).status, 400);
    eq('an over-long name is refused', (await bad({ officialName: 'x'.repeat(81) })).status, 400);
    eq('a rehearsal club is never named', (await call('POST', ORG, { club: 'Rehearsal Quins', officialName: 'Quins', rev: 5 })).status, 400);
    eq('a missing club is refused', (await call('POST', ORG, { officialName: 'X', rev: 5 })).status, 400);
    /* CONTROL: none of the refusals touched the store. */
    eq('⚠️ …and not one refusal changed the stored map', JSON.stringify(SAVED.names), JSON.stringify({ keep: 'Keep' }));
  }

  section('⚠️ The optimistic rev guard — no lost update');
  {
    SAVED = { v: 1, rev: 3, names: { a: 'A' }, savedAt: '', savedBy: '' };
    const stale = await call('POST', ORG, { club: 'New Club', officialName: 'New', rev: 1 });
    eq('a stale rev is refused 409, not written', stale.status, 409);
    check('…and hands back the fresh map and rev to retry with', stale.json.conflict === true && stale.json.rev === 3);
    check('…the stored map is untouched by the stale write', JSON.stringify(SAVED.names) === JSON.stringify({ a: 'A' }));
    const good = await call('POST', ORG, { club: 'New Club', officialName: 'New', rev: 3 });
    eq('the same save with the correct rev succeeds', good.status, 200);
    eq('…and the rev advances', good.json.rev, 4);
  }

  section('⚠️ Clear is its own action; a blank Save never deletes');
  {
    SAVED = { v: 1, rev: 2, names: { 'dubai sharks': 'Dubai Sharks' }, savedAt: '', savedBy: '' };
    const blank = await call('POST', ORG, { club: 'Dubai Sharks', officialName: '', rev: 2 });
    eq('a blank Save is refused', blank.status, 400);
    check('…and the name SURVIVES it', SAVED.names['dubai sharks'] === 'Dubai Sharks');

    const cleared = await call('POST', ORG, { club: 'Dubai Sharks', clear: true, rev: 2 });
    eq('Clear succeeds', cleared.status, 200);
    check('…and removes exactly that key', cleared.json.names['dubai sharks'] === undefined);
  }

  section('A write outage fails soft, not silent');
  {
    SAVED = { v: 1, rev: 1, names: {}, savedAt: '', savedBy: '' };
    THROW_ON_WRITE = true;
    const r = await call('POST', ORG, { club: 'A Club', officialName: 'A', rev: 1 });
    THROW_ON_WRITE = false;
    eq('a failed write reports 503, not a false success', r.status, 503);
  }

  section('The page and the data layer agree (wiring)');
  {
    const OD = readRepo('organizer-data.js');
    ['clubOfficialNames', 'saveClubOfficialName', 'clearClubOfficialName'].forEach((f) => {
      check(`organizer-data exports ${f}()`, new RegExp('export async function ' + f + '\\b').test(OD));
    });
    const ORGP = readRepo('Organizer.dc.html');
    /* Loaded when the Clubs tab OPENS (like the club link), not at boot. */
    check('the Clubs tab loads the official names on open',
      /showClubs: \(\) => \{[\s\S]{0,120}this\.loadClubOfficialNames\(\);/.test(ORGP));
    /* The clubRows must RETURN every binding the row markup uses, or it resolves
       silently to empty (the binding trap). */
    ['officialDraft', 'isNamed', 'namedBadge', 'onSaveOfficialName', 'onClearOfficialName', 'onOfficialNameInput']
      .forEach((b) => check(`clubRows returns ${b}`, new RegExp('\\b' + b + ':').test(ORGP)));
  }

  summary('test-save-club-names.js');
})();
