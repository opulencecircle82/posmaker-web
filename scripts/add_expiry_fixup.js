// add_expiry_fixup.js
// Fix P6 (name cell promo tag) and P11 (expiry banner div) missed by first pass
// Run: node scripts/add_expiry_fixup.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html')
  .sort();

let p6Fixed = 0, p11Fixed = 0, p6Skip = 0, p11Skip = 0;

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');
  let changed = false;

  // ── P6: add promoTag after i.name in inventory row ──────────────────────
  // Two variants: frozenInvIds.has(i.id) or frozen
  const P6A_OLD = '${i.name}${promoTag}${frozenInvIds.has(i.id)?frozenBadgeHtml():\'\'}';
  const P6B_OLD = '${i.name}${promoTag}${frozen?frozenBadgeHtml():\'\'}';
  if (c.includes(P6A_OLD) || c.includes(P6B_OLD)) {
    p6Skip++;
  } else {
    const P6A_SRC = '${i.name}${frozenInvIds.has(i.id)?frozenBadgeHtml():\'\'}';
    const P6B_SRC = '${i.name}${frozen?frozenBadgeHtml():\'\'}';
    if (c.includes(P6A_SRC)) {
      c = c.replace(P6A_SRC, '${i.name}${promoTag}${frozenInvIds.has(i.id)?frozenBadgeHtml():\'\'}');
      p6Fixed++; changed = true;
    } else if (c.includes(P6B_SRC)) {
      c = c.replace(P6B_SRC, '${i.name}${promoTag}${frozen?frozenBadgeHtml():\'\'}');
      p6Fixed++; changed = true;
    } else {
      console.log(`⚠  ${file} P6: name cell anchor not found`);
    }
  }

  // ── P11: insert expiry banner div before the inventory <table> ──────────
  const BANNER = '<div id="invExpiryBanner" style="display:none;background:#1a0505;border:1px solid #7f1d1d;border-radius:8px;padding:10px 16px;margin:0 0 10px;font-size:13px;color:var(--text);line-height:1.6"></div>\n          ';
  if (c.includes('id="invExpiryBanner"')) {
    p11Skip++;
  } else {
    // Find <table> that is immediately followed by the invTbody thead
    // Anchor: "<table>\n          <thead><tr><th>SKU</th>"
    const TABLE_ANCHOR = '<table>\n          <thead><tr><th>SKU</th>';
    if (c.includes(TABLE_ANCHOR)) {
      c = c.replace(TABLE_ANCHOR, BANNER + TABLE_ANCHOR);
      p11Fixed++; changed = true;
    } else {
      // fallback: find <tbody id="invTbody"> and insert before the parent <table>
      const tbodyIdx = c.indexOf('<tbody id="invTbody">');
      if (tbodyIdx !== -1) {
        // walk back to find the opening <table>
        const before = c.slice(0, tbodyIdx);
        const lastTable = before.lastIndexOf('<table>');
        if (lastTable !== -1) {
          c = c.slice(0, lastTable) + BANNER + c.slice(lastTable);
          p11Fixed++; changed = true;
        } else {
          console.log(`⚠  ${file} P11: <table> not found before invTbody`);
        }
      } else {
        console.log(`⚠  ${file} P11: invTbody not found`);
      }
    }
  }

  if (changed) {
    const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
    fs.writeFileSync(fp, out, 'utf-8');
    console.log(`✓  ${file}`);
  }
}

console.log(`\nP6: ${p6Fixed} fixed, ${p6Skip} already done.`);
console.log(`P11: ${p11Fixed} fixed, ${p11Skip} already done.`);
