import { Banknote, Receipt, TrendingUp, Package, Users, Wallet } from "lucide-react";
import { formatMoneyCents, toCents } from "@/lib/money";
import type { ReportOverview } from "@/lib/reports";

export function reportMoney(value: unknown, currency = "KES") { return formatMoneyCents(toCents(Number(value ?? 0)), currency); }
export function ReportMetrics({ data, currency = "KES" }: { data: ReportOverview; currency?: string }) {
  const metrics = [
    { label: "Completed sales revenue", value: reportMoney(data.sales.revenue, currency), Icon: Banknote, tone: "text-primary" },
    { label: "Completed sales", value: data.sales.count.toLocaleString(), Icon: Receipt, tone: "text-primary" },
    { label: "Average sale", value: reportMoney(data.sales.average, currency), Icon: TrendingUp, tone: "text-chart-4" },
    { label: "Discounts", value: reportMoney(data.sales.discounts, currency), Icon: Wallet, tone: "text-chart-2" },
    { label: "Tax", value: Number(data.sales.tax) ? reportMoney(data.sales.tax, currency) : "Not applied", Icon: Receipt, tone: "text-muted-foreground" },
  ];
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(({ label, value, Icon, tone }) => <div key={label} className="rounded-lg border bg-card p-4"><Icon className={`mb-3 size-4 ${tone}`} aria-hidden /><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words font-display text-xl font-semibold tabular-nums">{value}</p></div>)}</div>;
}
export function InventoryMetrics({ data, currency }: { data: ReportOverview; currency: string }) {
  return <div className="space-y-4"><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{[["Total products",data.inventory.total],["Active",data.inventory.active],["Inactive",data.inventory.inactive],["In stock",data.inventory.in_stock],["Low stock",data.inventory.low],["Out of stock",data.inventory.out]].map(([label,value]) => <div key={label} className="rounded-lg border bg-card p-4"><Package className="mb-2 size-4 text-primary"/><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>)}</div><p className="text-sm text-muted-foreground">Estimated inventory value at cost: <strong className="text-foreground">{reportMoney(data.inventory.estimated_value,currency)}</strong> · Current stock, not revenue or profit.</p></div>;
}
export function CustomerMetrics({ data }: { data: ReportOverview }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Total customers",data.customers.total],["Active",data.customers.active],["Inactive",data.customers.inactive],["Customers with purchases",data.customers.purchasing]].map(([label,value])=><div key={label} className="rounded-lg border bg-card p-4"><Users className="mb-2 size-4 text-chart-4"/><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div>;
}