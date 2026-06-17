// fix_ordertype_restaurant_only.js
// Hide "By Order Type" breakdown for non-restaurant (retail) dashboards
// Run: node scripts/fix_ordertype_restaurant_only.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const OLD = '  const typeGroups = {};\n  orders.forEach(o => {';
const NEW = '  const typeGroups = {};\n  if (RESTAURANT_BIZ.has(STORE && STORE.business_type)) orders.forEach(o => {';

let patched = 0, skipped = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (!c.includes('typeGroups')) { skipped++; continue; }
  if (c.includes('RESTAURANT_BIZ.has(STORE')) { console.log(`— ${file}: already patched`); skipped++; continue; }

  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); errors++; continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} patched, ${skipped} skipped, ${errors} errors.`);
