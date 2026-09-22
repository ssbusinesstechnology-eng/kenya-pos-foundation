/**
 * Print-friendly receipt. Everything shown comes from what was stored with the
 * sale (snapshots + stored totals) and from the business record — nothing is
 * recalculated from today's product prices, and nothing is invented.
 */
import type { Business, SaleDetail } from "@/lib/api/types";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/api/types";
import { formatMoneyCents, formatQuantity, toCents, toMilli } from "@/lib/money";

function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status as PaymentStatus] ?? status;
}

export function SaleReceipt({
  sale,
  business,
  cashierName,
}: {
  sale: SaleDetail;
  business: Business | null;
  cashierName: string | null;
}) {
  const currency = business?.currency ?? "KES";
  const created = new Date(sale.created_at);
  const taxCents = toCents(Number(sale.tax_amount));
  const discountCents = toCents(Number(sale.discount_amount));

  return (
    <div
      id="receipt-print"
      className="mx-auto w-full max-w-sm rounded-xl border border-border bg-card p-5 text-sm"
    >
      <header className="border-b border-border pb-3 text-center">
        <h2 className="text-lg font-semibold tracking-tight">{business?.name ?? "Receipt"}</h2>
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {business?.address ? <p>{business.address}</p> : null}
          {business?.contact_phone ? <p>{business.contact_phone}</p> : null}
          {business?.contact_email ? <p>{business.contact_email}</p> : null}
        </div>
      </header>

      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Receipt</dt>
          <dd className="font-medium">{sale.sale_number}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Date</dt>
          <dd>{created.toLocaleDateString("en-KE")}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Time</dt>
          <dd>{created.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</dd>
        </div>
        {cashierName ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Served by</dt>
            <dd>{cashierName}</dd>
          </div>
        ) : null}
      </dl>

      <table className="mt-4 w-full border-t border-border text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Price</th>
            <th className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.sale_items.map((item) => (
            <tr key={item.id} className="border-t border-border align-top">
              <td className="py-2 pr-2">
                <span className="block font-medium">{item.product_name}</span>
                {item.product_sku ? (
                  <span className="text-muted-foreground">{item.product_sku}</span>
                ) : null}
                {Number(item.discount_amount) > 0 ? (
                  <span className="block text-muted-foreground">
                    Less {formatMoneyCents(toCents(Number(item.discount_amount)), currency)}
                  </span>
                ) : null}
              </td>
              <td className="py-2 text-right">
                {formatQuantity(toMilli(Number(item.quantity)))} {item.unit}
              </td>
              <td className="py-2 text-right">
                {formatMoneyCents(toCents(Number(item.unit_price)), currency)}
              </td>
              <td className="py-2 text-right font-medium">
                {formatMoneyCents(toCents(Number(item.line_subtotal)), currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>{formatMoneyCents(toCents(Number(sale.subtotal)), currency)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Discount</dt>
          <dd>
            {discountCents > 0 ? "−" : ""}
            {formatMoneyCents(discountCents, currency)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Tax</dt>
          <dd>{taxCents > 0 ? formatMoneyCents(taxCents, currency) : "Not applied"}</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
          <dt>Total</dt>
          <dd>{formatMoneyCents(toCents(Number(sale.total_amount)), currency)}</dd>
        </div>
      </dl>

      <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
        {sale.payments.map((payment) => (
          <div key={payment.id} className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid via</span>
              <span>{PAYMENT_METHOD_LABELS[payment.payment_method]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount paid</span>
              <span>{formatMoneyCents(toCents(Number(payment.amount)), currency)}</span>
            </div>
            {payment.reference ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference</span>
                <span>{payment.reference}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span>{paymentStatusLabel(payment.payment_status)}</span>
            </div>
          </div>
        ))}
      </div>

      <footer className="mt-4 border-t border-border pt-3 text-center text-xs text-muted-foreground">
        <p>Thank you for your business.</p>
        {business?.receipt_footer ? <p className="mt-1">{business.receipt_footer}</p> : null}
      </footer>
    </div>
  );
}
