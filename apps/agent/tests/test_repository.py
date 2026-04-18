from pathlib import Path
from datetime import datetime, timedelta, timezone

from xidea_agent.repository import SQLiteRepository
from xidea_agent.runtime import run_agent_v0
from xidea_agent.state import (
    AgentRequest,
    KnowledgePoint,
    KnowledgePointState,
    KnowledgePointSuggestion,
    SourceAsset,
)

from conftest import build_mock_llm, build_mock_llm_for_review


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
    run_result = run_agent_v0(request, llm=build_mock_llm_for_review())

    repository.save_run(request, run_result)

    recent_messages = repository.list_recent_messages("thread-1")
    learner_state = repository.get_learner_unit_state("thread-1", "unit-rag-retrieval")
    review_state = repository.get_review_state("thread-1", "unit-rag-retrieval")
    thread_context = repository.get_thread_context("thread-1")
    review_events = repository.list_review_events("thread-1", "unit-rag-retrieval")

    assert len(recent_messages) == 2
    assert recent_messages[0].role == "user"
    assert recent_messages[1].role == "assistant"

    assert learner_state is not None
    assert learner_state.recommended_action == "review"

    assert review_state is not None
    assert review_state.due_unit_ids == ["unit-rag-retrieval"]
    assert review_state.review_reason is not None

    assert thread_context is not None
    assert thread_context["entry_mode"] == "chat-question"
    assert thread_context["source_asset_ids"] == []

    assert len(review_events) == 2
    assert [event["event_kind"] for event in review_events] == ["reviewed", "scheduled"]


def test_repository_persists_and_resolves_knowledge_point_suggestion(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    request = build_request(
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[
            {
                "role": "user",
                "content": "我搞不清楚 embedding 和 reranking 是不是同一回事，它们的边界到底是什么？",
            },
        ],
    )
    run_result = run_agent_v0(request, llm=build_mock_llm())
    repository.save_run(request, run_result)

    suggestions = repository.list_knowledge_point_suggestions("rag-demo")
    assert len(suggestions) == 1
    assert suggestions[0].status == "pending"
    assert suggestions[0].title == "embedding 与 reranking 的边界"

    resolution = repository.resolve_knowledge_point_suggestion(
        "rag-demo",
        suggestions[0].id,
        "confirm",
    )
    assert resolution is not None
    assert resolution.suggestion.status == "accepted"
    assert resolution.knowledge_point is not None
    assert resolution.knowledge_point.title == "embedding 与 reranking 的边界"
    assert resolution.knowledge_point_state is not None
    assert resolution.knowledge_point_state.learning_status == "new"


def test_repository_resolves_archive_suggestion_and_archives_knowledge_point(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    now = datetime.now(timezone.utc)
    repository.save_knowledge_points(
        [
            KnowledgePoint(
                id="kp-rag-boundary",
                project_id="rag-demo",
                title="retrieval 与 reranking 的边界",
                description="说明 retrieval 与 reranking 在 RAG 里的职责边界。",
                status="active",
                origin_type="seed",
                source_material_refs=["asset-1"],
                created_at=now,
                updated_at=now,
            )
        ],
        states=[
            KnowledgePointState(
                knowledge_point_id="kp-rag-boundary",
                mastery=95,
                learning_status="stable",
                review_status="stable",
                next_review_at=now + timedelta(days=30),
                archive_suggested=True,
                updated_at=now,
            )
        ],
    )
    repository.save_knowledge_point_suggestions(
        [
            KnowledgePointSuggestion(
                id="suggestion-archive-1",
                kind="archive",
                project_id="rag-demo",
                session_id="thread-archive",
                knowledge_point_id="kp-rag-boundary",
                title="retrieval 与 reranking 的边界",
                description="说明 retrieval 与 reranking 在 RAG 里的职责边界。",
                reason="该知识点已经稳定，可以归档。",
                status="pending",
                created_at=now,
                updated_at=now,
            )
        ]
    )

    resolution = repository.resolve_knowledge_point_suggestion(
        "rag-demo",
        "suggestion-archive-1",
        "confirm",
    )

    assert resolution is not None
    assert resolution.suggestion.status == "accepted"
    assert resolution.knowledge_point is not None
    assert resolution.knowledge_point.status == "archived"
    assert resolution.knowledge_point_state is not None
    assert resolution.knowledge_point_state.learning_status == "archived"
    assert resolution.knowledge_point_state.review_status == "archived"
    assert resolution.knowledge_point_state.archive_suggested is False


def test_repository_persists_activity_result_writeback_to_project_level_state(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    now = datetime.now(timezone.utc)
    repository.save_knowledge_points(
        [
            KnowledgePoint(
                id="kp-rag-boundary",
                project_id="rag-demo",
                title="retrieval 与 reranking 的边界",
                description="说明 retrieval 与 reranking 在 RAG 里的职责边界。",
                status="active",
                origin_type="seed",
                source_material_refs=["asset-1"],
                created_at=now,
                updated_at=now,
            )
        ],
        states=[
            KnowledgePointState(
                knowledge_point_id="kp-rag-boundary",
                mastery=40,
                learning_status="learning",
                review_status="idle",
                updated_at=now,
            )
        ],
    )

    request = build_request(
        messages=[{"role": "user", "content": "我这轮已经做完复习，继续吧。"}],
        activity_result={
            "run_id": "run-review-1",
            "project_id": "rag-demo",
            "session_id": "thread-1",
            "activity_id": "activity-unit-rag-retrieval-guided-qa",
            "knowledge_point_id": "kp-rag-boundary",
            "result_type": "review",
            "action": "submit",
            "answer": "retrieval 负责召回候选集，reranking 负责在候选集里做精排。",
            "meta": {"correct": True},
        },
    )
    run_result = run_agent_v0(request, repository=repository, llm=build_mock_llm_for_review())

    repository.save_run(request, run_result)

    knowledge_point_state = repository.get_knowledge_point_state("kp-rag-boundary")
    project_memory = repository.get_project_memory("rag-demo")
    project_learning_profile = repository.get_project_learning_profile("rag-demo")
    project_context = repository.get_project_context("rag-demo", "thread-1")

    assert knowledge_point_state is not None
    assert knowledge_point_state.mastery > 40
    assert knowledge_point_state.review_status == "scheduled"
    assert project_memory is not None
    assert "最近一次 review 结果" in project_memory.summary
    assert project_learning_profile is not None
    assert project_learning_profile.current_stage == "stabilizing"
    assert project_context is not None
    assert project_context["project_memory"] is not None
    assert project_context["project_learning_profile"] is not None


def test_repository_persists_project_materials(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    material = SourceAsset(
        id="material-uploaded-1",
        title="rag-notes.md",
        kind="note",
        topic="RAG 设计判断",
        summary="记录了召回、重排和上下文构造的判断标准。",
        source_uri="rag-notes.md",
        content_ref=str(tmp_path / "rag-notes.md"),
        status="ready",
    )

    repository.save_project_material(material, project_id="rag-demo")

    materials = repository.list_project_materials("rag-demo")
    selected_materials = repository.get_project_materials_by_ids("rag-demo", ["material-uploaded-1"])

    assert len(materials) == 1
    assert materials[0].id == "material-uploaded-1"
    assert materials[0].summary is not None
    assert len(selected_materials) == 1
    assert selected_materials[0].title == "rag-notes.md"
