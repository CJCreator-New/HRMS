import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  validateRequestOrigin: vi.fn(),
  assertAnyPermission: vi.fn(),
  checkLoginRateLimit: vi.fn(),
  resetLoginRateLimit: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/security", () => ({
  validateRequestOrigin: mocks.validateRequestOrigin,
  sanitizeInput: (val: string) => val,
}));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertAnyPermission: mocks.assertAnyPermission,
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkLoginRateLimit: mocks.checkLoginRateLimit,
  resetLoginRateLimit: mocks.resetLoginRateLimit,
}));
vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

import { loginAction, unlockEmployeeAccountAction } from "@/lib/actions/auth";

describe("Account Lockout & Brute-Force Protection (P1-6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_MOCK_AUTH = "false";
    mocks.validateRequestOrigin.mockResolvedValue(null);
    mocks.assertAnyPermission.mockResolvedValue(null);
    mocks.checkLoginRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
    mocks.resetLoginRateLimit.mockResolvedValue(undefined);
    mocks.cookies.mockResolvedValue({ set: vi.fn() });
  });

  it("blocks login when employee record is currently locked", async () => {
    const futureLock = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return {
            data: { id: "emp-lock-1", failed_login_attempts: 5, locked_until: futureLock },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const fd = new FormData();
    fd.append("email", "locked.user@company.com");
    fd.append("password", "SecretPassword123!");

    const res = await loginAction(fd);
    expect(res.errorCode).toBe("ACCOUNT_LOCKED");
    expect(res.status).toBe(423);
    expect(res.error).toContain("Account is temporarily locked");
  });

  it("locks account after 5 consecutive failed attempts", async () => {
    let updatePayload: any = null;
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return {
            data: { id: "emp-target-1", failed_login_attempts: 4, locked_until: null },
            error: null,
          };
        }
        if (state.table === "employees" && state.method === "update") {
          updatePayload = state.payload;
          return { data: { id: "emp-target-1" }, error: null };
        }
        return { data: null, error: null };
      },
      auth: {
        signInWithPassword: () => ({
          data: { session: null, user: null },
          error: { message: "Invalid login credentials", status: 400 },
        }),
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const fd = new FormData();
    fd.append("email", "target.user@company.com");
    fd.append("password", "WrongPassword123!");

    const res = await loginAction(fd);
    expect(res.errorCode).toBe("ACCOUNT_LOCKED");
    expect(res.status).toBe(423);
    expect(updatePayload).not.toBeNull();
    expect(updatePayload.failed_login_attempts).toBe(5);
    expect(updatePayload.locked_until).toBeDefined();
  });

  it("resets failed_login_attempts and locked_until on successful login", async () => {
    let updatePayload: any = null;
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return {
            data: { id: "emp-success-1", failed_login_attempts: 2, locked_until: null },
            error: null,
          };
        }
        if (state.table === "employees" && state.method === "update") {
          updatePayload = state.payload;
          return { data: { id: "emp-success-1" }, error: null };
        }
        return { data: null, error: null };
      },
      auth: {
        signInWithPassword: () => ({
          data: {
            session: { access_token: "mock-token", expires_in: 3600 },
            user: { id: "auth-123" },
          },
          error: null,
        }),
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const fd = new FormData();
    fd.append("email", "success.user@company.com");
    fd.append("password", "CorrectPassword123!");

    const res = await loginAction(fd);
    expect(res.success).toBe(true);
    expect(updatePayload).toEqual({ failed_login_attempts: 0, locked_until: null });
  });

  it("unlockEmployeeAccountAction resets lockout counters when called by admin", async () => {
    let updatePayload: any = null;
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "update") {
          updatePayload = state.payload;
          return { data: { id: "emp-locked-1" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await unlockEmployeeAccountAction("emp-locked-1");
    expect(res.success).toBe(true);
    expect(updatePayload).toEqual({ failed_login_attempts: 0, locked_until: null });
  });

  it("unlockEmployeeAccountAction fails if caller lacks permission", async () => {
    mocks.assertAnyPermission.mockResolvedValue({ error: "Access denied" });
    const res = await unlockEmployeeAccountAction("emp-locked-1");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Access denied");
  });
});
