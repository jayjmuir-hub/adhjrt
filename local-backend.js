/* ============================================================
   ADH JRT — Local test backend (PREVIEW ONLY, not for production)
   ------------------------------------------------------------
   This project's real backend is a set of Netlify Functions + Netlify
   Blobs (see netlify/functions/*.js) — they only exist once this site
   is deployed to Netlify. This file is a stand-in that mimics the exact
   same behavior using localStorage, purely so signup/login/approval/
   the fixture editor/score entry can all be tried out right here in
   this preview before you deploy anything.

   organizer-data.js and scores-data.js try the real Netlify Function
   first; if that fails (no backend deployed here) or 404s, they fall
   back to the matching function below. Once deployed for real, the
   real functions respond normally and this file is never used.

   Passwords here are stored in plain text and tokens are just base64 —
   totally fine for local testing, NOT how the real backend works (that
   uses bcrypt hashing + HMAC-signed tokens server-side).

   Invite codes for local testing (separate from your real Netlify env
   vars — set those when you deploy):
     Organizer:     test-organizer
     Manager (any age group id): test-<id>  e.g. test-u16b, test-u8, test-u12g
     Manager (admin, all groups): test-admin
   ============================================================ */

const ACCOUNTS_KEY = 'adhjrt_local_accounts';
const RESULTS_KEY = 'adhjrt_local_results';
const SCHEDULES_KEY = 'adhjrt_local_schedules';

const ORGANIZER_CODE = 'test-organizer';
const MANAGER_AGE_IDS = ['u6', 'u7', 'u8', 'u9', 'u10', 'u11', 'u12', 'u12g', 'u13', 'u14b', 'u14g', 'u16b', 'u16g', 'u18b', 'u18g'];

