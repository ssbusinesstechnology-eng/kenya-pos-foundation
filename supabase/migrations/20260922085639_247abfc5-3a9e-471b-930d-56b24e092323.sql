-- 1) Customers -------------------------------------------------------------
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL DEFAULT public.get_user_business_id() REFERENCES public.businesses(id),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customers_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT customers_name_len CHECK (char_length(name) <= 120),
  CONSTRAINT customers_phone_len CHECK (phone IS NULL OR char_length(phone) BETWEEN 3 AND 40),
  CONSTRAINT customers_email_len CHECK (email IS NULL OR char_length(email) <= 160),
  CONSTRAINT customers_email_shape CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s.]+\.[^@\s]+$'),
  CONSTRAINT customers_address_len CHECK (address IS NULL OR char_length(address) <= 400),
  CONSTRAINT customers_notes_len CHECK (notes IS NULL OR char_length(notes) <= 1000)
);

GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_select_own_tenant ON public.customers
  FOR SELECT TO authenticated
  USING (business_id = private.get_user_business_id());

CREATE POLICY customers_insert_own_tenant ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    business_id = private.get_user_business_id()
    AND private.get_user_role() = ANY (ARRAY['owner','manager'])
  );

CREATE POLICY customers_update_own_tenant ON public.customers
  FOR UPDATE TO authenticated
  USING (
    business_id = private.get_user_business_id()
    AND private.get_user_role() = ANY (ARRAY['owner','manager'])
  )
  WITH CHECK (business_id = private.get_user_business_id());

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX customers_business_created_idx ON public.customers (business_id, created_at DESC);
CREATE INDEX customers_business_name_idx ON public.customers (business_id, lower(name));
CREATE INDEX customers_business_phone_idx ON public.customers (business_id, phone);

-- 2) Optional customer on a sale ------------------------------------------
ALTER TABLE public.sales
  ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT;

CREATE INDEX sales_customer_created_idx ON public.sales (customer_id, created_at DESC);

