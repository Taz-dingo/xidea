from pathlib import Path

from xidea_agent.graph import compile_graph
from xidea_agent.repository import SQLiteRepository
from xidea_agent.runtime import run_agent_v0
from xidea_agent.state import build_initial_graph_state, AgentRequest


def build_request(**overrides) -> AgentRequest:
    payload = {
        "project_id": "rag-demo",
        "thread_id": "thread-1",
        "entry_mode": "chat-question",
        "topic": "RAG retrieval design",
        "target_unit_id": "unit-rag-retrieval",
        "messages": [
            {"role": "user", "content": "我分不清 retrieval 和 reranking 的职责"},
        ],
    }
    payload.update(overrides)
    return AgentRequest(**payload)


def test_compiled_graph_produces_structured_state() -> None:
    request = build_request()
    graph = compile_graph()

    result = graph.invoke(build_initial_graph_state(request))

    assert result["diagnosis"]["recommended_action"] == "clarify"
    assert result["plan"]["selected_mode"] == "contrast-drill"
    assert result["state_patch"]["last_action"]["action"] == "clarify"


def test_compiled_graph_uses_repository_context(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    first_request = build_request(messages=[{"role": "user", "content": "我最近总忘这些概念，想做一次复习巩固"}])
    repository.save_run(first_request, run_agent_v0(first_request))

    second_request = build_request(
        entry_mode="coach-followup",
        messages=[{"role": "user", "content": "继续吧，我想再确认一下我刚才混淆的点"}],
    )
    graph = compile_graph(repository=repository)
    result = graph.invoke(build_initial_graph_state(second_request))

    assert len(result["recent_messages"]) >= 3
    assert any(
        "load_context pulled recent thread messages from SQLite repository." in item
        for item in result["rationale"]
    )
