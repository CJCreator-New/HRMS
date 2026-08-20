# HRMS v2.7 — Enhancement Plan

> **Scope**: All 50+ enhancements from FULL_APP_REVIEW.md + BUG_AND_GAP_TRACKER.md
> **Timeline**: 3-week sprint (2 developers)
> **Total Estimated Effort**: ~110 hours
> **Branch**: `feature/auth`
> **Generated**: August 20, 2026

---

## Executive Summary

This plan addresses every identified gap across **Visual/UI**, **User Journey**, **Functional**, **Page Migrations**, **Security**, and **Testing** — organized into 3 weekly phases with parallel work streams to maximize throughput.

| Phase | Focus | Estimated Hours | Parallel Streams |
|---|---|---|---|
| **Week 1** | Quick Wins & Foundation | ~32h | Stream A: Visual/Design · Stream B: Functional/Test |
| **Week 2** | Architecture & Migrations | ~40h | Stream A: RSC + Architecture · Stream B: Page Migrations |
| **Week 3** | Security, UX Polish & Production Readiness | ~38h | Stream A: Security + Functional · Stream B: UX Polish + Testing |

---

## Phase 1 — Quick Wins & Foundation (Week 1)

**Goal**: Fix all critical blockers, establish design token consistency, and unblock testing.

### Stream A: Visual & Design Token Migration (~16h)

| # | Task | ID | Effort | Acceptance Criteria |
|---|---|---|---|---|
| 1 | **Fix vitest component test environment** — Add `environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']]` to `vitest.config.ts` | F1 | 1h | All 5 `.tsx` test files execute and pass. `npm run test:unit` shows 0 errors |
| 2 | **Migrate AppShell/Header/Sidebar to semantic tokens** — Replace all raw `gray-*`/`slate-*` classes in `AppShell.tsx`, `Header.tsx`, `Sidebar.tsx` with `bg-surface`, `text-ink`, `border-line`, `primary-*` tokens | V1 | 3h | No raw `gray-*` or `slate-*` color classes remain in shell components |
| 3 | **Migrate Login Page to primary tokens** — Replace `bg-slate-900`, `bg-blue-600`, `text-blue-600` with `bg-primary-600`, `bg-primary-700` | V2 | 1h | All button and accent colors on login page use `primary-*` tokens |
| 4 | **Migrate Error/403/NotFound Pages** — Replace hardcoded `bg-gray-50`, `bg-white`, `text-gray-900`, `text-gray-600` with `bg-background`, `bg-surface`, `text-ink`, `text-ink-secondary` | V4 | 1.5h | No raw `gray-*` color references on error/403/not-found pages |
| 5 | **Consolidate Duplicate Punch Cards** — Merge `PunchCard.tsx` and `AttendancePunchBar.tsx` into a single shared `PunchButton` component with consistent colors and feature parity | V3 | 3h | Single punch component used on both dashboard and attendance page |
| 6 | **Standardize Z-Index Scale** — Define `z-modal: 50`, `z-overlay: 55`, `z-toast: 60`, `z-search: 70` in `tailwind.config.ts`. Update `GlobalSearchPalette.tsx` (`z-[9999]` → `z-search`), Modal, Drawer | V5 | 1h | All overlay components reference shared z-index scale |
| 7 | **Add Favicon & App Icons** — Generate `favicon.ico`, `apple-touch-icon.png`, Open Graph image. Set `metadata.icons` in `layout.tsx` | V8 | 1h | Browser tab shows branded icon |
| 8 | **Add CSS Transition to Mobile Sidebar** — Mount drawer always, control visibility via CSS transform/opacity with `transition` class | V9 | 2h | Mobile sidebar slides in/out with smooth animation |
| 9 | **Migrate Approvals Page to Semantic Tokens** — Replace 50+ raw `bg-white`, `text-gray-*`, `border-gray-*` references with semantic tokens | V7 | 3h | Zero raw `gray-*` color references in approvals page |

### Stream B: Functional Fixes & Test Infrastructure (~16h)

