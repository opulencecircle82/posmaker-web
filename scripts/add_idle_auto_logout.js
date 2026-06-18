// add_idle_auto_logout.js
// Auto-logs-out the Owner (dashboard-*.html) and Manager (manager.html)
// after 5 minutes of no mouse/keyboard/touch/scroll activity, by reusing
// each file's existing doLogout() function. Staff/cashier sessions are
// intentionally NOT included — a cashier mid-transaction with no mouse
// movement (e.g. waiting on a customer, using a barcode scanner) shouldn't
// get logged out, only the back-office owner/manager screens were asked for.
// Run: node scripts/add_idle_auto_logout.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');

const IDLE_BLOCK =
`
// ── Auto-logout after 5 min idle ───────────────────────────────────────────
let _idleTimer = null;
function _resetIdleTimer() {
  clearTimeout(_idleTimer);
  _idleTimer = setTimeout(() => { doLogout(); }, 5 * 60 * 1000);
}
['mousemove','mousedown','keydown','touchstart','scroll'].forEach(evt =>
  document.addEventListener(evt, _resetIdleTimer, { passive: true }));
_resetIdleTimer();
`;

function patchFile(fp, anchor, label) {
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');
  if (c.includes('_resetIdleTimer')) { console.log(`—  ${label}: already patched`); return; }
  if (!c.includes(anchor)) { console.log(`⚠  ${label}: anchor not found`); return; }
  c = c.replace(anchor, anchor + IDLE_BLOCK);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${label}`);
}

// ── 24 dashboard-*.html ──────────────────────────────────────────────────
const DASH_ANCHOR =
`async function doLogout() {
  await _sb.auth.signOut();
  localStorage.removeItem('pm_store_id');
  location.href = 'login.html';
}`;
const dashFiles = fs.readdirSync(dir)
  .filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();
for (const f of dashFiles) patchFile(path.join(dir, f), DASH_ANCHOR, f);

// ── manager.html ─────────────────────────────────────────────────────────
const MGR_ANCHOR =
`function doLogout(){
  if(_pingInterval){clearInterval(_pingInterval);_pingInterval=null;}
  if(MGR?.staff_id){
    _sb.rpc('log_staff_logout',{p_staff_id:MGR.staff_id}).then(() => {});
    _sb.from('activity_logs').insert({ store_id: MGR.store_id, actor_name: MGR.name, actor_role: MGR.role || 'manager', action: 'LOGOUT', target_name: MGR.name, details: JSON.stringify({ device: getDeviceLabel() }) }).then(() => {});
  }
  localStorage.removeItem('pm_mgr');
  goLogin();
}`;
patchFile(path.join(dir, 'manager.html'), MGR_ANCHOR, 'manager.html');
