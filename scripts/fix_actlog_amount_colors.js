// fix_actlog_amount_colors.js
// OWNER_SEND amount → neon green (money IN), SALARY_GIVEN+EXPENSE_PAID → neon red (money OUT)
// Run: node scripts/fix_actlog_amount_colors.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const OLD = `        } else if (l.action === 'OWNER_SEND' || l.action === 'SALARY_GIVEN' || l.action === 'EXPENSE_PAID') {
          details = filtered.filter(([k]) => !['cr_id'].includes(k)).map(([k,v]) => {
            if (k === 'amount') return '<span style="color:#39ff14;font-weight:700">₱' + parseFloat(v).toFixed(2) + '</span>';
            if (k === 'note' || k === 'desc') return '<span style="color:#00e5ff">' + v + '</span>';
            if (k === 'name') return v;
            if (k === 'category') return '<span style="color:var(--muted);font-size:11px">' + v + '</span>';
            return k + ': ' + v;
          }).join(' &bull; ');`;

const NEW = `        } else if (l.action === 'OWNER_SEND' || l.action === 'SALARY_GIVEN' || l.action === 'EXPENSE_PAID') {
          const _amtColor = l.action === 'OWNER_SEND' ? '#39ff14' : '#ff3131';
          details = filtered.filter(([k]) => !['cr_id'].includes(k)).map(([k,v]) => {
            if (k === 'amount') return '<span style="color:' + _amtColor + ';font-weight:700">₱' + parseFloat(v).toFixed(2) + '</span>';
            if (k === 'note' || k === 'desc') return '<span style="color:#00e5ff">' + v + '</span>';
            if (k === 'name') return v;
            if (k === 'category') return '<span style="color:var(--muted);font-size:11px">' + v + '</span>';
            return k + ': ' + v;
          }).join(' &bull; ');`;

let patched = 0, skipped = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (!c.includes('OWNER_SEND')) { skipped++; continue; }
  if (c.includes('_amtColor')) { console.log(`— ${file}: already patched`); skipped++; continue; }

  if (c.includes(OLD)) {
    c = c.replace(OLD, NEW);
    const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
    fs.writeFileSync(fp, out, 'utf-8');
    console.log(`✓  ${file}`);
    patched++;
  } else {
    console.log(`⚠  ${file}: anchor not found`);
    errors++;
  }
}

console.log(`\nDone: ${patched} patched, ${skipped} skipped, ${errors} errors.`);
