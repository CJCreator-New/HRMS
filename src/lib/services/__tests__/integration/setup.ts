/**
 * Shared setup for integration tests.
 *
 * Provides reusable mock factories that simulate the full server-action
 * dependency tree: Supabase client, admin client, RBAC assertions,
 * rate limiting, CSRF validation, and external service calls.
 *
 * Each factory returns a context object with pre-wired mocks and helper
 * functions for asserting database writes, permission checks, and
 * notification dispatches.
 */

import { vi, beforeEach } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "../helpers/fake-supabase";

// ── Centralized mock registry ──────────────────────────────────────
// Note: vi.hoisted cannot be exported, so we define mocks as a plain object
// and register module mocks via registerModuleMocks().

export const mocks = {
  // Supabase
  createClient: vi.fn(),
  createAdminClient: vi.fn(),

  // Auth & RBAC
  assertPermission: vi.fn(),
  assertAnyPermission: vi.fn(),
  assertCallerIdentity: vi.fn(),
  getAuthenticatedCaller: vi.fn(),

  // Services
  resolveLeaveApprover: vi.fn(),
  computeCompOffExpiryDate: vi.fn(),
  filterPayrollEligibleEmployees: vi.fn(),
  resolveMonthlyCtc: vi.fn(),
  computeEmployeePayrollRun: vi.fn(),
  computeLastWorkingDay: vi.fn(),
  resolveFfApprovalOutcome: vi.fn(),

  // Actions
  createNotificationAction: vi.fn(),
  writeAuditLogAction: vi.fn(),

  // Security
  validateRequestOrigin: vi.fn(),
  checkActionRateLimit: vi.fn(),
  checkLoginRateLimit: vi.fn(),
  resetLoginRateLimit: vi.fn(),
  assertIdempotencyKey: vi.fn(),
  sanitizeInput: vi.fn((s: string) => s),

  // Cookies
  cookies: vi.fn(),
  signMockCookieValue: vi.fn(),
  validateMockCookieValue: vi.fn(),
  resolveMockSession: vi.fn(),
};

// ── Module mocks (declared at module top level for Vitest compatibility) ─────

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: mocks.assertAnyPermission,
  assertCallerIdentity: mocks.assertCallerIdentity,
  getAuthenticatedCaller: mocks.getAuthenticatedCaller,
}));
vi.mock("@/lib/services/leave-routing", () => ({
  resolveLeaveApprover: mocks.resolveLeaveApprover,
}));
vi.mock("@/lib/services/leave-engine", () => ({
  computeCompOffExpiryDate: mocks.computeCompOffExpiryDate,
}));
vi.mock("@/lib/services/payroll-engine", () => ({
  filterPayrollEligibleEmployees: mocks.filterPayrollEligibleEmployees,
  resolveMonthlyCtc: mocks.resolveMonthlyCtc,
  computeEmployeePayrollRun: mocks.computeEmployeePayrollRun,
}));
vi.mock("@/lib/services/offboarding-engine", () => ({
  computeLastWorkingDay: mocks.computeLastWorkingDay,
  resolveFfApprovalOutcome: mocks.resolveFfApprovalOutcome,
}));
vi.mock("@/lib/actions/notifications", () => ({
  createNotificationAction: mocks.createNotificationAction,
}));
vi.mock("@/lib/actions/audit", () => ({
  writeAuditLogAction: mocks.writeAuditLogAction,
}));
vi.mock("@/lib/security", () => ({
  validateRequestOrigin: mocks.validateRequestOrigin,
  sanitizeInput: mocks.sanitizeInput,
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkActionRateLimit: mocks.checkActionRateLimit,
  checkLoginRateLimit: mocks.checkLoginRateLimit,
  resetLoginRateLimit: mocks.resetLoginRateLimit,
}));
vi.mock("@/lib/services/idempotency", () => ({
  assertIdempotencyKey: mocks.assertIdempotencyKey,
}));
vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));
vi.mock("@/lib/auth/mock-cookie", () => ({
  signMockCookieValue: mocks.signMockCookieValue,
  validateMockCookieValue: mocks.validateMockCookieValue,
  resolveMockSession: mocks.resolveMockSession,
}));

/**
 * Retained for backwards-compatibility with test suites importing registerModuleMocks.
 * Mocks are now hoisted at the module top level.
 */
export function registerModuleMocks() {}

// ── Default mock behaviors ─────────────────────────────────────────

