-- Tenant isolation + role permission tests.
-- Runs inside one transaction and ROLLS BACK, so it never leaves data behind.
-- Any failed check raises an exception and aborts the run.
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
  ('bbbbbbbb-0000-0000-0000-0000000000s1'::text::uuid, 'bbbbbbbb-0000-0000-0000-000000000001',200,200,'PAID','bbbbbbbb-0000-0000-0000-0000000000c1')
  ON CONFLICT DO NOTHING;
