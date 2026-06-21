-- dedupe_stores.sql
-- Run in Supabase SQL Editor. Removes any duplicate store rows that share
-- the same owner_id (keeping the oldest one per owner), cleaning up child
-- rows first to satisfy foreign keys. Run BEFORE the
-- stores_owner_id_unique constraint in sql/schema.sql.

CREATE TEMP TABLE _dupe_stores AS
SELECT id FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at ASC) AS rn
  FROM stores
) t WHERE t.rn > 1;

-- Inspect before deleting
SELECT * FROM stores WHERE id IN (SELECT id FROM _dupe_stores);

DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE store_id IN (SELECT id FROM _dupe_stores));
DELETE FROM orders        WHERE store_id IN (SELECT id FROM _dupe_stores);
DELETE FROM staff_logs     WHERE store_id IN (SELECT id FROM _dupe_stores);
DELETE FROM activity_logs  WHERE store_id IN (SELECT id FROM _dupe_stores);
DELETE FROM categories     WHERE store_id IN (SELECT id FROM _dupe_stores);
DELETE FROM draft_orders   WHERE store_id IN (SELECT id FROM _dupe_stores);
DELETE FROM pos_devices    WHERE store_id IN (SELECT id FROM _dupe_stores);
DELETE FROM inventory_items WHERE store_id IN (SELECT id FROM _dupe_stores);
DELETE FROM products      WHERE store_id IN (SELECT id FROM _dupe_stores);
DELETE FROM store_users   WHERE store_id IN (SELECT id FROM _dupe_stores);

DELETE FROM stores WHERE id IN (SELECT id FROM _dupe_stores);

DROP TABLE _dupe_stores;
