import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const timestamp = new Date().toISOString();
  let dbStatus = "ok";
  let latencyMs = 0;

  try {
    const start = Date.now();
    const supabase = await createClient();
    const { error } = await supabase.from("roles").select("count", { count: "exact", head: true });
    latencyMs = Date.now() - start;

    if (error) {
      dbStatus = `degraded: ${error.message}`;
    }
  } catch (err: any) {
    dbStatus = `error: ${err?.message || "connection failed"}`;
  }

  const isHealthy = dbStatus === "ok";

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      version: "2.7.0",
      timestamp,
      checks: {
        database: dbStatus,
        latencyMs,
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
