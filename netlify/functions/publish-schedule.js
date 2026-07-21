// netlify/functions/publish-schedule.js
//
// Makes one age group's draft fixtures public, or withdraws them again.
// Requires an Authorization: Bearer <token> header. Permission is decided by
// _publish.js — organisers any time, managers only on the tournament days.
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

const { verify, getBearerToken, blobStore } = require('./_auth');
const { draftKey, publishedKey, publishDenialReason } = require('./_publish');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const session = verify(getBearerToken(event));
    const { ageGroupId, action } = JSON.parse(event.body || '{}');

    if (!ageGroupId) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing ageGroupId.' }) };
    }
    if (action !== 'publish' && action !== 'unpublish') {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Unknown action.' }) };
    }

    const denied = publishDenialReason(session, ageGroupId);
    if (denied) {
      return {
        statusCode: session ? 403 : 401,
        body: JSON.stringify({ ok: false, error: denied }),
      };
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

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, published: true, publishedAt: record.publishedAt }),
    };
  } catch (err) {
    console.error('publish-schedule error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
