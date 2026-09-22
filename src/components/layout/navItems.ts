import {
  BarChart3,
  Boxes,
  History,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Sparkles,
  Users,
  UserSquare2,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Sales", to: "/sales", icon: Receipt },
  { label: "Sales history", to: "/sales-history", icon: History },
  { label: "Products", to: "/products", icon: Package },
  { label: "Inventory", to: "/inventory", icon: Boxes },
  { label: "Customers", to: "/customers", icon: UserSquare2 },
  { label: "Reports", to: "/reports", icon: BarChart3 },
  { label: "Users", to: "/users", icon: Users },
  { label: "Ask S&S", to: "/assistant", icon: Sparkles },
  { label: "Settings", to: "/settings", icon: Settings },
];
