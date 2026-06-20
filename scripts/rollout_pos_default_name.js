// rollout_pos_default_name.js
// "Add POS Terminal" modal pre-filled the name as "<StoreName> #<n>" (e.g.
// "Ricemodira #2"), which didn't match the "POS #<n> — <StoreName>" format
// already used everywhere terminals are listed (e.g. "POS #1 — Ricemodira").
// Makes the default match that convention.
// Run: node scripts/rollout_pos_default_name.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const OLD = `  const defaultName = (STORE ? STORE.name : 'My Store') + ' #' + (allStores.length + 1);`;
const NEW = `  const defaultName = 'POS #' + (allStores.length + 1) + ' — ' + (STORE ? STORE.name : 'My Store');`;

let patched = 0, skipped = 0;
const errors = [];

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes(NEW)) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); errors.push(file); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (errors.length) console.log('Anchor not found in: ' + errors.join(', '));
