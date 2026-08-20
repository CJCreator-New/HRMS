import type { RoleCode } from "@/lib/types";

/**
 * Cumulative union permission mapping per role (FR §1.3).
 *
 * Single source of truth for role → permissions. Previously this map was
 * duplicated in `src/lib/roleContext.tsx` (client) and
 * `src/lib/services/mock-rbac.ts` (server), which let the two drift. This
 * module is deliberately free of `"use client"` / `"use server"` directives so
 * both environments (and server-rendered RSC pages) can share it.
 *
 * Content is the union of the two former maps — a strict superset of each, so
 * no consumer loses a permission. `system_admin` is treated as unrestricted by
 * `permissionsForRoles` (matching the client behavior), not by this table.
 */
export const ROLE_PERMISSIONS_MAP: Record<RoleCode, string[]> = {
  employee: [
    "employee.view.self", "attendance.mark.self", "attendance.view.self", "attendance.correct.self",
    "leave.view.self", "leave.apply.self", "leave.cancel.self", "leave.encash.apply.self",
    "compoff.apply.self", "permission.apply.self", "salary.view.self", "reimbursement.apply.self",
    "reimbursement.cancel.self", "separation.view", "attachment.upload", "attachment.view",
  ],
  manager: [
    "employee.view.self", "attendance.mark.self", "attendance.view.self", "attendance.correct.self",
    "leave.view.self", "leave.apply.self", "leave.cancel.self", "leave.encash.apply.self",
    "compoff.apply.self", "permission.apply.self", "reimbursement.apply.self",
    "reimbursement.cancel.self", "attachment.upload", "attachment.view",
    "employee.view.team", "attendance.mark.team", "attendance.view.team", "attendance.correct.approve",
    "leave.view.team", "leave.approve.manager", "leave.cancel.approve", "permission.approve",
    "permission.override.quota", "compoff.approve", "reimbursement.approve", "reimbursement.view.team",
    "separation.create", "separation.view", "job.view",
  ],
  hr: [
    "employee.view.all", "employee.create", "employee.edit", "employee.import", "employee.deactivate",
    "attendance.view.all", "attendance.correct.override", "leave.view.all", "leave.approve.hr",
    "leave.cancel.approve", "leave.manage_types", "leave.encash.approve", "salary.view.all", "salary.edit",
    "statutory.view", "statutory.edit", "reimbursement.approve", "reimbursement.view.all", "separation.view",
    "separation.create", "separation.edit", "offboarding.manage", "ff.create", "ff.view", "ff.approve",
    "compoff.credit.manual", "compoff.revoke", "attachment.upload", "attachment.view", "reports.export",
    "audit.view", "settings.manage", "job.view", "job.rerun",
  ],
  payroll_admin: [
    "salary.view.all", "salary.edit", "payroll.view", "payroll.run", "payroll.reopen",
    "payroll.finalize", "payroll.publish", "payroll.schedule", "statutory.view", "statutory.edit",
    "ff.view", "reports.export", "employee.view.all", "attendance.view.all",
    "leave.view.all", "reimbursement.view.all", "attachment.view",
  ],
  system_admin: [
    "settings.manage", "audit.view", "job.view", "job.rerun", "employee.view.all",
  ],
};

/**
 * Cumulative UNION of permissions across all assigned roles. `system_admin`
 * bypasses every gate, so its union is unrestricted (matches the client
 * RoleProvider behavior and the server-side middleware bypass).
 */
export function permissionsForRoles(roles: string[]): string[] {
  const normalized = roles as RoleCode[];
  if (normalized.includes("system_admin")) {
    return Array.from(new Set(Object.values(ROLE_PERMISSIONS_MAP).flat()));
  }
  return Array.from(
    new Set(normalized.flatMap((role) => ROLE_PERMISSIONS_MAP[role] || []))
  );
}

/**
 * Permission check with scope fallback — mirrors the client `hasPermission`:
 * an exact code, or a broader `.all` / `.team` / `.self` scope of the same
 * permission, grants access.
 */
export function hasPermission(permissions: string[], permissionCode: string): boolean {
  if (permissions.includes(permissionCode)) return true;
  if (permissions.includes(`${permissionCode}.all`)) return true;
  if (permissions.includes(`${permissionCode}.team`)) return true;
  if (permissions.includes(`${permissionCode}.self`)) return true;
  return false;
}
