/* ============================================================
   ADH JRT — Organizer data layer  (LIVE backend)
   ------------------------------------------------------------
   Organizer accounts self-signup via organizer-signup.js (gated by a
   shared invite code) and are stored server-side in Netlify Blobs.
   Registrations are read live from the two Google Sheets via
   get-registrations.js, which requires the signed-in organizer's
   session token. See those files in netlify/functions/ for one-time
   setup (ORGANIZER_INVITE_CODE + SESSION_SECRET env vars, on top of
   the GOOGLE_* vars documented in submission-created.js).
   ============================================================ */

const SESSION_KEY = 'adhjrt_organizer_session';

export async function login(username, password) {
  try {
    const res = await fetch('/.netlify/functions/organizer-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    if (json.ok) {
      const session = { ...json.session, token: json.token };
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
      return { ok: true, session };
    }
    return { ok: false, error: json.error || 'Incorrect username or password.' };
  } catch (e) {
    return { ok: false, error: 'Could not reach the server. Try again.' };
  }
}

// Organizer self-signup, gated by ORGANIZER_INVITE_CODE (see
// organizer-signup.js). `title` is a free-text label shown next to the
// organizer's name (e.g. "Registrar", "Medical Lead") — every organizer
// currently has the same full access to both registration tables.
export async function signup({ name, title, username, password, inviteCode }) {
  try {
    const res = await fetch('/.netlify/functions/organizer-signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, title, username, password, inviteCode }),
    });
    const json = await res.json();
    if (json.ok) {
      const session = { ...json.session, token: json.token };
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
      return { ok: true, session };
    }
    return { ok: false, error: json.error || 'Could not create account.' };
  } catch (e) {
    return { ok: false, error: 'Could not reach the server. Try again.' };
  }
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
  try {
    const res = await fetch('/.netlify/functions/get-registrations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.token}` },
    });
    const json = await res.json();
    if (!json.ok) return { teams: [], players: [] };
    return { teams: json.teams, players: json.players };
  } catch (e) {
    return { teams: [], players: [] };
  }
}
