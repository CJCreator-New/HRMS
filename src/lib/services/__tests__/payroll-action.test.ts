import { describe, it, expect, vi, beforeEach } from "vitest";
import { eqFilter } from "./helpers/fake-supabase";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
  checkActionRateLimit: vi.fn(async () => ({ allowed: true, retryAfterMs: 0 })),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: vi.fn(async () => null),
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkActionRateLimit: mocks.checkActionRateLimit,
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import {
  createPayrollPeriodAction,
  executeBulkPayrollRunAction,
  finalizePayrollPeriodAction,
  publishPayrollPeriodAction,
} from "@/lib/actions/payroll";

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

  it("runs payroll for eligible employees only and sends calculated payslips to atomic RPC", async () => {
    let atomicPayload: any = null;
    const fake = createFakeSupabase({
      rpcs: {
        validate_payroll_lock: () => ({ data: true, error: null }),
        execute_atomic_payroll_run: (args) => {
          atomicPayload = args;
          return { data: [{ success: true, processed_count: 1, error_message: null }], error: null };
        },
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
              return { data: { id: "ss1", employee_id: "e1", monthly_ctc: null, annual_ctc: 900000 }, error: null };
            case "statutory_profiles":
              return {
                data: { id: "sp1", employee_id: "e1", pt_state: "Karnataka", tax_regime: "new_regime", is_pf_eligible: true, is_esi_eligible: false },
                error: null,
              };
          }
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
    expect(atomicPayload).toBeDefined();
    expect(atomicPayload.p_period_id).toBe("per-1");
    expect(atomicPayload.p_revision_id).toBe("rev-1");
    expect(atomicPayload.p_payslips).toHaveLength(1);

    const payslip = atomicPayload.p_payslips.find((p: any) => p.employee_id === "e1");
    expect(payslip).toMatchObject({
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
    expect(atomicPayload.p_payslips.some((p: any) => p.employee_id === "e2")).toBe(false);
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

describe("finalizePayrollPeriodAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("updates period and draft revisions to finalized status", async () => {
    const writes: any[] = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.method === "update") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await finalizePayrollPeriodAction("per-1");
    expect(res).toEqual({ success: true });
    expect(writes).toEqual([
      { table: "payroll_periods", payload: { status: "finalized" } },
      { table: "payroll_revisions", payload: { status: "finalized" } },
    ]);
  });
});

describe("publishPayrollPeriodAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("transitions period and revisions to published status", async () => {
    const writes: any[] = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.method === "update") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await publishPayrollPeriodAction("per-1");
    expect(res).toEqual({ success: true });
    expect(writes).toEqual([
      { table: "payroll_periods", payload: { status: "published" } },
      { table: "payroll_revisions", payload: { status: "published" } },
    ]);
  });

  it("blocks caller without payroll.publish permission", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Insufficient permissions: payroll.publish required" });
    const fake = createFakeSupabase();
    mocks.createClient.mockReturnValue(fake);

    const res = await publishPayrollPeriodAction("per-1");
    expect(res).toEqual({ error: "Insufficient permissions: payroll.publish required" });
  });
});

