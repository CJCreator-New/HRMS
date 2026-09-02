"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Laptop, Smartphone, ShieldCheck, AlertCircle, Loader2, LogOut, CheckCircle2 } from "lucide-react";
import { listActiveSessionsAction, revokeSessionAction, type UserSessionItem } from "@/lib/actions/sessions";
import { useToast } from "@/components/shared/Toast";

export default function SessionsManagementPage() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    const res = await listActiveSessionsAction();
    if (res.success) {
      setSessions(res.sessions);
    } else {
      setError(res.error || "Failed to load active sessions.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevoke = (sessionId: string) => {
    startTransition(async () => {
      const res = await revokeSessionAction(sessionId);
      if (res.success) {
        showToast("Session revoked successfully.", "success");
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } else {
        showToast(res.error || "Failed to revoke session.", "error");
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Active Device Sessions</h1>
        <p className="text-sm text-ink-secondary">
          Review and manage browser and device sessions currently authenticated with your enterprise account.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-line p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary-600" />
            <h2 className="text-base font-semibold text-ink">Authenticated Sessions ({sessions.length})</h2>
          </div>
          <span className="text-xs text-ink-muted">
            Revoking a session will immediately terminate access on that device.
          </span>
        </div>

        <div className="divide-y divide-line">
          {sessions.map((s) => (
            <div key={s.id} className="py-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-surface-muted border border-line text-ink-secondary mt-0.5">
                  {s.device_type === "mobile" ? (
                    <Smartphone className="w-5 h-5" />
                  ) : (
                    <Laptop className="w-5 h-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-ink">
                      {s.user_agent || "Web Browser"}
                    </p>
                    {s.is_current && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Current Device
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-secondary">
                    IP: <span className="font-mono">{s.ip_address || "Hidden"}</span> • Last active:{" "}
                    {new Date(s.last_active_at).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {!s.is_current && (
                <button
                  onClick={() => handleRevoke(s.id)}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" /> Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
