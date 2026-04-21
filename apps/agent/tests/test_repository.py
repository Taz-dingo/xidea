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

    thread_messages = repository.list_thread_messages("thread-1")
    project_threads = repository.list_project_threads("rag-demo")
    recent_messages = repository.list_recent_messages("thread-1")
    learner_state = repository.get_learner_unit_state("thread-1", "unit-rag-retrieval")
    review_state = repository.get_review_state("thread-1", "unit-rag-retrieval")
    thread_context = repository.get_thread_context("thread-1")
    review_events = repository.list_review_events("thread-1", "unit-rag-retrieval")

    assert len(thread_messages) == 2
    assert thread_messages[0].role == "user"
    assert thread_messages[1].role == "assistant"

    assert len(recent_messages) == 2
    assert recent_messages[0].role == "user"
    assert recent_messages[1].role == "assistant"

    assert len(project_threads) == 1
    assert project_threads[0]["thread_id"] == "thread-1"
    assert project_threads[0]["session_type"] == "study"
    assert project_threads[0]["knowledge_point_id"] == "unit-rag-retrieval"
    assert project_threads[0]["entry_mode"] == "chat-question"
    assert project_threads[0]["title"] == "RAG retrieval design"
    assert isinstance(project_threads[0]["summary"], str)
    assert project_threads[0]["status"] == "已更新"

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


