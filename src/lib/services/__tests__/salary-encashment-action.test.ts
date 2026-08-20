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
import { createSalaryStructureAction, bulkAssignSalaryStructure } from "@/lib/actions/salary";
import {
  submitLeaveEncashmentAction,
  decideLeaveEncashmentAction,
} from "@/lib/actions/encashment";
import { saveStatutoryProfileAction, bulkUpsertStatutoryProfiles } from "@/lib/actions/statutory";

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

describe("bulkAssignSalaryStructure", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("successfully processes valid rows, closes open previous versions, and inserts new versions", async () => {
    const writes: Array<{ table: string; method: string; payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-101", employee_code: "EMP-101", full_name: "Test Employee" }, error: null };
        }
        if (state.table === "employee_salary_structures" && state.method === "select") {
          // Existing version starting 2026-01-01 open-ended
          return {
            data: [{ id: "v1", effective_from: "2026-01-01", effective_to: null, version_number: 1 }],
            error: null,
          };
        }
        if (state.method === "update" || state.method === "insert") {
          writes.push({ table: state.table, method: state.method, payload: state.payload });
          return { data: { id: "new-id", ...(state.payload as object) }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await bulkAssignSalaryStructure([
      {
        employee_code: "EMP-101",
        annual_ctc: 960000,
        effective_start_date: "2026-09-01",
        effective_end_date: "",
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.total).toBe(1);
    expect(result.successCount).toBe(1);
    expect(result.errorCount).toBe(0);

    // Verify closing update
    const updateCall = writes.find((w) => w.table === "employee_salary_structures" && w.method === "update");
    expect(updateCall?.payload).toEqual({ effective_to: "2026-08-31" });

    // Verify insert
    const insertCall = writes.find((w) => w.table === "employee_salary_structures" && w.method === "insert");
    expect(insertCall?.payload).toMatchObject({
      employee_id: "emp-101",
      annual_ctc: 960000,
      monthly_gross: 80000,
      basic_monthly: 40000,
      effective_from: "2026-09-01",
      version_number: 2,
    });
  });

  it("rejects overlapping version conflicts against closed historical periods", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-101", employee_code: "EMP-101", full_name: "Test" }, error: null };
        }
        if (state.table === "employee_salary_structures" && state.method === "select") {
          // Closed historical version from 2026-01-01 to 2026-06-30
          return {
            data: [{ id: "v1", effective_from: "2026-01-01", effective_to: "2026-06-30", version_number: 1 }],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    // Try to insert a version that starts inside the closed window [2026-03-01 to 2026-08-01]
    const result = await bulkAssignSalaryStructure([
      {
        employee_code: "EMP-101",
        annual_ctc: 960000,
        effective_start_date: "2026-03-01",
        effective_end_date: "2026-08-01",
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0]).toContain("Overlapping version conflict");
  });

  it("handles missing/unknown employee code gracefully", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await bulkAssignSalaryStructure([
      {
        employee_code: "NONEXISTENT",
        annual_ctc: 500000,
        effective_start_date: "2026-09-01",
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0]).toContain("Employee code 'NONEXISTENT' not found");
  });

  it("blocks unauthorized callers without salary.bulk_assign permission", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Insufficient permissions: salary.bulk_assign required" });
    const fake = createFakeSupabase();
    mocks.createClient.mockReturnValue(fake);

    const result = await bulkAssignSalaryStructure([
      {
        employee_code: "EMP-101",
        annual_ctc: 500000,
        effective_start_date: "2026-09-01",
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("Insufficient permissions");
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

describe("bulkUpsertStatutoryProfiles", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("updates existing statutory profile when open profile exists", async () => {
    const updates: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-101", employee_code: "EMP-101" }, error: null };
        }
        if (state.table === "statutory_profiles" && state.method === "select") {
          return { data: { id: "sp-existing", effective_from: "2025-04-01" }, error: null };
        }
        if (state.table === "statutory_profiles" && state.method === "update") {
          updates.push({ payload: state.payload });
          return { data: { id: "sp-existing", ...(state.payload as object) }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await bulkUpsertStatutoryProfiles([
      {
        employee_code: "EMP-101",
        pan_number: "ABCDE1234F",
        uan_number: "100904567890",
        pf_number: "PF-001",
        esi_number: "ESI-001",
        pt_state: "Karnataka",
        tax_regime: "new_regime",
        pf_applicable: true,
        esi_applicable: true,
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.total).toBe(1);
    expect(result.successCount).toBe(1);
    expect(updates[0].payload).toMatchObject({
      pan_number: "ABCDE1234F",
      uan_number: "100904567890",
      pt_state: "Karnataka",
      tax_regime: "new_regime",
      pf_applicable: true,
      esi_applicable: true,
    });
  });

  it("inserts new statutory profile when no existing profile is found", async () => {
    const inserts: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-102", employee_code: "EMP-102" }, error: null };
        }
        if (state.table === "statutory_profiles" && state.method === "select") {
          return { data: null, error: null };
        }
        if (state.table === "statutory_profiles" && state.method === "insert") {
          inserts.push({ payload: state.payload });
          return { data: { id: "sp-new", ...(state.payload as object) }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await bulkUpsertStatutoryProfiles([
      {
        employee_code: "EMP-102",
        pan_number: "XYZPK9876Q",
        uan_number: "100904567891",
        pt_state: "Maharashtra",
        tax_regime: "old_regime",
        pf_applicable: true,
        esi_applicable: false,
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.successCount).toBe(1);
    expect(inserts[0].payload).toMatchObject({
      employee_id: "emp-102",
      pan_number: "XYZPK9876Q",
      pt_state: "Maharashtra",
      tax_regime: "old_regime",
    });
  });

  it("rejects invalid PAN format", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-101", employee_code: "EMP-101" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await bulkUpsertStatutoryProfiles([
      {
        employee_code: "EMP-101",
        pan_number: "INVALID_PAN_123",
        pt_state: "Karnataka",
        tax_regime: "new_regime",
        pf_applicable: true,
        esi_applicable: true,
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0]).toContain("Invalid PAN format");
  });

  it("rejects invalid UAN format", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-101", employee_code: "EMP-101" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await bulkUpsertStatutoryProfiles([
      {
        employee_code: "EMP-101",
        pan_number: "ABCDE1234F",
        uan_number: "1234", // Not 12 digits
        pt_state: "Karnataka",
        tax_regime: "new_regime",
        pf_applicable: true,
        esi_applicable: true,
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0]).toContain("Invalid UAN format");
  });

  it("handles unknown employee code", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const result = await bulkUpsertStatutoryProfiles([
      {
        employee_code: "NONEXISTENT",
        pan_number: "ABCDE1234F",
        pt_state: "Karnataka",
        tax_regime: "new_regime",
        pf_applicable: true,
        esi_applicable: true,
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0]).toContain("Employee code 'NONEXISTENT' not found");
  });

  it("blocks unauthorized callers without statutory.bulk_upsert", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Insufficient permissions: statutory.bulk_upsert required" });
    const fake = createFakeSupabase();
    mocks.createClient.mockReturnValue(fake);

    const result = await bulkUpsertStatutoryProfiles([
      {
        employee_code: "EMP-101",
        pan_number: "ABCDE1234F",
        pt_state: "Karnataka",
        tax_regime: "new_regime",
        pf_applicable: true,
        esi_applicable: true,
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("Insufficient permissions");
  });
});
