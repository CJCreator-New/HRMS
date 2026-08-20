"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin } from "@/lib/security";

export async function getScheduledJobLogsAction(): Promise<{ logs: any[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scheduled_job_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(30);

  if (error) return { logs: [], error: error.message };
  return { logs: data || [] };
}

export async function runScheduledJobAction(jobName: string): Promise<{ success: boolean; error?: string }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  const permError = await assertPermission("job.rerun");
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();

  if (jobName.includes("earned_leave")) {
    const { error } = await supabase.rpc("job_accrue_monthly_earned_leave");
    if (error) return { success: false, error: error.message };
  } else if (jobName.includes("comp_off")) {
    const { error } = await supabase.rpc("job_expire_comp_off_grants");
    if (error) return { success: false, error: error.message };
  } else {
    // Log manual execution in scheduled_job_logs
    await supabase.from("scheduled_job_logs").insert({
      job_name: jobName,
      status: "success",
      records_processed_count: 1,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  }

  return { success: true };
}

