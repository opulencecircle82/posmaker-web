// revert_laundry_only_scope.js
// The mQty-backdrop and 2-copy-receipt changes were rolled out to all 24
// cashier-*.html files, but the user clarified these should be Laundry-only
// — revert both changes on the other 23 files, leaving cashier-laundry.html
// untouched.
// Run: node scripts/revert_laundry_only_scope.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier-.*\.html$/.test(f) && f !== 'cashier-laundry.html')
  .sort();

// ── mQty backdrop revert (same for all 24 files) ───────────────────────────
const MQTY_NEW = `<div id="mQty" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:500">
  <div class="mbox" style="width:min(300px,96vw);box-shadow:0 10px 40px rgba(0,0,0,.7)">`;
const MQTY_OLD = `<div class="modal" id="mQty">
  <div class="mbox" style="width:min(300px,96vw)">`;

const MQTY_SHOW_NEW = `document.getElementById('mQty').style.display = 'block';`;
const MQTY_SHOW_OLD = `document.getElementById('mQty').classList.add('show');`;

const MQTY_HIDE_NEW = `document.getElementById('mQty').style.display='none'`;
const MQTY_HIDE_OLD = `closeM('mQty')`;

// ── Receipt revert — standard (21 files) ───────────────────────────────────
const RECEIPT_NEW_STANDARD = `function buildReceiptText(d) {
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

const RECEIPT_OLD_STANDARD = `function buildReceiptText(d) {
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

const GLOBAL_NEW = `let discPct = 0, discAmt = 0;
let _lastReceiptData = null;`;
const GLOBAL_OLD = `let discPct = 0, discAmt = 0;`;

let patched = 0, errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');
  const fileErrs = [];

  // mQty revert
  if (c.includes(MQTY_NEW)) c = c.replace(MQTY_NEW, MQTY_OLD); else fileErrs.push('mQty-wrapper-not-found(skip)');
  if (c.includes(MQTY_SHOW_NEW)) c = c.replace(MQTY_SHOW_NEW, MQTY_SHOW_OLD);
  c = c.split(MQTY_HIDE_NEW).join(MQTY_HIDE_OLD);

  // Receipt revert (standard files only — bigasan/barbershop handled separately)
  if (c.includes(RECEIPT_NEW_STANDARD)) {
    c = c.replace(RECEIPT_NEW_STANDARD, RECEIPT_OLD_STANDARD);
    c = c.replace(GLOBAL_NEW, GLOBAL_OLD);
  } else {
    fileErrs.push('receipt-block-not-standard(needs manual revert)');
  }

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log((fileErrs.length ? '~  ' : '✓  ') + file + (fileErrs.length ? ' — ' + fileErrs.join(', ') : ''));
  patched++;
}

console.log(`\nDone: ${patched} files processed.`);
