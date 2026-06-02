'use strict';
// Threads (Meta) — official Threads API. Two-step: create a media container,
// then publish it. Requires a Meta app + long-lived user token with
// `threads_basic` and `threads_content_publish`. Scaffolded; fill THREADS_USER_ID
// + THREADS_ACCESS_TOKEN and flip CHANNEL_THREADS to enable.
// Env: THREADS_USER_ID, THREADS_ACCESS_TOKEN
async function post(draft, env) {
  const uid = env.THREADS_USER_ID, token = env.THREADS_ACCESS_TOKEN;
  if (!uid || !token) return { ok: false, error: 'missing THREADS_USER_ID / THREADS_ACCESS_TOKEN' };
  const base = 'https://graph.threads.net/v1.0';
  const create = await fetch(`${base}/${uid}/threads`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ media_type: 'TEXT', text: draft.text, access_token: token }),
  }).then(r => r.json());
  if (!create.id) return { ok: false, error: 'container failed: ' + JSON.stringify(create) };
  const pub = await fetch(`${base}/${uid}/threads_publish`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ creation_id: create.id, access_token: token }),
  }).then(r => r.json());
  return pub.id ? { ok: true, id: pub.id } : { ok: false, error: JSON.stringify(pub) };
}
module.exports = { post };
