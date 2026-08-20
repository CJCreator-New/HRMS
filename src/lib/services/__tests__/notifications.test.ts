import { describe, it, expect } from "vitest";
import { notificationActionUrl } from "../notifications";

describe("notificationActionUrl (F-05 deep-links)", () => {
  it("prefers an explicit action_url when the emitter provided one", () => {
    expect(
      notificationActionUrl({
        action_url: "/payroll?period=abc",
        title: "Payslip published",
        message: "Your August payslip is ready.",
      })
    ).toBe("/payroll?period=abc");
  });

  it("maps pending leave/attendance/reimbursement/encashment to the approvals inbox", () => {
    expect(notificationActionUrl({ title: "Leave Request", message: "John applied for leave" })).toBe("/approvals");
    expect(notificationActionUrl({ title: "Attendance Correction", message: "Pending approval" })).toBe("/approvals");
    expect(notificationActionUrl({ title: "Expense Claim", message: "₹2,000 submitted for approval" })).toBe("/approvals");
    expect(notificationActionUrl({ title: "Leave Encashment", message: "awaiting approval" })).toBe("/approvals");
    expect(notificationActionUrl({ title: "Comp-Off Grant", message: "Pending approval" })).toBe("/approvals");
  });

  it("maps payslip/payroll lifecycle notifications to /payroll", () => {
    expect(notificationActionUrl({ title: "Payslip Published", message: "Revision v2 available" })).toBe("/payroll");
    expect(notificationActionUrl({ title: "Payroll Finalized", message: "August cycle locked" })).toBe("/payroll");
  });

  it("maps offboarding / F&F notifications to /offboarding", () => {
    expect(notificationActionUrl({ title: "F&F Settlement", message: "Draft ready for review" })).toBe("/offboarding");
    expect(notificationActionUrl({ title: "Clearance", message: "IT clearance pending" })).toBe("/offboarding");
  });

  it("maps onboarding invitations to the employee directory", () => {
    expect(notificationActionUrl({ title: "Onboarding", message: "You have been invited" })).toBe("/employees");
    expect(notificationActionUrl({ title: "Welcome", message: "Your HRMS credentials" })).toBe("/employees");
  });

  it("returns null for unrelated notifications", () => {
    expect(notificationActionUrl({ title: "Policy Update", message: "New holiday list published" })).toBeNull();
    expect(notificationActionUrl({ title: "", message: "" })).toBeNull();
  });
});
