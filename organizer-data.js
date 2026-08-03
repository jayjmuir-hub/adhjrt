/* ============================================================
   ADH JRT — Organizer data layer  (LIVE backend, with local fallback)
   ------------------------------------------------------------
   Organizer accounts self-signup via organizer-signup.js (gated by a
   shared invite code) and are stored server-side in Netlify Blobs.
   Registrations are read live from the two Google Sheets via
   get-registrations.js, which requires the signed-in organizer's
   session token. See those files in netlify/functions/ for one-time
   setup (ORGANIZER_INVITE_CODE + SESSION_SECRET env vars, on top of
   the GOOGLE_* vars documented in submission-created.js).

   LOCAL PREVIEW: before this site is deployed to Netlify, none of the
   /.netlify/functions/* endpoints exist, so every call below falls back
   to local-backend.js (localStorage-backed) — letting you try signup,
   login, approval, etc. right here. Once deployed for real, the real
   functions respond with valid JSON and this file uses those instead,
   automatically — no code changes needed. See local-backend.js for the
   local test invite codes.
   ============================================================ */

/* ONE session key for BOTH roles since Aug 2026 — the same
   'adhjrt_session_v2' scores-data.js uses (see the comment there and
   claude/specs/spec-unified-login.md). The one-time migration off the two
   old keys lives in scores-data.js's migrateSession(), imported below, so
   there is exactly one copy of that rule. */
const SESSION_KEY = 'adhjrt_session_v2';

import { migrateSession } from './scores-data.js';

let localBackendPromise = null;
function local() {
  if (!localBackendPromise) localBackendPromise = import(new URL('local-backend.js', document.baseURI).href);
  return localBackendPromise;
}

// Tries the real Netlify Function; if it can't even be reached, or
// answers 404 (both signs no backend is deployed here — a plain static
// server has no /.netlify/functions/* route to serve), signals the caller
// to use the local fallback instead. A real error response from an
// actually-deployed function (wrong password, etc.) is still valid JSON,
// so it's trusted as-is and never falls back.
//
// 30 Jul: this used to treat ANY non-JSON body as "no backend here" —
// including a genuinely deployed function returning a broken response
// (a Netlify platform error page, a crash, a timeout, all of which are
// HTML/plain text, not JSON). That silently substituted fake local-preview
// data (or a fake "success") for a real outage. Only a 404 means "not
// deployed"; any other non-JSON response is a real, live problem and is
// now surfaced as an error instead of masked.
async function tryFetchJson(url, opts) {
  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    return { real: false }; // couldn't even reach the network
  }
  let text = '';
  try { text = await res.text(); } catch (e) { /* fall through - body unreadable */ }
  try {
    const parsed = JSON.parse(text);
    // Guard against a technically-valid-JSON body that isn't an object
    // (e.g. `null`, a bare string) — every caller does `json.ok`/`json.X`.
    if (!parsed || typeof parsed !== 'object') {
      return { real: true, json: { ok: false, error: 'Unexpected response from the server.' } };
    }
    return { real: true, json: parsed };
  } catch (e) {
    if (res.status === 404) return { real: false }; // no backend deployed here
    return { real: true, json: { ok: false, error: 'Server error. Please try again in a moment.' } };
  }
}

/* Sign-in, sign-up and Google auth all live on the /signin page now, which
   talks to scores-data.js — including THE fallback hack this file used to
   carry (try organizer-login, then manager-login, then hand-write the token
   into the other data layer's localStorage key before redirecting). The
   unified endpoint made the whole chain unnecessary: one call, the account's
   own role decides where you land. See claude/specs/spec-unified-login.md. */

export function currentSession() {
  migrateSession();
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const s = raw ? JSON.parse(raw) : null;
    if (!s || !s.token) return null;
    /* The one key can hold either role now, and this page is the ORGANIZER
       dashboard: a manager session here reads as signed out rather than as
       an organizer with no data (the backend would 403 every read). */
    return (s._role === 'organizer' || s.role === 'organizer' || s.isOrganizer) ? s : null;
  } catch (e) { return null; }
}

/* Clears the two pre-Aug-2026 keys too — a stale pre-migration copy must
   never resurrect a signed-in state after an explicit sign-out. */
export function logout() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  try { localStorage.removeItem('adhjrt_session_v1'); } catch (e) {}
  try { localStorage.removeItem('adhjrt_organizer_session'); } catch (e) {}
}

export async function getRegistrations() {
  const session = currentSession();
  if (!session || !session.token) return { teams: [], players: [] };
  const r = await tryFetchJson('/.netlify/functions/get-registrations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.token}` },
  });
  // 30 Jul: a failed load used to come back as plain empty arrays,
  // indistinguishable from "nobody's registered yet." `error` is new and
  // additive — every existing caller destructuring {teams, players} is
  // unaffected; loadData() is the one that now checks it.
  if (r.real) return r.json.ok ? { teams: r.json.teams, players: r.json.players } : { teams: [], players: [], error: r.json.error || 'Could not load teams and players.' };
  return (await local()).sampleRegistrations();
}

