/**
 * Business Date and Timezone Utilities for HRMS v2.7
 * Timezone: Asia/Kolkata (IST, UTC+5:30)
 *
 * Prevents UTC ISO serialization drift on calendar and payroll dates.
 */

export const BUSINESS_TIMEZONE = "Asia/Kolkata";

/**
 * Returns today's calendar date as YYYY-MM-DD in Asia/Kolkata timezone.
 */
export function getTodayDateStringIST(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/**
 * Returns the start date of a month as YYYY-MM-DD (e.g. 2026-03 -> 2026-03-01).
 */
export function getMonthStartDateString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * Returns the number of days in a given month.
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Returns the end date of a month as YYYY-MM-DD (e.g. 2026-03 -> 2026-03-31, 2026-02 -> 2026-02-28, 2028-02 -> 2028-02-29).
 * Never converts local midnight via toISOString().
 */
export function getMonthEndDateString(year: number, month: number): string {
  const days = getDaysInMonth(year, month);
  return `${year}-${String(month).padStart(2, "0")}-${String(days).padStart(2, "0")}`;
}

/**
 * Returns the calendar date string (YYYY-MM-DD) for the day before dateStr.
 */
export function previousDateString(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return "";
  const [year, month, day] = parts;
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - 1);
  const prevYear = d.getUTCFullYear();
  const prevMonth = String(d.getUTCMonth() + 1).padStart(2, "0");
  const prevDay = String(d.getUTCDate()).padStart(2, "0");
  return `${prevYear}-${prevMonth}-${prevDay}`;
}

/**
 * Formats a Date or date string to YYYY-MM-DD in Asia/Kolkata timezone.
 */
export function formatDateStringIST(date: Date | string | null | undefined): string {
  if (!date) return getTodayDateStringIST();
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return getTodayDateStringIST();
  return getTodayDateStringIST(d);
}
