"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission, assertAnyPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";
import { previousDate } from "@/lib/services/compensation-engine";
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

  const { error } = await supabase
    .from("employee_work_calendar_assignment")
    .insert({
      employee_id: employeeId,
      calendar_template_id: calendarTemplateId,
      effective_from: effectiveFrom,
    });

  if (error) return { error: error.message };
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

  // Fetch all templates to match by code or name
  const { data: allTemplates } = await supabase
    .from("work_calendar_templates")
    .select("id, code, name");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const scope = (row.scope || "employee").toLowerCase();
    const targetCode = sanitizeInput(row.target_code || "").trim();
    const templateName = sanitizeInput(row.template_name || "").trim();
    const effectiveStart = row.effective_start_date ? row.effective_start_date.trim() : new Date().toISOString().split("T")[0];

    if (!targetCode || !templateName) {
      errorCount++;
      const msg = `Row #${rowNum}: Missing target_code or template_name.`;
      errors.push(msg);
      rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
      continue;
    }

    // 1. Resolve calendar template by code or name
    const matchedTemplate = (allTemplates || []).find(
      (t: any) =>
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

    // 2. Resolve employee ID list based on scope
    let targetEmployeeIds: string[] = [];

    if (scope === "employee") {
      const { data: emp, error: empErr } = await supabase
        .from("employees")
        .select("id, employee_code")
        .eq("employee_code", targetCode)
        .maybeSingle();

      if (empErr || !emp) {
        errorCount++;
        const msg = `Row #${rowNum}: Employee code '${targetCode}' not found.`;
        errors.push(msg);
        rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
        continue;
      }
      targetEmployeeIds = [emp.id];
    } else if (scope === "department") {
      // Resolve department
      const { data: dept, error: deptErr } = await supabase
        .from("departments")
        .select("id, name")
        .eq("name", targetCode)
        .maybeSingle();

      if (deptErr || !dept) {
        errorCount++;
        const msg = `Row #${rowNum}: Department '${targetCode}' not found.`;
        errors.push(msg);
        rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
        continue;
      }

      // Query active employees in department
      const { data: deptAssignments } = await supabase
        .from("employee_department_assignment")
        .select("employee_id")
        .eq("department_id", dept.id)
        .is("effective_to", null);

      if (!deptAssignments || deptAssignments.length === 0) {
        errorCount++;
        const msg = `Row #${rowNum}: No active employees found in department '${targetCode}'.`;
        errors.push(msg);
        rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
        continue;
      }

      targetEmployeeIds = Array.from(new Set(deptAssignments.map((a: any) => a.employee_id)));
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
      // Close open previous calendar assignment
      const { data: openAssign } = await supabase
        .from("employee_work_calendar_assignment")
        .select("id, effective_from")
        .eq("employee_id", empId)
        .is("effective_to", null)
        .maybeSingle();

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
