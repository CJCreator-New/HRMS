/**
 * Mock-mode RBAC helpers.
 *
 * Used by the middleware and the auth actions when no real Supabase session
 * is available (E2E / offline mock-token mode). "ALL" means the persona has
 * system-admin bypass access. Pure functions so the routing rules are
 * unit-testable without a browser or database.
 *
 * Role → permissions lives in `@/lib/auth/permissions-map` (single source of
 * truth shared with the client RoleProvider and RSC pages) — only the mock
 * *email* → *roles* resolution and route allow-list live here.
 */

import { ROLE_PERMISSIONS_MAP } from "@/lib/auth/permissions-map";
import type { RoleCode } from "@/lib/types";

// E2E / offline mock RBAC table — the single source of truth the middleware
// enforces offline. e2e/specs/rbac/route-matrix.spec.ts derives its
// 14-persona × 22-route expected-access matrix from this table (so spec and
// gate cannot drift).
export const E2E_MOCK_ALLOWED_ROUTES: Record<string, string[] | "ALL"> = {
  "admin@company.com": "ALL",
  "sysadmin@company.com": "ALL",
  "hradmin@company.com": [
    "/", "/approvals", "/attendance", "/leave", "/calendar",
    "/employees", "/employees/import", "/onboarding", "/departments",
    "/offboarding", "/salary", "/statutory", "/reimbursements",
    "/encashment", "/documents", "/jobs",
    "/reports", "/settings", "/audit",
  ],
  "payroll@company.com": [
    "/", "/attendance", "/leave", "/calendar", "/employees",
    "/offboarding", "/salary", "/payroll", "/statutory",
    "/reimbursements", "/documents",
    "/reports", "/eligibility",
  ],
  "manager.m1@company.com": [
    "/", "/approvals", "/attendance", "/leave", "/calendar",
    "/employees", "/offboarding", "/reimbursements", "/documents", "/permissions",
  ],
  "manager.m2@company.com": [
    "/", "/approvals", "/attendance", "/leave", "/calendar",
    "/employees", "/offboarding", "/reimbursements", "/documents", "/permissions",
  ],
  "employee.e1@company.com": [
    "/", "/attendance", "/leave", "/calendar", "/employees",
    "/salary", "/offboarding", "/reimbursements", "/encashment", "/documents", "/permissions",
  ],
  "employee.e2@company.com": [],     // fully restricted persona
  "employee.e3@company.com": [
    "/", "/attendance", "/leave", "/calendar", "/employees",
    "/salary", "/offboarding", "/reimbursements", "/encashment", "/documents", "/permissions",
  ],
  "multi.hrmgr@company.com": [
    "/", "/approvals", "/attendance", "/leave", "/calendar",
    "/employees", "/employees/import", "/onboarding", "/departments",
    "/offboarding", "/statutory", "/reimbursements",
    "/encashment", "/documents", "/permissions", "/jobs",
    "/reports", "/settings", "/audit",
  ],
  "hr.alt@company.com": [
    "/", "/approvals", "/attendance", "/leave", "/calendar",
    "/employees", "/employees/import", "/onboarding", "/departments",
    "/offboarding", "/salary", "/statutory", "/reimbursements",
    "/encashment", "/documents", "/jobs",
    "/reports", "/settings", "/audit",
  ],
  // Lifecycle personas: active-workforce states get employee routes;
  // suspended/offboarded have access revoked (CONTEXT.md domain model), so
  // they are deny-all — they exist to be acted on, not to log in.
  "invited.emp@company.com": [
    "/", "/attendance", "/leave", "/calendar", "/employees",
    "/salary", "/offboarding", "/reimbursements", "/encashment", "/documents", "/permissions",
  ],
  "notice.emp@company.com": [
    "/", "/attendance", "/leave", "/calendar", "/employees",
    "/salary", "/offboarding", "/reimbursements", "/encashment", "/documents", "/permissions",
  ],
  "suspended.emp@company.com": [],  // access revoked during admin review
  "offboarded.emp@company.com": [], // access revoked after LWD
  "withdrawn.emp@company.com": [],  // access revoked — applicant withdrew before start
};

