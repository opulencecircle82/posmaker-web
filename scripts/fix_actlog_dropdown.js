// fix_actlog_dropdown.js
// 1. Remove "Add New Item" from action filter dropdown
// 2. Add "Others" option (filters OWNER_SEND + SALARY_GIVEN + EXPENSE_PAID)
// 3. Update renderActivityLog filter logic for "Others"
// 4. Add labels + colors for OWNER_SEND, SALARY_GIVEN, EXPENSE_PAID
// Run: node scripts/fix_actlog_dropdown.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── Patch 1: Dropdown — remove Add New Item, add Others ─────────────────────
const OLD_DD = `              <option value="ADD_ITEM">Add New Item</option>
              <option value="SALE">Sale</option>`;
const NEW_DD = `              <option value="__others__">Others</option>
              <option value="SALE">Sale</option>`;

// ── Patch 2: Filter logic ────────────────────────────────────────────────────
const OLD_FILTER = `  if (actionF) rows = rows.filter(l => l.action === actionF);`;
const NEW_FILTER = `  if (actionF) rows = rows.filter(l => actionF === '__others__' ? ['OWNER_SEND','SALARY_GIVEN','EXPENSE_PAID'].includes(l.action) : l.action === actionF);`;

// ── Patch 3: actionLabel — add Others entries ────────────────────────────────
const OLD_LABEL = `  const actionLabel = { ADD_STOCK: '+ Add Stock', EDIT_ITEM: 'Edit Item', ADD_ITEM: '+ New Item', SALE: '\u{1F4B0} Sale', REMITTANCE: '\u{1FA99} Remittance', MGR_REMIT: '⬆ Deposit' };`;
const NEW_LABEL = `  const actionLabel = { ADD_STOCK: '+ Add Stock', EDIT_ITEM: 'Edit Item', ADD_ITEM: '+ New Item', SALE: '\u{1F4B0} Sale', REMITTANCE: '\u{1FA99} Remittance', MGR_REMIT: '⬆ Deposit', OWNER_SEND: '\u{1F4B8} Send', SALARY_GIVEN: '\u{1F464} Salary', EXPENSE_PAID: '\u{1F4CB} Expense' };`;

// ── Patch 4: actionColor — add Others entries ────────────────────────────────
const OLD_COLOR = `    MGR_REMIT:   'background:#1a0a2e;color:#c084fc',
  };`;
const NEW_COLOR = `    MGR_REMIT:    'background:#1a0a2e;color:#c084fc',
    OWNER_SEND:   'background:#0a2a10;color:#39ff14',
    SALARY_GIVEN: 'background:#0a2a10;color:#39ff14',
    EXPENSE_PAID: 'background:#2a1a0a;color:#f59e0b',
  };`;

// ── Patch 5: Details rendering — add OWNER_SEND/SALARY_GIVEN/EXPENSE_PAID ────
const OLD_DET = `        if (l.action === 'MGR_REMIT') {
          details = filtered.map(([k,v]) => {
            if (k === 'amount') return 'amount: <span style="color:#39ff14;font-weight:700">₱' + parseFloat(v).toFixed(2) + '</span>';
            if (k === 'note')   return '<span style="color:#00e5ff;font-weight:700">' + v + '</span>';
            return k + ': ' + v;
          }).join(' &bull; ');
        } else {
          details = filtered.map(([k,v]) => \`\${k}: \${v}\`).join(', ');
        }`;
const NEW_DET = `        if (l.action === 'MGR_REMIT') {
          details = filtered.map(([k,v]) => {
            if (k === 'amount') return 'amount: <span style="color:#39ff14;font-weight:700">₱' + parseFloat(v).toFixed(2) + '</span>';
            if (k === 'note')   return '<span style="color:#00e5ff;font-weight:700">' + v + '</span>';
            return k + ': ' + v;
          }).join(' &bull; ');
        } else if (l.action === 'OWNER_SEND' || l.action === 'SALARY_GIVEN' || l.action === 'EXPENSE_PAID') {
          details = filtered.filter(([k]) => !['cr_id'].includes(k)).map(([k,v]) => {
            if (k === 'amount') return '<span style="color:#39ff14;font-weight:700">₱' + parseFloat(v).toFixed(2) + '</span>';
            if (k === 'note' || k === 'desc') return '<span style="color:#00e5ff">' + v + '</span>';
            if (k === 'name') return v;
            if (k === 'category') return '<span style="color:var(--muted);font-size:11px">' + v + '</span>';
            return k + ': ' + v;
          }).join(' &bull; ');
        } else {
          details = filtered.map(([k,v]) => \`\${k}: \${v}\`).join(', ');
        }`;

let patched = 0, skipped = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  // Normalize to LF for matching
  let c = raw.replace(/\r\n/g, '\n');

  if (!c.includes('logActionFilter')) { console.log(`— ${file}: no activity log, skipping`); skipped++; continue; }
  if (c.includes('__others__')) { console.log(`— ${file}: already patched`); skipped++; continue; }

  const issues = [];

  if (c.includes(OLD_DD)) { c = c.replace(OLD_DD, NEW_DD); } else { issues.push('p1-dropdown'); }
  if (c.includes(OLD_FILTER)) { c = c.replace(OLD_FILTER, NEW_FILTER); } else { issues.push('p2-filter'); }
  if (c.includes(OLD_LABEL)) { c = c.replace(OLD_LABEL, NEW_LABEL); } else { issues.push('p3-label'); }
  if (c.includes(OLD_COLOR)) { c = c.replace(OLD_COLOR, NEW_COLOR); } else { issues.push('p4-color'); }
  if (c.includes(OLD_DET)) { c = c.replace(OLD_DET, NEW_DET); } else { issues.push('p5-details'); }

  if (issues.length) {
    console.log(`⚠  ${file}: anchors missing — ${issues.join(', ')}`);
    errors++;
  } else {
    // Restore original line endings
    const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
    fs.writeFileSync(fp, out, 'utf-8');
    console.log(`✓  ${file}`);
    patched++;
  }
}

console.log(`\nDone: ${patched} patched, ${skipped} skipped, ${errors} errors.`);
