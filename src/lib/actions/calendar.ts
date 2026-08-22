"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission, assertAnyPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";
import { previousDate } from "@/lib/services/compensation-engine";
import { getTodayDateStringIST } from "@/lib/utils/date-utils";
import { writeAuditLogAction } from "@/lib/actions/audit";
import type { CalendarAssignmentImportRow } from "@/lib/batch-import/schemas";
import type { BatchCommitResult } from "@/lib/batch-import/types";

export async function createHolidayAction(
  calendarTemplateId: string,
  name: string,
  holidayDate: string,
  isOptional: boolean
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("settings.manage");
  if (permError) return permError;

  name = sanitizeInput(name);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("holidays")
    .insert({
      calendar_template_id: calendarTemplateId,
      name,
      holiday_date: holidayDate,
      is_optional: isOptional,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { success: true, record: data };
}

export async function selectOptionalHolidayAction(
  employeeId: string,
  holidayId: string,
  selected: boolean
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertAnyPermission(["settings.manage", "employee.view.self"]);
  if (permError) return permError;

  const supabase = await createClient();

  if (selected) {
    const { data: tmpl } = await supabase
      .from("holidays")
      .select("calendar_template_id")
      .eq("id", holidayId)
      .single();
    const { data: existing } = await supabase
      .from("employee_optional_holiday_selections")
      .select("holiday_id")
      .eq("employee_id", employeeId);
    const cap = 2;
    if ((existing?.length || 0) >= cap) {
      return { error: `Maximum limit reached: you can select up to ${cap} optional holidays.` };
    }
    const { error } = await supabase
      .from("employee_optional_holiday_selections")
      .insert({ employee_id: employeeId, holiday_id: holidayId, calendar_template_id: tmpl?.calendar_template_id || null });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("employee_optional_holiday_selections")
      .delete()
      .eq("employee_id", employeeId)
      .eq("holiday_id", holidayId);
    if (error) return { error: error.message };
  }

  return { success: true };
}

export async function assignCalendarAction(
  employeeId: string,
  calendarTemplateId: string,
  effectiveFrom: string
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("settings.manage");
  if (permError) return permError;

  const supabase = await createClient();

  const { error: rpcErr } = await supabase.rpc("update_employee_work_calendar_assignment", {
    p_employee_id: employeeId,
    p_calendar_template_id: calendarTemplateId,
    p_effective_from: effectiveFrom,
  });

  if (rpcErr) {
    const { data: openAssignment } = await supabase
      .from("employee_work_calendar_assignment")
      .select("id, effective_from")
      .eq("employee_id", employeeId)
      .is("effective_to", null)
      .maybeSingle();

    if (openAssignment) {
      if (openAssignment.effective_from === effectiveFrom) {
        const { error: updateErr } = await supabase
          .from("employee_work_calendar_assignment")
          .update({ calendar_template_id: calendarTemplateId })
          .eq("id", openAssignment.id);
        if (updateErr) return { error: updateErr.message };
        return { success: true };
      } else {
        const prevDate = previousDate(effectiveFrom);
        await supabase
          .from("employee_work_calendar_assignment")
          .update({ effective_to: prevDate })
          .eq("id", openAssignment.id);
      }
    }

    const { error } = await supabase
      .from("employee_work_calendar_assignment")
      .insert({
        employee_id: employeeId,
        calendar_template_id: calendarTemplateId,
        effective_from: effectiveFrom,
      });

    if (error) return { error: error.message };
  }

  return { success: true };
}

/**
 * Bulk assigns work calendar templates by employee or department (§3.5, §7).
 * Closes previous open-ended calendar assignments before inserting new effective-dated rows.
 * Writes a single batch audit log entry on completion.
 */
export async function bulkAssignCalendarTemplate(
  rows: CalendarAssignmentImportRow[]
): Promise<BatchCommitResult<CalendarAssignmentImportRow>> {
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

  const permError = await assertPermission("calendar.bulk_assign");
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
  const rowResults: BatchCommitResult<CalendarAssignmentImportRow>["rowResults"] = [];

  // 1. Pre-fetch templates, employees, and departments in bulk
  const empTargetCodes = new Set<string>();
  const deptTargetNames = new Set<string>();

  for (const row of rows) {
    const scope = (row.scope || "employee").toLowerCase();
    const targetCode = sanitizeInput(row.target_code || "").trim();
    if (targetCode) {
      if (scope === "employee") empTargetCodes.add(targetCode);
      if (scope === "department") deptTargetNames.add(targetCode);
    }
  }

  const [
    { data: allTemplates },
    { data: preEmployees },
    { data: preDepartments },
  ] = await Promise.all([
    supabase.from("work_calendar_templates").select("id, code, name"),
    empTargetCodes.size > 0
      ? supabase.from("employees").select("id, employee_code").in("employee_code", Array.from(empTargetCodes))
      : Promise.resolve({ data: [] }),
    deptTargetNames.size > 0
      ? supabase.from("departments").select("id, name").in("name", Array.from(deptTargetNames))
      : Promise.resolve({ data: [] }),
  ]);

  const safeAllTemplates = Array.isArray(allTemplates)
    ? allTemplates
    : allTemplates && typeof allTemplates === "object"
    ? [allTemplates]
    : [];

  const safePreEmployees = Array.isArray(preEmployees)
    ? preEmployees
    : preEmployees && typeof preEmployees === "object"
    ? [preEmployees]
    : [];

  const empMap = new Map<string, { id: string; employee_code: string }>();
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

  // Pre-fetch department employee assignments if any departments targeted
  const deptIds = Array.from(deptMap.values()).map((d) => d.id);
  const { data: deptAssignments } = deptIds.length > 0
    ? await supabase
        .from("employee_department_assignment")
        .select("department_id, employee_id")
        .in("department_id", deptIds)
        .is("effective_to", null)
    : { data: [] };

  const safeDeptAssignments = Array.isArray(deptAssignments)
    ? deptAssignments
    : deptAssignments && typeof deptAssignments === "object"
    ? [deptAssignments]
    : [];

  const deptToEmpsMap = new Map<string, string[]>();
  for (const a of safeDeptAssignments) {
    if (!deptToEmpsMap.has(a.department_id)) deptToEmpsMap.set(a.department_id, []);
    deptToEmpsMap.get(a.department_id)!.push(a.employee_id);
  }

  // Collect all possible employee IDs to pre-fetch open calendar assignments
  const allTargetEmpIds = new Set<string>();
  for (const e of empMap.values()) allTargetEmpIds.add(e.id);
  for (const empIds of deptToEmpsMap.values()) {
    for (const id of empIds) allTargetEmpIds.add(id);
  }

  const { data: openCalendarAssignments } = allTargetEmpIds.size > 0
    ? await supabase
        .from("employee_work_calendar_assignment")
        .select("id, employee_id, effective_from")
        .in("employee_id", Array.from(allTargetEmpIds))
        .is("effective_to", null)
    : { data: [] };

  const safeOpenCalendarAssignments = Array.isArray(openCalendarAssignments)
    ? openCalendarAssignments
    : openCalendarAssignments && typeof openCalendarAssignments === "object"
    ? [openCalendarAssignments]
    : [];

  const openCalendarMap = new Map<string, { id: string; effective_from: string }>();
  for (const a of safeOpenCalendarAssignments) {
    openCalendarMap.set(a.employee_id, a);
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const scope = (row.scope || "employee").toLowerCase();
    const targetCode = sanitizeInput(row.target_code || "").trim();
    const templateName = sanitizeInput(row.template_name || "").trim();
    const effectiveStart = row.effective_start_date ? row.effective_start_date.trim() : getTodayDateStringIST();

    if (!targetCode || !templateName) {
      errorCount++;
      const msg = `Row #${rowNum}: Missing target_code or template_name.`;
      errors.push(msg);
      rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
      continue;
    }

    // 1. Resolve calendar template by code or name
    const matchedTemplate = (allTemplates || []).find(
      (t: { code?: string | null; name?: string | null }) =>
        t.code?.toLowerCase() === templateName.toLowerCase() ||
        t.name?.toLowerCase() === templateName.toLowerCase()
    );

    if (!matchedTemplate) {
      errorCount++;
      const msg = `Row #${rowNum}: Calendar template '${templateName}' not found.`;
      errors.push(msg);
      rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
      continue;
    }

    // 2. Resolve employee ID list based on scope from pre-fetched maps
    let targetEmployeeIds: string[] = [];

    if (scope === "employee") {
      let emp = empMap.get(targetCode.toLowerCase());
      if (!emp) {
        const { data: directEmp } = await supabase
          .from("employees")
          .select("id, employee_code")
          .eq("employee_code", targetCode)
          .maybeSingle();
        if (directEmp) {
          emp = directEmp;
          empMap.set(targetCode.toLowerCase(), directEmp);
        }
      }

      if (!emp) {
        errorCount++;
        const msg = `Row #${rowNum}: Employee code '${targetCode}' not found.`;
        errors.push(msg);
        rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
        continue;
      }
      targetEmployeeIds = [emp.id];
    } else if (scope === "department") {
      let dept = deptMap.get(targetCode.toLowerCase());
      if (!dept) {
        const { data: directDept } = await supabase
          .from("departments")
          .select("id, name")
          .eq("name", targetCode)
          .maybeSingle();
        if (directDept) {
          dept = directDept;
          deptMap.set(targetCode.toLowerCase(), directDept);
        }
      }

      if (!dept) {
        errorCount++;
        const msg = `Row #${rowNum}: Department '${targetCode}' not found.`;
        errors.push(msg);
        rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
        continue;
      }

      let deptEmps = deptToEmpsMap.get(dept.id);
      if (!deptEmps || deptEmps.length === 0) {
        const { data: directDeptAssigns } = await supabase
          .from("employee_department_assignment")
          .select("employee_id")
          .eq("department_id", dept.id)
          .is("effective_to", null);
        const safeAssigns = Array.isArray(directDeptAssigns) ? directDeptAssigns : directDeptAssigns ? [directDeptAssigns] : [];
        deptEmps = safeAssigns.map((a: { employee_id: string }) => a.employee_id);
        deptToEmpsMap.set(dept.id, deptEmps);
      }

      if (!deptEmps || deptEmps.length === 0) {
        errorCount++;
        const msg = `Row #${rowNum}: No active employees found in department '${targetCode}'.`;
        errors.push(msg);
        rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
        continue;
      }

      targetEmployeeIds = Array.from(new Set(deptEmps));
    } else {
      errorCount++;
      const msg = `Row #${rowNum}: Invalid scope '${scope}'. Must be 'employee' or 'department'.`;
      errors.push(msg);
      rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
      continue;
    }

    // 3. Apply assignment to all target employees
    const prevDay = previousDate(effectiveStart);
    let assignFailed = false;

    for (const empId of targetEmployeeIds) {
      let openAssign = openCalendarMap.get(empId);
      if (!openAssign) {
        const { data: directOpenAssign } = await supabase
          .from("employee_work_calendar_assignment")
          .select("id, effective_from")
          .eq("employee_id", empId)
          .is("effective_to", null)
          .maybeSingle();
        if (directOpenAssign) openAssign = directOpenAssign;
      }

      if (openAssign && prevDay) {
        await supabase
          .from("employee_work_calendar_assignment")
          .update({ effective_to: prevDay })
          .eq("id", openAssign.id);
      }

      const { error: insErr } = await supabase
        .from("employee_work_calendar_assignment")
        .insert({
          employee_id: empId,
          calendar_template_id: matchedTemplate.id,
          effective_from: effectiveStart,
        });

      if (insErr) {
        assignFailed = true;
        errorCount++;
        const msg = `Row #${rowNum}: Failed to assign calendar template to employee ID ${empId}: ${insErr.message}`;
        errors.push(msg);
        rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
        break;
      }
    }

    if (!assignFailed) {
      successCount++;
      rowResults.push({
        rowNumber: rowNum,
        status: "success",
        message: `Assigned template '${matchedTemplate.name}' to ${scope} '${targetCode}' (${targetEmployeeIds.length} employee(s)) effective ${effectiveStart}`,
        data: row,
      });
    }
  }

  // 4. Batch audit log entry
  if (successCount > 0) {
    await writeAuditLogAction({
      action: "calendar.bulk_assign",
      entityType: "calendar_assignment",
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
