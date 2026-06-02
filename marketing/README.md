# Linkd autonomous marketing system

End-to-end, low-touch marketing for **[linkddaily.com](https://linkddaily.com)** — the daily word-chain puzzle. Zero runtime dependencies (pure Node 18+), driven by the puzzle data already in `index.html`, scheduled by GitHub Actions.

Four channels, each independently toggleable:

| # | Channel | Status | Gate |
|---|---------|--------|------|
| 1 | **SEO answer pages** | ✅ live, fully built | none — autonomous by design |
| 2 | **Social posting** (X, Bluesky, Reddit, Mastodon, Discord, Threads) | ✅ built, behind flags | `AUTO_PUBLISH` + per-channel + keys |
| 3 | **Email / newsletter** (Buttondown, Resend) | ✅ built, behind flags | `AUTO_PUBLISH` + `CHANNEL_EMAIL` + keys |
| 4 | **Analytics → decision loop** (Umami) | ✅ built, weekly | needs Umami key |

---

## TL;DR — what runs without you

Every day at **05:15 UTC** (`.github/workflows/daily-marketing.yml`):

1. Reads `PUZZLES` + `THEMES` straight out of `index.html` (single source of truth — the marketing pages can never disagree with the game).
2. Generates an SEO “hints & answer” page for **today** and every past day, plus the archive index, `sitemap.xml`, `robots.txt`, and a branded OG image.
3. Drafts one spoiler-free post per enabled platform + an email, and writes them to `marketing/review-queue/<date>/` for you to read.
4. **If `AUTO_PUBLISH=true`:** posts/sends them through official APIs. Otherwise they just sit in the queue.
5. Commits the generated files to `main`. Your static host redeploys on push.

Every Monday (`weekly-analytics.yml`): pulls Umami, writes `marketing/reports/weekly-<date>.md` with what's working and what to do next.

**The SEO channel needs no API keys and ships value immediately.** Everything else stays dark until you add a key and flip a flag.

---

## Architecture

```
index.html                      ← the game; also the puzzle SOURCE OF TRUTH

scripts/
  daily.js                      ← daily pipeline entrypoint (SEO + channels)
  weekly.js                     ← weekly analytics report

marketing/
  lib/
    config.js                   ← all flags + env, nothing hardcoded
    puzzle.js                   ← extracts PUZZLES/THEMES from index.html; date↔day math, bridges
    context.js                  ← per-day puzzle context shared by every channel
    html.js                     ← escaping / masking helpers
  generators/
    seo.js                      ← answer pages, archive, sitemap, robots, OG image
  channels/
    index.js                    ← orchestrator: draft → queue → (gated) publish
    voice.js                    ← brand-voice drafts per platform (+ email)
    queue.js                    ← review queue + idempotency markers
    social/{x,bluesky,reddit,mastodon,discord,threads}.js
    email/index.js              ← Buttondown / Resend adapters
  analytics/
    umami.js                    ← Umami API client
    report.js                   ← weekly summary + recommendations
  review-queue/<date>/          ← drafts (audit trail), committed
  reports/                      ← weekly reports + trend history, committed

.github/workflows/
  daily-marketing.yml           ← cron 05:15 UTC daily
  weekly-analytics.yml          ← cron Mondays 05:30 UTC

Generated at the site root (served by your host):
  answers/<linkd-month-d-year>/index.html
  answers/index.html            ← archive
  sitemap.xml  robots.txt  assets/og-linkd.svg
```

**Why extract from `index.html` instead of copying the puzzles?** The game picks today's chain with `chainForDay(dayNum)` off a fixed 2026-01-01 epoch. `marketing/lib/puzzle.js` mirrors that math exactly and parses the live `PUZZLES` array, so a generated answer page always matches what a player sees — no second copy to keep in sync.

**Adaptive to an expanding word bank.** Nothing hardcodes the bank size; `validPuzzles.length` is read fresh every run. **Add chains to `PUZZLES` in `index.html` and they're picked up automatically** — new days get the new chains, and because `BACKFILL=1` rebuilds every page each run, the archive and `sitemap.xml` self-heal. A parse-integrity check (parsed-count vs raw chain-literal count) aborts the build rather than ship truncated/wrong answers if the array ever grows malformed. The daily log prints the detected bank size each run.

> Two things to keep stable as you grow the bank: (1) keep the `const PUZZLES = [ … \n];` literal format (array-of-arrays of double-quoted words) so extraction keeps working; (2) prefer **appending** chains over inserting mid-array — `THEMES` is keyed by position, so an insertion shifts themes (the game's own `THEME_FIRST_WORDS` self-test guards this).

---

## The `AUTO_PUBLISH` switch

One flag, defaulting to **off**, governs everything outbound:

- `AUTO_PUBLISH=0` (default) — social + email drafts are written to `marketing/review-queue/<date>/` and **nothing is sent**. Read them, build trust.
- `AUTO_PUBLISH=1` — each **enabled** channel with **working credentials** publishes via its official API. Drafts are still written to the queue as an audit log.

SEO pages ignore this flag entirely — they're on your own domain, zero risk, and ship every day (requirement #1: “no gatekeeper”).

**To flip it:** set repo Variable `AUTO_PUBLISH=1` (Settings → Secrets and variables → Actions → Variables), or `export AUTO_PUBLISH=1` locally, or trigger the workflow manually with the `auto_publish` input. Turn on one channel at a time.

### Channel toggles

Each channel is independent: `CHANNEL_SEO`, `CHANNEL_X`, `CHANNEL_BLUESKY`, `CHANNEL_REDDIT`, `CHANNEL_MASTODON`, `CHANNEL_DISCORD`, `CHANNEL_EMAIL` (1/0). `CHANNEL_SEO` defaults on; the rest default off. A channel posts only when **its toggle is on AND `AUTO_PUBLISH=1` AND its keys are present**.

---

## API keys & scopes — exactly what to get

Set **Secrets** for anything with a token; **Variables** for non-secret config (base URLs, IDs, toggles). All names match `.env.example`.

### Bluesky — _start here (free, no approval)_
| Var | Secret? | How to get it |
|---|---|---|
| `BLUESKY_HANDLE` | no | your handle, e.g. `linkd.bsky.social` |
| `BLUESKY_APP_PASSWORD` | **yes** | Bluesky → Settings → **App Passwords** → Add. Use this, never your real password. |

No API key, no fee, no approval. Scope = full account via app password. Rate limits (~3,000 req / 5 min) are far beyond a daily post.

### X (Twitter)
| Var | Secret? | How to get it |
|---|---|---|
| `X_API_KEY`, `X_API_SECRET` | **yes** | developer.x.com → create a Project + App → **Keys and tokens** → *API Key & Secret* (consumer keys) |
| `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | **yes** | same page → *Access Token & Secret*. The app's **User authentication settings** must be set to **Read and Write**, app type *Web/Automated*. |

Scope needed: **`tweet.write`, `tweet.read`, `users.read`** (Read+Write). Posting uses OAuth 1.0a user context. Note the **Free** tier allows only a tiny monthly write quota (~500 posts/mo, 1 app) — fine for one post/day; **Basic** is ~$200/mo if you need more.

### Reddit — _high value, high ban risk: read § Reddit below_
| Var | Secret? | How to get it |
|---|---|---|
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | **yes** | reddit.com/prefs/apps → create app, type **script** |
| `REDDIT_USERNAME`, `REDDIT_PASSWORD` | **yes** | the posting account |
| `REDDIT_SUBREDDIT` | no (Var) | target sub without `r/` |
| `REDDIT_USER_AGENT` | no (Var) | e.g. `linkd-marketing/1.0 by u/you` |

Scopes: **`submit`, `identity`**. Free tier = 100 queries/min authenticated — vastly more than needed.

### Mastodon
| Var | Secret? | How to get it |
|---|---|---|
| `MASTODON_BASE_URL` | no (Var) | your instance, e.g. `https://mastodon.social` |
| `MASTODON_ACCESS_TOKEN` | **yes** | Preferences → Development → New application → scope **`write:statuses`** → copy access token |

### Discord
| Var | Secret? | How to get it |
|---|---|---|
| `DISCORD_WEBHOOK_URL` | **yes** | Server Settings → Integrations → Webhooks → New → Copy URL |

No scopes — a webhook posts to one channel only.

### Threads (Meta)
| Var | Secret? | How to get it |
|---|---|---|
| `THREADS_USER_ID` | no (Var) | your Threads numeric user id |
| `THREADS_ACCESS_TOKEN` | **yes** | Meta app → Threads API → long-lived token, scopes **`threads_basic`, `threads_content_publish`** |

### Email — pick one
**Buttondown** (recommended for indie newsletters):
| Var | Secret? | How to get it |
|---|---|---|
| `BUTTONDOWN_API_KEY` | **yes** | buttondown.com → Settings → Programming → API key |

**Resend** (broadcasts to an audience):
| Var | Secret? | How to get it |
|---|---|---|
| `RESEND_API_KEY` | **yes** | resend.com → API Keys (scope: **Sending access**) |
| `RESEND_AUDIENCE_ID` | no (Var) | Audiences → your audience id |
| `RESEND_FROM` | no (Var) | a verified sender, e.g. `Linkd <hi@linkddaily.com>` |

### Analytics (Umami)
| Var | Secret? | How to get it |
|---|---|---|
| `UMAMI_API_KEY` | **yes** | Umami Cloud → Settings → **API** → create key (self-host: use `UMAMI_TOKEN` bearer instead) |
| `UMAMI_WEBSITE_ID` | no (Var) | defaults to the id already in `index.html` (`cec9cd34…`) |

---

## The growth playbook (research-backed, prioritized)

From a deep-research pass on what actually grows indie daily puzzle games in 2025–2026. Ordered by ROI for a solo founder on a tiny budget.

### 0. The single highest-ROI mechanic you already have — the emoji share
The spoiler-free emoji-grid share (the thing that made Wordle explode) is **already in the game** (`Share Result` → `Linkd № 152 · EASY / 🟦🟩🟩🟩⬜⬜ / 3/5 links`). Two evidence-based tweaks worth considering (your call — not auto-applied, since it's the live game):
- **Decision: should the share include a link?** Today it doesn't. Wordle deliberately omitted the link and credited that for keeping shares *intrinsic* and non-spammy. But Wordle was already a phenomenon; a small game benefits from discoverability. Recommendation: **add a single trailing `linkddaily.com` line** — the marginal spam cost is low and it turns every share into a findable invite. (One-line change in the `shareBtn` handler in `index.html`.)
- Keep it spoiler-free (it is). Never put the answer in a share.

### 1. SEO answer pages — built, autonomous, compounding
This is the channel with the best long-run ROI and it's **done**. Players search exact strings like *“linkd answer today”*, *“linkd june 1 hints”*, *“linkd #152”*. The generated pages match that intent with: date+number H1, tiered spoiler-light hints, a spoiler-gated full answer, an **original difficulty rating + solver's note** (computed per puzzle), a visible FAQ mirrored in FAQ JSON-LD, breadcrumbs, neighbour links, and a chronological archive.

> **⚠️ The #1 risk to this channel: Google's Helpful Content signal.** It's **site-wide** — enough thin, auto-generated pages can demote your *whole* domain — and it explicitly targets “extensive automation” and “summarizing without adding value.” Mitigations already built in: every page carries original, puzzle-specific analysis (difficulty, longest-bridge anchor, hub-word commentary), not just the answer; sitemap `lastmod` is each puzzle's real date (no “fake freshness”); copy varies per day. **Keep it that way.** If Search Console ever flags the section, add more genuine commentary before adding more pages — never the reverse.

### 2. Bluesky — the #1 free social channel. Turn it on first.
Completely free, no keys to apply for, no approval, generous limits. Get an app password, set `CHANNEL_BLUESKY=1`, flip `AUTO_PUBLISH=1`. One spoiler-free hook a day.

### 3. Reddit — highest reach, highest ban risk. Use surgically.
The API is generous, but **~90% of subs ban self-promotion, and identical cross-posting triggers site-wide account suspension.** Rules baked into how you should use the built-in poster:
- Post to subs where it's **welcomed**: `r/SideProject`, `r/IMadeThis`, `r/incremental_games`, your **own** subreddit. Not `r/wordle`/`r/NYTConnections` cold.
- Obey the **9:1 rule**: nine genuine community contributions per promo post. The bot only does the 1; *you* do the 9.
- Don't auto-post the same text to multiple subs. Vary it, space it out.
- Most subs need ~20+ karma and a >1-week-old account. Warm the account first.
- Treat Reddit as **manual-assist**: review the queued draft, post it yourself where it fits. Only automate into a sub you control.

### 4. Email — turn on once a list exists
The daily email recaps yesterday's answer (good for the answer-page intent) and teases today spoiler-free. Add a signup form on the site first; Buttondown is the lowest-friction provider.

### 5. Mastodon / Discord / Threads — cheap breadth
Free and low-effort. Discord is best paired with a community server. Enable when you have the accounts.

### Schedulers (if you outgrow per-platform posting)
The built-in posters cover the main platforms for free. If you later want one dashboard: **Postiz** (open-source, self-host free or $39/mo, ~30 platforms) is the best-value API option; **Ayrshare** ($149/mo) is turnkey. Both have APIs you can swap in behind `channels/`.

### Phased rollout
1. **Week 1 — ship SEO (done).** Merge this, let the daily build run, submit `sitemap.xml` in Google Search Console + Bing Webmaster Tools. Consider the share-link tweak.
2. **Week 2 — Bluesky.** App password → `CHANNEL_BLUESKY=1` → `AUTO_PUBLISH=1`. Watch the queue for a few days first.
3. **Week 3 — Reddit (manual-assist) + a couple of cheap channels** (Mastodon/Discord).
4. **Week 4 — email** once a signup form exists, and **wire Umami** so the weekly report starts steering hooks.
5. **Ongoing —** read `marketing/reports/weekly-*.md`; double down on the top channel, fix the quiet ones.

---

## Brand voice

Editorial, terse, a little wry, lowercase-comfortable. No hype words, no emoji spam, one clean hook + one link. Mirrors the site (“Build the chain. Each word links to the next.”). Hooks may reference the **starter word, chain length, and theme** — **never the answer**. Copy lives in `channels/voice.js`; swap the templates for an LLM call later without touching anything else.

---

## Running it locally

```bash
node scripts/daily.js            # full pipeline (SEO always; channels gated)
node scripts/daily.js --only=seo # SEO only
node scripts/daily.js --dry-run  # compute + log, write nothing
node scripts/weekly.js           # analytics report (needs UMAMI_API_KEY)

# preview channel drafts without any keys:
CHANNEL_BLUESKY=1 CHANNEL_X=1 CHANNEL_EMAIL=1 node scripts/daily.js
cat marketing/review-queue/<date>/README.md
```

First run backfills every page from 2026-01-01 to today. Set `BACKFILL=0` once the archive is large to build only today's page.

## Hosting note

`linkddaily.com` is served by a static host watching this repo (the daily workflow just commits to `main`; the host redeploys on push). New files under `answers/`, plus `sitemap.xml` / `robots.txt`, are served automatically. If you're on GitHub Pages instead and want the Action itself to deploy, swap the commit step for an upload-pages-artifact + deploy-pages step — say the word and it's a 5-line change.

## Sources

Growth tactics above are drawn from a verified deep-research pass (Wordle launch mechanics; word.tips / Tom's Guide answer-page structure; Google Helpful Content docs; Bluesky AT Protocol, Reddit API & self-promo norms; Postiz/Ayrshare pricing). The full cited report is in the session's research output.
