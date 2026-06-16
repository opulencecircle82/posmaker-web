// patch_offline2.js — two extra offline fixes:
// 1. On activation, immediately cache full store data
// 2. On init with no STORE_ID offline, auto-recover from saved code map
// Run: node scripts/patch_offline2.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir).filter(f => /^cashier.*\.html$/.test(f)).sort();
const NL = '\r\n';

const patches = [

  // 1. After saving store code map in doActivateStore,
  //    immediately fetch + cache full store data before redirect
  [
    'Cache full store data on activation',
    "  localStorage.setItem('pm_store_id', store.id);" + NL +
    "  location.replace(location.pathname + '?store=' + store.id);",

    // Fetch full store in background so offline cache is ready immediately
    "  _sb.from('stores').select('*').eq('id',store.id).single().then(({data:_fs})=>{ if(_fs) try{localStorage.setItem('pm_cached_store_'+store.id,JSON.stringify(_fs));}catch(_){} });" + NL +
    "  localStorage.setItem('pm_store_id', store.id);" + NL +
    "  location.replace(location.pathname + '?store=' + store.id);"
  ],

  // 2. In init, if no STORE_ID and offline, auto-recover from pm_store_code_map
  [
    'Auto-recover STORE_ID from code map when offline',
    "  if (!STORE_ID) {" + NL +
    "    document.getElementById('loginWrap').style.display = 'none';" + NL +
    "    document.getElementById('activateWrap').classList.add('show');",

    // Before showing activation screen, try recovering from saved code map
    "  if (!STORE_ID && !navigator.onLine) { try { const _cm=JSON.parse(localStorage.getItem('pm_store_code_map')||'{}'); for(const _sid of Object.values(_cm)){ if(localStorage.getItem('pm_cached_store_'+_sid)){ STORE_ID=_sid; localStorage.setItem('pm_store_id',_sid); break; } } } catch(_){} }" + NL +
    "  if (!STORE_ID) {" + NL +
    "    document.getElementById('loginWrap').style.display = 'none';" + NL +
    "    document.getElementById('activateWrap').classList.add('show');"
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
