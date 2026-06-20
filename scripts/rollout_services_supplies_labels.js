// rollout_services_supplies_labels.js
// Fixes a naming confusion: for TRUE_SERVICE_BIZ stores (Laundry, Salon/
// Barbershop, Printing/Photocopy) the sidebar's "Inventory" tab (raw
// materials/supplies stock, consumed behind the scenes via inv_links) was
// mislabeled "My Services", while the actual sellable service+price catalog
// (the "Products" tab, which feeds the cashier/POS) was labeled "Services &
// Prices". This swaps it: "My Services" now correctly names the
// Products tab, and the Inventory tab is honestly labeled "Supplies".
// Run: node scripts/rollout_services_supplies_labels.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const P1_OLD = `<h3>Products</h3>`;
const P1_NEW = `<h3 id="prodSecTitle">Products</h3>`;

const P2_OLD = `  } else if (isService) {
    document.getElementById('navOrdersLbl').textContent    = 'Transactions';
    document.getElementById('navProductsLbl').textContent  = 'Services & Prices';
    document.getElementById('navInventoryLbl').textContent = isTrueService ? 'My Services' : 'Supplies';
    if (document.getElementById('qaInvLbl')) document.getElementById('qaInvLbl').textContent = isTrueService ? 'My Services' : 'Supplies';
    if (isTrueService) {
      if (document.getElementById('invSecTitle')) document.getElementById('invSecTitle').firstChild.textContent = 'My Services ';
      if (document.getElementById('invSecSub'))   document.getElementById('invSecSub').textContent = '(used for your services)';
      SECTION_TITLES.inventory = 'My Services';
      if (document.getElementById('topbarTitle') && document.getElementById('topbarTitle').textContent === 'Inventory')
        document.getElementById('topbarTitle').textContent = 'My Services';
    }
  } else {`;
const P2_NEW = `  } else if (isService) {
    document.getElementById('navOrdersLbl').textContent    = 'Transactions';
    document.getElementById('navProductsLbl').textContent  = isTrueService ? 'My Services' : 'Services & Prices';
    document.getElementById('navInventoryLbl').textContent = 'Supplies';
    if (document.getElementById('qaInvLbl')) document.getElementById('qaInvLbl').textContent = 'Supplies';
    if (document.getElementById('prodSecTitle')) document.getElementById('prodSecTitle').textContent = isTrueService ? 'My Services' : 'Services & Prices';
    if (isTrueService) {
      if (document.getElementById('invSecTitle')) document.getElementById('invSecTitle').firstChild.textContent = 'Supplies ';
      if (document.getElementById('invSecSub'))   document.getElementById('invSecSub').textContent = '(used for your services)';
      SECTION_TITLES.inventory = 'Supplies';
      if (document.getElementById('topbarTitle') && document.getElementById('topbarTitle').textContent === 'Inventory')
        document.getElementById('topbarTitle').textContent = 'Supplies';
    }
  } else {`;

const PATCHES = [
  ['P1-prodSecTitle-id', P1_OLD, P1_NEW],
  ['P2-label-swap', P2_OLD, P2_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes(`document.getElementById('prodSecTitle')`)) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
