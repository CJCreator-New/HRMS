import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertAnyPermission: vi.fn(),
  getAuthenticatedCaller: vi.fn(),
  validateRequestOrigin: vi.fn(),
  writeAuditLogAction: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertAnyPermission: mocks.assertAnyPermission,
  getAuthenticatedCaller: mocks.getAuthenticatedCaller,
}));
vi.mock("@/lib/security", () => ({
  validateRequestOrigin: mocks.validateRequestOrigin,
  sanitizeInput: (s: string) => s.trim(),
}));
vi.mock("@/lib/actions/audit", () => ({
  writeAuditLogAction: mocks.writeAuditLogAction,
}));

import { getProfileSelfAction, updateProfileSelfAction } from "@/lib/actions/profile";

describe("Profile Self-Service Actions (P2-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertAnyPermission.mockResolvedValue(null);
    mocks.validateRequestOrigin.mockResolvedValue(null);
    mocks.writeAuditLogAction.mockResolvedValue({ success: true });
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: "emp-test-123",
      email: "alice@company.com",
    });
  });

  it("getProfileSelfAction returns the current user profile", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return {
            data: {
              id: "emp-test-123",
              full_name: "Alice Smith",
              employee_code: "EMP-ALICE",
              email: "alice@company.com",
              phone: "+91 9876543210",
              personal_address: "123 Main St",
              emergency_contact_name: "Bob Smith",
              emergency_contact_phone: "+91 9876543211",
              date_of_joining: "2026-01-01",
              date_of_birth: "1995-05-15",
              status: "active",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await getProfileSelfAction();
    expect(res.success).toBe(true);
    expect(res.data?.fullName).toBe("Alice Smith");
    expect(res.data?.phone).toBe("+91 9876543210");
  });

  it("updateProfileSelfAction updates self-service fields and records audit log", async () => {
    let updatePayload: any = null;
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employees" && state.method === "update") {
          updatePayload = state.payload;
          return { data: { id: "emp-test-123" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const fd = new FormData();
    fd.append("phone", "+91 9999988888");
    fd.append("personalAddress", "456 Oak Avenue");
    fd.append("emergencyContactName", "Charlie Smith");
    fd.append("emergencyContactPhone", "+91 9999977777");

    const res = await updateProfileSelfAction(fd);
    expect(res.success).toBe(true);
    expect(updatePayload).toMatchObject({
      phone: "+91 9999988888",
      personal_address: "456 Oak Avenue",
      emergency_contact_name: "Charlie Smith",
      emergency_contact_phone: "+91 9999977777",
    });
    expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "profile.self_update",
        entityId: "emp-test-123",
      })
    );
  });

  it("fails if user is not authenticated", async () => {
    mocks.getAuthenticatedCaller.mockResolvedValue(null);
    const fd = new FormData();
    const res = await updateProfileSelfAction(fd);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Unauthenticated");
  });
});
