-- Move the internal RLS helpers into a schema the API does not expose.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.get_user_business_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT business_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION private.get_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION private.get_user_business_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.get_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.get_user_business_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_user_role() TO authenticated, service_role;

-- Repoint every policy at the private helpers.
DROP POLICY "businesses_select_own_tenant" ON public.businesses;
DROP POLICY "businesses_update_owner" ON public.businesses;
DROP POLICY "profiles_select_tenant_for_owner" ON public.profiles;
DROP POLICY "audit_log_select_own_tenant" ON public.audit_log;

CREATE POLICY "businesses_select_own_tenant" ON public.businesses
FOR SELECT TO authenticated
USING (id = private.get_user_business_id());

CREATE POLICY "businesses_update_owner" ON public.businesses
FOR UPDATE TO authenticated
USING (id = private.get_user_business_id() AND private.get_user_role() = 'owner')
WITH CHECK (id = private.get_user_business_id() AND private.get_user_role() = 'owner');

CREATE POLICY "profiles_select_tenant_for_owner" ON public.profiles
FOR SELECT TO authenticated
USING (
  business_id IS NOT NULL
  AND business_id = private.get_user_business_id()
  AND private.get_user_role() = 'owner'
);

CREATE POLICY "audit_log_select_own_tenant" ON public.audit_log
FOR SELECT TO authenticated
USING (business_id = private.get_user_business_id());

-- public.get_user_business_id() stays as a thin, tenant-safe wrapper for app code.
CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.get_user_business_id();
$$;

DROP FUNCTION IF EXISTS public.get_user_role();

-- Rewire the remaining definer functions onto the private helpers.
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_business_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_business_id uuid;
  v_own uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_own := private.get_user_business_id();
  v_business_id := COALESCE(p_business_id, v_own);

  IF v_business_id IS NOT NULL AND v_own IS NOT NULL AND v_business_id <> v_own THEN
    RAISE EXCEPTION 'cross-tenant audit write rejected';
  END IF;

  INSERT INTO public.audit_log (business_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (v_business_id, auth.uid(), p_action, p_entity_type, p_entity_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_business_for_owner(
  p_name text,
  p_owner_full_name text,
  p_contact_phone text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_currency text DEFAULT 'KES'
)
RETURNS public.businesses LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

REVOKE EXECUTE ON FUNCTION public.get_user_business_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_business_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_business_for_owner(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_business_for_owner(text, text, text, text, text, text) TO authenticated;