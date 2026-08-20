import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Enable mock mode for all auth tests
process.env.NEXT_PUBLIC_MOCK_AUTH = "true";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  cookies: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkLoginRateLimit: vi.fn(async () => ({ allowed: true })),
  resetLoginRateLimit: vi.fn(async () => {}),
}));
// Mock the cookie signing/validation — tests use plain emails as cookie values,
// so validateMockCookieValue extracts the email from the signed format.
vi.mock("@/lib/auth/mock-cookie", () => ({
  signMockCookieValue: vi.fn(async (email: string) => `${email}:dummysig:${Date.now() + 86400000}`),
  validateMockCookieValue: vi.fn(async (val: string) => {
    // Extract the email from "email:signature:expiry" format, or return as-is
    const parts = val.split(":");
    if (parts.length === 3 && parts[0].includes("@")) return parts[0];
    if (val.includes("@")) return val;
    return null;
  }),
}));

import { createFakeSupabase, type FakeSupabase } from "./helpers/fake-supabase";
import {
  loginAction,
  logoutAction,
  changePasswordAction,
  getCurrentUserRolesAction,
} from "@/lib/actions/auth";

function withAuthExtras(fake: FakeSupabase): any {
  const f = fake as any;
  f.auth.signInWithPassword = vi.fn(async () => ({ data: { user: { id: "u1" } }, error: null }));
  f.auth.updateUser = vi.fn(async () => ({ data: null, error: null }));
  f.auth.signOut = vi.fn(async () => null);
  return f;
}

describe("loginAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.cookies.mockReset();
    mocks.cookies.mockResolvedValue({
      get: vi.fn(() => undefined),
      set: vi.fn(),
    });
  });

  it("requires both email and password", async () => {
    const fd = new FormData();
    fd.set("email", "a@b.com");
    await expect(loginAction(fd)).resolves.toEqual({
      error: "Email and password are required.",
    });
  });

  it("rejects explicitly invalid credentials", async () => {
    const fd = new FormData();
    fd.set("email", "invalid@x.com");
    fd.set("password", "WrongPass");
    await expect(loginAction(fd)).resolves.toEqual({
      error: "Invalid login credentials",
    });
  });

  it("sets the mock token cookie and signs in", async () => {
    const cookieStore = { get: vi.fn(() => undefined), set: vi.fn() };
    mocks.cookies.mockResolvedValue(cookieStore);
    const fake = withAuthExtras(createFakeSupabase());
    mocks.createClient.mockReturnValue(fake);

    const fd = new FormData();
    fd.set("email", "hradmin@company.com");
    fd.set("password", "Password123!");
    await expect(loginAction(fd)).resolves.toEqual({ success: true });
    expect(cookieStore.set).toHaveBeenCalledWith(
      "sb-access-token",
      expect.stringContaining("hradmin@company.com"),
      expect.any(Object)
    );
  });
});

