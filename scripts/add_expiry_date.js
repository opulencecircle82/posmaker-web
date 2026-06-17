// add_expiry_date.js
// Adds expiry date + promo/sale to inventory items across all 25 dashboard files
// Run: node scripts/add_expiry_date.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── helpers ────────────────────────────────────────────────────────────────
function applyPatch(c, label, oldStr, newStr) {
  if (!c.includes(oldStr)) return { c, ok: false, label };
  return { c: c.replace(oldStr, newStr), ok: true, label };
}

// ── patch definitions (LF-normalized strings) ──────────────────────────────

// P1: table header — add Expiry column
const P1_OLD = '<thead><tr><th>SKU</th><th>Item Name</th><th>Category</th><th>Unit</th><th>Cost</th><th>Stock</th><th>Status</th><th></th></tr></thead>';
const P1_NEW = '<thead><tr><th>SKU</th><th>Item Name</th><th>Category</th><th>Unit</th><th>Cost</th><th>Stock</th><th>Status</th><th>Expiry</th><th></th></tr></thead>';

// P2: loading row colspan 8→9
const P2_OLD = '<tbody id="invTbody"><tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">Loading...</td></tr></tbody>';
const P2_NEW = '<tbody id="invTbody"><tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px">Loading...</td></tr></tbody>';

// P3: no-items row colspan 8→9
const P3_OLD = "if(!items.length){tbody.innerHTML='<tr><td colspan=\"8\" style=\"text-align:center;color:var(--muted);padding:24px\">No items. Click + Add Item.</td></tr>';return;}";
const P3_NEW = "if(!items.length){tbody.innerHTML='<tr><td colspan=\"9\" style=\"text-align:center;color:var(--muted);padding:24px\">No items. Click + Add Item.</td></tr>';return;}";

// P4: modal — add expiry + promo fields after invLowStockField
const P4_OLD = '    <div class="field" id="invLowStockField"><label>Low Stock Alert (qty)</label><input id="invLowStock" type="number" min="0" step="1" placeholder="e.g. 5" value="5"></div>\n    <div class="m-actions">';
const P4_NEW =
'    <div class="field" id="invLowStockField"><label>Low Stock Alert (qty)</label><input id="invLowStock" type="number" min="0" step="1" placeholder="e.g. 5" value="5"></div>\n' +
'    <div class="row2" id="invExpiryRow">\n' +
'      <div class="field">\n' +
'        <label>Expiry Date <span style="color:var(--dim);font-weight:400">(optional)</span></label>\n' +
'        <input id="invExpiry" type="date" style="width:100%;padding:10px 12px;background:var(--bg);border:1.5px solid var(--border);border-radius:7px;color:var(--text);font-size:14px;font-family:Inter,sans-serif;outline:none" oninput="checkInvExpiryPromo()">\n' +
'      </div>\n' +
'      <div class="field">\n' +
'        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">\n' +
'          <input type="checkbox" id="invOnPromo" onchange="toggleInvPromo()" style="width:auto;margin:0"> Mark as On Sale / Promo\n' +
'        </label>\n' +
'        <div id="invPromoFields" style="display:none;margin-top:8px">\n' +
'          <input id="invSalePrice" type="number" min="0" step="0.01" placeholder="Sale price (e.g. 29.00)" style="width:100%;padding:10px 12px;background:var(--bg);border:1.5px solid #f59e0b;border-radius:7px;color:var(--text);font-size:14px;font-family:Inter,sans-serif;outline:none">\n' +
'          <div id="invPromoHint" style="font-size:11px;color:#f59e0b;margin-top:5px"></div>\n' +
'        </div>\n' +
'      </div>\n' +
'    </div>\n' +
'    <div id="invExpiryAlert" style="display:none;background:#2a0a0a;border:1px solid #ef4444;border-radius:8px;padding:10px 14px;font-size:12px;color:#ef4444;margin-bottom:12px"></div>\n' +
'    <div class="m-actions">';

