// add_salary_action_filter.js
// SALARY_GIVEN entries were lumped into the generic "Others" filter bucket
// (along with OWNER_SEND/EXPENSE_PAID) in the Activity Log — no way to
// filter to just salary payments. Adds a dedicated "Salary" option and
// removes SALARY_GIVEN from the "Others" bucket so the two don't overlap.
// Run: node scripts/add_salary_action_filter.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const P1_OLD = `              <option value="MGR_REMIT">Deposit</option>
              <option value="LOGIN">Login</option>`;
const P1_NEW = `              <option value="MGR_REMIT">Deposit</option>
              <option value="SALARY_GIVEN">Salary</option>
              <option value="LOGIN">Login</option>`;

const P2_OLD = `actionF === '__others__' ? ['OWNER_SEND','SALARY_GIVEN','EXPENSE_PAID'].includes(l.action) : l.action === actionF`;
const P2_NEW = `actionF === '__others__' ? ['OWNER_SEND','EXPENSE_PAID'].includes(l.action) : l.action === actionF`;

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('<option value="SALARY_GIVEN">Salary</option>')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  if (c.includes(P1_OLD)) { c = c.replace(P1_OLD, P1_NEW); } else { fileErrs.push('P1-dropdown'); }
  if (c.includes(P2_OLD)) { c = c.split(P2_OLD).join(P2_NEW); } else { fileErrs.push('P2-filter'); }
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
