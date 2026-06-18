// add_coh_to_staff_transfer.js
// Lets the owner transfer part of the manager's existing Cash on Hand
// directly into Staff Funds (no need to send new money) — e.g. COH is
// ₱4500, transfer ₱2000 to Staff Funds, COH becomes ₱2500 and the manager
// can use that ₱2000 for salary/expenses via the existing Staff Funds flow.
// Implemented as two linked cash_remittances rows: a positive 'owner_payment'
// entry (shows up in the existing Staff Funds list) and a negative
// 'coh_to_staff' entry (reduces Net Cash with Manager via the adjustment bucket).
// Run: node scripts/add_coh_to_staff_transfer.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── P1: include coh_to_staff in the adjustment bucket (2 occurrences per file) ──
const P1_OLD = `const adjStatuses = ['purchase','deposit'];`;
const P1_NEW = `const adjStatuses = ['purchase','deposit','coh_to_staff'];`;

// ── P2: add Transfer UI + dedicated total line, and the transfer function ──
const P2_OLD =
`  el.innerHTML = '<div style="background:var(--s2);border-radius:8px;padding:14px 16px;text-align:center;margin-bottom:14px">'+
    '<div style="font-size:11px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px;text-transform:uppercase">Net Cash with Manager</div>'+
    '<div style="font-size:28px;font-weight:800;color:#10b981">'+CUR+netTotal.toFixed(2)+'</div>'+
    '<div style="font-size:12px;color:var(--muted);margin-top:4px">'+subLine+'</div>'+
    '</div>'+
    '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Recent Remittances</div>'+
    '<div style="max-height:280px;overflow-y:auto">'+breakdownHtml+'</div>';
}`;
const P2_NEW =
`  const staffTransferTotal = rows.filter(r=>r.status==='coh_to_staff').reduce((s,r)=>s+Math.abs(parseFloat(r.cash_on_hand||0)),0);

  el.innerHTML = '<div style="background:var(--s2);border-radius:8px;padding:14px 16px;text-align:center;margin-bottom:14px">'+
    '<div style="font-size:11px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px;text-transform:uppercase">Net Cash with Manager</div>'+
    '<div style="font-size:28px;font-weight:800;color:#10b981">'+CUR+netTotal.toFixed(2)+'</div>'+
    '<div style="font-size:12px;color:var(--muted);margin-top:4px">'+subLine+'</div>'+
    (staffTransferTotal>0?'<div style="font-size:11px;color:#a855f7;margin-top:4px">'+CUR+staffTransferTotal.toFixed(2)+' total transferred to Staff Funds</div>':'')+
    '</div>'+
    '<div style="background:var(--s2);border-radius:8px;padding:12px 14px;margin-bottom:14px">'+
    '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Transfer to Staff Funds</div>'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Use part of this cash directly for salary/expenses instead of remitting it &mdash; no need to send new money.</div>'+
    '<div style="display:flex;gap:8px">'+
    '<input id="cohTransferAmt" type="number" min="0.01" max="'+netTotal+'" step="0.01" placeholder="Amount" style="flex:1;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px">'+
    '<button class="btn btn-accent btn-sm" onclick="transferCohToStaffFunds('+netTotal+')">Transfer</button>'+
    '</div>'+
    '</div>'+
    '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Recent Remittances</div>'+
    '<div style="max-height:280px;overflow-y:auto">'+breakdownHtml+'</div>';
}

async function transferCohToStaffFunds(maxAmount) {
  const inp = document.getElementById('cohTransferAmt');
  const amt = parseFloat(inp.value);
  if (!amt || amt <= 0) { showToast('Enter a valid amount.', true); return; }
  if (amt > maxAmount + 0.001) { showToast('Cannot transfer more than the current Net Cash with Manager.', true); return; }
  const today = new Date().toISOString().slice(0,10);
  const { error: e1 } = await _sb.from('cash_remittances').insert({
    store_id: STORE.id, cashier_name: 'Owner Transfer', shift_date: today,
    pos_sales: 0, cash_on_hand: amt, difference: amt,
    status: 'owner_payment', description: "Transferred from manager's Cash on Hand"
  });
  if (e1) { showToast('Error: ' + e1.message, true); return; }
  const { error: e2 } = await _sb.from('cash_remittances').insert({
    store_id: STORE.id, cashier_name: 'Owner Transfer', shift_date: today,
    pos_sales: 0, cash_on_hand: -amt, difference: -amt,
    status: 'coh_to_staff', description: 'Transferred to Staff Funds'
  });
  if (e2) { showToast('Error: ' + e2.message, true); return; }
  showToast(CUR + amt.toFixed(2) + ' transferred to Staff Funds.');
  openMgrCohModal();
}`;

const PATCHES = [
  ['P1-adj', P1_OLD, P1_NEW],
  ['P2-ui',  P2_OLD, P2_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('transferCohToStaffFunds')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  // P1 occurs twice identically — replace all
  if (c.includes(P1_OLD)) { c = c.split(P1_OLD).join(P1_NEW); } else { fileErrs.push('P1-adj'); }
  if (c.includes(P2_OLD)) { c = c.replace(P2_OLD, P2_NEW); } else { fileErrs.push('P2-ui'); }
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
