-- Privileged runner required. Fixtures and sequences are rolled back, even on failure.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email) VALUES
 ('a3000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase3-owner-a@test.local'),
 ('a3000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase3-manager@test.local'),
 ('a3000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase3-cashier@test.local'),
 ('b3000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase3-owner-b@test.local');
INSERT INTO public.businesses(id,name) VALUES('a3000000-0000-0000-0000-000000000010','PHASE3 A'),('b3000000-0000-0000-0000-000000000010','PHASE3 B');
INSERT INTO public.profiles(id,business_id,role) VALUES
 ('a3000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000010','owner'),
 ('a3000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000010','manager'),
 ('a3000000-0000-0000-0000-000000000003','a3000000-0000-0000-0000-000000000010','cashier'),
 ('b3000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000010','owner');
INSERT INTO public.customers(id,business_id,name,is_active) VALUES ('a3000000-0000-0000-0000-000000000020','a3000000-0000-0000-0000-000000000010','Inactive buyer',false);
INSERT INTO public.products(id,business_id,name,sku,category,cost_price,selling_price,stock_quantity,low_stock_threshold,is_active) VALUES
 ('a3000000-0000-0000-0000-000000000030','a3000000-0000-0000-0000-000000000010','Renamed product','NEW','Goods',100,9999,10,5,false),
 ('a3000000-0000-0000-0000-000000000031','a3000000-0000-0000-0000-000000000010','Low stock','LOW','Goods',80,120,5,5,true),
 ('a3000000-0000-0000-0000-000000000032','a3000000-0000-0000-0000-000000000010','Out stock','OUT','Goods',20,30,0,5,true);
INSERT INTO public.sales(id,business_id,subtotal,discount_amount,tax_amount,total_amount,payment_status,sale_status,customer_id,created_at) VALUES
 ('a3000000-0000-0000-0000-000000000041','a3000000-0000-0000-0000-000000000010',1000,0,0,1000,'PAID','COMPLETED','a3000000-0000-0000-0000-000000000020','2026-11-05 00:00+03'),
 ('a3000000-0000-0000-0000-000000000042','a3000000-0000-0000-0000-000000000010',2100,200,100,2000,'PAID','COMPLETED',NULL,'2026-11-05 12:00+03'),
 ('a3000000-0000-0000-0000-000000000043','a3000000-0000-0000-0000-000000000010',500,0,0,500,'PAID','COMPLETED',NULL,'2026-11-05 23:59:59+03'),
 ('a3000000-0000-0000-0000-000000000044','a3000000-0000-0000-0000-000000000010',900,0,0,900,'PAID','VOIDED',NULL,'2026-11-05 12:00+03'),
 ('a3000000-0000-0000-0000-000000000045','a3000000-0000-0000-0000-000000000010',900,0,0,900,'FAILED','COMPLETED',NULL,'2026-11-05 12:00+03'),
 ('a3000000-0000-0000-0000-000000000046','a3000000-0000-0000-0000-000000000010',900,0,0,900,'REFUNDED','COMPLETED',NULL,'2026-11-05 12:00+03'),
 ('a3000000-0000-0000-0000-000000000047','a3000000-0000-0000-0000-000000000010',70,0,0,70,'PAID','COMPLETED',NULL,'2026-11-04 23:59:59+03'),
 ('a3000000-0000-0000-0000-000000000048','a3000000-0000-0000-0000-000000000010',80,0,0,80,'PAID','COMPLETED',NULL,'2026-11-06 00:00+03'),
 ('b3000000-0000-0000-0000-000000000041','b3000000-0000-0000-0000-000000000010',999,0,0,999,'PAID','COMPLETED',NULL,'2026-11-05 12:00+03');
INSERT INTO public.sale_items(business_id,sale_id,product_id,product_name,product_sku,quantity,unit_price,discount_amount,line_subtotal) VALUES
 ('a3000000-0000-0000-0000-000000000010','a3000000-0000-0000-0000-000000000041','a3000000-0000-0000-0000-000000000030','Original product','OLD',2,505,10,1000);
INSERT INTO public.payments(business_id,sale_id,payment_method,amount,payment_status,created_at) VALUES
 ('a3000000-0000-0000-0000-000000000010','a3000000-0000-0000-0000-000000000041','CASH',400,'PAID','2026-11-05 12:00+03'),
 ('a3000000-0000-0000-0000-000000000010','a3000000-0000-0000-0000-000000000041','MPESA',600,'PAID','2026-11-05 12:00+03'),
 ('a3000000-0000-0000-0000-000000000010','a3000000-0000-0000-0000-000000000042','CARD',2000,'PAID','2026-11-05 12:00+03'),
 ('a3000000-0000-0000-0000-000000000010','a3000000-0000-0000-0000-000000000043','OTHER',500,'PAID','2026-11-05 12:00+03'),
 ('a3000000-0000-0000-0000-000000000010','a3000000-0000-0000-0000-000000000047','CASH',70,'PAID','2026-11-05 12:00+03'),
 ('a3000000-0000-0000-0000-000000000010','a3000000-0000-0000-0000-000000000041','CASH',900,'FAILED','2026-11-05 12:00+03'),
 ('a3000000-0000-0000-0000-000000000010','a3000000-0000-0000-0000-000000000044','CASH',900,'PAID','2026-11-05 12:00+03');
