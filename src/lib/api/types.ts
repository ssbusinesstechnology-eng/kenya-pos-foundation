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

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
};
