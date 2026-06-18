// fix_weight_amount_precision.js
// Typing an exact peso amount (e.g. ₱1000) was getting converted to grams,
// ROUNDED to a whole gram (1429g), then converted back to price (₱1000.30)
// — losing precision. Now tracks which field the cashier actually typed in,
// and when it was the amount field, derives qty directly from amount/price
// (skipping the lossy gram-rounding round-trip) so the charged price always
// matches exactly what was typed.
// Run: node scripts/fix_weight_amount_precision.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = ['cashier-lechon.html', 'cashier-bigasan.html'];

const OLD =
`function onWeightGramsInput() {
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
function closeWeightModal() {
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

const NEW =
`let _weightLastField = 'grams'; // tracks which field the cashier actually typed in
function onWeightGramsInput() {
  _weightLastField = 'grams';
  const grams = parseFloat(document.getElementById('weightGrams').value) || 0;
  const amount = (_weightPricePerKg / 1000) * grams;
  document.getElementById('weightAmount').value = amount > 0 ? amount.toFixed(2) : '';
  updateWeightTotalDisplay();
}
function onWeightAmountInput() {
  _weightLastField = 'amount';
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
function closeWeightModal() {
  document.getElementById('weightModal').style.display = 'none';
  _weightProdId = null;
}
function confirmWeightAdd() {
  const p = prods.find(x => x.id == _weightProdId); if (!p) return;
  const grams  = parseFloat(document.getElementById('weightGrams').value) || 0;
  const amount = parseFloat(document.getElementById('weightAmount').value) || 0;
  if (grams <= 0) { showToast('Enter a valid weight or amount.', true); return; }
  const priceKg = parseFloat(p.price) || 0;
  // If the cashier typed the peso amount, charge exactly that amount instead
  // of re-deriving it from the rounded gram value (avoids a rounding drift).
  const qtyKg = (_weightLastField === 'amount' && amount > 0 && priceKg > 0) ? (amount / priceKg) : (grams / 1000);
  cart[p.id] = { id: p.id, name: p.name, price: priceKg, qty: qtyKg, isWeight: true };
  redrawCart();
  closeWeightModal();
}`;

let patched = 0, skipped = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('_weightLastField')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
