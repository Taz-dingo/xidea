"""Integration tests that call real LLM APIs.

Run with: uv run pytest tests/test_llm_integration.py -v -m llm
"""

from __future__ import annotations

import pytest

from xidea_agent.llm import (
    compose_with_llm,
    diagnose_with_llm,
    get_llm,
    reset_llm,
    _ensure_env,
)
from xidea_agent.runtime import run_agent_v0
from xidea_agent.state import (
    AgentRequest,
    LearnerUnitState,
    Message,
    Observation,
)
from xidea_agent.tools import retrieve_learning_unit

pytestmark = pytest.mark.llm


@pytest.fixture(autouse=True)
def _setup_llm():
    """Ensure LLM is configured for all tests in this module."""
    reset_llm()
    _ensure_env()
    client = get_llm()
    if client is None:
        pytest.skip("LLM not configured (OPENAI_API_KEY missing)")
    yield
    reset_llm()


def _build_request(**overrides) -> AgentRequest:
    payload = {
        "project_id": "rag-demo",
        "thread_id": "thread-1",
        "entry_mode": "chat-question",
        "topic": "RAG retrieval design",
        "target_unit_id": "unit-rag-retrieval",
        "messages": [
            {"role": "user", "content": "我分不清 retrieval 和 reranking 的职责边界"},
        ],
    }
    payload.update(overrides)
    return AgentRequest(**payload)


# ---------------------------------------------------------------------------
# 1. LLM diagnosis produces valid structured output
# ---------------------------------------------------------------------------


class TestLLMDiagnosis:
    def test_diagnosis_returns_valid_structure(self) -> None:
        messages = [Message(role="user", content="我分不清 retrieval 和 reranking 的职责")]
        observations = [
            Observation(
                observation_id="m1",
                kind="user-message",
                source="thread",
                summary="用户表达了概念混淆",
            )
        ]
        unit = retrieve_learning_unit("unit-rag-retrieval", "RAG retrieval")

        signals, learner_state, diagnosis = diagnose_with_llm(
            messages=messages,
            observations=observations,
            entry_mode="chat-question",
            learning_unit=unit,
            prior_state=None,
            target_unit_id="unit-rag-retrieval",
        )

        assert len(signals) > 0
        assert all(s.kind in (
            "concept-gap", "concept-confusion", "memory-weakness",
            "transfer-readiness", "review-pressure", "project-relevance",
        ) for s in signals)

        assert 0 <= learner_state.understanding_level <= 100
        assert 0 <= learner_state.confusion_level <= 100
        assert 0 <= learner_state.memory_strength <= 100
        assert 0 <= learner_state.transfer_readiness <= 100
        assert 0 <= learner_state.mastery <= 100

        assert diagnosis.recommended_action in (
            "teach", "clarify", "practice", "review", "apply"
        )
        assert diagnosis.primary_issue in (
            "insufficient-understanding", "concept-confusion",
            "weak-recall", "poor-transfer", "missing-context",
        )
        assert len(diagnosis.reason) > 5
        assert 0 <= diagnosis.confidence <= 1.0

    def test_diagnosis_detects_confusion(self) -> None:
        messages = [
            Message(role="user", content="向量召回和重排到底有什么区别？我总是混淆这两个概念的边界"),
        ]
        observations = [
            Observation(
                observation_id="m1",
                kind="user-message",
                source="thread",
                summary="用户明确表达概念混淆",
            )
        ]
        unit = retrieve_learning_unit("unit-rag-retrieval", "RAG retrieval")

        signals, learner_state, diagnosis = diagnose_with_llm(
            messages=messages,
            observations=observations,
            entry_mode="chat-question",
            learning_unit=unit,
            prior_state=None,
            target_unit_id="unit-rag-retrieval",
        )

        assert learner_state.confusion_level > 40
        confusion_signals = [s for s in signals if s.kind == "concept-confusion"]
        assert len(confusion_signals) >= 1

    def test_diagnosis_with_prior_state(self) -> None:
        messages = [
            Message(role="user", content="上次学的有点忘了，recall 和 rerank 分别负责什么来着"),
        ]
        observations = [
            Observation(
                observation_id="m1",
                kind="user-message",
                source="thread",
                summary="用户表达遗忘",
            )
        ]
        prior = LearnerUnitState(
            unit_id="unit-rag-retrieval",
            mastery=55,
            understanding_level=60,
            memory_strength=40,
            confusion_level=35,
            transfer_readiness=45,
        )
        unit = retrieve_learning_unit("unit-rag-retrieval", "RAG retrieval")

        signals, learner_state, diagnosis = diagnose_with_llm(
            messages=messages,
            observations=observations,
            entry_mode="chat-question",
            learning_unit=unit,
            prior_state=prior,
            target_unit_id="unit-rag-retrieval",
        )

        assert diagnosis.recommended_action in ("review", "clarify", "teach")
        assert len(diagnosis.reason) > 5


