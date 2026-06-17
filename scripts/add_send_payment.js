// add_send_payment.js — Add "Send Payment" button + modal to all 25 dashboard files
// Run: node scripts/add_send_payment.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── Patch 1: Add Send button to staff row (before Del) ──────────────────────
const OLD_BTN = `        <button class="btn btn-danger btn-sm" onclick="deleteStaff('\${s.id}')">Del</button>`;
const NEW_BTN =
  `        <button class="btn btn-sm" style="background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3)" onclick="openSendPayModal('\${s.id}')">&#128176; Send</button>\r\n` +
  `        <button class="btn btn-danger btn-sm" onclick="deleteStaff('\${s.id}')">Del</button>`;

// ── Patch 2: JS + HTML (before </body>) ─────────────────────────────────────
const OLD_BODY = `\r\n</body>`;

const NEW_BEFORE_BODY =
`\r\n
<script>
// ── Send Payment to Staff ──────────────────────────────────────────────────
let _spStaffId='',_spQRPoll=null,_spQRToken=null;
function openSendPayModal(staffId){
  const s=(allStaff||[]).find(x=>x.id===staffId)||{};
  _spStaffId=staffId;
  document.getElementById('spRecipient').textContent=(s.full_name||s.username)||'—';
  document.getElementById('spAmt').value='';
  document.getElementById('spNote').value='';
  document.getElementById('spFile').value='';
  document.getElementById('spPreview').style.display='none';
  const btn=document.getElementById('spBtn');
  btn.disabled=false;btn.innerHTML='&#128176; Send';
  document.getElementById('sendPayModal').classList.add('show');
}
function previewSendPayFile(){
  const file=document.getElementById('spFile').files[0];
  if(!file){document.getElementById('spPreview').style.display='none';return;}
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      const MAX=1200,cv=document.createElement('canvas');
      const sc=Math.min(1,MAX/Math.max(img.width,img.height));
      cv.width=img.width*sc;cv.height=img.height*sc;
      cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
      document.getElementById('spReceiptImg').src=cv.toDataURL('image/jpeg',0.6);
      document.getElementById('spPreview').style.display='';
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}
async function openSendPayQR(){
  if(!_opsData)await loadOpsData();
  _spQRToken=await createImgUploadToken('send_pay_rcpt',1);
  const url='https://posmaker.ggff.net/image-upload.html?sid='+STORE.id+'&token='+_spQRToken+'&max=1';
  document.getElementById('spQRCode').src='https://api.qrserver.com/v1/create-qr-code/?size=190x190&data='+encodeURIComponent(url);
  document.getElementById('spQRStatus').textContent='Waiting for photo…';
  document.getElementById('spQRModal').classList.add('show');
  if(_spQRPoll)clearInterval(_spQRPoll);
  _spQRPoll=setInterval(async()=>{
    await refreshOpsData();
    const sess=(_opsData&&_opsData.imgUploadSessions&&_opsData.imgUploadSessions[_spQRToken])||null;
    if(!sess||!sess.images||sess.images.length===0)return;
    document.getElementById('spReceiptImg').src='data:image/jpeg;base64,'+sess.images[0];
    document.getElementById('spPreview').style.display='';
    document.getElementById('spQRStatus').textContent='✅ Photo received!';
    await clearImgUploadSession(_spQRToken);_spQRToken=null;
    setTimeout(()=>closeSendPayQR(),1200);
  },2500);
}
function closeSendPayQR(){
  if(_spQRPoll){clearInterval(_spQRPoll);_spQRPoll=null;}
  if(_spQRToken){clearImgUploadSession(_spQRToken);_spQRToken=null;}
  document.getElementById('spQRModal').classList.remove('show');
}
async function saveSendPay(){
  const s=(allStaff||[]).find(x=>x.id===_spStaffId)||{};
  const amt=parseFloat(document.getElementById('spAmt').value);
  if(!amt||amt<=0){showToast('Enter a valid amount.',true);return;}
  const note=document.getElementById('spNote').value.trim();
  const rImg=document.getElementById('spReceiptImg');
  const rcpt=(rImg.src&&rImg.src.startsWith('data:'))?rImg.src:null;
  const btn=document.getElementById('spBtn');
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span>Sending…';
  const today=new Date().toISOString().slice(0,10);
  const desc='Owner sent'+(note?': '+note:'');
  const {data:crD,error:crE}=await _sb.from('cash_remittances').insert({
    store_id:STORE.id,cashier_name:s.username||'staff',shift_date:today,
    pos_sales:0,cash_on_hand:amt,difference:amt,
    status:'owner_payment',description:desc
  }).select('id').single();
  if(crE&&!(crE.message||'').includes('description')){
    showToast('Error: '+crE.message,true);
    btn.disabled=false;btn.innerHTML='&#128176; Send';return;
  }
  const crId=crD&&crD.id?crD.id:'';
  await _sb.from('activity_logs').insert({
    store_id:STORE.id,actor_name:(STORE.owner_name||'Owner'),actor_role:'owner',
    action:'OWNER_SEND',target_name:(s.full_name||s.username),
    details:JSON.stringify(Object.assign({amount:amt},note?{note}:{},rcpt?{receipt_b64:rcpt}:{}))
  }).then(()=>{});
  const mbody='PAYMENT_REF:'+crId+'\n₱'+amt.toFixed(2)+' mula sa may-ari'+(note?' — '+note:'')+(rcpt?'\n\nMay kasamang resibo ng transfer.':'')+'\n\nI-tap ang Confirm kapag natanggap mo na.';
  await _sb.from('store_messages').insert({
    store_id:STORE.id,from_name:(STORE.name||'Owner'),from_role:'owner',
    to_username:s.username,to_name:(s.full_name||s.username),
    body:mbody,read:false
  }).then(()=>{});
  closeModal('sendPayModal');
  showToast('₱'+amt.toFixed(2)+' sent to '+(s.full_name||s.username)+'.');
}
</script>

<!-- SEND PAYMENT MODAL -->
<div class="modal" id="sendPayModal">
  <div class="mbox">
    <h3>&#128176; Send Payment</h3>
    <div style="background:var(--s2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px">
      <span style="color:var(--muted)">Para kay: </span>
      <strong id="spRecipient" style="color:var(--accent)">—</strong>
    </div>
    <div class="field">
      <label>Amount (&#8369;)</label>
      <input id="spAmt" type="number" min="0.01" step="0.01" placeholder="0.00" style="font-weight:700;color:#10b981">
    </div>
    <div class="field">
      <label>Note / Purpose (optional)</label>
      <input id="spNote" type="text" placeholder="e.g. June Salary, Advance, Bonus">
    </div>
    <div class="field">
      <label>Receipt / Proof of Transfer</label>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input id="spFile" type="file" accept="image/*" onchange="previewSendPayFile()" style="font-size:12px;padding:8px;flex:1;min-width:0">
        <button type="button" class="btn btn-ghost btn-sm" onclick="openSendPayQR()" style="white-space:nowrap;font-size:12px">&#128247; Scan QR</button>
      </div>
      <div id="spPreview" style="display:none;margin-top:8px;text-align:center">
        <img id="spReceiptImg" style="max-width:100%;max-height:160px;border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:11px;color:#10b981;margin-top:4px">&#10003; Receipt attached</div>
      </div>
    </div>
    <div class="m-actions">
      <button class="btn btn-ghost" onclick="closeModal('sendPayModal')">Cancel</button>
      <button class="btn btn-accent" id="spBtn" onclick="saveSendPay()">&#128176; Send</button>
    </div>
  </div>
</div>

<div class="modal" id="spQRModal">
  <div class="mbox" style="text-align:center;max-width:320px">
    <h3 style="margin-bottom:8px">&#128247; Upload Receipt from Phone</h3>
    <p style="font-size:12px;color:var(--muted);margin-bottom:8px">I-scan ang QR. Sa phone: pumili ng larawan o kumuha ng photo ng bank receipt.</p>
    <img id="spQRCode" style="width:190px;height:190px;border-radius:8px;background:#fff;padding:6px;margin:8px auto;display:block">
    <div id="spQRStatus" style="font-size:12px;color:var(--muted);margin-bottom:14px">Waiting for photo&#8230;</div>
    <button class="btn btn-ghost" onclick="closeSendPayQR()">Close</button>
  </div>
</div>
</body>`;

