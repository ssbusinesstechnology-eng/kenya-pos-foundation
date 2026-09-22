import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/common/FormError";
import {
  STOCK_IN_REASONS,
  STOCK_OUT_REASONS,
  type MovementType,
  type Product,
  type StockAdjustmentInput,
} from "@/lib/api/types";

type Direction = "in" | "out";

export function StockAdjustDialog({
  open,
  onOpenChange,
  products,
  product,
  onSubmit,
  isSaving,
  submitError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  product?: Product | undefined;
  onSubmit: (input: StockAdjustmentInput) => void;
  isSaving: boolean;
  submitError?: string | null | undefined;
}) {
  const [productId, setProductId] = useState("");
  const [direction, setDirection] = useState<Direction>("in");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  type FieldErrors = { product?: string; quantity?: string; reason?: string };
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setProductId(product?.id ?? "");
    setDirection("in");
    setQuantity("");
    setReason("");
    setNotes("");
  }, [open, product]);

  const selected = products.find((item) => item.id === productId);
  const reasons = direction === "in" ? STOCK_IN_REASONS : STOCK_OUT_REASONS;
  const quantityValue = Number(quantity);
  const projected =
    selected && Number.isFinite(quantityValue) && quantity.trim() !== ""
      ? selected.stock_quantity + (direction === "in" ? quantityValue : -quantityValue)
      : null;

  function submit() {
    const next: FieldErrors = {};
    if (!productId) next.product = "Please choose a product.";
    if (quantity.trim() === "") next.quantity = "Please enter a quantity.";
    else if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      next.quantity = "Enter a quantity greater than zero.";
    } else if (direction === "out" && selected && quantityValue > selected.stock_quantity) {
      next.quantity = `You only have ${selected.stock_quantity} ${selected.unit} in stock.`;
    }
    if (!reason) next.reason = "Please choose a reason.";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const movementType: MovementType =
      direction === "out"
        ? "ADJUSTMENT_OUT"
        : reason === "Restocking"
          ? "RESTOCK"
          : reason === "Initial stock"
            ? "INITIAL_STOCK"
            : "ADJUSTMENT_IN";

    onSubmit({
      productId,
      movementType,
      quantity: quantityValue,
      reason,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            Record stock coming in or going out. Every change is kept in your inventory history.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <FormError message={submitError ?? null} />

          <div className="space-y-2">
            <Label htmlFor="adj-product">
              Product<span className="ml-0.5 text-destructive">*</span>
            </Label>
            <Select value={productId} onValueChange={setProductId} disabled={Boolean(product)}>
              <SelectTrigger id="adj-product">
                <SelectValue placeholder="Choose a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                    {item.sku ? ` · ${item.sku}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.product ? <p className="text-xs text-destructive">{errors.product}</p> : null}
            {selected ? (
              <p className="text-xs text-muted-foreground">
                Currently in stock: {selected.stock_quantity} {selected.unit}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>
              What is happening?<span className="ml-0.5 text-destructive">*</span>
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <DirectionCard
                active={direction === "in"}
                title="Stock in"
                hint="Restock, initial stock or returns — stock increases."
                icon={<ArrowUpRight className="size-4" aria-hidden />}
                onSelect={() => {
                  setDirection("in");
                  setReason("");
                }}
              />
              <DirectionCard
                active={direction === "out"}
                title="Stock out"
                hint="Damaged, lost, expired or corrections — stock decreases."
                icon={<ArrowDownRight className="size-4" aria-hidden />}
                onSelect={() => {
                  setDirection("out");
                  setReason("");
                }}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="adj-qty">
                Quantity<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                id="adj-qty"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0"
              />
              {errors.quantity ? (
                <p className="text-xs text-destructive">{errors.quantity}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj-reason">
                Reason<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="adj-reason">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.reason ? <p className="text-xs text-destructive">{errors.reason}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-notes">Notes (optional)</Label>
            <Textarea
              id="adj-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything worth remembering about this change."
            />
          </div>

          {selected && projected !== null && projected >= 0 ? (
            <p className="rounded-lg bg-secondary px-3 py-2 text-sm">
              {direction === "in" ? "Stock will increase" : "Stock will decrease"} from{" "}
              <strong>
                {selected.stock_quantity} {selected.unit}
              </strong>{" "}
              to{" "}
              <strong>
                {projected} {selected.unit}
              </strong>
              .
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Save adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DirectionCard({
  active,
  title,
  hint,
  icon,
  onSelect,
}: {
  active: boolean;
  title: string;
  hint: string;
  icon: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`rounded-xl border p-3 text-left transition ${
        active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
