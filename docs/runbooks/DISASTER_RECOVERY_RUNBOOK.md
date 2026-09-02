# Enterprise HRMS — Disaster Recovery & Business Continuity Runbook

## 1. Executive Summary & SLAs

| Metric | Target SLA | Strategy |
|---|---|---|
| **RPO (Recovery Point Objective)** | < 15 minutes | Continuous Write-Ahead Log (WAL) archiving via Supabase PITR |
| **RTO (Recovery Time Objective)** | < 60 minutes | Automated database restore + Vercel multi-region serverless fallback |
| **Data Retention** | 7 years | Statutory compliance requirement (PF, ESI, TDS, Form 16) |

---

## 2. Backup Architecture & Cadence

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Database                      │
│                    Supabase PostgreSQL                      │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
        Continuous WAL                   Nightly Dump
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│   Point-in-Time Recovery     │ │    Cold Encrypted Backup   │
│   (PITR) 7-Day Window        │ │    (AES-256 S3 / GCS)      │
└──────────────────────────────┘ └────────────────────────────┘
```

1. **Continuous Backup (Point-in-Time Recovery - PITR)**:
   - Enabled via Supabase Enterprise tier.
   - Retains write-ahead transaction logs for the past 7 days.
   - Allows restoration to any specific second (`YYYY-MM-DD HH:MM:SSZ`).

2. **Nightly Logical Dump**:
   - Automated scheduled dump via GitHub Actions / external cron:
     ```bash
     npx supabase db dump --linked -f backups/backup_$(date +%Y%m%d_%H%M%S).sql
     ```
   - Encrypted with AES-256 and stored in an isolated, immutable cloud storage bucket.

3. **Polymorphic Storage Buckets (`attachments`)**:
   - Document receipts and compliance proof stored in Supabase Storage.
   - S3-compatible versioning and lifecycle rules enabled.

---

## 3. Disaster Scenarios & Recovery Procedures

### Scenario A: Accidental Data Corruption or Erroneous Migration
1. **Freeze System Mutability**:
   - Set environment variable `MAINTENANCE_MODE=true` in Vercel.
   - Server Actions will immediately reject non-admin mutations.
2. **Identify Target Restoration Timestamp**:
   - Inspect immutable audit log (`audit_logs`) to determine the exact timestamp immediately preceding the corrupted operation:
     ```sql
     select id, created_at, actor_id, action, entity_type, entity_id
     from audit_logs
     order by created_at desc
     limit 20;
     ```
3. **Trigger PITR in Supabase**:
   - In Supabase Dashboard -> Database -> Backups -> Point in Time.
   - Select the target timestamp `T_target` (e.g., 2 minutes before the incident).
   - Initiate restore to new project or restore in-place.
4. **Run Verification Suite**:
   ```bash
   npm run verify:permissions
   npm run test:db
   ```
5. **Lift Maintenance Mode**:
   - Set `MAINTENANCE_MODE=false`.

---

### Scenario B: Cloud Region Outage / Failover
1. **Database DNS Failover**:
   - Point `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the standby replica.
2. **Next.js Edge Re-deployment**:
   - Redeploy the production release to the secondary region.
3. **Verify Health Probes**:
   - Request `GET /api/health` and assert:
     ```json
     {
       "status": "ok",
       "checks": {
         "database": "ok",
         "auth": "ok"
       }
     }
     ```

---

## 4. Key Rotation & Emergency Credential Invalidation

If any service key or session secret is compromised:

1. **Rotate Supabase Service Role Key**:
   - Generate a new key in Supabase API settings.
   - Update Vercel environment variables immediately.
   - Redeploy with `vercel --prod`.
2. **Invalidate Active Sessions**:
   - Execute auth revocation script:
     ```sql
     -- Terminate all user sessions
     delete from auth.sessions;
     delete from auth.refresh_tokens;
     ```
3. **Rotate Cookie Secret**:
   - Change `AUTH_COOKIE_SECRET` to invalidate all active signed mock/session cookies.

---

## 5. Post-Incident Review Checklist

- [ ] Execute `npm run test:db` to verify all triggers (`prevent_overlapping_leave_requests`, `validate_payroll_lock`) are operational.
- [ ] Verify RBAC synchronization via `npm run verify:permissions`.
- [ ] Conduct manual spot check on payroll period locking and separation settlements.
- [ ] Export incident timeline and audit logs to compliance archive.
