"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Bell, Mail, Smartphone, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {
  getNotificationPreferencesAction,
  updateNotificationPreferencesAction,
  type NotificationPreferenceItem,
} from "@/lib/actions/notifications";
import { useToast } from "@/components/shared/Toast";

const MODULE_LABELS: Record<string, { title: string; desc: string }> = {
  leaves: {
    title: "Leave Requests & Approvals",
    desc: "Alerts when leave requests are submitted, approved, or rejected.",
  },
  payroll: {
    title: "Payroll & Payslips",
    desc: "Notifications when monthly payslips are published or revisions finalized.",
  },
  attendance: {
    title: "Attendance & Shifts",
    desc: "Reminders for missed punches, regularizations, and shift changes.",
  },
  documents: {
    title: "Documents & Expirations",
    desc: "Reminders for expiring compliance documents or new company policies.",
  },
  announcements: {
    title: "Company Announcements",
    desc: "Broad organization notices and critical security alerts.",
  },
};

export default function NotificationPreferencesPage() {
  const { showToast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPreferences() {
      setLoading(true);
      const res = await getNotificationPreferencesAction();
      if (res.success) {
        setPreferences(res.preferences);
      } else {
        setError(res.error || "Failed to load notification settings.");
      }
      setLoading(false);
    }
    loadPreferences();
  }, []);

  const togglePreference = (module: string, channel: "email" | "inApp") => {
    setPreferences((prev) =>
      prev.map((item) => {
        if (item.module === module) {
          return {
            ...item,
            emailEnabled: channel === "email" ? !item.emailEnabled : item.emailEnabled,
            inAppEnabled: channel === "inApp" ? !item.inAppEnabled : item.inAppEnabled,
          };
        }
        return item;
      })
    );
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateNotificationPreferencesAction(preferences);
      if (res.success) {
        showToast("Notification preferences updated successfully!", "success");
      } else {
        setError(res.error || "Failed to save preferences.");
        showToast(res.error || "Update failed", "error");
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
        <h1 className="text-2xl font-bold text-ink">Notification Preferences</h1>
        <p className="text-sm text-ink-secondary">
          Configure how and when you receive automated notifications across enterprise communication channels.
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
            <Bell className="w-5 h-5 text-primary-600" />
            <h2 className="text-base font-semibold text-ink">Channel Delivery Matrix</h2>
          </div>
          <div className="flex items-center gap-8 text-xs font-semibold text-ink-muted uppercase">
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> Email
            </span>
            <span className="flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" /> In-App
            </span>
          </div>
        </div>

        <div className="divide-y divide-line">
          {preferences.map((item) => {
            const meta = MODULE_LABELS[item.module] || {
              title: item.module.toUpperCase(),
              desc: `Notifications regarding ${item.module}`,
            };

            return (
              <div key={item.module} className="py-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-ink">{meta.title}</p>
                  <p className="text-xs text-ink-secondary">{meta.desc}</p>
                </div>

                <div className="flex items-center gap-8 flex-shrink-0">
                  {/* Email checkbox */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.emailEnabled}
                      onChange={() => togglePreference(item.module, "email")}
                      className="w-4 h-4 text-primary-600 rounded border-line focus:ring-primary-500"
                    />
                  </label>

                  {/* In-App checkbox */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.inAppEnabled}
                      onChange={() => togglePreference(item.module, "inApp")}
                      className="w-4 h-4 text-primary-600 rounded border-line focus:ring-primary-500"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-4 border-t border-line">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-6 py-2.5 rounded-lg bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 transition focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Save Preferences
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
