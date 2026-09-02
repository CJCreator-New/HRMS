import { describe, it, expect, beforeEach, vi } from "vitest";
import { cacheGet, cacheSet, cacheInvalidate, cacheWrap } from "@/lib/cache/redis";

describe("Redis & In-Memory Cache Wrapper (P3-1)", () => {
  beforeEach(async () => {
    // Clear in-memory entries
    await cacheInvalidate("test:");
  });

  it("sets and gets cached item within TTL window", async () => {
    await cacheSet("test:key1", { name: "Engineering" }, 60);
    const cached = await cacheGet<{ name: string }>("test:key1");
    expect(cached).toEqual({ name: "Engineering" });
  });

  it("returns null for non-existent or expired keys", async () => {
    await cacheSet("test:expired", { val: 1 }, -1); // expired immediately
    const res = await cacheGet("test:expired");
    expect(res).toBeNull();
  });

  it("invalidates cache key properly", async () => {
    await cacheSet("test:to_delete", "active", 60);
    expect(await cacheGet("test:to_delete")).toBe("active");

    await cacheInvalidate("test:to_delete");
    expect(await cacheGet("test:to_delete")).toBeNull();
  });

  it("cacheWrap fetches fresh on first call and caches for subsequent calls", async () => {
    const fetcher = vi.fn(async () => ["HR", "Finance", "Engineering"]);

    // First call: should be fresh
    const r1 = await cacheWrap("test:depts", fetcher, 60);
    expect(r1.source).toBe("fresh");
    expect(r1.data).toEqual(["HR", "Finance", "Engineering"]);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Second call: should be from cache
    const r2 = await cacheWrap("test:depts", fetcher, 60);
    expect(r2.source).toBe("cache");
    expect(r2.data).toEqual(["HR", "Finance", "Engineering"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
