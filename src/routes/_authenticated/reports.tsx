import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState, LoadingState, PageHeader } from "@/components/common/StateViews";
import { ReportMetrics, InventoryMetrics, CustomerMetrics, reportMoney } from "@/components/reports/ReportMetrics";
import { ReportCharts } from "@/components/reports/ReportCharts";
import { ReportTable } from "@/components/reports/ReportTable";
import { PaymentReport } from "@/components/reports/PaymentReport";
import { SaleDetailDialog } from "@/components/sales/SaleDetailDialog";
import { useAccount } from "@/lib/api/useAccount";
import { reportsQueryOptions } from "@/lib/api/reports.functions";
import { REPORT_RANGES, RANGE_LABELS, REPORT_SECTIONS, STOCK_LABELS, nairobiDay, reportPeriod, reportSearchSchema, type ReportSearch, type ReportSection } from "@/lib/reports";

const SECTION_LABELS: Record<ReportSection,string> = { overview:"Overview",top:"Top sellers",performance:"Product performance",inventory:"Inventory",movements:"Stock movements",payments:"Payments",customers:"Customers",transactions:"Transactions" };
function options(search: ReportSearch) { return reportsQueryOptions({ ...search, ...reportPeriod(search.range,search.from,search.to) }); }

export const Route = createFileRoute("/_authenticated/reports")({
  validateSearch: (search) => reportSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(options(deps)),
  pendingMs: 100,
  pendingComponent: () => <LoadingState label="Loading reports…" />,
  errorComponent: () => { const router=useRouter();return <ErrorState title="Reports couldn't load" message="Please try again. Your business records have not changed." onRetry={()=>void router.invalidate()}/>; },
  notFoundComponent: () => <ErrorState title="Report not found" />,
  head: () => ({
    meta: [
      { title: "Reports & Analytics · S&S Business Hub" },
      {
        name: "description",
        content: "Accurate sales, payment, customer and inventory reports for your business.",
      },
      { property: "og:title", content: "Reports & Analytics · S&S Business Hub" },
      {
        property: "og:description",
        content: "Accurate sales, payment, customer and inventory reports for your business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const search=Route.useSearch(); const navigate=Route.useNavigate();
  const {data,refetch,isFetching,isRefetchError}=useSuspenseQuery(options(search));
  const {data:account}=useAccount(); const currency=account?.business?.currency??"KES";
  const [saleId,setSaleId]=useState<string|null>(null);
  const period=reportPeriod(search.range,search.from,search.to);
  const update=(patch:Partial<ReportSearch>)=>void navigate({ search:prev=>({...prev,...patch,page:patch.page??0}) });
  const productFilters=search.section==="inventory"||search.section==="performance";
  return <div className="space-y-6"><PageHeader title="Reports & Analytics" description="Completed, paid sales at their recorded values. Collections are shown separately; inventory is current." action={<Button variant="outline" disabled={isFetching} onClick={()=>void refetch()}><RefreshCw className={`size-4 ${isFetching?"animate-spin":""}`}/>Refresh</Button>}/>
    <div className="flex flex-wrap items-end gap-3 border-b pb-5"><div className="space-y-1.5"><Label htmlFor="report-range">Date range</Label><Select value={search.range} onValueChange={value=>update(value==="custom"?{range:"custom",from:search.from||nairobiDay(),to:search.to||nairobiDay()}:{range:value as ReportSearch["range"]})}><SelectTrigger id="report-range" className="w-44"><SelectValue/></SelectTrigger><SelectContent>{REPORT_RANGES.map(range=><SelectItem key={range} value={range}>{RANGE_LABELS[range]}</SelectItem>)}</SelectContent></Select></div>{search.range==="custom"?<><div className="space-y-1.5"><Label htmlFor="report-from">From</Label><Input id="report-from" type="date" value={search.from} max={search.to||undefined} onChange={e=>update({from:e.target.value})}/></div><div className="space-y-1.5"><Label htmlFor="report-to">To</Label><Input id="report-to" type="date" value={search.to} min={search.from||undefined} onChange={e=>update({to:e.target.value})}/></div></>:null}<p className="pb-2 text-xs text-muted-foreground">{period.from.slice(0,10)} — {new Date(Date.parse(period.to)-86400_000+3*3600_000).toISOString().slice(0,10)} · Nairobi (UTC+3)</p></div>
    {isRefetchError?<ErrorState title="Refresh failed" message="These are the last loaded figures." onRetry={()=>void refetch()}/>:null}
    <ReportMetrics data={data.overview} currency={currency}/>
    <div className="overflow-x-auto border-b pb-2"><Tabs value={search.section} onValueChange={section=>update({section:section as ReportSection,search:"",category:"",stock:"ALL"})}><TabsList aria-label="Report sections" className="h-auto justify-start bg-transparent p-0">{REPORT_SECTIONS.map(section=><TabsTrigger key={section} value={section} className="px-3 py-2">{SECTION_LABELS[section]}</TabsTrigger>)}</TabsList></Tabs></div>
    {search.section==="overview"?<><ReportCharts data={data.overview} currency={currency} group={period.group}/><PaymentReport data={data.overview} currency={currency}/><div className="border-t pt-4 text-sm text-muted-foreground">Pending completed sales: {reportMoney(data.overview.sales.pending,currency)} · Walk-in: {data.overview.sales.walk_in_count} sales, {reportMoney(data.overview.sales.walk_in_revenue,currency)}</div></>:search.section==="payments"?<PaymentReport data={data.overview} currency={currency}/>:<section className="space-y-4"><div><h2 className="text-lg font-semibold">{SECTION_LABELS[search.section]}</h2>{search.section==="top"||search.section==="performance"?<p className="text-sm text-muted-foreground">Historical item revenue after line discounts, before sale-level discounts and tax. Stock and category are current.</p>:null}</div>{search.section==="inventory"?<InventoryMetrics data={data.overview} currency={currency}/>:null}{search.section==="customers"?<><CustomerMetrics data={data.overview}/><p className="text-sm text-muted-foreground">Walk-in: {data.overview.sales.walk_in_count} completed purchases · {reportMoney(data.overview.sales.walk_in_revenue,currency)}. Customer counts are current; purchases follow the selected dates.</p></>:null}<div className="flex flex-wrap gap-3"><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><Input aria-label="Search report" className="pl-9" value={search.search} placeholder={search.section==="customers"?"Search name or phone":search.section==="transactions"?"Search sale or customer":"Search product or SKU"} onChange={e=>update({search:e.target.value})}/></div>{productFilters?<><Select value={search.category||"__all"} onValueChange={value=>update({category:value==="__all"?"":value})}><SelectTrigger className="w-44" aria-label="Category"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="__all">All categories</SelectItem>{data.overview.categories.map(category=><SelectItem value={category} key={category}>{category}</SelectItem>)}</SelectContent></Select><Select value={search.stock} onValueChange={value=>update({stock:value as ReportSearch["stock"]})}><SelectTrigger className="w-40" aria-label="Stock status"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(STOCK_LABELS).map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></>:null}{search.section==="top"||search.section==="performance"?<Select value={search.sort} onValueChange={value=>update({sort:value as ReportSearch["sort"]})}><SelectTrigger className="w-44" aria-label="Sort products"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="revenue">Highest revenue</SelectItem><SelectItem value="quantity">Highest quantity</SelectItem></SelectContent></Select>:null}{search.search||search.category||search.stock!=="ALL"?<Button variant="ghost" onClick={()=>update({search:"",category:"",stock:"ALL"})}>Clear filters</Button>:null}</div><ReportTable section={search.section} data={data.detail} page={search.page} currency={currency} onPage={page=>update({page})} onOpenSale={setSaleId}/></section>}
    <SaleDetailDialog saleId={saleId} currency={currency} onOpenChange={open=>{if(!open)setSaleId(null);}}/>
  </div>;
}
