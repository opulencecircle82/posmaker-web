// add_manager_cash_card.js
// Adds a "Manager Cash on Hand" card to the Staff section of all 25 dashboards.
// Same calculation logic as manager.html's loadCashSummary() — confirmed
// cashier remittances + purchase/deposit adjustments + manager-to-owner
// remittances — but readable directly by the owner without logging in as
// the manager.
// Run: node scripts/add_manager_cash_card.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── P1: HTML card after Helpers card, before sec-staff closes ─────────────
const P1_OLD =
`        <div id="helpersContent" style="padding:16px 20px">
          <div style="text-align:center;color:var(--muted);padding:20px">Loading...</div>
        </div>
      </div>
    </div>

    <!-- ACTIVITY LOG -->`;
const P1_NEW =
`        <div id="helpersContent" style="padding:16px 20px">
          <div style="text-align:center;color:var(--muted);padding:20px">Loading...</div>
        </div>
      </div>

      <!-- MANAGER CASH ON HAND CARD -->
      <div class="tbl-wrap" style="margin-top:16px" id="mgrCashCard">
        <div class="tbl-head">
          <h3>&#128181; Manager Cash on Hand</h3>
          <button class="btn btn-ghost btn-sm" onclick="loadManagerCash()">&#8635; Refresh</button>
        </div>
        <div id="mgrCashContent" style="padding:16px 20px">
          <div style="text-align:center;color:var(--muted);padding:20px">Loading...</div>
        </div>
      </div>
    </div>

    <!-- ACTIVITY LOG -->`;

// ── P2: trigger loadManagerCash() in staff nav ─────────────────────────────
const P2_OLD = "{ loadStaff(); updateMgrLink(); loadPerformance(); loadHelperStaff(); }";
const P2_NEW = "{ loadStaff(); updateMgrLink(); loadPerformance(); loadHelperStaff(); loadManagerCash(); }";

// ── P3: loadManagerCash() function — inserted before loadPerformance ──────
const P3_OLD = '// ── Staff Performance';
const P3_NEW =
`// ── Manager Cash on Hand ─────────────────────────────────────────────────
async function loadManagerCash() {
  const el = document.getElementById('mgrCashContent');
  if (!el || !STORE) return;
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

  el.innerHTML = '<div style="background:var(--s2);border-radius:8px;padding:14px 16px;text-align:center">'+
    '<div style="font-size:11px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px;text-transform:uppercase">Net Cash with Manager</div>'+
    '<div style="font-size:28px;font-weight:800;color:#10b981">'+CUR+netTotal.toFixed(2)+'</div>'+
    '<div style="font-size:12px;color:var(--muted);margin-top:4px">'+subLine+'</div>'+
    '</div>';
}

// ── Staff Performance`;

const PATCHES = [
  ['P1-html',  P1_OLD, P1_NEW],
  ['P2-nav',   P2_OLD, P2_NEW],
  ['P3-fn',    P3_OLD, P3_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('loadManagerCash')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
