---
name: clean-code-guardrails
description: Enforce clean-code and single-responsibility guardrails across frontend, backend, and agent code in Xidea. Use when a file is becoming too large, an App/page/endpoint/graph entrypoint is absorbing domain logic, repository/prompt/UI concerns are mixed together, or a change should be refactored into clearer boundaries before continuing implementation.
---

# Clean Code Guardrails

Keep Xidea changes reviewable by splitting responsibilities early instead of letting one file become the default landing zone for new logic.

## Use This Skill To

- route new logic away from overweight entry files
- review whether one file now mixes orchestration, domain logic, adapter code, repository access, prompt construction, or UI details
- refactor a working feature into smaller modules without changing the product scope
- decide where new code belongs before continuing implementation

## Boundary Rules

- Treat `App`, page, screen, route, FastAPI endpoint, graph, and runtime entry files as orchestration layers.
- Move pure domain rules, selectors, formatting helpers, prompt builders, repositories, and reusable UI sections out of entry files.
- Prefer one reason to change per file. If a file would change for product copy, transport shape, domain rule, and UI styling at the same time, it is already carrying too much.
- Do not accept “we will split it later” as the default path when the current task already touches the crowded file.

## Workflow

### 1. Identify the dominant responsibility

Answer:

- Is this file primarily orchestration, domain logic, transport, persistence, prompt assembly, or presentation?
- Which lines do not belong to that dominant role?

If the answer is “several of these at once”, plan a split before adding more feature work.

### 2. Choose the split target

Use these defaults:

- frontend page orchestration -> `apps/web/src/app`
- reusable UI sections -> `apps/web/src/components`
- pure selectors, formatters, derived state, contracts -> `apps/web/src/domain`
- demo fixtures and seed data -> `apps/web/src/data`
- agent runtime orchestration -> `apps/agent/src/xidea_agent/.../runtime|graph`
- repositories and persistence access -> repository/storage modules
- prompt builders, tool adapters, guardrails -> dedicated modules near the agent domain they belong to

Read [references/split-map.md](references/split-map.md) when the destination is unclear.

### 3. Refactor in stable slices

- First extract pure helpers and selectors.
- Then extract reusable UI or adapter sections.
- Then simplify the entry file so it mostly wires state, dependencies, and callbacks together.
- Keep behavior unchanged while splitting. Do not combine refactor and new product scope unless the user asked for both.

### 4. Validate the result

Check:

- Did the entry file shrink in both code and responsibility count?
- Can the extracted module be named by a single job?
- Did the split reduce, not increase, cross-file confusion?
- Does the app or service still build and run?

Use [references/review-checklist.md](references/review-checklist.md) as the final pass.

## Smells That Should Trigger A Split

- an entry file contains many `useState`, `useEffect`, `useMemo`, handlers, and large JSX branches at once
- an endpoint both validates input, queries storage, applies domain rules, and shapes response copy
- a graph/runtime file both routes nodes and embeds prompt text, tool plumbing, and writeback logic
- a file adds “just one more helper” every time a new task lands
- code review gets harder because unrelated concerns changed in the same file

## Xidea-Specific Guidance

- Prefer small orchestration files that make the project-centric story readable for the next teammate.
- For frontend work, keep session/workspace layout code separate from chat parsing, review heatmap helpers, and seed/demo data.
- For backend and agent work, keep repository access, prompt construction, graph routing, and writeback logic in separate modules whenever possible.
- If a refactor changes an active team convention, update `AGENTS.md` or `docs/memory/decision-log.md`.
