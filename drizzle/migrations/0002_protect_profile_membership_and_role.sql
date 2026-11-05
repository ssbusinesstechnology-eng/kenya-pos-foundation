-- Verified QA defect: self-update RLS allowed browser changes to tenancy and roles.
-- Keep the existing role/onboarding system; only full_name remains self-editable.
REVOKE UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id, business_id, full_name, role, is_active, created_at) ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;
COMMENT ON COLUMN public.profiles.role IS 'Protected legacy role: assigned only by privileged existing onboarding/administration, never browser self-update.';
COMMENT ON COLUMN public.profiles.business_id IS 'Protected tenant membership: assigned only by privileged existing onboarding/administration, never browser self-update.';