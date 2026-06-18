// add_login_logout_to_activity_log_ui.js
// Activity Log already shows ADD_STOCK/SALE/REMITTANCE/MGR_REMIT/etc.
// This adds LOGIN/LOGOUT to the action-filter dropdown plus their
// label/color so the new staff login/logout entries render nicely
// instead of falling back to the raw action string.
// Run: node scripts/add_login_logout_to_activity_log_ui.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── P1: filter dropdown options ────────────────────────────────────────────
const P1_OLD = `              <option value="MGR_REMIT">Deposit</option>`;
const P1_NEW =
`              <option value="MGR_REMIT">Deposit</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>`;

// ── P2: actionLabel map ─────────────────────────────────────────────────────
const P2_OLD = `EXPENSE_PAID: '📋 Expense' };`;
const P2_NEW = `EXPENSE_PAID: '📋 Expense', LOGIN: '🔓 Login', LOGOUT: '🔒 Logout' };`;

// ── P3: actionColor map ──────────────────────────────────────────────────────
const P3_OLD =
`    EXPENSE_PAID: 'background:#2a1a0a;color:#f59e0b',
  };`;
const P3_NEW =
`    EXPENSE_PAID: 'background:#2a1a0a;color:#f59e0b',
    LOGIN:        'background:#0a2a2a;color:#06b6d4',
    LOGOUT:       'background:#2a0a0a;color:#f87171',
  };`;

const PATCHES = [
  ['P1-filter', P1_OLD, P1_NEW],
  ['P2-label',  P2_OLD, P2_NEW],
  ['P3-color',  P3_OLD, P3_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes("LOGIN: '🔓 Login'")) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label); continue; }
    c = c.replace(oldStr, newStr);
  }
  if (fileErrs.length) errors[file] = fileErrs;

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(fileErrs.length ? `⚠  ${file}: missing ${fileErrs.join(', ')}` : `✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (Object.keys(errors).length) {
  console.log('\nFiles with anchor errors:');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
