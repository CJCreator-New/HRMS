"use server";

import { createClient } from "@/lib/supabase/server";
import {
  APPROVAL_TABLE_MAP,
  MODULE_APPROVE_PERMS,
  REQUEST_TYPE_BY_MODULE,
  mapApprovalRowToItem,
} from "@/lib/services/mappers";
import { assertPermission, assertAnyPermission, getAuthenticatedCaller } from "@/lib/auth/assertPermission";
import { formatDateIndian } from "@/lib/utils/formatters";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";
import type { RoleCode } from "@/lib/types";

export async function getPendingApprovalsCountAction(roleFocus?: RoleCode) {
  const supabase = await createClient();
  const caller = await getAuthenticatedCaller();

  if (roleFocus === "employee") {
    return { count: 0 };
  }

  let query = supabase
    .from("v_pending_approvals_dashboard")
    .select("id", { count: "exact", head: true });

  if (roleFocus === "manager" && caller?.employeeId) {
    const { data: teamEmps } = await supabase
      .from("employees")
      .select("id")
      .eq("manager_id", caller.employeeId);

    const teamIds = (teamEmps || []).map((e: { id: string }) => e.id);
    if (teamIds.length === 0) {
      return { count: 0 };
    }
    query = query.in("employee_id", teamIds);
  }

  const { count, error } = await query;

  if (error) return { count: 0 };
  return { count: count || 0 };
}

export interface ApprovalsQueryOptions {
  /** 1-based page number — when omitted, returns the full unpaginated set. */
  page?: number;
  pageSize?: number;
  /** Module name filter (e.g. "leave", "attendance") — maps to request_type. */
  module?: string;
  sort?: { column: string; dir: "asc" | "desc" };
}

const APPROVAL_SORT_COLUMNS: Record<string, string> = {
  employee_name: "employee_name",
  created_at: "created_at",
  status: "status",
  request_type: "request_type",
};

/**
 * Unified approvals inbox query (M-09). When `page` is provided, performs a
 * server-side count + ranged fetch; otherwise returns the full set.
 */
export async function getUnifiedApprovalsAction(opts: ApprovalsQueryOptions = {}) {
  const { page, pageSize = 25, module, sort } = opts;
  const paginated = typeof page === "number" && page > 0;
  const supabase = await createClient();

  let query = supabase
    .from("v_pending_approvals_dashboard")
    .select("*", { count: "exact" });

  if (module && module !== "all") {
    const requestType = REQUEST_TYPE_BY_MODULE[module];
    if (requestType) query = query.eq("request_type", requestType);
  }

  const sortCol =
    sort && APPROVAL_SORT_COLUMNS[sort.column] ? APPROVAL_SORT_COLUMNS[sort.column] : "created_at";
  query = query.order(sortCol, {
    // Default newest-first for the inbox (matches the previous behavior).
    ascending: sort?.dir ? sort.dir !== "desc" : false,
  });

  if (paginated) {
    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);
  }

  const { data, error, count } = await query;
  if (error) return { error: error.message, items: [], total: 0, pendingCount: 0 };

  const mappedItems = (data || []).map((row: Parameters<typeof mapApprovalRowToItem>[0]) => mapApprovalRowToItem(row));

  // Count total pending items across all pages for the active filter
  let pendingCount = count || 0;
  if (data && data.some((r: { status?: string | null }) => r.status !== "pending")) {
    const { count: pendingTotal } = await supabase
      .from("v_pending_approvals_dashboard")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    pendingCount = pendingTotal || 0;
  }

  return { items: mappedItems, total: count || 0, pendingCount };
}

