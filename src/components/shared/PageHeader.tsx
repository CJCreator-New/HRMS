"use client";

import React from "react";

/**
 * Shared page header bar — the standard white card header used across module
 * pages (WS-B pattern library). Consolidates the repeated
 * `bg-white p-6 rounded-xl border … justify-between` markup.
 */

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned action cluster (buttons / links / badges). */
  actions?: React.ReactNode;
  /** Optional data-testid applied to the <h2> (preserves existing E2E hooks). */
  testId?: string;
}

export function PageHeader({ icon, title, description, actions, testId }: PageHeaderProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-5">
      <div>
        <h2
          data-testid={testId}
          className="text-xl font-bold text-ink tracking-tight flex items-center gap-2"
        >
          {icon}
          <span>{title}</span>
        </h2>
        {description && <p className="text-xs text-ink-secondary mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 self-start sm:self-auto">{actions}</div>}
    </div>
  );
}

export default PageHeader;
