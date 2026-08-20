"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin } from "@/lib/security";
import {
  mapEmployeeToSearchResult,
  mapSeparationToViewModel,
} from "@/lib/services/mappers";

export async function globalSearchAction(query: string) {
  if (!query || query.trim().length < 2) return { results: [] };

  const cleanQuery = query.replace(/[^\w\s@.-]/gi, "").trim();
  if (cleanQuery.length < 2) return { results: [] };

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("search_global", {
    p_query: cleanQuery,
  });

  if (error) {
    // Fallback: search employees table directly with RLS-enforced scope
    const { data: emp } = await supabase
      .from("employees")
      .select("id, full_name, employee_code, email, department, designation, status")
      .or(`full_name.ilike.%${cleanQuery}%,employee_code.ilike.%${cleanQuery}%,email.ilike.%${cleanQuery}%`)
      .limit(10);

    return {
      results: (emp || []).map((e: any) => mapEmployeeToSearchResult(e)),
    };
  }

  return { results: data || [] };
}

export async function getCalendarDataAction() {
  const supabase = await createClient();

  const [{ data: holidays }, { data: templates }] = await Promise.all([
    supabase
      .from("holidays")
      .select("*")
      .order("date", { ascending: true }),
    supabase
      .from("work_calendar_templates")
      .select("*"),
  ]);

  const defaultTemplate = (templates || [])[0];

  const { data: { user } } = await supabase.auth.getUser();
  let selectedOptional: string[] = [];
  if (user) {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    if (emp) {
      const { data: sel } = await supabase
        .from("employee_optional_holiday_selections")
        .select("holiday_id")
        .eq("employee_id", emp.id);
      selectedOptional = (sel || []).map((s: any) => s.holiday_id);
    }
  }

  return {
    holidays: holidays || [],
    templates: templates || [],
    defaultTemplateId: defaultTemplate?.id || "",
    selectedOptional,
  };
}

export async function getSalaryDataAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { structures: [], components: [], assignments: [] };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const employeeId = emp?.id || null;

  // Check if caller has salary.view.all permission
  const { data: hasViewAll } = await supabase.rpc("has_permission", {
    perm_code: "salary.view.all",
  });

  const [{ data: components }, { data: structures }] = await Promise.all([
    supabase.from("salary_components").select("*").order("code"),
    hasViewAll
      ? supabase
          .from("employee_salary_structures")
          .select("*, employees(full_name, employee_code)")
          .order("effective_from", { ascending: false })
          .limit(20)
      : supabase
          .from("employee_salary_structures")
          .select("*, employees(full_name, employee_code)")
          .eq("employee_id", employeeId || "")
          .order("effective_from", { ascending: false }),
  ]);

  return {
    components: components || [],
    structures: structures || [],
    assignments: structures || [],
    employeeId,
  };
}

export async function getPayrollDataAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { periods: [], payslips: [] };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const { data: hasViewAll } = await supabase.rpc("has_permission", {
    perm_code: "payroll.view",
  });

  const [{ data: periods }, { data: payslips }] = await Promise.all([
    supabase
      .from("payroll_periods")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(12),
    hasViewAll
      ? supabase
          .from("payslips")
          .select("*, employees(full_name, employee_code)")
          .order("created_at", { ascending: false })
          .limit(50)
      : supabase
          .from("payslips")
          .select("*, employees(full_name, employee_code)")
          .eq("employee_id", emp?.id || "")
          .order("created_at", { ascending: false }),
  ]);

  return {
    periods: periods || [],
    payslips: payslips || [],
  };
}

import { executeBulkPayrollRunAction } from "@/lib/actions/payroll";

export async function runPayrollAction(periodId: string) {
  return await executeBulkPayrollRunAction(periodId);
}

export async function getReimbursementDataAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { categories: [], claims: [], employeeId: null };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const [{ data: categories }, { data: claims }] = await Promise.all([
    supabase.from("reimbursement_categories").select("*").order("name"),
    supabase
      .from("reimbursement_claims")
      .select("*, reimbursement_categories(name, is_taxable), employees(full_name)")
      .eq("employee_id", emp?.id || "")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    employeeId: emp?.id || null,
    categories: categories || [],
    claims: claims || [],
  };
}

export async function approveReimbursementAction(claimId: string, decision: "approved" | "rejected", approvedAmount?: number) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { error: csrfError.error };

  const permError = await assertPermission("reimbursement.approve");
  if (permError) return { error: permError.error };

  const supabase = await createClient();

  // Verify the caller is not approving their own claim (self-approval guard)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthenticated" };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!emp) return { error: "Employee record not found" };

  const { data: claim } = await supabase
    .from("reimbursement_claims")
    .select("employee_id")
    .eq("id", claimId)
    .single();

  if (claim && claim.employee_id === emp.id) {
    return { error: "Self-approval of reimbursement claims is not permitted." };
  }

  const { error } = await supabase
    .from("reimbursement_claims")
    .update({
      status: decision === "approved" ? "approved" : "rejected",
      approved_amount: decision === "approved" ? approvedAmount : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function getEncashmentDataAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { encashments: [], carryForwardLogs: [], employeeId: null };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const { data: hasViewAll } = await supabase.rpc("has_permission", {
    perm_code: "leave.encash.approve",
  });

  const [{ data: encashments }, { data: carryForwardLogs }] = await Promise.all([
    hasViewAll
      ? supabase
          .from("leave_encashment_requests")
          .select("*, employees(full_name)")
          .order("created_at", { ascending: false })
          .limit(20)
      : supabase
          .from("leave_encashment_requests")
          .select("*, employees(full_name)")
          .eq("employee_id", emp?.id || "")
          .order("created_at", { ascending: false }),
    hasViewAll
      ? supabase
          .from("leave_carry_forward_logs")
          .select("*, employees(full_name)")
          .order("created_at", { ascending: false })
          .limit(20)
      : supabase
          .from("leave_carry_forward_logs")
          .select("*, employees(full_name)")
          .eq("employee_id", emp?.id || "")
          .order("created_at", { ascending: false }),
  ]);

  return {
    employeeId: emp?.id || null,
    encashments: encashments || [],
    carryForwardLogs: carryForwardLogs || [],
  };
}

export async function getOffboardingDataAction() {
  const permError = await assertPermission("offboarding.manage");
  if (permError) return { separations: [] };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("separation_records")
    .select(
      "*, employees(full_name, employee_code), ff_settlement_records(*, ff_clearances(*))"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { separations: [] };

  const separations = (data || []).map((s: any) => mapSeparationToViewModel(s));

  return { separations };
}

export async function getStatutoryDataAction() {
  const permError = await assertPermission("statutory.view");
  if (permError) return { profiles: [] };

  const supabase = await createClient();

  const { data: profiles, error } = await supabase
    .from("statutory_profiles")
    .select("*, employees(full_name, employee_code)")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return { profiles: [] };
  return { profiles: profiles || [] };
}
