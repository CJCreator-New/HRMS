# 📊 HRMS Active Automated Testing Inventory & Coverage Status

**Target Environment**: Next.js App Router (RSC + Client Islands) + PostgreSQL / Supabase RBAC  
**Primary Test Engines**:
- **Unit & Domain Integration**: Vitest 4.1 (`npm run test:unit`)
- **End-to-End & NFR Browser Testing**: Playwright TypeScript (`npm run test:e2e:p0`, `npm run test:e2e`)
- **Historical Prototype Note**: A legacy Python pytest suite exists in `tests/` from an initial prototype pass, but active CI and production verification exclusively execute the TypeScript Vitest and Playwright suites below.

---

## 🏗️ 1. Active Test Suite Matrix

| Layer | Framework / Path | Test Count / Suites | Mode | CI Status |
|---|---|---|---|---|
| **Unit & Server Action Tests** | Vitest (`src/lib/services/__tests__/*.test.ts`) | 59 files / 604 tests | Mocked Supabase & Local In-Memory | ✅ Active & Gated in `ci.yml` |
| **RBAC Route Matrix** | Playwright TS (`e2e/specs/rbac/route-matrix.spec.ts`) | 22 routes × 14 personas | HMAC Cookie Injection (Mock Auth) | ✅ Gated in `e2e.yml` |
| **Smoke Tests** | Playwright TS (`e2e/specs/smoke/*.spec.ts`) | 12 tests | Fast smoke across core routes | ✅ Gated in `e2e.yml` |
| **Golden Paths (Offline)** | Playwright TS (`e2e/specs/cross-module/`) | 10 Golden Paths (GP-01 to GP-10) | Mock Auth & Session | ✅ Passing |
| **Live Golden Path Traces** | Playwright TS (`e2e/specs/cross-module/golden-path-routing-trace.spec.ts`) | Multi-step lifecycle | Live Supabase Backend | ⚠️ Requires `TEST_SUPABASE_*` credentials; self-skips offline |
| **A11y (axe-core)** | Playwright TS (`e2e/specs/nfr/accessibility.spec.ts`) | WCAG 2.1 AA scans | Chromium headless | ✅ Active |
| **Security & CSRF** | Playwright TS (`e2e/specs/nfr/security.spec.ts`) | Headers, origin, auth | Chromium headless | ✅ Active |

---

## 🌟 2. Golden Path End-to-End Coverage (GP-01 to GP-10)

| Golden Path ID | Workflow Description | Primary Personas | Target Assertions |
|---|---|---|---|
| **GP-01** | Hire-to-Payslip Journey | `sysadmin@company.com` | Dashboard metrics -> Attendance -> Leave -> 5-Step Payroll run |
| **GP-02** | Leave Application & Weekend Sandwich Rule | `employee.e1@company.com`, `manager.m1@company.com` | Date selection -> overlap prevention -> Manager Approvals inbox |
| **GP-03** | Attendance Regularization Lifecycle | `employee.e1@company.com`, `manager.m1@company.com` | Missed punch regularization request -> Manager Approvals review |
| **GP-04** | Short Permission 120-Minute Monthly Quota | `employee.e1@company.com` | Quota badge tracking -> 60-min request submission |
| **GP-05** | Expense Reimbursement Lifecycle | `employee.e1@company.com`, `manager.m1@company.com`, `hradmin@company.com` | Claim submit -> Two-stage Manager then HR approval |
| **GP-06** | Employee Resignation & Clearance Flow | `employee.e1@company.com`, `hradmin@company.com` | Resignation submit with LWD -> Multi-department clearances review |
| **GP-07** | Strict Self-Approval Prevention Guardrail | `manager.m1@company.com` | Manager applies for own leave -> self-approval blocked |
| **GP-08** | Multi-Role Union & Focus Switching | `multi.hrmgr@company.com` | Union permissions badge (48 codes) -> Switch role focus |
| **GP-09** | Full 5-Step Payroll Execution | `payroll@company.com` | Step wizard navigation -> Calculation engine -> Finalize state |
| **GP-10** | Leave Encashment Lifecycle | `employee.e1@company.com` | Encashment request against accrued balance |

---

## ⚡ 3. Execution Commands

```bash
# 1. Run full unit and server action test suite
npm run test:unit

# 2. Run unit tests with code coverage
npm run test:coverage

# 3. Verify RBAC permission code synchronization
npm run verify:permissions

# 4. Verify master database schema sync
npm run db:sync

# 5. Run Playwright P0 E2E test suite (Chromium)
npm run test:e2e:p0

# 6. Run full Playwright cross-module workflows
npm run test:e2e:workflows
```
