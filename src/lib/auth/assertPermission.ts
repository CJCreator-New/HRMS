"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { hasMockPermission, resolveMockEmployeeIdFromEmail, resolveMockRolesFromEmail } from "@/lib/services/mock-rbac";
import { validateMockCookieValue } from "@/lib/auth/mock-cookie";

export interface AuthenticatedCaller {
  employeeId: string | null;
  email: string | null;
  roles: string[];
}

/**
 * Resolves the authenticated caller's identity (employeeId, email, roles).
 */
export async function getAuthenticatedCaller(): Promise<AuthenticatedCaller | null> {
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get("sb-access-token")?.value;
    if (rawCookie) {
      const mockEmail = await validateMockCookieValue(rawCookie);
      if (mockEmail && mockEmail.includes("@")) {
        const employeeId = resolveMockEmployeeIdFromEmail(mockEmail);
        const { roles } = resolveMockRolesFromEmail(mockEmail);
        return { employeeId, email: mockEmail, roles };
      }
    }
  } catch {
    // ignore
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: emp } = await supabase
      .from("employees")
      .select("id, email")
      .eq("auth_user_id", user.id)
      .single();

    const { data: empRoles } = emp
      ? await supabase
          .from("employee_roles")
          .select("roles!inner(code)")
          .eq("employee_id", emp.id)
      : { data: null };

    const roles = empRoles?.map((r: any) => r.roles.code) || ["employee"];

    return {
      employeeId: emp?.id || null,
      email: emp?.email || user.email || null,
      roles,
    };
  } catch {
    return null;
  }
}

/**
 * Validates that the target employee ID matches the authenticated caller,
 * unless the caller holds admin/team permissions allowing proxy operations.
 */
export async function assertCallerIdentity(
  targetEmployeeId: string,
  proxyPermissionCodes: string[] = []
): Promise<{ error: string } | null> {
  const caller = await getAuthenticatedCaller();
  if (!caller || !caller.employeeId) {
    // If not unauthenticated, verify if assertPermission handles it
    return null;
  }

  // If caller matches target, authorized
  if (caller.employeeId === targetEmployeeId) {
    return null;
  }

  // If proxy permissions provided, check if caller holds any of them
  if (proxyPermissionCodes.length > 0) {
    const proxyCheck = await assertAnyPermission(proxyPermissionCodes);
    if (!proxyCheck) {
      return null; // caller authorized as proxy/admin
    }
  }

  return {
    error: "Forbidden: You cannot perform this action on behalf of another employee",
  };
}

/**
 * Lightweight server-side permission assertion helper.
 * Call at the start of any mutating server action.
 * Returns `null` if authorized, or an error object `{ error: string }` if not.
 *
 * In mock mode (NEXT_PUBLIC_MOCK_AUTH=true), permissions are resolved from
 * the email stored in the sb-access-token cookie using the static mock RBAC
 * table, so server actions work without a real Supabase session.
 *
 * Usage:
 *   const authError = await assertPermission("leave.approve.hr");
 *   if (authError) return authError;
 */
export async function assertPermission(
  permCode: string
): Promise<{ error: string } | null> {
  // --- Mock-mode fast path ---
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get("sb-access-token")?.value;
    if (rawCookie) {
      const mockEmail = await validateMockCookieValue(rawCookie);
      if (mockEmail && mockEmail.includes("@")) {
        if (hasMockPermission(mockEmail, [permCode])) {
          return null; // authorized via mock RBAC
        }
        return { error: `Insufficient permissions: ${permCode} required` };
      }
    }
  } catch {
    // cookies() unavailable (e.g. unit tests) — fall through to Supabase
  }

  // --- Real Supabase session path ---
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthenticated" };

  const { data: isAllowed } = await supabase.rpc("has_permission", {
    perm_code: permCode,
  });

  if (!isAllowed) {
    return { error: `Insufficient permissions: ${permCode} required` };
  }

  return null;
}

/**
 * Assert any of a list of permissions (OR logic).
 */
export async function assertAnyPermission(
  permCodes: string[]
): Promise<{ error: string } | null> {
  // --- Mock-mode fast path ---
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get("sb-access-token")?.value;
    if (rawCookie) {
      const mockEmail = await validateMockCookieValue(rawCookie);
      if (mockEmail && mockEmail.includes("@")) {
        if (hasMockPermission(mockEmail, permCodes)) {
          return null; // authorized via mock RBAC
        }
        return {
          error: `Insufficient permissions: one of [${permCodes.join(", ")}] required`,
        };
      }
    }
  } catch {
    // cookies() unavailable (e.g. unit tests) — fall through to Supabase
  }

  // --- Real Supabase session path ---
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthenticated" };

  const { data: isAllowed } = await supabase.rpc("has_any_permission", {
    perm_codes: permCodes,
  });

  if (isAllowed) return null;

  return {
    error: `Insufficient permissions: one of [${permCodes.join(", ")}] required`,
  };
}
