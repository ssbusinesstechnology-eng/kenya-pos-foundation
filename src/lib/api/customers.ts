/**
 * Single place for every customer read + write.
 * Tenancy and permissions are enforced by RLS — never filter by business_id here.
 * Lists are always read a page at a time, and searches run in the database.
 */
import { supabase } from "@/integrations/supabase/client";
import { friendlyDataError } from "@/lib/errors";
import { logAuditEvent } from "./account";
import type {
  Customer,
  CustomerInput,
  CustomersPage,
  CustomersQuery,
  SaleListRow,
} from "./types";

export const customerKeys = {
  all: ["customers"] as const,
  list: (query: CustomersQuery) => ["customers", "list", query] as const,
  detail: (id: string) => ["customers", "detail", id] as const,
  sales: (id: string) => ["customers", "sales", id] as const,
  lookup: (term: string) => ["customers", "lookup", term] as const,
};

function translateCustomerError(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : String((error as { message?: string })?.message ?? "");
  if (/customers_email_shape/.test(raw)) return "That email address doesn't look right.";
  if (/customers_name_not_blank/.test(raw)) return "Please enter the customer's name.";
  if (/customers_name_len|customers_phone_len|customers_email_len|customers_address_len|customers_notes_len/.test(raw)) {
    return "One of the details is too long. Please shorten it and try again.";
  }
  return friendlyDataError(error);
}

function escapeLike(term: string): string {
  return term.replace(/[%_,()]/g, " ").trim();
}

export async function fetchCustomersPage(q: CustomersQuery): Promise<CustomersPage> {
  let query = supabase.from("customers").select("*", { count: "exact" });

  if (q.status !== "ALL") query = query.eq("is_active", q.status === "ACTIVE");

  const term = escapeLike(q.search);
  if (term) {
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const from = q.page * q.pageSize;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + q.pageSize - 1);

  if (error) throw new Error(translateCustomerError(error));
  return { rows: (data ?? []) as Customer[], total: count ?? 0 };
}

export async function fetchCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(translateCustomerError(error));
  return (data as Customer | null) ?? null;
}

/** Sales linked to one customer, newest first — reuses the sales list shape. */
export async function fetchCustomerSales(customerId: string, limit = 20): Promise<SaleListRow[]> {
  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, sale_number, total_amount, payment_status, sale_status, created_at, created_by, customer_id, creator:profiles!sales_created_by_fkey(full_name), customer:customers(id, name, phone, is_active), payments(id, payment_method, reference, payment_status)",
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(friendlyDataError(error));
  return (data ?? []) as unknown as SaleListRow[];
}

/** Active customers matching a name or phone — small result set for the POS picker. */
export async function searchActiveCustomers(term: string, limit = 8): Promise<Customer[]> {
  const cleaned = escapeLike(term);
  let query = supabase.from("customers").select("*").eq("is_active", true);
  if (cleaned) query = query.or(`name.ilike.%${cleaned}%,phone.ilike.%${cleaned}%`);
  const { data, error } = await query.order("name", { ascending: true }).limit(limit);
  if (error) throw new Error(translateCustomerError(error));
  return (data ?? []) as Customer[];
}

/** Same business, same phone — used to warn before an accidental duplicate. */
export async function findCustomersByPhone(phone: string, excludeId?: string): Promise<Customer[]> {
  const cleaned = phone.trim();
  if (!cleaned) return [];
  let query = supabase.from("customers").select("*").eq("phone", cleaned);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.limit(5);
  if (error) throw new Error(translateCustomerError(error));
  return (data ?? []) as Customer[];
}

function clean(value: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

function normalise(input: CustomerInput): CustomerInput {
  return {
    name: input.name.trim(),
    phone: clean(input.phone),
    email: clean(input.email)?.toLowerCase() ?? null,
    address: clean(input.address),
    notes: clean(input.notes),
  };
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .insert(normalise(input))
    .select("*")
    .maybeSingle();
  if (error) throw new Error(translateCustomerError(error));
  if (!data) {
    throw new Error("We couldn't add that customer. Only owners and managers can add customers.");
  }
  const customer = data as Customer;
  await logAuditEvent("customer.created", {
    entityType: "customer",
    entityId: customer.id,
    metadata: { name: customer.name },
  });
  return customer;
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .update(normalise(input))
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(translateCustomerError(error));
  if (!data) {
    throw new Error("We couldn't save that customer. Only owners and managers can edit customers.");
  }
  const customer = data as Customer;
  await logAuditEvent("customer.updated", {
    entityType: "customer",
    entityId: customer.id,
    metadata: { name: customer.name },
  });
  return customer;
}

export async function setCustomerActive(id: string, isActive: boolean): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(translateCustomerError(error));
  if (!data) {
    throw new Error("We couldn't change that customer. Only owners and managers can do this.");
  }
  const customer = data as Customer;
  await logAuditEvent(isActive ? "customer.activated" : "customer.deactivated", {
    entityType: "customer",
    entityId: id,
    metadata: { name: customer.name },
  });
  return customer;
}
