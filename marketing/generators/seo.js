'use strict';
// ─────────────────────────────────────────────────────────────────────────
// Programmatic SEO page generator.
//
// For each past + current day it writes /answers/<slug>/index.html — an
// "hints & answer" page that targets the exact queries puzzle players search
// ("linkd answer today", "linkd june 1 hints"). Plus an archive index,
// sitemap.xml, robots.txt and a branded OG image. Every page is unique
// (real puzzle data, day-seeded copy variation) to stay clear of Google's
// thin/duplicate-content filters.
// ─────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const cfg = require('../lib/config');
const P = require('../lib/puzzle');
const { escapeHtml, titleWord, maskWord, pick } = require('../lib/html');

// ── Shared brand chrome (mirrors index.html's palette + type) ────────────────
const FONTS = 'https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap';

const CSS = `
:root{--bg:#f4ecd8;--bg-soft:#ebe2c9;--bg-card:#faf3e0;--ink:#1a1a1a;--ink-soft:#3a3a3a;--ink-muted:#6b665a;--ink-faint:#a8a294;--rule:#c9c0a8;--accent:#d62828;--accent-bg:rgba(214,40,40,.08);--correct:#2d5e2e;--close:#8a6b1a;--display:'Archivo',system-ui,sans-serif;--mono:'JetBrains Mono','Courier New',monospace}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--mono);background:var(--bg);color:var(--ink);line-height:1.6;-webkit-font-smoothing:antialiased;background-image:radial-gradient(ellipse at 25% 0%,rgba(214,40,40,.035) 0%,transparent 55%),radial-gradient(ellipse at 75% 100%,rgba(26,26,26,.04) 0%,transparent 60%)}
.wrap{max-width:640px;margin:0 auto;padding:28px 22px 72px}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.nav{display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:1.5px solid var(--ink);margin-bottom:28px}
.wordmark{font-family:var(--display);font-weight:900;font-size:22px;letter-spacing:-.02em;color:var(--ink);text-transform:uppercase;line-height:1}
.wordmark .accent{color:var(--accent);font-style:italic;font-weight:700}
.nav .cta{font-family:var(--mono);font-weight:700;font-size:12px;letter-spacing:.04em;text-transform:uppercase;border:1.5px solid var(--ink);padding:8px 14px;color:var(--ink);background:var(--bg-card)}
.nav .cta:hover{background:var(--ink);color:var(--bg);text-decoration:none}
.crumbs{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-muted);margin-bottom:18px}
.crumbs a{color:var(--ink-muted)}
h1{font-family:var(--display);font-weight:900;font-size:30px;line-height:1.12;letter-spacing:-.02em;margin-bottom:6px}
h1 .accent{color:var(--accent);font-style:italic}
.eyebrow{font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
.lede{font-size:15px;color:var(--ink-soft);margin:14px 0 26px}
h2{font-family:var(--display);font-weight:800;font-size:19px;letter-spacing:-.01em;margin:30px 0 12px;padding-top:22px;border-top:1px solid var(--rule)}
h2:first-of-type{border-top:none;padding-top:0}
p{margin:10px 0}
.card{background:var(--bg-card);border:1.5px solid var(--ink);padding:18px 20px;margin:14px 0}
.hint-list{list-style:none;counter-reset:h}
.hint-list li{counter-increment:h;position:relative;padding:11px 0 11px 40px;border-bottom:1px solid var(--rule)}
.hint-list li:last-child{border-bottom:none}
.hint-list li::before{content:counter(h);position:absolute;left:0;top:11px;font-family:var(--display);font-weight:900;font-size:15px;color:var(--accent);width:28px;height:28px;border:1.5px solid var(--accent);border-radius:50%;display:grid;place-items:center;line-height:1}
.hint-label{font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-muted);display:block;margin-bottom:2px}
.mono-em{font-family:var(--display);font-weight:800;letter-spacing:.02em}
.theme-tag{display:inline-block;background:var(--accent-bg);border:1px solid var(--accent);color:var(--accent);font-weight:700;font-size:12px;letter-spacing:.05em;text-transform:uppercase;padding:4px 10px;margin-top:4px}
details.answer{margin:8px 0;border:1.5px solid var(--ink);background:var(--bg-card)}
details.answer>summary{cursor:pointer;list-style:none;padding:16px 20px;font-family:var(--display);font-weight:800;font-size:16px;display:flex;justify-content:space-between;align-items:center}
details.answer>summary::-webkit-details-marker{display:none}
details.answer>summary .chev{color:var(--accent);font-weight:700}
details.answer[open]>summary{border-bottom:1px solid var(--rule)}
.reveal{padding:8px 20px 18px}
.reveal-row{display:flex;align-items:baseline;gap:12px;padding:7px 0}
.reveal-num{font-family:var(--mono);font-size:12px;color:var(--ink-faint);width:20px;flex:none}
.reveal-word{font-family:var(--display);font-weight:900;font-size:20px;letter-spacing:.01em}
.reveal-word.seed{color:var(--ink-muted)}
.bridge{font-size:11px;color:var(--ink-muted);padding:2px 0 2px 44px;font-family:var(--mono)}
.bridge .arrow{color:var(--accent);font-weight:700}
.bridge .compound{font-family:var(--display);font-weight:800;color:var(--ink-soft)}
.playbar{display:flex;gap:10px;flex-wrap:wrap;margin:26px 0}
.btn{font-family:var(--mono);font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;padding:13px 20px;border:1.5px solid var(--ink);text-align:center}
.btn.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
.btn.primary:hover{background:#b21f1f;text-decoration:none}
.btn.ghost{background:var(--bg-card);color:var(--ink)}
.btn.ghost:hover{background:var(--ink);color:var(--bg);text-decoration:none}
.pager{display:flex;justify-content:space-between;gap:12px;margin-top:30px;padding-top:18px;border-top:1px solid var(--rule);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.pager .next{text-align:right}
.pager span.disabled{color:var(--ink-faint)}
footer{margin-top:44px;padding-top:18px;border-top:1.5px solid var(--ink);font-size:12px;color:var(--ink-muted)}
footer a{color:var(--ink-muted)}
.arch-month{font-family:var(--display);font-weight:800;font-size:15px;letter-spacing:.02em;margin:24px 0 8px;color:var(--ink-muted);text-transform:uppercase}
.arch-list{list-style:none}
.arch-list li{border-bottom:1px solid var(--rule)}
.arch-list li a{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:12px 2px;color:var(--ink)}
.arch-list li a:hover{background:var(--accent-bg);text-decoration:none}
.arch-date{font-weight:700}
.arch-peek{font-size:12px;color:var(--ink-muted);font-family:var(--display);font-weight:700}
.arch-theme{font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:.05em}
`.trim();

