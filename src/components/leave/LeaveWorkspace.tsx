"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Calendar, Plus, Eye, EyeOff } from "lucide-react";
import {
  applyLeaveAction,
  approveLeaveAction,
  rejectLeaveAction,
  requestCompOffAction,
  withdrawLeaveRequestAction,
} from "@/lib/actions/leave";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataTable } from "@/components/shared/DataTable";
import { DataTableSkeleton } from "@/components/shared/Skeleton";
import { formatDateIndian } from "@/lib/utils/formatters";
import type { LeaveAllocationView, LeaveRequestView } from "@/lib/services/leave";

interface LeaveWorkspaceProps {
  initialAllocations: LeaveAllocationView[];
  initialRequests: LeaveRequestView[];
  employeeId: string | null;
  /** Server-resolved: viewer may approve/reject leave requests. */
  canApprove: boolean;
  /** Server-resolved: viewer is HR admin (affects leave routing). */
  isHrAdmin: boolean;
}

/**
 * Leave workspace (client island, Slice 3).
 *
 * Allocations + request ledger are fetched server-side by the RSC page; this
 * island owns the forms, toggles, and approval interactions. Mutations call
 * `router.refresh()` so the server re-renders with fresh data.
 */
export function LeaveWorkspace({
  initialAllocations,
  initialRequests,
  employeeId,
  canApprove,
  isHrAdmin,
}: LeaveWorkspaceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [allocations, setAllocations] = useState(initialAllocations);
  const [requests, setRequests] = useState(initialRequests);
  const [viewAsManager, setViewAsManager] = useState(true);

  // Apply Form State
  const [leaveTypeCode, setLeaveTypeCode] = useState(initialAllocations[0]?.type_code || "CL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [durationType, setDurationType] = useState<"full_day" | "first_half" | "second_half">("full_day");
  const [reason, setReason] = useState("");

  // Comp-Off Request State
  const [extraWorkDate, setExtraWorkDate] = useState(new Date().toISOString().split("T")[0]);

  // Reject Confirmation State (H-12 — direct rejection requires confirmation)
  const [rejectTarget, setRejectTarget] = useState<LeaveRequestView | null>(null);

  const refresh = () => router.refresh();

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !employeeId) return;

    // Check overlap locally first
    const isOverlap = requests.some(
      (r) =>
        r.status !== "rejected" &&
        r.status !== "cancelled" &&
        startDate <= r.end_date &&
        endDate >= r.start_date
    );
    if (isOverlap) {
      toast("Error: Overlapping Leave Request! An active leave application already covers this date range.", "error");
      return;
    }

    const res = await applyLeaveAction(employeeId, leaveTypeCode, startDate, endDate, durationType, reason, isHrAdmin);

    if ("error" in res && res.error) {
      toast(`Error: ${res.error}`, "error");
    } else {
      setReason("");
      toast(
        <span>
          Leave Application submitted for {durationType === "full_day" ? "1" : "0.5"} day(s)! Routed for approval.{" "}
          <Link href="/approvals" className="underline font-bold">
            Track in Approvals →
          </Link>
        </span>
      );
      refresh();
    }
  };

  const handleRequestCompOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return;

    const res = await requestCompOffAction(employeeId, extraWorkDate, 1.0);

    if ("error" in res && res.error) {
      toast(`Error: ${res.error}`, "error");
    } else {
      const expiry = new Date(new Date(extraWorkDate).getTime() + 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      toast(
        `Comp-Off grant requested for Extra Work on ${formatDateIndian(extraWorkDate)}! 1.0 day credit granted, valid for 90 days (expires ${formatDateIndian(expiry)}). Pending manager approval.`
      );
      refresh();
    }
  };

  const handleDecideLeave = async (id: string, status: "approved" | "rejected") => {
    if (!employeeId) return;
    const res = status === "approved" ? await approveLeaveAction(id, employeeId) : await rejectLeaveAction(id, employeeId);

    if ("error" in res && res.error) {
      toast(`Error: ${res.error}`, "error");
    } else {
      toast(
        <span>
          Leave request {status}!{" "}
          <Link href="/approvals" className="underline font-bold">
            Review remaining approvals →
          </Link>
        </span>
      );
      refresh();
    }
  };

  const handleWithdrawLeave = async (id: string) => {
    const res = await withdrawLeaveRequestAction(id);
    if ("error" in res && res.error) {
      toast(`Error: ${res.error}`, "error");
    } else {
      toast("Leave request withdrawn successfully.");
      setRequests((prev) =>
        prev.map((req) => (req.id === id ? { ...req, status: "withdrawn" } : req))
      );
      refresh();
    }
  };

  const toggleSandwichRule = (code: string) => {
    setAllocations(
      allocations.map((a) => (a.type_code === code ? { ...a, is_sandwich_enabled: !a.is_sandwich_enabled } : a))
    );
  };

  return (
    <>
      {/* Leave Balances Grid */}
      <div className="space-y-3">
        <h2 data-testid="leave-header" className="text-sm font-bold text-ink flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-primary-600" aria-hidden="true" /> Annual Leave Balances & Sandwich Rule Policy
        </h2>

        {allocations.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="w-8 h-8 text-ink-faint" />}
            title="No leave allocations assigned"
            description="Contact HR to set up your annual leave quota allocations."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {allocations.map((alloc) => (
              <div key={alloc.type_code} className="bg-surface p-4 rounded-xl border border-line shadow-card space-y-2 relative">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-ink">{alloc.type_name}</span>
                  <span className="text-[10px] font-mono font-bold bg-primary-50 text-primary-700 px-2 py-0.5 rounded">
                    {alloc.type_code}
                  </span>
                </div>

                <div>
                  <p className="text-2xl font-extrabold text-ink tabular-nums">{alloc.balance}</p>
                  <p className="text-[10px] text-ink-muted">
                    Allocated: {alloc.allocated} &bull; Used: {alloc.used}
                  </p>
                </div>

                <div className="pt-2 border-t border-line flex items-center justify-between text-[10px]">
                  <span className="text-ink-secondary">Sandwich Rule</span>
                  <button
                    onClick={() => toggleSandwichRule(alloc.type_code)}
                    className={`px-2 py-0.5 rounded font-semibold transition ${
                      alloc.is_sandwich_enabled ? "bg-amber-100 text-amber-800" : "bg-surface-muted text-ink-secondary"
                    }`}
                  >
                    {alloc.is_sandwich_enabled ? "ON" : "OFF"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Application & Comp-off Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Apply Leave Form */}
        <div className="lg:col-span-2 bg-surface p-6 rounded-xl border border-line shadow-card space-y-4">
          <h2 className="text-sm font-bold text-ink border-b border-line pb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary-600" aria-hidden="true" /> Apply for Leave
          </h2>

          <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="leaveTypeSelect" className="block font-semibold text-ink-secondary mb-1">
                  Leave Type *
                </label>
                <select
                  id="leaveTypeSelect"
                  data-testid="leave-type-select"
                  value={leaveTypeCode}
                  onChange={(e) => setLeaveTypeCode(e.target.value)}
                  className="w-full border border-line-strong rounded-lg px-3 py-2 bg-surface focus:ring-2 focus:ring-primary-300 focus:outline-none"
                >
                  {allocations.map((a) => (
                    <option key={a.type_code} value={a.type_code}>
                      {a.type_name} (Balance: {a.balance})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="durationTypeSelect" className="block font-semibold text-ink-secondary mb-1">
                  Duration Type *
                </label>
                <select
                  id="durationTypeSelect"
                  data-testid="duration-type-select"
                  value={durationType}
                  onChange={(e) => setDurationType(e.target.value as any)}
                  className="w-full border border-line-strong rounded-lg px-3 py-2 bg-surface focus:ring-2 focus:ring-primary-300 focus:outline-none"
                >
                  <option value="full_day">Full Day</option>
                  <option value="first_half">First Half Only (0.5 Day)</option>
                  <option value="second_half">Second Half Only (0.5 Day)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDateInput" className="block font-semibold text-ink-secondary mb-1">
                  Start Date *
                </label>
                <input
                  id="startDateInput"
                  data-testid="start-date-input"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartDate(val);
                    // J7: Auto-populate end date for full-day leaves
                    if (durationType === "full_day" && val) {
                      setEndDate(val);
                    }
                  }}
                  className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-primary-300 focus:outline-none bg-surface"
                />
              </div>

              <div>
                <label htmlFor="endDateInput" className="block font-semibold text-ink-secondary mb-1">
                  End Date *
                </label>
                <input
                  id="endDateInput"
                  data-testid="end-date-input"
                  type="date"
                  required
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-primary-300 focus:outline-none bg-surface"
                />
                {startDate && endDate && endDate < startDate && (
                  <p className="text-[11px] text-red-600 mt-1">End date cannot be before start date.</p>
                )}
                {startDate && endDate && endDate >= startDate && requests.some(
                  (r) =>
                    r.status !== "rejected" &&
                    r.status !== "cancelled" &&
                    r.status !== "withdrawn" &&
                    startDate <= r.end_date &&
                    endDate >= r.start_date
                ) && (
                  <p className="text-[11px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                    ⚠️ Selected date range overlaps with an existing leave request.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="leaveReasonInput" className="block font-semibold text-ink-secondary mb-1">
                Reason for Application *
              </label>
              <textarea
                id="leaveReasonInput"
                data-testid="leave-reason-input"
                required
                rows={3}
                placeholder="Provide details for leave request..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-300 focus:outline-none bg-surface"
              />
            </div>

            <div className="flex justify-end pt-2 border-t border-line">
              <button
                type="submit"
                data-testid="submit-leave-btn"
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs rounded-lg transition shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                Submit Leave Application
              </button>
            </div>
          </form>
        </div>

        {/* Comp-off Credit Sub-flow */}
        <div className="bg-surface p-6 rounded-xl border border-line shadow-card space-y-4">
          <h2 className="text-sm font-bold text-ink border-b border-line pb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-600" aria-hidden="true" /> Request Comp-Off Credit
          </h2>

          <form onSubmit={handleRequestCompOff} className="space-y-3 text-xs">
            <div>
              <label htmlFor="extraWorkDateInput" className="block font-semibold text-ink-secondary mb-1">
                Extra Work Date *
              </label>
              <input
                id="extraWorkDateInput"
                data-testid="compoff-date-input"
                type="date"
                required
                value={extraWorkDate}
                onChange={(e) => setExtraWorkDate(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-primary-300 focus:outline-none bg-surface"
              />
            </div>

            <button
              type="submit"
              data-testid="submit-compoff-btn"
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-lg transition shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              Request 1-Day Comp-Off
            </button>
          </form>
        </div>
      </div>

      {/* Leave Requests Ledger & Approval Queue */}
      <div className="bg-surface rounded-xl border border-line shadow-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 className="text-sm font-bold text-ink">Leave Requests Ledger & Approval Queue</h2>

          {/* Manager Masking Privacy Toggle Demo */}
          <button
            onClick={() => setViewAsManager(!viewAsManager)}
            data-testid="toggle-manager-view-btn"
            className="px-3 py-1 bg-surface-muted hover:bg-primary-50 text-ink-secondary font-semibold text-[11px] rounded-lg transition flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            {viewAsManager ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {viewAsManager ? "View Mode: Manager (Reason Masked)" : "View Mode: HR Admin (Full Details)"}
          </button>
        </div>

        <DataTable
          name="leave-ledger"
          columns={[
            { key: "employee", header: "Employee & Type" },
            { key: "range", header: "Date Range" },
            { key: "days", header: "Days" },
            { key: "reason", header: "Reason Privacy" },
            { key: "status", header: "Status", sortable: true },
            { key: "actions", header: "Approval Actions", headerClassName: "text-right" },
          ]}
          rows={requests}
          getSortValue={(r: LeaveRequestView, key) => (key === "status" ? r.status : "")}
          minWidth="min-w-[700px]"
          empty={
            <EmptyState
              icon={<Calendar className="w-8 h-8 text-ink-faint" />}
              title="No leave requests recorded"
              description="Submitted leave requests will appear in this ledger."
            />
          }
          renderRow={(r: LeaveRequestView) => {
            const isParental = r.leave_type_code === "MATERNITY" || r.leave_type_code === "PATERNITY";
            const displayReason = isParental && viewAsManager ? "Medical Leave (Confidential Reason Masked)" : r.reason;
            const displayTypeName = isParental && viewAsManager ? "Parental Leave" : r.leave_type_name;

            return (
              <tr key={r.id} className="hover:bg-surface-muted/50">
                <td className="px-4 py-3">
                  <p className="font-bold text-ink">{r.employee_name}</p>
                  <p className="text-[10px] font-mono text-ink-muted">{displayTypeName}</p>
                </td>
                <td className="px-4 py-3 font-mono text-ink-secondary tabular-nums">
                  {formatDateIndian(r.start_date)} &rarr; {formatDateIndian(r.end_date)}
                </td>
                <td className="px-4 py-3 font-semibold text-ink-secondary tabular-nums">{r.total_days} day(s)</td>
                <td className="px-4 py-3 text-ink-secondary italic max-w-xs truncate">{displayReason}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {r.status === "pending" ? (
                    <>
                      {canApprove && (
                        <>
                          <button
                            onClick={() => handleDecideLeave(r.id, "approved")}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectTarget(r)}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleWithdrawLeave(r.id)}
                        className="px-2.5 py-1 bg-surface-muted hover:bg-red-50 text-red-600 border border-line rounded text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        Withdraw
                      </button>
                    </>
                  ) : (
                    <span className="text-ink-faint font-medium capitalize">{r.status}</span>
                  )}
                </td>
              </tr>
            );
          }}
        />
      </div>

      {/* Reject Confirmation (shared ConfirmDialog — H-12) */}
      <ConfirmDialog
        isOpen={!!rejectTarget}
        title="Reject Leave Request"
        description={`Are you sure you want to reject the leave request from ${rejectTarget?.employee_name ?? "this employee"}? The decision is recorded in the audit log.`}
        confirmLabel="Reject Request"
        cancelLabel="Keep Request"
        danger
        onConfirm={() => {
          if (rejectTarget) handleDecideLeave(rejectTarget.id, "rejected");
          setRejectTarget(null);
        }}
        onCancel={() => setRejectTarget(null)}
      />
    </>
  );
}

export default LeaveWorkspace;
