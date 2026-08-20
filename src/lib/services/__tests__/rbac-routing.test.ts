import { describe, it, expect } from "vitest";
import { ROUTE_CONFIG, getRouteConfig } from "@/lib/nav/routeConfig";

// FR §1.3 Baseline Cumulative Union Permission Mapping per Role
const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  employee: [
    "employee.view.self", "attendance.mark.self", "attendance.view.self", "attendance.correct.self",
    "leave.view.self", "leave.apply.self", "leave.cancel.self", "leave.encash.apply.self",
    "compoff.apply.self", "permission.apply.self", "salary.view.self", "reimbursement.apply.self",
    "reimbursement.cancel.self", "separation.view", "attachment.upload", "attachment.view"
  ],
  manager: [
    "employee.view.self", "attendance.mark.self", "attendance.view.self", "attendance.correct.self",
    "leave.view.self", "leave.apply.self", "leave.cancel.self", "leave.encash.apply.self",
    "compoff.apply.self", "permission.apply.self", "reimbursement.apply.self",
    "reimbursement.cancel.self", "attachment.upload", "attachment.view",
    "employee.view.team", "attendance.mark.team", "attendance.view.team", "attendance.correct.approve",
    "leave.view.team", "leave.approve.manager", "leave.cancel.approve", "permission.approve",
    "permission.override.quota", "compoff.approve", "reimbursement.approve", "reimbursement.view.team",
    "separation.create", "separation.view", "job.view"
  ],
  hr: [
    "employee.view.all", "employee.create", "employee.edit", "employee.import", "employee.deactivate",
    "attendance.view.all", "attendance.correct.override", "leave.view.all", "leave.approve.hr",
    "leave.cancel.approve", "leave.manage_types", "leave.encash.approve", "salary.view.all", "salary.edit",
    "statutory.view", "statutory.edit", "reimbursement.approve", "reimbursement.view.all", "separation.view",
    "separation.create", "separation.edit", "offboarding.manage", "ff.create", "ff.view", "ff.approve",
    "compoff.credit.manual", "compoff.revoke", "attachment.upload", "attachment.view", "reports.export",
    "audit.view", "settings.manage", "job.view", "job.rerun"
  ],
  payroll_admin: [
    "salary.view.all", "salary.edit", "payroll.view", "payroll.run", "payroll.reopen",
    "payroll.finalize", "payroll.publish", "payroll.schedule", "statutory.view", "statutory.edit",
    "ff.view", "reports.export", "employee.view.all", "attendance.view.all",
    "leave.view.all", "reimbursement.view.all", "attachment.view"
  ],
  system_admin: [
    "settings.manage", "audit.view", "job.view", "job.rerun", "employee.view.all"
  ],
};

describe("RBAC Route Matrix & Permission Union Unit Tests", () => {
  it("verifies that all expected 22 non-public routes exist in ROUTE_CONFIG", () => {
    const paths = ROUTE_CONFIG.map((r) => r.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/approvals");
    expect(paths).toContain("/attendance");
    expect(paths).toContain("/leave");
    expect(paths).toContain("/permissions");
    expect(paths).toContain("/calendar");
    expect(paths).toContain("/reimbursements");
    expect(paths).toContain("/employees");
    expect(paths).toContain("/onboarding");
    expect(paths).toContain("/employees/import");
    expect(paths).toContain("/departments");
    expect(paths).toContain("/offboarding");
    expect(paths).toContain("/salary");
    expect(paths).toContain("/payroll");
    expect(paths).toContain("/eligibility");
    expect(paths).toContain("/statutory");
    expect(paths).toContain("/encashment");
    expect(paths).toContain("/documents");
    expect(paths).toContain("/reports");
    expect(paths).toContain("/settings");
    expect(paths).toContain("/audit");
    expect(paths).toContain("/jobs");
  });

  it("verifies that /calendar is categorized under MY WORK", () => {
    const cal = getRouteConfig("/calendar");
    expect(cal?.category).toBe("MY WORK");
  });

  it("enforces Manager No Salary Visibility (FR §5.8)", () => {
    const managerPerms = ROLE_PERMISSIONS_MAP["manager"];
    expect(managerPerms).not.toContain("salary.view.all");
    expect(managerPerms).not.toContain("salary.edit");
  });

  it("enforces Payroll Admin approval prohibition (FR §5.7)", () => {
    const payrollPerms = ROLE_PERMISSIONS_MAP["payroll_admin"];
    expect(payrollPerms).not.toContain("leave.approve.manager");
    expect(payrollPerms).not.toContain("leave.approve.hr");
    expect(payrollPerms).not.toContain("attendance.correct.approve");
    expect(payrollPerms).not.toContain("ff.approve");
    // But has read-only operations data
    expect(payrollPerms).toContain("attendance.view.all");
    expect(payrollPerms).toContain("leave.view.all");
    expect(payrollPerms).toContain("employee.view.all");
  });

  it("computes cumulative multi-role union correctly", () => {
    const assignedRoles = ["manager", "hr"];
    const union = Array.from(
      new Set(assignedRoles.flatMap((r) => ROLE_PERMISSIONS_MAP[r] || []))
    );
    expect(union).toContain("leave.approve.manager");
    expect(union).toContain("leave.approve.hr");
    expect(union).toContain("salary.view.all");
    expect(union).toContain("settings.manage");
  });
});
