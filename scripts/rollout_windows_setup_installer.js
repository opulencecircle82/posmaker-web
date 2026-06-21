// rollout_windows_setup_installer.js
// The Windows cashier app moved from a portable ZIP (Electron) to a proper
// installer (POSMakerSetup.exe, Flutter-based) — updates the "Download &
// Install" card's instructions/button across all 25 dashboard-*.html files.
// Run: node scripts/rollout_windows_setup_installer.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const OLD = `            <div style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">Download the app and your personal config file, then run <strong style="color:var(--text)">POSMaker.exe</strong> — it connects automatically, no typing needed.</div>
            <div style="font-size:11px;background:var(--s2);border-radius:7px;padding:10px;color:#ccc;line-height:1.9;margin-bottom:12px">
              1&#65039;&#8419; Download &amp; extract the <strong style="color:var(--accent)">ZIP</strong><br>
              2&#65039;&#8419; Download your <strong style="color:var(--accent)">Config File</strong> and put it in the same folder as POSMaker.exe<br>
              3&#65039;&#8419; Run <strong style="color:var(--accent)">POSMaker.exe</strong> — connects automatically<br>
              4&#65039;&#8419; Device is locked to your store &#128274;
            </div>
            <a class="btn btn-accent btn-sm" style="width:100%;justify-content:center;text-decoration:none;display:flex;margin-bottom:8px" href="https://github.com/le0n1982/posmaker-web/releases/latest/download/POSMaker-Windows.zip" target="_blank">&#11015; Download Windows ZIP</a>`;

const NEW = `            <div style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">Download the installer and your personal config file, then run <strong style="color:var(--text)">POSMaker.exe</strong> — it connects automatically, no typing needed.</div>
            <div style="font-size:11px;background:var(--s2);border-radius:7px;padding:10px;color:#ccc;line-height:1.9;margin-bottom:12px">
              1&#65039;&#8419; Download &amp; run the <strong style="color:var(--accent)">Setup</strong> (installs POSMaker)<br>
              2&#65039;&#8419; Download your <strong style="color:var(--accent)">Config File</strong> and put it in the install folder, next to POSMaker.exe<br>
              3&#65039;&#8419; Run <strong style="color:var(--accent)">POSMaker.exe</strong> — connects automatically<br>
              4&#65039;&#8419; Device is locked to your store &#128274;
            </div>
            <a class="btn btn-accent btn-sm" style="width:100%;justify-content:center;text-decoration:none;display:flex;margin-bottom:8px" href="https://github.com/le0n1982/posmaker-web/releases/latest/download/POSMakerSetup.exe" target="_blank">&#11015; Download Windows Setup</a>`;

let patched = 0, skipped = 0;
const errors = [];

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('Download Windows Setup')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { errors.push(file); console.log(`⚠  ${file}: anchor not found — not modified`); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped, ${errors.length} errors.`);
if (errors.length) console.log('Files with anchor errors:', errors.join(', '));
