// add_coco_status_feedback.js
// _loadCocoModel() had a silent try/catch — no way to confirm if COCO-SSD
// actually loaded or failed. Adds console logging + a camStat status message
// so loading state is visible (open browser console with F12 to verify, or
// watch the scanner status text right after opening the camera).
// Run: node scripts/add_coco_status_feedback.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f))
  .sort();

const OLD =
`async function _loadCocoModel(){
  if(_cocoModel || _cocoLoading) return;
  _cocoLoading = true;
  try{
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
    _cocoModel = await cocoSsd.load({base:'lite_mobilenet_v2'});
  }catch(_){ /* stays null — loop keeps using whole-frame fallback */ }
  _cocoLoading = false;
}`;
const NEW =
`async function _loadCocoModel(){
  if(_cocoModel || _cocoLoading) return;
  _cocoLoading = true;
  console.log('[POSMaker] Loading multi-object detector (COCO-SSD)…');
  if(scannerOpen) camStat('&#127919; Loading multi-object detector…');
  try{
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
    _cocoModel = await cocoSsd.load({base:'lite_mobilenet_v2'});
    console.log('[POSMaker] COCO-SSD loaded successfully — multi-object detection active.');
    if(scannerOpen) camStat('&#9989; Multi-object detector ready');
  }catch(e){
    console.warn('[POSMaker] COCO-SSD failed to load — falling back to single-item mode.', e);
    if(scannerOpen) camStat('&#9888; Multi-object detector unavailable — single-item mode');
  }
  _cocoLoading = false;
}`;

let patched = 0, skipped = 0;
const errors = [];

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('Loading multi-object detector (COCO-SSD)')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); errors.push(file); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped, ${errors.length} no-anchor.`);
