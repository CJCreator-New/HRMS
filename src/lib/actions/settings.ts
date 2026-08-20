"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

export async function getCompanySettingsAction() {
  const permError = await assertPermission("settings.manage");
  if (permError) return { error: permError.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("company_settings").select("*").limit(1).single();
  if (error) return { error: error.message };
  return { settings: data };
}

export async function updateCompanySettingsAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("settings.manage");
  if (permError) return { success: false, error: permError.error };

  const companyName = sanitizeInput(formData.get("companyName") as string);
  const timezone = sanitizeInput(formData.get("timezone") as string);
  const currency = sanitizeInput(formData.get("currency") as string);
  const currencySymbol = sanitizeInput(formData.get("currencySymbol") as string);
  const alternateHrApproverId = formData.get("alternateHrApproverId") as string;
  const managerSlaDays = parseInt(formData.get("managerSlaDays") as string) || 2;
  const noticePeriodDaysDefault = parseInt(formData.get("noticePeriodDaysDefault") as string) || 30;

  const supabase = await createClient();

  const { data: existing } = await supabase.from("company_settings").select("id").limit(1).single();

  if (existing?.id) {
    const { error } = await supabase
      .from("company_settings")
      .update({
        company_name: companyName,
        timezone,
        currency,
        currency_symbol: currencySymbol,
        alternate_hr_approver_id: alternateHrApproverId || null,
        manager_sla_days: managerSlaDays,
        notice_period_days_default: noticePeriodDaysDefault,
        is_configured: true, // Engine unlock gate flag
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) return { success: false, error: error.message };
  }

  return { success: true };
}

