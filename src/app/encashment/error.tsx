"use client";

import React from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function EncashmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="bg-surface rounded-xl border border-line shadow-card max-w-md w-full p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" aria-hidden="true" />
        <h2 className="text-lg font-bold text-ink">Leave Encashment Failed</h2>
        <p className="text-xs text-ink-secondary">
          An error occurred while calculating leave encashment entitlement
          {error?.digest ? ` (${error.digest})` : ""}. Please try again.
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Encashment
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-surface-muted hover:bg-surface border border-line text-ink-secondary text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
