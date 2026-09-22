/**
 * Checkout: review → payment → confirm → success.
 * No sale exists until the database operation in checkoutSale() succeeds, and a
 * single request id makes a double-click impossible to turn into two sales.
 */
import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, CreditCard, Loader2, Smartphone, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/common/FormError";
import type { CartLine, CartTotals } from "@/components/pos/useCart";
import { checkoutSale } from "@/lib/api/sales";
import {
  PAYMENT_METHOD_LABELS,
  type CheckoutResult,
  type PaymentMethod,
} from "@/lib/api/types";
import {
  formatMoneyCents,
  formatQuantity,
  fromCents,
  fromMilli,
  lineTotalCents,
  toCents,
} from "@/lib/money";

type Step = "review" | "payment" | "success";

const METHODS: { value: PaymentMethod; icon: typeof Banknote; hint: string }[] = [
  { value: "CASH", icon: Banknote, hint: "Money in hand" },
  { value: "MPESA", icon: Smartphone, hint: "Transaction code required" },
  { value: "CARD", icon: CreditCard, hint: "No card details collected" },
  { value: "OTHER", icon: Wallet, hint: "Bank transfer, cheque…" },
];

export function CheckoutDialog({
  open,
  onOpenChange,
  lines,
  totals,
  currency,
  onCompleted,
  onViewSale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: CartLine[];
  totals: CartTotals;
  currency: string;
  onCompleted: () => void;
  onViewSale: (saleId: string) => void;
}) {
  const [step, setStep] = useState<Step>("review");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [cashInput, setCashInput] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [result, setResult] = useState<CheckoutResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("review");
    setMethod("CASH");
    setReference("");
    setCashInput("");
    setNotes("");
    setError(null);
    setProcessing(false);
    setResult(null);
    setRequestId(crypto.randomUUID());
  }, [open]);

  const cashCents = useMemo(() => {
    const parsed = Number(cashInput);
    if (cashInput.trim() === "" || !Number.isFinite(parsed) || parsed < 0) return null;
    return toCents(parsed);
  }, [cashInput]);

  const changeCents =
    method === "CASH" && cashCents !== null ? cashCents - totals.totalCents : null;

  async function confirm() {
    if (processing) return;
    setError(null);

    if (method === "MPESA" && reference.trim() === "") {
      setError("Enter the M-Pesa transaction code to record this payment.");
      return;
    }
    if (method === "CASH" && (cashCents === null || cashCents < totals.totalCents)) {
      setError("Enter the cash received — it can't be less than the total.");
      return;
    }

    setProcessing(true);
    try {
      const paymentAmountCents = method === "CASH" ? (cashCents ?? 0) : totals.totalCents;
      const checkout = await checkoutSale({
        items: lines.map((line) => ({
          product_id: line.productId,
          quantity: fromMilli(line.quantityMilli),
          unit_price: fromCents(line.unitPriceCents),
          discount_amount: 0,
        })),
        paymentMethod: method,
        paymentAmount: fromCents(paymentAmountCents),
        discountAmount: fromCents(totals.discountCents),
        clientRequestId: requestId,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setResult(checkout);
      setStep("success");
      onCompleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete the sale. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (processing) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        {step === "success" && result ? (
          <SuccessView
            result={result}
            currency={currency}
            onNewSale={() => onOpenChange(false)}
            onViewSale={() => {
              onOpenChange(false);
              onViewSale(result.sale_id);
            }}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{step === "review" ? "Review this sale" : "Take payment"}</DialogTitle>
              <DialogDescription>
                {step === "review"
                  ? "Check the items and total before taking payment. Nothing is recorded yet."
                  : "Choose how the customer is paying. The sale is recorded only when you confirm."}
              </DialogDescription>
            </DialogHeader>

            {step === "review" ? (
              <div className="space-y-3">
                <ul className="space-y-2">
                  {lines.map((line) => (
                    <li
                      key={line.productId}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{line.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatQuantity(line.quantityMilli)} {line.unit} ×{" "}
                          {formatMoneyCents(line.unitPriceCents, currency)}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold">
                        {formatMoneyCents(
                          lineTotalCents(line.quantityMilli, line.unitPriceCents),
                          currency,
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <Totals totals={totals} currency={currency} />
              </div>
            ) : (
              <div className="space-y-4">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Payment method</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {METHODS.map((entry) => {
                      const Icon = entry.icon;
                      const active = method === entry.value;
                      return (
                        <button
                          key={entry.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setMethod(entry.value);
                            setError(null);
                          }}
                          className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition ${
                            active
                              ? "border-primary bg-secondary"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <Icon className="size-4 text-primary" aria-hidden />
                            {PAYMENT_METHOD_LABELS[entry.value]}
                          </span>
                          <span className="text-xs text-muted-foreground">{entry.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {method === "CASH" ? (
                  <div className="space-y-2">
                    <Label htmlFor="cash-received">Cash received ({currency})</Label>
                    <Input
                      id="cash-received"
                      inputMode="decimal"
                      placeholder={String(fromCents(totals.totalCents))}
                      value={cashInput}
                      onChange={(event) => setCashInput(event.target.value)}
                    />
                    {changeCents !== null && changeCents >= 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Change due:{" "}
                        <span className="font-semibold text-foreground">
                          {formatMoneyCents(changeCents, currency)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {method === "MPESA" ? (
                  <div className="space-y-2">
                    <Label htmlFor="mpesa-reference">M-Pesa transaction code</Label>
                    <Input
                      id="mpesa-reference"
                      placeholder="e.g. SFH4K9T2QX"
                      autoComplete="off"
                      value={reference}
                      onChange={(event) => setReference(event.target.value.toUpperCase())}
                    />
                    <p className="text-xs text-muted-foreground">
                      Recorded manually — no phone number or PIN is needed or stored.
                    </p>
                  </div>
                ) : null}

                {method === "CARD" ? (
                  <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
                    Recorded as a card payment. Card numbers, expiry dates and PINs are never
                    collected.
                  </p>
                ) : null}

                {method === "OTHER" ? (
                  <div className="space-y-2">
                    <Label htmlFor="other-reference">Reference (optional)</Label>
                    <Input
                      id="other-reference"
                      placeholder="Bank slip or cheque number"
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="sale-notes">Note (optional)</Label>
                  <Textarea
                    id="sale-notes"
                    rows={2}
                    placeholder="Anything worth remembering about this sale"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>

                <Totals totals={totals} currency={currency} />
              </div>
            )}

            <FormError message={error} />

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                variant="outline"
                disabled={processing}
                onClick={() => (step === "review" ? onOpenChange(false) : setStep("review"))}
              >
                {step === "review" ? "Back to cart" : "Back to review"}
              </Button>
              {step === "review" ? (
                <Button onClick={() => setStep("payment")}>Continue to payment</Button>
              ) : (
                <Button onClick={() => void confirm()} disabled={processing}>
                  {processing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Processing sale…
                    </>
                  ) : (
                    `Confirm ${formatMoneyCents(totals.totalCents, currency)}`
                  )}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Totals({ totals, currency }: { totals: CartTotals; currency: string }) {
  return (
    <dl className="space-y-1.5 rounded-xl border border-border p-3 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd>{formatMoneyCents(totals.subtotalCents, currency)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Discount</dt>
        <dd>−{formatMoneyCents(totals.discountCents, currency)}</dd>
      </div>
      <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
        <dt>Total</dt>
        <dd>{formatMoneyCents(totals.totalCents, currency)}</dd>
      </div>
    </dl>
  );
}

function SuccessView({
  result,
  currency,
  onNewSale,
  onViewSale,
}: {
  result: CheckoutResult;
  currency: string;
  onNewSale: () => void;
  onViewSale: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-primary" aria-hidden />
          Sale completed
        </DialogTitle>
        <DialogDescription>
          Stock has been updated and the payment is recorded.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2 rounded-xl border border-border p-4">
        <p className="text-lg font-semibold">{result.sale_number}</p>
        <p className="text-2xl font-semibold">
          {formatMoneyCents(toCents(Number(result.total_amount)), currency)}
        </p>
        <p className="text-sm text-muted-foreground">
          Paid with {PAYMENT_METHOD_LABELS[result.payment_method]} ·{" "}
          {new Date(result.created_at).toLocaleString("en-KE")}
        </p>
      </div>
      <DialogFooter className="gap-2 sm:justify-between">
        <Button variant="outline" onClick={onViewSale}>
          View sale
        </Button>
        <Button onClick={onNewSale}>New sale</Button>
      </DialogFooter>
    </>
  );
}
