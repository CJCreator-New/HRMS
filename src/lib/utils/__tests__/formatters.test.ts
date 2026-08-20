import { describe, it, expect } from "vitest";
import { formatDateIndian, formatCurrencyIndian } from "../formatters";

describe("formatDateIndian (M-08)", () => {
  it("formats an ISO date as DD-MMM-YYYY", () => {
    expect(formatDateIndian("2026-08-14T12:00:00")).toBe("14-Aug-2026");
    expect(formatDateIndian(new Date("2026-08-14T12:00:00"))).toBe("14-Aug-2026");
  });

  it("pads single-digit days and maps all months", () => {
    expect(formatDateIndian("2026-01-05T12:00:00")).toBe("05-Jan-2026");
    expect(formatDateIndian("2026-03-10T12:00:00")).toBe("10-Mar-2026");
    expect(formatDateIndian("2026-12-31T12:00:00")).toBe("31-Dec-2026");
  });

  it("returns an em dash for null/undefined/empty", () => {
    expect(formatDateIndian(null)).toBe("—");
    expect(formatDateIndian(undefined)).toBe("—");
    expect(formatDateIndian("")).toBe("—");
  });

  it("returns the raw string for unparseable input", () => {
    expect(formatDateIndian("not-a-date")).toBe("not-a-date");
  });

  it("optionally includes HH:mm time", () => {
    expect(formatDateIndian("2026-08-12T18:01:05", true)).toBe("12-Aug-2026 18:01");
  });
});

describe("formatCurrencyIndian (en-IN grouping)", () => {
  it("formats with lakh grouping and INR symbol", () => {
    expect(formatCurrencyIndian(150000)).toBe("₹1,50,000");
    expect(formatCurrencyIndian(5769)).toBe("₹5,769");
  });

  it("handles null/undefined/NaN as ₹0", () => {
    expect(formatCurrencyIndian(null)).toBe("₹0");
    expect(formatCurrencyIndian(undefined)).toBe("₹0");
    expect(formatCurrencyIndian(Number.NaN)).toBe("₹0");
  });
});
