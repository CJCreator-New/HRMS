import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
  assertAnyPermission: vi.fn(),
  resolveLeaveApprover: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: mocks.assertAnyPermission,
  assertCallerIdentity: vi.fn(async () => null),
  getAuthenticatedCaller: vi.fn(async () => null),
}));
vi.mock("@/lib/services/leave-routing", () => ({
  resolveLeaveApprover: mocks.resolveLeaveApprover,
}));
vi.mock("@/lib/actions/notifications", () => ({
  createNotificationAction: mocks.createNotification,
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import { applyLeaveAction, requestCompOffAction } from "@/lib/actions/leave";

describe("applyLeaveAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
    mocks.resolveLeaveApprover.mockReset();
    mocks.createNotification.mockReset();
    mocks.createNotification.mockResolvedValue({ success: true });
  });

  function baseFake(overrides: { leaveTypesData?: any } = {}) {
    const writes: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      rpcs: {
        calculate_leave_days: () => ({ data: 3, error: null }),
      },
      respond: (state) => {
        if (state.table === "leave_types" && state.method === "select") {
          return {
            data: overrides.leaveTypesData === undefined ? { id: "lt-1" } : overrides.leaveTypesData,
            error: null,
          };
        }
        if (state.table === "leave_requests" && state.method === "insert") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: { id: "lr-1", ...(state.payload as object) }, error: null };
        }
        if (state.table === "leave_request_approvals" && state.method === "insert") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    return { fake, writes };
  }

  it("applies full-day leave with computed days and routes to the approver", async () => {
    mocks.resolveLeaveApprover.mockResolvedValue({ approverId: "mgr-1", stage: "manager" });
    const { fake, writes } = baseFake();
    mocks.createClient.mockReturnValue(fake);

    const res: any = await applyLeaveAction("emp-1", "CL", "2026-08-10", "2026-08-12", "full_day", "Fever");

    expect(res.success).toBe(true);
    const leaveWrite = writes.find((w) => w.table === "leave_requests");
    expect(leaveWrite?.payload).toMatchObject({
      employee_id: "emp-1",
      leave_type_id: "lt-1", // code resolved to UUID
      total_days: 3,
      status: "pending",
      current_approver_id: "mgr-1",
    });
    const approvalWrite = writes.find((w) => w.table === "leave_request_approvals");
    expect(approvalWrite?.payload).toMatchObject({
      leave_request_id: "lr-1",
      approver_id: "mgr-1",
      stage: "manager",
      status: "pending",
    });
    expect(mocks.createNotification).toHaveBeenCalledWith(
      "mgr-1",
      "New Leave Request",
      expect.stringContaining("awaiting your approval"),
      "/approvals"
    );
  });

  it("uses half-day duration when requested", async () => {
    mocks.resolveLeaveApprover.mockResolvedValue({ approverId: null, stage: "manager" });
    const { fake, writes } = baseFake();
    mocks.createClient.mockReturnValue(fake);

    const res: any = await applyLeaveAction("emp-1", "CL", "2026-08-10", "2026-08-10", "first_half", "Dental");
    expect(res.success).toBe(true);
    expect(writes.find((w) => w.table === "leave_requests")?.payload.total_days).toBe(0.5);
  });

  it("keeps a UUID leave type id as-is without a lookup", async () => {
    mocks.resolveLeaveApprover.mockResolvedValue({ approverId: null, stage: "manager" });
    const { fake, writes } = baseFake();
    mocks.createClient.mockReturnValue(fake);

    const uuid = "11111111-2222-4333-8444-555555555555";
    const res: any = await applyLeaveAction("emp-1", uuid, "2026-08-10", "2026-08-10", "full_day", "Rest");
    expect(res.success).toBe(true);
    expect(writes.find((w) => w.table === "leave_requests")?.payload.leave_type_id).toBe(uuid);
  });

  it("surfaces insert errors", async () => {
    mocks.resolveLeaveApprover.mockResolvedValue({ approverId: null, stage: "manager" });
    const fake = createFakeSupabase({
      rpcs: { calculate_leave_days: () => ({ data: 3, error: null }) },
      respond: (state) => {
        if (state.table === "leave_requests" && state.method === "insert") {
          return { data: null, error: { message: "duplicate" } };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await applyLeaveAction("emp-1", "CL", "2026-08-10", "2026-08-12", "full_day", "Fever");
    expect(res).toEqual({ error: "duplicate" });
  });

  it("blocks users without the apply permission", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Insufficient permissions: leave.apply.self required" });
    const { fake } = baseFake();
    mocks.createClient.mockReturnValue(fake);

    const res = await applyLeaveAction("emp-1", "CL", "2026-08-10", "2026-08-12", "full_day", "Fever");
    expect(res).toEqual({ error: "Insufficient permissions: leave.apply.self required" });
  });
});

describe("requestCompOffAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("grants comp-off with a 90-day expiry and links an extra-work record", async () => {
    const writes: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "attendance_records" && state.method === "select") {
          return { data: { id: "att-1" }, error: null };
        }
        if (state.table === "comp_off_grants" && state.method === "insert") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: { id: "co-1" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await requestCompOffAction("emp-1", "2026-08-14");
    expect(res.success).toBe(true);
    expect(writes[0].payload).toMatchObject({
      employee_id: "emp-1",
      attendance_record_id: "att-1",
      worked_date: "2026-08-14",
      days_granted: 1,
      expiry_date: "2026-11-12",
      status: "pending",
    });
  });
});
