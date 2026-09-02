import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

interface MemoryCacheEntry {
  value: unknown;
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token && !url.includes("placeholder")) {
    try {
      redisClient = new Redis({ url, token });
      return redisClient;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Retrieves a cached value by key from Redis (or in-memory cache).
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const data = await redis.get<T>(key);
      return data ?? null;
    } catch (err: unknown) {
      logger.warn("cache.redis_get_error", {
        message: `Redis get failed for key ${key}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // In-memory fallback
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

/**
 * Stores a value in cache with a specified TTL in seconds (default: 300s).
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = 300
): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
      return;
    } catch (err: unknown) {
      logger.warn("cache.redis_set_error", {
        message: `Redis set failed for key ${key}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // In-memory fallback
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Invalidates a specific key or keys matching a prefix.
 */
export async function cacheInvalidate(key: string): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.del(key);
    } catch (err: unknown) {
      logger.warn("cache.redis_del_error", {
        message: `Redis del failed for key ${key}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // Also remove from in-memory fallback
  memoryCache.delete(key);
  for (const k of memoryCache.keys()) {
    if (k.startsWith(key)) {
      memoryCache.delete(k);
    }
  }
}

/**
 * High-order cache wrapper: returns cached data if present, otherwise
 * executes `fetcher()`, populates the cache, and returns fresh data.
 */
export async function cacheWrap<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<{ data: T; source: "cache" | "fresh" }> {
  const cached = await cacheGet<T>(key);
  if (cached !== null && cached !== undefined) {
    return { data: cached, source: "cache" };
  }

  const fresh = await fetcher();
  await cacheSet(key, fresh, ttlSeconds);
  return { data: fresh, source: "fresh" };
}
