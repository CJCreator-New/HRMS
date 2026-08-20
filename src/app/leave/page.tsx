import { Briefcase } from "lucide-react";
import { safeGetCurrentUserRoles } from "@/lib/auth/current-user";
import { permissionsForRoles, hasPermission } from "@/lib/auth/permissions-map";
import { getLeaveDashboard, type LeaveDashboardData } from "@/lib/services/leave";
import { ReadOnlyBanner } from "@/components/shared/ReadOnlyBanner";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeaveWorkspace } from "@/components/leave/LeaveWorkspace";

const EMPTY_DATA: LeaveDashboardData = { employeeId: null, allocations: [], requests: [] };

/**
 * Leave Ledger & Policy Engine (Slice 3: RSC conversion + token styling).
 *
 * Server component: allocations and the request ledger resolve on the server
 * and pass into the client workspace island (forms, toggles, approvals).
 *
 * E2E contract preserved (e2e/specs/modules/leave.spec.ts):
 *  - data-testid="leave-header"
 *  - data-testid="leave-type-select", "duration-type-select", "start-date-input",
 *    "end-date-input", "leave-reason-input", "submit-leave-btn"
 *  - data-testid="compoff-date-input", "submit-compoff-btn"
 *  - data-testid="toggle-manager-view-btn"
 */
export default async function LeaveManagementPage() {
  const userInfo = await safeGetCurrentUserRoles();
  const permissions = permissionsForRoles(userInfo.roles);

  let data: LeaveDashboardData = EMPTY_DATA;
  try {
    data = await getLeaveDashboard(userInfo);
  } catch {
    data = EMPTY_DATA;
  }

  const canApprove =
    hasPermission(permissions, "leave.approve.manager") || hasPermission(permissions, "leave.approve.hr");
  const isHrAdmin = userInfo.roles.includes("hr");

  return (
    <div className="space-y-6">
      <ReadOnlyBanner moduleName="Leave Ledger & Policy Engine" />

      {/* Header Bar (shared PageHeader — WS-B migration) */}
      <PageHeader
        icon={<Briefcase className="w-5 h-5 text-primary-600" aria-hidden="true" />}
        title="Leave Ledger & Policy Engine"
        description="Annual leave balances, sandwich rule policy, leave applications, and the approval queue."
      />

      <LeaveWorkspace
        initialAllocations={data.allocations}
        initialRequests={data.requests}
        employeeId={data.employeeId}
        canApprove={canApprove}
        isHrAdmin={isHrAdmin}
      />
    </div>
  );
}
