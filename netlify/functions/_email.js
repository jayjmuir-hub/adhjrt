// netlify/functions/_email.js
//
// Sends the registration confirmation emails through Microsoft Graph,
// using the tournament's own Microsoft 365 tenant. Not an HTTP endpoint —
// required by submission-created.js.
//
// Mail goes out from the shared mailbox registrations@adhjrt.com. Replies
// are pointed at the matching alias (player-registration@ / team-registration@)
// so a parent's reply lands somewhere sensible rather than in a no-reply void.
//
// ONE-TIME SETUP (already done, recorded here so it can be repeated):
//   1. entra.microsoft.com -> Applications -> App registrations -> New
//      registration, single tenant, no redirect URI.
//   2. API permissions -> Microsoft Graph -> APPLICATION permissions ->
//      Mail.Send -> Add -> then "Grant admin consent". The status must read
//      "Granted" or every send returns 403.
//   3. Certificates & secrets -> New client secret. The Value is shown once.
//   4. Netlify environment variables (all scopes, same value in all contexts):
//        MS_TENANT_ID      Directory (tenant) ID
//        MS_CLIENT_ID      Application (client) ID
//        MS_CLIENT_SECRET  the secret's Value
//        MAIL_FROM         registrations@adhjrt.com
//
// SECURITY NOTE: Mail.Send as an application permission lets this app send as
// ANY mailbox in the tenant. Worth restricting it to just MAIL_FROM with an
// Exchange application access policy (New-ApplicationAccessPolicy) so that a
// leaked secret cannot send as anyone else.
//
// The client secret expires. When it does, these emails stop and nothing
// else breaks, so the failure is quiet — see the console.error below, and
// keep a calendar reminder ahead of the expiry date.

const TENANT = process.env.MS_TENANT_ID;
const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const MAIL_FROM = process.env.MAIL_FROM;

const EVENT = 'Saturday 7 & Sunday 8 November 2026';
const VENUE = 'Zayed Sports City, Abu Dhabi';
const SITE = 'https://adhjrt.com';

/* ---------------- Graph auth ---------------- */

async function getToken() {
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET || !MAIL_FROM) {
    throw new Error('Email is not configured — check MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET and MAIL_FROM.');
  }

  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    /* Deliberately does not log the response body — it can echo back parts of
       the client secret. The error code alone is enough to diagnose:
         invalid_client  -> wrong secret, or the secret has expired
         unauthorized_client / 403 later -> admin consent was never granted */
    throw new Error(`Graph token request failed (${res.status}): ${data.error || 'unknown'}`);
  }
  return data.access_token;
}

/* ---------------- send ---------------- */

