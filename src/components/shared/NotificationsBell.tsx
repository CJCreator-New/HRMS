"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, X, ArrowUpRight } from "lucide-react";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/lib/actions/notifications";
import { notificationActionUrl } from "@/lib/services/notifications";

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  notification_type?: string;
  action_url?: string | null;
}

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const res = await getNotificationsAction();
    setNotifications((res.notifications || []) as Notification[]);
    setUnread(res.unread || 0);
  };

  useEffect(() => {
    load();
    // Poll every 60s as a background fallback
    const interval = setInterval(load, 60000);

    // Supabase real-time channel subscription
    let channel: any = null;
    try {
      const { createClient } = require("@/lib/supabase/client");
      const supabase = createClient();
      channel = supabase
        .channel("inbox_notifications_realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "inbox_notifications" },
          () => {
            load();
          }
        )
        .subscribe();
    } catch {
      // In offline / mock / unit test mode, fallback cleanly to interval polling
    }

    return () => {
      clearInterval(interval);
      if (channel) {
        try {
          const { createClient } = require("@/lib/supabase/client");
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnread((u) => Math.max(0, u - 1));
    await markNotificationReadAction(id);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    await markAllNotificationsReadAction();
  };

  // F-05 deep-link: mark read + navigate to the source record/action.
  const handleOpen = async (n: Notification) => {
    if (!n.is_read) await handleMarkRead(n.id);
    setOpen(false);
    const url = notificationActionUrl(n);
    if (url) router.push(url);
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    } catch {
      return "";
    }
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Notifications (${unread} unread)`}
        aria-expanded={open}
        className="relative p-2 text-ink-muted hover:text-ink rounded-lg hover:bg-surface-muted transition"
        title={`Notifications (${unread} unread)`}
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 bg-red-500 rounded-full ring-2 ring-white flex items-center justify-center px-0.5">
            <span className="text-[9px] font-bold text-white leading-none">{unread > 9 ? "9+" : unread}</span>
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Notifications panel"
          className="absolute right-0 top-full mt-2 w-80 bg-surface rounded-xl shadow-xl border border-line z-dropdown overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="text-xs font-bold text-ink">
              Notifications {unread > 0 && <span className="ml-1 text-red-600">({unread} new)</span>}
            </p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-primary-600 hover:text-primary-800 font-semibold flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} aria-label="Close notifications panel">
                <X className="w-3.5 h-3.5 text-ink-muted hover:text-ink" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-line">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-xs text-ink-faint">No notifications yet.</div>
            ) : (
              notifications.map((n) => {
                const url = notificationActionUrl(n);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleOpen(n)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 transition ${
                      !n.is_read ? "bg-primary-50/50" : "hover:bg-surface-muted"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                        !n.is_read ? "bg-primary-500" : "bg-transparent"
                      }`}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-semibold text-ink truncate">{n.title}</span>
                      <span className="block text-[11px] text-ink-secondary line-clamp-2">{n.body}</span>
                      <span className="block text-[10px] text-ink-faint mt-1">{formatTime(n.created_at)}</span>
                    </span>
                    {url && (
                      <span
                        aria-hidden="true"
                        className="shrink-0 mt-0.5 p-1 text-primary-500"
                        title="Open linked record"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
