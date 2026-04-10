---
name: docs-governance
description: Project-level documentation governance skill for Xidea. Use when deciding which docs to read first, where to record new information, how to update project memory, or how to maintain the docs structure without duplicating content. Especially relevant for spec/status/plan updates, docs/memory maintenance, collaboration docs, and documentation cleanup.
---

# Docs Governance

Use this skill when the task involves understanding, updating, or simplifying the Xidea documentation set.

## Goal

Help agents answer three questions consistently:

1. which docs are authoritative for this task
2. where a new fact or change should be written
3. how to update docs without creating duplicate or drifting sources of truth

## Canonical Layers

### 1. Operating layer

Use these for the current working state of the project:

- `docs/spec.md`: what we are building now
- `docs/status.md`: what is true now
- `docs/plan.md`: what we are doing next

### 2. Durable memory layer

Use these for information that should survive across sessions:

- `docs/memory/project-context.md`: stable background, target, scope
- `docs/memory/decision-log.md`: confirmed decisions, reasons, impact
- `docs/memory/open-questions.md`: unresolved questions with owner

### 3. Collaboration rules

Use these for process and team conventions:

- `AGENTS.md`: project rules for agents
- `CONTRIBUTING.md`: branch, PR, and collaboration conventions

### 4. Reference layer

These are supporting docs, not the first source of truth:

- `docs/product-brief.md`
- `docs/architecture.md`
- `docs/tech-stack.md`
- `docs/demo-showcase-strategy.md`
- `docs/backlog.md`
- `docs/collaboration.md`
- `docs/collaboration-playbook.md`
- `docs/agent-memory.md`

Read them only when the task actually needs broader context or historical framing.

## Read Strategy

### For general onboarding

Read in this order:

1. `AGENTS.md`
2. `docs/spec.md`
3. `docs/status.md`
4. `docs/plan.md`
5. `docs/memory/project-context.md`
6. `docs/memory/decision-log.md`
7. `docs/memory/open-questions.md`
8. `CONTRIBUTING.md`

### For a product or scope change

Read:

- `docs/spec.md`
- `docs/status.md`
- `docs/memory/project-context.md`
- `docs/memory/decision-log.md`

### For a collaboration or workflow change

Read:

- `AGENTS.md`
- `CONTRIBUTING.md`
- `docs/collaboration-playbook.md` only if needed

### For documentation cleanup

Read:

- `docs/spec.md`
- `docs/status.md`
- `docs/plan.md`
- `docs/memory/*`

Then treat other docs as candidates for consolidation, not default truth.

## Update Rules

### Update `docs/spec.md` when

- the current demo goal changes
- in-scope or out-of-scope boundaries change
- the core story or system framing changes

### Update `docs/status.md` when

- a meaningful task is finished
- current blockers or risks change
- the active focus of the team changes

### Update `docs/plan.md` when

- priorities change
- a task is added, removed, or re-owned
- the next concrete execution steps change

### Update `docs/memory/project-context.md` when

- a stable background fact becomes worth preserving
- the project target or persistent scope changes

### Update `docs/memory/decision-log.md` when

- the team confirms a product, technical, or collaboration decision
- the decision is durable and affects later work

### Update `docs/memory/open-questions.md` when

- a key unresolved question appears
- ownership of an open question becomes clear
- a previous question is no longer open

## Writing Rules

- prefer updating the smallest authoritative doc instead of many docs
- keep one fact owned by one main file whenever possible
- write conclusions, not chat transcripts
- keep durable memory short and reviewable
- do not turn brainstorms into fake decisions
- if a point is still unsettled, write it as an open question, not as spec

## Anti-Drift Checklist

Before finishing doc work, check:

1. did I update the authoritative file instead of only a reference doc
2. did I accidentally duplicate the same rule in multiple places
3. did I record durable decisions in `docs/memory/decision-log.md`
4. did I update `docs/status.md` or `docs/plan.md` if execution changed

## Task Routing

- Use `project-onboarding` first when context is still unclear
- Use this skill when the main problem is doc structure, source-of-truth, or doc maintenance
- Pair with `frontend-design`, `react-xidea`, or `typescript-xidea` only after the documentation target is clear
