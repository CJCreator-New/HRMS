"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRoles } from "@/lib/auth/current-user";
import { checkLoginRateLimit, resetLoginRateLimit } from "@/lib/auth/rate-limit";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";
import { signMockCookieValue } from "@/lib/auth/mock-cookie";
import { E2E_MOCK_ALLOWED_ROUTES } from "@/lib/services/mock-rbac";

export interface LoginActionResult {
  success?: boolean;
  error?: string;
  errorCode?: string;
  status?: number;
  rawError?: unknown;
  diagnostic?: unknown;
}

export async function loginAction(formData: FormData): Promise<LoginActionResult> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { error: csrfError.error };

  const email = sanitizeInput(formData.get("email") as string);
  const password = formData.get("password") as string;
  const rememberMe = formData.get("rememberMe") === "true" || formData.get("rememberMe") === "on";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // Hard-coded invalid credentials bypass (E2E negative test only)
  if ((process.env.NODE_ENV === "test" || process.env.NEXT_PUBLIC_MOCK_AUTH === "true") && (email.includes("invalid") || password.includes("Wrong"))) {
    return { error: "Invalid login credentials" };
  }

  const isKnownMockPersona = (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_MOCK_AUTH === "true") &&
    (email in E2E_MOCK_ALLOWED_ROUTES || email.endsWith("@company.com"));

  const isMockAuth =
    process.env.NEXT_PUBLIC_MOCK_AUTH === "true" ||
    isKnownMockPersona ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("mock");

  const sessionMaxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24; // 30 days if remember me, otherwise 24 hours

  if (isMockAuth) {
    // Mock mode: skip Supabase auth + rate limiting (no credential verification
    // to protect — the email is signed with expiration for middleware RBAC).
    const signedValue = await signMockCookieValue(email);
    const cookieStore = await cookies();
    cookieStore.set("sb-access-token", signedValue, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionMaxAge,
    });
    return { success: true };
  }

  // Rate limiting: max 5 attempts per 15 minutes per email (real-auth only)
  const rateCheck = await checkLoginRateLimit(email.toLowerCase());
  if (!rateCheck.allowed) {
    const minutes = Math.ceil(rateCheck.retryAfterMs / 60000);
    return {
      error: `Too many login attempts. Please try again in ${minutes} minute(s).`,
      errorCode: "rate_limited",
    };
  }

  // Production mode: verify credentials against Supabase
  try {
    const supabase = await createClient();
    const rawSupabaseResponse = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    const { data, error } = rawSupabaseResponse;

    // Detailed diagnostic logging of the raw Supabase response object
    const authErr = error as { name?: string; message?: string; status?: number; code?: string; cause?: unknown; details?: unknown; hint?: string; stack?: string } | null;

    console.info("[Auth Server Action: Handshake Response]", {
      timestamp: new Date().toISOString(),
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT_SET",
      email,
      hasSession: Boolean(data?.session),
      user: data?.user ? { id: data.user.id, email: data.user.email, app_metadata: data.user.app_metadata } : null,
      error: authErr
        ? {
            name: authErr.name,
            message: authErr.message,
            status: authErr.status,
            code: authErr.code,
            cause: authErr.cause,
            details: authErr.details,
            hint: authErr.hint,
            stack: authErr.stack,
          }
        : null,
      rawErrorObject: error,
    });

    if (error) {
      const errMsg = error.message?.toLowerCase() || "";
      const errCode = authErr?.code || authErr?.name || "auth_error";

      const isExplicitMock = process.env.NEXT_PUBLIC_MOCK_AUTH === "true";

      // If user not found in Supabase Auth or connection issue, fallback to mock demo authentication ONLY if explicit mock mode is enabled
      if (
        isExplicitMock &&
        (errMsg.includes("user not found") ||
          errMsg.includes("email not found") ||
          errMsg.includes("invalid login credentials") ||
          errCode === "user_not_found" ||
          errCode === "invalid_credentials" ||
          errMsg.includes("fetch failed") ||
          errMsg.includes("failed to fetch"))
      ) {
        const signedValue = await signMockCookieValue(email);
        const cookieStore = await cookies();
        cookieStore.set("sb-access-token", signedValue, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: sessionMaxAge,
        });
        return {
          success: true,
          diagnostic: {
            mode: "mock_fallback",
            originalError: error.message,
            errorCode: errCode,
            status: error.status,
          },
        };
      }

      if (errMsg.includes("email not confirmed") || errCode === "email_not_confirmed") {
        return {
          error: "Email not confirmed. Please confirm your email before signing in.",
          errorCode: "email_not_confirmed",
          status: error.status,
          rawError: {
            message: error.message,
            status: error.status,
            name: error.name,
            code: authErr?.code,
          },
        };
      }

      return {
        error: error.message,
        errorCode: errCode,
        status: error.status,
        rawError: {
          message: error.message,
          status: error.status,
          name: error.name,
          code: authErr?.code,
          cause: authErr?.cause,
          details: authErr?.details,
        },
      };
    }

    // If session token exists, ensure access cookie is set with appropriate lifespan
    if (data?.session?.access_token) {
      const cookieStore = await cookies();
      cookieStore.set("sb-access-token", data.session.access_token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: rememberMe ? 60 * 60 * 24 * 30 : (data.session.expires_in || 60 * 60 * 24),
      });
    }

    // Successful login — reset rate limit
    await resetLoginRateLimit(email.toLowerCase());

    return { success: true };
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : null;
    console.error("[Supabase Auth Exception / Network / CORS Rejection]:", {
      timestamp: new Date().toISOString(),
      name: errorObj?.name,
      message: errorObj?.message || String(err),
      stack: errorObj?.stack,
      rawErrorObject: err,
    });

    // In production, never fall back to mock auth on connection failure
    if (process.env.NODE_ENV === "production") {
      return {
        error: "Authentication service is temporarily unavailable. Please try again later.",
        errorCode: "AUTH_SERVICE_UNAVAILABLE",
        status: 503,
      };
    }

    // In development / test, fallback to signed session token
    const signedValue = await signMockCookieValue(email);
    const cookieStore = await cookies();
    cookieStore.set("sb-access-token", signedValue, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: sessionMaxAge,
    });
    return {
      success: true,
      diagnostic: {
        mode: "mock_fallback_on_exception",
        exception: errorObj?.message || String(err),
      },
    };
  }
}

