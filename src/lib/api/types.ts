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

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
};