// -------- Account approvals (Accounts tab) --------
function authHeaders() {
  const session = currentSession();
  return session && session.token ? { 'Authorization': `Bearer ${session.token}` } : {};
}

// 30 Jul: used to return a bare array, so a real failure silently looked
// exactly like "no accounts" (same class of bug as getRegistrations() above).
// Now returns { accounts, error } — both call sites (Organizer.dc.html's
// loadData/refreshAccounts) destructure both.
export async function listAccounts() {
  const session = currentSession();
  const r = await tryFetchJson('/.netlify/functions/accounts-admin', { headers: authHeaders() });
  if (r.real) return r.json.ok ? { accounts: r.json.accounts } : { accounts: [], error: r.json.error || 'Could not load accounts.' };
  return { accounts: await (await local()).accountsList(session && session.token) };
}

export async function approveAccount(username) {
  const session = currentSession();
  const r = await tryFetchJson('/.netlify/functions/accounts-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ action: 'approve', username }),
  });
  if (r.real) return r.json;
  return (await local()).accountsAction(session && session.token, 'approve', username);
}

export async function rejectAccount(username) {
  const session = currentSession();
  const r = await tryFetchJson('/.netlify/functions/accounts-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ action: 'reject', username }),
  });
  if (r.real) return r.json;
  return (await local()).accountsAction(session && session.token, 'reject', username);
}

export async function revokeAccount(username) {
  const session = currentSession();
  const r = await tryFetchJson('/.netlify/functions/accounts-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ action: 'revoke', username }),
  });
  if (r.real) return r.json;
  return (await local()).accountsAction(session && session.token, 'revoke', username);
}

/* Create a login directly (organizer-only, re-checked server-side). Approved
   immediately, so they can sign in straight away — no invite code, no approval
   round trip.

   `role` is 'manager' (needs ageGroupId) or 'organizer' (takes an optional
   title). Being able to make an ORGANIZER here is what lets
   ORGANIZER_INVITE_CODE be deleted from Netlify altogether: one shared code for
   everybody, with no expiry and no way to revoke it for one person, was the
   weakest thing about the old route. */
export async function createAccount({ role, name, username, password, ageGroupId, title }) {
  const r = await tryFetchJson('/.netlify/functions/accounts-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ action: 'create', role, name, username, password, ageGroupId, title }),
  });
  if (r.real) return r.json;
  return { ok: false, error: 'Creating logins needs the deployed site (not available in local preview).' };
}

/* Reset SOMEONE ELSE'S password. The organizer types it and hands it over —
   nothing is emailed.

   THIS FUNCTION DID NOT EXIST UNTIL 27 JULY 2026, while Organizer.dc.html
   called it. The Reset password dialog opened, took a new password, closed and
   did nothing: the TypeError was swallowed by the dialog's catch and only
   reached the browser console, so on screen it looked like it had worked.
   test-accounts.js now checks every api.* the page calls actually exists. */
export async function resetAccountPassword(username, password) {
  const r = await tryFetchJson('/.netlify/functions/accounts-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ action: 'password', username, password }),
  });
  if (r.real) return r.json;
  return { ok: false, error: 'Resetting a password needs the deployed site (not available in local preview).' };
}

/* Change your OWN password. The current one is required and checked against the
   stored hash server-side — a stolen session must not be enough to lock the
   real owner out. Was missing in exactly the same way as the function above. */
export async function changeMyPassword(currentPassword, password) {
  const r = await tryFetchJson('/.netlify/functions/accounts-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ action: 'changeMine', currentPassword, password }),
  });
  if (r.real) return r.json;
  return { ok: false, error: 'Changing your password needs the deployed site (not available in local preview).' };
}

/* -------- The venue: pitches per day, and which day each age group plays --------
   Read is public (venue-layout.js GET); adding ?usage=1 with an organiser token
   also returns how many saved match slots sit on each pitch, so the back office
   can warn before a rename or a removal orphans real fixtures.

   Writing is organiser-only and re-checked server-side. Managers are refused:
   which day a group plays and which pitches it owns affect every other age
   group, so it is a tournament-wide decision, not a per-group one.

   There is no local-backend fallback for these. In local preview the read falls
   back to the built-in defaults (the reader in scores-data.js does the same) and
   saving reports that it needs the deployed site — rather than silently writing
   to localStorage and letting someone think the layout is set when it is not. */
export async function getVenue({ withUsage = false } = {}) {
  const url = '/.netlify/functions/venue-layout' + (withUsage ? '?usage=1' : '');
  const r = await tryFetchJson(url, { headers: withUsage ? authHeaders() : {} });
  if (r.real && r.json && r.json.ok) return r.json;
  return { ok: false, error: 'Could not load the venue layout.' };
}

