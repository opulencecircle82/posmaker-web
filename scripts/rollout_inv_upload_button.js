// rollout_inv_upload_button.js
// "Upload from File" for the Add Inventory Item photo was hidden for every
// business type except TRUE_SERVICE_BIZ (only "Scan QR to Upload" showed for
// retail/inventory-tracking types) — leaving no way to add a photo without a
// phone to scan with. Makes the upload button always visible (Scan QR stays
// hidden for service types, which have no barcodes to scan, unchanged).
// Run: node scripts/rollout_inv_upload_button.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const P1_OLD = `<button type="button" class="btn btn-ghost btn-sm" style="flex:0 0 auto;display:none" id="btnInvUpload" onclick="document.getElementById('invImgInput').click()">&#128193; Upload Service Image</button>`;
const P1_NEW = `<button type="button" class="btn btn-ghost btn-sm" style="flex:0 0 auto" id="btnInvUpload" onclick="document.getElementById('invImgInput').click()">&#128193; Upload from File</button>`;

const P2_OLD = `  document.getElementById('btnInvUpload').style.display = isServiceBiz ? '' : 'none';`;
const P2_NEW = `  document.getElementById('btnInvUpload').style.display = '';`;

const PATCHES = [
  ['P1-button-label', P1_OLD, P1_NEW],
  ['P2-always-show',  P2_OLD, P2_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('Upload from File')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
