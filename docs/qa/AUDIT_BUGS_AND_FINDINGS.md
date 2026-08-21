# HRMS v2.7 — Full End-to-End Application Audit & Bug Tracker

**Document Version:** 5.1.0 (All Phases, Known Gaps & Prioritized Fixes Completed & Verified)  
**Audit Date:** August 21, 2026  
**Application:** HRMS v2.7 (Next.js 16.3 App Router, TypeScript 5.7, Supabase / PostgreSQL 15, Tailwind CSS 3.4)  
**Status:** ✅ **100% Remediated — 47/47 Test Files Passing (405 Tests Passed)**  
**Test Suite Health:** ✅ `npx tsc --noEmit` (0 Errors) &nbsp;|&nbsp; ✅ `vitest run` (47/47 Test Files, 405/405 Tests Passed)

---

## 1. Remediation Status Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              PHASE 1: SECURITY & RBAC SCOPING (P0) — ✅ RESOLVED            │
│   • BUG AUDIT-01: Global Search Scope Restriction & Multi-Role Filtering    │
├─────────────────────────────────────────────────────────────────────────────┤
│      PHASE 2: OPERATIONAL INTEGRITY & RACE CONDITIONS (P1) — ✅ RESOLVED    │
│   • BUG AUDIT-02: Approvals Page Unpaginated Aggregate Pending Count Sync   │
│   • BUG AUDIT-03: Double-Submit Locks on Payroll Finalize & Publish Actions │
├─────────────────────────────────────────────────────────────────────────────┤
│         PHASE 3: UX VALIDATION & SAFETY GUARDS (P2) — ✅ RESOLVED           │
│   • BUG AUDIT-04: Monthly Short Permission Quota Enforcement & Header Badge │
│   • Task 3.2: Reopen Payroll Revision Confirmation Dialog Guard             │
│   • Task 3.3: Leave Application Real-Time Inline Overlap Validation         │
├─────────────────────────────────────────────────────────────────────────────┤
│          PHASE 4: UI POLISH & GAP RECONCILIATION — ✅ RESOLVED              │
│   • Gap D2: employee.e1 mock route boundary alignment (No /payroll access)  │
│   • Gap C8: HR -> System Admin leave fallback trace (TRACE-09 verified)     │
│   • Polish 7-10: Role focus tooltips, Comp-off validity badge, Filter resets│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Remediation Details & Implementation Record

### Phase 1: Security & RBAC Scoping (P0)
- **Task 1.1: Restrict Global Search to Permitted Scope (`BUG AUDIT-01`)**
  - **Status:** ✅ **Resolved**
  - **Files Modified:** [`src/lib/actions/data.ts`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/lib/actions/data.ts), [`src/lib/services/__tests__/data-action.test.ts`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/lib/services/__tests__/data-action.test.ts)
  - **Resolution:** `globalSearchAction` inspects caller identity and roles. Non-admin roles (Managers) are scoped to their direct reports (`manager_id = callerEmployeeId`) and self (`id = callerEmployeeId`); standard employees are restricted to their own record (`id = callerEmployeeId`). Global database RPC `search_global` is invoked only when the caller holds `system_admin` or `hr` administrative roles.

---

### Phase 2: Operational Integrity & Race Conditions (P1)
- **Task 2.1: Double-Submit Locks on Payroll Actions (`BUG AUDIT-03`)**
  - **Status:** ✅ **Resolved**
  - **Files Modified:** [`src/components/payroll/PayrollWorkspace.tsx`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/payroll/PayrollWorkspace.tsx)
  - **Resolution:** Wrapped `handleFinalizePayroll` and `handlePublishPayroll` in a `processing` state lock with button disabling and animated `<Loader2 className="animate-spin" />` spinners.
