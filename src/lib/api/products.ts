/**
 * Single place for every product read + write.
 * Tenancy is enforced by RLS — never filter by business_id here.
 */
import { supabase } from "@/integrations/supabase/client";
import { friendlyDataError } from "@/lib/errors";
import { logAuditEvent } from "./account";
import type { Product, ProductInput } from "./types";

export const productKeys = {
  all: ["products"] as const,
  list: ["products", "list"] as const,
};

function translateProductError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? "");
  if (/products_business_sku_key|duplicate key|unique constraint/i.test(raw)) {
    return "Another product already uses that SKU. Please choose a different one.";
  }
  return friendlyDataError(error);
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(translateProductError(error));
  return (data ?? []) as Product[];
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .insert(input)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(translateProductError(error));
  if (!data) {
    throw new Error("We couldn't add that product. Only owners and managers can add products.");
  }
  const product = data as Product;
  await logAuditEvent("product.created", {
    entityType: "product",
    entityId: product.id,
    metadata: { name: product.name, sku: product.sku },
  });
  return product;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .update(input)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(translateProductError(error));
  if (!data) {
    throw new Error("We couldn't save that product. Only owners and managers can edit products.");
  }
  const product = data as Product;
  await logAuditEvent("product.updated", {
    entityType: "product",
    entityId: product.id,
    metadata: { name: product.name },
  });
  return product;
}

export async function setProductActive(id: string, isActive: boolean): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(translateProductError(error));
  if (!data) {
    throw new Error("We couldn't change that product. Only owners and managers can do this.");
  }
  const product = data as Product;
  await logAuditEvent(isActive ? "product.activated" : "product.deactivated", {
    entityType: "product",
    entityId: id,
    metadata: { name: product.name },
  });
  return product;
}