export async function decideApprovalAction(
  module: string,
  recordId: string,
  decision: "approved" | "rejected",
  remarks?: string
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  if (remarks) remarks = sanitizeInput(remarks);

  const perms = MODULE_APPROVE_PERMS[module];
  if (perms) {
    const permError = await assertAnyPermission(perms);
    if (permError) return permError;
  }

  const supabase = await createClient();

  // Get current employee (acting approver)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthenticated" };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!emp) return { error: "Employee record not found" };

  const table = APPROVAL_TABLE_MAP[module];
  if (!table) return { error: `Unknown module: ${module}` };

  // --- Approver identity verification (APP-01) ---
  // For modules with an assigned_approver_id, verify the acting employee is the
  // assigned approver (or HR/System Admin bypass). This prevents any manager with
  // the approve permission from approving requests they weren't assigned to.
  if (module === "reimbursement" || module === "reimbursement_claim") {
    const { data: claim } = await supabase
      .from("reimbursement_claims")
      .select("approver_id, status")
      .eq("id", recordId)
      .single();
    if (claim?.approver_id && claim.approver_id !== emp.id) {
      // Allow HR admin bypass
      const hrError = await assertAnyPermission(["reimbursement.approve", "settings.manage"]);
      const isHrBypass = hrError === null && (await assertPermission("settings.manage")) === null;
      if (!isHrBypass) {
        return { error: "You are not the assigned approver for this request." };
      }
    }
  } else if (module === "permissions" || module === "permission_request") {
    const { data: permReq } = await supabase
      .from("permission_requests")
      .select("approver_id")
      .eq("id", recordId)
      .single();
    if (permReq?.approver_id && permReq.approver_id !== emp.id) {
      const hrError = await assertPermission("settings.manage");
      if (hrError) {
        return { error: "You are not the assigned approver for this request." };
      }
    }
  } else if (module === "compoff" || module === "comp_off_grant") {
    const { data: compoff } = await supabase
      .from("comp_off_grants")
      .select("approver_id")
      .eq("id", recordId)
      .single();
    if (compoff?.approver_id && compoff.approver_id !== emp.id) {
      const hrError = await assertPermission("settings.manage");
      if (hrError) {
        return { error: "You are not the assigned approver for this request." };
      }
    }
  } else if (module === "attendance" || module === "attendance_correction") {
    const { data: corr } = await supabase
      .from("attendance_corrections")
      .select("approver_id")
      .eq("id", recordId)
      .single();
    if (corr?.approver_id && corr.approver_id !== emp.id) {
      const hrError = await assertPermission("settings.manage");
      if (hrError) {
        return { error: "You are not the assigned approver for this request." };
      }
    }
  } else if (module === "offboarding" || module === "ff_settlement") {
    const { data: ff } = await supabase
      .from("ff_settlement_records")
      .select("approved_by")
      .eq("id", recordId)
      .single();
    if (ff?.approved_by && ff.approved_by !== emp.id) {
      const hrError = await assertPermission("settings.manage");
      if (hrError) {
        return { error: "You are not the assigned approver for this request." };
      }
    }
  }

  // --- Two-stage reimbursement routing (F6 / D11) ---
  // If a manager approves a pending_manager reimbursement claim, advance it
  // to pending_hr instead of final approved — the HR stage must still sign off.
  let effectiveStatus: string = decision;
  if (module === "reimbursement" || module === "reimbursement_claim") {
    const { data: claim } = await supabase
      .from("reimbursement_claims")
      .select("status, reimbursement_categories!inner(approval_route)")
      .eq("id", recordId)
      .single();

    const claimRecord = claim as { status?: string; reimbursement_categories?: { approval_route?: string } } | null;
    const claimStatus = claimRecord?.status;
    const approvalRoute = claimRecord?.reimbursement_categories?.approval_route;

    if (
      decision === "approved" &&
      claimStatus === "pending_manager" &&
      approvalRoute === "manager_then_hr"
    ) {
      // Manager approved stage 1 → advance to HR stage 2
      effectiveStatus = "pending_hr";
    }
  }

  const { error } = await supabase
    .from(table)
    .update({
      status: effectiveStatus,
      updated_at: new Date().toISOString(),
      ...(module.includes("attendance") ? { decided_by: emp.id, decided_at: new Date().toISOString() } : {}),
    })
    .eq("id", recordId);

  if (error) return { error: error.message };

  // Leave approval stage record
  if (module.includes("leave")) {
    await supabase
      .from("leave_request_approvals")
      .update({
        status: decision,
        remarks,
        decided_at: new Date().toISOString(),
      })
      .eq("leave_request_id", recordId)
      .eq("approver_id", emp.id);
  }

  return { success: true };
}

