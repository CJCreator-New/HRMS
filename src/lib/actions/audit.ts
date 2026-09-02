"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

export interface AuditLogRecord {
  id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: unknown;
  new_values?: unknown;
  metadata?: unknown;
  correlation_id?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export async function getAuditLogsAction(filters?: {
  search?: string;
  entity?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<{ error?: string; logs: AuditLogRecord[] }> {
  const permError = await assertPermission("audit.view");
  if (permError) return { error: permError.error, logs: [] };

  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters?.limit || 100);

  if (filters?.entity) query = query.eq("entity_type", filters.entity);
  if (filters?.from) query = query.gte("created_at", filters.from);
  if (filters?.to) query = query.lte("created_at", filters.to);

  if (filters?.search && filters.search.trim()) {
    const q = filters.search.trim().replace(/[%]/g, "");
    query = query.or(
      `actor_name.ilike.%${q}%,action.ilike.%${q}%,entity_type.ilike.%${q}%,correlation_id.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) return { error: error.message, logs: [] };

  const typedData = (data as AuditLogRecord[]) || [];

  // Apply search filter (for mock environments and additional client precision)
  const logs = filters?.search
    ? typedData.filter(
        (l: AuditLogRecord) =>
          l.actor_name?.toLowerCase().includes(filters.search!.toLowerCase()) ||
          l.action?.toLowerCase().includes(filters.search!.toLowerCase()) ||
          l.entity_type?.toLowerCase().includes(filters.search!.toLowerCase()) ||
          l.correlation_id?.toLowerCase().includes(filters.search!.toLowerCase())
      )
    : typedData;

  return { logs };
}

export interface WriteAuditLogParams {
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  metadata?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

export async function writeAuditLogAction(params: WriteAuditLogParams) {
  try {
    const csrfError = await validateRequestOrigin();
    if (csrfError) return { error: csrfError.error };

    params.action = sanitizeInput(params.action);
    params.entityType = sanitizeInput(params.entityType);
    if (params.entityId) params.entityId = sanitizeInput(params.entityId);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let actorId: string | null = null;
    let actorName = "System";

    if (user) {
      const { data: emp } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("auth_user_id", user.id)
        .single();
      if (emp) {
        actorId = emp.id;
        actorName = emp.full_name;
      }
    }

    const { error } = await supabase.from("audit_logs").insert({
      actor_id: actorId,
      actor_name: actorName,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      old_values: params.oldValues ? JSON.stringify(params.oldValues) : null,
      new_values: params.newValues ? JSON.stringify(params.newValues) : null,
      metadata: params.metadata || params.details || {},
    });

    if (error) return { error: error.message };
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to record audit log";
    return { error: message };
  }
}

export async function archiveAuditLogsAction(retentionDays: number = 365): Promise<{
  success: boolean;
  archivedCount?: number;
  error?: string;
}> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("settings.manage");
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_old_audit_logs", {
    p_retention_days: retentionDays,
  });

  if (error) return { success: false, error: error.message };

  const count = Array.isArray(data) && data[0] ? Number(data[0].archived_count) : 0;
  return { success: true, archivedCount: count };
}