let patched = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  let c = fs.readFileSync(fp, 'utf-8');
  const issues = [];

  // Skip already patched
  if (c.includes('sendPayModal') || c.includes('openSendPayModal')) {
    console.log(`— ${file}: already patched`);
    continue;
  }

  // Patch 1 — Send button (CRLF variant)
  if (c.includes(OLD_BTN)) {
    c = c.replace(OLD_BTN, NEW_BTN);
  } else {
    // LF fallback
    const ob_lf = OLD_BTN.replace(/\r\n/g, '\n');
    const nb_lf = NEW_BTN.replace(/\r\n/g, '\n');
    if (c.includes(ob_lf)) {
      c = c.replace(ob_lf, nb_lf);
    } else {
      issues.push('p1-btn anchor missing');
    }
  }

  // Patch 2 — JS + HTML before </body> (CRLF variant)
  if (c.includes(OLD_BODY)) {
    c = c.replace(OLD_BODY, NEW_BEFORE_BODY);
  } else {
    const ob_lf = OLD_BODY.replace(/\r\n/g, '\n');
    const nb_lf = NEW_BEFORE_BODY.replace(/\r\n/g, '\n');
    if (c.includes(ob_lf)) {
      c = c.replace(ob_lf, nb_lf);
    } else {
      issues.push('p2-body anchor missing');
    }
  }

  if (issues.length) {
    console.log(`⚠  ${file}: ${issues.join(', ')}`);
    errors++;
  } else {
    fs.writeFileSync(fp, c, 'utf-8');
    console.log(`✓  ${file}`);
    patched++;
  }
}

console.log(`\nDone: ${patched} patched, ${errors} issues.`);
