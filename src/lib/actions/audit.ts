"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

export async function getAuditLogsAction(filters?: {
  search?: string;
  entity?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
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

  const { data, error } = await query;
  if (error) return { error: error.message, logs: [] };

  // Apply search post-fetch (audit_logs may not have full text index)
  const logs = filters?.search
    ? (data || []).filter(
        (l: any) =>
          l.actor_name?.toLowerCase().includes(filters.search!.toLowerCase()) ||
          l.action?.toLowerCase().includes(filters.search!.toLowerCase()) ||
          l.entity_type?.toLowerCase().includes(filters.search!.toLowerCase()) ||
          l.correlation_id?.toLowerCase().includes(filters.search!.toLowerCase())
      )
    : data || [];

  return { logs };
}

export interface WriteAuditLogParams {
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
}

export async function writeAuditLogAction(params: WriteAuditLogParams) {
  try {
    const csrfError = await validateRequestOrigin();
    if (csrfError) return { error: csrfError.error };

    const permError = await assertPermission("audit.view");
    if (permError) return { error: permError.error };

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

    const { data, error } = await supabase.from("audit_logs").insert({
      actor_id: actorId,
      actor_name: actorName,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      old_values: params.oldValues ? JSON.stringify(params.oldValues) : null,
      new_values: params.newValues ? JSON.stringify(params.newValues) : null,
      metadata: params.metadata || {},
    });

    if (error) return { error: error.message };
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to record audit log" };
  }
}