function head({ title, desc, canonical, jsonld, robots }) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}"/>
<link rel="canonical" href="${escapeHtml(canonical)}"/>
<meta name="robots" content="${robots || 'index,follow,max-image-preview:large'}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="Linkd"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(desc)}"/>
<meta property="og:url" content="${escapeHtml(canonical)}"/>
<meta property="og:image" content="${cfg.SITE_URL}${cfg.OG_IMAGE_URL_PATH}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(desc)}"/>
<meta name="twitter:image" content="${cfg.SITE_URL}${cfg.OG_IMAGE_URL_PATH}"/>
<meta name="theme-color" content="#f4ecd8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="${FONTS}" rel="stylesheet"/>
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ''}
</head><body><div class="wrap">`;
}

function navBar() {
  return `<header class="nav"><a class="wordmark" href="${cfg.SITE_URL}/">LIN<span class="accent">K</span>D</a><a class="cta" href="${cfg.SITE_URL}/">Play today →</a></header>`;
}

function footer() {
  return `<footer><strong>Linkd</strong> — ${escapeHtml(cfg.SITE_TAGLINE)} `
    + `<a href="${cfg.SITE_URL}/">Play the daily puzzle</a> · `
    + `<a href="${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/">Answer archive</a>.`
    + `<br/>Hints &amp; answers are auto-generated each day. This page is a fan resource for the Linkd daily word game.</footer></div></body></html>`;
}

// ── Hint generation (spoiler-light, fully derived from the chain) ──────────
const LEDE_TEMPLATES = [
  d => `Stuck on the Linkd chain for ${d.long}? Below are graduated hints — from the gentlest nudge to the full answer — so you can get unstuck without spoiling the whole puzzle.`,
  d => `Here are today's Linkd hints and the complete answer for ${d.long} (puzzle #${d.dayNum}). Start at hint 1 and only scroll as far as you need.`,
  d => `Need a hand with the ${d.long} Linkd puzzle? We've broken today's word chain down into escalating clues, then the full solution at the bottom.`,
  d => `The Linkd answer for ${d.long} is below, but try the hints first — they're ordered from soft to strong so you can keep your streak alive on your own terms.`,
];

