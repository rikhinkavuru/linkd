'use strict';
// ─────────────────────────────────────────────────────────────────────────
// Weekly analytics → decision loop.
//
// Pulls the last 7 days from Umami, classifies referrers into marketing
// channels, ranks top answer pages, and writes:
//   marketing/reports/weekly-<date>.md     (human summary + recommendations)
//   marketing/reports/history.jsonl        (trend log)
//   marketing/.state/insights.json         (machine signal the draft layer can read)
// ─────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const cfg = require('../lib/config');
const { client } = require('./umami');

function channelOf(referrer) {
  const r = (referrer || '').toLowerCase();
  if (!r || r === '(none)' || r.includes('linkddaily.com')) return 'direct/internal';
  if (r.includes('bsky') || r.includes('bluesky')) return 'bluesky';
  if (r.includes('t.co') || r.includes('twitter') || r.includes('x.com')) return 'x';
  if (r.includes('reddit') || r.includes('redd.it')) return 'reddit';
  if (r.includes('mastodon') || r.includes('mstdn') || r.includes('fed')) return 'mastodon';
  if (r.includes('discord')) return 'discord';
  if (r.includes('threads') || r.includes('instagram')) return 'threads';
  if (r.includes('google') || r.includes('bing') || r.includes('duckduckgo') || r.includes('search')) return 'organic-search';
  if (r.includes('buttondown') || r.includes('mail') || r.includes('email')) return 'email';
  return 'other';
}

async function run({ log = console.log, days = 7 } = {}) {
  const iso = new Date().toISOString().slice(0, 10);
  const reportsDir = path.join(cfg.ROOT, 'marketing', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const um = client(cfg.env);

  if (!um.configured) {
    const msg = `# Linkd weekly report — ${iso}\n\n⚠️ Umami not configured. Set UMAMI_API_KEY (or UMAMI_TOKEN) to enable the analytics loop. See README § Analytics.\n`;
    fs.writeFileSync(path.join(reportsDir, `weekly-${iso}.md`), msg);
    log('[weekly] Umami not configured — wrote placeholder report.');
    return { configured: false };
  }

  const [stats, referrers, pages] = await Promise.all([
    um.stats(days), um.metrics('referrer', days), um.metrics('url', days),
  ]);

  // Roll referrers up into channels.
  const byChannel = {};
  for (const { x, y } of referrers) {
    const ch = channelOf(x);
    byChannel[ch] = (byChannel[ch] || 0) + y;
  }
  const channelRank = Object.entries(byChannel).sort((a, b) => b[1] - a[1]);

  // Top answer pages (SEO performance).
  const answerPages = pages.filter(p => p.x && p.x.includes(`/${cfg.ANSWERS_PATH}/`))
    .sort((a, b) => b.y - a.y).slice(0, 10);

  const pv = stats.pageviews || { value: 0, prev: 0 };
  const vis = stats.visitors || { value: 0, prev: 0 };
  const delta = (c) => c.prev ? `${c.value >= c.prev ? '+' : ''}${Math.round((c.value - c.prev) / c.prev * 100)}%` : 'n/a';

  // ── Recommendations (the "decision") ──
  const recs = [];
  const topChannel = channelRank.find(([c]) => !['direct/internal', 'organic-search', 'other'].includes(c));
  if (topChannel) recs.push(`Top social channel: **${topChannel[0]}** (${topChannel[1]} visits). Keep/raise cadence there.`);
  const organic = byChannel['organic-search'] || 0;
  if (organic > 0) recs.push(`Organic search drove **${organic}** visits — the SEO answer pages are working. Keep the daily build running.`);
  if (answerPages.length) recs.push(`Best answer page: ${answerPages[0].x} (${answerPages[0].y} views). Themed/edge puzzles tend to over-index — lean hooks toward those.`);
  const quiet = ['bluesky', 'x', 'reddit', 'mastodon'].filter(c => !byChannel[c] && cfg.channels[c]);
  if (quiet.length) recs.push(`Enabled but no measurable traffic: ${quiet.join(', ')}. Revisit hook copy or posting time.`);
  if (!recs.length) recs.push('Not enough data yet — keep the daily pipeline running and re-check next week.');

  // ── Write human report ──
  let md = `# Linkd weekly report — ${iso} (last ${days} days)\n\n`;
  md += `## Traffic\n\n`;
  md += `| metric | this period | change |\n|---|---|---|\n`;
  md += `| pageviews | ${pv.value} | ${delta(pv)} |\n| visitors | ${vis.value} | ${delta(vis)} |\n`;
  md += `| visits | ${(stats.visits || {}).value ?? '?'} |  |\n\n`;
  md += `## Where plays came from (by channel)\n\n`;
  md += channelRank.map(([c, n]) => `- **${c}** — ${n}`).join('\n') || '- (no referrer data)';
  md += `\n\n## Top answer pages\n\n`;
  md += answerPages.map(p => `- ${p.x} — ${p.y}`).join('\n') || '- (none yet)';
  md += `\n\n## Recommendations → feed into next week's content\n\n`;
  md += recs.map(r => `- ${r}`).join('\n') + '\n';
  fs.writeFileSync(path.join(reportsDir, `weekly-${iso}.md`), md);

  // ── Trend log + machine signal ──
  fs.appendFileSync(path.join(reportsDir, 'history.jsonl'),
    JSON.stringify({ iso, pageviews: pv.value, visitors: vis.value, byChannel }) + '\n');
  const stateDir = path.join(cfg.ROOT, 'marketing', '.state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'insights.json'),
    JSON.stringify({ iso, topChannel: topChannel ? topChannel[0] : null, byChannel, recs }, null, 2));

  log(`[weekly] ${pv.value} pageviews (${delta(pv)}), ${vis.value} visitors. Top channel: ${topChannel ? topChannel[0] : 'n/a'}.`);
  recs.forEach(r => log('  → ' + r.replace(/\*\*/g, '')));
  return { configured: true, pageviews: pv.value, visitors: vis.value, byChannel, recs };
}
module.exports = { run, channelOf };
