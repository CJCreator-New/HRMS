# HRMS v2.7 — Python + Playwright Testing Architecture

**Document Version:** 1.0.0  
**Author:** Lead QA Automation Engineer & Software Architect  
**Framework Stack:** Python 3.13 + pytest 9.0 + pytest-playwright 0.7 + Playwright 1.55  
**Target Application:** Enterprise HRMS (Next.js 16.3 App Router, React 18.3, PostgreSQL / Supabase)

---

## 1. Repository Discovery & System Context

### 1.1 Architecture & Technology Stack
- **Frontend**: Next.js 16.3 App Router with React Server Components (RSC) and hydrated Client Component islands (`'use client'`).
- **Styling & Design System**: Tailwind CSS 3.4 with custom semantic tokens (`bg-surface`, `text-ink`, `border-line`, `primary-*`, `status-*`).
- **Backend & Data**: Next.js Server Actions (`src/lib/actions/*.ts`) communicating with Supabase PostgreSQL (24 modular schemas).
- **Authentication**:
  - **Offline Mock Mode (`NEXT_PUBLIC_MOCK_AUTH=true`)**: Cryptographically signed cookie `mock_auth_token` with HMAC-SHA256 signature (`hrms_mock_${base64Payload}.${sig}`).
  - **Live Backend Mode (`NEXT_PUBLIC_MOCK_AUTH=false`)**: Supabase Auth tokens (`sb-*-auth-token`) with database-level RLS policies.
- **Access Control & RBAC**:
  - 8 System Roles: `system_admin`, `hr`, `payroll_admin`, `manager`, `employee`, plus 3 dormant roles (`statutory_admin`, `finance_admin`, `it_admin`).
  - 62 Distinct Permission Codes (`permissions-map.ts` synchronized with `schema/01_rbac.sql`).
  - Strict self-approval prevention (applicants cannot approve their own leaves, expenses, attendance corrections, or F&F clearances).

### 1.2 Route & Feature Inventory (22 Functional Routes)
1. `/` (Executive Dashboard & Quick Actions)
2. `/login` (Authentication & Forgot Password)
3. `/403` (Unauthorized Route Fallback)
4. `/approvals` (Unified Approvals Inbox: Leave, Attendance, Expenses, Resignations)
5. `/attendance` (Daily Punch, Timesheet, Regularization Requests, Overtime)
6. `/audit` (System Audit Trail Logs & Filterable Change Events)
7. `/calendar` (Work Calendars, Holiday Schedules, Shift Template Management)
8. `/departments` (Org Hierarchy, Department Heads, Cost Center Mapping)
9. `/documents` (Company Policies, Employee Document Store)
10. `/eligibility` (Payroll Inclusion/Exclusion Rules, Hold Lists)
11. `/employees` (Employee Directory, Profile Details, Status Transitions)
12. `/encashment` (Annual Leave Encashment Workflow & Calculations)
13. `/jobs` (Automated Cron Job Execution & Audit Logs)
14. `/leave` (Leave Ledger, Balance Quotas, Overlap Validator, Applications)
15. `/offboarding` (Resignations, Department Clearance Checklist, F&F Settlement)
16. `/onboarding` (4-Step Direct Employee Onboarding Wizard)
17. `/payroll` (5-Step Monthly Payroll Wizard, Revision Guards, Payslip Generator)
18. `/permissions` (Monthly Short Permissions 120-min Quota, Comp-off Credits)
19. `/reimbursements` (Two-Stage Expense Claim FSM: Manager $\rightarrow$ HR)
20. `/reports` (Salary Registers, EPFO/ESIC Statutory ECR Exports)
21. `/salary` (Salary Component Structures, CTC Revisions, Pay Grades)
22. `/settings` (Company Profile, Global Policy Toggles, Sandbox Resets)
23. `/statutory` (PF ₹15k wage cap, ESI ₹21k limit, PT slabs, TDS configurations)
24. `/api/health` (System Health & Uptime Diagnostics)

---

## 2. Proposed Python + Playwright Architecture

