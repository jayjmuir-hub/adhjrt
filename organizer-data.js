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

const SESSION_KEY = 'adhjrt_organizer_session';

let localBackendPromise = null;
function local() {
  if (!localBackendPromise) localBackendPromise = import(new URL('local-backend.js', document.baseURI).href);
  return localBackendPromise;
}

// Tries the real Netlify Function; if it can't even be reached, or
// doesn't return valid JSON (both signs no backend is deployed here),
// signals the caller to use the local fallback instead. A real error
// response from an actually-deployed function (wrong password, etc.)
// is still valid JSON, so it's trusted as-is and never falls back.
async function tryFetchJson(url, opts) {
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    try { return { real: true, json: JSON.parse(text) }; } catch (e) { return { real: false }; }
  } catch (e) {
    return { real: false };
  }
}

export async function login(username, password) {
  const r = await tryFetchJson('/.netlify/functions/organizer-login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = r.real ? r.json : (await local()).organizerLogin({ username, password });
  if (json.ok) {
    const session = { ...json.session, token: json.token };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
    return { ok: true, session };
  }
  // If these were actually manager credentials (they clicked the wrong login),
  // sign them in as a manager and send them to the scores/manager area — the
  // organizer dashboard is organizer-only, so there's nothing useful to show a
  // manager here.
  const rm = await tryFetchJson('/.netlify/functions/manager-login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const mjson = rm.real ? rm.json : (await local()).managerLogin({ username, password });
  if (mjson.ok) {
    const mgrSession = { ...mjson.session, token: mjson.token };
    // 'adhjrt_session_v1' is the scores page's manager session key (SESSION_KEY in scores-data.js).
    try { localStorage.setItem('adhjrt_session_v1', JSON.stringify(mgrSession)); } catch (e) {}
    return { ok: true, redirect: '/scores' };
  }
  return { ok: false, error: json.error || 'Incorrect username or password.' };
}

// Organizer self-signup, gated by ORGANIZER_INVITE_CODE (see
// organizer-signup.js). `title` is a free-text label shown next to the
// organizer's name (e.g. "Registrar", "Medical Lead") — every organizer
// currently has the same full access to both registration tables.
// New accounts are pending until an existing organizer approves them
// (res.pending === true) — the very first organizer ever created is
// auto-approved.
export async function signup({ name, title, username, password, inviteCode }) {
  const r = await tryFetchJson('/.netlify/functions/organizer-signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, title, username, password, inviteCode }),
  });
  const json = r.real ? r.json : (await local()).organizerSignup({ name, title, username, password, inviteCode });
  if (json.ok && json.pending) return { ok: true, pending: true, message: json.message };
  if (json.ok) {
    const session = { ...json.session, token: json.token };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
    return { ok: true, session };
  }
  return { ok: false, error: json.error || 'Could not create account.' };
}

export function currentSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function logout() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}

export async function getRegistrations() {
  const session = currentSession();
  if (!session || !session.token) return { teams: [], players: [] };
  const r = await tryFetchJson('/.netlify/functions/get-registrations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.token}` },
  });
  if (r.real) return r.json.ok ? { teams: r.json.teams, players: r.json.players } : { teams: [], players: [] };
  return (await local()).sampleRegistrations();
}

// -------- Account approvals (Accounts tab) --------
function authHeaders() {
  const session = currentSession();
  return session && session.token ? { 'Authorization': `Bearer ${session.token}` } : {};
}

export async function listAccounts() {
  const session = currentSession();
  const r = await tryFetchJson('/.netlify/functions/accounts-admin', { headers: authHeaders() });
  if (r.real) return r.json.ok ? r.json.accounts : [];
  return (await local()).accountsList(session && session.token);
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

// Create an age-group Manager login directly (organizer-only, server-side).
// The new account is approved immediately, so the manager can sign in right
// away — useful for testing and for onboarding without invite codes.
export async function createManager({ name, username, password, ageGroupId }) {
  const r = await tryFetchJson('/.netlify/functions/accounts-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ action: 'create', name, username, password, ageGroupId }),
  });
  if (r.real) return r.json;
  return { ok: false, error: 'Creating logins needs the deployed site (not available in local preview).' };
}
