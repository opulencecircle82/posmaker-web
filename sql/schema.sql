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
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock      INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS available  BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku        TEXT    DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit       TEXT    DEFAULT 'pc';
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_b64  TEXT    DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS inv_links  TEXT    DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS barber_name TEXT   DEFAULT '';

-- Barbershop: saved chair layout (positions + assigned barber per chair), stored as JSON text
ALTER TABLE stores ADD COLUMN IF NOT EXISTS chair_layout TEXT DEFAULT '';

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

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS default_usage_qty NUMERIC DEFAULT 1;

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inv_owner        ON inventory_items;
DROP POLICY IF EXISTS inv_anon_read    ON inventory_items;
DROP POLICY IF EXISTS inv_anon_update  ON inventory_items;

CREATE POLICY inv_owner ON inventory_items FOR ALL TO authenticated
  USING     (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK(store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Cashier (anon) needs to read stock and deduct after sale
CREATE POLICY inv_anon_read   ON inventory_items FOR SELECT TO anon USING (TRUE);
CREATE POLICY inv_anon_update ON inventory_items FOR UPDATE TO anon USING (TRUE) WITH CHECK (TRUE);

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

-- Activity Log (stock edits, price changes, etc. by staff)
CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id    UUID        REFERENCES stores NOT NULL,
  actor_name  TEXT        NOT NULL,
  actor_role  TEXT        DEFAULT 'cashier',
  action      TEXT        NOT NULL,   -- ADD_STOCK | EDIT_ITEM | ADD_ITEM
  target_name TEXT        DEFAULT '',
  details     TEXT        DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS al_owner   ON activity_logs;
DROP POLICY IF EXISTS al_anon_rw ON activity_logs;
CREATE POLICY al_owner ON activity_logs FOR ALL TO authenticated
  USING     (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK(store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY al_anon_rw ON activity_logs FOR ALL TO anon
  USING (TRUE) WITH CHECK (TRUE);

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
DROP POLICY IF EXISTS ord_anon_select   ON orders;
DROP POLICY IF EXISTS oi_anon_select    ON order_items;
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
CREATE POLICY ord_anon_insert  ON orders FOR INSERT TO anon WITH CHECK (TRUE);
-- Orders: anon select own store's orders (needed for offline sync check)
CREATE POLICY ord_anon_select  ON orders FOR SELECT TO anon USING (TRUE);
-- Order items: anon select (needed for offline sync)
CREATE POLICY oi_anon_select   ON order_items FOR SELECT TO anon USING (TRUE);

-- Order items: owner full access
CREATE POLICY oi_owner ON order_items FOR ALL TO authenticated
  USING (order_id IN (
    SELECT id FROM orders
    WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  ));

-- Order items: anon insert
CREATE POLICY oi_anon_insert ON order_items FOR INSERT TO anon WITH CHECK (TRUE);

-- POS Theme columns on stores (for Customize POS feature)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pos_font    TEXT    DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pos_accent  TEXT    DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pos_bg      TEXT    DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pos_card    TEXT    DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pos_text    TEXT    DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pos_radius  NUMERIC DEFAULT 10;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pos_bg_img    TEXT    DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_type  TEXT    DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pos_btn_style  TEXT    DEFAULT 'default';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pos_bg_scale   TEXT    DEFAULT 'cover';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pos_bg_opacity NUMERIC DEFAULT 18;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_code     TEXT    DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_stores_store_code ON stores(store_code);

-- Restaurant POS columns on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type   TEXT    DEFAULT 'Dine In';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_no     TEXT    DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_kot       BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amt NUMERIC DEFAULT 0;

-- Draft orders (save-for-later cart)
CREATE TABLE IF NOT EXISTS draft_orders (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id     UUID        REFERENCES stores NOT NULL,
  cashier_name TEXT        DEFAULT '',
  order_type   TEXT        DEFAULT 'Dine In',
  table_no     TEXT        DEFAULT '',
  items_json   TEXT        DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE draft_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS draft_owner ON draft_orders;
DROP POLICY IF EXISTS draft_anon  ON draft_orders;
CREATE POLICY draft_owner ON draft_orders FOR ALL TO authenticated
  USING     (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK(store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY draft_anon ON draft_orders FOR ALL TO anon
  USING (TRUE) WITH CHECK (TRUE);

-- POS Device Registry (locks each POS terminal to one device)
CREATE TABLE IF NOT EXISTS pos_devices (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id      UUID        REFERENCES stores NOT NULL,
  device_id     TEXT        NOT NULL,
  device_name   TEXT        DEFAULT '',
  platform      TEXT        DEFAULT 'windows',
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, device_id)
);
ALTER TABLE pos_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pd_owner        ON pos_devices;
DROP POLICY IF EXISTS pd_anon_select  ON pos_devices;
DROP POLICY IF EXISTS pd_anon_insert  ON pos_devices;
CREATE POLICY pd_owner ON pos_devices FOR ALL TO authenticated
  USING     (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK(store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY pd_anon_select ON pos_devices FOR SELECT TO anon USING (TRUE);
CREATE POLICY pd_anon_insert ON pos_devices FOR INSERT TO anon WITH CHECK (TRUE);

-- Staff online tracking columns
ALTER TABLE store_users ADD COLUMN IF NOT EXISTS last_seen     TIMESTAMPTZ;
ALTER TABLE store_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Ping: update last_seen so dashboard can show Online indicator
CREATE OR REPLACE FUNCTION ping_staff_online(p_staff_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE store_users SET last_seen = NOW() WHERE id = p_staff_id;
END;
$$;

-- Login: insert into staff_logs AND stamp last_login_at on store_users
CREATE OR REPLACE FUNCTION log_staff_login(p_store_id UUID, p_staff_id UUID, p_username TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO staff_logs (store_id, staff_id, username) VALUES (p_store_id, p_staff_id, p_username);
  UPDATE store_users SET last_login_at = NOW() WHERE id = p_staff_id;
END;
$$;

-- Logout: clear last_seen so staff shows as offline immediately
CREATE OR REPLACE FUNCTION log_staff_logout(p_staff_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE store_users SET last_seen = NULL WHERE id = p_staff_id;
END;
$$;

-- ============================================================
--  Agent Referral Program
--  Run this block in Supabase → SQL Editor (once)
-- ============================================================

-- People who apply to become POSMaker referral agents
CREATE TABLE IF NOT EXISTS agents (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT        DEFAULT '',
  email          TEXT        DEFAULT '',
  contact_number TEXT        DEFAULT '',
  address        TEXT        DEFAULT '',
  description    TEXT        DEFAULT '',
  referral_code  TEXT        UNIQUE,
  status         TEXT        DEFAULT 'pending',  -- pending | approved | rejected
  default_free_months INTEGER DEFAULT 1,         -- free period (1-12) granted by default to this agent's referrals
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS default_free_months INTEGER DEFAULT 1;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE agents ALTER COLUMN name DROP NOT NULL;
ALTER TABLE agents ALTER COLUMN name SET DEFAULT '';
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agents_all ON agents;
CREATE POLICY agents_all ON agents FOR ALL TO anon USING (true) WITH CHECK (true);

-- Accounts requested through an agent's referral link (pending admin review)
CREATE TABLE IF NOT EXISTS agent_referrals (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id       UUID        REFERENCES agents NOT NULL,
  store_name     TEXT        NOT NULL,
  business_type  TEXT        DEFAULT 'retail',
  owner_email    TEXT        NOT NULL,
  contact_number TEXT        DEFAULT '',
  notes          TEXT        DEFAULT '',
  status         TEXT        DEFAULT 'pending',  -- pending | granted | denied
  free_period    TEXT        DEFAULT '',         -- '1month' | '1year'
  store_id       UUID        REFERENCES stores,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE agent_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_referrals_all ON agent_referrals;
CREATE POLICY agent_referrals_all ON agent_referrals FOR ALL TO anon USING (true) WITH CHECK (true);

-- Public: submit an agent application (from agent-apply.html) — email-only lead capture;
-- the owner follows up by email to learn more before approving.
DROP FUNCTION IF EXISTS submit_agent_application(text, text, text, text);
CREATE OR REPLACE FUNCTION submit_agent_application(p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO agents (name, email, status)
  VALUES (p_email, p_email, 'pending')
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- Public: look up an approved agent by referral code (used by agent-signup.html)
CREATE OR REPLACE FUNCTION get_agent_by_code(p_code text)
RETURNS TABLE(id uuid, name text, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT a.id, a.name, a.status FROM agents a
    WHERE a.referral_code = p_code AND a.status = 'approved';
END; $$;

-- Public: submit a referral signup request (from agent-signup.html) — does NOT create the account
CREATE OR REPLACE FUNCTION submit_agent_referral(p_ref_code text, p_store_name text,
  p_business_type text, p_owner_email text, p_contact text, p_notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agent_id uuid; v_id uuid;
BEGIN
  SELECT id INTO v_agent_id FROM agents WHERE referral_code = p_ref_code AND status = 'approved';
  IF v_agent_id IS NULL THEN RAISE EXCEPTION 'Invalid or inactive referral link.'; END IF;
  INSERT INTO agent_referrals (agent_id, store_name, business_type, owner_email, contact_number, notes, status)
  VALUES (v_agent_id, p_store_name, p_business_type, p_owner_email, p_contact, p_notes, 'pending')
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- Admin: list agent applications
DROP FUNCTION IF EXISTS dev_get_agents(text);
CREATE OR REPLACE FUNCTION dev_get_agents(p_token text)
RETURNS TABLE(id uuid, name text, email text, contact_number text, address text, description text,
              referral_code text, status text, default_free_months integer, commission_rate numeric, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dev_admins WHERE session_token = p_token
    AND session_expires_at > now()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT a.id, a.name, a.email, a.contact_number, a.address, a.description,
    a.referral_code, a.status, a.default_free_months, a.commission_rate, a.created_at FROM agents a ORDER BY a.created_at DESC;
END; $$;

-- Admin: approve an agent application — generates their referral code on first approval,
-- sets the default free period (1-12 months) granted to accounts they refer, and the
-- commission rate (%) the agent earns each month on their referred stores' subscriptions.
DROP FUNCTION IF EXISTS dev_approve_agent(text, uuid, integer);
CREATE OR REPLACE FUNCTION dev_approve_agent(p_token text, p_agent_id uuid, p_months integer DEFAULT 1, p_commission_rate numeric DEFAULT 10)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dev_admins WHERE session_token = p_token
    AND session_expires_at > now()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT referral_code INTO v_code FROM agents WHERE id = p_agent_id;
  IF v_code IS NULL THEN
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    UPDATE agents SET referral_code = v_code WHERE id = p_agent_id;
  END IF;
  UPDATE agents SET status = 'approved', default_free_months = p_months, commission_rate = p_commission_rate WHERE id = p_agent_id;
  RETURN v_code;
END; $$;

-- Admin: reject / revoke an agent application
CREATE OR REPLACE FUNCTION dev_reject_agent(p_token text, p_agent_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dev_admins WHERE session_token = p_token
    AND session_expires_at > now()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE agents SET status = 'rejected' WHERE id = p_agent_id;
  RETURN FOUND;
END; $$;

-- Admin: list referral signup requests
DROP FUNCTION IF EXISTS dev_get_agent_referrals(text);
CREATE OR REPLACE FUNCTION dev_get_agent_referrals(p_token text)
RETURNS TABLE(id uuid, agent_id uuid, agent_name text, agent_default_months integer, store_name text, business_type text,
              owner_email text, contact_number text, notes text, status text,
              free_period text, store_id uuid, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dev_admins WHERE session_token = p_token
    AND session_expires_at > now()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY
    SELECT r.id, r.agent_id, a.name, a.default_free_months, r.store_name, r.business_type, r.owner_email,
           r.contact_number, r.notes, r.status, r.free_period, r.store_id, r.created_at
    FROM agent_referrals r JOIN agents a ON a.id = r.agent_id
    ORDER BY r.created_at DESC;
END; $$;

-- Admin: deny a referral signup request
CREATE OR REPLACE FUNCTION dev_deny_referral(p_token text, p_referral_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dev_admins WHERE session_token = p_token
    AND session_expires_at > now()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE agent_referrals SET status = 'denied' WHERE id = p_referral_id;
  RETURN FOUND;
END; $$;

-- Admin: grant free access for a referral — call AFTER creating the store via dev_create_partner.
-- Records a free subscription (amount = 0) and links the referral to the new store.
-- Free period is a number of months (1-12), chosen by the admin per referral.
DROP FUNCTION IF EXISTS dev_grant_referral(text, uuid, uuid, text);
CREATE OR REPLACE FUNCTION dev_grant_referral(p_token text, p_referral_id uuid,
  p_store_id uuid, p_months integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_expires timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dev_admins WHERE session_token = p_token
    AND session_expires_at > now()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT owner_email INTO v_email FROM agent_referrals WHERE id = p_referral_id;
  v_expires := now() + (p_months || ' months')::interval;
  INSERT INTO subscriptions (store_id, subscriber_email, plan_name, amount, status, expires_at)
  VALUES (p_store_id, v_email, 'Agent Referral - Free', 0, 'active', v_expires);
  UPDATE agent_referrals SET status = 'granted', free_period = p_months::text, store_id = p_store_id
    WHERE id = p_referral_id;
  RETURN true;
END; $$;

-- ============================================================
--  Affiliate self-signup (agent-apply.html + affiliate-dashboard.html)
-- ============================================================

ALTER TABLE agents ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS agreed_terms BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 10;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS link_clicks INTEGER DEFAULT 0;

-- Public: called by index.html the first time a visitor lands via ?ref=CODE in a given
-- browser session. Lets affiliates see whether their link is getting any traffic at all.
CREATE OR REPLACE FUNCTION track_referral_click(p_ref_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE agents SET link_clicks = link_clicks + 1
    WHERE referral_code = p_ref_code AND status = 'approved';
END; $$;

-- Public (authenticated affiliate): submit/update their affiliate application after creating
-- their Supabase Auth account in agent-apply.html. Idempotent on auth_user_id so returning
-- from an email-confirmation link doesn't create a duplicate row.
CREATE OR REPLACE FUNCTION submit_affiliate_application(p_auth_user_id uuid, p_name text, p_email text, p_address text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM agents WHERE auth_user_id = p_auth_user_id;
  IF v_id IS NULL THEN
    INSERT INTO agents (auth_user_id, name, email, address, status, agreed_terms)
    VALUES (p_auth_user_id, p_name, p_email, p_address, 'pending', true)
    RETURNING id INTO v_id;
  ELSE
    UPDATE agents SET name = p_name, email = p_email, address = p_address, agreed_terms = true
      WHERE id = v_id;
  END IF;
  RETURN v_id;
END; $$;

-- Public (authenticated affiliate): fetch their own application/status for affiliate-dashboard.html
DROP FUNCTION IF EXISTS get_my_affiliate(uuid);
CREATE OR REPLACE FUNCTION get_my_affiliate(p_auth_user_id uuid)
RETURNS TABLE(id uuid, name text, email text, status text, referral_code text,
              default_free_months integer, commission_rate numeric, link_clicks integer, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT a.id, a.name, a.email, a.status, a.referral_code, a.default_free_months, a.commission_rate, a.link_clicks, a.created_at
    FROM agents a WHERE a.auth_user_id = p_auth_user_id;
END; $$;

-- Public (authenticated affiliate): list their own referrals for affiliate-dashboard.html, including
-- the referred store's current active subscription amount and the resulting monthly commission
-- (subscription amount x the affiliate's commission_rate).
DROP FUNCTION IF EXISTS get_my_referrals(uuid);
CREATE OR REPLACE FUNCTION get_my_referrals(p_auth_user_id uuid)
RETURNS TABLE(id uuid, store_name text, business_type text, status text, free_period text,
              created_at timestamptz, subscription_amount numeric, monthly_commission numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agent_id uuid; v_rate numeric;
BEGIN
  SELECT a.id, a.commission_rate INTO v_agent_id, v_rate FROM agents a WHERE a.auth_user_id = p_auth_user_id;
  IF v_agent_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT r.id, r.store_name, r.business_type, r.status, r.free_period, r.created_at,
           s.amount,
           ROUND(COALESCE(s.amount, 0) * COALESCE(v_rate, 10) / 100, 2)
    FROM agent_referrals r
    LEFT JOIN LATERAL (
      SELECT sub.amount FROM subscriptions sub
      WHERE sub.store_id = r.store_id AND sub.status = 'active' AND (sub.expires_at IS NULL OR sub.expires_at >= now())
      ORDER BY sub.expires_at DESC LIMIT 1
    ) s ON true
    WHERE r.agent_id = v_agent_id ORDER BY r.created_at DESC;
END; $$;

-- Public: called automatically by signup.html right after a new store is created via a
-- referral link (?ref=CODE). Records the referral against the affiliate and immediately
-- grants the affiliate's default free-trial period (as a 0-amount active subscription) —
-- no admin review needed. Silently does nothing if the code is missing/invalid/unapproved,
-- so signup always proceeds normally either way.
CREATE OR REPLACE FUNCTION track_referral(p_ref_code text, p_store_id uuid, p_store_name text,
  p_business_type text, p_owner_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agent_id uuid; v_months integer;
BEGIN
  SELECT id, default_free_months INTO v_agent_id, v_months FROM agents
    WHERE referral_code = p_ref_code AND status = 'approved';
  IF v_agent_id IS NULL THEN RETURN; END IF;

  INSERT INTO agent_referrals (agent_id, store_name, business_type, owner_email, status, free_period, store_id)
  VALUES (v_agent_id, p_store_name, p_business_type, p_owner_email, 'granted', v_months::text, p_store_id);

  INSERT INTO subscriptions (store_id, subscriber_email, plan_name, amount, status, expires_at)
  VALUES (p_store_id, p_owner_email, 'Referral - Free Trial', 0, 'active', now() + (v_months || ' months')::interval);
END; $$;
