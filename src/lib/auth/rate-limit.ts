/**
 * Production-ready rate limiter for login attempts.
 *
 * Uses Upstash Redis (serverless, edge-compatible) when credentials are
 * configured (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`).
 * Falls back to an in-memory Map for local development and testing.
 *
 * The Upstash implementation uses a sliding-window algorithm via
 * `@upstash/ratelimit` — it persists across server restarts and works
 * across multiple serverless instances.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_SECONDS = Math.floor(WINDOW_MS / 1000);

// ---------------------------------------------------------------------------
// Upstash Redis limiter (production)
// ---------------------------------------------------------------------------

let upstashLimiter: Ratelimit | null = null;
let productionWarningShown = false;

function getUpstashLimiter(): Ratelimit | null {
  if (upstashLimiter) return upstashLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SECURITY CONFIGURATION ERROR: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured in production for distributed rate limiting."
      );
    }
    return null;
  }

  try {
    const redis = new Redis({ url, token });
    upstashLimiter = new Ratelimit({
      redis,
      // Sliding window: allow MAX_ATTEMPTS requests within the window.
      limiter: Ratelimit.slidingWindow(MAX_ATTEMPTS, `${WINDOW_SECONDS} s`),
      analytics: true,
      prefix: "hrms:ratelimit:login",
    });
    return upstashLimiter;
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SECURITY CONFIGURATION ERROR: Failed to connect to Upstash Redis in production.");
    }
    // If Upstash connection fails in non-production, fall back to in-memory
    return null;
  }
}

/**
 * Pings Upstash Redis to verify connectivity.
 * Used by the system health check endpoint and startup verification.
 */
export async function pingRedis(): Promise<{
  ok: boolean;
  configured: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return {
      ok: false,
      configured: false,
      error: "Redis credentials not configured",
    };
  }

  const start = Date.now();
  try {
    const redis = new Redis({ url, token });
    await redis.ping();
    return {
      ok: true,
      configured: true,
      latencyMs: Date.now() - start,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      configured: true,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// In-memory limiter (development / fallback)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

function checkMemoryRateLimit(
  identifier: string
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  const entry = memoryStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Checks if a login attempt is allowed for the given identifier (email).
 * Returns `{ allowed: true }` if allowed, or `{ allowed: false, retryAfterMs }`
 * if rate-limited.
 */
export async function checkLoginRateLimit(
  identifier: string
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  const limiter = getUpstashLimiter();

  if (limiter) {
    const result = await limiter.limit(identifier);
    if (!result.success) {
      // Calculate retry-after from the reset timestamp
      const retryAfterMs = Math.max(0, result.reset - Date.now());
      return { allowed: false, retryAfterMs };
    }
    return { allowed: true };
  }

  // Fallback: in-memory rate limiting
  return checkMemoryRateLimit(identifier);
}

/**
 * Resets the rate limit for a given identifier (e.g., after successful login).
 */
export async function resetLoginRateLimit(identifier: string): Promise<void> {
  const limiter = getUpstashLimiter();

  if (limiter) {
    // Upstash Ratelimit doesn't have a direct reset, but we can use the
    // underlying Redis client. For now, the sliding window naturally expires.
    return;
  }

  memoryStore.delete(identifier);
}

/**
 * Generic rate limiter for server actions (NFR-02).
 */
export async function checkActionRateLimit(
  identifier: string,
  actionName: string,
  maxAttempts: number = 20,
  windowMs: number = 3600000 // 1 hour
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  const key = `${actionName}:${identifier}`;
  const limiter = getUpstashLimiter();

  if (limiter) {
    const result = await limiter.limit(key);
    if (!result.success) {
      const retryAfterMs = Math.max(0, result.reset - Date.now());
      return { allowed: false, retryAfterMs };
    }
    return { allowed: true };
  }

  // In-memory rate limiting
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true };
}

/**
 * Returns the number of remaining attempts for a given identifier.
 */
export async function getRemainingAttempts(
  identifier: string
): Promise<number> {
  const limiter = getUpstashLimiter();

  if (limiter) {
    const result = await limiter.limit(identifier);
    return Math.max(0, MAX_ATTEMPTS - result.remaining);
  }

  const entry = memoryStore.get(identifier);
  if (!entry || Date.now() > entry.resetAt) return MAX_ATTEMPTS;
  return Math.max(0, MAX_ATTEMPTS - entry.count);
}
