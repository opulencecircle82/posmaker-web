// add_sold_by_weight_dashboard.js
// Adds "Sold by weight (price per kilo)" option to Add Product, scoped to
// Lechon + Bigasan only (meat/rice sold by weight is specific to these).
// Run: node scripts/add_sold_by_weight_dashboard.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = ['dashboard-lechon.html', 'dashboard-bigasan.html'];

// ── P1: HTML checkbox before Selling Price field ───────────────────────────
const P1_OLD = `<div class="field"><label>Selling Price</label><input id="pPrice" type="number" min="0" step="0.01" placeholder="0.00" oninput="updateProfitPreview()"></div>`;
const P1_NEW =
`<div class="field" style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <label style="margin:0;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:400">
        <input type="checkbox" id="pSoldByWeight" onchange="toggleSoldByWeight()" style="width:auto;margin:0">
        Sold by weight (customer picks grams/kilos at POS)
      </label>
    </div>
    <div class="field"><label id="pPriceLbl">Selling Price</label><input id="pPrice" type="number" min="0" step="0.01" placeholder="0.00" oninput="updateProfitPreview()"></div>`;

// ── P2: load sold_by_weight when opening modal ─────────────────────────────
const P2_OLD = `  document.getElementById('pPrice').value=p?p.price:'';`;
const P2_NEW =
`  document.getElementById('pPrice').value=p?p.price:'';
  document.getElementById('pSoldByWeight').checked=p?!!p.sold_by_weight:false;
  toggleSoldByWeight();`;

// ── P3: toggleSoldByWeight() function — before updateProfitPreview ────────
const P3_OLD = `function updateProfitPreview(){`;
const P3_NEW =
`function toggleSoldByWeight(){
  const on=document.getElementById('pSoldByWeight').checked;
  document.getElementById('pPriceLbl').textContent=on?'Price per Kilo':'Selling Price';
  document.getElementById('pPrice').placeholder=on?'e.g. 700.00 per kg':'0.00';
}
function updateProfitPreview(){`;

// ── P4: save payload includes sold_by_weight ───────────────────────────────
const P4_OLD = `const payload={name,sku,category:cat,unit,price,cost_price:costPrice,inv_links:JSON.stringify(pInvLinks),available:avail,...imgPayload};`;
const P4_NEW = `const payload={name,sku,category:cat,unit,price,cost_price:costPrice,inv_links:JSON.stringify(pInvLinks),available:avail,sold_by_weight:document.getElementById('pSoldByWeight').checked,...imgPayload};`;

const PATCHES = [
  ['P1-html', P1_OLD, P1_NEW],
  ['P2-load', P2_OLD, P2_NEW],
  ['P3-fn',   P3_OLD, P3_NEW],
  ['P4-save', P4_OLD, P4_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('toggleSoldByWeight')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label); continue; }
    c = c.replace(oldStr, newStr);
  }
  if (fileErrs.length) errors[file] = fileErrs;

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(fileErrs.length ? `⚠  ${file}: missing ${fileErrs.join(', ')}` : `✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (Object.keys(errors).length) {
  console.log('\nFiles with anchor errors:');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