| # | Task | ID | Effort | Acceptance Criteria |
|---|---|---|---|---|
| 10 | **Fix Dashboard PunchCard State Sync** — Add `router.refresh()` after successful punch in `PunchCard.tsx` | J2 | 0.5h | After punch in/out on dashboard, navigating to attendance reflects updated state |
| 11 | **Remove Hardcoded Login Credentials** — Remove `defaultValue="admin@company.com"` and `defaultValue="TempAdminPass123!"` from login form inputs | J3 | 0.25h | Login form starts with empty email and password fields |
| 12 | **Add Leave End-Date Auto-Population** — When start date + `full_day` duration selected, auto-set `endDate = startDate`. Add client validation for end < start | J7 | 1h | End date auto-fills for full-day leaves; validation prevents end < start |
| 13 | **Add Keyboard Navigation for Filter Chips** — Add `aria-pressed` and `focus-visible:ring-2` to approval module filter buttons | J9 | 0.5h | Filter chips have `aria-pressed`, visible focus ring, keyboard-navigable |
| 14 | **Add `withdrawn` State to StatusBadge** — Map `"withdrawn"` to RED or BLUE color set in `StatusBadge.tsx` | F11 | 5m | Withdrawn status has distinct visual treatment |
| 15 | **Add Restricted-Access Guidance for Empty Personas** — Show "Your account has limited access. Contact your administrator." when dashboard has no accessible modules | F9 | 1h | Restricted users see helpful guidance instead of empty dashboard |
| 16 | **Consolidate Approvals Redundant Count Fetch** — Merge two `useEffect` hooks into single data fetch for pending count | F10 | 0.5h | Single fetch provides both header badge and data |
| 17 | **Add Per-Route Loading States** — Create `loading.tsx` for `/attendance`, `/leave`, `/employees`, `/reimbursements`, `/permissions`, `/calendar`, `/onboarding`, `/offboarding`, `/salary`, `/statutory`, `/encashment`, `/settings`, `/audit`, `/jobs`, `/reports` | J4, F8 | 3h | Each major route shows loading indicator during server-side data resolution |
| 18 | **Add Module-Level Error Boundaries** — Create `error.tsx` for `/payroll`, `/attendance`, `/leave`, `/employees` at minimum | J5 | 3h | Each module has dedicated error boundary with module-specific messaging |
| 19 | **Remove or Implement Dormant Roles** — Either implement `statutory_admin`, `finance_admin`, `it_admin` (login resolution, personas, UI) or remove from type union and permission map | F5 | 2h (remove) / 8h (implement) | No role exists without corresponding login resolution path |
| 20 | **Implement or Remove `withdrawn` Employee Status** — Either implement withdrawn lifecycle (persona, spec, UI) or remove dead enum variant | F7 | 2h | No dead enum variant in type system |

---

## Phase 2 — Architecture & Migrations (Week 2)

**Goal**: Convert approvals to RSC, migrate all 12 pages to shared pattern library, fix architecture issues.

### Stream A: RSC Conversion & Architecture (~20h)

| # | Task | ID | Effort | Acceptance Criteria |
|---|---|---|---|---|
| 21 | **Convert Approvals Page to RSC** — Server-side data fetch in page component, pass to `<ApprovalsWorkspace>` client island. Eliminate full client-side waterfall | J1 | 8h | `approvals/page.tsx` is a server component; only interactive parts are client islands |
| 22 | **Migrate Rate Limiter to Upstash Redis** — Replace in-memory `Map<string, RateLimitEntry>` with Redis-backed rate limiting (Upstash `@upstash/ratelimit`) | F4 | 3h | Rate limiter persists across server restarts and works across instances |
| 23 | **Implement Reimbursement Two-Stage Routing** — Fix `manager_then_hr` claims to start at `pending_manager`, transition to `pending_hr` after manager approval. Fix `manager_only` claims to approve directly after manager | F6, D11 | 5h | `manager_then_hr` → `pending_manager` → `pending_hr` → `approved`; `manager_only` → `pending_manager` → `approved` |
| 24 | **Add Next-Step Guidance to Toast Messages** — Enrich critical-action toasts (payroll finalize, employee onboard, F&F settlement) with contextual next-step links | J6 | 3h | All critical-action toasts include "next step" link to logical follow-up page |
| 25 | **Add Back-to-Top Button** — Floating button on employee directory, approvals inbox, payroll register after scrolling ~400px | J8 | 1h | Back-to-top appears on long pages after scroll |

### Stream B: Page Migrations to Shared Pattern Library (~20h)

