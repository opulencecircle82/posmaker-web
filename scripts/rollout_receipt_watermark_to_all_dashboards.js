// rollout_receipt_watermark_to_all_dashboards.js
// "Send Payment" receipt proof had no date/time watermark (unlike the
// Disbursement photo in manager.html, which already had one) — a reused
// old screenshot couldn't be distinguished from a fresh one. Adds the same
// watermark helper used elsewhere, applied to both the direct file upload
// and the "Scan QR from phone" upload path.
// Run: node scripts/rollout_receipt_watermark_to_all_dashboards.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

const P1_OLD = `// ── Send Payment to Staff ──────────────────────────────────────────────────
let _spStaffId='',_spQRPoll=null,_spQRToken=null;`;
const P1_NEW =
`// Stamps the current date/time onto a receipt photo so the proof can't be
// confused with an old/reused screenshot — applied to both direct uploads
// and photos sent over from a phone via "Scan QR".
function addTimestampWatermark(canvas) {
  const ctx = canvas.getContext('2d');
  const now = new Date();
  const ts = now.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})
    + '  ' + now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const fs = Math.max(20, Math.round(canvas.width * 0.055));
  ctx.font = 'bold ' + fs + 'px monospace';
  const pad = 8, tw = ctx.measureText(ts).width + pad*2, th = fs + pad*2;
  const x = pad, y = canvas.height - th - pad;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, tw, th);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(ts, x + pad, y + pad + fs * 0.85);
}
function watermarkImageDataUrl(rawDataUrl, maxSize) {
  maxSize = maxSize || 1200;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      cv.width = img.width * scale; cv.height = img.height * scale;
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      addTimestampWatermark(cv);
      resolve(cv.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}
// ── Send Payment to Staff ──────────────────────────────────────────────────
let _spStaffId='',_spQRPoll=null,_spQRToken=null;`;

const P2_OLD = `      document.getElementById('spReceiptImg').src=cv.toDataURL('image/jpeg',0.6);`;
const P2_NEW = `      addTimestampWatermark(cv);\n      document.getElementById('spReceiptImg').src=cv.toDataURL('image/jpeg',0.6);`;

const P3_OLD = `    document.getElementById('spReceiptImg').src='data:image/jpeg;base64,'+sess.images[0];`;
const P3_NEW = `    document.getElementById('spReceiptImg').src=await watermarkImageDataUrl('data:image/jpeg;base64,'+sess.images[0]);`;

const PATCHES = [
  ['P1-helpers', P1_OLD, P1_NEW],
  ['P2-direct',  P2_OLD, P2_NEW],
  ['P3-qr',      P3_OLD, P3_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('function addTimestampWatermark')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
