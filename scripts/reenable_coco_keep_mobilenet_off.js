// reenable_coco_keep_mobilenet_off.js
// User wants COCO-SSD (multi-object detector) active, but the legacy
// MobileNet AI embeddings matcher stays disabled. Both depend on TensorFlow.js
// as the underlying engine (can't avoid loading tf.js itself), but only the
// COCO-SSD trigger gets re-enabled here.
// Run: node scripts/reenable_coco_keep_mobilenet_off.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f))
  .sort();

const OLD = `  // _loadCocoModel(); // TensorFlow/COCO-SSD multi-object detection disabled for now`;
const NEW = `  _loadCocoModel(); // fire-and-forget; loop upgrades automatically once ready`;

let patched = 0, skipped = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes("_loadCocoModel(); // fire-and-forget")) { console.log(`—  ${file}: already re-enabled`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); errors++; continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped, ${errors} errors.`);
