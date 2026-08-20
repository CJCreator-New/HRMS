import { describe, it, expect } from "vitest";
import {
  computeCompOffExpiryDate,
  computePermissionDurationMinutes,
} from "../leave-engine";

describe("computeCompOffExpiryDate", () => {
  it("adds 90 days by default", () => {
    expect(computeCompOffExpiryDate("2026-08-14")).toBe("2026-11-12");
  });

  it("supports a custom validity window", () => {
    expect(computeCompOffExpiryDate("2026-08-14", 30)).toBe("2026-09-13");
  });

  it("rolls over month and year boundaries", () => {
    expect(computeCompOffExpiryDate("2026-11-15")).toBe("2027-02-13");
  });

  it("returns an empty string for an invalid date", () => {
    expect(computeCompOffExpiryDate("not-a-date")).toBe("");
  });
});

describe("computePermissionDurationMinutes", () => {
  it("computes duration within the same day", () => {
    expect(computePermissionDurationMinutes("10:00", "11:30")).toBe(90);
  });

  it("computes duration across hour boundaries", () => {
    expect(computePermissionDurationMinutes("09:45", "10:15")).toBe(30);
  });

  it("returns a negative duration when end precedes start", () => {
    expect(computePermissionDurationMinutes("11:00", "10:00")).toBe(-60);
  });

  it("handles malformed input as zero hours", () => {
    expect(computePermissionDurationMinutes("10", "11:00")).toBe(60);
  });
});
