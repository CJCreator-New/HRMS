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
}));
vi.mock("@/lib/actions/audit", () => ({
  writeAuditLogAction: mocks.writeAuditLogAction,
}));

import { listActiveSessionsAction, revokeSessionAction } from "@/lib/actions/sessions";

describe("Active Sessions Management Actions (P2-8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertAnyPermission.mockResolvedValue(null);
    mocks.validateRequestOrigin.mockResolvedValue(null);
    mocks.writeAuditLogAction.mockResolvedValue({ success: true });
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: "emp-sess-1",
      email: "alice@company.com",
    });
  });

  it("lists active sessions marking the most recent as current", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "user_sessions" && state.method === "select") {
          return {
            data: [
              {
                id: "sess-1",
                employee_id: "emp-sess-1",
                ip_address: "192.168.1.1",
                user_agent: "Chrome on macOS",
                device_type: "desktop",
                is_active: true,
                last_active_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              },
              {
                id: "sess-2",
                employee_id: "emp-sess-1",
                ip_address: "192.168.1.2",
                user_agent: "Safari on iOS",
                device_type: "mobile",
                is_active: true,
                last_active_at: new Date(Date.now() - 3600000).toISOString(),
                created_at: new Date(Date.now() - 3600000).toISOString(),
              },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await listActiveSessionsAction();
    expect(res.success).toBe(true);
    expect(res.sessions).toHaveLength(2);
    expect(res.sessions[0].is_current).toBe(true);
    expect(res.sessions[1].is_current).toBe(false);
  });

  it("revokes active session and logs audit trail", async () => {
    let updatePayload: any = null;
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "user_sessions" && state.method === "update") {
          updatePayload = state.payload;
          return { data: { id: "sess-2" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await revokeSessionAction("sess-2");
    expect(res.success).toBe(true);
    expect(updatePayload).toEqual({ is_active: false });
    expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.session_revoked",
        entityId: "sess-2",
      })
    );
  });
});
