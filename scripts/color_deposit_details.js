// color_deposit_details.js — Neon green for amount, neon blue for note in Deposit activity log
// Run: node scripts/color_deposit_details.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const OLD =
  "        const filtered = Object.entries(d).filter(([k]) => k !== 'receipt_b64');\r\n" +
  "        details = filtered.map(([k,v]) => `${k}: ${v}`).join(', ');";

const NEW =
  "        const filtered = Object.entries(d).filter(([k]) => k !== 'receipt_b64');\r\n" +
  "        if (l.action === 'MGR_REMIT') {\r\n" +
  "          details = filtered.map(([k,v]) => {\r\n" +
  "            if (k === 'amount') return 'amount: <span style=\"color:#39ff14;font-weight:700\">₱' + parseFloat(v).toFixed(2) + '</span>';\r\n" +
  "            if (k === 'note')   return '<span style=\"color:#00e5ff;font-weight:700\">' + v + '</span>';\r\n" +
  "            return k + ': ' + v;\r\n" +
  "          }).join(' &bull; ');\r\n" +
  "        } else {\r\n" +
  "          details = filtered.map(([k,v]) => `${k}: ${v}`).join(', ');\r\n" +
  "        }";

let patched = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  let c = fs.readFileSync(fp, 'utf-8');

  if (!c.includes(OLD)) {
    // Already patched or different line endings — try LF variant
    const OLD_LF = OLD.replace(/\r\n/g, '\n');
    if (!c.includes(OLD_LF)) { console.log(`⚠  ${file}: anchor not found`); errors++; continue; }
    c = c.replace(OLD_LF, NEW.replace(/\r\n/g, '\n'));
  } else {
    c = c.replace(OLD, NEW);
  }

  fs.writeFileSync(fp, c, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} patched, ${errors} issues.`);