/** Deny-by-default check of a mock persona's access to a pathname. */
export function isMockEmailAllowed(email: string, pathname: string): boolean {
  const allowed = E2E_MOCK_ALLOWED_ROUTES[email];
  if (allowed === undefined) return false; // unknown email → deny
  if (allowed === "ALL") return true;      // sys_admin bypass
  return allowed.includes(pathname);
}

/**
 * Checks whether a mock-mode email (from the sb-access-token cookie)
 * holds at least one of the required permissions.
 *
 * Returns false for:
 *  - Unknown emails not in the RBAC table (deny-by-default)
 *  - Emails with empty route lists (access revoked personas)
 *  - Emails whose roles don't hold any of the required permissions
 */
export function hasMockPermission(
  email: string,
  requiredPermissions: string[]
): boolean {
  const allowed = E2E_MOCK_ALLOWED_ROUTES[email];
  if (allowed === undefined) return false; // unknown email → deny
  if (allowed === "ALL") return true;      // sys_admin bypass
  if (Array.isArray(allowed) && allowed.length === 0) return false; // revoked

  const { roles } = resolveMockRolesFromEmail(email);
  const heldPermissions = new Set(
    roles.flatMap((role) => ROLE_PERMISSIONS_MAP[role as RoleCode] || [])
  );
  return requiredPermissions.some((p) => heldPermissions.has(p));
}

export function resolveMockEmployeeIdFromEmail(email: string): string | null {
  const map: Record<string, string> = {
    "admin@company.com": "00000000-0000-0000-0000-000000000101",
    "sysadmin@company.com": "00000000-0000-0000-0000-000000000101",
    "hradmin@company.com": "00000000-0000-0000-0000-000000000102",
    "hr.alt@company.com": "00000000-0000-0000-0000-000000000103",
    "payroll@company.com": "00000000-0000-0000-0000-000000000104",
    "manager.m1@company.com": "00000000-0000-0000-0000-000000000105",
    "manager.m2@company.com": "00000000-0000-0000-0000-000000000106",
    "employee.e1@company.com": "00000000-0000-0000-0000-000000000107",
    "employee.e2@company.com": "00000000-0000-0000-0000-000000000108",
    "employee.e3@company.com": "00000000-0000-0000-0000-000000000109",
    "multi.hrmgr@company.com": "00000000-0000-0000-0000-000000000110",
    "invited.emp@company.com": "00000000-0000-0000-0000-000000000111",
    "suspended.emp@company.com": "00000000-0000-0000-0000-000000000112",
    "notice.emp@company.com": "00000000-0000-0000-0000-000000000113",
    "offboarded.emp@company.com": "00000000-0000-0000-0000-000000000114",
  };
  return map[email] || null;
}

/**
 * Resolves the mock-mode role set for an email when no real session exists.
 * Used by getCurrentUserRolesAction to drive the client-side role switcher.
 */
export function resolveMockRolesFromEmail(
  email: string
): { roles: string[]; mustChangePassword: boolean } {
  if (email.includes("sysadmin") || email.startsWith("admin@")) return { roles: ["system_admin"], mustChangePassword: false };
  if (email.includes("multi.hrmgr")) return { roles: ["hr", "manager"], mustChangePassword: false };
  if (email.includes("hradmin")) return { roles: ["hr"], mustChangePassword: false };
  if (email.includes("hr.alt")) return { roles: ["hr"], mustChangePassword: false };
  if (email.includes("payroll")) return { roles: ["payroll_admin"], mustChangePassword: false };
  if (email.includes("manager")) return { roles: ["manager"], mustChangePassword: false };
  if (email.includes("invited")) return { roles: ["employee"], mustChangePassword: true };
  return { roles: ["employee"], mustChangePassword: false };
}
