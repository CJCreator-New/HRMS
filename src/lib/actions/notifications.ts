"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

export async function getNotificationsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { notifications: [], unread: 0 };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!emp) return { notifications: [], unread: 0 };

  const [{ data: notifications }, { count: unreadCount }] = await Promise.all([
    supabase
      .from("inbox_notifications")
      .select("*")
      .eq("recipient_id", emp.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("inbox_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", emp.id)
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthenticated" };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!emp) return { error: "Employee not found" };

  const { error } = await supabase
    .from("inbox_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_id", emp.id)
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
