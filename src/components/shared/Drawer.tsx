"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string; // renders the header row (with close button) when provided
  ariaLabel?: string; // used when no title is rendered
  children: React.ReactNode;
  footer?: React.ReactNode;
  dataTestId?: string;
  side?: "right" | "left";
  /** Tailwind max-width class for the panel (defaults to a comfortable side panel). */
  width?: string;
  closeLabel?: string;
}

/**
 * Shared accessible side drawer (WS-B pattern library, consumed by the
 * approvals detail view F-03). Provides focus trapping, Escape dismissal,
 * body scroll locking, backdrop click-to-close, and focus restoration —
 * mirroring the `Modal` a11y contract (H-11).
 *
 * data-testid contract (approvals.spec.ts):
 *  - overlay root:  data-testid="drawer"
 *  - close button:  data-testid="drawer-close"
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  ariaLabel,
  children,
  footer,
  dataTestId = "drawer",
  side = "right",
  width = "max-w-md",
  closeLabel = "Close panel",
}: DrawerProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isLeft = side === "left";

  return (
    <div data-testid={dataTestId} className="fixed inset-0 z-drawer" role="presentation">
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={title ? "drawer-title" : undefined}
        className={`absolute top-0 h-full w-full ${width} bg-surface shadow-overlay flex flex-col ${
          isLeft ? "left-0" : "right-0"
        }`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h3 id="drawer-title" className="text-base font-bold text-ink">
              {title}
            </h3>
            <button
              onClick={onClose}
              aria-label={closeLabel}
              data-testid="drawer-close"
              className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-muted rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Drawer;
