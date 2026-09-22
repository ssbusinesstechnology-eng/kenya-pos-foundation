-- =============================================================
-- Phase 2C-1: Sales database foundation
-- Future tables (categories, customers, price_history) still to come.
-- Sales -> Sale Items -> Products ; Sales -> Payments
-- =============================================================

-- Per-business sale number sequence -------------------------------------------
CREATE TABLE public.sale_number_sequences (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  last_number bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sale_number_sequences TO authenticated;
GRANT ALL ON public.sale_number_sequences TO service_role;
ALTER TABLE public.sale_number_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY sale_number_sequences_select_own_tenant
  ON public.sale_number_sequences FOR SELECT TO authenticated
  USING (business_id = private.get_user_business_id());

-- Sales header ---------------------------------------------------------------
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL DEFAULT public.get_user_business_id()
    REFERENCES public.businesses(id) ON DELETE CASCADE,
  sale_number text NOT NULL,
  subtotal numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  payment_status text NOT NULL DEFAULT 'PENDING'
    CHECK (payment_status IN ('PENDING','PAID','FAILED','REFUNDED')),
  sale_status text NOT NULL DEFAULT 'COMPLETED'
    CHECK (sale_status IN ('COMPLETED','VOIDED')),
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_business_sale_number_key UNIQUE (business_id, sale_number)
);

CREATE INDEX sales_business_created_at_idx ON public.sales (business_id, created_at DESC);
CREATE INDEX sales_business_sale_status_idx ON public.sales (business_id, sale_status);
CREATE INDEX sales_business_payment_status_idx ON public.sales (business_id, payment_status);

GRANT SELECT, INSERT, UPDATE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_select_own_tenant
  ON public.sales FOR SELECT TO authenticated
  USING (business_id = private.get_user_business_id());

CREATE POLICY sales_insert_own_tenant
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (business_id = private.get_user_business_id()
    AND private.get_user_role() = ANY (ARRAY['owner','manager']));

CREATE POLICY sales_update_own_tenant
  ON public.sales FOR UPDATE TO authenticated
  USING (business_id = private.get_user_business_id()
    AND private.get_user_role() = ANY (ARRAY['owner','manager']))
  WITH CHECK (business_id = private.get_user_business_id());

CREATE TRIGGER sales_set_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sale items -----------------------------------------------------------------
CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL DEFAULT public.get_user_business_id()
    REFERENCES public.businesses(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  product_sku text,
  unit text NOT NULL DEFAULT 'pc',
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  line_subtotal numeric(14,2) NOT NULL CHECK (line_subtotal >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sale_items_sale_id_idx ON public.sale_items (sale_id);
CREATE INDEX sale_items_business_product_idx ON public.sale_items (business_id, product_id);

GRANT SELECT, INSERT, UPDATE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY sale_items_select_own_tenant
  ON public.sale_items FOR SELECT TO authenticated
  USING (business_id = private.get_user_business_id());

CREATE POLICY sale_items_insert_own_tenant
  ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (business_id = private.get_user_business_id()
    AND private.get_user_role() = ANY (ARRAY['owner','manager'])
    AND EXISTS (SELECT 1 FROM public.sales s
      WHERE s.id = sale_id AND s.business_id = private.get_user_business_id())
    AND (product_id IS NULL OR EXISTS (SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.business_id = private.get_user_business_id())));

CREATE POLICY sale_items_update_own_tenant
  ON public.sale_items FOR UPDATE TO authenticated
  USING (business_id = private.get_user_business_id()
    AND private.get_user_role() = ANY (ARRAY['owner','manager']))
  WITH CHECK (business_id = private.get_user_business_id());

-- Payments -------------------------------------------------------------------
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL DEFAULT public.get_user_business_id()
    REFERENCES public.businesses(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  payment_method text NOT NULL CHECK (payment_method IN ('CASH','MPESA','CARD','OTHER')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  payment_status text NOT NULL DEFAULT 'PENDING'
    CHECK (payment_status IN ('PENDING','PAID','FAILED','REFUNDED')),
  reference text,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payments_sale_id_idx ON public.payments (sale_id);
CREATE INDEX payments_business_status_idx ON public.payments (business_id, payment_status);
CREATE INDEX payments_business_created_at_idx ON public.payments (business_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_select_own_tenant
  ON public.payments FOR SELECT TO authenticated
  USING (business_id = private.get_user_business_id());

CREATE POLICY payments_insert_own_tenant
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (business_id = private.get_user_business_id()
    AND private.get_user_role() = ANY (ARRAY['owner','manager'])
    AND EXISTS (SELECT 1 FROM public.sales s
      WHERE s.id = sale_id AND s.business_id = private.get_user_business_id()));

CREATE POLICY payments_update_own_tenant
  ON public.payments FOR UPDATE TO authenticated
  USING (business_id = private.get_user_business_id()
    AND private.get_user_role() = ANY (ARRAY['owner','manager']))
  WITH CHECK (business_id = private.get_user_business_id());

CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sale number allocation (atomic, per business) -------------------------------
CREATE OR REPLACE FUNCTION public.next_sale_number(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next bigint;
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'NO_BUSINESS';
  END IF;

  INSERT INTO public.sale_number_sequences (business_id, last_number)
  VALUES (p_business_id, 1)
  ON CONFLICT (business_id) DO UPDATE
    SET last_number = public.sale_number_sequences.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO v_next;

  RETURN 'SALE-' || lpad(v_next::text, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_sale_number(uuid) FROM PUBLIC, anon, authenticated;

-- Auto-assign the sale number when omitted, and pin tenancy/creator ----------
CREATE OR REPLACE FUNCTION public.sales_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.business_id IS NULL THEN
    NEW.business_id := private.get_user_business_id();
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  IF NULLIF(btrim(COALESCE(NEW.sale_number, '')), '') IS NULL THEN
    NEW.sale_number := public.next_sale_number(NEW.business_id);
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.sales ALTER COLUMN sale_number DROP NOT NULL;

CREATE TRIGGER sales_before_insert_assign
  BEFORE INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sales_before_insert();

ALTER TABLE public.sales
  ADD CONSTRAINT sales_sale_number_present CHECK (sale_number IS NOT NULL) NOT VALID;
ALTER TABLE public.sales VALIDATE CONSTRAINT sales_sale_number_present;

-- Payments/sale items must stay attached to their sale; nothing is deletable.
-- (No DELETE policies on sales, sale_items or payments: history is permanent.)
