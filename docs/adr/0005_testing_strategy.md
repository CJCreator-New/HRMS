# ADR 0005: Dual-Layer Testing Strategy (Vitest Service Units + Playwright E2E)

- **Status**: Approved
- **Date**: 2026-08-13
- **Deciders**: HRMS Lead Architect, QA Lead

---

## Context and Problem Statement

The HRMS v2.7 application encompasses critical business engines (payroll pro-rata computation, Indian statutory PF/ESI/PT/TDS compliance, leave sandwich calculation, and permission assertion logic) as well as complex multi-role user workflows across 25 Next.js App Router pages.

Prior releases relied exclusively on Playwright E2E specs without an isolated service-layer unit test tier, making edge-case calculation validation slow and dependent on browser automation.

---

## Decision Drivers

1. **Deterministic Business Rules**: Statutory calculations (PF ₹15,000 basic wage cap, ESI ₹21,000 gross limit, state-specific PT slabs) require fast, isolated, unit-level assertion.
2. **Fast Feedback Loop**: Developers require instant (< 3 second) feedback on pure calculation functions without launching browser fixtures.
3. **End-to-End Golden Paths**: Complex multi-role lifecycles (Hire-to-Payslip, Resignation-to-F&F, Comp-off lifecycle) require full browser + database integration assertions.

---

## Decision Outcome

We adopt a **Dual-Layer Testing Architecture**:

1. **Service-Layer Unit Tests (Vitest)**:
   - Framework: Vitest (`npm run test:unit`)
   - Scope: Pure functions in `src/lib/services/` (e.g., `payroll-engine`, `statutory-engine`, `leave-routing`).
   - Execution: Isolated Node.js environment, target execution < 3s.

2. **End-to-End & RBAC Automation (Playwright)**:
   - Framework: Playwright (`npm run test:e2e`, `npm run test:e2e:p0`)
   - Scope: UI page routing, Server Action integration, RLS policy enforcement, and Golden Path scenarios.
   - Fixtures: `auth.fixture.ts` (authenticated page context) and `db.fixture.ts` (direct database assertions).

---

## Positive Consequences

- Fast CI execution with split unit and E2E gating jobs.
- High confidence in statutory compliance calculations.
- Zero duplication between unit-level calculation checks and browser interaction tests.