```
tests/
├── __init__.py
├── conftest.py                   # Pytest hooks, browser management, console/network error trapping, artifacts
├── pytest.ini                    # Pytest configuration, markers, timeout, CLI flags
├── requirements.txt              # Python testing dependencies
│
├── fixtures/                     # Test Fixtures & Personas
│   ├── __init__.py
│   ├── personas.py               # 14 Seeded Test Personas definition & credentials
│   ├── auth_fixtures.py          # Session cookies, storage states, fast role injectors
│   └── page_fixtures.py          # Role-based authenticated page fixtures
│
├── pages/                        # Page Object Model (POM)
│   ├── __init__.py
│   ├── base_page.py              # Base class: navigation, headers, toasts, accessibility, wait helpers
│   ├── login_page.py             # Login, password reset, error feedback
│   ├── dashboard_page.py         # Dashboard metrics, punch card, role greeting
│   ├── attendance_page.py        # Punch bar, regularization modal, timesheet table
│   ├── leave_page.py             # Leave balance cards, apply modal, inline overlap warning
│   ├── payroll_page.py           # 5-step stepper, run cycle, finalize, publish, payslips
│   ├── employees_page.py         # Directory table, search, status filter, batch upload
│   ├── approvals_page.py         # Unified inbox, filter tabs, single & batch approvals
│   ├── onboarding_page.py        # 4-step hire stepper wizard
│   ├── offboarding_page.py       # Resignation submit, clearance checklist, F&F draft
│   ├── reimbursements_page.py    # Expense claim creation, receipt attachments, multi-stage review
│   ├── permissions_page.py       # Short permission quota badge, comp-off request
│   └── settings_page.py          # Policy toggles, sandwich rules, company info
│
├── components/                   # Reusable UI Component Objects
│   ├── __init__.py
│   ├── sidebar.py                # Desktop & mobile drawer navigation, active routes
│   ├── header.py                 # Role switcher, search trigger, notifications, profile
│   ├── datatable.py              # Generic table: pagination, sort, search debounce, empty state
│   ├── modal.py                  # Accessible dialogs, confirm destructive dialogs
│   └── punch_button.py           # Interactive clock-in/out button states & timers
│
├── flows/                        # End-to-End Golden Path Workflows
│   ├── __init__.py
│   ├── hire_to_payslip_flow.py   # GP-01: Complete lifecycle flow
│   ├── anomaly_to_lock_flow.py   # GP-02: Attendance anomaly $\rightarrow$ payroll lock
│   ├── leave_sandwich_flow.py    # GP-03: Weekend sandwich deduction verification
│   ├── compoff_lifecycle_flow.py # GP-04: Extra work credit $\rightarrow$ 90-day expiry $\rightarrow$ leave
│   ├── expense_to_payslip_flow.py# GP-05: Multi-stage reimbursement $\rightarrow$ payroll line item
│   └── resignation_to_ff_flow.py # GP-06: Resignation $\rightarrow$ clearance $\rightarrow$ F&F payout
│
├── utils/                        # Utilities & Security Helpers
│   ├── __init__.py
│   ├── cookie_signer.py          # Cryptographic HMAC-SHA256 mock cookie generator
│   ├── error_tracker.py          # JS console error & unhandled exception collector
│   ├── axe_helper.py             # Automated WCAG 2.1 AA accessibility scanner
│   └── assertions.py             # Domain-specific assertions & matchers
│
├── test_smoke/                   # P0 Smoke & Basic Health
│   └── test_smoke.py             # Health check, login redirect, invalid login
│
├── test_auth/                    # Authentication & Session Behavior
│   └── test_auth_flows.py        # Password reset, session persistence, logout
│
├── test_rbac/                    # RBAC Route Authorization Matrix
│   └── test_route_matrix.py      # 14 personas × 22 routes access matrix
│
├── test_navigation/              # Navigation & Wayfinding
│   └── test_navigation.py        # Sidebar, Header, Breadcrumbs, Command Palette (Ctrl+K)
│
├── test_forms/                   # Form Validation & Interactive Inputs
│   └── test_form_validation.py   # Inline overlap check, quota limits, required fields
│
├── test_buttons/                 # Interactive Controls & States
│   └── test_interactive_controls.py # PunchButton, disabled states, double-submit locks
│
├── test_workflows/               # End-to-End Golden Paths
│   ├── test_gp01_hire_to_payslip.py
│   ├── test_gp02_anomaly_lock.py
│   ├── test_gp03_leave_sandwich.py
│   ├── test_gp04_compoff_lifecycle.py
│   ├── test_gp05_expense_to_payslip.py
│   ├── test_gp06_resignation_to_ff.py
│   ├── test_gp07_hr_self_approval.py
│   └── test_gp08_multi_role_union.py
│
├── test_responsive/              # Responsive & Mobile Viewports
│   └── test_responsive_layout.py # Mobile drawer, table horizontal scroll, card stacking
│
├── test_errors/                  # Error Handling & Edge Cases
│   └── test_error_states.py      # 403 Forbidden, 404 Not Found, Error boundaries, Retries
│
└── test_accessibility/           # Automated WCAG 2.1 AA Checks
    └── test_a11y.py              # Automated accessibility scans across all pages
```

