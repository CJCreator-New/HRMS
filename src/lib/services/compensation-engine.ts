/**
 * Compensation engine — pure salary & encashment calculation helpers.
 *
 * Extracted from src/lib/actions/encashment.ts and src/lib/actions/salary.ts.
 * Side-effect free; safe to import from server actions and client code.
 */

/**
 * Computes leave-encashment amounts using the divisor-26 daily rate (FR §4.10):
 * daily_rate = basic/26 (rounded to 2 decimals), total = daily_rate × days.
 */
export function computeEncashmentAmount(
  basicMonthlySalary: number,
  daysToEncash: number
): { dailyRate: number; totalAmount: number } {
  const dailyRate = Math.round((basicMonthlySalary / 26) * 100) / 100;
  const totalAmount = Math.round(dailyRate * daysToEncash);
  return { dailyRate, totalAmount };
}

/**
 * Derives the monthly gross (annual/12) and basic (50% of gross) figures
 * used when creating a salary structure.
 */
export function computeSalaryBreakdown(annualCtc: number): {
  monthlyGross: number;
  basicMonthly: number;
} {
  const monthlyGross = Math.round(annualCtc / 12);
  const basicMonthly = Math.round(monthlyGross * 0.5);
  return { monthlyGross, basicMonthly };
}

/**
 * Returns the calendar day before `dateStr` (ISO date), used to close out the
 * previously-open salary structure. Returns "" for an invalid date.
 */
export function previousDate(dateStr: string): string {
  const ms = new Date(dateStr).getTime();
  if (Number.isNaN(ms)) return "";
  return new Date(ms - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}
