// add_expiry_fixup2.js — fix pluralization bug in expiry notification
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html').sort();

const OLD = "' item'+('+_expiredCount>1?'s':'')+' EXPIRED";
const NEW = "' item'+(_expiredCount>1?'s':'')+' EXPIRED";

let fixed = 0;
for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');
  if (!c.includes(OLD)) { console.log(`— ${file}: already ok`); continue; }
  c = c.replace(OLD, NEW);
  fs.writeFileSync(fp, hasCRLF ? c.replace(/\n/g,'\r\n') : c, 'utf-8');
  console.log(`✓  ${file}`);
  fixed++;
}
console.log(`\nFixed: ${fixed}`);
