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
