#!/usr/bin/env node
'use strict';
// Weekly analytics → decision loop. Pulls Umami, writes a report + recommendations.
//   node scripts/weekly.js
const report = require('../marketing/analytics/report');
report.run({ log: console.log })
  .then(() => console.log('Done.'))
  .catch(err => { console.error('[weekly] FAILED:', err && err.stack || err); process.exit(1); });