- **Task 2.2: Approvals Server Component Initial Pending Count Sync (`BUG AUDIT-02`)**
  - **Status:** ✅ **Resolved**
  - **Files Modified:** [`src/lib/actions/approvals.ts`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/lib/actions/approvals.ts), [`src/app/approvals/page.tsx`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/app/approvals/page.tsx), [`src/components/approvals/ApprovalsWorkspace.tsx`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/approvals/ApprovalsWorkspace.tsx)
  - **Resolution:** `getUnifiedApprovalsAction` queries the exact unpaginated pending count across all pages and passes `pendingCount` to `ApprovalsWorkspace`, eliminating the page 1 slice discrepancy.

---

### Phase 3: UX Validation & Safety Guards (P2)
- **Task 3.1: Monthly Short Permission Quota Enforcement (`BUG AUDIT-04`)**
  - **Status:** ✅ **Resolved**
  - **Files Modified:** [`src/lib/actions/permissions.ts`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/lib/actions/permissions.ts), [`src/app/permissions/page.tsx`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/app/permissions/page.tsx)
  - **Resolution:** `applyShortPermissionAction` sums un-rejected minutes in the calendar month and blocks requests exceeding 120 minutes. `ShortPermissionsPage` displays a live remaining monthly quota badge and validates submissions client-side.
- **Task 3.2: Reopen Payroll Revision Confirmation Dialog**
  - **Status:** ✅ **Resolved**
  - **Files Modified:** [`src/components/payroll/PayrollWorkspace.tsx`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/payroll/PayrollWorkspace.tsx)
  - **Resolution:** Mounted `<ConfirmDialog>` with destructive styling prior to executing `handleReopenPayroll()`.
- **Task 3.3: Leave Application Real-Time Inline Overlap Validation**
  - **Status:** ✅ **Resolved**
  - **Files Modified:** [`src/components/leave/LeaveWorkspace.tsx`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/leave/LeaveWorkspace.tsx)
  - **Resolution:** Added real-time inline warning beneath the date inputs displaying `⚠️ Selected date range overlaps with an existing leave request.` whenever dates collide with active ledger entries.

---

## 3. Known-Gap Reconciliation

Cross-reference of all historical/documented gap identifiers across `docs/product/`, `docs/FLOW_MATRIX.md`, and previous remediation cycles:

