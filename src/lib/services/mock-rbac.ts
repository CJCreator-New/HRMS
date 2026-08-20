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
  "sysadmin@company.com": "ALL",
  "hradmin@company.com": [
    "/", "/approvals", "/attendance", "/leave", "/calendar",
    "/employees", "/employees/import", "/onboarding", "/departments",
    "/offboarding", "/salary", "/statutory", "/reimbursements",
    "/encashment", "/documents", "/permissions", "/jobs",
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
    "/salary", "/offboarding", "/payroll", "/reimbursements", "/encashment", "/documents", "/permissions",
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
  "hr.alt@company.com": [],          // secondary test persona for negative / alternate testing
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

/**
 * Resolves the mock-mode role set for an email when no real session exists.
 * Used by getCurrentUserRolesAction to drive the client-side role switcher.
 */
export function resolveMockRolesFromEmail(
  email: string
): { roles: string[]; mustChangePassword: boolean } {
  if (email.includes("sysadmin")) return { roles: ["system_admin"], mustChangePassword: false };
  if (email.includes("multi.hrmgr")) return { roles: ["hr", "manager"], mustChangePassword: false };
  if (email.includes("hradmin")) return { roles: ["hr"], mustChangePassword: false };
  // hr.alt is a negative/alternate test persona with access revoked (empty route
  // list). Resolves to employee role — the minimal valid permission set — so the
  // role switcher shows a non-misleading role while hasMockPermission still denies
  // access via the empty route list.
  if (email.includes("hr.alt")) return { roles: ["employee"], mustChangePassword: false };
  if (email.includes("payroll")) return { roles: ["payroll_admin"], mustChangePassword: false };
  if (email.includes("manager")) return { roles: ["manager"], mustChangePassword: false };
  if (email.includes("invited")) return { roles: ["employee"], mustChangePassword: true };
  return { roles: ["employee"], mustChangePassword: false };
}
