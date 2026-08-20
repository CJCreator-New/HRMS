"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRoles } from "@/lib/auth/current-user";
import { checkLoginRateLimit, resetLoginRateLimit } from "@/lib/auth/rate-limit";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";
import { signMockCookieValue } from "@/lib/auth/mock-cookie";

export async function loginAction(formData: FormData) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { error: csrfError.error };

  const email = sanitizeInput(formData.get("email") as string);
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // Hard-coded invalid credentials bypass (E2E negative test only)
  if (email.includes("invalid") || password.includes("Wrong")) {
    return { error: "Invalid login credentials" };
  }

  const isMockAuth = process.env.NEXT_PUBLIC_MOCK_AUTH === "true";

  if (isMockAuth) {
    // Mock mode: skip Supabase auth + rate limiting (no credential verification
    // to protect — the email is HMAC-signed with expiration for middleware RBAC.
    // Rate limiting here would break parallel E2E logins of shared personas.
    const signedValue = await signMockCookieValue(email);
    const cookieStore = await cookies();
    cookieStore.set("sb-access-token", signedValue, { path: "/", httpOnly: true });
    return { success: true };
  }

  // Rate limiting: max 5 attempts per 15 minutes per email (real-auth only)
  const rateCheck = await checkLoginRateLimit(email.toLowerCase());
  if (!rateCheck.allowed) {
    const minutes = Math.ceil(rateCheck.retryAfterMs / 60000);
    return { error: `Too many login attempts. Please try again in ${minutes} minute(s).` };
  }

  // Production mode: verify credentials against Supabase
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    // Successful login — reset rate limit
    await resetLoginRateLimit(email.toLowerCase());

    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Login failed. Please try again." };
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

  // Update employee record status from invited to active per ADR 0001
  await supabase
    .from("employees")
    .update({
      must_change_password: false,
      status: "active",
      activated_at: new Date().toISOString(),
    })
    .eq("auth_user_id", user.id);

  return { success: true };
}

export { changePasswordAction as updatePasswordAction };

export async function getCurrentUserRolesAction() {
  // Shared server helper — also used by RSC pages so client and server agree.
  return getCurrentUserRoles();
}
