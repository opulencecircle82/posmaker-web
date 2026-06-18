// validate_login_logout_idle.js
// Extracts every inline <script> block from the files touched by this
// feature batch (login/logout activity logging + idle auto-logout) and
// runs new Function() on each to catch syntax errors before calling it done.
// Run: node scripts/validate_login_logout_idle.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = [
  ...fs.readdirSync(dir).filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html'),
  ...fs.readdirSync(dir).filter(f => /^cashier-.*\.html$/.test(f) && f !== 'cashier_backup.html'),
  'manager.html',
  'staff-login.html',
].sort();

let ok = 0, fail = 0;
for (const f of files) {
  const fp = path.join(dir, f);
  const html = fs.readFileSync(fp, 'utf-8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(m => m[1])
    .filter(s => s.trim() && !s.includes('src='));
  let fileOk = true;
  scripts.forEach((s, i) => {
    try { new Function(s); }
    catch (e) { fileOk = false; console.log(`✗  ${f} [script #${i}]: ${e.message}`); }
  });
  if (fileOk) ok++; else fail++;
}
console.log(`\n${ok} files OK, ${fail} files with errors.`);
