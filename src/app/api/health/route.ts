import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    } catch (pingErr: any) {
      reachable = false;
      errorMessage = pingErr?.name === "AbortError" 
        ? "Connection to Supabase timed out after 3000ms"
        : pingErr?.message || "Failed to reach configured Supabase endpoint";
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
  } catch (err: any) {
    if (isConfigured) {
      dbStatus = `error: ${err?.message || "connection failed"}`;
      reachable = false;
      errorMessage = errorMessage || err?.message || "Supabase database client connection failure";
    } else {
      dbStatus = "mock_mode_active";
    }
    latencyMs = Date.now() - start;
  }

  const isHealthy = reachable && (dbStatus === "ok" || dbStatus === "mock_mode_active");

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "unreachable",
      reachable,
      version: "2.7.0",
      timestamp,
      supabaseUrl: isConfigured ? rawSupabaseUrl : "mock://local-environment",
      latencyMs,
      checks: {
        configured: isConfigured,
        supabaseReachable: reachable,
        database: dbStatus,
        latencyMs,
      },
      error: isHealthy ? null : (errorMessage || "Supabase backend endpoint is currently unreachable"),
    },
    { status: isHealthy ? 200 : 503 }
  );
}

