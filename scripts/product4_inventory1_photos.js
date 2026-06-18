// product4_inventory1_photos.js
// FINAL photo count design:
//   Product: 4 total photos = 1 main (shown in POS, always photo[0]) + 3 different angles (for visual recognition). Barcode auto-detected live, doesn't count as a photo slot.
//   Inventory items: just 1 photo (no recognition matching needed there).
// Run: node scripts/product4_inventory1_photos.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ════════════════════ PRODUCT: 5 → 4 (1 main + 3 angles) ════════════════════

const P1_OLD =
`      <label>Product Photos <span style="color:var(--dim);font-weight:400">(optional, up to 5)</span></label>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <button type="button" id="prodLiveCamBtn" class="btn btn-accent btn-sm" style="flex:1;font-size:12px" onclick="openDashCam('prodPhoto','pSku')">&#128247; Live Camera</button>
        <button type="button" id="prodCamBtn" class="btn btn-ghost btn-sm" style="flex:1;font-size:12px" onclick="openImgUploadQR('product',5)">&#128248; Scan QR</button>
        <button type="button" class="btn btn-ghost btn-sm" style="flex:1;font-size:12px" onclick="document.getElementById('prodImgInput').click()">&#128193; Upload</button>
      </div>
      <div id="prodImgThumbs" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px"></div>
      <div id="prodImgHint" style="color:var(--dim);font-size:12px;padding:4px 0">Up to 5 product photos. Live Camera also auto-detects the barcode.</div>`;
const P1_NEW =
`      <label>Product Photos <span style="color:var(--dim);font-weight:400">(optional, up to 4)</span></label>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <button type="button" id="prodLiveCamBtn" class="btn btn-accent btn-sm" style="flex:1;font-size:12px" onclick="openDashCam('prodPhoto','pSku')">&#128247; Live Camera</button>
        <button type="button" id="prodCamBtn" class="btn btn-ghost btn-sm" style="flex:1;font-size:12px" onclick="openImgUploadQR('product',4)">&#128248; Scan QR</button>
        <button type="button" class="btn btn-ghost btn-sm" style="flex:1;font-size:12px" onclick="document.getElementById('prodImgInput').click()">&#128193; Upload</button>
      </div>
      <div id="prodImgThumbs" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px"></div>
      <div id="prodImgHint" style="color:var(--dim);font-size:12px;padding:4px 0">1st photo = Main Photo (shown in POS). Next 3 = different angles for better recognition. Barcode auto-detected.</div>`;

const P2_OLD =
`  if(hint) hint.textContent = n>=5 ? '5/5 photos — max reached. Tap × on a thumbnail to remove.' : (n>0 ? n+'/5 photos. Live Camera also auto-detects the barcode.' : 'Up to 5 product photos. Live Camera also auto-detects the barcode.');
  if(liveCamBtn) liveCamBtn.style.display = n>=5?'none':'';
  if(btn) btn.style.display = n>=5?'none':'';`;
const P2_NEW =
`  if(hint) hint.textContent = n>=4 ? '4/4 photos — max reached. Tap × on a thumbnail to remove.' : (n===0 ? '1st photo = Main Photo (shown in POS). Next 3 = different angles for better recognition.' : n+'/4 photos. Photo 1 is the Main Photo shown in POS.');
  if(liveCamBtn) liveCamBtn.style.display = n>=4?'none':'';
  if(btn) btn.style.display = n>=4?'none':'';`;

const P3_OLD =
`  if(_prodPendingImgs.length>=5){showToast('Max 5 photos reached. Tap × on a thumbnail to remove.',true);return;}`;
const P3_NEW =
`  if(_prodPendingImgs.length>=4){showToast('Max 4 photos reached. Tap × on a thumbnail to remove.',true);return;}`;

const P4_OLD =
`      imgs.forEach(b=>{if(_prodPendingImgs.length<5)_prodPendingImgs.push(b);});`;
const P4_NEW =
`      imgs.forEach(b=>{if(_prodPendingImgs.length<4)_prodPendingImgs.push(b);});`;

const P5_OLD =
`    captureBtn.textContent = '📷 Capture ('+_prodPendingImgs.length+'/5)';
    bcBtn.style.display = 'none';
    document.querySelector('#dashCamModal h3').textContent = '📷 Product Photos';`;
const P5_NEW =
`    captureBtn.textContent = '📷 Capture ('+_prodPendingImgs.length+'/4)';
    bcBtn.style.display = 'none';
    document.querySelector('#dashCamModal h3').textContent = '📷 Product Photos';`;

