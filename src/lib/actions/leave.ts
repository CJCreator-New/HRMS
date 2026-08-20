"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveLeaveApprover } from "@/lib/services/leave-routing";
import { computeCompOffExpiryDate } from "@/lib/services/leave-engine";
import { assertPermission, assertAnyPermission, assertCallerIdentity, getAuthenticatedCaller } from "@/lib/auth/assertPermission";
import { checkActionRateLimit } from "@/lib/auth/rate-limit";
import { createNotificationAction } from "@/lib/actions/notifications";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

export async function applyLeaveAction(
  employeeId: string,
  leaveTypeId: string,
  startDate: string,
  endDate: string,
  durationType: "full_day" | "first_half" | "second_half",
  reason: string,
  isHrAdmin: boolean = false
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const rateCheck = await checkActionRateLimit(employeeId, "apply_leave", 10, 3600000);
  if (!rateCheck.allowed) {
    const mins = Math.ceil(rateCheck.retryAfterMs / 60000);
    return { error: `Rate limit exceeded: Too many leave applications. Please try again in ${mins} minute(s).` };
  }

  reason = sanitizeInput(reason);

  const permError = await assertPermission("leave.apply.self");
  if (permError) return permError;

  // Caller identity check — prevent submitting leave on behalf of other employees without HR/manager proxy permissions
  const identityError = await assertCallerIdentity(employeeId, ["leave.approve.hr", "leave.approve.manager"]);
  if (identityError) return identityError;

  const supabase = await createClient();

  // Resolve leave_type_id if passed as a code (e.g. "CL", "SL", "EL")
  let resolvedLeaveTypeId = leaveTypeId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leaveTypeId);
  if (!isUuid) {
    const { data: lt } = await supabase
      .from("leave_types")
      .select("id")
      .eq("code", leaveTypeId)
      .single();
    if (lt?.id) resolvedLeaveTypeId = lt.id;
  }

  // Validate duration type constraint (H-13)
  if (durationType !== "full_day" && startDate !== endDate) {
    return { error: "Half-day leaves can only be applied for a single calendar date." };
  }

  // Check overlap using prevent_overlapping_leave_requests trigger via insert
  const { approverId, stage } = await resolveLeaveApprover(employeeId, isHrAdmin);

  // Compute total days (with sandwich calculation if enabled)
  let totalDays: number;
  if (durationType === "full_day") {
    const { data: daysCalc } = await supabase.rpc("calculate_leave_days", {
      p_employee_id: employeeId,
      p_leave_type_id: resolvedLeaveTypeId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_duration_type: durationType,
    });
    totalDays = daysCalc || 1;
  } else {
    // Half-day leaves are always 0.5 days
    totalDays = 0.5;
  }

  const { data: request, error } = await supabase
    .from("leave_requests")
    .insert({
      employee_id: employeeId,
      leave_type_id: resolvedLeaveTypeId,
      start_date: startDate,
      end_date: endDate,
      duration_type: durationType,
      total_days: totalDays,
      reason,
      status: "pending",
      current_approver_id: approverId,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (approverId) {
    await supabase.from("leave_request_approvals").insert({
      leave_request_id: request.id,
      approver_id: approverId,
      stage,
      status: "pending",
    });
    await createNotificationAction(
      approverId,
      "New Leave Request",
      `A leave request from ${employeeId} is awaiting your approval.`,
      "/approvals"
    );
  }

  return { success: true, request };
}

export async function approveLeaveAction(requestId: string, approverId: string, remarks?: string) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  if (remarks) remarks = sanitizeInput(remarks);

  const permError = await assertAnyPermission(["leave.approve.manager", "leave.approve.hr"]);
  if (permError) return permError;

  const caller = await getAuthenticatedCaller();
  const effectiveApproverId = caller?.employeeId || approverId;

  const supabase = await createClient();

  // Fetch the leave request to verify approver identity and prevent self-approval
  const { data: leaveRequest, error: fetchErr } = await supabase
    .from("leave_requests")
    .select("id, employee_id, current_approver_id, status")
    .eq("id", requestId)
    .single();

  if (fetchErr || !leaveRequest) return { error: "Leave request not found." };

  if (leaveRequest.status !== "pending") {
    return { error: "Unable to process: This leave request is no longer in a pending state." };
  }

  // Self-approval guard (FR §1.4)
  if (leaveRequest.employee_id === effectiveApproverId) {
    return { error: "Self-approval of leave requests is not permitted." };
  }

  // Approver identity verification — HR Admin bypasses the assigned-approver check
  const isHrAdmin = await assertPermission("leave.approve.hr");
  if (isHrAdmin === null) {
    // HR Admin — can approve any request
  } else if (leaveRequest.current_approver_id && leaveRequest.current_approver_id !== effectiveApproverId) {
    return { error: "You are not the assigned approver for this request." };
  }

  // Triggers process_leave_request_state_change on update to 'approved'
  const { data, error } = await supabase
    .from("leave_requests")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase
    .from("leave_request_approvals")
    .update({ status: "approved", remarks, decided_at: new Date().toISOString() })
    .eq("leave_request_id", requestId)
    .eq("approver_id", effectiveApproverId);

  if (data?.employee_id) {
    await createNotificationAction(
      data.employee_id,
      "Leave Approved",
      `Your leave request has been approved.`,
      "/leave"
    );
  }

  return { success: true, request: data };
}

