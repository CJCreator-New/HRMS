"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import {
  submitAttendanceCorrectionAction,
  approveAttendanceCorrectionAction,
} from "@/lib/actions/attendance";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/DataTable";
import { formatDateIndian } from "@/lib/utils/formatters";
import type { AttendanceRecordView, CorrectionView } from "@/lib/services/attendance";

interface AttendanceWorkspaceProps {
  initialRecords: AttendanceRecordView[];
  initialCorrections: CorrectionView[];
  employeeId: string | null;
  /** Server-resolved: viewer may approve/reject correction requests. */
  canApprove: boolean;
}

/**
 * Attendance logs + correction queue (client island, Slice 2).
 *
 * Data is fetched server-side by the RSC page and passed in as props; only the
 * interactions (submit correction, approve/reject, modal state) live on the
 * client. Mutations call `router.refresh()` to re-render with fresh server data.
 */
export function AttendanceWorkspace({
  initialRecords,
  initialCorrections,
  employeeId,
  canApprove,
}: AttendanceWorkspaceProps) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [corrections, setCorrections] = useState(initialCorrections);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Correction Modal State
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecordView | null>(null);
  const [reqIn, setReqIn] = useState("09:00");
  const [reqOut, setReqOut] = useState("17:30");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Reject Confirmation State (H-12)
  const [rejectTarget, setRejectTarget] = useState<CorrectionView | null>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSubmitting(true);
    setError("");
    const res = await submitAttendanceCorrectionAction(
      selectedRecord.id,
      employeeId || "",
      reqIn,
      reqOut,
      reason
    );
    setSubmitting(false);

    if ("error" in res && res.error) {
      setError(res.error);
    } else if ("success" in res && !res.success) {
      setError("Correction submission failed. Please try again.");
    } else {
      flash("Attendance Correction Request submitted for manager approval!");
      setSelectedRecord(null);
      setReason("");
      router.refresh();
    }
  };

  const handleDecideCorrection = async (id: string, decision: "approved" | "rejected") => {
    const res = await approveAttendanceCorrectionAction(id, decision);
    if ("error" in res && res.error) {
      flash(`Correction update failed: ${res.error}`);
    } else {
      flash(`Correction ${decision} successfully.`);
      router.refresh();
    }
  };

  const pendingCount = corrections.filter((c) => c.status === "submitted").length;

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            notice.includes("failed") || notice.includes("Failed")
              ? "bg-red-50 border-red-200 text-red-900"
              : "bg-emerald-50 border-emerald-200 text-emerald-900"
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {/* Daily Attendance History */}
      <div className="bg-surface rounded-xl border border-line shadow-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-ink border-b border-line pb-3">
          My Attendance Logs
        </h3>

        <DataTable
          name="attendance-logs"
          columns={[
            { key: "date", header: "Date", sortable: true },
            { key: "check_in", header: "Check-In" },
            { key: "check_out", header: "Check-Out" },
            { key: "status", header: "Status", sortable: true },
            { key: "actions", header: "Actions", headerClassName: "text-right" },
          ]}
          rows={records}
          getSortValue={(a: AttendanceRecordView, key) =>
            key === "date" || key === "status" ? a[key as "date" | "status"] : ""
          }
          minWidth="min-w-[600px]"
          empty={
            <EmptyState
              icon={<Clock className="w-8 h-8 text-ink-faint" />}
              title="No attendance records found"
              description="Use the Punch Check-In button above to log your shift attendance."
            />
          }
          renderRow={(a: AttendanceRecordView) => (
            <tr key={a.id} className="hover:bg-surface-muted/50">
              <td className="px-4 py-3 font-mono font-semibold text-ink">{formatDateIndian(a.date)}</td>
              <td className="px-4 py-3 font-mono text-ink-secondary tabular-nums">{a.check_in || "--:--"}</td>
              <td className="px-4 py-3 font-mono text-ink-secondary tabular-nums">{a.check_out || "--:--"}</td>
              <td className="px-4 py-3">
                <StatusBadge status={a.status} />
              </td>
              <td className="px-4 py-3 text-right">
                {a.status === "pending_review" && (
                  <button
                    data-testid="open-correction-modal-btn"
                    onClick={() => setSelectedRecord(a)}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    Submit Correction
                  </button>
                )}
              </td>
            </tr>
          )}
        />
      </div>

      {/* Pending Correction Approvals Queue */}
      <div className="bg-surface rounded-xl border border-line shadow-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-ink border-b border-line pb-3 flex items-center justify-between">
          <span>Attendance Correction Requests Queue</span>
          <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full tabular-nums">
            {pendingCount} Pending
          </span>
        </h3>

        <DataTable
          name="attendance-corrections"
          columns={[
            { key: "employee", header: "Employee & Date" },
            { key: "timestamps", header: "Requested Timestamps" },
            { key: "reason", header: "Reason" },
            { key: "status", header: "Status", sortable: true },
            { key: "actions", header: "Approval Actions", headerClassName: "text-right" },
          ]}
          rows={corrections}
          getSortValue={(c: CorrectionView, key) => (key === "status" ? c.status : "")}
          minWidth="min-w-[650px]"
          empty={
            <EmptyState
              icon={<Clock className="w-8 h-8 text-ink-faint" />}
              title="No correction requests pending"
              description="Submitted attendance correction requests will appear here for manager review."
            />
          }
          renderRow={(c: CorrectionView) => (
            <tr key={c.id} className="hover:bg-surface-muted/50">
              <td className="px-4 py-3">
                <p className="font-bold text-ink">{c.employee_name}</p>
                <p className="text-[11px] font-mono text-ink-muted">{formatDateIndian(c.date)}</p>
              </td>
              <td className="px-4 py-3 font-mono text-ink-secondary tabular-nums">
                {c.requested_check_in} &rarr; {c.requested_check_out}
              </td>
              <td className="px-4 py-3 text-ink-secondary italic">&quot;{c.reason}&quot;</td>
              <td className="px-4 py-3">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-4 py-3 text-right space-x-2">
                {c.status === "submitted" ? (
                  canApprove ? (
                    <>
                      <button
                        data-testid="approve-correction-btn"
                        onClick={() => handleDecideCorrection(c.id, "approved")}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        Approve
                      </button>
                      <button
                        data-testid="reject-correction-btn"
                        onClick={() => setRejectTarget(c)}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-amber-700 font-semibold text-[11px] bg-amber-50 px-2 py-0.5 rounded">
                      Read-Only
                    </span>
                  )
                ) : (
                  <span className="text-ink-faint font-medium">Decided</span>
                )}
              </td>
            </tr>
          )}
        />
      </div>

      {/* Submit Correction Modal (shared Modal — focus trap, Escape, scroll lock) */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={selectedRecord ? `Submit Attendance Correction (${selectedRecord.date})` : "Submit Attendance Correction"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmitCorrection} className="space-y-4 text-xs">
          <div>
            <label htmlFor="reqInInput" className="block font-semibold text-ink-secondary mb-1">
              Check-In Time *
            </label>
            <input
              id="reqInInput"
              type="text"
              data-testid="correction-in-input"
              required
              value={reqIn}
              onChange={(e) => setReqIn(e.target.value)}
              className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-primary-300 focus:border-primary-500 focus:outline-none bg-surface"
            />
          </div>

          <div>
            <label htmlFor="reqOutInput" className="block font-semibold text-ink-secondary mb-1">
              Check-Out Time *
            </label>
            <input
              id="reqOutInput"
              type="text"
              data-testid="correction-out-input"
              required
              value={reqOut}
              onChange={(e) => setReqOut(e.target.value)}
              className="w-full border border-line-strong rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-primary-300 focus:border-primary-500 focus:outline-none bg-surface"
            />
          </div>

          <div>
            <label htmlFor="reasonInput" className="block font-semibold text-ink-secondary mb-1">
              Reason for Correction *
            </label>
            <textarea
              id="reasonInput"
              data-testid="correction-reason-input"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Specify reason for missed or incorrect punch..."
              className="w-full border border-line-strong rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-300 focus:border-primary-500 focus:outline-none bg-surface"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSelectedRecord(null)}
              className="px-4 py-2 bg-surface-muted hover:bg-primary-50 text-ink-secondary font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="correction-submit-btn"
              disabled={submitting}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg transition disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject Confirmation (shared ConfirmDialog — H-12) */}
      <ConfirmDialog
        isOpen={!!rejectTarget}
        title="Reject Attendance Correction"
        description={`Are you sure you want to reject the correction request from ${rejectTarget?.employee_name ?? "this employee"}? The decision is recorded in the audit log.`}
        confirmLabel="Reject Request"
        cancelLabel="Keep Request"
        danger
        onConfirm={() => {
          if (rejectTarget) handleDecideCorrection(rejectTarget.id, "rejected");
          setRejectTarget(null);
        }}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  );
}

export default AttendanceWorkspace;
