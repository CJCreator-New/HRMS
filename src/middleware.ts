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

/** Builds a Content-Security-Policy header with nonce-based script allowlisting and CDN allowances. */
function buildCspHeader(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://*.jsdelivr.net https://apis.google.com https://*.google.com https://*.gstatic.com https://*.googleapis.com`,
    `script-src-elem 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://*.jsdelivr.net https://apis.google.com https://*.google.com https://*.gstatic.com https://*.googleapis.com`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://*.jsdelivr.net`,
    `style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://*.jsdelivr.net`,
    "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com https://*.unsplash.com https://cdn.jsdelivr.net https://*.jsdelivr.net https://*.gstatic.com https://*.google.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://*.jsdelivr.net https://*.google.com https://*.googleapis.com https://*.googleusercontent.com",
    "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://*.jsdelivr.net",
    "frame-src 'self' https://*.google.com https://*.run.app",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
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

  let user = null;
  try {
    const userRes = await supabase.auth.getUser();
    user = userRes?.data?.user || null;
  } catch {
    user = null;
  }

  const mockToken = request.cookies.get("sb-access-token")?.value;
  let validMockEmail: string | null = null;
  if (mockToken) {
    validMockEmail = await validateMockCookieValue(mockToken);
  }

  // 1. Unauthenticated redirect to /login
  if (!user && !validMockEmail && pathname !== "/login") {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 2a. Mock-mode RBAC: real user session is absent but valid mock token is present.
  //     Validate expiration and enforce access control via the static E2E RBAC table.
  if (!user && validMockEmail) {
    if (!isMockEmailAllowed(validMockEmail, pathname)) {
      const forbiddenUrl = new URL("/403", request.url);
      return NextResponse.redirect(forbiddenUrl);
    }
    return response;
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

