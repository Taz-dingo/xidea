from pathlib import Path
from datetime import datetime, timedelta, timezone

from xidea_agent.repository import SQLiteRepository
from xidea_agent.runtime import (
    _boost,
    _multi_turn_frequency,
    _score_actions,
    build_signals,
    estimate_learner_state,
    iter_agent_v0_events,
    run_agent_v0,
)
from xidea_agent.review_engine import ReviewDecision
from xidea_agent.state import (
    AgentRequest,
    KnowledgePoint,
    KnowledgePointState,
    LearnerUnitState,
    Message,
    Observation,
    ProjectLearningProfile,
    ProjectMemory,
    Signal,
)

from conftest import (
    build_mock_llm,
    build_mock_llm_for_material_import,
    build_mock_llm_for_review,
    build_mock_llm_for_teach,
)


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
    result = run_agent_v0(build_request(), llm=build_mock_llm())

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.plan is not None
    assert result.graph_state.activity is not None
    assert result.graph_state.state_patch is not None
    assert result.graph_state.diagnosis.recommended_action == "clarify"
    assert result.graph_state.diagnosis.primary_issue == "concept-confusion"
    assert result.graph_state.plan.selected_mode == "contrast-drill"
    assert result.graph_state.activity.kind == "quiz"
    assert len(result.graph_state.activities) == 2
    assert result.graph_state.activities[1].kind == "coach-followup"
    assert result.graph_state.activity.input.type == "choice"
    assert result.graph_state.activity.input.choices[0].is_correct is True
    assert result.graph_state.activity.input.choices[1].is_correct is False
    assert len(result.graph_state.activity.input.choices[1].feedback_layers) >= 3
    assert result.graph_state.activity.input.choices[1].analysis is not None
    assert [event.event for event in result.events] == [
        "diagnosis",
        "text-delta",
        "plan",
        "activities",
        "state-patch",
        "done",
    ]


def test_iter_agent_v0_events_yields_incrementally() -> None:
    events = list(iter_agent_v0_events(build_request(), llm=build_mock_llm()))

    event_types = [event.event for event in events]
    assert event_types[:2] == ["status", "status"]
    assert event_types[2] == "diagnosis"
    assert event_types[3] == "status"
    assert event_types[4] == "text-delta"
    assert "plan" in event_types[4:-2]
    assert "activities" in event_types[4:-2]
    assert event_types[-2:] == ["state-patch", "done"]
    assert event_types.count("text-delta") >= 1


def test_iter_agent_v0_events_prefers_live_reply_stream_over_local_chunking() -> None:
    import json
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    from xidea_agent.llm import LLMClient

    main_decision_response = json.dumps({
        "signals": [
            {"kind": "concept-confusion", "score": 0.85, "confidence": 0.88, "summary": "用户混淆"},
        ],
        "diagnosis": {
            "recommended_action": "clarify",
            "reason": "用户明确表达分不清两个概念的职责边界",
            "confidence": 0.88,
            "primary_issue": "concept-confusion",
            "needs_tool": False,
        },
        "reply": "先把 retrieval 和 reranking 的边界拉清楚，再继续往项目判断里迁移。",
        "plan": {
            "headline": "围绕 retrieval vs reranking 的辨析路径",
            "summary": "先辨析边界再追问验证",
            "selected_mode": "contrast-drill",
            "expected_outcome": "能清晰说出两者的职责差异",
            "steps": [
                {"id": "contrast-boundary", "title": "对比辨析", "mode": "contrast-drill",
                 "reason": "LLM-reason", "outcome": "LLM-outcome"},
            ],
        },
    })

    def _response(content: str):
        message = SimpleNamespace(content=content)
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])

    def _stream_chunk(content: str):
        delta = SimpleNamespace(content=content)
        choice = SimpleNamespace(delta=delta)
        return SimpleNamespace(choices=[choice])

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _response(main_decision_response),
        iter([
            _stream_chunk("先把 retrieval 和 reranking 的边界"),
            _stream_chunk("拉清楚，再继续往项目判断里迁移。"),
        ]),
    ]
    llm = LLMClient(client=mock_client, model="GLM-4.1V-Thinking-Flash", provider="zhipu")

    events = list(iter_agent_v0_events(build_request(), llm=llm))
    event_types = [event.event for event in events]

    assert event_types[:4] == ["status", "status", "diagnosis", "status"]
    assert event_types[-2:] == ["state-patch", "done"]
    assert any(event.event == "plan" for event in events)
    assert "".join(event.delta for event in events if event.event == "text-delta").startswith("先把 retrieval")
    assert mock_client.chat.completions.create.call_count == 2


