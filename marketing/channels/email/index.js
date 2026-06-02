'use strict';
// Newsletter sending — provider-agnostic. Pick one with EMAIL_PROVIDER, or it's
// inferred from whichever keys are present.
//
//  buttondown  (recommended for indie newsletters)
//    Env: BUTTONDOWN_API_KEY
//  resend      (broadcasts to an audience)
//    Env: RESEND_API_KEY, RESEND_AUDIENCE_ID, RESEND_FROM (e.g. "Linkd <hi@linkddaily.com>")
function detectProvider(env) {
  if (env.EMAIL_PROVIDER) return env.EMAIL_PROVIDER.toLowerCase();
  if (env.BUTTONDOWN_API_KEY) return 'buttondown';
  if (env.RESEND_API_KEY) return 'resend';
  return null;
}

async function sendButtondown(draft, env) {
  // Creating an email with status "about_to_send" dispatches to all subscribers.
  const res = await fetch('https://api.buttondown.email/v1/emails', {
    method: 'POST',
    headers: { authorization: `Token ${env.BUTTONDOWN_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ subject: draft.subject, body: draft.html, status: 'about_to_send' }),
  });
  const j = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, id: j.id } : { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(j)}` };
}

async function sendResend(draft, env) {
  if (!env.RESEND_AUDIENCE_ID || !env.RESEND_FROM) return { ok: false, error: 'missing RESEND_AUDIENCE_ID / RESEND_FROM' };
  const create = await fetch('https://api.resend.com/broadcasts', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ audience_id: env.RESEND_AUDIENCE_ID, from: env.RESEND_FROM, subject: draft.subject, html: draft.html }),
  }).then(r => r.json());
  if (!create.id) return { ok: false, error: 'broadcast create failed: ' + JSON.stringify(create) };
  const send = await fetch(`https://api.resend.com/broadcasts/${create.id}/send`, {
    method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}` },
  });
  return send.ok ? { ok: true, id: create.id } : { ok: false, error: `send HTTP ${send.status}` };
}

async function send(draft, env) {
  const provider = detectProvider(env);
  if (!provider) return { ok: false, error: 'no email provider configured (set BUTTONDOWN_API_KEY or RESEND_API_KEY)' };
  if (provider === 'buttondown') return sendButtondown(draft, env);
  if (provider === 'resend') return sendResend(draft, env);
  return { ok: false, error: `unknown EMAIL_PROVIDER "${provider}"` };
}
module.exports = { send, detectProvider };
