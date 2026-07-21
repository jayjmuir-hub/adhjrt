// netlify/functions/_scoring.js
//
// What can be scored, and for how many points, at each age group.
//
// ⚠️ CONFIRM AGAINST THE UAERF AGE-GRADE LAWS BEFORE THE TOURNAMENT.
// These defaults follow the standard age-grade progression — kicking at goal
// is introduced gradually, so the younger groups score tries only:
//
//   U6–U8    tag rugby        tries only
//   U9–U11   contact          tries only. Penalties are a free pass (U9) or
//                             tap-and-play (U10/U11), so there is no kick at
//                             goal to record.
//   U12–U13  contact          tries and conversions
//   U14+     full laws        tries, conversions, penalties, drop goals
//
// These are only DEFAULTS. An organiser can change any age group from the
// Manager area without a deploy — overrides are stored in Netlify Blobs and
// merged over this table by loadRules(). The score entry forms build
// themselves from the result, and the server totals from it, so the two can
// never disagree.

const POINTS = { tries: 5, conversions: 2, penalties: 3, drops: 3 };

const TRIES_ONLY = ['tries'];
const TRIES_CONV = ['tries', 'conversions'];
const FULL       = ['tries', 'conversions', 'penalties', 'drops'];

const BY_AGE = {
  u6: TRIES_ONLY, u7: TRIES_ONLY, u8: TRIES_ONLY,
  u9: TRIES_ONLY, u10: TRIES_ONLY, u11: TRIES_ONLY,
  u12: TRIES_CONV, u12g: TRIES_CONV, u13: TRIES_CONV,
  u14b: FULL, u14g: FULL,
  u16b: FULL, u16g: FULL,
  u18b: FULL, u18g: FULL,
};

/* Unknown age groups get the full set rather than the narrowest — better to
   offer an option that is not used than to make a score impossible to enter. */
function scoringFor(ageGroupId) {
  return BY_AGE[ageGroupId] || FULL;
}

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0;
};

/* Totals are always computed from the components, never taken from the client.
   That is what stops a typo — or a tampered request — producing a score that
   does not match the tries and kicks recorded beside it. */
function totalFor(ageGroupId, parts, rules) {
  const allowed = (rules && rules[ageGroupId]) || scoringFor(ageGroupId);
  return allowed.reduce((sum, k) => sum + n(parts[k]) * POINTS[k], 0);
}

/* Organiser overrides, stored as { ageGroupId: ['tries', ...] }. Read once per
   request; a missing or unreadable store just means the defaults apply, which
   is the safe direction — a config problem must never make scores unenterable
   on a match day. */
async function loadRules(blobStore) {
  try {
    const saved = await blobStore('config').get('scoring', { type: 'json' });
    if (saved && typeof saved === 'object') return { ...BY_AGE, ...saved };
  } catch (e) {
    console.warn('scoring overrides unavailable, using defaults:', e.message);
  }
  return { ...BY_AGE };
}

const VALID = ['tries', 'conversions', 'penalties', 'drops'];

/* Keeps only known keys, in a fixed order, and never lets an age group end up
   with nothing scoreable. */
function cleanRules(input) {
  const out = {};
  Object.keys(input || {}).forEach((ag) => {
    const list = Array.isArray(input[ag]) ? VALID.filter((k) => input[ag].includes(k)) : [];
    out[ag] = list.length ? list : ['tries'];
  });
  return out;
}

module.exports = { POINTS, scoringFor, totalFor, BY_AGE, loadRules, cleanRules, VALID };