function buildHints(chain, theme) {
  const bridges = P.bridgesFor(chain);
  const seed = chain[0];
  const links = chain.length - 1;
  const hints = [];

  hints.push({
    label: 'Theme',
    html: theme
      ? `Today's chain has a theme: <span class="theme-tag">${escapeHtml(theme)}</span>`
      : `No named theme today — just follow the links wherever they go.`,
  });

  hints.push({
    label: 'Shape',
    html: `The chain is <span class="mono-em">${chain.length} words</span> long, so there are <span class="mono-em">${links} links</span> to find after the starter.`,
  });

  hints.push({
    label: 'Starter',
    html: `It opens with <span class="mono-em">${escapeHtml(seed)}</span> (always given to you).`,
  });

  hints.push({
    label: 'First letters',
    html: `After the starter, each word begins: ${chain.slice(1)
      .map(w => `<span class="mono-em">${escapeHtml(w[0])}</span>`).join(' · ')}.`,
  });

  // The big one: each bridge as a masked compound — strong nudge, not the word.
  const bridgeBits = bridges.map(b =>
    `<span class="mono-em">${escapeHtml(b.a)}</span> + <span class="mono-em">${escapeHtml(maskWord(b.b, 1))}</span> (${b.b.length} letters) makes the word <span class="mono-em">${escapeHtml(b.a + maskWord(b.b, 1))}…</span>`
  ).join('<br/>');
  hints.push({
    label: 'The links',
    html: `Each step joins with the last to make a real compound word:<br/>${bridgeBits}`,
  });

  return hints;
}

// ── Full answer block ─────────────────────────────────────────────
function buildAnswer(chain) {
  let rows = '';
  chain.forEach((w, i) => {
    rows += `<div class="reveal-row"><span class="reveal-num">${i + 1}</span><span class="reveal-word${i === 0 ? ' seed' : ''}">${escapeHtml(w)}</span></div>`;
    if (i < chain.length - 1) {
      rows += `<div class="bridge"><span class="arrow">↳</span> <span class="compound">${escapeHtml(w + chain[i + 1])}</span></div>`;
    }
  });
  return `<details class="answer"><summary>Show the full answer chain <span class="chev">▾</span></summary><div class="reveal">${rows}</div></details>`;
}

