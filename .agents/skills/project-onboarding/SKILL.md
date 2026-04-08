---
name: project-onboarding
description: Project-level onboarding skill for Xidea. Use when starting work in this repository, handing the project to a new teammate, resuming after a gap, or when an agent needs to quickly learn the current rules, context, status, and task entrypoints before making changes.
---

# Project Onboarding

Use this skill at the start of work in the Xidea repository.

## Goal

Bring a new teammate or agent to productive context quickly, without relying on chat history.

This skill is the default entrypoint when someone needs to understand:

- what the project is trying to prove now
- what is in scope and out of scope
- how the team collaborates
- where long-term memory lives
- what the current tasks and risks are

## Read Order

Read these files in order:

1. [../../AGENTS.md](../../AGENTS.md)
2. [../../docs/spec.md](../../docs/spec.md)
3. [../../docs/status.md](../../docs/status.md)
4. [../../docs/plan.md](../../docs/plan.md)
5. [../../docs/agent-memory.md](../../docs/agent-memory.md)
6. [../../docs/memory/project-context.md](../../docs/memory/project-context.md)
7. [../../docs/memory/decision-log.md](../../docs/memory/decision-log.md)
8. [../../docs/memory/open-questions.md](../../docs/memory/open-questions.md)
9. [../../CONTRIBUTING.md](../../CONTRIBUTING.md)

Only read older or broader docs like `product-brief.md` and `architecture.md` if the current task truly needs them.

## Expected Output After Reading

After reading, the agent should be able to state:

- the current demo scope in 2 to 4 sentences
- the next highest-priority tasks
- which docs are stable memory vs current execution docs
- which owner likely owns the current task

## Doc Roles

- `spec.md`: what we are building now
- `plan.md`: what we are doing next
- `status.md`: where things currently stand
- `docs/memory/*`: long-lived memory

Treat `spec / plan / status` as the current operating layer.
Treat `docs/memory/` as durable memory that survives across sessions.

## Working Rules

- Default to simplifying scope, not expanding it
- Keep `main` buildable and demoable
- Use short-lived branches
- If a task changes team-wide understanding, update the relevant memory doc

## When To Update Docs

### Update `status.md`

- after finishing a meaningful task
- when blockers or risks change

### Update `plan.md`

- when priorities change
- when a task is added, removed, or re-owned

### Update `spec.md`

- only when current scope or demo goal changes

### Update `docs/memory/*`

- when a decision becomes durable and relevant beyond the current task

## Task Routing

For UI simplification or presentation work:

- also use `frontend-design`
- often use `react-xidea`

For learning logic, planner, or domain modeling:

- use `typescript-xidea`
- inspect `src/domain`

For project setup, collaboration, or context handoff:

- stay anchored to this skill and the docs above

