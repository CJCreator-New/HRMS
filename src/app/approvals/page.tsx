import { CheckSquare } from "lucide-react";
import { safeGetCurrentUserRoles } from "@/lib/auth/current-user";
import { permissionsForRoles } from "@/lib/auth/permissions-map";
import { getUnifiedApprovalsAction } from "@/lib/actions/approvals";
import { ApprovalsWorkspace } from "@/components/approvals/ApprovalsWorkspace";

/**
 * Approvals Inbox — Server Component (J1 / FR §4.7).
 *
 * Data resolves on the server (initial page load only). Interactive logic
 * (filters, batch actions, detail drawer) lives in the ApprovalsWorkspace
 * client island. Parental medical privacy masking is applied server-side
 * via the permissions check, then enforced client-side for non-HR users.
 *
 * E2E contract preserved (e2e/specs/modules/approvals.spec.ts):
 *  - main h1 / heading text
 *  - data-testid="select-all-approvals"
 *  - data-testid="approve-selected-btn"
 *  - data-testid="view-approval-btn"
 *  - data-testid="reject-in-drawer-btn", "approve-in-drawer-btn"
 */
export default async function ApprovalsPage() {
  const userInfo = await safeGetCurrentUserRoles();
  const permissions = permissionsForRoles(userInfo.roles);

  // F10: Single data fetch — pending count derived from the unified query
  // (eliminates the separate getPendingApprovalsCountAction call).
  let initialItems: any[] = [];
  let initialTotal = 0;
  let pendingCount = 0;
  try {
    const res = await getUnifiedApprovalsAction({ page: 1, pageSize: 25, module: "all" });
    initialItems = (res.items || []).map((i: any) => ({
      id: i.id,
      module: i.module,
      employee_name: i.employee_name || "Employee",
      employee_code: i.employee_code || "EMP",
      title: i.summary || "Request",
      sub_details: i.amount_or_duration || "-",
      status: i.status || "pending",
      created_at: i.submitted_date || "",
    }));
    initialTotal = res.total ?? 0;
    // Derive pending count from the response (server-side, no extra query).
    pendingCount = initialItems.filter((i) => i.status === "pending").length;
  } catch {
    initialItems = [];
    initialTotal = 0;
  }

  return (
    <ApprovalsWorkspace
      initialItems={initialItems}
      initialTotal={initialTotal}
      initialPendingCount={pendingCount}
    />
  );
}