const P6_OLD =
`  // product photo mode — multi-photo
  if(_prodPendingImgs.length>=5){ showToast('Max 5 photos. Tap × on a thumbnail to remove.',true); return; }
  _prodPendingImgs.push(b64);
  renderProdThumbs();
  if(_dashBarcode) document.getElementById('pSku').value=_dashBarcode;
  const np=_prodPendingImgs.length;
  const capBtn=document.getElementById('dashCamCapture');
  if(np>=5){ showToast('5 photos captured!'); if(capBtn) capBtn.textContent='✓ Done (5/5)'; closeDashCam(); }
  else{ if(capBtn) capBtn.textContent='📷 Capture ('+np+'/5)'; showToast('Photo '+np+'/5 captured! Move to next angle.'); }
}`;
const P6_NEW =
`  // product photo mode — multi-photo
  if(_prodPendingImgs.length>=4){ showToast('Max 4 photos. Tap × on a thumbnail to remove.',true); return; }
  _prodPendingImgs.push(b64);
  renderProdThumbs();
  if(_dashBarcode) document.getElementById('pSku').value=_dashBarcode;
  const np=_prodPendingImgs.length;
  const capBtn=document.getElementById('dashCamCapture');
  if(np>=4){ showToast('4 photos captured!'); if(capBtn) capBtn.textContent='✓ Done (4/4)'; closeDashCam(); }
  else{ if(capBtn) capBtn.textContent='📷 Capture ('+np+'/4)'; showToast('Photo '+np+'/4 captured! Move to next angle.'); }
}`;

// ════════════════════ INVENTORY: 4 → 1 photo ════════════════════

const I1_OLD =
`        <button type="button" class="btn btn-accent btn-sm" style="flex:0 0 auto" id="btnInvCam" onclick="openImgUploadQR('inventory',4)">&#128248; Scan QR to Upload</button>
        <button type="button" class="btn btn-ghost btn-sm" style="flex:0 0 auto;display:none" id="btnInvUpload" onclick="document.getElementById('invImgInput').click()">&#128193; Upload Service Image</button>
        <span id="invCamHint" style="font-size:11px;color:var(--dim);flex:1">Take up to 4 photos from different angles. Barcode auto-detected.</span>`;
const I1_NEW =
`        <button type="button" class="btn btn-accent btn-sm" style="flex:0 0 auto" id="btnInvCam" onclick="openImgUploadQR('inventory',1)">&#128248; Scan QR to Upload</button>
        <button type="button" class="btn btn-ghost btn-sm" style="flex:0 0 auto;display:none" id="btnInvUpload" onclick="document.getElementById('invImgInput').click()">&#128193; Upload Service Image</button>
        <span id="invCamHint" style="font-size:11px;color:var(--dim);flex:1">1 photo. Barcode auto-detected.</span>`;

const I2_OLD =
`  document.getElementById('invCamHint').textContent     = isServiceBiz ? 'Up to 4 photos showing this service.' : 'Take up to 4 photos from different angles. Barcode auto-detected.';`;
const I2_NEW =
`  document.getElementById('invCamHint').textContent     = isServiceBiz ? '1 photo showing this service.' : '1 photo. Barcode auto-detected.';`;

const I3_OLD =
`function handleInvImg(input){
  const file=input.files[0];if(!file)return;
  if(_invPendingImgs.length>=4){showToast('Max 4 photos.',true);return;}`;
const I3_NEW =
`function handleInvImg(input){
  const file=input.files[0];if(!file)return;
  if(_invPendingImgs.length>=1){showToast('Remove existing photo first.',true);return;}`;

const I4_OLD =
`    if(_imgQRType==='inventory'){
      imgs.forEach(b=>{if(_invPendingImgs.length<4)_invPendingImgs.push(b);});
      renderInvThumbs();`;
const I4_NEW =
`    if(_imgQRType==='inventory'){
      if(_invPendingImgs.length===0) _invPendingImgs.push(imgs[0]);
      renderInvThumbs();`;

