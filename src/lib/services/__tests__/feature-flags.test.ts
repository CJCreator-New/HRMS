import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/flags/feature-flags";

describe("Feature Flags Evaluation Engine (P3-2)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns default values when no environment override exists", () => {
    delete process.env.NEXT_PUBLIC_FF_AI_PAYROLL_INSIGHTS;
    expect(isFeatureEnabled(FEATURE_FLAGS.AI_PAYROLL_INSIGHTS)).toBe(false);
    expect(isFeatureEnabled(FEATURE_FLAGS.BIO_ATTENDANCE_V2)).toBe(true);
  });

  it("respects NEXT_PUBLIC_FF_* environment variable overrides", () => {
    process.env.NEXT_PUBLIC_FF_AI_PAYROLL_INSIGHTS = "true";
    expect(isFeatureEnabled(FEATURE_FLAGS.AI_PAYROLL_INSIGHTS)).toBe(true);

    process.env.NEXT_PUBLIC_FF_BIO_ATTENDANCE_V2 = "false";
    expect(isFeatureEnabled(FEATURE_FLAGS.BIO_ATTENDANCE_V2)).toBe(false);
  });

  it("enables features automatically for system_admin and hr_admin canary context", () => {
    delete process.env.NEXT_PUBLIC_FF_AI_PAYROLL_INSIGHTS;
    expect(
      isFeatureEnabled(FEATURE_FLAGS.AI_PAYROLL_INSIGHTS, { userRole: "system_admin" })
    ).toBe(true);
  });
});
