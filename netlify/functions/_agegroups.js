// netlify/functions/_agegroups.js
//
// The fifteen age groups, server side.
//
// WHY THIS IS A SECOND COPY. The same table lives in "Quins JRT.dc.html" as
// AGE_GROUP_INFO, because the registration form needs it to show squad caps and
// age warnings before any fetch resolves. There is no build step in this repo,
// so there is no way to have one copy — the same situation as DEFAULT_VENUE,
// which is duplicated between _venue.js and scores-data.js for the same reason.
//
// test-agegroups.js compares the two, deep-equal, and fails if either moves.
// Change one, change them both, run the test.
//
// WHAT THE SERVER USES IT FOR: the squad cap. Until the submission gateway
// existed that cap was enforced in the browser ONLY — `_squadCap()` in the page
// — so anyone editing the page could register a squad of any size and nothing
// downstream noticed. Sub-project 2 will add the age rules on top of `ages`.
//
// The list below is copied CHARACTER FOR CHARACTER out of the page. All four
// girls' groups play 7s with a squad of 12, including U16G and U18G, which is
// why they differ from the boys' groups of the same age — the caps are not
// derivable from a rule and must not be "tidied".

const AGE_GROUPS = [
  { id: 'u6', name: 'U6 Tag', ages: [5], format: '7s', squad: 12 },
  { id: 'u7', name: 'U7 Tag', ages: [6], format: '7s', squad: 12 },
  { id: 'u8', name: 'U8 Tag', ages: [7], format: '7s', squad: 12 },
  { id: 'u9', name: 'U9 Mixed Contact', ages: [8], format: '7s', squad: 12 },
  { id: 'u10', name: 'U10 Mixed Contact', ages: [9], format: '10s', squad: 15 },
  { id: 'u11', name: 'U11 Mixed Contact', ages: [10], format: '12s', squad: 18 },
  { id: 'u12', name: 'U12 Mixed Contact', ages: [11], format: '12s', squad: 18 },
  { id: 'u12g', name: 'U12G QR', ages: [11], format: '7s', squad: 12 },
  { id: 'u13', name: 'U13 Mixed Contact', ages: [12], format: '10s', squad: 15 },
  { id: 'u14b', name: 'U14B Contact', ages: [13], format: '12s', squad: 18 },
  { id: 'u14g', name: 'U14G QR', ages: [13], format: '7s', squad: 12 },
  { id: 'u16b', name: 'U16B Contact', ages: [14, 15], format: '12s', squad: 18 },
  { id: 'u16g', name: 'U16G Contact', ages: [14, 15], format: '7s', squad: 12 },
  { id: 'u18b', name: 'U18B Contact', ages: [16, 17], format: '12s', squad: 18 },
  { id: 'u18g', name: 'U18G Contact', ages: [16, 17], format: '7s', squad: 12 },
];

const AGE_GROUP_BY_NAME = {};
const AGE_GROUP_BY_ID = {};
AGE_GROUPS.forEach((g) => { AGE_GROUP_BY_NAME[g.name] = g; AGE_GROUP_BY_ID[g.id] = g; });

/* Derived, not typed, so adding a bigger squad cannot leave this behind. */
const MAX_SQUAD_ANY_GROUP = Math.max(...AGE_GROUPS.map((g) => g.squad));

/* The cap for a group NAME as the form submits it.

   Falls back to the largest squad in the tournament when the group is missing
   or unrecognised — same rule as the client's _squadCap(), and for the same
   reason: a roster typed before a group is chosen must not be refused. The
   fallback can therefore only ever be MORE permissive than the real cap, never
   less, and the real cap applies the moment a group is present.

   Names are matched EXACTLY. A near-miss must not quietly resolve, because the
   gateway refuses an unrecognised age group outright rather than guessing, and
   two different answers to "is this a real group" is how a submission ends up
   validated against one group and stored against another. */
function squadCap(name) {
  const g = AGE_GROUP_BY_NAME[typeof name === 'string' ? name : ''];
  return g ? g.squad : MAX_SQUAD_ANY_GROUP;
}

module.exports = {
  AGE_GROUPS, AGE_GROUP_BY_NAME, AGE_GROUP_BY_ID, MAX_SQUAD_ANY_GROUP, squadCap,
};
