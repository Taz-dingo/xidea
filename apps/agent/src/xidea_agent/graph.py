from __future__ import annotations

from langgraph.graph import END, START, StateGraph
from pydantic import TypeAdapter

from xidea_agent.guardrails import ALL_GUARDRAILS
from xidea_agent.repository import SQLiteRepository
from xidea_agent.runtime import (
    compose_response_step,
    decide_action_step,
    diagnose_step,
    load_context_step,
    maybe_tool_step,
    writeback_step,
)
from xidea_agent.state import AgentRequest, GraphState, StreamEvent
from xidea_agent.tools import describe_tool_registry


GRAPH_NODES = [
    "load_context",
    "diagnose",
    "decide_action",
    "maybe_tool",
    "compose_response",
    "writeback",
]


def build_graph(repository: SQLiteRepository | None = None):
    graph = StateGraph(GraphState)

    graph.add_node("load_context", _load_context_node(repository))
    graph.add_node("diagnose", diagnose_node)
    graph.add_node("decide_action", decide_action_node)
    graph.add_node("maybe_tool", _maybe_tool_node(repository))
    graph.add_node("compose_response", compose_response_node)
    graph.add_node("writeback", writeback_node)

    graph.add_edge(START, "load_context")
    graph.add_edge("load_context", "diagnose")
    graph.add_edge("diagnose", "decide_action")
    graph.add_edge("decide_action", "maybe_tool")
    graph.add_edge("maybe_tool", "compose_response")
    graph.add_edge("compose_response", "writeback")
    graph.add_edge("writeback", END)

    return graph


def compile_graph(repository: SQLiteRepository | None = None):
    return build_graph(repository=repository).compile()


def describe_graph() -> dict[str, object]:
    return {
        "nodes": GRAPH_NODES,
        "edges": [
            "START -> load_context",
            "load_context -> diagnose",
            "diagnose -> decide_action",
            "decide_action -> maybe_tool",
            "maybe_tool -> compose_response",
            "compose_response -> writeback",
            "writeback -> END",
        ],
        "request_model": AgentRequest.model_json_schema(),
        "state_model": GraphState.model_json_schema(),
        "stream_event_model": TypeAdapter(StreamEvent).json_schema(),
        "tools": describe_tool_registry(),
        "guardrails": [guardrail.__name__ for guardrail in ALL_GUARDRAILS],
        "note": (
            "Current v0 LangGraph keeps observation, signal, diagnosis, plan, and state-patch "
            "aligned with the agreed web-agent contract."
        ),
    }


def _load_context_node(repository: SQLiteRepository | None):
    def node(state: GraphState) -> dict[str, object]:
        updated = load_context_step(state, repository=repository)
        return updated.model_dump(mode="python")

    return node


def diagnose_node(state: GraphState) -> dict[str, object]:
    updated = diagnose_step(state)
    return updated.model_dump(mode="python")


def decide_action_node(state: GraphState) -> dict[str, object]:
    updated = decide_action_step(state)
    return updated.model_dump(mode="python")


def _maybe_tool_node(repository: SQLiteRepository | None):
    def node(state: GraphState) -> dict[str, object]:
        updated = maybe_tool_step(state, repository=repository)
        return updated.model_dump(mode="python")

    return node


def compose_response_node(state: GraphState) -> dict[str, object]:
    updated = compose_response_step(state)
    return updated.model_dump(mode="python")


def writeback_node(state: GraphState) -> dict[str, object]:
    updated = writeback_step(state)
    return updated.model_dump(mode="python")
