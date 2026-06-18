// add_product_multivision_barcode.js
// Fixes Add Product photo capture: wires up the already-built (but dead/unused)
// live camera + barcode detection (openDashCam), bumps photo limit 1 -> 4 across
// all entry points (file upload, QR phone upload, live camera), and exposes the
// previously-hidden pSku field as a visible "Barcode / SKU" input.
// Run: node scripts/add_product_multivision_barcode.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── P1: HTML — add Live Camera button, fix QR button max, expose Barcode/SKU field ──
const P1_OLD =
`    <!-- Product image upload -->
    <div class="field" style="margin-bottom:14px">
      <label>Product Image <span style="color:var(--dim);font-weight:400">(optional)</span></label>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <button type="button" id="prodCamBtn" class="btn btn-accent btn-sm" style="flex:1;font-size:12px" onclick="openImgUploadQR('product',1)">&#128248; Scan QR to Upload</button>
        <button type="button" class="btn btn-ghost btn-sm" style="flex:1;font-size:12px" onclick="document.getElementById('prodImgInput').click()">&#128193; Upload</button>
      </div>
      <div id="prodImgThumbs" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px"></div>
      <div id="prodImgHint" style="color:var(--dim);font-size:12px;padding:4px 0">1 product photo. Tap × to remove and scan again.</div>
      <input type="file" id="prodImgInput" accept="image/*" style="display:none" onchange="handleProdImg(this)">
    </div>
    <div class="field"><label id="pNameLbl">Product Name</label><input id="pName" type="text" placeholder="e.g. Burger"></div>
    <input type="hidden" id="pSku" value="">`;
const P1_NEW =
`    <!-- Product image upload -->
    <div class="field" style="margin-bottom:14px">
      <label>Product Photos <span style="color:var(--dim);font-weight:400">(optional, up to 4)</span></label>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <button type="button" id="prodLiveCamBtn" class="btn btn-accent btn-sm" style="flex:1;font-size:12px" onclick="openDashCam('prodPhoto','pSku')">&#128247; Live Camera</button>
        <button type="button" id="prodCamBtn" class="btn btn-ghost btn-sm" style="flex:1;font-size:12px" onclick="openImgUploadQR('product',4)">&#128248; Scan QR</button>
        <button type="button" class="btn btn-ghost btn-sm" style="flex:1;font-size:12px" onclick="document.getElementById('prodImgInput').click()">&#128193; Upload</button>
      </div>
      <div id="prodImgThumbs" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px"></div>
      <div id="prodImgHint" style="color:var(--dim);font-size:12px;padding:4px 0">Up to 4 product photos. Live Camera also auto-detects the barcode.</div>
      <input type="file" id="prodImgInput" accept="image/*" style="display:none" onchange="handleProdImg(this)">
    </div>
    <div class="field"><label id="pNameLbl">Product Name</label><input id="pName" type="text" placeholder="e.g. Burger"></div>
    <div class="field"><label>Barcode / SKU <span style="color:var(--dim);font-weight:400">(optional)</span></label><input id="pSku" type="text" placeholder="Scan via Live Camera or type manually" style="width:100%;padding:10px 12px;background:var(--bg);border:1.5px solid var(--border);border-radius:7px;color:var(--text);font-size:14px;font-family:Inter,sans-serif;outline:none"></div>`;

// ── P2: JS — renderProdThumbs: show count, hide buttons at 4 instead of at 1 ──
const P2_OLD =
`function renderProdThumbs(){
  const el=document.getElementById('prodImgThumbs'); if(!el) return;
  const hint=document.getElementById('prodImgHint');
  const btn=document.getElementById('prodCamBtn');
  if(_prodPendingImgs.length===0){
    el.innerHTML='';
    if(hint) hint.style.display='';
    if(btn){btn.style.display='';btn.innerHTML='&#128248; Scan QR to Upload';}
    return;
  }
  if(hint) hint.style.display='none';
  el.innerHTML=_prodPendingImgs.map((b,i)=>\`<div style="position:relative"><img src="data:image/jpeg;base64,\${b}" style="height:54px;width:70px;border-radius:6px;object-fit:cover;border:1px solid var(--border)"><button onclick="removeProdImgAt(\${i})" style="position:absolute;top:-5px;right:-5px;background:#ef4444;border:none;color:#fff;border-radius:50%;width:17px;height:17px;font-size:11px;cursor:pointer;line-height:17px;padding:0;text-align:center">&#215;</button></div>\`).join('');
  if(btn) btn.style.display='none';
}`;
const P2_NEW =
`function renderProdThumbs(){
  const el=document.getElementById('prodImgThumbs'); if(!el) return;
  const hint=document.getElementById('prodImgHint');
  const liveCamBtn=document.getElementById('prodLiveCamBtn');
  const btn=document.getElementById('prodCamBtn');
  const n=_prodPendingImgs.length;
  el.innerHTML=_prodPendingImgs.map((b,i)=>\`<div style="position:relative"><img src="data:image/jpeg;base64,\${b}" style="height:54px;width:70px;border-radius:6px;object-fit:cover;border:1px solid var(--border)"><button onclick="removeProdImgAt(\${i})" style="position:absolute;top:-5px;right:-5px;background:#ef4444;border:none;color:#fff;border-radius:50%;width:17px;height:17px;font-size:11px;cursor:pointer;line-height:17px;padding:0;text-align:center">&#215;</button></div>\`).join('');
  if(hint) hint.textContent = n>=4 ? '4/4 photos — max reached. Tap × on a thumbnail to remove.' : (n>0 ? n+'/4 photos. Live Camera also auto-detects the barcode.' : 'Up to 4 product photos. Live Camera also auto-detects the barcode.');
  if(liveCamBtn) liveCamBtn.style.display = n>=4?'none':'';
  if(btn) btn.style.display = n>=4?'none':'';
}`;

// ── P3: JS — handleProdImg: bump cap from 1 to 4 ──────────────────────────
const P3_OLD =
`function handleProdImg(input){
  const file=input.files[0];if(!file)return;
  if(_prodPendingImgs.length>=1){showToast('Remove existing photo first.',true);return;}`;
const P3_NEW =
`function handleProdImg(input){
  const file=input.files[0];if(!file)return;
  if(_prodPendingImgs.length>=4){showToast('Max 4 photos reached. Tap × on a thumbnail to remove.',true);return;}`;

// ── P4: JS — openImgUploadQR: push all received images (up to 4), not just first ──
const P4_OLD =
`    } else {
      if(_prodPendingImgs.length===0) _prodPendingImgs.push(imgs[0]);
      renderProdThumbs();
    }`;
const P4_NEW =
`    } else {
      imgs.forEach(b=>{if(_prodPendingImgs.length<4)_prodPendingImgs.push(b);});
      renderProdThumbs();
    }`;

const PATCHES = [
  ['P1-html',   P1_OLD, P1_NEW],
  ['P2-thumbs', P2_OLD, P2_NEW],
  ['P3-cap',    P3_OLD, P3_NEW],
  ['P4-qr',     P4_OLD, P4_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('prodLiveCamBtn')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
