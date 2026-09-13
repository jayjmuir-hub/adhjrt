// netlify/functions/publish-schedule.js
//
// Makes one age group's draft fixtures public, or withdraws them again.
// Requires an Authorization: Bearer <token> header. Permission is decided by
// _publish.js — organisers only (managers stopped being able to publish on
// 8 Sep 2026; see the tombstone in _publish.js's publishDenialReason).
//
// POST { ageGroupId, action: 'publish' }
//   -> copies the draft into the published slot. The draft is left alone, so
//      editing can continue afterwards without affecting what is public until
//      it is published again.
//
// POST { ageGroupId, action: 'unpublish' }
//   -> deletes the published copy. The public page reverts to the
//      auto-generated draw. Anyone who had already seen the fixtures will find
//      them gone, so the UI should warn before calling this.

const { resolveSession, sessionRefusal, blobStore } = require('./_auth');
const { draftKey, publishedKey, publishDenialReason } = require('./_publish');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    /* resolveSession + sessionRefusal, not optionalSession (JRT-20). A revoked
       or deleted token used to collapse to null here and get a bare 401/403 with
       no sessionEnded marker, so the client never signed the person out — this
       was the one endpoint that refused a session without the shared builder.
       Now a finished session is signed out like everywhere else, while a store
       blip (503, no marker) and the wrong-role refusal below both keep the
       person signed in. */
    const auth = await resolveSession(event);
    if (!auth.ok) return sessionRefusal(auth);
    const session = auth.session;

    const { ageGroupId, action } = JSON.parse(event.body || '{}');

    if (!ageGroupId) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing ageGroupId.' }) };
    }
    if (action !== 'publish' && action !== 'unpublish') {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Unknown action.' }) };
    }

    /* A valid session that simply may not publish (a manager — organisers only
       since 8 Sep 2026) is a 403 that STAYS signed in, not a session refusal. */
    const denied = publishDenialReason(session, ageGroupId);
    if (denied) {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: denied }) };
    }

    const store = blobStore('schedules');

    if (action === 'unpublish') {
      await store.delete(publishedKey(ageGroupId));
      return { statusCode: 200, body: JSON.stringify({ ok: true, published: false }) };
    }

    const draft = await store.get(draftKey(ageGroupId), { type: 'json' });
    if (!draft) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          error: 'There is nothing to publish for this age group yet — save a draw first.',
        }),
      };
    }

    const record = {
      schedule: draft,
      publishedAt: new Date().toISOString(),
      publishedBy: session.username,
    };
    await store.setJSON(publishedKey(ageGroupId), record);
    /* Publishing answers a review request (spec-draw-rights § 5): the group
       leaves the organiser's "Awaiting review" strip. Best-effort — a
       leftover note is a nuisance, a failed publish is not. */
    try { await store.delete(`review:${ageGroupId}`); } catch (e) { /* see above */ }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, published: true, publishedAt: record.publishedAt }),
    };
  } catch (err) {
    console.error('publish-schedule error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
