/* tests/test-email.js
   ------------------------------------------------------------------------
   The confirmation emails — added 28 Jul 2026 alongside the wider girls'-
   groups play-up allowance (see claude/spec-age-validation.md). Until now
   nothing tested _email.js's templates at all; sendConfirmation() was always
   mocked out whole in test-intake.js, which proves the intake pipeline calls
   it but says nothing about what it actually sends.

   THE THING THIS FILE IS FOR: a parent who ticks the play-up consent box on
   the player form should see that reflected in the confirmation email they
   get, not just in the /organizer sheet. Before 28 Jul 2026 the email never
   mentioned play-up at all — it looked identical to a completely normal
   registration.

   Mail.Send is never actually called here — global.fetch is replaced with a
   stub that captures the request instead of hitting Microsoft Graph, and the
   env vars are set to obviously-fake values so getToken()'s early throw never
   fires. The token fetch is answered by the same stub.

   ⚠️ Every field value in this file is invented and obviously so. NEVER build
   a fixture from a real sheet row — this repo is public and those rows are
   children.
*/

const path = require('path');
const { repoRoot, section, check, eq, summary } = require('./_lib');

process.env.MS_TENANT_ID = 'test-tenant';
process.env.MS_CLIENT_ID = 'test-client';
process.env.MS_CLIENT_SECRET = 'test-secret';
process.env.MAIL_FROM = 'registrations@adhjrt.test';

const EMAIL_PATH = path.join(repoRoot(), 'netlify', 'functions', '_email.js');

/* Captures every fetch call so a test can inspect what would have been sent,
   without ever reaching Microsoft Graph. Token requests get a fake token;
   the sendMail request gets a bare 202-style ok response and its body is
   stashed on `calls` for inspection. */
async function withStubbedGraph(run) {
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    if (String(url).includes('/oauth2/v2.0/token')) {
      return { ok: true, json: async () => ({ access_token: 'fake-token' }) };
    }
    return { ok: true, json: async () => ({}), text: async () => '' };
  };
  try {
    delete require.cache[EMAIL_PATH];
    const E = require(EMAIL_PATH);
    await run(E, calls);
  } finally {
    global.fetch = realFetch;
    delete require.cache[EMAIL_PATH];
  }
}

function sentHtml(calls) {
  const sendCall = calls.find((c) => c.url.includes('/sendMail'));
  if (!sendCall) return '';
  const body = JSON.parse(sendCall.opts.body);
  return body.message.body.content;
}

async function main() {

section('A normal player registration — no play-up mentioned');
await withStubbedGraph(async (E, calls) => {
  const data = {
    'player-first-name': 'Sample', 'player-last-name': 'Player',
    dob: '2015-01-01', 'age-group': 'U12 Mixed Contact', club: 'Test RFC',
    'parent-first-name': 'Test', 'parent-last-name': 'Parent', 'parent-email': 'parent@example.test',
    'parent-phone': '0000000000',
    'emergency-first-name': 'Emg', 'emergency-last-name': 'Contact', 'emergency-phone': '0000000001',
    'play-up-consent': 'No',
  };
  const res = await E.sendConfirmation('player-registration', data);
  check('the mail is reported as sent', res.sent === true, JSON.stringify(res));
  const html = sentHtml(calls);
  check('the age group is shown plain, with no "(playing up)" suffix', html.includes('U12 Mixed Contact') && !html.includes('playing up'), html);
});

section('A play-up player registration — the email must say so');
await withStubbedGraph(async (E, calls) => {
  const data = {
    'player-first-name': 'Mike', 'player-last-name': 'Yohotu',
    dob: '2013-09-01', 'age-group': 'U14G QR', club: 'Test RFC',
    'parent-first-name': 'Test', 'parent-last-name': 'Parent', 'parent-email': 'parent@example.test',
    'parent-phone': '0000000000',
    'emergency-first-name': 'Emg', 'emergency-last-name': 'Contact', 'emergency-phone': '0000000001',
    'play-up-consent': 'Yes',
  };
  await E.sendConfirmation('player-registration', data);
  const html = sentHtml(calls);
  check('the age group row is suffixed "(playing up)"', /U14G QR\s*\(playing up\)/.test(html), html);
  check('the closing paragraph names the player as playing up', /Mike Yohotu is registered to play up an age group/.test(html) || /Mike Yohotu[\s\S]{0,40}play up an age group/.test(html), html);
  check('the closing paragraph credits parent\/guardian consent', /with your consent as parent\/guardian/.test(html), html);
});

section('play-up-consent of "No" never triggers the highlight, even with other fields present');
await withStubbedGraph(async (E, calls) => {
  const data = {
    'player-first-name': 'Not', 'player-last-name': 'PlayingUp',
    dob: '2015-01-01', 'age-group': 'U12 Mixed Contact', club: 'Test RFC',
    'parent-first-name': 'Test', 'parent-last-name': 'Parent', 'parent-email': 'parent@example.test',
    'parent-phone': '0000000000',
    'emergency-first-name': 'Emg', 'emergency-last-name': 'Contact', 'emergency-phone': '0000000001',
    'play-up-consent': 'No',
  };
  await E.sendConfirmation('player-registration', data);
  const html = sentHtml(calls);
  check('no play-up wording leaks in when consent is "No"', !html.includes('playing up') && !html.includes('play up'), html);
});

section('a team registration is unaffected — no per-player play-up concept exists there');
await withStubbedGraph(async (E, calls) => {
  const data = {
    'team-name': 'TST1', club: 'Test RFC', 'age-group': 'U12 Mixed Contact', 'preferred-pool': 'A',
    'head-coach-name': 'Coach One', 'head-coach-email': 'coach@example.test', 'head-coach-phone': '0000000000',
    players: JSON.stringify([{ firstName: 'A', lastName: 'Player', dob: '2015-01-01' }]),
  };
  const res = await E.sendConfirmation('team-registration', data);
  check('the mail is reported as sent', res.sent === true, JSON.stringify(res));
  const html = sentHtml(calls);
  check('no play-up wording appears in a team email', !html.includes('playing up') && !html.includes('play up'), html);
});

summary('test-email.js');

}

main();
