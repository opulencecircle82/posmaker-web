// refresh_badge_after_hashes.js
// buildImgHashes() never refreshed the camera status badge (_scanModes()) after
// finishing — so the badge could stay stuck on stale text ("barcode + OCR")
// even after hash-matching successfully populated _prodHashes. Adds a
// camStat(_scanModes()) call so the badge updates to show "visual(N)" once
// ready, giving a clear, immediate signal that hash-matching is active.
// Run: node scripts/refresh_badge_after_hashes.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f))
  .sort();

const OLD =
`  if(scannerOpen && !_visLoopId){
    const v=document.getElementById('camVideo');
    if(v && v.videoWidth>0) startVisualLoop(v);
  }
  // If square scanner is open, start its visual loop now that hashes are ready
  if(_sqOpen && !_sqVisLoopId){
    const sv=document.getElementById('sqVideo');
    if(sv && sv.videoWidth>0) _startSqVisualLoop(sv, _sqSess);
  }
  sqStatusUpdate();
}`;
const NEW =
`  if(scannerOpen && !_visLoopId){
    const v=document.getElementById('camVideo');
    if(v && v.videoWidth>0) startVisualLoop(v);
  }
  // If square scanner is open, start its visual loop now that hashes are ready
  if(_sqOpen && !_sqVisLoopId){
    const sv=document.getElementById('sqVideo');
    if(sv && sv.videoWidth>0) _startSqVisualLoop(sv, _sqSess);
  }
  if(scannerOpen) camStat(_scanModes()); // refresh badge so "visual(N)" shows once hashes are ready
  sqStatusUpdate();
}`;

let patched = 0, skipped = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('refresh badge so "visual')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); errors++; continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped, ${errors} errors.`);
