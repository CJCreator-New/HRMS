"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog for destructive / irreversible actions.
 * Built on the shared Modal (focus trap, Escape, scroll lock).
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} maxWidth="max-w-md" dataTestId="confirm-dialog">
      {description && (
        <div className="flex items-start gap-3">
          {danger && <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />}
          <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          data-testid="confirm-dialog-cancel"
          onClick={onCancel}
          className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-semibold transition"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          data-testid="confirm-dialog-confirm"
          onClick={onConfirm}
          className={`px-4 py-1.5 text-white text-xs font-semibold rounded-lg transition shadow-xs ${
            danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
