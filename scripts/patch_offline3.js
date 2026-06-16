// patch_offline3.js — cache ALL offline data (store+products+users) at activation time
// Replace the background store-only fetch with a full eager cache before redirect
// Run: node scripts/patch_offline3.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir).filter(f => /^cashier.*\.html$/.test(f)).sort();
const NL = '\r\n';

// Replace the background store cache with a full eager pre-cache
const SEARCH =
  "  _sb.from('stores').select('*').eq('id',store.id).single().then(({data:_fs})=>{ if(_fs) try{localStorage.setItem('pm_cached_store_'+store.id,JSON.stringify(_fs));}catch(_){} });" + NL +
  "  localStorage.setItem('pm_store_id', store.id);" + NL +
  "  location.replace(location.pathname + '?store=' + store.id);";

// Eagerly await store + products + cashier users before redirecting
const REPLACE =
  "  // Pre-cache everything so POS works immediately offline after first Connect" + NL +
  "  btn.innerHTML='<span class=\"spinner\"></span> Setting up offline…';" + NL +
  "  try {" + NL +
  "    const [_sfull,_sp,_su]=await Promise.all([" + NL +
  "      _sb.from('stores').select('*').eq('id',store.id).single()," + NL +
  "      _sb.from('products').select('id,name,price,category,image_b64,sku,unit,stock,inv_links,embeddings').eq('store_id',store.id).eq('available',true).order('category').order('name')," + NL +
  "      _sb.from('store_users').select('id,username,full_name,role,password_hash,active').eq('store_id',store.id)" + NL +
  "    ]);" + NL +
  "    if(_sfull.data) localStorage.setItem('pm_cached_store_'+store.id,JSON.stringify(_sfull.data));" + NL +
  "    if(_sp.data) localStorage.setItem('pm_cached_prods_'+store.id,JSON.stringify(_sp.data.map(p=>({id:p.id,name:p.name,price:p.price,category:p.category,image_b64:p.image_b64||'',sku:p.sku||'',unit:p.unit||'pc',stock:p.stock||0,inv_links:p.inv_links||null,embeddings:p.embeddings||null}))));" + NL +
  "    if(_su.data) localStorage.setItem('pm_cached_users_'+store.id,JSON.stringify(_su.data));" + NL +
  "    const _pro=await _sb.rpc('get_store_pro_status',{p_store_id:store.id}); localStorage.setItem('pm_cached_pro_'+store.id,JSON.stringify(!!_pro.data));" + NL +
  "  } catch(_) {}" + NL +
  "  localStorage.setItem('pm_store_id', store.id);" + NL +
  "  location.replace(location.pathname + '?store=' + store.id);";

let totalPatched = 0, totalErrors = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  const count = content.split(SEARCH).length - 1;
  if (count === 0) {
    console.log(`⚠  ${file}: anchor not found`);
    totalErrors++;
    continue;
  }
  if (count > 1) {
    console.log(`⚠  ${file}: multiple matches (${count}) — skipped`);
    totalErrors++;
    continue;
  }

  content = content.replace(SEARCH, REPLACE);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`✓  ${file}`);
  totalPatched++;
}

console.log(`\nDone: ${totalPatched} patched, ${totalErrors} issues.`);
