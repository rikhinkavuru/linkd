'use strict';
// Mastodon — free. Create an app in Preferences → Development to get a token
// with the `write:statuses` scope.
// Env: MASTODON_BASE_URL (e.g. https://mastodon.social), MASTODON_ACCESS_TOKEN
async function post(draft, env) {
  const base = (env.MASTODON_BASE_URL || '').replace(/\/$/, '');
  const token = env.MASTODON_ACCESS_TOKEN;
  if (!base || !token) return { ok: false, error: 'missing MASTODON_BASE_URL / MASTODON_ACCESS_TOKEN' };
  const res = await fetch(`${base}/api/v1/statuses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`,
      'Idempotency-Key': `linkd-${draft.idemKey || draft.text.slice(0, 24)}` },
    body: JSON.stringify({ status: draft.text, visibility: 'public' }),
  }).then(r => r.json());
  return res.id ? { ok: true, id: res.id, permalink: res.url } : { ok: false, error: JSON.stringify(res) };
}
module.exports = { post };