describe("logoutAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.redirect.mockReset();
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("signs out and redirects to login", async () => {
    const fake = withAuthExtras(createFakeSupabase());
    mocks.createClient.mockReturnValue(fake);

    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT");
    expect(fake.auth.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});

describe("changePasswordAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const fd = new FormData();
    fd.set("newPassword", "short");
    await expect(changePasswordAction(fd)).resolves.toEqual({
      error: "Password must be at least 8 characters long.",
    });
  });

  it("updates the password and activates the employee", async () => {
    const updates: Array<{ payload: any }> = [];
    const fake: any = withAuthExtras(createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "update") {
          updates.push({ payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    }));
    mocks.createClient.mockReturnValue(fake);

    const fd = new FormData();
    fd.set("newPassword", "NewPassword123!");
    await expect(changePasswordAction(fd)).resolves.toEqual({ success: true });
    expect(fake.auth.updateUser).toHaveBeenCalledWith({ password: "NewPassword123!" });
    expect(updates[0].payload).toMatchObject({
      must_change_password: false,
      status: "active",
    });
  });

  it("preserves pre-assigned roles when activating an invited employee", async () => {
    const roleInserts: any[] = [];
    const updates: Array<{ payload: any }> = [];

    const fake: any = withAuthExtras(createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-1", status: "invited" }, error: null };
        }
        if (state.table === "employee_roles" && state.method === "select") {
          return {
            data: [
              { id: "er-1", role_id: "role-mgr" },
              { id: "er-2", role_id: "role-hr" },
            ],
            error: null,
          };
        }
        if (state.table === "employee_roles" && state.method === "insert") {
          roleInserts.push(state.payload);
          return { data: null, error: null };
        }
        if (state.table === "employees" && state.method === "update") {
          updates.push({ payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    }));
    mocks.createClient.mockReturnValue(fake);

    const fd = new FormData();
    fd.set("newPassword", "NewPassword123!");
    await expect(changePasswordAction(fd)).resolves.toEqual({ success: true });
    expect(fake.auth.updateUser).toHaveBeenCalledWith({ password: "NewPassword123!" });
    // Should NOT insert default role because pre-assigned roles exist
    expect(roleInserts.length).toBe(0);
    expect(updates[0].payload).toMatchObject({
      must_change_password: false,
      status: "active",
    });
  });

  it("assigns default employee role only if no pre-assigned roles exist", async () => {
    const roleInserts: any[] = [];
    const updates: Array<{ payload: any }> = [];

    const fake: any = withAuthExtras(createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-2", status: "invited" }, error: null };
        }
        if (state.table === "employee_roles" && state.method === "select") {
          return { data: [], error: null };
        }
        if (state.table === "roles" && state.method === "select") {
          return { data: { id: "role-emp", code: "employee" }, error: null };
        }
        if (state.table === "employee_roles" && state.method === "insert") {
          roleInserts.push(state.payload);
          return { data: null, error: null };
        }
        if (state.table === "employees" && state.method === "update") {
          updates.push({ payload: state.payload });
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    }));
    mocks.createClient.mockReturnValue(fake);

    const fd = new FormData();
    fd.set("newPassword", "NewPassword123!");
    await expect(changePasswordAction(fd)).resolves.toEqual({ success: true });
    expect(roleInserts.length).toBe(1);
    expect(roleInserts[0]).toEqual({
      employee_id: "emp-2",
      role_id: "role-emp",
    });
  });

  it("returns an error for an unauthenticated session", async () => {
    const fake = createFakeSupabase({ user: null });
    withAuthExtras(fake);
    mocks.createClient.mockReturnValue(fake);

    const fd = new FormData();
    fd.set("newPassword", "NewPassword123!");
    await expect(changePasswordAction(fd)).resolves.toEqual({
      error: "Unauthenticated session.",
    });
  });
});

describe("getCurrentUserRolesAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.cookies.mockReset();
  });

  it("resolves mock-mode roles from the token cookie", async () => {
    mocks.cookies.mockResolvedValue({
      get: vi.fn(() => ({ value: "multi.hrmgr@company.com" })),
      set: vi.fn(),
    });
    const fake = createFakeSupabase({ user: null });
    mocks.createClient.mockReturnValue(fake);

    await expect(getCurrentUserRolesAction()).resolves.toEqual({
      roles: ["hr", "manager"],
      mustChangePassword: false,
      userName: "multi.hrmgr",
      employeeId: "00000000-0000-0000-0000-000000000110",
    });
  });

  it("falls back to the default employee roles without a mock token", async () => {
    mocks.cookies.mockResolvedValue({ get: vi.fn(() => undefined), set: vi.fn() });
    const fake = createFakeSupabase({ user: null });
    mocks.createClient.mockReturnValue(fake);

    await expect(getCurrentUserRolesAction()).resolves.toEqual({
      roles: ["employee"],
      mustChangePassword: false,
      userName: "Employee",
      employeeId: null,
    });
  });

  it("resolves real roles and the password-change flag from the database", async () => {
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-1", must_change_password: true }, error: null };
        }
        if (state.table === "employee_roles" && state.method === "select") {
          return {
            data: [
              { roles: { code: "employee" } },
              { roles: { code: "manager" } },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(getCurrentUserRolesAction()).resolves.toEqual({
      roles: ["employee", "manager"],
      mustChangePassword: true,
      userName: "Employee",
      employeeId: "emp-1",
    });
  });
});
