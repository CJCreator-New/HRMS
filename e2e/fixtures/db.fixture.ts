import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy_service_role_key";

export const adminDb = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Lightweight reachability probe for the Supabase/PostgREST backend.
 * Used to skip DB/mutation-dependent specs in offline mock-token mode
 * (see ADR 0004 — hybrid seeding requires a live backend).
 * Returns true when any HTTP response is received within 2s.
 */
export async function isSupabaseReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.status >= 200; // any HTTP response means the gateway is up
  } catch {
    return false;
  }
}

export async function assertRecordExists(table: string, filter: Record<string, any>) {
  let query = adminDb.from(table).select("*");
  for (const [key, val] of Object.entries(filter)) {
    query = query.eq(key, val);
  }
  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    throw new Error(`DB Assertion Failed: Record not found in '${table}' matching ${JSON.stringify(filter)}`);
  }
  return data[0];
}

export async function assertAuditLogCreated(action: string, entityType: string) {
  const { data, error } = await adminDb
    .from("audit_logs")
    .select("*")
    .eq("action", action)
    .eq("entity_type", entityType)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    throw new Error(`DB Audit Assertion Failed: Audit log for '${action}' on '${entityType}' not found.`);
  }
  return data[0];
}
