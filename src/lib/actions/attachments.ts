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

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const ALLOWED_FILE_EXTENSIONS = new Set([
  "pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"
]);

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

  fileName = sanitizeInput(fileName).replace(/[/\\?%*:|"<>]/g, "_").replace(/\.\.+/g, ".").trim();
  storagePath = sanitizeInput(storagePath).trim();
  entityType = sanitizeInput(entityType).trim();
  entityId = sanitizeInput(entityId).trim();

  // 1. Validate file size (P2 #11)
  if (!fileSizeBytes || fileSizeBytes <= 0 || fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return { error: "File size exceeds maximum allowed limit of 10MB." };
  }

  // 2. Validate MIME type
  const normalizedMime = mimeType ? mimeType.toLowerCase().trim() : "";
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    return { error: `Unsupported or invalid file MIME type: ${mimeType || "unknown"}.` };
  }

  // 3. Validate file extension
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
    return { error: `Unsupported or invalid file extension: .${ext}.` };
  }

  // 4. Validate storage path traversal
  if (storagePath.includes("..") || storagePath.includes("\0")) {
    return { error: "Invalid storage path." };
  }
  if (fileName.includes("..")) {
    return { error: "Invalid storage path or filename." };
  }

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
      mime_type: normalizedMime,
      storage_path: storagePath,
      uploaded_by: emp?.id || null,
      scan_status: "pending",
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { success: true, attachment: data };
}


