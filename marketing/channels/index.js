'use strict';
// ─────────────────────────────────────────────────────────────────────────
// Outbound channel orchestrator (social + email).
//
// Gating:
//   • A channel runs only if its CHANNEL_<NAME> flag is on.
//   • Drafts are ALWAYS written to the review queue (audit trail).
//   • Live posting happens only when AUTO_PUBLISH=true AND the channel has
//     working credentials. Otherwise the draft is queued for your review.
// ─────────────────────────────────────────────────────────────────────────
const cfg = require('../lib/config');
const { buildDayContext } = require('../lib/context');
const voice = require('./voice');
const queue = require('./queue');
const email = require('./email');

const SOCIAL = {
  x: require('./social/x'),
  bluesky: require('./social/bluesky'),
  reddit: require('./social/reddit'),
  mastodon: require('./social/mastodon'),
  discord: require('./social/discord'),
  threads: require('./social/threads'),
};

async function runDaily({ dryRun = false, log = console.log } = {}) {
  const today = buildDayContext();
  const yesterday = today.dayNum > 1 ? buildDayContext(today.dayNum - 1) : null;
  const iso = today.iso;

  // 1. Build every enabled social draft.
  const platforms = Object.keys(SOCIAL).filter(p => cfg.channels[p]);
  const drafts = platforms.map(p => ({ ...voice.draftFor(p, today) }));
  const emailDraft = cfg.channels.email ? voice.emailDraft(today, yesterday) : null;

  // 2. Always queue for review (audit trail).
  if (!dryRun) {
    const dir = queue.writeDrafts(iso, drafts, emailDraft);
    log(`[channels] drafts queued → ${dir.replace(cfg.ROOT + '/', '')}`);
  }

  if (!cfg.AUTO_PUBLISH) {
    log(`[channels] AUTO_PUBLISH=false — ${drafts.length} social draft(s)${emailDraft ? ' + email' : ''} held for review. Nothing published.`);
    return { published: 0, queued: drafts.length + (emailDraft ? 1 : 0) };
  }

  // 3. AUTO_PUBLISH=true — post each enabled channel through its official API.
  let published = 0;
  for (const d of drafts) {
    if (queue.alreadyPosted(iso, d.platform)) { log(`[${d.platform}] already posted today — skip`); continue; }
    if (dryRun) { log(`[${d.platform}] dry-run — would post`); continue; }
    try {
      const r = await SOCIAL[d.platform].post(d, cfg.env);
      if (r.ok) { queue.markPosted(iso, d.platform, r); published++; log(`[${d.platform}] posted ✓ ${r.permalink || r.id}`); }
      else log(`[${d.platform}] NOT posted: ${r.error}`);
    } catch (e) { log(`[${d.platform}] error: ${e.message}`); }
  }

  if (emailDraft) {
    if (queue.alreadyPosted(iso, 'email')) { log('[email] already sent today — skip'); }
    else if (dryRun) { log('[email] dry-run — would send'); }
    else {
      try {
        const r = await email.send(emailDraft, cfg.env);
        if (r.ok) { queue.markPosted(iso, 'email', r); published++; log(`[email] sent ✓ ${r.id || ''}`); }
        else log(`[email] NOT sent: ${r.error}`);
      } catch (e) { log(`[email] error: ${e.message}`); }
    }
  }

  return { published, queued: drafts.length + (emailDraft ? 1 : 0) };
}

module.exports = { runDaily };
