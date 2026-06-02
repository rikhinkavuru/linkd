'use strict';
// ─────────────────────────────────────────────────────────────────────────
// Central config. Every secret comes from an environment variable; nothing
// sensitive is ever hardcoded here. Channels are independently toggleable so
// you can switch pieces on as you add API keys.
// ─────────────────────────────────────────────────────────────────────────
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..'); // repo root (where index.html lives)

const bool = (v, dflt = false) =>
  v == null || v === '' ? dflt : /^(1|true|yes|on)$/i.test(String(v).trim());

const config = {
  ROOT,
  INDEX_HTML: path.join(ROOT, 'index.html'),

  // ── Site identity (used in canonical URLs, OG tags, post copy) ──
  SITE_URL: (process.env.SITE_URL || 'https://linkddaily.com').replace(/\/$/, ''),
  SITE_NAME: 'Linkd',
  SITE_TAGLINE: 'Build the chain. Each word links to the next.',
  // Reference timezone for deciding which calendar day is "today". The game
  // rolls over at the player's local midnight; for answer pages we pick one
  // canonical zone so the daily build is deterministic. Override via env.
  SITE_TZ: process.env.SITE_TZ || 'America/New_York',

  // Day 1 of the rotation = 2026-01-01 (must match index.html's epoch).
  EPOCH: { y: 2026, m: 1, d: 1 },

  // Output locations (all served from the site root by the static host).
  ANSWERS_PATH: 'answers',                         // /answers/linkd-<month>-<d>-<year>/
  ANSWERS_DIR: path.join(ROOT, 'answers'),
  SITEMAP: path.join(ROOT, 'sitemap.xml'),
  ROBOTS: path.join(ROOT, 'robots.txt'),
  OG_IMAGE: path.join(ROOT, 'assets', 'og-linkd.svg'),
  OG_IMAGE_URL_PATH: '/assets/og-linkd.svg',

  // Re-generate every past page (1..today) on each run. Idempotent; gives the
  // archive instant depth and self-heals if a template changes. Set BACKFILL=0
  // once the archive is large to only build today's page.
  BACKFILL: bool(process.env.BACKFILL, true),

  // ── Publish gating ──
  // AUTO_PUBLISH governs OUTBOUND channels only (social + email). SEO answer
  // pages are autonomous by design (requirement #1: "no gatekeeper") and are
  // always written + committed regardless of this flag.
  AUTO_PUBLISH: bool(process.env.AUTO_PUBLISH, false),
  REVIEW_DIR: path.join(ROOT, 'marketing', 'review-queue'),

  // ── Per-channel toggles ── flip each on as its API key lands.
  channels: {
    seo:      bool(process.env.CHANNEL_SEO, true),   // always-on by default
    x:        bool(process.env.CHANNEL_X, false),
    bluesky:  bool(process.env.CHANNEL_BLUESKY, false),
    reddit:   bool(process.env.CHANNEL_REDDIT, false),
    mastodon: bool(process.env.CHANNEL_MASTODON, false),
    discord:  bool(process.env.CHANNEL_DISCORD, false),
    email:    bool(process.env.CHANNEL_EMAIL, false),
  },

  // Raw env passthrough for channel modules (keeps secrets out of this file).
  env: process.env,
  bool,
};

module.exports = config;
