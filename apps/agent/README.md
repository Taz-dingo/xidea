# Xidea Agent

Python orchestration core for Xidea.

## Intended Stack

- LangGraph for orchestration
- LangChain for model and tool integration
- FastAPI for service surface

## Current Scope

- define shared state, tool boundaries, and guardrails
- run the heuristic v0 orchestration loop with SQLite-backed persistence
- expose the FastAPI surface already consumed by `apps/web`

## Current V0

- aligned `AgentRequest / diagnosis / plan / state-patch / StreamEvent` contract
- heuristic `load_context -> diagnose -> decide_action -> maybe_tool -> compose_response -> writeback` flow
- optional SQLite persistence for thread messages, learner unit state, and review state
- FastAPI endpoints for `/health`, `/schemas`, `/runs/v0`, `/runs/v0/stream`, and storage inspection
- tests covering runtime, graph, API, and repository roundtrip

## Local Commands

Run tests:

```bash
uv --native-tls run --extra dev python -m pytest tests
```

Run the API:

```bash
uv --native-tls run python -m xidea_agent
```

Enable SQLite persistence:

```bash
export XIDEA_AGENT_DB_PATH=/absolute/path/to/xidea-agent.db
```