// P5: renderInv — add expiry computation + row background + name promo flag + expiry cell
const P5_OLD =
'    const rs=out?\'background:rgba(239,68,68,.04)\':low?\'background:rgba(245,158,11,.04)\':\'\';';
const P5_NEW =
'    const _expDate = i.expiry_date ? new Date(i.expiry_date + \'T00:00:00\') : null;\n' +
'    const _now = new Date(); _now.setHours(0,0,0,0);\n' +
'    const _daysLeft = _expDate ? Math.round((_expDate - _now) / 86400000) : null;\n' +
'    const _expired = _daysLeft !== null && _daysLeft < 0;\n' +
'    const _expCrit = _daysLeft !== null && _daysLeft >= 0 && _daysLeft <= 90;\n' +
'    const _expWarn = _daysLeft !== null && _daysLeft > 90 && _daysLeft <= 180;\n' +
'    const expiryCell = _expDate\n' +
'      ? (_expired\n' +
'          ? \'<span style="background:#2a0505;color:#ef4444;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700">EXPIRED</span>\'\n' +
'          : _expCrit\n' +
'            ? \'<span style="color:#ef4444;font-size:11px;font-weight:600">\' + i.expiry_date + \'<br><span style="font-size:10px">⚠ \' + _daysLeft + \'d left</span></span>\'\n' +
'            : _expWarn\n' +
'              ? \'<span style="color:#f59e0b;font-size:11px">\' + i.expiry_date + \'<br><span style="font-size:10px;color:var(--muted)">\' + _daysLeft + \'d left</span></span>\'\n' +
'              : \'<span style="color:var(--muted);font-size:11px">\' + i.expiry_date + \'</span>\')\n' +
'      : \'<span style="color:var(--dim);font-size:11px">&#8212;</span>\';\n' +
'    const promoTag = i.is_on_promo ? \' <span style="background:#1a0f00;color:#f59e0b;font-size:10px;padding:1px 5px;border-radius:3px;font-weight:700;vertical-align:middle">SALE</span>\' : \'\';\n' +
'    const rs = (_expired||_expCrit) ? \'background:rgba(239,68,68,.05)\' : _expWarn ? \'background:rgba(245,158,11,.03)\' : out ? \'background:rgba(239,68,68,.04)\' : low ? \'background:rgba(245,158,11,.04)\' : \'\';';

// P6: renderInv — update name cell to show promoTag
const P6_OLD = "      <td style=\"font-weight:600\">${i.name}${frozenInvIds.has(i.id)?frozenBadgeHtml():''}</td>";
const P6_NEW = "      <td style=\"font-weight:600\">${i.name}${promoTag}${frozenInvIds.has(i.id)?frozenBadgeHtml():''}</td>";

// P7: renderInv — add expiry cell before actions column
const P7_OLD = "      <td>${badge}</td>\n      <td style=\"white-space:nowrap\">";
const P7_NEW = "      <td>${badge}</td>\n      <td>${expiryCell}</td>\n      <td style=\"white-space:nowrap\">";

// P8: openInvModal — populate expiry/promo fields just before classList.add('show')
const P8_OLD = "  document.getElementById('invModal').classList.add('show');\n  setTimeout(()=>document.getElementById('invName').focus(),50);";
const P8_NEW =
"  document.getElementById('invExpiry').value = item ? (item.expiry_date || '') : '';\n" +
"  document.getElementById('invSalePrice').value = item ? (item.sale_price || '') : '';\n" +
"  document.getElementById('invOnPromo').checked = !!(item && item.is_on_promo);\n" +
"  document.getElementById('invPromoFields').style.display = (item && item.is_on_promo) ? '' : 'none';\n" +
"  document.getElementById('invExpiryAlert').style.display = 'none';\n" +
"  checkInvExpiryPromo();\n" +
"  document.getElementById('invModal').classList.add('show');\n" +
"  setTimeout(()=>document.getElementById('invName').focus(),50);";

// P9: saveInvItem — extend payload to include expiry + promo
const P9_OLD = "  const payload={name,sku,category:cat,unit,stock,cost_price:cost,low_stock_threshold:lowStock,default_usage_qty:usageQty,...(imgData?{image_b64:imgData}:{})};";
const P9_NEW =
"  const _expiry = document.getElementById('invExpiry').value || null;\n" +
"  const _onPromo = document.getElementById('invOnPromo').checked;\n" +
"  const _salePrice = _onPromo ? (parseFloat(document.getElementById('invSalePrice').value) || null) : null;\n" +
"  const payload={name,sku,category:cat,unit,stock,cost_price:cost,low_stock_threshold:lowStock,default_usage_qty:usageQty,...(imgData?{image_b64:imgData}:{}),expiry_date:_expiry,is_on_promo:_onPromo,sale_price:_salePrice};";

