# HRMS v2.7 — Local Backend & Developer Setup Guide

This guide walks you through setting up and running the Enterprise HRMS application locally.

---

## ⚡ 1. Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: `v18.x` or `v20.x` LTS (Recommended: `v20.x`)
- **npm**: `v9.x` or `v10.x` (or `bun` / `pnpm`)
- **Database (Optional if using Mock Mode)**:
  - Local PostgreSQL 15+ instance running on `localhost:5432` / `localhost:54322`, OR
  - Local Supabase CLI (`npx supabase start`), OR
  - A hosted Supabase project.

---

## ⚙️ 2. Environment Configuration

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Select your development mode in `.env.local`:

### Option A: Rapid Mock Auth Mode (Zero PostgreSQL Setup)
Ideal for instant UI development, component testing, and rapid workflow prototyping:
```env
NEXT_PUBLIC_MOCK_AUTH=true
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_anon_key
SUPABASE_SERVICE_ROLE_KEY=dummy_service_role_key
```

### Option B: Full-Stack Database Mode (PostgreSQL / Supabase)
Required for end-to-end database tests, RLS policy validation, and persistent data:
```env
NEXT_PUBLIC_MOCK_AUTH=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key
```

---

## 🗄️ 3. Database Initialization & Schema Application

When running in **Full-Stack Mode**, initialize your database with the modular schema:

### Step 1: Compile the Modular SQL Schema
The database schema consists of 24 modular SQL scripts (`schema/00_setup.sql` through `22_comprehensive_performance_indexes.sql` plus `bootstrap/01_system_admin.sql`). Merge them into a single script:
```bash
npm run db:sync
```

### Step 2: Apply the Generated Schema to PostgreSQL / Supabase
```bash
# Option A: Using psql CLI against local Postgres
psql -h localhost -p 5432 -U postgres -d hrms -f schema/combined_init.sql

# Option B: Using psql with Supabase CLI local pooler (port 54322)
psql -h localhost -p 54322 -U postgres -d postgres -f schema/combined_init.sql

# Option C: Paste contents of schema/combined_init.sql into Supabase Studio SQL Editor
```

### Step 3: Seed Realistic Test Data
Seed realistic employees, attendance punches, leave balances, salary structures, and reimbursement claims:
```bash
npm run seed:mock
```

---

## 👥 4. Seeded Test Personas & Credentials

The system provides 8 distinct enterprise roles out of the box:

| Role | Email | Default Password | Persona Code | Primary Capabilities |
|---|---|---|---|---|
| **System Admin** | `admin@company.com` | `TempAdminPass123!` | `persona-sysadmin-001` | Break-glass admin; tenant settings & role governance |
| **HR Admin** | `hr.admin@company.com` | `Password123!` | `persona-hr-001` | Employee lifecycle, onboarding, leave policies |
| **Payroll Admin** | `payroll.admin@company.com` | `Password123!` | `persona-payroll-001` | Salary structures, payroll batch runs, payslips |
| **Statutory Admin** | `statutory.admin@company.com` | `Password123!` | `persona-stat-001` | PF / ESI / PT / TDS statutory compliance registers |
| **Finance Admin** | `finance.admin@company.com` | `Password123!` | `persona-fin-001` | Expense reimbursement payouts & F&F settlement audit |
| **IT Admin** | `it.admin@company.com` | `Password123!` | `persona-it-001` | Hardware & IT asset clearance for offboarding |
| **Manager** | `manager.m1@company.com` | `Password123!` | `persona-mgr-001` | Team attendance review, leave approval, claim review |
| **Employee** | `employee.e1@company.com` | `Password123!` | `persona-emp-001` | Self-service web punch, leave requests, claim filing |

> [!NOTE]
> When `NEXT_PUBLIC_MOCK_AUTH=true`, you can switch between these personas dynamically using the **Persona Switcher** dropdown in the top navigation bar without logging in or out.

---

## 🚀 5. Launching the Application

Start the Next.js development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 6. Testing & Validation Commands

```bash
# Verify RBAC permission code sync between TypeScript and SQL
npm run verify:permissions

# Run Vitest unit & component test suite
npm run test:unit

# Run unit tests with code coverage report
npm run test:coverage

# Run Playwright P0 E2E smoke & RBAC specs
npm run test:e2e:p0

# Run golden path cross-module routing tests
npm run test:golden-path

# Run Non-Functional Requirements (NFR) accessibility & performance tests
npm run test:e2e:nfr
```

---

## 🛠️ 7. Troubleshooting

### Issue: "Missing or invalid Supabase credentials"
- **Cause**: `.env.local` is missing or `NEXT_PUBLIC_SUPABASE_URL` is empty while `NEXT_PUBLIC_MOCK_AUTH=false`.
- **Solution**: Set `NEXT_PUBLIC_MOCK_AUTH=true` in `.env.local` for instant mock mode, or provide valid Supabase credentials.

### Issue: "Permission sync verification failed"
- **Cause**: A permission code exists in `src/lib/auth/permissions-map.ts` that is not present in `schema/01_rbac.sql` (or vice versa).
- **Solution**: Update both files consistently and run `npm run verify:permissions`.

### Issue: "psql: connection to server at localhost, port 5432 failed"
- **Cause**: Local PostgreSQL is not running or running on a different port (e.g. Supabase CLI uses port `54322`).
- **Solution**: Verify the port with `npx supabase status` and pass `-p <port>` to `psql`.
