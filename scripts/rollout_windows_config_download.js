// rollout_windows_config_download.js
// Every dashboard already had a working downloadStoreConfig() function (saves
// a posmaker-store.json with this store's id) and the Electron app already
// auto-detects that file next to POSMaker.exe and registers with zero typing
// (main.js "Path A") — but no button anywhere called it, so owners were stuck
// manually typing the Store Code every time. This wires up a "Download Your
// Config File" button under the Windows ZIP download and updates the steps.
// Run: node scripts/rollout_windows_config_download.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const OLD = `            <div style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">Download, extract, and run <strong style="color:var(--text)">POSMaker.exe</strong>. Enter your Store Code on first launch — locked to that device automatically.</div>
            <div style="font-size:11px;background:var(--s2);border-radius:7px;padding:10px;color:#ccc;line-height:1.9;margin-bottom:12px">
              1&#65039;&#8419; Download &amp; extract the <strong style="color:var(--accent)">ZIP</strong><br>
              2&#65039;&#8419; Run <strong style="color:var(--accent)">POSMaker.exe</strong><br>
              3&#65039;&#8419; Enter your <strong style="color:var(--accent)">Store Code</strong> on first launch<br>
              4&#65039;&#8419; Device is locked to your store &#128274;
            </div>
            <a class="btn btn-accent btn-sm" style="width:100%;justify-content:center;text-decoration:none;display:flex" href="https://github.com/le0n1982/posmaker-web/releases/latest/download/POSMaker-Windows.zip" target="_blank">&#11015; Download Windows ZIP</a>`;

const NEW = `            <div style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">Download the app and your personal config file, then run <strong style="color:var(--text)">POSMaker.exe</strong> — it connects automatically, no typing needed.</div>
            <div style="font-size:11px;background:var(--s2);border-radius:7px;padding:10px;color:#ccc;line-height:1.9;margin-bottom:12px">
              1&#65039;&#8419; Download &amp; extract the <strong style="color:var(--accent)">ZIP</strong><br>
              2&#65039;&#8419; Download your <strong style="color:var(--accent)">Config File</strong> and put it in the same folder as POSMaker.exe<br>
              3&#65039;&#8419; Run <strong style="color:var(--accent)">POSMaker.exe</strong> — connects automatically<br>
              4&#65039;&#8419; Device is locked to your store &#128274;
            </div>
            <a class="btn btn-accent btn-sm" style="width:100%;justify-content:center;text-decoration:none;display:flex;margin-bottom:8px" href="https://github.com/le0n1982/posmaker-web/releases/latest/download/POSMaker-Windows.zip" target="_blank">&#11015; Download Windows ZIP</a>
            <button type="button" class="btn btn-ghost btn-sm" style="width:100%;justify-content:center" onclick="downloadStoreConfig()">&#128196; Download Your Config File</button>`;

let patched = 0, skipped = 0;
const errors = [];

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('Download Your Config File')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found`); errors.push(file); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (errors.length) console.log('Anchor not found in: ' + errors.join(', '));
