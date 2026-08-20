import { createClient } from "@/lib/supabase/server";
import type { CurrentUserInfo } from "@/lib/auth/current-user";

/**
 * Server-side dashboard data (Slice 1 — RSC conversion).
 *
 * Previously the dashboard fetched the full employee list client-side (just to
 * count active records) and all 30 attendance rows (just to find today's
 * punch). This service replaces those with targeted count / single-row queries
 * and resolves everything in one server pass.
 *
 * Every query is wrapped so a down/unreachable DB degrades the dashboard to
 * "—" placeholders instead of crashing the page (matches the previous
 * client-side failure behavior, where fetches simply never resolved).
 */

export interface PunchState {
  employeeId: string | null;
  isCheckedIn: boolean;
  checkInTime: string | null;
  activeRecordId: string | null;
}

export interface DashboardData {
  /** Resolved only when the viewer holds `employee.view.all`. */
  headcount: { active: number; newThisMonth: number } | null;
  /** Resolved only when the viewer holds an approval permission. */
  pendingApprovals: number | null;
  /** Today's punch state for the session user (self-service). */
  punch: PunchState | null;
}

const todayIso = () => new Date().toISOString().split("T")[0];

export async function getDashboardData(userInfo: CurrentUserInfo): Promise<DashboardData> {
  const supabase = await createClient();

  const hasHeadcountAccess = userInfo.roles.includes("system_admin") || userInfo.roles.includes("hr") || userInfo.roles.includes("payroll_admin");

  // -- Headcount: targeted counts instead of a full employee fetch -------------
  const headcountPromise = (async (): Promise<DashboardData["headcount"]> => {
    if (!hasHeadcountAccess) return null;
    try {
      const activeQuery = supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      const [{ count: active }, { count: newThisMonth }] = await Promise.all([
        activeQuery,
        supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gte("activated_at", `${todayIso().slice(0, 7)}-01`),
      ]);
      return { active: active ?? 0, newThisMonth: newThisMonth ?? 0 };
    } catch {
      return null;
    }
  })();

  // -- Pending approvals: count from the RLS-scoped dashboard view -------------
  const pendingApprovalsPromise = (async (): Promise<number | null> => {
    try {
      const { count, error } = await supabase
        .from("v_pending_approvals_dashboard")
        .select("*", { count: "exact", head: true });
      if (error) return null;
      return count ?? 0;
    } catch {
      return null;
    }
  })();

  // -- Today's punch state -----------------------------------------------------
  const punchPromise = (async (): Promise<PunchState | null> => {
    if (!userInfo.employeeId) return null;
    try {
      const { data: todayRec } = await supabase
        .from("attendance_records")
        .select("id, check_in_time, check_out_time")
        .eq("employee_id", userInfo.employeeId)
        .eq("attendance_date", todayIso())
        .maybeSingle();
      const isCheckedIn = !!todayRec?.check_in_time && !todayRec?.check_out_time;
      return {
        employeeId: userInfo.employeeId,
        isCheckedIn,
        checkInTime: todayRec?.check_in_time ?? null,
        activeRecordId: todayRec?.id ?? null,
      };
    } catch {
      return null;
    }
  })();

  const [headcount, pendingApprovals, punch] = await Promise.all([
    headcountPromise,
    pendingApprovalsPromise,
    punchPromise,
  ]);

  return { headcount, pendingApprovals, punch };
}
