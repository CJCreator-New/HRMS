/**
 * Sanitizes user-provided input strings before logging to prevent Log Injection (CRLF / CWE-117)
 * and mask sensitive patterns.
 */
export function sanitizeForLog(input: unknown): string {
  if (input === null || input === undefined) return "";
  const str = typeof input === "string" ? input : String(input);
  return str
    .replace(/[\r\n]/g, "\\n")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .slice(0, 500);
}

/**
 * Masks an email address to protect PII in application log telemetry.
 * Example: alice@company.com -> a***e@company.com
 */
export function maskEmail(email: unknown): string {
  if (!email || typeof email !== "string" || !email.includes("@")) return "[INVALID_EMAIL]";
  const [user, domain] = email.split("@");
  if (!user || user.length <= 2) {
    return `${user ? user[0] : "*"}***@${domain || "masked"}`;
  }
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

