// upgrade_weight_modal_dual_input.js
// Upgrades the weight-input popup to support TWO ways of buying: by weight
// (grams) OR by peso amount (e.g. "₱200 worth") — typing either field
// auto-calculates the other, since many customers ask for "200 pesos lang"
// rather than a specific weight.
// Run: node scripts/upgrade_weight_modal_dual_input.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = ['cashier-lechon.html', 'cashier-bigasan.html'];

const OLD =
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

const NEW =
`<!-- WEIGHT INPUT MODAL (sold-by-weight products) -->
<div class="modal" id="weightModal">
  <div class="mbox" style="width:min(380px,100%)">
    <h3 id="weightModalTitle">&#9878;&#65039; Enter Weight</h3>
    <p style="font-size:12px;color:var(--muted);margin-bottom:12px" id="weightPricePerKg"></p>
    <div class="row2">
      <div class="field">
        <label>Weight (grams)</label>
        <input id="weightGrams" type="number" min="1" step="1" placeholder="e.g. 200" oninput="onWeightGramsInput()">
      </div>
      <div class="field">
        <label>Or Amount (&#8369;)</label>
        <input id="weightAmount" type="number" min="1" step="1" placeholder="e.g. 200" oninput="onWeightAmountInput()">
      </div>
    </div>
    <div style="font-size:11px;color:var(--dim);margin-bottom:10px">Type either box &mdash; the other fills in automatically.</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Quick weight:</div>
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      <button type="button" class="btn btn-ghost btn-sm" onclick="setWeightGrams(250)">250g</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="setWeightGrams(500)">500g</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="setWeightGrams(1000)">1kg</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="setWeightGrams(2000)">2kg</button>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Quick amount:</div>
    <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
      <button type="button" class="btn btn-ghost btn-sm" onclick="setWeightAmount(100)">&#8369;100</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="setWeightAmount(200)">&#8369;200</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="setWeightAmount(300)">&#8369;300</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="setWeightAmount(500)">&#8369;500</button>
    </div>
    <div style="text-align:center;font-size:24px;font-weight:800;color:var(--accent);margin-bottom:14px" id="weightPriceTotal"></div>
    <div class="m-actions">
      <button class="btn btn-ghost" onclick="closeModal('weightModal')">Cancel</button>
      <button class="btn btn-accent" onclick="confirmWeightAdd()">Add to Cart</button>
    </div>
  </div>
</div>

<script>
let _weightProdId = null, _weightPricePerKg = 0;
function openWeightModal(id) {
  const p = prods.find(x => x.id == id); if (!p) return;
  _weightProdId = id;
  _weightPricePerKg = parseFloat(p.price) || 0;
  document.getElementById('weightModalTitle').textContent = '\\u2696\\uFE0F ' + p.name;
  document.getElementById('weightPricePerKg').textContent = CUR + _weightPricePerKg.toFixed(2) + ' per kilo';
  const existing = cart[id];
  document.getElementById('weightGrams').value = existing ? Math.round(existing.qty * 1000) : '';
  document.getElementById('weightAmount').value = existing ? (existing.price * existing.qty).toFixed(2) : '';
  updateWeightTotalDisplay();
  document.getElementById('weightModal').classList.add('show');
  setTimeout(() => document.getElementById('weightGrams').focus(), 50);
}
function onWeightGramsInput() {
  const grams = parseFloat(document.getElementById('weightGrams').value) || 0;
  const amount = (_weightPricePerKg / 1000) * grams;
  document.getElementById('weightAmount').value = amount > 0 ? amount.toFixed(2) : '';
  updateWeightTotalDisplay();
}
function onWeightAmountInput() {
  const amount = parseFloat(document.getElementById('weightAmount').value) || 0;
  const grams = _weightPricePerKg > 0 ? (amount / _weightPricePerKg) * 1000 : 0;
  document.getElementById('weightGrams').value = grams > 0 ? Math.round(grams) : '';
  updateWeightTotalDisplay();
}
function setWeightGrams(g) {
  document.getElementById('weightGrams').value = g;
  onWeightGramsInput();
}
function setWeightAmount(a) {
  document.getElementById('weightAmount').value = a;
  onWeightAmountInput();
}
function updateWeightTotalDisplay() {
  const amount = parseFloat(document.getElementById('weightAmount').value) || 0;
  document.getElementById('weightPriceTotal').textContent = CUR + amount.toFixed(2);
}
function confirmWeightAdd() {
  const p = prods.find(x => x.id == _weightProdId); if (!p) return;
  const grams = parseFloat(document.getElementById('weightGrams').value) || 0;
  if (grams <= 0) { showToast('Enter a valid weight or amount.', true); return; }
  const qtyKg = grams / 1000;
  cart[p.id] = { id: p.id, name: p.name, price: parseFloat(p.price), qty: qtyKg, isWeight: true };
  redrawCart();
  closeModal('weightModal');
  _weightProdId = null;
}
</script>
</body>
</html>`;

let patched = 0, skipped = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('onWeightAmountInput')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
