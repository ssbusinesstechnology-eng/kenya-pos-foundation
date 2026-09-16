/**
 * Single place for every account/tenancy read + write.
 * Later phases should add sibling modules (products.ts, sales.ts, ...) and
 * never re-implement these queries inline in components.
 */
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError, friendlyDataError } from "@/lib/errors";
import type { Account, Business, BusinessSetupInput, Profile } from "./types";

export const accountKeys = {
  current: ["account", "current"] as const,
};

/** Creates the caller's profile row if it doesn't exist yet. */
export async function ensureProfile(fullName?: string | null): Promise<Profile> {
  const args: { p_full_name?: string } = {};
  if (fullName) args.p_full_name = fullName;
  const { data, error } = await supabase.rpc("ensure_profile", args);
  if (error) throw new Error(friendlyDataError(error));
  return data as unknown as Profile;
}

export async function fetchBusiness(businessId: string): Promise<Business | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw new Error(friendlyDataError(error));
  return (data as Business | null) ?? null;
}

/** The signed-in user, their profile and (if set up) their business. */
export async function fetchAccount(): Promise<Account | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const user = userData.user;
  const metadataName =
    (user.user_metadata?.["full_name"] as string | undefined) ?? null;

  const profile = await ensureProfile(metadataName);
  const business = profile.business_id ? await fetchBusiness(profile.business_id) : null;

  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
    business,
  };
}

export async function createBusinessForOwner(input: BusinessSetupInput): Promise<Business> {
  const args: {
    p_name: string;
    p_owner_full_name: string;
    p_currency: string;
    p_contact_phone?: string;
    p_contact_email?: string;
    p_address?: string;
  } = {
    p_name: input.name,
    p_owner_full_name: input.ownerFullName,
    p_currency: input.currency,
  };
  if (input.phone) args.p_contact_phone = input.phone;
  if (input.email) args.p_contact_email = input.email;
  if (input.address) args.p_address = input.address;

  const { data, error } = await supabase.rpc("create_business_for_owner", args);
  if (error) throw new Error(friendlyDataError(error));
  return data as unknown as Business;
}

export async function logAuditEvent(
  action: string,
  options: {
    entityType?: string | null;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  // Audit logging must never block a user flow.
  const args: {
    p_action: string;
    p_entity_type?: string;
    p_entity_id?: string;
    p_metadata?: never;
  } = { p_action: action };
  if (options.entityType) args.p_entity_type = options.entityType;
  if (options.entityId) args.p_entity_id = options.entityId;
  if (options.metadata) args.p_metadata = options.metadata as never;

  const { error } = await supabase.rpc("log_audit_event", args);
  if (error) console.warn("audit log skipped", action);
}

/* ---------------- auth ---------------- */

export async function signUpWithEmail(params: {
  email: string;
  password: string;
  fullName: string;
}): Promise<{ needsEmailConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth`,
      data: { full_name: params.fullName },
    },
  });
  if (error) throw new Error(friendlyAuthError(error));
  return { needsEmailConfirmation: !data.session };
}

export async function signInWithEmail(params: { email: string; password: string }) {
  const { error } = await supabase.auth.signInWithPassword(params);
  if (error) throw new Error(friendlyAuthError(error));
  await logAuditEvent("user.login", { entityType: "profile" });
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(friendlyAuthError(error));
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(friendlyAuthError(error));
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(friendlyAuthError(error));
}
