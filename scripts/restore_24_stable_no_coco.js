// restore_24_stable_no_coco.js
// Restores the calibrated, production-stable detection state (barcode + hash-
// matching + OCR, all properly calibrated with blank-frame protection and
// multi-frame confirmation) to all cashier files EXCEPT cashier-sarisari.html,
// which is the dedicated test store for the experimental COCO-SSD multi-
// object detector. These 24 files get hash-matching back but WITHOUT the
// COCO-SSD trigger (that stays sarisari-only for now).
// Run: node scripts/restore_24_stable_no_coco.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f) && f !== 'cashier-sarisari.html')
  .sort();

// ── P1: main scanner — restore startVisualLoop, drop Python vision (dormant anyway) ──
const P1_OLD = `startBcLoop(v); startTextLoop(v); /* visual matching + Python vision disabled — barcode+OCR only */`;
const P1_NEW = `startBcLoop(v); startTextLoop(v); startVisualLoop(v);`;

// ── P2: square scanner — restore _startSqVisualLoop, drop Python vision ───
const P2_OLD =
`    sqLoop();
    _startSqTextLoop(sv, sess);
    /* _startSqVisualLoop + _startSqPyLoop disabled — barcode+OCR only */`;
const P2_NEW =
`    sqLoop();
    _startSqTextLoop(sv, sess);
    _startSqVisualLoop(sv, sess);`;

// ── P3: restore the buildImgHashes retry triggers ──────────────────────────
const P3_OLD = `  // Visual-loop retry triggers disabled — barcode+OCR only`;
const P3_NEW =
`  if(scannerOpen && !_visLoopId){
    const v=document.getElementById('camVideo');
    if(v && v.videoWidth>0) startVisualLoop(v);
  }
  // If square scanner is open, start its visual loop now that hashes are ready
  if(_sqOpen && !_sqVisLoopId){
    const sv=document.getElementById('sqVideo');
    if(sv && sv.videoWidth>0) _startSqVisualLoop(sv, _sqSess);
  }`;

// ── P4: remove the COCO-SSD trigger from THESE 24 files' startVisualLoop ──
// (keeps hash-matching active, but COCO-SSD stays sarisari-only for now)
const P4_OLD = `  _loadCocoModel(); // fire-and-forget; loop upgrades automatically once ready`;
const P4_NEW = `  // _loadCocoModel(); // COCO-SSD experimentation scoped to Sari-Sari Store only for now`;

const PATCHES = [
  ['P1-main-scanner', P1_OLD, P1_NEW],
  ['P2-sq-scanner',   P2_OLD, P2_NEW],
  ['P3-retry',        P3_OLD, P3_NEW],
  ['P4-no-coco',      P4_OLD, P4_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('COCO-SSD experimentation scoped')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label); continue; }
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
