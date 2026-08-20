import { describe, it, expect } from "vitest";
import {
  computePayableUnits,
  computeMidMonthProRataSalary,
  filterPayrollEligibleEmployees,
  resolveMonthlyCtc,
  computeEmployeePayrollRun,
} from "../payroll-engine";

describe("Payroll Engine Unit Tests", () => {
  it("computes payable units and LOP units correctly for full month", () => {
    const result = computePayableUnits({
      totalDaysInMonth: 30,
      workedDays: 20,
      paidLeaveDays: 8,
      lopDays: 2,
    });
    expect(result.payableUnits).toBe(28);
    expect(result.lopUnits).toBe(2);
  });

  it("handles zero worked days with full paid leave", () => {
    const result = computePayableUnits({
      totalDaysInMonth: 31,
      workedDays: 0,
      paidLeaveDays: 31,
      lopDays: 0,
    });
    expect(result.payableUnits).toBe(31);
    expect(result.lopUnits).toBe(0);
  });

  it("calculates mid-month revision pro-rata salary correctly", () => {
    const result = computeMidMonthProRataSalary(600000, 900000, 30, 15);
    expect(result.oldEarned).toBe(25000);
    expect(result.newEarned).toBe(37500);
    expect(result.totalGross).toBe(62500);
  });
});

describe("filterPayrollEligibleEmployees", () => {
  const employees = [{ id: "e1" }, { id: "e2" }, { id: "e3" }];
  const period = { start: "2026-07-01", end: "2026-07-31" };

  it("keeps everyone eligible when there are no overrides", () => {
    const { eligible, excludedCount } = filterPayrollEligibleEmployees(
      employees,
      [],
      period.start,
      period.end
    );
    expect(eligible).toHaveLength(3);
    expect(excludedCount).toBe(0);
  });

  it("excludes an employee with an ineligible override overlapping the period", () => {
    const { eligible, excludedCount } = filterPayrollEligibleEmployees(
      employees,
      [{ employee_id: "e2", is_eligible: false, effective_from: "2026-01-01", effective_to: null }],
      period.start,
      period.end
    );
    expect(eligible.map((e) => e.id)).toEqual(["e1", "e3"]);
    expect(excludedCount).toBe(1);
  });

  it("ignores overrides that expired before the period", () => {
    const { excludedCount } = filterPayrollEligibleEmployees(
      employees,
      [{ employee_id: "e2", is_eligible: false, effective_from: "2026-01-01", effective_to: "2026-06-30" }],
      period.start,
      period.end
    );
    expect(excludedCount).toBe(0);
  });

  it("ignores overrides that start after the period", () => {
    const { excludedCount } = filterPayrollEligibleEmployees(
      employees,
      [{ employee_id: "e2", is_eligible: false, effective_from: "2026-08-01", effective_to: null }],
      period.start,
      period.end
    );
    expect(excludedCount).toBe(0);
  });

  it("ignores rows that are explicitly eligible", () => {
    const { excludedCount } = filterPayrollEligibleEmployees(
      employees,
      [{ employee_id: "e2", is_eligible: true, effective_from: "2026-01-01", effective_to: null }],
      period.start,
      period.end
    );
    expect(excludedCount).toBe(0);
  });
});

describe("resolveMonthlyCtc", () => {
  it("returns null when no salary structure exists", () => {
    expect(resolveMonthlyCtc(null)).toBeNull();
    expect(resolveMonthlyCtc(undefined)).toBeNull();
  });

  it("derives monthly CTC from annual CTC", () => {
    expect(resolveMonthlyCtc({ annual_ctc: 900000 })).toBe(75000);
  });

  it("returns monthly_ctc when annual_ctc is not set", () => {
    expect(resolveMonthlyCtc({ monthly_ctc: 60000 })).toBe(60000);
  });

  it("returns null when structure has zero or invalid values", () => {
    expect(resolveMonthlyCtc({ annual_ctc: 0 })).toBeNull();
    expect(resolveMonthlyCtc({ monthly_ctc: -1000 })).toBeNull();
  });
});

describe("computeEmployeePayrollRun", () => {
  const base = {
    daysInMonth: 30,
    workedCount: 20,
    halfDayCount: 0,
    paidLeaveDays: 8,
    monthlyCtc: 75000,
    ptState: "Karnataka",
    taxRegime: "new_regime" as const,
    pfApplicable: true,
    esiApplicable: false,
  };

  it("computes units, pro-rated earnings and net pay for a normal month", () => {
    const result = computeEmployeePayrollRun(base);
    expect(result.payableUnits).toBe(28);
    expect(result.lopUnits).toBe(2);
    expect(result.grossMonthly).toBe(70000);
    expect(result.basicMonthly).toBe(35000);
    // PF 1800 (capped) + Karnataka PT 200 + Karnataka LWF 20; TDS 0 under new regime
    expect(result.totalDeduction).toBe(2020);
    expect(result.netPay).toBe(67980);
  });

  it("counts half days as 0.5 worked units", () => {
    const result = computeEmployeePayrollRun({
      ...base,
      workedCount: 0,
      halfDayCount: 4,
      paidLeaveDays: 26,
    });
    expect(result.payableUnits).toBe(28);
    expect(result.lopUnits).toBe(2);
    expect(result.grossMonthly).toBe(70000);
  });

  it("falls back to full paid-leave units when nothing was worked", () => {
    const result = computeEmployeePayrollRun({
      ...base,
      workedCount: 0,
      halfDayCount: 0,
      paidLeaveDays: 30,
    });
    expect(result.payableUnits).toBe(30);
    expect(result.lopUnits).toBe(0);
    expect(result.grossMonthly).toBe(75000);
    // PF 1800 + Karnataka PT 200 + Karnataka LWF 20 = 2020
    expect(result.netPay).toBe(72980);
  });

  it("applies old regime TDS when configured", () => {
    const result = computeEmployeePayrollRun({ ...base, taxRegime: "old_regime" });
    // PF 1800 + Karnataka PT 200 + Karnataka LWF 20 + Old Regime TDS (with 4% cess) 6110 = 8130
    expect(result.totalDeduction).toBe(8130);
    expect(result.netPay).toBe(61870);
  });

  it("never produces negative net pay", () => {
    const result = computeEmployeePayrollRun({
      ...base,
      monthlyCtc: 10000,
      taxRegime: "old_regime",
    });
    expect(result.netPay).toBeGreaterThanOrEqual(0);
  });

  it("handles non-applicable PF and ESI (zero statutory PF/ESI deductions)", () => {
    const result = computeEmployeePayrollRun({
      ...base,
      pfApplicable: false,
      esiApplicable: false,
    });
    // PT 200 + LWF 20 = 220
    expect(result.totalDeduction).toBe(220);
    expect(result.netPay).toBe(69780);
  });

  it("applies ESI deduction when gross is below ESI threshold and applicable", () => {
    const result = computeEmployeePayrollRun({
      ...base,
      monthlyCtc: 20000,
      pfApplicable: false,
      esiApplicable: true,
    });
    // ESI 0.75% of pro-rated gross (18667) = ~140 + PT + LWF
    expect(result.totalDeduction).toBeGreaterThan(0);
    expect(result.netPay).toBeLessThan(result.grossMonthly);
  });

  it("clamps payable units when combined units exceed days in month", () => {
    const result = computeEmployeePayrollRun({
      ...base,
      workedCount: 25,
      paidLeaveDays: 10,
    });
    expect(result.payableUnits).toBe(30);
    expect(result.lopUnits).toBe(0);
  });
});
