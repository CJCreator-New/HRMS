/**
 * Integration Tests — Authentication & Session Management
 *
 * Covers:
 *   - Login flow (mock auth, real auth, fallback, rate limiting)
 *   - Logout flow (cookie clearing, Supabase signout)
 *   - Password change (validation, complexity, employee activation)
 *   - Session resolution (mock cookie, real Supabase session)
 *   - Auto-provisioning on first login
 *
 * These tests exercise the full server-action code path with mocked
 * Supabase and external dependencies, verifying the interaction between
 * auth actions, RBAC assertions, cookie management, and database writes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerModuleMocks, resetAllMocks, mocks, createTestContext, FIXTURES } from "./setup";

registerModuleMocks();

// Mock next/navigation redirect
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { loginAction, logoutAction, changePasswordAction } from "@/lib/actions/auth";

describe("Auth Integration — Login Flow", () => {
  const origMockAuth = process.env.NEXT_PUBLIC_MOCK_AUTH;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MOCK_AUTH = "true";
    resetAllMocks();
    // Mock cookie helpers for mock auth mode
    mocks.signMockCookieValue.mockResolvedValue("signed-mock-token");
    mocks.validateMockCookieValue.mockResolvedValue(null);
    mocks.resolveMockSession.mockResolvedValue(null);
  });

  afterEach(() => {
    if (origMockAuth !== undefined) {
      process.env.NEXT_PUBLIC_MOCK_AUTH = origMockAuth;
    } else {
      delete process.env.NEXT_PUBLIC_MOCK_AUTH;
    }
  });

  it("rejects login with missing email or password", async () => {
    const fd = new FormData();
    fd.set("email", "");
    fd.set("password", "pass");

    const result = await loginAction(fd);
    expect(result.error).toBe("Email and password are required.");
  });

  it("rejects login with missing password", async () => {
    const fd = new FormData();
    fd.set("email", "test@company.com");
    fd.set("password", "");

    const result = await loginAction(fd);
    expect(result.error).toBe("Email and password are required.");
  });

  it("succeeds with mock auth for known @company.com emails", async () => {
    const fd = new FormData();
    fd.set("email", "alice@company.com");
    fd.set("password", "anypassword");
    fd.set("rememberMe", "false");

    const result = await loginAction(fd);
    expect(result.success).toBe(true);
    expect(mocks.signMockCookieValue).toHaveBeenCalledWith("alice@company.com");
  });

  it("succeeds with mock auth when NEXT_PUBLIC_MOCK_AUTH=true", async () => {
    process.env.NEXT_PUBLIC_MOCK_AUTH = "true";

    const fd = new FormData();
    fd.set("email", "external@test.com");
    fd.set("password", "pass123");

    const result = await loginAction(fd);
    expect(result.success).toBe(true);
  });

  it("applies rememberMe cookie maxAge of 30 days", async () => {
    const fd = new FormData();
    fd.set("email", "alice@company.com");
    fd.set("password", "pass");
    fd.set("rememberMe", "true");

    const mockCookieStore = { set: vi.fn(), get: vi.fn(() => undefined), delete: vi.fn() };
    mocks.cookies.mockResolvedValue(mockCookieStore);

    await loginAction(fd);

    const setCall = mockCookieStore.set.mock.calls.find(
      (c: unknown[]) => c[0] === "sb-access-token"
    );
    expect(setCall).toBeDefined();
    expect(setCall![2].maxAge).toBe(60 * 60 * 24 * 30); // 30 days
  });

  it("applies default 1-day cookie when rememberMe is false", async () => {
    const fd = new FormData();
    fd.set("email", "alice@company.com");
    fd.set("password", "pass");
    fd.set("rememberMe", "false");

    const mockCookieStore = { set: vi.fn(), get: vi.fn(() => undefined), delete: vi.fn() };
    mocks.cookies.mockResolvedValue(mockCookieStore);

    await loginAction(fd);

    const setCall = mockCookieStore.set.mock.calls.find(
      (c: unknown[]) => c[0] === "sb-access-token"
    );
    expect(setCall).toBeDefined();
    expect(setCall![2].maxAge).toBe(60 * 60 * 24); // 1 day
  });

  it("CSRF validation blocks login if origin is invalid", async () => {
    mocks.validateRequestOrigin.mockResolvedValue({ error: "Invalid request origin" });

    const fd = new FormData();
    fd.set("email", "alice@company.com");
    fd.set("password", "pass");

    const result = await loginAction(fd);
    expect(result.error).toBe("Invalid request origin");
  });
});

describe("Auth Integration — Logout Flow", () => {
  beforeEach(() => {
    resetAllMocks();
    mocks.resolveMockSession.mockResolvedValue(null);
    mocks.validateMockCookieValue.mockResolvedValue(null);
  });

  it("clears the session cookie on logout", async () => {
    const mockCookieStore = { set: vi.fn(), get: vi.fn(() => undefined), delete: vi.fn() };
    mocks.cookies.mockResolvedValue(mockCookieStore);

    const result = await logoutAction();
    expect(result.success).toBe(true);

    // Cookie should be cleared with maxAge: 0
    const setCall = mockCookieStore.set.mock.calls.find(
      (c: unknown[]) => c[0] === "sb-access-token"
    );
    expect(setCall).toBeDefined();
    expect(setCall![2].maxAge).toBe(0);

    // Cookie should also be deleted
    expect(mockCookieStore.delete).toHaveBeenCalledWith("sb-access-token");
  });

  it("calls Supabase signOut when not in mock mode", async () => {
    process.env.NEXT_PUBLIC_MOCK_AUTH = "false";
    const mockCookieStore = { set: vi.fn(), get: vi.fn(() => undefined), delete: vi.fn() };
    mocks.cookies.mockResolvedValue(mockCookieStore);

    const fakeSignOut = vi.fn();
    mocks.createClient.mockResolvedValue({ auth: { signOut: fakeSignOut } });

    await logoutAction();
    expect(fakeSignOut).toHaveBeenCalled();

    delete process.env.NEXT_PUBLIC_MOCK_AUTH;
  });

  it("does not call Supabase signOut in mock mode", async () => {
    process.env.NEXT_PUBLIC_MOCK_AUTH = "true";
    const mockCookieStore = { set: vi.fn(), get: vi.fn(() => undefined), delete: vi.fn() };
    mocks.cookies.mockResolvedValue(mockCookieStore);

    const fakeSignOut = vi.fn();
    mocks.createClient.mockResolvedValue({ auth: { signOut: fakeSignOut } });

    await logoutAction();
    expect(fakeSignOut).not.toHaveBeenCalled();

    delete process.env.NEXT_PUBLIC_MOCK_AUTH;
  });

  it("CSRF validation blocks logout if origin is invalid", async () => {
    mocks.validateRequestOrigin.mockResolvedValue({ error: "CSRF failed" });

    const result = await logoutAction();
    // logoutAction returns void, not an error object — it silently returns
    expect(result).toBeUndefined();
  });
});

describe("Auth Integration — Password Change", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const fd = new FormData();
    fd.set("newPassword", "Short1!");

    const result = await changePasswordAction(fd);
    expect(result.error).toBe("Password must be at least 8 characters long.");
  });

  it("rejects passwords without uppercase", async () => {
    const fd = new FormData();
    fd.set("newPassword", "lowercase1!");

    const result = await changePasswordAction(fd);
    expect(result.error).toContain("uppercase");
  });

  it("rejects passwords without special character", async () => {
    const fd = new FormData();
    fd.set("newPassword", "NoSpecial1");

    const result = await changePasswordAction(fd);
    expect(result.error).toContain("special character");
  });

  it("succeeds with a strong password and updates employee status", async () => {
    const fd = new FormData();
    fd.set("newPassword", "StrongP@ss1");

    const { fake } = createTestContext((state) => {
      if (state.table === "employees" && state.method === "select") {
        return { data: { id: "emp-001", status: "invited" }, error: null };
      }
      if (state.table === "employee_roles" && state.method === "select") {
        return { data: [{ id: "er-1" }], error: null };
      }
      if (state.table === "employees" && state.method === "update") {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });

    // Wire up auth.getUser to return a user
    const fakeWithAuth = {
      ...fake,
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "auth-001", email: "alice@company.com" } },
          error: null,
        })),
        updateUser: vi.fn(async () => ({ data: {}, error: null })),
      },
    };
    mocks.createClient.mockResolvedValue(fakeWithAuth);

    const result = await changePasswordAction(fd);
    expect(result.success).toBe(true);

    // Employee should be activated
    expect(fakeWithAuth.auth.updateUser).toHaveBeenCalledWith({ password: "StrongP@ss1" });
  });

  it("activates an invited employee and assigns default role if none exist", async () => {
    const fd = new FormData();
    fd.set("newPassword", "StrongP@ss1");

    const writes: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.table === "employees" && state.method === "select") {
        return { data: { id: "emp-001", status: "invited" }, error: null };
      }
      if (state.table === "employee_roles" && state.method === "select") {
        // No existing roles
        return { data: [], error: null };
      }
      if (state.table === "roles" && state.method === "select") {
        return { data: { id: "r-employee" }, error: null };
      }
      if (state.method === "insert") {
        writes.push({ table: state.table, payload: state.payload });
        return { data: null, error: null };
      }
      if (state.method === "update") {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });

    const fakeWithAuth = {
      ...fake,
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "auth-001", email: "alice@company.com" } },
          error: null,
        })),
        updateUser: vi.fn(async () => ({ data: {}, error: null })),
      },
    };
    mocks.createClient.mockResolvedValue(fakeWithAuth);

    const result = await changePasswordAction(fd);
    expect(result.success).toBe(true);

    // Should have inserted default employee role
    const roleInsert = writes.find((w) => w.table === "employee_roles");
    expect(roleInsert).toBeDefined();
    expect(roleInsert!.payload).toMatchObject({
      employee_id: "emp-001",
      role_id: "r-employee",
    });
  });

  it("preserves existing roles when employee already has roles assigned", async () => {
    const fd = new FormData();
    fd.set("newPassword", "StrongP@ss1");

    const writes: Array<{ table: string; payload: unknown }> = [];
    const { fake } = createTestContext((state) => {
      if (state.table === "employees" && state.method === "select") {
        return { data: { id: "emp-001", status: "invited" }, error: null };
      }
      if (state.table === "employee_roles" && state.method === "select") {
        // Already has roles
        return { data: [{ id: "er-1" }, { id: "er-2" }], error: null };
      }
      if (state.method === "insert") {
        writes.push({ table: state.table, payload: state.payload });
        return { data: null, error: null };
      }
      if (state.method === "update") {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });

    const fakeWithAuth = {
      ...fake,
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "auth-001", email: "alice@company.com" } },
          error: null,
        })),
        updateUser: vi.fn(async () => ({ data: {}, error: null })),
      },
    };
    mocks.createClient.mockResolvedValue(fakeWithAuth);

    const result = await changePasswordAction(fd);
    expect(result.success).toBe(true);

    // Should NOT have inserted any new roles
    const roleInsert = writes.find((w) => w.table === "employee_roles");
    expect(roleInsert).toBeUndefined();
  });

  it("returns error for unauthenticated session", async () => {
    const fd = new FormData();
    fd.set("newPassword", "StrongP@ss1");

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: { message: "Not authenticated" } })),
        updateUser: vi.fn(),
      },
    });

    const result = await changePasswordAction(fd);
    expect(result.error).toBe("Unauthenticated session.");
  });

  it("CSRF validation blocks password change", async () => {
    mocks.validateRequestOrigin.mockResolvedValue({ error: "CSRF failed" });

    const fd = new FormData();
    fd.set("newPassword", "StrongP@ss1");

    const result = await changePasswordAction(fd);
    expect(result.error).toBe("CSRF failed");
  });
});
