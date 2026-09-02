"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission, getAuthenticatedCaller } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

export async function getNotificationsAction() {
  const supabase = await createClient();
  const caller = await getAuthenticatedCaller();
  let employeeId = caller?.employeeId;

  if (!employeeId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { notifications: [], unread: 0 };

    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!emp) return { notifications: [], unread: 0 };
    employeeId = emp.id;
  }

  const [{ data: notifications }, { count: unreadCount }] = await Promise.all([
    supabase
      .from("inbox_notifications")
      .select("*")
      .eq("recipient_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("inbox_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", employeeId)
      .eq("is_read", false),
  ]);

  const safeNotifications = Array.isArray(notifications) ? notifications : notifications ? [notifications] : [];
  const unread =
    typeof unreadCount === "number"
      ? unreadCount
      : safeNotifications.filter((n: { is_read?: boolean | null }) => !n.is_read).length;

  return { notifications: safeNotifications, unread };
}

export async function markNotificationReadAction(notificationId: string) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("employee.view.self");
  if (permError) return permError;

  const supabase = await createClient();
  const { error } = await supabase
    .from("inbox_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function markAllNotificationsReadAction() {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("employee.view.self");
  if (permError) return permError;

  const supabase = await createClient();
  const caller = await getAuthenticatedCaller();
  let employeeId = caller?.employeeId;

  if (!employeeId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthenticated" };

    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!emp) return { error: "Employee not found" };
    employeeId = emp.id;
  }

  const { error } = await supabase
    .from("inbox_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_id", employeeId)
    .eq("is_read", false);

  if (error) return { error: error.message };
  return { success: true };
}

export async function createNotificationAction(
  recipientId: string,
  title: string,
  message: string,
  actionUrl?: string
) {
  try {
    const authError = await assertPermission('settings.manage');
    if (authError) return { error: authError.error };

    title = sanitizeInput(title);
    message = sanitizeInput(message);
    if (actionUrl) actionUrl = sanitizeInput(actionUrl);

    const supabase = await createClient();
    const { error } = await supabase.from("inbox_notifications").insert({
      recipient_id: recipientId,
      title,
      message,
      action_url: actionUrl || null,
    });
    if (error) return { error: error.message };
    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create notification";
    return { error: message };
  }
}

export interface NotificationPreferenceItem {
  module: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
}

export async function getNotificationPreferencesAction(
  targetEmployeeId?: string
): Promise<{ success: boolean; preferences: NotificationPreferenceItem[]; error?: string }> {
  const caller = await getAuthenticatedCaller();
  if (!caller?.employeeId) {
    return { success: false, preferences: [], error: "Unauthenticated" };
  }

  const effectiveEmpId = targetEmployeeId || caller.employeeId;
  if (effectiveEmpId !== caller.employeeId) {
    const permError = await assertPermission("settings.manage");
    if (permError) return { success: false, preferences: [], error: permError.error };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("module, email_enabled, in_app_enabled")
    .eq("employee_id", effectiveEmpId);

  if (error) {
    return { success: false, preferences: [], error: error.message };
  }

  // Default modules matrix
  const standardModules = ["leaves", "payroll", "attendance", "documents", "announcements"];
  const existingMap = new Map((data || []).map((p: any) => [p.module, p]));

  const merged: NotificationPreferenceItem[] = standardModules.map((mod) => {
    const match = existingMap.get(mod);
    return {
      module: mod,
      emailEnabled: match ? match.email_enabled : true,
      inAppEnabled: match ? match.in_app_enabled : true,
    };
  });

  return { success: true, preferences: merged };
}

export async function updateNotificationPreferencesAction(
  preferences: NotificationPreferenceItem[]
): Promise<{ success: boolean; error?: string }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const caller = await getAuthenticatedCaller();
  if (!caller?.employeeId) {
    return { success: false, error: "Unauthenticated" };
  }

  const supabase = await createClient();

  const upserts = preferences.map((p) => ({
    employee_id: caller.employeeId,
    module: sanitizeInput(p.module).trim().toLowerCase(),
    email_enabled: Boolean(p.emailEnabled),
    in_app_enabled: Boolean(p.inAppEnabled),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(upserts, { onConflict: "employee_id,module" });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

