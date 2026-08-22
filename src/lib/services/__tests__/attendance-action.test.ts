import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
  assertAnyPermission: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: mocks.assertAnyPermission,
  assertCallerIdentity: vi.fn(async () => null),
  getAuthenticatedCaller: vi.fn(async () => null),
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import {
  punchCheckInAction,
  punchCheckOutAction,
  submitAttendanceCorrectionAction,
  approveAttendanceCorrectionAction,
  getAttendanceAction,
} from "@/lib/actions/attendance";

describe("punchCheckInAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertAnyPermission.mockReset();
    mocks.assertAnyPermission.mockResolvedValue(null);
  });

  it("inserts an attendance record and an in-punch", async () => {
    const writes: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "attendance_records" && state.method === "insert") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: { id: "att-1" }, error: null };
        }
        if (state.table === "attendance_punches" && state.method === "insert") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await punchCheckInAction("emp-1");
    expect(res.success).toBe(true);
    expect(writes[0]).toMatchObject({
      table: "attendance_records",
      payload: { employee_id: "emp-1", status: "pending_review" },
    });
    expect(writes[0].payload.check_in_time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(writes[1]).toMatchObject({
      table: "attendance_punches",
      payload: { attendance_record_id: "att-1", punch_type: "check_in" },
    });
    expect(writes[1].payload.punch_timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("resolves the employee id from the session when not provided", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-9" }, error: null };
        }
        if (state.table === "attendance_records" && state.method === "insert") {
          return { data: { id: "att-2" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await punchCheckInAction();
    expect(res.success).toBe(true);
    expect(res.record.id).toBe("att-2");
  });

  it("fails when no employee can be resolved", async () => {
    const fake = createFakeSupabase({ user: null });
    mocks.createClient.mockReturnValue(fake);

    const res = await punchCheckInAction();
    expect(res).toEqual({ success: false, error: "Employee record not found for check-in" });
  });
});

describe("punchCheckOutAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertAnyPermission.mockReset();
    mocks.assertAnyPermission.mockResolvedValue(null);
  });

  it("updates the record to present and logs an out-punch", async () => {
    const writes: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "attendance_records" && state.method === "update") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: { id: "att-1" }, error: null };
        }
        if (state.table === "attendance_punches" && state.method === "insert") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await punchCheckOutAction("att-1");
    expect(res.success).toBe(true);
    expect(writes[0].payload).toMatchObject({ status: "present" });
    expect(writes[0].payload.check_out_time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(writes[1].payload).toMatchObject({ attendance_record_id: "att-1", punch_type: "check_out" });
    expect(writes[1].payload.punch_timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("surfaces update errors", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "attendance_records" && state.method === "update") {
          return { data: null, error: { message: "lock" } };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await punchCheckOutAction("att-1");
    expect(res).toEqual({ success: false, error: "lock" });
  });
});

describe("submitAttendanceCorrectionAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("submits a correction in the submitted state", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "attendance_corrections" && state.method === "insert") {
          return { data: { id: "corr-1", ...(state.payload as object) }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await submitAttendanceCorrectionAction("att-1", "emp-1", "09:00", "18:00", "Forgot to punch");
    expect(res.success).toBe(true);
    expect(res.correction).toMatchObject({
      attendance_record_id: "att-1",
      employee_id: "emp-1",
      status: "submitted",
      reason: "Forgot to punch",
    });
  });

  it("returns a null correction on insert failure", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "attendance_corrections" && state.method === "insert") {
          return { data: null, error: { message: "db down" } };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await submitAttendanceCorrectionAction("att-1", "emp-1", "09:00", "18:00", "x");
    expect(res).toEqual({ success: false, correction: null });
  });
});

describe("approveAttendanceCorrectionAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertAnyPermission.mockReset();
    mocks.assertAnyPermission.mockResolvedValue(null);
  });

  it("approves a correction with the acting employee as decider", async () => {
    const updates: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-9" }, error: null };
        }
        if (state.table === "attendance_corrections" && state.method === "update") {
          updates.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await approveAttendanceCorrectionAction("corr-1", "approved");
    expect(res.success).toBe(true);
    expect(updates[0].payload).toMatchObject({ status: "approved", decided_by: "emp-9" });
  });

  it("rejects unauthenticated requests", async () => {
    const fake = createFakeSupabase({ user: null });
    mocks.createClient.mockReturnValue(fake);

    const res = await approveAttendanceCorrectionAction("corr-1", "rejected");
    expect(res).toEqual({ error: "Unauthenticated" });
  });
});

describe("getAttendanceAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("returns empty data when unauthenticated", async () => {
    const fake = createFakeSupabase({ user: null });
    mocks.createClient.mockReturnValue(fake);

    await expect(getAttendanceAction()).resolves.toEqual({ records: [], corrections: [] });
  });

  it("returns records and corrections for the current employee", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-1" }, error: null };
        }
        if (state.table === "attendance_records" && state.method === "select") {
          return { data: [{ id: "att-1", status: "present" }], error: null };
        }
        if (state.table === "attendance_corrections" && state.method === "select") {
          return { data: [{ id: "corr-1", status: "submitted" }], error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await getAttendanceAction();
    expect(res.employeeId).toBe("emp-1");
    expect(res.records).toHaveLength(1);
    expect(res.corrections).toHaveLength(1);
  });
});
