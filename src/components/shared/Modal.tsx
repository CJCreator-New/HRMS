"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string; // renders the header row (with close button) when provided
  ariaLabel?: string; // used when no title is rendered
  children: React.ReactNode;
  footer?: React.ReactNode;
  dataTestId?: string;
  closable?: boolean;
  placement?: "center" | "top";
  maxWidth?: string;
  closeLabel?: string;
}

/**
 * Shared accessible modal dialog. Provides focus trapping, Escape dismissal,
 * body scroll locking, and focus restoration to the triggering element.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  ariaLabel,
  children,
  footer,
  dataTestId = "modal",
  closable = true,
  placement = "center",
  maxWidth = "max-w-lg",
  closeLabel = "Close dialog",
}: ModalProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen || !closable) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closable, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid={dataTestId}
      onClick={(e) => {
        if (closable && e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-modal flex ${placement === "top" ? "items-start pt-20" : "items-center"} justify-center bg-slate-950/50 backdrop-blur-[2px] p-4`}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={title ? "modal-title" : undefined}
        className={`bg-surface rounded-xl shadow-overlay w-full ${maxWidth} p-6 space-y-4 max-h-[90vh] overflow-y-auto`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h3 id="modal-title" className="text-base font-bold text-ink">
              {title}
            </h3>
            {closable && (
              <button
                onClick={onClose}
                aria-label={closeLabel}
                data-testid="modal-close"
                className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-muted rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        {children}
        {footer && <div className="flex justify-end gap-2 pt-2 border-t border-line">{footer}</div>}
      </div>
    </div>
  );
}
