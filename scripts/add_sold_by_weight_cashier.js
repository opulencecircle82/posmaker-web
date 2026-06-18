// add_sold_by_weight_cashier.js
// POS side of weight-based pricing: clicking a sold_by_weight product opens
// a popup asking for grams, computes the price from price-per-kilo, and
// adds to cart with a fractional qty (in kg) — which the existing checkout
// stock-deduction math already handles correctly (deduction = inv_link_qty * item.qty).
// Run: node scripts/add_sold_by_weight_cashier.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = ['cashier-lechon.html', 'cashier-bigasan.html'];

// ── P1: addItem() — redirect weight-priced products to the weight modal ───
const P1_OLD =
`function addItem(id) {
  const p = prods.find(x => x.id == id); if (!p) return;
  if (!cart[id]) cart[id] = { id: p.id, name: p.name, price: parseFloat(p.price), qty: 0 };`;
const P1_NEW =
`function addItem(id) {
  const p = prods.find(x => x.id == id); if (!p) return;
  if (p.sold_by_weight) { openWeightModal(id); return; }
  if (!cart[id]) cart[id] = { id: p.id, name: p.name, price: parseFloat(p.price), qty: 0 };`;

// ── P2: redrawCart() — show grams + edit/remove for weight items ──────────
const P2_OLD =
`  document.getElementById('cartList').innerHTML = hasItems
    ? items.map(i => \`<div class="ci">
        <span class="ci-name">\${i.name}</span>
        <div class="ci-qty">
          <button class="q-btn" onclick="adjQty('\${i.id}',-1)">&#8722;</button>
          <span class="ci-qty-num">\${i.qty}</span>
          <button class="q-btn" onclick="adjQty('\${i.id}',1)">+</button>
        </div>
        <span class="ci-line">\${CUR}\${(i.price*i.qty).toFixed(2)}</span>
      </div>\`).join('')
    : \`<div class="cart-empty">Cart is empty</div>\`;`;
const P2_NEW =
`  document.getElementById('cartList').innerHTML = hasItems
    ? items.map(i => i.isWeight ? \`<div class="ci">
        <span class="ci-name">\${i.name} <span style="font-size:11px;color:var(--muted)">(\${Math.round(i.qty*1000)}g)</span></span>
        <div class="ci-qty">
          <button class="q-btn" onclick="openWeightModal('\${i.id}')" title="Edit weight">&#9999;&#65039;</button>
          <button class="q-btn" onclick="delete cart['\${i.id}']; redrawCart();" title="Remove">&#10005;</button>
        </div>
        <span class="ci-line">\${CUR}\${(i.price*i.qty).toFixed(2)}</span>
      </div>\` : \`<div class="ci">
        <span class="ci-name">\${i.name}</span>
        <div class="ci-qty">
          <button class="q-btn" onclick="adjQty('\${i.id}',-1)">&#8722;</button>
          <span class="ci-qty-num">\${i.qty}</span>
          <button class="q-btn" onclick="adjQty('\${i.id}',1)">+</button>
        </div>
        <span class="ci-line">\${CUR}\${(i.price*i.qty).toFixed(2)}</span>
      </div>\`).join('')
    : \`<div class="cart-empty">Cart is empty</div>\`;`;

// ── P3: weight modal HTML — before </body> ─────────────────────────────────
const P3_OLD = `</body>\n</html>`;
const P3_NEW =
`<!-- WEIGHT INPUT MODAL (sold-by-weight products) -->
<div class="modal" id="weightModal">
  <div class="mbox" style="width:min(360px,100%)">
    <h3 id="weightModalTitle">&#9878;&#65039; Enter Weight</h3>
    <p style="font-size:12px;color:var(--muted);margin-bottom:12px" id="weightPricePerKg"></p>
    <div class="field">
      <label>Weight (grams)</label>
      <input id="weightGrams" type="number" min="1" step="1" placeholder="e.g. 200" oninput="updateWeightPreview()">
    </div>
    <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
      <button type="button" class="btn btn-ghost btn-sm" onclick="setWeightGrams(250)">250g</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="setWeightGrams(500)">500g</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="setWeightGrams(1000)">1kg</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="setWeightGrams(2000)">2kg</button>
    </div>
    <div style="text-align:center;font-size:24px;font-weight:800;color:var(--accent);margin-bottom:14px" id="weightPriceTotal"></div>
    <div class="m-actions">
      <button class="btn btn-ghost" onclick="closeModal('weightModal')">Cancel</button>
      <button class="btn btn-accent" onclick="confirmWeightAdd()">Add to Cart</button>
    </div>
  </div>
</div>

<script>
let _weightProdId = null;
function openWeightModal(id) {
  const p = prods.find(x => x.id == id); if (!p) return;
  _weightProdId = id;
  document.getElementById('weightModalTitle').textContent = '\\u2696\\uFE0F ' + p.name;
  document.getElementById('weightPricePerKg').textContent = CUR + parseFloat(p.price).toFixed(2) + ' per kilo';
  const existing = cart[id];
  document.getElementById('weightGrams').value = existing ? Math.round(existing.qty * 1000) : '';
  updateWeightPreview();
  document.getElementById('weightModal').classList.add('show');
  setTimeout(() => document.getElementById('weightGrams').focus(), 50);
}
function setWeightGrams(g) {
  document.getElementById('weightGrams').value = g;
  updateWeightPreview();
}
function updateWeightPreview() {
  const p = prods.find(x => x.id == _weightProdId); if (!p) return;
  const grams = parseFloat(document.getElementById('weightGrams').value) || 0;
  const total = (parseFloat(p.price) / 1000) * grams;
  document.getElementById('weightPriceTotal').textContent = CUR + total.toFixed(2);
}
function confirmWeightAdd() {
  const p = prods.find(x => x.id == _weightProdId); if (!p) return;
  const grams = parseFloat(document.getElementById('weightGrams').value) || 0;
  if (grams <= 0) { showToast('Enter a valid weight.', true); return; }
  const qtyKg = grams / 1000;
  cart[p.id] = { id: p.id, name: p.name, price: parseFloat(p.price), qty: qtyKg, isWeight: true };
  redrawCart();
  closeModal('weightModal');
  _weightProdId = null;
}
</script>
</body>
</html>`;

const PATCHES = [
  ['P1-additem',  P1_OLD, P1_NEW],
  ['P2-cart',     P2_OLD, P2_NEW],
  ['P3-modal',    P3_OLD, P3_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('openWeightModal')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
