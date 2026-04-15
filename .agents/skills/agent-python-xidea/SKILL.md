---
name: agent-python-xidea
description: Project-level Python agent skill for Xidea. Use when editing the learning-engine backend in `apps/agent/src/xidea_agent`, especially for Python runtime flow, prompt assembly, LangChain integration, LangGraph state transitions, repository logic, stream events, and agent-facing contracts.
---

# Agent Python Xidea

Use this skill when working on the Python learning-engine side of Xidea.

## Goal

Keep the backend easy to demo, easy to reason about, and easy to align with the frontend contract.

This skill covers the repo's Python agent surface, including:

- prompt and model orchestration
- LangGraph node flow and state transitions
- LangChain model or tool integration
- repository and persistence logic
- stream event contract for `apps/web`

## Read Order

1. [../../../AGENTS.md](../../../AGENTS.md)
2. [../../../docs/status.md](../../../docs/status.md)
3. [../../../docs/plan.md](../../../docs/plan.md)
4. [../../../docs/memory/decision-log.md](../../../docs/memory/decision-log.md)
5. [../../../docs/reference/architecture.md](../../../docs/reference/architecture.md) only if the task changes runtime or contract shape
6. [../../../docs/reference/agent-state-design.md](../../../docs/reference/agent-state-design.md) only if the task changes state, activity, or writeback structure

## Main Edit Surface

- `apps/agent/src/xidea_agent/api.py`: HTTP and SSE surface
- `apps/agent/src/xidea_agent/runtime.py`: orchestration loop and event flow
- `apps/agent/src/xidea_agent/llm.py`: prompts, parsing, model calls
- `apps/agent/src/xidea_agent/state.py`: typed graph state and activity schema
- `apps/agent/src/xidea_agent/repository.py`: persistence and retrieval

Keep these boundaries crisp:

- `state.py` owns shape
- `llm.py` owns model prompts and parsing
- `runtime.py` owns sequencing
- `api.py` owns transport
- repository code should not silently become prompt logic

## Preferred Patterns

### 1. Keep the runtime loop legible

Prefer a small number of clear steps over clever indirection.

Good:

- `load_context -> prepare_evidence -> agent_turn -> maybe_activity/tool -> writeback`

Avoid:

- hiding major runtime decisions inside utility helpers
- mixing parsing, transport, and writeback in one function

### 2. Treat frontend-visible behavior as contract work

If the frontend depends on an event, activity field, or prompt behavior, treat it as a contract, not an implementation detail.

Before changing event shape, confirm:

- what the frontend currently renders
- whether the change is additive or breaking
- whether docs need a matching update

### 3. Prompt changes should support product behavior, not just model output quality

When touching prompts, check whether the prompt helps the product actually behave the way the UI expects.

Examples:

- if the UI locks on a pending activity, the tutor prompt should reliably decide when to emit one
- if the UI wants short post-answer diagnosis, the prompt should avoid long freeform explanations
- if materials can be attached at any turn, prompt context should distinguish thread-level materials from turn-level attachments

### 4. Keep state typed and explicit

Prefer explicit typed fields over loosely structured dictionaries.

Good:

- `activity`
- `activities`
- `state_patch`
- `review_patch`

Avoid:

- passing freeform blobs between runtime stages when the shape is known

### 5. Favor additive migration paths

When evolving the backend:

- keep the current flow working while adding the next contract
- prefer additive event support before deleting fallback fields
- use docs to mark temporary adapters vs long-term contract

## LangChain / LangGraph Guidance

- Use LangGraph for visible orchestration boundaries, not as decoration
- Keep node responsibilities narrow and inspectable
- Do not let LangChain abstractions hide important prompt or parsing decisions
- If a plain Python helper is clearer than another chain abstraction, prefer the helper

For this repo, "mature agent loop" means:

- one user-visible run
- backend may iterate internally
- activity or tool decisions must still be explicit in runtime state and stream events

## Before Shipping

Check:

1. Which workstream owns this change: learning-engine, frontend, or shared contract?
2. Did the backend change any field the frontend depends on?
3. Did prompt changes make the UI behavior more reliable, not less?
4. If this changes shared understanding, did we update `docs/memory/decision-log.md`?
5. If this changes next steps or ownership, did we update `docs/status.md` or `docs/plan.md`?

## Validation

At minimum for backend changes:

- run the narrowest relevant Python validation first
- prefer repo tests if available
- if prompt/runtime behavior changed, also sanity-check the emitted event order and payload shape

If full backend validation is skipped, explicitly note:

- why it was skipped
- what user-facing risk remains
- what should be tested next
