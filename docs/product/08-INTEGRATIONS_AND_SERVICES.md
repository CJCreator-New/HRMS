# HRMS v2.7 — Integrations, Services & Infrastructure

> **Audience**: Engineering, DevOps, Security, Product  
> **Last Updated**: August 19, 2026

---

## 1. External Service Integrations

### 1.1 Supabase (Primary Backend)

| Aspect | Detail |
|---|---|
| **Service** | Supabase (PostgreSQL 15 + Auth + Storage + Realtime) |
| **Purpose** | Database, authentication, file storage, row-level security |
| **SDK** | `@supabase/supabase-js` v2.48, `@supabase/ssr` v0.5 |
| **Auth Method** | Cookie-based SSR sessions |
| **RLS** | Enabled on all tables with role-scoped policies |
| **Storage** | File attachments (PDF, JPEG, PNG ≤10MB) |
| **Environment** | Local-first; cloud-ready for Supabase Cloud |

**Configuration**:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Client Instances**:
- `src/lib/supabase/server.ts` — Server-side client (Service Role)
- `src/lib/supabase/client.ts` — Client-side browser client (Anon Key)

### 1.2 Upstash Redis (Rate Limiting — Optional)

| Aspect | Detail |
|---|---|
| **Service** | Upstash Redis |
| **Purpose** | Distributed rate limiting (replaces in-memory Map) |
| **SDK** | `@upstash/redis` v1.38, `@upstash/ratelimit` v2.0 |
| **Status** | Dependencies installed; in-memory fallback active |

**Configuration** (when enabled):
```env
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

**Current State**: Rate limiter uses in-memory `Map<string, RateLimitEntry>` (gap F4 — planned migration to Upstash for production).

---

## 2. Authentication Architecture

### 2.1 Supabase Auth

| Feature | Implementation |
|---|---|
| **Login** | Email/password via Supabase Auth |
| **Session** | Cookie-based (`sb-access-token`) |
| **Password Reset** | Forced reset on first login (ADR 0001) |
| **User Resolution** | `auth.users` → `employees.auth_user_id` FK |
| **SSO/MFA** | Out of scope (Phase 1 MVP) |

### 2.2 Mock Authentication (Development/Testing)

| Feature | Implementation |
|---|---|
| **Mode** | Cookie-based email token (no Supabase Auth) |
| **Activation** | `NEXT_PUBLIC_MOCK_AUTH=true` or `NODE_ENV=test` |
| **RBAC** | Static table in `mock-rbac.ts` |
| **Personas** | 14 test personas defined in `e2e/fixtures/test-data.ts` |
| **Use Case** | Local development, E2E tests |

### 2.3 Auth Flow Diagram

```
Browser → Next.js Middleware
  │
  ├─ Check: Is mock mode enabled?
  │   ├─ Yes: Check mock token (email in cookie)
  │   │   └─ Verify against mock RBAC table
  │   └─ No: Check Supabase session
  │       └─ Verify via supabase.auth.getUser()
  │
  ├─ Resolve employee record
  │   └─ Query employees table by auth_user_id
  │
  ├─ Resolve roles
  │   └─ Query employee_roles → roles
  │
  ├─ Check route permissions
  │   └─ has_any_permission(perm_codes[]) RPC
  │
  └─ Allow / Redirect to /403
```

---

## 3. File Storage

### 3.1 Supabase Storage

| Aspect | Detail |
|---|---|
| **Bucket** | Document attachments |
| **File Types** | PDF, JPEG, PNG |
| **Max Size** | 10MB per file |
| **Scan Status** | `pending` → `clean` / `flagged` |
| **Access Control** | RLS-scoped by entity ownership |

### 3.2 Upload Flow

```
1. Client selects file
2. File validated (type, size)
3. Upload to Supabase Storage
4. Create document_attachments record
5. scan_status = 'pending'
6. Background scan initiated
7. scan_status updated to 'clean' or 'flagged'
```

---

## 4. Security Infrastructure

### 4.1 Content Security Policy (CSP)

Generated per-request in middleware with nonce-based script allowlisting:

```
default-src 'self'
script-src 'self' 'nonce-{random}'
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob: https://*.supabase.co
connect-src 'self' https://*.supabase.co wss://*.supabase.co
font-src 'self' data:
object-src 'none'
frame-ancestors 'none'
base-uri 'self'
form-action 'self'
```

### 4.2 HTTP Security Headers

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-XSS-Protection` | `1; mode=block` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

### 4.3 Rate Limiting

**Current Implementation** (in-memory):
```typescript
// src/lib/auth/rate-limit.ts
const rateLimitMap = new Map<string, RateLimitEntry>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const entry = rateLimitMap.get(key);
  if (!entry || Date.now() - entry.timestamp > windowMs) {
    rateLimitMap.set(key, { count: 1, timestamp: Date.now() });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
```

