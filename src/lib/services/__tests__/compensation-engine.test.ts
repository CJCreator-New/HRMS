import { describe, it, expect } from "vitest";
import {
  computeEncashmentAmount,
  computeSalaryBreakdown,
  previousDate,
} from "../compensation-engine";

describe("computeEncashmentAmount", () => {
  it("computes the divisor-26 daily rate and total (FR §4.10)", () => {
    const { dailyRate, totalAmount } = computeEncashmentAmount(26000, 10);
    expect(dailyRate).toBe(1000);
    expect(totalAmount).toBe(10000);
  });

  it("rounds the daily rate to 2 decimals", () => {
    const { dailyRate, totalAmount } = computeEncashmentAmount(30000, 3);
    // 30000 / 26 = 1153.846... → 1153.85
    expect(dailyRate).toBe(1153.85);
    // 1153.85 * 3 = 3461.55 → 3462
    expect(totalAmount).toBe(3462);
  });

  it("returns zero amounts for zero days", () => {
    expect(computeEncashmentAmount(26000, 0)).toEqual({
      dailyRate: 1000,
      totalAmount: 0,
    });
  });
});

describe("computeSalaryBreakdown", () => {
  it("derives monthly gross and 50% basic from annual CTC", () => {
    expect(computeSalaryBreakdown(900000)).toEqual({
      monthlyGross: 75000,
      basicMonthly: 37500,
    });
  });

  it("rounds fractional gross", () => {
    expect(computeSalaryBreakdown(900001).monthlyGross).toBe(75000);
    expect(computeSalaryBreakdown(900007).monthlyGross).toBe(75001);
  });
});

describe("previousDate", () => {
  it("returns the day before an ISO date", () => {
    expect(previousDate("2026-08-14")).toBe("2026-08-13");
  });

  it("rolls back over month boundaries", () => {
    expect(previousDate("2026-03-01")).toBe("2026-02-28");
    expect(previousDate("2024-03-01")).toBe("2024-02-29"); // leap year
  });

  it("rolls back over year boundaries", () => {
    expect(previousDate("2027-01-01")).toBe("2026-12-31");
  });

  it("returns an empty string for an invalid date", () => {
    expect(previousDate("not-a-date")).toBe("");
  });
});
