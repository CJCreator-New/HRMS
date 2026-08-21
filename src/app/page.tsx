import { getCurrentUserRoles, type CurrentUserInfo } from "@/lib/auth/current-user";
import { getDashboardData, type DashboardData } from "@/lib/services/dashboard";
import { formatDateIndian } from "@/lib/utils/formatters";
import { DashboardWorkspace } from "@/components/dashboard/DashboardWorkspace";

const FALLBACK_USER: CurrentUserInfo = {
  roles: ["employee"],
  mustChangePassword: false,
  userName: "Employee",
  employeeId: null,
};

const EMPTY_DATA: DashboardData = { headcount: null, pendingApprovals: null, punch: null };

/**
 * Dashboard — command center (RSC data pre-fetch + client workspace focus adaptation).
 *
 * Server component: pre-fetches dashboard metrics in one pass on the server.
 * Interactive rendering and active-focus filtering are handled inside the
 * DashboardWorkspace client island.
 *
 * E2E contract preserved (e2e/specs/navigation/dashboard.spec.ts):
 *  - data-testid="dashboard-greeting"  role-aware h2 heading
 *  - data-testid="next-actions"        role-aware contextual action links
 */
export default async function DashboardPage() {
  // Graceful degradation: if the DB/session layer is unavailable, render the
  // default employee view with placeholder data instead of 500-ing the page.
  let userInfo: CurrentUserInfo = FALLBACK_USER;
  let data: DashboardData = EMPTY_DATA;
  try {
    userInfo = await getCurrentUserRoles();
  } catch {
    userInfo = FALLBACK_USER;
  }
  try {
    data = await getDashboardData(userInfo);
  } catch {
    data = EMPTY_DATA;
  }

  const todayStr = formatDateIndian(new Date());
  const payrollPeriodLabel = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <DashboardWorkspace
      initialData={data}
      todayStr={todayStr}
      payrollPeriodLabel={payrollPeriodLabel}
    />
  );
}
