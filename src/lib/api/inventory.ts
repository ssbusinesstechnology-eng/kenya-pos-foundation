/**
 * Single place for every inventory read + write.
 * Tenancy and permissions are enforced by RLS and the adjust_product_stock RPC —
 * never filter by business_id here.
 */
import { supabase } from "@/integrations/supabase/client";
import { friendlyDataError } from "@/lib/errors";
import type { InventoryMovement, StockAdjustmentInput } from "./types";

export const inventoryKeys = {
  all: ["inventory"] as const,
  movements: ["inventory", "movements"] as const,
  product: (productId: string) => ["inventory", "movements", productId] as const,
};

function translateStockError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? "");
  if (/INSUFFICIENT_STOCK/.test(raw)) {
    return "That would take the stock below zero. Reduce the quantity and try again.";
  }
  if (/NOT_ALLOWED/.test(raw)) {
    return "Only owners and managers can adjust stock.";
  }
  if (/PRODUCT_NOT_FOUND/.test(raw)) {
    return "We couldn't find that product in your business.";
  }
  if (/INVALID_QUANTITY/.test(raw)) {
    return "Enter a quantity greater than zero.";
  }
  if (/INVALID_TYPE/.test(raw)) {
    return "Please choose whether stock is coming in or going out.";
  }
  if (/NO_BUSINESS/.test(raw)) {
    return "Finish setting up your business before adjusting stock.";
  }
  return friendlyDataError(error);
}

const MOVEMENT_COLUMNS =
  "id, business_id, product_id, movement_type, quantity, quantity_change, previous_stock, new_stock, reason, notes, created_by, created_at";

export async function fetchMovements(limit = 100): Promise<InventoryMovement[]> {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select(MOVEMENT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(translateStockError(error));
  return (data ?? []) as InventoryMovement[];
}

export async function fetchProductMovements(productId: string): Promise<InventoryMovement[]> {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select(MOVEMENT_COLUMNS)
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(translateStockError(error));
  return (data ?? []) as InventoryMovement[];
}

export async function adjustStock(input: StockAdjustmentInput): Promise<InventoryMovement> {
  const { data, error } = await supabase.rpc("adjust_product_stock", {
    p_product_id: input.productId,
    p_movement_type: input.movementType,
    p_quantity: input.quantity,
    p_reason: input.reason,
    ...(input.notes ? { p_notes: input.notes } : {}),
  });
  if (error) throw new Error(translateStockError(error));
  if (!data) throw new Error("We couldn't record that stock change. Please try again.");
  return data as unknown as InventoryMovement;
}

/** Names for the movement "recorded by" column. RLS decides what is visible. */
export async function fetchTeamNames(): Promise<{ id: string; full_name: string | null }[]> {
  const { data, error } = await supabase.from("profiles").select("id, full_name");
  if (error) throw new Error(friendlyDataError(error));
  return (data ?? []) as { id: string; full_name: string | null }[];
}
