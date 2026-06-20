// rollout_remove_sw_reload.js
// Follow-up to rollout_sw_reload_guard.js: rather than just limiting the
// auto-reload-on-update to once per session, remove it outright. Nothing
// about the active session (staff login, store device pairing) lives in the
// service worker cache, so there's nothing to "preserve" by reloading — the
// reload was only ever disruptive (it's what looked like a random logout).
// The new service worker still takes over for future requests via
// skipWaiting()/clients.claim() in sw.js; the currently-open page just keeps
// running on its already-loaded JS until the app is next closed and reopened.
// Run: node scripts/rollout_remove_sw_reload.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /\.html$/.test(f))
  .sort();

const OLD_VARIANTS = [
`  // Reload once to pick up a new service worker — guarded so a flaky
  // connection that keeps re-triggering "controllerchange" can't bounce the
  // page in a reload loop (which looked like the cashier getting logged out
  // every few seconds).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sessionStorage.getItem('_swReloaded')) return;
    sessionStorage.setItem('_swReloaded', '1');
    setTimeout(()=>location.reload(), 400);
  });`,
`navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sessionStorage.getItem('_swReloaded')) return;
    sessionStorage.setItem('_swReloaded', '1');
    setTimeout(()=>location.reload(), 400);
  });`,
];

const NEW = `  // Intentionally no reload-on-update: nothing about the active session
  // (staff login, device pairing) lives in the SW cache, so there's nothing
  // to gain from reloading — it only disrupted whoever was using the page.
  // The new worker still takes over future requests via skipWaiting() above;
  // this tab just keeps running until it's next closed and reopened.`;

let patched = 0, skipped = 0;
const errors = [];

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  if (!raw.includes("addEventListener('controllerchange'")) continue;
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (!c.includes('_swReloaded')) { console.log(`—  ${file}: not the guarded version (skip)`); skipped++; continue; }
  const matchedOld = OLD_VARIANTS.find(v => c.includes(v));
  if (!matchedOld) { console.log(`⚠  ${file}: anchor not found`); errors.push(file); continue; }

  c = c.replace(matchedOld, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (errors.length) console.log('Anchor not found in: ' + errors.join(', '));
