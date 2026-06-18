// add_order_type_popup_lechon.js
// Replaces the always-visible Dine In / Take Away / Delivery tab bar at the
// top of the Lechon House cashier with a popup that appears when "Confirm
// Order" is clicked. Choosing Dine In confirms immediately; choosing Take
// Away or Delivery shows an optional packaging step listing Products whose
// category is "Packaging" (owner creates this category + items, e.g. Box,
// Plastic Spoon, with their own price) — tapping one adds it to the cart at
// its set price, reusing the existing addItem()/stock logic untouched.
// "Skip"/no selection is allowed (packaging is optional per the owner).
// Scoped to cashier-lechon.html only for now (test store), matching the
// established pattern of trying new cashier UX in one store before rollout.
// Run: node scripts/add_order_type_popup_lechon.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const fp = path.join(dir, 'cashier-lechon.html');

const raw = fs.readFileSync(fp, 'utf-8');
const hasCRLF = raw.includes('\r\n');
let c = raw.replace(/\r\n/g, '\n');

if (c.includes('openOrderTypeModal')) {
  console.log('—  cashier-lechon.html: already patched');
  process.exit(0);
}

// ── P1: remove the top tab bar ──────────────────────────────────────────────
const P1_OLD =
`<!-- Order type tabs -->
<div class="ot-bar">
  <button class="ot-btn active" data-type="Dine In"   onclick="setOrderType(this)">&#127869; Dine In</button>
  <button class="ot-btn"        data-type="Take Away"  onclick="setOrderType(this)">&#128101; Take Away</button>
  <button class="ot-btn"        data-type="Delivery"   onclick="setOrderType(this)">&#128666; Delivery</button>
</div>`;
const P1_NEW = `<!-- Order type is now chosen via the popup at Confirm Order time — see #mOrderType -->`;

// ── P2: add the new modal HTML right after the Select Table modal ─────────
const P2_OLD =
`<div class="modal" id="mTable">
  <div class="mbox">
    <div class="mtitle">&#127963; Select Table</div>
    <div class="tbl-grid" id="tblGrid"></div>
    <div class="m-actions">
      <button class="btn-cancel" onclick="closeM('mTable')">Close</button>
    </div>
  </div>
</div>`;
const P2_NEW =
P2_OLD + `

<!-- ── ORDER TYPE / PACKAGING ── -->
<div class="modal" id="mOrderType">
  <div class="mbox" style="width:min(360px,96vw)">
    <div class="mtitle" id="otModalTitle">&#127869; Saan ba ito?</div>
    <div id="otStep1" style="display:flex;flex-direction:column;gap:8px;margin:10px 0">
      <button class="q-cash" style="padding:14px;font-size:14px" onclick="chooseOrderType('Dine In')">&#127869; Dine In</button>
      <button class="q-cash" style="padding:14px;font-size:14px" onclick="chooseOrderType('Take Away')">&#129385; Take Away</button>
      <button class="q-cash" style="padding:14px;font-size:14px" onclick="chooseOrderType('Delivery')">&#128666; Delivery</button>
    </div>
    <div id="otStep2" style="display:none">
      <div style="font-size:12px;color:#888;margin-bottom:8px">Add packaging (optional):</div>
      <div id="otPackagingList" style="display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto;margin-bottom:10px"></div>
    </div>
    <div class="m-actions">
      <button class="btn-cancel" onclick="closeM('mOrderType')">Cancel</button>
      <button class="btn-confirm" id="otContinueBtn" style="display:none" onclick="finishOrderTypeStep()">Continue</button>
    </div>
  </div>
</div>`;

