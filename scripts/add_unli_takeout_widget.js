// add_unli_takeout_widget.js
// Lechon House only: clicking a product whose category contains "Unli" (e.g.
// the existing "UNLI RICE" category) now opens a small floating widget
// (same style as the Sold-by-Weight widget) asking Dine In or Take Out.
// Dine In adds the item normally. Take Out adds it as a separate cart line
// tagged "(Take Out)" with the owner-configurable Unli Takeout Fee (Settings
// > Store Information) added to its price. Requires a new `unli_takeout_fee`
// column on `stores` (SQL must be run manually); defaults to 0 until then.
// Run: node scripts/add_unli_takeout_widget.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');

// ════════════════════════════ dashboard-lechon.html ════════════════════════
{
  const fp = path.join(dir, 'dashboard-lechon.html');
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('sUnliFee')) {
    console.log('—  dashboard-lechon.html: already patched');
  } else {
    const H_OLD =
`          <div class="field"><label>Currency Symbol</label><input id="sCurrency" type="text" maxlength="4"></div>
          <div class="field"><label>Tax Rate (%)</label><input id="sTax" type="number" min="0" max="100" step="0.5"></div>
        </div>`;
    const H_NEW =
`          <div class="field"><label>Currency Symbol</label><input id="sCurrency" type="text" maxlength="4"></div>
          <div class="field"><label>Tax Rate (%)</label><input id="sTax" type="number" min="0" max="100" step="0.5"></div>
        </div>
        <div class="field"><label>Unli Takeout Fee (&#8369;) <span style="color:var(--muted);font-size:11px;font-weight:400">(extra charge when an Unli item is ordered Take Out)</span></label><input id="sUnliFee" type="number" min="0" step="0.01" placeholder="0.00"></div>`;

    const L_OLD = `  document.getElementById('sTax').value      = store.tax_rate || 12;`;
    const L_NEW = `  document.getElementById('sTax').value      = store.tax_rate || 12;\n  document.getElementById('sUnliFee').value  = store.unli_takeout_fee || 0;`;

    const S_OLD = `    tax_rate:       parseFloat(document.getElementById('sTax').value) || 0,`;
    const S_NEW = `    tax_rate:       parseFloat(document.getElementById('sTax').value) || 0,\n    unli_takeout_fee: parseFloat(document.getElementById('sUnliFee').value) || 0,`;

    const errs = [];
    if (c.includes(H_OLD)) c = c.replace(H_OLD, H_NEW); else errs.push('html');
    if (c.includes(L_OLD)) c = c.replace(L_OLD, L_NEW); else errs.push('load');
    if (c.includes(S_OLD)) c = c.replace(S_OLD, S_NEW); else errs.push('save');

    if (errs.length) {
      console.log('⚠  dashboard-lechon.html: missing ' + errs.join(', '));
    } else {
      const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
      fs.writeFileSync(fp, out, 'utf-8');
      console.log('✓  dashboard-lechon.html');
    }
  }
}

// ════════════════════════════ cashier-lechon.html ═══════════════════════════
{
  const fp = path.join(dir, 'cashier-lechon.html');
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('openUnliTypeModal')) {
    console.log('—  cashier-lechon.html: already patched');
  } else {
    // ── P1: addItem() — reroute Unli-category products to the new widget ──
    const P1_OLD =
`function addItem(id) {
  const p = prods.find(x => x.id == id); if (!p) return;
  if (p.sold_by_weight) { openWeightModal(id); return; }`;
    const P1_NEW =
`function isUnliProduct(p) {
  return (p.category||'').trim().toLowerCase().includes('unli');
}
function addItem(id, skipUnliCheck) {
  const p = prods.find(x => x.id == id); if (!p) return;
  if (!skipUnliCheck && isUnliProduct(p)) { openUnliTypeModal(id); return; }
  if (p.sold_by_weight) { openWeightModal(id); return; }`;

    // ── P2: the widget functions, inserted right before the weight-modal functions ──
    const P2_OLD = `let _weightProdId = null, _weightPricePerKg = 0;`;
    const P2_NEW =
`let _unliProdId = null;
function openUnliTypeModal(id) {
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
}
let _weightProdId = null, _weightPricePerKg = 0;`;

    // ── P3: the floating widget markup, inserted right before the weight modal's div ──
    const P3_OLD = `<div id="weightModal" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:500;background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:16px;width:min(270px,92vw);box-shadow:0 10px 40px rgba(0,0,0,.7)">`;
    const P3_NEW =
`<div id="unliTypeModal" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:500;background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:16px;width:min(270px,92vw);box-shadow:0 10px 40px rgba(0,0,0,.7)">
    <div class="mtitle" style="font-size:14px;margin-bottom:10px">&#127869; Dine In or Take Out?</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
      <button type="button" class="q-cash" style="padding:12px;font-size:13px" onclick="confirmUnliType('Dine In')">&#127869; Dine In</button>
      <button type="button" class="q-cash" style="padding:12px;font-size:13px" onclick="confirmUnliType('Take Out')">&#129385; Take Out <span style="color:#888">(+<span id="unliFeeLabel"></span>)</span></button>
    </div>
    <div class="m-actions">
      <button class="btn-cancel" onclick="closeUnliTypeModal()">Cancel</button>
    </div>
  </div>

  <div id="weightModal" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:500;background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:16px;width:min(270px,92vw);box-shadow:0 10px 40px rgba(0,0,0,.7)">`;

    const PATCHES = [
      ['P1-addItem', P1_OLD, P1_NEW],
      ['P2-functions', P2_OLD, P2_NEW],
      ['P3-markup', P3_OLD, P3_NEW],
    ];

    const errs = [];
    for (const [label, oldStr, newStr] of PATCHES) {
      if (!c.includes(oldStr)) { errs.push(label); continue; }
      c = c.replace(oldStr, newStr);
    }

    if (errs.length) {
      console.log('⚠  cashier-lechon.html: missing ' + errs.join(', '));
    } else {
      const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
      fs.writeFileSync(fp, out, 'utf-8');
      console.log('✓  cashier-lechon.html');
    }
  }
}