# ---------------------------------------------------------------------------
# 2. LLM compose produces meaningful teaching response
# ---------------------------------------------------------------------------


class TestLLMCompose:
    def test_compose_generates_chinese_response(self) -> None:
        messages = [Message(role="user", content="重排到底解决什么问题？")]
        observations = [
            Observation(
                observation_id="m1",
                kind="user-message",
                source="thread",
                summary="概念提问",
            )
        ]
        unit = retrieve_learning_unit("unit-rag-retrieval", "RAG retrieval")

        _, _, diagnosis = diagnose_with_llm(
            messages=messages,
            observations=observations,
            entry_mode="chat-question",
            learning_unit=unit,
            prior_state=None,
            target_unit_id="unit-rag-retrieval",
        )

        from xidea_agent.runtime import build_plan
        plan = build_plan(
            "RAG retrieval design",
            unit.title,
            unit.candidate_modes,
            diagnosis,
            LearnerUnitState(
                unit_id="unit-rag-retrieval",
                mastery=50, understanding_level=50,
                memory_strength=55, confusion_level=40,
                transfer_readiness=45,
            ),
        )

        response = compose_with_llm(
            diagnosis=diagnosis,
            plan=plan,
            tool_result=None,
            messages=messages,
            learning_unit=unit,
        )

        assert len(response) > 50
        assert any(ch >= '\u4e00' and ch <= '\u9fff' for ch in response)


# ---------------------------------------------------------------------------
# 3. End-to-end: run_agent_v0 with real LLM
# ---------------------------------------------------------------------------


class TestEndToEnd:
    def test_run_agent_v0_with_llm(self) -> None:
        request = _build_request()
        result = run_agent_v0(request)

        assert result.graph_state.diagnosis is not None
        assert result.graph_state.plan is not None
        assert result.graph_state.state_patch is not None
        assert result.graph_state.assistant_message is not None
        assert len(result.graph_state.assistant_message) > 50

        assert any("LLM" in r for r in result.graph_state.rationale)

        event_types = [e.event for e in result.events]
        assert event_types == ["text-delta", "diagnosis", "plan", "state-patch", "done"]

    def test_run_agent_v0_with_review_request(self) -> None:
        request = _build_request(
            messages=[{"role": "user", "content": "我最近总忘这些概念，想做一次复习巩固"}],
        )
        result = run_agent_v0(request)

        assert result.graph_state.diagnosis is not None
        assert result.graph_state.plan is not None
        assert result.graph_state.assistant_message is not None
        assert len(result.graph_state.assistant_message) > 30

    def test_run_agent_v0_with_material_import(self) -> None:
        request = _build_request(
            entry_mode="material-import",
            source_asset_ids=["asset-1", "asset-2"],
            messages=[{"role": "user", "content": "帮我先看这份材料，再判断我下一步该怎么学"}],
            target_unit_id=None,
        )
        result = run_agent_v0(request)

        assert result.graph_state.diagnosis is not None
        assert result.graph_state.tool_result is not None
        assert result.graph_state.assistant_message is not None

    def test_run_agent_v0_transfer_scenario(self) -> None:
        request = _build_request(
            messages=[
                {"role": "user", "content": "我想用 RAG 做一个项目文档搜索系统，怎么设计方案比较好？"},
            ],
        )
        result = run_agent_v0(request)

        assert result.graph_state.diagnosis is not None
        assert result.graph_state.plan is not None
        assert result.graph_state.assistant_message is not None
