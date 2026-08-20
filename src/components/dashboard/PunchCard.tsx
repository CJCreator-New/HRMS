"use client";

import React from "react";
import { Clock, CheckCircle2 } from "lucide-react";
import { PunchButton } from "@/components/shared/PunchButton";

interface PunchCardProps {
  initialEmployeeId: string | null;
  initialIsCheckedIn: boolean;
  initialCheckInTime: string | null;
  initialActiveRecordId: string | null;
  todayLabel: string;
}

/**
 * Attendance punch widget (client island). The initial state (today's record)
 * is resolved server-side by the dashboard RSC page and passed in as props;
 * only the punch interaction itself lives on the client.
 *
 * V3: Now delegates to shared <PunchButton variant="toggle">.
 */
export function PunchCard({
  initialEmployeeId,
  initialIsCheckedIn,
  initialCheckInTime,
  initialActiveRecordId,
  todayLabel,
}: PunchCardProps) {
  return (
    <div className="bg-surface p-5 rounded-xl border border-line shadow-card space-y-3">
      <div className="flex justify-between items-center text-ink-secondary">
        <span className="text-xs font-bold uppercase tracking-wider">Attendance Punch</span>
        <Clock className="w-4 h-4 text-primary-600" aria-hidden="true" />
      </div>
      <div>
        <p className="text-xl font-extrabold text-ink font-mono tabular-nums">
          {initialIsCheckedIn ? `IN @ ${initialCheckInTime}` : "Logged Out"}
        </p>
        <p className="text-[11px] text-ink-muted">Today: {todayLabel}</p>
      </div>
      <PunchButton
        employeeId={initialEmployeeId}
        activeRecordId={initialActiveRecordId}
        isCheckedIn={initialIsCheckedIn}
        variant="toggle"
      />
    </div>
  );
}

export default PunchCard;
