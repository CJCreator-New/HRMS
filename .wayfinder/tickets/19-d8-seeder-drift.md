---
type: wayfinder:task
id: 19
title: "D8: seeders drift — JS seeder vs mock_seed.sql"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

Why do two seed paths produce different local databases?

## Resolution

**Catalog entry — data gap (category: data).**

- `scripts/seed-mock-data.mjs` (canonical; run by `npm run seed:mock` and
  referenced by global-setup) covers all 14 personas with the full per-persona
  matrix from ticket `02`.
- `schema/mock_seed.sql` (offline fallback for a fresh Supabase) also covers 14
  personas but lacks the newer per-persona data (salary structures, statutory
  profiles, calendar/allocations, alt-approver records) — two seed paths, two
  data states.
- Fix direction (follow-up effort): either extend `mock_seed.sql` to parity or
  delete it in favor of the JS seeder so there is one canonical population
  path.
