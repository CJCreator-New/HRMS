"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface PageLoadingProps {
  message?: string;
  className?: string;
}

export function PageLoading({ message = "Loading data...", className = "" }: PageLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center py-16 px-4 gap-3 text-ink-muted min-h-[200px] ${className}`}
    >
      <Loader2 className="w-6 h-6 animate-spin text-primary-600" aria-hidden="true" />
      <span className="text-xs font-semibold tracking-wide text-ink-secondary">{message}</span>
    </div>
  );
}
