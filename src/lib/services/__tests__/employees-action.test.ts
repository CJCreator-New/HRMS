import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  assertPermission: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: vi.fn(async () => null),
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import {
  createEmployeeAction,
  getEmployeesAction,
  importEmployeesCsvAction,
  toggleEmployeeDeactivationAction,
  updateEmployeeAssignmentAction,
} from "@/lib/actions/employees";

describe("createEmployeeAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.createAdminClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  function buildFakes(overrides: { settingsConfigured?: boolean; createUserError?: boolean } = {}) {
    const adminFake = {
      from: createFakeSupabase({
        respond: (state) => {
          if (state.table === "company_settings" && state.method === "select") {
            return { data: { is_configured: overrides.settingsConfigured ?? true }, error: null };
          }
          return { data: null, error: null };
        },
      }).from,
      auth: {
        admin: {
          createUser: vi.fn(async () =>
            overrides.createUserError
              ? { data: null, error: { message: "email taken" } }
              : { data: { user: { id: "auth-new" } }, error: null }
          ),
        },
      },
    };
    mocks.createAdminClient.mockReturnValue(adminFake as any);

    const writes: Array<{ table: string; payload: any }> = [];
    const client = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "insert") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: { id: "emp-new", ...(state.payload as object) }, error: null };
        }
        if (state.table === "roles" && state.method === "select") {
          const allRoles = [
            { id: "r-employee", code: "employee" },
            { id: "r-manager", code: "manager" },
          ];
          const inFilter = state.filters.find((f) => f.op === "in" && f.col === "code");
          const codes = (inFilter?.val as string[]) || [];
          return { data: allRoles.filter((r) => codes.includes(r.code)), error: null };
        }
        if (state.table === "employee_roles" && state.method === "insert") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(client);
    return { writes };
  }

  function form(overrides: Record<string, string> = {}) {
    const fd = new FormData();
    fd.set("employeeCode", "E1001");
    fd.set("fullName", "Alice Doe");
    fd.set("email", "alice@company.com");
    fd.set("tempPassword", "Password123!");
    fd.set("dateOfJoining", "2026-08-01");
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("creates the auth user, employee and default role", async () => {
    const { writes } = buildFakes();

    const res: any = await createEmployeeAction(form());
    expect(res.success).toBe(true);

    const empWrite = writes.find((w) => w.table === "employees");
    expect(empWrite?.payload).toMatchObject({
      employee_code: "E1001",
      full_name: "Alice Doe",
      email: "alice@company.com",
      auth_user_id: "auth-new",
      status: "invited",
      must_change_password: true,
    });
    // default role = employee only
    const roleWrite = writes.find((w) => w.table === "employee_roles");
    expect(roleWrite?.payload).toEqual([{ employee_id: "emp-new", role_id: "r-employee" }]);
  });

  it("applies explicit roles from the roles form field", async () => {
    const { writes } = buildFakes();

    const res: any = await createEmployeeAction(form({ roles: '["manager"]' }));
    expect(res.success).toBe(true);
    const roleWrite = writes.find((w) => w.table === "employee_roles");
    expect(roleWrite?.payload).toEqual([{ employee_id: "emp-new", role_id: "r-manager" }]);
  });

  it("falls back to first/last name when fullName is absent", async () => {
    const { writes } = buildFakes();

    const fd = form();
    fd.delete("fullName");
    fd.set("firstName", "Bob");
    fd.set("lastName", "Smith");
    const res: any = await createEmployeeAction(fd);
    expect(res.success).toBe(true);
    expect(writes.find((w) => w.table === "employees")?.payload.full_name).toBe("Bob Smith");
  });

  it("rejects missing required fields", async () => {
    const { writes } = buildFakes();
    const fd = new FormData();
    const res = await createEmployeeAction(fd);
    expect(res).toEqual({ error: "Missing required onboarding fields (code, name, email, password)." });
    expect(writes).toHaveLength(0);
  });

  it("blocks onboarding until the company is configured", async () => {
    buildFakes({ settingsConfigured: false });
    const res = await createEmployeeAction(form());
    expect(res).toEqual({
      error: "System configuration required: Complete company configuration in Settings before onboarding employees.",
    });
  });

  it("surfaces auth user creation failures", async () => {
    buildFakes({ createUserError: true });
    const res = await createEmployeeAction(form());
    expect(res).toEqual({ error: "Auth User Creation Failed: email taken" });
  });

  it("blocks users without employee.create", async () => {
    mocks.assertPermission.mockResolvedValue({ error: "Insufficient permissions: employee.create required" });
    buildFakes();
    const res = await createEmployeeAction(form());
    expect(res).toEqual({ error: "Insufficient permissions: employee.create required" });
  });
});

describe("importEmployeesCsvAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("imports valid rows and skips invalid ones", async () => {
    const writes: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "insert") {
          if ((state.payload as any).employee_code === "FAIL") {
            return { data: null, error: { message: "duplicate code" } };
          }
          writes.push({ payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await importEmployeesCsvAction([
      { code: "E1", name: "A", email: "a@x.com" },
      { code: "E2", name: "B", email: "b@x.com", doj: "2026-01-01" },
      { code: "", name: "NoCode", email: "c@x.com" },
      { code: "FAIL", name: "Dup", email: "d@x.com" },
    ]);

    expect(res).toMatchObject({ success: true, imported: 2, skipped: 2 });
    expect(res.errors).toHaveLength(2);
    expect(writes).toHaveLength(2);
    expect(writes[1].payload).toMatchObject({
      employee_code: "E2",
      date_of_joining: "2026-01-01",
      status: "invited",
    });
  });
});

describe("toggleEmployeeDeactivationAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("updates the deactivation flag", async () => {
    const updates: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "update") {
          updates.push({ payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await toggleEmployeeDeactivationAction("emp-1", true);
    expect(res.success).toBe(true);
    expect(updates[0].payload).toMatchObject({ is_deactivated: true });
  });
});

describe("updateEmployeeAssignmentAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("inserts assignments only for the provided fields", async () => {
    const writes: Array<{ table: string; payload: any }> = [];
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.method === "insert") {
          writes.push({ table: state.table, payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await updateEmployeeAssignmentAction("emp-1", "dept-1", undefined, "Engineer");
    expect(res.success).toBe(true);
    expect(writes.map((w) => w.table).sort()).toEqual([
      "employee_department_assignment",
      "employee_designation_assignment",
    ]);
    expect(writes.find((w) => w.table === "employee_department_assignment")?.payload).toMatchObject({
      employee_id: "emp-1",
      department_id: "dept-1",
    });
  });
});
