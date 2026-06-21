// rollout_receipt_2copy_contact.js
// Built + validated in cashier-laundry.html: the printed receipt now shows
// the store's Phone/Address (contact details), prints a CUSTOMER COPY and
// an OWNER COPY back-to-back per order (page-break-before between them),
// and gives the Order # its own large centered line so the two slips are
// easy to match up later. Rolls the same change out to the other 23
// cashier-*.html files.
// Run: node scripts/rollout_receipt_2copy_contact.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier-.*\.html$/.test(f) && f !== 'cashier-laundry.html')
  .sort();

const OLD = `function buildReceiptText(d) {
  const ln = '─'.repeat(32);
  const store = STORE?.name || 'POSMaker';
  let s = store + '\\n';
  if (d.isKOT) s += '*** KITCHEN ORDER TICKET ***\\n';
  s += \`\${ln}\\nOrder #\${d.order_id}  \${new Date().toLocaleTimeString()}\\n\`;
  s += \`Type: \${d.orderType}\${d.tableNo ? ' | ' + d.tableNo : ''}\\n\`;
  s += \`Cashier: \${d.cashier}\\n\${ln}\\n\`;
  d.items.forEach(i => s += \`\${i.name}\\n  \${i.qty} x \${CUR}\${i.price.toFixed(2)} = \${CUR}\${(i.price*i.qty).toFixed(2)}\\n\`);
  s += \`\${ln}\\nSubtotal: \${CUR}\${d.sub.toFixed(2)}\\n\`;
  if (d.disc > 0) s += \`Discount: -\${CUR}\${d.disc.toFixed(2)}\\n\`;
  s += \`VAT:      \${CUR}\${d.tax.toFixed(2)}\\nTOTAL:    \${CUR}\${d.total.toFixed(2)}\\n\`;
  if (d.method === 'Cash') s += \`Cash:     \${CUR}\${d.tender.toFixed(2)}\\nChange:   \${CUR}\${d.change.toFixed(2)}\\n\`;
  else s += \`Paid via: \${d.method}\\n\`;
  s += \`\${ln}\\n\${STORE?.receipt_footer || 'Thank you!'}\`;
  return s;
}

function showReceipt(d) {
  document.getElementById('confirmTotal').textContent = CUR + d.total.toFixed(2);
  document.getElementById('confirmChange').textContent = d.method === 'Cash' ? 'Change: ' + CUR + d.change.toFixed(2) : '';
  document.getElementById('receiptTxt').textContent = buildReceiptText(d);
  document.getElementById('mConfirm').style.display = 'block';
}

function doPrint() {
  const txt = document.getElementById('receiptTxt').textContent;
  const w = window.open('', '', 'width=300,height=500');
  w.document.write('<pre style="font-family:monospace;font-size:12px">' + txt + '</pre>');
  w.print(); w.close();
  newOrder();
}`;

