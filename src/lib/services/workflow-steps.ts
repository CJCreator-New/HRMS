/**
 * Guided workflow step mappings (WS-C §C1–§C3).
 *
 * Pure functions deriving the active Stepper index from domain state so the
 * FLW E2E specs and unit tests share one source of truth. No side effects.
 */

// ---------------------------------------------------------------------------
// Payroll cycle (FLW-01 / FLW-02)
// ---------------------------------------------------------------------------

export const PAYROLL_STEPS = [
  "Period & Eligibility",
  "Validate Lock",
  "Execute Run",
  "Review Payslips",
  "Finalize & Publish",
];

/** Maps a `payroll_periods.status` value to a 0-based Stepper index. */
export function payrollStepIndex(status: string | undefined): number {
  switch (status) {
    case "processing":
      return 2; // step 3 — Execute Run
    case "validated":
      return 3; // step 4 — Review Payslips
    case "finalized":
    case "published":
      return 4; // step 5 — Finalize & Publish
    default:
      return 0; // draft / unknown — step 1
  }
}

// ---------------------------------------------------------------------------
// Offboarding / F&F lifecycle (FLW-03)
// ---------------------------------------------------------------------------

export const OFFBOARDING_STEPS = [
  "Resignation",
  "Notice Period",
  "Clearance",
  "F&F Draft",
  "Approval",
];

export interface SeparationFlowState {
  status: string;
  ff_status: string;
  clearance: Record<string, boolean>;
}

/** Maps the separation FSM state to a 0-based Stepper index. */
export function offboardingStepIndex(sep: SeparationFlowState | null): number {
  if (!sep) return 0; // step 1 — no separation yet
  switch (sep.status) {
    case "completed":
      return 4; // step 5 — Approval done
    case "pending":
    case "rescinded":
      return 0; // step 1 — resignation (re)initiated
    default: {
      // active
      if (["approved", "paid", "pending_approval"].includes(sep.ff_status)) return 4; // step 5
      const cleared = Object.values(sep.clearance);
      if (cleared.every(Boolean)) return 3; // step 4 — F&F draft ready
      if (cleared.some(Boolean)) return 2; // step 3 — clearances in progress
      return 1; // step 2 — notice period
    }
  }
}
