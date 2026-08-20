/**
 * Reports engine — pure CSV generation for executive report exports.
 *
 * Extracted from src/lib/actions/reports.ts. All row→CSV mappings are pure so
 * the export format (escaping, column order) is unit-testable.
 * Side-effect free.
 */

/**
 * Quotes a CSV field, doubling embedded quotes per RFC 4180.
 * When `alwaysQuote` is set the field is quoted even without special chars,
 * matching the historical export format produced by the reports action.
 */
export function csvCell(value: unknown, alwaysQuote = false): string {
  const str = value == null ? "" : String(value);
  if (alwaysQuote || /[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Joins cells into one CSV line, quoting each exactly once.
 * Pass `true` as the second tuple element to force-quote a string field.
 */
function line(cells: Array<[unknown, boolean?]>): string {
  return cells.map(([value, force]) => csvCell(value, force)).join(",");
}

/** Joins raw cells into one CSV line with RFC 4180 quoting. */
export function csvRow(cells: unknown[]): string {
  return cells.map((c) => csvCell(c)).join(",");
}

/** Builds a full CSV document from a header row and raw data rows. */
export function buildCsv(header: string[], rows: unknown[][]): string {
  return [csvRow(header), ...rows.map((r) => csvRow(r))].join("\n") + "\n";
}

export interface AttendanceSummaryRow {
  employee_id: string;
  full_name: string;
  employee_code: string;
  month_year: string;
  present_count: number;
  half_day_count: number;
  absent_count: number;
  extra_work_count: number;
  pending_review_count: number;
  total_work_hours: number;
}

/** rep-01 Attendance Summary export (reports.ts contract). */
export function buildAttendanceCsv(rows: AttendanceSummaryRow[]): string {
  const header = line([
    ["Employee ID"], ["Full Name"], ["Employee Code"], ["Month Year"],
    ["Present"], ["Half Day"], ["Absent"], ["Extra Work"],
    ["Pending Review"], ["Total Work Hours"],
  ]);
  const body = rows.map((r) =>
    line([
      [r.employee_id, true], [r.full_name, true], [r.employee_code, true],
      [r.month_year, true], [r.present_count], [r.half_day_count],
      [r.absent_count], [r.extra_work_count], [r.pending_review_count],
      [r.total_work_hours],
    ])
  );
  return [header, ...body].join("\n") + "\n";
}

export interface LeaveUtilizationRow {
  employee_id: string;
  full_name: string;
  employee_code: string;
  leave_type_code: string;
  leave_type_name: string;
  year: number;
  allocated_days: number;
  used_days: number;
  pending_days: number;
  current_balance: number;
}

/** rep-02 Leave Utilization export (reports.ts contract). */
export function buildLeaveCsv(rows: LeaveUtilizationRow[]): string {
  const header = line([
    ["Employee ID"], ["Full Name"], ["Employee Code"], ["Leave Type Code"],
    ["Leave Type Name"], ["Year"], ["Allocated Days"], ["Used Days"],
    ["Pending Days"], ["Current Balance"],
  ]);
  const body = rows.map((r) =>
    line([
      [r.employee_id, true], [r.full_name, true], [r.employee_code, true],
      [r.leave_type_code, true], [r.leave_type_name, true], [r.year],
      [r.allocated_days], [r.used_days], [r.pending_days], [r.current_balance],
    ])
  );
  return [header, ...body].join("\n") + "\n";
}

export interface StatutoryRow {
  employees?: { employee_code?: string | null; full_name?: string | null } | null;
  pan_number?: string | null;
  uan_number?: string | null;
  pf_applicable?: boolean;
  esi_applicable?: boolean;
  pt_state?: string | null;
  tax_regime?: string | null;
}

/** rep-03 Statutory Compliance Register export (reports.ts contract). */
export function buildStatutoryCsv(rows: StatutoryRow[]): string {
  const header = line([
    ["Employee Code"], ["Full Name"], ["PAN Number"], ["UAN Number"],
    ["PF Applicable"], ["ESI Applicable"], ["PT State"], ["Tax Regime"],
  ]);
  const body = rows.map((r) =>
    line([
      [r.employees?.employee_code || "", true],
      [r.employees?.full_name || "", true],
      [r.pan_number || "", true],
      [r.uan_number || "", true],
      [r.pf_applicable],
      [r.esi_applicable],
      [r.pt_state || "", true],
      [r.tax_regime || "", true],
    ])
  );
  return [header, ...body].join("\n") + "\n";
}

export interface PayrollRegisterRow {
  revision_number: number;
  employee_code: string;
  full_name: string;
  payable_units: number;
  lop_units: number;
  gross_earnings: number;
  total_deductions: number;
  net_pay: number;
  is_published: boolean;
}

/** rep-04 Payroll Register export (reports.ts contract). */
export function buildPayrollCsv(rows: PayrollRegisterRow[]): string {
  const header = line([
    ["Revision Number"], ["Employee Code"], ["Full Name"], ["Payable Units"],
    ["LOP Units"], ["Gross Earnings"], ["Total Deductions"], ["Net Pay"],
    ["Is Published"],
  ]);
  const body = rows.map((r) =>
    line([
      [r.revision_number], [r.employee_code, true], [r.full_name, true],
      [r.payable_units], [r.lop_units], [r.gross_earnings],
      [r.total_deductions], [r.net_pay], [r.is_published],
    ])
  );
  return [header, ...body].join("\n") + "\n";
}
