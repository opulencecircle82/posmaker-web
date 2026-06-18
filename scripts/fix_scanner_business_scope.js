// fix_scanner_business_scope.js
// The camera scanner was meant to only appear for stores selling scannable
// packaged items (per the SCANNER_TYPES set + its own comment), but the actual
// gate used IS_RETAIL = !isRestaurant — which is true for EVERY non-restaurant
// business (Hardware, Electronics, Clothing, Furniture, Auto Parts, School
// Supplies, Pet Store, Bigasan...), not just the intended few. SCANNER_TYPES
// was defined but never actually referenced anywhere — dead code.
//
// Fix: add 'Agri Supply' to SCANNER_TYPES (confirmed scope: Sari-Sari Store,
// Drug Store, Agri Supply) and wire showScanner to SCANNER_TYPES.has(bizType)
// instead of IS_RETAIL. IS_RETAIL itself is untouched — it still correctly
// controls the general retail layout (compact list vs restaurant photo grid)
// for all non-restaurant business types.
// Run: node scripts/fix_scanner_business_scope.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f))
  .sort();

const P1_OLD =
`// Business types that sell barcoded/packaged items — only these get the camera/product scanner
const SCANNER_TYPES = new Set(['Sari-Sari Store','Drug Store']);`;
const P1_NEW =
`// Business types that sell barcoded/packaged items — only these get the camera/product scanner
const SCANNER_TYPES = new Set(['Sari-Sari Store','Drug Store','Agri Supply']);`;

const P2_OLD =
`  const overlay = document.getElementById('camOverlay');
  const btnCam  = document.getElementById('btnCam');
  const showScanner = IS_RETAIL; // all retail stores: barcode first, visual AI fallback
  SHOW_SCANNER = showScanner;`;
const P2_NEW =
`  const overlay = document.getElementById('camOverlay');
  const btnCam  = document.getElementById('btnCam');
  const showScanner = SCANNER_TYPES.has(bizType); // only stores that sell scannable packaged items
  SHOW_SCANNER = showScanner;`;

const PATCHES = [
  ['P1-scanner-types', P1_OLD, P1_NEW],
  ['P2-show-scanner',  P2_OLD, P2_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes("SCANNER_TYPES.has(bizType)")) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
