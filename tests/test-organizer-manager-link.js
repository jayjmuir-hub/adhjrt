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
  check('the link is labelled "View Manager Area"',
    />View Manager Area</.test(header));
  check('it sits after the existing "← Main site" link, not before it',
    header.indexOf('← Main site') > -1
    && header.indexOf('View Manager Area') > header.indexOf('← Main site'));
  check('it uses the same muted header-link colour as "← Main site"',
    /href="\/manager"[^>]*color:#aeb4bf/.test(header));
  check('it uses the same left-rule separator as "← Main site"',
    /href="\/manager"[^>]*border-left:1px solid rgba\(255,255,255,0\.15\)/.test(header));
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

summary('test-organizer-manager-link.js');
