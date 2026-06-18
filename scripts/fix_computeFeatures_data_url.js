// fix_computeFeatures_data_url.js
// CRITICAL BUG FIX: _computeFeatures(src) set img.src=src directly, but
// image_b64 is stored as a BARE base64 string (no "data:image/jpeg;base64,"
// prefix — confirmed via _imgSrc() which explicitly prepends it for display).
// This meant every reference photo silently failed to load (img.onerror),
// so _prodHashes stayed permanently empty — visual hash-matching could NEVER
// work, regardless of any threshold calibration. buildAiEmbeds() (MobileNet
// path) already handled this correctly; _computeFeatures() did not.
// Run: node scripts/fix_computeFeatures_data_url.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f) && f !== 'cashier-sarisari.html')
  .sort();

const OLD =
`function _computeFeatures(src) {
  return new Promise(res => {
    const img=new Image();
    img.onload=()=>{
      try{ res(_featuresFromCanvas(img, img.naturalWidth, img.naturalHeight)); }
      catch{ res(null); }
    };
    img.onerror=()=>res(null);
    img.src=src;`;
const NEW =
`function _computeFeatures(src) {
  return new Promise(res => {
    const img=new Image();
    img.onload=()=>{
      try{ res(_featuresFromCanvas(img, img.naturalWidth, img.naturalHeight)); }
      catch{ res(null); }
    };
    img.onerror=()=>res(null);
    img.src=src.startsWith('data:')?src:'data:image/jpeg;base64,'+src;`;

let patched = 0, skipped = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes("src.startsWith('data:')?src:'data:image/jpeg;base64,'+src")) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); errors++; continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped, ${errors} errors.`);
