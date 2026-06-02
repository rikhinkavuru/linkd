'use strict';
// Reddit via OAuth2 "script" app (password grant). HIGH BAN RISK if you spam —
// read the README § Reddit before enabling. Best used to post your OWN daily
// thread in a subreddit you run, or rare, genuinely-useful posts where self-
// promo is allowed. Respect each subreddit's rules and the ~9:1 ratio.
// Env: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD,
//      REDDIT_SUBREDDIT (no "r/"), REDDIT_USER_AGENT
async function getToken(env) {
  const basic = Buffer.from(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({ grant_type: 'password', username: env.REDDIT_USERNAME, password: env.REDDIT_PASSWORD });
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded',
      'user-agent': env.REDDIT_USER_AGENT || 'linkd-marketing/1.0' },
    body,
  }).then(r => r.json());
  return res.access_token || null;
}

async function post(draft, env) {
  for (const k of ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USERNAME', 'REDDIT_PASSWORD', 'REDDIT_SUBREDDIT'])
    if (!env[k]) return { ok: false, error: `missing ${k}` };
  const token = await getToken(env);
  if (!token) return { ok: false, error: 'reddit auth failed' };
  const ua = env.REDDIT_USER_AGENT || 'linkd-marketing/1.0';
  const form = new URLSearchParams({
    sr: env.REDDIT_SUBREDDIT, title: draft.title, kind: 'self', text: draft.body, api_type: 'json',
  });
  const res = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/x-www-form-urlencoded', 'user-agent': ua },
    body: form,
  }).then(r => r.json());
  const url = res && res.json && res.json.data && res.json.data.url;
  if (url) return { ok: true, id: res.json.data.id, permalink: url };
  return { ok: false, error: JSON.stringify(res) };
}
module.exports = { post };