async function sendMail({ to, replyTo, subject, html }) {
  const recipients = (Array.isArray(to) ? to : [to])
    .map((addr) => (addr || '').trim())
    .filter((addr) => addr.includes('@'));

  if (!recipients.length) return { sent: false, reason: 'no valid recipient' };

  const token = await getToken();

  const message = {
    subject,
    body: { contentType: 'HTML', content: html },
    from: { emailAddress: { address: MAIL_FROM, name: 'ADH JRT Registrations' } },
    toRecipients: recipients.map((address) => ({ emailAddress: { address } })),
  };
  if (replyTo) {
    message.replyTo = [{ emailAddress: { address: replyTo } }];
  }

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MAIL_FROM)}/sendMail`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Graph sendMail failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return { sent: true, count: recipients.length };
}

/* ---------------- templates ---------------- */

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function row(label, value) {
  if (!value) return '';
  return `<tr>
    <td style="padding:7px 16px 7px 0;color:#6b7280;font-size:14px;white-space:nowrap;vertical-align:top">${esc(label)}</td>
    <td style="padding:7px 0;color:#111827;font-size:14px;font-weight:600">${esc(value)}</td>
  </tr>`;
}

function wrap(heading, intro, rowsHtml, closing) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f1ed">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1ed;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Helvetica,Arial,sans-serif">

        <tr><td style="height:5px;background:#E11B22;font-size:0;line-height:0">&nbsp;</td></tr>

        <tr><td style="background:#0C0C0E;padding:24px 28px">
          <div style="color:#ffffff;font-size:19px;font-weight:800;letter-spacing:.4px">ABU DHABI HARLEQUINS</div>
          <div style="color:#17A34A;font-size:11px;font-weight:700;letter-spacing:2px;margin-top:5px">JUNIOR RUGBY TOURNAMENT</div>
        </td></tr>

        <tr><td style="padding:28px">
          <h1 style="margin:0 0 14px;font-size:21px;color:#111827">${esc(heading)}</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#374151">${intro}</p>

          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:22px">
            ${rowsHtml}
          </table>

          <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#374151">${closing}</p>

          <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280">
            <strong style="color:#111827">${esc(EVENT)}</strong><br>${esc(VENUE)}
          </p>
        </td></tr>

        <tr><td style="background:#0C0C0E;padding:18px 28px;color:#8a8f99;font-size:12px;line-height:1.6">
          Abu Dhabi Harlequins Rugby Football Club &middot; founded 1970<br>
          <a href="${SITE}" style="color:#17A34A;text-decoration:none">adhjrt.com</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

function playerEmail(d) {
  const player = [d['player-first-name'], d['player-last-name']].filter(Boolean).join(' ');
  const parent = d['parent-first-name'] || '';

  const rows = [
    row('Player', player),
    row('Date of birth', d.dob),
    row('Age group', d['age-group']),
    row('Club', d.club),
    row('Parent / guardian', [d['parent-first-name'], d['parent-last-name']].filter(Boolean).join(' ')),
    row('Contact email', d['parent-email']),
    row('Contact number', d['parent-phone']),
    row('Emergency contact', [d['emergency-first-name'], d['emergency-last-name']].filter(Boolean).join(' ')),
    row('Emergency number', d['emergency-phone']),
  ].join('');

  /* Medical notes are deliberately not repeated here — they are in the
     registration, but echoing them into an inbox is unnecessary. */

  return {
    subject: `Registration received — ${player || 'player'} | ADH JRT 2026`,
    html: wrap(
      'Thanks, we have your registration',
      `${parent ? esc(parent) + ', t' : 'T'}hank you for registering ${player ? `<strong>${esc(player)}</strong>` : 'your child'} for the Abu Dhabi Harlequins Junior Rugby Tournament. Here is what we received:`,
      rows,
      'Nothing further is needed from you now. Pool draws, kick-off times and pitch allocations are published closer to the tournament, and we will be in touch before the weekend. If anything above looks wrong, just reply to this email.'
    ),
  };
}

function teamEmail(d) {
  const team = d['team-name'] || '';
  const rows = [
    row('Club', d.club),
    row('Team', team),
    row('Age group', d['age-group']),
    row('Head coach', d['head-coach-name']),
    row('Coach email', d['head-coach-email']),
    row('Coach number', d['head-coach-phone']),
    row('Team manager', d['manager-name']),
    row('Manager email', d['manager-email']),
    row('Manager number', d['manager-phone']),
    row('Players entered', d['num-players']),
    row('Notes', d.notes),
  ].join('');

  return {
    subject: `Team registration received — ${team || d.club || 'team'} | ADH JRT 2026`,
    html: wrap(
      'Thanks, we have your team entry',
      `Thank you for entering ${team ? `<strong>${esc(team)}</strong>` : 'your team'} into the Abu Dhabi Harlequins Junior Rugby Tournament. Here is what we received:`,
      rows,
      'Nothing further is needed right now. Pool draws and fixtures are confirmed closer to the tournament and sent to the contacts above. If any detail is wrong, or your squad changes, reply to this email and we will update it.'
    ),
  };
}

/* ---------------- entry point ---------------- */

async function sendConfirmation(formName, data) {
  if (formName === 'player-registration') {
    const { subject, html } = playerEmail(data);
    return sendMail({
      to: data['parent-email'],
      subject,
      html,
    });
  }

  if (formName === 'team-registration') {
    const { subject, html } = teamEmail(data);
    // Coach and manager are often different people; both should get it.
    const to = [...new Set([data['head-coach-email'], data['manager-email']].filter(Boolean))];
    return sendMail({
      to,
      subject,
      html,
    });
  }

  return { sent: false, reason: `no template for form "${formName}"` };
}

module.exports = { sendConfirmation };
