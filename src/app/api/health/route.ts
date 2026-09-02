import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pingRedis } from "@/lib/auth/rate-limit";

export async function GET() {
  const timestamp = new Date().toISOString();
  const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isConfigured = Boolean(rawSupabaseUrl && !rawSupabaseUrl.includes("placeholder"));
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  let reachable = false;
  let dbStatus = "ok";
  let latencyMs = 0;
  let errorMessage: string | null = null;

  const start = Date.now();

  // 1. Direct lightweight reachability check of configured Supabase URL
  if (isConfigured) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const pingRes = await fetch(`${rawSupabaseUrl}/auth/v1/health`, {
        method: "GET",
        headers: {
          apikey: anonKey || "ping",
        },
        signal: controller.signal,
      }).catch(async () => {
        // Fallback to pinging rest root if auth/v1/health is restricted
        return fetch(`${rawSupabaseUrl}/rest/v1/`, {
          method: "GET",
          headers: { apikey: anonKey || "ping" },
          signal: controller.signal,
        });
      });

      clearTimeout(timeoutId);
      if (pingRes) {
        reachable = true;
      }
    } catch (pingErr: unknown) {
      reachable = false;
      const isAbort = pingErr instanceof Error && pingErr.name === "AbortError";
      const errMsg = pingErr instanceof Error ? pingErr.message : "Failed to reach configured Supabase endpoint";
      errorMessage = isAbort ? "Connection to Supabase timed out after 3000ms" : errMsg;
    }
  } else {
    // If running in local mock/offline mode with placeholder URL
    reachable = true;
    dbStatus = "mock_mode_active";
  }

  // 2. Query Supabase database client
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("roles").select("count", { count: "exact", head: true });
    latencyMs = Date.now() - start;

    if (error) {
      dbStatus = `degraded: ${error.message}`;
      if (!isConfigured) {
        // In dev mock mode, this is expected
        dbStatus = "mock_mode_active";
      }
    } else {
      reachable = true;
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "connection failed";
    if (isConfigured) {
      dbStatus = `error: ${errMsg}`;
      reachable = false;
      errorMessage = errorMessage || (err instanceof Error ? err.message : "Supabase database client connection failure");
    } else {
      dbStatus = "mock_mode_active";
    }
    latencyMs = Date.now() - start;
  }

  // 3. Redis connectivity check (P0-1 & P3-5)
  const redisHealth = await pingRedis().catch((err: unknown) => ({
    ok: false,
    configured: false,
    error: err instanceof Error ? err.message : String(err),
  }));

  // 4. Process metrics (P3-5)
  const memoryUsage = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());

  const isHealthy = reachable && (dbStatus === "ok" || dbStatus === "mock_mode_active");

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "unreachable",
      reachable,
      version: "2.7.0",
      timestamp,
      supabaseUrl: process.env.NODE_ENV === "production" ? "[CONFIGURED]" : (isConfigured ? rawSupabaseUrl : "mock://local-environment"),
      latencyMs,
      checks: {
        configured: isConfigured,
        supabaseReachable: reachable,
        database: dbStatus,
        redisReachable: redisHealth.ok,
        latencyMs,
      },
      components: {
        supabase: {
          status: reachable ? "up" : "down",
          database: dbStatus,
          latencyMs,
        },
        redis: {
          status: !redisHealth.configured ? "not_configured" : (redisHealth.ok ? "up" : "down"),
          configured: redisHealth.configured,
          latencyMs: ("latencyMs" in redisHealth ? redisHealth.latencyMs : null) ?? null,
          error: redisHealth.error ?? null,
        },
        memory: {
          rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
          heapUsedMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
          heapTotalMb: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
        },
        uptime: uptimeSeconds,
      },
      error: isHealthy ? null : (errorMessage || "Supabase backend endpoint is currently unreachable"),
    },
    { status: isHealthy ? 200 : 503 }
  );
}

