from pathlib import Path
from datetime import datetime, timedelta, timezone

from xidea_agent.repository import SQLiteRepository
from xidea_agent.runtime import (
    _boost,
    _multi_turn_frequency,
    _score_actions,
    build_signals,
    estimate_learner_state,
    diagnose_state,
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
    assert [event.event for event in result.events] == [
        "diagnosis",
        "text-delta",
        "plan",
        "activity",
        "state-patch",
        "done",
    ]


def test_iter_agent_v0_events_yields_incrementally() -> None:
    events = list(iter_agent_v0_events(build_request(), llm=build_mock_llm()))

    event_types = [event.event for event in events]
    assert event_types[0] == "diagnosis"
    assert event_types[1] == "text-delta"
    assert "plan" in event_types[1:-2]
    assert "activity" in event_types[1:-2]
    assert event_types[-2:] == ["state-patch", "done"]
    assert event_types.count("text-delta") >= 1


def test_run_agent_v0_emits_knowledge_point_suggestion_for_project_chat() -> None:
    request = build_request(
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

    assert len(result.graph_state.knowledge_point_suggestions) == 1
    suggestion = result.graph_state.knowledge_point_suggestions[0]
    assert suggestion.kind == "create"
    assert suggestion.status == "pending"
    assert suggestion.title == "embedding 与 reranking 的边界"
    assert [event.event for event in result.events] == [
        "diagnosis",
        "text-delta",
        "plan",
        "activity",
        "knowledge-point-suggestion",
        "state-patch",
        "done",
    ]


def test_run_agent_v0_blocks_off_topic_without_calling_llm() -> None:
    llm = build_mock_llm()
    request = build_request(
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
        target_unit_id=None,
        topic="RAG 系统设计",
        messages=[{"role": "user", "content": "继续看看这个 project 现在还剩什么要处理。"}],
    )
    result = run_agent_v0(request, repository=repository, llm=build_mock_llm_for_teach())

    assert len(result.graph_state.knowledge_point_suggestions) == 1
    suggestion = result.graph_state.knowledge_point_suggestions[0]
    assert suggestion.kind == "archive"
    assert suggestion.knowledge_point_id == "kp-rag-boundary"
    assert suggestion.title == "retrieval 与 reranking 的边界"


def test_iter_agent_v0_events_streams_reply_in_multiple_chunks() -> None:
    from unittest.mock import MagicMock
    import json

    from xidea_agent.llm import LLMClient

    bundled_response = json.dumps({
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
    })
    plan_response = json.dumps({
        "headline": "围绕 retrieval vs reranking 的辨析路径",
        "summary": "先辨析边界再追问验证",
        "selected_mode": "contrast-drill",
        "expected_outcome": "能清晰说出两者的职责差异",
        "steps": [
            {"id": "contrast-boundary", "title": "对比辨析", "mode": "contrast-drill",
             "reason": "LLM-reason", "outcome": "LLM-outcome"},
        ],
    })
    long_reply = "这不是简单拼接，因为检索、筛选、重排和上下文压缩各自承担不同职责，需要一起控制噪声、相关性和可解释性。"

    def _response(content: str):
        from types import SimpleNamespace

        message = SimpleNamespace(content=content)
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _response(bundled_response),
        _response(long_reply),
        _response(plan_response),
    ]
    llm = LLMClient(client=mock_client, model="GLM-4.1V-Thinking-Flash", provider="zhipu")

    events = list(iter_agent_v0_events(build_request(), llm=llm))

    event_types = [event.event for event in events]
    assert event_types[0] == "diagnosis"
    assert event_types[1] == "text-delta"
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

    result = run_agent_v0(request, llm=build_mock_llm_for_material_import())

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.diagnosis.needs_tool is True
    assert result.graph_state.tool_intent == "asset-summary"
    assert result.graph_state.tool_result is not None
    assert result.graph_state.tool_result.kind == "asset-summary"


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
