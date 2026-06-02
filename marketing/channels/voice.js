'use strict';
// ─────────────────────────────────────────────────────────────────────────
// Brand voice + per-platform draft generation.
//
// Voice (mirrors linkddaily.com): editorial, terse, a little wry, lowercase-
// comfortable, no hype words, no emoji spam. One clean hook + one link.
// SPOILER RULE: hooks may reference the starter word, chain length, and theme
// — never the answer.
//
// Output is deterministic (day-seeded) so re-runs are reproducible and you can
// review tomorrow's drafts today. Swap `draftFor` internals for an LLM call
// later if you want livelier copy — the interface stays the same.
// ─────────────────────────────────────────────────────────────────────────
const { pick } = require('../lib/html');

const HOOKS = [
  c => `Today's Linkd starts with ${c.starter}. ${c.links} links to the finish. Can you build the chain?`,
  c => `New Linkd is live. Seed word: ${c.starter}. ${c.length} words, every neighbour a compound. Go.`,
  c => `${c.starter} → ? → ? → ? Today's Linkd chain is ${c.length} words long. Find the links.`,
  c => `Daily word chain #${c.dayNum}: it opens on ${c.starter}. Keep the streak alive.`,
  c => `One starter word (${c.starter}), ${c.links} compound-word links to chase. That's today's Linkd.`,
];

const THEME_HOOKS = [
  c => `Today's Linkd has a theme: “${c.theme}.” Starts with ${c.starter}, ${c.links} links. Can you feel where it's going?`,
  c => `Themed chain today — “${c.theme}.” Seed: ${c.starter}. Build it: ${c.playUrl}`,
];

function hookFor(c) {
  return c.theme ? pick(THEME_HOOKS, c.dayNum)(c) : pick(HOOKS, c.dayNum)(c);
}

const HASHTAGS = ['#wordgames', '#puzzle', '#dailygame', '#wordpuzzle', '#Linkd'];

function tagLine(c, n = 2) {
  const tags = [];
  for (let i = 0; i < n; i++) tags.push(pick(HASHTAGS, c.dayNum + i));
  return [...new Set(tags)].join(' ');
}

// ── Per-platform drafts ──────────────────────────────────────────────
function draftFor(platform, c) {
  const hook = hookFor(c);
  switch (platform) {
    case 'x': // <= 280 chars; link counts as 23
      return { platform, text: `${hook}\n\n${c.playUrl}\n${tagLine(c, 2)}`.slice(0, 280) };

    case 'bluesky': // 300 graphemes; link as text + facet
      return { platform, text: `${hook}\n\n${c.playUrl} ${tagLine(c, 2)}`.slice(0, 300), link: c.playUrl };

    case 'mastodon': // 500 chars; tags welcomed
      return { platform, text: `${hook}\n\nPlay free, no account needed: ${c.playUrl}\n\n${tagLine(c, 3)}` };

    case 'discord':
      return {
        platform,
        content: `**Linkd #${c.dayNum} is live.** ${hook}`,
        embed: {
          title: `Linkd — ${c.long}`,
          description: `Seed word **${c.starter}** · ${c.length} words · ${c.links} links${c.theme ? ` · theme “${c.theme}”` : ''}`,
          url: c.playUrl,
          color: 0xd62828,
        },
      };

    case 'reddit':
      // Title is spoiler-free; self-post body adds context + link. Use sparingly
      // and only where self-promo is allowed (see README § Reddit).
      return {
        platform,
        title: `Linkd #${c.dayNum} (${c.long}) — ${c.length}-word chain starting with ${c.starter}${c.theme ? `, theme “${c.theme}”` : ''}`,
        body: `${hook}\n\nLinkd is a free daily word-chain puzzle — every adjacent pair forms a compound word, and you rebuild the chain from one starter. No account, no app required.\n\nPlay: ${c.playUrl}\nHints & past answers: ${c.archiveUrl}`,
        url: c.playUrl,
      };

    default:
      return { platform, text: `${hook} ${c.playUrl}` };
  }
}

// Email (newsletter) — subject + html + text. This one MAY recap yesterday's
// answer (opt-in audience), but today's hook stays spoiler-free.
function emailDraft(today, yesterday) {
  const subject = today.theme
    ? `Linkd ${today.long}: “${today.theme}” — today's chain is live`
    : `Linkd ${today.long}: ${today.length}-word chain, starts with ${today.starter}`;
  const hook = hookFor(today);
  const yAns = yesterday
    ? `<p style="color:#6b665a;font-size:13px">Yesterday (${yesterday.long}) was: <strong>${yesterday.chain.join(' → ')}</strong>. <a href="${yesterday.answerUrl}">Full hints &amp; recap →</a></p>`
    : '';
  const html = `<div style="font-family:'JetBrains Mono',monospace;max-width:540px;margin:0 auto;color:#1a1a1a">
<div style="font-family:Archivo,sans-serif;font-weight:900;font-size:22px">LIN<span style="color:#d62828;font-style:italic">K</span>D</div>
<h1 style="font-family:Archivo,sans-serif;font-size:24px;margin:18px 0 8px">${today.long}</h1>
<p>${hook}</p>
<p><a href="${today.playUrl}" style="display:inline-block;background:#d62828;color:#fff;padding:12px 20px;text-decoration:none;font-weight:700">Play today's Linkd →</a></p>
<p style="color:#6b665a;font-size:13px">Seed word <strong>${today.starter}</strong> · ${today.length} words · ${today.links} links${today.theme ? ` · theme “${today.theme}”` : ''}</p>
${yAns}
<hr style="border:none;border-top:1px solid #c9c0a8;margin:20px 0"/>
<p style="color:#a8a294;font-size:11px">You're getting this because you subscribed at linkddaily.com. {{ unsubscribe }}</p>
</div>`;
  const text = `${today.long}\n\n${hook}\n\nPlay: ${today.playUrl}\nSeed ${today.starter} · ${today.length} words · ${today.links} links${today.theme ? ` · theme “${today.theme}”` : ''}\n`;
  return { subject, html, text };
}

module.exports = { hookFor, draftFor, emailDraft, tagLine };
