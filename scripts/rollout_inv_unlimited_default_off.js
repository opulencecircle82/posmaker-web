// rollout_inv_unlimited_default_off.js
// Fix for the Inventory "Add Item" modal on TRUE_SERVICE_BIZ stores (Laundry,
// Salon/Barbershop, Printing/Photocopy): a brand-new item defaulted the
// "Unlimited" checkbox to checked (since svcStock starts at 0 and the old
// logic treated stock===0 as "unlimited"), which disables the Stock Qty
// input — so owners adding a real, trackable supply (e.g. soap powder) could
// not type a quantity at all. Now "Unlimited" only auto-checks when EDITING
// an existing item that was actually saved with stock=0; new items default
// to trackable (Unlimited unchecked, Qty field enabled).
// Run: node scripts/rollout_inv_unlimited_default_off.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const OLD = `    const svcStock = item ? (item.stock ?? 0) : 0;
    const unlimited = svcStock === 0;`;
const NEW = `    const svcStock = item ? (item.stock ?? 0) : 0;
    const unlimited = item ? (svcStock === 0) : false;`;

let patched = 0, skipped = 0;
const errors = [];

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes(`const unlimited = item ? (svcStock === 0) : false;`)) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { errors.push(file); console.log(`⚠  ${file}: anchor not found — not modified`); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped, ${errors.length} errors.`);
