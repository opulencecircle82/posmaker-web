// rollout_faster_staff_refresh.js
// Staff page auto-refreshes "Online" status every 30s — shortened to 10s so
// the dashboard reflects an actual logout sooner (was lagging behind the
// real POS state). Universal staff feature, applies to all business types.
// Run: node scripts/rollout_faster_staff_refresh.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const OLD = "if (id === 'staff') _staffRefreshTimer = setInterval(loadStaff, 30 * 1000);";
const NEW = "if (id === 'staff') _staffRefreshTimer = setInterval(loadStaff, 10 * 1000);";

let patched = 0, skipped = 0;
const errors = [];

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes(NEW)) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); errors.push(file); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (errors.length) console.log('Anchor not found in: ' + errors.join(', '));
