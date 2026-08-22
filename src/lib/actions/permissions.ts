"use server";

import { createClient } from "@/lib/supabase/server";
import { computePermissionDurationMinutes, computeCompOffExpiryDate } from "@/lib/services/leave-engine";
import { assertPermission, assertAnyPermission, getAuthenticatedCaller } from "@/lib/auth/assertPermission";
import { createNotificationAction } from "@/lib/actions/notifications";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";
import { getTodayDateStringIST } from "@/lib/utils/date-utils";
import { writeAuditLogAction } from "@/lib/actions/audit";
import type { CompOffGrantRecord } from "@/lib/actions/leave";

export async function applyShortPermissionAction(
  permissionDate: string,
  startTime: string,
  endTime: string,
  reason: string
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  reason = sanitizeInput(reason);

  const permError = await assertPermission("permission.apply.self");
  if (permError) return permError;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthenticated" };

  const { data: emp } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("auth_user_id", user.id)
    .single();

  if (!emp) return { error: "Employee record not found" };

  // Resolve manager from effective-dated manager assignment table (P0 Blocker #3)
  const { data: mgrAssignment } = await supabase
    .from("employee_manager_assignment")
    .select("manager_id")
    .eq("employee_id", emp.id)
    .is("effective_to", null)
    .maybeSingle();

  const managerId = mgrAssignment?.manager_id || null;

  // Calculate duration in minutes
  const durationMinutes = computePermissionDurationMinutes(startTime, endTime);

  if (durationMinutes <= 0 || durationMinutes > 120) {
    return { error: "Short permission requests are limited to maximum 2 hours (120 minutes)." };
  }

  // Calculate total permission minutes already requested/approved in the same month
  const currentMonthStart = permissionDate.slice(0, 7) + "-01";
  const { data: monthRequests } = await supabase
    .from("permission_requests")
    .select("duration_minutes, status")
    .eq("employee_id", emp.id)
    .gte("permission_date", currentMonthStart)
    .neq("status", "rejected");

  const existingMonthMins = (monthRequests || []).reduce(
    (sum: number, r: { duration_minutes?: number | null }) => sum + (r.duration_minutes || 0),
    0
  );

  if (existingMonthMins + durationMinutes > 120) {
    const remainingMins = Math.max(0, 120 - existingMonthMins);
    return {
      error: `Monthly quota exceeded: You have ${remainingMins} minute(s) remaining of your 120-minute monthly permission quota.`,
    };
  }

  const { data, error } = await supabase
    .from("permission_requests")
    .insert({
      employee_id: emp.id,
      permission_date: permissionDate,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMinutes,
      reason,
      status: "pending",
      approver_id: managerId,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (managerId) {
    await createNotificationAction(
      managerId,
      "New Permission Request",
      `${emp.full_name} has requested a ${durationMinutes}-minute permission on ${permissionDate}.`,
      "/approvals"
    );
  }

  return { success: true, record: data };
}

export async function getShortPermissionsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { requests: [], monthlyUsedMinutes: 0 };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!emp) return { requests: [], monthlyUsedMinutes: 0 };

  const todayStr = getTodayDateStringIST();
  const currentMonthStart = todayStr.slice(0, 7) + "-01";

  const [{ data, error }, { data: monthRequests }] = await Promise.all([
    supabase
      .from("permission_requests")
      .select("*")
      .eq("employee_id", emp.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("permission_requests")
      .select("duration_minutes, status")
      .eq("employee_id", emp.id)
      .gte("permission_date", currentMonthStart)
      .neq("status", "rejected"),
  ]);

  const monthlyUsedMinutes = (monthRequests || []).reduce(
    (sum: number, r: { duration_minutes?: number | null }) => sum + (r.duration_minutes || 0),
    0
  );

  if (error) return { requests: [], monthlyUsedMinutes: 0 };
  return { requests: data || [], monthlyUsedMinutes };
}

export async function decideShortPermissionAction(
  permissionId: string,
  decision: "approved" | "rejected"
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertAnyPermission(["permission.approve", "leave.approve.manager", "leave.approve.hr"]);
  if (permError) return permError;

  const caller = await getAuthenticatedCaller();
  const supabase = await createClient();

  // Fetch permission request to verify anti-self-approval
  const { data: permRequest } = await supabase
    .from("permission_requests")
    .select("employee_id")
    .eq("id", permissionId)
    .single();

  let deciderId = caller?.employeeId;
  if (!deciderId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      deciderId = emp?.id;
    }
  }

  if (!deciderId) return { error: "Employee record not found" };

  // Anti-self-approval guard
  if (permRequest?.employee_id && permRequest.employee_id === deciderId) {
    return { error: "Self-approval of short permission requests is not permitted." };
  }

  const { data, error } = await supabase
    .from("permission_requests")
    .update({
      status: decision,
      approver_id: deciderId,
    })
    .eq("id", permissionId)
    .select()
    .single();

  if (error) return { error: error.message };

  if (data?.employee_id) {
    await createNotificationAction(
      data.employee_id,
      `Permission Request ${decision === "approved" ? "Approved" : "Rejected"}`,
      `Your short permission request for ${data.permission_date} has been ${decision}.`,
      "/permissions"
    );
  }

  return { success: true, record: data };
}

