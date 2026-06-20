// rollout_neon_watermark.js
// The date/time watermark on photo proofs was plain white text on a dark
// strip — easy to miss in a busy photo. Switches it to a glowing neon-green
// style (double-drawn with a canvas shadow blur) so the date is unmistakable.
// Applies everywhere addTimestampWatermark() is defined (24 dashboards +
// manager.html) since they're all byte-identical copies of the same helper.
// Run: node scripts/rollout_neon_watermark.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /\.html$/.test(f))
  .sort();

const OLD = `  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, tw, th);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(ts, x + pad, y + pad + fs * 0.85);
}`;
const NEW = `  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, tw, th);
  ctx.shadowColor = '#39ff14';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#39ff14';
  ctx.fillText(ts, x + pad, y + pad + fs * 0.85);
  ctx.fillText(ts, x + pad, y + pad + fs * 0.85);
  ctx.shadowBlur = 0;
}`;

let patched = 0, skipped = 0;
const errors = [];

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  if (!raw.includes('function addTimestampWatermark')) continue;
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes("ctx.shadowColor = '#39ff14';")) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); errors.push(file); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (errors.length) console.log('Anchor not found in: ' + errors.join(', '));
