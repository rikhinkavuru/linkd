'use strict';
// Umami analytics client. Works with Umami Cloud (api.umami.is) or a self-host.
// Env: UMAMI_API_KEY (cloud, Settings → API)  OR  UMAMI_TOKEN (self-host bearer)
//      UMAMI_WEBSITE_ID (defaults to the id already wired into index.html)
//      UMAMI_BASE (default https://api.umami.is/v1)
const DEFAULT_WEBSITE = 'cec9cd34-0d6f-4615-855b-58a0733cf115'; // from index.html

function client(env) {
  const base = (env.UMAMI_BASE || 'https://api.umami.is/v1').replace(/\/$/, '');
  const websiteId = env.UMAMI_WEBSITE_ID || DEFAULT_WEBSITE;
  const headers = { accept: 'application/json' };
  if (env.UMAMI_API_KEY) headers['x-umami-api-key'] = env.UMAMI_API_KEY;
  else if (env.UMAMI_TOKEN) headers.authorization = `Bearer ${env.UMAMI_TOKEN}`;
  const configured = !!(env.UMAMI_API_KEY || env.UMAMI_TOKEN);

  async function get(pathname, params) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${base}/websites/${websiteId}/${pathname}?${qs}`, { headers });
    if (!res.ok) throw new Error(`umami ${pathname} HTTP ${res.status}: ${await res.text().catch(() => '')}`);
    return res.json();
  }

  // Window helpers (unix ms).
  const range = days => {
    const endAt = Date.now();
    const startAt = endAt - days * 86400000;
    return { startAt, endAt };
  };

  return {
    configured, base, websiteId,
    // {pageviews,visitors,visits,bounces,totaltime} each {value, prev}
    stats: (days = 7) => get('stats', range(days)),
    // type: 'url' | 'referrer' | 'event' ... returns [{x, y}]
    metrics: (type, days = 7, limit = 15) => get('metrics', { ...range(days), type, limit }),
  };
}
module.exports = { client, DEFAULT_WEBSITE };
