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

/* ============================================================
   THE AGE CHECK — sub-project 2, added 28 Jul 2026.
   ------------------------------------------------------------
   Everything below is copied CHARACTER FOR CHARACTER out of
   "Quins JRT.dc.html" — PREV_GROUP_ID, AGE_GRADE_CUTOFF_DATE, calcAge() and
   fmtAges() are the exact same names and the exact same logic
   _playerAgeCheck() already runs for the parent's form. Same reasoning as the
   table above: no build step means no way to have one copy, so this is a
   second copy with a test that fails if it drifts (test-agegroups.js).

   A DIFFERENT ALGORITHM THAT AGREES TODAY IS NOT GOOD ENOUGH. It would be one
   more thing that can drift from the client with no test able to see it. This
   stays a literal copy on purpose, even though calcAge()'s Date arithmetic
   could be rewritten as pure string math.

   calcAge()'s `new Date(dobStr + 'T00:00:00')` is timezone-safe here in a way
   the registration window's dates were NOT (see _registration.js): it never
   round-trips through UTC, so whatever timezone the runtime happens to be in,
   the calendar year/month/day read back out are the same ones that were
   typed in. Do not "fix" this into an explicit-offset version — that is the
   shape of the bug this comment is warning against, not a fix for one. */

// The next-younger group in each stream — the group actually one step below
// in the real competition structure, not just "one year younger" (e.g.
// U16B's previous group is U14B, since there's no U15B).
const PREV_GROUP_ID = {
  u7: 'u6', u8: 'u7', u9: 'u8', u10: 'u9', u11: 'u10', u12: 'u11', u12g: 'u11',
  u13: 'u12', u14b: 'u13', u14g: 'u12g', u16b: 'u14b', u16g: 'u14g', u18b: 'u16b', u18g: 'u16g',
};
// All four girls' groups — U12G/U14G QR (non-contact) and U16G/U18G Contact —
// get a wider, arithmetic-based play-up allowance (up to two age groups
// young) instead of the one-hop PREV_GROUP_ID chain above. Added 28 Jul 2026
// at Jay's explicit instruction, covering all four groups including the two
// contact ones — flagging once, here, that U16G/U18G are tackle formats, not
// non-contact QR like U12G/U14G, so the injury/age-grade profile of playing
// two years up is materially different there. See claude/spec-age-validation.md.
const TWO_YEAR_PLAYUP_GROUP_IDS = ['u12g', 'u14g', 'u16g', 'u18g'];

// UAERF age-grade cut-off: a player's age group is fixed by their age at
// midnight 31 August 2026 (start of the 2026/27 season) — "Under X" means
// they are exactly X−1 on that date. Emirati U18 players use a 31 December
// cut-off instead per UAERF rules; that nationality-specific exception isn't
// enforced here since the form doesn't collect nationality.
const AGE_GRADE_CUTOFF_DATE = new Date(2026, 7, 31); // 31 Aug 2026, local time

function calcAge(dobStr, asOf) {
  const dob = new Date(dobStr + 'T00:00:00');
  if (isNaN(dob.getTime())) return null;
  let years = asOf.getFullYear() - dob.getFullYear();
  let months = asOf.getMonth() - dob.getMonth();
  if (asOf.getDate() < dob.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years < 0) return null;
  return { years, months, birthYear: dob.getFullYear() };
}
function fmtAges(ages) { return ages.length > 1 ? `${ages[0]} or ${ages[1]}` : `${ages[0]}`; }

/* Reused, not reimplemented, wherever possible — this IS _playerAgeCheck()'s
   rule, minus the playUpConsent handling, which is a UI concept (a checkbox
   a parent ticks) rather than something the server checks.

   Returns { status: 'ok' | 'playUp' | 'blocked', message }.
     'ok'      — nothing to flag.
     'playUp'  — young enough to be allowed up with parent/guardian consent
                 rather than refused. Normally exactly one age group young
                 (the PREV_GROUP_ID chain). The four girls' groups in
                 TWO_YEAR_PLAYUP_GROUP_ID allow up to TWO age groups young
                 instead, via plain arithmetic on info.ages[0] rather than the
                 chain — added 28 Jul 2026 because the girls' QR/contact
                 ladder has no group at every age (U12G QR is 11, U14G QR is
                 13; there is no girls-specific group at 12), so the one-hop
                 chain wrongly blocked a real 12-year-old registering for
                 U14G QR. See claude/spec-age-validation.md decision 1: a
                 coach entering a whole squad cannot give parental consent on
                 a parent's behalf, so this is flagged for /organizer to
                 chase rather than blocked outright.
     'blocked' — anything else (too old, or more groups young than allowed).
                 Refused — the same rule the player form has always had. */
function ageGroupCheck(dob, groupName) {
  if (!dob || !groupName) return { status: 'ok', message: '' };
  const cutoffAge = calcAge(dob, AGE_GRADE_CUTOFF_DATE);
  const info = AGE_GROUP_BY_NAME[groupName];
  if (!cutoffAge || !info) return { status: 'ok', message: '' };
  if (info.ages.includes(cutoffAge.years)) return { status: 'ok', message: '' };
  if (TWO_YEAR_PLAYUP_GROUP_IDS.includes(info.id)) {
    const groupsYoung = info.ages[0] - cutoffAge.years;
    if (groupsYoung === 1 || groupsYoung === 2) {
      return {
        status: 'playUp',
        message: `This player is ${cutoffAge.years} at the 31 Aug 2026 cut-off — ${groupsYoung === 1 ? 'one age group' : 'two age groups'} younger than ${groupName}. ${groupName} is one of the girls' age groups, where UAERF rules allow playing up to two age groups with parent/guardian consent.`,
      };
    }
  } else {
    const prevInfo = AGE_GROUP_BY_ID[PREV_GROUP_ID[info.id]];
    if (prevInfo && prevInfo.ages.includes(cutoffAge.years)) {
      return {
        status: 'playUp',
        message: `This player's age at the 31 Aug 2026 cut-off fits ${prevInfo.name}, one age group younger than ${groupName}. Playing up one age group is permitted with parent/guardian consent.`,
      };
    }
  }
  return {
    status: 'blocked',
    message: `${groupName} is for players who are ${fmtAges(info.ages)} years old at the UAERF age-grade cut-off (31 Aug 2026). Based on this date of birth, the player is ${cutoffAge.years} at that cut-off — please check the date of birth or select the correct age group.`,
  };
}

module.exports = {
  AGE_GROUPS, AGE_GROUP_BY_NAME, AGE_GROUP_BY_ID, MAX_SQUAD_ANY_GROUP, squadCap,
  PREV_GROUP_ID, TWO_YEAR_PLAYUP_GROUP_IDS, AGE_GRADE_CUTOFF_DATE, calcAge, fmtAges, ageGroupCheck,
};
