import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeLastWorkingDay } from "../offboarding-engine";

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
import {
  submitResignationAction,
  approveFfAction,
  toggleClearanceAction,
} from "@/lib/actions/offboarding";

describe("submitResignationAction", () => {
  beforeEach(() => {
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("inserts the separation with the computed LWD and creates an F&F draft", async () => {
    const writes: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "separation_records" && state.method === "insert") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: { id: "sep-1", ...(state.payload as object) }, error: null };
        }
        if (state.table === "ff_settlement_records" && state.method === "insert") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await submitResignationAction("emp-1", "2026-08-14", 30, "init-1");

    expect(res.success).toBe(true);
    const sepWrite = writes.find((w) => w.table === "separation_records");
    expect(sepWrite?.payload).toMatchObject({
      employee_id: "emp-1",
      separation_type: "resignation",
      initiated_by: "init-1",
      notice_period_days: 30,
      last_working_day: computeLastWorkingDay("2026-08-14", 30),
      status: "active",
    });
    const ffWrite = writes.find((w) => w.table === "ff_settlement_records");
    expect(ffWrite?.payload).toMatchObject({
      separation_id: "sep-1",
      employee_id: "emp-1",
      last_working_day: computeLastWorkingDay("2026-08-14", 30),
      status: "draft",
    });
  });

  it("resolves the initiator from the session when none is provided", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-9" }, error: null };
        }
        if (state.table === "separation_records" && state.method === "insert") {
          return { data: { id: "sep-2" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await submitResignationAction("emp-1", "2026-08-14", 30);
    expect(res.success).toBe(true);
  });

  it("surfaces insert errors", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "separation_records" && state.method === "insert") {
          return { data: null, error: { message: "boom" } };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await submitResignationAction("emp-1", "2026-08-14", 30, "init-1");
    expect(res).toEqual({ error: "boom" });
  });
});

describe("approveFfAction", () => {
  beforeEach(() => {
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("marks the separation offboarded only when the LWD has been reached", async () => {
    const updates: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "ff_settlement_records" && state.method === "select") {
          return { data: { id: "ff-1", employee_id: "emp-1" }, error: null };
        }
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-9" }, error: null };
        }
        if (state.table === "separation_records" && state.method === "select") {
          return { data: { last_working_day: "2000-01-01" }, error: null };
        }
        if (state.method === "update") {
          updates.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await approveFfAction("sep-1");
    expect(res.success).toBe(true);
    expect(res.lwdReached).toBe(true);

    const sepUpdate = updates.find((u) => u.table === "separation_records");
    expect(sepUpdate?.payload.status).toBe("offboarded");
    const ffUpdate = updates.find((u) => u.table === "ff_settlement_records");
    expect(ffUpdate?.payload.status).toBe("approved");
  });

  it("keeps the separation active when the LWD is in the future", async () => {
    const updates: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "ff_settlement_records" && state.method === "select") {
          return { data: { id: "ff-1", employee_id: "emp-1" }, error: null };
        }
        if (state.table === "separation_records" && state.method === "select") {
          return { data: { last_working_day: "2999-12-31" }, error: null };
        }
        if (state.method === "update") {
          updates.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await approveFfAction("sep-1");
    expect(res.success).toBe(true);
    expect(res.lwdReached).toBe(false);
    const sepUpdate = updates.find((u) => u.table === "separation_records");
    expect(sepUpdate?.payload.status).toBe("active");
  });
});

describe("toggleClearanceAction", () => {
  beforeEach(() => {
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("upserts a department clearance for the settlement", async () => {
    const upserts: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "ff_settlement_records" && state.method === "select") {
          return { data: { id: "ff-1", employee_id: "emp-1" }, error: null };
        }
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-9" }, error: null };
        }
        if (state.table === "ff_clearances" && state.method === "upsert") {
          upserts.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await toggleClearanceAction("sep-1", "IT", true);
    expect(res.success).toBe(true);
    expect(upserts[0].payload).toMatchObject({
      ff_settlement_id: "ff-1",
      department_name: "IT",
      is_cleared: true,
      cleared_by: "emp-9",
    });
  });
});
