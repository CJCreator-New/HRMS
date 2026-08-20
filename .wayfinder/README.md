# Wayfinder — Local-Markdown Tracker

This repo has no usable hosted issue tracker (the `origin` remote
`github.com/CJCreator/HIMS-New` does not resolve for the authenticated `gh`
account), so wayfinder uses a **local-markdown tracker** (default per the
wayfinder skill). Everything lives under `.wayfinder/`.

## Operations

### The map
- File: `.wayfinder/map.md` — the canonical artifact, labelled `wayfinder:map`.
- It is an **index**, not a store: it lists decisions made and links to the
  ticket that holds each decision's detail. Never restate a decision in the map.

### Tickets
- Files: `.wayfinder/tickets/<NN>-<slug>.md` — each is a child issue of the map
  (frontmatter `parent: map`).
- Each ticket has a `type` label: `wayfinder:research`, `wayfinder:prototype`,
  `wayfinder:grilling`, or `wayfinder:task`.
- Body shape:
  - `## Question` — the decision or investigation, sized to one session.
  - On resolution the answer is recorded as a `## Resolution` section (the answer
    is **not** part of the body), the ticket is closed, and a one-line gist +
    link is appended to the map's **Decisions so far**.

### State, claims, and blocking
- Frontmatter `status`: `open` | `claimed` | `closed`.
- **Claiming** = setting `assignee` (the dev driving the map) *before* any work.
  An open, unassigned ticket is unclaimed; concurrent sessions skip claimed ones.
- Blocking is expressed with frontmatter `blockedBy: [<ticket-id>, ...]`
  (native dependency — tickets must exist before they can reference each other,
  so blocking edges are wired in a second pass after ticket creation).
- A ticket is **unblocked** when every ticket in `blockedBy` is `closed`.

### Frontier query
The **frontier** is the open, unblocked, unclaimed children — the edge of the known.
Query: grep all tickets for `status: open`, no `assignee`, and every id in
`blockedBy` closed.

```bash
# quick frontier scan
for f in .wayfinder/tickets/*.md; do
  grep -q '^status: open' "$f" || continue
  grep -q '^assignee:' "$f" && continue
  blocked=$(grep '^blockedBy:' "$f" | sed 's/blockedBy: \[//;s/\]//' | tr ',' ' ')
  ok=1
  for b in $blocked; do
    dep=$(grep -l "^id: $b$" .wayfinder/tickets/*.md)
    grep -q '^status: closed' "$dep" || ok=0
  done
  [ $ok -eq 1 ] && echo "$f"
done
```

### Refer by name
In narration, map and tickets are referred to by their **title**, never a bare
id or number. The id rides inside the link.
