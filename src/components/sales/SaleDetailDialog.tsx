/**
 * Read-only view of one completed sale, plus its printable receipt.
 * All item and total values are the ones stored with the sale.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, ReceiptText } from "lucide-react";
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
import { SaleReceipt } from "@/components/sales/SaleReceipt";
import { fetchSale, saleKeys } from "@/lib/api/sales";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  SALE_STATUS_LABELS,
  type PaymentStatus,
  type SaleStatus,
} from "@/lib/api/types";
import { useAccount } from "@/lib/api/useAccount";
import { formatMoneyCents, formatQuantity, toCents, toMilli } from "@/lib/money";

export function SaleDetailDialog({
  saleId,
  currency,
  onOpenChange,
}: {
  saleId: string | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: account } = useAccount();
  const [showReceipt, setShowReceipt] = useState(false);

  const sale = useQuery({
    queryKey: saleKeys.detail(saleId ?? "none"),
    queryFn: () => fetchSale(saleId as string),
    enabled: Boolean(saleId),
  });

  useEffect(() => {
    if (!saleId) setShowReceipt(false);
  }, [saleId]);

  const staffName =
    sale.data?.creator?.full_name ??
    (sale.data?.created_by && sale.data.created_by === account?.userId
      ? (account?.profile.full_name ?? "You")
      : null);

  return (
    <Dialog open={Boolean(saleId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg print:max-w-none">
        <DialogHeader className="no-print">
          <DialogTitle>{sale.data?.sale_number ?? "Sale"}</DialogTitle>
          <DialogDescription>
            {sale.data
              ? new Date(sale.data.created_at).toLocaleString("en-KE")
              : "Loading this sale…"}
          </DialogDescription>
        </DialogHeader>

        {sale.isPending ? (
          <LoadingState label="Loading this sale…" />
        ) : sale.isError ? (
          <ErrorState
            title="We couldn't load that sale"
            message={sale.error instanceof Error ? sale.error.message : undefined}
            onRetry={() => void sale.refetch()}
          />
        ) : !sale.data ? (
          <p className="text-sm text-muted-foreground">That sale is no longer available.</p>
        ) : showReceipt ? (
          <>
            <SaleReceipt
              sale={sale.data}
              business={account?.business ?? null}
              cashierName={staffName}
            />
            <DialogFooter className="no-print gap-2 sm:justify-between">
              <Button variant="outline" onClick={() => setShowReceipt(false)}>
                Back to details
              </Button>
              <Button onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden />
                Print receipt
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {SALE_STATUS_LABELS[sale.data.sale_status as SaleStatus] ?? sale.data.sale_status}
              </Badge>
              <Badge variant="outline">
                {PAYMENT_STATUS_LABELS[sale.data.payment_status as PaymentStatus] ??
                  sale.data.payment_status}
              </Badge>
              {staffName ? (
                <span className="text-xs text-muted-foreground">Sold by {staffName}</span>
              ) : null}
            </div>

            <ul className="space-y-2">
              {sale.data.sale_items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.product_sku ?? "No SKU"} ·{" "}
                      {formatQuantity(toMilli(Number(item.quantity)))} {item.unit} ×{" "}
                      {formatMoneyCents(toCents(Number(item.unit_price)), currency)}
                    </p>
                    {Number(item.discount_amount) > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Line discount{" "}
                        {formatMoneyCents(toCents(Number(item.discount_amount)), currency)}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-semibold">
                    {formatMoneyCents(toCents(Number(item.line_subtotal)), currency)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="space-y-1.5 rounded-xl border border-border p-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatMoneyCents(toCents(Number(sale.data.subtotal)), currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount</dt>
                <dd>−{formatMoneyCents(toCents(Number(sale.data.discount_amount)), currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd>
                  {Number(sale.data.tax_amount) > 0
                    ? formatMoneyCents(toCents(Number(sale.data.tax_amount)), currency)
                    : "Not applied"}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatMoneyCents(toCents(Number(sale.data.total_amount)), currency)}</dd>
              </div>
            </dl>

            {sale.data.payments.map((payment) => (
              <dl key={payment.id} className="space-y-1 rounded-xl bg-secondary px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Payment method</dt>
                  <dd>{PAYMENT_METHOD_LABELS[payment.payment_method]}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd>{formatMoneyCents(toCents(Number(payment.amount)), currency)}</dd>
                </div>
                {payment.reference ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Reference</dt>
                    <dd>{payment.reference}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    {PAYMENT_STATUS_LABELS[payment.payment_status as PaymentStatus] ??
                      payment.payment_status}
                  </dd>
                </div>
              </dl>
            ))}

            {sale.data.notes ? (
              <p className="rounded-lg bg-secondary px-3 py-2 text-sm">{sale.data.notes}</p>
            ) : null}

            <DialogFooter className="gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setShowReceipt(true)}>
                <ReceiptText className="size-4" aria-hidden />
                View receipt
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
