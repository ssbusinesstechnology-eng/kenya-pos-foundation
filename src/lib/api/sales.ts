/**
 * Single place for every sale read + write.
 * The whole checkout runs inside one database operation (checkout_sale) so a
 * sale, its items, its payment and the stock change can never land half-done.
 * Tenancy and permissions are enforced there and by RLS — never filter by
 * business_id here.
 */
import { supabase } from "@/integrations/supabase/client";
import { friendlyDataError } from "@/lib/errors";
import type { CheckoutInput, CheckoutResult, SaleDetail } from "./types";

export const saleKeys = {
  all: ["sales"] as const,
  detail: (id: string) => ["sales", "detail", id] as const,
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
  return friendlyDataError(error);
}

export async function checkoutSale(input: CheckoutInput): Promise<CheckoutResult> {
  const { data, error } = await supabase.rpc("checkout_sale", {
    p_items: input.items as never,
    p_payment_method: input.paymentMethod,
    p_payment_amount: input.paymentAmount,
    p_discount_amount: input.discountAmount,
    p_client_request_id: input.clientRequestId,
    ...(input.reference ? { p_reference: input.reference } : {}),
    ...(input.notes ? { p_notes: input.notes } : {}),
  });
  if (error) throw new Error(translateCheckoutError(error));
  if (!data) throw new Error("Unable to complete the sale. Please try again.");
  return data as unknown as CheckoutResult;
}

export async function fetchSale(saleId: string): Promise<SaleDetail | null> {
  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, sale_number, subtotal, discount_amount, tax_amount, total_amount, payment_status, sale_status, notes, created_at, sale_items(id, product_name, product_sku, unit, quantity, unit_price, discount_amount, line_subtotal), payments(id, payment_method, amount, payment_status, reference, created_at)",
    )
    .eq("id", saleId)
    .maybeSingle();
  if (error) throw new Error(friendlyDataError(error));
  return (data as unknown as SaleDetail | null) ?? null;
}