// P10: loadInventory — add expiry notification after renderInv
const P10_OLD =
"  renderInv(invItems);\n" +
"  updateAddBtnLabels();\n" +
"  const _isTrueServiceBiz=TRUE_SERVICE_BIZ.has(STORE?.business_type||'');\n" +
"  const _lsCount=invItems.filter(i=>!(_isTrueServiceBiz&&parseFloat(i.stock??0)===0)&&parseFloat(i.stock??0)<=parseFloat(i.low_stock_threshold??5)).length;\n" +
"  _updateLowStockBadge(_lsCount);";
const P10_NEW =
"  renderInv(invItems);\n" +
"  updateAddBtnLabels();\n" +
"  const _isTrueServiceBiz=TRUE_SERVICE_BIZ.has(STORE?.business_type||'');\n" +
"  const _lsCount=invItems.filter(i=>!(_isTrueServiceBiz&&parseFloat(i.stock??0)===0)&&parseFloat(i.stock??0)<=parseFloat(i.low_stock_threshold??5)).length;\n" +
"  _updateLowStockBadge(_lsCount);\n" +
"  // Expiry notification\n" +
"  const _today=new Date(); _today.setHours(0,0,0,0);\n" +
"  const _exp3mo=new Date(_today); _exp3mo.setMonth(_exp3mo.getMonth()+3);\n" +
"  const _expiringItems=invItems.filter(i=>i.expiry_date&&new Date(i.expiry_date+'T00:00:00')<=_exp3mo);\n" +
"  const _expiryBanner=document.getElementById('invExpiryBanner');\n" +
"  if(_expiryBanner){\n" +
"    if(_expiringItems.length){\n" +
"      const _expiredCount=_expiringItems.filter(i=>new Date(i.expiry_date+'T00:00:00')<_today).length;\n" +
"      const _soonCount=_expiringItems.length-_expiredCount;\n" +
"      const _parts=[];\n" +
"      if(_expiredCount) _parts.push('<span style=\"color:#ef4444;font-weight:700\">'+_expiredCount+' item'+('+_expiredCount>1?'s':'')+' EXPIRED</span>');\n" +
"      if(_soonCount) _parts.push('<span style=\"color:#f59e0b;font-weight:700\">'+_soonCount+' expiring within 3 months</span>');\n" +
"      _expiryBanner.innerHTML='<span style=\"font-size:16px\">&#9888;&#65039;</span> '+_parts.join(' &bull; ')+' &mdash; consider marking them on <b>Sale</b>.';\n" +
"      _expiryBanner.style.display='';\n" +
"    } else { _expiryBanner.style.display='none'; }\n" +
"  }";

// P11: add expiry banner HTML above invTbody (into the tbl-head or just above table)
// We add it after the table's tbl-head div, before the <table> tag.
// Anchor: the opening of the inventory table (right before <table>)
// We look for the specific class="tbl" table that has invTbody
const P11_OLD = '<thead><tr><th>SKU</th><th>Item Name</th><th>Category</th><th>Unit</th><th>Cost</th><th>Stock</th><th>Status</th><th>Expiry</th><th></th></tr></thead>';
const P11_NEW =
'</div>\n' +
'        <div id="invExpiryBanner" style="display:none;background:#1a0505;border:1px solid #7f1d1d;border-radius:8px;padding:10px 16px;margin:0 0 10px;font-size:13px;color:var(--text);line-height:1.6"></div>\n' +
'        <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>SKU</th><th>Item Name</th><th>Category</th><th>Unit</th><th>Cost</th><th>Stock</th><th>Status</th><th>Expiry</th><th></th></tr></thead>';

// P12: close the extra div we opened in P11 — the </div> after the </table>
// We need to add a </div> after the table since we added an opening <div> for overflow-x:auto
// Actually let me think about this differently — the table might already be wrapped