const NEW = `function buildReceiptText(d) {
  const ln = '─'.repeat(32);
  const store = STORE?.name || 'POSMaker';
  let s = store + '\\n';
  if (STORE?.phone)   s += \`Tel: \${STORE.phone}\\n\`;
  if (STORE?.address) s += \`\${STORE.address}\\n\`;
  if (d.isKOT) s += '*** KITCHEN ORDER TICKET ***\\n';
  s += \`\${ln}\\nOrder #\${d.order_id}  \${new Date().toLocaleTimeString()}\\n\`;
  s += \`Type: \${d.orderType}\${d.tableNo ? ' | ' + d.tableNo : ''}\\n\`;
  s += \`Cashier: \${d.cashier}\\n\${ln}\\n\`;
  d.items.forEach(i => s += \`\${i.name}\\n  \${i.qty} x \${CUR}\${i.price.toFixed(2)} = \${CUR}\${(i.price*i.qty).toFixed(2)}\\n\`);
  s += \`\${ln}\\nSubtotal: \${CUR}\${d.sub.toFixed(2)}\\n\`;
  if (d.disc > 0) s += \`Discount: -\${CUR}\${d.disc.toFixed(2)}\\n\`;
  s += \`VAT:      \${CUR}\${d.tax.toFixed(2)}\\nTOTAL:    \${CUR}\${d.total.toFixed(2)}\\n\`;
  if (d.method === 'Cash') s += \`Cash:     \${CUR}\${d.tender.toFixed(2)}\\nChange:   \${CUR}\${d.change.toFixed(2)}\\n\`;
  else s += \`Paid via: \${d.method}\\n\`;
  s += \`\${ln}\\n\${STORE?.receipt_footer || 'Thank you!'}\`;
  return s;
}

function _escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Printed copy — same info as buildReceiptText, but with the Order # blown
// up in its own large centered line (easier to match the customer slip
// against the owner slip later) and a copy label at the bottom.
function buildReceiptHTML(d, copyLabel) {
  const ln = '─'.repeat(32);
  const store = STORE?.name || 'POSMaker';
  let head = store + '\\n';
  if (STORE?.phone)   head += \`Tel: \${STORE.phone}\\n\`;
  if (STORE?.address) head += \`\${STORE.address}\\n\`;
  if (d.isKOT) head += '*** KITCHEN ORDER TICKET ***\\n';
  head += ln;

  let tail = \`\\n\${new Date().toLocaleTimeString()}\\n\`;
  tail += \`Type: \${d.orderType}\${d.tableNo ? ' | ' + d.tableNo : ''}\\n\`;
  tail += \`Cashier: \${d.cashier}\\n\${ln}\\n\`;
  d.items.forEach(i => tail += \`\${i.name}\\n  \${i.qty} x \${CUR}\${i.price.toFixed(2)} = \${CUR}\${(i.price*i.qty).toFixed(2)}\\n\`);
  tail += \`\${ln}\\nSubtotal: \${CUR}\${d.sub.toFixed(2)}\\n\`;
  if (d.disc > 0) tail += \`Discount: -\${CUR}\${d.disc.toFixed(2)}\\n\`;
  tail += \`VAT:      \${CUR}\${d.tax.toFixed(2)}\\nTOTAL:    \${CUR}\${d.total.toFixed(2)}\\n\`;
  if (d.method === 'Cash') tail += \`Cash:     \${CUR}\${d.tender.toFixed(2)}\\nChange:   \${CUR}\${d.change.toFixed(2)}\\n\`;
  else tail += \`Paid via: \${d.method}\\n\`;
  tail += \`\${ln}\\n\${STORE?.receipt_footer || 'Thank you!'}\\n\\n*** \${copyLabel} ***\`;

  return \`<pre style="font-family:monospace;font-size:12px;margin:0">\${_escHtml(head)}</pre>\`
       + \`<div style="font-size:22px;font-weight:800;text-align:center;margin:2px 0">Order #\${_escHtml(d.order_id)}</div>\`
       + \`<pre style="font-family:monospace;font-size:12px;margin:0">\${_escHtml(tail)}</pre>\`;
}

function showReceipt(d) {
  _lastReceiptData = d;
  document.getElementById('confirmTotal').textContent = CUR + d.total.toFixed(2);
  document.getElementById('confirmChange').textContent = d.method === 'Cash' ? 'Change: ' + CUR + d.change.toFixed(2) : '';
  document.getElementById('receiptTxt').textContent = buildReceiptText(d);
  document.getElementById('mConfirm').style.display = 'block';
}

// Prints two slips per order — customer copy first, then the owner's copy
// on its own page/section (page-break-before) — so the cashier never has to
// remember to print a second one for store records.
function doPrint() {
  const d = _lastReceiptData;
  const w = window.open('', '', 'width=300,height=600');
  w.document.write(
    '<div>' + buildReceiptHTML(d, 'CUSTOMER COPY') + '</div>'
    + '<div style="page-break-before:always">' + buildReceiptHTML(d, 'OWNER COPY') + '</div>'
  );
  w.print(); w.close();
  newOrder();
}`;

const GLOBAL_OLD = `let discPct = 0, discAmt = 0;`;
const GLOBAL_NEW = `let discPct = 0, discAmt = 0;
let _lastReceiptData = null;`;

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('_lastReceiptData')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  if (!c.includes(OLD)) fileErrs.push('receipt-block');
  if (!c.includes(GLOBAL_OLD)) fileErrs.push('global-decl');
  if (fileErrs.length) { errors[file] = fileErrs; console.log(`⚠  ${file}: missing ${fileErrs.join(', ')}`); continue; }

  c = c.replace(GLOBAL_OLD, GLOBAL_NEW);
  c = c.replace(OLD, NEW);

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (Object.keys(errors).length) {
  console.log('\nFiles with anchor errors (not modified):');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
