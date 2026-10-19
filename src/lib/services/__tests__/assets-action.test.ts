import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
  getAuthenticatedCaller: vi.fn(),
  validateRequestOrigin: vi.fn(),
  writeAuditLogAction: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  getAuthenticatedCaller: mocks.getAuthenticatedCaller,
}));
vi.mock("@/lib/security", () => ({
  validateRequestOrigin: mocks.validateRequestOrigin,
}));
vi.mock("@/lib/actions/audit", () => ({
  writeAuditLogAction: mocks.writeAuditLogAction,
}));

import {
  listAssetsAction,
  listEmployeeAssetsAction,
  allocateAssetAction,
  returnAssetAction,
  getUnreturnedAssetsCountAction,
} from "@/lib/actions/assets";

describe("Asset Management & Separation Clearance Actions (GAP-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertPermission.mockResolvedValue(null);
    mocks.validateRequestOrigin.mockResolvedValue(null);
    mocks.writeAuditLogAction.mockResolvedValue({ success: true });
    mocks.getAuthenticatedCaller.mockResolvedValue({
      employeeId: "emp-1",
      roles: ["it_admin"],
    });
  });

  it("lists all company assets for authorized admin", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "company_assets") {
          return {
            data: [
              { id: "asset-1", asset_tag: "AST-001", name: "MacBook Pro", status: "available", cost: 150000 },
              { id: "asset-2", asset_tag: "AST-002", name: "Dell 27-inch", status: "allocated", cost: 25000 },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockResolvedValue(fake);

    const result = await listAssetsAction();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data?.[0].asset_tag).toBe("AST-001");
  });

  it("allocates an available asset to an employee and updates status", async () => {
    let assetStatus = "available";
    let insertedAssignment: Record<string, unknown> | null = null;

    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "company_assets" && state.method === "select") {
          return {
            data: { id: "asset-1", status: assetStatus, asset_tag: "AST-001" },
            error: null,
          };
        }
        if (state.table === "employee_asset_assignments" && state.method === "insert") {
          insertedAssignment = { id: "assign-1", ...state.filters };
          return { data: { id: "assign-1" }, error: null };
        }
        if (state.table === "company_assets" && state.method === "update") {
          assetStatus = "allocated";
          return { data: { id: "asset-1" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockResolvedValue(fake);

    const result = await allocateAssetAction("emp-2", "asset-1");
    expect(result.success).toBe(true);
    expect(result.data?.assignmentId).toBe("assign-1");
    expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "allocate_asset", entityId: "asset-1" })
    );
  });

  it("prevents allocation if asset is already allocated", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "company_assets") {
          return {
            data: { id: "asset-1", status: "allocated", asset_tag: "AST-001" },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockResolvedValue(fake);

    const result = await allocateAssetAction("emp-2", "asset-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("is not available");
  });

  it("returns an assigned asset and sets it back to available", async () => {
    let assetStatus = "allocated";
    let returnedAt: string | null = null;

    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employee_asset_assignments" && state.method === "select") {
          return {
            data: { id: "assign-1", asset_id: "asset-1", employee_id: "emp-2", returned_at: returnedAt },
            error: null,
          };
        }
        if (state.table === "employee_asset_assignments" && state.method === "update") {
          returnedAt = new Date().toISOString();
          return { data: { id: "assign-1" }, error: null };
        }
        if (state.table === "company_assets" && state.method === "update") {
          assetStatus = "available";
          return { data: { id: "asset-1" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockResolvedValue(fake);

    const result = await returnAssetAction("assign-1", "Good working condition");
    expect(result.success).toBe(true);
    expect(mocks.writeAuditLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "return_asset", entityId: "asset-1" })
    );
  });

  it("returns unreturned asset count for separation clearance", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "employee_asset_assignments") {
          return { data: 2, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockResolvedValue(fake);

    const result = await getUnreturnedAssetsCountAction("emp-2");
    expect(result.success).toBe(true);
    expect(result.data?.count).toBe(2);
  });
});
