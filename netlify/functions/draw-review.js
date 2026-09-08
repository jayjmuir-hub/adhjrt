// netlify/functions/draw-review.js
//
// "Send for review": a manager with an edit right says their draft is ready,
// the organisers get an email, and the organiser Fixtures tab shows the group
// under "Awaiting review" until somebody publishes it or dismisses the note.
// Spec: claude/specs/spec-draw-rights-sep-2026.md § 5.
//
// POST { action: 'request', ageGroupId, note? }   manager with an edit right for
//                                                 that group, or an organiser
//   -> writes review:<ageGroupId> in the `schedules` store and emails every
//      approved organiser account that carries an email address (the Club Hub
//      sign-in gives every hub account one — spec decision 1). Rate-limited to
//      one request per group per ten minutes, so a stuck button cannot mail the
//      committee thirty times.
// POST { action: 'dismiss', ageGroupId }           organiser
//   -> deletes the record. publish-schedule.js deletes it too on publish.
// GET                                              organiser
//   -> { ok, reviews: [{ ageGroupId, requestedBy, requestedAt, note }] }
//
// ⚠️ The email is best-effort. If the mail service is down the record is
// still written, the strip still shows the group, and the answer says
// `emailed: false` so the manager can tell the desk by other means. A
// review request must never fail because Microsoft Graph did.

const { resolveSession, sessionRefusal, hasAgeGroupAccess, blobStore, loadAccounts } = require('./_auth');
const { rightsFor } = require('./_drawRights');
const { checkRate, tooManyResponse } = require('./_ratelimit');
const { sendMail, wrap, esc, row } = require('./_email');
const { MAX_FIELD_CHARS } = require('./_intake');

const reviewKey = (ageGroupId) => `review:${ageGroupId}`;
const REVIEW_PREFIX = 'review:';
const RATE = { max: 1, windowMs: 10 * 60 * 1000 };
const json = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });

/* Age-group names for the email subject, mirroring AGE_GROUPS in scores-data. */
const NAMES = {
  u6: 'U6', u7: 'U7', u8: 'U8', u9: 'U9', u10: 'U10', u11: 'U11', u12: 'U12', u12g: 'U12 Girls', u13: 'U13',
  u14b: 'U14 Boys', u14g: 'U14 Girls', u16b: 'U16 Boys', u16g: 'U16 Girls', u18b: 'U18 Boys', u18g: 'U18 Girls',
};
const nameOf = (id) => NAMES[id] || String(id || '').toUpperCase();

async function organiserAddresses() {
  const accounts = await loadAccounts();
  return [...new Set(accounts
    .filter((a) => a.role === 'organizer' && a.approved && typeof a.email === 'string' && a.email.includes('@'))
    .map((a) => a.email.trim().toLowerCase()))];
}

async function listReviews(store) {
  let blobs = [];
  try { blobs = ((await store.list({ prefix: REVIEW_PREFIX })) || {}).blobs || []; } catch (e) { blobs = []; }
  const out = [];
  for (const b of blobs) {
    if (!b.key || !b.key.startsWith(REVIEW_PREFIX)) continue;
    const r = await store.get(b.key, { type: 'json' });
    if (r) out.push({ ageGroupId: b.key.slice(REVIEW_PREFIX.length), ...r });
  }
  return out.sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));
}

exports.handler = async (event) => {
  try {
    const auth = await resolveSession(event);
    if (!auth.ok) return sessionRefusal(auth);
    const session = auth.session;
    const store = blobStore('schedules');

    if (event.httpMethod === 'GET') {
      if (session.role !== 'organizer') return json(403, { ok: false, error: 'Only tournament organisers can see the review queue.' });
      return json(200, { ok: true, reviews: await listReviews(store) });
    }
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

    const { action, ageGroupId, note } = JSON.parse(event.body || '{}');
    if (!ageGroupId) return json(400, { ok: false, error: 'Missing ageGroupId.' });

    if (action === 'dismiss') {
      if (session.role !== 'organizer') return json(403, { ok: false, error: 'Only tournament organisers can dismiss a review request.' });
      await store.delete(reviewKey(ageGroupId));
      return json(200, { ok: true });
    }

    if (action !== 'request') return json(400, { ok: false, error: 'Unknown action.' });

    if (!hasAgeGroupAccess(session, ageGroupId)) return json(403, { ok: false, error: 'You can only send your own age group’s draw for review.' });
    const r = rightsFor(session);
    if (session.role === 'manager' && !r.pools && !r.times) {
      return json(403, { ok: false, error: 'Your organisers manage this group’s draw, so there is nothing of yours to send for review.' });
    }

    /* The draft check comes BEFORE the rate limit: a request refused for
       having nothing to review must not spend the one-per-ten-minutes budget,
       or the manager who saves and tries again is told to wait. */
    const draft = await store.get(ageGroupId, { type: 'json' });
    if (!draft) return json(400, { ok: false, error: 'Save the draw first, then send it for review.' });

    const rate = await checkRate(blobStore('config'), `review:${ageGroupId}`, Date.now(), RATE);
    if (!rate.ok) return tooManyResponse(rate);

    const record = {
      requestedBy: session.username,
      requestedAt: new Date().toISOString(),
      note: String(note || '').trim().slice(0, MAX_FIELD_CHARS) || '',
    };
    await store.setJSON(reviewKey(ageGroupId), record);

    let emailed = false;
    try {
      const to = await organiserAddresses();
      if (to.length) {
        const name = nameOf(ageGroupId);
        const rows = [row('Age group', name), row('Sent by', session.username), row('Note', record.note || '—')].join('');
        const res = await sendMail({
          to,
          subject: `Draw ready for review — ${name} | ADH JRT 2026`,
          html: wrap(
            'A draw is ready for review',
            `${esc(session.username)} has finished the <strong>${esc(name)}</strong> draw and asked for it to be checked and published.`,
            rows,
            'Open the tournament back office, choose the age group in /manager, run the weekend clash check, and publish when it is right. The group stays under "Awaiting review" on the Fixtures tab until it is published or dismissed.'
          ),
        });
        emailed = !!(res && res.sent);
      }
    } catch (err) {
      console.warn('draw-review: email failed -', err && err.message);
    }

    return json(200, { ok: true, emailed, requestedAt: record.requestedAt });
  } catch (err) {
    console.error('draw-review error:', err);
    return json(500, { ok: false, error: 'Server error.' });
  }
};

module.exports.reviewKey = reviewKey;
