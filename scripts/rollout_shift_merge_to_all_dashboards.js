// rollout_shift_merge_to_all_dashboards.js
// The Login History "Cash Drawer" feature (and its bugfixes) was iterated on
// live in dashboard-lechon.html only. This applies the FINAL version to all
// 24 dashboards: a new shift only starts after an ACTUAL logout — re-logging
// in without one (closed window/crash/brownout) continues the SAME shift
// instead of fragmenting into separate "—"/"unremitted" rows, since it's
// still the same cashier holding the same cash drawer. This is a general
// sales-tracking fix, not specific to any one business type.
// Run: node scripts/rollout_shift_merge_to_all_dashboards.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const OLD =
`  const loginTimes = logins.map(l => l.login_at);
  const shiftsAsc = loginTimes.map((loginAt, i) => {
    const nextLoginAt = loginTimes[i+1] || null;
    const logoutAt = logoutTimes.find(t => t > loginAt && (!nextLoginAt || t < nextLoginAt)) || null;
    const isOpen = !logoutAt && i === loginTimes.length - 1; // only the latest login can still be "Active"
    return { loginAt, logoutAt, isOpen };
  });
  const shifts = shiftsAsc.slice().reverse(); // newest first

  // Live running total for the genuinely open shift (no logout yet, and no
  // newer login after it) — sum of orders since login, so the owner sees
  // the current cash drawer total without listing each sale.
  const openShift = shifts.find(s => s.isOpen);
  let liveTotal = null;
  if (isCashier && openShift && STORE?.id) {
    const { data: ord } = await _sb.from('orders').select('total')
      .eq('store_id', STORE.id).eq('cashier_name', displayName).gte('timestamp', openShift.loginAt);
    liveTotal = (ord||[]).reduce((s,o) => s + (parseFloat(o.total)||0), 0);
  }

  body.innerHTML = \`
    <table style="width:100%">
      <thead><tr><th>#</th><th>Login</th><th>Logout</th>\${isCashier?'<th>Cash Drawer</th>':''}</tr></thead>
      <tbody>\${shifts.map((s,i) => {
        const loginStr = new Date(s.loginAt).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'});
        const logoutStr = s.logoutAt
          ? new Date(s.logoutAt).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'})
          : (s.isOpen ? '<span style="color:#22c55e;font-weight:600">&#128994; Active</span>' : '<span style="color:var(--dim)">—</span>');
        let cashCell = '—';
        if (isCashier) {
          if (s.isOpen) {
            cashCell = liveTotal != null ? \`<span style="color:#22c55e;font-weight:600">\${CUR||'₱'}\${liveTotal.toFixed(2)}</span> <span style="color:var(--muted);font-size:11px">live</span>\` : '—';
          } else if (s.logoutAt) {
            const r = remits.filter(r => new Date(r.created_at).getTime() >= new Date(s.loginAt).getTime() && new Date(r.created_at).getTime() <= new Date(s.logoutAt).getTime() + 5000)
              .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
            cashCell = r ? \`\${CUR||'₱'}\${parseFloat(r.cash_on_hand).toFixed(2)} <span style="color:var(--muted);font-size:11px">remitted</span>\` : '<span style="color:var(--dim)">no remit</span>';
          }
        }
        return \`<tr>
        <td style="color:var(--dim);font-size:12px">\${i+1}</td>
        <td>\${loginStr}</td>
        <td>\${logoutStr}</td>
        \${isCashier?\`<td>\${cashCell}</td>\`:''}
      </tr>\`;
      }).join('')}</tbody>
    </table>\`;
}`;

const NEW =
`  const loginTimes = logins.map(l => l.login_at);
  // Group logins into shifts: a NEW shift only starts after an ACTUAL
  // logout. Re-logging in without one (e.g. reopened after a crash/brownout,
  // closed the window instead of clicking Logout) continues the SAME shift
  // — same running total — instead of fragmenting into separate rows, since
  // it's the same cashier still holding the same cash drawer.
  const shiftsAsc = [];
  let curStart = null;
  for (let i = 0; i < loginTimes.length; i++) {
    const loginAt = loginTimes[i];
    if (curStart === null) curStart = loginAt;
    const nextLoginAt = loginTimes[i+1] || null;
    const logoutAt = logoutTimes.find(t => t > loginAt && (!nextLoginAt || t < nextLoginAt)) || null;
    if (logoutAt) {
      shiftsAsc.push({ loginAt: curStart, logoutAt, isOpen: false });
      curStart = null;
    } else if (!nextLoginAt) {
      shiftsAsc.push({ loginAt: curStart, logoutAt: null, isOpen: true });
      curStart = null;
    }
    // else: no logout yet, but another login follows — keep merging
  }
  const shifts = shiftsAsc.slice().reverse(); // newest first

  // Live running total for the open shift — sum of orders since the shift's
  // (possibly merged) start, so the owner sees the current cash drawer
  // total without listing each sale.
  if (isCashier && STORE?.id) {
    await Promise.all(shifts.filter(s => !s.logoutAt).map(async s => {
      const { data: ord } = await _sb.from('orders').select('total')
        .eq('store_id', STORE.id).eq('cashier_name', displayName)
        .gte('timestamp', s.loginAt);
      s._total = (ord||[]).reduce((sum,o) => sum + (parseFloat(o.total)||0), 0);
    }));
  }

  body.innerHTML = \`
    <table style="width:100%">
      <thead><tr><th>#</th><th>Login</th><th>Logout</th>\${isCashier?'<th>Cash Drawer</th>':''}</tr></thead>
      <tbody>\${shifts.map((s,i) => {
        const loginStr = new Date(s.loginAt).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'});
        const logoutStr = s.logoutAt
          ? new Date(s.logoutAt).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'})
          : '<span style="color:#22c55e;font-weight:600">&#128994; Active</span>';
        let cashCell = '—';
        if (isCashier) {
          if (s.logoutAt) {
            const r = remits.filter(r => new Date(r.created_at).getTime() >= new Date(s.loginAt).getTime() && new Date(r.created_at).getTime() <= new Date(s.logoutAt).getTime() + 5000)
              .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
            cashCell = r ? \`\${CUR||'₱'}\${parseFloat(r.cash_on_hand).toFixed(2)} <span style="color:var(--muted);font-size:11px">remitted</span>\` : '<span style="color:var(--dim)">no remit</span>';
          } else {
            cashCell = s._total != null ? \`<span style="color:#22c55e;font-weight:600">\${CUR||'₱'}\${s._total.toFixed(2)}</span> <span style="color:var(--muted);font-size:11px">live</span>\` : '—';
          }
        }
        return \`<tr>
        <td style="color:var(--dim);font-size:12px">\${i+1}</td>
        <td>\${loginStr}</td>
        <td>\${logoutStr}</td>
        \${isCashier?\`<td>\${cashCell}</td>\`:''}
      </tr>\`;
      }).join('')}</tbody>
    </table>\`;
}`;

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('let curStart = null;')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); errors[file] = ['anchor']; continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (Object.keys(errors).length) {
  console.log('\nFiles with anchor errors:');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
