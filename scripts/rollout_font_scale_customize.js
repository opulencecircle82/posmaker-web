// rollout_font_scale_customize.js
// The Font Size Scale slider was added to customize.html, but customize.html
// only renders when accessed directly — each business type actually loads
// its OWN separate customize-<slug>.html copy (24 of them; earlier file
// searches this session missed them, which caused real confusion). Applies
// the same 7 edits made to customize.html to all 24 per-business copies.
// Run: node scripts/rollout_font_scale_customize.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^customize-.*\.html$/.test(f))
  .sort();

const PATCHES = [
  ['P1-html-field',
`        <div class="font-preview-text" id="fontPreview">The quick brown fox &#8212; &#8369;1,234.56</div>
      </div>
    </div>

    <!-- BUTTON STYLE -->`,
`        <div class="font-preview-text" id="fontPreview">The quick brown fox &#8212; &#8369;1,234.56</div>
      </div>
      <div class="cz-field">
        <label>Font Size Scale</label>
        <div class="range-row">
          <input type="range" class="cz-range" id="czFontScale" min="80" max="130" step="5" value="100" oninput="applyPreview()">
          <span class="rval" id="valFontScale">100%</span>
        </div>
      </div>
    </div>

    <!-- BUTTON STYLE -->`],

  ['P2-read-value',
`  const radius  = document.getElementById('czRadius').value;
  const opacity = document.getElementById('czBgOpacity').value;

  // Update labels & swatches`,
`  const radius  = document.getElementById('czRadius').value;
  const opacity = document.getElementById('czBgOpacity').value;
  const fontScale = document.getElementById('czFontScale').value;

  // Update labels & swatches`],

  ['P3-display-label',
`  document.getElementById('valRadius').textContent    = radius + 'px';
  document.getElementById('valBgOpacity').textContent = opacity + '%';`,
`  document.getElementById('valRadius').textContent    = radius + 'px';
  document.getElementById('valBgOpacity').textContent = opacity + '%';
  document.getElementById('valFontScale').textContent = fontScale + '%';`],

  ['P4-apply-zoom',
`  ].forEach(([k, v]) => m.style.setProperty(k, v));
  m.style.fontFamily = \`'\${font}', sans-serif\`;`,
`  ].forEach(([k, v]) => m.style.setProperty(k, v));
  m.style.fontFamily = \`'\${font}', sans-serif\`;
  m.style.zoom = fontScale / 100;`],

  ['P5-load-from-store',
`  if (store.pos_radius != null) document.getElementById('czRadius').value = store.pos_radius;`,
`  if (store.pos_radius != null) document.getElementById('czRadius').value = store.pos_radius;
  if (store.pos_font_scale != null) document.getElementById('czFontScale').value = store.pos_font_scale;`],

  ['P6-save-payload',
`  const radius  = parseInt(document.getElementById('czRadius').value);
  const footer  = document.getElementById('czFooter').value;
  const imgVal  = bgImgData || '';
  const opacity = parseInt(document.getElementById('czBgOpacity').value);

  // Try progressively simpler payloads until one succeeds
  // (handles databases where new columns haven't been added yet)
  const tries = [
    { pos_font:font, pos_accent:accent, pos_bg:bg, pos_card:card, pos_text:text, pos_radius:radius,
      pos_name_color:nameColor, pos_price_color:priceColor,
      pos_btn_style:btnStyle, pos_bg_scale:bgScale, pos_bg_opacity:opacity, pos_bg_img:imgVal, receipt_footer:footer },`,
`  const radius  = parseInt(document.getElementById('czRadius').value);
  const footer  = document.getElementById('czFooter').value;
  const imgVal  = bgImgData || '';
  const opacity = parseInt(document.getElementById('czBgOpacity').value);
  const fontScale = parseInt(document.getElementById('czFontScale').value);

  // Try progressively simpler payloads until one succeeds
  // (handles databases where new columns haven't been added yet)
  const tries = [
    { pos_font:font, pos_accent:accent, pos_bg:bg, pos_card:card, pos_text:text, pos_radius:radius,
      pos_name_color:nameColor, pos_price_color:priceColor, pos_font_scale:fontScale,
      pos_btn_style:btnStyle, pos_bg_scale:bgScale, pos_bg_opacity:opacity, pos_bg_img:imgVal, receipt_footer:footer },`],

  ['P7-reset',
`  document.getElementById('czRadius').value    = '10';
  document.getElementById('czBgOpacity').value = '18';`,
`  document.getElementById('czRadius').value    = '10';
  document.getElementById('czBgOpacity').value = '18';
  document.getElementById('czFontScale').value = '100';`],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('czFontScale')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label); continue; }
    c = c.replace(oldStr, newStr);
  }
  if (fileErrs.length) { errors[file] = fileErrs; console.log(`⚠  ${file}: missing ${fileErrs.join(', ')}`); continue; }

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (Object.keys(errors).length) {
  console.log('\nFiles with anchor errors (not modified):');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
