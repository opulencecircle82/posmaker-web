// add_unli_takeout_raw_material_picker.js
// Lechon House only: extends the Dine In/Take Out widget — after choosing
// Take Out, the cashier now sees a running extra-charge total (starting at
// the configured Unli Takeout Fee) plus a Category -> Item dropdown pair
// sourced from the owner's Inventory (raw materials). Picking an item adds
// its cost to the total and remembers it; at "Add to Cart" the cart entry's
// price includes all of it, and at order-confirm time those raw materials'
// stock gets deducted (same deductions map used for normal inv_links).
// Run: node scripts/add_unli_takeout_raw_material_picker.js
const fs = require('fs');
const path = require('path');

const fp = path.join(__dirname, '..', 'cashier-lechon.html');
const raw = fs.readFileSync(fp, 'utf-8');
const hasCRLF = raw.includes('\r\n');
let c = raw.replace(/\r\n/g, '\n');

if (c.includes('chooseUnliTakeOut')) {
  console.log('—  cashier-lechon.html: already patched');
  process.exit(0);
}

// ── P1: fetch category + cost for inventory items ──────────────────────────
const P1_OLD = `    const { data: invData } = await _sb.from('inventory_items')
      .select('id,name,sku,stock,low_stock_threshold,unit').eq('store_id', STORE_ID);`;
const P1_NEW = `    const { data: invData } = await _sb.from('inventory_items')
      .select('id,name,sku,stock,low_stock_threshold,unit,category,cost').eq('store_id', STORE_ID);`;

// ── P2: modal HTML — add Step 2 (price + category/item dropdowns) ─────────
const P2_OLD =
`<div id="unliTypeModal" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:500;background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:16px;width:min(270px,92vw);box-shadow:0 10px 40px rgba(0,0,0,.7)">
    <div class="mtitle" style="font-size:14px;margin-bottom:10px">&#127869; Dine In or Take Out?</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
      <button type="button" class="q-cash" style="padding:12px;font-size:13px" onclick="confirmUnliType('Dine In')">&#127869; Dine In</button>
      <button type="button" class="q-cash" style="padding:12px;font-size:13px" onclick="confirmUnliType('Take Out')">&#129385; Take Out <span style="color:#888">(+<span id="unliFeeLabel"></span>)</span></button>
    </div>
    <div class="m-actions">
      <button class="btn-cancel" onclick="closeUnliTypeModal()">Cancel</button>
    </div>
  </div>`;
const P2_NEW =
`<div id="unliTypeModal" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:500;background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:16px;width:min(300px,92vw);box-shadow:0 10px 40px rgba(0,0,0,.7)">
    <div class="mtitle" style="font-size:14px;margin-bottom:10px">&#127869; Dine In or Take Out?</div>
    <div id="unliStep1" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
      <button type="button" class="q-cash" style="padding:12px;font-size:13px" onclick="chooseUnliDineIn()">&#127869; Dine In</button>
      <button type="button" class="q-cash" style="padding:12px;font-size:13px" onclick="chooseUnliTakeOut()">&#129385; Take Out</button>
    </div>
    <div id="unliStep2" style="display:none">
      <div style="text-align:center;font-size:20px;font-weight:800;color:var(--accent);margin-bottom:10px">+<span id="unliTotalLabel">₱0.00</span></div>
      <div style="font-size:11px;color:#888;margin-bottom:6px">Add packaging from raw materials (optional):</div>
      <select id="unliInvCat" class="inp" onchange="populateUnliInvItems()" style="margin-bottom:6px"><option value="">— Category —</option></select>
      <select id="unliInvItem" class="inp" onchange="addUnliInvItem()" style="margin-bottom:8px"><option value="">— Item —</option></select>
      <div id="unliInvAddedList" style="font-size:11px;color:#ccc;margin-bottom:6px"></div>
    </div>
    <div class="m-actions">
      <button class="btn-cancel" onclick="closeUnliTypeModal()">Cancel</button>
      <button class="btn-confirm" id="unliConfirmBtn" style="display:none" onclick="finishUnliTakeOut()">Add to Cart</button>
    </div>
  </div>`;

