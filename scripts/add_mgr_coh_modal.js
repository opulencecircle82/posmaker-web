// add_mgr_coh_modal.js
// Adds a "View COH" button to the manager's row in the Staff table, opening
// a modal with the Net Cash with Manager breakdown + recent remittances list.
// Run: node scripts/add_mgr_coh_modal.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── P1: add "View COH" button on manager's row ─────────────────────────────
const P1_OLD = '${s.role===\'manager\'?`<button class="btn btn-sm" style="background:rgba(0,180,216,.15);color:#00b4d8;border:1px solid rgba(0,180,216,.3)" onclick="copyStaffLink()">&#128279; Link</button>`:\'\'}';
const P1_NEW = P1_OLD + '\n        ${s.role===\'manager\'?`<button class="btn btn-sm" style="background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3)" onclick="openMgrCohModal()">&#128181; View COH</button>`:\'\'}';

// ── P2: modal HTML before Receipt Viewer modal ─────────────────────────────
const P2_OLD = `<!-- RECEIPT VIEWER MODAL -->`;
const P2_NEW =
`<!-- MANAGER CASH ON HAND MODAL -->
<div class="modal" id="mgrCohModal">
  <div class="mbox" style="width:min(440px,100%)">
    <h3>&#128181; Manager Cash on Hand</h3>
    <div id="mgrCohModalContent" style="margin-top:10px">
      <div style="text-align:center;color:var(--muted);padding:20px">Loading...</div>
    </div>
    <div class="m-actions">
      <button class="btn btn-ghost" onclick="closeModal('mgrCohModal')">Close</button>
    </div>
  </div>
</div>

<!-- RECEIPT VIEWER MODAL -->`;

// ── P3: openMgrCohModal() function — inserted before loadManagerCash ──────
const P3_OLD = `// ── Manager Cash on Hand ─────────────────────────────────────────────────
async function loadManagerCash() {`;
const P3_NEW =
`// ── Manager Cash on Hand ─────────────────────────────────────────────────
async function openMgrCohModal() {
  if (!STORE) return;
  document.getElementById('mgrCohModal').classList.add('show');
  const el = document.getElementById('mgrCohModalContent');
  el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px">Loading...</div>';
  const { data } = await _sb.from('cash_remittances')
    .select('cashier_name,cash_on_hand,status,shift_date')
    .eq('store_id', STORE.id)
    .order('created_at', { ascending: false });
  const rows = data || [];
  if (!rows.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">No remittances recorded yet.</div>';
    return;
  }
  const adjStatuses = ['purchase','deposit'];
  const mgrRemitStatuses = ['mgr_remit'];
  const paymentStatuses = ['owner_payment','payment_confirmed'];
  const cashierRows  = rows.filter(r => !adjStatuses.includes(r.status) && !mgrRemitStatuses.includes(r.status) && !paymentStatuses.includes(r.status));
  const adjRows      = rows.filter(r => adjStatuses.includes(r.status));
  const mgrRemitRows = rows.filter(r => mgrRemitStatuses.includes(r.status));
  const confirmedStatuses = ['over','short','balanced'];
  const confirmedRows = cashierRows.filter(r => confirmedStatuses.includes(r.status));
  const pendingRows   = cashierRows.filter(r => r.status === 'pending');
  const confirmedTotal = confirmedRows.reduce((s,r) => s + parseFloat(r.cash_on_hand||0), 0);
  const pendingTotal   = pendingRows.reduce((s,r) => s + parseFloat(r.cash_on_hand||0), 0);
  const adjTotal       = adjRows.reduce((s,r) => s + parseFloat(r.cash_on_hand||0), 0);
  const mgrRemitTotal  = mgrRemitRows.reduce((s,r) => s + parseFloat(r.cash_on_hand||0), 0);
  const netTotal       = confirmedTotal + adjTotal + mgrRemitTotal;
  const purchaseTotal  = adjRows.filter(r=>r.status==='purchase').reduce((s,r)=>s+Math.abs(parseFloat(r.cash_on_hand||0)),0);
  const depositTotal   = adjRows.filter(r=>r.status==='deposit').reduce((s,r)=>s+parseFloat(r.cash_on_hand||0),0);

  const subLine = mgrRemitTotal<0
    ? CUR+confirmedTotal.toFixed(2)+' received &minus; '+CUR+Math.abs(mgrRemitTotal).toFixed(2)+' deposited to owner'
    : adjTotal<0
    ? CUR+confirmedTotal.toFixed(2)+' received &minus; '+CUR+purchaseTotal.toFixed(2)+' purchases'+(depositTotal>0?' + '+CUR+depositTotal.toFixed(2)+' deposit':'')
    : adjTotal>0
    ? CUR+confirmedTotal.toFixed(2)+' received + '+CUR+depositTotal.toFixed(2)+' deposit'
    : pendingTotal>0
    ? '+'+CUR+pendingTotal.toFixed(2)+' pending confirmation'
    : CUR+confirmedTotal.toFixed(2)+' received';

  const breakdownHtml = confirmedRows.length
    ? confirmedRows.slice(0,15).map(r => {
        const cash = parseFloat(r.cash_on_hand||0);
        const badge = r.status==='over' ? '<span style="color:#10b981;font-size:11px;margin-left:6px">Over</span>'
          : r.status==='short' ? '<span style="color:#ef4444;font-size:11px;margin-left:6px">Short</span>'
          : '<span style="color:var(--muted);font-size:11px;margin-left:6px">OK</span>';
        return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border)">'+
          '<span>'+r.cashier_name+' <span style="color:var(--dim)">'+(r.shift_date||'')+'</span>'+badge+'</span>'+
          '<span style="font-weight:600;color:#10b981">+'+CUR+cash.toFixed(2)+'</span></div>';
      }).join('')
    : '<div style="font-size:12px;color:var(--muted)">No cashier remittances yet.</div>';

  el.innerHTML = '<div style="background:var(--s2);border-radius:8px;padding:14px 16px;text-align:center;margin-bottom:14px">'+
    '<div style="font-size:11px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px;text-transform:uppercase">Net Cash with Manager</div>'+
    '<div style="font-size:28px;font-weight:800;color:#10b981">'+CUR+netTotal.toFixed(2)+'</div>'+
    '<div style="font-size:12px;color:var(--muted);margin-top:4px">'+subLine+'</div>'+
    '</div>'+
    '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Recent Remittances</div>'+
    '<div style="max-height:280px;overflow-y:auto">'+breakdownHtml+'</div>';
}

async function loadManagerCash() {`;

const PATCHES = [
  ['P1-button', P1_OLD, P1_NEW],
  ['P2-modal',  P2_OLD, P2_NEW],
  ['P3-fn',     P3_OLD, P3_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('openMgrCohModal')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
