import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/StateViews";
import { STOCK_LABELS, type ReportPage, type ReportRow, type ReportSection } from "@/lib/reports";
import { MOVEMENT_LABELS, type MovementType } from "@/lib/api/types";
import { reportMoney } from "./ReportMetrics";

const columns: Record<string, [string, string][]> = {
  top: [
    ["name", "Product (as sold)"],
    ["sku", "SKU"],
    ["quantity", "Qty sold"],
    ["unit", "Unit"],
    ["revenue", "Item revenue"],
    ["transactions", "Transactions"],
  ],
  performance: [
    ["name", "Product"],
    ["sku", "SKU"],
    ["category", "Category"],
    ["quantity", "Qty sold"],
    ["revenue", "Item revenue"],
    ["transactions", "Sales"],
    ["current_stock", "Current stock"],
    ["threshold", "Alert at"],
    ["stock", "Stock status"],
  ],
  inventory: [
    ["name", "Product"],
    ["sku", "SKU"],
    ["category", "Category"],
    ["current_stock", "Current qty"],
    ["unit", "Unit"],
    ["cost", "Cost price"],
    ["price", "Selling price"],
    ["stock", "Stock status"],
  ],
  movements: [
    ["name", "Product"],
    ["type", "Movement"],
    ["change", "Change"],
    ["before", "Before"],
    ["after", "After"],
    ["reason", "Reason"],
    ["staff", "Recorded by"],
    ["date", "Date / time"],
  ],
  customers: [
    ["name", "Customer"],
    ["phone", "Phone"],
    ["active", "Status"],
    ["transactions", "Completed purchases"],
    ["revenue", "Sales value"],
  ],
  transactions: [
    ["name", "Sale"],
    ["date", "Date / time"],
    ["customer", "Customer"],
    ["revenue", "Total"],
    ["method", "Payment"],
    ["payment_status", "Payment status"],
    ["status", "Sale status"],
  ],
};
function value(row: ReportRow, key: string, currency: string) {
  if (["revenue", "price", "cost"].includes(key)) return reportMoney(row[key], currency);
  if (key === "date")
    return new Date(String(row[key])).toLocaleString("en-KE", {
      timeZone: "Africa/Nairobi",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  if (key === "stock")
    return (
      <Badge variant={row[key] === "IN" ? "secondary" : "outline"}>
        {STOCK_LABELS[String(row[key])]}
      </Badge>
    );
  if (key === "active") return <Badge variant="outline">{row[key] ? "Active" : "Inactive"}</Badge>;
  if (key === "type") return MOVEMENT_LABELS[String(row[key]) as MovementType] ?? String(row[key]);
  return row[key] === null || row[key] === "" ? "—" : String(row[key] ?? "—");
}
export function ReportTable({
  section,
  data,
  page,
  currency,
  onPage,
  onOpenSale,
}: {
  section: ReportSection;
  data: ReportPage;
  page: number;
  currency: string;
  onPage: (page: number) => void;
  onOpenSale: (id: string) => void;
}) {
  const fields = columns[section] ?? [];
  if (!data.rows.length)
    return (
      <EmptyState
        title={
          page > 0
            ? "No more results"
            : section === "customers"
              ? "No customer activity found"
              : section === "inventory" || section === "performance"
                ? "No products found"
                : "No records in this period"
        }
        message={
          section === "inventory" || section === "performance"
            ? "Sales, payments and customer reports remain available for service-based businesses."
            : "Try a different date range or clear your search."
        }
        action={
          page > 0 ? (
            <Button variant="outline" onClick={() => onPage(0)}>
              First page
            </Button>
          ) : undefined
        }
      />
    );
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {fields.map(([key, label]) => (
                <TableHead key={key} className="whitespace-nowrap">
                  {label}
                </TableHead>
              ))}
              {section === "transactions" ? (
                <TableHead>
                  <span className="sr-only">View sale</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row, i) => (
              <TableRow key={`${row["id"]}-${row["name"]}-${i}`}>
                {fields.map(([key]) => (
                  <TableCell
                    key={key}
                    className={
                      key === "name" || key === "reason"
                        ? "min-w-40"
                        : "whitespace-nowrap tabular-nums"
                    }
                  >
                    {value(row, key, currency)}
                    {key === "name" && row["active"] === false && section !== "customers" ? (
                      <span className="ml-2 text-xs text-muted-foreground">Inactive</span>
                    ) : null}
                  </TableCell>
                ))}
                {section === "transactions" ? (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`View ${row["name"]}`}
                      onClick={() => onOpenSale(String(row["id"]))}
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {page * 20 + 1}–{Math.min((page + 1) * 20, data.total)} of {data.total}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * 20 >= data.total}
            onClick={() => onPage(page + 1)}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
