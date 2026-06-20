// rollout_sw_reload_guard.js
// navigator.serviceWorker.addEventListener('controllerchange', ...) reloads
// the page to pick up a new service worker. On a flaky connection this can
// keep re-firing, bouncing the page in a reload loop — which on the cashier
// looks exactly like getting logged out every few seconds (login state is
// in-memory JS, wiped on every reload). Guards it with a sessionStorage flag
// so it reloads at most once per session instead of looping.
// Formatting of the original listener varies file-to-file (some wrap in
// setTimeout, some don't, spacing differs), so this matches by regex rather
// than exact string and reports any file where the pattern isn't found.
// Run: node scripts/rollout_sw_reload_guard.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /\.html$/.test(f))
  .sort();

const PATTERN = /navigator\.serviceWorker\.addEventListener\('controllerchange',\s*\(\)\s*=>\s*(?:setTimeout\(\(\)\s*=>\s*location\.reload\(\),\s*\d+\)|location\.reload\(\))\s*\);/;

const GUARDED = `navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sessionStorage.getItem('_swReloaded')) return;
    sessionStorage.setItem('_swReloaded', '1');
    setTimeout(()=>location.reload(), 400);
  });`;

let patched = 0, skipped = 0;
const errors = [];

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  if (!raw.includes("addEventListener('controllerchange'")) continue;
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('_swReloaded')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!PATTERN.test(c)) { console.log(`⚠  ${file}: pattern not matched (needs manual check)`); errors.push(file); continue; }

  c = c.replace(PATTERN, GUARDED);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (errors.length) console.log('\nPattern not matched (check manually): ' + errors.join(', '));