/* `positions` is where each block sits on assets/venue-map.png, dragged into
   place in the back office. Sent with the layout so one Save covers both — but
   stored server-side under its own blob key, because validateVenue() rebuilds a
   day from known fields and would silently drop an extra one. */
export async function saveVenue(venue, positions) {
  const r = await tryFetchJson('/.netlify/functions/venue-layout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(positions ? { venue, positions } : { venue }),
  });
  if (r.real) return r.json;
  return { ok: false, error: 'Saving the venue layout needs the deployed site (not available in local preview).' };
}

/* Puts every block back where the code guessed it was. Deliberately its own
   call: the pitch layout and the map placement are different decisions, and
   someone fixing one should not lose the other. */
export async function resetVenuePositions() {
  const r = await tryFetchJson('/.netlify/functions/venue-layout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ resetPositions: true }),
  });
  if (r.real) return r.json;
  return { ok: false, error: 'Resetting the block positions needs the deployed site (not available in local preview).' };
}

/* resetVenue() was deleted 2 Aug 2026 — the panel's Reset button no longer
   posts the built-in 2025 layout back to the server; it clears the working
   copy's pitch assignments instead (see reallyResetVenue() in
   Organizer.dc.html). The SERVER still honours `{ reset: true }` on
   venue-layout.js as a deliberate escape hatch, but no page calls it. */

/* -------- The registration window: when the entry forms are open --------
   Read is public (registration-window.js GET); writing is organiser-only and
   re-checked server-side, because when registration opens is a tournament-wide
   decision rather than a per-age-group one.

   The date logic is NOT reimplemented here. It is re-exported straight out of
   scores-data.js, which holds the copy that is compared character for character
   against the server's. The Registration panel needs to show a preview of what
   the public will see, and a third hand-written copy of "is it open yet" is
   exactly how the day/pitch tables drifted apart before the venue layout was
   built. One extra module on a back-office page is the cheaper mistake.

   As with the venue, there is no local-backend fallback: in local preview the
   read falls back to the built-in default (which is CLOSED) and saving reports
   that it needs the deployed site, rather than silently writing to localStorage
   and letting someone think registration is set when it is not. */
/* The pitch model, re-exported from the server's own module through
   scores-data.js so the panel cannot grow a second opinion about how a pitch
   splits or what the main pitches are called. Same reasoning as the
   registration rules below. */
export {
  MAIN_PITCHES, SPLITS, derivePitches, remapGroupPitches,
} from './scores-data.js';

export {
  registrationState, registrationCopy, registrationWarnings, validateSettings,
  isRealDate, stampFromDate, dateOfStamp, fmtWindowDate, fmtCountdown,
  DEFAULT_REGISTRATION, REGISTRATION_MODES,
} from './scores-data.js';

/* The Tournament tab's bulk publish calls the same publish path the scores
   and manager pages use — re-exported, not reimplemented, so "publish" cannot
   quietly come to mean two different things. Same reasoning as the pitch
   model and registration rules above. */
export { publishDraw, unpublishDraw } from './scores-data.js';

/* The scoring rules editor, same story: the rules, their labels and their
   point values all come from scores-data.js, which is what the score entry
   forms themselves read — so the editor can never describe a scoring world
   the forms do not live in. */
export {
  loadScoringRules, saveScoringRules, scoringFor, allScoreTypes, scoreLabel, scorePoints,
} from './scores-data.js';

/* Simulate a tournament / Reset the simulation, same story again: every call
   a simulation makes is the exact call the real editor UI makes — same
   server-side checks, same write-and-verify, no second write path. venue()
   and loadVenue() feed the match-day guard; getAgeGroups() carries
   hasStandings; teamNamesFromRegs() is the canonical display-name rule the
   per-group saves rebuild names with. */
export {
  getAgeGroups, getDraw, saveDraw, submitResult, clearResult, allResults,
  ageGroupOfMatch, autoKnockoutSlots, supportsSpiritAward, getMyRegistrations,
  venue, loadVenue, teamNamesFromRegs,
} from './scores-data.js';

export async function getRegistrationWindow() {
  const r = await tryFetchJson('/.netlify/functions/registration-window');
  if (r.real && r.json && r.json.ok) return r.json;
  return { ok: false, error: 'Could not load the registration window.' };
}

export async function saveRegistrationWindow(settings) {
  const r = await tryFetchJson('/.netlify/functions/registration-window', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ settings }),
  });
  if (r.real) return r.json;
  return { ok: false, error: 'Saving the registration window needs the deployed site (not available in local preview).' };
}

export async function resetRegistrationWindow() {
  const r = await tryFetchJson('/.netlify/functions/registration-window', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ reset: true }),
  });
  if (r.real) return r.json;
  return { ok: false, error: 'Resetting the registration window needs the deployed site (not available in local preview).' };
}
