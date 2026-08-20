"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center p-6">
      <div className="bg-surface rounded-xl border border-line shadow-card max-w-md w-full p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" aria-hidden="true" />
        <h2 className="text-lg font-bold text-ink">Something went wrong</h2>
        <p className="text-xs text-ink-secondary">
          An unexpected error occurred while rendering this page
          {error?.digest ? ` (${error.digest})` : ""}. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try Again
        </button>
      </div>
    </div>
  );
}
