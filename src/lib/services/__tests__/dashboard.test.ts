import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { createFakeSupabase } from "./helpers/fake-supabase";
import { getDashboardData } from "@/lib/services/dashboard";

describe("getDashboardData", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("returns headcount from RPC get_dashboard_headcount when available", async () => {
    const fake = createFakeSupabase({
      rpcs: {
        get_dashboard_headcount: () => ({
          data: [{ active: 42, new_this_month: 5 }],
          error: null,
        }),
      },
      respond: (state) => {
        if (state.table === "v_pending_approvals_dashboard") {
          return { count: 3, error: null };
        }
        if (state.table === "attendance_records") {
          return {
            data: { id: "rec-1", check_in_time: "2026-08-21T09:00:00Z", check_out_time: null },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await getDashboardData({
      roles: ["hr"],
      mustChangePassword: false,
      userName: "HR Admin",
      employeeId: "emp-hr-1",
    });

    expect(result.headcount).toEqual({ active: 42, newThisMonth: 5 });
    expect(result.pendingApprovals).toBe(3);
    expect(result.punch).toEqual({
      employeeId: "emp-hr-1",
      isCheckedIn: true,
      checkInTime: "2026-08-21T09:00:00Z",
      activeRecordId: "rec-1",
    });
  });

  it("falls back to count queries if RPC get_dashboard_headcount fails", async () => {
    const fake = createFakeSupabase({
      rpcs: {
        get_dashboard_headcount: () => ({
          data: null,
          error: { message: "RPC not available" },
        }),
      },
      respond: (state) => {
        if (state.table === "employees") {
          // Check if it's the newThisMonth query (has gte filter) or active query
          const hasGte = state.filters.some((f) => f.op === "gte");
          return { count: hasGte ? 2 : 10, error: null };
        }
        if (state.table === "v_pending_approvals_dashboard") {
          return { count: 0, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await getDashboardData({
      roles: ["system_admin"],
      mustChangePassword: false,
      userName: "Sys Admin",
      employeeId: null,
    });

    expect(result.headcount).toEqual({ active: 10, newThisMonth: 2 });
    expect(result.pendingApprovals).toBe(0);
    expect(result.punch).toBeNull();
  });

  it("returns null headcount for standard employee role without admin privileges", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "attendance_records") {
          return {
            data: { id: "rec-2", check_in_time: "2026-08-21T09:00:00Z", check_out_time: "2026-08-21T17:00:00Z" },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await getDashboardData({
      roles: ["employee"],
      mustChangePassword: false,
      userName: "John Doe",
      employeeId: "emp-101",
    });

    expect(result.headcount).toBeNull();
    expect(result.punch).toEqual({
      employeeId: "emp-101",
      isCheckedIn: false,
      checkInTime: "2026-08-21T09:00:00Z",
      activeRecordId: "rec-2",
    });
  });
});
