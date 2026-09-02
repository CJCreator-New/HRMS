"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  /** ReactNode so callers can embed a next-step link (F-06). */
  message: React.ReactNode;
  variant: ToastVariant;
}

interface ToastContextType {
  toast: (message: React.ReactNode, variant?: ToastVariant) => void;
  showToast: (message: React.ReactNode, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const AUTO_DISMISS_MS = 4500;
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: React.ReactNode, variant: ToastVariant = "success") => {
      const id = `toast-${++idRef.current}`;
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, variant }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const renderIcon = (variant: ToastVariant) => {
    if (variant === "error") return <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />;
    if (variant === "info") return <Info className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />;
    return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />;
  };

  return (
    <ToastContext.Provider value={{ toast, showToast: toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-toast space-y-2 max-w-sm w-full" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            data-testid="toast"
            data-variant={t.variant}
            className={`flex items-start gap-2.5 p-3.5 rounded-xl border shadow-raised text-xs font-semibold bg-surface ${
              t.variant === "error"
                ? "border-red-200 text-red-900"
                : t.variant === "info"
                ? "border-primary-200 text-primary-900"
                : "border-emerald-200 text-emerald-900"
            }`}
          >
            {renderIcon(t.variant)}
            <span className="flex-1 leading-relaxed">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              data-testid="toast-close"
              className="shrink-0 p-1 text-ink-muted hover:text-ink rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
