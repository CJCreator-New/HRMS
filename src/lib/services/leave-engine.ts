/**
 * Leave engine — pure calculation helpers for leave & permission flows.
 *
 * Extracted from src/lib/actions/leave.ts and src/lib/actions/permissions.ts
 * so entitlement date math and duration rules are unit-testable.
 * Side-effect free; safe to import from server actions and client code.
 */

/**
 * Computes the comp-off expiry date = extra-work date + 90-day validity window.
 * Returns "" for an invalid worked date.
 */
export function computeCompOffExpiryDate(
  workedDate: string,
  validityDays: number = 90
): string {
  const ms = new Date(workedDate).getTime();
  if (Number.isNaN(ms)) return "";
  return new Date(ms + validityDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

/**
 * Computes a short-permission duration in minutes from "HH:MM" times.
 * Returns a negative number when endTime precedes startTime.
 */
export function computePermissionDurationMinutes(
  startTime: string,
  endTime: string
): number {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":");
    return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
  };
  return toMinutes(endTime) - toMinutes(startTime);
}
