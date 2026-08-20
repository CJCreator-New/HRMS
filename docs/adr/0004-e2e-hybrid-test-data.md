# ADR 0004: E2E Hybrid Test Data Strategy

- **Status**: Accepted
- **Date**: 2026-08-13
- **Deciders**: Engineering Lead, QA Lead, Core Development Team
- **Technical Story**: Establishing repeatable, fast, and robust E2E test data setup while adhering to manual UI data validation requirements (ADR 0002).

---

## Context and Problem Statement

HRMS v2.7 requires an extensive E2E testing suite (Playwright) covering 20 modules, 19 gated routes, 5 system roles, and multi-step cross-module golden paths.

ADR 0002 established a **Manual UI Test Data Setup Strategy** to ensure all operational forms and workflows are manually clickable and validated. However, relying purely on manual UI clicks for every E2E test run would result in extremely slow execution times, fragile test setup, and flakiness during automated CI pipeline runs. Conversely, populating data purely via SQL scripts bypasses Next.js server action handlers and business rule validation.

---

## Decision Drivers

1. **Speed & Efficiency**: Automated Playwright test suites must execute within CI time budgets (< 10 minutes total).
2. **Reliability**: Test fixtures must be predictable, idempotent, and isolated.
3. **Fidelity**: Core workflows (Direct Admin Onboarding, Punching, Leave Application, Payroll Runs) must still be fully validated end-to-end via the UI.
4. **Maintainability**: Personas and organizational hierarchies should be centrally seeded and reused across test specs.

---

## Considered Options

1. **Pure UI Setup**: Perform every prerequisite setup step (creating departments, onboarding 8 employees, setting salary structures, assigning work calendars) via Playwright browser UI clicks before every spec.
2. **Pure SQL Database Seeds**: Load static SQL dumps into PostgreSQL prior to running tests.
3. **Hybrid Test Data Strategy (Selected)**: 
   - **One-time UI Validation**: Core UI onboarding forms and setup flows are validated end-to-end via Playwright specs.
   - **Automated `globalSetup` Service-Role Seeding**: Playwright's `globalSetup` script initializes 8 standard test personas, baseline org fixtures, salary structures, and leave allocations directly via Supabase service-role client/API helpers prior to running specs.

---

## Decision Outcome

**Chosen Option**: **Hybrid Test Data Strategy**.

### Setup Mechanics

1. **Global Persona Seeding**:
   - `globalSetup.ts` executes before the Playwright test runner starts.
   - It uses Supabase Admin Service Role API to create 8 standard personas (`sys_admin`, `hr_admin`, `payroll_admin`, `manager_m1`, `employee_e1`, `employee_e2`, `multi_hr_mgr`, `hr_alt_approver`) with baseline password credentials (`Password123!`).
   - Baseline org fixtures (Departments: Engineering, HR, Finance; Calendars: 5-Day, 6-Day; Baseline leave allocations & salary components) are idempotently inserted into PostgreSQL.

2. **Spec Execution**:
   - Test specs reuse existing persona session state (`storageState`) or login via UI to test authentication.
   - Core feature happy paths perform actions via Playwright browser interaction (`data-testid` selectors).
   - Assertions verify both UI state transitions and DB state via Supabase service client queries.

---

## Consequences

### Positive
- **Fast Test Execution**: Pre-seeded personas and org fixtures eliminate thousands of redundant UI clicks during test runs.
- **High Test Isolation**: Tests run deterministically against known initial states.
- **CI Automation Ready**: Seamlessly runs in GitHub Actions using local Supabase/PostgreSQL containers.

### Negative / Risks
- **Schema Drift Risk**: Schema updates in `schema/*.sql` must be kept in sync with `globalSetup.ts` fixture generators.
- **Manager Salary Consistency**: Persona setup must explicitly account for manager role permission constraints (FR §5.8).
