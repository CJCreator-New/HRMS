import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
  assertAnyPermission: vi.fn(),
  getAuthenticatedCaller: vi.fn(),
  validateRequestOrigin: vi.fn(),
  writeAuditLogAction: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: mocks.assertAnyPermission,
  getAuthenticatedCaller: mocks.getAuthenticatedCaller,
}));
vi.mock("@/lib/security", () => ({
  validateRequestOrigin: mocks.validateRequestOrigin,
  sanitizeInput: (s: string) => s.trim(),
}));
vi.mock("@/lib/actions/audit", () => ({
  writeAuditLogAction: mocks.writeAuditLogAction,
}));

import {
  submitInvestmentDeclarationAction,
  reviewInvestmentDeclarationAction,
  getEmployeeDeclarationsAction,
} from "@/lib/actions/declarations";

describe("Tax Investment Declarations Action (P2-5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertPermission.mockResolvedValue(null);
    mocks.assertAnyPermission.mockResolvedValue(null);
    mocks.validateRequestOrigin.mockResolvedValue(null);
    mocks.writeAuditLogAction.mockResolvedValue({ success: true });
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: "emp-decl-1",
      email: "emp1@company.com",
    });
  });

  it("submits an investment declaration with capped amounts and audit log", async () => {
    let upsertPayload: any = null;
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "investment_declarations" && state.method === "upsert") {
          upsertPayload = state.payload;
          return {
            data: { id: "decl-1", ...state.payload },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await submitInvestmentDeclarationAction({
      financialYear: "2025-2026",
      section80C: 150000,
      section80D: 25000,
      section80G: 10000,
      otherExemptions: 50000,
      hraAnnualRent: 240000,
    });

    expect(res.success).toBe(true);
    expect(upsertPayload).toMatchObject({
      employee_id: "emp-decl-1",
      financial_year: "2025-2026",
      section_80c_amount: 150000,
      section_80d_amount: 25000,
      status: "submitted",
    });
    expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "statutory.declaration_submitted",
        entityId: "decl-1",
      })
    );
  });

  it("prevents self-approval when reviewer is the applicant (Self-Approval Guardrail)", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "investment_declarations" && state.method === "select") {
          return {
            data: { id: "decl-self", employee_id: "emp-decl-1" },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await reviewInvestmentDeclarationAction("decl-self", "verified");
    expect(res.success).toBe(false);
    expect(res.error).toContain("Self-approval violation");
  });

  it("allows different HR administrator to verify an employee declaration", async () => {
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: "emp-hr-admin",
      email: "hr@company.com",
    });

    let updatedPayload: any = null;
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "investment_declarations" && state.method === "select") {
          return {
            data: { id: "decl-emp1", employee_id: "emp-decl-1" },
            error: null,
          };
        }
        if (state.table === "investment_declarations" && state.method === "update") {
          updatedPayload = state.payload;
          return { data: { id: "decl-emp1" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await reviewInvestmentDeclarationAction("decl-emp1", "verified", "All proofs verified");
    expect(res.success).toBe(true);
    expect(updatedPayload).toMatchObject({
      status: "verified",
      reviewed_by: "emp-hr-admin",
      review_remarks: "All proofs verified",
    });
  });
});