function readJson(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
}
function writeJson(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

function loadAccounts() { return readJson(ACCOUNTS_KEY, []); }
function saveAccounts(list) { writeJson(ACCOUNTS_KEY, list); }

function makeToken(payload) {
  try { return 'local.' + btoa(unescape(encodeURIComponent(JSON.stringify(payload)))); } catch (e) { return 'local.' + JSON.stringify(payload); }
}
function readToken(token) {
  try {
    if (!token || !token.startsWith('local.')) return null;
    return JSON.parse(decodeURIComponent(escape(atob(token.slice(6)))));
  } catch (e) { return null; }
}
function hasAgeGroupAccess(session, ageGroupId) {
  if (!session) return false;
  if (session.role === 'organizer') return true;
  if (session.role === 'manager') return session.ageGroupId === '*' || session.ageGroupId === ageGroupId;
  return false;
}

function managerCodeToAgeGroup(code) {
  if (code === 'test-admin') return '*';
  const m = MANAGER_AGE_IDS.find((id) => `test-${id}` === code);
  return m || null;
}

/* -------- Organizer -------- */
export function organizerSignup({ name, title, username, password, inviteCode }) {
  if (!name || !username || !password || !inviteCode) return { ok: false, error: 'All fields are required.' };
  if (inviteCode !== ORGANIZER_CODE) return { ok: false, error: `Incorrect invite code. (Local test mode — use "${ORGANIZER_CODE}".)` };
  if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
  const uname = username.trim().toLowerCase();
  const accounts = loadAccounts();
  if (accounts.some((a) => a.username === uname)) return { ok: false, error: 'That username is already taken.' };
  const isFirstOrganizer = !accounts.some((a) => a.role === 'organizer');
  const account = { username: uname, password, name, role: 'organizer', title: title || 'Organizer', approved: isFirstOrganizer, createdAt: new Date().toISOString() };
  accounts.push(account);
  saveAccounts(accounts);
  if (!account.approved) return { ok: true, pending: true, message: 'Account created (local test mode). A tournament organizer needs to approve you before you can sign in.' };
  const session = { username: uname, name, role: title || 'Organizer' };
  return { ok: true, session, token: makeToken({ username: uname, role: 'organizer' }) };
}
export function organizerLogin({ username, password }) {
  const uname = (username || '').trim().toLowerCase();
  const accounts = loadAccounts();
  const account = accounts.find((a) => a.username === uname && a.role === 'organizer');
  if (!account || account.password !== password) return { ok: false, error: 'Incorrect username or password.' };
  if (!account.approved) return { ok: false, error: 'Your account is still pending approval from a tournament organizer.' };
  const session = { username: account.username, name: account.name, role: account.title || 'Organizer' };
  return { ok: true, session, token: makeToken({ username: account.username, role: 'organizer' }) };
}

/* -------- Manager -------- */
export function managerSignup({ name, username, password, inviteCode }) {
  if (!name || !username || !password || !inviteCode) return { ok: false, error: 'All fields are required.' };
  if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
  const ageGroupId = managerCodeToAgeGroup(inviteCode);
  if (!ageGroupId) return { ok: false, error: `Incorrect invite code. (Local test mode — try "test-u16b" or "test-admin".)` };
  const uname = username.trim().toLowerCase();
  const accounts = loadAccounts();
  if (accounts.some((a) => a.username === uname)) return { ok: false, error: 'That username is already taken.' };
  accounts.push({ username: uname, password, name, role: 'manager', ageGroupId, approved: false, createdAt: new Date().toISOString() });
  saveAccounts(accounts);
  return { ok: true, pending: true, message: 'Account created (local test mode). A tournament organizer needs to approve you before you can sign in.' };
}
export function managerLogin({ username, password }) {
  const uname = (username || '').trim().toLowerCase();
  const accounts = loadAccounts();
  const account = accounts.find((a) => a.username === uname && a.role === 'manager');
  if (!account || account.password !== password) return { ok: false, error: 'Wrong username or password.' };
  if (!account.approved) return { ok: false, error: 'Your account is still pending approval from a tournament organizer.' };
  const session = { username: account.username, name: account.name, ageGroupId: account.ageGroupId };
  return { ok: true, session, token: makeToken({ username: account.username, role: 'manager', ageGroupId: account.ageGroupId }) };
}

/* -------- Accounts admin (Organizer dashboard "Accounts" tab) -------- */
export function accountsList(token) {
  const session = readToken(token);
  if (!session || session.role !== 'organizer') return [];
  return loadAccounts().map(({ password, ...rest }) => rest);
}
export function accountsAction(token, action, username) {
  const session = readToken(token);
  if (!session || session.role !== 'organizer') return { ok: false, error: 'Not signed in.' };
  const accounts = loadAccounts();
  const idx = accounts.findIndex((a) => a.username === username);
  if (idx === -1) return { ok: false, error: 'Account not found.' };
  if (action === 'approve') accounts[idx].approved = true;
  else if (action === 'reject') accounts.splice(idx, 1);
  else if (action === 'revoke') accounts[idx].approved = false;
  else return { ok: false, error: 'Unknown action.' };
  saveAccounts(accounts);
  return { ok: true };
}

/* -------- Sample registrations (local preview only — real data comes from Google Sheets) -------- */
export function sampleRegistrations() {
  return {
    teams: [
      { submittedAt: '2026-09-14T09:12:00Z', club: 'Abu Dhabi Harlequins', teamName: 'Team 1', ageGroup: 'U16B Contact', headCoachName: 'Marcus Reed', headCoachEmail: 'marcus.reed@example.com', headCoachMobile: '+971501112222', managerName: 'Alia Khan', managerEmail: 'alia.khan@example.com', managerMobile: '+971502223333', numPlayers: '14', notes: '(local preview sample data)' },
      { submittedAt: '2026-09-15T11:40:00Z', club: 'Dubai Exiles', teamName: 'Team 1', ageGroup: 'U16B Contact', headCoachName: 'Tom Fielding', headCoachEmail: 'tom.fielding@example.com', headCoachMobile: '+971503334444', managerName: 'Priya Nair', managerEmail: 'priya.nair@example.com', managerMobile: '+971504445555', numPlayers: '13', notes: '' },
    ],
    players: [
      { submittedAt: '2026-09-14T09:20:00Z', playerName: 'Ethan Reed', dob: '2010-03-12', club: 'Abu Dhabi Harlequins', ageGroup: 'U16B Contact', parentName: 'Marcus Reed', parentEmail: 'marcus.reed@example.com', parentMobile: '+971501112222', emergencyContact: 'Marcus Reed', emergencyMobile: '+971501112222', medicalNotes: '(local preview sample data)', consent: 'Yes', playUpConsent: 'No' },
    ],
  };
}

/* -------- Results (score entry) -------- */
export function getResults() { return readJson(RESULTS_KEY, {}); }
export function submitResult(token, matchId, data) {
  const session = readToken(token);
  if (!session || (session.role !== 'manager' && session.role !== 'organizer')) return { ok: false, error: 'Not signed in.' };
  const agId = matchId.split(':')[0];
  if (!hasAgeGroupAccess(session, agId)) return { ok: false, error: 'You can only enter scores for your own age group.' };
  const WALKOVER_SCORE = 20;
  const results = getResults();
  results[matchId] = {
    homeScore: data.walkover === 'home' ? WALKOVER_SCORE : (data.walkover === 'away' ? 0 : Number(data.homeScore)),
    awayScore: data.walkover === 'away' ? WALKOVER_SCORE : (data.walkover === 'home' ? 0 : Number(data.awayScore)),
    homeTries: data.walkover === 'home' ? 4 : (data.walkover === 'away' ? 0 : Number(data.homeTries || 0)),
    awayTries: data.walkover === 'away' ? 4 : (data.walkover === 'home' ? 0 : Number(data.awayTries || 0)),
    homeCards: Number(data.homeCards || 0), awayCards: Number(data.awayCards || 0),
    walkover: data.walkover || null,
    spiritNomineeHome: (data.spiritNomineeHome || '').trim() || null,
    spiritNomineeAway: (data.spiritNomineeAway || '').trim() || null,
    submittedBy: session.username, submittedAt: new Date().toISOString(),
  };
  writeJson(RESULTS_KEY, results);
  return { ok: true };
}

/* -------- Schedule / draw override (fixture editor) -------- */
export function getScheduleOverride(ageGroupId) {
  const all = readJson(SCHEDULES_KEY, {});
  return all[ageGroupId] || null;
}
export function saveScheduleOverride(token, ageGroupId, schedule, reset) {
  const session = readToken(token);
  if (!session || (session.role !== 'manager' && session.role !== 'organizer')) return { ok: false, error: 'Not signed in.' };
  if (!hasAgeGroupAccess(session, ageGroupId)) return { ok: false, error: 'You can only edit your own age group\u2019s fixtures.' };
  const all = readJson(SCHEDULES_KEY, {});
  if (reset) { delete all[ageGroupId]; writeJson(SCHEDULES_KEY, all); return { ok: true }; }
  all[ageGroupId] = schedule;
  writeJson(SCHEDULES_KEY, all);
  return { ok: true };
}
