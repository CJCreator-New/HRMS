"use server";

import { createClient } from "@/lib/supabase/server";
import { computePermissionDurationMinutes } from "@/lib/services/leave-engine";
import { assertPermission, assertAnyPermission, getAuthenticatedCaller } from "@/lib/auth/assertPermission";
import { createNotificationAction } from "@/lib/actions/notifications";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

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
    .select("id, full_name, manager_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!emp) return { error: "Employee record not found" };

  // Calculate duration in minutes
  const durationMinutes = computePermissionDurationMinutes(startTime, endTime);

  if (durationMinutes <= 0 || durationMinutes > 120) {
    return { error: "Short permission requests are limited to maximum 2 hours (120 minutes)." };
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
      approver_id: emp.manager_id || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (emp.manager_id) {
    await createNotificationAction(
      emp.manager_id,
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
  if (!user) return { requests: [] };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!emp) return { requests: [] };

  const { data, error } = await supabase
    .from("permission_requests")
    .select("*")
    .eq("employee_id", emp.id)
    .order("created_at", { ascending: false });

  if (error) return { requests: [] };
  return { requests: data || [] };
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
