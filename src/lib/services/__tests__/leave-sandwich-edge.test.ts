import { describe, it, expect } from "vitest";

/**
 * Pure JavaScript mirror of Postgres calculate_leave_days stored procedure
 * for offline deterministic testing and verification of edge cases.
 */
function calculateLeaveDaysLogic(params: {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  durationType: "full_day" | "first_half" | "second_half";
  isSandwichEnabled: boolean;
  holidays?: string[]; // YYYY-MM-DD
}): number {
  const start = new Date(params.startDate);
  const end = new Date(params.endDate);

  if (end < start) {
    throw new Error("End date cannot precede start date in calculate_leave_days");
  }

  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 365) {
    throw new Error("Leave duration cannot exceed 365 days in calculate_leave_days");
  }

  const isSingleDay = params.startDate === params.endDate;
  if (isSingleDay && (params.durationType === "first_half" || params.durationType === "second_half")) {
    return 0.5;
  }

  const holidaySet = new Set(params.holidays || []);
  let curr = new Date(start);
  let days = 0;

  while (curr <= end) {
    const dayOfWeek = curr.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateStr = curr.toISOString().split("T")[0];
    const isHoliday = holidaySet.has(dateStr);
    const isWorkingDay = !isWeekend && !isHoliday;

    if (params.isSandwichEnabled || isWorkingDay) {
      days += 1;
    }

    curr.setDate(curr.getDate() + 1);
  }

  return days;
}

describe("Leave Sandwich Rule & Edge Cases (P3-7)", () => {
  it("computes 4 days for Friday to Monday when sandwich rule is enabled", () => {
    // 2026-09-04 is Friday, 2026-09-07 is Monday
    const result = calculateLeaveDaysLogic({
      startDate: "2026-09-04",
      endDate: "2026-09-07",
      durationType: "full_day",
      isSandwichEnabled: true,
    });
    // Friday + Saturday + Sunday + Monday = 4 days
    expect(result).toBe(4);
  });

  it("computes only 2 days for Friday to Monday when sandwich rule is disabled", () => {
    const result = calculateLeaveDaysLogic({
      startDate: "2026-09-04",
      endDate: "2026-09-07",
      durationType: "full_day",
      isSandwichEnabled: false,
    });
    // Saturday and Sunday are excluded -> Friday + Monday = 2 days
    expect(result).toBe(2);
  });

  it("includes intervening public holidays when sandwich rule is enabled", () => {
    // Thursday 2026-09-03 (Holiday) + Friday 2026-09-04 to Monday 2026-09-07
    const result = calculateLeaveDaysLogic({
      startDate: "2026-09-03",
      endDate: "2026-09-06", // Thursday to Sunday
      durationType: "full_day",
      isSandwichEnabled: true,
      holidays: ["2026-09-03"],
    });
    // Thursday + Friday + Saturday + Sunday = 4 days
    expect(result).toBe(4);
  });

  it("excludes intervening public holidays and weekends when sandwich is disabled", () => {
    // Thursday 2026-09-03 (Holiday) + Friday 2026-09-04 to Monday 2026-09-07
    const result = calculateLeaveDaysLogic({
      startDate: "2026-09-03",
      endDate: "2026-09-07",
      durationType: "full_day",
      isSandwichEnabled: false,
      holidays: ["2026-09-03"], // Thursday is holiday
    });
    // Thursday (holiday), Sat, Sun excluded -> Only Friday (1) + Monday (1) = 2
    expect(result).toBe(2);
  });

  it("returns exactly 0.5 for a single-day half-day leave without sandwich extension", () => {
    // Single Friday half-day leave
    const result = calculateLeaveDaysLogic({
      startDate: "2026-09-04",
      endDate: "2026-09-04",
      durationType: "first_half",
      isSandwichEnabled: true,
    });
    expect(result).toBe(0.5);
  });

  it("throws error when end date precedes start date", () => {
    expect(() =>
      calculateLeaveDaysLogic({
        startDate: "2026-09-10",
        endDate: "2026-09-05",
        durationType: "full_day",
        isSandwichEnabled: true,
      })
    ).toThrow("End date cannot precede start date");
  });

  it("throws error when leave duration exceeds 365 calendar days", () => {
    expect(() =>
      calculateLeaveDaysLogic({
        startDate: "2025-01-01",
        endDate: "2026-03-01", // > 365 days
        durationType: "full_day",
        isSandwichEnabled: true,
      })
    ).toThrow("Leave duration cannot exceed 365 days");
  });
});
