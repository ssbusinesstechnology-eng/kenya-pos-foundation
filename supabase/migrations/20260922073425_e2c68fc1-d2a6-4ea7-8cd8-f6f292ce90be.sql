-- Phase 2B: inventory movements (audit trail for every stock change)
-- Later phases will add SALE / PURCHASE movement types plus categories, customers,
-- sales, sale_items, payments and price_history tables. Keep this table additive.

CREATE TABLE public.inventory_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL DEFAULT public.get_user_business_id() REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('INITIAL_STOCK','RESTOCK','ADJUSTMENT_IN','ADJUSTMENT_OUT')),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  quantity_change numeric(14,3) NOT NULL,
  previous_stock numeric(14,3) NOT NULL,
  new_stock numeric(14,3) NOT NULL CHECK (new_stock >= 0),
  reason text,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Read-only from the API: writes only happen through the security-definer RPC/trigger below.
CREATE POLICY inventory_movements_select_own_tenant
  ON public.inventory_movements
  FOR SELECT
  TO authenticated
  USING (business_id = private.get_user_business_id());

CREATE INDEX inventory_movements_business_created_idx
  ON public.inventory_movements (business_id, created_at DESC);
CREATE INDEX inventory_movements_product_created_idx
  ON public.inventory_movements (product_id, created_at DESC);

-- Atomic stock adjustment: updates the product and writes history in one statement block.
CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  p_product_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.inventory_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid := private.get_user_business_id();
  v_role text := private.get_user_role();
  v_previous numeric(14,3);
  v_new numeric(14,3);
  v_change numeric(14,3);
  v_movement public.inventory_movements;
BEGIN
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'NO_BUSINESS';
  END IF;

  IF v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  IF p_movement_type NOT IN ('INITIAL_STOCK','RESTOCK','ADJUSTMENT_IN','ADJUSTMENT_OUT') THEN
    RAISE EXCEPTION 'INVALID_TYPE';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;

  SELECT stock_quantity INTO v_previous
  FROM public.products
  WHERE id = p_product_id AND business_id = v_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
  END IF;

  IF p_movement_type = 'ADJUSTMENT_OUT' THEN
    v_change := -p_quantity;
  ELSE
    v_change := p_quantity;
  END IF;

  v_new := v_previous + v_change;

  IF v_new < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  UPDATE public.products
  SET stock_quantity = v_new, updated_at = now()
  WHERE id = p_product_id AND business_id = v_business_id;

  INSERT INTO public.inventory_movements (
    business_id, product_id, movement_type, quantity, quantity_change,
    previous_stock, new_stock, reason, notes, created_by
  ) VALUES (
    v_business_id, p_product_id, p_movement_type, p_quantity, v_change,
    v_previous, v_new, nullif(btrim(coalesce(p_reason,'')), ''), nullif(btrim(coalesce(p_notes,'')), ''), auth.uid()
  )
  RETURNING * INTO v_movement;

  PERFORM public.log_audit_event(
    'inventory.adjusted',
    'product',
    p_product_id,
    jsonb_build_object(
      'movement_type', p_movement_type,
      'quantity', p_quantity,
      'previous_stock', v_previous,
      'new_stock', v_new
    ),
    v_business_id
  );

  RETURN v_movement;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_product_stock(uuid, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(uuid, text, numeric, text, text) TO authenticated;

-- Opening stock entered at product creation becomes an INITIAL_STOCK movement.
-- Deliberately AFTER INSERT only, so later product edits never create movements.
CREATE OR REPLACE FUNCTION public.record_initial_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stock_quantity IS NOT NULL AND NEW.stock_quantity > 0 THEN
    INSERT INTO public.inventory_movements (
      business_id, product_id, movement_type, quantity, quantity_change,
      previous_stock, new_stock, reason, created_by
    ) VALUES (
      NEW.business_id, NEW.id, 'INITIAL_STOCK', NEW.stock_quantity, NEW.stock_quantity,
      0, NEW.stock_quantity, 'Opening stock at product creation', auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_initial_stock() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER products_record_initial_stock
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.record_initial_stock();