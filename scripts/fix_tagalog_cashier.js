// fix_tagalog_cashier.js
// Translates the cash remittance modal Tagalog text to English across all cashier files
// Run: node scripts/fix_tagalog_cashier.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f))
  .sort();

const PATCHES = [
  ['Bilangin ang pera sa kahon bago mag-logout.', 'Count the cash in the drawer before logging out.'],
  ['Cash on Hand (ilan ang pera sa kahon?)', 'Cash on Hand (how much is in the drawer?)'],
  ['Tama ba ang halaga? I-confirm bago mag-logout.', 'Is the amount correct? Confirm before logging out.'],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (!c.includes('Bilangin ang pera')) { skipped++; continue; }

  const fileErrs = [];
  for (const [oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(oldStr); continue; }
    c = c.replace(oldStr, newStr);
  }
  if (fileErrs.length) errors[file] = fileErrs;

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(fileErrs.length ? `⚠  ${file}: missing ${fileErrs.length}` : `✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} patched, ${skipped} skipped (no Tagalog found).`);
if (Object.keys(errors).length) {
  console.log('\nFiles with missing anchors:');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(' | ')}`);
}
