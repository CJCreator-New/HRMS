"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queryEmployees, type EmployeeQueryOptions } from "@/lib/services/employees";
import { assertPermission } from "@/lib/auth/assertPermission";
import { checkActionRateLimit } from "@/lib/auth/rate-limit";
import { writeAuditLogAction } from "@/lib/actions/audit";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

export async function createEmployeeAction(formData: FormData) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("employee.create");
  if (permError) return permError;
  const employeeCode = String(formData.get("employeeCode") || formData.get("code") || "").trim();
  const rawFullName = formData.get("fullName");
  const firstName = formData.get("firstName") || "";
  const lastName = formData.get("lastName") || "";
  const fullName = sanitizeInput(rawFullName ? String(rawFullName).trim() : `${firstName} ${lastName}`.trim());
  const email = formData.get("email") as string;
  const tempPassword = formData.get("tempPassword") as string;
  const dateOfJoining = formData.get("dateOfJoining") as string;

  if (!employeeCode || !fullName || !email || !tempPassword) {
    return { error: "Missing required onboarding fields (code, name, email, password)." };
  }

  try {
    const adminSupabase = createAdminClient();

    // Check zero-seed configuration gate
    const { data: settings } = await adminSupabase
      .from("company_settings")
      .select("is_configured")
      .limit(1)
      .maybeSingle();

    if (settings && !settings.is_configured) {
      return { error: "System configuration required: Complete company configuration in Settings before onboarding employees." };
    }

    // 1. Create auth.user using service role
    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) {
      return { error: `Auth User Creation Failed: ${authError.message}` };
    }

    // 2. Create employee record (status = invited, must_change_password = true per ADR 0001)
    const supabase = await createClient();
    const { data: emp, error: empError } = await supabase
      .from("employees")
      .insert({
        employee_code: employeeCode,
        full_name: fullName,
        email,
        auth_user_id: authUser.user.id,
        date_of_joining: dateOfJoining || new Date().toISOString().split("T")[0],
        status: "invited",
        must_change_password: true,
      })
      .select()
      .single();

    if (empError) {
      return { error: `Employee Record Creation Failed: ${empError.message}` };
    }

    // Dynamic role assignment from onboarding UI (defaults to ["employee"])
    const rolesRaw = formData.get("roles");
    let roleCodes: string[] = ["employee"];
    if (rolesRaw) {
      try {
        const parsed = JSON.parse(String(rolesRaw));
        if (Array.isArray(parsed) && parsed.length > 0) roleCodes = parsed;
      } catch {}
    }

    const { data: rolesData } = await supabase
      .from("roles")
      .select("id, code")
      .in("code", roleCodes);

    if (rolesData && rolesData.length > 0) {
      await supabase.from("employee_roles").insert(
        rolesData.map((r: { id: string }) => ({
          employee_id: emp.id,
          role_id: r.id,
        }))
      );
    }

    return { success: true, employee: emp };
  } catch (err: any) {
    return { error: err.message || "An error occurred during employee creation." };
  }
}

export type { EmployeeQueryOptions } from "@/lib/services/employees";

/**
 * Employee directory query (M-09). Delegates to the shared server service so
 * the server-rendered directory page and this action resolve identically.
 * When `page` is provided, performs a server-side count + ranged fetch;
 * otherwise returns the full set (used by the offboarding resignation dropdown).
 */
export async function getEmployeesAction(opts: EmployeeQueryOptions = {}) {
  try {
    const { employees, total } = await queryEmployees(opts);
    return opts.page && opts.page > 0 ? { employees, total } : { employees };
  } catch (e: any) {
    return { error: e?.message || "Failed to load employees." };
  }
}

export async function importEmployeesCsvAction(rows: Array<{ code: string; name: string; email: string; doj?: string }>) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, imported: 0, skipped: 0, errors: [csrfError.error] };

  const permError = await assertPermission("employee.import");
  if (permError) return { success: false, imported: 0, skipped: 0, errors: [permError.error] };

  const rateCheck = await checkActionRateLimit("admin", "import_employees_csv", 10, 3600000);
  if (!rateCheck.allowed) {
    const mins = Math.ceil(rateCheck.retryAfterMs / 60000);
    return { success: false, imported: 0, skipped: 0, errors: [`Rate limit exceeded. Please try again in ${mins} minute(s).`] };
  }

  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.code || !row.name || !row.email) {
      skipped++;
      errors.push(`Row missing required field (code, name, email): ${JSON.stringify(row)}`);
      continue;
    }

    // Generate a temporary password for the imported employee
    const tempPassword = `Temp${row.code.slice(-4)}@${new Date().getFullYear()}!`;

    // Create auth user first
    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email: row.email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) {
      skipped++;
      errors.push(`Failed to create auth user for ${row.code}: ${authError.message}`);
      continue;
    }

    // Create employee record linked to auth user
    const { error } = await supabase.from("employees").insert({
      employee_code: row.code,
      full_name: row.name,
      email: row.email,
      auth_user_id: authUser.user.id,
      date_of_joining: row.doj || new Date().toISOString().split("T")[0],
      status: "invited",
      must_change_password: true,
    });

    if (error) {
      skipped++;
      // Best-effort cleanup: delete auth user if employee record creation fails
      try {
        await adminSupabase.auth.admin.deleteUser(authUser.user.id);
      } catch {
        // Ignore cleanup errors in test/mock environments
      }
      errors.push(`Failed to import ${row.code}: ${error.message}`);
    } else {
      imported++;
    }
  }

  return { success: true, imported, skipped, errors };
}

export async function toggleEmployeeDeactivationAction(employeeId: string, isDeactivated: boolean) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("employee.deactivate");
  if (permError) return permError;

  const supabase = await createClient();

  const nextStatus = isDeactivated ? "suspended" : "active";

  const { error } = await supabase
    .from("employees")
    .update({
      is_deactivated: isDeactivated,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", employeeId);

  if (error) return { error: error.message };

  await writeAuditLogAction({
    action: isDeactivated ? "employee.deactivate" : "employee.reactivate",
    entityType: "employee",
    entityId: employeeId,
    newValues: { is_deactivated: isDeactivated, status: nextStatus },
  });

  return { success: true };
}

export async function updateEmployeeAssignmentAction(
  employeeId: string,
  departmentId?: string,
  managerId?: string,
  designationTitle?: string
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("employee.edit");
  if (permError) return permError;

  if (designationTitle) designationTitle = sanitizeInput(designationTitle);

  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  if (departmentId) {
    await supabase.from("employee_department_assignment").insert({
      employee_id: employeeId,
      department_id: departmentId,
      effective_from: today,
    });
  }

  if (managerId) {
    await supabase.from("employee_manager_assignment").insert({
      employee_id: employeeId,
      manager_id: managerId,
      effective_from: today,
    });
  }

  if (designationTitle) {
    await supabase.from("employee_designation_assignment").insert({
      employee_id: employeeId,
      title: designationTitle,
      effective_from: today,
    });
  }

  return { success: true };
}
