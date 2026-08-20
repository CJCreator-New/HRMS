"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBannerProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorBanner({
  title = "Error Encountered",
  message,
  onRetry,
  className = "",
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={`p-4 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs flex items-start justify-between gap-3 ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <strong className="font-bold text-red-950 block">{title}</strong>
          <span className="text-red-900">{message}</span>
        </div>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-900 font-semibold rounded text-[11px] flex items-center gap-1 transition shrink-0"
        >
          <RefreshCw className="w-3 h-3" aria-hidden="true" /> Retry
        </button>
      )}
    </div>
  );
}
