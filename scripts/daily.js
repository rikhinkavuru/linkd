#!/usr/bin/env node
'use strict';
// ─────────────────────────────────────────────────────────────────────────
// Daily marketing pipeline.
//
//   1. SEO answer pages  — always runs, always writes (autonomous; no gate).
//   2. Social drafts     — gated by AUTO_PUBLISH + per-channel flags.
//   3. Email             — gated by AUTO_PUBLISH + CHANNEL_EMAIL.
//
// Usage:
//   node scripts/daily.js                 # full run
//   node scripts/daily.js --only=seo       # SEO only
//   node scripts/daily.js --dry-run        # compute + log, write nothing
// ─────────────────────────────────────────────────────────────────────────
const cfg = require('../marketing/lib/config');
const seo = require('../marketing/generators/seo');

const args = process.argv.slice(2);
const has = f => args.includes(f);
const only = (args.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;
const dryRun = has('--dry-run');

const log = (...a) => console.log(...a);
const hr = () => log('─'.repeat(58));

async function main() {
  hr();
  log(`Linkd daily marketing · ${new Date().toISOString()}`);
  log(`AUTO_PUBLISH=${cfg.AUTO_PUBLISH}  BACKFILL=${cfg.BACKFILL}  TZ=${cfg.SITE_TZ}  dryRun=${dryRun}`);
  hr();

  // ── 1. SEO (always) ──
  if (!only || only === 'seo') {
    if (cfg.channels.seo) {
      const r = seo.generate({ dryRun });
      log(`[seo] puzzle bank: ${r.bankSize} chains (auto-detected from index.html; new puzzles are picked up automatically)`);
      log(`[seo] day #${r.todayDayNum} (${r.todayIso}) · built ${r.pages} pages (${r.from}–${r.to}), ${r.changed} changed`);
      log(`[seo] today  : ${r.todayUrl}`);
      log(`[seo] archive: ${r.archiveUrl}`);
    } else {
      log('[seo] disabled (CHANNEL_SEO=0)');
    }
  }

  // ── 2 + 3. Outbound channels (social, email) — gated ──
  if (!only || only === 'channels') {
    let runChannels = null;
    try { runChannels = require('../marketing/channels'); } catch (_) { /* not built yet */ }
    if (runChannels) {
      await runChannels.runDaily({ dryRun, log });
    } else {
      log('[channels] orchestrator not present — skipping outbound.');
    }
  }

  hr();
  log('Done.');
}

main().catch(err => { console.error('\n[daily] FAILED:', err && err.stack || err); process.exit(1); });
