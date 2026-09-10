// netlify/functions/snapshot-registrations.js
//
// SCHEDULED (netlify.toml: @hourly). Emails a snapshot of every registration
// record to the tournament's own mailbox — hourly while the registration
// window is open, once a night otherwise (_snapshot.js shouldSend).
// Spec: claude/specs/spec-registration-store-sep-2026.md § 6.
//
// No decisions here: runSnapshot() in _snapshot.js decides and is tested with
// fakes. This file only wires the real store, the real window and the real
// mailer. Scheduled functions are invoked by Netlify, not by HTTP callers.
// The recipient is MAIL_FROM — nothing in any request can change it.

const { blobStore } = require('./_auth');
const { sendMail } = require('./_email');
const { loadRegistration, registrationState } = require('./_registration');
const { STORE_NAME, listAll } = require('./_regstore');
const { runSnapshot } = require('./_snapshot');

exports.handler = async () => {
  try {
    /* runSnapshot() deliberately does not catch a throwing sendMail — see the
       ⚠️ note at the top of _snapshot.js. There is no fallback channel when
       the only notification channel is itself broken, so this try/catch
       around the whole call is what logs that case. Not an oversight. */
    const result = await runSnapshot({
      now: Date.now(),
      listAll: () => listAll(blobStore(STORE_NAME)),
      windowOpen: async () => !!registrationState(await loadRegistration(blobStore), Date.now()).open,
      sendMail,
      mailFrom: process.env.MAIL_FROM,
    });
    /* Counts only. */
    console.log(`snapshot-registrations: ${result.sent ? 'sent' : 'skipped this hour'}${result.counts ? ` (${result.counts.team}/${result.counts.player}/${result.counts.club})` : ''}${result.error ? ' FAILED: ' + result.error : ''}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, sent: result.sent }) };
  } catch (err) {
    console.error('snapshot-registrations error:', err && err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false }) };
  }
};