export async function rejectLeaveAction(requestId: string, approverId: string, remarks?: string) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  if (remarks) remarks = sanitizeInput(remarks);

  const permError = await assertAnyPermission(["leave.approve.manager", "leave.approve.hr"]);
  if (permError) return permError;

  const caller = await getAuthenticatedCaller();
  const effectiveApproverId = caller?.employeeId || approverId;

  const supabase = await createClient();

  // Fetch the leave request to verify approver identity and prevent self-approval
  const { data: leaveRequest, error: fetchErr } = await supabase
    .from("leave_requests")
    .select("id, employee_id, current_approver_id, status")
    .eq("id", requestId)
    .single();

  if (fetchErr || !leaveRequest) return { error: "Leave request not found." };

  if (leaveRequest.status !== "pending") {
    return { error: "Unable to process: This leave request is no longer in a pending state." };
  }

  // Self-approval guard (FR §1.4)
  if (leaveRequest.employee_id === effectiveApproverId) {
    return { error: "Self-approval of leave requests is not permitted." };
  }

  // Approver identity verification — HR Admin bypasses the assigned-approver check
  const isHrAdmin = await assertPermission("leave.approve.hr");
  if (isHrAdmin === null) {
    // HR Admin — can reject any request
  } else if (leaveRequest.current_approver_id && leaveRequest.current_approver_id !== effectiveApproverId) {
    return { error: "You are not the assigned approver for this request." };
  }

  const { data, error } = await supabase
    .from("leave_requests")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase
    .from("leave_request_approvals")
    .update({ status: "rejected", remarks, decided_at: new Date().toISOString() })
    .eq("leave_request_id", requestId)
    .eq("approver_id", effectiveApproverId);

  if (data?.employee_id) {
    await createNotificationAction(
      data.employee_id,
      "Leave Rejected",
      `Your leave request has been rejected.`,
      "/leave"
    );
  }

  return { success: true, request: data };
}

