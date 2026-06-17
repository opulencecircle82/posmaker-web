// add_staff_performance.js
// Adds a Staff Performance card to the dashboard section of all 25 dashboards
// Shows cashier remittance accuracy and manager checklist compliance (last 30 days)
// Run: node scripts/add_staff_performance.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── P1: HTML card at end of sec-dashboard ─────────────────────────────────
const P1_OLD = '      </div>\n    </div>\n\n    <!-- ORDERS -->';
const P1_NEW =
'      </div>\n' +
'\n' +
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
'    </div>\n\n    <!-- ORDERS -->';

// ── P2: loadPerformance JS function ───────────────────────────────────────
// Inserted before the Sales Report section
const P2_OLD = '// ── Sales Report';
const P2_NEW =
'// ── Staff Performance ────────────────────────────────────────────────────────\n' +
'async function loadPerformance() {\n' +
'  if (!STORE) return;\n' +
'  const perfEl = document.getElementById(\'perfContent\');\n' +
'  if (!perfEl) return;\n' +
'  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);\n' +
'  const cutoffStr = cutoff.toISOString().slice(0, 10);\n' +
'\n' +
'  // 1. Cashier remittance accuracy\n' +
'  const { data: remits } = await _sb.from(\'cash_remittances\')\n' +
'    .select(\'cashier_name,status\')\n' +
'    .eq(\'store_id\', STORE.id)\n' +
'    .gte(\'shift_date\', cutoffStr)\n' +
'    .in(\'status\', [\'balanced\',\'over\',\'short\']);\n' +
'\n' +
'  const cashierMap = {};\n' +
'  for (const r of (remits || [])) {\n' +
'    const n = r.cashier_name || \'Unknown\';\n' +
'    if (!cashierMap[n]) cashierMap[n] = { total: 0, balanced: 0, over: 0, short: 0 };\n' +
'    cashierMap[n].total++;\n' +
'    if (r.status === \'balanced\') cashierMap[n].balanced++;\n' +
'    else if (r.status === \'over\') cashierMap[n].over++;\n' +
'    else if (r.status === \'short\') cashierMap[n].short++;\n' +
'  }\n' +
'\n' +
'  // 2. Manager checklist compliance from ops_data\n' +
'  await loadOpsData();\n' +
'  const _log = _opsData && _opsData.checklistLog ? _opsData.checklistLog : {};\n' +
'  const _items = _opsData && _opsData.checklistItems ? _opsData.checklistItems : {};\n' +
'  const _openTotal = (_items.opening || []).length;\n' +
'  const _closeTotal = (_items.closing || []).length;\n' +
'  let _ckDays = 0, _ckOpenOk = 0, _ckCloseOk = 0;\n' +
'  const _now = new Date();\n' +
'  for (let i = 0; i < 30; i++) {\n' +
'    const _d = new Date(_now); _d.setDate(_now.getDate() - i);\n' +
'    const _key = _d.toLocaleDateString(\'en-CA\');\n' +
'    const _dl = _log[_key];\n' +
'    if (!_dl) continue;\n' +
'    _ckDays++;\n' +
'    if (_openTotal > 0 && (_dl.opening || []).length >= _openTotal) _ckOpenOk++;\n' +
'    if (_closeTotal > 0 && (_dl.closing || []).length >= _closeTotal) _ckCloseOk++;\n' +
'  }\n' +
'\n' +
'  // Rating helpers\n' +
'  function _cr(rate) {\n' +
'    if (rate === 0)  return { label: \'Perfect\', color: \'#10b981\', bg: \'#0a1f14\' };\n' +
'    if (rate <= 5)   return { label: \'Excellent\', color: \'#10b981\', bg: \'#0a1f14\' };\n' +
'    if (rate <= 15)  return { label: \'Good\', color: \'#f59e0b\', bg: \'#1a1200\' };\n' +
'    if (rate <= 30)  return { label: \'Needs Improvement\', color: \'#f97316\', bg: \'#1a0f00\' };\n' +
'    return { label: \'Poor\', color: \'#ef4444\', bg: \'#1f0a0a\' };\n' +
'  }\n' +
'  function _ckr(rate) {\n' +
'    if (rate >= 95) return { label: \'Excellent\', color: \'#10b981\', bg: \'#0a1f14\' };\n' +
'    if (rate >= 80) return { label: \'Good\', color: \'#f59e0b\', bg: \'#1a1200\' };\n' +
'    if (rate >= 60) return { label: \'Needs Improvement\', color: \'#f97316\', bg: \'#1a0f00\' };\n' +
'    return { label: \'Poor\', color: \'#ef4444\', bg: \'#1f0a0a\' };\n' +
'  }\n' +
'\n' +
'  // Cashier section HTML\n' +
'  const _entries = Object.entries(cashierMap).sort((a, b) => {\n' +
'    return ((b[1].over + b[1].short) / b[1].total) - ((a[1].over + a[1].short) / a[1].total);\n' +
'  });\n' +
'  const _cashierHtml = _entries.length === 0\n' +
'    ? \'<div style="color:var(--muted);font-size:12px;padding:8px 0">No confirmed remittances in the last 30 days.</div>\'\n' +
'    : _entries.map(([name, s]) => {\n' +
'        const errRate = s.total > 0 ? Math.round((s.over + s.short) / s.total * 100) : 0;\n' +
'        const r = _cr(errRate);\n' +
'        const barW = Math.min(100, errRate * 2);\n' +
'        return \'<div style="background:\' + r.bg + \';border:1px solid \' + r.color + \'33;border-radius:8px;padding:10px 14px;margin-bottom:8px">\' +\n' +
'          \'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">\' +\n' +
'          \'<span style="font-weight:700;font-size:13px">\' + name + \'</span>\' +\n' +
'          \'<span style="font-size:11px;font-weight:700;color:\' + r.color + \';background:\' + r.color + \'22;padding:2px 8px;border-radius:20px">\' + r.label + \'</span>\' +\n' +
'          \'</div>\' +\n' +
'          \'<div style="font-size:11px;color:var(--muted);margin-bottom:8px">\' + s.total + \' remittances &mdash; \' +\n' +
'          \'<span style="color:#10b981">\' + s.balanced + \' balanced</span> &bull; \' +\n' +
'          \'<span style="color:#ef4444">\' + s.over + \' over</span> &bull; \' +\n' +
'          \'<span style="color:#f97316">\' + s.short + \' short</span></div>\' +\n' +
'          \'<div style="display:flex;align-items:center;gap:8px">\' +\n' +
'          \'<div style="flex:1;height:6px;background:#ffffff15;border-radius:3px;overflow:hidden">\' +\n' +
'          \'<div style="height:100%;width:\' + barW + \'%;background:\' + r.color + \';border-radius:3px"></div></div>\' +\n' +
'          \'<span style="font-size:12px;font-weight:700;color:\' + r.color + \';min-width:42px">\' + errRate + \'% err</span></div></div>\';\n' +
'      }).join(\'\');\n' +
'\n' +
'  // Checklist section HTML\n' +
'  function _ckRow(label, rate, icon) {\n' +
'    if (rate === null) return \'\';\n' +
'    const r = _ckr(rate);\n' +
'    return \'<div style="background:\' + r.bg + \';border:1px solid \' + r.color + \'33;border-radius:8px;padding:10px 14px;margin-bottom:8px">\' +\n' +
'      \'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">\' +\n' +
'      \'<span style="font-weight:700;font-size:13px">\' + icon + \' \' + label + \'</span>\' +\n' +
'      \'<span style="font-size:11px;font-weight:700;color:\' + r.color + \';background:\' + r.color + \'22;padding:2px 8px;border-radius:20px">\' + r.label + \'</span>\' +\n' +
'      \'</div>\' +\n' +
'      \'<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Completed \' + Math.round(rate * _ckDays / 100) + \' of \' + _ckDays + \' days tracked</div>\' +\n' +
'      \'<div style="display:flex;align-items:center;gap:8px">\' +\n' +
'      \'<div style="flex:1;height:6px;background:#ffffff15;border-radius:3px;overflow:hidden">\' +\n' +
'      \'<div style="height:100%;width:\' + rate + \'%;background:\' + r.color + \';border-radius:3px"></div></div>\' +\n' +
'      \'<span style="font-size:12px;font-weight:700;color:\' + r.color + \';min-width:36px">\' + rate + \'%</span></div></div>\';\n' +
'  }\n' +
'  const _ckHtml = _ckDays === 0\n' +
'    ? \'<div style="color:var(--muted);font-size:12px;padding:8px 0">No checklist data for the last 30 days.</div>\'\n' +
'    : _ckRow(\'Opening Checklist\', _openTotal > 0 ? Math.round(_ckOpenOk / _ckDays * 100) : null, \'&#9728;&#65039;\') +\n' +
'      _ckRow(\'Closing Checklist\', _closeTotal > 0 ? Math.round(_ckCloseOk / _ckDays * 100) : null, \'&#127769;\');\n' +
'\n' +
'  perfEl.innerHTML =\n' +
'    \'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px">\' +\n' +
'    \'<div><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">&#129532; Cashier Remittance Accuracy</div>\' + _cashierHtml + \'</div>\' +\n' +
'    \'<div><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">&#9989; Manager Checklist Compliance</div>\' + _ckHtml + \'</div>\' +\n' +
'    \'</div>\';\n' +
'}\n' +
'\n' +
'// ── Sales Report';

// ── P3a: call loadPerformance after init loadDashboard() ──────────────────
const P3a_OLD = '  loadDashboard();\n  await Promise.race([loadDbCategories()';
const P3a_NEW = '  loadDashboard();\n  loadPerformance();\n  await Promise.race([loadDbCategories()';

// ── P3b: call loadPerformance in nav() for dashboard ──────────────────────
const P3b_OLD = "if (id === 'dashboard')  loadDashboard();";
const P3b_NEW = "if (id === 'dashboard') { loadDashboard(); loadPerformance(); }";

const PATCHES = [
  ['P1-html', P1_OLD, P1_NEW],
  ['P2-js',   P2_OLD, P2_NEW],
  ['P3a-init',P3a_OLD, P3a_NEW],
  ['P3b-nav', P3b_OLD, P3b_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('loadPerformance')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label); continue; }
    c = c.replace(oldStr, newStr);
  }
  if (fileErrs.length) errors[file] = fileErrs;

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(fileErrs.length ? `⚠  ${file}: wrote but missing ${fileErrs.join(', ')}` : `✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (Object.keys(errors).length) {
  console.log('\nFiles with anchor errors:');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
