// fix_scanner_sensitivity_and_checkout_speed.js
// Fix 1: Visual scanner was too lenient (matched almost anything) — tighten the
//        match threshold, increase the required margin between best/runner-up,
//        and require 3 consistent reads (was 2) before auto-adding to cart.
// Fix 2: Checkout did N sequential network round-trips (1 per cart item, then
//        1 per inventory link, then 1 update per inventory link) to deduct stock.
//        Batch the lookups with .in() and run the updates in parallel — cuts a
//        13+ sequential-roundtrip checkout down to ~3 steps.
// Run: node scripts/fix_scanner_sensitivity_and_checkout_speed.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f))
  .sort();

// ── FIX 1: tighten visual scanner thresholds ──────────────────────────────
const S1_OLD =
`        if(best&&bestScore<=0.22&&(secScore-bestScore)>=0.04){
          _visConf[best.id]=(_visConf[best.id]||0)+1;
          const prod=prods.find(p=>p.id===best.id);
          if(prod) camStat('&#128247; <strong>'+prod.name+'</strong> '+pct+'% — hold still…');
          if(_visConf[best.id]>=2&&!isOnCooldown(best.id)){`;
const S1_NEW =
`        if(best&&bestScore<=0.15&&(secScore-bestScore)>=0.07){
          _visConf[best.id]=(_visConf[best.id]||0)+1;
          const prod=prods.find(p=>p.id===best.id);
          if(prod) camStat('&#128247; <strong>'+prod.name+'</strong> '+pct+'% — hold still…');
          if(_visConf[best.id]>=3&&!isOnCooldown(best.id)){`;

// ── FIX 2: batch + parallelize checkout stock deduction ──────────────────
const C_OLD =
`  await _sb.from('order_items').insert(
    items.map(i => ({ order_id: ord.id, product_id: i.id, name: i.name, price: i.price, qty: i.qty }))
  );

  // Auto-deduct inventory stock based on inv_links (or auto-matched inventory item)
  try {
    const deductions = {};
    for (const item of items) {
      const { data: pd } = await _sb.from('products').select('inv_links').eq('id', item.id).single();
      let links = []; try { links = pd?.inv_links ? JSON.parse(pd.inv_links) : []; } catch {}
      if (links.length > 0) {
        for (const link of links) {
          const invId = typeof link === 'string' ? link : link.id;
          const useQty = typeof link === 'object' ? (link.qty || 1) : 1;
          deductions[invId] = (deductions[invId] || 0) + useQty * item.qty;
        }
      } else {
        // Fallback: match inventory item by product name/SKU
        const p = prods.find(x => x.id === item.id);
        const autoId = p?._autoInvLink;
        if (autoId) deductions[autoId] = (deductions[autoId] || 0) + item.qty;
      }
    }
    for (const [invId, totalUse] of Object.entries(deductions)) {
      const { data: row } = await _sb.from('inventory_items').select('stock').eq('id', invId).single();
      if (row != null) {
        const newStock = Math.max(0, (row.stock || 0) - totalUse);
        await _sb.from('inventory_items').update({ stock: newStock }).eq('id', invId);
        // Update in-memory stock so display refreshes without a full reload
        if (invById[invId]) invById[invId].stock = newStock;
        const mp = prods.find(x => x._autoInvLink === invId || (x._invResolved && (JSON.parse(x.inv_links||'[]').some(l=>(l.id||l)===invId))));
        if (mp) mp.stock = Math.max(0, (mp.stock || 0) - totalUse);
      }
    }
  } catch (_) { /* stock deduction is best-effort */ }`;
const C_NEW =
`  // Run order_items insert and the products inv_links lookup in parallel —
  // neither depends on the other's result.
  const [, prodRowsRes] = await Promise.all([
    _sb.from('order_items').insert(
      items.map(i => ({ order_id: ord.id, product_id: i.id, name: i.name, price: i.price, qty: i.qty }))
    ),
    _sb.from('products').select('id,inv_links').in('id', items.map(i => i.id))
  ]);

  // Auto-deduct inventory stock based on inv_links (or auto-matched inventory item)
  try {
    const prodLinksMap = {};
    (prodRowsRes.data || []).forEach(p => { prodLinksMap[p.id] = p.inv_links; });

    const deductions = {};
    for (const item of items) {
      let links = []; try { links = prodLinksMap[item.id] ? JSON.parse(prodLinksMap[item.id]) : []; } catch {}
      if (links.length > 0) {
        for (const link of links) {
          const invId = typeof link === 'string' ? link : link.id;
          const useQty = typeof link === 'object' ? (link.qty || 1) : 1;
          deductions[invId] = (deductions[invId] || 0) + useQty * item.qty;
        }
      } else {
        // Fallback: match inventory item by product name/SKU
        const p = prods.find(x => x.id === item.id);
        const autoId = p?._autoInvLink;
        if (autoId) deductions[autoId] = (deductions[autoId] || 0) + item.qty;
      }
    }

    const invIds = Object.keys(deductions);
    if (invIds.length > 0) {
      const { data: invRows } = await _sb.from('inventory_items').select('id,stock').in('id', invIds);
      const stockMap = {};
      (invRows || []).forEach(r => { stockMap[r.id] = r.stock; });

      // Fire all stock updates in parallel instead of one-by-one
      await Promise.all(invIds.map(invId => {
        const curStock = stockMap[invId];
        if (curStock == null) return Promise.resolve();
        const totalUse = deductions[invId];
        const newStock = Math.max(0, (curStock || 0) - totalUse);
        // Update in-memory stock so display refreshes without a full reload
        if (invById[invId]) invById[invId].stock = newStock;
        const mp = prods.find(x => x._autoInvLink === invId || (x._invResolved && (JSON.parse(x.inv_links||'[]').some(l=>(l.id||l)===invId))));
        if (mp) mp.stock = Math.max(0, (mp.stock || 0) - totalUse);
        return _sb.from('inventory_items').update({ stock: newStock }).eq('id', invId);
      }));
    }
  } catch (_) { /* stock deduction is best-effort */ }`;

const PATCHES = [
  ['S1-scanner-threshold', S1_OLD, S1_NEW],
  ['C-checkout-speed',     C_OLD,  C_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('bestScore<=0.15')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
