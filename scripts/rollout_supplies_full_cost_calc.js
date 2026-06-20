// rollout_supplies_full_cost_calc.js
// Follow-up to the "My Services"/"Supplies" relabel: the Inventory ("Supplies")
// Add/Edit modal for TRUE_SERVICE_BIZ stores (Laundry, Salon/Barbershop,
// Printing/Photocopy) was hiding the real Stock Qty + Total Purchase Price
// auto cost-per-unit calculator and the usage-per-order calculator, showing
// a simplified manual Stock/Cost field instead — a leftover from when this
// tab was meant for abstract "services" with no real stock. Now that it's
// honestly "Supplies" (real, trackable raw materials like soap powder,
// detergent), it should use the exact same full calculator UI as every
// other business type's Inventory tab.
// Run: node scripts/rollout_supplies_full_cost_calc.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const P1_OLD = `document.getElementById('invModalTitle').textContent = item ? (isServiceBiz?'Edit Service':'Edit Item') : (isServiceBiz?'Add Service':'Add Inventory Item');
  document.getElementById('btnInvCam').style.display    = isServiceBiz ? 'none' : '';
  document.getElementById('btnInvUpload').style.display = '';
  document.getElementById('invCamHint').textContent     = isServiceBiz ? '1 photo showing this service.' : '1 photo. Barcode auto-detected.';
  document.getElementById('invStockRow').style.display    = isServiceBiz ? 'none' : '';
  document.getElementById('invCostCalc').style.display    = isServiceBiz ? 'none' : '';
  document.getElementById('invLowStockField').style.display = isServiceBiz ? 'none' : '';
  document.getElementById('invServiceCostField').style.display = isServiceBiz ? '' : 'none';
  document.getElementById('invServiceCost').value = item ? (item.cost_price || '') : '';
  document.getElementById('invServiceStockField').style.display = isServiceBiz ? '' : 'none';
  if (isServiceBiz) {
    const svcStock = item ? (item.stock ?? 0) : 0;
    const unlimited = item ? (svcStock === 0) : false;
    document.getElementById('invServiceUnlimited').checked = unlimited;
    document.getElementById('invServiceStock').value = unlimited ? '' : svcStock;
    document.getElementById('invLowStock').value = item ? (item.low_stock_threshold ?? 5) : 5;
    toggleServiceUnlimitedStock();
  }`;
const P1_NEW = `document.getElementById('invModalTitle').textContent = item ? (isServiceBiz?'Edit Supply':'Edit Item') : (isServiceBiz?'Add Supply':'Add Inventory Item');
  document.getElementById('btnInvCam').style.display    = isServiceBiz ? 'none' : '';
  document.getElementById('btnInvUpload').style.display = '';
  document.getElementById('invCamHint').textContent     = isServiceBiz ? '1 photo showing this supply item.' : '1 photo. Barcode auto-detected.';
  document.getElementById('invStockRow').style.display    = '';
  document.getElementById('invCostCalc').style.display    = '';
  document.getElementById('invLowStockField').style.display = '';
  document.getElementById('invServiceCostField').style.display = 'none';
  document.getElementById('invServiceStockField').style.display = 'none';`;

const P2_OLD = `  const isServiceBiz = TRUE_SERVICE_BIZ.has(STORE?.business_type || '');
  tbody.innerHTML=items.map(i=>{
    const stock=parseFloat(i.stock??0);
    const thresh=parseFloat(i.low_stock_threshold??5);
    const unlimited=isServiceBiz&&stock===0;`;
const P2_NEW = `  tbody.innerHTML=items.map(i=>{
    const stock=parseFloat(i.stock??0);
    const thresh=parseFloat(i.low_stock_threshold??5);
    const unlimited=false;`;

const PATCHES = [
  ['P1-modal-fields', P1_OLD, P1_NEW],
  ['P2-render-badge', P2_OLD, P2_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes(`'Add Supply'`)) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label); continue; }
    c = c.replace(oldStr, newStr);
  }
  if (fileErrs.length) { errors[file] = fileErrs; console.log(`⚠  ${file}: missing ${fileErrs.join(', ')} — not modified`); continue; }

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (Object.keys(errors).length) {
  console.log('\nFiles with anchor errors (not modified):');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