Each page migration follows this checklist:
- [ ] Replace hand-rolled `PageHeader` with shared `<PageHeader>`
- [ ] Replace hand-rolled table with shared `<DataTable>` with sort/filter/pagination
- [ ] Replace hand-rolled modals with shared `<Modal>` (focus trap, backdrop)
- [ ] Replace hand-rolled banners/notices with shared `<Toast>` or `<ErrorBanner>`
- [ ] Replace hand-rolled status badges with shared `<StatusBadge>`
- [ ] Add shared `<EmptyState>` for empty data scenarios
- [ ] Verify all dates use `formatDateIndian()` and currency uses `formatCurrencyIndian()`

| # | Page | ID | Effort | Key Components to Migrate |
|---|---|---|---|---|
| 26 | **`/attendance`** | — | 2h | PageHeader, Toast (replace notice banner), DataTable for attendance logs |
| 27 | **`/departments`** | — | 2h | PageHeader, Modal (add focus trap H-11), DataTable for department list |
| 28 | **`/calendar`** | — | 2h | PageHeader, DataTable for holiday list, Modal for template editing |
| 29 | **`/documents`** | — | 1.5h | PageHeader, DataTable for attachment register |
| 30 | **`/employees/import`** | — | 1.5h | PageHeader, DataTable for CSV import results |
| 31 | **`/settings`** | — | 2h | PageHeader, Modal for settings editing |
| 32 | **`/audit`** | — | 2h | PageHeader, DataTable with server-side search (debounced), EmptyState |
| 33 | **`/jobs`** | — | 1.5h | PageHeader, DataTable for job logs |
| 34 | **`/reports`** | — | 1.5h | PageHeader, Card layout for report catalog, category filters |
| 35 | **`/eligibility`** | — | 1h | PageHeader, DataTable for eligibility flags |
| 36 | **`/salary`** | — | 2h | Complete DataTable/PageHeader/Toast adoption, versioned structure table |
| 37 | **`/statutory`** | — | 1.5h | Complete shared Modal adoption, statutory profiles table |

---

## Phase 3 — Security, UX Polish & Production Readiness (Week 3)

**Goal**: Harden security, add skeleton loading, expand test coverage, final polish.

### Stream A: Security & Functional Hardening (~20h)

| # | Task | ID | Effort | Acceptance Criteria |
|---|---|---|---|---|
| 38 | **Add Skeleton Loading States** — Create `<Skeleton>` variants for DataTable rows, dashboard cards, and workspace layouts. Replace `<PageLoading>` spinners with skeleton placeholders in all major modules | V6 | 6h | Each major module shows skeleton placeholders matching final layout shape |
| 39 | **Fix Attendance Banner-to-Toast Migration** — Replace hand-rolled `notice` banner in attendance page with shared Toast component | — | 1h | Attendance uses shared Toast for punch confirmation |
| 40 | **Implement or Clean Up Reimbursement `manager_only` Route** — Ensure claims with `approval_route = "manager_only"` are properly handled (start at `pending_manager`, approve directly) | BUG-05 | 2h (already resolved) | Verify and add E2E test coverage |
| 41 | **Add Comp-Off Manual Credit/Revoke Actions** — Implement `compoff.credit.manual` and `compoff.revoke` server actions (C15 gap) | C15 | 4h | HR can manually credit comp-off; can revoke unused comp-off |
| 42 | **Add HR→System Admin Leave Fallback E2E Test** — C8 was unit-tested only; add E2E coverage for HR alternate self-application falling back to sysadmin | C8 | 3h | E2E test verifies HR leave routes to alt approver, then falls back to sysadmin |
| 43 | **Fix Persona Deduplication (D6)** — Consolidate persona definitions from `e2e/fixtures/test-data.ts` and `scripts/seed-mock-data.mjs` into single shared source | D6 | 2h | Single source of truth for persona definitions |
| 44 | **Add Payroll Run Excluded Employee Feedback** — Extend payroll run response to include `excludedEmployees: Array<{ id, name, reason }>` and display in UI | FLOW-02 | 2h | UI shows collapsible "Excluded Employees" section after payroll run |

### Stream B: Testing & UX Polish (~18h)

