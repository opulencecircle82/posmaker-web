// compact_weight_modal.js
// Makes the weight modal smaller/more compact (calculator-popup style):
// narrower width, side-by-side grams/amount inputs, tighter spacing.
// Run: node scripts/compact_weight_modal.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = ['cashier-lechon.html', 'cashier-bigasan.html'];

const OLD =
`<div class="modal" id="weightModal">
  <div class="mbox" style="width:min(340px,96vw)">
    <div class="mtitle" id="weightModalTitle">&#9878;&#65039; Enter Weight</div>
    <div style="font-size:12px;color:#888;margin-bottom:12px" id="weightPricePerKg"></div>
    <label style="font-size:11px;color:#888;display:block;margin-bottom:4px">Weight (grams)</label>
    <input class="inp" id="weightGrams" type="number" min="1" step="1" placeholder="e.g. 200" oninput="onWeightGramsInput()">
    <label style="font-size:11px;color:#888;display:block;margin-bottom:4px">Or Amount (&#8369;)</label>
    <input class="inp" id="weightAmount" type="number" min="1" step="1" placeholder="e.g. 200" oninput="onWeightAmountInput()">
    <div style="font-size:11px;color:#666;margin-bottom:10px">Type either box &mdash; the other fills in automatically.</div>
    <div style="font-size:11px;color:#888;margin-bottom:4px">Quick weight:</div>
    <div style="display:flex;gap:5px;margin-bottom:10px">
      <button type="button" class="q-cash" onclick="setWeightGrams(250)">250g</button>
      <button type="button" class="q-cash" onclick="setWeightGrams(500)">500g</button>
      <button type="button" class="q-cash" onclick="setWeightGrams(1000)">1kg</button>
      <button type="button" class="q-cash" onclick="setWeightGrams(2000)">2kg</button>
    </div>
    <div style="font-size:11px;color:#888;margin-bottom:4px">Quick amount:</div>
    <div style="display:flex;gap:5px;margin-bottom:14px">
      <button type="button" class="q-cash" onclick="setWeightAmount(100)">&#8369;100</button>
      <button type="button" class="q-cash" onclick="setWeightAmount(200)">&#8369;200</button>
      <button type="button" class="q-cash" onclick="setWeightAmount(300)">&#8369;300</button>
      <button type="button" class="q-cash" onclick="setWeightAmount(500)">&#8369;500</button>
    </div>
    <div style="text-align:center;font-size:22px;font-weight:800;color:var(--accent);margin-bottom:14px" id="weightPriceTotal"></div>
    <div class="m-actions">
      <button class="btn-cancel" onclick="closeM('weightModal')">Cancel</button>
      <button class="btn-confirm" onclick="confirmWeightAdd()">Add to Cart</button>
    </div>
  </div>
</div>`;

const NEW =
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

let patched = 0, skipped = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('width:min(270px,92vw)')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
