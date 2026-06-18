// disable_tensorflow.js
// Disables TensorFlow.js usage for now (both the MobileNet AI matcher and the
// COCO-SSD multi-object detector) by removing their two trigger points. The
// underlying function definitions are left intact (easy to re-enable later)
// — they just never get called, so TensorFlow.js itself never downloads.
// Barcode scanning, hash-based visual matching, and OCR/text detection are
// all TF-independent and remain fully active.
// Run: node scripts/disable_tensorflow.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f))
  .sort();

// ── Disable MobileNet AI loader trigger ───────────────────────────────────
const A_OLD =
`  // Load MobileNet whenever products have images (no pre-computed embeddings needed)
  if(!_mnModel && prods.some(p => p.image_b64)){
    _loadMnModel().then(ok => {
      if(!ok) return;
      buildAiEmbeds().then(() => {
        const v = document.getElementById('camVideo');
        if(scannerOpen && v) { startAiLoop(v); camStat(_scanModes()); }
      });
    });
  }`;
const A_NEW =
`  // TensorFlow/MobileNet AI matching disabled for now — relying on barcode +
  // hash-based visual matching + OCR instead. _loadMnModel() is still defined
  // below if this needs to be re-enabled later.`;

// ── Disable COCO-SSD loader trigger ────────────────────────────────────────
const B_OLD =
`  _loadCocoModel(); // fire-and-forget; loop upgrades automatically once ready`;
const B_NEW =
`  // _loadCocoModel(); // TensorFlow/COCO-SSD multi-object detection disabled for now`;

const PATCHES = [
  ['A-mobilenet-trigger', A_OLD, A_NEW],
  ['B-coco-trigger',      B_OLD, B_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('TensorFlow/MobileNet AI matching disabled')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