---

## 3. High-Speed Authentication Strategy (Cookie Signer)

Instead of forcing a slow browser login submission before every single test (which adds 1–2s per test), the test framework introduces `utils/cookie_signer.py`:
- Replicates the application's HMAC-SHA256 cookie generator (`src/lib/auth/mock-cookie.ts`).
- Generates valid `mock_auth_token` cookies instantly with the secret `process.env.MOCK_AUTH_SECRET || "hrms_mock_auth_secret_dev_key_2026"`.
- Injects the signed cookie directly into the Playwright `BrowserContext` via `context.add_cookies()`.
- Yields instantaneous authenticated sessions for any of the 14 personas without UI overhead, while still providing dedicated UI login tests in `test_smoke/` and `test_auth/`.

---

## 4. Multi-Browser & Responsive Viewport Strategy

### 4.1 Supported Browsers
- **Chromium** (Default desktop engine)
- **Firefox** (Gecko engine compatibility)
- **WebKit** (Safari engine compatibility)

### 4.2 Standard Responsive Viewports
| Device Profile | Viewport Dimensions | Target Testing Scenarios |
|---|---|---|
| **Mobile Portrait (Small)** | 375 × 667 (iPhone SE) | Hamburger toggle, mobile drawer navigation, card stacking |
| **Mobile Portrait (Standard)**| 390 × 844 (iPhone 13/14) | PunchBar mobile touch target, dialog responsive bounds |
| **Tablet Portrait** | 768 × 1024 (iPad Mini) | Collapsible sidebar, table horizontal scroll containment |
| **Laptop / Desktop** | 1280 × 800 | Full sidebar, multi-column dashboard, split stepper |
| **Large Desktop** | 1920 × 1080 | Full data table layouts, wide financial reports |

---

## 5. Artifacts, Tracing & Error Monitoring

- **Screenshots on Failure**: Captured automatically to `test-results/screenshots/` only when a test fails.
- **Playwright Traces**: Saved on first retry / failure to `test-results/traces/` (viewable via `playwright show-trace`).
- **Console & Network Error Tracking**: `ErrorTracker` listens to `page.on("console")` and `page.on("pageerror")`, surfacing unhandled React errors, missing chunk errors, or unhandled promise rejections directly in the test failure report.
- **HTML Test Reports**: Generated via `pytest-html` to `test-results/report.html`.

---

## 6. Execution Plan & Next Steps

1. Create `requirements.txt` and install dependencies (`pytest`, `pytest-playwright`, `pytest-html`, `pytest-xdist`).
2. Install Playwright browser binaries (`playwright install chromium firefox webkit`).
3. Implement `tests/utils/`, `tests/fixtures/`, and `tests/conftest.py`.
4. Implement Page Objects and Component Objects in `tests/pages/` and `tests/components/`.
5. Implement complete test suites across Smoke, Auth, RBAC Matrix, Forms, Controls, Golden Paths, Responsive, Errors, and Accessibility.
6. Launch local Next.js server and execute full test runs across Chromium, Firefox, WebKit, and mobile viewports.
7. Compile final test execution results, defect findings, and coverage metrics.
