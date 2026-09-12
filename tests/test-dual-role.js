/* tests/test-dual-role.js
   ------------------------------------------------------------------------
   Dual-role accounts (JRT-37): one login can be an organiser AND the named
   manager of an age group, carried as an identity-only `manages` list.
   Decision: claude/decisions/2026-09-12-dual-role-accounts.md.

   THE ONE THAT MATTERS MOST is "a manager whose manages names another group
   still cannot access it": `manages` is IDENTITY ONLY and must never reach an
   authorization decision. That is the whole safety guarantee of the feature.

   DRIVEN, NOT GREPPED where it counts: the real _auth.js resolveSession /
   hasAgeGroupAccess and the real accounts-admin handler run against an
   in-memory accounts blob, so a fault in the code fails a NAMED check here.
   The module-level `accountsList` IS the stored list — a test mutates the
   stored account between two resolveSession calls to prove the live read.

   ⚠️ Every value here is invented. */

const path = require('path');
const Module = require('module');
const { readRepo, repoRoot, section, check, eq, summary } = require('./_lib');

/* ---- stubs (same shape as test-draw-rights.js) -------------------------- */
let accountsList = [];
const stubs = {
  '@netlify/blobs': {
    getStore: (arg) => {
      const name = typeof arg === 'string' ? arg : (arg && arg.name);
      if (name === 'accounts') {
        return {
          async get(key) { return key === 'list' ? accountsList : null; },
          async setJSON(key, value) { if (key === 'list') accountsList = value; },
          async delete() {}, async list() { return { blobs: [] }; },
        };
      }
      return { async get() { return null; }, async setJSON() {}, async delete() {}, async list() { return { blobs: [] }; } };
    },
  },
  bcryptjs: { hashSync: (p) => `hashed:${p}`, compareSync: (p, h) => h === `hashed:${p}`, hash: async (p) => `hashed:${p}`, compare: async (p, h) => h === `hashed:${p}` },
};
const realResolve = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) { return Object.prototype.hasOwnProperty.call(stubs, r) ? 'STUB:' + r : realResolve.call(this, r, ...rest); };
const realLoad = Module._load;
Module._load = function (r, ...rest) { return Object.prototype.hasOwnProperty.call(stubs, r) ? stubs[r] : realLoad.call(this, r, ...rest); };
process.env.SESSION_SECRET = 'test-not-a-real-value';

const FN = path.join(repoRoot(), 'netlify', 'functions');
const auth = require(path.join(FN, '_auth.js'));   // resolveSession, hasAgeGroupAccess, managedGroupsOf, sign
const admin = require(path.join(FN, 'accounts-admin.js'));

const evOf = (token) => ({ headers: { authorization: `Bearer ${token}` } });
const tokenFor = (u) => {
  const a = accountsList.find((x) => x.username === u) || {};
  return auth.sign(a.role === 'organizer' ? { username: u, role: 'organizer' } : { username: u, role: 'manager', ageGroupId: a.ageGroupId });
};
const call = (u, body) => admin.handler({ httpMethod: 'POST', headers: { authorization: `Bearer ${tokenFor(u)}` }, body: JSON.stringify(body) });
const parse = async (res) => ({ status: res.statusCode, ...JSON.parse(res.body || '{}') });
const stored = (u) => accountsList.find((x) => x.username === u) || {};

