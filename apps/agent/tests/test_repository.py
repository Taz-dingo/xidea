import sqlite3
from pathlib import Path
from datetime import datetime, timedelta, timezone

import pytest

from xidea_agent.repository import SQLiteRepository
from xidea_agent.runtime import run_agent_v0
from xidea_agent.state import (
    AgentRequest,
    CreateProjectRequest,
    CreateSessionRequest,
    KnowledgePoint,
    KnowledgePointState,
    KnowledgePointSuggestion,
    UpdateKnowledgePointRequest,
    UpdateProjectRequest,
    UpdateSessionRequest,
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


def test_repository_creates_project_bootstrap(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")

    bootstrap = repository.create_project(
        CreateProjectRequest(
            title="RAG Demo 答辩排练",
            topic="围绕 RAG 系统设计准备比赛答辩",
            description="先收紧项目主题、材料边界和第一版知识点池。",
            special_rules=["优先围绕比赛答辩表达", "不要扩散到泛泛 AI 问答"],
            initial_materials=[
                {
                    "id": "asset-rag-overview",
                    "kind": "pdf",
                    "title": "RAG 系统设计概览",
                    "summary": "覆盖 retrieval、reranking 和 context construction。",
                },
                {
                    "kind": "web",
                    "title": "Retrieval vs Reranking",
                    "source_uri": "https://example.com/retrieval-vs-reranking",
                },
            ],
        )
    )

    assert bootstrap.project.title == "RAG Demo 答辩排练"
    assert bootstrap.project.special_rules == ["优先围绕比赛答辩表达", "不要扩散到泛泛 AI 问答"]
    assert len(bootstrap.sessions) == 1
    assert bootstrap.sessions[0].type == "project"
    assert len(bootstrap.project_materials) == 2
    assert len(bootstrap.session_attachments) == 2
    assert bootstrap.project_memory is not None
    assert bootstrap.project_memory.open_threads == [bootstrap.sessions[0].id]
    assert bootstrap.project_learning_profile is not None
    assert bootstrap.project_learning_profile.current_stage == "bootstrapping"
    assert len(bootstrap.knowledge_points) >= 1
    assert len(bootstrap.knowledge_point_states) == len(bootstrap.knowledge_points)

    project_context = repository.get_project_context(bootstrap.project.id, bootstrap.sessions[0].id)
    assert project_context is not None
    assert project_context["project_title"] == "RAG Demo 答辩排练"
    assert len(project_context["project_materials"]) == 2


def test_repository_updates_project_material_pool_without_losing_history(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    bootstrap = repository.create_project(
        CreateProjectRequest(
            title="RAG Demo",
            topic="RAG 系统设计",
            description="初始化 project。",
            initial_materials=[
                {"id": "asset-1", "kind": "pdf", "title": "RAG 概览"},
                {"id": "asset-2", "kind": "web", "title": "Reranking 指南"},
            ],
        )
    )

    updated = repository.update_project(
        bootstrap.project.id,
        UpdateProjectRequest(
            description="收敛答辩故事线与材料池。",
            initial_materials=[
                {"id": "asset-2", "kind": "web", "title": "Reranking 指南"},
                {"id": "asset-3", "kind": "note", "title": "答辩表达提纲"},
            ],
        ),
    )

    assert updated is not None
    assert updated.project.description == "收敛答辩故事线与材料池。"
    material_status = {material.id: material.status for material in updated.project_materials}
    assert material_status["asset-1"] == "archived"
    assert material_status["asset-2"] == "active"
    assert material_status["asset-3"] == "active"
    assert {attachment.project_material_id for attachment in updated.session_attachments} == {
        "asset-2",
        "asset-3",
    }


def test_repository_lists_projects_by_updated_at_desc(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    first = repository.create_project(
        CreateProjectRequest(
            project_id="project-first",
            title="First Project",
            topic="First Topic",
            description="First description",
        )
    )
    second = repository.create_project(
        CreateProjectRequest(
            project_id="project-second",
            title="Second Project",
            topic="Second Topic",
            description="Second description",
        )
    )

    repository.update_project(
        first.project.id,
        UpdateProjectRequest(description="First project touched later."),
    )

    projects = repository.list_projects()

    assert [project.id for project in projects] == [
        first.project.id,
        second.project.id,
    ]


def test_repository_creates_and_reads_session_detail(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    bootstrap = repository.create_project(
        CreateProjectRequest(
            project_id="project-rag-demo",
            title="RAG Demo",
            topic="RAG 系统设计",
            description="初始化 project。",
            initial_materials=[
                {"id": "asset-1", "kind": "pdf", "title": "RAG 概览"},
                {"id": "asset-2", "kind": "note", "title": "答辩表达提纲"},
            ],
        )
    )
    knowledge_point_id = bootstrap.knowledge_points[0].id

    detail = repository.create_session(
        bootstrap.project.id,
        CreateSessionRequest(
            session_id="session-review-rerank",
            type="review",
            focus_knowledge_point_ids=[knowledge_point_id],
            project_material_ids=["asset-2"],
        ),
    )

    assert detail is not None
    assert detail.session.id == "session-review-rerank"
    assert detail.session.type == "review"
    assert detail.session.focus_knowledge_point_ids == [knowledge_point_id]
    assert detail.thread_context is not None
    assert detail.thread_context.entry_mode == "chat-question"
    assert detail.thread_context.source_asset_ids == ["asset-2"]
    assert [attachment.project_material_id for attachment in detail.session_attachments] == ["asset-2"]

    sessions = repository.list_project_sessions(bootstrap.project.id)
    assert sessions[0].id == "session-review-rerank"

    project_memory = repository.get_project_memory(bootstrap.project.id)
    assert project_memory is not None
    assert project_memory.open_threads == [
        bootstrap.sessions[0].id,
        "session-review-rerank",
    ]

    fetched_detail = repository.get_session_detail(bootstrap.project.id, "session-review-rerank")
    assert fetched_detail is not None
    assert fetched_detail.session.id == "session-review-rerank"


def test_repository_updates_session_detail_and_open_threads(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    bootstrap = repository.create_project(
        CreateProjectRequest(
            project_id="project-rag-demo",
            title="RAG Demo",
            topic="RAG 系统设计",
            description="初始化 project。",
            initial_materials=[
                {"id": "asset-1", "kind": "pdf", "title": "RAG 概览"},
                {"id": "asset-2", "kind": "note", "title": "答辩表达提纲"},
            ],
        )
    )
    knowledge_point_id = bootstrap.knowledge_points[0].id
    repository.create_session(
        bootstrap.project.id,
        CreateSessionRequest(
            session_id="session-review-rerank",
            type="review",
            focus_knowledge_point_ids=[knowledge_point_id],
            project_material_ids=["asset-2"],
        ),
    )

    updated_detail = repository.update_session(
        bootstrap.project.id,
        "session-review-rerank",
        UpdateSessionRequest(
            title="复习：边界回拉",
            status="closed",
            focus_knowledge_point_ids=[],
            project_material_ids=["asset-1"],
        ),
    )

    assert updated_detail is not None
    assert updated_detail.session.title == "复习：边界回拉"
    assert updated_detail.session.status == "closed"
    assert updated_detail.session.focus_knowledge_point_ids == []
    assert updated_detail.thread_context is not None
    assert updated_detail.thread_context.source_asset_ids == ["asset-1"]
    assert [attachment.project_material_id for attachment in updated_detail.session_attachments] == [
        "asset-1"
    ]

    project_memory = repository.get_project_memory(bootstrap.project.id)
    assert project_memory is not None
    assert project_memory.open_threads == [bootstrap.sessions[0].id]


def test_repository_rejects_unknown_refs_when_creating_session(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    bootstrap = repository.create_project(
        CreateProjectRequest(
            project_id="project-rag-demo",
            title="RAG Demo",
            topic="RAG 系统设计",
            description="初始化 project。",
            initial_materials=[
                {"id": "asset-1", "kind": "pdf", "title": "RAG 概览"},
            ],
        )
    )

    with pytest.raises(ValueError, match="Unknown active project material ids"):
        repository.create_session(
            bootstrap.project.id,
            CreateSessionRequest(
                type="study",
                project_material_ids=["asset-missing"],
            ),
        )

    with pytest.raises(ValueError, match="Unknown project knowledge point ids"):
        repository.create_session(
            bootstrap.project.id,
            CreateSessionRequest(
                type="review",
                focus_knowledge_point_ids=["kp-missing"],
            ),
        )

    repository.create_session(
        bootstrap.project.id,
        CreateSessionRequest(
            session_id="session-review-rerank",
            type="review",
        ),
    )

    with pytest.raises(ValueError, match="Unknown active project material ids"):
        repository.update_session(
            bootstrap.project.id,
            "session-review-rerank",
            UpdateSessionRequest(project_material_ids=["asset-missing"]),
        )

    with pytest.raises(ValueError, match="Unknown project knowledge point ids"):
        repository.update_session(
            bootstrap.project.id,
            "session-review-rerank",
            UpdateSessionRequest(focus_knowledge_point_ids=["kp-missing"]),
        )


def test_repository_rejects_duplicate_session_id_when_creating_session(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    bootstrap = repository.create_project(
        CreateProjectRequest(
            project_id="project-rag-demo",
            title="RAG Demo",
            topic="RAG 系统设计",
            description="初始化 project。",
        )
    )

    with pytest.raises(ValueError, match="Session already exists"):
        repository.create_session(
            bootstrap.project.id,
            CreateSessionRequest(
                session_id=bootstrap.sessions[0].id,
                type="project",
            ),
        )


def test_repository_updates_knowledge_point_fields(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    bootstrap = repository.create_project(
        CreateProjectRequest(
            project_id="project-rag-demo",
            title="RAG Demo",
            topic="RAG 系统设计",
            description="初始化 project。",
            initial_materials=[
                {"id": "asset-1", "kind": "pdf", "title": "RAG 概览"},
                {"id": "asset-2", "kind": "note", "title": "答辩表达提纲"},
            ],
        )
    )
    knowledge_point_id = bootstrap.knowledge_points[0].id

    updated_record = repository.update_knowledge_point(
        bootstrap.project.id,
        knowledge_point_id,
        UpdateKnowledgePointRequest(
            title="更新后的知识点标题",
            description="更新后的知识点描述。",
            source_material_refs=["asset-2"],
        ),
    )

    assert updated_record is not None
    assert updated_record.knowledge_point.title == "更新后的知识点标题"
    assert updated_record.knowledge_point.description == "更新后的知识点描述。"
    assert updated_record.knowledge_point.source_material_refs == ["asset-2"]
    assert updated_record.knowledge_point_state is not None


def test_repository_rejects_unknown_project_material_refs_when_updating_knowledge_point(
    tmp_path: Path,
) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    bootstrap = repository.create_project(
        CreateProjectRequest(
            project_id="project-rag-demo",
            title="RAG Demo",
            topic="RAG 系统设计",
            description="初始化 project。",
            initial_materials=[
                {"id": "asset-1", "kind": "pdf", "title": "RAG 概览"},
            ],
        )
    )
    knowledge_point_id = bootstrap.knowledge_points[0].id

    with pytest.raises(ValueError, match="Unknown project material refs"):
        repository.update_knowledge_point(
            bootstrap.project.id,
            knowledge_point_id,
            UpdateKnowledgePointRequest(source_material_refs=["asset-missing"]),
        )


def test_repository_initialize_migrates_legacy_schema(tmp_path: Path) -> None:
    db_path = tmp_path / "legacy-agent.db"
    with sqlite3.connect(db_path) as connection:
        connection.executescript(
            """
            CREATE TABLE projects (
              project_id TEXT PRIMARY KEY,
              topic TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE threads (
              thread_id TEXT PRIMARY KEY,
              project_id TEXT NOT NULL,
              topic TEXT NOT NULL,
              entry_mode TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            """
        )
        connection.execute(
            """
            INSERT INTO projects(project_id, topic, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            ("legacy-project", "Legacy RAG Topic", "2026-04-18T00:00:00+00:00", "2026-04-18T00:00:00+00:00"),
        )
        connection.execute(
            """
            INSERT INTO threads(thread_id, project_id, topic, entry_mode, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                "thread-legacy-1",
                "legacy-project",
                "Legacy RAG Topic",
                "chat-question",
                "2026-04-18T00:00:00+00:00",
                "2026-04-18T00:00:00+00:00",
            ),
        )

    repository = SQLiteRepository(db_path)
    repository.initialize()

    project = repository.get_project("legacy-project")
    sessions = repository.list_project_sessions("legacy-project")

    assert project is not None
    assert project.title == "Legacy RAG Topic"
    assert project.description == "Legacy RAG Topic"
    assert sessions[0].title == "Legacy RAG Topic"
    assert sessions[0].type == "project"
