export type UserRole = "owner" | "manager" | "cashier";

export interface Profile {
  id: string;
  business_id: string | null;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Business {
  id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  currency: string;
  receipt_footer: string | null;
  default_low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface Account {
  userId: string;
  email: string | null;
  profile: Profile;
  business: Business | null;
}

export interface BusinessSetupInput {
  name: string;
  ownerFullName: string;
  phone?: string;
  email?: string;
  address?: string;
  currency: string;
}

export interface BusinessSettingsInput {
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  currency: string;
  receipt_footer: string | null;
  default_low_stock_threshold: number;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name: string;
  sku: string;
  category: string | null;
  description: string | null;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  unit: string;
  is_active: boolean;
}

export const PRODUCT_UNITS = [
  "pc",
  "kg",
  "g",
  "litre",
  "ml",
  "pack",
  "box",
  "crate",
  "dozen",
  "metre",
] as const;

export type MovementType = "INITIAL_STOCK" | "RESTOCK" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  INITIAL_STOCK: "Initial stock",
  RESTOCK: "Restock",
  ADJUSTMENT_IN: "Adjustment in",
  ADJUSTMENT_OUT: "Adjustment out",
};

export interface InventoryMovement {
  id: string;
  business_id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StockAdjustmentInput {
  productId: string;
  movementType: MovementType;
  quantity: number;
  reason: string;
  notes?: string;
}

export const STOCK_IN_REASONS = [
  "Restocking",
  "Initial stock",
  "Returned stock",
  "Other stock received",
] as const;

export const STOCK_OUT_REASONS = [
  "Damaged goods",
  "Lost stock",
  "Expired stock",
  "Manual correction",
  "Other stock removal",
] as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
};
