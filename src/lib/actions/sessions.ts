"use server";

import { createClient } from "@/lib/supabase/server";
import { assertAnyPermission, getAuthenticatedCaller } from "@/lib/auth/assertPermission";
import { validateRequestOrigin } from "@/lib/security";
import { writeAuditLogAction } from "@/lib/actions/audit";
import { logger } from "@/lib/logger";

export interface UserSessionItem {
  id: string;
  employee_id: string;
  ip_address?: string | null;
  user_agent?: string | null;
  device_type?: string | null;
  is_active: boolean;
  last_active_at: string;
  created_at: string;
  is_current?: boolean;
}

export async function listActiveSessionsAction(): Promise<{
  success: boolean;
  sessions: UserSessionItem[];
  error?: string;
}> {
  const permError = await assertAnyPermission(["employee.view.self", "settings.manage"]);
  if (permError) return { success: false, sessions: [], error: permError.error };

  const caller = await getAuthenticatedCaller();
  if (!caller?.employeeId) {
    return { success: false, sessions: [], error: "Unauthenticated session." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("employee_id", caller.employeeId)
    .eq("is_active", true)
    .order("last_active_at", { ascending: false });

  if (error) return { success: false, sessions: [], error: error.message };

  const sessions: UserSessionItem[] = (data || []).map((s: any, idx: number) => ({
    id: s.id,
    employee_id: s.employee_id,
    ip_address: s.ip_address,
    user_agent: s.user_agent,
    device_type: s.device_type || "desktop",
    is_active: s.is_active,
    last_active_at: s.last_active_at,
    created_at: s.created_at,
    is_current: idx === 0, // Most recent session is current
  }));

  // If no tracked sessions exist yet (e.g. fresh DB), return current synthetic session
  if (sessions.length === 0) {
    return {
      success: true,
      sessions: [
        {
          id: "current-session",
          employee_id: caller.employeeId,
          ip_address: "127.0.0.1",
          user_agent: "Current Browser Session",
          device_type: "desktop",
          is_active: true,
          last_active_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          is_current: true,
        },
      ],
    };
  }

  return { success: true, sessions };
}

export async function revokeSessionAction(sessionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertAnyPermission(["employee.view.self", "settings.manage"]);
  if (permError) return { success: false, error: permError.error };

  const caller = await getAuthenticatedCaller();
  if (!caller?.employeeId) {
    return { success: false, error: "Unauthenticated session." };
  }

  if (sessionId === "current-session") {
    return { success: true };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("user_sessions")
    .update({ is_active: false })
    .eq("id", sessionId)
    .eq("employee_id", caller.employeeId);

  if (error) {
    logger.error("session.revoke_error", {
      actorId: caller.employeeId,
      message: `Failed to revoke session ${sessionId}: ${error.message}`,
    });
    return { success: false, error: error.message };
  }

  await writeAuditLogAction({
    action: "auth.session_revoked",
    entityType: "user_session",
    entityId: sessionId,
    details: { revokedBy: caller.employeeId },
  });

  return { success: true };
}