def test_run_agent_v0_emits_knowledge_point_suggestion_for_project_chat() -> None:
    request = build_request(
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[
            {
                "role": "user",
                "content": "我搞不清楚 embedding 和 reranking 是不是同一回事，它们的边界到底是什么？",
            }
        ],
    )

    result = run_agent_v0(request, llm=build_mock_llm())

    assert result.graph_state.activity is None
    assert len(result.graph_state.knowledge_point_suggestions) == 1
    suggestion = result.graph_state.knowledge_point_suggestions[0]
    assert suggestion.kind == "create"
    assert suggestion.status == "pending"
    assert suggestion.title == "embedding 与 reranking 的边界"
    assert [event.event for event in result.events] == [
        "diagnosis",
        "text-delta",
        "plan",
        "knowledge-point-suggestion",
        "state-patch",
        "done",
    ]


def test_project_session_never_emits_activity_even_with_target_unit() -> None:
    request = build_request(session_type="project")

    result = run_agent_v0(request, llm=build_mock_llm())

    assert result.graph_state.activity is None
    assert result.graph_state.activities == []
    assert "activities" not in [event.event for event in result.events]
    assert any("skipped activity because project session" in item for item in result.graph_state.rationale)


def test_project_session_low_info_short_circuits_without_calling_llm() -> None:
    llm = build_mock_llm()
    request = build_request(
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[{"role": "user", "content": "hi"}],
    )

    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.diagnosis.primary_issue == "missing-context"
    assert result.graph_state.activities == []
    assert result.graph_state.knowledge_point_suggestions == []
    assert result.graph_state.state_patch is not None
    assert result.graph_state.state_patch.learner_state_patch is None
    assert "project session" in (result.graph_state.assistant_message or "")
    assert "学习方向" in (result.graph_state.assistant_message or "")
    assert result.graph_state.plan is not None
    assert "补相关材料" in result.graph_state.plan.expected_outcome
    assert [event.event for event in result.events] == [
        "diagnosis",
        "text-delta",
        "plan",
        "state-patch",
        "done",
    ]
    assert any("project_chat low-info guardrail" in item for item in result.graph_state.rationale)
    assert llm.client.chat.completions.create.call_count == 0


def test_review_session_capability_message_short_circuits_without_calling_llm() -> None:
    llm = build_mock_llm()
    request = build_request(
        session_type="review",
        topic="RAG 系统设计",
        messages=[{"role": "user", "content": "hi，你可以做什么"}],
    )

    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.diagnosis.primary_issue == "missing-context"
    assert result.graph_state.activities == []
    assert result.graph_state.activity is None
    assert result.graph_state.assistant_message is not None
    assert "review session" in result.graph_state.assistant_message
    assert "主动回忆" in result.graph_state.assistant_message
    assert any("session_capability guard" in item for item in result.graph_state.rationale)
    assert [event.event for event in result.events] == [
        "diagnosis",
        "text-delta",
        "plan",
        "state-patch",
        "done",
    ]
    assert llm.client.chat.completions.create.call_count == 0


def test_project_session_does_not_write_learning_state_patch() -> None:
    request = build_request(
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[
            {
                "role": "user",
                "content": "我搞不清 retrieval 和 reranking 的边界，帮我先讲清楚它们分别控制什么。",
            }
        ],
    )

    result = run_agent_v0(request, llm=build_mock_llm())

    assert result.graph_state.state_patch is not None
    assert result.graph_state.state_patch.learner_state_patch is None
    assert result.graph_state.state_patch.review_patch is None


