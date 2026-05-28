-- ============================================================
--  POSMaker SaaS Schema
--  Run this entire file in Supabase → SQL Editor
-- ============================================================

-- Stores (one per business / store owner)
CREATE TABLE IF NOT EXISTS stores (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id       UUID        REFERENCES auth.users NOT NULL,
  name           TEXT        NOT NULL,
  currency       TEXT        DEFAULT '₱',
  tax_rate       NUMERIC     DEFAULT 12,
  address        TEXT        DEFAULT '',
  phone          TEXT        DEFAULT '',
  receipt_footer TEXT        DEFAULT 'Thank you!',
  logo_b64       TEXT        DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Store staff: cashiers & managers (NOT Supabase Auth users)
CREATE TABLE IF NOT EXISTS store_users (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id      UUID    REFERENCES stores NOT NULL,
  username      TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  full_name     TEXT    DEFAULT '',
  role          TEXT    DEFAULT 'cashier',   -- cashier | manager
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, username)
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id   UUID    REFERENCES stores NOT NULL,
  name       TEXT    NOT NULL,
  category   TEXT    DEFAULT 'General',
  price      NUMERIC NOT NULL,
  stock      INTEGER DEFAULT 0,
  available  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Add columns to existing products (safe to re-run)
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku        TEXT    DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit       TEXT    DEFAULT 'pc';
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_b64  TEXT    DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS inv_links  TEXT    DEFAULT '[]';

-- Inventory Items (raw materials / supplies — separate from sellable products)
CREATE TABLE IF NOT EXISTS inventory_items (
  id                  UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id            UUID    REFERENCES stores NOT NULL,
  name                TEXT    NOT NULL,
  sku                 TEXT    DEFAULT '',
  category            TEXT    DEFAULT '',
  unit                TEXT    DEFAULT 'pc',
  stock               NUMERIC DEFAULT 0,
  low_stock_threshold NUMERIC DEFAULT 5,
  cost_price          NUMERIC DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inv_owner      ON inventory_items;
DROP POLICY IF EXISTS inv_anon_read  ON inventory_items;

CREATE POLICY inv_owner ON inventory_items FOR ALL TO authenticated
  USING     (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK(store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id              BIGSERIAL PRIMARY KEY,
  store_id        UUID    REFERENCES stores NOT NULL,
  timestamp       TIMESTAMPTZ DEFAULT NOW(),
  cashier_name    TEXT    DEFAULT '',
  subtotal        NUMERIC DEFAULT 0,
  tax             NUMERIC DEFAULT 0,
  total           NUMERIC DEFAULT 0,
  payment_method  TEXT    DEFAULT 'Cash',
  amount_tendered NUMERIC DEFAULT 0,
  change_given    NUMERIC DEFAULT 0,
  discount_pct    NUMERIC DEFAULT 0
);

-- Order line items
CREATE TABLE IF NOT EXISTS order_items (
  id         BIGSERIAL PRIMARY KEY,
  order_id   BIGINT  REFERENCES orders NOT NULL,
  product_id UUID,
  name       TEXT,
  price      NUMERIC,
  qty        INTEGER
);

-- Staff Login Logs
CREATE TABLE IF NOT EXISTS staff_logs (
  id        UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id  UUID        REFERENCES stores NOT NULL,
  staff_id  UUID        REFERENCES store_users NOT NULL,
  username  TEXT        NOT NULL,
  login_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE staff_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sl_owner      ON staff_logs;
DROP POLICY IF EXISTS sl_anon_insert ON staff_logs;
CREATE POLICY sl_owner ON staff_logs FOR ALL TO authenticated
  USING     (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK(store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY sl_anon_insert ON staff_logs FOR INSERT TO anon WITH CHECK (TRUE);

-- Categories (persistent, separate from products/inventory)
CREATE TABLE IF NOT EXISTS categories (
  id       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores NOT NULL,
  name     TEXT NOT NULL,
  type     TEXT DEFAULT 'prod',  -- prod | inv
  UNIQUE (store_id, name, type)
);

-- ── Row Level Security ─────────────────────────────────────────────────────────
ALTER TABLE categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_users  ENABLE ROW LEVEL SECURITY;
ALTER TABLE products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cat_owner ON categories;
CREATE POLICY cat_owner ON categories FOR ALL TO authenticated
  USING     (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK(store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Drop existing policies first (safe to re-run)
DROP POLICY IF EXISTS stores_owner      ON stores;
DROP POLICY IF EXISTS stores_anon_read  ON stores;
DROP POLICY IF EXISTS su_owner          ON store_users;
DROP POLICY IF EXISTS su_anon_read      ON store_users;
DROP POLICY IF EXISTS prod_owner        ON products;
DROP POLICY IF EXISTS prod_anon_read    ON products;
DROP POLICY IF EXISTS ord_owner         ON orders;
DROP POLICY IF EXISTS ord_anon_insert   ON orders;
DROP POLICY IF EXISTS oi_owner          ON order_items;
DROP POLICY IF EXISTS oi_anon_insert    ON order_items;

-- Stores: owner full access
CREATE POLICY stores_owner ON stores FOR ALL TO authenticated
  USING     (auth.uid() = owner_id)
  WITH CHECK(auth.uid() = owner_id);

-- Stores: anon can read a store's public info (name, currency, tax, logo)
CREATE POLICY stores_anon_read ON stores FOR SELECT TO anon USING (TRUE);

-- Store users: owner manages their store's staff
CREATE POLICY su_owner ON store_users FOR ALL TO authenticated
  USING     (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK(store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Store users: anon can read active users (for cashier login check)
CREATE POLICY su_anon_read ON store_users FOR SELECT TO anon
  USING (active = TRUE);

-- Products: owner full access
CREATE POLICY prod_owner ON products FOR ALL TO authenticated
  USING     (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK(store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Products: anon read available products (cashier needs this)
CREATE POLICY prod_anon_read ON products FOR SELECT TO anon
  USING (available = TRUE);

-- Orders: owner full access
CREATE POLICY ord_owner ON orders FOR ALL TO authenticated
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Orders: anon insert (cashier submits orders)
CREATE POLICY ord_anon_insert ON orders FOR INSERT TO anon WITH CHECK (TRUE);

-- Order items: owner full access
CREATE POLICY oi_owner ON order_items FOR ALL TO authenticated
  USING (order_id IN (
    SELECT id FROM orders
    WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  ));

-- Order items: anon insert
CREATE POLICY oi_anon_insert ON order_items FOR INSERT TO anon WITH CHECK (TRUE);
