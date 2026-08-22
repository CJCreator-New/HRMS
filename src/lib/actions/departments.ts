"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";
import { previousDate } from "@/lib/services/compensation-engine";
import { getTodayDateStringIST } from "@/lib/utils/date-utils";
import { writeAuditLogAction } from "@/lib/actions/audit";
import type { DepartmentAssignmentImportRow } from "@/lib/batch-import/schemas";
import type { BatchCommitResult } from "@/lib/batch-import/types";

export interface DepartmentRecord {
  id: string;
  name: string;
  active?: boolean;
  employee_count?: number;
  created_at?: string | null;
  [key: string]: unknown;
}

export async function createDepartmentAction(formData: FormData): Promise<{ success: boolean; error?: string; department?: DepartmentRecord }> {
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
  return { success: true, department: data as DepartmentRecord };
}

export async function toggleDepartmentActiveAction(id: string, active: boolean): Promise<{ success: boolean; error?: string; department?: DepartmentRecord }> {
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
  return { success: true, department: data as DepartmentRecord };
}

export async function updateDepartmentAction(id: string, name: string): Promise<{ success: boolean; error?: string; department?: DepartmentRecord }> {
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


export async function getDepartmentsAction(): Promise<{ departments: DepartmentRecord[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("departments").select("*").order("name");
  if (error) return { departments: [], error: error.message };
  return { departments: (data as DepartmentRecord[]) || [] };
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

  // --- Bulk Pre-fetch to eliminate N+1 DB queries ---
  const allEmpCodes = new Set<string>();
  const allDeptNames = new Set<string>();

  for (const row of rows) {
    const empCode = sanitizeInput(row.employee_code || "").trim();
    const mgrCode = row.manager_employee_code ? sanitizeInput(row.manager_employee_code).trim() : null;
    const deptName = sanitizeInput(row.department || "").trim();
    if (empCode) allEmpCodes.add(empCode);
    if (mgrCode) allEmpCodes.add(mgrCode);
    if (deptName) allDeptNames.add(deptName);
  }

  const [{ data: preEmployees }, { data: preDepartments }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, employee_code, full_name")
      .in("employee_code", Array.from(allEmpCodes)),
    supabase
      .from("departments")
      .select("id, name")
      .in("name", Array.from(allDeptNames)),
  ]);

  const safePreEmployees = Array.isArray(preEmployees)
    ? preEmployees
    : preEmployees && typeof preEmployees === "object"
    ? [preEmployees]
    : [];

  const empMap = new Map<string, { id: string; employee_code: string; full_name: string }>();
  for (const e of safePreEmployees) {
    if (e.employee_code) empMap.set(e.employee_code.toLowerCase(), e);
  }

  const safePreDepartments = Array.isArray(preDepartments)
    ? preDepartments
    : preDepartments && typeof preDepartments === "object"
    ? [preDepartments]
    : [];

  const deptMap = new Map<string, { id: string; name: string }>();
  for (const d of safePreDepartments) {
    if (d.name) deptMap.set(d.name.toLowerCase(), d);
  }

  const resolvedEmpIds = Array.from(empMap.values()).map((e) => e.id);

  // Pre-fetch all open assignments for resolved employees in 3 parallel queries
  const [
    { data: openDeptList },
    { data: openDesigList },
    { data: openMgrList },
  ] = resolvedEmpIds.length > 0
    ? await Promise.all([
        supabase
          .from("employee_department_assignment")
          .select("id, employee_id, effective_from")
          .in("employee_id", resolvedEmpIds)
          .is("effective_to", null),
        supabase
          .from("employee_designation_assignment")
          .select("id, employee_id, effective_from")
          .in("employee_id", resolvedEmpIds)
          .is("effective_to", null),
        supabase
          .from("employee_manager_assignment")
          .select("id, employee_id, effective_from")
          .in("employee_id", resolvedEmpIds)
          .is("effective_to", null),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const safeOpenDeptList = Array.isArray(openDeptList) ? openDeptList : openDeptList ? [openDeptList] : [];
  const safeOpenDesigList = Array.isArray(openDesigList) ? openDesigList : openDesigList ? [openDesigList] : [];
  const safeOpenMgrList = Array.isArray(openMgrList) ? openMgrList : openMgrList ? [openMgrList] : [];

  const openDeptMap = new Map<string, { id: string; effective_from: string }>();
  for (const a of safeOpenDeptList) openDeptMap.set(a.employee_id, a);

  const openDesigMap = new Map<string, { id: string; effective_from: string }>();
  for (const a of safeOpenDesigList) openDesigMap.set(a.employee_id, a);

  const openMgrMap = new Map<string, { id: string; effective_from: string }>();
  for (const a of safeOpenMgrList) openMgrMap.set(a.employee_id, a);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const empCode = sanitizeInput(row.employee_code || "").trim();
    const deptName = sanitizeInput(row.department || "").trim();
    const designation = row.designation ? sanitizeInput(row.designation).trim() : null;
    const managerCode = row.manager_employee_code ? sanitizeInput(row.manager_employee_code).trim() : null;
    const effectiveDate = row.effective_date ? row.effective_date.trim() : getTodayDateStringIST();

    if (!empCode || !deptName) {
      errorCount++;
      const msg = `Row #${rowNum}: Missing required employee_code or department.`;
      errors.push(msg);
      rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
      continue;
    }

    // 1. Resolve employee (from pre-fetch map with query fallback)
    let emp = empMap.get(empCode.toLowerCase());
    if (!emp) {
      const { data: directEmp } = await supabase
        .from("employees")
        .select("id, employee_code, full_name")
        .eq("employee_code", empCode)
        .maybeSingle();
      if (directEmp) {
        emp = directEmp;
        empMap.set(empCode.toLowerCase(), directEmp);
      }
    }

    if (!emp) {
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

      let managerEmp = empMap.get(managerCode.toLowerCase());
      if (!managerEmp) {
        const { data: directMgr } = await supabase
          .from("employees")
          .select("id, employee_code, full_name")
          .eq("employee_code", managerCode)
          .maybeSingle();
        if (directMgr) {
          managerEmp = directMgr;
          empMap.set(managerCode.toLowerCase(), directMgr);
        }
      }

      if (!managerEmp) {
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
    let existingDept = deptMap.get(deptName.toLowerCase());
    if (!existingDept) {
      const { data: directDept } = await supabase
        .from("departments")
        .select("id, name")
        .eq("name", deptName)
        .maybeSingle();
      if (directDept) {
        existingDept = directDept;
        deptMap.set(deptName.toLowerCase(), directDept);
      }
    }

    if (existingDept) {
      departmentId = existingDept.id;
    } else {
      const { data: newDept, error: createDeptErr } = await supabase
        .from("departments")
        .insert({ name: deptName, active: true })
        .select("id, name")
        .single();

      if (createDeptErr || !newDept) {
        errorCount++;
        const msg = `Row #${rowNum}: Failed to create department '${deptName}': ${createDeptErr?.message}`;
        errors.push(msg);
        rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
        continue;
      }
      departmentId = newDept.id;
      deptMap.set(deptName.toLowerCase(), newDept);
    }

    const prevDay = previousDate(effectiveDate);

    // 4. Effective-dated Department assignment
    let openDept = openDeptMap.get(emp.id);
    if (!openDept) {
      const { data: directOpenDept } = await supabase
        .from("employee_department_assignment")
        .select("id, effective_from")
        .eq("employee_id", emp.id)
        .is("effective_to", null)
        .maybeSingle();
      if (directOpenDept) openDept = directOpenDept;
    }

    if (openDept && prevDay) {
      await supabase
        .from("employee_department_assignment")
        .update({ effective_to: prevDay })
        .eq("id", openDept.id);
    }

    const { error: insDeptErr } = await supabase.from("employee_department_assignment").insert({
      employee_id: emp.id,
      department_id: departmentId,
      effective_from: effectiveDate,
    });

    if (insDeptErr) {
      errorCount++;
      const msg = `Row #${rowNum}: Failed to assign department for ${empCode}: ${insDeptErr.message}`;
      errors.push(msg);
      rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
      continue;
    }

    // 5. Effective-dated Designation assignment if provided
    if (designation) {
      let openDesig = openDesigMap.get(emp.id);
      if (!openDesig) {
        const { data: directOpenDesig } = await supabase
          .from("employee_designation_assignment")
          .select("id, effective_from")
          .eq("employee_id", emp.id)
          .is("effective_to", null)
          .maybeSingle();
        if (directOpenDesig) openDesig = directOpenDesig;
      }

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
      let openMgr = openMgrMap.get(emp.id);
      if (!openMgr) {
        const { data: directOpenMgr } = await supabase
          .from("employee_manager_assignment")
          .select("id, effective_from")
          .eq("employee_id", emp.id)
          .is("effective_to", null)
          .maybeSingle();
        if (directOpenMgr) openMgr = directOpenMgr;
      }

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