// ── Genuine per-puzzle value (Helpful-Content mitigation) ────────────────
// Google's Helpful Content signal is site-wide and explicitly targets thin,
// auto-summarized pages. These two functions derive ORIGINAL, puzzle-specific
// analysis from the actual chain so every page earns its place.
function assessDifficulty(chain) {
  const bridges = P.bridgesFor(chain);
  const len = chain.length;
  const avgLen = chain.reduce((s, w) => s + w.length, 0) / len;
  // Short interior "hub" words (OUT, UP, BACK…) attach to many compounds — more
  // branches to weigh, so they raise perceived difficulty.
  const hubs = chain.slice(1, -1).filter(w => w.length <= 3);
  const longestBridge = bridges.reduce((m, b) => b.compound.length > m.compound.length ? b : m, bridges[0]);
  let score = (len - 5) * 1.4 + Math.max(0, avgLen - 4.2) * 1.1 + hubs.length * 1.3;
  score = Math.max(0, score);
  let label, stars;
  if (score < 1.5) { label = 'Easy'; stars = 1; }
  else if (score < 3) { label = 'Medium'; stars = 2; }
  else if (score < 5) { label = 'Tricky'; stars = 3; }
  else { label = 'Tough'; stars = 4; }
  return { label, stars, score: Math.round(score * 10) / 10, len, avgLen: Math.round(avgLen * 10) / 10, hubs, longestBridge };
}

function solverNote(chain, diff) {
  const lb = diff.longestBridge;
  const parts = [];
  parts.push(`At ${diff.len} words this one sits in <span class="mono-em">${diff.label.toLowerCase()}</span> territory.`);
  parts.push(`The longest single link is <span class="mono-em">${escapeHtml(lb.a)} + ${escapeHtml(lb.b)} = ${escapeHtml(lb.compound)}</span> (${lb.compound.length} letters) — a solid anchor to lock in first and work outward from.`);
  if (diff.hubs.length) {
    const hubList = diff.hubs.map(w => `<span class="mono-em">${escapeHtml(w)}</span>`).join(', ');
    parts.push(`Watch the short connector word${diff.hubs.length > 1 ? 's' : ''} ${hubList} in the middle: tiny words like these join lots of compounds, so the challenge is less about spelling and more about spotting which branch the chain actually takes.`);
  } else {
    parts.push(`There are no tiny connector words today, so each link is fairly committed once you see it — momentum carries you.`);
  }
  return parts.join(' ');
}

// ── Visible FAQ (mirrors the FAQ JSON-LD so the on-page text matches) ──────
function faqBlock(items) {
  return `<div class="card">` + items.map(q =>
    `<details class="answer" style="border:none;background:none"><summary style="padding:10px 0;font-size:15px">${escapeHtml(q.q)} <span class="chev">▾</span></summary><div style="padding:0 0 12px;color:var(--ink-soft);font-size:14px">${q.a}</div></details>`
  ).join('') + `</div>`;
}

// ── JSON-LD ──────────────────────────────────────────────────
function stripTags(s) { return String(s).replace(/<[^>]+>/g, ''); }

function jsonLd({ canonical, long, dayNum, chain, theme, diff, faqItems }) {
  const answerText = chain.join(' → ');
  // Lead with the headline Q (the answer), then mirror the visible on-page FAQ
  // so the structured data matches what users actually see.
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What is the Linkd answer for ${long}?`,
        acceptedAnswer: { '@type': 'Answer', text: `Today's Linkd chain (#${dayNum}, rated ${diff ? diff.label : 'n/a'}) is: ${answerText}.` },
      },
      ...(faqItems || []).map(it => ({
        '@type': 'Question', name: it.q,
        acceptedAnswer: { '@type': 'Answer', text: stripTags(it.a) },
      })),
    ],
  };
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Linkd', item: cfg.SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Answers', item: `${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/` },
      { '@type': 'ListItem', position: 3, name: long, item: canonical },
    ],
  };
  return JSON.stringify([faq, breadcrumb]);
}

