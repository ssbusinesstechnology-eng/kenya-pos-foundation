import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { dashboardReportOptions } from "@/lib/api/reports.functions";
import { reportSearchSchema } from "@/lib/reports";
import { reportMoney } from "./ReportMetrics";
export function DashboardSummary({ currency }: { currency: string }) {
  const { data } = useSuspenseQuery(dashboardReportOptions());
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Business today</h2>
        <Link
          to="/reports"
          search={reportSearchSchema.parse({})}
          className="text-sm font-medium text-primary"
        >
          View reports →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Today's sales", reportMoney(data.today.sales.revenue, currency)],
          ["This month's sales", reportMoney(data.month.sales.revenue, currency)],
          ["Transactions today", data.today.sales.count],
          ["Low-stock alerts", data.today.inventory.low + data.today.inventory.out],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 break-words text-xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
