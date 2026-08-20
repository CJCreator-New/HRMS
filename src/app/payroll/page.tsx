import { safeGetCurrentUserRoles } from "@/lib/auth/current-user";
import { permissionsForRoles, hasPermission } from "@/lib/auth/permissions-map";
import { getPayrollDashboard, type PayrollDashboardData } from "@/lib/services/payroll";
import { ReadOnlyBanner } from "@/components/shared/ReadOnlyBanner";
import { PayrollWorkspace } from "@/components/payroll/PayrollWorkspace";

const EMPTY_DATA: PayrollDashboardData = { periods: [], payslips: [] };

/**
 * Payroll Core Engine & Revisions (Slice 5: RSC conversion + token styling).
 *
 * Server component: payroll periods + payslip register resolve on the server
 * (scope-aware via `payroll.view`) and pass into the client workspace island
 * (run / finalize / reopen, payslip print modal).
 *
 * E2E contract preserved:
 *  - data-testid="payroll-header", "stepper*"
 *  - data-testid="run-payroll-btn" / "reopen-payroll-btn" / "finalize-payroll-btn"
 *  - data-testid="payroll-eligibility-widget", "view-payslip-btn", "print-payslip-btn"
 */
export default async function PayrollCorePage() {
  const userInfo = await safeGetCurrentUserRoles();
  const permissions = permissionsForRoles(userInfo.roles);
  const canViewAll = hasPermission(permissions, "payroll.view");

  let data: PayrollDashboardData = EMPTY_DATA;
  try {
    data = await getPayrollDashboard(userInfo, canViewAll);
  } catch {
    data = EMPTY_DATA;
  }

  return (
    <div className="space-y-6">
      <ReadOnlyBanner moduleName="Payroll Operations" />
      <PayrollWorkspace initialPeriods={data.periods} initialPayslips={data.payslips} />
    </div>
  );
}
