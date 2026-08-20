# HRMS v2.7 — Local Backend & Database Setup Guide

This document provides step-by-step instructions to set up, initialize, and run the local PostgreSQL / Supabase backend and Next.js 14 application.

---

## 1. Prerequisites

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **PostgreSQL / Supabase Local Instance**:
  - Local Supabase CLI (`npx supabase start`), OR
  - Local PostgreSQL 15+ instance running on `localhost:5432`

---

## 2. Environment Configuration (`.env.local`)

Copy `.env.example` to `.env.local` and set your credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
```

---

## 3. Database Initialization & Schema Application

To apply all 20 modular schema files (`schema/00_setup.sql` through `19_reports.sql`) and bootstrap the break-glass System Admin account:

```bash
# 1. Regenerate combined_init.sql from modular files
npm run db:sync

# 2. Apply combined schema to local Postgres instance
# (or execute schema/combined_init.sql in pgAdmin / Supabase SQL Editor)
psql -h localhost -U postgres -d hrms -f schema/combined_init.sql
```

---

## 4. Bootstrapped System Admin Account (Break-Glass)

The initializer script automatically seeds the break-glass System Admin user:

- **Email**: `admin@company.com`
- **Employee Code**: `EMP-001`
- **Initial Password**: `TempAdminPass123!` (Requires forced reset on first login per ADR 0001)

---

## 5. Launching Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
