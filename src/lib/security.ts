/**
 * Security utilities — CSRF protection and input sanitization for server actions.
 *
 * These are lightweight guards that can be applied to any server action
 * without adding external dependencies.
 */

import { headers } from "next/headers";

/**
 * Validates that the request origin matches the application URL.
 * Call this at the start of any mutating server action to prevent CSRF.
 *
 * In mock-mode (NEXT_PUBLIC_MOCK_AUTH=true), this check is skipped since
 * Supabase's built-in CSRF protections don't apply.
 */
export async function validateRequestOrigin(): Promise<{ error: string } | null> {
  // Skip CSRF validation in test environment or mock mode
  if (
    process.env.NODE_ENV === "test" ||
    (process.env.NEXT_PUBLIC_MOCK_AUTH === "true" && process.env.NODE_ENV !== "production")
  ) {
    return null;
  }

  let headersList: Headers | null = null;
  try {
    headersList = (await headers()) as unknown as Headers;
  } catch {
    // Called outside request scope (e.g. unit test or background action) — allow
    return null;
  }

  const origin = headersList?.get("origin");
  const forwardedHost = headersList?.get("x-forwarded-host");
  const host = headersList?.get("host");

  if (!origin) {
    // Server-to-server call or missing origin (standard Next.js server action dispatch) — allow
    return null;
  }

  try {
    const originUrl = new URL(origin);
    // In reverse proxy environments (e.g. Cloud Run, preview container), match forwarded-host or host
    if (forwardedHost) {
      const primaryForwarded = forwardedHost.split(",")[0].trim();
      if (originUrl.host === primaryForwarded || originUrl.host.split(":")[0] === primaryForwarded.split(":")[0]) {
        return null;
      }
    }

    if (host) {
      if (originUrl.host === host || originUrl.host.split(":")[0] === host.split(":")[0]) {
        return null;
      }
    }

    // Allow localhost or container preview domains
    if (
      originUrl.hostname === "localhost" ||
      originUrl.hostname === "127.0.0.1" ||
      originUrl.hostname.endsWith(".run.app")
    ) {
      return null;
    }

    return { error: "CSRF validation failed: origin mismatch." };
  } catch {
    return { error: "CSRF validation failed: invalid origin header." };
  }
}

/**
 * Sanitizes a user-generated string by stripping HTML/script tags and escaping
 * special characters. Safe for storage and rendering (L-03).
 */
export function sanitizeInput(input: string | null | undefined): string {
  if (!input) return "";

  return String(input)
    // Strip script and style tags first (prevents nested-bypass attacks)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    // Strip all remaining HTML tags
    .replace(/<[^>]+>/g, "")
    // Escape HTML entities
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

/**
 * Sanitizes multiple string fields from an object.
 * Pass the field names that contain user-generated text.
 */
export function sanitizeFields(
  data: Record<string, any>,
  fields: string[]
): Record<string, any> {
  const sanitized = { ...data };
  for (const field of fields) {
    if (typeof sanitized[field] === "string") {
      sanitized[field] = sanitizeInput(sanitized[field]);
    }
  }
  return sanitized;
}
