// patch_offline.js — adds offline caching to all cashier*.html files
// Run: node scripts/patch_offline.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir).filter(f => /^cashier.*\.html$/.test(f)).sort();

// Each entry: [description, searchStr, replaceStr]
// CRLF is used for line endings to match the repo's Windows convention.
const NL = '\r\n';

const patches = [

  // 1. Store fetch: add offline cache fallback
  [
    'Store fetch offline fallback',
    "const { data: store } = await _sb.from('stores').select('*').eq('id', STORE_ID).single();",
    "const { data: _rawStore } = await _sb.from('stores').select('*').eq('id', STORE_ID).single();" + NL +
    "  let store = _rawStore;" + NL +
    "  if (!store && !navigator.onLine) { try { const _cs=localStorage.getItem('pm_cached_store_'+STORE_ID); if(_cs) store=JSON.parse(_cs); } catch(_){} }"
  ],

  // 2. Cache store data after successful load
  [
    'Cache store data',
    "STORE = store; CUR = store.currency || '₱'; TAX = parseFloat(store.tax_rate) || 0;",
    "STORE = store; CUR = store.currency || '₱'; TAX = parseFloat(store.tax_rate) || 0;" + NL +
    "  try { localStorage.setItem('pm_cached_store_'+STORE_ID, JSON.stringify(store)); } catch(_) {}"
  ],

  // 3. IS_PRO: cache when online, restore from cache when offline
  [
    'IS_PRO cache/restore',
    "IS_PRO = await getStorePro(_sb, STORE.id);",
    "IS_PRO = await getStorePro(_sb, STORE.id);" + NL +
    "  if (navigator.onLine) { try { localStorage.setItem('pm_cached_pro_'+STORE_ID, JSON.stringify(IS_PRO)); } catch(_) {} } else { try { IS_PRO = JSON.parse(localStorage.getItem('pm_cached_pro_'+STORE_ID)||'false'); } catch(_) {} }"
  ],

  // 4. loadProds: if offline, load from cache at start of function
  [
    'loadProds offline cache check',
    "async function loadProds() {",
    "async function loadProds() {" + NL +
    "  if (!navigator.onLine) { try { const _cp=localStorage.getItem('pm_cached_prods_'+STORE_ID); if(_cp){prods=JSON.parse(_cp);buildCats();renderProds('All');return;} } catch(_){} }"
  ],

  // 5. Cache products (processed with inv stock) before MobileNet section
  [
    'Cache products before MobileNet',
    "  // Load MobileNet whenever products have images (no pre-computed embeddings needed)" + NL +
    "  if(!_mnModel && prods.some(p => p.image_b64)){",
    "  try { localStorage.setItem('pm_cached_prods_'+STORE_ID, JSON.stringify(prods.map(p=>({id:p.id,name:p.name,price:p.price,category:p.category,image_b64:p.image_b64||'',sku:p.sku||'',unit:p.unit||'pc',stock:p.stock||0,inv_links:p.inv_links||null,embeddings:p.embeddings||null})))); } catch(_) {}" + NL +
    "  // Load MobileNet whenever products have images (no pre-computed embeddings needed)" + NL +
    "  if(!_mnModel && prods.some(p => p.image_b64)){"
  ],

  // 6. Login: offline fallback using cached users
  [
    'Login offline fallback',
    "    if (qErr && qErr.code !== 'PGRST116') throw new Error(qErr.message);",
    "    if (qErr && !navigator.onLine) { try { const _cu=JSON.parse(localStorage.getItem('pm_cached_users_'+STORE_ID)||'[]'); const _cf=_cu.find(u=>u.username===username); if(_cf&&_cf.active){const _h=await sha256(pw);if(_cf.password_hash===_h){CASHIER=_cf;if(prods.length===0){const _cpd=localStorage.getItem('pm_cached_prods_'+STORE_ID);try{if(_cpd){prods=JSON.parse(_cpd);buildCats();renderProds('All');}}catch(_){}}showPOS(_cf.full_name||_cf.username);return;}else{errEl.textContent='Wrong password.';return;}} } catch(_){} errEl.textContent='Offline — log in once while online to enable offline access.'; return; }" + NL +
    "    if (qErr && qErr.code !== 'PGRST116') throw new Error(qErr.message);"
  ],

  // 7. Cache user credentials after successful online login
  [
    'Cache user on login',
    "    CASHIER = found;" + NL +
    "    _sb.rpc('log_staff_login',",
    "    CASHIER = found;" + NL +
    "    try { const _cu=JSON.parse(localStorage.getItem('pm_cached_users_'+STORE_ID)||'[]'); const _xi=_cu.findIndex(u=>u.id===found.id); if(_xi>=0)_cu[_xi]=found;else _cu.push(found); localStorage.setItem('pm_cached_users_'+STORE_ID,JSON.stringify(_cu)); } catch(_) {}" + NL +
    "    _sb.rpc('log_staff_login',"
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
