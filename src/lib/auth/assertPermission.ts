"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { hasMockPermission } from "@/lib/services/mock-rbac";
import { validateMockCookieValue } from "@/lib/auth/mock-cookie";

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
  if (process.env.NEXT_PUBLIC_MOCK_AUTH === "true") {
    try {
      const cookieStore = await cookies();
      const rawCookie = cookieStore.get("sb-access-token")?.value;
      if (rawCookie) {
        // Validate HMAC signature and expiration; reject tampered/expired cookies
        const mockEmail = await validateMockCookieValue(rawCookie);
        if (mockEmail && mockEmail.includes("@")) {
          if (hasMockPermission(mockEmail, [permCode])) {
            return null; // authorized via mock RBAC
          }
          return { error: `Insufficient permissions: ${permCode} required` };
        }
        // Tampered or expired cookie — treat as unauthenticated
        return { error: "Unauthenticated: invalid or expired session" };
      }
    } catch {
      // cookies() unavailable (e.g. unit tests) — fall through to Supabase
    }
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
  if (process.env.NEXT_PUBLIC_MOCK_AUTH === "true") {
    try {
      const cookieStore = await cookies();
      const rawCookie = cookieStore.get("sb-access-token")?.value;
      if (rawCookie) {
        // Validate HMAC signature and expiration; reject tampered/expired cookies
        const mockEmail = await validateMockCookieValue(rawCookie);
        if (mockEmail && mockEmail.includes("@")) {
          if (hasMockPermission(mockEmail, permCodes)) {
            return null; // authorized via mock RBAC
          }
          return {
            error: `Insufficient permissions: one of [${permCodes.join(", ")}] required`,
          };
        }
        // Tampered or expired cookie — treat as unauthenticated
        return { error: "Unauthenticated: invalid or expired session" };
      }
    } catch {
      // cookies() unavailable (e.g. unit tests) — fall through to Supabase
    }
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
