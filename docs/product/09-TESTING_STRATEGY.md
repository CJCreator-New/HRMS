# HRMS v2.7 — Testing Strategy & Quality Gates

> **Audience**: Engineering, QA, Product  
> **Tools**: Vitest, Playwright, axe-core, ESLint, TypeScript  
> **Last Updated**: August 19, 2026

---

## 1. Testing Philosophy

### Core Principles

1. **Test Behavior, Not Implementation**: Tests verify external contracts and user-facing behavior, not internal private implementation details
2. **Three-Layer Coverage**: Database (SQL), API (Server Actions), UI (Components)
3. **Offline-First E2E**: Mock auth for fast local testing; live-backend assertions self-skip (never fail)
4. **Defense-in-Depth Verification**: Each security layer (middleware, RLS, server actions) tested independently
5. **Accessibility by Default**: axe-core automated WCAG AA compliance on every E2E run

---

## 2. Testing Pyramid

```
                    ┌─────────────┐
                    │   E2E Tests  │  40+ specs (Playwright)
                    │  (Slow,      │  Cross-browser, RBAC, NFR
                    │   Broad)     │
                    ├─────────────┤
                    │   Component  │  5 test files (React Testing Library)
                    │   Tests      │  Modal, Toast, Banner, Skeleton
                    │  (Medium)    │
                    ├─────────────┤
                    │   Unit Tests │  32 test files, 260 tests (Vitest)
                    │  (Fast,      │  Actions, engines, services, mappers
                    │   Focused)   │
                    └─────────────┘
```

---

## 3. Unit Tests (Vitest)

### Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',  // Note: .tsx files need 'jsdom' (gap F1)
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
```

### Test Suite Inventory (260 tests across 32 files)

| Suite | Tests | Focus |
|---|---|---|
| `approvals-action.test.ts` | 12 | Unified approval routing |
| `attachments-audit-action.test.ts` | 8 | File upload, audit logging |
| `attendance-action.test.ts` | 10 | Punch in/out, correction flow |
| `auth-action.test.ts` | 14 | Login, password reset, session |
| `auth-assert.test.ts` | 8 | Permission assertion logic |
| `auth-session.test.ts` | 6 | Session management |
| `calendar-action.test.ts` | 7 | Calendar template CRUD |
| `compensation-engine.test.ts` | 9 | Salary pro-ration calculation |
| `data-action.test.ts` | 11 | Data seed/mock operations |
| `departments-settings-action.test.ts` | 9 | Department & settings CRUD |
| `eligibility-reports-action.test.ts` | 8 | Payroll eligibility & reports |
| `employees-action.test.ts` | 10 | Employee lifecycle operations |
| `jobs-action.test.ts` | 6 | Scheduled job management |
| `leave-action.test.ts` | 12 | Leave apply/cancel/approve |
| `leave-engine.test.ts` | 8 | Leave calculation engine |
| `leave-routing.test.ts` | 5 | Leave approval routing (FR §1.4) |
| `mappers.test.ts` | 10 | Data transformation |
| `mock-rbac.test.ts` | 12 | Mock RBAC table validation |
| `notifications-action.test.ts` | 8 | Notification CRUD |
| `notifications.test.ts` | 6 | Notification service |
| `offboarding-action.test.ts` | 10 | Resignation, rescission |
| `offboarding-engine.test.ts` | 10 | F&F settlement engine |
| `payroll-action.test.ts` | 12 | Payroll run/finalize |
| `payroll-engine.test.ts` | 15 | Payroll calculation engine |
| `permissions-action.test.ts` | 8 | Role assignment |
| `rbac-routing.test.ts` | 5 | RBAC permission routing |
| `reimbursements-action.test.ts` | 4 | Expense claim flow |
| `reports-engine.test.ts` | 10 | Report generation |
| `salary-encashment-action.test.ts` | 10 | Salary & encashment |
| `statutory-engine.test.ts` | 12 | Statutory deduction engine |
| `workflow-steps.test.ts` | 10 | Multi-step workflow validation |

### What Unit Tests Cover

| Category | Examples |
|---|---|
| **Server Actions** | Input validation, permission gating, error handling |
| **Business Engines** | Leave calculation, payroll computation, statutory deductions |
| **Data Mappers** | Object transformation, formatting, type conversion |
| **RBAC Logic** | Permission routing, scope fallback, mock table validation |
| **Workflow Steps** | Multi-step wizard state transitions |

### Known Issues

| Gap | Description | Status |
|---|---|---|
| F1 | 5 component test files timeout (need `jsdom` environment) | Planned fix |

---

## 4. Component Tests (React Testing Library)

### Test Files

| File | Component | Status |
|---|---|---|
| `pattern-library.test.tsx` | Design token validation | ❌ Timeout (jsdom) |
| `modal-confirm-toast.test.tsx` | Modal, ConfirmDialog, Toast | ❌ Timeout (jsdom) |
| `read-only-banner.test.tsx` | ReadOnlyBanner | ❌ Timeout (jsdom) |
| `drawer.test.tsx` | Drawer | ❌ Timeout (jsdom) |
| `shared-components.test.tsx` | Shared component library | ❌ Timeout (jsdom) |

### Root Cause

`vitest.config.ts` sets `environment: "node"` globally, but `.tsx` component tests require `environment: "jsdom"` for React Testing Library.

### Planned Fix

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
  },
});
```

