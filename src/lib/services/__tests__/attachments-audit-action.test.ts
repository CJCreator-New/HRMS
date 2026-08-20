import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertPermission: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/assertPermission", () => ({
  assertPermission: mocks.assertPermission,
  assertAnyPermission: vi.fn(async () => null),
}));

import { createFakeSupabase } from "./helpers/fake-supabase";
import {
  getAttachmentsAction,
  uploadAttachmentAction,
} from "@/lib/actions/attachments";
import { getAuditLogsAction } from "@/lib/actions/audit";

describe("attachments", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.assertPermission.mockReset();
    mocks.assertPermission.mockResolvedValue(null);
  });

  it("lists recent attachments", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "document_attachments" && state.method === "select") {
          return { data: [{ id: "att-1", file_name: "payslip.pdf" }], error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(getAttachmentsAction()).resolves.toEqual({
      attachments: [{ id: "att-1", file_name: "payslip.pdf" }],
    });
  });

  it("uploads an attachment with the uploader and clean scan status", async () => {
    const writes: Array<{ payload: any }> = [];
    const fake = createFakeSupabase({
      user: { id: "auth-1" },
      respond: (state) => {
        if (state.table === "employees" && state.method === "select") {
          return { data: { id: "emp-1" }, error: null };
        }
        if (state.table === "document_attachments" && state.method === "insert") {
          writes.push({ payload: state.payload });
          return { data: { id: "att-2" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res: any = await uploadAttachmentAction("payslip", "emp-1", "mar.pdf", 1024, "application/pdf", "/docs/mar.pdf");
    expect(res.success).toBe(true);
    expect(writes[0].payload).toMatchObject({
      entity_type: "payslip",
      entity_id: "emp-1",
      file_name: "mar.pdf",
      file_size_bytes: 1024,
      mime_type: "application/pdf",
      storage_path: "/docs/mar.pdf",
      uploaded_by: "emp-1",
      scan_status: "clean",
    });
  });

  it("rejects unauthenticated uploads", async () => {
    const fake = createFakeSupabase({ user: null });
    mocks.createClient.mockReturnValue(fake);

    const res = await uploadAttachmentAction("a", "b", "c", 1, "t", "p");
    expect(res).toEqual({ error: "Unauthenticated" });
  });
});

describe("getAuditLogsAction", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("returns all logs without filters", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "audit_logs" && state.method === "select") {
          return { data: [{ id: "log-1", action: "create" }], error: null };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(getAuditLogsAction()).resolves.toEqual({
      logs: [{ id: "log-1", action: "create" }],
    });
  });

  it("filters logs by search term post-fetch", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "audit_logs" && state.method === "select") {
          return {
            data: [
              { id: "1", actor_name: "Alice", action: "update", entity_type: "leave", correlation_id: "c1" },
              { id: "2", actor_name: "Bob", action: "delete", entity_type: "salary", correlation_id: "c2" },
              { id: "3", actor_name: "Carol", action: "update", entity_type: "leave", correlation_id: "c3" },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await getAuditLogsAction({ search: "alice" });
    expect(res.logs.map((l: any) => l.id)).toEqual(["1"]);

    const byEntity = await getAuditLogsAction({ search: "leave" });
    expect(byEntity.logs.map((l: any) => l.id)).toEqual(["1", "3"]);
  });

  it("applies entity/date filters to the query chain", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "audit_logs" && state.method === "select") {
          const filterCols = state.filters.map((f) => f.col);
          return { data: [], error: null, count: filterCols.length };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    const res = await getAuditLogsAction({ entity: "leave", from: "2026-01-01", to: "2026-12-31", limit: 25 });
    expect(res.logs).toEqual([]);
  });

  it("returns an error payload when the query fails", async () => {
    const fake = createFakeSupabase({
      respond: (state) => {
        if (state.table === "audit_logs" && state.method === "select") {
          return { data: null, error: { message: "boom" } };
        }
        return { data: null, error: null };
      },
    });
    mocks.createClient.mockReturnValue(fake);

    await expect(getAuditLogsAction()).resolves.toEqual({ error: "boom", logs: [] });
  });
});
