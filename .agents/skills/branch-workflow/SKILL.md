---
name: branch-workflow
description: Project-level branch and PR workflow skill for Xidea. Use when creating, renaming, or checking a branch name; scoping work into one short-lived branch; deciding the correct type/owner/topic format; or preparing a PR that follows the repo's collaboration rules. Especially relevant for requests like "拉个分支", "rename this branch", "这个分支名符合规范吗", or "准备提 PR".
---

# Branch Workflow

Use this skill whenever the task starts with a branch, branch rename, branch naming check, or PR-scoping request.

## Goal

Turn the repo's collaboration rules into an execution checklist so branch-related requests follow project conventions by default.

## Read Order

Read these files in order:

1. [../../../AGENTS.md](../../../AGENTS.md)
2. [../../../CONTRIBUTING.md](../../../CONTRIBUTING.md)
3. [../../../docs/collaboration-playbook.md](../../../docs/collaboration-playbook.md) only if collaboration rules seem ambiguous
4. [../../../docs/memory/decision-log.md](../../../docs/memory/decision-log.md) only if the task may change shared understanding

## Core Rules

- start new scoped work from `main` when practical
- keep one short-lived branch per topic
- default to one branch for one PR, then delete the branch after merge
- branch naming must be `type/owner/topic`
- allowed `type` values are `feat`, `docs`, `fix`, and `refactor`
- if the task changes team-wide understanding, update `docs/memory/decision-log.md`
- if the task changes current execution state or priorities, update `docs/status.md` or `docs/plan.md`

## Choose The Type

- `docs`: architecture discussions, decision records, demo scripts, collaboration-process updates, or documentation-only work
- `feat`: new demo capability, new screen, new API surface, or new learning behavior
- `fix`: bug, regression, broken build, or incorrect behavior
- `refactor`: structure or boundary cleanup without introducing new external behavior

When the user says they want a branch mainly to discuss, align, or document architecture, default to `docs`.

## Choose The Owner

- use the explicitly named owner if the user gave one
- otherwise default to the active executor for the session, typically `codex`, and state that assumption
- if the task is clearly being prepared for a known teammate, prefer that teammate's identifier over a role name

## Choose The Topic

- keep it to one scope phrase, usually 2 to 4 hyphenated words
- describe the work scope, not the implementation detail
- prefer names like `architecture-discussion`, `planner-ui`, or `agent-contract`
- avoid vague topics like `updates`, `changes`, or `misc`

## Workflow

1. Check the current branch and worktree state before switching.
2. If the request only needs a discussion branch, prefer `docs/...`.
3. If the current non-`main` branch already matches the task, keep it or rename it instead of creating a second branch.
4. Create or rename the branch with the repo convention in mind.
5. Tell the user the final branch name and any `type` or `owner` assumption you made.
6. After a PR is merged, prefer deleting the branch and opening the next task from a fresh branch instead of reusing the old one.
7. Before finishing the task, check whether `decision-log`, `status`, or `plan` also need updates.

## Output Expectations

When fulfilling a branch or PR workflow request, report:

- the chosen branch name
- why that `type` fits the task
- any `owner` assumption
- whether the task likely needs a `decision-log`, `status`, or `plan` update
