import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
  assertAnyPermission: vi.fn(),
  getAuthenticatedCaller: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: mocks.assertAnyPermission,
  getAuthenticatedCaller: mocks.getAuthenticatedCaller,
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import {
  getPendingApprovalsCountAction,
  getUnifiedApprovalsAction,
  decideApprovalAction,
  getApprovalDetailAction,
} from "@/lib/actions/approvals";

describe("getPendingApprovalsCountAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.getAuthenticatedCaller.mockReset();
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: "00000000-0000-0000-0000-000000000101",
      email: "admin@company.com",
    });
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

describe("getApprovalDetailAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertAnyPermission.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertAnyPermission.mockResolvedValue(null);
  });

  it("redacts maternity leave details when caller lacks leave.view.all", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Unauthorized" });
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "leave_requests" && state.method === "select") {
          return {
            data: {
              start_date: "2026-09-01",
              end_date: "2026-11-30",
              total_days: 90,
              duration_type: "full_day",
              reason: "Maternity delivery and postnatal recovery",
              created_at: "2026-08-15T10:00:00.000Z",
              leave_types: { name: "Maternity Leave", code: "MATERNITY" },
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await getApprovalDetailAction("leave", "lr-1");
    expect(res.success).toBe(true);
    expect(res.detail).toEqual([
      { label: "Leave Type", value: "Parental Leave" },
      { label: "From", value: "01-Sep-2026" },
      { label: "To", value: "30-Nov-2026" },
      { label: "Duration", value: "90 day(s) (full_day)" },
      { label: "Reason", value: "[Confidential Medical Reason Redacted]" },
      { label: "Submitted", value: "15-Aug-2026" },
    ]);
  });

  it("does not redact maternity leave details when caller has leave.view.all", async () => {
    mocks.assertPermission.mockResolvedValue(null);
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "leave_requests" && state.method === "select") {
          return {
            data: {
              start_date: "2026-09-01",
              end_date: "2026-11-30",
              total_days: 90,
              duration_type: "full_day",
              reason: "Maternity delivery and postnatal recovery",
              created_at: "2026-08-15T10:00:00.000Z",
              leave_types: { name: "Maternity Leave", code: "MATERNITY" },
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await getApprovalDetailAction("leave", "lr-1");
    expect(res.success).toBe(true);
    expect(res.detail).toEqual([
      { label: "Leave Type", value: "Maternity Leave" },
      { label: "From", value: "01-Sep-2026" },
      { label: "To", value: "30-Nov-2026" },
      { label: "Duration", value: "90 day(s) (full_day)" },
      { label: "Reason", value: "Maternity delivery and postnatal recovery" },
      { label: "Submitted", value: "15-Aug-2026" },
    ]);
  });
});

