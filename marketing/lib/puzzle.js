'use strict';
// ─────────────────────────────────────────────────────────────────────────
// Puzzle source of truth.
//
// We do NOT re-type the puzzle data here. Instead we parse PUZZLES + THEMES
// straight out of index.html at build time, then mirror the game's exact
// day-selection math (chainForDay / themeFor / day-number-from-date). This
// guarantees an answer page can never drift from what a player actually sees.
// ─────────────────────────────────────────────────────────────────────────
const fs = require('fs');

const MS_DAY = 86400000;
const EPOCH_UTC = Date.UTC(2026, 0, 1); // 2026-01-01 == display day 1

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];

// ── Extraction ──────────────────────────────────────────────────────────
function extractPuzzles(html) {
  // The outer array is the only one that closes with `];` at line start.
  const m = html.match(/const\s+PUZZLES\s*=\s*\[([\s\S]*?)\n\];/);
  if (!m) throw new Error('[puzzle] Could not locate the PUZZLES array in index.html');
  const inner = m[1].replace(/,\s*$/, ''); // drop trailing comma before `]`
  let arr;
  try {
    arr = JSON.parse('[' + inner + ']');
  } catch (e) {
    throw new Error('[puzzle] Failed to parse PUZZLES array: ' + e.message);
  }
  if (!Array.isArray(arr) || !arr.length || !Array.isArray(arr[0])) {
    throw new Error('[puzzle] PUZZLES parsed but shape is unexpected');
  }
  // Integrity guard for an EXPANDING bank: every chain literal begins with `["`.
  // If the JSON parse silently truncated (e.g. a malformed entry deep in a
  // 1000-chain array), the parsed length won't match the raw count — fail loud
  // rather than publish wrong answers.
  const rawCount = (inner.match(/\[\s*"/g) || []).length;
  if (arr.length !== rawCount) {
    throw new Error(`[puzzle] integrity check failed: parsed ${arr.length} chains but found ${rawCount} chain literals — extraction may be truncated. Aborting to avoid shipping wrong answers.`);
  }
  return arr;
}

function extractThemes(html) {
  const m = html.match(/const\s+THEMES\s*=\s*\{([\s\S]*?)\};/);
  const out = {};
  if (m) {
    const re = /(\d+)\s*:\s*"([^"]+)"/g;
    let x;
    while ((x = re.exec(m[1]))) out[parseInt(x[1], 10)] = x[2];
  }
  return out;
}

// ── Date ↔ day-number ───────────────────────────────────────────────────
function dayNumForDate(y, m, d) {                       // m is 1-12
  return Math.floor((Date.UTC(y, m - 1, d) - EPOCH_UTC) / MS_DAY) + 1;
}

function dateForDayNum(n) {
  const dt = new Date(EPOCH_UTC + (n - 1) * MS_DAY);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

// Today's calendar date in a given IANA timezone (zero-dependency via Intl).
function civilToday(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = t => parseInt(parts.find(p => p.type === t).value, 10);
  return { y: get('year'), m: get('month'), d: get('day') };
}

// ── Presentation helpers ─────────────────────────────────────────────
function iso(dateObj) {
  const p = n => String(n).padStart(2, '0');
  return `${dateObj.y}-${p(dateObj.m)}-${p(dateObj.d)}`;
}

function longDate(dateObj) {
  const month = MONTHS[dateObj.m - 1];
  const cap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${cap} ${dateObj.d}, ${dateObj.y}`;
}

// Keyword-rich, share-friendly slug: linkd-june-1-2026
function slugFor(dateObj) {
  return `linkd-${MONTHS[dateObj.m - 1]}-${dateObj.d}-${dateObj.y}`;
}

// Adjacent compound "bridges": BLACK + OUT -> BLACKOUT (matches index.html).
function bridgesFor(chain) {
  const out = [];
  for (let i = 0; i < chain.length - 1; i++) {
    out.push({ a: chain[i], b: chain[i + 1], compound: chain[i] + chain[i + 1] });
  }
  return out;
}

// ── Loader ──────────────────────────────────────────────────────────
// Returns a fully-bound puzzle model mirroring index.html's runtime logic.
function load(indexHtmlPath) {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const PUZZLES = extractPuzzles(html);
  const THEMES = extractThemes(html);
  // index.html: validPuzzles = PUZZLES.filter(c => new Set(c).size === c.length)
  const validPuzzles = PUZZLES.filter(c => new Set(c).size === c.length);
  const count = validPuzzles.length;

  const idxForDay = dayNum => (((dayNum - 1) % count) + count) % count;
  const chainForDay = dayNum => validPuzzles[idxForDay(dayNum)];
  const themeFor = dayNum => THEMES[idxForDay(dayNum)] || null;

  return {
    PUZZLES, THEMES, validPuzzles, count,
    bankSize: count,             // grows automatically as PUZZLES expands in index.html
    idxForDay, chainForDay, themeFor,
    dayNumForDate, dateForDayNum, civilToday,
    iso, longDate, slugFor, bridgesFor,
    MONTHS,
  };
}

module.exports = {
  load, extractPuzzles, extractThemes,
  dayNumForDate, dateForDayNum, civilToday,
  iso, longDate, slugFor, bridgesFor, MONTHS,
};
