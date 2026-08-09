/* tests/test-validate-not-coerce.js
   ---------------------------------------------------------------------------
   Four bugs from an Aug 2026 code review, all the same shape: something the
   code could not make sense of was quietly turned into something it could,
   and the caller was told it had worked.

     1. A failed teams-sheet read numbered a new team from an EMPTY list, so it
        minted a code that already existed. Two squads, one identity, in the
        draw and the standings and every match id.
     2. A single player registration had NO server-side age check at all — the
        check existed, but only inside the branch that handles a coach's bulk
        roster. The primary path, one parent entering one child, was unchecked.
     3. scoring-rules.js coerced anything malformed into ['tries'] and answered
        200 ok, silently switching an age group to tries-only scoring.
     4. mergeVenue treated an EMPTY splits object as a present one, producing a
        tournament day with no pitches while still listing age groups on them.

   ⚠️ THE COMMON THREAD IS WORTH MORE THAN THE FOUR FIXES. Coercion is right on
   a READ — a blob nobody can parse should not take the tournament down — and
   wrong on a WRITE, where somebody is telling you what the truth IS. Three of
   these four were a read-shaped rule applied at a write.
*/

const Module = require('module');
const path = require('path');
const { section, check, eq, summary, repoRoot } = require('./_lib');

/* ---- stubs -------------------------------------------------------------- */
let scoringBlob = {};
const stubs = {
  '@netlify/blobs': {
    getStore: (arg) => {
      const name = typeof arg === 'string' ? arg : (arg && arg.name);
      return {
        async get(key) {
          if (name === 'accounts' && key === 'list') {
            return [{ username: 'org', role: 'organizer', approved: true, name: 'Org' }];
          }
          if (name === 'config' && key === 'scoring') return scoringBlob;
          return null;
        },
        async setJSON(key, v) { if (name === 'config' && key === 'scoring') scoringBlob = v; },
        async delete() {}, async list() { return { blobs: [] }; },
      };
    },
  },
  bcryptjs: { hash: async () => 'stub', compare: async () => false, hashSync: () => 'stub', compareSync: () => false },
};
const realResolve = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) {
  return Object.prototype.hasOwnProperty.call(stubs, r) ? 'STUB:' + r : realResolve.call(this, r, ...rest);
};
const realLoad = Module._load;
Module._load = function (r, ...rest) {
  return Object.prototype.hasOwnProperty.call(stubs, r) ? stubs[r] : realLoad.call(this, r, ...rest);
};
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-not-a-real-value';

const FN = path.join(repoRoot(), 'netlify', 'functions');
const { sign } = require(path.join(FN, '_auth.js'));
const scoringRules = require(path.join(FN, 'scoring-rules.js'));
const { mergeVenue, DEFAULT_VENUE, validateVenue } = require(path.join(FN, '_venue.js'));
const { validateSubmission } = require(path.join(FN, '_intake.js'));

const ORG = sign({ username: 'org', role: 'organizer' });
const postRules = (rules) => scoringRules.handler({
  httpMethod: 'POST', headers: { authorization: `Bearer ${ORG}` },
  body: JSON.stringify({ rules }),
});
const parse = (res) => ({ status: res.statusCode, ...JSON.parse(res.body || '{}') });