// P13: add toggleInvPromo and checkInvExpiryPromo functions
// These go after saveInvItem or near the openInvModal function
const P13_OLD = "async function openInvCatQuick(){";
const P13_NEW =
"function toggleInvPromo(){\n" +
"  const on=document.getElementById('invOnPromo').checked;\n" +
"  document.getElementById('invPromoFields').style.display=on?'':'none';\n" +
"  if(on) setTimeout(()=>document.getElementById('invSalePrice').focus(),50);\n" +
"}\n" +
"function checkInvExpiryPromo(){\n" +
"  const val=document.getElementById('invExpiry').value;\n" +
"  const alert=document.getElementById('invExpiryAlert');\n" +
"  if(!val){alert.style.display='none';return;}\n" +
"  const d=new Date(val+'T00:00:00');\n" +
"  const now=new Date(); now.setHours(0,0,0,0);\n" +
"  const days=Math.round((d-now)/86400000);\n" +
"  if(days<0){\n" +
"    alert.innerHTML='&#9888; This item is <strong>already expired</strong> ('+Math.abs(days)+' days ago). Consider removing it or marking as sold.';\n" +
"    alert.style.display='';\n" +
"  } else if(days<=90){\n" +
"    alert.innerHTML='&#9888; Expires in <strong>'+days+' days</strong>. Consider marking it <b>On Sale</b> to move stock quickly.';\n" +
"    alert.style.display='';\n" +
"    document.getElementById('invOnPromo').checked=true;\n" +
"    document.getElementById('invPromoFields').style.display='';\n" +
"  } else if(days<=180){\n" +
"    alert.innerHTML='&#128276; Expires in <strong>'+days+' days</strong> (~'+(Math.ceil(days/30))+' months).';\n" +
"    alert.style.background='#1a1200'; alert.style.borderColor='#f59e0b'; alert.style.color='#f59e0b';\n" +
"    alert.style.display='';\n" +
"  } else {\n" +
"    alert.style.display='none';\n" +
"  }\n" +
"}\n" +
"async function openInvCatQuick(){";

const PATCHES = [
  ['P1-thead-expiry',   P1_OLD,  P1_NEW],
  ['P2-loading-colspan',P2_OLD,  P2_NEW],
  ['P3-noitems-colspan',P3_OLD,  P3_NEW],
  ['P4-modal-fields',   P4_OLD,  P4_NEW],
  ['P5-renderInv-expiry-vars', P5_OLD, P5_NEW],
  ['P6-renderInv-name-promo',  P6_OLD, P6_NEW],
  ['P7-renderInv-expiry-cell', P7_OLD, P7_NEW],
  ['P8-openModal-populate',    P8_OLD, P8_NEW],
  ['P9-save-payload',          P9_OLD, P9_NEW],
  ['P10-load-notify',          P10_OLD,P10_NEW],
  ['P13-helper-fns',           P13_OLD,P13_NEW],
];

let patched = 0, skipped = 0;
const fileErrors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('invExpiry')) { console.log(`— ${file}: already patched`); skipped++; continue; }

  const errors = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { errors.push(label); continue; }
    c = c.replace(oldStr, newStr);
  }

  // P11: insert expiry banner before the inventory thead (after P1 ran, thead now has 'Expiry' in it)
  // Use regex to find the overflow table wrapper and add banner above it
  // The table is inside a div.panel; find '<table class="tbl">' that has invTbody
  const tableStart = c.indexOf('<table class="tbl"><thead><tr><th>SKU</th>');
  if (tableStart !== -1) {
    // Insert the banner div just before the table
    const bannerDiv = '<div id="invExpiryBanner" style="display:none;background:#1a0505;border:1px solid #7f1d1d;border-radius:8px;padding:10px 16px;margin:0 0 10px;font-size:13px;color:var(--text);line-height:1.6"></div>\n          ';
    c = c.slice(0, tableStart) + bannerDiv + c.slice(tableStart);
  } else {
    errors.push('P11-banner');
  }

  if (errors.length) {
    fileErrors[file] = errors;
    console.log(`⚠  ${file}: missing ${errors.join(', ')}`);
  } else {
    console.log(`✓  ${file}`);
  }

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (Object.keys(fileErrors).length) {
  console.log('\nFiles with anchor errors:');
  for (const [f, errs] of Object.entries(fileErrors)) console.log(`  ${f}: ${errs.join(', ')}`);
  console.log('\nSQL to run in Supabase:');
}
console.log('\n-- Run this in Supabase SQL Editor:');
console.log('ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS expiry_date DATE;');
console.log('ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sale_price NUMERIC;');
console.log('ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_on_promo BOOLEAN DEFAULT FALSE;');
