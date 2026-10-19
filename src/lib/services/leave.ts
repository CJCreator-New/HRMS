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

export const BASELINE_LEAVE_ALLOCATIONS: LeaveAllocationView[] = [
  { type_code: "CL", type_name: "Casual Leave", allocated: 12, used: 0, pending: 0, balance: 12, is_sandwich_enabled: false },
  { type_code: "SL", type_name: "Sick Leave", allocated: 10, used: 0, pending: 0, balance: 10, is_sandwich_enabled: false },
  { type_code: "EL", type_name: "Earned Leave", allocated: 15, used: 0, pending: 0, balance: 15, is_sandwich_enabled: true },
  { type_code: "COMP_OFF", type_name: "Compensatory Off", allocated: 0, used: 0, pending: 0, balance: 0, is_sandwich_enabled: false },
  { type_code: "LOP", type_name: "Loss of Pay", allocated: 0, used: 0, pending: 0, balance: 0, is_sandwich_enabled: false },
];

export interface LeaveDashboardData {
  employeeId: string | null;
  allocations: LeaveAllocationView[];
  requests: LeaveRequestView[];
}

export async function getLeaveDashboard(userInfo: CurrentUserInfo): Promise<LeaveDashboardData> {
  const empty: LeaveDashboardData = {
    employeeId: userInfo.employeeId,
    allocations: BASELINE_LEAVE_ALLOCATIONS,
    requests: [],
  };

  if (!userInfo.employeeId) return empty;

  const supabase = await createClient();

  try {
    const [{ data: leaveTypes }, { data: allocations }, { data: requests }] = await Promise.all([
      supabase
        .from("leave_types")
        .select("id, code, name, is_sandwich_enabled")
        .order("code"),
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

    type RawAlloc = {
      leave_types?: { code?: string | null; name?: string | null } | null;
      leave_type_code?: string | null;
      leave_type_name?: string | null;
      allocated_days?: number | null;
      used_days?: number | null;
      pending_days?: number | null;
      balance_days?: number | null;
      carry_forward_days?: number | null;
      is_sandwich_enabled?: boolean | null;
    };

    const allocMap = new Map<string, RawAlloc>();

    for (const a of ((allocations || []) as unknown as RawAlloc[])) {
      const code = a.leave_types?.code || a.leave_type_code;
      if (code) allocMap.set(code, a);
    }

    let resolvedAllocations: LeaveAllocationView[] = [];

    if (leaveTypes && leaveTypes.length > 0) {
      resolvedAllocations = leaveTypes.map((lt) => {
        const a = allocMap.get(lt.code);
        const allocated = a?.allocated_days || 0;
        const used = a?.used_days || 0;
        const pending = a?.pending_days || 0;
        const carryForward = a?.carry_forward_days || 0;
        const computedBalance = allocated + carryForward - used;
        const balance = a?.balance_days !== undefined && a?.balance_days !== null ? a.balance_days : computedBalance;
        return {
          type_code: lt.code,
          type_name: lt.name,
          allocated,
          used,
          pending,
          balance,
          is_sandwich_enabled: a?.is_sandwich_enabled ?? lt.is_sandwich_enabled ?? false,
        };
      });
    } else if (allocations && allocations.length > 0) {
      resolvedAllocations = ((allocations || []) as Array<{
        leave_types?: { code?: string | null; name?: string | null } | null;
        leave_type_code?: string | null;
        leave_type_name?: string | null;
        allocated_days?: number | null;
        used_days?: number | null;
        pending_days?: number | null;
        balance_days?: number | null;
        is_sandwich_enabled?: boolean | null;
      }>).map((a) => ({
        type_code: a.leave_types?.code || a.leave_type_code || "",
        type_name: a.leave_types?.name || a.leave_type_name || "",
        allocated: a.allocated_days || 0,
        used: a.used_days || 0,
        pending: a.pending_days || 0,
        balance: a.balance_days || 0,
        is_sandwich_enabled: a.is_sandwich_enabled ?? false,
      }));
    } else {
      resolvedAllocations = BASELINE_LEAVE_ALLOCATIONS;
    }

    return {
      employeeId: userInfo.employeeId,
      allocations: resolvedAllocations,
      requests: ((requests || []) as Array<{
        id: string;
        employee_id: string;
        full_name?: string | null;
        leave_type_code?: string | null;
        leave_types?: { name?: string | null } | null;
        leave_type_name?: string | null;
        start_date: string;
        end_date: string;
        duration_type: LeaveRequestView["duration_type"];
        total_days: number;
        reason: string;
        status: LeaveRequestView["status"];
        employees?: { full_name?: string | null } | null;
      }>).map((r) => ({
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
