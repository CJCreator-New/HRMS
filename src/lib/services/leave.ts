import { createClient } from "@/lib/supabase/server";
import type { CurrentUserInfo } from "@/lib/auth/current-user";

/**
 * Server-side leave data (Slice 3 — RSC conversion).
 *
 * Mirrors the output of the `getLeaveDataAction` server action so the RSC page
 * can resolve allocations + request ledger in one server pass and hand them to
 * the client workspace as serialized props. Degrades to empty on DB failure.
 */

export interface LeaveAllocationView {
  type_code: string;
  type_name: string;
  allocated: number;
  used: number;
  pending: number;
  balance: number;
  is_sandwich_enabled: boolean;
}

export interface LeaveRequestView {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type_code: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  duration_type: "full_day" | "first_half" | "second_half";
  total_days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "withdrawn";
  approver_name: string;
}

export interface LeaveDashboardData {
  employeeId: string | null;
  allocations: LeaveAllocationView[];
  requests: LeaveRequestView[];
}

export async function getLeaveDashboard(userInfo: CurrentUserInfo): Promise<LeaveDashboardData> {
  const empty: LeaveDashboardData = {
    employeeId: userInfo.employeeId,
    allocations: [],
    requests: [],
  };

  if (!userInfo.employeeId) return empty;

  const supabase = await createClient();

  try {
    const [{ data: allocations }, { data: requests }] = await Promise.all([
      supabase
        .from("leave_allocations")
        .select("*, leave_types(code, name)")
        .eq("employee_id", userInfo.employeeId),
      supabase
        .from("leave_requests")
        .select("*, leave_types(name), employees!current_approver_id(full_name)")
        .eq("employee_id", userInfo.employeeId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    return {
      employeeId: userInfo.employeeId,
      allocations: (allocations || []).map((a: any) => ({
        type_code: a.leave_types?.code || a.leave_type_code || "",
        type_name: a.leave_types?.name || a.leave_type_name || "",
        allocated: a.allocated_days || 0,
        used: a.used_days || 0,
        pending: a.pending_days || 0,
        balance: a.balance_days || 0,
        is_sandwich_enabled: a.is_sandwich_enabled ?? false,
      })),
      requests: (requests || []).map((r: any) => ({
        id: r.id,
        employee_id: r.employee_id,
        employee_name: r.full_name || "Me",
        leave_type_code: r.leave_type_code || "",
        leave_type_name: r.leave_types?.name || r.leave_type_name || "Leave",
        start_date: r.start_date,
        end_date: r.end_date,
        duration_type: r.duration_type,
        total_days: r.total_days,
        reason: r.reason,
        status: r.status,
        approver_name: r.employees?.full_name || "HR Admin",
      })),
    };
  } catch {
    return empty;
  }
}
