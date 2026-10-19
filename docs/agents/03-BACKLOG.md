# HRMS — Ticket Board

**Status:** no open tickets. The review backlog (B-01 to B-19) was deleted on 2026-10-19 so that new development can start from a clean board. The findings behind those tickets are still recorded in [01-E2E-PRODUCT-REVIEW.md](./01-E2E-PRODUCT-REVIEW.md), and that file remains the source for open risks.

## How to add a ticket

Each ticket must let one agent work on it alone. Give it an ID `T-NNN` (next free number), a title, and these fields:

- **Goal:** the behaviour that must be true afterwards.
- **Scope:** files and modules in scope, and explicit exclusions.
- **Evidence:** `file:line` or the reproduction steps.
- **Acceptance criteria:** observable behaviour and the tests that must pass.
- **Definition of done:** the gates from [04-DEV-WORKFLOW.md](./04-DEV-WORKFLOW.md) §2.
- **Agent:** the `hrms-*` agent that owns it (see [05-AGENT-ROSTER.md](./05-AGENT-ROSTER.md)).

Cite the ticket ID in commit messages and PR titles, for example `feat(leave): add carry-forward cap (T-001)`.

## Open tickets

_None._

## Closed tickets

_None recorded on this board. Closed review items are listed in [01-E2E-PRODUCT-REVIEW.md](./01-E2E-PRODUCT-REVIEW.md)._
