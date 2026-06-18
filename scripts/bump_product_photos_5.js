// bump_product_photos_5.js
// Bumps product photo capture limit from 4 to 5 (Add Product live camera + barcode flow only).
// Inventory item photo capture (separate _invPendingImgs flow) is untouched — stays at 4.
// Run: node scripts/bump_product_photos_5.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── P1: HTML hint text ──────────────────────────────────────────────────
const P1_OLD =
`      <label>Product Photos <span style="color:var(--dim);font-weight:400">(optional, up to 4)</span></label>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <button type="button" id="prodLiveCamBtn" class="btn btn-accent btn-sm" style="flex:1;font-size:12px" onclick="openDashCam('prodPhoto','pSku')">&#128247; Live Camera</button>
        <button type="button" id="prodCamBtn" class="btn btn-ghost btn-sm" style="flex:1;font-size:12px" onclick="openImgUploadQR('product',4)">&#128248; Scan QR</button>
        <button type="button" class="btn btn-ghost btn-sm" style="flex:1;font-size:12px" onclick="document.getElementById('prodImgInput').click()">&#128193; Upload</button>
      </div>
      <div id="prodImgThumbs" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px"></div>
      <div id="prodImgHint" style="color:var(--dim);font-size:12px;padding:4px 0">Up to 4 product photos. Live Camera also auto-detects the barcode.</div>`;
const P1_NEW =
`      <label>Product Photos <span style="color:var(--dim);font-weight:400">(optional, up to 5)</span></label>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <button type="button" id="prodLiveCamBtn" class="btn btn-accent btn-sm" style="flex:1;font-size:12px" onclick="openDashCam('prodPhoto','pSku')">&#128247; Live Camera</button>
        <button type="button" id="prodCamBtn" class="btn btn-ghost btn-sm" style="flex:1;font-size:12px" onclick="openImgUploadQR('product',5)">&#128248; Scan QR</button>
        <button type="button" class="btn btn-ghost btn-sm" style="flex:1;font-size:12px" onclick="document.getElementById('prodImgInput').click()">&#128193; Upload</button>
      </div>
      <div id="prodImgThumbs" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px"></div>
      <div id="prodImgHint" style="color:var(--dim);font-size:12px;padding:4px 0">Up to 5 product photos. Live Camera also auto-detects the barcode.</div>`;

// ── P2: renderProdThumbs() hint + button visibility ────────────────────
const P2_OLD =
`  if(hint) hint.textContent = n>=4 ? '4/4 photos — max reached. Tap × on a thumbnail to remove.' : (n>0 ? n+'/4 photos. Live Camera also auto-detects the barcode.' : 'Up to 4 product photos. Live Camera also auto-detects the barcode.');
  if(liveCamBtn) liveCamBtn.style.display = n>=4?'none':'';
  if(btn) btn.style.display = n>=4?'none':'';`;
const P2_NEW =
`  if(hint) hint.textContent = n>=5 ? '5/5 photos — max reached. Tap × on a thumbnail to remove.' : (n>0 ? n+'/5 photos. Live Camera also auto-detects the barcode.' : 'Up to 5 product photos. Live Camera also auto-detects the barcode.');
  if(liveCamBtn) liveCamBtn.style.display = n>=5?'none':'';
  if(btn) btn.style.display = n>=5?'none':'';`;

// ── P3: handleProdImg() cap ─────────────────────────────────────────────
const P3_OLD =
`  if(_prodPendingImgs.length>=4){showToast('Max 4 photos reached. Tap × on a thumbnail to remove.',true);return;}`;
const P3_NEW =
`  if(_prodPendingImgs.length>=5){showToast('Max 5 photos reached. Tap × on a thumbnail to remove.',true);return;}`;

// ── P4: openImgUploadQR product branch cap ──────────────────────────────
const P4_OLD =
`      imgs.forEach(b=>{if(_prodPendingImgs.length<4)_prodPendingImgs.push(b);});`;
const P4_NEW =
`      imgs.forEach(b=>{if(_prodPendingImgs.length<5)_prodPendingImgs.push(b);});`;

// ── P5: openDashCam() prodPhoto branch button text ──────────────────────
const P5_OLD =
`    captureBtn.textContent = '📷 Capture ('+_prodPendingImgs.length+'/4)';
    bcBtn.style.display = 'none';
    document.querySelector('#dashCamModal h3').textContent = '📷 Product Photos';`;
const P5_NEW =
`    captureBtn.textContent = '📷 Capture ('+_prodPendingImgs.length+'/5)';
    bcBtn.style.display = 'none';
    document.querySelector('#dashCamModal h3').textContent = '📷 Product Photos';`;

// ── P6: captureDashPhoto() product-mode block (NOT the inventory block) ──
const P6_OLD =
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
const P6_NEW =
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

const PATCHES = [
  ['P1-html',     P1_OLD, P1_NEW],
  ['P2-thumbs',   P2_OLD, P2_NEW],
  ['P3-cap',      P3_OLD, P3_NEW],
  ['P4-qr',       P4_OLD, P4_NEW],
  ['P5-camtext',  P5_OLD, P5_NEW],
  ['P6-capture',  P6_OLD, P6_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes("up to 5")) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
