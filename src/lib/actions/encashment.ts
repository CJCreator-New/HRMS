"use server";

import { createClient } from "@/lib/supabase/server";
import { computeEncashmentAmount } from "@/lib/services/compensation-engine";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin } from "@/lib/security";

export async function submitLeaveEncashmentAction(
  employeeId: string,
  daysToEncash: number,
  triggerType: "annual_window" | "fnf",
  basicMonthlySalary: number,
  leaveTypeId?: string
): Promise<{ success: boolean; error?: string; request?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("leave.encash.apply");
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();

  let ltId = leaveTypeId;
  if (!ltId) {
    const { data: lt } = await supabase
      .from("leave_types")
      .select("id")
      .eq("code", "EL")
      .single();
    if (lt) ltId = lt.id;
  }

  if (!ltId) return { success: false, error: "Leave type ID for encashment is missing" };

  // Divisor 26 daily rate per FR §4.10
  const { dailyRate, totalAmount } = computeEncashmentAmount(basicMonthlySalary, daysToEncash);

  const { data: request, error } = await supabase
    .from("leave_encashment_requests")
    .insert({
      employee_id: employeeId,
      leave_type_id: ltId,
      days_to_encash: daysToEncash,
      encashment_trigger: triggerType,
      daily_rate: dailyRate,
      total_amount: totalAmount,
      status: "pending",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, request };
}

export async function decideLeaveEncashmentAction(
  requestId: string,
  decision: "approved" | "rejected"
): Promise<{ success: boolean; error?: string; request?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("leave.encash.approve");
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const { data: request, error } = await supabase
    .from("leave_encashment_requests")
    .update({
      status: decision,
      approver_id: emp?.id || null,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, request };
}


