---
type: wayfinder:task
id: 17
title: "D5: withdrawn lifecycle state unmodeled"
status: closed
assignee: buffy
parent: map
created: 2026-08-17
---

## Question

What does the `withdrawn` lifecycle state mean and why is it uncovered?

## Resolution

**Catalog entry — inventory gap (category: data/coverage).**

- `withdrawn` is in the TS union and the DB enum (6 states in code) but has:
  no persona in `e2e/fixtures/test-data.ts` / `scripts/seed-mock-data.mjs`,
  no lifecycle spec case, no UI treatment, and no glossary definition — 5 of
  the 6 states are modeled, this one is not.
- Presumed intent (needs FR confirmation): an employment record withdrawn
  before activation (offer rescinded) — distinct from `offboarded`.
- Fix direction (follow-up effort): either add a `withdrawn` persona + LIFE
  spec case + glossary entry, or remove the state from union + DB if out of
  scope for v2.7.
