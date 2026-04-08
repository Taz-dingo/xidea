from xidea_agent.state import GraphState


GRAPH_NODES = [
    "ingest_input",
    "diagnose_learner",
    "select_training_mode",
    "generate_plan",
    "write_back_memory",
]


def describe_graph() -> dict[str, object]:
    return {
        "nodes": GRAPH_NODES,
        "state_model": GraphState.model_json_schema(),
        "note": "Current skeleton for LangGraph-oriented orchestration. Implement node logic after state and path design stabilizes.",
    }