// ── P3: JS — replace openUnliTypeModal/closeUnliTypeModal/confirmUnliType ──
const P3_OLD =
`function openUnliTypeModal(id) {
  _unliProdId = id;
  const fee = parseFloat(STORE.unli_takeout_fee) || 0;
  document.getElementById('unliFeeLabel').textContent = (CUR||'₱') + fee.toFixed(2);
  document.getElementById('unliTypeModal').style.display = 'block';
}
function closeUnliTypeModal() {
  document.getElementById('unliTypeModal').style.display = 'none';
  _unliProdId = null;
}
function confirmUnliType(type) {
  const id = _unliProdId;
  const p = prods.find(x => x.id == id);
  closeUnliTypeModal();
  if (!p) return;
  if (type === 'Dine In') { addItem(id, true); return; }
  const fee = parseFloat(STORE.unli_takeout_fee) || 0;
  const key = id + '_takeout';
  if (!cart[key]) cart[key] = { id: p.id, name: p.name + ' (Take Out)', price: parseFloat(p.price) + fee, qty: 0 };
  const max = _maxStock(id);
  if (cart[key].qty >= max) { showToast(\`Only \${max} in stock\`); return; }
  cart[key].qty++;
  redrawCart();
}`;
const P3_NEW =
`let _unliExtra = 0, _unliAddedItems = [];
function openUnliTypeModal(id) {
  _unliProdId = id;
  _unliExtra = 0;
  _unliAddedItems = [];
  document.getElementById('unliStep1').style.display = '';
  document.getElementById('unliStep2').style.display = 'none';
  document.getElementById('unliConfirmBtn').style.display = 'none';
  document.getElementById('unliTypeModal').style.display = 'block';
}
function closeUnliTypeModal() {
  document.getElementById('unliTypeModal').style.display = 'none';
  _unliProdId = null;
}
function chooseUnliDineIn() {
  const id = _unliProdId;
  closeUnliTypeModal();
  addItem(id, true);
}
function chooseUnliTakeOut() {
  _unliExtra = parseFloat(STORE.unli_takeout_fee) || 0;
  _unliAddedItems = [];
  document.getElementById('unliStep1').style.display = 'none';
  document.getElementById('unliStep2').style.display = '';
  document.getElementById('unliConfirmBtn').style.display = '';
  updateUnliTotalLabel();
  populateUnliInvCats();
  renderUnliAddedList();
}
function updateUnliTotalLabel() {
  document.getElementById('unliTotalLabel').textContent = (CUR||'₱') + _unliExtra.toFixed(2);
}
function populateUnliInvCats() {
  const sel = document.getElementById('unliInvCat');
  sel.innerHTML = '<option value="">— Category —</option>';
  const cats = [...new Set(storeInvItems.map(i => i.category).filter(Boolean))].sort();
  cats.forEach(c => sel.add(new Option(c, c)));
  document.getElementById('unliInvItem').innerHTML = '<option value="">— Item —</option>';
}
function populateUnliInvItems() {
  const cat = document.getElementById('unliInvCat').value;
  const sel = document.getElementById('unliInvItem');
  sel.innerHTML = '<option value="">— Item —</option>';
  if (!cat) return;
  storeInvItems.filter(i => i.category === cat).forEach(i => {
    sel.add(new Option(i.name + ' (' + (CUR||'₱') + (parseFloat(i.cost)||0).toFixed(2) + ')', i.id));
  });
}
function addUnliInvItem() {
  const sel = document.getElementById('unliInvItem');
  const invId = sel.value;
  if (!invId) return;
  const inv = storeInvItems.find(i => i.id == invId);
  if (!inv) return;
  const cost = parseFloat(inv.cost) || 0;
  _unliExtra += cost;
  _unliAddedItems.push({ invId: inv.id, name: inv.name, cost });
  updateUnliTotalLabel();
  renderUnliAddedList();
  sel.value = '';
}
function renderUnliAddedList() {
  const el = document.getElementById('unliInvAddedList');
  if (!_unliAddedItems.length) { el.innerHTML = ''; return; }
  el.innerHTML = _unliAddedItems.map((it,idx) =>
    \`<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0">
      <span>\${it.name} (+\${CUR||'₱'}\${it.cost.toFixed(2)})</span>
      <button type="button" class="q-btn" onclick="removeUnliInvItem(\${idx})">&#10005;</button>
    </div>\`
  ).join('');
}
function removeUnliInvItem(idx) {
  const it = _unliAddedItems[idx];
  if (it) _unliExtra -= it.cost;
  _unliAddedItems.splice(idx, 1);
  updateUnliTotalLabel();
  renderUnliAddedList();
}
function finishUnliTakeOut() {
  const id = _unliProdId;
  const p = prods.find(x => x.id == id);
  if (!p) { closeUnliTypeModal(); return; }
  const key = id + '_takeout';
  if (!cart[key]) cart[key] = { id: p.id, name: p.name + ' (Take Out)', price: parseFloat(p.price) + _unliExtra, qty: 0, _unliInvUsed: [] };
  const max = _maxStock(id);
  if (cart[key].qty >= max) { showToast(\`Only \${max} in stock\`); return; }
  cart[key].qty++;
  cart[key]._unliInvUsed = (cart[key]._unliInvUsed || []).concat(_unliAddedItems.map(it => it.invId));
  closeUnliTypeModal();
  redrawCart();
}`;

// ── P4: deduct raw materials manually picked for Take Out packaging ───────
const P4_OLD =
`      } else {
        // Fallback: match inventory item by product name/SKU
        const p = prods.find(x => x.id === item.id);
        const autoId = p?._autoInvLink;
        if (autoId) deductions[autoId] = (deductions[autoId] || 0) + item.qty;
      }
    }`;
const P4_NEW =
`      } else {
        // Fallback: match inventory item by product name/SKU
        const p = prods.find(x => x.id === item.id);
        const autoId = p?._autoInvLink;
        if (autoId) deductions[autoId] = (deductions[autoId] || 0) + item.qty;
      }
      // Raw materials manually picked for Take Out packaging (Unli widget)
      if (item._unliInvUsed && item._unliInvUsed.length) {
        item._unliInvUsed.forEach(invId => { deductions[invId] = (deductions[invId] || 0) + 1; });
      }
    }`;

const PATCHES = [
  ['P1-select', P1_OLD, P1_NEW],
  ['P2-html', P2_OLD, P2_NEW],
  ['P3-js', P3_OLD, P3_NEW],
  ['P4-deduct', P4_OLD, P4_NEW],
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
