# HRMS — Agent Workspace

Start here if you are an AI agent or a developer about to change this repository. This folder is the working set for building HRMS with subagents: a verified review of the product, a map of the code, a prioritized backlog, the workflow, and the team of agents.

## Read in this order

| # | Document | Purpose | Read when |
|---|---|---|---|
| 0 | [`AGENTS.md`](../../AGENTS.md) | Non-negotiable rules (security, schema, coding) | Always, first |
| 1 | [`01-E2E-PRODUCT-REVIEW.md`](./01-E2E-PRODUCT-REVIEW.md) | What was verified, what is broken or risky, doc drift | Before planning any change |
| 2 | [`02-MODULE-MAP.md`](./02-MODULE-MAP.md) | Route → action → service → schema → test for each module | Before editing a module |
| 3 | [`03-BACKLOG.md`](./03-BACKLOG.md) | Ticketed work (B-01…B-19) with definition of done | Choosing what to work on |
| 4 | [`04-DEV-WORKFLOW.md`](./04-DEV-WORKFLOW.md) | Commands, Definition of Done, recipes, troubleshooting | Before and after every change |
| 5 | [`05-AGENT-ROSTER.md`](./05-AGENT-ROSTER.md) | Which agent does what, the pipeline, handoff template | Delegating work |

## Agents

Defined in [`.claude/agents/`](../../.claude/agents/):

| Agent | Role |
|---|---|
| `hrms-rbac-auditor` | Read-only security/RBAC gate |
| `hrms-server-action-dev` | Server actions and services |
| `hrms-db-schema` | SQL, RLS, triggers, RPCs |
| `hrms-ui-dev` | Pages and components |
| `hrms-test-engineer` | Unit, integration, E2E tests and gate runs |
| `hrms-domain-reviewer` | Business-rule and statutory correctness |
| `hrms-docs` | Documentation accuracy |

## State at review (2026-10-19)

| Gate | Result |
|---|---|
| `npm run verify:permissions` | ✅ 62/62 codes, 8 roles |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors, 1 warning |
| `npm run db:sync` | ✅ `combined_init.sql` in sync |
| `npx vitest run` | ✅ 70 files, 649 tests |
| Integration, DB trigger, Playwright E2E, build | ⚪ not run (need live DB / browsers) |

**Top three things to know before touching code:**
1. The audit trail is probably not being written for user-scoped changes (review **F-01**, **F-02**; backlog **B-01**, **B-02**). Confirm on a live database first.
2. The working tree is dirty (55 entries, including the deletion of `.wayfinder/`). Get a decision on it (**B-06**) before large changes.
3. Older documents disagree with the code on counts and file names. Trust the commands in `04-DEV-WORKFLOW.md`, not the numbers in the older docs (**B-12**).

## Maintenance

- Re-run the review when the backlog is mostly closed, or each release. Record new results as dated sections in `01-E2E-PRODUCT-REVIEW.md`; do not overwrite earlier results.
- When a ticket closes, mark it closed in `03-BACKLOG.md` with the commit that closed it.
- Keep `02-MODULE-MAP.md` accurate when a route, action or schema file is added (the `hrms-docs` agent can check this).
