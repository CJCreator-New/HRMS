"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";
import { writeAuditLogAction } from "@/lib/actions/audit";
import type { StatutoryImportRow } from "@/lib/batch-import/schemas";
import type { BatchCommitResult } from "@/lib/batch-import/types";

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const UAN_REGEX = /^\d{12}$/;

export async function saveStatutoryProfileAction(
  profileId: string,
  panNumber: string,
  uanNumber: string,
  ptState: string,
  taxRegime: "new_regime" | "old_regime",
  pfApplicable: boolean,
  esiApplicable: boolean
): Promise<{ success: boolean; error?: string; profile?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  panNumber = sanitizeInput(panNumber);
  uanNumber = sanitizeInput(uanNumber);
  ptState = sanitizeInput(ptState);

  const permError = await assertPermission("statutory.edit");
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("statutory_profiles")
    .update({
      pan_number: panNumber,
      uan_number: uanNumber,
      pt_state: ptState,
      tax_regime: taxRegime,
      pf_applicable: pfApplicable,
      esi_applicable: esiApplicable,
    })
    .eq("id", profileId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, profile: data };
}

/**
 * Bulk upserts employee statutory registration profiles (§5.10).
 * Validates PAN and UAN formats, tax regime, and resolves employee codes.
 * Writes a batch audit log entry on completion.
 */
export async function bulkUpsertStatutoryProfiles(
  rows: StatutoryImportRow[]
): Promise<BatchCommitResult<StatutoryImportRow>> {
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

  const permError = await assertPermission("statutory.bulk_upsert");
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
  const rowResults: BatchCommitResult<StatutoryImportRow>["rowResults"] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const empCode = sanitizeInput(row.employee_code || "").trim();
    const pan = sanitizeInput(row.pan_number || "").trim().toUpperCase();
    const uan = row.uan_number ? sanitizeInput(row.uan_number).trim() : "";
    const pfNumber = row.pf_number ? sanitizeInput(row.pf_number).trim() : null;
    const esiNumber = row.esi_number ? sanitizeInput(row.esi_number).trim() : null;
    const ptState = sanitizeInput(row.pt_state || "Karnataka").trim();
    const taxRegime = row.tax_regime === "old_regime" ? "old_regime" : "new_regime";
    const pfApplicable = row.pf_applicable !== false;
    const esiApplicable = row.esi_applicable !== false;

    // 1. Validation checks
    if (!empCode) {
      errorCount++;
      const msg = `Row #${rowNum}: Missing employee_code.`;
      errors.push(msg);
      rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
      continue;
    }

    if (!pan || !PAN_REGEX.test(pan)) {
      errorCount++;
      const msg = `Row #${rowNum}: Invalid PAN format '${pan}' for employee ${empCode}. Must be 10 characters (5 letters, 4 digits, 1 letter).`;
      errors.push(msg);
      rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
      continue;
    }

    if (uan && !UAN_REGEX.test(uan)) {
      errorCount++;
      const msg = `Row #${rowNum}: Invalid UAN format '${uan}' for employee ${empCode}. Must be 12 numeric digits.`;
      errors.push(msg);
      rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
      continue;
    }

    // 2. Resolve employee by code
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

    // 3. Check for existing statutory profile
    const { data: existingProfile } = await supabase
      .from("statutory_profiles")
      .select("id, effective_from")
      .eq("employee_id", emp.id)
      .is("effective_to", null)
      .maybeSingle();

    if (existingProfile) {
      // Update existing open profile
      const { error: updateErr } = await supabase
        .from("statutory_profiles")
        .update({
          pan_number: pan,
          uan_number: uan || null,
          pf_number: pfNumber,
          esi_number: esiNumber,
          pt_state: ptState,
          tax_regime: taxRegime,
          pf_applicable: pfApplicable,
          esi_applicable: esiApplicable,
        })
        .eq("id", existingProfile.id);

      if (updateErr) {
        errorCount++;
        const msg = `Row #${rowNum}: Failed to update statutory profile for ${empCode}: ${updateErr.message}`;
        errors.push(msg);
        rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
      } else {
        successCount++;
        rowResults.push({
          rowNumber: rowNum,
          status: "success",
          message: `Updated statutory profile (PAN: ${pan}, PT: ${ptState}, Regime: ${taxRegime})`,
          data: row,
        });
      }
    } else {
      // Insert new statutory profile
      const today = new Date().toISOString().split("T")[0];
      const { error: insertErr } = await supabase
        .from("statutory_profiles")
        .insert({
          employee_id: emp.id,
          pan_number: pan,
          uan_number: uan || null,
          pf_number: pfNumber,
          esi_number: esiNumber,
          pt_state: ptState,
          tax_regime: taxRegime,
          pf_applicable: pfApplicable,
          esi_applicable: esiApplicable,
          effective_from: today,
        });

      if (insertErr) {
        errorCount++;
        const msg = `Row #${rowNum}: Failed to create statutory profile for ${empCode}: ${insertErr.message}`;
        errors.push(msg);
        rowResults.push({ rowNumber: rowNum, status: "failed", message: msg, data: row });
      } else {
        successCount++;
        rowResults.push({
          rowNumber: rowNum,
          status: "success",
          message: `Created statutory profile (PAN: ${pan}, PT: ${ptState}, Regime: ${taxRegime})`,
          data: row,
        });
      }
    }
  }

  // 4. Batch audit log entry
  if (successCount > 0) {
    await writeAuditLogAction({
      action: "statutory.bulk_upsert",
      entityType: "statutory_profile",
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
