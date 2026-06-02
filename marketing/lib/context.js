'use strict';
// Builds the per-day "puzzle context" object that every channel (social, email)
// draws from. Spoiler discipline lives here: `starter`, `length`, `theme` are
// safe to broadcast; `chain` (the answer) is included only for the SEO/email
// answer recap and must never go into a social hook.
const cfg = require('./config');
const P = require('./puzzle');

function buildDayContext(dayNum) {
  const model = P.load(cfg.INDEX_HTML);
  if (dayNum == null) {
    const t = model.civilToday(cfg.SITE_TZ);
    dayNum = model.dayNumForDate(t.y, t.m, t.d);
  }
  const date = P.dateForDayNum(dayNum);
  const chain = model.chainForDay(dayNum);
  const theme = model.themeFor(dayNum);
  const slug = P.slugFor(date);
  return {
    dayNum,
    date,
    iso: P.iso(date),
    long: P.longDate(date),
    chain,                       // full answer — SEO/email only
    starter: chain[0],           // safe to share (always given to players)
    length: chain.length,
    links: chain.length - 1,
    theme,                       // safe to share
    playUrl: `${cfg.SITE_URL}/`,
    answerUrl: `${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/${slug}/`,
    archiveUrl: `${cfg.SITE_URL}/${cfg.ANSWERS_PATH}/`,
  };
}

module.exports = { buildDayContext };
