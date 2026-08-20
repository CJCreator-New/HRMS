"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

export async function getEligibilityDataAction() {
  const permError = await assertPermission("payroll.view");
  if (permError) return permError;

  const supabase = await createClient();

  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, full_name, employee_code, status")
    .eq("status", "active")
    .order("full_name");

  if (empErr) return { error: empErr.message };

  const { data: rows, error: rowsErr } = await supabase
    .from("payroll_eligibility")
    .select("id, employee_id, is_eligible, reason, source, effective_from, effective_to")
    .order("effective_from", { ascending: false });

  if (rowsErr) return { error: rowsErr.message };

  return {
    success: true,
    employees: employees || [],
    eligibility: rows || [],
  };
}

export async function setEligibilityAction(
  employeeId: string,
  isEligible: boolean,
  effectiveFrom: string,
  reason?: string,
  effectiveTo?: string
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  if (reason) reason = sanitizeInput(reason);

  const permError = await assertPermission("payroll.run");
  if (permError) return permError;

  const supabase = await createClient();

  const { data: me } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id)
    .maybeSingle();

  const { error } = await supabase.from("payroll_eligibility").insert({
    employee_id: employeeId,
    is_eligible: isEligible,
    reason: reason || null,
    source: "hr_override",
    effective_from: effectiveFrom,
    effective_to: effectiveTo || null,
    created_by: me?.id || null,
  });

  if (error) return { error: error.message };

  return { success: true };
}

export async function removeEligibilityAction(id: string) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("payroll.run");
  if (permError) return permError;

  const supabase = await createClient();

  const { error } = await supabase.from("payroll_eligibility").delete().eq("id", id);

  if (error) return { error: error.message };

  return { success: true };
}
