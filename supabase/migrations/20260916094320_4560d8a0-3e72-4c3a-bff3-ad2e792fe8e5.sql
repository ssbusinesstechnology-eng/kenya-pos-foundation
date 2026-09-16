-- ============================================================
-- S&S POS — Phase 1 foundation
-- businesses / profiles / audit_log + RLS helpers
--
-- MIGRATION NOTES FOR LATER PHASES:
-- Future tables (categories, products, inventory_movements, customers,
-- sales, sale_items, payments, price_history) must all carry
-- business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE
-- and use RLS policies of the form:
--   USING (business_id = public.get_user_business_id())
-- Do NOT introduce a second tenancy key. profiles.business_id and
-- businesses.id are the only tenancy anchors.
-- ============================================================

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_phone text,
  contact_email text,
  address text,
  currency text NOT NULL DEFAULT 'KES',
  receipt_footer text,
  default_low_stock_threshold integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  full_name text,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','manager','cashier')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_business_id_idx ON public.profiles (business_id);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_business_id_created_at_idx ON public.audit_log (business_id, created_at DESC);

-- ---------- grants ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

-- ---------- reusable tenancy helpers ----------
CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ---------- updated_at ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER businesses_set_updated_at
BEFORE UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- audit helper ----------
-- user_id is always forced to the caller; business_id defaults to the
-- caller's tenant so callers can never write into another business.
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_business_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_business_id := COALESCE(p_business_id, public.get_user_business_id());

  IF v_business_id IS NOT NULL
     AND public.get_user_business_id() IS NOT NULL
     AND v_business_id <> public.get_user_business_id() THEN
    RAISE EXCEPTION 'cross-tenant audit write rejected';
  END IF;

  INSERT INTO public.audit_log (business_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (v_business_id, auth.uid(), p_action, p_entity_type, p_entity_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------- profile bootstrap ----------
-- Creates the caller's profile row if it does not exist yet (called right
-- after sign up / sign in). Logs user.registered on first creation.
CREATE OR REPLACE FUNCTION public.ensure_profile(p_full_name text DEFAULT NULL)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();

  IF v_profile.id IS NULL THEN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (auth.uid(), NULLIF(TRIM(COALESCE(p_full_name, '')), ''), 'owner')
    RETURNING * INTO v_profile;

    INSERT INTO public.audit_log (business_id, user_id, action, entity_type, entity_id)
    VALUES (NULL, auth.uid(), 'user.registered', 'profile', auth.uid());
  ELSIF v_profile.full_name IS NULL AND NULLIF(TRIM(COALESCE(p_full_name, '')), '') IS NOT NULL THEN
    UPDATE public.profiles SET full_name = TRIM(p_full_name)
    WHERE id = auth.uid() RETURNING * INTO v_profile;
  END IF;

  RETURN v_profile;
END;
$$;

-- ---------- onboarding: create business + attach owner ----------
CREATE OR REPLACE FUNCTION public.create_business_for_owner(
  p_name text,
  p_owner_full_name text,
  p_contact_phone text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_currency text DEFAULT 'KES'
)
RETURNS public.businesses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business public.businesses;
  v_existing uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NULLIF(TRIM(COALESCE(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'business name is required';
  END IF;

  PERFORM public.ensure_profile(p_owner_full_name);

  SELECT business_id INTO v_existing FROM public.profiles WHERE id = auth.uid();
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'this account already belongs to a business';
  END IF;

  INSERT INTO public.businesses (name, contact_phone, contact_email, address, currency)
  VALUES (
    TRIM(p_name),
    NULLIF(TRIM(COALESCE(p_contact_phone, '')), ''),
    NULLIF(TRIM(COALESCE(p_contact_email, '')), ''),
    NULLIF(TRIM(COALESCE(p_address, '')), ''),
    COALESCE(NULLIF(TRIM(COALESCE(p_currency, '')), ''), 'KES')
  )
  RETURNING * INTO v_business;

  UPDATE public.profiles
  SET business_id = v_business.id,
      role = 'owner',
      full_name = COALESCE(NULLIF(TRIM(COALESCE(p_owner_full_name, '')), ''), full_name)
  WHERE id = auth.uid();

  INSERT INTO public.audit_log (business_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (v_business.id, auth.uid(), 'business.created', 'business', v_business.id,
          jsonb_build_object('name', v_business.name, 'currency', v_business.currency));

  RETURN v_business;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_business_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_business_for_owner(text, text, text, text, text, text) TO authenticated;

-- ---------- RLS ----------
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "businesses_select_own_tenant" ON public.businesses
FOR SELECT TO authenticated
USING (id = public.get_user_business_id());

CREATE POLICY "businesses_update_owner" ON public.businesses
FOR UPDATE TO authenticated
USING (id = public.get_user_business_id() AND public.get_user_role() = 'owner')
WITH CHECK (id = public.get_user_business_id() AND public.get_user_role() = 'owner');

CREATE POLICY "profiles_select_self" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "profiles_select_tenant_for_owner" ON public.profiles
FOR SELECT TO authenticated
USING (
  business_id IS NOT NULL
  AND business_id = public.get_user_business_id()
  AND public.get_user_role() = 'owner'
);

CREATE POLICY "profiles_update_self" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "audit_log_select_own_tenant" ON public.audit_log
FOR SELECT TO authenticated
USING (business_id = public.get_user_business_id());