import { describe, expect, test } from "vitest";
import { reportPeriod, stockStatus } from "./reports";
const now = new Date("2026-11-05T21:30:00Z");
describe("Nairobi reporting dates", () => {
  test("Today switches at Nairobi midnight, not UTC midnight", () =>
    expect(reportPeriod("today", "", "", now)).toEqual({
      from: "2026-11-06T00:00:00+03:00",
      to: "2026-11-07T00:00:00+03:00",
      group: "day",
    }));
  test("Yesterday is exactly the preceding business day", () =>
    expect(reportPeriod("yesterday", "", "", now).from).toBe("2026-11-05T00:00:00+03:00"));
  test("Last seven days includes today and six preceding days", () =>
    expect(reportPeriod("last7", "", "", now).from).toBe("2026-10-31T00:00:00+03:00"));
  test("Last thirty days includes today and 29 preceding days", () =>
    expect(reportPeriod("last30", "", "", now).from).toBe("2026-10-08T00:00:00+03:00"));
  test("This month starts on local first day", () =>
    expect(reportPeriod("month", "", "", now).from).toBe("2026-11-01T00:00:00+03:00"));
  test("Last month excludes current month", () =>
    expect(reportPeriod("lastmonth", "", "", now)).toEqual({
      from: "2026-10-01T00:00:00+03:00",
      to: "2026-11-01T00:00:00+03:00",
      group: "day",
    }));
  test("Year groups monthly", () =>
    expect(reportPeriod("year", "", "", now)).toEqual({
      from: "2026-01-01T00:00:00+03:00",
      to: "2026-11-07T00:00:00+03:00",
      group: "month",
    }));
  test("Custom end date is inclusive", () =>
    expect(reportPeriod("custom", "2026-10-01", "2026-10-31", now).to).toBe(
      "2026-11-01T00:00:00+03:00",
    ));
  test("Long custom range groups weekly", () =>
    expect(reportPeriod("custom", "2026-08-01", "2026-10-31", now).group).toBe("week"));
});
describe("Stock states", () => {
  test("Zero stock is out, not low", () => expect(stockStatus(0, 5)).toBe("OUT"));
  test("Threshold is inclusive", () => expect(stockStatus(5, 5)).toBe("LOW"));
  test("Above threshold is in stock", () => expect(stockStatus(6, 5)).toBe("IN"));
});
