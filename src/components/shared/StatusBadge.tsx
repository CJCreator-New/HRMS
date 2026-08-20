"use client";

import React from "react";

/**
 * Shared status chip — normalizes status → color across the app so the same
 * state is always rendered identically (WS-B pattern library).
 *
 * Color families:
 *  - emerald: positive / resolved (active, approved, present, completed, finalized…)
 *  - amber:   in-flight / awaiting action (pending, invited, submitted, draft…)
 *  - red:     negative / blocked (rejected, revoked, cancelled, suspended, rescinded…)
 *  - blue:    transitional policy states (notice_period, scheduled, in_progress)
 *  - gray:    fallback / neutral
 */

const EMERALD = new Set([
  "active",
  "approved",
  "present",
  "completed",
  "finalized",
  "published",
  "paid",
  "cleared",
  "reactivated",
  "success",
  "clean",
  "eligible",
]);

const AMBER = new Set([
  "pending",
  "invited",
  "submitted",
  "pending_review",
  "pending_manager",
  "pending_approval",
  "draft",
  "in_review",
  "processing",
  "scheduled",
  "running",
  "pending_scan",
]);

const RED = new Set([
  "rejected",
  "revoked",
  "cancelled",
  "deactivated",
  "suspended",
  "rescinded",
  "absent",
  "stale",
  "overdue",
  "failed",
  "error",
  "flagged",
  "ineligible",
  "withdrawn",
]);

const BLUE = new Set([
  "notice_period",
  "in_progress",
  "locked",
]);

export function statusBadgeClass(status: string): string {
  const key = (status || "").toLowerCase();
  if (EMERALD.has(key)) return "bg-emerald-100 text-emerald-800";
  if (AMBER.has(key)) return "bg-amber-100 text-amber-800";
  if (RED.has(key)) return "bg-red-100 text-red-800";
  if (BLUE.has(key)) return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-700";
}

interface StatusBadgeProps {
  status: string;
  /** Optional display label — defaults to the raw status string. */
  label?: React.ReactNode;
  className?: string;
}

export function StatusBadge({ status, label, className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(
        status
      )} ${className}`}
    >
      {label ?? status}
    </span>
  );
}

export default StatusBadge;
