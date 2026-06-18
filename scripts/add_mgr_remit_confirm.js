// add_mgr_remit_confirm.js
// Fixes the "Deposit to owner" status badge (was wrongly showing Short/Over
// based purely on the negative cash_on_hand difference) and adds an
// owner-side "Confirm Received" action in the Activity Log: deposits start
// as "Under Review", and once the owner clicks Confirm, the status becomes
// "Confirmed" — visible both in the dashboard Activity Log and the
// manager's own Cash Remit table.
// Run: node scripts/add_mgr_remit_confirm.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── P1: declare _mgrRemitConfirm alongside _receiptCache ──────────────────
const P1_OLD = `const _receiptCache = {};`;
const P1_NEW = `const _receiptCache = {};\nlet _mgrRemitConfirm = {};`;

// ── P2: fetch confirmation status for MGR_REMIT entries after loading logs ──
const P2_OLD = `  _activityLogs = data || [];`;
const P2_NEW =
`  _activityLogs = data || [];
  // Look up owner_confirmed status for any "Deposit to owner" entries (linked via cr_id)
  _mgrRemitConfirm = {};
  const _crIds = [];
  _activityLogs.forEach(l => {
    if (l.action === 'MGR_REMIT' && l.details) {
      try { const d = JSON.parse(l.details); if (d.cr_id) _crIds.push(d.cr_id); } catch(_) {}
    }
  });
  if (_crIds.length) {
    const { data: _crRows } = await _sb.from('cash_remittances').select('id,owner_confirmed').in('id', _crIds);
    (_crRows || []).forEach(r => { _mgrRemitConfirm[r.id] = !!r.owner_confirmed; });
  }`;

// ── P3: MGR_REMIT details rendering — filter cr_id + add confirm button ───
const P3_OLD =
`        if (l.action === 'MGR_REMIT') {
          details = filtered.map(([k,v]) => {
            if (k === 'amount') return 'amount: <span style="color:#39ff14;font-weight:700">₱' + parseFloat(v).toFixed(2) + '</span>';
            if (k === 'note')   return '<span style="color:#00e5ff;font-weight:700">' + v + '</span>';
            return k + ': ' + v;
          }).join(' &bull; ');
        } else if (l.action === 'OWNER_SEND' || l.action === 'SALARY_GIVEN' || l.action === 'EXPENSE_PAID') {`;
const P3_NEW =
`        if (l.action === 'MGR_REMIT') {
          const _crId = d.cr_id;
          details = filtered.filter(([k]) => k !== 'cr_id').map(([k,v]) => {
            if (k === 'amount') return 'amount: <span style="color:#39ff14;font-weight:700">₱' + parseFloat(v).toFixed(2) + '</span>';
            if (k === 'note')   return '<span style="color:#00e5ff;font-weight:700">' + v + '</span>';
            return k + ': ' + v;
          }).join(' &bull; ');
          if (_crId) {
            details += _mgrRemitConfirm[_crId]
              ? ' <span class="badge" style="background:#0d2e1f;color:#10b981;margin-left:6px">&#10003; Confirmed</span>'
              : ' <button class="btn btn-sm" style="background:#facc15;color:#1a1500;font-weight:700;margin-left:6px" onclick="confirmMgrDeposit(\\'' + _crId + '\\',this)">&#10003; Confirm Received</button>';
          }
        } else if (l.action === 'OWNER_SEND' || l.action === 'SALARY_GIVEN' || l.action === 'EXPENSE_PAID') {`;

// ── P4: confirmMgrDeposit() function — inserted before loadActivityLog ────
const P4_OLD = `async function loadActivityLog() {`;
const P4_NEW =
`async function confirmMgrDeposit(crId, btnEl) {
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Confirming…'; }
  const { error } = await _sb.from('cash_remittances').update({ owner_confirmed: true }).eq('id', crId);
  if (error) { showToast('Error: ' + error.message, true); if (btnEl) { btnEl.disabled = false; btnEl.textContent = '✓ Confirm Received'; } return; }
  _mgrRemitConfirm[crId] = true;
  showToast('Deposit confirmed as received.');
  renderActivityLog();
}
async function loadActivityLog() {`;

const PATCHES = [
  ['P1-decl', P1_OLD, P1_NEW],
  ['P2-fetch', P2_OLD, P2_NEW],
  ['P3-render', P3_OLD, P3_NEW],
  ['P4-fn', P4_OLD, P4_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('confirmMgrDeposit')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
