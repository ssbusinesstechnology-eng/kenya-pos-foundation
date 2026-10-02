-- Tenant isolation + role permission tests for customers, sales, receipts
-- (sale + items + payments + business header) and inventory.
-- Runs in one transaction and ROLLS BACK, so it never leaves data behind.
-- Any failed check raises an exception and aborts the run.
-- Run with a privileged connection, e.g.: psql -v ON_ERROR_STOP=1 -f supabase/tests/tenant_isolation.test.sql
BEGIN;

-- ---------- Setup (privileged) ----------
INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
  ('a0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','zz_owner_a@test.local'),
  ('a0000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','zz_manager_a@test.local'),
  ('a0000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','zz_cashier_a@test.local'),
  ('b0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','zz_owner_b@test.local');

INSERT INTO public.businesses (id, name) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','ZZ Biz A'),
  ('bbbbbbbb-0000-0000-0000-000000000001','ZZ Biz B');

INSERT INTO public.profiles (id, business_id, full_name, role) VALUES
  ('a0000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','Owner A','owner'),
  ('a0000000-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','Manager A','manager'),
  ('a0000000-0000-0000-0000-00000000000c','aaaaaaaa-0000-0000-0000-000000000001','Cashier A','cashier'),
  ('b0000000-0000-0000-0000-00000000000a','bbbbbbbb-0000-0000-0000-000000000001','Owner B','owner');

INSERT INTO public.products (id, business_id, name, selling_price, stock_quantity) VALUES
  ('aaaaaaaa-0000-0000-0000-0000000000f1','aaaaaaaa-0000-0000-0000-000000000001','ZZ Prod A',100,10),
  ('bbbbbbbb-0000-0000-0000-0000000000f1','bbbbbbbb-0000-0000-0000-000000000001','ZZ Prod B',200,10);

INSERT INTO public.customers (id, business_id, name) VALUES
  ('aaaaaaaa-0000-0000-0000-0000000000c1','aaaaaaaa-0000-0000-0000-000000000001','ZZ Cust A'),
  ('bbbbbbbb-0000-0000-0000-0000000000c1','bbbbbbbb-0000-0000-0000-000000000001','ZZ Cust B');

INSERT INTO public.sales (id, business_id, subtotal, total_amount, payment_status, customer_id) VALUES
  ('bbbbbbbb-0000-0000-0000-0000000000e1','bbbbbbbb-0000-0000-0000-000000000001',200,200,'PAID','bbbbbbbb-0000-0000-0000-0000000000c1');
INSERT INTO public.sale_items (business_id, sale_id, product_id, product_name, quantity, unit_price, line_subtotal) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-0000000000e1','bbbbbbbb-0000-0000-0000-0000000000f1','ZZ Prod B',1,200,200);
INSERT INTO public.payments (business_id, sale_id, payment_method, amount, payment_status) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-0000000000e1','CASH',200,'PAID');