---

## 5. E2E Tests (Playwright)

### Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'edge', use: { ...devices['Desktop Edge'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
    { name: 'tablet', use: { ...devices['iPad Pro 11'] } },
  ],
});
```

### Test Structure

```
e2e/
├── fixtures/
│   ├── auth.fixture.ts        # Mock auth setup
│   ├── db.fixture.ts          # Database assertions
│   └── test-data.ts           # 14 persona definitions
├── specs/
│   ├── smoke/                 # P0 critical paths
│   │   └── auth.spec.ts       # Login, redirect, invalid creds
│   ├── rbac/                  # RBAC verification
│   │   ├── route-matrix.spec.ts  # 14 personas × 22 routes (308 cases)
│   │   └── manager-salary.spec.ts # Manager salary isolation
│   ├── modules/               # Per-module specs
│   │   ├── attendance.spec.ts
│   │   ├── leave.spec.ts
│   │   ├── payroll.spec.ts
│   │   └── ... (16 module specs)
│   ├── cross-module/          # Golden path traces
│   │   ├── golden-path-routing-trace.spec.ts  # 8 DB-level traces
│   │   └── ... (12 cross-module specs)
│   ├── flows/                 # Multi-step wizards
│   │   ├── onboarding-stepper.spec.ts
│   │   ├── offboarding-stepper.spec.ts
│   │   └── payroll-stepper.spec.ts
│   ├── ui/                    # UI consistency
│   │   ├── dialogs.spec.ts
│   │   └── pagination.spec.ts
│   └── nfr/                   # Non-functional requirements
│       ├── accessibility.spec.ts  # axe-core WCAG AA
│       ├── performance.spec.ts    # LCP budgets
│       └── security.spec.ts       # Security probes
└── global-setup.ts            # Global test environment seeding
```

### Test Categories

#### Smoke Tests (P0)
- Login flow (valid/invalid credentials)
- Redirect logic (unauthenticated → /login)
- Route access (authorized/unauthorized)

#### RBAC Tests (P0)
- **Route Matrix**: 14 personas × 22 routes = 308 test cases
- **Manager Salary Isolation**: Verify 403 on /salary
- **System Admin Bypass**: Verify all routes accessible

#### Module Tests
- **Attendance**: Punch in/out, correction submission, manager approval
- **Leave**: Balance display, application, overlap prevention, approval
- **Payroll**: Period initiation, lock verification, run execution, publishing
- **Employees**: Directory display, onboarding flow, CSV import
- **Offboarding**: Resignation, F&F settlement, rescission

#### Cross-Module Tests (Golden Paths)
- **GP-01**: Hire → Payslip (complete chain)
- **GP-02**: Anomaly → Lock (attendance to payroll)
- **GP-03**: Leave Sandwich (policy enforcement)
- **GP-04**: Comp-Off Lifecycle (extra work → credit → expiry)
- **GP-05**: Expense → Payslip (claim to disbursement)
- **GP-06**: Resignation → F&F (separation to settlement)
- **GP-07**: HR Self-Approval (FR §1.4 routing)
- **GP-08**: Multi-Role Union (cumulative permissions)

#### NFR Tests
- **Accessibility**: axe-core automated WCAG AA checks
- **Performance**: LCP budget validation
- **Security**: CSP headers, authentication probes

### Mock vs Real Mode

| Aspect | Mock Mode | Real Mode |
|---|---|---|
| Auth | Cookie-based email token | Supabase Auth session |
| RBAC | Static table (`mock-rbac.ts`) | Database `has_permission()` |
| Data | Fixture definitions | Live database |
| Self-Skip | — | Live-backend assertions self-skip (never fail) |

---

## 6. Quality Gates

### Pre-Commit Gates

| Gate | Command | Pass Criteria |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | 0 errors |
| ESLint | `npx eslint src` | 0 errors |
| Unit Tests | `npm run test:unit` | 260/260 pass |

### PR Gates

| Gate | Command | Pass Criteria |
|---|---|---|
| P0 Smoke | `npm run test:e2e:p0` | All pass (Chromium) |
| RBAC Matrix | `npm run test:e2e:rbac` | All 308 cases pass |
| Accessibility | `npm run test:e2e:nfr` | axe-core 0 violations |
| Build | `npm run build` | Successful production build |

### Release Gates

| Gate | Command | Pass Criteria |
|---|---|---|
| Full E2E | `npm run test:e2e:full` | All specs pass (all browsers) |
| Coverage | `npm run test:coverage` | >80% line coverage |
| Security | Manual review | CSP, RLS, permission enforcement |

---

## 7. Test Data Management

### Seeded Test Personas (14)

| Persona | Roles | Notes |
|---|---|---|
| `sysadmin@company.com` | system_admin | ALL bypass |
| `hradmin@company.com` | hr | Mock over-grants `/permissions` (D9) |
| `payroll@company.com` | payroll_admin | — |
| `manager.m1@company.com` | manager | Team of E1/E2 |
| `manager.m2@company.com` | manager | Team of E3 |
| `employee.e1@company.com` | employee | Mock over-grants `/payroll` (D2) |
| `employee.e2@company.com` | employee | Deny-all (restricted) |
| `employee.e3@company.com` | employee | Pure employee routes |
| `multi.hrmgr@company.com` | hr + manager | Union persona |
| `hr.alt@company.com` | hr | Deny-all in mock (D12) |
| `invited.emp@company.com` | employee | `mustChangePassword: true` |
| `notice.emp@company.com` | employee | Notice period keeps access |
| `suspended.emp@company.com` | employee | Deny-all (access revoked) |
| `offboarded.emp@company.com` | employee | Deny-all (access revoked) |

### Seeded Database Accounts

| Role | Email | Password |
|---|---|---|
| System Admin | `admin@company.com` | `TempAdminPass123!` |
| HR Admin | `hr.admin@company.com` | `Password123!` |
| Payroll Admin | `payroll.admin@company.com` | `Password123!` |
| Manager | `manager.m1@company.com` | `Password123!` |
| Employee | `employee.e1@company.com` | `Password123!` |

---

## 8. Known Test Gaps

| Gap ID | Description | Impact |
|---|---|---|
| D2 | `employee.e1` mock over-grants `/payroll` | Mock-only divergence |
| D5 | `withdrawn` lifecycle state unmodeled | No test coverage |
| D9 | `hradmin` mock over-grants `/permissions` | Mock-only divergence |
| D11 | Reimbursement two-stage routing unenforced | Functional gap |
| D12 | `hr.alt` deny-all in mock blocks FR §1.4 | No offline E2E for HR self-approval |
| F1 | 5 component test files timeout | Missing component test coverage |
| C8 | HR → System Admin leave fallback | Unit-tested only (no E2E) |
| C15 | Comp-off manual credit/revoke | Actions unimplemented |

---

## 9. Running Tests

### Quick Commands

```bash
# Unit tests
npm run test:unit

# Unit tests with coverage
npm run test:coverage

# E2E P0 smoke + RBAC (fast PR gate)
npm run test:e2e:p0

# Full E2E suite (all browsers)
npm run test:e2e:full

# RBAC-only E2E
npm run test:e2e:rbac

# NFR tests (accessibility + performance)
npm run test:e2e:nfr

# Audit tests (cross-module + RBAC)
npm run test:audit

# View E2E report
npx playwright show-report e2e-report
```

---

*Generated by Buffy (Codebuff Agent) — August 19, 2026*
