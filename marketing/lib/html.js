'use strict';
// Tiny HTML/text helpers shared across generators and channels. No deps.

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Title-case a SCREAMING word for prose: "BLACK" -> "Black".
function titleWord(w) {
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

// Render a word as a masked hint: first `reveal` letters shown, rest as dots.
// maskWord("OUT", 1) -> "O··"
function maskWord(w, reveal = 1) {
  const letters = [...w];
  return letters.map((ch, i) => (i < reveal ? ch : '·')).join('');
}

// Deterministic pick from a list, seeded by an integer (keeps copy varied
// across days without randomness, so builds are reproducible).
function pick(list, seed) {
  return list[((seed % list.length) + list.length) % list.length];
}

function minify(html) {
  // Conservative: collapse run-of-the-mill inter-tag whitespace only.
  return html.replace(/>\n\s+</g, '><').trim() + '\n';
}

module.exports = { escapeHtml, titleWord, maskWord, pick, minify };
