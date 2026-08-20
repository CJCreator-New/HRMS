import { createClient } from "@/lib/supabase/server";

export async function resolveLeaveApprover(applicantEmployeeId: string, isApplicantHrAdmin: boolean) {
  const supabase = await createClient();

  if (isApplicantHrAdmin) {
    // Route to alternate_hr_approver_id per FR §1.4
    const { data: settings } = await supabase
      .from("company_settings")
      .select("alternate_hr_approver_id")
      .limit(1)
      .single();

    if (settings?.alternate_hr_approver_id && settings.alternate_hr_approver_id !== applicantEmployeeId) {
      return { approverId: settings.alternate_hr_approver_id, stage: "alternate_hr" };
    }

    // System Admin fallback
    const { data: sysAdmin } = await supabase
      .from("employee_roles")
      .select("employee_id, roles!inner(code)")
      .eq("roles.code", "system_admin")
      .neq("employee_id", applicantEmployeeId)
      .limit(1)
      .single();

    return { approverId: sysAdmin?.employee_id || null, stage: "system_admin" };
  }

  // Manager approval routing
  const { data: assignment } = await supabase
    .from("employee_manager_assignment")
    .select("manager_id")
    .eq("employee_id", applicantEmployeeId)
    .is("effective_to", null)
    .single();

  return { approverId: assignment?.manager_id || null, stage: "manager" };
}
