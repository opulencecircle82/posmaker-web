// fix_send_activity_crid.js — Add cr_id to OWNER_SEND activity_log details so inbox can find the receipt
// Run: node scripts/fix_send_activity_crid.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const OLD = "details:JSON.stringify(Object.assign({amount:amt},note?{note}:{},rcpt?{receipt_b64:rcpt}:{}))";
const NEW = "details:JSON.stringify(Object.assign({amount:amt,cr_id:crId},note?{note}:{},rcpt?{receipt_b64:rcpt}:{}))";

let patched = 0, skipped = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  let c = fs.readFileSync(fp, 'utf-8');

  if (!c.includes('OWNER_SEND')) { console.log(`— ${file}: no OWNER_SEND, skipping`); skipped++; continue; }
  if (c.includes('cr_id:crId') && c.includes('OWNER_SEND')) { console.log(`— ${file}: already patched`); skipped++; continue; }

  if (c.includes(OLD)) {
    c = c.replace(OLD, NEW);
    fs.writeFileSync(fp, c, 'utf-8');
    console.log(`✓  ${file}`);
    patched++;
  } else {
    console.log(`⚠  ${file}: anchor not found`);
    errors++;
  }
}

console.log(`\nDone: ${patched} patched, ${skipped} skipped, ${errors} errors.`);
