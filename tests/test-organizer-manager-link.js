/* tests/test-organizer-manager-link.js
   ------------------------------------------------------------------------
   Organizer.dc.html's dashboard header already carries a "← Main site" link
   back to the public site. Manager.html carries the same link the other way.
   Nothing links Organizer → the manager area, so an organiser who wants the
   manager dashboard has to type the URL.

   These are markup assertions on the real file (same approach
   tests/test-venue-map.js uses for Organizer's own markup) — there is no
   behaviour to drive here, the link is a plain anchor.
*/
const { readRepo, section, check, summary } = require('./_lib');

const html = readRepo('Organizer.dc.html');
const DASH = '<!-- ===================== DASHBOARD ===================== -->';
const TABS = '<!-- tabs -->';
const loginPart = html.slice(0, html.indexOf(DASH));
const header = html.slice(html.indexOf(DASH), html.indexOf(TABS));

section('Organizer dashboard header links to the Manager area');
{
  check('the dashboard header contains a link whose href is /manager',
    /href="\/manager"/.test(header));
  /* Aug 2026 (design audit): label moved to sentence case with the rest of
     the site's copy. */
  check('the link is labelled "View manager area"',
    />View manager area</.test(header));
  check('it sits after the existing "← Main site" link, not before it',
    header.indexOf('← Main site') > -1
    && header.indexOf('View manager area') > header.indexOf('← Main site'));
  check('it uses the same muted header-link colour as "← Main site"',
    /href="\/manager"[^>]*color:var\(--chrome-muted\)/.test(header));
  check('it uses the same left-rule separator as "← Main site"',
    /href="\/manager"[^>]*border-left:1px solid var\(--chrome-line\)/.test(header));
}

section('Nothing else in Organizer.dc.html changed');
{
  check('the existing "← Main site" header link is still there',
    /href="Quins JRT\.dc\.html"[^>]*>← Main site</.test(header));
  check('no /manager link was added to the logged-out login card',
    !/href="\/manager"/.test(loginPart));
  check('the five existing dashboard tabs are still present',
    /showTeams/.test(html) && /showPlayers/.test(html) && /showAccounts/.test(html)
    && /showVenue/.test(html) && /showRegistration/.test(html));
}

section('Every signed-in route to "the manager tools" points at /manager, not /scores');
/* Aug 2026: /scores is becoming a purely public results page (see
   claude/specs/spec-scores-manager-removal.md), so the two places that used
   to send a signed-in manager THERE for tooling must point at /manager. The
   app's PUBLIC "Full scores page" row is a different link and stays. */
{
  const app = readRepo('app.html');
  check('the app\'s More-tab tools row goes to /manager',
    /if \(a === 'tools'\)\s*\{ location\.href = '\/manager'; return; \}/.test(app));
  check('…and no signed-in action in the app navigates to /scores any more',
    !/location\.href = '\/scores'/.test(app));
  check('the app\'s public "Full scores page" row survives untouched',
    /href="\/scores"[^>]*><div><b>Full scores page<\/b>/.test(app));

  /* Aug 2026, later on the same branch: the organizer login's manager
     fallback was DELETED WHOLE with the unified sign-in page — the redirect
     it briefly pointed at /manager exists nowhere now, and neither does the
     cross-key localStorage write it did first. Assert the deletion. */
  /* Absence checks read the CODE only — the tombstone comment left where
     the hack lived names it, and failing on the explanation of a deletion
     is the strip-comments lesson. */
  const dataCode = readRepo('organizer-data.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  check('organizer-data.js carries no login fallback at all any more',
    !/manager-login/.test(dataCode) && !/redirect:/.test(dataCode));
  check('…and no direct-to-page redirects of any kind',
    !/redirect: '\/scores'/.test(dataCode) && !/redirect: '\/manager'/.test(dataCode));
}

summary('test-organizer-manager-link.js');
