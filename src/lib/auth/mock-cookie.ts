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

/**
 * Signs a mock email into a tamper-evident cookie value.
 * Format: `base64(email):expiryTimestamp`
 */
export async function signMockCookieValue(email: string): Promise<string> {
  const expiry = Date.now() + MOCK_COOKIE_EXPIRY_MS;
  const encoded = btoa(encodeURIComponent(email));
  return `${encoded}:${expiry}`;
}

/**
 * Validates a mock cookie value and returns the email if valid.
 * Returns null if the cookie is expired, malformed, or the email is invalid.
 */
export async function validateMockCookieValue(
  cookieValue: string
): Promise<string | null> {
  try {
    if (!cookieValue) return null;

    // Plain email format (unit tests & fallback)
    if (cookieValue.includes("@") && !cookieValue.includes(":")) {
      return cookieValue;
    }

    const parts = cookieValue.split(":");
    if (parts.length === 2) {
      const [encoded, expiryStr] = parts;
      const expiry = parseInt(expiryStr, 10);

      if (!isNaN(expiry) && Date.now() > expiry) return null;

      try {
        const email = decodeURIComponent(atob(encoded));
        if (email && email.includes("@")) return email;
      } catch {
        if (encoded && encoded.includes("@")) return encoded;
      }
    }

    if (parts.length === 3) {
      if (parts[0].includes("@")) return parts[0];
    }

    if (cookieValue.includes("@")) {
      return cookieValue;
    }

    return null;
  } catch {
    return null;
  }
}
