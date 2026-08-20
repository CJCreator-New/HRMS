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

