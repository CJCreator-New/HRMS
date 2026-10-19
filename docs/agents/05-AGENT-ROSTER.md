# HRMS — Agent Roster and Delivery Pipeline

The project defines seven subagents in `.claude/agents/`. Each has a narrow tool set, reads the same rules (`AGENTS.md`) and these docs, and reports in a fixed format. Use them through the Agent tool with the `hrms-*` name as `subagent_type`. If a new agent does not appear in the list, restart the Claude Code session so it reloads `.claude/agents/`.

## 1. Roster

| Agent | Writes code? | Owns | Use when |
|---|---|---|---|
| `hrms-rbac-auditor` | No (read-only) | Authorization, roles, self-approval, mock auth, audit | Before merging anything that touches actions, permissions, routes, cookies, RLS/RPCs |
| `hrms-server-action-dev` | Yes | `src/lib/actions`, `src/lib/services`, `src/lib/auth`, types | Business logic, action wiring, typing, removing `any` |
| `hrms-db-schema` | Yes | `schema/*.sql`, `scripts/db-apply.mjs`, triggers, RLS, RPCs | Any table/column/policy/trigger/function change |
| `hrms-ui-dev` | Yes | `src/app`, `src/components` | Screens, forms, tables, error/loading states, a11y |
| `hrms-test-engineer` | Yes (tests only) | `**/__tests__`, `e2e/`, `scripts/test-*` | Regression tests, gate runs, flaky tests, coverage |
| `hrms-domain-reviewer` | No (read-only + web) | Business-rule correctness vs spec and statute | Changing leave, payroll, statutory, reimbursement, F&F rules |
| `hrms-docs` | Yes (docs only) | `docs/`, `README.md`, `AGENTS.md` (below its generated block), `CHANGELOG.md`, `CONTEXT.md` | Reconciling counts, superseding old docs, ADRs, commit plans |

Not in the roster but available: the global `e2e-test-writer` agent and the `forge:*` workflow. Prefer `hrms-test-engineer` for HRMS work so that it follows this repo's layers and commands.

## 2. Pipeline for a backlog ticket

```
  ticket (03-BACKLOG.md)
     │
     ├─ rule changes? ──► hrms-domain-reviewer  (spec + statute check, read-only)
     │
     ├─ SQL changes? ───► hrms-db-schema        (schema/*.sql, db:sync, live-DB check)
     │
     ├─ server logic? ──► hrms-server-action-dev (guards first, typed results)
     │
     ├─ UI changes? ────► hrms-ui-dev           (server-first, tokens, a11y)
     │
     ├─ tests ──────────► hrms-test-engineer    (regression first, gate runs)
     │
     ├─ security gate ──► hrms-rbac-auditor     (BLOCK / PASS WITH NOTES / PASS)
     │
     └─ docs ───────────► hrms-docs             (only if the ticket changes facts)
            │
            ▼
     Definition of Done (04-DEV-WORKFLOW.md §2) → commit on a branch → PR
```

Run independent branches in parallel (for example, UI and server action in different files). Serialize anything that touches the same file or `schema/combined_init.sql`.

## 3. Handoff template

Paste this into the agent prompt. Fill every field; write `none` when a field does not apply.

```
Ticket: B-xx — <title>  (docs/agents/03-BACKLOG.md)
Goal: <one sentence: the behaviour that must be true afterwards>
In scope: <files / modules>
Out of scope: <explicit exclusions>
Rules that apply: AGENTS.md §2 (security), §4 (coding), plus <specific>
Evidence: <file:line from the review or the reproduction>
Acceptance criteria:
  1. <observable behaviour>
  2. <test that must pass>
Gates to run: <from 04-DEV-WORKFLOW.md §2 — list the exact commands>
Constraints: no commit/push · do not edit schema/combined_init.sql by hand · no weakened guards
Report: files changed; command + exit code + summary for each gate; what was NOT verified
```

## 4. Review gates

| Gate | Who | Passes when |
|---|---|---|
| Security | `hrms-rbac-auditor` | Verdict PASS or PASS WITH NOTES; no BLOCK |
| Rules | `hrms-domain-reviewer` | Result MATCHES for each changed rule, or the deviation is ticketed |
| Tests | `hrms-test-engineer` | Required gates from the DoD ran and passed; not-run items are listed |
| Human | the owner | Reviews the diff and the report; approves the PR |

No agent may mark its own work as passing a gate it did not run.

## 5. Ticket order (recommended)

1. **B-06** — human decision on the working tree (unblocks everything else; agents work on a clean base).
2. **B-01** — confirm the audit-trigger issue on a live DB (`hrms-db-schema` + `hrms-test-engineer`).
3. **B-02** — audit write redesign (`hrms-rbac-auditor` design → `hrms-server-action-dev`).
4. **B-04** — guard-coverage regression test (`hrms-test-engineer`).
5. **B-03**, **B-19** — typing clean-up (`hrms-server-action-dev`), one module per PR.
6. **B-05** — mock cookie hardening (`hrms-rbac-auditor`).
7. **B-13** — run the gates this review could not run (`hrms-test-engineer`).
8. **B-12** — documentation reconciliation (`hrms-docs`), after the counts above settle.
9. P2 and P3 items as capacity allows.

## 6. Example invocations

**Verify the audit trigger (B-01 step 1):**
> Use `hrms-db-schema`. Ticket B-01 step 1 only. Against the live database in `.env.local`, confirm whether a user-scoped `update` on `employees` succeeds and whether it writes an `audit_logs` row. Do not change schema yet. Report the exact error text if it fails.

**Review a change before merge:**
> Use `hrms-rbac-auditor` on the diff of the current branch against `main`. Apply the checklist and return the report format.

**Guard test (B-04):**
> Use `hrms-test-engineer`. Ticket B-04. Write the guard-coverage test described in `docs/agents/03-BACKLOG.md`. Run `npx vitest run` on that file and report the result. Do not change action code.

**Documentation reconcile (B-12):**
> Use `hrms-docs`. Ticket B-12. Reproduce each count in `docs/agents/01-E2E-PRODUCT-REVIEW.md` §5 with the commands listed in its agent file, then update the documents named there. Report each change with its command.