// ── Page builders ───────────────────────────────────────────────
function answerPage(model, dayNum, todayDayNum) {
  const date = P.dateForDayNum(dayNum);
  const long = P.longDate(date);
  const slug = P.slugFor(date);
  const chain = model.chainForDay(dayNum);
  const theme = model.themeFor(dayNum);
  const canonical = `${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/${slug}/`;

  const diff = assessDifficulty(chain);
  const title = `Linkd ${long} — Hints & Answer (Puzzle #${dayNum})`;
  const desc = `Hints, difficulty (${diff.label}) and the full answer for the Linkd word-chain puzzle on ${long}`
    + `${theme ? ` (theme: ${theme})` : ''}. ${chain.length} words, ${chain.length - 1} links — nudges first, solution last.`;

  const lede = pick(LEDE_TEMPLATES, dayNum)({ long, dayNum });
  const hints = buildHints(chain, theme);
  const note = solverNote(chain, diff);
  const faqItems = [
    { q: `How hard is the Linkd ${long} puzzle?`, a: `We rate it <strong>${diff.label}</strong> (${diff.stars}/4): ${diff.len} words, average word length ${diff.avgLen}${diff.hubs.length ? `, with ${diff.hubs.length} short connector word${diff.hubs.length > 1 ? 's' : ''} to watch` : ''}.` },
    { q: `What is the starting word for Linkd ${long}?`, a: `The chain opens on <strong>${escapeHtml(chain[0])}</strong>, which is always given. You build the remaining ${chain.length - 1} links from there.` },
    ...(theme ? [{ q: `What is the theme of the Linkd ${long} puzzle?`, a: `The theme is “<strong>${escapeHtml(theme)}</strong>”.` }] : []),
    { q: `What is Linkd and where can I play?`, a: `Linkd is a free daily word-chain puzzle — each adjacent pair of words forms a compound word, and you rebuild the chain from one starter across easy, medium and hard modes. Play at <a href="${cfg.SITE_URL}/">linkddaily.com</a>.` },
  ];
  const ld = jsonLd({ canonical, long, dayNum, chain, theme, diff, faqItems });

  // Neighbour links (never link to a future / unbuilt day).
  const prev = dayNum > 1 ? P.dateForDayNum(dayNum - 1) : null;
  const next = dayNum < todayDayNum ? P.dateForDayNum(dayNum + 1) : null;
  const prevLink = prev
    ? `<a href="${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/${P.slugFor(prev)}/">← ${P.longDate(prev)}</a>`
    : `<span class="disabled">← (start)</span>`;
  const nextLink = next
    ? `<a href="${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/${P.slugFor(next)}/">${P.longDate(next)} →</a>`
    : `<span class="disabled">latest →</span>`;

  const body = navBar()
    + `<nav class="crumbs"><a href="${cfg.SITE_URL}/">Linkd</a> / <a href="${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/">Answers</a> / ${escapeHtml(long)}</nav>`
    + `<div class="eyebrow">Puzzle #${dayNum} · ${escapeHtml(long)}</div>`
    + `<h1>Linkd Hints &amp; <span class="accent">Answer</span></h1>`
    + `<p class="lede">${lede}</p>`
    + `<div class="playbar"><a class="btn primary" href="${cfg.SITE_URL}/">Play today's Linkd</a><a class="btn ghost" href="${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/">Browse the archive</a></div>`
    + `<h2>How Linkd works</h2><p>Each Linkd puzzle is a chain of words where <em>every neighbouring pair joins into a single compound word</em> — for example <span class="mono-em">BLACK</span> + <span class="mono-em">OUT</span> makes <span class="mono-em">BLACKOUT</span>. You're given the first word; your job is to rebuild the rest of the chain, one link at a time, across easy, medium and hard modes.</p>`
    + `<h2>Difficulty &amp; solver's note</h2><div class="card"><p style="margin-top:0"><span class="hint-label">Our rating</span><span class="mono-em" style="font-size:18px">${escapeHtml(diff.label)}</span> <span style="color:var(--accent)">${'◆'.repeat(diff.stars)}${'◇'.repeat(4 - diff.stars)}</span></p><p style="margin-bottom:0">${note}</p></div>`
    + `<h2>Today's hints</h2><div class="card"><ol class="hint-list">`
    + hints.map(h => `<li><span class="hint-label">${escapeHtml(h.label)}</span>${h.html}</li>`).join('')
    + `</ol></div>`
    + `<h2>Linkd ${escapeHtml(long)} answer</h2>`
    + `<p>Final spoiler warning — the complete chain is below. Tap to reveal.</p>`
    + buildAnswer(chain)
    + `<div class="playbar"><a class="btn primary" href="${cfg.SITE_URL}/">Keep your streak — play now</a></div>`
    + `<h2>Linkd ${escapeHtml(long)} FAQ</h2>`
    + faqBlock(faqItems)
    + `<nav class="pager"><div class="prev">${prevLink}</div><div class="next">${nextLink}</div></nav>`
    + footer();

  const html = head({ title, desc, canonical, jsonld: ld }) + body;
  return { slug, html, date, long, dayNum, theme, chain };
}

