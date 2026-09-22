import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { PRODUCT_UNITS, type Product, type ProductInput } from "@/lib/api/types";

type FormState = {
  name: string;
  sku: string;
  category: string;
  description: string;
  selling_price: string;
  cost_price: string;
  stock_quantity: string;
  low_stock_threshold: string;
  unit: string;
};

function emptyForm(defaultThreshold: number): FormState {
  return {
    name: "",
    sku: "",
    category: "",
    description: "",
    selling_price: "",
    cost_price: "",
    stock_quantity: "",
    low_stock_threshold: String(defaultThreshold),
    unit: "pc",
  };
}

function fromProduct(product: Product): FormState {
  return {
    name: product.name,
    sku: product.sku ?? "",
    category: product.category ?? "",
    description: product.description ?? "",
    selling_price: String(product.selling_price),
    cost_price: String(product.cost_price),
    stock_quantity: String(product.stock_quantity),
    low_stock_threshold: String(product.low_stock_threshold),
    unit: product.unit,
  };
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  categories,
  defaultThreshold,
  currency,
  existingSkus,
  onSubmit,
  isSaving,
  submitError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | undefined;
  categories: string[];
  defaultThreshold: number;
  currency: string;
  existingSkus: string[];
  onSubmit: (input: ProductInput) => void;
  isSaving: boolean;
  submitError?: string | null | undefined;
}) {
  const [form, setForm] = useState<FormState>(emptyForm(defaultThreshold));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(product ? fromProduct(product) : emptyForm(defaultThreshold));
  }, [open, product, defaultThreshold]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): ProductInput | null {
    const next: Partial<Record<keyof FormState, string>> = {};
    const name = form.name.trim();
    const sku = form.sku.trim();
    const selling = Number(form.selling_price);
    const cost = form.cost_price.trim() === "" ? 0 : Number(form.cost_price);
    const stock = form.stock_quantity.trim() === "" ? 0 : Number(form.stock_quantity);
    const threshold =
      form.low_stock_threshold.trim() === ""
        ? defaultThreshold
        : Number(form.low_stock_threshold);

    if (!name) next.name = "Please enter the product name.";
    if (!sku) next.sku = "Please enter a SKU or product code.";
    else if (
      existingSkus.some(
        (existing) => existing.toLowerCase() === sku.toLowerCase() && existing !== (product?.sku ?? ""),
      )
    ) {
      next.sku = "Another product already uses that SKU.";
    }
    if (form.selling_price.trim() === "" || !Number.isFinite(selling) || selling < 0) {
      next.selling_price = "Enter a selling price of 0 or more.";
    }
    if (!Number.isFinite(cost) || cost < 0) next.cost_price = "Enter a cost price of 0 or more.";
    if (!Number.isFinite(stock) || stock < 0) next.stock_quantity = "Enter a stock of 0 or more.";
    if (!Number.isFinite(threshold) || threshold < 0) {
      next.low_stock_threshold = "Enter a low-stock level of 0 or more.";
    }
    if (!form.unit.trim()) next.unit = "Please choose a unit.";

    setErrors(next);
    if (Object.keys(next).length > 0) return null;

    return {
      name,
      sku,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      cost_price: cost,
      selling_price: selling,
      stock_quantity: stock,
      low_stock_threshold: Math.round(threshold),
      unit: form.unit.trim(),
      is_active: product ? product.is_active : true,
    };
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            {product
              ? "Update the details of this product."
              : "Add something you sell. You can change any of this later."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            const input = validate();
            if (input) onSubmit(input);
          }}
        >
          <FormError message={submitError ?? null} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name" htmlFor="p-name" error={errors.name} required>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Sugar 1kg"
              />
            </Field>
            <Field label="SKU / product code" htmlFor="p-sku" error={errors.sku} required>
              <Input
                id="p-sku"
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="SGR-1KG"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={`Selling price (${currency})`}
              htmlFor="p-sell"
              error={errors.selling_price}
              required
            >
              <Input
                id="p-sell"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.selling_price}
                onChange={(e) => set("selling_price", e.target.value)}
              />
            </Field>
            <Field label={`Cost price (${currency})`} htmlFor="p-cost" error={errors.cost_price}>
              <Input
                id="p-cost"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.cost_price}
                onChange={(e) => set("cost_price", e.target.value)}
                placeholder="0.00"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Unit" htmlFor="p-unit" error={errors.unit} required>
              <Select value={form.unit} onValueChange={(value) => set("unit", value)}>
                <SelectTrigger id="p-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Current stock" htmlFor="p-stock" error={errors.stock_quantity}>
              <Input
                id="p-stock"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.stock_quantity}
                onChange={(e) => set("stock_quantity", e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field
              label="Low-stock alert at"
              htmlFor="p-threshold"
              error={errors.low_stock_threshold}
            >
              <Input
                id="p-threshold"
                type="number"
                min={0}
                value={form.low_stock_threshold}
                onChange={(e) => set("low_stock_threshold", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Category" htmlFor="p-category">
            <Input
              id="p-category"
              list="product-category-options"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Groceries"
            />
            <datalist id="product-category-options">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </Field>

          <Field label="Description" htmlFor="p-desc">
            <Textarea
              id="p-desc"
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Anything worth remembering about this product."
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {product ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | undefined;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
