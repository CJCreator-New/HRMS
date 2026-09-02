export interface RouteGate {
  path: string;
  name: string;
  description?: string; // shown as header subtitle + used for contextual hints
  category: "MY WORK" | "PEOPLE" | "PAY" | "ADMIN";
  parent?: string; // parent route path for breadcrumbs / sidebar grouping (e.g. "/employees/import" -> "/employees")
  requiredPermissions: string[]; // User must hold ANY of these to pass gate (union)
  public?: boolean;
}

export const ROUTE_CONFIG: RouteGate[] = [
  {
    path: "/login",
    name: "Sign In",
    category: "MY WORK",
    requiredPermissions: [],
    public: true,
    description: "Sign in with your organizational credentials.",
  },
  {
    path: "/",
    name: "Dashboard",
    category: "MY WORK",
    requiredPermissions: ["employee.view.self"],
    description: "Role-aware workspace with quick actions and an operational overview.",
  },
  {
    path: "/approvals",
    name: "My Approvals",
    category: "MY WORK",
    requiredPermissions: [
      "attendance.correct.approve",
      "leave.approve.manager",
      "leave.approve.hr",
      "leave.cancel.approve",
      "compoff.approve",
      "permission.approve",
      "reimbursement.approve",
      "leave.encash.approve",
      "ff.approve",
    ],
    description: "Unified approval inbox for leave, attendance, reimbursements, encashment, and F&F.",
  },
  {
    path: "/attendance",
    name: "Attendance & Punch",
    category: "MY WORK",
    requiredPermissions: ["attendance.view.self", "attendance.view.team", "attendance.view.all"],
    description: "Punch check-in/out, daily logs, and correction requests.",
  },
  {
    path: "/leave",
    name: "Leave Engine",
    category: "MY WORK",
    requiredPermissions: ["leave.view.self", "leave.view.team", "leave.view.all"],
    description: "Leave balances, applications, comp-off credits, and the approval queue.",
  },
  {
    path: "/reimbursements",
    name: "Expense Claims",
    category: "MY WORK",
    requiredPermissions: ["reimbursement.apply.self", "reimbursement.view.team", "reimbursement.view.all"],
    description: "Submit expense claims with receipts and track approval routing.",
  },
  {
    path: "/permissions",
    name: "Short Permissions",
    category: "MY WORK",
    requiredPermissions: ["permission.apply.self", "permission.approve"],
    description: "Short permissions and comp-off grants.",
  },
  {
    path: "/calendar",
    name: "Work Calendar",
    category: "MY WORK",
    requiredPermissions: ["employee.view.self", "settings.manage"],
    description: "Work calendar templates, holidays, and optional holiday selection.",
  },
  {
    path: "/employees",
    name: "Employee Directory",
    category: "PEOPLE",
    requiredPermissions: ["employee.view.self", "employee.view.team", "employee.view.all"],
    description: "Employee profiles, departments, and access status.",
  },
  {
    path: "/employees/import",
    name: "Bulk Employee Import",
    category: "PEOPLE",
    parent: "/employees",
    requiredPermissions: ["employee.import"],
    description: "Bulk CSV employee import with row-level validation.",
  },
  {
    path: "/onboarding",
    name: "Direct Onboarding",
    category: "PEOPLE",
    requiredPermissions: ["employee.create"],
    description: "Direct admin onboarding with temporary credentials (ADR 0001).",
  },
  {
    path: "/departments",
    name: "Departments",
    category: "PEOPLE",
    requiredPermissions: ["employee.view.all", "settings.manage"],
    description: "Department master and effective-dated assignments.",
  },
  {
    path: "/offboarding",
    name: "Offboarding & F&F",
    category: "PEOPLE",
    requiredPermissions: ["separation.view", "ff.view", "offboarding.manage"],
    description: "Resignations, clearance boards, and F&F settlements.",
  },
  {
    path: "/salary",
    name: "Salary Structures",
    category: "PAY",
    requiredPermissions: ["salary.view.self", "salary.view.all"],
    description: "Salary components and per-employee versioned structures.",
  },
  {
    path: "/payroll",
    name: "Payroll Operations",
    category: "PAY",
    requiredPermissions: ["payroll.view", "payroll.run"],
    description: "Payroll periods, lock verification, bulk runs, and payslips.",
  },
  {
    path: "/eligibility",
    name: "Payroll Eligibility",
    category: "PAY",
    requiredPermissions: ["payroll.view", "payroll.run"],
    description: "Binary payroll eligibility and suspension treatment.",
  },
  {
    path: "/statutory",
    name: "Statutory Engine",
    category: "PAY",
    requiredPermissions: ["statutory.view"],
    description: "PF/ESI/PT/TDS statutory profiles and rule versions.",
  },
  {
    path: "/encashment",
    name: "Leave Encashment",
    category: "PAY",
    requiredPermissions: ["leave.encash.apply.self", "leave.encash.approve"],
    description: "Leave encashment requests and the carry-forward log.",
  },
  {
    path: "/documents",
    name: "Document Attachments",
    category: "ADMIN",
    requiredPermissions: ["attachment.view"],
    description: "Polymorphic document attachments and receipts.",
  },
  {
    path: "/settings",
    name: "Company Settings",
    category: "ADMIN",
    requiredPermissions: ["settings.manage"],
    description: "Company settings, policies, and the zero-seed configuration gate.",
  },
  {
    path: "/audit",
    name: "System Audit Trail",
    category: "ADMIN",
    requiredPermissions: ["audit.view"],
    description: "Immutable system audit trail.",
  },
  {
    path: "/jobs",
    name: "Scheduled Jobs",
    category: "ADMIN",
    requiredPermissions: ["job.view", "job.rerun"],
    description: "Scheduled background jobs status and manual triggers.",
  },
  {
    path: "/reports",
    name: "Executive Reports",
    category: "ADMIN",
    requiredPermissions: ["reports.export"],
    description: "Executive and compliance report exports.",
  },
];

/**
 * Resolve the route gate for a pathname. Exact match first; for unknown nested
 * paths (e.g. future child routes) fall back to the longest registered prefix
 * so middleware gating and header context stay consistent.
 */
export function getRouteConfig(pathname: string): RouteGate | undefined {
  const exact = ROUTE_CONFIG.find((r) => r.path === pathname);
  if (exact) return exact;
  return ROUTE_CONFIG.filter((r) => pathname.startsWith(`${r.path}/`)).sort(
    (a, b) => b.path.length - a.path.length
  )[0];
}

/**
 * Breadcrumb trail (root excluded) for a pathname, resolved through the
 * `parent` chain. Used by the Breadcrumbs component and E2E navigation specs.
 */
export function getBreadcrumbs(pathname: string): RouteGate[] {
  const current = getRouteConfig(pathname);
  if (!current || current.public || current.path === "/") return [];
  const chain: RouteGate[] = [];
  let node: RouteGate | undefined = current;
  while (node) {
    chain.unshift(node);
    node = node.parent ? getRouteConfig(node.parent) : undefined;
  }
  return chain;
}