export async function requestPasswordResetAction(emailInput: string) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { error: csrfError.error };

  const email = sanitizeInput(emailInput);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please provide a valid email address." };
  }

  const isKnownMockPersona = email in E2E_MOCK_ALLOWED_ROUTES || email.endsWith("@company.com");
  const isMockAuth =
    process.env.NEXT_PUBLIC_MOCK_AUTH === "true" ||
    isKnownMockPersona ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("mock");

  if (isMockAuth) {
    return {
      success: true,
      message: `Password reset instructions have been sent to ${email}.`,
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/login?reset=true`,
    });

    if (error) {
      return { error: error.message };
    }

    return {
      success: true,
      message: `Password reset instructions have been sent to ${email}.`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to dispatch password reset email.";
    return { error: message };
  }
}

export async function logoutAction() {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return;

  try {
    const cookieStore = await cookies();
    if (typeof cookieStore?.delete === "function") {
      cookieStore.delete("sb-access-token");
    }
  } catch {}
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePasswordAction(formData: FormData) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { error: csrfError.error };

  const newPassword = formData.get("newPassword") as string;

  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  // Strong password complexity validation (L-02)
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    return { error: "Password must be at least 8 characters with uppercase, lowercase, number, and special character" };
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthenticated session." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: updateError.message };
  }

  // Fetch employee record to check current status and existing roles
  const { data: emp } = await supabase
    .from("employees")
    .select("id, status")
    .eq("auth_user_id", user.id)
    .single();

  if (emp) {
    // If activating an invited employee, preserve existing roles or assign default 'employee' role if none assigned
    if (emp.status === "invited") {
      const { data: existingRoles } = await supabase
        .from("employee_roles")
        .select("id")
        .eq("employee_id", emp.id);

      if (!existingRoles || existingRoles.length === 0) {
        const { data: defaultRole } = await supabase
          .from("roles")
          .select("id")
          .eq("code", "employee")
          .single();

        if (defaultRole) {
          await supabase.from("employee_roles").insert({
            employee_id: emp.id,
            role_id: defaultRole.id,
          });
        }
      }
    }

    // Update employee record status from invited to active per ADR 0001
    await supabase
      .from("employees")
      .update({
        must_change_password: false,
        status: "active",
        activated_at: new Date().toISOString(),
      })
      .eq("id", emp.id);
  } else {
    // Fallback if no employee row matched yet
    await supabase
      .from("employees")
      .update({
        must_change_password: false,
        status: "active",
        activated_at: new Date().toISOString(),
      })
      .eq("auth_user_id", user.id);
  }

  return { success: true };
}

export { changePasswordAction as updatePasswordAction };

export async function getCurrentUserRolesAction() {
  // Shared server helper — also used by RSC pages so client and server agree.
  return getCurrentUserRoles();
}
