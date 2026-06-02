'use strict';
// Discord — free. Server Settings → Integrations → Webhooks → copy URL.
// Great for a Linkd community server or a personal log channel.
// Env: DISCORD_WEBHOOK_URL
async function post(draft, env) {
  const url = env.DISCORD_WEBHOOK_URL;
  if (!url) return { ok: false, error: 'missing DISCORD_WEBHOOK_URL' };
  const body = { content: draft.content || draft.text };
  if (draft.embed) body.embeds = [draft.embed];
  const res = await fetch(`${url}?wait=true`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) { const j = await res.json().catch(() => ({})); return { ok: true, id: j.id || 'sent' }; }
  return { ok: false, error: `HTTP ${res.status}: ${await res.text().catch(() => '')}` };
}
module.exports = { post };
