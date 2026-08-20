/**
 * Shared input sanitization utility for HRMS v2.7 (L-03).
 * Canonical implementation lives in @/lib/security.ts.
 * This file re-exports for backward compatibility.
 */
export { sanitizeInput, sanitizeFields } from "@/lib/security";
