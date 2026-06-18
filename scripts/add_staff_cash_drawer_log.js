// add_staff_cash_drawer_log.js
// Upgrades the Staff "Login History" modal (viewStaffLogs) so each row is a
// full shift (login -> logout) instead of a bare login timestamp, and for
// cashiers shows the cash total for that shift:
//   - Open shift (no logout yet): live running total from `orders` since
//     login time, refreshed automatically every 20s while the modal is open
//     (no need to list every individual sale).
//   - Closed shift: the amount the cashier actually remitted at logout,
//     pulled from the cash_remittances row created by confirmRemitLogout()
//     right before the LOGOUT activity_logs entry.
// Logout timestamps come from the LOGIN/LOGOUT activity_logs entries added
// in the previous patch; login timestamps keep using staff_logs so existing
// login history isn't lost. Managers are shown login/logout only (no cash
// column) since they don't run a personal cash drawer.
// Run: node scripts/add_staff_cash_drawer_log.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── P1: Close button — also stop the polling interval ─────────────────────
const P1_OLD = `<button class="btn btn-ghost" onclick="closeModal('staffLogsModal')">Close</button>`;
const P1_NEW = `<button class="btn btn-ghost" onclick="closeStaffLogsModal()">Close</button>`;

// ── P2: replace viewStaffLogs() with the shift-aware version ──────────────
const P2_OLD =
`async function viewStaffLogs(staffId, username) {
  document.getElementById('staffLogsTitle').textContent = username + ' — Login History';
  document.getElementById('staffLogsBody').innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Loading...</div>';
  document.getElementById('staffLogsModal').classList.add('show');
  const { data, error } = await _sb.from('staff_logs')
    .select('login_at').eq('staff_id', staffId).order('login_at', { ascending: false }).limit(100);
  if (error || !data?.length) {
    document.getElementById('staffLogsBody').innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">No login records found.</div>';
    return;
  }
  document.getElementById('staffLogsBody').innerHTML = \`
    <table style="width:100%">
      <thead><tr><th>#</th><th>Date &amp; Time</th></tr></thead>
      <tbody>\${data.map((l,i) => \`<tr>
        <td style="color:var(--dim);font-size:12px">\${i+1}</td>
        <td>\${new Date(l.login_at).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'})}</td>
      </tr>\`).join('')}</tbody>
    </table>\`;
}`;

const P2_NEW =
`let _staffLogsPoll = null;
function closeStaffLogsModal() {
  closeModal('staffLogsModal');
  clearInterval(_staffLogsPoll); _staffLogsPoll = null;
}
async function viewStaffLogs(staffId, username) {
  document.getElementById('staffLogsTitle').textContent = username + ' — Login History';
  document.getElementById('staffLogsBody').innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">Loading...</div>';
  document.getElementById('staffLogsModal').classList.add('show');
  const staffRec = (allStaff||[]).find(s => s.id === staffId);
  const displayName = staffRec ? (staffRec.full_name || staffRec.username) : username;
  const role = staffRec ? staffRec.role : 'cashier';
  await renderStaffLogsBody(staffId, displayName, role);
  clearInterval(_staffLogsPoll);
  if (role !== 'manager') _staffLogsPoll = setInterval(() => renderStaffLogsBody(staffId, displayName, role), 20000);
}
async function renderStaffLogsBody(staffId, displayName, role) {
  const body = document.getElementById('staffLogsBody');
  const { data: logins, error } = await _sb.from('staff_logs')
    .select('login_at').eq('staff_id', staffId).order('login_at', { ascending: true }).limit(100);
  if (error || !logins?.length) {
    body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">No login records found.</div>';
    return;
  }
  const isCashier = role !== 'manager';
  let logoutTimes = [], remits = [];
  if (STORE?.id) {
    const { data: logoutData } = await _sb.from('activity_logs')
      .select('created_at').eq('store_id', STORE.id).eq('actor_name', displayName).eq('action', 'LOGOUT')
      .order('created_at', { ascending: true }).limit(100);
    logoutTimes = (logoutData||[]).map(l => l.created_at);
    if (isCashier) {
      const { data: remitData } = await _sb.from('cash_remittances')
        .select('created_at,cash_on_hand').eq('store_id', STORE.id).eq('cashier_name', displayName)
        .order('created_at', { ascending: true }).limit(200);
      remits = remitData || [];
    }
  }
  const loginTimes = logins.map(l => l.login_at);
  const shifts = loginTimes.map((loginAt, i) => {
    const nextLoginAt = loginTimes[i+1] || null;
    const logoutAt = logoutTimes.find(t => t > loginAt && (!nextLoginAt || t < nextLoginAt)) || null;
    return { loginAt, logoutAt };
  }).reverse(); // newest first

  // Live running total for the open shift (no logout yet) — sum of orders since login,
  // so the owner sees the current cash drawer total without listing each sale.
  const openShift = shifts.find(s => !s.logoutAt);
  let liveTotal = null;
  if (isCashier && openShift && STORE?.id) {
    const { data: ord } = await _sb.from('orders').select('total')
      .eq('store_id', STORE.id).eq('cashier_name', displayName).gte('timestamp', openShift.loginAt);
    liveTotal = (ord||[]).reduce((s,o) => s + (parseFloat(o.total)||0), 0);
  }

  body.innerHTML = \`
    <table style="width:100%">
      <thead><tr><th>#</th><th>Login</th><th>Logout</th>\${isCashier?'<th>Cash Drawer</th>':''}</tr></thead>
      <tbody>\${shifts.map((s,i) => {
        const loginStr = new Date(s.loginAt).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'});
        const logoutStr = s.logoutAt
          ? new Date(s.logoutAt).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'})
          : '<span style="color:#22c55e;font-weight:600">&#128994; Active</span>';
        let cashCell = '—';
        if (isCashier) {
          if (!s.logoutAt) {
            cashCell = liveTotal != null ? \`<span style="color:#22c55e;font-weight:600">\${CUR||'₱'}\${liveTotal.toFixed(2)}</span> <span style="color:var(--muted);font-size:11px">live</span>\` : '—';
          } else {
            const r = remits.filter(r => new Date(r.created_at).getTime() >= new Date(s.loginAt).getTime() && new Date(r.created_at).getTime() <= new Date(s.logoutAt).getTime() + 5000)
              .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
            cashCell = r ? \`\${CUR||'₱'}\${parseFloat(r.cash_on_hand).toFixed(2)} <span style="color:var(--muted);font-size:11px">remitted</span>\` : '<span style="color:var(--dim)">no remit</span>';
          }
        }
        return \`<tr>
        <td style="color:var(--dim);font-size:12px">\${i+1}</td>
        <td>\${loginStr}</td>
        <td>\${logoutStr}</td>
        \${isCashier?\`<td>\${cashCell}</td>\`:''}
      </tr>\`;
      }).join('')}</tbody>
    </table>\`;
}`;

const PATCHES = [
  ['P1-close', P1_OLD, P1_NEW],
  ['P2-view',  P2_OLD, P2_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('function renderStaffLogsBody')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
