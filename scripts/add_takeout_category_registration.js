// add_takeout_category_registration.js
// Lechon House only: the cashier's Take Out raw-material picker was listing
// EVERY inventory category (ingredients, meat, etc.) — clutter, since most
// have nothing to do with packaging. This adds a checkbox in the dashboard's
// Add/Edit Inventory Item modal ("Available in cashier's Take Out picker")
// that registers/unregisters the CURRENTLY SELECTED category into a simple
// comma-separated list on stores.takeout_inv_categories. The cashier's
// category dropdown now only shows categories in that list.
// Requires: ALTER TABLE stores ADD COLUMN IF NOT EXISTS takeout_inv_categories TEXT DEFAULT '';
// Run: node scripts/add_takeout_category_registration.js
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');

function patch(fp, label, patches, alreadyMarker) {
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');
  if (c.includes(alreadyMarker)) { console.log(`—  ${label}: already patched`); return; }
  const errs = [];
  for (const [name, oldStr, newStr] of patches) {
    if (!c.includes(oldStr)) { errs.push(name); continue; }
    c = c.replace(oldStr, newStr);
  }
  if (errs.length) { console.log(`⚠  ${label}: missing ${errs.join(', ')}`); return; }
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${label}`);
}

// ── dashboard-lechon.html ───────────────────────────────────────────────────
{
  const H_OLD =
`          <select id="invCat" style="flex:1;padding:10px 12px;background:var(--bg);border:1.5px solid var(--border);border-radius:7px;color:var(--text);font-size:14px;font-family:Inter,sans-serif;outline:none"><option value="">&#8212; Select &#8212;</option></select>
          <button type="button" class="btn btn-ghost btn-sm" onclick="openInvCatQuick()">+ New</button>
        </div>
      </div>`;
  const H_NEW =
`          <select id="invCat" style="flex:1;padding:10px 12px;background:var(--bg);border:1.5px solid var(--border);border-radius:7px;color:var(--text);font-size:14px;font-family:Inter,sans-serif;outline:none" onchange="syncInvCatTakeoutCheckbox()"><option value="">&#8212; Select &#8212;</option></select>
          <button type="button" class="btn btn-ghost btn-sm" onclick="openInvCatQuick()">+ New</button>
        </div>
        <label style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:var(--muted);font-weight:400;cursor:pointer">
          <input type="checkbox" id="invCatTakeout" onchange="toggleInvCatTakeout(this.checked)" style="width:auto"> Available in cashier's Take Out packaging picker
        </label>
      </div>`;

  const J_OLD = `  populateInvCatSelect(document.getElementById('invCat'),item?item.category:'');`;
  const J_NEW =
`  populateInvCatSelect(document.getElementById('invCat'),item?item.category:'');
  syncInvCatTakeoutCheckbox();`;

  const F_OLD = `function toggleInvPromo(){`;
  const F_NEW =
`function syncInvCatTakeoutCheckbox() {
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

  patch(path.join(dir, 'dashboard-lechon.html'), 'dashboard-lechon.html', [
    ['html', H_OLD, H_NEW],
    ['open-sync', J_OLD, J_NEW],
    ['functions', F_OLD, F_NEW],
  ], 'invCatTakeout');
}

// ── cashier-lechon.html ──────────────────────────────────────────────────────
{
  const C_OLD =
`function populateUnliInvCats() {
  const sel = document.getElementById('unliInvCat');
  sel.innerHTML = '<option value="">— Category —</option>';
  const cats = [...new Set(storeInvItems.map(i => i.category).filter(Boolean))].sort();
  cats.forEach(c => sel.add(new Option(c, c)));
  document.getElementById('unliInvItem').innerHTML = '<option value="">— Material —</option>';
}`;
  const C_NEW =
`function populateUnliInvCats() {
  const sel = document.getElementById('unliInvCat');
  sel.innerHTML = '<option value="">— Category —</option>';
  const allowed = (STORE.takeout_inv_categories || '').split(',').map(s=>s.trim()).filter(Boolean);
  const cats = [...new Set(storeInvItems.map(i => i.category).filter(Boolean))]
    .filter(c => allowed.includes(c))
    .sort();
  cats.forEach(c => sel.add(new Option(c, c)));
  document.getElementById('unliInvItem').innerHTML = '<option value="">— Material —</option>';
}`;

  patch(path.join(dir, 'cashier-lechon.html'), 'cashier-lechon.html', [
    ['filter', C_OLD, C_NEW],
  ], 'STORE.takeout_inv_categories');
}
