// add_helpers_dashboard.js
// Adds the Helpers (non-account staff) view to sec-staff in all 25 dashboards
// Owner can see duty hours, assign tasks, view task completion
// Run: node scripts/add_helpers_dashboard.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── P1: Add helpers card HTML after perfCard in sec-staff ─────────────────
const P1_OLD = '      </div>\n    </div>\n\n    <!-- ACTIVITY LOG -->';
const P1_NEW =
'      </div>\n\n' +
'      <!-- HELPERS CARD -->\n' +
'      <div class="tbl-wrap" style="margin-top:16px" id="helpersCard">\n' +
'        <div class="tbl-head">\n' +
'          <h3>&#128119; Non-Account Staff / Helpers</h3>\n' +
'          <button class="btn btn-ghost btn-sm" onclick="loadHelperStaff()">&#8635; Refresh</button>\n' +
'        </div>\n' +
'        <div id="helpersContent" style="padding:16px 20px">\n' +
'          <div style="text-align:center;color:var(--muted);padding:20px">Loading...</div>\n' +
'        </div>\n' +
'      </div>\n' +
'    </div>\n\n    <!-- ACTIVITY LOG -->';

// ── P2: loadHelperStaff JS function (inserted before loadPerformance) ──────
const P2_OLD = '// ── Staff Performance';
const P2_NEW =
'// ── Helpers (Non-Account Staff) ────────────────────────────────────────────\n' +
'async function loadHelperStaff() {\n' +
'  const el = document.getElementById(\'helpersContent\');\n' +
'  if (!el) return;\n' +
'  await loadOpsData();\n' +
'  const todayKey = new Date().toLocaleDateString(\'en-CA\');\n' +
'  const helpers = (_opsData && _opsData.helperStaff || []).filter(h => h.active !== false);\n' +
'  const duty  = ((_opsData && _opsData.helperDuty)  || {})[todayKey] || {};\n' +
'  const tasks = ((_opsData && _opsData.helperTasks) || {})[todayKey] || {};\n' +
'\n' +
'  if (!helpers.length) {\n' +
'    el.innerHTML = \'<div style="color:var(--muted);font-size:13px;padding:8px 0">No helpers added yet. The manager can add non-account staff from the Manager App.</div>\';\n' +
'    return;\n' +
'  }\n' +
'\n' +
'  el.innerHTML = helpers.map(h => {\n' +
'    const d = duty[h.id] || {};\n' +
'    const dutyStr = d.in\n' +
'      ? (d.out ? `${d.in} &rarr; ${d.out}` : `${d.in} &rarr; <span style="color:#f59e0b">still on duty</span>`)\n' +
'      : \'<span style="color:var(--dim)">&#8212; not clocked in</span>\';\n' +
'    const hTasks = tasks[h.id] || [];\n' +
'    const doneCnt = hTasks.filter(t => t.done).length;\n' +
'    const rate = hTasks.length ? Math.round(doneCnt / hTasks.length * 100) : null;\n' +
'    const rateColor = rate === null ? \'var(--muted)\' : rate >= 80 ? \'#10b981\' : rate >= 50 ? \'#f59e0b\' : \'#ef4444\';\n' +
'    const taskRows = hTasks.map(t =>\n' +
'      `<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">`+\n' +
'      `<span style="${t.done ? \'color:#10b981\' : \'color:var(--muted)\'}">${t.done ? \'&#10003;\' : \'&#9675;\'}</span>`+\n' +
'      `<span style="${t.done ? \'text-decoration:line-through;color:var(--muted)\' : \'\'}">${t.text}</span></div>`\n' +
'    ).join(\'\');\n' +
'\n' +
'    return `<div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:10px">`+\n' +
'      `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px">`+\n' +
'      `<div><div style="font-weight:700;font-size:14px">${h.name}</div>`+\n' +
'      `<div style="font-size:12px;color:var(--muted)">${h.jobTitle}</div></div>`+\n' +
'      `<div style="text-align:right"><div style="font-size:11px;color:var(--muted)">Today\'s Duty</div>`+\n' +
'      `<div style="font-size:12px">${dutyStr}</div></div></div>`+\n' +
'      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">`+\n' +
'      `<div>`+\n' +
'      `<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Tasks Today `+\n' +
'      (rate !== null ? `<span style="color:${rateColor};font-size:12px">${doneCnt}/${hTasks.length} done</span>` : \'\')+`</div>`+\n' +
'      (taskRows || \'<div style="font-size:12px;color:var(--dim);font-style:italic">No tasks yet.</div>\')+`</div>`+\n' +
'      `<div>`+\n' +
'      `<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Assign Task</div>`+\n' +
'      `<div style="display:flex;gap:6px">`+\n' +
'      `<input id="htask_${h.id}" type="text" placeholder="Add a task..." style="flex:1;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px" onkeydown="if(event.key===\'Enter\')addHelperTask(\'${h.id}\')">`+\n' +
'      `<button class="btn btn-accent btn-sm" style="padding:5px 10px;font-size:12px" onclick="addHelperTask(\'${h.id}\')">+</button></div></div>`+\n' +
'      `</div>`+\n' +
'      `</div>`;\n' +
'  }).join(\'\');\n' +
'}\n' +
'\n' +
'async function addHelperTask(helperId) {\n' +
'  const inp = document.getElementById(\'htask_\' + helperId);\n' +
'  if (!inp) return;\n' +
'  const text = inp.value.trim();\n' +
'  if (!text) return;\n' +
'  await loadOpsData();\n' +
'  const todayKey = new Date().toLocaleDateString(\'en-CA\');\n' +
'  if (!_opsData.helperTasks) _opsData.helperTasks = {};\n' +
'  if (!_opsData.helperTasks[todayKey]) _opsData.helperTasks[todayKey] = {};\n' +
'  if (!_opsData.helperTasks[todayKey][helperId]) _opsData.helperTasks[todayKey][helperId] = [];\n' +
'  _opsData.helperTasks[todayKey][helperId].push({ text, done: false });\n' +
'  await saveOpsData().then(() => {});\n' +
'  inp.value = \'\';\n' +
'  loadHelperStaff();\n' +
'  showToast(\'Task assigned.\');\n' +
'}\n' +
'\n' +
'// ── Staff Performance';

// ── P3: trigger loadHelperStaff in staff nav ──────────────────────────────
const P3_OLD = "{ loadStaff(); updateMgrLink(); loadPerformance(); }";
const P3_NEW = "{ loadStaff(); updateMgrLink(); loadPerformance(); loadHelperStaff(); }";

const PATCHES = [
  ['P1-html',      P1_OLD, P1_NEW],
  ['P2-js',        P2_OLD, P2_NEW],
  ['P3-staff-nav', P3_OLD, P3_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('loadHelperStaff')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
