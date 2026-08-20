import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertAnyPermission: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: vi.fn(async () => null),
  assertAnyPermission: mocks.assertAnyPermission,
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import {
  getPendingApprovalsCountAction,
  getUnifiedApprovalsAction,
  decideApprovalAction,
} from "@/lib/actions/approvals";

describe("getPendingApprovalsCountAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("returns the exact count", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "v_pending_approvals_dashboard" && state.method === "select") {
          return { data: [], error: null, count: 7 };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(getPendingApprovalsCountAction()).resolves.toEqual({ count: 7 });
  });

  it("returns zero when the query errors", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "v_pending_approvals_dashboard" && state.method === "select") {
          return { data: null, error: { message: "boom" } };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(getPendingApprovalsCountAction()).resolves.toEqual({ count: 0 });
  });
});

describe("getUnifiedApprovalsAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("maps approval rows through the module mapper", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "v_pending_approvals_dashboard" && state.method === "select") {
          return {
            data: [
              {
                request_id: "r1",
                request_type: "leave_request",
                employee_name: "Alice",
                item_name: "CL 2 days",
                created_at: "2026-08-01T09:00:00.000Z",
                status: "pending",
              },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await getUnifiedApprovalsAction();
    expect(res.items[0]).toEqual({
      id: "r1",
      module: "leave",
      employee_name: "Alice",
      summary: "CL 2 days",
      submitted_date: "2026-08-01",
      amount_or_duration: "CL 2 days",
      status: "pending",
    });
  });
});

describe("decideApprovalAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertAnyPermission.mockReset();
    mocks.assertAnyPermission.mockResolvedValue(null);
  });

  it("updates attendance corrections with the decider set", async () => {
    const updates: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-9" }, error: null };
        }
        if (state.method === "update") {
          updates.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await decideApprovalAction("attendance", "corr-1", "approved");
    expect(res.success).toBe(true);
    expect(mocks.assertAnyPermission).toHaveBeenCalledWith(["attendance.correct.approve"]);
    const corrUpdate = updates.find((u) => u.table === "attendance_corrections");
    expect(corrUpdate?.payload).toMatchObject({
      status: "approved",
      decided_by: "emp-9",
    });
    // no leave_request_approvals stage update
    expect(updates.some((u) => u.table === "leave_request_approvals")).toBe(false);
  });

  it("also updates the approval stage for leave modules", async () => {
    const updates: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-9" }, error: null };
        }
        if (state.method === "update") {
          updates.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await decideApprovalAction("leave_request", "lr-1", "rejected", "Not enough balance");
    expect(res.success).toBe(true);
    expect(updates.some((u) => u.table === "leave_requests")).toBe(true);
    const stageUpdate = updates.find((u) => u.table === "leave_request_approvals");
    expect(stageUpdate?.payload).toMatchObject({
      status: "rejected",
      remarks: "Not enough balance",
    });
  });

  it("rejects unknown modules", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-9" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await decideApprovalAction("bogus", "x", "approved");
    expect(res).toEqual({ error: "Unknown module: bogus" });
  });

  it("blocks users without the module's approve permission", async () => {
    mocks.assertAnyPermission.mockResolvedValue({ error: "Insufficient permissions" });
    const fake = createFakeSupabase();
    mocks.createClient.mockReturnValue(fake);

    const res = await decideApprovalAction("reimbursement", "c1", "approved");
    expect(res).toEqual({ error: "Insufficient permissions" });
  });

  it("advances pending_manager reimbursement to pending_hr (two-stage routing)", async () => {
    const updates: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-9" }, error: null };
        }
        if (state.table === "reimbursement_claims" && state.method === "select") {
          return {
            data: {
              status: "pending_manager",
              reimbursement_categories: { approval_route: "manager_then_hr" },
            },
            error: null,
          };
        }
        if (state.method === "update") {
          updates.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await decideApprovalAction("reimbursement", "c1", "approved");
    expect(res.success).toBe(true);
    const claimUpdate = updates.find((u) => u.table === "reimbursement_claims");
    expect(claimUpdate?.payload.status).toBe("pending_hr");
  });

  it("final-approves hr_only reimbursement directly to approved", async () => {
    const updates: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-9" }, error: null };
        }
        if (state.table === "reimbursement_claims" && state.method === "select") {
          return {
            data: {
              status: "pending_hr",
              reimbursement_categories: { approval_route: "hr_only" },
            },
            error: null,
          };
        }
        if (state.method === "update") {
          updates.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await decideApprovalAction("reimbursement", "c1", "approved");
    expect(res.success).toBe(true);
    const claimUpdate = updates.find((u) => u.table === "reimbursement_claims");
    expect(claimUpdate?.payload.status).toBe("approved");
  });
});
