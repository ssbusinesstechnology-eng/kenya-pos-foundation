/**
 * Exact money + quantity arithmetic.
 * Money is handled in integer cents, quantity in integer thousandths,
 * so no floating-point drift can reach a displayed or stored value.
 */

export const QTY_SCALE = 1000;
const MONEY_SCALE = 100;

export function toCents(amount: number): number {
  return Math.round(amount * MONEY_SCALE);
}

export function fromCents(cents: number): number {
  return cents / MONEY_SCALE;
}

export function toMilli(quantity: number): number {
  return Math.round(quantity * QTY_SCALE);
}

export function fromMilli(milli: number): number {
  return milli / QTY_SCALE;
}

/** quantity × unit price, in cents. */
export function lineTotalCents(quantityMilli: number, unitPriceCents: number): number {
  return Math.round((quantityMilli * unitPriceCents) / QTY_SCALE);
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function percentOfCents(cents: number, percent: number): number {
  return Math.round((cents * Math.round(percent * 100)) / 10_000);
}

export function formatMoneyCents(cents: number, currency = "KES"): string {
  return `${currency} ${fromCents(cents).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Trims trailing zeros: 2 → "2", 1.250 → "1.25". */
export function formatQuantity(milli: number): string {
  const value = fromMilli(milli);
  return value.toLocaleString("en-KE", { maximumFractionDigits: 3 });
}
