// fix_remit_race.js — Fix race condition where 2nd remit popup shows same POS Sales as 1st
// Root cause: DB insert hasn't committed yet when 2nd popup queries lastRemit,
//             so it uses the wrong time window and counts the same orders twice.
// Fix: Store last-remit timestamp in localStorage BEFORE DB insert, so next popup
//      uses localStorage boundary even if DB write isn't visible yet.
// Run: node scripts/fix_remit_race.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f))
  .sort();

// ── Patch 1: openRemitOnLogout() ─────────────────────────────────────────────
// Old: const from = lastRemit?.[0]?.created_at || (today + 'T00:00:00');
// New: also check localStorage, use whichever is more recent
const OLD_FROM =
  `    const from = lastRemit?.[0]?.created_at || (today + 'T00:00:00');`;
const NEW_FROM =
  `    const _lsRemitKey = 'pm_last_remit_' + STORE_ID + '_' + name;\r\n` +
  `    const _lsRemitTime = localStorage.getItem(_lsRemitKey);\r\n` +
  `    const _dbRemitTime = lastRemit?.[0]?.created_at;\r\n` +
  `    const from = (_lsRemitTime && _dbRemitTime)\r\n` +
  `      ? (_lsRemitTime > _dbRemitTime ? _lsRemitTime : _dbRemitTime)\r\n` +
  `      : (_lsRemitTime || _dbRemitTime || (today + 'T00:00:00'));`;

// ── Patch 2: confirmRemitLogout() — save to localStorage BEFORE DB insert ────
// Anchor: the line right before the await insert
const OLD_INSERT =
  `    await _sb.from('cash_remittances').insert({\r\n` +
  `      store_id: STORE_ID, cashier_name: name, shift_date: today,\r\n` +
  `      pos_sales: pos, cash_on_hand: cash, difference: diff, status: 'pending'\r\n` +
  `    }).then(()=>{});`;
const NEW_INSERT =
  `    try { localStorage.setItem('pm_last_remit_' + STORE_ID + '_' + name, new Date().toISOString()); } catch(_e) {}\r\n` +
  `    await _sb.from('cash_remittances').insert({\r\n` +
  `      store_id: STORE_ID, cashier_name: name, shift_date: today,\r\n` +
  `      pos_sales: pos, cash_on_hand: cash, difference: diff, status: 'pending'\r\n` +
  `    }).then(()=>{});`;

let totalPatched = 0, totalErrors = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;
  let issues = [];

  // Patch 1
  const p1count = content.split(OLD_FROM).length - 1;
  if (p1count === 0) {
    issues.push('patch1 anchor not found');
  } else if (p1count > 1) {
    issues.push(`patch1 multiple matches (${p1count})`);
  } else {
    content = content.replace(OLD_FROM, NEW_FROM);
    changed = true;
  }

  // Patch 2
  const p2count = content.split(OLD_INSERT).length - 1;
  if (p2count === 0) {
    issues.push('patch2 anchor not found');
  } else if (p2count > 1) {
    issues.push(`patch2 multiple matches (${p2count})`);
  } else {
    content = content.replace(OLD_INSERT, NEW_INSERT);
    changed = true;
  }

  if (issues.length > 0) {
    console.log(`⚠  ${file}: ${issues.join(', ')}`);
    totalErrors++;
  } else if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓  ${file}`);
    totalPatched++;
  }
}

console.log(`\nDone: ${totalPatched} patched, ${totalErrors} issues.`);
