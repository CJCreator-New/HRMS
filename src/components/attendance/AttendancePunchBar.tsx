"use client";

import React from "react";
import { PunchButton } from "@/components/shared/PunchButton";

interface AttendancePunchBarProps {
  employeeId: string | null;
  /** Today's open attendance record (the punch-out target). */
  activeRecordId: string | null;
  isCheckedIn: boolean;
}

/**
 * Punch in / out + refresh controls (client island).
 *
 * V3: Now delegates to shared <PunchButton variant="separate" showRefresh>.
 */
export function AttendancePunchBar({
  employeeId,
  activeRecordId,
  isCheckedIn,
}: AttendancePunchBarProps) {
  return (
    <PunchButton
      employeeId={employeeId}
      activeRecordId={activeRecordId}
      isCheckedIn={isCheckedIn}
      variant="separate"
      showRefresh
    />
  );
}

export default AttendancePunchBar;
