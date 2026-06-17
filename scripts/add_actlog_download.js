// add_actlog_download.js — Add CSV download button to activity log in all dashboards
// Run: node scripts/add_actlog_download.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── Patch 1: Add Download button next to Refresh ────────────────────────────
const OLD_BTN = `            <button class="btn btn-ghost btn-sm" onclick="loadActivityLog()">&#8635; Refresh</button>`;
const NEW_BTN = `            <button class="btn btn-ghost btn-sm" onclick="loadActivityLog()">&#8635; Refresh</button>
            <button class="btn btn-ghost btn-sm" onclick="downloadActivityLog()" style="color:#00b4d8;border-color:rgba(0,180,216,.3)">&#11123; Download</button>`;

// ── Patch 2: Add downloadActivityLog() function after renderActivityLog() ────
const OLD_AFTER = `// ── Receipt Viewer `;
const NEW_AFTER = `function downloadActivityLog() {
  const actorF  = document.getElementById('logActorFilter')?.value  || '';
  const actionF = document.getElementById('logActionFilter')?.value || '';
  let rows = _activityLogs;
  if (actorF)  rows = rows.filter(l => (l.actor_name || '').trim() === actorF.trim());
  if (actionF) rows = rows.filter(l => actionF === '__others__' ? ['OWNER_SEND','SALARY_GIVEN','EXPENSE_PAID'].includes(l.action) : l.action === actionF);
  if (!rows.length) { alert('No activity to download.'); return; }
  const esc = v => '"' + String(v||'').replace(/"/g,'""') + '"';
  const header = ['Time','Staff','Role','Action','Item','Details'].map(esc).join(',');
  const csvRows = rows.map(l => {
    const dt = new Date(l.created_at).toLocaleString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});
    let details = '';
    try {
      if (l.details) {
        const d = JSON.parse(l.details);
        details = Object.entries(d).filter(([k]) => k !== 'receipt_b64').map(([k,v]) => k+': '+v).join(' | ');
      }
    } catch(_) { details = l.details || ''; }
    return [dt, l.actor_name||'', l.actor_role||'', l.action||'', l.target_name||'', details].map(esc).join(',');
  });
  const csv = [header, ...csvRows].join('\\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0,10);
  a.href = url; a.download = 'activity-log-' + today + '.csv';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
// ── Receipt Viewer `;

let patched = 0, skipped = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (!c.includes('logActionFilter')) { console.log(`— ${file}: no activity log, skipping`); skipped++; continue; }
  if (c.includes('downloadActivityLog')) { console.log(`— ${file}: already patched`); skipped++; continue; }

  const issues = [];
  if (c.includes(OLD_BTN)) { c = c.replace(OLD_BTN, NEW_BTN); } else { issues.push('p1-btn'); }
  if (c.includes(OLD_AFTER)) { c = c.replace(OLD_AFTER, NEW_AFTER); } else { issues.push('p2-fn'); }

  if (issues.length) {
    console.log(`⚠  ${file}: ${issues.join(', ')}`);
    errors++;
  } else {
    const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
    fs.writeFileSync(fp, out, 'utf-8');
    console.log(`✓  ${file}`);
    patched++;
  }
}

console.log(`\nDone: ${patched} patched, ${skipped} skipped, ${errors} errors.`);
