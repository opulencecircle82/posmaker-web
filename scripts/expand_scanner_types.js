// expand_scanner_types.js
// Change scanner gate from SCANNER_TYPES whitelist → all retail (IS_RETAIL) stores
// Barcode loop already runs; this just unhides the camera for more store types.
// Run: node scripts/expand_scanner_types.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f))
  .sort();

const OLD = `const SCANNER_TYPES = new Set(['Sari-Sari Store','Drug Store']);`;
const NEW = `const SCANNER_TYPES = new Set(['Sari-Sari Store','Drug Store']); // kept for reference
// All retail (non-restaurant) stores now get the barcode + visual scanner`;

const OLD_GATE = `  const showScanner = SCANNER_TYPES.has(bizType);`;
const NEW_GATE  = `  const showScanner = IS_RETAIL; // all retail stores: barcode first, visual AI fallback`;

let patched = 0, skipped = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (!c.includes('SCANNER_TYPES')) { console.log(`— ${file}: no SCANNER_TYPES, skipping`); skipped++; continue; }
  if (c.includes('all retail stores: barcode first')) { console.log(`— ${file}: already patched`); skipped++; continue; }

  const issues = [];
  if (c.includes(OLD_GATE)) { c = c.replace(OLD_GATE, NEW_GATE); } else { issues.push('gate'); }

  if (issues.length) {
    console.log(`⚠  ${file}: ${issues.join(', ')}`);
    errors++;
  } else {
    const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
    fs.writeFileSync(fp, out, 'utf-8');
    console.log(`✓  ${file}`);
    patched++;
  }
}

console.log(`\nDone: ${patched} patched, ${skipped} skipped, ${errors} errors.`);