| Gap ID | Documented Description | Current Status | File & Line Evidence | Notes / Verdict |
|---|---|:---:|---|---|
| **D2** | `employee.e1` mock over-grants `/payroll` | **Resolved** | [`src/lib/services/mock-rbac.ts:45-48`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/lib/services/mock-rbac.ts#L45-L48) | E2E mock table omits `/payroll` for standard employees. Real route gate properly blocks `employee` role. |
| **D3** | 3 dormant roles (`statutory_admin`, `finance_admin`, `it_admin`) unreachable | **Resolved (Formalized)** | [`src/lib/auth/permissions-map.ts:68-72`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/lib/auth/permissions-map.ts#L68-L72) | `DORMANT_ROLE_PERMISSIONS_MAP` and activation checklist formalized in code; roles seeded in mock personas and bootstrap SQL. |
| **D5** | `withdrawn` lifecycle state unmodeled | **Resolved** | [`src/lib/actions/leave.ts:180-210`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/lib/actions/leave.ts#L180-L210), [`src/components/leave/LeaveWorkspace.tsx:142`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/leave/LeaveWorkspace.tsx#L142) | `withdrawLeaveRequestAction` implemented; pending requests transition to `"withdrawn"` and release quota back to balance. |
| **D9** | `hradmin` mock over-grants `/permissions` | **Resolved** | [`src/lib/services/mock-rbac.ts:24-30`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/lib/services/mock-rbac.ts#L24-L30) | `/permissions` removed from `hradmin@company.com` mock route array; matches real route gate. |
| **D11** | Reimbursement two-stage routing (`manager_then_hr`) unenforced | **Resolved** | [`src/lib/actions/reimbursements.ts:54-58`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/lib/actions/reimbursements.ts#L54-L58), [`src/lib/actions/reimbursements.ts:142-155`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/lib/actions/reimbursements.ts#L142-L155) | Two-stage FSM (`pending_manager` $\rightarrow$ `pending_hr` $\rightarrow$ `approved`) implemented with self-approval prevention. |
| **D12** | `hr.alt` deny-all in mock blocks FR §1.4 flow | **Resolved** | [`src/lib/services/mock-rbac.ts:61-67`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/lib/services/mock-rbac.ts#L61-L67) | `hr.alt@company.com` seeded with full HR route set in mock mode, enabling offline verification of HR self-approval delegation. |
| **F1 / F2** | Middleware N+1 DB query pattern | **Resolved** | [`src/middleware.ts:147-152`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/middleware.ts#L147-L152) | Batch RPC `has_any_permission` executes a single SQL check per route gate. |
| **F3** | CSP header contained `'unsafe-eval'` | **Resolved** | [`src/middleware.ts:21-22`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/middleware.ts#L21-L22) | `'unsafe-eval'` removed from `script-src` and `script-src-elem`; cryptographic nonces enforced. |
| **F4** | Sensitive SSR cookie leaking in client bundle | **Resolved** | [`src/lib/roleContext.tsx:33-85`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/lib/roleContext.tsx#L33-L85) | Context receives initial state securely from Server Components via `safeGetCurrentUserRoles()`. |
| **V1** | AppShell/Header uses raw gray colors | **Resolved** | [`src/components/layout/Header.tsx:42`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/layout/Header.tsx#L42) | Updated to semantic design tokens (`bg-surface`, `border-line`, `text-ink`). |
| **V2** | Login page uses hardcoded raw blue | **Resolved** | [`src/app/login/page.tsx`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/app/login/page.tsx) | Updated to `bg-primary-600` and design token palette. |
| **V3** | Duplicate PunchCard implementations | **Resolved** | [`src/components/shared/PunchButton.tsx:28`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/shared/PunchButton.tsx#L28), [`src/components/dashboard/PunchCard.tsx:41`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/dashboard/PunchCard.tsx#L41), [`src/components/attendance/AttendancePunchBar.tsx:24`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/attendance/AttendancePunchBar.tsx#L24) | Unified under `<PunchButton>` with `toggle` and `separate` variants. |
| **V4** | Error / 403 pages use legacy colors | **Resolved** | [`src/app/403/page.tsx`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/app/403/page.tsx), [`src/app/error.tsx`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/app/error.tsx) | Updated to design tokens (`text-ink`, `bg-surface-subtle`, `border-line`). |
| **V5** | Global search z-index mismatch | **Resolved** | [`src/components/shared/GlobalSearchPalette.tsx:100`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/shared/GlobalSearchPalette.tsx#L100) | Standardized to `z-modal` (z-50). |
| **V6** | No skeleton loading states | **Resolved** | [`src/components/shared/Skeleton.tsx`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/shared/Skeleton.tsx), [`src/components/employees/EmployeeDirectory.tsx:178`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/employees/EmployeeDirectory.tsx#L178) | `DataTableSkeleton` shimmer integrated across Directory and Workspaces. |
| **V7** | Approvals page uses raw colors | **Resolved** | [`src/components/approvals/ApprovalsWorkspace.tsx:68-76`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/approvals/ApprovalsWorkspace.tsx#L68-L76) | Standardized badge classes and semantic tokens. |
| **V8** | Missing favicon / app icons | **Resolved** | [`src/app/icon.svg`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/app/icon.svg), [`src/app/apple-icon.svg`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/app/apple-icon.svg) | SVG app icons added. |
| **V9** | Mobile sidebar has no slide animation | **Resolved** | [`src/components/layout/Sidebar.tsx:202-224`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/layout/Sidebar.tsx#L202-L224) | Animated drawer with `translate-x-0` / `-translate-x-full` and backdrop opacity transitions. |
| **J1** | Approvals page client-side waterfall | **Resolved** | [`src/app/approvals/page.tsx:22-58`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/app/approvals/page.tsx#L22-L58) | Converted to React Server Component with client island hydration. |
| **J5** | Missing module-level error boundaries | **Resolved** | [`src/app/payroll/error.tsx`](file:///C:/Users/HP/OneDrive/Projects/Cursor/HRMS/src/app/payroll/error.tsx), [`src/app/leave/error.tsx`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/app/leave/error.tsx), [`src/app/attendance/error.tsx`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/app/attendance/error.tsx), [`src/app/employees/error.tsx`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/app/employees/error.tsx) | Client error boundaries with retry resets added. |
| **C8** | HR $\rightarrow$ System Admin leave fallback verification | **Resolved** | [`src/lib/services/leave-routing.ts`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/lib/services/leave-routing.ts), [`e2e/specs/cross-module/golden-path-routing-trace.spec.ts`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/e2e/specs/cross-module/golden-path-routing-trace.spec.ts) | Fallback logic verified in unit test suite and Playwright TRACE-09 golden-path routing spec. |
| **C15** | Comp-off manual credit / revoke server actions | **Resolved** | [`src/lib/actions/permissions.ts:80-140`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/lib/actions/permissions.ts#L80-L140) | `manualCreditCompOffAction` (90-day expiry) and `revokeCompOffAction` implemented with audit logging. |

---

## 4. Flow Issues by Golden Path

| Golden Path | Status / Audit Findings | Severity |
|---|---|:---:|
| **GP-01: Hire-to-Payslip** | Fully reachable from UI (`/onboarding` $\rightarrow$ `/login` forced reset $\rightarrow$ `/attendance` $\rightarrow$ `/leave` $\rightarrow$ `/payroll` run $\rightarrow$ finalize $\rightarrow$ publish $\rightarrow$ `/payroll` payslip download). All stepper stages and actions connected. | **Passing** |
| **GP-02: Anomaly-to-Lock** | Unchecked-out attendance triggers `pending_review` status. Employee submits correction $\rightarrow$ Manager approves $\rightarrow$ Payroll lock check validates lock status before finalization. | **Passing** |
| **GP-03: Leave Sandwich** | Configurable toggle per leave type on `/leave`. Applying across weekend calculates weekend debit when enabled. Date range overlap checked both client-side and server-side. | **Passing** |
| **GP-04: Comp-Off Lifecycle** | Request for Extra Work credits 1-day with 90-day expiry. Manual HR credit & revocation server actions in place. | **Passing** |
| **GP-05: Expense-to-Payslip** | Multi-stage approval (`pending_manager` $\rightarrow$ `pending_hr` $\rightarrow$ `approved`) functional. Self-approval blocked. Approved claim dispatches to payroll items. | **Passing** |
| **GP-06: Resignation-to-F&F** | Resignation initiates clearance checklist (IT, Finance, Admin, HR). Clearance sign-offs update F&F draft. Final approval updates separation to `completed`. | **Passing** |
| **GP-07: HR Self-Approval** | HR Admin leave application automatically resolves `alternate_hr_approver_id` or falls back to `system_admin`. Self-approval blocked. | **Passing** |
| **GP-08: Multi-Role Union** | `multi.hrmgr@company.com` evaluated as 48 unique permission union. Header switcher filters sidebar view without dropping union capabilities. | **Passing** |

---

## 5. UI/UX Issues by Category

### A. Component Consistency & Reusability
- **Punch Button Consolidation:** Verified that previous divergence between dashboard `PunchCard` and attendance `AttendancePunchBar` is resolved via the shared `<PunchButton>` component (`src/components/shared/PunchButton.tsx`).
- **Dialogs & Modals:** Standardized across modules using `<Modal>` and `<ConfirmDialog>` with focus trap and keyboard `Escape` handlers.

### B. Accessibility (WCAG 2.1 AA)
- **Skip Links:** Present in [`src/components/layout/AppShell.tsx:20-25`](file:///C:/Users/HP/OneDrive/Desktop/Projects/Cursor/HRMS/src/components/layout/AppShell.tsx#L20-L25).
- **ARIA & Landmarks:** Main content region designated with `id="main-content"` and `tabIndex={-1}`. Screen reader labels present on all icon buttons (`aria-label`).
- **Color Contrast:** Clean token hierarchy using Tailwind semantic colors (`text-ink`, `text-ink-secondary`, `text-ink-muted`, `bg-surface`, `border-line`).

### C. Responsive Breakpoints
- **Mobile Drawer (< 768px):** Animated slide-out navigation with backdrop blur and escape key listener. Header hamburger toggle triggers drawer cleanly.
- **Data Tables:** Horizontal scrolling enabled with responsive minimum widths (`min-w-[650px]` to `min-w-[700px]`) preventing table collapse on mobile.

### D. Form Validation & UX
- **Inline vs Toast:** Validation errors utilize inline form feedback for field bounds (dates, numbers) and floating `Toast` alerts for server response statuses.

### E. Loading & Skeleton States
- **DataTableSkeleton:** Shimmer loading states integrated on initial load and search query debounce across `EmployeeDirectory`, `LeaveWorkspace`, and `ApprovalsWorkspace`.

---

## 6. App Flow & Architecture Issues

1. **RSC vs Client Islands:**
   - Pages like `/payroll`, `/approvals`, `/attendance`, `/leave`, and `/employees` act as Server Components fetching initial payloads with SSR cookie decoding.
   - Interactive UI islands handle client events without cascading network waterfalls.
2. **Middleware Route Gate vs Server Action Defense-in-Depth:**
   - Middleware enforces batch permission checks via `has_any_permission`.
   - Server Actions enforce `assertPermission()` / `assertCallerIdentity()` independently of the middleware gate.
3. **Audit Log Coverage:**
   - Administrative mutations across company settings, payroll finalize/reopen/publish, resignation rescission, clearance approvals, and comp-off credits write to `audit_logs`.

---

## 7. Top 10 Prioritized Fixes — ✅ 100% Completed

| # | Task | Status | Implementation Evidence |
|---|---|:---:|---|
| **1** | Restrict Global Search to RLS / User-Permitted Scope (`BUG AUDIT-01`) | ✅ **Resolved** | `src/lib/actions/data.ts:11-37` (caller-scoped filters) |
| **2** | Double-Submit Locks on Payroll Finalize & Publish (`BUG AUDIT-03`) | ✅ **Resolved** | `src/components/payroll/PayrollWorkspace.tsx` (`processing` state locks) |
| **3** | Total Pending Count in Approvals Server Component (`BUG AUDIT-02`) | ✅ **Resolved** | `src/app/approvals/page.tsx:44-56`, `src/lib/actions/approvals.ts` |
| **4** | Client-Side Monthly Short Permission Quota Check (`BUG AUDIT-04`) | ✅ **Resolved** | `src/app/permissions/page.tsx:54-80` (120-min monthly limit & badge) |
| **5** | Confirmation Dialog on "Reopen Payroll for Revision" | ✅ **Resolved** | `src/components/payroll/PayrollWorkspace.tsx` (`<ConfirmDialog>` attached) |
| **6** | Inline Date Overlap Feedback in Leave Application Form | ✅ **Resolved** | `src/components/leave/LeaveWorkspace.tsx:303-307` |
| **7** | Tooltip Descriptions to Role Switcher Select Options | ✅ **Resolved** | `src/components/layout/Header.tsx:88-96` (descriptive title per option) |
| **8** | Clear All Filters Button in Approvals Workspace | ✅ **Resolved** | `src/components/approvals/ApprovalsWorkspace.tsx:357-364` |
| **9** | Display Remaining Comp-Off Validity Badge on Leave Allocation | ✅ **Resolved** | `src/components/leave/LeaveWorkspace.tsx:190-194` (90-day expiry badge) |
| **10** | Mobile Header Search Touch Target & Shortcut Polish | ✅ **Resolved** | `src/components/shared/GlobalSearchPalette.tsx:81-96` |