function archivePage(model, todayDayNum) {
  const title = `Linkd Answer Archive — Every Daily Puzzle's Hints & Solutions`;
  const desc = `Browse hints and answers for every Linkd daily word-chain puzzle, newest first. ${todayDayNum} puzzles and counting.`;
  const canonical = `${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/`;

  // Group newest-first by month.
  const groups = [];
  let curKey = null, cur = null;
  for (let n = todayDayNum; n >= 1; n--) {
    const d = P.dateForDayNum(n);
    const key = `${d.y}-${d.m}`;
    if (key !== curKey) { cur = { label: `${P.MONTHS[d.m - 1].toUpperCase()} ${d.y}`, items: [] }; groups.push(cur); curKey = key; }
    const chain = model.chainForDay(n);
    const theme = model.themeFor(n);
    cur.items.push({ n, d, slug: P.slugFor(d), long: P.longDate(d), seed: chain[0], len: chain.length, theme });
  }

  let listHtml = '';
  for (const g of groups) {
    listHtml += `<div class="arch-month">${escapeHtml(g.label)}</div><ul class="arch-list">`;
    for (const it of g.items) {
      listHtml += `<li><a href="${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/${it.slug}/">`
        + `<span class="arch-date">${escapeHtml(it.long)} <span style="color:var(--ink-faint);font-weight:400">· #${it.n}</span></span>`
        + `<span class="arch-peek">${escapeHtml(it.seed)}… (${it.len})${it.theme ? ` <span class="arch-theme">${escapeHtml(it.theme)}</span>` : ''}</span>`
        + `</a></li>`;
    }
    listHtml += `</ul>`;
  }

  const ld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'Linkd Answer Archive', url: canonical, description: desc,
  });

  const body = navBar()
    + `<nav class="crumbs"><a href="${cfg.SITE_URL}/">Linkd</a> / Answers</nav>`
    + `<div class="eyebrow">The archive</div>`
    + `<h1>Linkd Answer <span class="accent">Archive</span></h1>`
    + `<p class="lede">Hints and full solutions for every Linkd puzzle to date, newest first. Looking for today's? <a href="${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/${P.slugFor(P.dateForDayNum(todayDayNum))}/">Jump to the latest answer</a> or <a href="${cfg.SITE_URL}/">play the live puzzle</a>.</p>`
    + listHtml
    + footer();

  return head({ title, desc, canonical, jsonld: ld }) + body;
}