/** Normalized label/value detail row for the read-only drawer (F-03). */
export interface ApprovalDetailField {
  label: string;
  value: string;
}

const fmtCurrency = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(v);

const fmtDate = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return formatDateIndian(d);
};

/**
 * Fetches the underlying source record for an approval inbox row so the detail
 * drawer can show dates, reason, requester and amounts before Approve/Reject.
 * Read-only; gated by the module's approve permissions.
 */
export async function getApprovalDetailAction(module: string, recordId: string) {
  const perms = MODULE_APPROVE_PERMS[module];
  if (perms) {
    const permError = await assertAnyPermission(perms);
    if (permError) return permError;
  }

  const supabase = await createClient();

  let fields: ApprovalDetailField[] = [];

  try {
    if (module === "leave") {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("start_date, end_date, total_days, duration_type, reason, created_at, leave_types(name, code)")
        .eq("id", recordId)
        .single();
      if (error) return { error: error.message };

      const row = data as {
        start_date?: string | null;
        end_date?: string | null;
        total_days?: number | null;
        duration_type?: string | null;
        reason?: string | null;
        created_at?: string | null;
        leave_types?: { name?: string | null; code?: string | null } | null;
      } | null;

      const rawTypeName = row?.leave_types?.name || "—";
      const rawTypeCode = (row?.leave_types?.code || "").toUpperCase();
      const isParental =
        rawTypeCode === "MATERNITY" ||
        rawTypeCode === "PATERNITY" ||
        rawTypeName.toLowerCase().includes("maternity") ||
        rawTypeName.toLowerCase().includes("paternity");

      let displayTypeName = rawTypeName;
      let displayReason = row?.reason || "—";

      if (isParental) {
        const canViewAll = (await assertPermission("leave.view.all")) === null;
        if (!canViewAll) {
          displayTypeName = "Parental Leave";
          displayReason = "[Confidential Medical Reason Redacted]";
        }
      }

      fields = [
        { label: "Leave Type", value: displayTypeName },
        { label: "From", value: fmtDate(row?.start_date) },
        { label: "To", value: fmtDate(row?.end_date) },
        { label: "Duration", value: `${row?.total_days ?? "—"} day(s) (${row?.duration_type || "—"})` },
        { label: "Reason", value: displayReason },
        { label: "Submitted", value: fmtDate(row?.created_at) },
      ];
    } else if (module === "attendance") {
      const { data, error } = await supabase
        .from("attendance_corrections")
        .select("requested_status, requested_check_in, requested_check_out, reason, created_at")
        .eq("id", recordId)
        .single();
      if (error) return { error: error.message };

      const row = data as {
        requested_status?: string | null;
        requested_check_in?: string | null;
        requested_check_out?: string | null;
        reason?: string | null;
        created_at?: string | null;
      } | null;

      fields = [
        { label: "Requested Status", value: row?.requested_status || "—" },
        { label: "Requested Check-In", value: fmtDate(row?.requested_check_in) },
        { label: "Requested Check-Out", value: fmtDate(row?.requested_check_out) },
        { label: "Reason", value: row?.reason || "—" },
        { label: "Submitted", value: fmtDate(row?.created_at) },
      ];
    } else if (module === "reimbursement") {
      const { data, error } = await supabase
        .from("reimbursement_claims")
        .select("claim_date, vendor_name, requested_amount, description, is_duplicate_warning, created_at, reimbursement_categories(name)")
        .eq("id", recordId)
        .single();
      if (error) return { error: error.message };

      const row = data as {
        claim_date?: string | null;
        vendor_name?: string | null;
        requested_amount?: number | null;
        description?: string | null;
        is_duplicate_warning?: boolean | null;
        created_at?: string | null;
        reimbursement_categories?: { name?: string | null } | null;
      } | null;

      fields = [
        { label: "Category", value: row?.reimbursement_categories?.name || "—" },
        { label: "Claim Date", value: fmtDate(row?.claim_date) },
        { label: "Vendor", value: row?.vendor_name || "—" },
        { label: "Requested Amount", value: fmtCurrency(row?.requested_amount) },
        { label: "Description", value: row?.description || "—" },
        { label: "Duplicate Warning", value: row?.is_duplicate_warning ? "Yes" : "No" },
        { label: "Submitted", value: fmtDate(row?.created_at) },
      ];
    } else if (module === "encashment") {
      const { data, error } = await supabase
        .from("leave_encashment_requests")
        .select("days_to_encash, daily_rate, total_amount, created_at")
        .eq("id", recordId)
        .single();
      if (error) return { error: error.message };

      const row = data as {
        days_to_encash?: number | null;
        daily_rate?: number | null;
        total_amount?: number | null;
        created_at?: string | null;
      } | null;

      fields = [
        { label: "Days to Encash", value: `${row?.days_to_encash ?? "—"} day(s)` },
        { label: "Daily Rate", value: fmtCurrency(row?.daily_rate) },
        { label: "Total Amount", value: fmtCurrency(row?.total_amount) },
        { label: "Submitted", value: fmtDate(row?.created_at) },
      ];
    } else if (module === "offboarding") {
      const { data, error } = await supabase
        .from("ff_settlement_records")
        .select("last_working_day, leave_encashment_amount, asset_recovery_amount, net_settlement_amount, created_at")
        .eq("id", recordId)
        .single();
      if (error) return { error: error.message };

      const row = data as {
        last_working_day?: string | null;
        leave_encashment_amount?: number | null;
        asset_recovery_amount?: number | null;
        net_settlement_amount?: number | null;
        created_at?: string | null;
      } | null;

      fields = [
        { label: "Last Working Day", value: fmtDate(row?.last_working_day) },
        { label: "Leave Encashment", value: fmtCurrency(row?.leave_encashment_amount) },
        { label: "Asset Recovery", value: fmtCurrency(row?.asset_recovery_amount) },
        { label: "Net Settlement", value: fmtCurrency(row?.net_settlement_amount) },
        { label: "Submitted", value: fmtDate(row?.created_at) },
      ];
    } else if (module === "permission" || module === "permissions" || module === "permission_request") {
      const { data, error } = await supabase
        .from("permission_requests")
        .select("permission_date, start_time, end_time, reason, created_at")
        .eq("id", recordId)
        .single();
      if (error) return { error: error.message };

      const row = data as {
        permission_date?: string | null;
        start_time?: string | null;
        end_time?: string | null;
        reason?: string | null;
        created_at?: string | null;
      } | null;

      fields = [
        { label: "Date", value: fmtDate(row?.permission_date) },
        { label: "Time Range", value: `${row?.start_time || "—"} to ${row?.end_time || "—"}` },
        { label: "Reason", value: row?.reason || "—" },
        { label: "Submitted", value: fmtDate(row?.created_at) },
      ];
    } else if (module === "compoff" || module === "comp_off_grant") {
      const { data, error } = await supabase
        .from("comp_off_grants")
        .select("worked_date, days_granted, expiry_date, reason, created_at")
        .eq("id", recordId)
        .single();
      if (error) return { error: error.message };

      const row = data as {
        worked_date?: string | null;
        days_granted?: number | null;
        expiry_date?: string | null;
        reason?: string | null;
        created_at?: string | null;
      } | null;

      fields = [
        { label: "Worked Date", value: fmtDate(row?.worked_date) },
        { label: "Days Granted", value: `${row?.days_granted ?? "—"} day(s)` },
        { label: "Expiry Date", value: fmtDate(row?.expiry_date) },
        { label: "Reason", value: row?.reason || "—" },
        { label: "Submitted", value: fmtDate(row?.created_at) },
      ];
    } else {
      return { success: true, detail: [] };
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load request details";
    return { error: message };
  }

  return { success: true, detail: fields };
}

