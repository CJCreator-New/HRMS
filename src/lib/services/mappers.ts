/**
 * Data mappers — pure row → view-model transformations.
 *
 * Extracted from src/lib/actions/data.ts and src/lib/actions/approvals.ts so
 * the mapping rules are unit-testable and shared with client code.
 * Side-effect free.
 */

// ---------------------------------------------------------------------------
// Separation / offboarding view model
// ---------------------------------------------------------------------------

export interface SeparationRow {
  id: string;
  employees?: { employee_code?: string | null; full_name?: string | null } | null;
  separation_type?: string | null;
  resignation_date?: string | null;
  created_at?: string | null;
  notice_period_days?: number | null;
  last_working_day?: string | null;
  status?: string | null;
  ff_settlement_records?: {
    status?: string | null;
    is_stale?: boolean | null;
    leave_encashment_amount?: number | null;
    asset_recovery_amount?: number | null;
    net_settlement_amount?: number | null;
    ff_clearances?: Array<{
      department_name: string;
      is_cleared: boolean;
    }> | null;
  } | null;
}

export type ClearanceKey = "it" | "finance" | "admin" | "hr";

export interface SeparationViewModel {
  id: string;
  employee_code: string;
  employee_name: string;
  type: string;
  resignation_date: string;
  notice_days: number;
  last_working_day: string;
  status: string;
  ff_status: string;
  is_stale: boolean;
  encashment_amount: number;
  asset_recovery_amount: number;
  net_settlement: number;
  clearance: Record<ClearanceKey, boolean>;
}

const EMPTY_CLEARANCE: Record<ClearanceKey, boolean> = {
  it: false,
  finance: false,
  admin: false,
  hr: false,
};

/** Maps a raw separation row (with embedded F&F + clearances) to the UI view model. */
export function mapSeparationToViewModel(
  s: SeparationRow
): SeparationViewModel {
  const ff = s.ff_settlement_records;
  const clearances = (ff?.ff_clearances || []).reduce(
    (acc, c) => {
      acc[c.department_name.toLowerCase() as ClearanceKey] = c.is_cleared;
      return acc;
    },
    { ...EMPTY_CLEARANCE }
  );

  return {
    id: s.id,
    employee_code: s.employees?.employee_code || "",
    employee_name: s.employees?.full_name || "",
    type: s.separation_type || "resignation",
    resignation_date: s.resignation_date || s.created_at?.split("T")[0] || "",
    notice_days: s.notice_period_days || 30,
    last_working_day: s.last_working_day || "",
    status: s.status === "offboarded" ? "completed" : s.status || "active",
    ff_status: ff?.status || "draft",
    is_stale: ff?.is_stale || false,
    encashment_amount: Number(ff?.leave_encashment_amount || 0),
    asset_recovery_amount: Number(ff?.asset_recovery_amount || 0),
    net_settlement: Number(ff?.net_settlement_amount || 0),
    clearance: clearances,
  };
}

// ---------------------------------------------------------------------------
// Global search fallback mapping
// ---------------------------------------------------------------------------

export interface SearchableEmployee {
  id: string;
  full_name: string;
  employee_code: string;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  status?: string | null;
}

export interface SearchResult {
  id: string;
  type: "employee";
  label: string;
  sub: string;
  href: string;
  status?: string | null;
}

/** Maps an employee row to the global-search result shape (fallback path). */
export function mapEmployeeToSearchResult(
  e: SearchableEmployee
): SearchResult {
  return {
    id: e.id,
    type: "employee",
    label: e.full_name,
    sub: `${e.employee_code} · ${e.department || ""}`,
    href: "/employees",
    status: e.status,
  };
}

// ---------------------------------------------------------------------------
// Approvals module mapping
// ---------------------------------------------------------------------------

export type ApprovalModule =
  | "leave"
  | "attendance"
  | "reimbursement"
  | "encashment"
  | "offboarding"
  | "permissions"
  | "compoff";

export const APPROVAL_MODULE_MAP: Record<string, ApprovalModule> = {
  leave_request: "leave",
  attendance_correction: "attendance",
  reimbursement_claim: "reimbursement",
  leave_encashment: "encashment",
  ff_settlement: "offboarding",
  permission_request: "permissions",
  comp_off_grant: "compoff",
  leave: "leave",
  attendance: "attendance",
  reimbursement: "reimbursement",
  encashment: "encashment",
  offboarding: "offboarding",
  permissions: "permissions",
  compoff: "compoff",
};

export function resolveApprovalModule(
  requestType: string,
  fallback?: string
): ApprovalModule | string {
  return APPROVAL_MODULE_MAP[requestType] || fallback || "leave";
}

/** Inverse map — UI module name → the view's `request_type` value (for filters). */
export const REQUEST_TYPE_BY_MODULE: Record<string, string> = {
  leave: "leave_request",
  attendance: "attendance_correction",
  reimbursement: "reimbursement_claim",
  encashment: "leave_encashment",
  offboarding: "ff_settlement",
  permissions: "permission_request",
  compoff: "comp_off_grant",
};

export const MODULE_APPROVE_PERMS: Record<string, string[]> = {
  leave: ["leave.approve.hr", "leave.approve.manager"],
  leave_request: ["leave.approve.hr", "leave.approve.manager"],
  attendance: ["attendance.correct.approve"],
  attendance_correction: ["attendance.correct.approve"],
  reimbursement: ["reimbursement.approve"],
  reimbursement_claim: ["reimbursement.approve"],
  encashment: ["leave.encash.approve"],
  leave_encashment: ["leave.encash.approve"],
  offboarding: ["ff.approve"],
  ff_settlement: ["ff.approve"],
  permissions: ["leave.approve.manager", "leave.approve.hr", "permission.approve"],
  permission_request: ["leave.approve.manager", "leave.approve.hr", "permission.approve"],
  compoff: ["compoff.approve", "leave.approve.manager", "leave.approve.hr"],
  comp_off_grant: ["compoff.approve", "leave.approve.manager", "leave.approve.hr"],
};

export const APPROVAL_TABLE_MAP: Record<string, string> = {
  leave: "leave_requests",
  leave_request: "leave_requests",
  attendance: "attendance_corrections",
  attendance_correction: "attendance_corrections",
  reimbursement: "reimbursement_claims",
  reimbursement_claim: "reimbursement_claims",
  encashment: "leave_encashment_requests",
  leave_encashment: "leave_encashment_requests",
  offboarding: "ff_settlement_records",
  ff_settlement: "ff_settlement_records",
  permissions: "permission_requests",
  permission_request: "permission_requests",
  compoff: "comp_off_grants",
  comp_off_grant: "comp_off_grants",
};

export interface ApprovalRow {
  request_id?: string | null;
  id?: string | null;
  request_type?: string | null;
  module?: string | null;
  employee_name?: string | null;
  item_name?: string | null;
  created_at?: string | null;
  status?: string | null;
}

export interface ApprovalItem {
  id: string;
  module: string;
  employee_name: string;
  summary: string;
  submitted_date: string;
  amount_or_duration: string;
  status: string;
}

/** Maps an approval queue row to the unified approvals view-model shape. */
export function mapApprovalRowToItem(row: ApprovalRow): ApprovalItem {
  return {
    id: row.request_id || row.id || "",
    module: resolveApprovalModule(row.request_type || "", row.module || undefined),
    employee_name: row.employee_name || "Employee",
    summary: row.item_name || "Pending Request",
    submitted_date: row.created_at ? row.created_at.split("T")[0] : "",
    amount_or_duration: row.item_name || "-",
    status: row.status || "pending",
  };
}