def test_run_agent_v0_blocks_off_topic_without_calling_llm() -> None:
    llm = build_mock_llm()
    request = build_request(
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[{"role": "user", "content": "上海明天天气怎么样？"}],
    )

    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.is_off_topic is True
    assert result.graph_state.diagnosis is not None
    assert result.graph_state.diagnosis.primary_issue == "off-topic"
    assert result.graph_state.activity is None
    assert result.graph_state.knowledge_point_suggestions == []
    assert result.graph_state.state_patch is not None
    assert result.graph_state.state_patch.learner_state_patch is None
    assert [event.event for event in result.events] == [
        "diagnosis",
        "text-delta",
        "plan",
        "state-patch",
        "done",
    ]
    assert llm.client.chat.completions.create.call_count == 0


def test_run_agent_v0_dedupes_boundary_suggestion_when_pair_order_changes(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    first_request = build_request(
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[
            {
                "role": "user",
                "content": "我搞不清楚 embedding 和 reranking 是不是同一回事，它们的边界到底是什么？",
            }
        ],
    )
    first_result = run_agent_v0(first_request, repository=repository, llm=build_mock_llm())
    repository.save_run(first_request, first_result)

    second_request = build_request(
        thread_id="thread-2",
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[
            {
                "role": "user",
                "content": "我还是分不清 reranking 和 embedding 的边界，怎么选？",
            }
        ],
    )
    second_result = run_agent_v0(second_request, repository=repository, llm=build_mock_llm())

    assert second_result.graph_state.knowledge_point_suggestions == []


def test_run_agent_v0_emits_archive_suggestion_for_stable_knowledge_point(tmp_path: Path) -> None:
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
                mastery=92,
                learning_status="stable",
                review_status="stable",
                next_review_at=now + timedelta(days=21),
                archive_suggested=False,
                updated_at=now,
            )
        ],
    )

    request = build_request(
        session_type="project",
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[{"role": "user", "content": "继续看看这个 project 现在还剩什么要处理。"}],
    )
    result = run_agent_v0(request, repository=repository, llm=build_mock_llm_for_teach())

    assert result.graph_state.activity is None
    assert len(result.graph_state.knowledge_point_suggestions) == 1
    suggestion = result.graph_state.knowledge_point_suggestions[0]
    assert suggestion.kind == "archive"
    assert suggestion.knowledge_point_id == "kp-rag-boundary"
    assert suggestion.title == "retrieval 与 reranking 的边界"


def test_iter_agent_v0_events_streams_reply_in_multiple_chunks() -> None:
    from unittest.mock import MagicMock
    import json

    from xidea_agent.llm import LLMClient

    main_decision_response = json.dumps({
        "signals": [
            {"kind": "concept-confusion", "score": 0.85, "confidence": 0.88, "summary": "用户混淆"},
        ],
        "diagnosis": {
            "recommended_action": "clarify",
            "reason": "用户明确表达分不清两个概念的职责边界",
            "confidence": 0.88,
            "primary_issue": "concept-confusion",
            "needs_tool": False,
        },
        "reply": "这不是简单拼接，因为检索、筛选、重排和上下文压缩各自承担不同职责，需要一起控制噪声、相关性和可解释性。",
        "plan": {
            "headline": "围绕 retrieval vs reranking 的辨析路径",
            "summary": "先辨析边界再追问验证",
            "selected_mode": "contrast-drill",
            "expected_outcome": "能清晰说出两者的职责差异",
            "steps": [
                {"id": "contrast-boundary", "title": "对比辨析", "mode": "contrast-drill",
                 "reason": "LLM-reason", "outcome": "LLM-outcome"},
            ],
        },
    })
    long_reply = "这不是简单拼接，因为检索、筛选、重排和上下文压缩各自承担不同职责，需要一起控制噪声、相关性和可解释性。"

    def _response(content: str):
        from types import SimpleNamespace

        message = SimpleNamespace(content=content)
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])

    def _stream_chunk(content: str):
        from types import SimpleNamespace

        delta = SimpleNamespace(content=content)
        choice = SimpleNamespace(delta=delta)
        return SimpleNamespace(choices=[choice])

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _response(main_decision_response),
        iter([
            _stream_chunk("这不是简单拼接，因为检索、筛选、重排"),
            _stream_chunk("和上下文压缩各自承担不同职责，需要一起控制噪声、相关性和可解释性。"),
        ]),
    ]
    llm = LLMClient(client=mock_client, model="GLM-4.1V-Thinking-Flash", provider="zhipu")

    events = list(iter_agent_v0_events(build_request(), llm=llm))

    event_types = [event.event for event in events]
    assert event_types[:2] == ["status", "status"]
    assert event_types[2] == "diagnosis"
    assert event_types[3] == "status"
    assert event_types[4] == "text-delta"
    text_deltas = [event.delta for event in events if event.event == "text-delta"]
    assert len(text_deltas) >= 2
    assert "".join(text_deltas) == long_reply


