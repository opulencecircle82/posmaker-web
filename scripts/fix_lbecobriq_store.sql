-- Recovers the incomplete signup for lbecobriq@gmail.com by creating their
-- missing store row. Safe to run more than once — it only inserts if this
-- user doesn't already have a store.
-- (open_time/close_time/closed_days columns don't exist yet on this DB —
-- omitted here; dashboards fall back to 08:00/20:00/none automatically.)
INSERT INTO stores (name, owner_id, currency, tax_rate, business_type, store_code, free_until)
SELECT
  'My Lechon Store',
  u.id,
  '₱',
  12,
  'Lechon',
  'LECHON' || floor(random()*9000+1000)::text,
  now() + interval '14 days'
FROM auth.users u
WHERE u.email = 'lbecobriq@gmail.com'
AND NOT EXISTS (SELECT 1 FROM stores s WHERE s.owner_id = u.id);

-- Verify it worked:
SELECT id, name, business_type, store_code, free_until FROM stores
WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'lbecobriq@gmail.com');
