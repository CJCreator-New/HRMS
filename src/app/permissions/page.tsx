"use client";

import React, { useState, useEffect } from "react";
import { Clock, Plus, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { applyShortPermissionAction, getShortPermissionsAction } from "@/lib/actions/permissions";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageLoading } from "@/components/shared/PageLoading";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { formatDateIndian } from "@/lib/utils/formatters";

interface PermissionRequest {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
}

export default function ShortPermissionsPage() {
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const [monthlyUsedMinutes, setMonthlyUsedMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [permDate, setPermDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [reason, setReason] = useState("");

  const loadRequests = async () => {
    setLoading(true);
    setError("");
    const res = await getShortPermissionsAction();
    if ("error" in res && typeof res.error === "string") {
      setError(res.error);
      setLoading(false);
      return;
    }
    if (typeof res.monthlyUsedMinutes === "number") {
      setMonthlyUsedMinutes(res.monthlyUsedMinutes);
    }
    const mapped: PermissionRequest[] = (res.requests || []).map((r: { id: string; permission_date?: string; date?: string; start_time?: string; end_time?: string; duration_minutes?: number; reason?: string; status?: "pending" | "approved" | "rejected" | string }) => ({
      id: r.id,
      date: r.permission_date || r.date || "",
      start_time: r.start_time || "",
      end_time: r.end_time || "",
      duration_minutes: r.duration_minutes || 0,
      reason: r.reason || "",
      status: (r.status as PermissionRequest["status"]) || "pending",
    }));
    setRequests(mapped);
    setLoading(false);
  };

  useEffect(() => { loadRequests(); }, []);

  const remainingQuota = Math.max(0, 120 - monthlyUsedMinutes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setNotice("");

    const startMins = parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]);
    const endMins = parseInt(endTime.split(":")[0]) * 60 + parseInt(endTime.split(":")[1]);
    const duration = endMins - startMins;

    if (duration <= 0 || duration > 120) {
      setNotice("Error: Short permission requests are limited to maximum 2 hours (120 minutes).");
      setSubmitting(false);
      setTimeout(() => setNotice(""), 4500);
      return;
    }

    if (monthlyUsedMinutes + duration > 120) {
      setNotice(`Error: Requested ${duration} mins exceeds your remaining monthly quota (${remainingQuota} mins remaining of 120 mins).`);
      setSubmitting(false);
      setTimeout(() => setNotice(""), 4500);
      return;
    }

    const res = await applyShortPermissionAction(permDate, startTime, endTime, reason);
    if ("error" in res && res.error) {
      setNotice(`Error: ${res.error}`);
    } else {
      setReason("");
      setNotice(`Short permission request submitted for ${duration} mins on ${permDate}! Pending manager approval.`);
      await loadRequests();
    }
    setSubmitting(false);
    setTimeout(() => setNotice(""), 4500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* PageHeader (WS-B shared component) */}
      <PageHeader
        icon={<Clock className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
        title="Short Permission Requests"
        description="Submit and track short work permissions (2-hour maximum per month quota)."
        actions={
          <span className="px-3 py-1 bg-indigo-50 text-indigo-800 font-bold text-xs rounded-full flex items-center gap-1.5 border border-indigo-200">
            <Clock className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
            Monthly Quota: {remainingQuota} mins remaining ({monthlyUsedMinutes}/120 mins used)
          </span>
        }
      />

      {error && <ErrorBanner message={error} onRetry={loadRequests} />}

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            notice.startsWith("Error")
              ? "bg-red-50 border-red-200 text-red-900"
              : "bg-primary-50 border-primary-200 text-primary-900"
          }`}
        >
          {notice.startsWith("Error") ? (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-primary-600 shrink-0" />
          )}
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="bg-surface p-6 rounded-xl border border-line shadow-card space-y-4">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
            <Plus className="w-4 h-4 text-indigo-600" /> Apply for Short Permission
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3 text-xs" data-testid="permission-form">
            <div>
              <label className="block font-semibold text-ink-secondary mb-1">Date *</label>
              <input type="date" required data-testid="permission-date-input" value={permDate} onChange={(e) => setPermDate(e.target.value)} className="w-full border border-line-strong rounded-lg px-3 py-2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-ink-secondary mb-1">Start Time *</label>
                <input type="time" required data-testid="permission-start-time-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full border border-line-strong rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block font-semibold text-ink-secondary mb-1">End Time *</label>
                <input type="time" required data-testid="permission-end-time-input" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full border border-line-strong rounded-lg px-3 py-2" />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-ink-secondary mb-1">Reason *</label>
              <textarea required rows={2} data-testid="permission-reason-input" placeholder="Reason for short absence..." value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-line-strong rounded-lg px-3 py-2" />
            </div>
            <button type="submit" disabled={submitting} data-testid="permission-submit-btn" className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Request"}
            </button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-line shadow-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-ink border-b border-line pb-3">
            Permission Request History & Quota Tracker
          </h3>

          {loading ? (
            <PageLoading message="Loading short permission requests..." />
          ) : requests.length === 0 ? (
            <EmptyState
              title="No Permission Requests"
              description="You have not submitted any short work permission requests yet."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-muted border-b border-line font-bold uppercase text-ink-muted text-[11px]">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Time Range</th>
                    <th className="px-4 py-2.5">Duration</th>
                    <th className="px-4 py-2.5">Reason</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3 font-semibold text-ink">{formatDateIndian(r.date)}</td>
                      <td className="px-4 py-3 font-mono text-ink-secondary">
                        {r.start_time} - {r.end_time}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-indigo-700">{r.duration_minutes} mins</td>
                      <td className="px-4 py-3 text-ink-secondary italic">{r.reason}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
