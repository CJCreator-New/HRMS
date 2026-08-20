import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getRouteConfig } from "@/lib/nav/routeConfig";
import { isMockEmailAllowed } from "@/lib/services/mock-rbac";
import { validateMockCookieValue } from "@/lib/auth/mock-cookie";
/**
 * Generates a cryptographically secure nonce for CSP.
 * Uses the Web Crypto API (available in both Node.js and Edge runtimes).
 * Each request gets a unique nonce used to allow only trusted scripts.
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/** Builds a strict Content-Security-Policy header with nonce-based script allowlisting. */
function buildCspHeader(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'unsafe-inline'`,
    "img-src 'self' data: blob: https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "font-src 'self' data:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Generate per-request nonce and attach CSP header
  const nonce = generateNonce();
  response.headers.set("Content-Security-Policy", buildCspHeader(nonce));
  // Expose nonce to server components via request header
  response.headers.set("X-Nonce", nonce);

  const pathname = request.nextUrl.pathname;

  // Allow /403 page and /login without auth checks
  if (pathname === "/403" || pathname === "/login") {
    return response;
  }

  const routeGate = getRouteConfig(pathname);

  // Allow public routes without auth
  if (routeGate?.public) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set({ name, value, ...options })
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const mockToken = request.cookies.get("sb-access-token")?.value;

  const isMockAllowed =
    process.env.NEXT_PUBLIC_MOCK_AUTH === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.NODE_ENV === "development";

  // 1. Unauthenticated redirect to /login
  if (!user && (!mockToken || !isMockAllowed) && pathname !== "/login") {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 2a. Mock-mode RBAC: real user session is absent but mock token is present.
  //     Validate HMAC signature and expiration; enforce access control via the
  //     static E2E RBAC table.
  if (!user && isMockAllowed && mockToken) {
    const mockEmail = await validateMockCookieValue(mockToken);
    if (mockEmail && mockEmail.includes("@")) {
      if (!isMockEmailAllowed(mockEmail, pathname)) {
        const forbiddenUrl = new URL("/403", request.url);
        return NextResponse.redirect(forbiddenUrl);
      }
      return response;
    }
    // Tampered or expired mock cookie — redirect to login
    if (pathname !== "/login") {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2b. Real Supabase RBAC: full permission check via DB queries.
  if (user && routeGate && routeGate.requiredPermissions.length > 0) {
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!employee) {
      const forbiddenUrl = new URL(`/403?code=missing_employee_record`, request.url);
      return NextResponse.redirect(forbiddenUrl);
    }

    // Query employee roles
    const { data: empRoles } = await supabase
      .from("employee_roles")
      .select("roles!inner(code)")
      .eq("employee_id", employee.id);

    const userRoles = empRoles?.map((r: any) => r.roles.code) || ["employee"];

    // System Admin bypass
    if (userRoles.includes("system_admin")) {
      return response;
    }

    // Bug B & C fix: Batch permission check (Union logic) — single RPC call
    // instead of N sequential has_permission calls per required permission.
    const { data: hasAnyAccess } = await supabase.rpc("has_any_permission", {
      perm_codes: routeGate.requiredPermissions,
    });

    if (!hasAnyAccess) {
      const forbiddenUrl = new URL(`/403?code=${encodeURIComponent(routeGate.requiredPermissions[0])}`, request.url);
      return NextResponse.redirect(forbiddenUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