def test_run_agent_v0_uses_asset_summary_for_material_import() -> None:
    request = build_request(
        entry_mode="material-import",
        source_asset_ids=["asset-1", "asset-2"],
        messages=[{"role": "user", "content": "帮我先看这份材料，再判断我下一步该怎么学"}],
        target_unit_id=None,
    )

    llm = build_mock_llm_for_material_import()
    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.diagnosis.needs_tool is False
    assert result.graph_state.tool_intent == "none"
    assert result.graph_state.tool_result is not None
    assert result.graph_state.tool_result.kind == "asset-summary"
    assert llm.client.chat.completions.create.call_count == 1


def test_run_agent_v0_schedules_review_for_recall_requests() -> None:
    request = build_request(
        messages=[{"role": "user", "content": "我最近总忘这些概念，想做一次复习巩固"}],
    )

    result = run_agent_v0(request, llm=build_mock_llm_for_review())

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.state_patch is not None
    assert result.graph_state.diagnosis.recommended_action == "review"
    assert result.graph_state.state_patch.review_patch is not None
    assert result.graph_state.state_patch.review_patch.due_unit_ids == ["unit-rag-retrieval"]


def test_run_agent_v0_preloads_review_context_for_review_requests() -> None:
    request = build_request(
        session_type="review",
        messages=[{"role": "user", "content": "我最近总忘这些概念，想做一次复习巩固"}],
    )
    llm = build_mock_llm_for_review()

    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.tool_result is not None
    assert result.graph_state.tool_result.kind == "review-context"
    assert result.graph_state.tool_intent == "none"
    assert llm.client.chat.completions.create.call_count == 1


def test_review_session_coerces_non_review_diagnosis_when_confusion_is_not_high() -> None:
    request = build_request(
        session_type="review",
        messages=[{"role": "user", "content": "继续这一轮吧，我想稳一下刚学过的内容。"}],
    )

    result = run_agent_v0(request, llm=build_mock_llm_for_teach())

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.activity is not None
    assert result.graph_state.diagnosis.recommended_action == "review"
    assert result.graph_state.diagnosis.primary_issue == "weak-recall"
    assert result.graph_state.activity.kind == "recall"


def test_run_agent_v0_reuses_preloaded_unit_detail_when_main_decision_requests_tool() -> None:
    import json
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    from xidea_agent.llm import LLMClient

    main_decision_response = json.dumps({
        "signals": [
            {"kind": "concept-gap", "score": 0.82, "confidence": 0.85, "summary": "用户需要补单元细节"},
        ],
        "diagnosis": {
            "recommended_action": "teach",
            "reason": "需要补充当前学习单元的结构化细节后再继续",
            "confidence": 0.81,
            "primary_issue": "missing-context",
            "needs_tool": True,
        },
    })
    bundled_response = json.dumps({
        "reply": "我先把这个知识点的结构和常见误区拉出来，再带你过一遍核心判断。",
        "plan": {
            "headline": "围绕当前知识点结构化补全的教学路径",
            "summary": "先补骨架再追问验证",
            "selected_mode": "guided-qa",
            "expected_outcome": "能复述当前单元的关键框架",
            "steps": [
                {"id": "guided-model", "title": "导师问答", "mode": "guided-qa",
                 "reason": "先补结构化框架", "outcome": "能说清当前单元的关键判断"},
            ],
        },
    })

    def _response(content: str):
        message = SimpleNamespace(content=content)
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _response(main_decision_response),
        _response(bundled_response),
    ]
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    result = run_agent_v0(build_request(), llm=llm)

    assert result.graph_state.tool_result is not None
    assert result.graph_state.tool_result.kind == "unit-detail"
    assert result.graph_state.tool_intent == "unit-detail"
    assert any(
        "maybe_tool reused preloaded unit-detail context." in item
        for item in result.graph_state.rationale
    )
    assert mock_client.chat.completions.create.call_count == 2


