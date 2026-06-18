// fix_sold_by_weight_select.js
// The product fetch queries use an explicit column list that didn't include
// sold_by_weight — even with the column existing in the DB and saved on the
// product, the cashier never received it, so addItem() never knew to open
// the weight popup. Add sold_by_weight to both fetch queries.
// Run: node scripts/fix_sold_by_weight_select.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = ['cashier-lechon.html', 'cashier-bigasan.html'];

const OLD = `id,name,price,category,image_b64,sku,unit,stock,inv_links,embeddings`;
const NEW = `id,name,price,category,image_b64,sku,unit,stock,inv_links,embeddings,sold_by_weight`;

let patched = 0, skipped = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('embeddings,sold_by_weight')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); continue; }

  c = c.split(OLD).join(NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
