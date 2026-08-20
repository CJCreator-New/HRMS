"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission, assertCallerIdentity } from "@/lib/auth/assertPermission";
import { checkActionRateLimit } from "@/lib/auth/rate-limit";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

export async function submitReimbursementClaimAction(
  employeeId: string,
  categoryId: string,
  claimDate: string,
  vendorName: string,
  requestedAmount: number
): Promise<{ success: boolean; error?: string; claim?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const rateCheck = await checkActionRateLimit(employeeId, "submit_reimbursement", 20, 3600000);
  if (!rateCheck.allowed) {
    const mins = Math.ceil(rateCheck.retryAfterMs / 60000);
    return { success: false, error: `Rate limit exceeded: Too many claims submitted. Please try again in ${mins} minute(s).` };
  }

  vendorName = sanitizeInput(vendorName);

  const permError = await assertPermission("reimbursement.apply.self");
  if (permError) return { success: false, error: permError.error };

  const identityError = await assertCallerIdentity(employeeId, ["reimbursement.view.all", "reimbursement.approve"]);
  if (identityError) return { success: false, error: identityError.error };

  const supabase = await createClient();

  // Check duplicate policy
  const { data: cat } = await supabase
    .from("reimbursement_categories")
    .select("*")
    .eq("id", categoryId)
    .single();

  const { data: duplicates } = await supabase
    .from("reimbursement_claims")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("claim_date", claimDate)
    .eq("requested_amount", requestedAmount);

  const isDuplicate = (duplicates && duplicates.length > 0) || false;

  if (isDuplicate && cat?.duplicate_policy === "block") {
    return { success: false, error: "Duplicate Claim Blocked: Claim with identical amount and date already exists." };
  }

  const initialStatus =
    cat?.approval_route === "manager_then_hr" || cat?.approval_route === "manager_only"
      ? "pending_manager"
      : "pending_hr";

  const { data: claim, error } = await supabase
    .from("reimbursement_claims")
    .insert({
      employee_id: employeeId,
      category_id: categoryId,
      claim_date: claimDate,
      vendor_name: vendorName,
      requested_amount: requestedAmount,
      is_duplicate_warning: isDuplicate && cat?.duplicate_policy === "warn_and_allow",
      status: initialStatus,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, claim };
}

export async function approveReimbursementClaimAction(
  claimId: string,
  decision: "approved" | "rejected",
  approvedAmount?: number
): Promise<{ success: boolean; error?: string; newStatus?: string }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("reimbursement.approve");
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let deciderId: string | null = null;
  if (user) {
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    deciderId = emp?.id || null;
  }

  // Fetch claim with category to check approval route
  const { data: claim, error: fetchError } = await supabase
    .from("reimbursement_claims")
    .select("*, reimbursement_categories(*)")
    .eq("id", claimId)
    .single();

  if (fetchError || !claim) {
    return { success: false, error: "Reimbursement claim not found." };
  }

  // Self-approval defense-in-depth
  if (deciderId && claim.employee_id === deciderId) {
    return { success: false, error: "Self-approval of reimbursement claims is not permitted." };
  }

  if (claim.status === "approved" || claim.status === "rejected" || claim.status === "paid") {
    return { success: false, error: `Claim is already finalized as '${claim.status}'.` };
  }

  if (decision === "rejected") {
    const { error: updateError } = await supabase
      .from("reimbursement_claims")
      .update({
        status: "rejected",
        approver_id: deciderId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimId);

    if (updateError) return { success: false, error: updateError.message };
    return { success: true, newStatus: "rejected" };
  }

  // Two-stage routing check (FR §11.3 / D11)
  const category = claim.reimbursement_categories;
  const route = category?.approval_route || "manager_only";

  let nextStatus: string = "approved";

  if (route === "manager_then_hr") {
    if (claim.status === "pending_manager" || claim.status === "submitted") {
      // Stage 1 (Manager) approval -> Advances to pending_hr
      nextStatus = "pending_hr";
    } else if (claim.status === "pending_hr") {
      // Stage 2 (HR) approval -> Final approved
      nextStatus = "approved";
    } else {
      return { success: false, error: "Two-stage approval violation: Invalid current state for manager_then_hr route." };
    }
  } else {
    // Single-stage route (manager_only or hr_only)
    nextStatus = "approved";
  }

  const updatePayload: Record<string, any> = {
    status: nextStatus,
    approver_id: deciderId,
    updated_at: new Date().toISOString(),
  };

  if (nextStatus === "approved") {
    updatePayload.approved_amount = approvedAmount ?? claim.requested_amount;
    updatePayload.decided_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from("reimbursement_claims")
    .update(updatePayload)
    .eq("id", claimId);

  if (updateError) return { success: false, error: updateError.message };
  return { success: true, newStatus: nextStatus };
}

