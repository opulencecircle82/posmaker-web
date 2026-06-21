// rollout_no_backdrop_mqty.js
// Same treatment mConfirm already got (see rollout_no_backdrop_mconfirm.js):
// the "Enter Quantity" modal (mQty, used for weight/volume-priced items)
// used the shared .modal class, which darkens the whole screen behind it
// (rgba(0,0,0,.88) full-screen backdrop). Converts it to a floating widget
// (no backdrop, centered via fixed position) across all 24 cashier-*.html.
// Run: node scripts/rollout_no_backdrop_mqty.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier-.*\.html$/.test(f))
  .sort();

const P1_OLD = `<div class="modal" id="mQty">
  <div class="mbox" style="width:min(300px,96vw)">`;
const P1_NEW = `<div id="mQty" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:500">
  <div class="mbox" style="width:min(300px,96vw);box-shadow:0 10px 40px rgba(0,0,0,.7)">`;

const P2_OLD = `document.getElementById('mQty').classList.add('show');`;
const P2_NEW = `document.getElementById('mQty').style.display = 'block';`;

const P3_OLD = `closeM('mQty')`;
const P3_NEW = `document.getElementById('mQty').style.display='none'`;

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes(`id="mQty" style="display:none;position:fixed`)) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  if (!c.includes(P1_OLD)) fileErrs.push('P1-wrapper');
  if (!c.includes(P2_OLD)) fileErrs.push('P2-show');
  if (!c.includes(P3_OLD)) fileErrs.push('P3-hide');
  if (fileErrs.length) { errors[file] = fileErrs; console.log(`⚠  ${file}: missing ${fileErrs.join(', ')}`); continue; }

  c = c.replace(P1_OLD, P1_NEW);
  c = c.replace(P2_OLD, P2_NEW);
  c = c.split(P3_OLD).join(P3_NEW); // replace all occurrences (Cancel button + confirmQty())

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