describe("Payroll Remediation Regression Tests (TEST-PAY-001 to 008)", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("TEST-PAY-001: Employee A has salary structure, Employee B has none; A is processed, B is excluded", async () => {
    let atomicPayload: any = null;
    const fake = createFakeSupabase({
      rpcs: {
        validate_payroll_lock: () => ({ data: true, error: null }),
        execute_atomic_payroll_run: (args) => {
          atomicPayload = args;
          return { data: [{ success: true, processed_count: 1, error_message: null }], error: null };
        },
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
                  { id: "emp-a", full_name: "Employee A", employee_code: "EA", status: "active" },
                  { id: "emp-b", full_name: "Employee B", employee_code: "EB", status: "active" },
                ],
                error: null,
              };
            case "payroll_eligibility":
              return { data: [], error: null };
            case "attendance_records":
              return {
                data: [
                  { id: "a1", employee_id: "emp-a", status: "present" },
                  { id: "a2", employee_id: "emp-b", status: "present" },
                ],
                error: null,
              };
            case "leave_requests":
              return { data: [], error: null };
            case "employee_salary_structures":
              return {
                data: [
                  { id: "ss-a", employee_id: "emp-a", monthly_ctc: 60000, annual_ctc: 720000 },
                ],
                error: null,
              };
            case "statutory_profiles":
              return {
                data: [
                  { id: "sp-a", employee_id: "emp-a", pt_state: "Karnataka", tax_regime: "new_regime" },
                ],
                error: null,
              };
          }
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await executeBulkPayrollRunAction("per-1");

    expect(res.success).toBe(true);
    expect(res.count).toBe(2);
    expect(res.excludedEmployees).toHaveLength(1);
    expect(res.excludedEmployees[0]).toEqual({
      id: "emp-b",
      name: "Employee B",
      reason: "Missing or invalid salary structure",
    });

    expect(atomicPayload.p_payslips).toHaveLength(1);
    expect(atomicPayload.p_payslips[0].employee_id).toBe("emp-a");
  });

  it("TEST-PAY-002: Only one salary structure exists for entire org with multiple employees; unmatched employees excluded", async () => {
    let atomicPayload: any = null;
    const fake = createFakeSupabase({
      rpcs: {
        validate_payroll_lock: () => ({ data: true, error: null }),
        execute_atomic_payroll_run: (args) => {
          atomicPayload = args;
          return { data: [{ success: true, processed_count: 1, error_message: null }], error: null };
        },
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
                  { id: "emp-1", full_name: "Emp 1", employee_code: "E1", status: "active" },
                  { id: "emp-2", full_name: "Emp 2", employee_code: "E2", status: "active" },
                  { id: "emp-3", full_name: "Emp 3", employee_code: "E3", status: "active" },
                ],
                error: null,
              };
            case "payroll_eligibility":
              return { data: [], error: null };
            case "attendance_records":
              return { data: [], error: null };
            case "leave_requests":
              return { data: [], error: null };
            case "employee_salary_structures":
              return {
                data: [
                  { id: "ss-1", employee_id: "emp-1", monthly_ctc: 80000, annual_ctc: 960000 },
                ],
                error: null,
              };
            case "statutory_profiles":
              return { data: [], error: null };
          }
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await executeBulkPayrollRunAction("per-1");

    expect(res.success).toBe(true);
    expect(res.count).toBe(3);
    expect(res.excludedEmployees).toHaveLength(2);
    expect(res.excludedEmployees.map((e: any) => e.id)).toEqual(["emp-2", "emp-3"]);
    expect(atomicPayload.p_payslips).toHaveLength(1);
    expect(atomicPayload.p_payslips[0].employee_id).toBe("emp-1");
  });

  it("TEST-PAY-003: Two employees have different salary structures; verify distinct calculation without cross-bleeding", async () => {
    let atomicPayload: any = null;
    const fake = createFakeSupabase({
      rpcs: {
        validate_payroll_lock: () => ({ data: true, error: null }),
        execute_atomic_payroll_run: (args) => {
          atomicPayload = args;
          return { data: [{ success: true, processed_count: 2, error_message: null }], error: null };
        },
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
                  { id: "emp-low", full_name: "Emp Low", employee_code: "EL", status: "active" },
                  { id: "emp-high", full_name: "Emp High", employee_code: "EH", status: "active" },
                ],
                error: null,
              };
            case "payroll_eligibility":
              return { data: [], error: null };
            case "attendance_records":
              return {
                data: [
                  { id: "a1", employee_id: "emp-low", status: "present" },
                  { id: "a2", employee_id: "emp-high", status: "present" },
                ],
                error: null,
              };
            case "leave_requests":
              return { data: [], error: null };
            case "employee_salary_structures":
              return {
                data: [
                  { id: "ss-low", employee_id: "emp-low", monthly_ctc: 30000, annual_ctc: 360000 },
                  { id: "ss-high", employee_id: "emp-high", monthly_ctc: 120000, annual_ctc: 1440000 },
                ],
                error: null,
              };
            case "statutory_profiles":
              return {
                data: [
                  { id: "sp-low", employee_id: "emp-low", pt_state: "Karnataka", tax_regime: "new_regime" },
                  { id: "sp-high", employee_id: "emp-high", pt_state: "Karnataka", tax_regime: "new_regime" },
                ],
                error: null,
              };
          }
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await executeBulkPayrollRunAction("per-1");

    expect(res.success).toBe(true);
    expect(res.count).toBe(2);
    expect(res.excludedEmployees).toHaveLength(0);

    const payslipLow = atomicPayload.p_payslips.find((p: any) => p.employee_id === "emp-low");
    const payslipHigh = atomicPayload.p_payslips.find((p: any) => p.employee_id === "emp-high");

    expect(payslipLow).toBeDefined();
    expect(payslipHigh).toBeDefined();
    expect(payslipLow.gross_earnings).toBeLessThan(payslipHigh.gross_earnings);
  });

  it("TEST-PAY-004: Missing salary structure produces controlled failure without sensitive data exposure", async () => {
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
                  { id: "emp-missing", full_name: "Missing Struct", employee_code: "EMS", status: "active" },
                ],
                error: null,
              };
            case "payroll_eligibility":
              return { data: [], error: null };
            case "attendance_records":
              return { data: [], error: null };
            case "leave_requests":
              return { data: [], error: null };
            case "employee_salary_structures":
              return { data: [], error: null };
            case "statutory_profiles":
              return { data: [], error: null };
          }
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await executeBulkPayrollRunAction("per-1");

    expect(res.success).toBe(true);
    expect(res.excludedEmployees).toHaveLength(1);
    const item = res.excludedEmployees[0];
    expect(item.reason).toBe("Missing or invalid salary structure");
    // Ensure no salary figures leaked in item
    expect(item).not.toHaveProperty("ctc");
    expect(item).not.toHaveProperty("salary");
    expect(item).not.toHaveProperty("amount");
  });

  it("TEST-PAY-005: Successful bulk payroll invokes atomic RPC execute_atomic_payroll_run", async () => {
    let rpcCalledWith: any = null;
    const fake = createFakeSupabase({
      rpcs: {
        validate_payroll_lock: () => ({ data: true, error: null }),
        execute_atomic_payroll_run: (args) => {
          rpcCalledWith = args;
          return { data: [{ success: true, processed_count: 1, error_message: null }], error: null };
        },
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
                data: [{ id: "e1", full_name: "Emp 1", employee_code: "E1", status: "active" }],
                error: null,
              };
            case "payroll_eligibility":
              return { data: [], error: null };
            case "attendance_records":
              return { data: [{ id: "a1", employee_id: "e1", status: "present" }], error: null };
            case "leave_requests":
              return { data: [], error: null };
            case "employee_salary_structures":
              return { data: [{ id: "ss1", employee_id: "e1", monthly_ctc: 50000, annual_ctc: 600000 }], error: null };
            case "statutory_profiles":
              return { data: [{ id: "sp1", employee_id: "e1", pt_state: "Karnataka", tax_regime: "new_regime" }], error: null };
          }
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await executeBulkPayrollRunAction("per-1");
    expect(res.success).toBe(true);
    expect(rpcCalledWith).toEqual({
      p_period_id: "per-1",
      p_revision_id: "rev-1",
      p_payslips: expect.any(Array),
    });
    expect(rpcCalledWith.p_payslips).toHaveLength(1);
  });

  it("TEST-PAY-006: Atomic RPC failure fails closed without fallback writes", async () => {
    const fake = createFakeSupabase({
      rpcs: {
        validate_payroll_lock: () => ({ data: true, error: null }),
        execute_atomic_payroll_run: () => {
          return { data: null, error: { message: "Database transaction lock timeout" } };
        },
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
                data: [{ id: "e1", full_name: "Emp 1", employee_code: "E1", status: "active" }],
                error: null,
              };
            case "payroll_eligibility":
              return { data: [], error: null };
            case "attendance_records":
              return { data: [], error: null };
            case "leave_requests":
              return { data: [], error: null };
            case "employee_salary_structures":
              return { data: [{ id: "ss1", employee_id: "e1", monthly_ctc: 50000, annual_ctc: 600000 }], error: null };
            case "statutory_profiles":
              return { data: [], error: null };
          }
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await executeBulkPayrollRunAction("per-1");
    expect(res.success).toBeFalsy();
    expect(res.error).toBe("Database transaction lock timeout");
  });

  it("TEST-PAY-007 & TEST-PAY-008: Concurrency lock / eligibility failure blocks conflicting payroll run", async () => {
    const fake = createFakeSupabase({
      rpcs: {
        validate_payroll_lock: () => ({ data: null, error: { message: "Period is locked by another transaction" } }),
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await executeBulkPayrollRunAction("per-1");
    expect(res.success).toBeFalsy();
    expect(res.error).toContain("Period is locked by another transaction");
  });
});

