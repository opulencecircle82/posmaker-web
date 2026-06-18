// add_camera_capture_button.js
// On some Android phones/browsers, a plain <input type="file" accept="image/*">
// (no `capture` attribute) opens straight to the Files/Upload picker instead of
// offering a Camera choice — inconsistent native-picker behavior across devices.
// The app already has a proven fix for this elsewhere (Checklist Photo Proof in
// manager.html uses capture="environment" to force the camera open directly).
// This adds a dedicated "Take Photo" button (forces camera) next to the existing
// "Upload Photo" button (forces file/gallery picker) so both are explicit,
// guaranteed options on tablet/phone — leaving "Scan QR" untouched for the
// PC/laptop-with-no-or-bad-camera case.
// Touches: manager.html (Add Staff Salary/Expense photo proof) and all 24
// dashboard-*.html (owner's Send Payment receipt proof).
// Run: node scripts/add_camera_capture_button.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');

function patch(fp, label, patches, alreadyMarker) {
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');
  if (c.includes(alreadyMarker)) { console.log(`—  ${label}: already patched`); return; }

  const errs = [];
  for (const [name, oldStr, newStr] of patches) {
    if (!c.includes(oldStr)) { errs.push(name); continue; }
    c = c.replace(oldStr, newStr);
  }
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(errs.length ? `⚠  ${label}: missing ${errs.join(', ')}` : `✓  ${label}`);
}

// ── manager.html — Disburse (Add Staff Salary / Add Expense) photo proof ──
{
  const P1_OLD =
`      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <label class="btn btn-ghost" for="disbFile" style="flex:1;text-align:center;cursor:pointer;font-size:12px;margin-bottom:0">&#128247; Take / Choose Photo</label>
        <input id="disbFile" type="file" accept="image/*" style="display:none" onchange="handleDisburseFile(this)">
        <button type="button" class="btn btn-ghost btn-sm" onclick="openDisburseQR()" style="white-space:nowrap;font-size:12px">&#128248; Scan QR</button>
      </div>`;
  const P1_NEW =
`      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <label class="btn btn-ghost" for="disbFileCam" style="flex:1;text-align:center;cursor:pointer;font-size:12px;margin-bottom:0">&#128247; Take Photo</label>
        <input id="disbFileCam" type="file" accept="image/*" capture="environment" style="display:none" onchange="handleDisburseFile(this)">
        <label class="btn btn-ghost" for="disbFile" style="flex:1;text-align:center;cursor:pointer;font-size:12px;margin-bottom:0">&#128193; Upload Photo</label>
        <input id="disbFile" type="file" accept="image/*" style="display:none" onchange="handleDisburseFile(this)">
        <button type="button" class="btn btn-ghost btn-sm" onclick="openDisburseQR()" style="white-space:nowrap;font-size:12px">&#128248; Scan QR</button>
      </div>`;

  const P2_OLD = `  document.getElementById('disbFile').value = '';`;
  const P2_NEW = `  document.getElementById('disbFile').value = '';\n  document.getElementById('disbFileCam').value = '';`;

  patch(path.join(dir, 'manager.html'), 'manager.html', [
    ['disburse-buttons', P1_OLD, P1_NEW],
    ['disburse-reset', P2_OLD, P2_NEW],
  ], 'disbFileCam');
}

// ── dashboard-*.html — Send Payment receipt proof ──────────────────────────
{
  const P1_OLD =
`        <input id="spFile" type="file" accept="image/*" onchange="previewSendPayFile()" style="font-size:12px;padding:8px;flex:1;min-width:0">
        <button type="button" class="btn btn-ghost btn-sm" onclick="openSendPayQR()" style="white-space:nowrap;font-size:12px">&#128247; Scan QR</button>`;
  const P1_NEW =
`        <label class="btn btn-ghost btn-sm" for="spFileCam" style="cursor:pointer;font-size:12px;margin-bottom:0">&#128247; Take Photo</label>
        <input id="spFileCam" type="file" accept="image/*" capture="environment" onchange="previewSendPayFile(this)" style="display:none">
        <label class="btn btn-ghost btn-sm" for="spFile" style="cursor:pointer;font-size:12px;margin-bottom:0">&#128193; Upload Photo</label>
        <input id="spFile" type="file" accept="image/*" onchange="previewSendPayFile(this)" style="display:none">
        <button type="button" class="btn btn-ghost btn-sm" onclick="openSendPayQR()" style="white-space:nowrap;font-size:12px">&#128247; Scan QR</button>`;

  const P2_OLD = `function previewSendPayFile(){\n  const file=document.getElementById('spFile').files[0];`;
  const P2_NEW = `function previewSendPayFile(input){\n  const file=input.files[0];`;

  const P3_OLD = `  document.getElementById('spFile').value='';`;
  const P3_NEW = `  document.getElementById('spFile').value='';\n  document.getElementById('spFileCam').value='';`;

  const files = fs.readdirSync(dir)
    .filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html')
    .sort();
  for (const f of files) {
    patch(path.join(dir, f), f, [
      ['sendpay-buttons', P1_OLD, P1_NEW],
      ['previewSendPayFile-sig', P2_OLD, P2_NEW],
      ['sendpay-reset', P3_OLD, P3_NEW],
    ], 'spFileCam');
  }
}