def test_repository_generates_project_session_title_from_material_suggestion(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    now = datetime.now(timezone.utc)
    repository.save_project_material(
        SourceAsset(
            id="asset-uploaded-1",
            title="LLM、音视频、具身智能.md",
            kind="note",
            topic="多模态学习编排",
            summary="围绕 LLM、音视频、具身智能梳理学习主题。",
            status="ready",
            created_at=now,
            updated_at=now,
        ),
        project_id="rag-demo",
    )
    request = build_request(
        session_type="project",
        thread_id="thread-material-import",
        entry_mode="material-import",
        target_unit_id=None,
        source_asset_ids=["asset-uploaded-1"],
        messages=[
            {"role": "user", "content": "你先根据这份材料梳理主题，并产出可以继续学习的知识卡"},
        ],
    )
    run_result = run_agent_v0(request, repository=repository, llm=build_mock_llm())

    repository.save_run(request, run_result)

    project_threads = repository.list_project_threads("rag-demo")
    assert project_threads[0]["thread_id"] == "thread-material-import"
    assert project_threads[0]["title"].startswith("LLM")


def test_repository_persists_session_orchestration_in_thread_context(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    now = datetime.now(timezone.utc)
    repository.save_knowledge_points(
        [
            KnowledgePoint(
                id="kp-retrieval",
                project_id="rag-demo",
                title="retrieval 与召回覆盖",
                description="说明召回覆盖和候选集召回。",
                status="active",
                origin_type="seed",
                source_material_refs=["asset-rag"],
                created_at=now,
                updated_at=now,
            ),
            KnowledgePoint(
                id="kp-reranking",
                project_id="rag-demo",
                title="reranking 与精排判断",
                description="说明重排的职责边界。",
                status="active",
                origin_type="seed",
                source_material_refs=["asset-rag"],
                created_at=now,
                updated_at=now,
            ),
        ],
        states=[
            KnowledgePointState(
                knowledge_point_id="kp-retrieval",
                mastery=0,
                learning_status="new",
                review_status="idle",
                next_review_at=None,
                archive_suggested=False,
                updated_at=now,
            ),
            KnowledgePointState(
                knowledge_point_id="kp-reranking",
                mastery=0,
                learning_status="new",
                review_status="idle",
                next_review_at=None,
                archive_suggested=False,
                updated_at=now,
            ),
        ],
    )
    request = build_request(
        thread_id="thread-orchestration",
        target_unit_id=None,
        knowledge_point_id=None,
        session_type="study",
        topic="RAG retrieval design",
        messages=[
            {"role": "user", "content": "先带我理清 reranking 和召回的边界"},
        ],
    )
    run_result = run_agent_v0(request, repository=repository, llm=build_mock_llm())

    repository.save_run(request, run_result)

    thread_context = repository.get_thread_context("thread-orchestration")

    assert thread_context is not None
    assert thread_context["session_orchestration"] is not None
    assert thread_context["session_orchestration"]["candidate_pool_ids"] == [
        "kp-reranking",
        "kp-retrieval",
    ]
    assert thread_context["orchestration_events"][0]["kind"] == "plan_created"
    assert thread_context["plan"] is not None
    assert len(thread_context["activities"]) == 2
    assert thread_context["plan"]["selected_mode"] in {"guided-qa", "contrast-drill"}
    assert thread_context["activities"][0]["title"] != ""


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


def test_repository_deletes_knowledge_point_and_clears_thread_links(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    now = datetime.now(timezone.utc)
    repository.save_knowledge_points(
        [
            KnowledgePoint(
                id="kp-multimodal",
                project_id="rag-demo",
                title="多模态统一表示",
                description="说明音视频与文本共用表示空间。",
                status="active",
                origin_type="session-suggestion",
                origin_session_id="thread-study-1",
                source_material_refs=["asset-1"],
                created_at=now,
                updated_at=now,
            )
        ],
        states=[
            KnowledgePointState(
                knowledge_point_id="kp-multimodal",
                mastery=35,
                learning_status="learning",
                review_status="idle",
                updated_at=now,
            )
        ],
    )
    repository.save_knowledge_point_suggestions(
        [
            KnowledgePointSuggestion(
                id="suggestion-create-1",
                kind="create",
                project_id="rag-demo",
                session_id="thread-project-1",
                knowledge_point_id="kp-multimodal",
                title="多模态统一表示",
                description="说明音视频与文本共用表示空间。",
                reason="适合沉淀成知识卡。",
                status="accepted",
                created_at=now,
                updated_at=now,
            )
        ]
    )
    with repository._connect() as connection:
        connection.execute(
            """
            INSERT INTO projects(project_id, topic, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            ("rag-demo", "多模态学习", now.isoformat(), now.isoformat()),
        )
        connection.execute(
            """
            INSERT INTO threads(
              thread_id, project_id, topic, session_type, knowledge_point_id,
              title, summary, status, entry_mode, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "thread-study-1",
                "rag-demo",
                "多模态学习",
                "study",
                "kp-multimodal",
                "学习：多模态统一表示",
                "围绕多模态统一表示学习。",
                "已更新",
                "chat-question",
                now.isoformat(),
                now.isoformat(),
            ),
        )
        connection.execute(
            """
            INSERT INTO learner_unit_state(
              thread_id, unit_id, mastery, understanding_level, memory_strength,
              confusion_level, transfer_readiness, weak_signals, recommended_action,
              confidence, based_on, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "thread-study-1",
                "kp-multimodal",
                30,
                2,
                2,
                1,
                1,
                "[]",
                "teach",
                0.8,
                "test",
                now.isoformat(),
            ),
        )
        connection.execute(
            """
            INSERT INTO review_state(
              thread_id, unit_id, due_unit_ids, scheduled_at, review_reason,
              review_count, lapse_count, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "thread-study-1",
                "kp-multimodal",
                '["kp-multimodal"]',
                now.isoformat(),
                "test",
                1,
                0,
                now.isoformat(),
            ),
        )
        connection.execute(
            """
            INSERT INTO review_events(
              thread_id, unit_id, event_kind, event_at, review_reason, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                "thread-study-1",
                "kp-multimodal",
                "scheduled",
                now.isoformat(),
                "test",
                now.isoformat(),
            ),
        )
        connection.execute(
            """
            INSERT INTO thread_activity_decks(
              deck_id, thread_id, session_type, knowledge_point_id, completed_at, payload
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                "deck-1",
                "thread-study-1",
                "study",
                "kp-multimodal",
                now.isoformat(),
                '{"cards":[]}',
            ),
        )

    deleted = repository.delete_knowledge_point("rag-demo", "kp-multimodal")

    assert deleted is True
    assert repository.get_knowledge_point("rag-demo", "kp-multimodal") is None
    assert repository.get_knowledge_point_state("kp-multimodal") is None
    assert repository.list_knowledge_point_suggestions("rag-demo") == []
    assert repository.get_learner_unit_state("thread-study-1", "kp-multimodal") is None
    assert repository.get_review_state("thread-study-1", "kp-multimodal") is None
    assert repository.list_review_events("thread-study-1", "kp-multimodal") == []
    thread_record = repository.list_project_threads("rag-demo")[0]
    assert thread_record["knowledge_point_id"] is None
    assert repository.list_thread_activity_decks("thread-study-1")[0]["knowledge_point_id"] is None


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
    assert "T" not in project_memory.summary
    assert "+00:00" not in project_memory.summary
    assert project_learning_profile is not None
    assert project_learning_profile.current_stage == "stabilizing"
    assert project_context is not None
    assert project_context["project_memory"] is not None
    assert project_context["project_learning_profile"] is not None


def test_repository_persists_thread_activity_decks(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    request = build_request(
        session_type="study",
        knowledge_point_id="kp-rag-boundary",
        activity_result={
            "run_id": "run-study-1",
            "project_id": "rag-demo",
            "session_id": "thread-1",
            "activity_id": "batch-activity-rag-boundary",
            "knowledge_point_id": "kp-rag-boundary",
            "result_type": "exercise",
            "action": "submit",
            "answer": "已提交本组学习动作结果（2 张卡，尝试 2 次，已全部答对）。",
            "meta": {
                "items": [
                    {
                        "activityId": "activity-1",
                        "activityTitle": "边界判断",
                        "activityPrompt": "说明为什么不能只做向量召回。",
                        "knowledgePointId": "kp-rag-boundary",
                        "kind": "guided-qa",
                        "activitySnapshot": {
                            "id": "activity-1",
                            "kind": "quiz",
                            "knowledgePointId": "kp-rag-boundary",
                            "title": "边界判断",
                            "objective": "判断为什么不能只做向量召回。",
                            "prompt": "说明为什么不能只做向量召回。",
                            "support": "先区分候选召回和最终回答质量。",
                            "mode": "contrast-drill",
                            "evidence": ["召回不等于回答可用。"],
                            "submitLabel": "提交判断",
                            "input": {
                                "type": "text",
                                "placeholder": "写出你的判断",
                                "minLength": 4,
                            },
                        },
                        "action": "submit",
                        "responseText": "因为召回不等于回答可用。",
                        "selectedChoiceId": None,
                        "isCorrect": True,
                        "attempts": [],
                        "finalFeedback": "回答到位。",
                        "finalAnalysis": None,
                    },
                    {
                        "activityId": "activity-2",
                        "activityTitle": "信号辨析",
                        "activityPrompt": "区分召回率和排序质量。",
                        "knowledgePointId": "kp-rag-boundary",
                        "kind": "contrast-drill",
                        "activitySnapshot": {
                            "id": "activity-2",
                            "kind": "quiz",
                            "knowledgePointId": "kp-rag-boundary",
                            "title": "信号辨析",
                            "objective": "区分召回率和排序质量。",
                            "prompt": "区分召回率和排序质量。",
                            "support": "不要把命中候选和最终排序混为一谈。",
                            "mode": "contrast-drill",
                            "evidence": ["召回率高也可能排错。"],
                            "submitLabel": "提交判断",
                            "input": {
                                "type": "text",
                                "placeholder": "写出你的判断",
                                "minLength": 4,
                            },
                        },
                        "action": "submit",
                        "responseText": "召回率高也可能排错。",
                        "selectedChoiceId": None,
                        "isCorrect": True,
                        "attempts": [],
                        "finalFeedback": "区分准确。",
                        "finalAnalysis": None,
                    },
                ]
            },
        },
    )
    run_result = run_agent_v0(request, repository=repository, llm=build_mock_llm_for_review())

    repository.save_run(request, run_result)

    decks = repository.list_thread_activity_decks("thread-1")
    assert len(decks) == 1
    assert decks[0]["deck_id"] == "run-study-1"
    assert decks[0]["session_type"] == "study"
    assert decks[0]["knowledge_point_id"] == "kp-rag-boundary"
    assert len(decks[0]["cards"]) == 2
    assert decks[0]["cards"][0]["activitySnapshot"]["title"] == "边界判断"


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
