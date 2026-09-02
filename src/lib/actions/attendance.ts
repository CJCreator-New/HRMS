"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertPermission, assertAnyPermission, assertCallerIdentity, getAuthenticatedCaller } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";
import { getTodayDateStringIST } from "@/lib/utils/date-utils";

export interface AttendanceActionRecord {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  status: string;
  [key: string]: unknown;
}

async function getPunchMetadata(): Promise<{ ipAddress: string; userAgent?: string }> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(",")[0].trim() : (h.get("x-real-ip") || "127.0.0.1");
    const userAgent = h.get("user-agent") || undefined;
    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: "127.0.0.1" };
  }
}

export async function punchCheckInAction(employeeId?: string): Promise<{ success: boolean; error?: string; record?: AttendanceActionRecord }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertAnyPermission(["attendance.mark.self", "attendance.mark.team", "attendance.view.all"]);
  if (permError) return { success: false, error: permError.error };

  const caller = await getAuthenticatedCaller();
  let empId = employeeId;
  if (!empId) {
    empId = caller?.employeeId || undefined;
  }

  if (!empId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      if (emp) empId = emp.id;
    }
  }

  if (!empId) return { success: false, error: "Employee record not found for check-in" };

  // Validate identity if punching for a specific target employee
  const identityError = await assertCallerIdentity(empId, ["attendance.mark.team", "attendance.view.all"]);
  if (identityError) return { success: false, error: identityError.error };

  const supabase = await createClient();
  const today = getTodayDateStringIST();
  const nowIso = new Date().toISOString();

  // Check if an open or existing record already exists for today (M3)
  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id, employee_id, attendance_date, check_in_time, check_out_time, status")
    .eq("employee_id", empId)
    .eq("attendance_date", today)
    .maybeSingle();

  if (existing) {
    if (existing.check_in_time && !existing.check_out_time) {
      return { success: false, error: "You are already checked in for today.", record: existing as AttendanceActionRecord };
    }
    if (existing.check_out_time) {
      return { success: false, error: "Attendance for today has already been completed.", record: existing as AttendanceActionRecord };
    }
  }

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

  const { ipAddress, userAgent } = await getPunchMetadata();
  await supabase.from("attendance_punches").insert({
    attendance_record_id: record.id,
    punch_type: "check_in",
    punch_timestamp: nowIso,
    ip_address: ipAddress,
    device_id: userAgent,
  });

  try {
    revalidatePath("/");
    revalidatePath("/attendance");
  } catch {
    // Non-blocking in non-RSC / unit test contexts
  }

  return { success: true, record };
}

export async function punchCheckOutAction(attendanceRecordId: string): Promise<{ success: boolean; error?: string; record?: AttendanceActionRecord }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertAnyPermission(["attendance.mark.self", "attendance.mark.team", "attendance.view.all"]);
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();

  // Validate that the attendance record belongs to the caller or caller has team/admin mark permission
  const { data: existingRecord } = await supabase
    .from("attendance_records")
    .select("employee_id")
    .eq("id", attendanceRecordId)
    .single();

  if (existingRecord?.employee_id) {
    const identityError = await assertCallerIdentity(existingRecord.employee_id, ["attendance.mark.team", "attendance.view.all"]);
    if (identityError) return { success: false, error: identityError.error };
  }

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

  const { ipAddress: outIp, userAgent: outAgent } = await getPunchMetadata();
  await supabase.from("attendance_punches").insert({
    attendance_record_id: attendanceRecordId,
    punch_type: "check_out",
    punch_timestamp: nowIso,
    ip_address: outIp,
    device_id: outAgent,
  });

  try {
    revalidatePath("/");
    revalidatePath("/attendance");
  } catch {
    // Non-blocking in non-RSC / unit test contexts
  }

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

  const identityError = await assertCallerIdentity(employeeId, ["attendance.correct.override"]);
  if (identityError) return identityError;

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
  let empId: string | null | undefined = null;

  if (user) {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    if (emp) empId = emp.id;
  }

  if (!empId) {
    const caller = await getAuthenticatedCaller();
    empId = caller?.employeeId;
  }

  if (!empId) return { records: [], corrections: [] };

  const [{ data: records }, { data: corrections }] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("*")
      .eq("employee_id", empId)
      .order("attendance_date", { ascending: false })
      .limit(30),
    supabase
      .from("attendance_corrections")
      .select("*, employees!employee_id(full_name)")
      .eq("employee_id", empId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    employeeId: empId,
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

  const caller = await getAuthenticatedCaller();
  const supabase = await createClient();

  // Fetch correction to enforce anti-self-approval
  const { data: correction } = await supabase
    .from("attendance_corrections")
    .select("employee_id")
    .eq("id", correctionId)
    .single();

  let deciderId = caller?.employeeId;
  if (!deciderId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user && !caller) return { error: "Unauthenticated" };
    if (user) {
      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      if (emp) deciderId = emp.id;
    }
  }

  if (!deciderId) return { error: "Employee record not found" };

  // Anti-self-approval guard
  if (correction?.employee_id && correction.employee_id === deciderId) {
    return { error: "Self-approval of attendance corrections is not permitted." };
  }

  const { error } = await supabase
    .from("attendance_corrections")
    .update({
      status: decision,
      decided_by: deciderId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", correctionId);

  if (error) return { error: error.message };
  return { success: true };
}

