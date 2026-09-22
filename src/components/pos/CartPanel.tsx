import { useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CartLine, CartTotals, DiscountMode } from "@/components/pos/useCart";
import type { Product } from "@/lib/api/types";
import {
  formatMoneyCents,
  formatQuantity,
  lineTotalCents,
  toMilli,
} from "@/lib/money";

export function CartPanel({
  lines,
  totals,
  currency,
  productById,
  discountMode,
  discountInput,
  onDiscountModeChange,
  onDiscountInputChange,
  onQuantityChange,
  onRemove,
  onClear,
  onCheckout,
}: {
  lines: CartLine[];
  totals: CartTotals;
  currency: string;
  productById: (id: string) => Product | undefined;
  discountMode: DiscountMode;
  discountInput: string;
  onDiscountModeChange: (mode: DiscountMode) => void;
  onDiscountInputChange: (value: string) => void;
  onQuantityChange: (product: Product, quantityMilli: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
}) {
  return (
    <div className="surface-panel flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-4 text-primary" aria-hidden />
          <h2 className="text-base font-semibold">Current sale</h2>
        </div>
        {lines.length > 0 ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm">
                New sale
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear this cart?</AlertDialogTitle>
                <AlertDialogDescription>
                  The {lines.length} item{lines.length === 1 ? "" : "s"} in this cart will be
                  removed so you can start a new sale. Nothing has been sold yet, so your stock
                  stays exactly as it is.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep cart</AlertDialogCancel>
                <AlertDialogAction onClick={onClear}>Clear cart</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-secondary">
            <ShoppingCart className="size-5 text-primary" aria-hidden />
          </span>
          <p className="text-sm font-semibold">Your cart is empty</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Search for a product or pick one from the list to begin a sale.
          </p>
        </div>
      ) : (
        <ul className="flex-1 space-y-3 overflow-y-auto">
          {lines.map((line) => {
            const product = productById(line.productId);
            const lineTotal = lineTotalCents(line.quantityMilli, line.unitPriceCents);
            return (
              <li key={line.productId} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {line.sku ?? "No SKU"} · {formatMoneyCents(line.unitPriceCents, currency)} per{" "}
                      {line.unit}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${line.name} from the sale`}
                    onClick={() => onRemove(line.productId)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <QuantityControl
                    line={line}
                    product={product}
                    onQuantityChange={onQuantityChange}
                  />
                  <span className="text-sm font-semibold">
                    {formatMoneyCents(lineTotal, currency)}
                  </span>
                </div>
                {product ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatQuantity(line.quantityMilli)} {line.unit} ·{" "}
                    {product.stock_quantity} {product.unit} available
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <Select
            value={discountMode}
            onValueChange={(value) => onDiscountModeChange(value as DiscountMode)}
          >
            <SelectTrigger className="w-36" aria-label="Discount type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="amount">Discount {currency}</SelectItem>
              <SelectItem value="percent">Discount %</SelectItem>
            </SelectContent>
          </Select>
          <Input
            className="flex-1"
            inputMode="decimal"
            placeholder="0"
            aria-label="Discount value"
            value={discountInput}
            disabled={lines.length === 0}
            onChange={(event) => onDiscountInputChange(event.target.value)}
          />
        </div>

        <dl className="space-y-1.5 text-sm">
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

        <Button
          size="lg"
          className="w-full"
          disabled={lines.length === 0}
          onClick={onCheckout}
        >
          Checkout
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Nothing is recorded until you confirm the payment.
        </p>
      </div>
    </div>
  );
}

function QuantityControl({
  line,
  product,
  onQuantityChange,
}: {
  line: CartLine;
  product: Product | undefined;
  onQuantityChange: (product: Product, quantityMilli: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const step = toMilli(1);

  if (!product) {
    return <span className="text-sm text-muted-foreground">{formatQuantity(line.quantityMilli)}</span>;
  }

  const commit = (value: string) => {
    setDraft(null);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onQuantityChange(product, toMilli(parsed));
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        aria-label={`Reduce quantity of ${line.name}`}
        onClick={() => onQuantityChange(product, Math.max(line.quantityMilli - step, 0))}
      >
        <Minus className="size-4" aria-hidden />
      </Button>
      <Input
        className="h-9 w-20 text-center"
        inputMode="decimal"
        aria-label={`Quantity of ${line.name}`}
        value={draft ?? formatQuantity(line.quantityMilli)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit((event.target as HTMLInputElement).value);
          }
        }}
      />
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        aria-label={`Increase quantity of ${line.name}`}
        onClick={() => onQuantityChange(product, line.quantityMilli + step)}
      >
        <Plus className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
