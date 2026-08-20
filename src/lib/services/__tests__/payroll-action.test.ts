import { describe, it, expect, vi, beforeEach } from "vitest";
import { eqFilter } from "./helpers/fake-supabase";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: vi.fn(async () => null),
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import { executeBulkPayrollRunAction } from "@/lib/actions/payroll";

const PERIOD = {
  id: "per-1",
  year: 2026,
  month: 7,
  start_date: "2026-07-01",
  end_date: "2026-07-31",
  status: "draft",
};

describe("executeBulkPayrollRunAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("runs payroll for eligible employees only and writes payslips", async () => {
    const writes: Array<{ table: string; method: string; payload: any }> = [];
    const fake = createFakeSupabase({
      rpcs: {
        validate_payroll_lock: () => ({ data: true, error: null }),
      },
      respond: (state) => {
        if (state.method === "select") {
          switch (state.table) {
            case "payroll_periods":
              return { data: PERIOD, error: null };
            case "payroll_revisions":
              return { data: { id: "rev-1", revision_number: 1, status: "draft" }, error: null };
            case "employees":
              return {
                data: [
                  { id: "e1", full_name: "A", employee_code: "E1", status: "active" },
                  { id: "e2", full_name: "B", employee_code: "E2", status: "active" },
                ],
                error: null,
              };
            case "payroll_eligibility":
              return {
                data: [
                  { employee_id: "e2", is_eligible: false, effective_from: "2026-01-01", effective_to: null },
                ],
                error: null,
              };
            case "attendance_records": {
              const empId = eqFilter(state, "employee_id");
              const inFilter = state.filters.find((f) => f.op === "in" && f.col === "employee_id");
              const hasE1 = empId === "e1" || (Array.isArray(inFilter?.val) && (inFilter?.val as string[]).includes("e1"));
              if (hasE1) {
                return {
                  data: Array.from({ length: 20 }, (_, i) => ({ id: `a${i}`, employee_id: "e1", status: "present" })),
                  error: null,
                };
              }
              return { data: [], error: null };
            }
            case "leave_requests":
              return { data: [{ id: "l1", employee_id: "e1", total_days: 8, status: "approved" }], error: null };
            case "employee_salary_structures":
              return { data: { id: "ss1", monthly_ctc: null, annual_ctc: 900000 }, error: null };
            case "statutory_profiles":
              return {
                data: { id: "sp1", pt_state: "Karnataka", tax_regime: "new_regime", is_pf_eligible: true, is_esi_eligible: false },
                error: null,
              };
          }
        }
        if (state.method === "upsert" && state.table === "payslips") {
          writes.push({ table: state.table, method: state.method, payload: state.payload });
          return { data: null, error: null };
        }
        if (state.method === "update") {
          writes.push({ table: state.table, method: state.method, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await executeBulkPayrollRunAction("per-1");

    expect(res.success).toBe(true);
    expect(res.count).toBe(1);
    expect(res.excludedCount).toBe(1);

    // e1: 20 present + 8 paid leave out of 31 days → 28 payable / 3 LOP,
    // gross = round(75000 * 28/31) = 67742, deductions = 2020 (PF+PT+LWF), net = 65722
    const payslip = writes.find((w) => w.table === "payslips" && w.payload.employee_id === "e1");
    expect(payslip?.payload).toMatchObject({
      payroll_revision_id: "rev-1",
      employee_id: "e1",
      year: 2026,
      month: 7,
      payable_units: 28,
      lop_units: 3,
      gross_earnings: 67742,
      total_deductions: 2020,
      net_pay: 65722,
      is_published: false,
    });

    // No payslip for the ineligible employee e2
    expect(writes.some((w) => w.table === "payslips" && w.payload.employee_id === "e2")).toBe(false);

    const revUpdate = writes.find((w) => w.table === "payroll_revisions" && w.method === "update");
    expect(revUpdate?.payload).toMatchObject({
      total_employees: 1,
      total_gross: 67742,
      total_deductions: 2020,
      total_net: 65722,
    });

    const periodUpdate = writes.find((w) => w.table === "payroll_periods" && w.method === "update");
    expect(periodUpdate?.payload.status).toBe("validated");
  });

  it("blocks the run when the payroll lock validation fails", async () => {
    const fake = createFakeSupabase({
      rpcs: {
        validate_payroll_lock: () => ({ data: null, error: { message: "attendance anomaly" } }),
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await executeBulkPayrollRunAction("per-1");
    expect(res.success).toBeFalsy();
    expect(res.error).toContain("attendance anomaly");
  });

  it("blocks users without the payroll.run permission", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Insufficient permissions: payroll.run required" });
    const fake = createFakeSupabase();
    mocks.createClient.mockReturnValue(fake);

    const res = await executeBulkPayrollRunAction("per-1");
    expect(res).toEqual({ error: "Insufficient permissions: payroll.run required" });
  });
});
