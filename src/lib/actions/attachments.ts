"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission, assertAnyPermission, getAuthenticatedCaller } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

export async function getAttachmentsAction() {
  const permError = await assertAnyPermission(["attachment.view", "employee.view.self"]);
  if (permError) return { attachments: [] };

  const caller = await getAuthenticatedCaller();
  const isHrOrAdmin = await assertAnyPermission(["employee.view.all", "employee.create"]);

  const supabase = await createClient();
  let query = supabase
    .from("document_attachments")
    .select("*, employees:uploaded_by(full_name)")
    .order("created_at", { ascending: false })
    .limit(30);

  // If standard employee without view.all, scope to their own uploaded attachments or entities
  if (isHrOrAdmin !== null && caller?.employeeId) {
    query = query.or(`uploaded_by.eq.${caller.employeeId},entity_id.eq.${caller.employeeId}`);
  }

  const { data, error } = await query;

  if (error) return { attachments: [] };
  return { attachments: data || [] };
}

export async function uploadAttachmentAction(
  entityType: string,
  entityId: string,
  fileName: string,
  fileSizeBytes: number,
  mimeType: string,
  storagePath: string
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  fileName = sanitizeInput(fileName);

  const permError = await assertPermission("attachment.upload");
  if (permError) return permError;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthenticated" };

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const { data, error } = await supabase
    .from("document_attachments")
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      file_name: fileName,
      file_size_bytes: fileSizeBytes,
      mime_type: mimeType,
      storage_path: storagePath,
      uploaded_by: emp?.id || null,
      scan_status: "clean",
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { success: true, attachment: data };
}

