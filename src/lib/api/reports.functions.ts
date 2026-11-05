import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reportInputSchema, type ReportInput, type ReportOverview, type ReportPage } from "@/lib/reports";
import { friendlyDataError } from "@/lib/errors";

export const getReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReportInput) => reportInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ overview: ReportOverview; detail: ReportPage }> => {
    // Security-invoker RPCs preserve each table's existing RLS.
    const client = context.supabase;
    const [summary, detail] = await Promise.all([
      client.rpc("report_overview", { p_from: data.from, p_to: data.to, p_group: data.group }),
      data.section === "overview" || data.section === "payments"
        ? Promise.resolve({ data: { rows: [], total: 0 }, error: null })
        : client.rpc("report_details", {
          p_from: data.from, p_to: data.to, p_section: data.section, p_search: data.search,
          p_category: data.category, p_stock: data.stock, p_sort: data.sort, p_page: data.page,
        }),
    ]);
    if (summary.error || detail.error) throw new Error(friendlyDataError(summary.error ?? detail.error));
    return { overview: summary.data as unknown as ReportOverview, detail: detail.data as unknown as ReportPage };
  });

export function reportsQueryOptions(input: ReportInput) {
  return queryOptions({ queryKey: ["reports", input], queryFn: () => getReports({ data: input }), staleTime: 30_000 });
}