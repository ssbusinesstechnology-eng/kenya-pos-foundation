-- Phase 2A: products catalogue.
-- Later phases will add: categories, inventory_movements, customers, sales,
-- sale_items, payments, price_history. products.category is plain text for now
-- so a future categories table can be introduced without conflicting data.

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL DEFAULT public.get_user_business_id() REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  sku text,
  category text,
  description text,
  cost_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  selling_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  stock_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  unit text NOT NULL DEFAULT 'pc',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- SKU optional, but unique (case-insensitive) within a single business.
CREATE UNIQUE INDEX products_business_sku_key
  ON public.products (business_id, lower(btrim(sku)))
  WHERE sku IS NOT NULL AND btrim(sku) <> '';

CREATE INDEX products_business_created_idx ON public.products (business_id, created_at DESC);
CREATE INDEX products_business_name_idx ON public.products (business_id, lower(name));

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- The business_id column default needs the helper to be callable by the user.
GRANT EXECUTE ON FUNCTION public.get_user_business_id() TO authenticated;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_select_own_tenant ON public.products
  FOR SELECT TO authenticated
  USING (business_id = private.get_user_business_id());

CREATE POLICY products_insert_own_tenant ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    business_id = private.get_user_business_id()
    AND private.get_user_role() IN ('owner', 'manager')
  );

CREATE POLICY products_update_own_tenant ON public.products
  FOR UPDATE TO authenticated
  USING (
    business_id = private.get_user_business_id()
    AND private.get_user_role() IN ('owner', 'manager')
  )
  WITH CHECK (business_id = private.get_user_business_id());
