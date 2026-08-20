/**
 * Offboarding engine — pure calculation helpers for separation & F&F flows.
 *
 * Extracted from src/lib/actions/offboarding.ts and the offboarding page so
 * the LWD / F&F status-gating rules (FR §2.2–§2.3) are unit-testable.
 * This module is intentionally side-effect free so it can be imported from
 * both server actions and client components.
 */

/**
 * Computes the Last Working Day (LWD) = resignation date + notice period.
 *
 * Date-only strings are parsed as UTC midnight, so the arithmetic is
 * timezone-independent. Returns "" when the resignation date is invalid
 * (the inline code it replaces would have thrown a RangeError instead).
 */
export function computeLastWorkingDay(
  resignationDate: string,
  noticeDays: number
): string {
  const ms = new Date(resignationDate).getTime();
  if (Number.isNaN(ms)) return "";
  return new Date(ms + noticeDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

export type SeparationStatusAfterFf = "offboarded" | "active";

export interface FfApprovalOutcome {
  lwdReached: boolean;
  status: SeparationStatusAfterFf;
}

/**
 * Decides the separation status after an F&F approval: the separation is
 * marked "offboarded" only when the LWD has been reached AND F&F is approved.
 * A missing LWD counts as reached (backward compatible with prior behavior).
 *
 * `today` defaults to the current UTC date; inject it for deterministic tests.
 */
export function resolveFfApprovalOutcome(
  lastWorkingDay: string | null | undefined,
  today?: string
): FfApprovalOutcome {
  const todayStr = today ?? new Date().toISOString().split("T")[0];
  const lwdReached = lastWorkingDay ? lastWorkingDay <= todayStr : true;
  return { lwdReached, status: lwdReached ? "offboarded" : "active" };
}

export interface FfBreakdownInput {
  monthlyBasic: number;
  monthlyGross: number;
  dateOfJoining: string;
  lastWorkingDay: string;
  earnedLeaveBalance: number;
  mandatedNoticeDays: number;
  servedNoticeDays: number;
  unpaidSalaryDays?: number;
  pendingReimbursements?: number;
  assetRecoveryDues?: number;
}

export interface FfBreakdownResult {
  tenureYears: number;
  isGratuityEligible: boolean;
  gratuityAmount: number;
  leaveEncashmentAmount: number;
  noticeShortfallDays: number;
  noticeRecoveryAmount: number;
  unpaidSalaryAmount: number;
  pendingReimbursements: number;
  assetRecoveryDues: number;
  grossSettlement: number;
  totalDeductions: number;
  netSettlementAmount: number;
}

/**
 * Computes statutory Full & Final settlement breakdown (H-07).
 * - Gratuity (Payment of Gratuity Act 1972): 15/26 * basic * tenure for tenure >= 5 yrs
 * - Leave encashment: earned leave balance * daily basic rate
 * - Notice recovery: notice shortfall * daily gross rate
 */
export function computeFfSettlementBreakdown(
  input: FfBreakdownInput
): FfBreakdownResult {
  // 1. Calculate tenure in years
  const dojMs = new Date(input.dateOfJoining).getTime();
  const lwdMs = new Date(input.lastWorkingDay).getTime();
  const tenureDays = Math.max(0, (lwdMs - dojMs) / (1000 * 60 * 60 * 24));
  const tenureYears = Number((tenureDays / 365.25).toFixed(2));

  // 2. Gratuity calculation (Payment of Gratuity Act 1972)
  const isGratuityEligible = tenureYears >= 5.0;
  let gratuityAmount = 0;
  if (isGratuityEligible) {
    gratuityAmount = Math.round((15 * input.monthlyBasic * tenureYears) / 26);
  }

  // 3. Leave encashment (earned leave at daily basic)
  const dailyBasic = input.monthlyBasic / 30;
  const leaveEncashmentAmount = Math.round(
    Math.max(0, input.earnedLeaveBalance) * dailyBasic
  );

  // 4. Notice period shortfall recovery
  const dailyGross = input.monthlyGross / 30;
  const noticeShortfallDays = Math.max(
    0,
    input.mandatedNoticeDays - input.servedNoticeDays
  );
  const noticeRecoveryAmount = Math.round(noticeShortfallDays * dailyGross);

  // 5. Unpaid salary
  const unpaidSalaryDays = input.unpaidSalaryDays || 0;
  const unpaidSalaryAmount = Math.round(unpaidSalaryDays * dailyGross);

  // 6. Net settlement
  const pendingReimbursements = input.pendingReimbursements || 0;
  const assetRecoveryDues = input.assetRecoveryDues || 0;

  const grossSettlement =
    unpaidSalaryAmount +
    gratuityAmount +
    leaveEncashmentAmount +
    pendingReimbursements;

  const totalDeductions = noticeRecoveryAmount + assetRecoveryDues;
  const netSettlementAmount = Math.max(0, grossSettlement - totalDeductions);

  return {
    tenureYears,
    isGratuityEligible,
    gratuityAmount,
    leaveEncashmentAmount,
    noticeShortfallDays,
    noticeRecoveryAmount,
    unpaidSalaryAmount,
    pendingReimbursements,
    assetRecoveryDues,
    grossSettlement,
    totalDeductions,
    netSettlementAmount,
  };
}
