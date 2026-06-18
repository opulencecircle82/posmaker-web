// fix_remit_logout_stuck_saving.js
// confirmRemitLogout() had no timeout on the cash_remittances insert — on a
// slow/flaky connection the `await` can hang indefinitely with the button
// stuck on "Saving…" forever, no error, no way out. Other network calls in
// the app (staff-login.html, dashboard init) already wrap Supabase calls in
// a Promise.race + timeout; this applies the same pattern here: give up
// after 15s, show a toast explaining what happened, and still proceed to
// log out (matching the existing catch(_){} intent of "logout must never
// get permanently stuck").
// Run: node scripts/fix_remit_logout_stuck_saving.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier-.*\.html$/.test(f) && f !== 'cashier_backup.html')
  .sort();

const OLD =
`    try { localStorage.setItem('pm_last_remit_' + STORE_ID + '_' + name, new Date().toISOString()); } catch(_e) {}
    await _sb.from('cash_remittances').insert({
      store_id: STORE_ID, cashier_name: name, shift_date: today,
      pos_sales: pos, cash_on_hand: cash, difference: diff, status: 'pending'
    }).then(()=>{});
    const diffLabel = diff<0 ? \`Short -\${CUR||'₱'}\${Math.abs(diff).toFixed(2)}\` : diff>0 ? \`Over +\${CUR||'₱'}\${Math.abs(diff).toFixed(2)}\` : 'Balanced';
    _sb.from('activity_logs').insert({
      store_id: STORE_ID, actor_name: name, actor_role: CASHIER?.role||'cashier',
      action: 'REMITTANCE', target_name: name,
      details: \`POS: \${CUR||'₱'}\${pos.toFixed(2)} | Cash: \${CUR||'₱'}\${cash.toFixed(2)} | \${diffLabel}\`
    }).then(()=>{});
  } catch(_) {}
  document.getElementById('mRemitLogout').classList.remove('show');
  _actualLogout();`;

const NEW =
`    try { localStorage.setItem('pm_last_remit_' + STORE_ID + '_' + name, new Date().toISOString()); } catch(_e) {}
    await Promise.race([
      _sb.from('cash_remittances').insert({
        store_id: STORE_ID, cashier_name: name, shift_date: today,
        pos_sales: pos, cash_on_hand: cash, difference: diff, status: 'pending'
      }),
      new Promise((_,rej) => setTimeout(() => rej(new Error('timeout')), 15000))
    ]);
    const diffLabel = diff<0 ? \`Short -\${CUR||'₱'}\${Math.abs(diff).toFixed(2)}\` : diff>0 ? \`Over +\${CUR||'₱'}\${Math.abs(diff).toFixed(2)}\` : 'Balanced';
    _sb.from('activity_logs').insert({
      store_id: STORE_ID, actor_name: name, actor_role: CASHIER?.role||'cashier',
      action: 'REMITTANCE', target_name: name,
      details: \`POS: \${CUR||'₱'}\${pos.toFixed(2)} | Cash: \${CUR||'₱'}\${cash.toFixed(2)} | \${diffLabel}\`
    }).then(()=>{});
  } catch(_) {
    showToast('Could not save the remittance — check your internet. Logging out anyway.', true);
  }
  document.getElementById('mRemitLogout').classList.remove('show');
  _actualLogout();`;

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes("setTimeout(() => rej(new Error('timeout')), 15000));\n    const diffLabel")) { console.log(`—  ${file}: already patched`); skipped++; continue; }
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