-- 21 additional zero-value transactions check pagination without changing known totals.
INSERT INTO public.sales(business_id,created_at) SELECT 'a3000000-0000-0000-0000-000000000010','2026-11-05 13:00+03'::timestamptz FROM generate_series(1,21);
SELECT set_config('request.jwt.claims','{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE r jsonb; d jsonb; n numeric; who text; section text;
BEGIN
 r:=public.report_overview('2026-11-05 00:00+03','2026-11-06 00:00+03');
 IF (r#>>'{sales,revenue}')::numeric<>3500 THEN RAISE EXCEPTION 'FAIL known revenue'; END IF;
 IF (r#>>'{sales,count}')::int<>3 THEN RAISE EXCEPTION 'FAIL no void/failed/refunded/pending'; END IF;
 IF (r#>>'{sales,average}')::numeric<>1166.67 THEN RAISE EXCEPTION 'FAIL average'; END IF;
 IF (r#>>'{sales,discounts}')::numeric<>210 THEN RAISE EXCEPTION 'FAIL header and line discounts'; END IF;
 IF (r#>>'{sales,tax}')::numeric<>100 THEN RAISE EXCEPTION 'FAIL tax'; END IF;
 IF (r#>>'{sales,walk_in_count}')::int<>2 THEN RAISE EXCEPTION 'FAIL walk-in'; END IF;
 IF (r#>>'{trend,0,revenue}')::numeric<>3500 THEN RAISE EXCEPTION 'FAIL local date trend'; END IF;
 SELECT sum((x->>'collected')::numeric) INTO n FROM jsonb_array_elements(r->'payments') x;
 IF n<>3570 THEN RAISE EXCEPTION 'FAIL collections or older-sale payment: %',n; END IF;
 IF (r#>>'{inventory,estimated_value}')::numeric<>1400 OR (r#>>'{inventory,low}')::int<>1 OR (r#>>'{inventory,out}')::int<>1 OR (r#>>'{inventory,inactive}')::int<>1 THEN RAISE EXCEPTION 'FAIL inventory'; END IF;
 IF (r#>>'{customers,inactive}')::int<>1 OR (r#>>'{customers,purchasing}')::int<>1 THEN RAISE EXCEPTION 'FAIL customers'; END IF;
 d:=public.report_details('2026-11-05 00:00+03','2026-11-06 00:00+03','top');
 IF d#>>'{rows,0,name}'<>'Original product' OR d#>>'{rows,0,sku}'<>'OLD' OR (d#>>'{rows,0,revenue}')::numeric<>1000 OR (d#>>'{rows,0,quantity}')::numeric<>2 THEN RAISE EXCEPTION 'FAIL historical snapshots'; END IF;
 d:=public.report_details('2026-11-05 00:00+03','2026-11-06 00:00+03','customers');
 IF (d#>>'{rows,0,revenue}')::numeric<>1000 OR (d#>>'{rows,0,transactions}')::int<>1 THEN RAISE EXCEPTION 'FAIL inactive purchase history'; END IF;
 d:=public.report_details('2026-11-05 00:00+03','2026-11-06 00:00+03','transactions');
 IF jsonb_array_length(d->'rows')<>20 OR (d->>'total')::int<>27 THEN RAISE EXCEPTION 'FAIL first page'; END IF;
 d:=public.report_details('2026-11-05 00:00+03','2026-11-06 00:00+03','transactions','','','ALL','revenue',1);
 IF jsonb_array_length(d->'rows')<>7 THEN RAISE EXCEPTION 'FAIL next page'; END IF;
 FOREACH who IN ARRAY ARRAY['a3000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000003'] LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',who,'role','authenticated')::text,true);
  r:=public.report_overview('2026-11-05 00:00+03','2026-11-06 00:00+03');
  IF (r#>>'{sales,revenue}')::numeric<>3500 THEN RAISE EXCEPTION 'FAIL role-scoped report %',who; END IF;
  FOREACH section IN ARRAY ARRAY['top','performance','inventory','movements','customers','transactions'] LOOP
   d:=public.report_details('2026-11-05 00:00+03','2026-11-06 00:00+03',section,'999');
   IF (d->>'total')::int<>0 THEN RAISE EXCEPTION 'FAIL cross-tenant search %',section; END IF;
  END LOOP;
 END LOOP;
 PERFORM set_config('request.jwt.claims','{"sub":"b3000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
 r:=public.report_overview('2026-11-05 00:00+03','2026-11-06 00:00+03');
 IF (r#>>'{sales,revenue}')::numeric<>999 OR (r#>>'{inventory,total}')::int<>0 OR (r#>>'{customers,total}')::int<>0 THEN RAISE EXCEPTION 'FAIL reverse tenant isolation or service business'; END IF;
END $$;
RESET ROLE;
SELECT 'REPORT ACCURACY, PAGINATION AND ROLE ISOLATION PASSED' result;
ROLLBACK;