**Planned**: Migration to Upstash Redis for distributed rate limiting (gap F4).

### 4.4 Self-Grant Prevention

Database trigger prevents System Admin from granting approval permissions to themselves:

```sql
CREATE TRIGGER trg_block_self_grant
  BEFORE INSERT ON employee_roles
  FOR EACH ROW
  EXECUTE FUNCTION block_self_grant();
```

---

## 5. API Architecture

### 5.1 Server Actions (Primary API)

All mutations use Next.js Server Actions (not REST/GraphQL):

```
Client Component → Server Action → assertPermission() → Business Logic → Supabase
```

**22 Server Action Files**:
| File | Key Actions |
|---|---|
| `approvals.ts` | `getPendingApprovals()`, `approveItem()`, `rejectItem()` |
| `attendance.ts` | `punchCheckIn()`, `punchCheckOut()`, `submitCorrection()` |
| `auth.ts` | `login()`, `logout()`, `resetPassword()`, `getCurrentUserRoles()` |
| `leave.ts` | `applyLeave()`, `cancelLeave()`, `approveLeave()` |
| `payroll.ts` | `initiatePeriod()`, `runPayroll()`, `finalizePeriod()` |
| `employees.ts` | `createEmployee()`, `importCSV()`, `deactivateEmployee()` |
| `reimbursements.ts` | `submitClaim()`, `approveClaim()` |
| `offboarding.ts` | `submitResignation()`, `createFFSettlement()` |
| `salary.ts` | `createComponent()`, `assignStructure()` |
| `statutory.ts` | `createRuleVersion()`, `updateProfile()` |

### 5.2 Health Check API

```
GET /api/health
Response: { status: "ok", timestamp: "..." }
```

### 5.3 Global Search API

```
search_global(query TEXT) → TABLE (entity_type, entity_id, name, subtitle)
```

Searches across:
- Employees (by name, code, email)
- Departments (by name)
- Payroll periods (by month/year)

---

## 6. Infrastructure

### 6.1 Development Environment

| Component | Technology |
|---|---|
| **Runtime** | Node.js v18.x / v20.x |
| **Package Manager** | npm v9.x / v10.x |
| **Database** | Local Supabase CLI or PostgreSQL 15 |
| **Dev Server** | `npm run dev` (Next.js dev server, port 3000) |
| **Schema Sync** | `npm run db:sync` (merge 20 SQL files) |
| **Mock Data** | `npm run seed:mock` |

### 6.2 Build & Deployment

| Command | Purpose |
|---|---|
| `npm run build` | Production build with type-checking |
| `npm run start` | Start production server |
| `npm run lint` | ESLint across `src/` |
| `npm run test:unit` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E tests (Chromium) |
| `npm run test:e2e:full` | Full E2E suite (all browsers) |

### 6.3 CI/CD Pipeline

| Stage | Tool | Purpose |
|---|---|---|
| **Lint** | ESLint | Code quality |
| **Type Check** | TypeScript | Type safety |
| **Unit Tests** | Vitest | Logic correctness |
| **E2E Tests** | Playwright | User flow verification |
| **Accessibility** | axe-core | WCAG AA compliance |
| **Build** | Next.js | Production readiness |

### 6.4 Database Schema Management

| Step | Command | Purpose |
|---|---|---|
| 1 | Edit modular SQL files (`schema/00_*.sql` through `22_*.sql`) | Schema changes |
| 2 | `npm run db:sync` | Merge 24 modular files into `combined_init.sql` |
| 3 | `psql -f schema/combined_init.sql` | Apply to database |
| 4 | `npm run seed:mock` | Populate test data |

---

## 7. Environment Variables

### Required

| Variable | Purpose | Example |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbG...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbG...` |

### Optional

| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_MOCK_AUTH` | Enable mock authentication | `false` |
| `UPSTASH_REDIS_REST_URL` | Redis URL for rate limiting | N/A (in-memory fallback) |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token | N/A |

---

## 8. Integration Architecture Status

| Feature / Gap ID | Description | Status |
|---|---|---|
| F4 | Rate limiter in-memory with Upstash fallback | Configured (in-memory dev / Upstash prod) |
| F3 | Strict nonce-based CSP headers | **Resolved**: Cryptographic nonces enforced |
| D11 | Reimbursement two-stage routing (`manager_then_hr`) | **Resolved**: Multi-stage state machine active |
| — | No SSO/MFA integration | Out of scope (Phase 1 MVP) |
| — | No bank payment gateway | Out of scope (Phase 1 MVP) |
| — | No ERP/accounting integration | Out of scope (Phase 1 MVP) |

---

*Generated by Buffy (Codebuff Agent) — August 19, 2026*
