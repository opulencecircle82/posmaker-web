// rollout_text_only_font_scale_customize.js
// Same fix as rollout_text_only_font_scale.js but for the Customize POS live
// preview mock (.pm-* classes), which previously used zoom on the whole
// #posMock element. Converts the text-bearing .pm-* rules to font-size:calc(
// Npx * var(--font-scale,1)) and switches applyPreview() to set that
// variable on #posMock instead of zooming it.
// Run: node scripts/rollout_text_only_font_scale_customize.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^customize-.*\.html$/.test(f))
  .sort();

function scaled(px) { return `calc(${px}px * var(--font-scale,1))`; }

const PATCHES = [
  ['pm-storename',
    `.pm-storename{font-size:14px;font-weight:800;color:#fff;flex:1}`,
    `.pm-storename{font-size:${scaled(14)};font-weight:800;color:#fff;flex:1}`],
  ['pm-card-name/price',
    `.pm-card-name{font-size:9px;font-weight:600;color:var(--pm-name,var(--pm-text,#f0f0f8));margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.pm-card-price{font-size:11px;font-weight:800;color:var(--pm-price,var(--pm-accent,#00b4d8))}`,
    `.pm-card-name{font-size:${scaled(9)};font-weight:600;color:var(--pm-name,var(--pm-text,#f0f0f8));margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.pm-card-price{font-size:${scaled(11)};font-weight:800;color:var(--pm-price,var(--pm-accent,#00b4d8))}`],
  ['pm-cart-item',
    `.pm-cart-item{\n  font-size:9px;color:var(--pm-text,#f0f0f8);`,
    `.pm-cart-item{\n  font-size:${scaled(9)};color:var(--pm-text,#f0f0f8);`],
  ['pm-total-*',
    `.pm-total-label{font-size:9px;color:var(--pm-muted,#8888aa)}\n.pm-total-val{font-size:9px;font-weight:700;color:var(--pm-muted,#8888aa)}\n.pm-total-row.big .pm-total-label{font-size:11px;font-weight:800;color:var(--pm-accent,#00b4d8)}\n.pm-total-row.big .pm-total-val{font-size:14px;font-weight:800;color:var(--pm-accent,#00b4d8)}`,
    `.pm-total-label{font-size:${scaled(9)};color:var(--pm-muted,#8888aa)}\n.pm-total-val{font-size:${scaled(9)};font-weight:700;color:var(--pm-muted,#8888aa)}\n.pm-total-row.big .pm-total-label{font-size:${scaled(11)};font-weight:800;color:var(--pm-accent,#00b4d8)}\n.pm-total-row.big .pm-total-val{font-size:${scaled(14)};font-weight:800;color:var(--pm-accent,#00b4d8)}`],
  ['pm-btn',
    `  padding:8px;font-size:11px;font-weight:700;\n  cursor:pointer;font-family:inherit;margin:6px 7px 7px;`,
    `  padding:8px;font-size:${scaled(11)};font-weight:700;\n  cursor:pointer;font-family:inherit;margin:6px 7px 7px;`],
  ['pm-list-name/price',
    `.pm-list-name{flex:1;font-size:9px;font-weight:600;color:var(--pm-name,var(--pm-text,#f0f0f8));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.pm-list-price{font-size:10px;font-weight:800;color:var(--pm-price,var(--pm-accent,#00b4d8));flex-shrink:0}`,
    `.pm-list-name{flex:1;font-size:${scaled(9)};font-weight:600;color:var(--pm-name,var(--pm-text,#f0f0f8));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.pm-list-price{font-size:${scaled(10)};font-weight:800;color:var(--pm-price,var(--pm-accent,#00b4d8));flex-shrink:0}`],
  ['applyPreview-zoom-to-var',
    `  ].forEach(([k, v]) => m.style.setProperty(k, v));\n  m.style.fontFamily = \`'\${font}', sans-serif\`;\n  m.style.zoom = fontScale / 100;`,
    `  ].forEach(([k, v]) => m.style.setProperty(k, v));\n  m.style.fontFamily = \`'\${font}', sans-serif\`;\n  m.style.setProperty('--font-scale', fontScale / 100);`],
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
  console.log('\nFiles with SOME anchors not found:');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