export async function getLeaveDataAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allocations: [], requests: [], employeeId: null };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!emp) return { allocations: [], requests: [], employeeId: null };

  const [{ data: allocations }, { data: requests }] = await Promise.all([
    supabase
      .from("leave_allocations")
      .select("*, leave_types(code, name)")
      .eq("employee_id", emp.id),
    supabase
      .from("leave_requests")
      .select("*, leave_types(name), employees!current_approver_id(full_name)")
      .eq("employee_id", emp.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    employeeId: emp.id,
    allocations: allocations || [],
    requests: requests || [],
  };
}

export async function requestCompOffAction(
  employeeId: string,
  extraWorkDate: string,
  daysGranted: number = 1.0
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertAnyPermission(["compoff.apply.self", "leave.apply.self"]);
  if (permError) return permError;

  const identityError = await assertCallerIdentity(employeeId, ["leave.approve.hr", "leave.approve.manager"]);
  if (identityError) return identityError;

  const supabase = await createClient();

  // Link to an extra_work attendance record on the given date if present
  const { data: attRecord } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("attendance_date", extraWorkDate)
    .eq("status", "extra_work")
    .maybeSingle();

  const expiryDate = computeCompOffExpiryDate(extraWorkDate);

  const { data, error } = await supabase
    .from("comp_off_grants")
    .insert({
      employee_id: employeeId,
      attendance_record_id: attRecord?.id || null,
      worked_date: extraWorkDate,
      days_granted: daysGranted,
      expiry_date: expiryDate,
      status: "pending",
    })
    .select()
    .single();

  if (error) return { error: error.message };

  return { success: true, record: data };
}

export async function creditCompOff(
  employeeId: string,
  workedDate: string,
  daysGranted: number = 1.0,
  reason?: string
): Promise<{ success: boolean; error?: string; record?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertAnyPermission(["compoff.manage", "leave.manage", "leave.approve.hr"]);
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();
  const caller = await getAuthenticatedCaller();

  const expiryDate = computeCompOffExpiryDate(workedDate);

  const { data: grant, error } = await supabase
    .from("comp_off_grants")
    .insert({
      employee_id: employeeId,
      worked_date: workedDate,
      days_granted: daysGranted,
      expiry_date: expiryDate,
      status: "approved",
      approver_id: caller?.employeeId || null,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Write audit log
  try {
    const { writeAuditLogAction } = await import("@/lib/actions/audit");
    await writeAuditLogAction({
      action: "compoff.credit_grant",
      entityType: "comp_off_grants",
      entityId: grant.id,
      newValues: {
        employee_id: employeeId,
        worked_date: workedDate,
        days_granted: daysGranted,
        expiry_date: expiryDate,
        reason,
      },
    });
  } catch {
    // Non-blocking audit failure in mock/test environment
  }

  return { success: true, record: grant };
}

export async function revokeCompOff(
  grantId: string,
  reason?: string
): Promise<{ success: boolean; error?: string; record?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertAnyPermission(["compoff.manage", "leave.manage", "leave.approve.hr"]);
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();

  const { data: grant, error: fetchError } = await supabase
    .from("comp_off_grants")
    .select("*")
    .eq("id", grantId)
    .single();

  if (fetchError || !grant) {
    return { success: false, error: "Comp-off grant record not found." };
  }

  if (grant.is_used) {
    return { success: false, error: "Cannot revoke comp-off grant: Grant has already been utilized." };
  }

  if (grant.status === "rejected" || grant.status === "cancelled" || grant.status === "withdrawn") {
    return { success: false, error: `Grant is already ${grant.status}.` };
  }

  const { data: updated, error: updateError } = await supabase
    .from("comp_off_grants")
    .update({
      status: "rejected",
    })
    .eq("id", grantId)
    .select()
    .single();

  if (updateError) return { success: false, error: updateError.message };

  // Write audit log
  try {
    const { writeAuditLogAction } = await import("@/lib/actions/audit");
    await writeAuditLogAction({
      action: "compoff.revoke_grant",
      entityType: "comp_off_grants",
      entityId: grantId,
      oldValues: { status: grant.status },
      newValues: { status: "rejected", reason },
    });
  } catch {
    // Non-blocking audit failure in mock/test environment
  }

  return { success: true, record: updated };
}

export const creditCompOffAction = creditCompOff;
export const revokeCompOffAction = revokeCompOff;


