// barcode_ocr_only.js
// User wants ONLY barcode + OCR/text detection active in the POS camera —
// disables both visual-matching systems (hash-based startVisualLoop, which
// also contains the COCO-SSD trigger, and the square scanner's equivalent)
// plus the dormant Python vision loop triggers (harmless no-ops since
// VISION_URL is empty, but removed for cleanliness/consistency).
// Functions are left defined (not deleted) — easy to re-enable later by
// restoring the trigger calls.
// Run: node scripts/barcode_ocr_only.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f))
  .sort();

// ── P1: main scanner — drop startVisualLoop + _startPyLoop, keep barcode+text (3x identical) ──
const P1_OLD = `startBcLoop(v); startTextLoop(v); startVisualLoop(v); _startPyLoop(v, _scanSession);`;
const P1_NEW = `startBcLoop(v); startTextLoop(v); /* visual matching + Python vision disabled — barcode+OCR only */`;

// ── P2: square scanner — drop _startSqVisualLoop + _startSqPyLoop ─────────
const P2_OLD =
`    sqLoop();
    _startSqTextLoop(sv, sess);
    _startSqVisualLoop(sv, sess);
    _startSqPyLoop(sv, sess);`;
const P2_NEW =
`    sqLoop();
    _startSqTextLoop(sv, sess);
    /* _startSqVisualLoop + _startSqPyLoop disabled — barcode+OCR only */`;

// ── P3: buildImgHashes retry-trigger for main scanner visual loop ─────────
const P3_OLD =
`  if(scannerOpen && !_visLoopId){
    const v=document.getElementById('camVideo');
    if(v && v.videoWidth>0) startVisualLoop(v);
  }
  // If square scanner is open, start its visual loop now that hashes are ready
  if(_sqOpen && !_sqVisLoopId){
    const sv=document.getElementById('sqVideo');
    if(sv && sv.videoWidth>0) _startSqVisualLoop(sv, _sqSess);
  }`;
const P3_NEW =
`  // Visual-loop retry triggers disabled — barcode+OCR only`;

const PATCHES = [
  ['P1-main-scanner', P1_OLD, P1_NEW],
  ['P2-sq-scanner',   P2_OLD, P2_NEW],
  ['P3-retry',        P3_OLD, P3_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('barcode+OCR only')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label); continue; }
    // P1 occurs multiple times identically — replace all occurrences
    if (label === 'P1-main-scanner') {
      c = c.split(oldStr).join(newStr);
    } else {
      c = c.replace(oldStr, newStr);
    }
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
