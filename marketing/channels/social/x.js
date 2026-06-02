'use strict';
// X (Twitter) API v2 — POST /2/tweets with OAuth 1.0a user context.
// Requires a project/app on the Basic tier or above (the Free tier allows a
// very small monthly write quota — see README). Zero-dependency HMAC-SHA1
// signing via node:crypto.
// Env: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
const crypto = require('crypto');

function oauth1Header(method, url, { consumerKey, consumerSecret, token, tokenSecret }) {
  const enc = encodeURIComponent;
  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0',
  };
  // JSON-body request: only oauth params are signed (no body params).
  const paramString = Object.keys(oauth).sort()
    .map(k => `${enc(k)}=${enc(oauth[k])}`).join('&');
  const baseString = [method.toUpperCase(), enc(url), enc(paramString)].join('&');
  const signingKey = `${enc(consumerSecret)}&${enc(tokenSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort()
    .map(k => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}

async function post(draft, env) {
  const creds = {
    consumerKey: env.X_API_KEY, consumerSecret: env.X_API_SECRET,
    token: env.X_ACCESS_TOKEN, tokenSecret: env.X_ACCESS_SECRET,
  };
  if (!creds.consumerKey || !creds.consumerSecret || !creds.token || !creds.tokenSecret)
    return { ok: false, error: 'missing X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET' };
  const url = 'https://api.twitter.com/2/tweets';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: oauth1Header('POST', url, creds) },
    body: JSON.stringify({ text: draft.text }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok && j.data && j.data.id)
    return { ok: true, id: j.data.id, permalink: `https://x.com/i/web/status/${j.data.id}` };
  return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(j)}` };
}
module.exports = { post };
