// rollout_inv_cat_takeout_checkbox.js
// dashboard-lechon.html has a checkbox in the Add/Edit Inventory Item modal:
// "Available in cashier's Take Out packaging picker" — it tags the item's
// CATEGORY into stores.takeout_inv_categories, which is what feeds the
// cashier's Material dropdown for Take Out packaging/utensils. Every other
// business type is missing this control entirely (no way to mark categories
// for that picker at all) — this rolls the exact lechon implementation out
// to the other 23 dashboard-*.html files.
// Run: node scripts/rollout_inv_cat_takeout_checkbox.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const P1_OLD = `<select id="invCat" style="flex:1;padding:10px 12px;background:var(--bg);border:1.5px solid var(--border);border-radius:7px;color:var(--text);font-size:14px;font-family:Inter,sans-serif;outline:none"><option value="">&#8212; Select &#8212;</option></select>
          <button type="button" class="btn btn-ghost btn-sm" onclick="openInvCatQuick()">+ New</button>
        </div>`;
const P1_NEW = `<select id="invCat" style="flex:1;padding:10px 12px;background:var(--bg);border:1.5px solid var(--border);border-radius:7px;color:var(--text);font-size:14px;font-family:Inter,sans-serif;outline:none" onchange="syncInvCatTakeoutCheckbox()"><option value="">&#8212; Select &#8212;</option></select>
          <button type="button" class="btn btn-ghost btn-sm" onclick="openInvCatQuick()">+ New</button>
        </div>
        <label style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:var(--muted);font-weight:400;cursor:pointer">
          <input type="checkbox" id="invCatTakeout" onchange="toggleInvCatTakeout(this.checked)" style="width:auto"> Available in cashier's Take Out packaging picker
        </label>`;

const P2_OLD = `  checkInvExpiryPromo();
  document.getElementById('invModal').classList.add('show');`;
const P2_NEW = `  checkInvExpiryPromo();
  syncInvCatTakeoutCheckbox();
  document.getElementById('invModal').classList.add('show');`;

const P3_OLD = `function toggleInvPromo(){`;
const P3_NEW = `function syncInvCatTakeoutCheckbox() {
  const cat = document.getElementById('invCat').value;
  const list = (STORE.takeout_inv_categories || '').split(',').map(s=>s.trim()).filter(Boolean);
  document.getElementById('invCatTakeout').checked = !!cat && list.includes(cat);
}
async function toggleInvCatTakeout(checked) {
  const cat = document.getElementById('invCat').value;
  if (!cat) { document.getElementById('invCatTakeout').checked = false; showToast('Select a category first.', true); return; }
  let list = (STORE.takeout_inv_categories || '').split(',').map(s=>s.trim()).filter(Boolean);
  if (checked) { if (!list.includes(cat)) list.push(cat); }
  else { list = list.filter(c => c !== cat); }
  const newVal = list.join(',');
  const { error } = await _sb.from('stores').update({ takeout_inv_categories: newVal }).eq('id', STORE.id);
  if (!error) { STORE.takeout_inv_categories = newVal; showToast(checked ? \`"\${cat}" marked for Take Out.\` : \`"\${cat}" unmarked.\`); }
  else { showToast('Error: ' + error.message, true); document.getElementById('invCatTakeout').checked = !checked; }
}
function toggleInvPromo(){`;

const PATCHES = [
  ['P1-checkbox-html', P1_OLD, P1_NEW],
  ['P2-sync-call',     P2_OLD, P2_NEW],
  ['P3-js-functions',  P3_OLD, P3_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('invCatTakeout')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label); continue; }
    c = c.replace(oldStr, newStr);
  }
  if (fileErrs.length) { errors[file] = fileErrs; console.log(`⚠  ${file}: missing ${fileErrs.join(', ')}`); continue; }

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (Object.keys(errors).length) {
  console.log('\nFiles with anchor errors (not modified):');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
