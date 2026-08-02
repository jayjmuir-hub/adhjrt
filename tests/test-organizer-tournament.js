/* tests/test-organizer-tournament.js
   ------------------------------------------------------------------------
   The Tournament tab on /organizer — tournament-wide tools moved here from
   the old /scores Manager area (Aug 2026). This file grows a section per
   moved tool, in the same order the moves were committed:

     1. Bulk publish — "Publish all age groups" / "Unpublish all"

   The behaviour checks DRIVE the real component (build(), same pattern as
   test-organizer-grouping.js) with a fake api that records its calls — a
   source check alone cannot see a loop that quietly stops at the first age
   group, and the per-item sweep must be proven to cover the TAIL, not just
   the head (the club-count lesson).

   ⚠️ Every fixture value here is invented. Never build one from real data.
*/

const { readRepo, section, check, eq, summary } = require('./_lib');

/* Same minimal framework stand-in the other component-driving tests use. */
class DCLogic {
  setState(patch, cb) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    if (typeof cb === 'function') cb();
  }
}

function build() {
  const t = readRepo('Organizer.dc.html');
  const m = t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no x-dc script found in Organizer.dc.html');
  // eslint-disable-next-line no-new-func
  const C = new Function('DCLogic', 'window', 'document', m[1] + '\n;return Component;')(
    DCLogic,
    { addEventListener() {} },
    { addEventListener() {}, body: { style: {} }, baseURI: 'https://adhjrt.com/', getElementById: () => null }
  );
  const c = new C();
  c.props = {};
  return c;
}

/* The fifteen age-group ids, written OUT rather than derived from the page —
   a check that derives its expectation from the thing under test cannot catch
   a deliberate change to it (the POOL_OPTIONS lesson). */
const ALL_IDS = ['u6', 'u7', 'u8', 'u9', 'u10', 'u11', 'u12', 'u12g', 'u13',
  'u14b', 'u14g', 'u16b', 'u16g', 'u18b', 'u18g'];

async function main() {

/* ====================================================================== */
section('The markup: a Tournament tab whose section holds the bulk publish');
{
  const page = readRepo('Organizer.dc.html');

  check('the Tournament tab button exists',
    /<button onClick="\{\{ showTournament \}\}" style="\{\{ tabTournamentStyle \}\}">Tournament<\/button>/.test(page));

  /* Slice out the Tournament section. Anchored on the sc-if that gates it;
     ended on the filters section that has always followed the tab panels.
     PROVE the slice selected something real before trusting anything read
     from it — a slice to index -1 still yields text (the lazy-regex lesson). */
  const start = page.indexOf('<sc-if value="{{ isTournament }}"');
  const end = page.indexOf('<sc-if value="{{ showFilters }}"');
  check('the Tournament section exists and sits before the filters block',
    start > -1 && end > start, `start=${start} end=${end}`);
  const sect = page.slice(start, end);

  check('…holding the Publish all button', /onClick="\{\{ onPublishAll \}\}"/.test(sect));
  check('…and the Unpublish all button', /onClick="\{\{ onUnpublishAll \}\}"/.test(sect));
  check('…both disabled while a bulk run is busy', (sect.match(/disabled="\{\{ bulkBusy \}\}"/g) || []).length === 2);
  check('…with the outcome message bound', /\{\{ bulkMsg \}\}/.test(sect));

  /* And only here — a second copy elsewhere on the page would be the exact
     drift this move exists to end. */
  eq('the page has exactly one Publish-all button, and it is in this section',
    { page: (page.match(/onClick="\{\{ onPublishAll \}\}"/g) || []).length,
      section: (sect.match(/onClick="\{\{ onPublishAll \}\}"/g) || []).length },
    { page: 1, section: 1 });
}

/* ====================================================================== */
section('renderVals: everything the section binds is actually returned');
{
  const c = build();
  c.state = { ...c.state, api: {}, session: { token: 't', _role: 'organizer' } };
  let vals = null;
  try { vals = c.renderVals(); } catch (e) { vals = { _threw: String(e) }; }
  ['isTournament', 'tabTournamentStyle', 'showTournament', 'onPublishAll',
    'onUnpublishAll', 'bulkBusy', 'bulkMsg'].forEach((k) =>
    check(`renderVals returns ${k}`, vals && Object.prototype.hasOwnProperty.call(vals, k),
      vals && vals._threw ? vals._threw : 'missing — the binding silently resolves to empty'));

  /* The tab switch actually lands on the tab. */
  if (vals && typeof vals.showTournament === 'function') {
    vals.showTournament();
    eq('showTournament switches the tab', c.state.tab, 'tournament');
    eq('…and renderVals then reports isTournament', !!c.renderVals().isTournament, true);
  }
}

/* ====================================================================== */
section('Publish all: every age group is called, tail included, and counted');
{
  const c = build();
  const calls = [];
  /* ok for most, "save a draw first" for two, a hard failure for one —
     the three outcomes the message reports, all present at once so a
     counting mix-up cannot cancel out. */
  const fake = {
    publishDraw: async (id) => {
      calls.push(id);
      if (id === 'u12g' || id === 'u16g') return { ok: false, error: 'Nothing to publish — save a draw first.' };
      if (id === 'u18g') return { ok: false, error: 'Server error.' };
      return { ok: true };
    },
  };
  c.state = { ...c.state, api: fake, session: { token: 't', _role: 'organizer' } };

  await c.onPublishAll();
  check('nothing runs before the dialog is confirmed', calls.length === 0, String(calls.length));
  check('a confirm dialog was raised', !!c.state.modal && typeof c.state.modal.onConfirm === 'function');

  await c.state.modal.onConfirm();
  eq('every age group is published, tail included — all fifteen, in order', calls, ALL_IDS);
  eq('a group with no saved draw is counted as skipped, a hard failure as failed',
    c.state.bulkMsg, 'Published 12 age groups. Skipped 2 with no saved draw. 1 could not be published.');
  eq('the busy flag is released', c.state.bulkBusy, false);
}

/* ====================================================================== */
section('Unpublish all: every age group is called and failures are reported');
{
  const c = build();
  const calls = [];
  const fake = {
    unpublishDraw: async (id) => {
      calls.push(id);
      return id === 'u6' ? { ok: false, error: 'Server error.' } : { ok: true };
    },
  };
  c.state = { ...c.state, api: fake, session: { token: 't', _role: 'organizer' } };

  await c.onUnpublishAll();
  check('a confirm dialog was raised first', !!c.state.modal && typeof c.state.modal.onConfirm === 'function');
  await c.state.modal.onConfirm();
  eq('every age group is unpublished, tail included', calls, ALL_IDS);
  eq('the outcome names the failure', c.state.bulkMsg, 'Unpublished 14 age groups. 1 could not be unpublished.');
}

/* ====================================================================== */
section('The data layer provides the publish calls — re-exported, not copied');
{
  const data = readRepo('organizer-data.js');
  const reExported = [...data.matchAll(/^export\s*\{([\s\S]*?)\}\s*from\s*'\.\/scores-data\.js';/gm)]
    .flatMap((m) => m[1].split(',').map((x) => x.trim()).filter(Boolean));
  check('publishDraw is re-exported from scores-data.js', reExported.includes('publishDraw'));
  check('unpublishDraw is re-exported from scores-data.js', reExported.includes('unpublishDraw'));
  /* Not reimplemented — a second implementation is the drift this whole
     branch exists to remove. */
  check('organizer-data.js does not carry its own publishDraw implementation',
    !/function\s+publishDraw|const\s+publishDraw\s*=/.test(data));
}

summary('test-organizer-tournament.js');
}

main().catch((e) => { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
