/**
 * Current-sale cart. Lives in React state only — nothing here touches the
 * database. Checkout (a later phase) is what turns this into a sale.
 */
import { useCallback, useMemo, useState } from "react";
import type { Product } from "@/lib/api/types";
import {
  lineTotalCents,
  percentOfCents,
  sumCents,
  toCents,
  toMilli,
} from "@/lib/money";

export interface CartLine {
  productId: string;
  name: string;
  sku: string | null;
  unit: string;
  /** Snapshot of the selling price when the product was added, in cents. */
  unitPriceCents: number;
  /** Quantity in thousandths. */
  quantityMilli: number;
}

export type DiscountMode = "amount" | "percent";

export interface CartTotals {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

const STEP = toMilli(1);

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discountMode, setDiscountMode] = useState<DiscountMode>("amount");
  const [discountInput, setDiscountInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const clearNotice = useCallback(() => setNotice(null), []);

  const setQuantity = useCallback(
    (product: Product, quantityMilli: number) => {
      const availableMilli = toMilli(product.stock_quantity);
      if (quantityMilli <= 0) {
        setLines((prev) => prev.filter((line) => line.productId !== product.id));
        return;
      }
      if (quantityMilli > availableMilli) {
        setNotice(`Only ${product.stock_quantity} ${product.unit} of ${product.name} available.`);
        setLines((prev) =>
          prev.map((line) =>
            line.productId === product.id ? { ...line, quantityMilli: availableMilli } : line,
          ),
        );
        return;
      }
      setNotice(null);
      setLines((prev) =>
        prev.map((line) =>
          line.productId === product.id ? { ...line, quantityMilli } : line,
        ),
      );
    },
    [],
  );

  const addProduct = useCallback((product: Product) => {
    const availableMilli = toMilli(product.stock_quantity);
    if (!product.is_active) {
      setNotice(`${product.name} is inactive and can't be sold.`);
      return;
    }
    if (availableMilli <= 0) {
      setNotice(`${product.name} is out of stock.`);
      return;
    }
    setLines((prev) => {
      const existing = prev.find((line) => line.productId === product.id);
      if (!existing) {
        setNotice(null);
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            unit: product.unit,
            unitPriceCents: toCents(product.selling_price),
            quantityMilli: Math.min(STEP, availableMilli),
          },
        ];
      }
      const next = existing.quantityMilli + STEP;
      if (next > availableMilli) {
        setNotice(`Only ${product.stock_quantity} ${product.unit} of ${product.name} available.`);
        return prev.map((line) =>
          line.productId === product.id ? { ...line, quantityMilli: availableMilli } : line,
        );
      }
      setNotice(null);
      return prev.map((line) =>
        line.productId === product.id ? { ...line, quantityMilli: next } : line,
      );
    });
  }, []);

  const removeLine = useCallback((productId: string) => {
    setNotice(null);
    setLines((prev) => prev.filter((line) => line.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
    setDiscountInput("");
    setNotice(null);
  }, []);

  const totals = useMemo<CartTotals>(() => {
    const subtotalCents = sumCents(
      lines.map((line) => lineTotalCents(line.quantityMilli, line.unitPriceCents)),
    );
    const parsed = Number(discountInput);
    const valid = discountInput.trim() !== "" && Number.isFinite(parsed) && parsed > 0;
    let discountCents = 0;
    if (valid) {
      discountCents =
        discountMode === "percent"
          ? percentOfCents(subtotalCents, Math.min(parsed, 100))
          : toCents(parsed);
    }
    discountCents = Math.min(Math.max(discountCents, 0), subtotalCents);
    return { subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
  }, [lines, discountInput, discountMode]);

  return {
    lines,
    addProduct,
    setQuantity,
    removeLine,
    clearCart,
    totals,
    discountMode,
    setDiscountMode,
    discountInput,
    setDiscountInput,
    notice,
    clearNotice,
  };
}
