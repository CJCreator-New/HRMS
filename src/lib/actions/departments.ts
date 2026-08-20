"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";
import { previousDate } from "@/lib/services/compensation-engine";
import { writeAuditLogAction } from "@/lib/actions/audit";
import type { DepartmentAssignmentImportRow } from "@/lib/batch-import/schemas";
import type { BatchCommitResult } from "@/lib/batch-import/types";

export async function createDepartmentAction(formData: FormData): Promise<{ success: boolean; error?: string; department?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("settings.manage");
  if (permError) return { success: false, error: permError.error };

  const name = sanitizeInput(formData.get("name") as string);
  if (!name) return { success: false, error: "Department Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .insert({ name, active: true })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, department: data };
}

export async function toggleDepartmentActiveAction(id: string, active: boolean): Promise<{ success: boolean; error?: string; department?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("settings.manage");
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, department: data };
}

export async function updateDepartmentAction(id: string, name: string): Promise<{ success: boolean; error?: string; department?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("settings.manage");
  if (permError) return { success: false, error: permError.error };

  name = sanitizeInput(name);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .update({ name })
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, department: data };
}

export async function getDepartmentsAction(): Promise<{ departments: any[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("departments").select("*").order("name");
  if (error) return { departments: [], error: error.message };
  return { departments: data || [] };
}

/**
 * Bulk assigns department, designation, and reporting manager hierarchy (§2.1, §2.4).
 * Respects effective-dating: closes open-ended previous versions before inserting new records.
 * Writes a batch audit log entry on completion.
 */
export async function bulkAssignDepartments(
  rows: DepartmentAssignmentImportRow[]
): Promise<BatchCommitResult<DepartmentAssignmentImportRow>> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) {
    return {
      success: false,
      total: rows.length,
      successCount: 0,
      errorCount: rows.length,
      errors: [csrfError.error],
    };
  }

  const permError = await assertPermission("department.bulk_assign");
  if (permError) {
    return {
      success: false,
      total: rows.length,
      successCount: 0,
      errorCount: rows.length,
      errors: [permError.error],
    };
  }

  const supabase = await createClient();
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];
  const rowResults: BatchCommitResult<DepartmentAssignmentImportRow>["rowResults"] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const empCode = sanitizeInput(row.employee_code || "").trim();
    const deptName = sanitizeInput(row.department || "").trim();
    const designation = row.designation ? sanitizeInput(row.designation).trim() : null;
    const managerCode = row.manager_employee_code ? sanitizeInput(row.manager_employee_code).trim() : null;
    const effectiveDate = row.effective_date ? row.effective_date.trim() : new Date().toISOString().split("T")[0];

    if (!empCode || !deptName) {
      errorCount++;
      const msg = `Row #${rowNum}: Missing required employee_code or department.`;
      errors.push(msg);
      rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
      continue;
    }

    // 1. Resolve employee
    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .select("id, employee_code, full_name")
      .eq("employee_code", empCode)
      .maybeSingle();

    if (empErr || !emp) {
      errorCount++;
      const msg = `Row #${rowNum}: Employee code '${empCode}' not found.`;
      errors.push(msg);
      rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
      continue;
    }

    // 2. Resolve manager if provided
    let managerId: string | null = null;
    if (managerCode) {
      if (managerCode.toLowerCase() === empCode.toLowerCase()) {
        errorCount++;
        const msg = `Row #${rowNum}: Self-reporting error — Employee ${empCode} cannot be their own manager.`;
        errors.push(msg);
        rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
        continue;
      }

      const { data: managerEmp, error: mgrErr } = await supabase
        .from("employees")
        .select("id, employee_code, full_name")
        .eq("employee_code", managerCode)
        .maybeSingle();

      if (mgrErr || !managerEmp) {
        errorCount++;
        const msg = `Row #${rowNum}: Reporting manager code '${managerCode}' not found.`;
        errors.push(msg);
        rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
        continue;
      }
      managerId = managerEmp.id;
    }

    // 3. Resolve or create department
    let departmentId: string | null = null;
    const { data: existingDept } = await supabase
      .from("departments")
      .select("id, name")
      .eq("name", deptName)
      .maybeSingle();

    if (existingDept) {
      departmentId = existingDept.id;
    } else {
      const { data: newDept, error: createDeptErr } = await supabase
        .from("departments")
        .insert({ name: deptName, active: true })
        .select("id")
        .single();

      if (createDeptErr || !newDept) {
        errorCount++;
        const msg = `Row #${rowNum}: Failed to create department '${deptName}': ${createDeptErr?.message}`;
        errors.push(msg);
        rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
        continue;
      }
      departmentId = newDept.id;
    }

    const prevDay = previousDate(effectiveDate);

    // 4. Effective-dated Department assignment
    // Close open department assignment
    const { data: openDept } = await supabase
      .from("employee_department_assignment")
      .select("id, effective_from")
      .eq("employee_id", emp.id)
      .is("effective_to", null)
      .maybeSingle();

    if (openDept && prevDay) {
      await supabase
        .from("employee_department_assignment")
        .update({ effective_to: prevDay })
        .eq("id", openDept.id);
    }

    await supabase.from("employee_department_assignment").insert({
      employee_id: emp.id,
      department_id: departmentId,
      effective_from: effectiveDate,
    });

    // 5. Effective-dated Designation assignment if provided
    if (designation) {
      const { data: openDesig } = await supabase
        .from("employee_designation_assignment")
        .select("id, effective_from")
        .eq("employee_id", emp.id)
        .is("effective_to", null)
        .maybeSingle();

      if (openDesig && prevDay) {
        await supabase
          .from("employee_designation_assignment")
          .update({ effective_to: prevDay })
          .eq("id", openDesig.id);
      }

      await supabase.from("employee_designation_assignment").insert({
        employee_id: emp.id,
        title: designation,
        effective_from: effectiveDate,
      });
    }

    // 6. Effective-dated Manager assignment if provided
    if (managerId) {
      const { data: openMgr } = await supabase
        .from("employee_manager_assignment")
        .select("id, effective_from")
        .eq("employee_id", emp.id)
        .is("effective_to", null)
        .maybeSingle();

      if (openMgr && prevDay) {
        await supabase
          .from("employee_manager_assignment")
          .update({ effective_to: prevDay })
          .eq("id", openMgr.id);
      }

      await supabase.from("employee_manager_assignment").insert({
        employee_id: emp.id,
        manager_id: managerId,
        effective_from: effectiveDate,
      });
    }

    successCount++;
    rowResults.push({
      rowNumber: rowNum,
      status: "success",
      message: `Assigned to ${deptName}${designation ? ` as ${designation}` : ""}${managerCode ? ` (Reports to: ${managerCode})` : ""} effective ${effectiveDate}`,
      data: row,
    });
  }

  // 7. Write single batch audit log entry
  if (successCount > 0) {
    await writeAuditLogAction({
      action: "department.bulk_assign",
      entityType: "department_assignment",
      metadata: {
        totalRows: rows.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10),
      },
    });
  }

  return {
    success: errorCount === 0,
    total: rows.length,
    successCount,
    errorCount,
    errors,
    rowResults,
  };
}
