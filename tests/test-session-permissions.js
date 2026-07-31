/* tests/test-session-permissions.js
   Proves isOrganiserSession() and canScoreAgeGroup() in scores-data.js —
   the shared gating logic both app.html and the new Manager.html rely on to
   stop a manager scoring outside their own age group. Extracted from
   app.html's own local isOrganiser/canScore (see that file's history) so it
   is shared and testable instead of duplicated.
*/
const { section, check, summary } = require('./_lib');

// scores-data.js is an ES module; load just the two pure functions under
// test via a lightweight extraction, same approach test-venue-splits.js
// uses for other pure exports in this same file — avoids dragging in the
// whole module's fetch-backed surface for a synchronous logic check.
const fs = require('fs');
const path = require('path');
const { repoRoot } = require('./_lib');
const src = fs.readFileSync(path.join(repoRoot(), 'scores-data.js'), 'utf8');

function extractFn(name) {
  const re = new RegExp(`export function ${name}\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`${name} not found in scores-data.js`);
  // Strip the leading `export ` — new Function()'s body is a plain function
  // body, not a module, so the `export` keyword itself is a syntax error.
  return m[0].replace(/^export\s+/, '');
}

// canScoreAgeGroup() calls isOrganiserSession() internally, so both bodies
// have to be evaluated together in the same scope rather than one at a time.
const isOrganiserSessionSrc = extractFn('isOrganiserSession');
const canScoreAgeGroupSrc = extractFn('canScoreAgeGroup');
// eslint-disable-next-line no-new-func
const { isOrganiserSession, canScoreAgeGroup } = new Function(
  `${isOrganiserSessionSrc}\n${canScoreAgeGroupSrc}\nreturn { isOrganiserSession, canScoreAgeGroup };`
)();

section('isOrganiserSession()');
check('null session is not an organiser', isOrganiserSession(null) === false);
check('plain manager session is not an organiser', isOrganiserSession({ ageGroupId: 'u14b' }) === false);
check('isOrganizer:true flag is an organiser', isOrganiserSession({ isOrganizer: true }) === true);
check('role:"organizer" is an organiser', isOrganiserSession({ role: 'organizer' }) === true);

section('canScoreAgeGroup()');
check('no session cannot score', canScoreAgeGroup(null, 'u14b') === false);
check('manager can score own age group', canScoreAgeGroup({ ageGroupId: 'u14b' }, 'u14b') === true);
check('manager CANNOT score a different age group', canScoreAgeGroup({ ageGroupId: 'u14b' }, 'u16b') === false);
check('admin manager ("*") can score any age group', canScoreAgeGroup({ ageGroupId: '*' }, 'u16b') === true);
check('organiser can score any age group', canScoreAgeGroup({ isOrganizer: true, ageGroupId: null }, 'u16b') === true);

summary('test-session-permissions.js');
