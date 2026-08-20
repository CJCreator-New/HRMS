"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission, assertAnyPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

export async function createHolidayAction(
  calendarTemplateId: string,
  name: string,
  holidayDate: string,
  isOptional: boolean
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("settings.manage");
  if (permError) return permError;

  name = sanitizeInput(name);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("holidays")
    .insert({
      calendar_template_id: calendarTemplateId,
      name,
      holiday_date: holidayDate,
      is_optional: isOptional,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { success: true, record: data };
}

export async function selectOptionalHolidayAction(
  employeeId: string,
  holidayId: string,
  selected: boolean
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertAnyPermission(["settings.manage", "employee.view.self"]);
  if (permError) return permError;

  const supabase = await createClient();

  if (selected) {
    const { data: tmpl } = await supabase
      .from("holidays")
      .select("calendar_template_id")
      .eq("id", holidayId)
      .single();
    const { data: existing } = await supabase
      .from("employee_optional_holiday_selections")
      .select("holiday_id")
      .eq("employee_id", employeeId);
    const cap = 2;
    if ((existing?.length || 0) >= cap) {
      return { error: `Maximum limit reached: you can select up to ${cap} optional holidays.` };
    }
    const { error } = await supabase
      .from("employee_optional_holiday_selections")
      .insert({ employee_id: employeeId, holiday_id: holidayId, calendar_template_id: tmpl?.calendar_template_id || null });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("employee_optional_holiday_selections")
      .delete()
      .eq("employee_id", employeeId)
      .eq("holiday_id", holidayId);
    if (error) return { error: error.message };
  }

  return { success: true };
}

export async function assignCalendarAction(
  employeeId: string,
  calendarTemplateId: string,
  effectiveFrom: string
) {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return csrfError;

  const permError = await assertPermission("settings.manage");
  if (permError) return permError;

  const supabase = await createClient();

  const { error } = await supabase
    .from("employee_work_calendar_assignment")
    .insert({
      employee_id: employeeId,
      calendar_template_id: calendarTemplateId,
      effective_from: effectiveFrom,
    });

  if (error) return { error: error.message };
  return { success: true };
}
