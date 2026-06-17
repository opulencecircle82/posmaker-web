// fix_mbody_english.js — Replace Tagalog text in saveSendPay() mbody with English
// Run: node scripts/fix_mbody_english.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const OLD = "  var _nl=String.fromCharCode(10);const mbody='PAYMENT_REF:'+crId+_nl+'\\u20b1'+amt.toFixed(2)+' mula sa may-ari'+(note?' \\u2014 '+note:'')+_nl+(rcpt?_nl+'May kasamang resibo ng transfer.'+_nl:'')+_nl+'I-tap ang Confirm kapag natanggap mo na.';";
const NEW = "  var _nl=String.fromCharCode(10);const mbody='PAYMENT_REF:'+crId+_nl+'\\u20b1'+amt.toFixed(2)+' from owner'+(note?' \\u2014 '+note:'')+_nl+(rcpt?_nl+'Bank transfer receipt attached.'+_nl:'')+_nl+'Tap Confirm once received.';";

let patched = 0, skipped = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  let c = fs.readFileSync(fp, 'utf-8');

  if (!c.includes('sendPayModal')) { skipped++; continue; }

  if (c.includes("' from owner'") && c.includes("'Tap Confirm once received.'")) {
    console.log(`— ${file}: already English`); skipped++; continue;
  }

  if (c.includes(OLD)) {
    c = c.replace(OLD, NEW);
    fs.writeFileSync(fp, c, 'utf-8');
    console.log(`✓  ${file}`);
    patched++;
  } else {
    // Try to match with regex in case of minor variations
    const rx = /var _nl=String\.fromCharCode\(10\);const mbody='PAYMENT_REF:'\+crId\+_nl\+'\\u20b1'\+amt\.toFixed\(2\)\+' mula sa may-ari'[\s\S]{0,200}?'I-tap ang Confirm kapag natanggap mo na\.';/;
    if (rx.test(c)) {
      c = c.replace(rx, NEW);
      fs.writeFileSync(fp, c, 'utf-8');
      console.log(`✓  ${file} (regex)`);
      patched++;
    } else {
      console.log(`⚠  ${file}: anchor not found`);
      errors++;
    }
  }
}

console.log(`\nDone: ${patched} patched, ${skipped} skipped, ${errors} errors.`);