async function main() {

/* ====================================================================== */
section('resolveSession surfaces `manages` LIVE, gated on the organiser role');
{
  accountsList = [{ username: 'jay', name: 'Jay', role: 'organizer', title: 'Organizer', approved: true, manages: ['u16b'] }];
  const token = auth.sign({ username: 'jay', role: 'organizer' });   // ONE token, minted once — carries NO manages

  const r1 = await auth.resolveSession(evOf(token));
  check('an organiser session carries its manages list', r1.ok && JSON.stringify(r1.session.manages) === JSON.stringify(['u16b']), JSON.stringify(r1.session && r1.session.manages));

  /* ⚠️ MOVE THE STORED VALUE, KEEP THE TOKEN. This is the real discriminator:
     the token never carries `manages`, so only a read from the ACCOUNT can see
     the change. A fault that reads payload.manages is caught right here. */
  accountsList[0].manages = ['u16b', 'u18b'];
  const r2 = await auth.resolveSession(evOf(token));
  check('resolveSession reads manages live from the stored account',
    r2.ok && JSON.stringify(r2.session.manages) === JSON.stringify(['u16b', 'u18b']), JSON.stringify(r2.session && r2.session.manages));

  /* '*' and non-strings are coerced away on read (validated strictly on write). */
  accountsList[0].manages = ['u16b', '*', 5, ''];
  const r3 = await auth.resolveSession(evOf(token));
  check('a * or non-string id in manages is dropped on read', JSON.stringify(r3.session.manages) === JSON.stringify(['u16b']), JSON.stringify(r3.session.manages));
}

/* ====================================================================== */
section('⚠️ `manages` is IDENTITY ONLY — it is NEVER an access decision');
{
  /* An ILLEGAL shape on purpose: a manager account that also names another
     group in `manages`. hasAgeGroupAccess must ignore it entirely. */
  const badManager = { role: 'manager', ageGroupId: 'u9', manages: ['u16b'] };
  check('a manager whose manages names another group still cannot access it',
    auth.hasAgeGroupAccess(badManager, 'u16b') === false);
  check('…and still CAN access their own group', auth.hasAgeGroupAccess(badManager, 'u9') === true);

  /* The dual account gets every group the normal way: it is a real organiser. */
  check('a dual organiser has every group via the organiser branch, not via manages',
    auth.hasAgeGroupAccess({ role: 'organizer', manages: ['u16b'] }, 'u9') === true &&
    auth.hasAgeGroupAccess({ role: 'organizer', manages: [] }, 'u9') === true);

  /* resolveSession GATES manages on the organiser role, so a manager's session
     never even carries it — a second line of defence. */
  accountsList = [{ username: 'mgr', name: 'Mgr', role: 'manager', ageGroupId: 'u9', approved: true, manages: ['u16b'] }];
  const rm = await auth.resolveSession(evOf(auth.sign({ username: 'mgr', role: 'manager', ageGroupId: 'u9' })));
  check('a manager account’s session carries no manages, whatever the record holds',
    rm.ok && JSON.stringify(rm.session.manages) === JSON.stringify([]), JSON.stringify(rm.session && rm.session.manages));
}

/* ====================================================================== */
section('A forged token cannot grant organiser-ness or a managed group');
{
  accountsList = [{ username: 'mgr', name: 'Mgr', role: 'manager', ageGroupId: 'u9', approved: true }];
  /* Claim organiser + manages for a stored MANAGER. */
  const forged = auth.sign({ username: 'mgr', role: 'organizer', manages: ['u16b'] });
  const r = await auth.resolveSession(evOf(forged));
  check('the stored role wins over the token', r.ok && r.session.role === 'manager');
  check('…scoped to its own group, with no manages', r.session.ageGroupId === 'u9' && JSON.stringify(r.session.manages) === JSON.stringify([]));
  check('…and it cannot reach another group', auth.hasAgeGroupAccess(r.session, 'u16b') === false);
}

/* ====================================================================== */
section('accounts-admin `managerGroups` — organiser-only, validated, enforced server-side');
{
  const seed = () => { accountsList = [
    { username: 'jay', name: 'Jay', role: 'organizer', title: 'Organizer', approved: true },
    { username: 'org2', name: 'Org Two', role: 'organizer', title: 'Organizer', approved: true },
    { username: 'mgr', name: 'Mgr', role: 'manager', ageGroupId: 'u9', approved: true },
  ]; };

  seed();
  const ok = await parse(await call('jay', { action: 'managerGroups', username: 'org2', manages: ['u16b', 'u16b'] }));
  eq('an organiser sets another organiser’s managed groups', ok.status, 200);
  eq('…deduped and stored', JSON.stringify(stored('org2').manages), JSON.stringify(['u16b']));
  check('managerGroups stamps who changed it', stored('org2').managerGroupsChangedBy === 'jay');

  seed();
  eq('managerGroups refuses a manager target', (await parse(await call('jay', { action: 'managerGroups', username: 'mgr', manages: ['u9'] }))).status, 400);
  check('…and the manager record is untouched', !('manages' in stored('mgr')));

  seed();
  eq('an unknown age group is refused', (await parse(await call('jay', { action: 'managerGroups', username: 'org2', manages: ['u16b', 'nope'] }))).status, 400);
  eq('the all-groups sentinel is refused in manages', (await parse(await call('jay', { action: 'managerGroups', username: 'org2', manages: ['*'] }))).status, 400);
  check('…and nothing was written on a rejected set', !('manages' in stored('org2')));

  /* SERVER-SIDE ENFORCEMENT: a manager caller is refused and nothing changes. */
  seed();
  const denied = await parse(await call('mgr', { action: 'managerGroups', username: 'org2', manages: ['u16b'] }));
  check('a manager cannot set manager groups (403), and nothing changes',
    (denied.status === 401 || denied.status === 403) && !('manages' in stored('org2')));
}

/* ====================================================================== */
section('accounts-admin `setRole` — promote / demote, and the hub-auto-revoke fix');
{
  seedPromote();
  const promoted = await parse(await call('jay', { action: 'setRole', username: 'dan', role: 'organizer' }));
  eq('promote a manager to organiser returns 200', promoted.status, 200);
  eq('…the role is now organiser', stored('dan').role, 'organizer');
  check('promotion folds the age group into manages', JSON.stringify(stored('dan').manages) === JSON.stringify(['u9']) && !('ageGroupId' in stored('dan')));
  check('…and drops the manager-only draw rights', !('drawPools' in stored('dan')) && !('drawTimes' in stored('dan')));
  /* ⚠️ THE ONE THE REVIEW CAUGHT. An auto-approved hub manager promoted without
     clearing autoApproved is AUTO-REVOKED on the next hub sign-in (hub-auth.js
     :154 fires on the surviving flag with the now-deleted ageGroupId). */
  check('promotion clears the hub auto-approve markers so the club hub will not auto-revoke',
    !('autoApproved' in stored('dan')) && !('autoRevoked' in stored('dan')) &&
    !('suggestedAgeGroupIds' in stored('dan')) && !('suggestedFrom' in stored('dan')));
  check('…and records who changed the role', stored('dan').roleChangedBy === 'jay');

  seedPromote();
  accountsList.push({ username: 'org2', name: 'Org Two', role: 'organizer', title: 'Organizer', approved: true, manages: ['u9'] });
  const demoted = await parse(await call('jay', { action: 'setRole', username: 'org2', role: 'manager', ageGroupId: 'u9' }));
  eq('demote an organiser to a manager returns 200', demoted.status, 200);
  check('demotion sets the age group and drops manages',
    stored('org2').role === 'manager' && stored('org2').ageGroupId === 'u9' && !('manages' in stored('org2')));

  seedPromote();
  accountsList.push({ username: 'org3', name: 'Org Three', role: 'organizer', title: 'Organizer', approved: true });
  eq('demotion with no valid age group is refused', (await parse(await call('jay', { action: 'setRole', username: 'org3', role: 'manager' }))).status, 400);

  seedPromote();
  eq('setRole to the role the account already has is refused', (await parse(await call('jay', { action: 'setRole', username: 'jay', role: 'organizer' }))).status, 400);

  /* SERVER-SIDE ENFORCEMENT: a manager caller cannot change roles. */
  seedPromote();
  const denied = await parse(await call('dan', { action: 'setRole', username: 'dan', role: 'organizer' }));
  check('a manager cannot change a role (403), and nothing changes',
    (denied.status === 401 || denied.status === 403) && stored('dan').role === 'manager');
}

/* ====================================================================== */
section('managedGroupsOf unions the two homes, and the client copy does not drift');
{
  eq('a plain manager’s group', JSON.stringify(auth.managedGroupsOf({ role: 'manager', ageGroupId: 'u9' })), JSON.stringify(['u9']));
  eq('a dual organiser’s manages', JSON.stringify(auth.managedGroupsOf({ role: 'organizer', manages: ['u16b', 'u18b'] })), JSON.stringify(['u16b', 'u18b']));
  eq('an all-groups * manager names no ONE group', JSON.stringify(auth.managedGroupsOf({ role: 'manager', ageGroupId: '*' })), JSON.stringify([]));
  eq('a plain organiser manages nothing', JSON.stringify(auth.managedGroupsOf({ role: 'organizer' })), JSON.stringify([]));

  /* The client copy in organizer-data.js must match the server copy character
     for character, or the roster and the enforcement drift apart. */
  const body = (src) => (src.replace(/\r\n/g, '\n').match(/function managedGroupsOf\(account\) \{\n([\s\S]*?)\n\}/) || [])[1];
  const serverBody = body(readRepo(path.join('netlify', 'functions', '_auth.js')));
  const clientBody = body(readRepo('organizer-data.js'));
  check('control: both managedGroupsOf bodies were found', !!serverBody && !!clientBody, `${serverBody ? 'server ok' : 'server MISSING'}, ${clientBody ? 'client ok' : 'client MISSING'}`);
  check('the client managedGroupsOf matches the server copy', serverBody === clientBody);
}

/* ====================================================================== */
section('sessionFor carries manages on the organiser session, never in the token');
{
  const login = readRepo(path.join('netlify', 'functions', 'login.js')).replace(/\r\n/g, '\n');
  const hub = readRepo(path.join('netlify', 'functions', 'hub-auth.js')).replace(/\r\n/g, '\n');
  const orgLine = /_role: 'organizer', manages: account\.manages \|\| \[\] \}/;
  check('login.js sessionFor puts manages on the organiser session', orgLine.test(login));
  check('hub-auth.js sessionFor does the same', orgLine.test(hub));
  /* The token stays single-role-shaped — manages is never minted into sign(),
     so there is no new forgeable claim. */
  check('neither file mints manages into the signed token',
    !/sign\(\{ username: account\.username, role: 'organizer', manages/.test(login) &&
    !/sign\(\{ username: account\.username, role: 'organizer', manages/.test(hub));
}

summary('test-dual-role.js');
}

/* An auto-approved hub manager (Dan) plus the promoting organiser (Jay). */
function seedPromote() {
  accountsList = [
    { username: 'jay', name: 'Jay', role: 'organizer', title: 'Organizer', approved: true },
    { username: 'dan', name: 'Dan Young', role: 'manager', ageGroupId: 'u9', approved: true, drawPools: true, drawTimes: false,
      autoApproved: { at: '2026-09-01T00:00:00.000Z', from: ['Quins U9'] }, suggestedFrom: ['Quins U9'] },
  ];
}

main().catch((e) => { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