-- ================= OWNER A =================
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE n int;
BEGIN
  -- Reads are scoped to business A
  SELECT count(*) INTO n FROM public.customers WHERE business_id <> 'aaaaaaaa-0000-0000-0000-000000000001';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner A sees other businesses customers'; END IF;
  SELECT count(*) INTO n FROM public.customers WHERE id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: owner A cannot see own customer'; END IF;
  SELECT count(*) INTO n FROM public.sales WHERE id = 'bbbbbbbb-0000-0000-0000-0000000000e1';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner A sees business B sale'; END IF;
  SELECT count(*) INTO n FROM public.sale_items WHERE sale_id = 'bbbbbbbb-0000-0000-0000-0000000000e1';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner A sees business B receipt items'; END IF;
  SELECT count(*) INTO n FROM public.payments WHERE sale_id = 'bbbbbbbb-0000-0000-0000-0000000000e1';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner A sees business B payments'; END IF;
  SELECT count(*) INTO n FROM public.businesses WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner A sees business B receipt header'; END IF;
  SELECT count(*) INTO n FROM public.products WHERE business_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner A sees business B products'; END IF;
  SELECT count(*) INTO n FROM public.inventory_movements WHERE business_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner A sees business B stock history'; END IF;

  -- Writes into business B are blocked
  BEGIN
    INSERT INTO public.customers (business_id, name) VALUES ('bbbbbbbb-0000-0000-0000-000000000001','ZZ Intruder');
    RAISE EXCEPTION 'FAIL: owner A inserted a customer into business B';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.customers SET name = 'hacked' WHERE id = 'bbbbbbbb-0000-0000-0000-0000000000c1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner A updated business B customer'; END IF;
  UPDATE public.products SET selling_price = 1 WHERE id = 'bbbbbbbb-0000-0000-0000-0000000000f1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner A updated business B product'; END IF;

  -- Stock adjustment on business B product is refused
  BEGIN
    PERFORM public.adjust_product_stock('bbbbbbbb-0000-0000-0000-0000000000f1','RESTOCK',5,'test',NULL);
    RAISE EXCEPTION 'FAIL: owner A adjusted business B stock';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;

  -- Checkout with business B customer is refused
  BEGIN
    PERFORM public.checkout_sale(
      '[{"product_id":"aaaaaaaa-0000-0000-0000-0000000000f1","quantity":1,"unit_price":100}]'::jsonb,
      'CASH',100,0,NULL,NULL,gen_random_uuid(),'bbbbbbbb-0000-0000-0000-0000000000c1');
    RAISE EXCEPTION 'FAIL: owner A checked out with business B customer';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%CUSTOMER_NOT_FOUND%' THEN RAISE EXCEPTION 'FAIL: unexpected checkout error: %', SQLERRM; END IF;
  END;

  -- Own-business owner permissions
  UPDATE public.businesses SET receipt_footer = 'ok' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: owner A cannot update own business'; END IF;
  SELECT count(*) INTO n FROM public.profiles WHERE business_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  IF n <> 3 THEN RAISE EXCEPTION 'FAIL: owner A should see all 3 team profiles (saw %)', n; END IF;

  -- Nothing can be deleted
  DELETE FROM public.customers WHERE id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner A deleted a customer'; END IF;
END $$;
RESET ROLE;

-- ================= MANAGER A =================
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-00000000000b","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE n int;
BEGIN
  INSERT INTO public.customers (name) VALUES ('ZZ Manager Cust');
  UPDATE public.customers SET notes = 'ok' WHERE id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: manager cannot edit own customer'; END IF;
  PERFORM public.adjust_product_stock('aaaaaaaa-0000-0000-0000-0000000000f1','RESTOCK',2,'test',NULL);
  SELECT count(*) INTO n FROM public.sales WHERE business_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: manager sees business B sales'; END IF;
  UPDATE public.businesses SET receipt_footer = 'manager' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: manager edited business settings (owner only)'; END IF;
  SELECT count(*) INTO n FROM public.profiles;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: manager should only see own profile (saw %)', n; END IF;
END $$;
RESET ROLE;

-- ================= CASHIER A =================
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-00000000000c","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE n int;
BEGIN
  BEGIN
    INSERT INTO public.customers (name) VALUES ('ZZ Cashier Cust');
    RAISE EXCEPTION 'FAIL: cashier created a customer';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.adjust_product_stock('aaaaaaaa-0000-0000-0000-0000000000f1','RESTOCK',1,'test',NULL);
    RAISE EXCEPTION 'FAIL: cashier adjusted stock';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%NOT_ALLOWED%' THEN RAISE EXCEPTION 'FAIL: cashier stock: %', SQLERRM; END IF;
  END;
  SELECT count(*) INTO n FROM public.customers WHERE business_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: cashier sees business B customers'; END IF;
END $$;
RESET ROLE;

-- ================= OWNER B =================
SELECT set_config('request.jwt.claims','{"sub":"b0000000-0000-0000-0000-00000000000a","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.customers WHERE business_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner B sees business A customers'; END IF;
  SELECT count(*) INTO n FROM public.inventory_movements WHERE business_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner B sees business A stock history'; END IF;
  SELECT count(*) INTO n FROM public.sales WHERE id = 'bbbbbbbb-0000-0000-0000-0000000000e1';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: owner B cannot see own sale'; END IF;
END $$;
RESET ROLE;

SELECT 'ALL TENANT ISOLATION TESTS PASSED' AS result;
ROLLBACK;
