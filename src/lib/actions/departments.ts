"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

export async function createDepartmentAction(formData: FormData): Promise<{ success: boolean; error?: string; department?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("settings.manage");
  if (permError) return { success: false, error: permError.error };

  const name = sanitizeInput(formData.get("name") as string);
  if (!name) return { success: false, error: "Department Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .insert({ name, active: true })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, department: data };
}

export async function toggleDepartmentActiveAction(id: string, active: boolean): Promise<{ success: boolean; error?: string; department?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("settings.manage");
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, department: data };
}

export async function updateDepartmentAction(id: string, name: string): Promise<{ success: boolean; error?: string; department?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("settings.manage");
  if (permError) return { success: false, error: permError.error };

  name = sanitizeInput(name);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .update({ name })
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, department: data };
}

export async function getDepartmentsAction(): Promise<{ departments: any[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("departments").select("*").order("name");
  if (error) return { departments: [], error: error.message };
  return { departments: data || [] };
}


