/**
 * Integration Tests — Offboarding Workflow
 *
 * Covers:
 *   - Resignation submission (F&F draft creation, LWD calculation)
 *   - Resignation rescind (status update, F&F cancellation)
 *   - Clearance toggle (department-specific, audit logging)
 *   - F&F approval (self-approval guard, LWD-based status resolution)
 *   - Stale F&F detection
 *   - Permission enforcement across all operations
 *   - Edge cases (missing F&F, already completed separation)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerModuleMocks, resetAllMocks, mocks, createTestContext, FIXTURES } from "./setup";

registerModuleMocks();

import {
  submitResignationAction,
  rescindResignationAction,
  toggleClearanceAction,
  approveFfAction,
  triggerStaleFfAction,
} from "@/lib/actions/offboarding";

// ── Resignation Submission ─────────────────────────────────────────

describe("Offboarding — Submit Resignation", () => {
  beforeEach(() => {
    resetAllMocks();
    mocks.computeLastWorkingDay.mockReturnValue("2026-08-31");
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: FIXTURES.employee.id,
      email: FIXTURES.employee.email,
      roles: ["employee"],
    });
  });

  it("creates a separation record and F&F draft", async () => {
    const writes: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.method === "insert") {
        writes.push({ table: state.table, payload: state.payload });
        return { data: { id: "sep-001", ...(state.payload as object) }, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await submitResignationAction(
      FIXTURES.employee.id,
      "2026-08-01",
      30
    );

    expect(result.success).toBe(true);
    expect(result.record).toBeDefined();

    // Separation record created
    const sepWrite = writes.find((w) => w.table === "separation_records");
    expect(sepWrite).toBeDefined();
    expect(sepWrite!.payload).toMatchObject({
      employee_id: FIXTURES.employee.id,
      separation_type: "resignation",
      separation_date: "2026-08-01",
      notice_period_days: 30,
      last_working_day: "2026-08-31",
      status: "active",
    });

    // F&F draft created
    const ffWrite = writes.find((w) => w.table === "ff_settlement_records");
    expect(ffWrite).toBeDefined();
    expect(ffWrite!.payload).toMatchObject({
      separation_id: "sep-001",
      employee_id: FIXTURES.employee.id,
      last_working_day: "2026-08-31",
      net_settlement_amount: 0,
      status: "draft",
    });
  });

  it("uses the caller's employee ID as initiator", async () => {
    const writes: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.method === "insert") {
        writes.push({ table: state.table, payload: state.payload });
        return { data: { id: "sep-002", ...(state.payload as object) }, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    await submitResignationAction(
      FIXTURES.employee.id,
      "2026-08-01",
      30
    );

    const sepWrite = writes.find((w) => w.table === "separation_records");
    expect(sepWrite!.payload).toMatchObject({
      initiated_by: FIXTURES.employee.id,
      created_by: FIXTURES.employee.id,
    });
  });

  it("blocks users without separation.create permission", async () => {
    mocks.assertAnyPermission.mockResolvedValue({
      error: "Insufficient permissions: one of [separation.view, separation.create, offboarding.manage] required",
    });

    const result = await submitResignationAction(
      FIXTURES.employee.id,
      "2026-08-01",
      30
    );

    expect(result.error).toContain("Insufficient permissions");
  });

  it("surfaces database errors", async () => {
    const { fake } = createTestContext((state) => {
      if (state.method === "insert") {
        return { data: null, error: { message: "duplicate separation" } };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await submitResignationAction(
      FIXTURES.employee.id,
      "2026-08-01",
      30
    );

    expect(result.error).toBe("duplicate separation");
  });
});

// ── Resignation Rescind ────────────────────────────────────────────

describe("Offboarding — Rescind Resignation", () => {
  beforeEach(() => {
    resetAllMocks();
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: FIXTURES.employee.id,
      email: FIXTURES.employee.email,
      roles: ["employee"],
    });
  });

  it("rescinds a resignation and cancels F&F draft", async () => {
    const updates: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.table === "separation_records" && state.method === "select") {
        return {
          data: { employee_id: FIXTURES.employee.id, status: "active" },
          error: null,
        };
      }
      if (state.method === "update") {
        updates.push({ table: state.table, payload: state.payload });
        return { data: { id: "sep-001", status: "rescinded" }, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await rescindResignationAction("sep-001");
    expect(result.success).toBe(true);

    // Separation status updated
    const sepUpdate = updates.find((u) => u.table === "separation_records");
    expect(sepUpdate!.payload).toMatchObject({ status: "rescinded" });

    // F&F draft cancelled
    const ffUpdate = updates.find((u) => u.table === "ff_settlement_records");
    expect(ffUpdate!.payload).toMatchObject({ status: "cancelled" });

    // Audit log written
    expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "separation.rescind",
      })
    );
  });

  it("returns error for non-existent separation", async () => {
    const { fake } = createTestContext((state) => {
      if (state.table === "separation_records" && state.method === "select") {
        return { data: null, error: { message: "not found" } };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await rescindResignationAction("non-existent");
    expect(result.error).toBe("Separation record not found");
  });

  it("blocks rescind for another employee's resignation (non-HR)", async () => {
    // Mock assertCallerIdentity to return error for non-self operations
    mocks.assertCallerIdentity.mockResolvedValue({
      error: "Forbidden: You cannot perform this action on behalf of another employee",
    });

    const { fake } = createTestContext((state) => {
      if (state.table === "separation_records" && state.method === "select") {
        return {
          data: { employee_id: "other-emp-id", status: "active" },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await rescindResignationAction("sep-001");
    expect(result.error).toContain("Forbidden");
  });
});

// ── Clearance Toggle ───────────────────────────────────────────────

describe("Offboarding — Toggle Clearance", () => {
  beforeEach(() => {
    resetAllMocks();
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: FIXTURES.hrAdmin.id,
      email: FIXTURES.hrAdmin.email,
      roles: ["hr"],
    });
  });

  it("marks IT department as cleared", async () => {
    const writes: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.table === "ff_settlement_records" && state.method === "select") {
        return { data: { id: "ff-001", employee_id: FIXTURES.employee.id }, error: null };
      }
      if (state.table === "employees" && state.method === "select") {
        return { data: { id: FIXTURES.hrAdmin.id }, error: null };
      }
      if (state.table === "ff_clearances" && state.method === "upsert") {
        writes.push({ table: "ff_clearances", payload: state.payload });
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await toggleClearanceAction("sep-001", "IT", true);
    expect(result.success).toBe(true);

    expect(writes[0].payload).toMatchObject({
      department_name: "IT",
      is_cleared: true,
    });

    // Audit log written
    expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ff.clearance_approved",
      })
    );
  });

  it("revokes clearance for a department", async () => {
    const writes: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.table === "ff_settlement_records" && state.method === "select") {
        return { data: { id: "ff-001", employee_id: FIXTURES.employee.id }, error: null };
      }
      if (state.table === "employees" && state.method === "select") {
        return { data: { id: FIXTURES.hrAdmin.id }, error: null };
      }
      if (state.table === "ff_clearances" && state.method === "upsert") {
        writes.push({ table: "ff_clearances", payload: state.payload });
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await toggleClearanceAction("sep-001", "Finance", false);
    expect(result.success).toBe(true);

    expect(writes[0].payload).toMatchObject({
      department_name: "Finance",
      is_cleared: false,
      cleared_by: null,
    });

    expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ff.clearance_revoked",
      })
    );
  });

  it("returns error when no F&F settlement exists", async () => {
    const { fake } = createTestContext((state) => {
      if (state.table === "ff_settlement_records" && state.method === "select") {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await toggleClearanceAction("sep-001", "IT", true);
    expect(result.error).toContain("No F&F settlement found");
  });

  it("blocks users without offboarding.manage permission", async () => {
    mocks.assertPermission.mockResolvedValue({
      error: "Insufficient permissions: offboarding.manage required",
    });

    const result = await toggleClearanceAction("sep-001", "IT", true);
    expect(result.error).toContain("Insufficient permissions");
  });
});

// ── F&F Approval ───────────────────────────────────────────────────

describe("Offboarding — Approve F&F", () => {
  beforeEach(() => {
    resetAllMocks();
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: FIXTURES.hrAdmin.id,
      email: FIXTURES.hrAdmin.email,
      roles: ["hr"],
    });
  });

  it("approves F&F and resolves separation status based on LWD", async () => {
    const updates: Array<{ table: string; payload: unknown }> = [];
    mocks.resolveFfApprovalOutcome.mockReturnValue({
      status: "completed",
      lwdReached: true,
    });

    const { fake } = createTestContext((state) => {
      if (state.table === "ff_settlement_records" && state.method === "select") {
        return { data: { id: "ff-001", employee_id: FIXTURES.employee.id }, error: null };
      }
      if (state.table === "employees" && state.method === "select") {
        return { data: { id: FIXTURES.hrAdmin.id }, error: null };
      }
      if (state.table === "separation_records" && state.method === "select") {
        return { data: { last_working_day: "2026-07-15" }, error: null };
      }
      if (state.method === "update") {
        updates.push({ table: state.table, payload: state.payload });
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await approveFfAction("sep-001");
    expect(result.success).toBe(true);
    expect(result.lwdReached).toBe(true);

    // F&F status updated
    const ffUpdate = updates.find((u) => u.table === "ff_settlement_records");
    expect(ffUpdate!.payload).toMatchObject({ status: "approved" });

    // Separation status updated
    const sepUpdate = updates.find((u) => u.table === "separation_records");
    expect(sepUpdate!.payload).toMatchObject({ status: "completed" });

    // Audit log written
    expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ff.approve",
      })
    );
  });

  it("blocks self-approval of F&F settlement", async () => {
    const { fake } = createTestContext((state) => {
      if (state.table === "ff_settlement_records" && state.method === "select") {
        return {
          data: { id: "ff-002", employee_id: FIXTURES.hrAdmin.id }, // Same as approver
          error: null,
        };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await approveFfAction("sep-001");
    expect(result.error).toContain("Self-approval");
  });

  it("returns error when no F&F settlement exists", async () => {
    const { fake } = createTestContext((state) => {
      if (state.table === "ff_settlement_records" && state.method === "select") {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await approveFfAction("sep-001");
    expect(result.error).toContain("No F&F settlement found");
  });

  it("blocks users without ff.approve permission", async () => {
    mocks.assertPermission.mockResolvedValue({
      error: "Insufficient permissions: ff.approve required",
    });

    const result = await approveFfAction("sep-001");
    expect(result.error).toContain("Insufficient permissions");
  });
});

// ── Stale F&F Detection ────────────────────────────────────────────

describe("Offboarding — Trigger Stale F&F", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it("inserts a leave ledger entry to trigger staleness", async () => {
    const writes: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.table === "ff_settlement_records" && state.method === "select") {
        return { data: { id: "ff-001", employee_id: FIXTURES.employee.id }, error: null };
      }
      if (state.table === "leave_types" && state.method === "select") {
        return { data: { id: "lt-cl" }, error: null };
      }
      if (state.table === "leave_ledger" && state.method === "insert") {
        writes.push({ table: "leave_ledger", payload: state.payload });
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await triggerStaleFfAction("sep-001");
    expect(result.success).toBe(true);

    expect(writes[0].payload).toMatchObject({
      employee_id: FIXTURES.employee.id,
      reference_id: "ff-001",
    });
  });

  it("blocks users without offboarding.manage permission", async () => {
    mocks.assertPermission.mockResolvedValue({
      error: "Insufficient permissions: offboarding.manage required",
    });

    const result = await triggerStaleFfAction("sep-001");
    expect(result.error).toContain("Insufficient permissions");
  });
});
