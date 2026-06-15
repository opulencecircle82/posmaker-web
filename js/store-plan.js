// Shared helpers for Free/Pro plan limits and "frozen" (over-limit) items.
// Used by dashboard-*.html and cashier-*.html.

// Returns the Set of ids that are "frozen" (everything past the first `limit`
// rows, oldest-first by created_at) when !isPro. Empty set when isPro.
function computeFrozenIds(rows, limit, isPro) {
  if (isPro) return new Set();
  return new Set(
    [...rows]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(limit)
      .map(r => r.id)
  );
}

// Small inline badge for frozen rows in dashboard tables.
function frozenBadgeHtml() {
  return ' <span class="badge" style="background:#2a1a00;color:#f59e0b" title="Over your free plan limit — upgrade to unlock">&#128274; Frozen</span>';
}

// Cashier-side (anon) Pro check via SECURITY DEFINER RPC.
async function getStorePro(sb, storeId) {
  const { data, error } = await sb.rpc('get_store_pro_status', { p_store_id: storeId });
  if (error) { console.error('getStorePro error:', error); return false; }
  return !!data;
}

// Auto-generate a SKU like "COF-001" from a category name, based on the
// highest existing SKU number already used in that category.
function genAutoSku(category, items) {
  const prefix = (category || 'ITM').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'ITM';
  const re = new RegExp('^' + prefix + '-(\\d+)$');
  let max = 0;
  for (const it of items) {
    if (it.category !== category) continue;
    const m = (it.sku || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return prefix + '-' + String(max + 1).padStart(3, '0');
}
