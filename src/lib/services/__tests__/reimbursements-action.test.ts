import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: vi.fn(async () => null),
  assertCallerIdentity: vi.fn(async () => null),
  getAuthenticatedCaller: vi.fn(async () => null),
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import { submitReimbursementClaimAction } from "@/lib/actions/reimbursements";

describe("submitReimbursementClaimAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  function fakeWith({
    category,
    duplicates,
  }: {
    category: { id: string; duplicate_policy: string; approval_route: string };
    duplicates: unknown[];
  }) {
    const writes: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "reimbursement_categories" && state.method === "select") {
          return { data: category, error: null };
        }
        if (state.table === "reimbursement_claims" && state.method === "select") {
          return { data: duplicates, error: null };
        }
        if (state.table === "reimbursement_claims" && state.method === "insert") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: { id: "claim-1", ...(state.payload as object) }, error: null };
        }
        return { data: null, error: null };
      },
    });
    return { fake, writes };
  }

  it("blocks a duplicate claim when the category policy is block", async () => {
    const { fake } = fakeWith({
      category: { id: "cat-1", duplicate_policy: "block", approval_route: "hr_only" },
      duplicates: [{ id: "dup-1" }],
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await submitReimbursementClaimAction("emp-1", "cat-1", "2026-08-01", "Vendor", 5000);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Duplicate Claim Blocked");
  });

  it("flags duplicates as warnings when policy is warn_and_allow", async () => {
    const { fake, writes } = fakeWith({
      category: { id: "cat-1", duplicate_policy: "warn_and_allow", approval_route: "manager_then_hr" },
      duplicates: [{ id: "dup-1" }],
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await submitReimbursementClaimAction("emp-1", "cat-1", "2026-08-01", "Vendor", 5000);
    expect(res.success).toBe(true);
    expect(writes[0].payload.is_duplicate_warning).toBe(true);
    // manager_then_hr route starts at pending_manager
    expect(writes[0].payload.status).toBe("pending_manager");
  });

  it("submits clean claims to pending_hr for hr-only routes", async () => {
    const { fake, writes } = fakeWith({
      category: { id: "cat-1", duplicate_policy: "allow", approval_route: "hr_only" },
      duplicates: [],
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await submitReimbursementClaimAction("emp-1", "cat-1", "2026-08-01", "Vendor", 5000);
    expect(res.success).toBe(true);
    expect(writes[0].payload).toMatchObject({
      employee_id: "emp-1",
      category_id: "cat-1",
      requested_amount: 5000,
      is_duplicate_warning: false,
      status: "pending_hr",
    });
  });

  it("blocks users without the apply permission", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Insufficient permissions: reimbursement.apply.self required" });
    const { fake } = fakeWith({
      category: { id: "cat-1", duplicate_policy: "allow", approval_route: "hr_only" },
      duplicates: [],
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await submitReimbursementClaimAction("emp-1", "cat-1", "2026-08-01", "Vendor", 5000);
    expect(res).toEqual({ success: false, error: "Insufficient permissions: reimbursement.apply.self required" });
  });
});

describe("approveReimbursementClaimAction — Two-Stage Routing (D11 / FR §11.3)", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  function fakeApproveWith({
    claim,
    user = { id: "auth-decider" },
    deciderEmployee = { id: "emp-decider" },
  }: {
    claim: any;
    user?: { id: string } | null;
    deciderEmployee?: { id: string } | null;
  }) {
    const updates: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: deciderEmployee, error: null };
        }
        if (state.table === "reimbursement_claims" && state.method === "select") {
          return { data: claim, error: null };
        }
        if (state.table === "reimbursement_claims" && state.method === "update") {
          updates.push({ table: state.table, payload: state.payload });
          return { data: { ...claim, ...(state.payload as object) }, error: null };
        }
        return { data: null, error: null };
      },
    });
    fake.auth = {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    } as any;
    return { fake, updates };
  }

  it("advances manager_then_hr claim from pending_manager to pending_hr (Stage 1)", async () => {
    const { fake, updates } = fakeApproveWith({
      claim: {
        id: "claim-two-stage-1",
        employee_id: "emp-requester",
        status: "pending_manager",
        requested_amount: 8000,
        reimbursement_categories: {
          id: "cat-1",
          approval_route: "manager_then_hr",
        },
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const { approveReimbursementClaimAction } = await import("@/lib/actions/reimbursements");
    const res = await approveReimbursementClaimAction("claim-two-stage-1", "approved");

    expect(res.success).toBe(true);
    expect(res.newStatus).toBe("pending_hr");
    expect(updates[0].payload.status).toBe("pending_hr");
    // Does NOT set approved_amount or final status yet
    expect(updates[0].payload.approved_amount).toBeUndefined();
  });

  it("advances manager_then_hr claim from pending_hr to approved (Stage 2)", async () => {
    const { fake, updates } = fakeApproveWith({
      claim: {
        id: "claim-two-stage-2",
        employee_id: "emp-requester",
        status: "pending_hr",
        requested_amount: 8000,
        reimbursement_categories: {
          id: "cat-1",
          approval_route: "manager_then_hr",
        },
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const { approveReimbursementClaimAction } = await import("@/lib/actions/reimbursements");
    const res = await approveReimbursementClaimAction("claim-two-stage-2", "approved", 7500);

    expect(res.success).toBe(true);
    expect(res.newStatus).toBe("approved");
    expect(updates[0].payload.status).toBe("approved");
    expect(updates[0].payload.approved_amount).toBe(7500);
  });

  it("approves single-stage route directly to approved", async () => {
    const { fake, updates } = fakeApproveWith({
      claim: {
        id: "claim-single-stage",
        employee_id: "emp-requester",
        status: "pending_manager",
        requested_amount: 3000,
        reimbursement_categories: {
          id: "cat-1",
          approval_route: "manager_only",
        },
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const { approveReimbursementClaimAction } = await import("@/lib/actions/reimbursements");
    const res = await approveReimbursementClaimAction("claim-single-stage", "approved");

    expect(res.success).toBe(true);
    expect(res.newStatus).toBe("approved");
    expect(updates[0].payload.status).toBe("approved");
  });

  it("transitions to rejected at any stage upon rejection", async () => {
    const { fake, updates } = fakeApproveWith({
      claim: {
        id: "claim-reject",
        employee_id: "emp-requester",
        status: "pending_manager",
        requested_amount: 3000,
        reimbursement_categories: {
          id: "cat-1",
          approval_route: "manager_then_hr",
        },
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const { approveReimbursementClaimAction } = await import("@/lib/actions/reimbursements");
    const res = await approveReimbursementClaimAction("claim-reject", "rejected");

    expect(res.success).toBe(true);
    expect(res.newStatus).toBe("rejected");
    expect(updates[0].payload.status).toBe("rejected");
  });

  it("blocks self-approval by employee", async () => {
    const { fake } = fakeApproveWith({
      claim: {
        id: "claim-self",
        employee_id: "emp-decider",
        status: "pending_manager",
        reimbursement_categories: { id: "cat-1", approval_route: "manager_only" },
      },
      deciderEmployee: { id: "emp-decider" },
    });
    mocks.createClient.mockReturnValue(fake);

    const { approveReimbursementClaimAction } = await import("@/lib/actions/reimbursements");
    const res = await approveReimbursementClaimAction("claim-self", "approved");

    expect(res.success).toBe(false);
    expect(res.error).toContain("Self-approval");
  });
});

