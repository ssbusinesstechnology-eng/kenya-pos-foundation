import { z } from "zod";

/** Decimal strings remain exact even when aggregate totals exceed safe JS cents. */
export function reportMoney(value: unknown, currency = "KES") {
  const text = String(value ?? 0);
  const [whole = "0", fraction = ""] = text.split(".");
  if (!/^-?\d+$/.test(whole)) return `${currency} 0.00`;
  return `${currency} ${BigInt(whole).toLocaleString("en-KE")}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}
export function decimalCents(value: string) {
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}
export function centsDecimal(cents: bigint) {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

export const REPORT_RANGES = [
  "today",
  "yesterday",
  "last7",
  "last30",
  "month",
  "lastmonth",
  "year",
  "custom",
] as const;
export const RANGE_LABELS: Record<(typeof REPORT_RANGES)[number], string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  month: "This month",
  lastmonth: "Last month",
  year: "This year",
  custom: "Custom range",
};
export const REPORT_SECTIONS = [
  "overview",
  "top",
  "performance",
  "inventory",
  "movements",
  "payments",
  "customers",
  "transactions",
] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];
export const reportSearchSchema = z.object({
  range: z.enum(REPORT_RANGES).catch("last7"),
  from: z.string().catch(""),
  to: z.string().catch(""),
  section: z.enum(REPORT_SECTIONS).catch("overview"),
  search: z.string().max(120).catch(""),
  category: z.string().max(120).catch(""),
  stock: z.enum(["ALL", "IN", "LOW", "OUT"]).catch("ALL"),
  sort: z.enum(["revenue", "quantity"]).catch("revenue"),
  page: z.coerce.number().int().min(0).max(100000).catch(0),
});
export type ReportSearch = z.infer<typeof reportSearchSchema>;
export interface ReportPeriod {
  from: string;
  to: string;
  group: "day" | "week" | "month";
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}
export function nairobiDay(now = new Date()) {
  return isoDay(new Date(now.getTime() + 3 * 3600_000));
}
function shift(day: string, amount: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return isoDay(d);
}
function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !Number.isNaN(Date.parse(day)) &&
    isoDay(new Date(`${day}T00:00:00Z`)) === day
  );
}
export function reportPeriod(
  range: ReportSearch["range"],
  customFrom = "",
  customTo = "",
  now = new Date(),
): ReportPeriod {
  const today = nairobiDay(now);
  let start = today,
    end = shift(today, 1);
  const month = `${today.slice(0, 7)}-01`;
  if (range === "yesterday") {
    start = shift(today, -1);
    end = today;
  }
  if (range === "last7") start = shift(today, -6);
  if (range === "last30") start = shift(today, -29);
  if (range === "month") start = month;
  if (range === "lastmonth") {
    end = month;
    start = `${shift(month, -1).slice(0, 7)}-01`;
  }
  if (range === "year") start = `${today.slice(0, 4)}-01-01`;
  if (range === "custom" && validDay(customFrom) && validDay(customTo) && customFrom <= customTo) {
    start = customFrom;
    end = shift(customTo, 1);
  }
  const days = (Date.parse(end) - Date.parse(start)) / 86400_000;
  if (days > 3660) throw new Error("Choose a date range of ten years or less.");
  return {
    from: `${start}T00:00:00+03:00`,
    to: `${end}T00:00:00+03:00`,
    group: days > 180 ? "month" : days > 45 ? "week" : "day",
  };
}
export function stockStatus(quantity: number, threshold: number) {
  return quantity <= 0 ? "OUT" : quantity <= threshold ? "LOW" : "IN";
}
export const STOCK_LABELS: Record<string, string> = {
  ALL: "All stock",
  IN: "In stock",
  LOW: "Low stock",
  OUT: "Out of stock",
};
export const reportInputSchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  group: z.enum(["day", "week", "month"]),
  section: z.enum(REPORT_SECTIONS),
  search: z.string().max(120),
  category: z.string().max(120),
  stock: z.enum(["ALL", "IN", "LOW", "OUT"]),
  sort: z.enum(["revenue", "quantity"]),
  page: z.number().int().min(0).max(100000),
});
export type ReportInput = z.infer<typeof reportInputSchema>;
export interface ReportOverview {
  sales: {
    revenue: string;
    count: number;
    average: string;
    discounts: string;
    tax: string;
    pending: string;
    walk_in_count: number;
    walk_in_revenue: string;
  };
  inventory: {
    total: number;
    active: number;
    inactive: number;
    in_stock: number;
    low: number;
    out: number;
    estimated_value: string;
  };
  customers: { total: number; active: number; inactive: number; purchasing: number };
  trend: { date: string; revenue: string; count: number }[];
  payments: { method: string; status: string; count: number; amount: string; collected: string }[];
  categories: string[];
}
export type ReportRow = Record<string, string | number | boolean | null>;
export interface ReportPage {
  rows: ReportRow[];
  total: number;
}
