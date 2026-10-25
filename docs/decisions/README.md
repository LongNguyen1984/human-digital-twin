# Decision records

Short records of decisions that change scope, architecture, roadmap or compliance. One file per decision, numbered in order. A record is never rewritten: if a decision changes, add a new record that supersedes the old one and update the old one's **Status** line.

| # | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-core-and-twin-rings.md) | ASTRO-COMPANION is the core product; Human Digital Twin is the platform around it | Accepted | 2026-10-25 |

## Adding a record

1. Copy the template below to `NNNN-short-title.md` (next number, kebab-case title).
2. Fill it in. Keep it under a page.
3. Add a row to the table above.
4. If it changes the brief, update [`../project-brief.md`](../project-brief.md) in the same pull request.

## Template

```markdown
# NNNN. Title

- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD
- **Deciders:** names

## Context

What forces the decision: the problem, constraints, options considered.

## Decision

What was decided, in one or two sentences.

## Consequences

What changes because of it: work added or removed, risks, follow-ups.
```
