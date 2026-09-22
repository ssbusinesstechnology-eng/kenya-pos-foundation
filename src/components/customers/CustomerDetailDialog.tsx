/**
 * One customer, with what they have bought. The purchase list reuses the sales
 * list shape, and opening a sale hands off to the existing sale detail view.
 */
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/common/StateViews";
import { customerKeys, fetchCustomer, fetchCustomerSales } from "@/lib/api/customers";
import {
  PAYMENT_METHOD_LABELS,
  SALE_STATUS_LABELS,
  type Customer,
  type SaleStatus,
} from "@/lib/api/types";
import { formatMoneyCents, toCents } from "@/lib/money";

export function CustomerDetailDialog({
  customerId,
  currency,
  onOpenChange,
  onEdit,
  onOpenSale,
}: {
  customerId: string | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
  onEdit: (customer: Customer) => void;
  onOpenSale: (saleId: string) => void;
}) {
  const customer = useQuery({
    queryKey: customerKeys.detail(customerId ?? "none"),
    queryFn: () => fetchCustomer(customerId as string),
    enabled: Boolean(customerId),
  });

  const sales = useQuery({
    queryKey: customerKeys.sales(customerId ?? "none"),
    queryFn: () => fetchCustomerSales(customerId as string),
    enabled: Boolean(customerId),
  });

  return (
    <Dialog open={Boolean(customerId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{customer.data?.name ?? "Customer"}</DialogTitle>
          <DialogDescription>
            {customer.data
              ? `Added ${new Date(customer.data.created_at).toLocaleDateString("en-KE")}`
              : "Loading this customer…"}
          </DialogDescription>
        </DialogHeader>

        {customer.isPending ? (
          <LoadingState label="Loading this customer…" />
        ) : customer.isError ? (
          <ErrorState
            title="We couldn't load that customer"
            message={customer.error instanceof Error ? customer.error.message : undefined}
            onRetry={() => void customer.refetch()}
          />
        ) : !customer.data ? (
          <p className="text-sm text-muted-foreground">That customer is no longer available.</p>
        ) : (
          <div className="space-y-4">
            <Badge variant={customer.data.is_active ? "secondary" : "outline"}>
              {customer.data.is_active ? "Active" : "Inactive"}
            </Badge>

            <dl className="space-y-1.5 rounded-xl border border-border p-3 text-sm">
              {customer.data.phone ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{customer.data.phone}</dd>
                </div>
              ) : null}
              {customer.data.email ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="truncate">{customer.data.email}</dd>
                </div>
              ) : null}
              {customer.data.address ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Address</dt>
                  <dd className="text-right">{customer.data.address}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Added</dt>
                <dd>{new Date(customer.data.created_at).toLocaleString("en-KE")}</dd>
              </div>
            </dl>

            {customer.data.notes ? (
              <p className="rounded-lg bg-secondary px-3 py-2 text-sm">{customer.data.notes}</p>
            ) : null}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Purchase history</h3>
              {sales.isPending ? (
                <LoadingState label="Loading purchases…" />
              ) : sales.isError ? (
                <ErrorState
                  title="We couldn't load these purchases"
                  message={sales.error instanceof Error ? sales.error.message : undefined}
                  onRetry={() => void sales.refetch()}
                />
              ) : (sales.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No purchases recorded for this customer yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(sales.data ?? []).map((sale) => {
                    const payment = sale.payments[0];
                    return (
                      <li key={sale.id}>
                        <button
                          type="button"
                          onClick={() => onOpenSale(sale.id)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left text-sm transition hover:border-primary/50"
                        >
                          <span className="min-w-0">
                            <span className="block font-medium">{sale.sale_number}</span>
                            <span className="block text-xs text-muted-foreground">
                              {new Date(sale.created_at).toLocaleString("en-KE")}
                              {payment ? ` · ${PAYMENT_METHOD_LABELS[payment.payment_method]}` : ""}
                              {` · ${SALE_STATUS_LABELS[sale.sale_status as SaleStatus] ?? sale.sale_status}`}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold">
                            {formatMoneyCents(toCents(Number(sale.total_amount)), currency)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}

        {customer.data ? (
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => onEdit(customer.data as Customer)}>
              <Pencil className="size-4" aria-hidden />
              Edit customer
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
