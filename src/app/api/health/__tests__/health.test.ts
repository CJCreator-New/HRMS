import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { GET } from "../route";
import { createFakeSupabase } from "@/lib/services/__tests__/helpers/fake-supabase";

describe("GET /api/health", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mocks.createClient.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns healthy with mock_mode_active when Supabase is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const fake = createFakeSupabase({
      respond: () => ({ data: null, error: null }),
    });
    mocks.createClient.mockReturnValue(fake);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.reachable).toBe(true);
    expect(data.checks.database).toBe("mock_mode_active");
  });

  it("returns healthy when Supabase endpoint and database query succeed", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);

    const fake = createFakeSupabase({
      respond: () => ({ data: null, error: null }),
    });
    mocks.createClient.mockReturnValue(fake);

    try {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("healthy");
      expect(data.checks.configured).toBe(true);
      expect(data.checks.database).toBe("ok");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("returns 503 unreachable when database query fails in configured mode", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);

    const fake = createFakeSupabase({
      respond: () => ({ data: null, error: { message: "connection timeout" } }),
    });
    mocks.createClient.mockReturnValue(fake);

    try {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe("unreachable");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