export async function manualCreditCompOffAction(
  employeeId: string,
  days: number,
  reason: string,
  expiryDays: number = 90
): Promise<{ success: boolean; error?: string; grant?: CompOffGrantRecord }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("compoff.credit.manual");
  if (permError) return { success: false, error: permError.error };

  reason = sanitizeInput(reason);
  if (!employeeId || days <= 0 || !reason) {
    return { success: false, error: "Invalid parameters: employeeId, positive days, and reason are required." };
  }

  const supabase = await createClient();
  const caller = await getAuthenticatedCaller();
  let approverId = caller?.employeeId || null;

  if (!approverId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      approverId = emp?.id || null;
    }
  }

  const today = getTodayDateStringIST();
  const expiryDate = computeCompOffExpiryDate(today, expiryDays);

  const { data: grant, error } = await supabase
    .from("comp_off_grants")
    .insert({
      employee_id: employeeId,
      worked_date: today,
      days_granted: days,
      expiry_date: expiryDate,
      status: "approved",
      approver_id: approverId,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  try {
    await writeAuditLogAction({
      action: "compoff.credit.manual",
      entityType: "comp_off_grants",
      entityId: grant.id,
      newValues: {
        employee_id: employeeId,
        days_granted: days,
        expiry_date: expiryDate,
        reason,
      },
    });
  } catch {
    // Non-blocking in mock/test environments
  }

  await createNotificationAction(
    employeeId,
    "Comp-Off Credited",
    `You have been credited ${days} day(s) of comp-off. Reason: ${reason}`,
    "/leave"
  );

  return { success: true, grant: grant as CompOffGrantRecord };
}

export async function revokeCompOffAction(
  grantId: string,
  reason: string
): Promise<{ success: boolean; error?: string; grant?: CompOffGrantRecord }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("compoff.revoke");
  if (permError) return { success: false, error: permError.error };

  reason = sanitizeInput(reason);
  if (!grantId || !reason) {
    return { success: false, error: "Invalid parameters: grantId and reason are required." };
  }

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

  if (grant.status === "rejected" || grant.status === "cancelled") {
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

  try {
    await writeAuditLogAction({
      action: "compoff.revoke",
      entityType: "comp_off_grants",
      entityId: grantId,
      oldValues: { status: grant.status },
      newValues: { status: "rejected", reason },
    });
  } catch {
    // Non-blocking in mock/test environments
  }

  await createNotificationAction(
    grant.employee_id,
    "Comp-Off Revoked",
    `A comp-off grant of ${grant.days_granted} day(s) has been revoked. Reason: ${reason}`,
    "/leave"
  );

  return { success: true, grant: updated };
}
