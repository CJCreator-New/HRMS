import { describe, it, expect } from "vitest";
import {
  computeLastWorkingDay,
  resolveFfApprovalOutcome,
} from "../offboarding-engine";

describe("computeLastWorkingDay", () => {
  it("adds the notice period to the resignation date", () => {
    expect(computeLastWorkingDay("2026-08-14", 30)).toBe("2026-09-13");
  });

  it("rolls over month boundaries", () => {
    expect(computeLastWorkingDay("2026-01-31", 30)).toBe("2026-03-02");
  });

  it("accounts for leap years", () => {
    expect(computeLastWorkingDay("2024-02-15", 14)).toBe("2024-02-29");
    expect(computeLastWorkingDay("2023-02-15", 14)).toBe("2023-03-01");
  });

  it("rolls over year boundaries", () => {
    expect(computeLastWorkingDay("2026-12-25", 10)).toBe("2027-01-04");
  });

  it("returns the same date for a zero-day notice", () => {
    expect(computeLastWorkingDay("2026-08-14", 0)).toBe("2026-08-14");
  });

  it("returns an empty string for an invalid resignation date", () => {
    expect(computeLastWorkingDay("not-a-date", 30)).toBe("");
  });
});

describe("resolveFfApprovalOutcome", () => {
  it("marks the separation offboarded when LWD is in the past", () => {
    expect(resolveFfApprovalOutcome("2026-08-01", "2026-08-14")).toEqual({
      lwdReached: true,
      status: "offboarded",
    });
  });

  it("marks the separation offboarded when LWD is today", () => {
    expect(resolveFfApprovalOutcome("2026-08-14", "2026-08-14")).toEqual({
      lwdReached: true,
      status: "offboarded",
    });
  });

  it("keeps the separation active when LWD is in the future", () => {
    expect(resolveFfApprovalOutcome("2026-08-20", "2026-08-14")).toEqual({
      lwdReached: false,
      status: "active",
    });
  });

  it("uses the current date when today is not injected", () => {
    // Deterministic regardless of when the suite runs (dates far in past/future)
    expect(resolveFfApprovalOutcome("2000-01-01").lwdReached).toBe(true);
    expect(resolveFfApprovalOutcome("2999-12-31").lwdReached).toBe(false);
  });

  it("treats a missing LWD as reached", () => {
    expect(resolveFfApprovalOutcome(null, "2026-08-14")).toEqual({
      lwdReached: true,
      status: "offboarded",
    });
    expect(resolveFfApprovalOutcome(undefined, "2026-08-14")).toEqual({
      lwdReached: true,
      status: "offboarded",
    });
  });
});
