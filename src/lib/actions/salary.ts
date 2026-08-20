"use server";

import { createClient } from "@/lib/supabase/server";
import { computeSalaryBreakdown, previousDate } from "@/lib/services/compensation-engine";
import { assertPermission } from "@/lib/auth/assertPermission";

export async function createSalaryStructureAction(
  employeeId: string,
  annualCtc: number,
  effectiveFrom: string
) {
  const permError = await assertPermission("salary.edit");
  if (permError) return permError;

  const supabase = await createClient();

  const { monthlyGross, basicMonthly } = computeSalaryBreakdown(annualCtc);

  // Close the currently-open version (effective_to = day before new effective_from)
  const { data: open } = await supabase
    .from("employee_salary_structures")
    .select("id, effective_from")
    .eq("employee_id", employeeId)
    .is("effective_to", null)
    .maybeSingle();

  if (open) {
    const prevDay = previousDate(effectiveFrom);
    await supabase
      .from("employee_salary_structures")
      .update({ effective_to: prevDay })
      .eq("id", open.id);
  }

  const { data, error } = await supabase
    .from("employee_salary_structures")
    .insert({
      employee_id: employeeId,
      annual_ctc: annualCtc,
      monthly_gross: monthlyGross,
      basic_monthly: basicMonthly,
      effective_from: effectiveFrom,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { success: true, record: data };
}
