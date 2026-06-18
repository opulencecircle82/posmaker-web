// add_remit_tolerance.js
// Cashier remittance accuracy used to count ANY over/short the same way,
// regardless of magnitude — being ₱1 off scored identically to ₱1000 off
// (both just "1 over" out of the total). Adds a ₱100 tolerance: differences
// within that range are treated as effectively balanced.
// Run: node scripts/add_remit_tolerance.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const OLD =
`  // 1. Cashier remittance accuracy
  const { data: remits } = await _sb.from('cash_remittances')
    .select('cashier_name,status')
    .eq('store_id', STORE.id)
    .gte('shift_date', cutoffStr)
    .in('status', ['balanced','over','short']);

  const cashierMap = {};
  for (const r of (remits || [])) {
    const n = r.cashier_name || 'Unknown';
    if (!cashierMap[n]) cashierMap[n] = { total: 0, balanced: 0, over: 0, short: 0 };
    cashierMap[n].total++;
    if (r.status === 'balanced') cashierMap[n].balanced++;
    else if (r.status === 'over') cashierMap[n].over++;
    else if (r.status === 'short') cashierMap[n].short++;
  }`;
const NEW =
`  // 1. Cashier remittance accuracy
  // Tolerance: over/short within ₱100 is treated as effectively balanced —
  // a ₱1 difference shouldn't score the same as a ₱1000 one.
  const REMIT_TOLERANCE = 100;
  const { data: remits } = await _sb.from('cash_remittances')
    .select('cashier_name,status,difference')
    .eq('store_id', STORE.id)
    .gte('shift_date', cutoffStr)
    .in('status', ['balanced','over','short']);

  const cashierMap = {};
  for (const r of (remits || [])) {
    const n = r.cashier_name || 'Unknown';
    if (!cashierMap[n]) cashierMap[n] = { total: 0, balanced: 0, over: 0, short: 0 };
    cashierMap[n].total++;
    const withinTolerance = Math.abs(parseFloat(r.difference) || 0) <= REMIT_TOLERANCE;
    if (r.status === 'balanced' || withinTolerance) cashierMap[n].balanced++;
    else if (r.status === 'over') cashierMap[n].over++;
    else if (r.status === 'short') cashierMap[n].short++;
  }`;

let patched = 0, skipped = 0;
const errors = [];

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('REMIT_TOLERANCE')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); errors.push(file); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped, ${errors.length} errors.`);
