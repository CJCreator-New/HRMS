/**
 * Notification deep-link mapping (WS-C §C5 / F-05).
 *
 * Pure, side-effect free: `inbox_notifications` carries a nullable `action_url`
 * (no `notification_type` column exists in the schema), so deep-linking prefers
 * `action_url` when the emitter supplied one, and otherwise derives the target
 * route from keywords in the title/message. Keeping this here makes the mapping
 * unit-testable and shared with the header bell.
 */

export interface NotificationLike {
  action_url?: string | null;
  title?: string | null;
  message?: string | null;
}

/**
 * Returns the route a notification should navigate to, or `null` when no
 * sensible target exists (the item can still be marked read).
 */
export function notificationActionUrl(n: NotificationLike): string | null {
  if (n.action_url) return n.action_url;

  const text = `${n.title || ""} ${n.message || ""}`.toLowerCase();

  // Offboarding / F&F first — these keywords are the most specific.
  if (/(ff settlement|f&f|clearance|offboarding|separation|last working day)/.test(text)) {
    return "/offboarding";
  }
  // Approvals inbox covers the pending request families.
  if (/(leave request|leave |attendance correction|reimbursement|expense claim|encashment|comp.?off|permission request|pending approval|awaiting approval|submitted)/.test(text)) {
    return "/approvals";
  }
  // Payroll lifecycle.
  if (/(payslip|payroll|revision)/.test(text)) {
    return "/payroll";
  }
  // Onboarding invitations land on the employee directory.
  if (/(onboarding|invited|welcome|credentials|account created)/.test(text)) {
    return "/employees";
  }

  return null;
}
