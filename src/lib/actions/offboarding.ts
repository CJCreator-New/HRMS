"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assertPermission";
import { computeLastWorkingDay, resolveFfApprovalOutcome } from "@/lib/services/offboarding-engine";
import { validateRequestOrigin } from "@/lib/security";

export async function submitResignationAction(
  employeeId: string,
  resignationDate: string,
  noticeDays: number,
  initiatedBy?: string
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { error: csrfError.error };

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  let currentEmpId = initiatedBy;
  if (!currentEmpId && user) {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    if (emp) currentEmpId = emp.id;
  }
  const initiator = currentEmpId || employeeId;

  const lwd = computeLastWorkingDay(resignationDate, noticeDays);

  const { data: record, error } = await supabase
    .from("separation_records")
    .insert({
      employee_id: employeeId,
      separation_type: "resignation",
      initiated_by: initiator,
      separation_date: resignationDate,
      notice_period_days: noticeDays,
      last_working_day: lwd,
      status: "active",
      created_by: initiator,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Create initial F&F Draft record
  await supabase.from("ff_settlement_records").insert({
    separation_id: record.id,
    employee_id: employeeId,
    last_working_day: lwd,
    net_settlement_amount: 0,
    status: "draft",
    is_stale: false,
    asset_recovery_amount: 0,
  });

  return { success: true, record };
}

export async function rescindResignationAction(separationId: string) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { error: csrfError.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("separation_records")
    .update({ status: "rescinded" })
    .eq("id", separationId)
    .select()
    .single();

  if (error) return { error: error.message };
  return { success: true, record: data };
}

async function getFfSettlementId(supabase: any, separationId: string) {
  const { data } = await supabase
    .from("ff_settlement_records")
    .select("id, employee_id")
    .eq("separation_id", separationId)
    .maybeSingle();
  return data;
}

export async function toggleClearanceAction(
  separationId: string,
  department: "IT" | "Finance" | "Admin" | "HR",
  isCleared: boolean
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("offboarding.manage");
  if (permError) return permError;

  const supabase = await createClient();

  const ff = await getFfSettlementId(supabase, separationId);
  if (!ff) return { error: "No F&F settlement found for this separation." };

  const { data: { user } } = await supabase.auth.getUser();
  let clearedById: string | null = null;
  if (user) {
    const { data: e } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    clearedById = e?.id || null;
  }

  const { error } = await supabase.from("ff_clearances").upsert(
    {
      ff_settlement_id: ff.id,
      department_name: department,
      is_cleared: isCleared,
      cleared_by: isCleared ? clearedById : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ff_settlement_id,department_name" }
  );

  if (error) return { error: error.message };
  return { success: true };
}

export async function approveFfAction(separationId: string) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("ff.approve");
  if (permError) return permError;

  const supabase = await createClient();

  const ff = await getFfSettlementId(supabase, separationId);
  if (!ff) return { error: "No F&F settlement found for this separation." };

  const { data: { user } } = await supabase.auth.getUser();
  let approverId: string | null = null;
  if (user) {
    const { data: e } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    approverId = e?.id || null;
  }

  const { error: ffErr } = await supabase
    .from("ff_settlement_records")
    .update({
      status: "approved",
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      is_stale: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ff.id);

  if (ffErr) return { error: ffErr.message };

  // Completed Separation only when LWD reached AND F&F approved (FR §2.2–§2.3)
  const { data: sep } = await supabase
    .from("separation_records")
    .select("last_working_day")
    .eq("id", separationId)
    .single();

  const outcome = resolveFfApprovalOutcome(sep?.last_working_day);

  const { error: sepErr } = await supabase
    .from("separation_records")
    .update({ status: outcome.status })
    .eq("id", separationId);

  if (sepErr) return { error: sepErr.message };

  return { success: true, lwdReached: outcome.lwdReached };
}

export async function triggerStaleFfAction(separationId: string) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("offboarding.manage");
  if (permError) return permError;

  const supabase = await createClient();

  const ff = await getFfSettlementId(supabase, separationId);
  if (!ff) return { error: "No F&F settlement found for this separation." };

  // Insert a leave_ledger adjustment for the employee; the DB trigger
  // invalidate_stale_ff_settlement() marks the draft F&F settlement stale.
  const { data: lt } = await supabase
    .from("leave_types")
    .select("id")
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("leave_ledger").insert({
    employee_id: ff.employee_id,
    leave_type_id: lt?.id || null,
    transaction_type: "adjustment",
    days: 0,
    balance_after: 0,
    reference_id: ff.id,
    notes: "F&F stale re-calculation trigger",
  });

  if (error) return { error: error.message };
  return { success: true };
}