export function resetAllMocks() {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockReset" in m) {
      m.mockReset();
    }
  });

  // Default: permissions pass, rate limits pass, CSRF passes, idempotency passes
  mocks.assertPermission.mockResolvedValue(null);
  mocks.assertAnyPermission.mockResolvedValue(null);
  mocks.assertCallerIdentity.mockResolvedValue(null);
  mocks.getAuthenticatedCaller.mockResolvedValue(null);
  mocks.validateRequestOrigin.mockResolvedValue(null);
  mocks.checkActionRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  mocks.checkLoginRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  mocks.resetLoginRateLimit.mockResolvedValue(undefined);
  mocks.assertIdempotencyKey.mockResolvedValue({ isDuplicate: false, error: undefined });
  mocks.createNotificationAction.mockResolvedValue({ success: true });
  mocks.writeAuditLogAction.mockResolvedValue({ success: true });
  mocks.sanitizeInput.mockImplementation((s: string) => s);

  // Default: no mock session (falls through to Supabase)
  mocks.resolveMockSession.mockResolvedValue(null);
  mocks.validateMockCookieValue.mockResolvedValue(null);
  mocks.cookies.mockResolvedValue({
    get: vi.fn(() => undefined),
    set: vi.fn(),
    delete: vi.fn(),
  });
}

// ── Context builders ───────────────────────────────────────────────

export interface WriteRecord {
  table: string;
  payload: unknown;
}

export interface TestContext {
  fake: FakeSupabase;
  writes: WriteRecord[];
  updates: WriteRecord[];
  deletes: WriteRecord[];
}

/**
 * Creates a FakeSupabase instance that records all writes (insert/update/upsert/delete)
 * into the returned context for assertion.
 */
export function createTestContext(
  respond?: (state: import("../helpers/fake-supabase").QueryState) => { data?: unknown; error?: unknown; count?: number }
): TestContext {
  const writes: WriteRecord[] = [];
  const updates: WriteRecord[] = [];
  const deletes: WriteRecord[] = [];

  const defaultRespond = (state: import("../helpers/fake-supabase").QueryState) => {
    if (state.method === "insert") {
      writes.push({ table: state.table, payload: state.payload });
      return { data: { id: "generated-id", ...(state.payload as object) }, error: null };
    }
    if (state.method === "update") {
      updates.push({ table: state.table, payload: state.payload });
      return { data: { id: "updated-id", ...(state.payload as object) }, error: null };
    }
    if (state.method === "upsert") {
      writes.push({ table: state.table, payload: state.payload });
      return { data: { id: "upserted-id", ...(state.payload as object) }, error: null };
    }
    if (state.method === "delete") {
      deletes.push({ table: state.table, payload: state.filters });
      return { data: null, error: null };
    }
    return { data: null, error: null };
  };

  const fake = createFakeSupabase({ respond: respond ?? defaultRespond });
  return { fake, writes, updates, deletes };
}

// ── Fixture data ───────────────────────────────────────────────────

export const FIXTURES = {
  employee: {
    id: "emp-001",
    auth_user_id: "auth-001",
    employee_code: "E1001",
    full_name: "Alice Doe",
    email: "alice@company.com",
    status: "active",
    date_of_joining: "2026-01-15",
  },
  manager: {
    id: "mgr-001",
    auth_user_id: "auth-mgr-001",
    employee_code: "M1001",
    full_name: "Bob Manager",
    email: "bob@company.com",
    status: "active",
  },
  hrAdmin: {
    id: "hr-001",
    auth_user_id: "auth-hr-001",
    employee_code: "HR1001",
    full_name: "Carol HR",
    email: "carol@company.com",
    status: "active",
  },
  payrollAdmin: {
    id: "pay-001",
    auth_user_id: "auth-pay-001",
    employee_code: "PAY1001",
    full_name: "Dave Payroll",
    email: "dave@company.com",
    status: "active",
  },
  systemAdmin: {
    id: "sys-001",
    auth_user_id: "auth-sys-001",
    employee_code: "SYS1001",
    full_name: "Eve System",
    email: "eve@company.com",
    status: "active",
  },
  roles: {
    employee: { id: "r-employee", code: "employee" },
    manager: { id: "r-manager", code: "manager" },
    hr: { id: "r-hr", code: "hr" },
    payroll_admin: { id: "r-payroll_admin", code: "payroll_admin" },
    system_admin: { id: "r-system_admin", code: "system_admin" },
  },
  leaveType: {
    id: "lt-cl",
    code: "CL",
    name: "Casual Leave",
    annual_allocation: 12,
    allow_negative_balance: false,
  },
  salaryStructure: {
    id: "ss-001",
    employee_id: "emp-001",
    monthly_ctc: 75000,
    annual_ctc: 900000,
    is_open: true,
  },
  payrollPeriod: {
    id: "pp-2026-08",
    year: 2026,
    month: 8,
    start_date: "2026-08-01",
    end_date: "2026-08-31",
    cutoff_date: "2026-08-31",
    status: "draft",
  },
  separation: {
    id: "sep-001",
    employee_id: "emp-001",
    separation_type: "resignation",
    initiated_by: "emp-001",
    separation_date: "2026-08-01",
    notice_period_days: 30,
    last_working_day: "2026-08-31",
    status: "active",
  },
} as const;
