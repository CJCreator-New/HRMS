"use server";

import { createClient } from "@/lib/supabase/server";
import { assertAnyPermission, getAuthenticatedCaller } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";
import { writeAuditLogAction } from "@/lib/actions/audit";
import { logger } from "@/lib/logger";

export interface ProfileData {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
  phone?: string | null;
  personalAddress?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  dateOfJoining: string;
  dateOfBirth?: string | null;
  status: string;
}

export async function getProfileSelfAction(): Promise<{
  success: boolean;
  data?: ProfileData;
  error?: string;
}> {
  const permError = await assertAnyPermission(["employee.view.self", "employee.view"]);
  if (permError) return { success: false, error: permError.error };

  const caller = await getAuthenticatedCaller();
  if (!caller?.employeeId) {
    return { success: false, error: "Unauthenticated: no employee profile associated with caller." };
  }

  const supabase = await createClient();
  const { data: emp, error } = await supabase
    .from("employees")
    .select("id, full_name, employee_code, email, phone, personal_address, emergency_contact_name, emergency_contact_phone, date_of_joining, date_of_birth, status")
    .eq("id", caller.employeeId)
    .single();

  if (error || !emp) {
    return { success: false, error: error?.message || "Profile not found." };
  }

  return {
    success: true,
    data: {
      id: emp.id,
      fullName: emp.full_name,
      employeeCode: emp.employee_code,
      email: emp.email,
      phone: emp.phone,
      personalAddress: emp.personal_address,
      emergencyContactName: emp.emergency_contact_name,
      emergencyContactPhone: emp.emergency_contact_phone,
      dateOfJoining: emp.date_of_joining,
      dateOfBirth: emp.date_of_birth,
      status: emp.status,
    },
  };
}

export async function updateProfileSelfAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertAnyPermission(["employee.view.self", "employee.edit"]);
  if (permError) return { success: false, error: permError.error };

  const caller = await getAuthenticatedCaller();
  if (!caller?.employeeId) {
    return { success: false, error: "Unauthenticated: cannot resolve caller identity." };
  }

  const phone = sanitizeInput(formData.get("phone") as string || "");
  const personalAddress = sanitizeInput(formData.get("personalAddress") as string || "");
  const emergencyContactName = sanitizeInput(formData.get("emergencyContactName") as string || "");
  const emergencyContactPhone = sanitizeInput(formData.get("emergencyContactPhone") as string || "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({
      phone: phone || null,
      personal_address: personalAddress || null,
      emergency_contact_name: emergencyContactName || null,
      emergency_contact_phone: emergencyContactPhone || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", caller.employeeId);

  if (error) {
    logger.error("profile.update_error", {
      actorId: caller.employeeId,
      message: `Failed to update profile: ${error.message}`,
    });
    return { success: false, error: error.message };
  }

  await writeAuditLogAction({
    action: "profile.self_update",
    entityType: "employee",
    entityId: caller.employeeId,
    details: {
      updatedFields: ["phone", "personal_address", "emergency_contact_name", "emergency_contact_phone"],
      timestamp: new Date().toISOString(),
    },
  });

  return { success: true };
}
