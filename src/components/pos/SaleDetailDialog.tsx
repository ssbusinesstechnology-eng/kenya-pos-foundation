/** Read-only look at one completed sale. Full sales history comes later. */
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingState } from "@/components/common/StateViews";
import { fetchSale, saleKeys } from "@/lib/api/sales";
import { PAYMENT_METHOD_LABELS } from "@/lib/api/types";
import { formatMoneyCents, toCents, toMilli, formatQuantity } from "@/lib/money";

export function SaleDetailDialog({
  saleId,
  currency,
  onOpenChange,
}: {
  saleId: string | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
}) {
  const sale = useQuery({
    queryKey: saleKeys.detail(saleId ?? "none"),
    queryFn: () => fetchSale(saleId as string),
    enabled: Boolean(saleId),
  });

  return (
    <Dialog open={Boolean(saleId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
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
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{sale.data.sale_status}</Badge>
              <Badge variant="outline">{sale.data.payment_status}</Badge>
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
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatMoneyCents(toCents(Number(sale.data.total_amount)), currency)}</dd>
              </div>
            </dl>

            {sale.data.payments.map((payment) => (
              <p key={payment.id} className="text-sm text-muted-foreground">
                Paid with {PAYMENT_METHOD_LABELS[payment.payment_method]} ·{" "}
                {formatMoneyCents(toCents(Number(payment.amount)), currency)}
                {payment.reference ? ` · Ref ${payment.reference}` : ""}
              </p>
            ))}

            {sale.data.notes ? (
              <p className="rounded-lg bg-secondary px-3 py-2 text-sm">{sale.data.notes}</p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
