// rollout_font_scale.js
// Customize POS now has a Font Size Scale slider (pos_font_scale, 80-130%).
// Applies it on the cashier side via CSS zoom (Chromium/Electron/Android
// webview all support it, which covers every device this app targets) so
// the whole POS UI scales without needing to rewrite every hardcoded
// font-size in the CSS to relative units.
// Run: node scripts/rollout_font_scale.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier-.*\.html$/.test(f) && f !== 'cashier_backup.html')
  .sort();

const OLD = `  if (s.pos_radius)      r.style.setProperty('--radius', s.pos_radius + 'px');`;
const NEW = `  if (s.pos_radius)      r.style.setProperty('--radius', s.pos_radius + 'px');
  if (s.pos_font_scale)  document.body.style.zoom = s.pos_font_scale / 100;`;

let patched = 0, skipped = 0;
const errors = [];

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('pos_font_scale')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); errors.push(file); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (errors.length) console.log('Anchor not found in: ' + errors.join(', '));
