// add_staff_jobtitle.js
// Adds "Others" role + Job Title + Job Description to staff modal across all 25 dashboards
// Run: node scripts/add_staff_jobtitle.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── P1: Add "Others" option to role dropdown ──────────────────────────────
const P1_OLD =
'          <option value="cashier">Cashier</option>\n' +
'          <option value="manager">Manager</option>';
const P1_NEW =
'          <option value="cashier">Cashier</option>\n' +
'          <option value="manager">Manager</option>\n' +
'          <option value="others">Others</option>';

// ── P2: Add Job Title + Job Description fields before m-actions ───────────
const P2_OLD =
'    <div class="field" style="display:flex;align-items:center;gap:10px">\n' +
'      <label style="margin:0">Active</label>\n' +
'      <label class="toggle"><input type="checkbox" id="sfActive" checked><span class="slider"></span></label>\n' +
'    </div>\n' +
'    <div class="m-actions">';
const P2_NEW =
'    <div class="field" style="display:flex;align-items:center;gap:10px">\n' +
'      <label style="margin:0">Active</label>\n' +
'      <label class="toggle"><input type="checkbox" id="sfActive" checked><span class="slider"></span></label>\n' +
'    </div>\n' +
'    <div class="row2" style="margin-top:4px">\n' +
'      <div class="field">\n' +
'        <label>Job Title <span style="color:var(--dim);font-weight:400;font-size:11px">(optional)</span></label>\n' +
'        <input id="sfJobTitle" type="text" placeholder="e.g. Head Cashier, Stock Keeper">\n' +
'      </div>\n' +
'      <div class="field">\n' +
'        <label>Job Description <span style="color:var(--dim);font-weight:400;font-size:11px">(optional)</span></label>\n' +
'        <input id="sfJobDesc" type="text" placeholder="e.g. Handles daily cash and sales">\n' +
'      </div>\n' +
'    </div>\n' +
'    <div class="m-actions">';

// ── P3: Pre-fill job fields in openStaffModal ──────────────────────────────
const P3_OLD = "  document.getElementById('sfActive').checked= s ? s.active : true;";
const P3_NEW =
"  document.getElementById('sfActive').checked= s ? s.active : true;\n" +
"  document.getElementById('sfJobTitle').value = s ? (s.job_title || '') : '';\n" +
"  document.getElementById('sfJobDesc').value  = s ? (s.job_description || '') : '';";

// ── P4: Include job fields in saveStaff payload ───────────────────────────
const P4_OLD = "  let payload = { full_name: name, role, active };";
const P4_NEW =
"  const jobTitle = document.getElementById('sfJobTitle').value.trim();\n" +
"  const jobDesc  = document.getElementById('sfJobDesc').value.trim();\n" +
"  let payload = { full_name: name, role, active, job_title: jobTitle || null, job_description: jobDesc || null };";

// ── P5: Show job title under full name in staff table ─────────────────────
const P5_OLD = "      <td>${s.full_name || '&#8212;'}</td>";
const P5_NEW =
"      <td>${s.full_name || '&#8212;'}${s.job_title ? `<br><span style=\"font-size:11px;color:var(--muted);font-weight:400\">${s.job_title}</span>` : ''}</td>";

// ── P6: Style "others" badge differently ──────────────────────────────────
const P6_OLD = "      <td><span class=\"badge bg-cash\" style=\"${s.role==='manager'?'background:#1a1a3a;color:#818cf8':''}\">$";
const P6_NEW = "      <td><span class=\"badge bg-cash\" style=\"${s.role==='manager'?'background:#1a1a3a;color:#818cf8':s.role==='others'?'background:#0f1f1a;color:#6ee7b7':''}\">$";

const PATCHES = [
  ['P1-others-option', P1_OLD, P1_NEW],
  ['P2-job-fields',    P2_OLD, P2_NEW],
  ['P3-prefill',       P3_OLD, P3_NEW],
  ['P4-payload',       P4_OLD, P4_NEW],
  ['P5-table-name',    P5_OLD, P5_NEW],
  ['P6-badge-style',   P6_OLD, P6_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes("value=\"others\"") && c.includes('sfJobTitle')) {
    console.log(`—  ${file}: already patched`);
    skipped++;
    continue;
  }

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