-- 3) Checkout: same atomic operation, now with server-side customer checks --
CREATE OR REPLACE FUNCTION public.checkout_sale(
  p_items jsonb,
  p_payment_method text,
  p_payment_amount numeric,
  p_discount_amount numeric DEFAULT 0,
  p_reference text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_client_request_id uuid DEFAULT NULL::uuid,
  p_customer_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_business_id uuid;
  v_role text;
  v_user uuid := auth.uid();
  v_item jsonb;
  v_product public.products;
  v_qty numeric(14,3);
  v_price numeric(14,2);
  v_line_discount numeric(14,2);
  v_line_total numeric(14,2);
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2);
  v_total numeric(14,2);
  v_payment numeric(14,2);
  v_sale public.sales;
  v_existing public.sales;
  v_customer public.customers;
  v_method text := upper(coalesce(p_payment_method, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT business_id, role INTO v_business_id, v_role
  FROM public.profiles WHERE id = v_user;

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'NO_BUSINESS';
  END IF;
  IF v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  IF p_client_request_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.sales
     WHERE business_id = v_business_id AND client_request_id = p_client_request_id;
    IF v_existing.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'sale_id', v_existing.id,
        'sale_number', v_existing.sale_number,
        'total_amount', v_existing.total_amount,
        'subtotal', v_existing.subtotal,
        'discount_amount', v_existing.discount_amount,
        'payment_method', v_method,
        'payment_amount', v_existing.total_amount,
        'created_at', v_existing.created_at,
        'duplicate', true
      );
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART';
  END IF;
  IF v_method NOT IN ('CASH','MPESA','CARD','OTHER') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD';
  END IF;
  IF v_method = 'MPESA' AND coalesce(btrim(p_reference), '') = '' THEN
    RAISE EXCEPTION 'REFERENCE_REQUIRED';
  END IF;

  -- Customer is optional; when supplied it must belong to this business and be active.
  IF p_customer_id IS NOT NULL THEN
    SELECT * INTO v_customer FROM public.customers
     WHERE id = p_customer_id AND business_id = v_business_id;
    IF v_customer.id IS NULL THEN
      RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
    END IF;
    IF NOT v_customer.is_active THEN
      RAISE EXCEPTION 'CUSTOMER_INACTIVE:%', v_customer.name;
    END IF;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _checkout_lines (
    product_id uuid,
    product_name text,
    product_sku text,
    unit text,
    quantity numeric(14,3),
    unit_price numeric(14,2),
    discount_amount numeric(14,2),
    line_subtotal numeric(14,2)
  ) ON COMMIT DROP;
  DELETE FROM _checkout_lines WHERE true;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := round((v_item->>'quantity')::numeric, 3);
    v_price := round((v_item->>'unit_price')::numeric, 2);
    v_line_discount := round(coalesce((v_item->>'discount_amount')::numeric, 0), 2);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY';
    END IF;

    SELECT * INTO v_product FROM public.products
     WHERE id = (v_item->>'product_id')::uuid AND business_id = v_business_id
     FOR UPDATE;

    IF v_product.id IS NULL THEN
      RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
    END IF;
    IF NOT v_product.is_active THEN
      RAISE EXCEPTION 'PRODUCT_INACTIVE:%', v_product.name;
    END IF;
    IF v_product.selling_price <> v_price THEN
      RAISE EXCEPTION 'PRICE_CHANGED:%', v_product.name;
    END IF;
    IF v_product.stock_quantity < v_qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%:%:%', v_product.name, v_product.stock_quantity, v_product.unit;
    END IF;

    v_line_total := round(v_qty * v_price, 2) - v_line_discount;
    IF v_line_total < 0 THEN
      RAISE EXCEPTION 'INVALID_LINE_TOTAL';
    END IF;
    v_subtotal := v_subtotal + v_line_total;

    INSERT INTO _checkout_lines VALUES (
      v_product.id, v_product.name, v_product.sku, v_product.unit,
      v_qty, v_price, v_line_discount, v_line_total
    );
  END LOOP;

  v_discount := least(greatest(round(coalesce(p_discount_amount, 0), 2), 0), v_subtotal);
  v_total := v_subtotal - v_discount;
  v_payment := round(coalesce(p_payment_amount, 0), 2);

  IF v_payment < v_total THEN
    RAISE EXCEPTION 'UNDERPAYMENT';
  END IF;

  INSERT INTO public.sales (
    business_id, subtotal, discount_amount, tax_amount, total_amount,
    payment_status, sale_status, notes, created_by, client_request_id, customer_id
  ) VALUES (
    v_business_id, v_subtotal, v_discount, 0, v_total,
    'PAID', 'COMPLETED', nullif(btrim(coalesce(p_notes, '')), ''), v_user, p_client_request_id,
    v_customer.id
  ) RETURNING * INTO v_sale;

  INSERT INTO public.sale_items (
    business_id, sale_id, product_id, product_name, product_sku, unit,
    quantity, unit_price, discount_amount, line_subtotal
  )
  SELECT v_business_id, v_sale.id, product_id, product_name, product_sku, unit,
         quantity, unit_price, discount_amount, line_subtotal
    FROM _checkout_lines;

  INSERT INTO public.payments (
    business_id, sale_id, payment_method, amount, payment_status, reference, created_by
  ) VALUES (
    v_business_id, v_sale.id, v_method, v_total,
    'PAID', nullif(btrim(coalesce(p_reference, '')), ''), v_user
  );

  INSERT INTO public.inventory_movements (
    business_id, product_id, movement_type, quantity, quantity_change,
    previous_stock, new_stock, reason, notes, created_by
  )
  SELECT v_business_id, l.product_id, 'SALE', l.quantity, -l.quantity,
         p.stock_quantity, p.stock_quantity - l.quantity,
         'Sale ' || v_sale.sale_number, NULL, v_user
    FROM _checkout_lines l
    JOIN public.products p ON p.id = l.product_id;

  UPDATE public.products p
     SET stock_quantity = p.stock_quantity - l.quantity,
         updated_at = now()
    FROM _checkout_lines l
   WHERE p.id = l.product_id;

  IF EXISTS (
    SELECT 1 FROM public.products p JOIN _checkout_lines l ON l.product_id = p.id
     WHERE p.stock_quantity < 0
  ) THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK:::';
  END IF;

  PERFORM public.log_audit_event('sale.completed', 'sale', v_sale.id,
    jsonb_build_object('sale_number', v_sale.sale_number, 'total', v_total, 'method', v_method,
                       'customer_id', v_sale.customer_id));

  RETURN jsonb_build_object(
    'sale_id', v_sale.id,
    'sale_number', v_sale.sale_number,
    'total_amount', v_total,
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'payment_method', v_method,
    'payment_amount', v_payment,
    'created_at', v_sale.created_at,
    'duplicate', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.checkout_sale(jsonb, text, numeric, numeric, text, text, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.checkout_sale(jsonb, text, numeric, numeric, text, text, uuid, uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.checkout_sale(jsonb, text, numeric, numeric, text, text, uuid);