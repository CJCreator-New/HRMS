import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { resolveMockSession } from "@/lib/auth/mock-cookie";

// Safe wrapper for React's request-scoped cache (active in RSC, passthrough in test/client runners)
type CacheFn = <T extends (...args: unknown[]) => unknown>(fn: T) => T;
const serverCache: CacheFn = typeof (React as unknown as { cache?: CacheFn }).cache === "function"
  ? (React as unknown as { cache: CacheFn }).cache
  : <T extends (...args: unknown[]) => unknown>(fn: T): T => fn;

export interface CurrentUserInfo {
  roles: string[];
  mustChangePassword: boolean;
  userName: string;
  /** Resolved employees.id for the session — null in mock mode / unauthenticated. */
  employeeId: string | null;
}

const DEFAULT_USER: CurrentUserInfo = {
  roles: ["employee"],
  mustChangePassword: false,
  userName: "Employee",
  employeeId: null,
};

/**
 * Resolves the current user's roles, name, and password-reset flag.
 *
 * Server-only (uses `cookies()` + the user-scoped Supabase client) — shared by
 * the `getCurrentUserRolesAction` server action and server-rendered RSC pages
 * so both environments resolve identity identically.
 *
 * Real mode: Supabase session → employees row with joined employee_roles in 1 query.
 * Mock mode (NEXT_PUBLIC_MOCK_AUTH): the `sb-access-token` cookie holds the
 * persona email → static mock RBAC table.
 */
async function resolveCurrentUserRoles(): Promise<CurrentUserInfo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get("sb-access-token")?.value;
    const mockSession = await resolveMockSession(rawCookie);
    if (mockSession) {
      return {
        roles: mockSession.roles,
        mustChangePassword: false,
        userName: mockSession.email.split("@")[0],
        employeeId: mockSession.employeeId,
      };
    }
    return DEFAULT_USER;
  }

  // Combined single query: fetch employee details and joined employee_roles -> roles
  const { data: emp } = await supabase
    .from("employees")
    .select(`
      id,
      must_change_password,
      full_name,
      employee_roles(roles(code))
    `)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!emp) return DEFAULT_USER;

  // Extract roles array from joined relation
  let roles: string[] = [];
  if (Array.isArray(emp.employee_roles)) {
    roles = (emp.employee_roles as Array<{ roles?: { code?: string } | Array<{ code?: string }> | null }>)
      .map((r) => (Array.isArray(r.roles) ? r.roles[0]?.code : r.roles?.code))
      .filter((c): c is string => Boolean(c));
  }

  // Fallback for test fakes or environments where employee_roles is queried separately
  if (roles.length === 0 && !Array.isArray(emp.employee_roles)) {
    const { data: empRoles } = await supabase
      .from("employee_roles")
      .select("roles!inner(code)")
      .eq("employee_id", emp.id);

    roles = (empRoles as Array<{ roles?: { code?: string } | string | null }>)
      ?.map((r) => (typeof r.roles === "object" && r.roles !== null ? r.roles.code : r.roles))
      .filter((c): c is string => Boolean(c)) || [];
  }

  return {
    roles: roles.length > 0 ? roles : ["employee"],
    mustChangePassword: !!emp.must_change_password,
    userName: emp.full_name || "Employee",
    employeeId: emp.id,
  };
}

/**
 * Resolves the current user's roles, name, and password-reset flag.
 * Request-scoped memoization via React `cache()` prevents redundant lookups across layouts/pages.
 */
export const getCurrentUserRoles = serverCache(resolveCurrentUserRoles);

export async function safeGetCurrentUserRoles(): Promise<CurrentUserInfo> {
  try {
    return await getCurrentUserRoles();
  } catch {
    return DEFAULT_USER;
  }
}
