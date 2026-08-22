import { describe, it, expect } from "vitest";
import {
  getMonthEndDateString,
  getMonthStartDateString,
  getTodayDateStringIST,
  formatDateStringIST,
  getDaysInMonth,
  previousDateString,
} from "../date-utils";

describe("Business Date & Timezone Utilities (Asia/Kolkata)", () => {
  it("TEST-TZ-001: March 2026 => 2026-03-31", () => {
    expect(getMonthEndDateString(2026, 3)).toBe("2026-03-31");
  });

  it("TEST-TZ-002: April 2026 => 2026-04-30", () => {
    expect(getMonthEndDateString(2026, 4)).toBe("2026-04-30");
  });

  it("TEST-TZ-003: February 2026 => 2026-02-28", () => {
    expect(getMonthEndDateString(2026, 2)).toBe("2026-02-28");
  });

  it("TEST-TZ-004: February 2028 => 2028-02-29", () => {
    expect(getMonthEndDateString(2028, 2)).toBe("2028-02-29");
  });

  it("TEST-TZ-005: previousDateString('2026-04-01') => '2026-03-31'", () => {
    expect(previousDateString("2026-04-01")).toBe("2026-03-31");
  });

  it("TEST-TZ-006: previousDateString('2026-03-01') => '2026-02-28'", () => {
    expect(previousDateString("2026-03-01")).toBe("2026-02-28");
  });

  it("TEST-TZ-007: All calculations remain correct when process timezone is UTC", () => {
    // 2026-03-31 01:00:00 IST is 2026-03-30 19:30:00 UTC
    const dateAt1AmIST = new Date("2026-03-30T19:30:00.000Z");
    expect(formatDateStringIST(dateAt1AmIST)).toBe("2026-03-31");

    // 2026-03-31 23:59:00 IST is 2026-03-31 18:29:00 UTC
    const dateAtLateNightIST = new Date("2026-03-31T18:29:00.000Z");
    expect(formatDateStringIST(dateAtLateNightIST)).toBe("2026-03-31");

    expect(getMonthStartDateString(2026, 1)).toBe("2026-01-01");
    expect(getMonthEndDateString(2026, 1)).toBe("2026-01-31");
    expect(getDaysInMonth(2026, 1)).toBe(31);
    expect(previousDateString("2026-01-01")).toBe("2025-12-31");
  });
});
