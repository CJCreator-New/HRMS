"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission, assertAnyPermission, getAuthenticatedCaller } from "@/lib/auth/assertPermission";
import { validateRequestOrigin } from "@/lib/security";
import {
  mapEmployeeToSearchResult,
  mapSeparationToViewModel,
} from "@/lib/services/mappers";

export async function globalSearchAction(query: string) {
  if (!query || query.trim().length < 2) return { results: [] };

  const cleanQuery = query.replace(/[^\w\s@.-]/gi, "").trim();
  if (cleanQuery.length < 2) return { results: [] };

  const caller = await getAuthenticatedCaller();
  const callerRoles = caller?.roles || ["employee"];
  const isSysAdmin = callerRoles.includes("system_admin");
  const isHrAdmin = callerRoles.includes("hr");
  const isManager = callerRoles.includes("manager");
  const callerEmployeeId = caller?.employeeId;

  const supabase = await createClient();

  // If caller has global view privileges (system_admin or hr), query global RPC
  if (isSysAdmin || isHrAdmin) {
    const { data, error } = await supabase.rpc("search_global", {
      p_query: cleanQuery,
    });

    if (!error && data) {
      return { results: data };
    }
  }

  // Fallback / Scoped Query: search employees table directly with role-enforced scope
  let queryBuilder = supabase
    .from("employees")
    .select("id, full_name, employee_code, email, department, designation, status")
    .or(`full_name.ilike.%${cleanQuery}%,employee_code.ilike.%${cleanQuery}%,email.ilike.%${cleanQuery}%`);

  if (!isSysAdmin && !isHrAdmin) {
    if (isManager && callerEmployeeId) {
      // Manager can view self and direct reports
      queryBuilder = queryBuilder.or(`id.eq.${callerEmployeeId},manager_id.eq.${callerEmployeeId}`);
    } else if (callerEmployeeId) {
      // Standard employee can only search/view self
      queryBuilder = queryBuilder.eq("id", callerEmployeeId);
    }
  }

  const { data: emp } = await queryBuilder.limit(10);

  return {
    results: (emp || []).map((e: any) => mapEmployeeToSearchResult(e)),
  };
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

export async function getSalaryDataAction(targetEmployeeId?: string) {
  const permError = await assertAnyPermission(["salary.view.self", "salary.view.all"]);
  if (permError) return { structures: [], components: [], assignments: [], employees: [], error: permError.error };

  const caller = await getAuthenticatedCaller();
  let employeeId = caller?.employeeId || null;

  const supabase = await createClient();

  if (!employeeId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      employeeId = emp?.id || null;
    }
  }

  // Check if caller has salary.view.all permission
  const isViewAll = await assertPermission("salary.view.all");
  const hasViewAll = isViewAll === null;

  const effectiveEmployeeId = hasViewAll && targetEmployeeId ? targetEmployeeId : employeeId;

  const [{ data: components }, { data: structures }, { data: employees }] = await Promise.all([
    supabase.from("salary_components").select("*").order("code"),
    hasViewAll && !targetEmployeeId
      ? supabase
          .from("employee_salary_structures")
          .select("*, employees(full_name, employee_code)")
          .order("effective_from", { ascending: false })
          .limit(20)
      : supabase
          .from("employee_salary_structures")
          .select("*, employees(full_name, employee_code)")
          .eq("employee_id", effectiveEmployeeId || "")
          .order("effective_from", { ascending: false }),
    hasViewAll
      ? supabase
          .from("employees")
          .select("id, full_name, employee_code")
          .eq("is_deactivated", false)
          .order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  return {
    components: components || [],
    structures: structures || [],
    assignments: structures || [],
    employees: employees || [],
    employeeId: effectiveEmployeeId,
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
  const { approveReimbursementClaimAction } = await import("@/lib/actions/reimbursements");
  const res = await approveReimbursementClaimAction(claimId, decision, approvedAmount);
  if (!res.success) return { error: res.error };
  return { success: true, newStatus: res.newStatus };
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

/**
 * Admin action to trigger a mass-seeding of mock employees and attendance records
 * to the database to facilitate local testing and development.
 */
export async function triggerMassSeedAction() {
  const { MOCK_EMPLOYEES, MOCK_ATTENDANCE_RECORDS } = await import("@/lib/seed-data");

  const permError = await assertAnyPermission(["system_admin", "admin.write", "employee.create"]);
  if (permError) {
    // In local demo / offline mode, check caller roles
    const caller = await getAuthenticatedCaller();
    if (caller && !caller.roles.includes("system_admin") && !caller.roles.includes("hr")) {
      return { error: "Forbidden: Only administrators can trigger mass data seeding" };
    }
  }

  const supabase = await createClient();

  let seededEmployees = 0;
  let seededAttendance = 0;
  const errors: string[] = [];

  // 1. Seed employees
  for (const emp of MOCK_EMPLOYEES) {
    const { error } = await supabase.from("employees").upsert(
      {
        id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        email: emp.email,
        phone: emp.phone,
        date_of_birth: emp.date_of_birth,
        date_of_joining: emp.date_of_joining,
        status: emp.status,
        must_change_password: emp.must_change_password,
        is_deactivated: emp.is_deactivated,
      },
      { onConflict: "id" }
    );

    if (!error) {
      seededEmployees++;
    } else {
      errors.push(`Employee ${emp.employee_code}: ${error.message}`);
    }
  }

  // 2. Seed attendance records
  for (const att of MOCK_ATTENDANCE_RECORDS) {
    const { error } = await supabase.from("attendance_records").upsert(
      {
        id: att.id,
        employee_id: att.employee_id,
        attendance_date: att.attendance_date,
        status: att.status,
        check_in_time: att.check_in_time,
        check_out_time: att.check_out_time,
        total_work_minutes: att.total_work_minutes,
        remarks: att.remarks,
        is_locked: att.is_locked ?? false,
      },
      { onConflict: "employee_id,attendance_date" }
    );

    if (!error) {
      seededAttendance++;
    }
  }

  return {
    success: true,
    seededEmployees,
    seededAttendance,
    totalExpectedEmployees: MOCK_EMPLOYEES.length,
    totalExpectedAttendance: MOCK_ATTENDANCE_RECORDS.length,
    errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    message: `Successfully seeded ${seededEmployees} employees and ${seededAttendance} attendance records.`,
  };
}

