/**
 * Integration Tests — Payroll Workflow
 *
 * Covers:
 *   - Payroll period creation (duplicate detection, idempotency)
 *   - Bulk payroll run (eligibility filtering, salary resolution, atomic RPC)
 *   - Period finalization (lock validation, status transition)
 *   - Period publishing (audit logging)
 *   - Period reopening (revision tracking)
 *   - Permission enforcement across all operations
 *   - Edge cases (missing salary structures, no eligible employees)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerModuleMocks, resetAllMocks, mocks, createTestContext, FIXTURES } from "./setup";

registerModuleMocks();

import {
  createPayrollPeriodAction,
  executeBulkPayrollRunAction,
  finalizePayrollPeriodAction,
  publishPayrollPeriodAction,
  reopenPayrollPeriodAction,
  validatePayrollLockAction,
} from "@/lib/actions/payroll";

// ── Payroll Period Creation ────────────────────────────────────────

describe("Payroll Workflow — Create Period", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it("creates a new payroll period with initial revision", async () => {
    const writes: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.table === "payroll_periods" && state.method === "select") {
        return { data: null, error: null }; // No existing period
      }
      if (state.method === "insert") {
        writes.push({ table: state.table, payload: state.payload });
        return {
          data: { id: `gen-${state.table}`, ...(state.payload as object) },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await createPayrollPeriodAction(2026, 8);
    expect(result.success).toBe(true);
    expect(result.period).toBeDefined();
    expect(result.revision).toBeDefined();

    // Period created with correct dates
    const periodWrite = writes.find((w) => w.table === "payroll_periods");
    expect(periodWrite!.payload).toMatchObject({
      year: 2026,
      month: 8,
      start_date: "2026-08-01",
      end_date: "2026-08-31",
      status: "draft",
    });

    // Initial revision created
    const revisionWrite = writes.find((w) => w.table === "payroll_revisions");
    expect(revisionWrite!.payload).toMatchObject({
      revision_number: 1,
      status: "draft",
    });
  });

  it("rejects duplicate period for same year/month", async () => {
    const { fake } = createTestContext((state) => {
      if (state.table === "payroll_periods" && state.method === "select") {
        return { data: { id: "existing-period" }, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await createPayrollPeriodAction(2026, 8);
    expect(result.error).toContain("already exists");
  });

  it("blocks duplicate creation with idempotency key", async () => {
    mocks.assertIdempotencyKey.mockResolvedValue({
      isDuplicate: true,
      error: "Duplicate request detected",
    });

    const result = await createPayrollPeriodAction(2026, 8, "idemp-key-1");
    expect(result.error).toBe("Duplicate request detected");
  });

  it("blocks users without payroll.run permission", async () => {
    mocks.assertPermission.mockResolvedValue({
      error: "Insufficient permissions: payroll.run required",
    });

    const result = await createPayrollPeriodAction(2026, 8);
    expect(result.error).toContain("Insufficient permissions");
  });
});

// ── Bulk Payroll Run ───────────────────────────────────────────────

describe("Payroll Workflow — Execute Bulk Run", () => {
  beforeEach(() => {
    resetAllMocks();
    mocks.computeEmployeePayrollRun.mockReturnValue({
      payableUnits: 31,
      lopUnits: 0,
      grossMonthly: 75000,
      totalDeduction: 12000,
      netPay: 63000,
    });
    mocks.resolveMonthlyCtc.mockReturnValue(75000);
    mocks.filterPayrollEligibleEmployees.mockReturnValue({
      eligible: [{ id: FIXTURES.employee.id }],
      excludedCount: 0,
    });
  });

  it("runs payroll for eligible employees via atomic RPC", async () => {
    const writes: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.table === "payroll_periods" && state.method === "select") {
        return { data: FIXTURES.payrollPeriod, error: null };
      }
      if (state.table === "payroll_revisions" && state.method === "select") {
        return { data: { id: "rev-001", status: "draft" }, error: null };
      }
      if (state.table === "employees" && state.method === "select") {
        return { data: [FIXTURES.employee], error: null };
      }
      if (state.table === "payroll_eligibility" && state.method === "select") {
        return { data: [], error: null };
      }
      if (state.table === "attendance_records" && state.method === "select") {
        return { data: [], error: null };
      }
      if (state.table === "leave_requests" && state.method === "select") {
        return { data: [], error: null };
      }
      if (state.table === "employee_salary_structures" && state.method === "select") {
        return { data: [FIXTURES.salaryStructure], error: null };
      }
      if (state.table === "statutory_profiles" && state.method === "select") {
        return { data: [], error: null };
      }
      return { data: null, error: null };
    });

    const fakeWithRpc = {
      ...fake,
      rpc: vi.fn(async (fnName: string, args?: unknown) => {
        if (fnName === "validate_payroll_lock") return { data: true, error: null };
        if (fnName === "execute_atomic_payroll_run") {
          writes.push({ table: "atomic_rpc", payload: args });
          return {
            data: [{ success: true, processed_count: 1, error_message: null }],
            error: null,
          };
        }
        return { data: null, error: null };
      }),
    };
    mocks.createClient.mockReturnValue(fakeWithRpc);

    const result = await executeBulkPayrollRunAction("pp-2026-08");
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);

    // Verify atomic RPC was called with payslip data
    const rpcCall = writes.find((w) => w.table === "atomic_rpc");
    expect(rpcCall).toBeDefined();
    const rpcPayload = rpcCall!.payload as { p_payslips: Array<Record<string, unknown>> };
    expect(rpcPayload.p_payslips).toHaveLength(1);
    expect(rpcPayload.p_payslips[0]).toMatchObject({
      employee_id: FIXTURES.employee.id,
      year: 2026,
      month: 8,
      gross_earnings: 75000,
      total_deductions: 12000,
      net_pay: 63000,
    });
  });

  it("excludes employees with missing salary structures", async () => {
    mocks.resolveMonthlyCtc.mockReturnValue(null); // No salary structure
    mocks.filterPayrollEligibleEmployees.mockReturnValue({
      eligible: [{ id: FIXTURES.employee.id }], // Employee passes eligibility check
      excludedCount: 0,
    });

    const { fake } = createTestContext((state) => {
      if (state.table === "payroll_periods" && state.method === "select") {
        return { data: FIXTURES.payrollPeriod, error: null };
      }
      if (state.table === "payroll_revisions" && state.method === "select") {
        return { data: { id: "rev-001", status: "draft" }, error: null };
      }
      if (state.table === "employees" && state.method === "select") {
        return { data: [FIXTURES.employee], error: null };
      }
      if (state.table === "payroll_eligibility" && state.method === "select") {
        return { data: [], error: null };
      }
      if (state.table === "employee_salary_structures" && state.method === "select") {
        return { data: [], error: null }; // No salary structure
      }
      return { data: null, error: null };
    });

    const fakeWithRpc = {
      ...fake,
      rpc: vi.fn(async (fnName: string) => {
        if (fnName === "validate_payroll_lock") return { data: true, error: null };
        return { data: null, error: null };
      }),
    };
    mocks.createClient.mockReturnValue(fakeWithRpc);

    const result = await executeBulkPayrollRunAction("pp-2026-08");
    expect(result.success).toBe(true);
    // Employee is excluded because resolveMonthlyCtc returns null
    expect(result.excludedEmployees).toHaveLength(1);
    expect(result.excludedEmployees![0].reason).toContain("Missing or invalid salary structure");
  });

  it("handles zero eligible employees gracefully", async () => {
    mocks.filterPayrollEligibleEmployees.mockReturnValue({
      eligible: [],
      excludedCount: 1,
    });

    const updates: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.table === "payroll_periods" && state.method === "select") {
        return { data: FIXTURES.payrollPeriod, error: null };
      }
      if (state.table === "payroll_revisions" && state.method === "select") {
        return { data: { id: "rev-001", status: "draft" }, error: null };
      }
      if (state.table === "employees" && state.method === "select") {
        return { data: [], error: null };
      }
      if (state.table === "payroll_eligibility" && state.method === "select") {
        return { data: [], error: null };
      }
      if (state.table === "payroll_periods" && state.method === "update") {
        updates.push({ table: "payroll_periods", payload: state.payload });
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });

    const fakeWithRpc = {
      ...fake,
      rpc: vi.fn(async (fnName: string) => {
        if (fnName === "validate_payroll_lock") return { data: true, error: null };
        return { data: null, error: null };
      }),
    };
    mocks.createClient.mockReturnValue(fakeWithRpc);

    const result = await executeBulkPayrollRunAction("pp-2026-08");
    expect(result.success).toBe(true);
    expect(result.count).toBe(0);

    // Period should be marked as validated
    const periodUpdate = updates.find((u) => u.table === "payroll_periods");
    expect(periodUpdate!.payload).toMatchObject({ status: "validated" });
  });

  it("blocks when payroll lock validation fails", async () => {
    const { fake } = createTestContext();
    const fakeWithRpc = {
      ...fake,
      rpc: vi.fn(async (fnName: string) => {
        if (fnName === "validate_payroll_lock") {
          return { data: null, error: { message: "Period is locked" } };
        }
        return { data: null, error: null };
      }),
    };
    mocks.createClient.mockReturnValue(fakeWithRpc);

    const result = await executeBulkPayrollRunAction("pp-2026-08");
    expect(result.error).toContain("Lock Check Failed");
  });

  it("blocks users without payroll.run permission", async () => {
    mocks.assertPermission.mockResolvedValue({
      error: "Insufficient permissions: payroll.run required",
    });

    const result = await executeBulkPayrollRunAction("pp-2026-08");
    expect(result.error).toContain("Insufficient permissions");
  });

  it("respects rate limiting on bulk payroll runs", async () => {
    mocks.checkActionRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterMs: 120000, // 2 minutes
    });

    const result = await executeBulkPayrollRunAction("pp-2026-08");
    expect(result.error).toContain("Rate limit exceeded");
    expect(result.error).toContain("2 minute(s)");
  });
});

// ── Period Finalization ────────────────────────────────────────────

describe("Payroll Workflow — Finalize Period", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it("finalizes a draft payroll period", async () => {
    const updates: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.method === "update") {
        updates.push({ table: state.table, payload: state.payload });
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });

    const fakeWithRpc = {
      ...fake,
      rpc: vi.fn(async (fnName: string) => {
        if (fnName === "validate_payroll_lock") return { data: true, error: null };
        return { data: null, error: null };
      }),
    };
    mocks.createClient.mockReturnValue(fakeWithRpc);

    const result = await finalizePayrollPeriodAction("pp-2026-08");
    expect((result as any).success).toBe(true);

    // Period status updated
    const periodUpdate = updates.find((u) => u.table === "payroll_periods");
    expect(periodUpdate!.payload).toMatchObject({ status: "finalized" });

    // Revision status also updated
    const revisionUpdate = updates.find((u) => u.table === "payroll_revisions");
    expect(revisionUpdate!.payload).toMatchObject({ status: "finalized" });

    // Audit log written
    expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payroll.finalize",
        entityType: "payroll_periods",
      })
    );
  });

  it("blocks finalization when payroll lock fails", async () => {
    const { fake } = createTestContext();
    const fakeWithRpc = {
      ...fake,
      rpc: vi.fn(async (fnName: string) => {
        if (fnName === "validate_payroll_lock") {
          return { data: null, error: { message: "Period locked by another process" } };
        }
        return { data: null, error: null };
      }),
    };
    mocks.createClient.mockReturnValue(fakeWithRpc);

    const result = await finalizePayrollPeriodAction("pp-2026-08");
    expect((result as any).error).toContain("Cannot finalize");
  });

  it("blocks users without payroll.finalize permission", async () => {
    mocks.assertPermission.mockResolvedValue({
      error: "Insufficient permissions: payroll.finalize required",
    });

    const result = await finalizePayrollPeriodAction("pp-2026-08");
    expect((result as any).error).toContain("Insufficient permissions");
  });
});

// ── Period Publishing ──────────────────────────────────────────────

describe("Payroll Workflow — Publish Period", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it("publishes a finalized payroll period", async () => {
    const updates: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.method === "update") {
        updates.push({ table: state.table, payload: state.payload });
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await publishPayrollPeriodAction("pp-2026-08");
    expect((result as any).success).toBe(true);

    const periodUpdate = updates.find((u) => u.table === "payroll_periods");
    expect(periodUpdate!.payload).toMatchObject({ status: "published" });

    // Audit log written
    expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payroll.publish",
      })
    );
  });

  it("blocks users without payroll.publish permission", async () => {
    mocks.assertPermission.mockResolvedValue({
      error: "Insufficient permissions: payroll.publish required",
    });

    const result = await publishPayrollPeriodAction("pp-2026-08");
    expect((result as any).error).toContain("Insufficient permissions");
  });
});

// ── Period Reopening ───────────────────────────────────────────────

describe("Payroll Workflow — Reopen Period", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it("reopens a finalized period and creates a new revision", async () => {
    const { fake } = createTestContext();
    const fakeWithRpc = {
      ...fake,
      rpc: vi.fn(async (fnName: string) => {
        if (fnName === "reopen_payroll_period") {
          return { data: "rev-002", error: null };
        }
        return { data: null, error: null };
      }),
    };
    mocks.createClient.mockReturnValue(fakeWithRpc);

    const result = await reopenPayrollPeriodAction("pp-2026-08");
    expect((result as any).success).toBe(true);
    expect((result as any).newRevisionId).toBe("rev-002");

    // Audit log written
    expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payroll.reopen",
      })
    );
  });

  it("blocks users without payroll.reopen permission", async () => {
    mocks.assertPermission.mockResolvedValue({
      error: "Insufficient permissions: payroll.reopen required",
    });

    const result = await reopenPayrollPeriodAction("pp-2026-08");
    expect((result as any).error).toContain("Insufficient permissions");
  });
});

// ── Validate Payroll Lock ──────────────────────────────────────────

describe("Payroll Workflow — Validate Lock", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it("returns success when lock is valid", async () => {
    const { fake } = createTestContext();
    const fakeWithRpc = {
      ...fake,
      rpc: vi.fn(async (fnName: string) => {
        if (fnName === "validate_payroll_lock") return { data: true, error: null };
        return { data: null, error: null };
      }),
    };
    mocks.createClient.mockReturnValue(fakeWithRpc);

    const result = await validatePayrollLockAction("pp-2026-08");
    expect((result as any).success).toBe(true);
  });

  it("returns error when lock validation fails", async () => {
    const { fake } = createTestContext();
    const fakeWithRpc = {
      ...fake,
      rpc: vi.fn(async (fnName: string) => {
        if (fnName === "validate_payroll_lock") {
          return { data: null, error: { message: "Period is locked" } };
        }
        return { data: null, error: null };
      }),
    };
    mocks.createClient.mockReturnValue(fakeWithRpc);

    const result = await validatePayrollLockAction("pp-2026-08");
    expect((result as any).error).toContain("Payroll Lock Blocked");
  });
});
