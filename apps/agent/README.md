# Xidea Agent

Python orchestration core for Xidea.

## Intended Stack

- LangGraph for orchestration
- LangChain for model and tool integration
- FastAPI for service surface

## Current Scope

- define shared state
- define graph nodes and execution boundaries
- expose a minimal API for frontend integration later

## Current V0

- aligned `AgentRequest / diagnosis / plan / state-patch / StreamEvent` contract
- heuristic `load_context -> diagnose -> decide_action -> maybe_tool -> compose_response -> writeback` flow
- optional SQLite persistence for thread messages, learner unit state, and review state
- FastAPI endpoints for schemas, v0 runs, and storage inspection
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
