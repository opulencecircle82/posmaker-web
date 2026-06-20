// rollout_text_only_font_scale.js
// Font Size Scale previously used CSS `zoom`, which scaled EVERYTHING
// (icons, photos, padding, card size) — not what "font size" should mean.
// Converts the actual text-bearing CSS rules (product name/price, cart
// lines, category tabs, totals, buttons) to font-size:calc(Npx * var(
// --font-scale,1)) instead, and switches applyPosTheme() to set that CSS
// variable rather than zooming the whole page. Icon/photo-only rules
// (.p-noimg etc.) are deliberately left untouched.
// Run: node scripts/rollout_text_only_font_scale.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier-.*\.html$/.test(f) && f !== 'cashier_backup.html' && f !== 'cashier-fastfood.html')
  .sort();

function scaled(px) { return `calc(${px}px * var(--font-scale,1))`; }

const PATCHES = [
  ['hdr-title/cashier',
    `.hdr-title{font-size:15px;font-weight:700;flex:1}\n.hdr-cashier{font-size:11px;opacity:.85;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`,
    `.hdr-title{font-size:${scaled(15)};font-weight:700;flex:1}\n.hdr-cashier{font-size:${scaled(11)};opacity:.85;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`],
  ['ot-btn',
    `.ot-btn{flex:1;padding:9px 6px;border:none;background:transparent;color:#666;font-size:12px;font-weight:700;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;transition:all .15s;letter-spacing:.4px;text-transform:uppercase}`,
    `.ot-btn{flex:1;padding:9px 6px;border:none;background:transparent;color:#666;font-size:${scaled(12)};font-weight:700;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;transition:all .15s;letter-spacing:.4px;text-transform:uppercase}`],
  ['cat-btn',
    `.cat-btn{background:var(--s2);border:1px solid var(--border);color:#888;padding:7px 14px;border-radius:6px;cursor:pointer;white-space:nowrap;font-size:11px;font-weight:700;flex-shrink:0;text-transform:uppercase;letter-spacing:.6px;transition:all .15s}`,
    `.cat-btn{background:var(--s2);border:1px solid var(--border);color:#888;padding:7px 14px;border-radius:6px;cursor:pointer;white-space:nowrap;font-size:${scaled(11)};font-weight:700;flex-shrink:0;text-transform:uppercase;letter-spacing:.6px;transition:all .15s}`],
  ['r-card-name/sku',
    `.r-card-name{font-size:11px;font-weight:600;color:var(--name-color,#ccc);line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.r-card-sku{font-size:9px;color:#444;font-family:monospace}`,
    `.r-card-name{font-size:${scaled(11)};font-weight:600;color:var(--name-color,#ccc);line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.r-card-sku{font-size:${scaled(9)};color:#444;font-family:monospace}`],
  ['r-card-price/stock',
    `.r-card-price{font-size:12px;font-weight:800;color:var(--price-color,var(--accent))}\n.r-card-stock{font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px}`,
    `.r-card-price{font-size:${scaled(12)};font-weight:800;color:var(--price-color,var(--accent))}\n.r-card-stock{font-size:${scaled(9)};font-weight:700;padding:1px 5px;border-radius:3px}`],
  ['retail-pay t-row',
    `.retail-pay .t-row{font-size:12px;padding:3px 0}\n.retail-pay .t-row.big{font-size:26px;font-weight:900;color:var(--accent);padding:12px 0 4px;border-top:1px solid var(--border);margin-top:4px}`,
    `.retail-pay .t-row{font-size:${scaled(12)};padding:3px 0}\n.retail-pay .t-row.big{font-size:${scaled(26)};font-weight:900;color:var(--accent);padding:12px 0 4px;border-top:1px solid var(--border);margin-top:4px}`],
  ['p-name/price/stock',
    `.p-name{font-size:11px;line-height:1.3;color:var(--name-color,#ddd);margin-bottom:3px;font-weight:500}\n.p-price{color:var(--price-color,var(--accent));font-size:13px;font-weight:800}\n.p-stock{font-size:10px;font-weight:600;margin-top:2px}`,
    `.p-name{font-size:${scaled(11)};line-height:1.3;color:var(--name-color,#ddd);margin-bottom:3px;font-weight:500}\n.p-price{color:var(--price-color,var(--accent));font-size:${scaled(13)};font-weight:800}\n.p-stock{font-size:${scaled(10)};font-weight:600;margin-top:2px}`],
  ['act-btn',
    `.act-btn{flex:1;padding:5px 2px;border:1px solid var(--border);background:var(--s2);color:#999;border-radius:5px;cursor:pointer;font-size:10px;font-weight:700;text-align:center;white-space:nowrap;letter-spacing:.3px}`,
    `.act-btn{flex:1;padding:5px 2px;border:1px solid var(--border);background:var(--s2);color:#999;border-radius:5px;cursor:pointer;font-size:${scaled(10)};font-weight:700;text-align:center;white-space:nowrap;letter-spacing:.3px}`],
  ['ci-name',
    `.ci-name{flex:1;color:#ccc;font-size:11px;line-height:1.25}`,
    `.ci-name{flex:1;color:#ccc;font-size:${scaled(11)};line-height:1.25}`],
  ['ci-qty-num/ci-line',
    `.ci-qty-num{min-width:16px;text-align:center;font-size:11px}\n.ci-line{color:#aaa;min-width:48px;text-align:right;font-size:11px}`,
    `.ci-qty-num{min-width:16px;text-align:center;font-size:${scaled(11)}}\n.ci-line{color:#aaa;min-width:48px;text-align:right;font-size:${scaled(11)}}`],
  ['disc-label',
    `.disc-label{font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px;font-weight:700}`,
    `.disc-label{font-size:${scaled(9)};color:#555;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px;font-weight:700}`],
  ['disc-inp',
    `.disc-inp{flex:1;padding:5px 7px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px;outline:none;font-family:inherit;min-width:0}`,
    `.disc-inp{flex:1;padding:5px 7px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:${scaled(12)};outline:none;font-family:inherit;min-width:0}`],
  ['totals',
    `.totals{padding:7px 9px;border-top:1px solid var(--border);font-size:11px;flex-shrink:0}`,
    `.totals{padding:7px 9px;border-top:1px solid var(--border);font-size:${scaled(11)};flex-shrink:0}`],
  ['t-row.big',
    `.t-row.big{font-size:15px;font-weight:800;color:var(--accent);padding-top:4px}`,
    `.t-row.big{font-size:${scaled(15)};font-weight:800;color:var(--accent);padding-top:4px}`],
  ['pay-label',
    `.pay-label{font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px;font-weight:700}`,
    `.pay-label{font-size:${scaled(9)};color:#555;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px;font-weight:700}`],
  ['m-btn',
    `.m-btn{flex:1;padding:6px 2px;border:2px solid var(--border);background:transparent;color:#777;border-radius:5px;cursor:pointer;font-size:11px;min-width:0;font-weight:600}`,
    `.m-btn{flex:1;padding:6px 2px;border:2px solid var(--border);background:transparent;color:#777;border-radius:5px;cursor:pointer;font-size:${scaled(11)};min-width:0;font-weight:600}`],
  ['q-cash',
    `.q-cash{flex:1;min-width:50px;padding:6px 3px;background:var(--s2);border:1px solid var(--border);color:#ccc;border-radius:5px;cursor:pointer;font-size:11px}`,
    `.q-cash{flex:1;min-width:50px;padding:6px 3px;background:var(--s2);border:1px solid var(--border);color:#ccc;border-radius:5px;cursor:pointer;font-size:${scaled(11)}}`],
  ['btn-checkout',
    `.btn-checkout{margin:6px 7px 7px;background:var(--accent);color:#fff;border:none;padding:11px;border-radius:var(--radius);font-size:14px;font-weight:700;cursor:pointer;width:calc(100% - 14px)}`,
    `.btn-checkout{margin:6px 7px 7px;background:var(--accent);color:#fff;border:none;padding:11px;border-radius:var(--radius);font-size:${scaled(14)};font-weight:700;cursor:pointer;width:calc(100% - 14px)}`],
  ['poItem-name',
    `<span style="flex:1;min-width:0;font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${it.name}</span>`,
    `<span style="flex:1;min-width:0;font-size:${scaled(12)};font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${it.name}</span>`],
  ['poItem-total',
    `<span id="poItemTotal_\${idx}" style="font-size:12px;font-weight:700;color:var(--accent);min-width:54px;text-align:right;flex-shrink:0">\${CUR}\${(it.price*it.qty).toFixed(2)}</span>`,
    `<span id="poItemTotal_\${idx}" style="font-size:${scaled(12)};font-weight:700;color:var(--accent);min-width:54px;text-align:right;flex-shrink:0">\${CUR}\${(it.price*it.qty).toFixed(2)}</span>`],
  ['apply-theme-zoom-to-var',
    `  if (s.pos_font_scale)  document.body.style.zoom = s.pos_font_scale / 100;`,
    `  if (s.pos_font_scale)  r.style.setProperty('--font-scale', s.pos_font_scale / 100);`],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('var(--font-scale')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label); continue; }
    c = c.replace(oldStr, newStr);
  }

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  if (fileErrs.length) { errors[file] = fileErrs; console.log(`~  ${file}: applied, but missing ${fileErrs.join(', ')}`); }
  else console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (Object.keys(errors).length) {
  console.log('\nFiles with SOME anchors not found (still written, just incomplete):');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
