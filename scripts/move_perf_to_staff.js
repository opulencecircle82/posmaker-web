// move_perf_to_staff.js
// Moves the Staff Performance card from sec-dashboard into sec-staff
// Also updates the trigger from dashboard load to staff nav
// Run: node scripts/move_perf_to_staff.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── P1: remove perf card block from sec-dashboard ─────────────────────────
const P1_OLD =
'\n\n      <!-- STAFF PERFORMANCE CARD -->\n' +
'      <div class="tbl-wrap" style="margin-top:16px" id="perfCard">\n' +
'        <div class="tbl-head">\n' +
'          <h3>&#128200; Staff Performance <span style="font-size:11px;font-weight:400;color:var(--muted)">(Last 30 days)</span></h3>\n' +
'          <button class="btn btn-ghost btn-sm" onclick="loadPerformance()">&#8635; Refresh</button>\n' +
'        </div>\n' +
'        <div id="perfContent" style="padding:16px 20px">\n' +
'          <div style="text-align:center;color:var(--muted);padding:20px">Loading...</div>\n' +
'        </div>\n' +
'      </div>';
const P1_NEW = '';

// ── P2: add perf card at bottom of sec-staff (before <!-- ACTIVITY LOG -->) ──
const P2_OLD = '      </div>\n    </div>\n\n    <!-- ACTIVITY LOG -->';
const P2_NEW =
'      </div>\n\n' +
'      <!-- STAFF PERFORMANCE CARD -->\n' +
'      <div class="tbl-wrap" style="margin-top:16px" id="perfCard">\n' +
'        <div class="tbl-head">\n' +
'          <h3>&#128200; Staff Performance <span style="font-size:11px;font-weight:400;color:var(--muted)">(Last 30 days)</span></h3>\n' +
'          <button class="btn btn-ghost btn-sm" onclick="loadPerformance()">&#8635; Refresh</button>\n' +
'        </div>\n' +
'        <div id="perfContent" style="padding:16px 20px">\n' +
'          <div style="text-align:center;color:var(--muted);padding:20px">Loading...</div>\n' +
'        </div>\n' +
'      </div>\n' +
'    </div>\n\n    <!-- ACTIVITY LOG -->';

// ── P3: remove loadPerformance() from init startup ─────────────────────────
const P3_OLD = '  loadDashboard();\n  loadPerformance();\n  await Promise.race([loadDbCategories()';
const P3_NEW = '  loadDashboard();\n  await Promise.race([loadDbCategories()';

// ── P4: move trigger from dashboard nav to staff nav ──────────────────────
const P4_OLD = "if (id === 'dashboard') { loadDashboard(); loadPerformance(); }";
const P4_NEW = "if (id === 'dashboard') { loadDashboard(); }";

const P5_OLD = "if (id === 'staff')     loadStaff();";
const P5_NEW = "if (id === 'staff')     { loadStaff(); loadPerformance(); }";

const PATCHES = [
  ['P1-rm-from-dash', P1_OLD, P1_NEW],
  ['P2-add-to-staff', P2_OLD, P2_NEW],
  ['P3-rm-init',      P3_OLD, P3_NEW],
  ['P4-dash-nav',     P4_OLD, P4_NEW],
  ['P5-staff-nav',    P5_OLD, P5_NEW],
];

let patched = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label + '(not found)'); continue; }
    c = c.replace(oldStr, newStr);
  }
  if (fileErrs.length) errors[file] = fileErrs;

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(fileErrs.length ? `⚠  ${file}: ${fileErrs.join(', ')}` : `✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} files written.`);
if (Object.keys(errors).length) {
  console.log('\nFiles with anchor errors:');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
