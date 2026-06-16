// patch_activation_offline.js — offline store code activation + fix placeholder
// Run: node scripts/patch_activation_offline.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir).filter(f => /^cashier.*\.html$/.test(f)).sort();

const NL = '\r\n';

const patches = [

  // 1. Change placeholder from LECHON1234 to STORE1234
  [
    'Placeholder example',
    'placeholder="e.g. LECHON1234"',
    'placeholder="e.g. STORE1234"'
  ],

  // 2. Save store code → ID mapping after successful activation
  [
    'Save store code map on activation',
    "  localStorage.setItem('pm_store_id', store.id);",
    "  try { const _cm=JSON.parse(localStorage.getItem('pm_store_code_map')||'{}'); _cm[raw]=store.id; localStorage.setItem('pm_store_code_map',JSON.stringify(_cm)); } catch(_) {}" + NL +
    "  localStorage.setItem('pm_store_id', store.id);"
  ],

  // 3. Add offline fallback at start of doActivateStore (after the empty check)
  [
    'Offline activation fallback',
    "  if (!raw || raw.length < 4) { err.textContent = 'Please enter your store code.'; return; }" + NL + NL +
    "  btn.disabled = true;",
    "  if (!raw || raw.length < 4) { err.textContent = 'Please enter your store code.'; return; }" + NL + NL +
    "  if (!navigator.onLine) { try { const _cm=JSON.parse(localStorage.getItem('pm_store_code_map')||'{}'); const _sid=_cm[raw]; if(_sid&&localStorage.getItem('pm_cached_store_'+_sid)){localStorage.setItem('pm_store_id',_sid);location.replace(location.pathname+'?store='+_sid);return;} } catch(_){} err.textContent='Offline — connect to internet first to set up this device.'; return; }" + NL + NL +
    "  btn.disabled = true;"
  ],

];

let totalPatched = 0;
let totalErrors = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  const issues = [];

  for (const [desc, search, replace] of patches) {
    const count = content.split(search).length - 1;
    if (count === 0) {
      issues.push(`  MISSING: ${desc}`);
    } else if (count > 1) {
      issues.push(`  MULTIPLE(${count}): ${desc} — skipped`);
    } else {
      content = content.replace(search, replace);
      modified = true;
    }
  }

  if (issues.length > 0) {
    console.log(`\n⚠  ${file}:`);
    issues.forEach(i => console.log(i));
    totalErrors++;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓  ${file}`);
    totalPatched++;
  }
}

console.log(`\nDone: ${totalPatched} files patched, ${totalErrors} files with issues.`);
