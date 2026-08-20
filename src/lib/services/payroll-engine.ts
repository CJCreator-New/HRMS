import { computeIndiaStatutoryDeductions } from "./statutory-engine";

export interface PayableUnitsParams {
  totalDaysInMonth: number;
  workedDays: number;
  paidLeaveDays: number;
  lopDays: number;
}

export function computePayableUnits(params: PayableUnitsParams) {
  // FR §3.6 / §5.3: payable_units = worked_units + paid_leave_units (clamped to totalDaysInMonth)
  const payableUnits = Math.min(params.totalDaysInMonth, params.workedDays + params.paidLeaveDays);
  const lopUnits = Math.max(0, params.totalDaysInMonth - payableUnits);

  return {
    payableUnits,
    lopUnits,
  };
}

export function computeMidMonthProRataSalary(
  oldCtc: number,
  newCtc: number,
  daysInMonth: number,
  splitDay: number
) {
  const oldMonthlyGross = Math.round(oldCtc / 12);
  const newMonthlyGross = Math.round(newCtc / 12);

  const oldDays = splitDay;
  const newDays = daysInMonth - splitDay;

  const oldEarned = Math.round((oldMonthlyGross / daysInMonth) * oldDays);
  const newEarned = Math.round((newMonthlyGross / daysInMonth) * newDays);

  return {
    oldDays,
    newDays,
    oldEarned,
    newEarned,
    totalGross: oldEarned + newEarned,
  };
}

export interface PayrollEligibilityRow {
  employee_id: string;
  is_eligible: boolean;
  effective_from?: string | null;
  effective_to?: string | null;
}

/**
 * Filters employees eligible for a payroll run within a period window (FR §2.1, §5.3).
 * An employee is excluded only by an explicit `is_eligible = false` override whose
 * effective window overlaps the period ([periodStart, periodEnd]).
 */
export function filterPayrollEligibleEmployees(
  employees: Array<{ id: string; full_name?: string; employee_code?: string; status?: string }>,
  eligibilityRows: PayrollEligibilityRow[] | null | undefined,
  periodStart: string,
  periodEnd: string
): { eligible: Array<{ id: string; full_name?: string; employee_code?: string; status?: string }>; excludedCount: number } {
  const ineligibleEmployeeIds = new Set(
    (eligibilityRows || [])
      .filter((row) => {
        if (row.is_eligible !== false) return false;
        if (!row.effective_from || row.effective_from > periodEnd) return false;
        if (row.effective_to != null && row.effective_to < periodStart) return false;
        return true;
      })
      .map((row) => row.employee_id)
  );

  const employeeList = employees || [];
  const eligible = employeeList.filter((e) => !ineligibleEmployeeIds.has(e.id));
  return { eligible, excludedCount: employeeList.length - eligible.length };
}

export interface SalaryStructureLike {
  monthly_ctc?: number | null;
  annual_ctc?: number | null;
}

/**
 * Resolves the effective monthly CTC for a payroll run.
 *
 * Preserves the historical resolution logic (annual CTC preferred over monthly).
 * Returns null when the structure is missing or unparseable, so callers can
 * block the payroll run instead of silently using a fallback salary.
 */
export function resolveMonthlyCtc(
  salStruct?: SalaryStructureLike | null
): number | null {
  if (!salStruct) return null;
  const raw = salStruct.annual_ctc ?? salStruct.monthly_ctc;
  if (raw == null || raw <= 0) return null;
  const monthlyCtc = salStruct.annual_ctc != null
    ? Number(salStruct.annual_ctc) / 12
    : Number(salStruct.monthly_ctc);
  return Number.isFinite(monthlyCtc) && monthlyCtc > 0 ? monthlyCtc : null;
}

export interface PayrollEmployeeRunInput {
  daysInMonth: number;
  /** attendance records with status present or extra_work */
  workedCount: number;
  /** attendance records with status half_day */
  halfDayCount: number;
  /** sum of approved leave total_days within the period */
  paidLeaveDays: number;
  monthlyCtc: number;
  ptState: string;
  taxRegime: "new_regime" | "old_regime";
  pfApplicable: boolean;
  esiApplicable: boolean;
}

export interface PayrollEmployeeRunResult {
  payableUnits: number;
  lopUnits: number;
  grossMonthly: number;
  basicMonthly: number;
  totalDeduction: number;
  netPay: number;
  pfEmployerAmount: number;
  esiEmployerAmount: number;
  lwfAmount: number;
}

/**
 * Computes a single employee's payroll run within a period (FR §3.6, §5.3):
 * aggregates worked / paid-leave / LOP units, pro-rates salary, applies the
 * statutory deduction engine, and returns the payslip figures.
 */
export function computeEmployeePayrollRun(
  input: PayrollEmployeeRunInput
): PayrollEmployeeRunResult {
  const workedDays = input.workedCount + input.halfDayCount * 0.5;
  const lopDays = Math.max(
    0,
    input.daysInMonth - (workedDays + input.paidLeaveDays)
  );

  const units = computePayableUnits({
    totalDaysInMonth: input.daysInMonth,
    workedDays: workedDays > 0 ? workedDays : input.daysInMonth - input.paidLeaveDays,
    paidLeaveDays: input.paidLeaveDays,
    lopDays: workedDays > 0 ? lopDays : 0,
  });

  const baseProRataFactor = units.payableUnits / input.daysInMonth;
  const grossMonthly = Math.round(input.monthlyCtc * baseProRataFactor);
  const basicMonthly = Math.round(input.monthlyCtc * 0.5 * baseProRataFactor);

  const deductions = computeIndiaStatutoryDeductions({
    basicMonthly,
    grossMonthly,
    ptState: input.ptState,
    taxRegime: input.taxRegime,
    pfApplicable: input.pfApplicable,
    esiApplicable: input.esiApplicable,
  });

  const netPay = Math.max(0, grossMonthly - deductions.totalDeduction);

  return {
    payableUnits: units.payableUnits,
    lopUnits: units.lopUnits,
    grossMonthly,
    basicMonthly,
    totalDeduction: deductions.totalDeduction,
    netPay,
    // Employer contributions (for statutory snapshot recording)
    pfEmployerAmount: deductions.pfEmployerAmount,
    esiEmployerAmount: deductions.esiEmployerAmount,
    lwfAmount: deductions.lwfAmount,
  };
}
