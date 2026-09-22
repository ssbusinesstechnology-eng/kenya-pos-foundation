/**
 * Single place for every sale read + write.
 * The whole checkout runs inside one database operation (checkout_sale) so a
 * sale, its items, its payment and the stock change can never land half-done.
 * Tenancy and permissions are enforced there and by RLS — never filter by
 * business_id here.
 */
import { supabase } from "@/integrations/supabase/client";
import { friendlyDataError } from "@/lib/errors";
import type {
  CheckoutInput,
  CheckoutResult,
  SaleDetail,
  SaleListRow,
  SalesQuery,
  SalesPage,
} from "./types";

export const saleKeys = {
  all: ["sales"] as const,
  detail: (id: string) => ["sales", "detail", id] as const,
  list: (query: SalesQuery) => ["sales", "list", query] as const,
};

function translateCheckoutError(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : String((error as { message?: string })?.message ?? "");

  const stock = /INSUFFICIENT_STOCK:([^:]*):([^:]*):([^:]*)/.exec(raw);
  if (stock) {
    const name = stock[1];
    const parsedAvailable = Number(stock[2]);
    const available = Number.isFinite(parsedAvailable)
      ? parsedAvailable.toLocaleString("en-KE", { maximumFractionDigits: 3 })
      : stock[2];
    const unit = stock[3];
    return name
      ? `Stock changed. ${name} now has only ${available} ${unit} left. Please review your cart.`
      : "Stock changed. Please review your cart.";
  }
  const price = /PRICE_CHANGED:(.*)/.exec(raw);
  if (price) {
    return `The price of ${price[1]} changed since you added it. Remove it and add it again to use the current price.`;
  }
  const inactive = /PRODUCT_INACTIVE:(.*)/.exec(raw);
  if (inactive) {
    return `${inactive[1]} is no longer active and can't be sold. Remove it from the cart.`;
  }
  if (/PRODUCT_NOT_FOUND/.test(raw)) {
    return "One of the products in the cart is no longer available. Please review your cart.";
  }
  if (/UNDERPAYMENT/.test(raw)) {
    return "The amount paid is less than the sale total.";
  }
  if (/REFERENCE_REQUIRED/.test(raw)) {
    return "Enter the M-Pesa transaction code to record this payment.";
  }
  if (/INVALID_PAYMENT_METHOD/.test(raw)) {
    return "Please choose a payment method.";
  }
  if (/INVALID_QUANTITY|INVALID_LINE_TOTAL/.test(raw)) {
    return "One of the quantities isn't valid. Please review your cart.";
  }
  if (/EMPTY_CART/.test(raw)) {
    return "Add at least one product before completing a sale.";
  }
  if (/NOT_ALLOWED/.test(raw)) {
    return "Only owners and managers can complete sales.";
  }
  if (/NO_BUSINESS/.test(raw)) {
    return "Finish setting up your business before making a sale.";
  }
  const inactiveCustomer = /CUSTOMER_INACTIVE:(.*)/.exec(raw);
  if (inactiveCustomer) {
    return `${inactiveCustomer[1]} is marked inactive and can't be added to a new sale.`;
  }
  if (/CUSTOMER_NOT_FOUND/.test(raw)) {
    return "That customer is no longer available. Remove the customer and try again.";
  }
  return friendlyDataError(error);
}

export async function checkoutSale(input: CheckoutInput): Promise<CheckoutResult> {
  const { data, error } = await supabase.rpc("checkout_sale", {
    p_items: input.items as never,
    p_payment_method: input.paymentMethod,
    p_payment_amount: input.paymentAmount,
    p_discount_amount: input.discountAmount,
    p_client_request_id: input.clientRequestId,
    ...(input.customerId ? { p_customer_id: input.customerId } : {}),
    ...(input.reference ? { p_reference: input.reference } : {}),
    ...(input.notes ? { p_notes: input.notes } : {}),
  });
  if (error) throw new Error(translateCheckoutError(error));
  if (!data) throw new Error("Unable to complete the sale. Please try again.");
  return data as unknown as CheckoutResult;
}

