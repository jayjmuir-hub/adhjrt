// netlify/functions/get-schedule-override.js
//
// Returns the custom draw (pool membership + match slots with times/pitches)
// for one age group.
//
// WHAT EACH CALLER GETS
//   No token (the public Fixtures/Standings page)
//       -> the PUBLISHED draw, or null if nothing has been published. Null
//          means the reader falls back to the deterministic auto-generated
//          draw in scores-data.js, exactly as an untouched age group always
//          did. A manager's unpublished edits are never visible here.
//
//   Valid manager/organiser token + ?draft=1 (the Manager area editor)
//       -> the DRAFT, so editing continues from where it was left.
//
// Either way the response carries the publish state, so the editor can show
// whether this age group is live and when it went out.

const { verify, getBearerToken, hasAgeGroupAccess, blobStore } = require('./_auth');
const { draftKey, publishedKey, isTournamentWindow } = require('./_publish');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const params = event.queryStringParameters || {};
    const ageGroupId = params.age;
    if (!ageGroupId) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing age.' }) };
    }

    const store = blobStore('schedules');
    const publishedRecord = await store.get(publishedKey(ageGroupId), { type: 'json' });

    const state = {
      published: !!publishedRecord,
      publishedAt: publishedRecord ? publishedRecord.publishedAt || null : null,
      publishedBy: publishedRecord ? publishedRecord.publishedBy || null : null,
      managerCanPublishNow: isTournamentWindow(),

      /* An auto-generated draw is NEVER shown to the public, at any point.
         Those pools are sample data, and a parent cannot tell a placeholder
         fixture from a real one. So an age group with nothing published shows
         "coming soon" until a human publishes it — before, during and after
         the tournament alike. */
      awaitingPublication: !publishedRecord,
    };

    /* Draft is only ever handed out to someone who is signed in AND has access
       to this age group. Anything short of that falls through to the public
       answer below — a bad or missing token quietly gets the published view
       rather than an error, so a stale login cannot blank the page. */
    if (params.draft === '1') {
      const session = verify(getBearerToken(event));
      if (session && hasAgeGroupAccess(session, ageGroupId)) {
        const draft = await store.get(draftKey(ageGroupId), { type: 'json' });
        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true, schedule: draft || null, isDraft: true, ...state }),
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        schedule: publishedRecord ? publishedRecord.schedule : null,
        isDraft: false,
        ...state,
      }),
    };
  } catch (err) {
    console.error('get-schedule-override error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error.' }) };
  }
};
