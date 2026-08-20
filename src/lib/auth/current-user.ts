import { createClient } from "@/lib/supabase/server";
import { resolveMockRolesFromEmail } from "@/lib/services/mock-rbac";
import { cookies } from "next/headers";
import { validateMockCookieValue } from "@/lib/auth/mock-cookie";

export interface CurrentUserInfo {
  roles: string[];
  mustChangePassword: boolean;
  userName: string;
  /** Resolved employees.id for the session — null in mock mode / unauthenticated. */
  employeeId: string | null;
}

/**
 * Resolves the current user's roles, name, and password-reset flag.
 *
 * Server-only (uses `cookies()` + the user-scoped Supabase client) — shared by
 * the `getCurrentUserRolesAction` server action and server-rendered RSC pages
 * so both environments resolve identity identically.
 *
 * Real mode: Supabase session → employees row → employee_roles.
 * Mock mode (NEXT_PUBLIC_MOCK_AUTH): the `sb-access-token` cookie holds the
 * persona email → static mock RBAC table.
 */
export async function getCurrentUserRoles(): Promise<CurrentUserInfo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get("sb-access-token")?.value;
    if (rawCookie) {
      // Validate HMAC signature and expiration; reject tampered/expired cookies
      const mockEmail = await validateMockCookieValue(rawCookie);
      if (mockEmail) {
        const mockResult = resolveMockRolesFromEmail(mockEmail);
        return { ...mockResult, userName: mockEmail.split("@")[0], employeeId: null };
      }
      // Tampered or expired mock cookie — fall through to unauthenticated
    }
    return { roles: ["employee"], mustChangePassword: false, userName: "Employee", employeeId: null };
  }

  const { data: emp } = await supabase
    .from("employees")
    .select("id, must_change_password, full_name")
    .eq("auth_user_id", user.id)
    .single();

  if (!emp) return { roles: ["employee"], mustChangePassword: false, userName: "Employee", employeeId: null };

  const { data: empRoles } = await supabase
    .from("employee_roles")
    .select("roles!inner(code)")
    .eq("employee_id", emp.id);

  const roles = empRoles?.map((r: any) => r.roles.code) || ["employee"];
  return {
    roles,
    mustChangePassword: !!emp.must_change_password,
    userName: emp.full_name || "Employee",
    employeeId: emp.id,
  };
}

const DEFAULT_USER: CurrentUserInfo = {
  roles: ["employee"],
  mustChangePassword: false,
  userName: "Employee",
  employeeId: null,
};

/**
 * Like `getCurrentUserRoles` but never throws — RSC pages use this so a down
 * DB/session layer degrades to the default employee view instead of 500-ing.
 */
export async function safeGetCurrentUserRoles(): Promise<CurrentUserInfo> {
  try {
    return await getCurrentUserRoles();
  } catch {
    return DEFAULT_USER;
  }
}
