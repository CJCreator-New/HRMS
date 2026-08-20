import { describe, it, expect, beforeEach } from "vitest";
import {
  checkLoginRateLimit,
  resetLoginRateLimit,
  checkActionRateLimit,
  getRemainingAttempts,
} from "../rate-limit";

describe("Rate Limiting Service (F4)", () => {
  const testId = "test-user@company.com";

  beforeEach(async () => {
    await resetLoginRateLimit(testId);
  });

  it("allows initial login attempts up to MAX_ATTEMPTS", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await checkLoginRateLimit(testId);
      expect(res.allowed).toBe(true);
    }
  });

  it("blocks login attempts when MAX_ATTEMPTS exceeded", async () => {
    for (let i = 0; i < 5; i++) {
      await checkLoginRateLimit(testId);
    }
    const blocked = await checkLoginRateLimit(testId);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("resets rate limit on resetLoginRateLimit call", async () => {
    for (let i = 0; i < 5; i++) {
      await checkLoginRateLimit(testId);
    }
    const blocked = await checkLoginRateLimit(testId);
    expect(blocked.allowed).toBe(false);

    await resetLoginRateLimit(testId);
    const afterReset = await checkLoginRateLimit(testId);
    expect(afterReset.allowed).toBe(true);
  });

  it("tracks action-specific rate limits independently", async () => {
    const actionKey = "custom_action_test";
    const res1 = await checkActionRateLimit(testId, actionKey, 2, 60000);
    expect(res1.allowed).toBe(true);
    const res2 = await checkActionRateLimit(testId, actionKey, 2, 60000);
    expect(res2.allowed).toBe(true);
    const res3 = await checkActionRateLimit(testId, actionKey, 2, 60000);
    expect(res3.allowed).toBe(false);
  });

  it("returns remaining attempts accurately", async () => {
    await resetLoginRateLimit("rem-user@company.com");
    expect(await getRemainingAttempts("rem-user@company.com")).toBe(5);
    await checkLoginRateLimit("rem-user@company.com");
    expect(await getRemainingAttempts("rem-user@company.com")).toBe(4);
  });
});
