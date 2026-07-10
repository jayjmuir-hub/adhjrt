/* ============================================================
   ADH JRT — Organizer data layer  (MOCK / prototype)
   ------------------------------------------------------------
   Named organizer logins are checked client-side against the demo
   list below. Registration rows are hard-coded sample data shaped
   exactly like the header rows in the two live Google Sheets:
     Team Registrations:   docs.google.com/spreadsheets/d/1u1aGMMFFVsnbbw2atMQWOofGIG7gGMt0OK98ipwjAt8
     Player Registrations: docs.google.com/spreadsheets/d/1rrouliAtSlA2hqoVm8KG7Mke80oq6iBv4tJJkETi2jc

   NOTE(backend): Once the Google Cloud service account + Netlify env
   vars from netlify/functions/submission-created.js are set up, swap
   the bodies of login() and getRegistrations() below for a fetch()
   to a new `netlify/functions/get-registrations.js` endpoint (see the
   template left alongside submission-created.js). That function
   should check the submitted username/password against an
   ORGANIZER_ACCOUNTS env var (a JSON map, ideally hashed passwords)
   before reading the two sheets server-side with the same service
   account credentials, so the sheets themselves can stay private.
   ============================================================ */

// Demo named organizer accounts — replace with the real people who need
// access once the secure backend is wired up. Each account currently has
// full access to both tables; scoped permissions (e.g. medical-notes-only)
// can be added the same way once real data is behind the backend call.
const ORGANIZER_ACCOUNTS = [
  { username: 'jay', password: 'adhjrt-jay', name: 'Jay Muir', role: 'Tournament Director' },
  { username: 'registrar', password: 'adhjrt-registrar', name: 'Registrations Lead', role: 'Registrar' },
  { username: 'medical', password: 'adhjrt-medical', name: 'Medical Lead', role: 'Medical' },
];

const SESSION_KEY = 'adhjrt_organizer_session';

const TEAMS = [
  { submittedAt: '2026-09-14T09:12:00Z', club: 'Abu Dhabi Harlequins', teamName: 'Team 1', ageGroup: 'U12 Mixed Contact', headCoachName: 'Marcus Reed', headCoachEmail: 'marcus.reed@example.com', headCoachMobile: '+971501112222', managerName: 'Alia Khan', managerEmail: 'alia.khan@example.com', managerMobile: '+971502223333', numPlayers: '14', notes: '' },
  { submittedAt: '2026-09-15T11:40:00Z', club: 'Dubai Exiles', teamName: 'Team 1', ageGroup: 'U12 Mixed Contact', headCoachName: 'Tom Fielding', headCoachEmail: 'tom.fielding@example.com', headCoachMobile: '+971503334444', managerName: 'Priya Nair', managerEmail: 'priya.nair@example.com', managerMobile: '+971504445555', numPlayers: '13', notes: 'Arriving Fri night, need 2 extra parking passes' },
  { submittedAt: '2026-09-16T08:05:00Z', club: 'Dubai Sharks', teamName: 'Team 2', ageGroup: 'U14B Contact', headCoachName: 'Chris Bailey', headCoachEmail: 'chris.bailey@example.com', headCoachMobile: '+971505556666', managerName: 'Noura Saeed', managerEmail: 'noura.saeed@example.com', managerMobile: '+971506667777', numPlayers: '15', notes: '' },
  { submittedAt: '2026-09-17T13:22:00Z', club: 'Dubai Hurricanes', teamName: 'Team 1', ageGroup: 'U16B Contact', headCoachName: 'James Ortiz', headCoachEmail: 'james.ortiz@example.com', headCoachMobile: '+971507778888', managerName: 'Fatima Al Zaabi', managerEmail: 'fatima.alzaabi@example.com', managerMobile: '+971508889999', numPlayers: '15', notes: '' },
  { submittedAt: '2026-09-18T10:50:00Z', club: 'Barrelhouse', teamName: 'Team 1', ageGroup: 'U9 Mixed Contact', headCoachName: 'Dan Cooper', headCoachEmail: 'dan.cooper@example.com', headCoachMobile: '+971509990000', managerName: 'Layla Hassan', managerEmail: 'layla.hassan@example.com', managerMobile: '+971501010101', numPlayers: '12', notes: '' },
  { submittedAt: '2026-09-19T15:30:00Z', club: 'Al Ain Amblers', teamName: 'Team 1', ageGroup: 'U18G Contact', headCoachName: 'Rachel Kim', headCoachEmail: 'rachel.kim@example.com', headCoachMobile: '+971502020202', managerName: 'Mona Rashid', managerEmail: 'mona.rashid@example.com', managerMobile: '+971503030303', numPlayers: '14', notes: 'Vegetarian catering x3' },
  { submittedAt: '2026-09-20T09:00:00Z', club: 'Dubai Dragons', teamName: 'Team 1', ageGroup: 'U13 Mixed Contact', headCoachName: 'Peter Novak', headCoachEmail: 'peter.novak@example.com', headCoachMobile: '+971504040404', managerName: 'Huda Farouk', managerEmail: 'huda.farouk@example.com', managerMobile: '+971505050505', numPlayers: '15', notes: '' },
  { submittedAt: '2026-09-21T16:15:00Z', club: 'Dubai Tigers', teamName: 'Team 2', ageGroup: 'U11 Mixed Contact', headCoachName: 'Ollie Grant', headCoachEmail: 'ollie.grant@example.com', headCoachMobile: '+971506060606', managerName: 'Sara Idris', managerEmail: 'sara.idris@example.com', managerMobile: '+971507070707', numPlayers: '11', notes: '' },
  { submittedAt: '2026-09-22T12:05:00Z', club: 'Abu Dhabi Small Blacks', teamName: 'Team 1', ageGroup: 'U8 Tag', headCoachName: 'Ben Foster', headCoachEmail: 'ben.foster@example.com', headCoachMobile: '+971508080808', managerName: 'Amina Yousef', managerEmail: 'amina.yousef@example.com', managerMobile: '+971509091010', numPlayers: '10', notes: '' },
  { submittedAt: '2026-09-23T14:45:00Z', club: 'Abu Dhabi Harlequins', teamName: 'Team 2', ageGroup: 'U14G QR', headCoachName: 'Sophie Marsh', headCoachEmail: 'sophie.marsh@example.com', headCoachMobile: '+971501112121', managerName: 'Reem Salem', managerEmail: 'reem.salem@example.com', managerMobile: '+971502123232', numPlayers: '13', notes: '' },
];