// items: [{ slug, iso }] — each answer page carries its OWN puzzle date as
// lastmod (honest freshness; avoids the date-only "fake freshness" that Google
// penalises). Home + archive legitimately change daily, so they use today.
function sitemapXml(items, todayIso) {
  const url = (loc, lastmod, priority) =>
    `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod>${priority ? `<priority>${priority}</priority>` : ''}</url>`;
  const entries = [
    url(`${cfg.SITE_URL}/`, todayIso, '1.0'),
    url(`${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/`, todayIso, '0.8'),
    ...items.map(it => url(`${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/${it.slug}/`, it.iso, '0.6')),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

function robotsTxt() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${cfg.SITE_URL}/sitemap.xml\n`;
}

function ogSvg() {
  // Branded, brand-palette OG card. SVG keeps it zero-dependency; swap in a
  // PNG at the same path later for maximum unfurl compatibility.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f4ecd8"/>
<rect x="0" y="0" width="1200" height="12" fill="#d62828"/>
<text x="80" y="150" font-family="Archivo,Arial,sans-serif" font-weight="900" font-size="54" letter-spacing="-1" fill="#1a1a1a">LIN<tspan fill="#d62828" font-style="italic">K</tspan>D</text>
<text x="80" y="330" font-family="Archivo,Arial,sans-serif" font-weight="900" font-size="104" fill="#1a1a1a">Build the <tspan fill="#d62828" font-style="italic">chain.</tspan></text>
<text x="82" y="420" font-family="'JetBrains Mono',monospace" font-size="34" fill="#3a3a3a">A daily word-chain puzzle · hints &amp; answers</text>
<g font-family="Archivo,Arial,sans-serif" font-weight="800" font-size="30" fill="#1a1a1a">
<rect x="80" y="500" width="170" height="62" fill="#faf3e0" stroke="#1a1a1a" stroke-width="3"/><text x="110" y="541">BLACK</text>
<text x="268" y="541" fill="#d62828" font-size="34">+</text>
<rect x="300" y="500" width="120" height="62" fill="#faf3e0" stroke="#1a1a1a" stroke-width="3"/><text x="330" y="541">OUT</text>
<text x="440" y="541" fill="#d62828" font-size="34">=</text>
<rect x="476" y="500" width="250" height="62" fill="#d62828"/><text x="506" y="541" fill="#fff">BLACKOUT</text>
</g>
<text x="1120" y="560" text-anchor="end" font-family="'JetBrains Mono',monospace" font-size="26" fill="#6b665a">linkddaily.com</text>
</svg>\n`;
}

// ── Orchestration ────────────────────────────────────────────────
function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  let existed = false, changed = true;
  if (fs.existsSync(p)) { existed = true; changed = fs.readFileSync(p, 'utf8') !== content; }
  if (changed) fs.writeFileSync(p, content);
  return { existed, changed };
}

// generate({ dryRun }) -> summary
function generate({ dryRun = false } = {}) {
  const model = P.load(cfg.INDEX_HTML);
  const today = model.civilToday(cfg.SITE_TZ);
  const todayDayNum = model.dayNumForDate(today.y, today.m, today.d);
  if (todayDayNum < 1) throw new Error(`[seo] todayDayNum=${todayDayNum} (< 1). Check SITE_TZ / system clock vs the 2026-01-01 epoch.`);

  const from = cfg.BACKFILL ? 1 : todayDayNum;
  const items = [];
  let written = 0, changed = 0;

  for (let n = from; n <= todayDayNum; n++) {
    const page = answerPage(model, n, todayDayNum);
    items.push({ slug: page.slug, iso: P.iso(page.date) });
    const outPath = path.join(cfg.ANSWERS_DIR, page.slug, 'index.html');
    if (!dryRun) {
      const r = writeFile(outPath, page.html);
      written++;
      if (r.changed) changed++;
    }
  }

  // Archive index, sitemap, robots, OG image.
  const todayIso = P.iso(today);
  if (!dryRun) {
    writeFile(path.join(cfg.ANSWERS_DIR, 'index.html'), archivePage(model, todayDayNum));
    writeFile(cfg.SITEMAP, sitemapXml(items, todayIso));
    writeFile(cfg.ROBOTS, robotsTxt());
    writeFile(cfg.OG_IMAGE, ogSvg());
  }

  const todaySlug = P.slugFor(P.dateForDayNum(todayDayNum));
  return {
    todayDayNum, todayIso, from, to: todayDayNum,
    bankSize: model.bankSize,
    pages: items.length, written, changed,
    todayUrl: `${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/${todaySlug}/`,
    archiveUrl: `${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/`,
  };
}

module.exports = { generate, answerPage, archivePage, sitemapXml, robotsTxt, ogSvg };
