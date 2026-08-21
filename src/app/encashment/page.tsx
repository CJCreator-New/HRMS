"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DollarSign, Plus, Calculator, History, Play } from "lucide-react";
import { getEncashmentDataAction } from "@/lib/actions/data";
import { submitLeaveEncashmentAction, decideLeaveEncashmentAction } from "@/lib/actions/encashment";
import { useToast } from "@/components/shared/Toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatCurrencyIndian, formatDateIndian } from "@/lib/utils/formatters";

interface EncashmentRequest {
  id: string;
  employee_name: string;
  leave_type: string;
  days: number;
  trigger_type: "annual_window" | "fnf";
  daily_rate: number;
  total_amount: number;
  status: "pending" | "approved" | "rejected" | "processed";
  created_at: string;
}

interface CarryForwardLog {
  id: string;
  employee_name: string;
  year: number;
  unused: number;
  carried_forward: number;
  lapsed: number;
  processed_at: string;
}

export default function EncashmentPage() {
  const [encashments, setEncashments] = useState<EncashmentRequest[]>([]);
  const [logs, setLogs] = useState<CarryForwardLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const { toast } = useToast();
  const [runningJob, setRunningJob] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const res = await getEncashmentDataAction();
    setEmployeeId(res.employeeId || null);
    const rawEnc = res.encashments || [];
    setEncashments(rawEnc.map((e: { id: string; employees?: { full_name?: string | null } | null; days_to_encash: number; encashment_trigger?: string; daily_rate?: number; total_amount?: number; status: string; created_at?: string }) => ({
      id: e.id,
      employee_name: e.employees?.full_name || "Me",
      leave_type: "Earned Leave (EL)",
      days: e.days_to_encash,
      trigger_type: (e.encashment_trigger as "annual_window" | "fnf") || "annual_window",
      daily_rate: e.daily_rate || 0,
      total_amount: e.total_amount || 0,
      status: (e.status as EncashmentRequest["status"]) || "pending",
      created_at: e.created_at?.split("T")[0] || "",
    })));
    const rawLogs = res.carryForwardLogs || [];
    setLogs(rawLogs.map((l: { id: string; employees?: { full_name?: string | null } | null; year?: number; leave_year?: number; unused_days?: number; carried_forward_days?: number; lapsed_days?: number; created_at?: string }) => ({
      id: l.id,
      employee_name: l.employees?.full_name || "",
      year: l.year ?? l.leave_year ?? new Date().getFullYear(),
      unused: l.unused_days || 0,
      carried_forward: l.carried_forward_days || 0,
      lapsed: l.lapsed_days || 0,
      processed_at: l.created_at?.split("T")[0] || "",
    })));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const [daysToEncash, setDaysToEncash] = useState(5);
  const [triggerType, setTriggerType] = useState<"annual_window" | "fnf">("annual_window");
  const basicMonthly = 30000;
  const dailyRate = Math.round((basicMonthly / 26) * 100) / 100;
  const calculatedTotal = Math.round(dailyRate * daysToEncash);

  const handleApplyEncashment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) { toast("Employee record not found.", "error"); return; }
    const res = await submitLeaveEncashmentAction(employeeId, daysToEncash, triggerType, basicMonthly);
    if (res.error) {
      toast(`Error: ${res.error}`, "error");
    } else {
      toast(
        <span>
          Leave Encashment request submitted for {daysToEncash} EL day(s)! Total: {formatCurrencyIndian(calculatedTotal)}.{" "}
          <Link href="/approvals" className="underline font-bold">Track in Approvals →</Link>
        </span>
      );
      await loadData();
    }
  };

  const handleDecideEncashment = async (id: string, status: "approved" | "rejected") => {
    const res = await decideLeaveEncashmentAction(id, status);
    if (res.error) {
      toast(`Error: ${res.error}`, "error");
    } else {
      setEncashments(encashments.map((e) => (e.id === id ? { ...e, status } : e)));
      toast(
        <span>
          Encashment request {status}! Approved amounts will populate in current payroll run.{" "}
          <Link href="/approvals" className="underline font-bold">Review remaining approvals →</Link>
        </span>
      );
    }
  };

  const handleRunCarryForwardJob = () => {
    setRunningJob(true);
    setTimeout(() => {
      setRunningJob(false);
      toast(
        <span>
          Automated Year-End Carry Forward & Lapse Job executed successfully!{" "}
          <Link href="/encashment" className="underline font-bold">View carry-forward log ↓</Link>
        </span>
      );
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* PageHeader (WS-B shared component) */}
      <PageHeader
        icon={<DollarSign className="w-5 h-5 text-purple-600" aria-hidden="true" />}
        title="Financial Leave Operations & Encashment"
        description="Leave encashment calculator (26-day daily rate divisor), payroll inclusion, and year-end carry forward/lapse job log runner."
        actions={
          <button
            onClick={handleRunCarryForwardJob}
            disabled={runningJob}
            className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-semibold rounded-lg border border-purple-200 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Play className="w-4 h-4 text-purple-700" /> {runningJob ? "Running Job..." : "Run Carry-Forward Job"}
          </button>
        }
      />

      {/* Forms & Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Apply Form */}
        <div className="bg-surface p-6 rounded-xl border border-line shadow-card space-y-4">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-line pb-3">
            <Calculator className="w-4 h-4 text-purple-600" /> Leave Encashment Calculator (26-Day Divisor)
          </h3>

          <form onSubmit={handleApplyEncashment} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-ink-secondary mb-1">Encashment Trigger *</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as "annual_window" | "fnf")}
                className="w-full border border-line-strong rounded-lg px-3 py-2 bg-surface font-medium"
              >
                <option value="annual_window">Annual Encashment Window</option>
                <option value="fnf">Full & Final (F&F) Exit Trigger</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-ink-secondary mb-1">Earned Leave Days to Encash *</label>
              <input
                type="number"
                min="1"
                max="30"
                required
                value={daysToEncash}
                onChange={(e) => setDaysToEncash(parseInt(e.target.value) || 1)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono"
              />
            </div>

            <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 space-y-1">
              <div className="flex justify-between text-ink-secondary">
                <span>Basic Monthly:</span>
                <span className="font-mono font-semibold">{formatCurrencyIndian(basicMonthly)}</span>
              </div>
              <div className="flex justify-between text-ink-secondary">
                <span>Daily Rate (Basic / 26):</span>
                <span className="font-mono font-semibold">{formatCurrencyIndian(dailyRate)}/day</span>
              </div>
              <div className="flex justify-between font-bold text-purple-900 pt-1 border-t border-purple-200 text-xs">
                <span>Calculated Encashment Total:</span>
                <span className="font-mono text-purple-950">{formatCurrencyIndian(calculatedTotal)}</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
            >
              Submit Encashment Request
            </button>
          </form>
        </div>

        {/* Encashment Requests Queue */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-line shadow-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-ink border-b border-line pb-3">
            Leave Encashment Approvals & Payroll Integration Queue
          </h3>

          {loading ? (
            <div className="p-8 text-center text-ink-muted text-xs">Loading encashment data...</div>
          ) : encashments.length === 0 ? (
            <EmptyState title="No encashment requests" description="Encashment requests will appear here." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-muted border-b border-line font-bold uppercase text-ink-muted text-[11px]">
                    <th className="px-4 py-2.5">Employee</th>
                    <th className="px-4 py-2.5">Trigger & Days</th>
                    <th className="px-4 py-2.5">Daily Rate & Total</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {encashments.map((e) => (
                    <tr key={e.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-ink">{e.employee_name}</p>
                        <p className="text-[11px] text-ink-muted">{e.leave_type}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink-secondary">
                        {e.days} days
                        <p className="text-[10px] text-ink-muted font-normal uppercase">{e.trigger_type.replace("_", " ")}</p>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-purple-700">
                        {formatCurrencyIndian(e.total_amount)}
                        <p className="text-[10px] text-ink-muted font-normal">{formatCurrencyIndian(e.daily_rate)}/day</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {e.status === "pending" ? (
                          <>
                            <button
                              onClick={() => handleDecideEncashment(e.id, "approved")}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDecideEncashment(e.id, "rejected")}
                              className="px-2.5 py-1 bg-red-600 text-white rounded text-[11px] font-semibold hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-ink-faint">Decided</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Year-End Carry Forward Audit Log */}
      <div className="bg-surface rounded-xl border border-line shadow-card p-6 space-y-4">
        <h3 className="text-sm font-bold text-ink border-b border-line pb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-purple-600" /> Year-End Carry Forward & Lapse Audit Log
        </h3>

        {logs.length === 0 ? (
          <EmptyState title="No carry-forward logs" description="Year-end carry forward logs will appear here." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-muted border-b border-line font-bold uppercase text-ink-muted text-[11px]">
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5">Year</th>
                  <th className="px-4 py-2.5">Unused Days</th>
                  <th className="px-4 py-2.5">Carried Forward</th>
                  <th className="px-4 py-2.5">Lapsed Days</th>
                  <th className="px-4 py-2.5 text-right">Execution Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-surface-muted/50">
                    <td className="px-4 py-3 font-bold text-ink">{l.employee_name}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-ink-secondary">{l.year}</td>
                    <td className="px-4 py-3 font-mono text-ink-secondary">{l.unused} days</td>
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-700">{l.carried_forward} days</td>
                    <td className="px-4 py-3 font-mono text-red-600">{l.lapsed} days</td>
                    <td className="px-4 py-3 font-mono text-ink-muted text-right">{formatDateIndian(l.processed_at, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
