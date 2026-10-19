"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission, getAuthenticatedCaller } from "@/lib/auth/assertPermission";
import { validateRequestOrigin } from "@/lib/security";
import { writeAuditLogAction } from "@/lib/actions/audit";
export type ActionResponse<T = void> = {
  success?: boolean;
  data?: T;
  error?: string;
};

export interface CompanyAsset {
  id: string;
  asset_tag: string;
  name: string;
  category: string;
  serial_number?: string | null;
  model?: string | null;
  status: "available" | "allocated" | "maintenance" | "decommissioned" | "lost";
  purchase_date?: string | null;
  cost: number;
}

export interface EmployeeAssetAssignment {
  id: string;
  employee_id: string;
  asset_id: string;
  assigned_at: string;
  returned_at?: string | null;
  condition_notes?: string | null;
  asset?: CompanyAsset;
}

/**
 * List all company assets (IT Admin, HR Admin, System Admin)
 */
export async function listAssetsAction(): Promise<ActionResponse<CompanyAsset[]>> {
  const permError = await assertPermission("settings.manage");
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []) as CompanyAsset[] };
}

/**
 * List assets assigned to a specific employee or all assignments for admins
 */
export async function listEmployeeAssetsAction(
  employeeId?: string
): Promise<ActionResponse<EmployeeAssetAssignment[]>> {
  const caller = await getAuthenticatedCaller();
  const isSelf = employeeId ? caller?.employeeId === employeeId : false;

  if (!isSelf) {
    const permError = await assertPermission("employee.view.all");
    if (permError) return { success: false, error: permError.error };
  }

  const supabase = await createClient();
  let query = supabase
    .from("employee_asset_assignments")
    .select("*, company_assets(*)")
    .order("assigned_at", { ascending: false });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;

  if (error) return { success: false, error: error.message };

  const formatted: EmployeeAssetAssignment[] = (data || []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    employee_id: String(row.employee_id),
    asset_id: String(row.asset_id),
    assigned_at: String(row.assigned_at),
    returned_at: (row.returned_at as string | null) || null,
    condition_notes: (row.condition_notes as string | null) || null,
    asset: row.company_assets as CompanyAsset | undefined,
  }));

  return { success: true, data: formatted };
}

/**
 * Allocate an asset to an employee
 */
export async function allocateAssetAction(
  employeeId: string,
  assetId: string,
  notes?: string
): Promise<ActionResponse<{ assignmentId: string }>> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("offboarding.manage");
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();

  // Verify asset is available
  const { data: asset, error: assetErr } = await supabase
    .from("company_assets")
    .select("id, status, asset_tag")
    .eq("id", assetId)
    .single();

  if (assetErr || !asset) return { success: false, error: "Asset not found" };
  if (asset.status !== "available") {
    return { success: false, error: `Asset ${asset.asset_tag} is not available (status: ${asset.status})` };
  }

  // Create assignment
  const { data: assignment, error: assignErr } = await supabase
    .from("employee_asset_assignments")
    .insert({
      employee_id: employeeId,
      asset_id: assetId,
      assigned_at: new Date().toISOString(),
      condition_notes: notes || null,
    })
    .select("id")
    .single();

  if (assignErr) return { success: false, error: assignErr.message };

  // Update asset status
  await supabase
    .from("company_assets")
    .update({ status: "allocated", updated_at: new Date().toISOString() })
    .eq("id", assetId);

  await writeAuditLogAction({
    action: "allocate_asset",
    entityType: "company_assets",
    entityId: assetId,
    details: { employee_id: employeeId, asset_tag: asset.asset_tag, notes },
  });

  return { success: true, data: { assignmentId: assignment.id } };
}

/**
 * Return an assigned asset
 */
export async function returnAssetAction(
  assignmentId: string,
  conditionNotes?: string
): Promise<ActionResponse> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("offboarding.manage");
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();

  const { data: assignment, error: findErr } = await supabase
    .from("employee_asset_assignments")
    .select("id, asset_id, employee_id, returned_at")
    .eq("id", assignmentId)
    .single();

  if (findErr || !assignment) return { success: false, error: "Assignment record not found" };
  if (assignment.returned_at) return { success: false, error: "Asset has already been returned" };

  const now = new Date().toISOString();

  // Mark assignment returned
  const { error: updateErr } = await supabase
    .from("employee_asset_assignments")
    .update({
      returned_at: now,
      condition_notes: conditionNotes || "Returned in good condition",
    })
    .eq("id", assignmentId);

  if (updateErr) return { success: false, error: updateErr.message };

  // Free asset
  await supabase
    .from("company_assets")
    .update({ status: "available", updated_at: now })
    .eq("id", assignment.asset_id);

  await writeAuditLogAction({
    action: "return_asset",
    entityType: "company_assets",
    entityId: assignment.asset_id,
    details: { assignment_id: assignmentId, condition: conditionNotes },
  });

  return { success: true };
}

/**
 * Check unreturned assets count for offboarding clearance check
 */
export async function getUnreturnedAssetsCountAction(
  employeeId: string
): Promise<ActionResponse<{ count: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employee_asset_assignments")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId)
    .is("returned_at", null);

  if (error) return { success: false, error: error.message };
  return { success: true, data: { count: data ? (data as unknown as number) : 0 } };
}
