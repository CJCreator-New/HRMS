import { describe, it, expect } from "vitest";
import {
  PAYROLL_STEPS,
  payrollStepIndex,
  OFFBOARDING_STEPS,
  offboardingStepIndex,
} from "../workflow-steps";

describe("payrollStepIndex (FLW-01/FLW-02)", () => {
  it("exposes the 5 guided steps", () => {
    expect(PAYROLL_STEPS).toHaveLength(5);
  });

  it("maps draft to step 1 (Period & Eligibility)", () => {
    expect(payrollStepIndex("draft")).toBe(0);
    expect(payrollStepIndex(undefined)).toBe(0);
  });

  it("maps processing (run in progress) to the Execute Run step", () => {
    expect(payrollStepIndex("processing")).toBe(2);
  });

  it("maps validated (post-run) to Review Payslips", () => {
    expect(payrollStepIndex("validated")).toBe(3);
  });

  it("maps finalized/published to Finalize & Publish", () => {
    expect(payrollStepIndex("finalized")).toBe(4);
    expect(payrollStepIndex("published")).toBe(4);
  });
});

describe("offboardingStepIndex (FLW-03)", () => {
  it("exposes the 5 lifecycle steps", () => {
    expect(OFFBOARDING_STEPS).toHaveLength(5);
  });

  const active = (overrides: Partial<{ ff_status: string; clearance: Record<string, boolean> }> = {}) => ({
    status: "active",
    ff_status: "draft",
    clearance: { it: false, finance: false, admin: false, hr: false },
    ...overrides,
  });

  it("starts at Resignation when there is no separation", () => {
    expect(offboardingStepIndex(null)).toBe(0);
    expect(offboardingStepIndex({ status: "pending", ff_status: "draft", clearance: {} })).toBe(0);
    expect(offboardingStepIndex({ status: "rescinded", ff_status: "draft", clearance: {} })).toBe(0);
  });

  it("advances to Notice Period for an active separation with no clearances", () => {
    expect(offboardingStepIndex(active())).toBe(1);
  });

  it("advances to Clearance once any department clears", () => {
    expect(
      offboardingStepIndex(active({ clearance: { it: true, finance: false, admin: false, hr: false } }))
    ).toBe(2);
  });

  it("reaches F&F Draft when all clearances are done", () => {
    expect(
      offboardingStepIndex(
        active({ clearance: { it: true, finance: true, admin: true, hr: true } })
      )
    ).toBe(3);
  });

  it("lands on Approval for pending_approval / approved / paid and completed separations", () => {
    expect(offboardingStepIndex(active({ ff_status: "pending_approval" }))).toBe(4);
    expect(offboardingStepIndex(active({ ff_status: "approved" }))).toBe(4);
    expect(
      offboardingStepIndex({ status: "completed", ff_status: "paid", clearance: {} })
    ).toBe(4);
  });
});