// ── P3: split confirmOrder() into a popup-opening wrapper + _doConfirmOrder() ──
const P3_OLD =
`// ── Confirm Order ─────────────────────────────────────────────────────────
async function confirmOrder() {
  const { items, raw, disc, total, tax, sub } = getCartTotals();
  const tender = payMeth === 'Cash' ? parseFloat(document.getElementById('tendered').value) || 0 : total;
  const change = payMeth === 'Cash' ? parseFloat((tender - total).toFixed(2)) : 0;
  const dPct   = discAmt > 0 && raw > 0 ? parseFloat(((disc / raw) * 100).toFixed(2)) : discPct;

  if (payMeth === 'Cash' && tender < total) { alert('Amount tendered is less than total.'); return; }

  const receiptData = { order_id: 'DEMO', items, sub, tax, total, disc, tender, change, method: payMeth, cashier: CASHIER_NAME, orderType, tableNo, isKOT };`;
const P3_NEW =
`// ── Confirm Order ─────────────────────────────────────────────────────────
function confirmOrder() {
  openOrderTypeModal();
}
function openOrderTypeModal() {
  document.getElementById('otModalTitle').innerHTML = '&#127869; Saan ba ito?';
  document.getElementById('otStep1').style.display = '';
  document.getElementById('otStep2').style.display = 'none';
  document.getElementById('otContinueBtn').style.display = 'none';
  document.getElementById('mOrderType').classList.add('show');
}
function chooseOrderType(type) {
  orderType = type;
  if (type === 'Dine In') {
    closeM('mOrderType');
    _doConfirmOrder();
    return;
  }
  document.getElementById('otModalTitle').innerHTML = (type === 'Take Away' ? '&#129385; Take Away' : '&#128666; Delivery') + ' — Packaging';
  document.getElementById('otStep1').style.display = 'none';
  document.getElementById('otStep2').style.display = '';
  document.getElementById('otContinueBtn').style.display = '';
  renderPackagingList();
}
function renderPackagingList() {
  const list = document.getElementById('otPackagingList');
  const items = prods.filter(p => (p.category||'').trim().toLowerCase() === 'packaging');
  if (!items.length) {
    list.innerHTML = '<div style="text-align:center;color:#666;font-size:12px;padding:10px">No packaging items set up yet. (Add a Product category named "Packaging".)</div>';
    return;
  }
  list.innerHTML = items.map(p => {
    const inCart = cart[p.id]?.qty || 0;
    return \`<button class="q-cash" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;font-size:13px" onclick="addItem('\${p.id}');renderPackagingList()">
      <span>\${p.name}\${inCart?' <span style="color:var(--accent);font-weight:700">×'+inCart+'</span>':''}</span>
      <span style="color:#888">\${CUR||'₱'}\${parseFloat(p.price).toFixed(2)}</span>
    </button>\`;
  }).join('');
}
function finishOrderTypeStep() {
  closeM('mOrderType');
  _doConfirmOrder();
}
async function _doConfirmOrder() {
  const { items, raw, disc, total, tax, sub } = getCartTotals();
  const tender = payMeth === 'Cash' ? parseFloat(document.getElementById('tendered').value) || 0 : total;
  const change = payMeth === 'Cash' ? parseFloat((tender - total).toFixed(2)) : 0;
  const dPct   = discAmt > 0 && raw > 0 ? parseFloat(((disc / raw) * 100).toFixed(2)) : discPct;

  if (payMeth === 'Cash' && tender < total) { alert('Amount tendered is less than total.'); return; }

  const receiptData = { order_id: 'DEMO', items, sub, tax, total, disc, tender, change, method: payMeth, cashier: CASHIER_NAME, orderType, tableNo, isKOT };`;

const PATCHES = [
  ['P1-remove-tabs', P1_OLD, P1_NEW],
  ['P2-add-modal',   P2_OLD, P2_NEW],
  ['P3-split-fn',    P3_OLD, P3_NEW],
];

const errs = [];
for (const [label, oldStr, newStr] of PATCHES) {
  if (!c.includes(oldStr)) { errs.push(label); continue; }
  c = c.replace(oldStr, newStr);
}

if (errs.length) {
  console.log('⚠  cashier-lechon.html: missing anchors: ' + errs.join(', '));
  process.exit(1);
}

const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
fs.writeFileSync(fp, out, 'utf-8');
console.log('✓  cashier-lechon.html patched');
