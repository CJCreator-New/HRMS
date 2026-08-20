import { describe, it, expect } from "vitest";
import {
  E2E_MOCK_ALLOWED_ROUTES,
  isMockEmailAllowed,
  resolveMockRolesFromEmail,
  hasMockPermission,
} from "../mock-rbac";
import { getRouteConfig, ROUTE_CONFIG } from "@/lib/nav/routeConfig";

// FR §1.3 Baseline Cumulative Union Permission Mapping per Role
// (mirrors roleContext.tsx and the schema/01_rbac.sql seeds)
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

// Deliberate E2E persona grants beyond the strict exact-match model:
// - employees view their own salary/payslip (self-service) in mock mode
// - hr/payroll personas reach the dashboard and approvals despite the
//   baseline role map not granting employee.view.self / permission.approve
// If the permission model is fixed (e.g. hr gains employee.view.self),
// these entries should shrink — the last test below enforces the list stays
// in sync with reality.
const DELIBERATE_EXTRA_GRANTS: Array<[string, string]> = [
  ["hradmin@company.com", "/"],
  ["hr.alt@company.com", "/"],
  ["payroll@company.com", "/"],
  ["payroll@company.com", "/calendar"],
];

describe("isMockEmailAllowed", () => {
  it("denies unknown emails by default", () => {
    expect(isMockEmailAllowed("nobody@company.com", "/leave")).toBe(false);
  });

  it("allows everything for the system-admin persona (ALL bypass)", () => {
    expect(isMockEmailAllowed("sysadmin@company.com", "/settings")).toBe(true);
    expect(isMockEmailAllowed("sysadmin@company.com", "/not-a-route")).toBe(true);
  });

  it("allows listed routes and denies unlisted routes for a persona", () => {
    expect(isMockEmailAllowed("manager.m1@company.com", "/approvals")).toBe(true);
    expect(isMockEmailAllowed("manager.m1@company.com", "/salary")).toBe(false);
  });

  it("authenticates the second manager persona (manager.m2) with manager routes", () => {
    expect(isMockEmailAllowed("manager.m2@company.com", "/approvals")).toBe(true);
    expect(isMockEmailAllowed("manager.m2@company.com", "/leave")).toBe(true);
    expect(isMockEmailAllowed("manager.m2@company.com", "/salary")).toBe(false);
  });

  it("authenticates the employee personas with the pure employee route set (no /payroll)", () => {
    expect(isMockEmailAllowed("employee.e1@company.com", "/salary")).toBe(true);
    expect(isMockEmailAllowed("employee.e1@company.com", "/leave")).toBe(true);
    expect(isMockEmailAllowed("employee.e1@company.com", "/payroll")).toBe(false);
    expect(isMockEmailAllowed("employee.e3@company.com", "/salary")).toBe(true);
    expect(isMockEmailAllowed("employee.e3@company.com", "/leave")).toBe(true);
    expect(isMockEmailAllowed("employee.e3@company.com", "/payroll")).toBe(false);
  });

  it("authenticates active-workforce lifecycle personas with employee routes", () => {
    expect(isMockEmailAllowed("invited.emp@company.com", "/")).toBe(true);
    expect(isMockEmailAllowed("invited.emp@company.com", "/leave")).toBe(true);
    expect(isMockEmailAllowed("notice.emp@company.com", "/leave")).toBe(true);
    expect(isMockEmailAllowed("notice.emp@company.com", "/approvals")).toBe(false);
  });

  it("supports fully-restricted and alternate HR personas", () => {
    expect(isMockEmailAllowed("employee.e2@company.com", "/")).toBe(false);
    expect(isMockEmailAllowed("hr.alt@company.com", "/approvals")).toBe(true);
    expect(isMockEmailAllowed("hr.alt@company.com", "/leave")).toBe(true);
  });

  it("denies all routes to lifecycle personas with revoked access", () => {
    expect(isMockEmailAllowed("suspended.emp@company.com", "/")).toBe(false);
    expect(isMockEmailAllowed("suspended.emp@company.com", "/attendance")).toBe(false);
    expect(isMockEmailAllowed("offboarded.emp@company.com", "/")).toBe(false);
    expect(isMockEmailAllowed("offboarded.emp@company.com", "/offboarding")).toBe(false);
  });

  it("denies all routes to withdrawn persona (access revoked)", () => {
    expect(isMockEmailAllowed("withdrawn.emp@company.com", "/")).toBe(false);
    expect(isMockEmailAllowed("withdrawn.emp@company.com", "/leave")).toBe(false);
    expect(isMockEmailAllowed("withdrawn.emp@company.com", "/attendance")).toBe(false);
  });
});