const PLAYERS = [
  { submittedAt: '2026-09-14T09:20:00Z', playerName: 'Ethan Reed', dob: '2014-03-12', club: 'Abu Dhabi Harlequins', ageGroup: 'U12 Mixed Contact', parentName: 'Marcus Reed', parentEmail: 'marcus.reed@example.com', parentMobile: '+971501112222', emergencyContact: 'Marcus Reed', emergencyMobile: '+971501112222', medicalNotes: 'Mild asthma, carries inhaler', consent: 'Yes', playUpConsent: 'No' },
  { submittedAt: '2026-09-14T09:24:00Z', playerName: 'Zayd Karim', dob: '2014-06-02', club: 'Abu Dhabi Harlequins', ageGroup: 'U12 Mixed Contact', parentName: 'Farah Karim', parentEmail: 'farah.karim@example.com', parentMobile: '+971501113344', emergencyContact: 'Omar Karim', emergencyMobile: '+971501114455', medicalNotes: '', consent: 'Yes', playUpConsent: 'No' },
  { submittedAt: '2026-09-15T11:45:00Z', playerName: 'Harry Fielding', dob: '2014-01-22', club: 'Dubai Exiles', ageGroup: 'U12 Mixed Contact', parentName: 'Tom Fielding', parentEmail: 'tom.fielding@example.com', parentMobile: '+971503334444', emergencyContact: 'Tom Fielding', emergencyMobile: '+971503334444', medicalNotes: 'Peanut allergy — EpiPen in kit bag', consent: 'Yes', playUpConsent: 'No' },
  { submittedAt: '2026-09-16T08:10:00Z', playerName: 'Leo Bailey', dob: '2012-05-30', club: 'Dubai Sharks', ageGroup: 'U14B Contact', parentName: 'Chris Bailey', parentEmail: 'chris.bailey@example.com', parentMobile: '+971505556666', emergencyContact: 'Sam Bailey', emergencyMobile: '+971505557777', medicalNotes: '', consent: 'Yes', playUpConsent: 'Yes' },
  { submittedAt: '2026-09-16T08:16:00Z', playerName: 'Adam Rashid', dob: '2012-09-18', club: 'Dubai Sharks', ageGroup: 'U14B Contact', parentName: 'Nadia Rashid', parentEmail: 'nadia.rashid@example.com', parentMobile: '+971505558888', emergencyContact: 'Khalid Rashid', emergencyMobile: '+971505559999', medicalNotes: '', consent: 'Yes', playUpConsent: 'No' },
  { submittedAt: '2026-09-17T13:30:00Z', playerName: 'Jack Ortiz', dob: '2010-11-04', club: 'Dubai Hurricanes', ageGroup: 'U16B Contact', parentName: 'James Ortiz', parentEmail: 'james.ortiz@example.com', parentMobile: '+971507778888', emergencyContact: 'James Ortiz', emergencyMobile: '+971507778888', medicalNotes: 'Previous shoulder injury (cleared to play)', consent: 'Yes', playUpConsent: 'No' },
  { submittedAt: '2026-09-18T10:55:00Z', playerName: 'Noor Hassan', dob: '2017-02-14', club: 'Barrelhouse', ageGroup: 'U9 Mixed Contact', parentName: 'Layla Hassan', parentEmail: 'layla.hassan@example.com', parentMobile: '+971509990000', emergencyContact: 'Youssef Hassan', emergencyMobile: '+971509991111', medicalNotes: '', consent: 'Yes', playUpConsent: 'No' },
  { submittedAt: '2026-09-19T15:35:00Z', playerName: 'Grace Kim', dob: '2008-07-09', club: 'Al Ain Amblers', ageGroup: 'U18G Contact', parentName: 'Rachel Kim', parentEmail: 'rachel.kim@example.com', parentMobile: '+971502020202', emergencyContact: 'Rachel Kim', emergencyMobile: '+971502020202', medicalNotes: '', consent: 'Yes', playUpConsent: 'No' },
  { submittedAt: '2026-09-20T09:05:00Z', playerName: 'Milo Novak', dob: '2013-04-27', club: 'Dubai Dragons', ageGroup: 'U13 Mixed Contact', parentName: 'Peter Novak', parentEmail: 'peter.novak@example.com', parentMobile: '+971504040404', emergencyContact: 'Peter Novak', emergencyMobile: '+971504040404', medicalNotes: 'Type 1 diabetes — insulin kit with team manager', consent: 'Yes', playUpConsent: 'No' },
  { submittedAt: '2026-09-21T16:20:00Z', playerName: 'Finn Grant', dob: '2015-08-19', club: 'Dubai Tigers', ageGroup: 'U11 Mixed Contact', parentName: 'Ollie Grant', parentEmail: 'ollie.grant@example.com', parentMobile: '+971506060606', emergencyContact: 'Ollie Grant', emergencyMobile: '+971506060606', medicalNotes: '', consent: 'Yes', playUpConsent: 'No' },
  { submittedAt: '2026-09-22T12:10:00Z', playerName: 'Sara Foster', dob: '2018-12-01', club: 'Abu Dhabi Small Blacks', ageGroup: 'U8 Tag', parentName: 'Ben Foster', parentEmail: 'ben.foster@example.com', parentMobile: '+971508080808', emergencyContact: 'Ben Foster', emergencyMobile: '+971508080808', medicalNotes: '', consent: 'Yes', playUpConsent: 'No' },
  { submittedAt: '2026-09-23T14:50:00Z', playerName: 'Amelia Marsh', dob: '2012-10-16', club: 'Abu Dhabi Harlequins', ageGroup: 'U14G QR', parentName: 'Sophie Marsh', parentEmail: 'sophie.marsh@example.com', parentMobile: '+971501112121', emergencyContact: 'Sophie Marsh', emergencyMobile: '+971501112121', medicalNotes: '', consent: 'Yes', playUpConsent: 'No' },
];

function delay(v, ms = 220) { return new Promise((res) => setTimeout(() => res(v), ms)); }

export async function login(username, password) {
  const acct = ORGANIZER_ACCOUNTS.find((a) => a.username === username.trim().toLowerCase() && a.password === password);
  if (!acct) return delay({ ok: false, error: 'Incorrect username or password.' });
  const session = { username: acct.username, name: acct.name, role: acct.role };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
  return delay({ ok: true, session });
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

// NOTE(backend): replace this mock with a fetch() to
// netlify/functions/get-registrations.js, passing the session/token so the
// function can verify it before reading the private sheets server-side.
export async function getRegistrations() {
  return delay({ teams: TEAMS, players: PLAYERS });
}
