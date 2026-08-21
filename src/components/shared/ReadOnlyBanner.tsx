"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { useRole } from "@/lib/roleContext";

export function ReadOnlyBanner({ moduleName }: { moduleName: string }) {
  const { activeRole } = useRole();

  if (activeRole !== "payroll_admin") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="read-only-banner"
      className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl text-xs font-medium flex items-center justify-between shadow-xs mb-4"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          <strong>Payroll Admin View ({moduleName}):</strong> Operational data is displayed in Read-Only mode for audit verification. Approval and modification buttons are restricted to Manager and HR Admin roles.
        </span>
      </div>
    </div>
  );
}
