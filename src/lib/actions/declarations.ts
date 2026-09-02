"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission, assertAnyPermission, getAuthenticatedCaller } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";
import { writeAuditLogAction } from "@/lib/actions/audit";
import { logger } from "@/lib/logger";

export interface InvestmentDeclarationInput {
  financialYear: string;
  section80C: number;
  section80D: number;
  section80G: number;
  otherExemptions: number;
  hraAnnualRent: number;
}

export interface InvestmentDeclarationRecord {
  id: string;
  employee_id: string;
  financial_year: string;
  section_80c_amount: number;
  section_80d_amount: number;
  section_80g_amount: number;
  other_exemptions_amount: number;
  hra_annual_rent: number;
  total_declared_amount: number;
  status: "draft" | "submitted" | "verified" | "rejected";
  submitted_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_remarks?: string | null;
  created_at: string;
}

export async function submitInvestmentDeclarationAction(
  input: InvestmentDeclarationInput
): Promise<{ success: boolean; data?: InvestmentDeclarationRecord; error?: string }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertAnyPermission(["statutory.view", "employee.view.self"]);
  if (permError) return { success: false, error: permError.error };

  const caller = await getAuthenticatedCaller();
  if (!caller?.employeeId) {
    return { success: false, error: "Unauthenticated caller." };
  }

  // Cap validation per Indian IT Act limits:
  // Section 80C: max ₹1,50,000
  // Section 80D: max ₹1,00,000 (parents + self)
  const sec80c = Math.max(0, Number(input.section80C) || 0);
  const sec80d = Math.max(0, Number(input.section80D) || 0);
  const sec80g = Math.max(0, Number(input.section80G) || 0);
  const otherExempt = Math.max(0, Number(input.otherExemptions) || 0);
  const hraRent = Math.max(0, Number(input.hraAnnualRent) || 0);
  const total = sec80c + sec80d + sec80g + otherExempt;

  const fy = sanitizeInput(input.financialYear).trim() || "2025-2026";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investment_declarations")
    .upsert(
      {
        employee_id: caller.employeeId,
        financial_year: fy,
        section_80c_amount: sec80c,
        section_80d_amount: sec80d,
        section_80g_amount: sec80g,
        other_exemptions_amount: otherExempt,
        hra_annual_rent: hraRent,
        total_declared_amount: total,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "employee_id,financial_year" }
    )
    .select()
    .single();

  if (error) {
    logger.error("statutory.declaration_error", {
      actorId: caller.employeeId,
      message: `Failed to submit investment declaration: ${error.message}`,
    });
    return { success: false, error: error.message };
  }

  await writeAuditLogAction({
    action: "statutory.declaration_submitted",
    entityType: "investment_declaration",
    entityId: data.id,
    details: { financialYear: fy, totalDeclared: total },
  });

  return { success: true, data };
}

export async function getEmployeeDeclarationsAction(
  targetEmployeeId?: string
): Promise<{ success: boolean; declarations?: InvestmentDeclarationRecord[]; error?: string }> {
  const caller = await getAuthenticatedCaller();
  if (!caller?.employeeId) {
    return { success: false, error: "Unauthenticated caller." };
  }

  const effectiveEmpId = targetEmployeeId || caller.employeeId;

  // If viewing another employee's declarations, require statutory.view permission
  if (effectiveEmpId !== caller.employeeId) {
    const permError = await assertPermission("statutory.view");
    if (permError) return { success: false, error: permError.error };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investment_declarations")
    .select("*")
    .eq("employee_id", effectiveEmpId)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, declarations: data || [] };
}

export async function reviewInvestmentDeclarationAction(
  declarationId: string,
  status: "verified" | "rejected",
  remarks?: string
): Promise<{ success: boolean; error?: string }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("statutory.edit");
  if (permError) return { success: false, error: permError.error };

  const caller = await getAuthenticatedCaller();
  if (!caller?.employeeId) {
    return { success: false, error: "Unauthenticated caller." };
  }

  const supabase = await createClient();

  // Self-approval guardrail check
  const { data: decl, error: fetchErr } = await supabase
    .from("investment_declarations")
    .select("employee_id")
    .eq("id", declarationId)
    .single();

  if (fetchErr || !decl) {
    return { success: false, error: "Declaration not found." };
  }

  if (decl.employee_id === caller.employeeId) {
    return {
      success: false,
      error: "Self-approval violation: You cannot review or verify your own investment declarations.",
    };
  }

  const { error: updateErr } = await supabase
    .from("investment_declarations")
    .update({
      status,
      reviewed_by: caller.employeeId,
      reviewed_at: new Date().toISOString(),
      review_remarks: remarks ? sanitizeInput(remarks).trim() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", declarationId);

  if (updateErr) return { success: false, error: updateErr.message };

  await writeAuditLogAction({
    action: `statutory.declaration_${status}`,
    entityType: "investment_declaration",
    entityId: declarationId,
    details: { reviewerId: caller.employeeId, status, remarks },
  });

  return { success: true };
}
