// add_deposit_filter.js — Add MGR_REMIT "Deposit" to Activity Log in all dashboards
// Run: node scripts/add_deposit_filter.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir).filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html').sort();

// Patch 1: dropdown — add Deposit option after Remittance
const OLD_OPTION = `              <option value="REMITTANCE">Remittance</option>`;
const NEW_OPTION = `              <option value="REMITTANCE">Remittance</option>\r\n              <option value="MGR_REMIT">Deposit</option>`;

// Patch 2: actionLabel — add MGR_REMIT entry
const OLD_LABEL = `REMITTANCE: '🪙 Remittance' }`;
const NEW_LABEL = `REMITTANCE: '🪙 Remittance', MGR_REMIT: '⬆ Deposit' }`;

// Patch 3: actionColor — add MGR_REMIT after REMITTANCE line
const OLD_COLOR = `    REMITTANCE:  'background:#2e1a0d;color:#f59e0b',`;
const NEW_COLOR = `    REMITTANCE:  'background:#2e1a0d;color:#f59e0b',\r\n    MGR_REMIT:   'background:#1a0a2e;color:#c084fc',`;

let patched = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  let c = fs.readFileSync(fp, 'utf-8');
  const issues = [];

  // Patch 1
  if (!c.includes(OLD_OPTION)) { issues.push('p1 anchor missing'); }
  else if (c.includes('value="MGR_REMIT">Deposit')) { /* already patched */ }
  else { c = c.replace(OLD_OPTION, NEW_OPTION); }

  // Patch 2
  if (!c.includes(OLD_LABEL)) { issues.push('p2 anchor missing'); }
  else if (c.includes("MGR_REMIT: '⬆ Deposit'")) { /* already patched */ }
  else { c = c.replace(OLD_LABEL, NEW_LABEL); }

  // Patch 3
  if (!c.includes(OLD_COLOR)) { issues.push('p3 anchor missing'); }
  else if (c.includes("MGR_REMIT:   'background:#1a0a2e")) { /* already patched */ }
  else { c = c.replace(OLD_COLOR, NEW_COLOR); }

  if (issues.length) { console.log(`⚠  ${file}: ${issues.join(', ')}`); errors++; continue; }
  fs.writeFileSync(fp, c, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} patched, ${errors} issues.`);
