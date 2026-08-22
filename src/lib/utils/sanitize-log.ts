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
