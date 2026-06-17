// fix_report_summary_right.js
// Move Overall Summary in renderReport() to a sticky right panel with divider
// Run: node scripts/fix_report_summary_right.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

// Regex to match the Overall Summary block + closing lines (quote-agnostic)
// Matches: html += `<div style=?background:var(--s2)...`; + html += '</div>'; + el.innerHTML = html; + rptDownload line + }
const BLOCK_RE = /(  html \+= `<div style=.background:var\(--s2\)[^`]+`;\n\n  html \+= '<\/div>';\n  el\.innerHTML = html;\n  document\.getElementById\('rptDownload'\)\.style\.display = '';\n})/s;

// The replacement block
const NEW_BLOCK =
'  const summaryHtml = `<div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:16px 18px">\n' +
'    <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">&#128202; Overall Summary</div>\n' +
'    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">\n' +
'      <div style="background:var(--s1);border-radius:8px;padding:10px 12px">\n' +
'        <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Total Orders</div>\n' +
'        <div style="font-size:20px;font-weight:800">${grandCount}</div>\n' +
'      </div>\n' +
'      <div style="background:var(--s1);border-radius:8px;padding:10px 12px">\n' +
'        <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Subtotal (ex-VAT)</div>\n' +
'        <div style="font-size:14px;font-weight:800">${CUR}${grandSub.toFixed(2)}</div>\n' +
'      </div>\n' +
'      <div style="background:var(--s1);border-radius:8px;padding:10px 12px">\n' +
'        <div style="font-size:10px;color:var(--muted);margin-bottom:3px">VAT (${TAX}%)</div>\n' +
'        <div style="font-size:14px;font-weight:800">${CUR}${grandVat.toFixed(2)}</div>\n' +
'      </div>\n' +
'      <div style="background:linear-gradient(135deg,#003d4d,#00263a);border:1px solid var(--accent);border-radius:8px;padding:10px 12px;grid-column:1/-1">\n' +
'        <div style="font-size:10px;color:var(--accent);margin-bottom:3px">GRAND TOTAL</div>\n' +
'        <div style="font-size:22px;font-weight:800;color:var(--accent)">${CUR}${grandTotal.toFixed(2)}</div>\n' +
'      </div>\n' +
'    </div>\n' +
'    ${typeCols ? `<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">&#127860; By Order Type</div>\n' +
'    <div style="display:grid;grid-template-columns:1fr;gap:8px">${typeCols}</div>` : \'\'}\n' +
'  </div>`;\n' +
'\n' +
'  html += \'</div>\';\n' +
'  el.innerHTML = `<div style="display:flex;gap:0;align-items:flex-start"><div style="flex:1;min-width:0">${html}</div><div style="width:1px;background:var(--border);margin:0 18px;align-self:stretch;flex-shrink:0"></div><div style="width:260px;flex-shrink:0;position:sticky;top:16px">${summaryHtml}</div></div>`;\n' +
'  document.getElementById(\'rptDownload\').style.display = \'\';\n' +
'}';

let patched = 0, skipped = 0, errors = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (!c.includes('Overall Summary')) { skipped++; continue; }
  if (c.includes('summaryHtml')) { console.log(`— ${file}: already patched`); skipped++; continue; }

  if (!BLOCK_RE.test(c)) {
    console.log(`⚠  ${file}: block regex not found`);
    errors++;
    continue;
  }

  c = c.replace(BLOCK_RE, NEW_BLOCK);

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} patched, ${skipped} skipped, ${errors} errors.`);
