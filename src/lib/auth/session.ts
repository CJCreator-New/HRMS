import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function getSessionUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function getCurrentEmployee() {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: employee } = await supabase
    .from("employees")
    .select("*, employee_roles!employee_roles_employee_id_fkey(roles(code, name))")
    .eq("auth_user_id", user.id)
    .single();

  return employee;
}
