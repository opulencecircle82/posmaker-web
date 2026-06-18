// add_manager_login_logout_logging.js
// Records manager LOGIN (staff-login.html, only for role==='manager' — the
// cashier role already gets logged separately inside cashier-*.html's own
// doLogin(), so we don't double-log cashiers who arrive via this page) and
// manager LOGOUT (manager.html doLogout()) into activity_logs, with a
// device label, same as the cashier app.
// Run: node scripts/add_manager_login_logout_logging.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');

const DEVICE_HELPER =
`function getDeviceLabel() {
  const ua = navigator.userAgent || '';
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
  const isMobile = !isTablet && /iPhone|Android.*Mobile|Mobile.*Android/i.test(ua);
  const os = /Windows/i.test(ua) ? 'Windows' : /Macintosh|Mac OS X/i.test(ua) ? 'Mac' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Linux/i.test(ua) ? 'Linux' : 'Unknown';
  const browser = /Edg\\//.test(ua) ? 'Edge' : /OPR\\//.test(ua) ? 'Opera' : /Chrome\\//.test(ua) ? 'Chrome' : /Firefox\\//.test(ua) ? 'Firefox' : /Safari\\//.test(ua) ? 'Safari' : 'Browser';
  const type = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';
  return type + ' \\u00b7 ' + os + ' \\u00b7 ' + browser;
}
`;

function patchStaffLogin() {
  const fp = path.join(dir, 'staff-login.html');
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');
  if (c.includes('function getDeviceLabel()')) { console.log('—  staff-login.html: already patched'); return; }

  const H_OLD = `async function doLogin() {\n  const username = document.getElementById('username').value.trim();`;
  const H_NEW = DEVICE_HELPER + `async function doLogin() {\n  const username = document.getElementById('username').value.trim();`;

  const L_OLD =
`    await _sb.rpc('log_staff_login', { p_store_id: SID, p_staff_id: staff.id, p_username: staff.username });
    location.href = staff.role === 'manager' ? 'manager.html?sid=' + SID : 'cashier.html?store=' + SID;`;
  const L_NEW =
`    await _sb.rpc('log_staff_login', { p_store_id: SID, p_staff_id: staff.id, p_username: staff.username });
    if (staff.role === 'manager') {
      _sb.from('activity_logs').insert({ store_id: SID, actor_name: staff.full_name || staff.username, actor_role: 'manager', action: 'LOGIN', target_name: staff.full_name || staff.username, details: JSON.stringify({ device: getDeviceLabel() }) }).then(() => {});
    }
    location.href = staff.role === 'manager' ? 'manager.html?sid=' + SID : 'cashier.html?store=' + SID;`;

  const errs = [];
  if (c.includes(H_OLD)) c = c.replace(H_OLD, H_NEW); else errs.push('helper');
  if (c.includes(L_OLD)) c = c.replace(L_OLD, L_NEW); else errs.push('login-insert');

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(errs.length ? `⚠  staff-login.html: missing ${errs.join(', ')}` : '✓  staff-login.html');
}

function patchManager() {
  const fp = path.join(dir, 'manager.html');
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');
  if (c.includes('function getDeviceLabel()')) { console.log('—  manager.html: already patched'); return; }

  const D_OLD = `function doLogout(){ if(_pingInterval){clearInterval(_pingInterval);_pingInterval=null;} if(MGR?.staff_id) _sb.rpc('log_staff_logout',{p_staff_id:MGR.staff_id}).then(() => {}); localStorage.removeItem('pm_mgr'); goLogin(); }`;
  const D_NEW =
DEVICE_HELPER +
`function doLogout(){
  if(_pingInterval){clearInterval(_pingInterval);_pingInterval=null;}
  if(MGR?.staff_id){
    _sb.rpc('log_staff_logout',{p_staff_id:MGR.staff_id}).then(() => {});
    _sb.from('activity_logs').insert({ store_id: MGR.store_id, actor_name: MGR.name, actor_role: MGR.role || 'manager', action: 'LOGOUT', target_name: MGR.name, details: JSON.stringify({ device: getDeviceLabel() }) }).then(() => {});
  }
  localStorage.removeItem('pm_mgr');
  goLogin();
}`;

  if (!c.includes(D_OLD)) { console.log('⚠  manager.html: anchor not found'); return; }
  c = c.replace(D_OLD, D_NEW);

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log('✓  manager.html');
}

patchStaffLogin();
patchManager();
