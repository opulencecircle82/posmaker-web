// rollout_stock_decimal_fix_to_all_dashboards.js
// Inventory stock with fractional values (e.g. weight-based deductions)
// displayed as ugly long decimals (19.171428571428567). Fixed in
// dashboard-lechon.html earlier (round to 2dp when fractional, show whole
// numbers as-is) — rolling out to all dashboards since any business with
// fractional stock (weight, volume, etc.) can hit this.
// Run: node scripts/rollout_stock_decimal_fix_to_all_dashboards.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const OLD = '        <span style="min-width:32px;text-align:center;font-weight:700;color:${out?\'#ef4444\':low?\'#f59e0b\':\'var(--text)\'}">${stock}</span>';
const NEW = '        <span style="min-width:32px;text-align:center;font-weight:700;color:${out?\'#ef4444\':low?\'#f59e0b\':\'var(--text)\'}">${Number.isInteger(stock)?stock:stock.toFixed(2)}</span>';

let patched = 0, skipped = 0;
const errors = [];

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('Number.isInteger(stock)')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); errors.push(file); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (errors.length) console.log('Anchor not found in: ' + errors.join(', '));
