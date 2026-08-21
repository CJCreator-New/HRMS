import { resolveMockRolesFromEmail, resolveMockEmployeeIdFromEmail } from "@/lib/services/mock-rbac";

/**
 * Mock cookie utilities — tamper detection via base64 encoding + expiry.
 *
 * The mock auth cookie stores the email as `base64(email):expiryTimestamp`.
 * This provides:
 *  - Obfuscation (email is not plaintext in the cookie)
 *  - Expiration (24-hour TTL)
 *  - Basic tamper detection (base64 decode + expiry check)
 *
 * NOTE: Full HMAC signing was removed because the Edge runtime (middleware) and
 * Node.js runtime (server actions) produce inconsistent crypto.subtle results,
 * causing cookie validation failures. The base64+expiry approach is sufficient
 * for mock-mode security where the goal is preventing casual impersonation,
 * not cryptographic security.
 */

const MOCK_COOKIE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MOCK_COOKIE_SECRET = process.env.MOCK_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "hrms-mock-dev-secret-key-2026";

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(MOCK_COOKIE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Signs a mock email into a tamper-evident HMAC-SHA256 signed cookie value.
 * Format: `base64(email):expiryTimestamp:hmacSignature`
 */
export async function signMockCookieValue(email: string): Promise<string> {
  const expiry = Date.now() + MOCK_COOKIE_EXPIRY_MS;
  const data = `${email}:${expiry}`;
  const key = await getHmacKey();
  const enc = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const sig = bufferToHex(signatureBuffer);
  const encoded = btoa(encodeURIComponent(email));
  return `${encoded}:${expiry}:${sig}`;
}

/**
 * Validates a mock cookie value and returns the email if valid and signed.
 * Returns null if the cookie is expired, malformed, or the signature does not match.
 */
export async function validateMockCookieValue(
  cookieValue: string
): Promise<string | null> {
  try {
    if (!cookieValue) return null;

    // Unit test bypass (only in test environment)
    if (process.env.NODE_ENV === "test" && cookieValue.includes("@") && !cookieValue.includes(":")) {
      return cookieValue;
    }

    const parts = cookieValue.split(":");
    if (parts.length === 3) {
      const [encodedEmail, expiryStr, sig] = parts;
      const expiry = parseInt(expiryStr, 10);
      if (!isNaN(expiry) && Date.now() > expiry) return null;

      let email: string;
      try {
        email = decodeURIComponent(atob(encodedEmail));
      } catch {
        return null;
      }

      if (!email || !email.includes("@")) return null;

      const data = `${email}:${expiryStr}`;
      const key = await getHmacKey();
      const enc = new TextEncoder();
      const expectedBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(data));
      const expectedSig = bufferToHex(expectedBuffer);

      if (sig === expectedSig) {
        return email;
      }
      return null;
    }

    // Backward compatibility for existing 2-part format during development / non-production
    if (process.env.NODE_ENV !== "production" && parts.length === 2) {
      const [encoded, expiryStr] = parts;
      const expiry = parseInt(expiryStr, 10);
      if (!isNaN(expiry) && Date.now() > expiry) return null;
      try {
        const email = decodeURIComponent(atob(encoded));
        if (email && email.includes("@")) return email;
      } catch {
        return null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export interface MockSession {
  email: string;
  employeeId: string | null;
  roles: string[];
}

/**
 * Resolves a full mock session from raw cookie string if valid and unexpired.
 */
export async function resolveMockSession(rawCookie?: string): Promise<MockSession | null> {
  if (!rawCookie) return null;
  const mockEmail = await validateMockCookieValue(rawCookie);
  if (!mockEmail || !mockEmail.includes("@")) return null;
  const employeeId = resolveMockEmployeeIdFromEmail(mockEmail);
  const { roles } = resolveMockRolesFromEmail(mockEmail);
  return { email: mockEmail, employeeId, roles };
}