| # | Task | ID | Effort | Acceptance Criteria |
|---|---|---|---|---|
| 45 | **Expand Security Spec** — Add tests for CSRF validation, IDOR prevention, XSS sanitization, cookie tampering, session fixation | NFR-08 | 3h | 8 new security tests pass |
| 46 | **Add Full Payroll Lifecycle E2E Test** — Period creation → lock validation → bulk run → review → finalize → publish | TEST-05 | 2h | Test covers all 5 payroll stepper steps end-to-end |
| 47 | **Add Multi-Role Union Permission Tests** — Verify `permissionsForRoles(["hr", "manager"])` returns correct union, no duplicates, correct route access | TEST-06 | 1h | All union permission tests pass |
| 48 | **Add Component Workspace Unit Tests** — Tests for `LeaveWorkspace`, `AttendanceWorkspace`, `PayrollWorkspace`, `ApprovalsWorkspace`, `EmployeeDirectory` | TEST-04 | 3h | Each workspace has render + interaction test |
| 49 | **Expand Accessibility Scan to All 22 Routes** — Add remaining gated routes to `routesToScan` in `accessibility.spec.ts` | NFR-07 | 1h | All 22 routes pass axe-core WCAG AA scan |
| 50 | **Add Payroll Engine Edge Case Tests** — 8 boundary tests for mid-month joins, PF/ESI combos, LOP, half-day units | TEST-01 | 2h | All 8 edge case tests pass, `payroll-engine.ts` coverage ≥90% |
| 51 | **Add Golden-Path E2E CI Integration** — Configure CI pipeline with live Supabase test project for golden-path trace tests | TEST-03 | 2h | All 10 golden-path tests pass in CI |
| 52 | **Add Permissions Sync CI Check** — Verify `ROLE_PERMISSIONS_MAP` matches SQL seed via `scripts/verify-permissions-sync.mjs` | FLOW-01 | 1h | CI fails if TS and SQL permission maps diverge |
| 53 | **Add Missing Permission Detail Handlers** — Add `permission` and `compoff` module handlers in `getApprovalDetailAction` | FLOW-03 | 1h | Viewing permission/compoff request details shows all fields |
| 54 | **Verify Employee Deactivation Status FSM** — Ensure `toggleEmployeeDeactivationAction` properly transitions status and logs audit | APP-02 | 1h | Deactivation changes status to `suspended`, reactivation to `active`, audit logged |

---

## Dependency Graph

```
Week 1                          Week 2                          Week 3
──────                          ──────                          ──────
F1 (vitest fix) ──────────────→ All tests unblocked
V1-V5 (tokens) ──────────────→ Page migrations (26-37)
J2, J3 (login/punch) ────────→ J6 (toast guidance)
J4, J5 (loading/errors) ─────→ Skeleton states (38)
V7 (approvals tokens) ───────→ J1 (approvals RSC)
F5, F7 (dormant roles) ──────→ Reimbursement routing (23)
                                Page migrations (26-37) ────→ Final polish
```

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Approvals RSC conversion breaks existing functionality | High | Test thoroughly against 308 RBAC route-gate cases before and after |
| Page migration introduces visual regressions | Medium | Snapshot test key pages before/after; visual diff check |
| Reimbursement routing change breaks existing claims | High | Write unit tests for all routing paths before implementation |
| Upstash Redis setup blocks rate limiter migration | Low | Keep in-memory fallback; Redis is optional upgrade |
| Component test jsdom migration reveals new failures | Medium | Fix failures incrementally; don't block other work |

---

## Success Criteria

| Metric | Target |
|---|---|
| TypeScript errors | 0 (`tsc --noEmit`) |
| Unit test pass rate | 100% (including all 5 component test files) |
| ESLint errors | 0 |
| Design token consistency | Zero raw `gray-*`/`slate-*` in shell, login, error, approvals pages |
| RSC conversion | Approvals page is server component with client islands |
| Page migrations | All 12 pages use shared pattern library components |
| Security tests | 8+ security tests covering CSRF, IDOR, XSS, cookies |
| Accessibility | All 22 routes pass axe-core WCAG AA |
| Golden-path tests | All 10 traces pass against live backend |
| Component tests | All 5 `.tsx` test files pass |

---

## Tracking

Use the following IDs from this document to track progress:
- **V1-V9**: Visual/Design enhancements
- **J1-J9**: User Journey/Flow enhancements
- **F1-F11**: Functional/Architecture enhancements
- **Pages 26-37**: Page migrations
- **Tasks 38-54**: Security, Testing, Polish

---

*Generated by Buffy (Codebuff Agent) — August 20, 2026*
