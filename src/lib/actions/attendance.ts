"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission, assertAnyPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

export async function punchCheckInAction(employeeId?: string): Promise<{ success: boolean; error?: string; record?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertAnyPermission(["attendance.mark.self", "attendance.mark.team"]);
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let empId = employeeId;
  if (!empId && user) {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    if (emp) empId = emp.id;
  }

  if (!empId) return { success: false, error: "Employee record not found for check-in" };

  const today = new Date().toISOString().split("T")[0];
  const nowIso = new Date().toISOString();

  const { data: record, error } = await supabase
    .from("attendance_records")
    .insert({
      employee_id: empId,
      attendance_date: today,
      check_in_time: nowIso,
      status: "pending_review",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await supabase.from("attendance_punches").insert({
    attendance_record_id: record.id,
    punch_type: "check_in",
    punch_timestamp: nowIso,
  });

  return { success: true, record };
}

export async function punchCheckOutAction(attendanceRecordId: string): Promise<{ success: boolean; error?: string; record?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertAnyPermission(["attendance.mark.self", "attendance.mark.team"]);
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data: record, error } = await supabase
    .from("attendance_records")
    .update({
      check_out_time: nowIso,
      status: "present", // Calculated by process_attendance_record_update trigger
    })
    .eq("id", attendanceRecordId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await supabase.from("attendance_punches").insert({
    attendance_record_id: attendanceRecordId,
    punch_type: "check_out",
    punch_timestamp: nowIso,
  });

  return { success: true, record };
}

export async function submitAttendanceCorrectionAction(
  attendanceId: string,
  employeeId: string,
  requestedCheckIn: string,
  requestedCheckOut: string,
  reason: string
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("attendance.correct.self");
  if (permError) return permError;

  reason = sanitizeInput(reason);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_corrections")
    .insert({
      attendance_record_id: attendanceId,
      employee_id: employeeId,
      requested_check_in: requestedCheckIn,
      requested_check_out: requestedCheckOut,
      reason,
      status: "submitted",
    })
    .select()
    .single();

  if (error) return { success: false, correction: null };
  return { success: true, correction: data };
}

export async function getAttendanceAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { records: [], corrections: [] };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!emp) return { records: [], corrections: [] };

  const [{ data: records }, { data: corrections }] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("*")
      .eq("employee_id", emp.id)
      .order("attendance_date", { ascending: false })
      .limit(30),
    supabase
      .from("attendance_corrections")
      .select("*, employees!employee_id(full_name)")
      .eq("employee_id", emp.id)
      .order("created_at", { ascending: false }),
  ]);

  return {
    employeeId: emp.id,
    records: records || [],
    corrections: corrections || [],
  };
}

export async function approveAttendanceCorrectionAction(
  correctionId: string,
  decision: "approved" | "rejected"
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertAnyPermission(["attendance.correct.approve", "attendance.correct.override"]);
  if (permError) return permError;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthenticated" };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!emp) return { error: "Employee record not found" };

  const { error } = await supabase
    .from("attendance_corrections")
    .update({
      status: decision,
      decided_by: emp.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", correctionId);

  if (error) return { error: error.message };
  return { success: true };
}