(async () => {
  /* ==================================================================== */
  section('scoring-rules.js validates instead of coercing');

  {
    scoringBlob = {};
    /* The realistic client bug: a comma string where a list belongs. This
       answered 200 ok and stored ['tries'], so every result in that group
       totalled tries only, for ever, looking deliberate. */
    const r = parse(await postRules({ u16b: 'tries,conversions,penalties' }));
    eq('a string instead of a list is REFUSED', r.status, 400);
    check('…and says what was wrong', /must be a list/i.test(r.error || ''), r.error);
    eq('⚠️ …and nothing was written', JSON.stringify(scoringBlob), '{}');
  }
  {
    scoringBlob = {};
    /* Wrong case wrote a key nothing reads and left the group on defaults. */
    const r = parse(await postRules({ u16B: ['tries'] }));
    eq('an unknown age-group key is refused', r.status, 400);
    check('…naming the key', /u16B/.test(r.error || ''), r.error);
    eq('…and nothing was written', JSON.stringify(scoringBlob), '{}');
  }
  {
    scoringBlob = {};
    const r = parse(await postRules({ u16b: ['tries', 'bonus-points'] }));
    eq('an unknown component is refused', r.status, 400);
    check('…naming it', /bonus-points/.test(r.error || ''), r.error);
  }
  {
    scoringBlob = {};
    /* cleanRules would turn [] into ['tries'] and report success, so the
       organiser would believe they had switched scoring off. */
    const r = parse(await postRules({ u16b: [] }));
    eq('an empty list is refused rather than becoming tries-only', r.status, 400);
  }
  {
    scoringBlob = {};
    const r = parse(await postRules({ u16b: ['tries', 'conversions'] }));
    eq('⚠️ a VALID change still works', r.status, 200);
    eq('…and is stored exactly as sent', JSON.stringify(scoringBlob.u16b), '["tries","conversions"]');
  }

  /* ==================================================================== */
  section('mergeVenue never produces a day with no pitches');

  {
    /* normaliseSplits returns {} — truthy — when every key is unrecognised, so
       the `||` fallback never fired and derivePitches({}) gave []. */
    const broken = { day1: { groups: { u12: [] }, splits: { 'not-a-pitch': 3 }, pitches: [] } };
    const merged = mergeVenue(broken);
    check('an all-unrecognised splits object does not empty the day',
      merged.day1.pitches.length > 0, JSON.stringify(merged.day1.pitches));
    eq('…it falls back to the default day', merged.day1.pitches.length, DEFAULT_VENUE.day1.pitches.length);
  }
  {
    const empty = { day1: { groups: { u12: [] }, splits: {} } };
    check('a literally empty splits object does not either',
      mergeVenue(empty).day1.pitches.length > 0);
  }
  {
    /* The legacy shape must still work — that is what the fallback is FOR. */
    const legacy = { day1: { groups: { u12: [] }, pitches: DEFAULT_VENUE.day1.pitches.slice(0, 2) } };
    check('a pre-splits blob with only `pitches` still resolves',
      mergeVenue(legacy).day1.pitches.length === 2, JSON.stringify(mergeVenue(legacy).day1.pitches));
  }
  {
    /* ⚠️ THE READ AND WRITE PATHS MUST AGREE. They had separate copies of this
       resolution and only one was right. */
    const bad = { day1: { groups: { u12: [] }, splits: { 'not-a-pitch': 3 } }, day2: DEFAULT_VENUE.day2 };
    const v = validateVenue(bad);
    check('validateVenue rejects what mergeVenue refuses to build',
      !v.ok || (v.errors && v.errors.length > 0), JSON.stringify(v).slice(0, 160));
  }

  /* ==================================================================== */
  section('⚠️ A single player registration is age-checked server-side');

  {
    /* ⚠️ EVERY REQUIRED FIELD, OR THIS PROVES NOTHING. My first version used
       invented field names, so the submission was refused at the required-field
       step and never reached the age check at all — a check that would have
       passed identically with no age rule in the code. The names come from the
       spec in _intake.js, not from memory. */
    const base = {
      'age-group': 'U8 Tag',
      'player-first-name': 'Test', 'player-last-name': 'Child',
      club: 'Abu Dhabi Harlequins',
      'parent-first-name': 'Test', 'parent-last-name': 'Parent',
      'parent-email': 'nobody@example.com',
      'emergency-first-name': 'Emergency', 'emergency-last-name': 'Contact',
      'emergency-phone': '+971500000000',
      consent: 'Yes',
    };

    /* The control FIRST, so a refusal below cannot be mistaken for the age
       rule when it is really a missing field. */
    const right = validateSubmission('player-registration', { ...base, dob: '2019-03-04' });
    check('⚠️ CONTROL: a correctly-aged child passes every other rule',
      right && right.ok === true, JSON.stringify(right).slice(0, 220));

    /* Born in 2000, entered for U8 Tag. The browser blocks this; the entire
       stated purpose of this gateway is that a browser-only rule is not a
       rule. Before Aug 2026 this was accepted, written to the players sheet
       and confirmed by email. */
    const tooOld = validateSubmission('player-registration', { ...base, dob: '2000-01-01' });
    check('a wildly out-of-age child is refused', tooOld && tooOld.ok === false,
      JSON.stringify(tooOld).slice(0, 220));
    check('…on the DATE OF BIRTH, not on something incidental',
      tooOld && tooOld.field === 'dob', JSON.stringify(tooOld).slice(0, 220));
  }

  Module._resolveFilename = realResolve;
  Module._load = realLoad;
  summary('test-validate-not-coerce.js');
})();
