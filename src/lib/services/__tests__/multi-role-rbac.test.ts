import { describe, it, expect, vi } from "vitest";
import {
  ROLE_PERMISSIONS_MAP,
  permissionsForRoles,
  hasPermission,
} from "@/lib/auth/permissions-map";
import {
  resolveMockRolesFromEmail,
  hasMockPermission,
  isMockEmailAllowed,
} from "@/lib/services/mock-rbac";
import type { RoleCode } from "@/lib/types";

describe("Multi-Role RBAC Specification Verification Suite", () => {
  describe("TEST-01: Cumulative Permission Union Calculation", () => {
    it("computes the exact union of permissions for multi.hrmgr (HR + Manager)", () => {
      const roles: RoleCode[] = ["hr", "manager"];
      const union = permissionsForRoles(roles);

      // Must contain HR permissions
      expect(union).toContain("employee.create");
      expect(union).toContain("salary.view.all");
      expect(union).toContain("offboarding.manage");
      expect(union).toContain("ff.approve");
      expect(union).toContain("settings.manage");

      // Must contain Manager permissions
      expect(union).toContain("leave.approve.manager");
      expect(union).toContain("attendance.correct.approve");
      expect(union).toContain("reimbursement.view.team");

      // Must NOT contain unassigned permissions (e.g. payroll run)
      expect(union).not.toContain("payroll.run");
      expect(union).not.toContain("payroll.finalize");
    });

    it("grants full capabilities to system_admin across all modules", () => {
      const union = permissionsForRoles(["system_admin"]);
      expect(hasPermission(union, "settings.manage")).toBe(true);
      expect(hasPermission(union, "audit.view")).toBe(true);
      expect(hasPermission(union, "job.rerun")).toBe(true);
    });
  });

  describe("TEST-02: Scope Hierarchy Fallback Evaluation", () => {
    it("grants access when user has .all and check requires .self or .team", () => {
      const hrPermissions = ["salary.view.all", "leave.view.all", "employee.view.all"];

      // .self checks should pass because user holds .all
      expect(hasPermission(hrPermissions, "salary.view.self")).toBe(true);
      expect(hasPermission(hrPermissions, "leave.view.self")).toBe(true);
      expect(hasPermission(hrPermissions, "employee.view.self")).toBe(true);

      // .team checks should pass because user holds .all
      expect(hasPermission(hrPermissions, "leave.view.team")).toBe(true);
      expect(hasPermission(hrPermissions, "employee.view.team")).toBe(true);

      // unscoped checks should pass because user holds .all
      expect(hasPermission(hrPermissions, "salary.view")).toBe(true);
      expect(hasPermission(hrPermissions, "leave.view")).toBe(true);
    });

    it("grants access when user has .team and check requires .self", () => {
      const managerPermissions = ["leave.view.team", "employee.view.team"];

      expect(hasPermission(managerPermissions, "leave.view.self")).toBe(true);
      expect(hasPermission(managerPermissions, "employee.view.self")).toBe(true);
      expect(hasPermission(managerPermissions, "leave.view.team")).toBe(true);

      // Should NOT grant .all
      expect(hasPermission(managerPermissions, "leave.view.all")).toBe(false);
      expect(hasPermission(managerPermissions, "employee.view.all")).toBe(false);
    });

    it("denies access when user only has .self and check requires .team or .all", () => {
      const empPermissions = ["salary.view.self", "leave.view.self", "employee.view.self"];

      expect(hasPermission(empPermissions, "salary.view.self")).toBe(true);
      expect(hasPermission(empPermissions, "salary.view.team")).toBe(false);
      expect(hasPermission(empPermissions, "salary.view.all")).toBe(false);
      expect(hasPermission(empPermissions, "leave.view.team")).toBe(false);
      expect(hasPermission(empPermissions, "leave.view.all")).toBe(false);
    });
  });

  describe("TEST-03: Multi-Role Persona Mock Parity (multi.hrmgr)", () => {
    it("resolves multi.hrmgr to both HR and Manager roles", () => {
      const { roles } = resolveMockRolesFromEmail("multi.hrmgr@company.com");
      expect(roles).toEqual(["hr", "manager"]);
    });

    it("allows multi.hrmgr access to /salary via route allowlist and permission check", () => {
      expect(isMockEmailAllowed("multi.hrmgr@company.com", "/salary")).toBe(true);
      expect(hasMockPermission("multi.hrmgr@company.com", ["salary.view.all"])).toBe(true);
      expect(hasMockPermission("multi.hrmgr@company.com", ["salary.view.self"])).toBe(true);
    });

    it("allows multi.hrmgr access to both HR and Manager specific operations", () => {
      expect(hasMockPermission("multi.hrmgr@company.com", ["employee.create"])).toBe(true);
      expect(hasMockPermission("multi.hrmgr@company.com", ["leave.approve.manager"])).toBe(true);
      expect(hasMockPermission("multi.hrmgr@company.com", ["offboarding.manage"])).toBe(true);
      expect(hasMockPermission("multi.hrmgr@company.com", ["ff.approve"])).toBe(true);
      expect(hasMockPermission("multi.hrmgr@company.com", ["payroll.run"])).toBe(false);
    });
  });

  describe("TEST-04: Manager Baseline Permissions", () => {
    it("includes salary.view.self in manager role baseline permissions", () => {
      const managerPerms = ROLE_PERMISSIONS_MAP.manager;
      expect(managerPerms).toContain("salary.view.self");
    });
  });

  describe("TEST-05: Focus Isolation Logic", () => {
    it("correctly isolates active focus permissions from the broader assigned roles", () => {
      const managerPerms = ROLE_PERMISSIONS_MAP.manager;
      const hrPerms = ROLE_PERMISSIONS_MAP.hr;

      // In Manager focus, HR admin capabilities are not present in activeRolePermissions
      expect(managerPerms).not.toContain("employee.create");
      expect(managerPerms).not.toContain("salary.view.all");
      expect(managerPerms).not.toContain("offboarding.manage");

      // In HR focus, Manager team-scoped approvals are not present in activeRolePermissions
      expect(hrPerms).toContain("employee.create");
      expect(hrPerms).toContain("salary.view.all");
      expect(hrPerms).toContain("offboarding.manage");
    });
  });
});
