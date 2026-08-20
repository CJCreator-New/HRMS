"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { punchCheckInAction, punchCheckOutAction } from "@/lib/actions/attendance";
import { ErrorBanner } from "@/components/shared/ErrorBanner";

interface PunchButtonProps {
  employeeId: string | null;
  activeRecordId: string | null;
  isCheckedIn: boolean;
  /** "toggle" = single button flips between in/out; "separate" = two distinct buttons */
  variant?: "toggle" | "separate";
  /** Show a refresh button (attendance page only) */
  showRefresh?: boolean;
  /** Callback after successful punch (parent can trigger router.refresh, etc.) */
  onPunchSuccess?: () => void;
}

/**
 * V3: Shared punch-in/out button.
 *
 * Consolidates the duplicated punch logic from `PunchCard` (dashboard) and
 * `AttendancePunchBar` (attendance page) into a single reusable component.
 * Parents wrap it in their own layout; this component owns the mutation + notice state.
 */
export function PunchButton({
  employeeId,
  activeRecordId,
  isCheckedIn: initialCheckedIn,
  variant = "toggle",
  showRefresh = false,
  onPunchSuccess,
}: PunchButtonProps) {
  const router = useRouter();
  const [isCheckedIn, setIsCheckedIn] = useState(initialCheckedIn);
  const [currentRecordId, setCurrentRecordId] = useState(activeRecordId);
  const [busy, setBusy] = useState<"in" | "out" | "refresh" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  };

  const handlePunch = async (type: "check_in" | "check_out") => {
    setBusy(type === "check_in" ? "in" : "out");
    setNotice("");
    setError("");
    try {
      let res;
      if (type === "check_in") {
        res = await punchCheckInAction(employeeId ?? undefined);
      } else {
        if (!currentRecordId) {
          flash("No active check-in record found for punch-out.");
          setBusy(null);
          return;
        }
        res = await punchCheckOutAction(currentRecordId);
      }
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        if (type === "check_in") {
          setIsCheckedIn(true);
          if ("record" in res && res.record) {
            setCurrentRecordId(res.record.id);
          }
          flash(`Checked in at ${nowTime}`);
        } else {
          setIsCheckedIn(false);
          setCurrentRecordId(null);
          flash(`Checked out at ${nowTime}`);
        }
        router.refresh();
        onPunchSuccess?.();
      }
    } catch (e: any) {
      setError(e?.message || "Unexpected punch error");
    } finally {
      setBusy(null);
    }
  };

  const handleRefresh = () => {
    setBusy("refresh");
    setNotice("");
    router.refresh();
    setTimeout(() => setBusy(null), 600);
  };

  return (
    <>
      {variant === "toggle" ? (
        <button
          onClick={() => handlePunch(isCheckedIn ? "check_out" : "check_in")}
          disabled={busy !== null}
          aria-label={isCheckedIn ? "Punch Out of work" : "Punch In to work"}
          className={`w-full py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${
            isCheckedIn
              ? "bg-rose-600 hover:bg-rose-700 text-white"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-50`}
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isCheckedIn ? "Punch Out Now" : "Punch In Now"}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            data-testid="punch-in-btn"
            onClick={() => handlePunch("check_in")}
            disabled={busy !== null}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition flex items-center gap-2 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            {busy === "in" ? "Punching In…" : "Punch Check-In"}
          </button>
          <button
            data-testid="punch-out-btn"
            onClick={() => handlePunch("check_out")}
            disabled={busy !== null}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs transition flex items-center gap-2 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-50"
          >
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            {busy === "out" ? "Punching Out…" : "Punch Check-Out"}
          </button>
          {showRefresh && (
            <button
              onClick={handleRefresh}
              disabled={busy !== null}
              aria-label="Refresh attendance data"
              className="p-2.5 bg-surface-muted hover:bg-primary-50 text-ink-secondary rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-50"
            >
              <Loader2 className={`w-4 h-4 ${busy === "refresh" ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            notice.includes("failed") || notice.includes("Failed") || notice.includes("No active")
              ? "bg-red-50 border-red-200 text-red-900"
              : "bg-emerald-50 border-emerald-200 text-emerald-900"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}
    </>
  );
}

export default PunchButton;
