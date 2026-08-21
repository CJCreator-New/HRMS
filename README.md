# Enterprise Human Resource Management System (HRMS v2.7)

[![Next.js](https://img.shields.io/badge/Next.js-App_Router-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_15-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Vitest](https://img.shields.io/badge/Vitest-Unit_Testing-6E9F18?style=flat-square&logo=vitest)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E_Testing-45BA4B?style=flat-square&logo=playwright)](https://playwright.dev/)

An enterprise-grade, full-stack Human Resource Management System (HRMS) built with Next.js App Router, TypeScript, Server Actions, Tailwind CSS, and Supabase / PostgreSQL. Aligned with Indian statutory regulations (PF, ESI, PT, TDS), granular Role-Based Access Control (RBAC), and automated workflow engines.

---

## 📋 Table of Contents

- [Key Features & Modules](#-key-features--modules)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start Guide](#-quick-start-guide)
- [Development Modes (Mock vs Live)](#-development-modes)
- [Environment Variables](#-environment-variables)
- [Database Setup & Synchronization](#-database-setup--synchronization)
- [Seeded Test Personas & Credentials](#-seeded-test-personas--credentials)
- [Available Scripts](#-available-scripts)
- [Project Architecture & Documentation](#-project-architecture--documentation)
- [Testing & Verification](#-testing--verification)
- [Contributing & License](#-contributing--license)

---

## ✨ Key Features & Modules

### 🔐 1. Granular Role-Based Access Control (RBAC)
- 8 distinct enterprise roles: **System Admin**, **HR Admin**, **Payroll Admin**, **Manager**, **Employee**, **Statutory Admin**, **Finance Admin**, **IT Admin**.
- Multi-role union support per employee with server-side `assertPermission()` enforcement and Row Level Security (RLS) policies.
- Defense-in-depth against self-approval (e.g. managers cannot approve their own leave or grant themselves admin rights).

### 👥 2. Employee Lifecycle & Onboarding
- Complete employee directory with effective-dated department, designation, and manager assignments.
- Built-in CSV batch import UI (`/employees`) with duplicate validation and field mapping.
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

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React Server Components, Server Actions)
- **Language**: [TypeScript 5.7](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 3.4](https://tailwindcss.com/), [Lucide React Icons](https://lucide.dev/)
- **Database & Backend**: [Supabase](https://supabase.com/) / [PostgreSQL 15](https://www.postgresql.org/)
  - Row-Level Security (RLS)
  - Stored Procedures / RPCs (`has_permission`, `calculate_leave_days`, `compute_payroll`)
  - Automated Database Triggers
- **Testing**: [Vitest](https://vitest.dev/) (Unit/Component tests), [Playwright](https://playwright.dev/) (E2E), [`@axe-core/playwright`](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright) for WCAG AA compliance

---

## ⚡ Prerequisites

Before running the application, ensure you have:

- **Node.js**: v18.x or v20.x (Recommended: v20.x LTS)
- **npm**: v9.x or v10.x
- **PostgreSQL / Supabase (Optional for Mock Mode)**:
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

### Step 4: Choose Development Mode

#### Mode A: Rapid Mock Mode (Zero Database Setup Required)
Set `NEXT_PUBLIC_MOCK_AUTH=true` in `.env.local`:
```env
NEXT_PUBLIC_MOCK_AUTH=true
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
This enables instantaneous development with simulated personas and the top-bar Persona Switcher.

#### Mode B: Full-Stack Database Mode
Set `NEXT_PUBLIC_MOCK_AUTH=false` in `.env.local` and initialize the database:
```bash
# 1. Merge all 24 modular SQL schema files into schema/combined_init.sql
npm run db:sync

# 2. Apply combined schema to Postgres
psql -h localhost -p 5432 -U postgres -d hrms -f schema/combined_init.sql

# 3. Seed realistic mock records (employees, punch logs, leave balances)
npm run seed:mock
```

### Step 5: Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 👥 Seeded Test Personas & Credentials

The system provides 8 pre-seeded enterprise personas:

| Role | Email | Default Password | Persona Code | Description |
|---|---|---|---|---|
| **System Admin** | `admin@company.com` | `TempAdminPass123!` | `persona-sysadmin-001` | Break-glass admin account (requires password reset on 1st login) |
| **HR Admin** | `hr.admin@company.com` | `Password123!` | `persona-hr-001` | Full employee onboarding, directory & leave policy management |
| **Payroll Admin** | `payroll.admin@company.com` | `Password123!` | `persona-payroll-001` | Bulk payroll execution, revisions & salary structure management |
| **Statutory Admin** | `statutory.admin@company.com` | `Password123!` | `persona-stat-001` | PF, ESI, PT, and TDS statutory compliance registers |
| **Finance Admin** | `finance.admin@company.com` | `Password123!` | `persona-fin-001` | Expense reimbursement payouts & F&F settlement audit |
| **IT Admin** | `it.admin@company.com` | `Password123!` | `persona-it-001` | Hardware & IT asset clearance for offboarding |
| **Manager** | `manager.m1@company.com` | `Password123!` | `persona-mgr-001` | Team attendance review, leave approvals & claim reviews |
| **Employee** | `employee.e1@company.com` | `Password123!` | `persona-emp-001` | Self-service web punch, leave applications & claim filings |

---

## 📜 Available Scripts

In the project directory, you can run:

| Command | Description |
|---|---|
| `npm run dev` | Starts the Next.js development server on `localhost:3000` |
| `npm run build` | Compiles production build and runs Next.js type-checking/linting |
| `npm run start` | Starts the production server built with `npm run build` |
| `npm run lint` | Runs ESLint across `src/` to ensure code quality |
| `npm run db:sync` | Compiles 24 modular schema files into `schema/combined_init.sql` |
| `npm run seed:mock` | Seeds test personas, departments, leave balances, and punches |
| `npm run verify:permissions` | Verifies TypeScript `ROLE_PERMISSIONS_MAP` against `schema/01_rbac.sql` |
| `npm run test:unit` | Executes Vitest unit & component test suite (400+ tests) |
| `npm run test:coverage` | Runs Vitest with v8 code coverage reporting |
| `npm run test:e2e` | Executes Playwright P0 E2E tests on Chromium |
| `npm run test:e2e:p0` | Runs fast PR-gating P0 smoke & RBAC specs |
| `npm run test:e2e:rbac` | Executes dedicated RBAC permission enforcement specs |
| `npm run test:golden-path` | Executes cross-module golden path routing trace tests |
| `npm run test:e2e:full` | Executes full E2E test suite across browser matrix |
| `npm run test:e2e:nfr` | Runs Non-Functional Requirements (Accessibility & Performance) tests |
| `npm run test:audit` | Runs cross-module and RBAC audit specs |

---

## 🏗️ Project Architecture & Documentation

Detailed architecture specifications, guides, and ADRs are maintained under `docs/`:

```
HRMS/
├── .github/
│   ├── ISSUE_TEMPLATE/     # Bug report & feature request templates
│   ├── workflows/          # GitHub Actions CI/CD workflows
│   └── pull_request_template.md # PR submission checklist
├── docs/
│   ├── adr/                # Architectural Decision Records (ADRs 0001–0005)
│   ├── product/            # Product architecture & engineering specifications
│   ├── API_DOCUMENTATION.md # Server Actions, RPCs, and REST API reference
│   ├── DATABASE_MIGRATIONS.md # Modular SQL schema, sync workflow & seeding
│   ├── LOCAL_SETUP.md      # Detailed developer setup & troubleshooting
│   └── PRD.md              # Product Requirements Document
├── schema/                 # 24 modular SQL schema files + combined initializer
├── scripts/                # Database sync, mock seeding, and RBAC verification scripts
├── src/
│   ├── app/                # Next.js App Router pages (/attendance, /payroll, /leave, etc.)
│   ├── components/         # Shared UI components, AppShell, Header, Sidebar
│   ├── lib/
│   │   ├── actions/        # 22 Server Action modules (gated with assertPermission)
│   │   ├── auth/           # Permission maps & session helpers
│   │   ├── services/       # Core business logic (payroll, statutory engine)
│   │   └── supabase/       # Supabase client & admin SDK configurations
│   └── middleware.ts       # Route guard middleware & CSP headers
├── CONTRIBUTING.md         # Contribution guidelines & coding standards
├── CHANGELOG.md            # Semantic version release notes
└── LICENSE                 # Enterprise Proprietary License
```

---

## 🧪 Testing & Verification

The project enforces high test coverage across both unit tests (Vitest) and end-to-end user journeys (Playwright):

1. **Unit & Component Testing**:
   ```bash
   npm run test:unit
   ```
2. **Permission Synchronization Check**:
   ```bash
   npm run verify:permissions
   ```
3. **End-to-End Golden Paths**:
   ```bash
   npm run test:e2e:p0
   ```

---

## 📄 Contributing & License

- Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on code standards, branch conventions, and PR submission rules.
- See [CHANGELOG.md](CHANGELOG.md) for release notes.
- This software is governed by the [Enterprise Proprietary License](LICENSE). All rights reserved.
