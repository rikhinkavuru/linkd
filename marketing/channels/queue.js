'use strict';
// Review queue + idempotency state. Every generated draft is written here as a
// human-readable audit trail — whether or not it gets auto-published — so you
// can read tomorrow's posts today and trust the system before flipping
// AUTO_PUBLISH. Drafts live under marketing/review-queue/<date>/.
const fs = require('fs');
const path = require('path');
const cfg = require('../lib/config');

const STATE_DIR = path.join(cfg.ROOT, 'marketing', '.state');

function writeDrafts(iso, drafts, emailDraft) {
  const dir = path.join(cfg.REVIEW_DIR, iso);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'drafts.json'), JSON.stringify({ iso, drafts, email: emailDraft }, null, 2));

  let md = `# Linkd marketing drafts — ${iso}\n\n`;
  for (const d of drafts) {
    md += `## ${d.platform}\n\n`;
    if (d.title) md += `**Title:** ${d.title}\n\n`;
    if (d.text) md += '```\n' + d.text + '\n```\n\n';
    if (d.content) md += '```\n' + d.content + (d.embed ? `\n[embed] ${d.embed.title} — ${d.embed.description}` : '') + '\n```\n\n';
    if (d.body) md += '```\n' + d.body + '\n```\n\n';
  }
  if (emailDraft) md += `## email\n\n**Subject:** ${emailDraft.subject}\n\n\`\`\`\n${emailDraft.text}\n\`\`\`\n`;
  fs.writeFileSync(path.join(dir, 'README.md'), md);
  return dir;
}

// Idempotency: don't post the same platform twice on the same day.
function alreadyPosted(iso, platform) {
  return fs.existsSync(path.join(STATE_DIR, `${iso}.${platform}.sent`));
}
function markPosted(iso, platform, result) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(path.join(STATE_DIR, `${iso}.${platform}.sent`),
    JSON.stringify({ iso, platform, at: new Date().toISOString(), result }));
}

module.exports = { writeDrafts, alreadyPosted, markPosted, STATE_DIR };
