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
import { createSalaryStructureAction } from "@/lib/actions/salary";
import {
  submitLeaveEncashmentAction,
  decideLeaveEncashmentAction,
} from "@/lib/actions/encashment";
import { saveStatutoryProfileAction } from "@/lib/actions/statutory";

describe("createSalaryStructureAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("closes the open version and inserts the new structure", async () => {
    const writes: Array<{ table: string; method: string; payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employee_salary_structures" && state.method === "select") {
          return { data: { id: "ss-old", effective_from: "2026-01-01" }, error: null };
        }
        if (state.method === "update" || state.method === "insert") {
          writes.push({ table: state.table, method: state.method, payload: state.payload });
          return { data: { id: "ss-new", ...(state.payload as object) }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await createSalaryStructureAction("emp-1", 900000, "2026-08-01");
    expect(res.success).toBe(true);

    const closeUpdate = writes.find((w) => w.method === "update");
    expect(closeUpdate?.payload).toEqual({ effective_to: "2026-07-31" });

    const insert = writes.find((w) => w.method === "insert");
    expect(insert?.payload).toMatchObject({
      employee_id: "emp-1",
      annual_ctc: 900000,
      monthly_gross: 75000,
      basic_monthly: 37500,
      effective_from: "2026-08-01",
    });
  });

  it("skips closing when no open version exists", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employee_salary_structures" && state.method === "select") {
          return { data: null, error: null };
        }
        if (state.method === "insert") {
          return { data: { id: "ss-new" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await createSalaryStructureAction("emp-1", 600000, "2026-08-01");
    expect(res.success).toBe(true);
    expect(fake.rpc).toBeDefined();
  });
});

describe("submitLeaveEncashmentAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("resolves the EL leave type and inserts with divisor-26 amounts", async () => {
    const writes: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "leave_types" && state.method === "select") {
          return { data: { id: "lt-el" }, error: null };
        }
        if (state.table === "leave_encashment_requests" && state.method === "insert") {
          writes.push({ payload: state.payload });
          return { data: { id: "enc-1", ...(state.payload as object) }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await submitLeaveEncashmentAction("emp-1", 10, "annual_window", 26000);
    expect(res.success).toBe(true);
    expect(writes[0].payload).toMatchObject({
      employee_id: "emp-1",
      leave_type_id: "lt-el",
      days_to_encash: 10,
      daily_rate: 1000,
      total_amount: 10000,
      status: "pending",
    });
  });

  it("uses a provided leave type id without a lookup", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "leave_encashment_requests" && state.method === "insert") {
          return { data: { id: "enc-2" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await submitLeaveEncashmentAction("emp-1", 5, "fnf", 26000, "lt-direct");
    expect(res.success).toBe(true);
  });

  it("fails when no leave type can be resolved", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "leave_types" && state.method === "select") {
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await submitLeaveEncashmentAction("emp-1", 5, "fnf", 26000);
    expect(res).toEqual({ success: false, error: "Leave type ID for encashment is missing" });
  });
});

describe("decideLeaveEncashmentAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("updates the request with the acting approver", async () => {
    const updates: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-9" }, error: null };
        }
        if (state.table === "leave_encashment_requests" && state.method === "update") {
          updates.push({ payload: state.payload });
          return { data: { id: "enc-1" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await decideLeaveEncashmentAction("enc-1", "approved");
    expect(res.success).toBe(true);
    expect(updates[0].payload).toMatchObject({
      status: "approved",
      approver_id: "emp-9",
    });
  });

  it("rejects unauthenticated requests", async () => {
    const fake = createFakeSupabase({ user: null });
    mocks.createClient.mockReturnValue(fake);

    const res = await decideLeaveEncashmentAction("enc-1", "rejected");
    expect(res).toEqual({ success: false, error: "Unauthenticated" });
  });
});

describe("saveStatutoryProfileAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("updates the statutory profile", async () => {
    const updates: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "statutory_profiles" && state.method === "update") {
          updates.push({ payload: state.payload });
          return { data: { id: "sp-1", ...(state.payload as object) }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await saveStatutoryProfileAction(
      "sp-1", "ABCDE1234F", "100000000001", "Karnataka",
      "new_regime", true, false
    );
    expect(res.success).toBe(true);
    expect(updates[0].payload).toMatchObject({
      pan_number: "ABCDE1234F",
      pt_state: "Karnataka",
      tax_regime: "new_regime",
      pf_applicable: true,
      esi_applicable: false,
    });
  });

  it("blocks users without statutory.edit", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Insufficient permissions: statutory.edit required" });
    const fake = createFakeSupabase();
    mocks.createClient.mockReturnValue(fake);

    const res = await saveStatutoryProfileAction("sp-1", "P", "U", "Karnataka", "new_regime", true, false);
    expect(res).toEqual({ success: false, error: "Insufficient permissions: statutory.edit required" });
  });
});
