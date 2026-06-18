// add_cashier_login_logout_logging.js
// Records staff LOGIN/LOGOUT into activity_logs (the table that feeds the
// owner dashboard's "Staff Activity Log") with a short device label
// (Desktop/Mobile/Tablet + OS + browser), so the owner can see who
// logged in/out and from what kind of device — not just the existing
// staff_logs/last_seen bookkeeping which never showed up in that log.
// Run: node scripts/add_cashier_login_logout_logging.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier-.*\.html$/.test(f) && f !== 'cashier_backup.html')
  .sort();

// ── P1: getDeviceLabel() helper, inserted right before doLogin() ──────────
const P1_OLD = `async function doLogin() {
  const username = document.getElementById('lu').value.trim().toLowerCase();`;
const P1_NEW =
`function getDeviceLabel() {
  const ua = navigator.userAgent || '';
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
  const isMobile = !isTablet && /iPhone|Android.*Mobile|Mobile.*Android/i.test(ua);
  const os = /Windows/i.test(ua) ? 'Windows' : /Macintosh|Mac OS X/i.test(ua) ? 'Mac' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Linux/i.test(ua) ? 'Linux' : 'Unknown';
  const browser = /Edg\\//.test(ua) ? 'Edge' : /OPR\\//.test(ua) ? 'Opera' : /Chrome\\//.test(ua) ? 'Chrome' : /Firefox\\//.test(ua) ? 'Firefox' : /Safari\\//.test(ua) ? 'Safari' : 'Browser';
  const type = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';
  return type + ' \\u00b7 ' + os + ' \\u00b7 ' + browser;
}
async function doLogin() {
  const username = document.getElementById('lu').value.trim().toLowerCase();`;

// ── P2: log LOGIN to activity_logs right after a successful online login ──
const P2_OLD = `    _sb.rpc('log_staff_login', { p_store_id: STORE_ID, p_staff_id: found.id, p_username: found.username }).then(() => {});`;
const P2_NEW =
`    _sb.rpc('log_staff_login', { p_store_id: STORE_ID, p_staff_id: found.id, p_username: found.username }).then(() => {});
    _sb.from('activity_logs').insert({ store_id: STORE_ID, actor_name: found.full_name || found.username, actor_role: found.role || 'cashier', action: 'LOGIN', target_name: found.full_name || found.username, details: JSON.stringify({ device: getDeviceLabel() }) }).then(() => {});`;

// ── P3: log LOGOUT to activity_logs in _actualLogout() while CASHIER is still set ──
const P3_OLD =
`function _actualLogout() {
  clearTimeout(_openScanTimer); _openScanTimer = null;
  if (_pingInterval) { clearInterval(_pingInterval); _pingInterval = null; }
  if (CASHIER?.id) _sb.rpc('log_staff_logout', { p_staff_id: CASHIER.id }).then(() => {});
  closeScanner();`;
const P3_NEW =
`function _actualLogout() {
  clearTimeout(_openScanTimer); _openScanTimer = null;
  if (_pingInterval) { clearInterval(_pingInterval); _pingInterval = null; }
  if (CASHIER?.id) {
    _sb.rpc('log_staff_logout', { p_staff_id: CASHIER.id }).then(() => {});
    _sb.from('activity_logs').insert({ store_id: STORE_ID, actor_name: CASHIER.full_name || CASHIER.username, actor_role: CASHIER.role || 'cashier', action: 'LOGOUT', target_name: CASHIER.full_name || CASHIER.username, details: JSON.stringify({ device: getDeviceLabel() }) }).then(() => {});
  }
  closeScanner();`;

const PATCHES = [
  ['P1-helper', P1_OLD, P1_NEW],
  ['P2-login',  P2_OLD, P2_NEW],
  ['P3-logout', P3_OLD, P3_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('function getDeviceLabel()')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
