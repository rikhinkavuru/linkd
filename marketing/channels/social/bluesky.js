'use strict';
// Bluesky via the AT Protocol — free, open, no approval, generous limits.
// Auth: an APP PASSWORD (Settings → App Passwords), NOT your main password.
// Env: BLUESKY_HANDLE (e.g. linkd.bsky.social), BLUESKY_APP_PASSWORD,
//      BLUESKY_PDS (optional, default https://bsky.social)
async function post(draft, env) {
  const pds = (env.BLUESKY_PDS || 'https://bsky.social').replace(/\/$/, '');
  const identifier = env.BLUESKY_HANDLE;
  const password = env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password) return { ok: false, error: 'missing BLUESKY_HANDLE / BLUESKY_APP_PASSWORD' };

  const sess = await fetch(`${pds}/xrpc/com.atproto.server.createSession`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  }).then(r => r.json());
  if (!sess.accessJwt) return { ok: false, error: 'auth failed: ' + JSON.stringify(sess) };

  // Build a link facet so the URL is clickable.
  const text = draft.text;
  const facets = [];
  if (draft.link) {
    const idx = text.indexOf(draft.link);
    if (idx >= 0) {
      const byteStart = Buffer.byteLength(text.slice(0, idx));
      const byteEnd = byteStart + Buffer.byteLength(draft.link);
      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: draft.link }],
      });
    }
  }

  const record = {
    $type: 'app.bsky.feed.post', text,
    createdAt: new Date().toISOString(),
    ...(facets.length ? { facets } : {}),
  };
  const res = await fetch(`${pds}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${sess.accessJwt}` },
    body: JSON.stringify({ repo: sess.did, collection: 'app.bsky.feed.post', record }),
  }).then(r => r.json());

  if (res.uri) {
    const rkey = res.uri.split('/').pop();
    return { ok: true, id: res.uri, permalink: `https://bsky.app/profile/${sess.did}/post/${rkey}` };
  }
  return { ok: false, error: JSON.stringify(res) };
}
module.exports = { post };
