import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Receipt, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common/StateViews";
import { SaleDetailDialog } from "@/components/sales/SaleDetailDialog";
import { fetchSalesPage, saleKeys } from "@/lib/api/sales";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  SALE_STATUS_LABELS,
  type DatePreset,
  type PaymentMethod,
  type PaymentStatus,
  type SaleStatus,
  type SalesQuery,
} from "@/lib/api/types";
import { useAccount } from "@/lib/api/useAccount";
import { formatMoneyCents, toCents } from "@/lib/money";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_authenticated/sales-history")({
  head: () => ({
    meta: [
      { title: "Sales history · S&S POS" },
      {
        name: "description",
        content:
          "Every completed sale with its reference, payment method and printable receipt, newest first.",
      },
      { property: "og:title", content: "Sales history · S&S POS" },
      {
        property: "og:description",
        content:
          "Every completed sale with its reference, payment method and printable receipt, newest first.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalesHistoryPage,
});

function startOfDay(offsetDays = 0): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date;
}

function presetBounds(
  preset: DatePreset,
  customFrom: string,
  customTo: string,
): { from: string | null; to: string | null } {
  switch (preset) {
    case "today":
      return { from: startOfDay().toISOString(), to: startOfDay(1).toISOString() };
    case "yesterday":
      return { from: startOfDay(-1).toISOString(), to: startOfDay().toISOString() };
    case "last7":
      return { from: startOfDay(-6).toISOString(), to: startOfDay(1).toISOString() };
    case "last30":
      return { from: startOfDay(-29).toISOString(), to: startOfDay(1).toISOString() };
    case "custom": {
      const from = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
      const toDate = customTo ? new Date(`${customTo}T00:00:00`) : null;
      if (toDate) toDate.setDate(toDate.getDate() + 1);
      return {
        from: from ? from.toISOString() : null,
        to: toDate ? toDate.toISOString() : null,
      };
    }
    default:
      return { from: null, to: null };
  }
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
  const today = startOfDay();
  const yesterday = startOfDay(-1);
  if (date >= today) return `Today, ${time}`;
  if (date >= yesterday) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}, ${time}`;
}

function SalesHistoryPage() {
  const { data: account } = useAccount();
  const currency = account?.business?.currency ?? "KES";

  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "ALL">("ALL");
  const [saleStatus, setSaleStatus] = useState<SaleStatus | "ALL">("ALL");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);

  const bounds = useMemo(
    () => presetBounds(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const query: SalesQuery = {
    search: search.trim(),
    from: bounds.from,
    to: bounds.to,
    paymentMethod,
    saleStatus,
    paymentStatus,
    page,
    pageSize: PAGE_SIZE,
  };

  const sales = useQuery({
    queryKey: saleKeys.list(query),
    queryFn: () => fetchSalesPage(query),
    placeholderData: keepPreviousData,
  });

  const filtersActive =
    search.trim() !== "" ||
    preset !== "all" ||
    paymentMethod !== "ALL" ||
    saleStatus !== "ALL" ||
    paymentStatus !== "ALL";

  function resetFilters() {
    setSearch("");
    setPreset("all");
    setCustomFrom("");
    setCustomTo("");
    setPaymentMethod("ALL");
    setSaleStatus("ALL");
    setPaymentStatus("ALL");
    setPage(0);
  }

  const rows = sales.data?.rows ?? [];
  const total = sales.data?.total ?? 0;
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = page * PAGE_SIZE + rows.length;
  const hasNext = showingTo < total;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales history"
        description="Every completed sale, newest first. Open a sale to see its items and print a receipt. Sales can't be edited or deleted here."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void sales.refetch()} disabled={sales.isFetching}>
              <RefreshCw
                className={`size-4 ${sales.isFetching ? "animate-spin" : ""}`}
                aria-hidden
              />
              Refresh
            </Button>
            <Button asChild>
              <Link to="/sales">New sale</Link>
            </Button>
          </div>
        }
      />

      <div className="surface-panel space-y-4 p-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Search by sale reference or payment reference"
            aria-label="Search sales"
            className="pl-9"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Date</span>
            <Select
              value={preset}
              onValueChange={(value) => {
                setPreset(value as DatePreset);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last7">Last 7 days</SelectItem>
                <SelectItem value="last30">Last 30 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Payment method</span>
            <Select
              value={paymentMethod}
              onValueChange={(value) => {
                setPaymentMethod(value as PaymentMethod | "ALL");
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All methods</SelectItem>
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                  <SelectItem key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Sale status</span>
            <Select
              value={saleStatus}
              onValueChange={(value) => {
                setSaleStatus(value as SaleStatus | "ALL");
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All sales</SelectItem>
                {(Object.keys(SALE_STATUS_LABELS) as SaleStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {SALE_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Payment status</span>
            <Select
              value={paymentStatus}
              onValueChange={(value) => {
                setPaymentStatus(value as PaymentStatus | "ALL");
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All payments</SelectItem>
                {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {PAYMENT_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        {preset === "custom" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:max-w-md">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">From</span>
              <Input
                type="date"
                value={customFrom}
                onChange={(event) => {
                  setCustomFrom(event.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">To</span>
              <Input
                type="date"
                value={customTo}
                onChange={(event) => {
                  setCustomTo(event.target.value);
                  setPage(0);
                }}
              />
            </label>
          </div>
        ) : null}

        {filtersActive ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <SlidersHorizontal className="size-3.5" aria-hidden />
            <span>Filters applied</span>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </div>

      {sales.isPending ? (
        <LoadingState label="Loading your sales…" />
      ) : sales.isError ? (
        <ErrorState
          title="We couldn't load your sales"
          message={sales.error instanceof Error ? sales.error.message : undefined}
          onRetry={() => void sales.refetch()}
        />
      ) : rows.length === 0 ? (
        filtersActive ? (
          <EmptyState
            title="No sales found."
            message="Nothing matches those filters. Clear them to see all sales."
            icon={<Search className="size-5 text-primary" aria-hidden />}
            action={
              <Button variant="outline" onClick={resetFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No sales yet."
            message="Completed sales will appear here."
            icon={<Receipt className="size-5 text-primary" aria-hidden />}
            action={
              <Button asChild>
                <Link to="/sales">Go to point of sale</Link>
              </Button>
            }
          />
        )
      ) : (
        <div className="surface-panel overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale</TableHead>
                  <TableHead>Date &amp; time</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Payment status</TableHead>
                  <TableHead>Sale status</TableHead>
                  <TableHead>Recorded by</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const payment = row.payments[0];
                  const staff =
                    row.creator?.full_name ??
                    (row.created_by && row.created_by === account?.userId
                      ? (account?.profile.full_name ?? "You")
                      : "—");
                  return (
                    <TableRow
                      key={row.id}
                      onClick={() => setOpenSaleId(row.id)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium">{row.sale_number}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatWhen(row.created_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-semibold">
                        {formatMoneyCents(toCents(Number(row.total_amount)), currency)}
                      </TableCell>
                      <TableCell>
                        {payment ? PAYMENT_METHOD_LABELS[payment.payment_method] : "—"}
                        {payment?.reference ? (
                          <span className="block text-xs text-muted-foreground">
                            {payment.reference}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {PAYMENT_STATUS_LABELS[row.payment_status as PaymentStatus] ??
                            row.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {SALE_STATUS_LABELS[row.sale_status as SaleStatus] ?? row.sale_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{staff}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenSaleId(row.id);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {showingFrom}–{showingTo} of {sales.data?.capped ? `${total}+` : total} sales
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={page === 0 || sales.isFetching}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => current + 1)}
                disabled={!hasNext || sales.isFetching}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <SaleDetailDialog
        saleId={openSaleId}
        currency={currency}
        onOpenChange={(open) => {
          if (!open) setOpenSaleId(null);
        }}
      />
    </div>
  );
}
