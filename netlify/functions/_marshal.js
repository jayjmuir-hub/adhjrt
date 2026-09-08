// netlify/functions/_marshal.js
//
// Pitch marshal links — the credential a volunteer parent scores with.
// Spec: claude/specs/spec-pitch-marshals-sep-2026.md
//
// WHAT A MARSHAL LINK IS. A signed token for ONE age group's ONE pitch on
// ONE day, issued by that group's manager (or an organiser), carried in the
// URL fragment `/app#marshal=<token>`. Whoever opens it types their first
// name and scores that pitch's matches. It is per PITCH, never per person:
// volunteers swap without telling anyone, so anything issued per person
// fails on the first swap. The name is asked for on every save instead.
//
// HOW IT IS REVOKED. The `marshals` store holds one record per
// (ageGroupId, day, pitch): { jti, issuedAt, issuedBy, revokedAt }. A token
// is live only while its `jti` is the record's current one and the record is
// not revoked. Issuing again mints a new jti, so the old link dies without a
// separate revoke. The token itself is never stored — only enough to
// recognise it (same rule as club-link.js and CLUB_FORM_KEY).
//
// WHEN IT IS LIVE. Only on its `day`, in Gulf time, computed from
// DEFAULT_VENUE — never from the token. Issued early is fine; it goes live
// at midnight and dies at midnight. verify()'s own six-month ceiling still
// applies on top.

const crypto = require('crypto');
const { sign, verify, getBearerToken, blobStore } = require('./_auth');
const { DEFAULT_VENUE, DAY_IDS } = require('./_venue');

const GST = '+04:00';
const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDayUTC = (isoDate) => Date.parse(`${isoDate}T00:00:00${GST}`);

const recordKey = (ageGroupId, day, pitch) => `${ageGroupId}:${day}:${pitch}`;
const marshalStore = () => blobStore('marshals');

/* The window a token for `day` is live in: [00:00, 24:00) Gulf time. */
function dayWindow(day) {
  if (!DAY_IDS.includes(day) || !DEFAULT_VENUE[day]) return null;
  const start = startOfDayUTC(DEFAULT_VENUE[day].date);
  return { start, end: start + DAY_MS, label: DEFAULT_VENUE[day].label };
}
function isLiveDay(day, now = Date.now()) {
  const w = dayWindow(day);
  return !!w && now >= w.start && now < w.end;
}

async function issue(ageGroupId, day, pitch, issuedBy) {
  const jti = crypto.randomBytes(12).toString('base64url');
  const record = { jti, issuedAt: new Date().toISOString(), issuedBy, revokedAt: null };
  await marshalStore().setJSON(recordKey(ageGroupId, day, pitch), record);
  const token = sign({ kind: 'marshal', ageGroupId, day, pitch, jti });
  return { token, record };
}

async function revoke(ageGroupId, day, pitch, revokedBy) {
  const key = recordKey(ageGroupId, day, pitch);
  const store = marshalStore();
  const current = (await store.get(key, { type: 'json' })) || null;
  if (!current) return null;
  const record = { ...current, revokedAt: new Date().toISOString(), revokedBy };
  await store.setJSON(key, record);
  return record;
}

async function readRecord(ageGroupId, day, pitch) {
  return (await marshalStore().get(recordKey(ageGroupId, day, pitch), { type: 'json' })) || null;
}

/* The marshal identity behind a request, or null with a reason. Reads the
   bearer token; a session token (kind absent) answers null so the ordinary
   session path can run instead. */
async function verifyMarshal(event, now = Date.now()) {
  const payload = verify(getBearerToken(event));
  if (!payload || payload.kind !== 'marshal') return { ok: false, reason: 'not-marshal' };
  const { ageGroupId, day, pitch, jti } = payload;
  if (!ageGroupId || !day || !pitch || !jti) return { ok: false, reason: 'malformed' };
  if (!isLiveDay(day, now)) return { ok: false, reason: 'not-today' };
  let record;
  try { record = await readRecord(ageGroupId, day, pitch); } catch (e) { return { ok: false, reason: 'store' }; }
  if (!record || record.jti !== jti) return { ok: false, reason: 'reissued' };
  if (record.revokedAt) return { ok: false, reason: 'revoked' };
  return { ok: true, marshal: { ageGroupId, day, pitch, jti } };
}

const NOT_LIVE = 'This pitch link is no longer live. Ask the age-group table for a new one.';

module.exports = { recordKey, dayWindow, isLiveDay, issue, revoke, readRecord, verifyMarshal, NOT_LIVE };
