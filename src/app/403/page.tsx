"use client";

import React, { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import Link from "next/link";

function ForbiddenContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawCode = searchParams.get("code") || "access.denied";
  const displayCode = rawCode === "access.denied" ? "Standard Role Authorization Restriction" : rawCode;

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-xl border border-line max-w-md w-full p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full mx-auto flex items-center justify-center shadow-xs">
          <ShieldAlert className="w-8 h-8" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-ink">403 — Access Restricted</h1>
          <p className="text-xs text-ink-secondary leading-relaxed">
            You do not have permission to access this module or execute this operation under your currently assigned role permissions.
          </p>
        </div>

        <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-xs font-mono text-red-900">
          Required Scope: <span className="font-bold text-red-950">{displayCode}</span>
        </div>

        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-surface-muted hover:bg-primary-50 text-ink-secondary font-semibold text-xs rounded-lg transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1.5 shadow-xs"
          >
            <Home className="w-4 h-4" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ForbiddenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-8 text-xs text-ink-muted">Loading...</div>}>
      <ForbiddenContent />
    </Suspense>
  );
}
