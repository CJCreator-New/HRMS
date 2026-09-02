# Operational Runbook: Secret Rotation Procedure

**Target Audience**: DevOps, System Administrators, Security Engineers  
**Classification**: Enterprise Standard Operating Procedure (SOP)  
**Last Updated**: 2026-09-01  

---

## 1. Scope & Managed Secrets

The following cryptographic secrets and API tokens are managed within the HRMS deployment lifecycle:

| Secret Name | Location | Usage | Rotation Cadence |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Server Environment (.env.production, CI secrets) | Administrative access to PostgreSQL and bypass of RLS for background workers | 90 Days / Immediate on compromise |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser / Client Environment | Public anon client authentication to Supabase API gateway | 180 Days |
| `UPSTASH_REDIS_REST_TOKEN` | Server Environment | Authentication for distributed rate limiting & session caching | 90 Days |
| `MOCK_COOKIE_SECRET` | Server Environment | HMAC-SHA256 signing secret for development mock sessions | Per major release |

---

## 2. Rotation Runbook: `SUPABASE_SERVICE_ROLE_KEY`

1. **Generate New Service Key**:
   - Access the Supabase Dashboard -> Project Settings -> API.
   - Generate a secondary Service Role key or roll the existing secret.
2. **Update Deployment Secrets**:
   - Update repository secrets in GitHub Actions (`SUPABASE_SERVICE_ROLE_KEY`).
   - Update container environment secrets in your hosting orchestration (Kubernetes Secret / Docker Compose / Cloud Run).
3. **Verify Zero-Downtime Handshake**:
   - Execute the database trigger and RPC validation suite:
     ```bash
     npm run test:db
     ```
   - Hit `/api/health` and verify `components.supabase.status === "up"`.
4. **Invalidate Previous Key**:
   - After verification succeeds and all application pods/instances have reloaded, delete the old service key from the Supabase dashboard.

---

## 3. Rotation Runbook: `UPSTASH_REDIS_REST_TOKEN`

1. **Access Upstash Console**:
   - Open the target Redis database in Upstash Console -> Details -> REST API.
2. **Dual-Key Rotation**:
   - Upstash provides Read/Write primary and secondary tokens. Generate a new token.
   - Update `UPSTASH_REDIS_REST_TOKEN` in the environment configuration.
3. **Validate Rate Limiting**:
   - Run the automated rate-limit unit tests:
     ```bash
     npx vitest run src/lib/auth/__tests__/rate-limit.test.ts
     ```
   - Check `/api/health` to confirm `components.redis.status === "up"`.
4. **Revoke Old Token**:
   - Revoke the retired token from the Upstash console.

---

## 4. Emergency Secret Compromise Checklist

If a secret is exposed in a public repository, commit, or log:
- [ ] 1. Revoke the compromised secret immediately in the upstream provider dashboard (Supabase / Upstash).
- [ ] 2. Audit recent database actions via `schema/15_audit.sql` (`audit_logs` table) for unauthorized calls using service role credentials.
- [ ] 3. Run Gitleaks across git history: `gitleaks detect --verbose`.
- [ ] 4. Force invalidation of all active user sessions: `supabase.auth.admin.signOut()`.
- [ ] 5. File a Security Incident Report (P0/P1) documenting blast radius and remediation timestamp.
