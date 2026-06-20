// rollout_no_backdrop_mconfirm.js
// The "Order Confirmed" receipt modal used the shared .modal class, which
// darkens the whole screen behind it (rgba(0,0,0,.88) full-screen backdrop).
// cashier-lechon.html already had this converted to a floating widget (no
// backdrop, centered via fixed position) per an earlier fix — this rolls the
// same change out to the other 23 cashier-*.html files.
// Run: node scripts/rollout_no_backdrop_mconfirm.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier-.*\.html$/.test(f))
  .sort();

const P1_OLD = `<div class="modal" id="mConfirm">
  <div class="mbox">`;
const P1_NEW = `<div id="mConfirm" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:500">
  <div class="mbox" style="box-shadow:0 10px 40px rgba(0,0,0,.7)">`;

const P2_OLD = `document.getElementById('mConfirm').classList.add('show');`;
const P2_NEW = `document.getElementById('mConfirm').style.display = 'block';`;

const P3_OLD = `closeM('mConfirm');`;
const P3_NEW = `document.getElementById('mConfirm').style.display = 'none';`;

const PATCHES = [
  ['P1-wrapper', P1_OLD, P1_NEW],
  ['P2-show',    P2_OLD, P2_NEW],
  ['P3-hide',    P3_OLD, P3_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes(`id="mConfirm" style="display:none;position:fixed`)) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label); continue; }
    c = c.replace(oldStr, newStr);
  }
  if (fileErrs.length) { errors[file] = fileErrs; console.log(`⚠  ${file}: missing ${fileErrs.join(', ')}`); continue; }

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (Object.keys(errors).length) {
  console.log('\nFiles with anchor errors (not modified):');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
