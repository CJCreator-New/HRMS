"use client";

import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export function MockAuthBanner() {
  const [dismissed, setDismissed] = useState(false);
  const isMockAuth = process.env.NEXT_PUBLIC_MOCK_AUTH === "true";

  if (!isMockAuth || dismissed) return null;

  return (
    <aside
      aria-label="Development environment warning"
      className="bg-amber-500 text-amber-950 px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between shadow-sm z-50 sticky top-0"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-900" />
        <span>
          <strong className="font-semibold">MOCK AUTH MODE:</strong> Running with simulated dev personas. Set{" "}
          <code className="bg-amber-400/60 px-1 py-0.5 rounded font-mono text-[11px]">
            NEXT_PUBLIC_MOCK_AUTH=false
          </code>{" "}
          for real Supabase authentication.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-amber-600/30 rounded focus:outline-none focus:ring-1 focus:ring-amber-900"
        aria-label="Dismiss banner"
      >
        <X className="w-3.5 h-3.5 text-amber-950" />
      </button>
    </aside>
  );
}
