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
            {"role": "user", "content": "我分不清 retrieval 和 reranking 的职责"},
        ],
    }
    payload.update(overrides)
    return AgentRequest(**payload)


def test_run_agent_v0_prefers_clarify_for_confusion() -> None:
    result = run_agent_v0(build_request())

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.plan is not None
    assert result.graph_state.state_patch is not None
    assert result.graph_state.diagnosis.recommended_action == "clarify"
    assert result.graph_state.diagnosis.primary_issue == "concept-confusion"
    assert result.graph_state.plan.selected_mode == "contrast-drill"
    assert result.graph_state.tool_intent == "none"
    assert [event.event for event in result.events] == [
        "text-delta",
        "diagnosis",
        "plan",
        "state-patch",
        "done",
    ]


def test_run_agent_v0_uses_asset_summary_for_material_import() -> None:
    request = build_request(
        entry_mode="material-import",
        source_asset_ids=["asset-1", "asset-2"],
        messages=[{"role": "user", "content": "帮我先看这份材料，再判断我下一步该怎么学"}],
        target_unit_id=None,
    )

    result = run_agent_v0(request)

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.diagnosis.needs_tool is True
    assert result.graph_state.tool_intent == "asset-summary"
    assert result.graph_state.tool_result is not None
    assert result.graph_state.tool_result.kind == "asset-summary"


def test_run_agent_v0_schedules_review_for_recall_requests() -> None:
    request = build_request(
        messages=[{"role": "user", "content": "我最近总忘这些概念，想做一次复习巩固"}],
    )

    result = run_agent_v0(request)

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.state_patch is not None
    assert result.graph_state.diagnosis.recommended_action == "review"
    assert result.graph_state.state_patch.review_patch is not None
    assert result.graph_state.state_patch.review_patch.due_unit_ids == ["unit-rag-retrieval"]


def test_run_agent_v0_loads_recent_context_from_repository(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    first_request = build_request(
        messages=[{"role": "user", "content": "我分不清 retrieval 和 reranking 的职责"}],
    )
    first_result = run_agent_v0(first_request)
    repository.save_run(first_request, first_result)

    second_request = build_request(
        entry_mode="coach-followup",
        messages=[{"role": "user", "content": "继续吧，我想再确认一下我刚才混淆的点"}],
    )
    second_result = run_agent_v0(second_request, repository=repository)

    assert len(second_result.graph_state.recent_messages) >= 3
    assert any(
        "load_context pulled recent thread messages from SQLite repository."
        in item
        for item in second_result.graph_state.rationale
    )
