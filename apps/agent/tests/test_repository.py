from pathlib import Path

from xidea_agent.repository import SQLiteRepository
from xidea_agent.runtime import run_agent_v0
from xidea_agent.state import AgentRequest


def build_request(**overrides) -> AgentRequest:
    payload = {
        "project_id": "rag-demo",
        "thread_id": "thread-1",
        "entry_mode": "chat-question",
        "topic": "RAG retrieval design",
        "target_unit_id": "unit-rag-retrieval",
        "messages": [
            {"role": "user", "content": "我最近总忘这些概念，想做一次复习巩固"},
        ],
    }
    payload.update(overrides)
    return AgentRequest(**payload)


def test_repository_initializes_and_persists_run(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    request = build_request()
    run_result = run_agent_v0(request)

    repository.save_run(request, run_result)

    recent_messages = repository.list_recent_messages("thread-1")
    learner_state = repository.get_learner_unit_state("thread-1", "unit-rag-retrieval")
    review_state = repository.get_review_state("thread-1", "unit-rag-retrieval")

    assert len(recent_messages) == 2
    assert recent_messages[0].role == "user"
    assert recent_messages[1].role == "assistant"

    assert learner_state is not None
    assert learner_state.recommended_action == "review"
    assert "关键概念记忆不稳" in learner_state.weak_signals

    assert review_state is not None
    assert review_state.due_unit_ids == ["unit-rag-retrieval"]
    assert review_state.review_reason is not None