describe("resolveMockRolesFromEmail", () => {
  it("maps persona emails to their mock role sets", () => {
    expect(resolveMockRolesFromEmail("sysadmin@company.com")).toEqual({ roles: ["system_admin"], mustChangePassword: false });
    expect(resolveMockRolesFromEmail("multi.hrmgr@company.com")).toEqual({ roles: ["hr", "manager"], mustChangePassword: false });
    expect(resolveMockRolesFromEmail("hradmin@company.com")).toEqual({ roles: ["hr"], mustChangePassword: false });
    expect(resolveMockRolesFromEmail("hr.alt@company.com")).toEqual({ roles: ["hr"], mustChangePassword: false });
    expect(resolveMockRolesFromEmail("payroll@company.com")).toEqual({ roles: ["payroll_admin"], mustChangePassword: false });
    expect(resolveMockRolesFromEmail("manager.m1@company.com")).toEqual({ roles: ["manager"], mustChangePassword: false });
    expect(resolveMockRolesFromEmail("manager.m2@company.com")).toEqual({ roles: ["manager"], mustChangePassword: false });
  });

  it("flags invited users as must-change-password", () => {
    expect(resolveMockRolesFromEmail("invited.emp@company.com")).toEqual({ roles: ["employee"], mustChangePassword: true });
  });

  it("resolves the remaining lifecycle personas to plain employees", () => {
    expect(resolveMockRolesFromEmail("suspended.emp@company.com")).toEqual({ roles: ["employee"], mustChangePassword: false });
    expect(resolveMockRolesFromEmail("notice.emp@company.com")).toEqual({ roles: ["employee"], mustChangePassword: false });
    expect(resolveMockRolesFromEmail("offboarded.emp@company.com")).toEqual({ roles: ["employee"], mustChangePassword: false });
    expect(resolveMockRolesFromEmail("withdrawn.emp@company.com")).toEqual({ roles: ["employee"], mustChangePassword: false });
    expect(resolveMockRolesFromEmail("employee.e3@company.com")).toEqual({ roles: ["employee"], mustChangePassword: false });
  });

  it("defaults unknown emails to a plain employee", () => {
    expect(resolveMockRolesFromEmail("random@example.com")).toEqual({ roles: ["employee"], mustChangePassword: false });
  });
});

