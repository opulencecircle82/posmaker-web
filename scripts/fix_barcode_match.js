// fix_barcode_match.js
// Improve handleBarcode: case-insensitive + trimmed SKU match, vibrate on no-match too
// Run: node scripts/fix_barcode_match.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f))
  .sort();

const OLD = `function handleBarcode(code){
  if(!code) return;
  const p = prods.find(x=>x.sku && x.sku===code);
  if(!p){ camStat('Barcode <strong>'+code+'</strong> — no match'); return; }
  if(isOnCooldown(p.id)) return;
  setCooldown(p.id); addItem(p.id);
  if(navigator.vibrate) navigator.vibrate(50);
  flashMatch(p.name,'&#127380; barcode');
}`;

const NEW = `function handleBarcode(code){
  if(!code) return;
  const norm = code.trim().toLowerCase();
  const p = prods.find(x=>x.sku && (x.sku===code || x.sku.trim().toLowerCase()===norm));
  if(!p){ camStat('&#127380; <strong>'+code+'</strong> — no product found'); return; }
  if(isOnCooldown(p.id)) return;
  setCooldown(p.id); addItem(p.id);
  if(navigator.vibrate) navigator.vibrate([30,20,30]);
  flashMatch(p.name,'&#127380; barcode');
}`;

let patched = 0, skipped = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (!c.includes('handleBarcode')) { skipped++; continue; }
  if (c.includes("norm = code.trim()")) { console.log(`— ${file}: already patched`); skipped++; continue; }

  if (c.includes(OLD)) {
    c = c.replace(OLD, NEW);
    const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
    fs.writeFileSync(fp, out, 'utf-8');
    console.log(`✓  ${file}`);
    patched++;
  } else {
    console.log(`⚠  ${file}: anchor not found`);
    errors++;
  }
}

console.log(`\nDone: ${patched} patched, ${skipped} skipped, ${errors} errors.`);