def test_run_agent_v0_loads_recent_context_from_repository(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    first_request = build_request(
        messages=[{"role": "user", "content": "我分不清 retrieval 和 reranking 的职责"}],
    )
    first_result = run_agent_v0(first_request, llm=build_mock_llm())
    repository.save_run(first_request, first_result)

    second_request = build_request(
        entry_mode="coach-followup",
        messages=[{"role": "user", "content": "继续吧，我想再确认一下我刚才混淆的点"}],
    )
    second_result = run_agent_v0(second_request, repository=repository, llm=build_mock_llm())

    assert len(second_result.graph_state.recent_messages) >= 3
    assert any(
        "load_context pulled recent thread messages from SQLite repository."
        in item
        for item in second_result.graph_state.rationale
    )


def test_project_context_is_loaded_from_repository_not_frontend_hint(tmp_path: Path) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    first_request = build_request(topic="Persisted project topic")
    first_result = run_agent_v0(first_request, llm=build_mock_llm())
    repository.save_run(first_request, first_result)

    second_request = build_request(
        topic="Frontend hint topic",
        context_hint="前端拼出来的 project 叙事",
        messages=[{"role": "user", "content": "继续这个 project 的下一步"}],
    )
    second_result = run_agent_v0(second_request, repository=repository, llm=build_mock_llm())

    assert second_result.graph_state.project_context is not None
    assert second_result.graph_state.project_context.source == "repository"
    assert second_result.graph_state.project_context.topic == "Persisted project topic"
    assert second_result.graph_state.project_context.summary.startswith("当前 project 主题：Persisted project topic")


def test_run_agent_v0_applies_activity_result_writeback_and_preloads_project_state(
    tmp_path: Path,
) -> None:
    repository = SQLiteRepository(tmp_path / "agent.db")
    repository.initialize()
    now = datetime.now(timezone.utc)
    repository.save_knowledge_points(
        [
            KnowledgePoint(
                id="kp-rag-boundary",
                project_id="rag-demo",
                title="retrieval 与 reranking 的边界",
                description="说明 retrieval 与 reranking 在 RAG 中的职责分工。",
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
                mastery=42,
                learning_status="learning",
                review_status="idle",
                updated_at=now,
            )
        ],
    )
    repository.create_or_update_project_memory(
        ProjectMemory(
            project_id="rag-demo",
            summary="最近一次 project session 暴露 retrieval 与 reranking 的边界混淆。",
            updated_at=now,
        )
    )
    repository.create_or_update_project_learning_profile(
        ProjectLearningProfile(
            project_id="rag-demo",
            current_stage="building-understanding",
            primary_weaknesses=["concept-confusion"],
            learning_preferences=["contrast-drill"],
            freshness="fresh",
            updated_at=now,
        )
    )

    request = build_request(
        messages=[{"role": "user", "content": "我已经做完这轮辨析，继续下一步。"}],
        activity_result={
            "run_id": "run-1",
            "project_id": "rag-demo",
            "session_id": "thread-1",
            "activity_id": "activity-unit-rag-retrieval-contrast-drill",
            "knowledge_point_id": "kp-rag-boundary",
            "result_type": "exercise",
            "action": "submit",
            "answer": "应该先判断问题出在召回、重排还是上下文构造，而不是盲目加 chunk。",
            "meta": {"correct": True},
        },
    )

    result = run_agent_v0(request, repository=repository, llm=build_mock_llm())

    assert result.graph_state.project_context is not None
    assert result.graph_state.project_context.project_memory_summary is not None
    assert result.graph_state.project_context.project_learning_profile_summary is not None
    assert any(observation.kind == "exercise-result" for observation in result.graph_state.observations)
    assert result.graph_state.state_patch is not None
    assert result.graph_state.state_patch.review_patch is not None
    assert result.graph_state.knowledge_point_state_writebacks[0].knowledge_point_id == "kp-rag-boundary"
    assert result.graph_state.project_memory_writeback is not None
    assert result.graph_state.project_learning_profile_writeback is not None


# ---------------------------------------------------------------------------
# A. Multi-turn signal accumulation (rule-based helpers, tested directly)
# ---------------------------------------------------------------------------

def test_multi_turn_frequency_counts_user_messages() -> None:
    msgs = [
        Message(role="user", content="我分不清这两个概念"),
        Message(role="assistant", content="好的，来比较一下"),
        Message(role="user", content="我还是混淆，区别在哪"),
    ]
    count = _multi_turn_frequency(msgs, ("分不清", "混淆", "区别", "差别", "搞不清", "边界"))
    assert count == 2


def test_boost_single_turn_returns_base() -> None:
    assert _boost(0.82, 1) == 0.82


def test_boost_multi_turn_increases_score() -> None:
    boosted = _boost(0.82, 3)
    assert boosted > 0.82
    assert boosted <= 1.0


def test_build_signals_boosts_on_repeated_confusion() -> None:
    msgs = [
        Message(role="user", content="分不清 retrieval 和 reranking"),
        Message(role="assistant", content="区别在于..."),
        Message(role="user", content="还是搞不清区别"),
    ]
    obs = [Observation(observation_id="m1", kind="user-message", source="thread", summary="q")]
    signals = build_signals(msgs, obs, "chat-question")
    confusion_signals = [s for s in signals if s.kind == "concept-confusion"]
    assert len(confusion_signals) == 1
    assert confusion_signals[0].score > 0.82


def test_build_signals_adds_trend_when_prior_confusion_high() -> None:
    msgs = [Message(role="user", content="这边界我分不清")]
    obs = [Observation(observation_id="m1", kind="user-message", source="thread", summary="q")]
    prior = LearnerUnitState(
        unit_id="u1", mastery=50, understanding_level=48,
        memory_strength=58, confusion_level=55, transfer_readiness=50,
    )
    signals = build_signals(msgs, obs, "chat-question", prior_state=prior)
    confusion_signals = [s for s in signals if s.kind == "concept-confusion"]
    assert len(confusion_signals) == 2


def test_build_signals_adds_memory_trend_when_prior_weak() -> None:
    msgs = [Message(role="user", content="继续讲下一个知识点吧")]
    obs = [Observation(observation_id="m1", kind="user-message", source="thread", summary="q")]
    prior = LearnerUnitState(
        unit_id="u1", mastery=50, understanding_level=60,
        memory_strength=42, confusion_level=20, transfer_readiness=50,
    )
    signals = build_signals(msgs, obs, "chat-question", prior_state=prior)
    memory_signals = [s for s in signals if s.kind == "memory-weakness"]
    assert len(memory_signals) == 1
    assert "隐性遗忘风险" in memory_signals[0].summary


# ---------------------------------------------------------------------------
# B. Confidence-weighted estimation + dynamic confidence
# ---------------------------------------------------------------------------

def test_estimate_confidence_varies_with_signal_count() -> None:
    one_signal = [
        Signal(kind="concept-confusion", score=0.82, confidence=0.86, summary="s1", based_on=[]),
    ]
    two_signals = [
        Signal(kind="concept-confusion", score=0.82, confidence=0.86, summary="s1", based_on=[]),
        Signal(kind="memory-weakness", score=0.8, confidence=0.78, summary="s2", based_on=[]),
    ]
    state_1 = estimate_learner_state("u1", one_signal)
    state_2 = estimate_learner_state("u1", two_signals)
    assert state_2.confidence > state_1.confidence


def test_estimate_scales_delta_by_signal_confidence() -> None:
    high_conf = [Signal(kind="concept-confusion", score=0.82, confidence=0.95, summary="s", based_on=[])]
    low_conf = [Signal(kind="concept-confusion", score=0.82, confidence=0.55, summary="s", based_on=[])]
    state_high = estimate_learner_state("u1", high_conf)
    state_low = estimate_learner_state("u1", low_conf)
    assert state_high.confusion_level > state_low.confusion_level


# ---------------------------------------------------------------------------
# C. Action scoring replaces if-elif waterfall
# ---------------------------------------------------------------------------

def test_score_actions_clarify_wins_when_confusion_high() -> None:
    ls = LearnerUnitState(
        unit_id="u1", mastery=50, understanding_level=48,
        memory_strength=58, confusion_level=72, transfer_readiness=50,
    )
    review_dec = ReviewDecision(should_review=False, priority=0.0, reason="ok")
    scores = _score_actions(ls, review_dec)
    assert max(scores, key=lambda k: scores[k]) == "clarify"


def test_score_actions_review_wins_when_memory_weak() -> None:
    ls = LearnerUnitState(
        unit_id="u1", mastery=50, understanding_level=62,
        memory_strength=35, confusion_level=20, transfer_readiness=55,
    )
    review_dec = ReviewDecision(should_review=True, priority=0.46, reason="memory weak")
    scores = _score_actions(ls, review_dec)
    assert max(scores, key=lambda k: scores[k]) == "review"


def test_score_actions_teach_wins_when_understanding_low() -> None:
    ls = LearnerUnitState(
        unit_id="u1", mastery=40, understanding_level=35,
        memory_strength=70, confusion_level=25, transfer_readiness=60,
    )
    review_dec = ReviewDecision(should_review=False, priority=0.0, reason="stable")
    scores = _score_actions(ls, review_dec)
    best = max(scores, key=lambda k: scores[k])
    assert best == "teach"


def test_diagnosis_includes_action_scores_in_explanation() -> None:
    result = run_agent_v0(build_request(), llm=build_mock_llm())
    diag = result.graph_state.diagnosis
    assert diag is not None
    assert diag.explanation is not None


def test_diagnosis_resolves_confusion_vs_review_tradeoff() -> None:
    """When both confusion and memory weakness compete, scoring resolves it."""
    request = build_request(
        messages=[{"role": "user", "content": "我搞不清这两个概念，而且上次学的也快忘了"}],
    )
    result = run_agent_v0(request, llm=build_mock_llm())
    diag = result.graph_state.diagnosis
    assert diag is not None
    assert diag.recommended_action in ("clarify", "review", "teach")


# ---------------------------------------------------------------------------
# D. Effect assessment — prior action penalty
# ---------------------------------------------------------------------------

def test_score_actions_penalizes_repeated_ineffective_clarify() -> None:
    ls = LearnerUnitState(
        unit_id="u1", mastery=50, understanding_level=48,
        memory_strength=58, confusion_level=60, transfer_readiness=50,
    )
    prior = LearnerUnitState(
        unit_id="u1", mastery=55, understanding_level=52,
        memory_strength=58, confusion_level=58, transfer_readiness=50,
        recommended_action="clarify",
    )
    review_dec = ReviewDecision(should_review=False, priority=0.0, reason="ok")

    scores_no_prior = _score_actions(ls, review_dec, prior_state=None)
    scores_with_prior = _score_actions(ls, review_dec, prior_state=prior)
    assert scores_with_prior["clarify"] < scores_no_prior["clarify"]


def test_multi_round_escalation(tmp_path: Path) -> None:
    """Two rounds with confusion: second round should still decide but with richer signals."""
    repository = SQLiteRepository(tmp_path / "agent.db")
    first = run_agent_v0(
        build_request(
            messages=[{"role": "user", "content": "我分不清 retrieval 和 reranking"}],
        ),
        llm=build_mock_llm(),
    )
    repository.save_run(build_request(), first)

    second = run_agent_v0(
        build_request(
            entry_mode="coach-followup",
            messages=[{"role": "user", "content": "还是混淆，能再讲讲区别吗"}],
        ),
        repository=repository,
        llm=build_mock_llm(),
    )
    assert second.graph_state.diagnosis is not None