describe("mock RBAC consistency with the real permission model", () => {
  it("every mock-granted path must exist in ROUTE_CONFIG (no typos)", () => {
    const configPaths = new Set(ROUTE_CONFIG.map((r) => r.path));
    for (const [email, routes] of Object.entries(E2E_MOCK_ALLOWED_ROUTES)) {
      if (routes === "ALL") continue;
      for (const path of routes) {
        expect(configPaths.has(path), `${email} grants unknown path ${path}`).toBe(true);
      }
    }
  });

  it("every mock grant is reachable by the persona's roles (or documented as deliberate)", () => {
    const exceptions = new Set(DELIBERATE_EXTRA_GRANTS.map(([e, p]) => `${e}${p}`));
    for (const [email, routes] of Object.entries(E2E_MOCK_ALLOWED_ROUTES)) {
      if (routes === "ALL") continue; // system-admin bypass
      const roles = resolveMockRolesFromEmail(email).roles;
      const union = Array.from(
        new Set(roles.flatMap((r) => ROLE_PERMISSIONS_MAP[r] || []))
      );

      for (const path of routes) {
        if (exceptions.has(`${email}${path}`)) continue;
        const gate = getRouteConfig(path);
        if (!gate || gate.public) continue;
        const reachable = gate.requiredPermissions.some((p) => union.includes(p));
        expect(reachable, `${email} cannot reach ${path} with roles ${roles.join(",")}`).toBe(true);
      }
    }
  });

  it("documents exactly the deliberate extra grants that exist today", () => {
    const actual: string[] = [];
    for (const [email, routes] of Object.entries(E2E_MOCK_ALLOWED_ROUTES)) {
      if (routes === "ALL") continue;
      const roles = resolveMockRolesFromEmail(email).roles;
      const union = new Set(roles.flatMap((r) => ROLE_PERMISSIONS_MAP[r] || []));
      for (const path of routes) {
        const gate = getRouteConfig(path);
        if (!gate || gate.public) continue;
        if (!gate.requiredPermissions.some((p) => union.has(p))) {
          actual.push(`${email}${path}`);
        }
      }
    }
    expect(actual.sort()).toEqual(DELIBERATE_EXTRA_GRANTS.map(([e, p]) => `${e}${p}`).sort());
  });
});

describe("hasMockPermission", () => {
  it("allows system_admin all permissions via ALL bypass", () => {
    // sysadmin has "ALL" bypass — hasMockPermission returns true for any perm
    expect(hasMockPermission("sysadmin@company.com", ["settings.manage"])).toBe(true);
    expect(hasMockPermission("sysadmin@company.com", ["payroll.run"])).toBe(true);
    expect(hasMockPermission("sysadmin@company.com", ["leave.apply.self"])).toBe(true);
  });

  it("allows hr admin to access HR-level permissions", () => {
    expect(hasMockPermission("hradmin@company.com", ["leave.approve.hr"])).toBe(true);
    expect(hasMockPermission("hradmin@company.com", ["employee.create"])).toBe(true);
    expect(hasMockPermission("hradmin@company.com", ["settings.manage"])).toBe(true);
  });

  it("allows manager to access manager-level permissions", () => {
    expect(hasMockPermission("manager.m1@company.com", ["leave.approve.manager"])).toBe(true);
    expect(hasMockPermission("manager.m1@company.com", ["attendance.correct.approve"])).toBe(true);
  });

  it("allows employee to access employee-level permissions", () => {
    expect(hasMockPermission("employee.e1@company.com", ["leave.apply.self"])).toBe(true);
    expect(hasMockPermission("employee.e1@company.com", ["attendance.mark.self"])).toBe(true);
  });

  it("denies employee manager-level permissions", () => {
    expect(hasMockPermission("employee.e1@company.com", ["leave.approve.manager"])).toBe(false);
    expect(hasMockPermission("employee.e1@company.com", ["settings.manage"])).toBe(false);
  });

  it("checks OR logic for multiple required permissions", () => {
    // employee.e1 has leave.apply.self but not leave.approve.manager
    expect(hasMockPermission("employee.e1@company.com", ["leave.apply.self", "leave.approve.manager"])).toBe(true);
    // employee.e2 has empty routes (access revoked) → denied regardless of role permissions
    expect(hasMockPermission("employee.e2@company.com", ["leave.apply.self", "attendance.mark.self"])).toBe(false);
  });

  it("denies unknown emails not in the RBAC table", () => {
    expect(hasMockPermission("nobody@company.com", ["leave.apply.self"])).toBe(false);
  });

  it("evaluates multi-role union for multi.hrmgr persona (TEST-06)", () => {
    // multi.hrmgr has both HR and Manager roles
    expect(hasMockPermission("multi.hrmgr@company.com", ["settings.manage"])).toBe(true);
    expect(hasMockPermission("multi.hrmgr@company.com", ["leave.approve.manager"])).toBe(true);
    expect(hasMockPermission("multi.hrmgr@company.com", ["payroll.run"])).toBe(false);
  });
});
