-- lbecobriq@gmail.com ended up with 2 duplicate stores (likely from a
-- multi-tab race during email confirmation). The duplicate also got its own
-- auto-created default categories — delete those first (foreign key),
-- then the store itself. Keep the first store and backfill its free_until.

DELETE FROM categories WHERE store_id = '59056341-520b-4e15-a6e8-77fe65550362';

DELETE FROM stores WHERE id = '59056341-520b-4e15-a6e8-77fe65550362';

UPDATE stores
SET free_until = now() + interval '14 days'
WHERE id = 'ccc98591-600d-4f69-9f50-bbf1de672cea';

-- Verify only one remains:
SELECT id, name, business_type, store_code, free_until FROM stores
WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'lbecobriq@gmail.com');
