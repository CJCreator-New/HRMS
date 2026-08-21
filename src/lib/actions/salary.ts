"use server";

import { createClient } from "@/lib/supabase/server";
import { computeSalaryBreakdown, previousDate } from "@/lib/services/compensation-engine";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";
import { writeAuditLogAction } from "@/lib/actions/audit";
import type { SalaryImportRow } from "@/lib/batch-import/schemas";
import type { BatchCommitResult } from "@/lib/batch-import/types";

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

/**
 * Bulk assigns per-employee salary structure versions (§5.1).
 * Validates employee existence and checks against overlapping version exclusion constraints.
 * Writes a batch audit log entry on completion.
 */
export async function bulkAssignSalaryStructure(
  rows: SalaryImportRow[]
): Promise<BatchCommitResult<SalaryImportRow>> {
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

  const permError = await assertPermission("salary.bulk_assign");
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
  const rowResults: BatchCommitResult<SalaryImportRow>["rowResults"] = [];

  // --- Bulk Pre-fetch to eliminate N+1 DB queries ---
  const allEmpCodes = new Set<string>();
  for (const row of rows) {
    const code = sanitizeInput(row.employee_code || "").trim();
    if (code) allEmpCodes.add(code);
  }

  const { data: preEmployees } = allEmpCodes.size > 0
    ? await supabase
        .from("employees")
        .select("id, employee_code, full_name")
        .in("employee_code", Array.from(allEmpCodes))
    : { data: [] };

  const safePreEmployees = Array.isArray(preEmployees)
    ? preEmployees
    : preEmployees && typeof preEmployees === "object"
    ? [preEmployees]
    : [];

  const empMap = new Map<string, { id: string; employee_code: string; full_name: string }>();
  for (const e of safePreEmployees) {
    if (e.employee_code) empMap.set(e.employee_code.toLowerCase(), e);
  }

  const resolvedEmpIds = Array.from(empMap.values()).map((e) => e.id);
  const { data: allSalaryStructures } = resolvedEmpIds.length > 0
    ? await supabase
        .from("employee_salary_structures")
        .select("id, employee_id, effective_from, effective_to, version_number")
        .in("employee_id", resolvedEmpIds)
    : { data: [] };

  type SalaryVersionRow = { id: string; employee_id?: string; effective_from: string; effective_to: string | null; version_number?: number };
  const safeSalaryStructures = Array.isArray(allSalaryStructures)
    ? allSalaryStructures
    : allSalaryStructures && typeof allSalaryStructures === "object"
    ? [allSalaryStructures]
    : [];

  const salaryHistoryMap = new Map<string, SalaryVersionRow[]>();
  for (const v of safeSalaryStructures as SalaryVersionRow[]) {
    if (v.employee_id) {
      if (!salaryHistoryMap.has(v.employee_id)) salaryHistoryMap.set(v.employee_id, []);
      salaryHistoryMap.get(v.employee_id)!.push(v);
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const empCode = sanitizeInput(row.employee_code || "").trim();
    const annualCtc = Number(row.annual_ctc);
    const effectiveFrom = row.effective_start_date;
    const effectiveTo = row.effective_end_date ? row.effective_end_date.trim() : null;

    if (!empCode || isNaN(annualCtc) || !effectiveFrom) {
      errorCount++;
      const msg = `Row #${rowNum}: Missing required salary fields (employee_code, annual_ctc, effective_start_date).`;
      errors.push(msg);
      rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
      continue;
    }

    // 1. Resolve employee (pre-fetch map with fallback)
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

    // 2. Fetch existing salary structures from pre-fetched history map with fallback
    let existingVersions: SalaryVersionRow[] = salaryHistoryMap.get(emp.id) || [];
    if (existingVersions.length === 0) {
      const { data: directVersions } = await supabase
        .from("employee_salary_structures")
        .select("id, employee_id, effective_from, effective_to, version_number")
        .eq("employee_id", emp.id);
      const safeDirect = (Array.isArray(directVersions) ? directVersions : directVersions ? [directVersions] : []) as SalaryVersionRow[];
      if (safeDirect.length > 0) {
        existingVersions = safeDirect;
        salaryHistoryMap.set(emp.id, safeDirect);
      }
    }

    const newStart = new Date(effectiveFrom).getTime();
    const newEnd = effectiveTo ? new Date(effectiveTo).getTime() : Infinity;

    let hasOverlapConflict = false;
    let openVersionToClose: { id: string; effective_from: string } | null = null;

    for (const v of existingVersions) {
      const vStart = new Date(v.effective_from).getTime();
      const vEnd = v.effective_to ? new Date(v.effective_to).getTime() : Infinity;

      // Check if [newStart, newEnd] overlaps with [vStart, vEnd]
      if (newStart <= vEnd && vStart <= newEnd) {
        // If the existing version is open-ended and starts strictly before newStart, and new version is open or future
        if (v.effective_to === null && newStart > vStart && !openVersionToClose) {
          openVersionToClose = { id: v.id, effective_from: v.effective_from };
        } else {
          hasOverlapConflict = true;
          const conflictPeriod = `[${v.effective_from} to ${v.effective_to || "present"}]`;
          const requestedPeriod = `[${effectiveFrom} to ${effectiveTo || "present"}]`;
          const msg = `Row #${rowNum}: Overlapping version conflict for ${empCode}: version ${conflictPeriod} overlaps requested ${requestedPeriod}.`;
          errors.push(msg);
          rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
          break;
        }
      }
    }

    if (hasOverlapConflict) {
      errorCount++;
      continue;
    }

    // Close the previous open version if applicable
    if (openVersionToClose) {
      const prevDay = previousDate(effectiveFrom);
      await supabase
        .from("employee_salary_structures")
        .update({ effective_to: prevDay })
        .eq("id", openVersionToClose.id);
    }

    // 3. Compute salary breakdown & insert new record
    const { monthlyGross, basicMonthly } = computeSalaryBreakdown(annualCtc);
    const nextVersionNum = existingVersions.length + 1;

    const { error: insertErr } = await supabase
      .from("employee_salary_structures")
      .insert({
        employee_id: emp.id,
        annual_ctc: annualCtc,
        monthly_gross: monthlyGross,
        basic_monthly: basicMonthly,
        effective_from: effectiveFrom,
        effective_to: effectiveTo,
        version_number: nextVersionNum,
      });

    if (insertErr) {
      errorCount++;
      const msg = `Row #${rowNum}: Failed to insert salary structure for ${empCode}: ${insertErr.message}`;
      errors.push(msg);
      rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
    } else {
      successCount++;
      rowResults.push({
        rowNumber: rowNum,
        status: "success",
        message: `Assigned CTC ₹${annualCtc.toLocaleString("en-IN")} effective ${effectiveFrom}`,
        data: row,
      });
    }
  }

  // 4. Record single batch audit log entry
  if (successCount > 0) {
    await writeAuditLogAction({
      action: "salary.bulk_assign",
      entityType: "salary_structure",
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
