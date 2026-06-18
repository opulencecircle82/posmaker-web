// add_trial_banner.js
// Adds a "X days left of free trial" banner at the top of the Dashboard,
// shown only while store.free_until is set and still in the future.
// Run: node scripts/add_trial_banner.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// ── P1: HTML banner before the Quick Setup banner ──────────────────────────
const P1_OLD =
`      <!-- Quick Setup Banner (shown only when store is empty) -->
      <div id="setupBanner" style="display:none;background:linear-gradient(135deg,#0a1a2a,#0a2a1a);border:1px solid var(--accent);border-radius:12px;padding:20px 24px;margin-bottom:20px">`;
const P1_NEW =
`      <!-- Free Trial Banner (shown only during active 14-day trial) -->
      <div id="trialBanner" style="display:none;background:linear-gradient(135deg,#1a0f2a,#0a1a2a);border:1px solid #a855f7;border-radius:12px;padding:14px 24px;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">&#127873;</span>
          <div>
            <div style="font-size:14px;font-weight:700;color:#c084fc" id="trialDaysText"></div>
            <div style="font-size:12px;color:var(--muted)">All Pro features are unlocked during your free trial.</div>
          </div>
        </div>
      </div>
      <!-- Quick Setup Banner (shown only when store is empty) -->
      <div id="setupBanner" style="display:none;background:linear-gradient(135deg,#0a1a2a,#0a2a1a);border:1px solid var(--accent);border-radius:12px;padding:20px 24px;margin-bottom:20px">`;

// ── P2: call checkTrialBanner() alongside checkSetupBanner() ──────────────
const P2_OLD = `  checkSetupBanner();`;
const P2_NEW = `  checkSetupBanner();\n  checkTrialBanner();`;

// ── P3: checkTrialBanner() function — inserted before checkSetupBanner ────
const P3_OLD = `async function checkSetupBanner() {`;
const P3_NEW =
`function checkTrialBanner() {
  const banner = document.getElementById('trialBanner');
  if (!banner || !STORE) return;
  if (!STORE.free_until) { banner.style.display = 'none'; return; }
  const daysLeft = Math.ceil((new Date(STORE.free_until) - new Date()) / 86400000);
  if (daysLeft <= 0) { banner.style.display = 'none'; return; }
  const txt = document.getElementById('trialDaysText');
  if (txt) txt.innerHTML = '&#127881; You have <strong>' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + '</strong> left of your free trial!';
  banner.style.display = '';
}
async function checkSetupBanner() {`;

const PATCHES = [
  ['P1-html', P1_OLD, P1_NEW],
  ['P2-call', P2_OLD, P2_NEW],
  ['P3-fn',   P3_OLD, P3_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('checkTrialBanner')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