const I5_OLD =
`function renderInvThumbs(){
  const el=document.getElementById('invImgThumbs'); if(!el) return;
  const hint=document.getElementById('invCamHint');
  if(_invPendingImgs.length===0){
    el.innerHTML='';
    if(hint) hint.textContent='Take up to 4 photos from your phone. Tap × to remove.';
    const capBtn=document.getElementById('dashCamCapture');
    if(capBtn) capBtn.innerHTML='&#128247; Capture';
    return;
  }
  el.innerHTML=_invPendingImgs.map((b,i)=>\`<div style="position:relative"><img src="data:image/jpeg;base64,\${b}" style="height:44px;width:58px;border-radius:5px;object-fit:cover;border:1px solid var(--border)"><button onclick="removeInvImg(\${i})" style="position:absolute;top:-5px;right:-5px;background:#ef4444;border:none;color:#fff;border-radius:50%;width:17px;height:17px;font-size:11px;cursor:pointer;line-height:17px;padding:0;text-align:center">×</button></div>\`).join('');
  if(hint) hint.textContent=_invPendingImgs.length+'/4 photos. Tap × to remove, Scan QR to add more.';
}`;
const I5_NEW =
`function renderInvThumbs(){
  const el=document.getElementById('invImgThumbs'); if(!el) return;
  const hint=document.getElementById('invCamHint');
  const camBtn=document.getElementById('btnInvCam');
  if(_invPendingImgs.length===0){
    el.innerHTML='';
    if(hint) hint.textContent='1 photo. Barcode auto-detected.';
    if(camBtn) camBtn.style.display='';
    const capBtn=document.getElementById('dashCamCapture');
    if(capBtn) capBtn.innerHTML='&#128247; Capture';
    return;
  }
  el.innerHTML=_invPendingImgs.map((b,i)=>\`<div style="position:relative"><img src="data:image/jpeg;base64,\${b}" style="height:44px;width:58px;border-radius:5px;object-fit:cover;border:1px solid var(--border)"><button onclick="removeInvImg(\${i})" style="position:absolute;top:-5px;right:-5px;background:#ef4444;border:none;color:#fff;border-radius:50%;width:17px;height:17px;font-size:11px;cursor:pointer;line-height:17px;padding:0;text-align:center">×</button></div>\`).join('');
  if(hint) hint.textContent='Photo attached. Tap × to remove and retake.';
  if(camBtn) camBtn.style.display='none';
}`;

// openDashCam 'inventory' mode button text (orphaned/dead code path, fix for consistency)
const I6_OLD =
`  } else if(_dashCamMode === 'inventory'){
    captureBtn.style.display = '';
    captureBtn.textContent = '📷 Capture ('+_invPendingImgs.length+'/4)';`;
const I6_NEW =
`  } else if(_dashCamMode === 'inventory'){
    captureBtn.style.display = '';
    captureBtn.textContent = '📷 Capture ('+_invPendingImgs.length+'/1)';`;

const I7_OLD =
`  if(_dashCamMode==='inventory'){
    if(_invPendingImgs.length>=4){ showToast('Max 4 photos. Tap × on a thumbnail to remove.',true); return; }
    _invPendingImgs.push(b64);
    renderInvThumbs();
    if(_dashBarcode) document.getElementById('invSku').value=_dashBarcode;
    const n=_invPendingImgs.length;
    const capBtn=document.getElementById('dashCamCapture');
    if(n>=4){ showToast('4 photos captured!'); if(capBtn) capBtn.textContent='✓ Done (4/4)'; closeDashCam(); }
    else{ if(capBtn) capBtn.textContent='📷 Capture ('+(n)+'/4)'; showToast('Photo '+n+'/4 captured! Move to next angle.'); }
    return;
  }`;
const I7_NEW =
`  if(_dashCamMode==='inventory'){
    if(_invPendingImgs.length>=1){ showToast('Max 1 photo. Tap × on the thumbnail to remove.',true); return; }
    _invPendingImgs.push(b64);
    renderInvThumbs();
    if(_dashBarcode) document.getElementById('invSku').value=_dashBarcode;
    showToast('Photo captured!');
    closeDashCam();
    return;
  }`;

const PATCHES = [
  ['P1-html',     P1_OLD, P1_NEW],
  ['P2-thumbs',   P2_OLD, P2_NEW],
  ['P3-cap',      P3_OLD, P3_NEW],
  ['P4-qr',       P4_OLD, P4_NEW],
  ['P5-camtext',  P5_OLD, P5_NEW],
  ['P6-capture',  P6_OLD, P6_NEW],
  ['I1-html',     I1_OLD, I1_NEW],
  ['I2-hint',     I2_OLD, I2_NEW],
  ['I3-cap',      I3_OLD, I3_NEW],
  ['I4-qr',       I4_OLD, I4_NEW],
  ['I5-thumbs',   I5_OLD, I5_NEW],
  ['I6-camtext',  I6_OLD, I6_NEW],
  ['I7-capture',  I7_OLD, I7_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('Main Photo (shown in POS)') && c.includes("'1 photo. Barcode auto-detected.'")) {
    console.log(`—  ${file}: already patched`); skipped++; continue;
  }

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label); continue; }
    c = c.replace(oldStr, newStr);
  }
  if (fileErrs.length) errors[file] = fileErrs;

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(fileErrs.length ? `⚠  ${file}: missing ${fileErrs.join(', ')}` : `✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (Object.keys(errors).length) {
  console.log('\nFiles with anchor errors:');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
