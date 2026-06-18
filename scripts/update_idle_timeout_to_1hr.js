// update_idle_timeout_to_1hr.js
// Changes the owner/manager idle auto-logout timer from 5 minutes to 1 hour.
// Run: node scripts/update_idle_timeout_to_1hr.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = [
  ...fs.readdirSync(dir).filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html'),
  'manager.html',
].sort();

const OLD = `  _idleTimer = setTimeout(() => { doLogout(); }, 5 * 60 * 1000);`;
const NEW = `  _idleTimer = setTimeout(() => { doLogout(); }, 60 * 60 * 1000);`;

let patched = 0, skipped = 0;
const errors = [];

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('60 * 60 * 1000); // idle logout')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (c.includes(NEW)) { console.log(`—  ${file}: already 1hr`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); errors.push(file); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (errors.length) console.log('Anchor not found in: ' + errors.join(', '));
