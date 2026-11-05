import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/StateViews";
import { reportMoney } from "./ReportMetrics";
import type { ReportOverview } from "@/lib/reports";
const config = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  count: { label: "Sales", color: "var(--chart-4)" },
};
export function ReportCharts({
  data,
  currency,
  group,
}: {
  data: ReportOverview;
  currency: string;
  group: string;
}) {
  const [mode, setMode] = useState("revenue");
  const rows = data.trend.map((row) => ({
    ...row,
    revenue: Number(row.revenue),
    label: new Date(`${row.date}T00:00:00Z`).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }),
  }));
  const grid = <CartesianGrid vertical={false} stroke="var(--border)" />;
  return (
    <section className="space-y-4 border-b pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Sales trend</h2>
          <p className="text-xs text-muted-foreground">
            {group === "day" ? "Daily" : group === "week" ? "Weekly" : "Monthly"} · Nairobi time
          </p>
        </div>
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList aria-label="Trend measure">
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="count">Sales volume</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {data.sales.count === 0 ? (
        <EmptyState
          title="No completed sales in this period"
          message="Sales and service transactions will appear here when recorded."
        />
      ) : (
        <ChartContainer config={config} className="h-72 w-full aspect-auto">
          {mode === "revenue" ? (
            <AreaChart
              accessibilityLayer
              data={rows}
              margin={{ left: 0, right: 12, top: 12, bottom: 0 }}
            >
              {grid}
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={70}
                tickFormatter={(value) => Number(value).toLocaleString("en-KE")}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={(value) => reportMoney(value, currency)} />
                }
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                fill="var(--color-revenue)"
                fillOpacity={0.1}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
            <BarChart accessibilityLayer data={rows}>
              {grid}
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={3} isAnimationActive={false} />
            </BarChart>
          )}
        </ChartContainer>
      )}
    </section>
  );
}