/**
 * One sale, read entirely from what was stored at the time of sale.
 * Product name, SKU, unit and unit price come from sale_items snapshots — the
 * current product record is never consulted.
 */
export async function fetchSale(saleId: string): Promise<SaleDetail | null> {
  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, sale_number, subtotal, discount_amount, tax_amount, total_amount, payment_status, sale_status, notes, created_at, created_by, customer_id, creator:profiles!sales_created_by_fkey(full_name), customer:customers(id, name, phone, is_active), sale_items(id, product_name, product_sku, unit, quantity, unit_price, discount_amount, line_subtotal), payments(id, payment_method, amount, payment_status, reference, created_at)",
    )
    .eq("id", saleId)
    .maybeSingle();
  if (error) throw new Error(friendlyDataError(error));
  return (data as unknown as SaleDetail | null) ?? null;
}

const LIST_BASE =
  "id, sale_number, total_amount, payment_status, sale_status, created_at, created_by, customer_id, creator:profiles!sales_created_by_fkey(full_name), customer:customers(id, name, phone, is_active)";

const LIST_COLUMNS = `${LIST_BASE}, payments(id, payment_method, reference, payment_status)`;

const LIST_COLUMNS_INNER = `${LIST_BASE}, payments!inner(id, payment_method, reference, payment_status)`;

const SEARCH_CAP = 200;

type Builder = ReturnType<ReturnType<typeof supabase.from>["select"]>;

function applyFilters(query: Builder, q: SalesQuery): Builder {
  let next = query;
  if (q.saleStatus !== "ALL") next = next.eq("sale_status", q.saleStatus);
  if (q.paymentStatus !== "ALL") next = next.eq("payment_status", q.paymentStatus);
  if (q.from) next = next.gte("created_at", q.from);
  if (q.to) next = next.lt("created_at", q.to);
  if (q.paymentMethod !== "ALL") next = next.eq("payments.payment_method", q.paymentMethod);
  return next;
}

function escapeLike(term: string): string {
  return term.replace(/[%_,()]/g, " ").trim();
}

/**
 * Newest first, page by page — never the whole table.
 * Searching by sale reference and by payment reference are two separate reads
 * (they match different tables); results are merged, de-duplicated and capped.
 */
export async function fetchSalesPage(q: SalesQuery): Promise<SalesPage> {
  const term = escapeLike(q.search);

  if (term) {
    const numberQuery = applyFilters(
      supabase.from("sales").select(q.paymentMethod === "ALL" ? LIST_COLUMNS : LIST_COLUMNS_INNER),
      q,
    )
      .ilike("sale_number", `%${term}%`)
      .order("created_at", { ascending: false })
      .limit(SEARCH_CAP);

    const refQuery = applyFilters(supabase.from("sales").select(LIST_COLUMNS_INNER), q)
      .ilike("payments.reference", `%${term}%`)
      .order("created_at", { ascending: false })
      .limit(SEARCH_CAP);

    const [byNumber, byRef] = await Promise.all([numberQuery, refQuery]);
    if (byNumber.error) throw new Error(friendlyDataError(byNumber.error));
    if (byRef.error) throw new Error(friendlyDataError(byRef.error));

    const merged = new Map<string, SaleListRow>();
    for (const row of [
      ...((byNumber.data ?? []) as unknown as SaleListRow[]),
      ...((byRef.data ?? []) as unknown as SaleListRow[]),
    ]) {
      merged.set(row.id, row);
    }
    const rows = [...merged.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const start = q.page * q.pageSize;
    return {
      rows: rows.slice(start, start + q.pageSize),
      total: rows.length,
      capped: rows.length >= SEARCH_CAP,
    };
  }

  const from = q.page * q.pageSize;
  const { data, error, count } = await applyFilters(
    supabase
      .from("sales")
      .select(q.paymentMethod === "ALL" ? LIST_COLUMNS : LIST_COLUMNS_INNER, { count: "exact" }),
    q,
  )
    .order("created_at", { ascending: false })
    .range(from, from + q.pageSize - 1);

  if (error) throw new Error(friendlyDataError(error));
  return {
    rows: (data ?? []) as unknown as SaleListRow[],
    total: count ?? 0,
    capped: false,
  };
}
