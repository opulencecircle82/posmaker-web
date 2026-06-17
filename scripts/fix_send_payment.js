// fix_send_payment.js — Fix two issues in all 25 dashboard send-payment patches:
// 1. Broken mbody string (\n became literal newlines → SyntaxError)
// 2. Send button shown for all roles → restrict to manager only
// Run: node scripts/fix_send_payment.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── Patch 1: Fix broken mbody (multi-line string → single-line) ─────────────
// The broken code spans multiple lines in the file. Use regex to match it.
// The pattern: "const mbody='PAYMENT_REF:'+crId+'" then newline then "₱'+..." until end of statement
const MBODY_FIXED =
  "  var _nl=String.fromCharCode(10);const mbody='PAYMENT_REF:'+crId+_nl+'\\u20b1'+amt.toFixed(2)+' mula sa may-ari'+(note?' \\u2014 '+note:'')+_nl+(rcpt?_nl+'May kasamang resibo ng transfer.'+_nl:'')+_nl+'I-tap ang Confirm kapag natanggap mo na.';";

// ── Patch 2: Gate Send button to manager only ───────────────────────────────
const OLD_BTN =
  "        <button class=\"btn btn-sm\" style=\"background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3)\" onclick=\"openSendPayModal('${s.id}')\">&#128176; Send</button>";
const NEW_BTN =
  "        \${s.role==='manager'?`<button class=\"btn btn-sm\" style=\"background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3)\" onclick=\"openSendPayModal('\${s.id}')\">&#128176; Send</button>` : ''}";

let fixed = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  let c = fs.readFileSync(fp, 'utf-8');

  if (!c.includes('sendPayModal')) {
    console.log(`— ${file}: no send payment patch, skipping`);
    continue;
  }

  const issues = [];

  // Patch 1 — Fix the broken mbody using regex (matches across newlines)
  if (c.includes("var _nl=String.fromCharCode")) {
    // Already fixed
  } else {
    const mbodyRx = /  const mbody='PAYMENT_REF:'\+crId\+'[\s\S]+?I-tap ang Confirm kapag natanggap mo na\.';/;
    if (mbodyRx.test(c)) {
      c = c.replace(mbodyRx, MBODY_FIXED);
    } else {
      issues.push('p1-mbody regex no match');
    }
  }

  // Patch 2 — Gate to manager only
  // Check specifically for the Send button with openSendPayModal in a gated context
  const alreadyGated = /s\.role===.manager.\?[`']<button[^>]+openSendPayModal/.test(c);
  if (alreadyGated) {
    // Already gated
  } else if (c.includes(OLD_BTN)) {
    c = c.replace(OLD_BTN, NEW_BTN);
  } else {
    issues.push('p2-btn anchor missing');
  }

  if (issues.length) {
    console.log(`⚠  ${file}: ${issues.join(', ')}`);
    errors++;
  } else {
    fs.writeFileSync(fp, c, 'utf-8');
    console.log(`✓  ${file}`);
    fixed++;
  }
}

console.log(`\nDone: ${fixed} fixed, ${errors} issues.`);
