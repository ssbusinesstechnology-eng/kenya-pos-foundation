import { forwardRef } from "react";
import { Package, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Product } from "@/lib/api/types";
import { formatMoneyCents, toCents } from "@/lib/money";

export function stockState(product: Product): "out" | "low" | "ok" {
  if (product.stock_quantity <= 0) return "out";
  if (product.stock_quantity <= product.low_stock_threshold) return "low";
  return "ok";
}

export const PosSearchInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (value: string) => void;
    onEnter: () => void;
  }
>(function PosSearchInput({ value, onChange, onEnter }, ref) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={ref}
        className="h-12 pl-9 text-base"
        placeholder="Scan or search by product name or SKU"
        aria-label="Search products to sell"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onEnter();
          }
        }}
      />
    </div>
  );
});

export function ProductTile({
  product,
  inCartQuantity,
  currency,
  onSelect,
}: {
  product: Product;
  inCartQuantity: string | null;
  currency: string;
  onSelect: () => void;
}) {
  const state = stockState(product);
  const soldOut = state === "out";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={soldOut}
      aria-label={`Add ${product.name} to the sale`}
      className="group flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:shadow-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{product.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {product.sku ? product.sku : "No SKU"}
            {product.category ? ` · ${product.category}` : ""}
          </p>
        </div>
        {inCartQuantity ? (
          <Badge variant="secondary" className="shrink-0">
            {inCartQuantity} in cart
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-semibold">
          {formatMoneyCents(toCents(product.selling_price), currency)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">/ {product.unit}</span>
        </span>
        {soldOut ? (
          <Badge variant="destructive">Out of stock</Badge>
        ) : state === "low" ? (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            Low stock · {product.stock_quantity} {product.unit} available
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">
            {product.stock_quantity} {product.unit} in stock
          </span>
        )}
      </div>
    </button>
  );
}

export function ProductPickerIcon() {
  return <Package className="size-5 text-primary" aria-hidden />;
}
