# Enterprise Human Resource Management System (HRMS v2.7)

[![Next.js](https://img.shields.io/badge/Next.js-14.2.18-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_15-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E_Testing-45BA4B?style=flat-square&logo=playwright)](https://playwright.dev/)

An enterprise-grade, full-stack Human Resource Management System (HRMS) built with Next.js 14 App Router, TypeScript, Server Actions, Tailwind CSS, and Supabase / PostgreSQL. Aligned with Indian statutory regulations (PF, ESI, PT, TDS), granular Role-Based Access Control (RBAC), and automated workflow engines.

---

## 📋 Table of Contents

- [Key Features & Modules](#-key-features--modules)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start Guide](#-quick-start-guide)
- [Environment Variables](#-environment-variables)
- [Database Setup & Synchronization](#-database-setup--synchronization)
- [Seeded Test Personas & Credentials](#-seeded-test-personas--credentials)
- [Available Scripts](#-available-scripts)
- [Project Architecture](#-project-architecture)
- [E2E Testing & Verification](#-e2e-testing--verification)

---

## ✨ Key Features & Modules

### 🔐 1. Granular Role-Based Access Control (RBAC)
- 8 distinct enterprise roles: **System Admin**, **HR Admin**, **Payroll Admin**, **Manager**, **Employee**, **Statutory Admin**, **Finance Admin**, **IT Admin**.
- Multi-role union support per employee with server-side `assertPermission()` enforcement and Row Level Security (RLS) policies.
- Defense-in-depth against self-approval (e.g. managers cannot approve their own leave or grant themselves admin rights).

### 👥 2. Employee Lifecycle & Onboarding
- Complete employee directory with effective-dated department, designation, and manager assignments.
- Automated CSV bulk import (`npm run import`) with duplicate prevention.
- Security-first password reset workflow (`ForcePasswordResetModal`) on initial login.

### ⏱️ 3. Attendance & Time Tracking
- Web-based punch check-in / check-out with automatic worked hours calculation.
- Attendance correction workflow with manager review and approval routing.
- Multi-calendar support (Regional, Metro, Shift-based) and optional holiday selection.
- Overtime and extra-work tracking linked to comp-off grants.

### 🌴 4. Leave Management & Policy Engine
- Accrual, allocation, and tracking for Casual Leave (CL), Sick Leave (SL), Earned Leave (EL), and Maternity/Paternity leave.
- Automated **Sandwich Policy** calculation engine (weekend/holiday inclusion based on configuration).
- **Comp-off Grants**: 90-day expiry enforcement linked to worked weekend/overtime attendance records.
- Leave encashment workflow and year-end balance carry-forward background job.
- Overlapping request prevention via database triggers.

### 💰 5. Payroll Engine & Indian Statutory Compliance
- Versioned per-employee salary structure components (Basic, HRA, Special Allowance, Bonuses).
- Pro-rata earnings calculation based on payable units and Loss-of-Pay (LOP) days.
- **Indian Statutory Compliance Engine**:
  - **Provident Fund (PF)**: Employer/Employee contributions with wage capping rules.
  - **Employee State Insurance (ESI)**: Eligibility thresholds and percentage calculations.
  - **Professional Tax (PT)**: State-specific slabs (Karnataka, Maharashtra, etc.).
  - **Income Tax / TDS**: Support for Old and New Tax Regimes.
- Payroll eligibility management UI for setting effective-dated inclusion/exclusion overrides.
- Automated payslip generation and distribution.

### 🚪 6. Separation & Full & Final (F&F) Offboarding
- Resignation submission, notice period computation, and last working day (LWD) calculation.
- Rescission handling before LWD.
- Inter-departmental clearance checklist (IT, Finance, Admin, HR).
- Automated F&F draft settlement calculation including encashment, asset recovery, and LOP deductions.
- Database triggers to detect attendance/leave modifications after draft creation and mark settlement as `stale`.

### 🧾 7. Expense Reimbursements & Receipts
- Category-based claim submissions with expense cap policy limits.
- File attachment receipt upload integrated with Supabase storage.
- Duplicate claim detection and manager approval routing.

### 🔔 8. Notifications & Reporting
- Workflow inbox notifications triggered on leave submissions, attendance corrections, and payroll releases.
- Live report exports for Attendance Summary, Leave Utilization, Statutory Compliance Register, and Payroll Register (downloadable as CSV).

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14.2](https://nextjs.org/) (App Router, Server Actions, React Server Components)
- **Language**: [TypeScript 5.7](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 3.4](https://tailwindcss.com/), [Lucide React Icons](https://lucide.dev/)
- **Database & Backend**: [Supabase](https://supabase.com/) / [PostgreSQL 15](https://www.postgresql.org/)
  - Row-Level Security (RLS)
  - Stored Procedures / RPCs (`has_permission`, `calculate_leave_days`, `compute_payroll`)
  - Automated Database Triggers
- **Testing**: [Playwright](https://playwright.dev/), [`@axe-core/playwright`](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright) for WCAG AA compliance

---

## ⚡ Prerequisites

Before running the application, ensure you have installed:

- **Node.js**: v18.x or v20.x (Recommended: v20.x LTS)
- **npm**: v9.x or v10.x
- **PostgreSQL / Supabase**:
  - Local Supabase CLI (`npx supabase start`), OR
  - Local PostgreSQL 15+ instance running on `localhost:5432` / Supabase Cloud Project

---

## 🚀 Quick Start Guide

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd HRMS
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your local or remote Supabase credentials in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key
```

### Step 4: Synchronize & Initialize Database Schema
Generate the combined master database script and apply it to your Database:
```bash
# 1. Merge all 20 modular SQL files into schema/combined_init.sql
npm run db:sync

# 2. Apply the generated SQL schema to your Postgres/Supabase instance
# Option A: Using psql CLI
psql -h localhost -p 54322 -U postgres -d hrms_db -f schema/combined_init.sql

# Option B: Run schema/combined_init.sql directly inside Supabase SQL Editor
```

### Step 5: Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 👥 Seeded Test Personas & Credentials

The database initialization script automatically bootstraps the following test accounts:

| Role | Email | Default Password | Description |
|---|---|---|---|
| **System Admin** | `admin@company.com` | `TempAdminPass123!` | Break-glass admin account (requires password change on 1st login) |
| **HR Admin** | `hr.admin@company.com` | `Password123!` | Full employee onboarding & leave policy management |
| **Payroll Admin** | `payroll.admin@company.com` | `Password123!` | Bulk payroll execution & salary structure management |
| **Manager** | `manager.m1@company.com` | `Password123!` | Team attendance approval & leave approvals |
| **Employee** | `employee.e1@company.com` | `Password123!` | Standard employee self-service (punch, apply leave, claims) |

---

## 📜 Available Scripts

In the project directory, you can run:

- `npm run dev` — Starts the Next.js development server on `localhost:3000`.
- `npm run build` — Compiles production build and runs Next.js type-checking/linting.
- `npm run start` — Starts the production server built with `npm run build`.
- `npm run lint` — Runs ESLint across `src/` to ensure code quality.
- `npm run db:sync` — Combines all 20 modular schema files into `schema/combined_init.sql`.
- `npm run test:e2e` — Executes Playwright P0 E2E tests on Chromium.
- `npm run test:e2e:p0` — Runs fast PR-gating P0 smoke & RBAC specs.
- `npm run test:e2e:full` — Executes full E2E test suite across browser matrix.
- `npm run test:e2e:nfr` — Runs Non-Functional Requirements (Accessibility & Performance) tests.

---

## 🏗️ Project Architecture

```
HRMS/
├── .github/
│   └── workflows/          # GitHub Actions CI/CD workflows (P0 gating on Chromium)
├── docs/                   # Product documentation, PRD, RBAC matrix, ADRs
│   ├── adr/                # Architectural Decision Records (0001–0004)
│   └── PRD.md              # Product Requirements Document
├── e2e/                    # Playwright end-to-end testing suite
│   ├── fixtures/           # Auth fixture (auth.fixture.ts) & DB assertions (db.fixture.ts)
│   ├── specs/              # Module, cross-module golden paths, and edge specs
│   └── global-setup.ts     # Global test environment seeding
├── schema/                 # 20 modular SQL schema files + combined initializer
│   ├── 00_setup.sql        # Extensions & core ENUMs
│   ├── 01_rbac.sql         # Roles, permissions, & has_permission RPC
│   ├── 05_attendance.sql   # Attendance records & punch triggers
│   ├── 06_leave.sql        # Leave requests, sandwich policy & comp-off
│   ├── 09_payroll.sql      # Payroll revisions, runs, and payslips
│   ├── 10_statutory.sql    # PF/ESI/PT/TDS statutory engines
│   └── combined_init.sql   # Master concatenated initializer
├── scripts/
│   └── db-apply.mjs        # Script to merge modular SQL files into combined_init.sql
├── src/
│   ├── app/                # Next.js App Router routes (/attendance, /payroll, /leave, etc.)
│   ├── components/         # Shared UI components, AppShell, Header, Sidebar
│   ├── lib/
│   │   ├── actions/        # Server Actions (Gated with assertPermission)
│   │   ├── auth/           # Permission check helpers (assertPermission.ts)
│   │   ├── services/       # Core business logic (payroll-engine, statutory-engine)
│   │   └── supabase/       # Supabase client configurations (Server & Client)
│   └── middleware.ts       # Route guard middleware
├── package.json
└── README.md
```

---

## 🧪 E2E Testing & Verification

The project includes an end-to-end test suite powered by Playwright with custom authentication fixtures (`auth.fixture.ts`) and direct database assertions (`db.fixture.ts`).

### Running Tests Locally

1. **Start the local server & backend** (or ensure `localhost:3000` is accessible).
2. **Execute Golden Path & Smoke Specs**:
   ```bash
   npm run test:e2e:p0
   ```
3. **Execute Full Suite**:
   ```bash
   npm run test:e2e:full
   ```
4. **View Playwright HTML Report**:
   ```bash
   npx playwright show-report e2e-report
   ```

---

## 📄 License & System Status

This project is an internal Enterprise HRMS application (v2.7 Release Candidate). All core modules, backend server actions, statutory engines, and E2E specs are verified.
