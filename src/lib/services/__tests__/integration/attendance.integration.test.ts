/**
 * Integration Tests — Attendance Workflow
 *
 * Covers:
 *   - Punch check-in (duplicate detection, identity validation)
 *   - Punch check-out (ownership verification)
 *   - Attendance correction submission
 *   - Correction approval/rejection (anti-self-approval guard)
 *   - Permission enforcement across all operations
 *   - Edge cases (already checked in, already completed, missing employee)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerModuleMocks, resetAllMocks, mocks, createTestContext, FIXTURES } from "./setup";

registerModuleMocks();

import {
  punchCheckInAction,
  punchCheckOutAction,
  submitAttendanceCorrectionAction,
  approveAttendanceCorrectionAction,
} from "@/lib/actions/attendance";

// ── Punch Check-In ─────────────────────────────────────────────────

describe("Attendance — Punch Check-In", () => {
  beforeEach(() => {
    resetAllMocks();
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: FIXTURES.employee.id,
      email: FIXTURES.employee.email,
      roles: ["employee"],
    });
  });

  it("creates an attendance record and punch log on check-in", async () => {
    const writes: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.table === "attendance_records" && state.method === "select") {
        return { data: null, error: null }; // No existing record
      }
      if (state.method === "insert") {
        writes.push({ table: state.table, payload: state.payload });
        return { data: { id: "att-001", ...(state.payload as object) }, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await punchCheckInAction();
    expect(result.success).toBe(true);
    expect(result.record).toBeDefined();

    // Attendance record created
    const attWrite = writes.find((w) => w.table === "attendance_records");
    expect(attWrite).toBeDefined();
    expect(attWrite!.payload).toMatchObject({
      employee_id: FIXTURES.employee.id,
      status: "pending_review",
    });

    // Punch log created
    const punchWrite = writes.find((w) => w.table === "attendance_punches");
    expect(punchWrite).toBeDefined();
    expect(punchWrite!.payload).toMatchObject({
      attendance_record_id: "att-001",
      punch_type: "check_in",
    });
  });

  it("rejects check-in when already checked in for today", async () => {
    const { fake } = createTestContext((state) => {
      if (state.table === "attendance_records" && state.method === "select") {
        return {
          data: {
            id: "att-existing",
            employee_id: FIXTURES.employee.id,
            check_in_time: "2026-08-01T09:00:00Z",
            check_out_time: null,
            status: "pending_review",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await punchCheckInAction();
    expect(result.success).toBe(false);
    expect(result.error).toBe("You are already checked in for today.");
  });

  it("rejects check-in when attendance is already completed", async () => {
    const { fake } = createTestContext((state) => {
      if (state.table === "attendance_records" && state.method === "select") {
        return {
          data: {
            id: "att-completed",
            employee_id: FIXTURES.employee.id,
            check_in_time: "2026-08-01T09:00:00Z",
            check_out_time: "2026-08-01T18:00:00Z",
            status: "present",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await punchCheckInAction();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Attendance for today has already been completed.");
  });

  it("blocks users without attendance.mark.self permission", async () => {
    mocks.assertAnyPermission.mockResolvedValue({
      error: "Insufficient permissions",
    });

    const result = await punchCheckInAction();
    expect(result.success).toBe(false);
    expect(result.error).toContain("Insufficient permissions");
  });

  it("returns error when employee record is not found", async () => {
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: null,
      email: null,
      roles: [],
    });

    const { fake } = createTestContext((state) => {
      if (state.table === "employees" && state.method === "select") {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await punchCheckInAction();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Employee record not found for check-in");
  });
});

// ── Punch Check-Out ────────────────────────────────────────────────

describe("Attendance — Punch Check-Out", () => {
  beforeEach(() => {
    resetAllMocks();
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: FIXTURES.employee.id,
      email: FIXTURES.employee.email,
      roles: ["employee"],
    });
  });

  it("updates the attendance record with check-out time", async () => {
    const updates: Array<{ table: string; payload: unknown }> = [];
    const writes: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.table === "attendance_records" && state.method === "select" && state.filters.some((f) => f.val === "att-001")) {
        return { data: { employee_id: FIXTURES.employee.id }, error: null };
      }
      if (state.table === "attendance_records" && state.method === "update") {
        updates.push({ table: "attendance_records", payload: state.payload });
        return { data: { id: "att-001", status: "present" }, error: null };
      }
      if (state.table === "attendance_punches" && state.method === "insert") {
        writes.push({ table: "attendance_punches", payload: state.payload });
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await punchCheckOutAction("att-001");
    expect(result.success).toBe(true);

    // Record updated
    const attUpdate = updates.find((u) => u.table === "attendance_records");
    expect(attUpdate!.payload).toMatchObject({ status: "present" });

    // Punch log created
    const punchWrite = writes.find((w) => w.table === "attendance_punches");
    expect(punchWrite).toBeDefined();
    expect(punchWrite!.payload).toMatchObject({
      attendance_record_id: "att-001",
      punch_type: "check_out",
    });
  });

  it("blocks check-out for another employee's record (non-admin)", async () => {
    // Mock assertCallerIdentity to return error for non-self operations
    mocks.assertCallerIdentity.mockResolvedValue({
      error: "Forbidden: You cannot perform this action on behalf of another employee",
    });

    const { fake } = createTestContext((state) => {
      if (state.table === "attendance_records" && state.method === "select") {
        return { data: { employee_id: "other-emp-id" }, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await punchCheckOutAction("att-001");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Forbidden");
  });
});

// ── Attendance Correction ──────────────────────────────────────────

describe("Attendance — Submit Correction", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it("submits a correction request with sanitized reason", async () => {
    const writes: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.method === "insert") {
        writes.push({ table: state.table, payload: state.payload });
        return { data: { id: "corr-001", ...(state.payload as object) }, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await submitAttendanceCorrectionAction(
      "att-001",
      FIXTURES.employee.id,
      "2026-08-01T08:30:00Z",
      "2026-08-01T17:30:00Z",
      "Forgot to punch in"
    );

    expect(result.success).toBe(true);
    expect(result.correction).toBeDefined();

    const corrWrite = writes.find((w) => w.table === "attendance_corrections");
    expect(corrWrite!.payload).toMatchObject({
      attendance_record_id: "att-001",
      employee_id: FIXTURES.employee.id,
      status: "submitted",
    });
  });

  it("blocks correction without attendance.correct.self permission", async () => {
    mocks.assertPermission.mockResolvedValue({
      error: "Insufficient permissions: attendance.correct.self required",
    });

    const result = await submitAttendanceCorrectionAction(
      "att-001",
      FIXTURES.employee.id,
      "2026-08-01T08:30:00Z",
      "2026-08-01T17:30:00Z",
      "Forgot to punch"
    );

    // The action returns { error: string } on permission failure
    expect(result).toHaveProperty("error");
    expect(result.error).toContain("Insufficient permissions");
  });
});

// ── Correction Approval ────────────────────────────────────────────

describe("Attendance — Approve Correction", () => {
  beforeEach(() => {
    resetAllMocks();
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: FIXTURES.manager.id,
      email: FIXTURES.manager.email,
      roles: ["manager"],
    });
  });

  it("approves a correction request", async () => {
    const updates: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.table === "attendance_corrections" && state.method === "select") {
        return {
          data: { employee_id: FIXTURES.employee.id },
          error: null,
        };
      }
      if (state.table === "attendance_corrections" && state.method === "update") {
        updates.push({ table: "attendance_corrections", payload: state.payload });
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await approveAttendanceCorrectionAction("corr-001", "approved");
    expect(result.success).toBe(true);

    expect(updates[0].payload).toMatchObject({
      status: "approved",
      decided_by: FIXTURES.manager.id,
    });
  });

  it("rejects a correction request", async () => {
    const updates: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.table === "attendance_corrections" && state.method === "select") {
        return {
          data: { employee_id: FIXTURES.employee.id },
          error: null,
        };
      }
      if (state.table === "attendance_corrections" && state.method === "update") {
        updates.push({ table: "attendance_corrections", payload: state.payload });
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await approveAttendanceCorrectionAction("corr-001", "rejected");
    expect(result.success).toBe(true);
    expect(updates[0].payload).toMatchObject({ status: "rejected" });
  });

  it("blocks self-approval of attendance corrections", async () => {
    const { fake } = createTestContext((state) => {
      if (state.table === "attendance_corrections" && state.method === "select") {
        return {
          data: { employee_id: FIXTURES.manager.id }, // Same as decider
          error: null,
        };
      }
      return { data: null, error: null };
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await approveAttendanceCorrectionAction("corr-002", "approved");
    expect(result.error).toContain("Self-approval");
  });

  it("blocks users without approval permission", async () => {
    mocks.assertAnyPermission.mockResolvedValue({
      error: "Insufficient permissions",
    });

    const result = await approveAttendanceCorrectionAction("corr-001", "approved");
    expect(result.error).toContain("Insufficient permissions");
  });
});
