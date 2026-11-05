import { expect, test } from "vitest";
import { lineTotalCents, toCents, toMilli, percentOfCents, formatMoneyCents } from "./money";

test("Two KES 120 items less KES 15 equals KES 225", () => {
  expect(lineTotalCents(toMilli(2), toCents(120)) - toCents(15)).toBe(22500);
});

test("Fractional quantity at an exact decimal price rounds once to cents", () => {
  expect(lineTotalCents(toMilli(1.25), toCents(120.10))).toBe(15013);
});

test("Ten percent discount on KES 240 is KES 24", () => {
  expect(percentOfCents(toCents(240), 10)).toBe(2400);
});

test("Completed sale amount is displayed in KES without rounding drift", () => {
  expect(formatMoneyCents(22500)).toBe("KES 225.00");
});