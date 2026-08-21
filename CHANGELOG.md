# Changelog

All notable changes to the Enterprise Human Resource Management System (HRMS) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Biometric biometric hardware device integration connector.
- Advanced performance review cycle management (360-degree appraisals).
- Multi-currency payroll processing for international subsidiaries.

---

## [2.7.0] - 2026-08-21 (Release Candidate)

### Added
- **Granular RBAC Engine**:
  - 8 distinct enterprise roles (`System Admin`, `HR Admin`, `Payroll Admin`, `Manager`, `Employee`, `Statutory Admin`, `Finance Admin`, `IT Admin`) with 62 permission codes.
  - Automated CI check (`npm run verify:permissions`) asserting zero drift between TypeScript definitions and SQL seeds.
- **Attendance & Time Tracking**:
  - Web punch check-in / check-out with automatic daily worked hours computation.
  - Attendance correction request workflow with manager approval routing.
  - Multi-calendar support (Metro, Regional, Shift) and optional holiday management.
- **Leave Management & Policy Engine**:
  - Casual (CL), Sick (SL), and Earned (EL) leave accrual and tracking.
  - Automated **Sandwich Policy** calculation engine (weekend/holiday inclusion based on configuration).
  - 90-day expiring **Comp-off Grants** linked to worked overtime/weekend attendance logs.
  - Leave balance encashment and year-end carry forward automation.
  - Database triggers preventing overlapping leave intervals.
- **Indian Statutory Compliance & Payroll**:
  - Versioned per-employee salary structure components (Basic, HRA, Special Allowance).
  - Indian Statutory Compliance Engine:
    - Provident Fund (PF) employer/employee calculations with statutory wage ceiling.
    - Employee State Insurance (ESI) wage thresholds and percentage calculations.
    - Professional Tax (PT) state-specific slabs (Karnataka, Maharashtra, etc.).
    - Income Tax / TDS support for Old and New Tax Regimes.
  - Automated draft payroll calculation, batch finalization, and payslip publication.
- **Offboarding & Full & Final (F&F) Settlement**:
  - Resignation lifecycle with notice period tracking and Last Working Day (LWD) computation.
  - Multi-departmental clearance checklist (IT, Finance, Admin, HR).
  - Automated F&F settlement drafts with leave encashment, recovery deductions, and database staleness triggers.
- **Expense Reimbursements**:
  - Category-based claim submission with policy spending limits and receipt uploads via Supabase storage.
- **Developer Experience & Tooling**:
  - Dual local development modes: Instant Mock Auth (`NEXT_PUBLIC_MOCK_AUTH=true`) and Full-Stack PostgreSQL mode.
  - Modular 24-file database schema with automatic compiler (`npm run db:sync`).
  - Comprehensive 400+ unit test suite (Vitest) and Playwright E2E golden-path test suite.

### Security
- Server-side `assertPermission()` validation across all 22 Server Action modules.
- Strict defense-in-depth against self-approval on leaves, attendance adjustments, claims, and offboarding clearances.
- Cryptographically signed developer session cookies for mock authentication.
- Row-Level Security (RLS) policies isolating tenant data.
