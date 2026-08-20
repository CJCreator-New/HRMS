"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, Cpu, Layers } from "lucide-react";
import { usePermission } from "@/lib/auth/usePermission";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/DataTable";
import { useToast } from "@/components/shared/Toast";

interface JobLog {
  id: string;
  job_name: string;
  status: "success" | "running" | "failed";
  records_processed: number;
  error_message?: string;
  executed_at: string;
}

const INITIAL_JOBS: JobLog[] = [
  {
    id: "j1",
    job_name: "job_accrue_monthly_earned_leave()",
    status: "success",
    records_processed: 48,
    executed_at: "2026-08-01 00:05:00",
  },
  {
    id: "j2",
    job_name: "job_expire_comp_off_grants()",
    status: "success",
    records_processed: 3,
    executed_at: "2026-08-01 00:10:00",
  },
  {
    id: "j3",
    job_name: "job_year_end_carry_forward()",
    status: "success",
    records_processed: 45,
    executed_at: "2026-01-01 00:15:00",
  },
];

import { getScheduledJobLogsAction, runScheduledJobAction } from "@/lib/actions/jobs";
import { formatDateIndian } from "@/lib/utils/formatters";

export default function ScheduledJobsPage() {
  const { can } = usePermission();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  const canRerun = can("job.rerun");

  const loadLogs = async () => {
    setLoading(true);
    const res = await getScheduledJobLogsAction();
    const rawLogs: any[] = res.logs || [];
    setJobs(
      rawLogs.map((l: any) => ({
        id: l.id,
        job_name: l.job_name,
        status: l.status,
        records_processed: l.records_processed_count || 0,
        error_message: l.error_details,
        executed_at: l.started_at ? l.started_at.replace("T", " ").split(".")[0] : "",
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleTriggerJob = async (jobId: string, jobName: string) => {
    setRunningJobId(jobId);
    const res = await runScheduledJobAction(jobName);
    setRunningJobId(null);

    if (res.error) {
      toast(`Error running job: ${res.error}`, "error");
    } else {
      toast(`Background Job '${jobName}' executed successfully! Log recorded.`);
      await loadLogs();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar (shared PageHeader) */}
      <PageHeader
        icon={<Cpu className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
        title="Scheduled Background Jobs Monitor"
        description="Automated cron tasks: monthly EL accruals, comp-off 90-day expiry forfeiture, and year-end carry forward / lapse."
      />

      {/* Jobs Log Table */}
      <div className="bg-surface rounded-xl border border-line shadow-card p-6 space-y-4">
        <h3 className="text-sm font-bold text-ink border-b border-line pb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-ink-secondary" /> System Job Audit Log (`scheduled_job_logs`)
        </h3>

        <DataTable
          name="jobs"
          columns={[
            { key: "job_name", header: "Job Name" },
            { key: "status", header: "Status" },
            { key: "records_processed", header: "Records Processed" },
            { key: "executed_at", header: "Last Executed" },
            { key: "trigger", header: "Manual Trigger", headerClassName: "text-right" },
          ]}
          rows={jobs}
          getSortValue={(j: JobLog, key) => {
            if (key === "executed_at") return j.executed_at;
            if (key === "records_processed") return j.records_processed;
            return (j as any)[key];
          }}
          renderRow={(j: JobLog) => (
            <tr key={j.id} className="hover:bg-surface-muted/50">
              <td className="px-4 py-3 font-mono font-bold text-ink">{j.job_name}</td>
              <td className="px-4 py-3">
                <StatusBadge status={j.status} />
              </td>
              <td className="px-4 py-3 font-mono text-ink-secondary">{j.records_processed} employees</td>
              <td className="px-4 py-3 font-mono text-ink-muted text-[11px]">
                {formatDateIndian(j.executed_at, true)}
              </td>
              <td className="px-4 py-3 text-right">
                {canRerun ? (
                  <button
                    onClick={() => handleTriggerJob(j.id, j.job_name)}
                    disabled={runningJobId === j.id}
                    className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-[11px] font-semibold transition inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${runningJobId === j.id ? "animate-spin" : ""}`} />
                    {runningJobId === j.id ? "Executing..." : "Run Job Now"}
                  </button>
                ) : (
                  <span className="text-[11px] text-ink-faint font-medium">Read-Only</span>
                )}
              </td>
            </tr>
          )}
        />
      </div>
    </div>
  );
}
