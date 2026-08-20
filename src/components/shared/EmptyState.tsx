"use client";

import React from "react";
import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon = <FolderOpen className="w-8 h-8 text-ink-faint" aria-hidden="true" />,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 bg-surface-muted/50 rounded-xl border border-dashed border-line ${className}`}
    >
      <div className="p-3 bg-surface rounded-full shadow-xs border border-line mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {description && <p className="text-xs text-ink-secondary max-w-sm mt-1">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs rounded-lg transition shadow-xs"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
