// floating_weight_widget.js
// Converts the weight popup from a full-screen ".modal" (dark backdrop
// covering the whole POS) into a small standalone floating widget with NO
// backdrop — the rest of the POS stays visible/uncovered behind it.
// Run: node scripts/floating_weight_widget.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = ['cashier-lechon.html', 'cashier-bigasan.html'];

const OLD =
`<div class="modal" id="weightModal">
  <div class="mbox" style="width:min(270px,92vw);padding:16px">
    <div class="mtitle" id="weightModalTitle" style="font-size:14px;margin-bottom:4px">&#9878;&#65039; Enter Weight</div>
    <div style="font-size:11px;color:#888;margin-bottom:10px" id="weightPricePerKg"></div>
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <div style="flex:1">
        <label style="font-size:10px;color:#888;display:block;margin-bottom:3px">Grams</label>
        <input class="inp" id="weightGrams" type="number" min="1" step="1" placeholder="200" oninput="onWeightGramsInput()" style="margin-bottom:0;padding:8px 6px;text-align:center;font-size:14px">
      </div>
      <div style="flex:1">
        <label style="font-size:10px;color:#888;display:block;margin-bottom:3px">Or &#8369;</label>
        <input class="inp" id="weightAmount" type="number" min="1" step="1" placeholder="200" oninput="onWeightAmountInput()" style="margin-bottom:0;padding:8px 6px;text-align:center;font-size:14px">
      </div>
    </div>
    <div style="display:flex;gap:4px;margin-bottom:5px">
      <button type="button" class="q-cash" onclick="setWeightGrams(250)">250g</button>
      <button type="button" class="q-cash" onclick="setWeightGrams(500)">500g</button>
      <button type="button" class="q-cash" onclick="setWeightGrams(1000)">1kg</button>
    </div>
    <div style="display:flex;gap:4px;margin-bottom:10px">
      <button type="button" class="q-cash" onclick="setWeightAmount(100)">&#8369;100</button>
      <button type="button" class="q-cash" onclick="setWeightAmount(200)">&#8369;200</button>
      <button type="button" class="q-cash" onclick="setWeightAmount(300)">&#8369;300</button>
    </div>
    <div style="text-align:center;font-size:20px;font-weight:800;color:var(--accent);margin-bottom:10px" id="weightPriceTotal"></div>
    <div class="m-actions">
      <button class="btn-cancel" onclick="closeM('weightModal')">Cancel</button>
      <button class="btn-confirm" onclick="confirmWeightAdd()">Add to Cart</button>
    </div>
  </div>
</div>`;

const NEW =
`<!-- Standalone floating widget — NO dark backdrop, rest of POS stays visible -->
<div id="weightModal" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:500;background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:16px;width:min(270px,92vw);box-shadow:0 10px 40px rgba(0,0,0,.7)">
    <div class="mtitle" id="weightModalTitle" style="font-size:14px;margin-bottom:4px">&#9878;&#65039; Enter Weight</div>
    <div style="font-size:11px;color:#888;margin-bottom:10px" id="weightPricePerKg"></div>
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <div style="flex:1">
        <label style="font-size:10px;color:#888;display:block;margin-bottom:3px">Grams</label>
        <input class="inp" id="weightGrams" type="number" min="1" step="1" placeholder="200" oninput="onWeightGramsInput()" style="margin-bottom:0;padding:8px 6px;text-align:center;font-size:14px">
      </div>
      <div style="flex:1">
        <label style="font-size:10px;color:#888;display:block;margin-bottom:3px">Or &#8369;</label>
        <input class="inp" id="weightAmount" type="number" min="1" step="1" placeholder="200" oninput="onWeightAmountInput()" style="margin-bottom:0;padding:8px 6px;text-align:center;font-size:14px">
      </div>
    </div>
    <div style="display:flex;gap:4px;margin-bottom:5px">
      <button type="button" class="q-cash" onclick="setWeightGrams(250)">250g</button>
      <button type="button" class="q-cash" onclick="setWeightGrams(500)">500g</button>
      <button type="button" class="q-cash" onclick="setWeightGrams(1000)">1kg</button>
    </div>
    <div style="display:flex;gap:4px;margin-bottom:10px">
      <button type="button" class="q-cash" onclick="setWeightAmount(100)">&#8369;100</button>
      <button type="button" class="q-cash" onclick="setWeightAmount(200)">&#8369;200</button>
      <button type="button" class="q-cash" onclick="setWeightAmount(300)">&#8369;300</button>
    </div>
    <div style="text-align:center;font-size:20px;font-weight:800;color:var(--accent);margin-bottom:10px" id="weightPriceTotal"></div>
    <div class="m-actions">
      <button class="btn-cancel" onclick="closeWeightModal()">Cancel</button>
      <button class="btn-confirm" onclick="confirmWeightAdd()">Add to Cart</button>
    </div>
</div>`;

const J_OLD = `document.getElementById('weightModal').classList.add('show');`;
const J_NEW = `document.getElementById('weightModal').style.display = 'block';`;

const J2_OLD =
`function confirmWeightAdd() {
  const p = prods.find(x => x.id == _weightProdId); if (!p) return;
  const grams = parseFloat(document.getElementById('weightGrams').value) || 0;
  if (grams <= 0) { showToast('Enter a valid weight or amount.', true); return; }
  const qtyKg = grams / 1000;
  cart[p.id] = { id: p.id, name: p.name, price: parseFloat(p.price), qty: qtyKg, isWeight: true };
  redrawCart();
  closeM('weightModal');
  _weightProdId = null;
}`;
const J2_NEW =
`function closeWeightModal() {
  document.getElementById('weightModal').style.display = 'none';
  _weightProdId = null;
}
function confirmWeightAdd() {
  const p = prods.find(x => x.id == _weightProdId); if (!p) return;
  const grams = parseFloat(document.getElementById('weightGrams').value) || 0;
  if (grams <= 0) { showToast('Enter a valid weight or amount.', true); return; }
  const qtyKg = grams / 1000;
  cart[p.id] = { id: p.id, name: p.name, price: parseFloat(p.price), qty: qtyKg, isWeight: true };
  redrawCart();
  closeWeightModal();
}`;

const PATCHES = [
  ['P1-html', OLD, NEW],
  ['P2-show', J_OLD, J_NEW],
  ['P3-close', J2_OLD, J2_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('closeWeightModal')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
