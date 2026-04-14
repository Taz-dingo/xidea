"""Tests for the LLM integration layer (llm.py) using mocked OpenAI client."""

from __future__ import annotations

import json
from dataclasses import dataclass
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from xidea_agent.llm import (
    LLMClient,
    build_llm_client,
    enrich_plan_steps,
    generate_assistant_reply,
)
from xidea_agent.state import Diagnosis, LearnerUnitState, StudyPlan, StudyPlanStep


def _make_diagnosis(**overrides) -> Diagnosis:
    defaults = {
        "recommended_action": "clarify",
        "primary_issue": "concept-confusion",
        "confidence": 0.8,
        "reason": "用户混淆了 retrieval 和 reranking 的职责边界。",
        "explanation": None,
    }
    defaults.update(overrides)
    return Diagnosis(**defaults)


def _make_learner_state(**overrides) -> LearnerUnitState:
    defaults = {
        "unit_id": "unit-rag-retrieval",
        "mastery": 40,
        "understanding_level": 40,
        "memory_strength": 50,
        "confusion_level": 70,
        "transfer_readiness": 20,
    }
    defaults.update(overrides)
    return LearnerUnitState(**defaults)


def _make_plan(**overrides) -> StudyPlan:
    steps = overrides.pop("steps", [
        StudyPlanStep(
            id="contrast-boundary",
            title="概念辨析训练",
            mode="contrast-drill",
            reason="先比较相近概念的边界。",
            outcome="用户能说清两个概念分别解决什么问题。",
        ),
    ])
    defaults = {
        "headline": "围绕「RAG」的动态学习路径",
        "summary": "系统决定先执行概念辨析训练。",
        "selected_mode": "contrast-drill",
        "expected_outcome": "检视学习表现。",
        "steps": steps,
    }
    defaults.update(overrides)
    return StudyPlan(**defaults)


def _mock_openai_response(content: str) -> MagicMock:
    """Build a mock that mimics openai.ChatCompletion response shape."""
    message = SimpleNamespace(content=content)
    choice = SimpleNamespace(message=message)
    response = SimpleNamespace(choices=[choice])
    return response


def _make_mock_llm(response_content: str) -> LLMClient:
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(response_content)
    return LLMClient(client=mock_client, model="gpt-4o-mini")


# --- generate_assistant_reply ---


def test_generate_reply_returns_llm_content() -> None:
    llm = _make_mock_llm("这两个概念的边界在于：retrieval 负责召回候选文档……")
    result = generate_assistant_reply(
        llm, _make_diagnosis(), _make_plan(), _make_learner_state(),
        "我分不清 retrieval 和 reranking",
    )
    assert result == "这两个概念的边界在于：retrieval 负责召回候选文档……"


def test_generate_reply_strips_whitespace() -> None:
    llm = _make_mock_llm("  回复内容  \n")
    result = generate_assistant_reply(
        llm, _make_diagnosis(), _make_plan(), _make_learner_state(), "问题",
    )
    assert result == "回复内容"


def test_generate_reply_returns_none_on_empty_content() -> None:
    llm = _make_mock_llm("   ")
    result = generate_assistant_reply(
        llm, _make_diagnosis(), _make_plan(), _make_learner_state(), "问题",
    )
    assert result is None


def test_generate_reply_returns_none_on_exception() -> None:
    llm = _make_mock_llm("")
    llm.client.chat.completions.create.side_effect = RuntimeError("API error")
    result = generate_assistant_reply(
        llm, _make_diagnosis(), _make_plan(), _make_learner_state(), "问题",
    )
    assert result is None


def test_generate_reply_includes_tool_result_context() -> None:
    from xidea_agent.state import ToolResult
    tool_result = ToolResult(kind="asset-summary", payload={"assets": []})

    llm = _make_mock_llm("根据材料内容……")
    generate_assistant_reply(
        llm, _make_diagnosis(), _make_plan(), _make_learner_state(),
        "问题", tool_result=tool_result,
    )
    call_args = llm.client.chat.completions.create.call_args
    user_msg = call_args.kwargs["messages"][1]["content"]
    assert "asset-summary" in user_msg


# --- enrich_plan_steps ---


def test_enrich_plan_steps_replaces_reason_and_outcome() -> None:
    enrichments = json.dumps([
        {"id": "contrast-boundary", "reason": "LLM新reason", "outcome": "LLM新outcome"},
    ])
    llm = _make_mock_llm(enrichments)
    steps = _make_plan().steps

    result = enrich_plan_steps(llm, steps, _make_diagnosis(), "用户问题", "RAG")
    assert result is not None
    assert result[0].reason == "LLM新reason"
    assert result[0].outcome == "LLM新outcome"
    assert result[0].id == "contrast-boundary"
    assert result[0].mode == "contrast-drill"


def test_enrich_plan_steps_handles_code_fence_wrapping() -> None:
    enrichments = json.dumps([
        {"id": "contrast-boundary", "reason": "LLM reason", "outcome": "LLM outcome"},
    ])
    wrapped = f"```json\n{enrichments}\n```"
    llm = _make_mock_llm(wrapped)
    steps = _make_plan().steps

    result = enrich_plan_steps(llm, steps, _make_diagnosis(), "问题", "RAG")
    assert result is not None
    assert result[0].reason == "LLM reason"


def test_enrich_plan_steps_preserves_original_on_empty_fields() -> None:
    enrichments = json.dumps([
        {"id": "contrast-boundary", "reason": "", "outcome": ""},
    ])
    llm = _make_mock_llm(enrichments)
    steps = _make_plan().steps
    original_reason = steps[0].reason
    original_outcome = steps[0].outcome

    result = enrich_plan_steps(llm, steps, _make_diagnosis(), "问题", "RAG")
    assert result is not None
    assert result[0].reason == original_reason
    assert result[0].outcome == original_outcome


def test_enrich_plan_steps_returns_none_on_count_mismatch() -> None:
    enrichments = json.dumps([
        {"id": "a", "reason": "r1", "outcome": "o1"},
        {"id": "b", "reason": "r2", "outcome": "o2"},
    ])
    llm = _make_mock_llm(enrichments)
    steps = _make_plan().steps  # only 1 step

    result = enrich_plan_steps(llm, steps, _make_diagnosis(), "问题", "RAG")
    assert result is None


def test_enrich_plan_steps_returns_none_on_exception() -> None:
    llm = _make_mock_llm("")
    llm.client.chat.completions.create.side_effect = RuntimeError("timeout")
    steps = _make_plan().steps

    result = enrich_plan_steps(llm, steps, _make_diagnosis(), "问题", "RAG")
    assert result is None


def test_enrich_plan_steps_returns_none_on_invalid_json() -> None:
    llm = _make_mock_llm("not valid json at all")
    steps = _make_plan().steps

    result = enrich_plan_steps(llm, steps, _make_diagnosis(), "问题", "RAG")
    assert result is None


def test_enrich_plan_steps_handles_multiple_steps() -> None:
    steps = [
        StudyPlanStep(id="s1", title="Step 1", mode="guided-qa", reason="r1", outcome="o1"),
        StudyPlanStep(id="s2", title="Step 2", mode="scenario-sim", reason="r2", outcome="o2"),
    ]
    enrichments = json.dumps([
        {"id": "s1", "reason": "new-r1", "outcome": "new-o1"},
        {"id": "s2", "reason": "new-r2", "outcome": "new-o2"},
    ])
    llm = _make_mock_llm(enrichments)

    result = enrich_plan_steps(llm, steps, _make_diagnosis(), "问题", "RAG")
    assert result is not None
    assert len(result) == 2
    assert result[0].reason == "new-r1"
    assert result[1].outcome == "new-o2"


# --- build_llm_client ---


def test_build_llm_client_raises_without_api_key() -> None:
    with patch.dict("os.environ", {}, clear=True):
        with pytest.raises(RuntimeError, match="OPENAI_API_KEY is required"):
            build_llm_client()


def test_build_llm_client_raises_with_empty_api_key() -> None:
    with patch.dict("os.environ", {"OPENAI_API_KEY": "  "}, clear=True):
        with pytest.raises(RuntimeError, match="OPENAI_API_KEY is required"):
            build_llm_client()


# --- runtime integration: compose_response_step with LLM ---


def test_compose_response_step_uses_llm_when_available() -> None:
    from xidea_agent.runtime import run_agent_v0
    from xidea_agent.state import AgentRequest

    signals_response = json.dumps([
        {"kind": "concept-confusion", "score": 0.85, "confidence": 0.88,
         "summary": "用户对 retrieval 和 reranking 概念边界混淆"},
    ])
    diagnosis_response = json.dumps({
        "recommended_action": "clarify",
        "reason": "用户明确表达分不清两个概念的职责边界",
        "confidence": 0.88,
        "primary_issue": "concept-confusion",
        "needs_tool": False,
    })
    plan_response = json.dumps({
        "headline": "围绕 retrieval vs reranking 的辨析路径",
        "summary": "先辨析边界再追问验证",
        "selected_mode": "contrast-drill",
        "expected_outcome": "能清晰说出两者的职责差异",
        "steps": [
            {"id": "contrast-boundary", "title": "对比辨析", "mode": "contrast-drill",
             "reason": "LLM-reason", "outcome": "LLM-outcome"},
            {"id": "guided-check", "title": "追问验证", "mode": "guided-qa",
             "reason": "LLM-reason-2", "outcome": "LLM-outcome-2"},
        ],
    })
    reply_content = "LLM生成的教学回复内容"
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _mock_openai_response(signals_response),
        _mock_openai_response(diagnosis_response),
        _mock_openai_response(plan_response),
        _mock_openai_response(reply_content),
    ]
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    request = AgentRequest(
        project_id="rag-demo",
        thread_id="thread-1",
        entry_mode="chat-question",
        topic="RAG retrieval design",
        target_unit_id="unit-rag-retrieval",
        messages=[{"role": "user", "content": "我分不清 retrieval 和 reranking 的职责"}],
    )
    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.assistant_message == reply_content
    assert result.graph_state.plan is not None
    assert result.graph_state.plan.steps[0].reason == "LLM-reason"
    assert result.graph_state.plan.headline == "围绕 retrieval vs reranking 的辨析路径"
    assert "LLM" in result.graph_state.rationale[-2]


def test_diagnose_step_raises_when_llm_diagnosis_fails() -> None:
    """When all LLM calls fail, diagnose_step raises RuntimeError instead of falling back."""
    from xidea_agent.runtime import run_agent_v0
    from xidea_agent.state import AgentRequest

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = RuntimeError("API down")
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    request = AgentRequest(
        project_id="rag-demo",
        thread_id="thread-1",
        entry_mode="chat-question",
        topic="RAG retrieval design",
        target_unit_id="unit-rag-retrieval",
        messages=[{"role": "user", "content": "我分不清 retrieval 和 reranking 的职责"}],
    )
    with pytest.raises(RuntimeError, match="LLM diagnosis returned None"):
        run_agent_v0(request, llm=llm)


# --- A Layer: LLM signal extraction tests ---


def test_llm_build_signals_extracts_confusion_signal() -> None:
    from xidea_agent.llm import llm_build_signals
    from xidea_agent.state import Message, Observation

    signals_json = json.dumps([
        {"kind": "concept-confusion", "score": 0.9, "confidence": 0.85,
         "summary": "用户对 retrieval 和 reranking 的职责边界混淆"},
        {"kind": "project-relevance", "score": 0.7, "confidence": 0.8,
         "summary": "问题与 RAG 项目直接相关"},
    ])
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(signals_json)
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    messages = [Message(role="user", content="我分不清 retrieval 和 reranking")]
    observations = [
        Observation(observation_id="msg-1", kind="user-message",
                    source="thread", summary="用户提问"),
    ]

    result = llm_build_signals(llm, messages, observations, "chat-question")

    assert result is not None
    assert len(result) == 2
    assert result[0].kind == "concept-confusion"
    assert result[0].score == 0.9
    assert result[0].confidence == 0.85


def test_llm_build_signals_filters_invalid_kinds() -> None:
    from xidea_agent.llm import llm_build_signals
    from xidea_agent.state import Message, Observation

    signals_json = json.dumps([
        {"kind": "concept-confusion", "score": 0.8, "confidence": 0.8,
         "summary": "有效信号"},
        {"kind": "totally-invalid-kind", "score": 0.5, "confidence": 0.5,
         "summary": "无效类型会被过滤"},
    ])
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(signals_json)
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    messages = [Message(role="user", content="测试")]
    observations = [
        Observation(observation_id="msg-1", kind="user-message",
                    source="thread", summary="测试"),
    ]

    result = llm_build_signals(llm, messages, observations, "chat-question")

    assert result is not None
    assert len(result) == 1
    assert result[0].kind == "concept-confusion"


def test_llm_build_signals_returns_none_on_failure() -> None:
    from xidea_agent.llm import llm_build_signals
    from xidea_agent.state import Message, Observation

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = RuntimeError("API error")
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    messages = [Message(role="user", content="测试")]
    observations = [
        Observation(observation_id="msg-1", kind="user-message",
                    source="thread", summary="测试"),
    ]

    result = llm_build_signals(llm, messages, observations, "chat-question")
    assert result is None


def test_llm_build_signals_returns_none_on_empty_signals() -> None:
    from xidea_agent.llm import llm_build_signals
    from xidea_agent.state import Message, Observation

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response("[]")
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    messages = [Message(role="user", content="测试")]
    observations = [
        Observation(observation_id="msg-1", kind="user-message",
                    source="thread", summary="测试"),
    ]

    result = llm_build_signals(llm, messages, observations, "chat-question")
    assert result is None


def test_llm_build_signals_includes_prior_state_in_context() -> None:
    from xidea_agent.llm import llm_build_signals
    from xidea_agent.state import Message, Observation

    signals_json = json.dumps([
        {"kind": "memory-weakness", "score": 0.75, "confidence": 0.8,
         "summary": "记忆强度偏低"},
    ])
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(signals_json)
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    messages = [Message(role="user", content="上次学的好像忘了")]
    observations = [
        Observation(observation_id="msg-1", kind="user-message",
                    source="thread", summary="用户表达遗忘"),
    ]
    prior = _make_learner_state(memory_strength=35, recommended_action="review")

    result = llm_build_signals(llm, messages, observations, "chat-question", prior_state=prior)

    assert result is not None
    call_args = mock_client.chat.completions.create.call_args
    user_prompt = call_args[1]["messages"][1]["content"]
    assert "上轮推荐动作" in user_prompt
    assert "review" in user_prompt


# --- A Layer: LLM diagnosis tests ---


def test_llm_diagnose_returns_valid_diagnosis() -> None:
    from xidea_agent.llm import llm_diagnose

    diagnosis_json = json.dumps({
        "recommended_action": "clarify",
        "reason": "用户对两个概念的职责边界存在混淆",
        "confidence": 0.88,
        "primary_issue": "concept-confusion",
        "needs_tool": False,
    })
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(diagnosis_json)
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    from xidea_agent.state import Signal

    learner_state = _make_learner_state()
    signals = [
        Signal(kind="concept-confusion", score=0.85, confidence=0.88,
               summary="概念混淆", based_on=["msg-1"]),
    ]

    result = llm_diagnose(
        llm, learner_state, signals, "chat-question",
        target_unit_id="unit-rag-retrieval",
    )

    assert result is not None
    assert result.recommended_action == "clarify"
    assert result.primary_issue == "concept-confusion"
    assert result.confidence == 0.88
    assert result.explanation is not None
    assert "source=LLM" in result.explanation.evidence


def test_llm_diagnose_returns_none_on_invalid_action() -> None:
    from xidea_agent.llm import llm_diagnose

    diagnosis_json = json.dumps({
        "recommended_action": "invalid-action",
        "reason": "test",
        "confidence": 0.5,
        "primary_issue": "concept-confusion",
        "needs_tool": False,
    })
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(diagnosis_json)
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    from xidea_agent.state import Signal

    learner_state = _make_learner_state()
    signals = [Signal(kind="concept-confusion", score=0.8, confidence=0.8,
                      summary="test", based_on=[])]

    result = llm_diagnose(
        llm, learner_state, signals, "chat-question",
        target_unit_id="unit-1",
    )
    assert result is None


def test_llm_diagnose_returns_none_on_api_failure() -> None:
    from xidea_agent.llm import llm_diagnose

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = RuntimeError("API error")
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    from xidea_agent.state import Signal

    learner_state = _make_learner_state()
    signals = [Signal(kind="concept-confusion", score=0.8, confidence=0.8,
                      summary="test", based_on=[])]

    result = llm_diagnose(
        llm, learner_state, signals, "chat-question",
        target_unit_id="unit-1",
    )
    assert result is None


def test_llm_diagnose_infers_primary_issue_from_action() -> None:
    from xidea_agent.llm import llm_diagnose

    diagnosis_json = json.dumps({
        "recommended_action": "teach",
        "reason": "用户理解框架不稳",
        "confidence": 0.75,
        "primary_issue": "not-a-valid-issue",
        "needs_tool": False,
    })
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(diagnosis_json)
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    from xidea_agent.state import Signal

    learner_state = _make_learner_state(understanding_level=35)
    signals = [Signal(kind="concept-gap", score=0.8, confidence=0.8,
                      summary="理解不足", based_on=[])]

    result = llm_diagnose(
        llm, learner_state, signals, "chat-question",
        target_unit_id="unit-1",
    )

    assert result is not None
    assert result.recommended_action == "teach"
    assert result.primary_issue == "insufficient-understanding"


def test_llm_diagnose_forces_needs_tool_for_material_import() -> None:
    from xidea_agent.llm import llm_diagnose

    diagnosis_json = json.dumps({
        "recommended_action": "teach",
        "reason": "需要教学",
        "confidence": 0.7,
        "primary_issue": "insufficient-understanding",
        "needs_tool": False,
    })
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(diagnosis_json)
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    from xidea_agent.state import Signal

    learner_state = _make_learner_state()
    signals = [Signal(kind="project-relevance", score=0.8, confidence=0.8,
                      summary="材料导入", based_on=[])]

    result = llm_diagnose(
        llm, learner_state, signals, "material-import",
        target_unit_id="unit-1",
    )

    assert result is not None
    assert result.needs_tool is True


# --- A Layer: Guardrail validation of LLM diagnosis ---


def test_guardrail_rejects_llm_review_when_understanding_low() -> None:
    from xidea_agent.guardrails import validate_diagnosis

    diag = _make_diagnosis(recommended_action="review", primary_issue="weak-recall")
    state = _make_learner_state(understanding_level=30)

    violations = validate_diagnosis(diag, state)
    assert len(violations) >= 1
    assert any(v.rule_id == "G2" for v in violations)


def test_guardrail_rejects_llm_practice_when_confusion_high() -> None:
    from xidea_agent.guardrails import validate_diagnosis

    diag = _make_diagnosis(recommended_action="practice", primary_issue="poor-transfer")
    state = _make_learner_state(confusion_level=80)

    violations = validate_diagnosis(diag, state)
    assert len(violations) >= 1
    assert any(v.rule_id == "G3" for v in violations)


def test_guardrail_passes_valid_llm_diagnosis() -> None:
    from xidea_agent.guardrails import validate_diagnosis

    diag = _make_diagnosis(recommended_action="clarify", primary_issue="concept-confusion")
    state = _make_learner_state(confusion_level=75, understanding_level=50)

    violations = validate_diagnosis(diag, state)
    assert len(violations) == 0


# --- A Layer: diagnose_step with LLM integration ---


def test_diagnose_step_uses_llm_signals_and_diagnosis() -> None:
    from xidea_agent.runtime import run_agent_v0
    from xidea_agent.state import AgentRequest

    signals_json = json.dumps([
        {"kind": "concept-gap", "score": 0.82, "confidence": 0.85,
         "summary": "用户不理解 RAG 的上下文构造"},
    ])
    diagnosis_json = json.dumps({
        "recommended_action": "teach",
        "reason": "用户对 RAG 上下文构造缺乏基本理解",
        "confidence": 0.85,
        "primary_issue": "insufficient-understanding",
        "needs_tool": False,
    })
    reply_content = "LLM教学回复"
    plan_response = json.dumps({
        "headline": "围绕 RAG 上下文构造的教学路径",
        "summary": "先建模再验证",
        "selected_mode": "guided-qa",
        "expected_outcome": "能解释 RAG 上下文构造的核心逻辑",
        "steps": [
            {"id": "guided-model", "title": "导师问答", "mode": "guided-qa",
             "reason": "LLM-r1", "outcome": "LLM-o1"},
            {"id": "scenario-check", "title": "情境验证", "mode": "scenario-sim",
             "reason": "LLM-r2", "outcome": "LLM-o2"},
        ],
    })
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _mock_openai_response(signals_json),
        _mock_openai_response(diagnosis_json),
        _mock_openai_response(plan_response),
        _mock_openai_response(reply_content),
    ]
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    request = AgentRequest(
        project_id="rag-demo",
        thread_id="thread-1",
        entry_mode="chat-question",
        topic="RAG context construction",
        target_unit_id="unit-rag-core",
        messages=[{"role": "user", "content": "RAG 的上下文构造到底是怎么回事"}],
    )
    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.diagnosis.recommended_action == "teach"
    diagnose_rationale = [r for r in result.graph_state.rationale if "diagnose selected" in r]
    assert len(diagnose_rationale) == 1
    assert "signals=LLM" in diagnose_rationale[0]
    assert "diagnosis=LLM" in diagnose_rationale[0]


def test_diagnose_step_uses_rule_signals_when_llm_signals_fail() -> None:
    """When LLM signal extraction fails, rule-based signals are used but LLM diagnosis still runs."""
    from xidea_agent.runtime import run_agent_v0
    from xidea_agent.state import AgentRequest

    diagnosis_json = json.dumps({
        "recommended_action": "clarify",
        "reason": "混淆",
        "confidence": 0.8,
        "primary_issue": "concept-confusion",
        "needs_tool": False,
    })
    plan_json = json.dumps({
        "headline": "辨析路径",
        "summary": "先辨析",
        "selected_mode": "contrast-drill",
        "expected_outcome": "能区分",
        "steps": [
            {"id": "s1", "title": "对比", "mode": "contrast-drill",
             "reason": "r", "outcome": "o"},
        ],
    })
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        RuntimeError("signal extraction failed"),
        _mock_openai_response(diagnosis_json),
        _mock_openai_response(plan_json),
        _mock_openai_response("回复内容"),
    ]
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    request = AgentRequest(
        project_id="rag-demo",
        thread_id="thread-1",
        entry_mode="chat-question",
        topic="RAG retrieval design",
        target_unit_id="unit-rag-retrieval",
        messages=[{"role": "user", "content": "我分不清 retrieval 和 reranking 的职责"}],
    )
    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.diagnosis is not None
    diagnose_rationale = [r for r in result.graph_state.rationale if "diagnose selected" in r]
    assert len(diagnose_rationale) == 1
    assert "signals=rules" in diagnose_rationale[0]
    assert "diagnosis=LLM" in diagnose_rationale[0]


def test_diagnose_step_guardrail_corrects_bad_llm_diagnosis() -> None:
    """When LLM diagnosis violates guardrails, it gets corrected (not fallen back to rules)."""
    from xidea_agent.runtime import run_agent_v0
    from xidea_agent.state import AgentRequest

    signals_json = json.dumps([
        {"kind": "concept-gap", "score": 0.9, "confidence": 0.95,
         "summary": "用户完全不理解核心概念"},
        {"kind": "concept-confusion", "score": 0.8, "confidence": 0.9,
         "summary": "多个概念混淆"},
    ])
    bad_diagnosis_json = json.dumps({
        "recommended_action": "review",
        "reason": "应该复习",
        "confidence": 0.7,
        "primary_issue": "weak-recall",
        "needs_tool": False,
    })
    plan_json = json.dumps({
        "headline": "教学路径",
        "summary": "先教学",
        "selected_mode": "guided-qa",
        "expected_outcome": "理解概念",
        "steps": [
            {"id": "s1", "title": "导师问答", "mode": "guided-qa",
             "reason": "r", "outcome": "o"},
        ],
    })
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _mock_openai_response(signals_json),
        _mock_openai_response(bad_diagnosis_json),
        _mock_openai_response(plan_json),
        _mock_openai_response("教学回复"),
    ]
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    request = AgentRequest(
        project_id="rag-demo",
        thread_id="thread-1",
        entry_mode="chat-question",
        topic="RAG",
        target_unit_id="unit-rag-core",
        messages=[{"role": "user", "content": "什么是 RAG"}],
    )
    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.diagnosis is not None
    assert result.graph_state.diagnosis.recommended_action != "review"
    guardrail_rationale = [r for r in result.graph_state.rationale if "guardrail" in r.lower()]
    assert len(guardrail_rationale) >= 1
    diagnose_rationale = [r for r in result.graph_state.rationale if "diagnose selected" in r]
    assert len(diagnose_rationale) == 1
    assert "diagnosis=LLM" in diagnose_rationale[0]


# --- B Layer: LLM plan generation tests ---


def test_llm_build_plan_returns_valid_plan() -> None:
    from xidea_agent.llm import llm_build_plan

    plan_json = json.dumps({
        "headline": "围绕 RAG 检索设计的辨析路径",
        "summary": "先对比再追问",
        "selected_mode": "contrast-drill",
        "expected_outcome": "用户能区分 retrieval 和 reranking",
        "steps": [
            {"id": "compare", "title": "概念对比", "mode": "contrast-drill",
             "reason": "两个概念边界不清", "outcome": "能说清各自解决什么问题"},
            {"id": "verify", "title": "追问验证", "mode": "guided-qa",
             "reason": "确认理解真正稳定", "outcome": "能独立判断何时用哪个"},
        ],
    })
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(plan_json)
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    diagnosis = _make_diagnosis()
    learner_state = _make_learner_state()

    result = llm_build_plan(
        llm, "RAG", "召回 vs 重排",
        ["contrast-drill", "guided-qa", "scenario-sim"],
        diagnosis, learner_state, "我分不清这两个概念",
    )

    assert result is not None
    assert result.headline == "围绕 RAG 检索设计的辨析路径"
    assert len(result.steps) == 2
    assert result.steps[0].mode == "contrast-drill"
    assert result.selected_mode == "contrast-drill"


def test_llm_build_plan_filters_invalid_modes() -> None:
    from xidea_agent.llm import llm_build_plan

    plan_json = json.dumps({
        "headline": "test",
        "summary": "test",
        "selected_mode": "guided-qa",
        "expected_outcome": "test",
        "steps": [
            {"id": "s1", "title": "有效步骤", "mode": "guided-qa",
             "reason": "r", "outcome": "o"},
            {"id": "s2", "title": "无效模式", "mode": "invalid-mode",
             "reason": "r", "outcome": "o"},
        ],
    })
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(plan_json)
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    result = llm_build_plan(
        llm, "test", "test", [],
        _make_diagnosis(), _make_learner_state(), "test",
    )

    assert result is not None
    assert len(result.steps) == 1
    assert result.steps[0].mode == "guided-qa"


def test_llm_build_plan_respects_candidate_modes() -> None:
    from xidea_agent.llm import llm_build_plan

    plan_json = json.dumps({
        "headline": "test",
        "summary": "test",
        "selected_mode": "scenario-sim",
        "expected_outcome": "test",
        "steps": [
            {"id": "s1", "title": "情境模拟", "mode": "scenario-sim",
             "reason": "r", "outcome": "o"},
            {"id": "s2", "title": "苏格拉底", "mode": "socratic",
             "reason": "r", "outcome": "o"},
        ],
    })
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(plan_json)
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    result = llm_build_plan(
        llm, "test", "test", ["scenario-sim", "guided-qa"],
        _make_diagnosis(), _make_learner_state(), "test",
    )

    assert result is not None
    assert len(result.steps) == 1
    assert result.steps[0].mode == "scenario-sim"


def test_llm_build_plan_returns_none_on_failure() -> None:
    from xidea_agent.llm import llm_build_plan

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = RuntimeError("API error")
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    result = llm_build_plan(
        llm, "test", "test", [],
        _make_diagnosis(), _make_learner_state(), "test",
    )
    assert result is None


def test_llm_build_plan_returns_none_on_empty_steps() -> None:
    from xidea_agent.llm import llm_build_plan

    plan_json = json.dumps({
        "headline": "test",
        "summary": "test",
        "selected_mode": "guided-qa",
        "expected_outcome": "test",
        "steps": [],
    })
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(plan_json)
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    result = llm_build_plan(
        llm, "test", "test", [],
        _make_diagnosis(), _make_learner_state(), "test",
    )
    assert result is None


def test_llm_build_plan_returns_none_on_missing_fields() -> None:
    from xidea_agent.llm import llm_build_plan

    plan_json = json.dumps({
        "headline": "",
        "summary": "test",
        "selected_mode": "guided-qa",
        "expected_outcome": "test",
        "steps": [
            {"id": "s1", "title": "t", "mode": "guided-qa",
             "reason": "r", "outcome": "o"},
        ],
    })
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(plan_json)
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    result = llm_build_plan(
        llm, "test", "test", [],
        _make_diagnosis(), _make_learner_state(), "test",
    )
    assert result is None


def test_compose_response_uses_llm_plan_and_reply() -> None:
    from xidea_agent.runtime import run_agent_v0
    from xidea_agent.state import AgentRequest

    signals_json = json.dumps([
        {"kind": "concept-confusion", "score": 0.85, "confidence": 0.88,
         "summary": "混淆"},
    ])
    diagnosis_json = json.dumps({
        "recommended_action": "clarify",
        "reason": "概念混淆",
        "confidence": 0.88,
        "primary_issue": "concept-confusion",
        "needs_tool": False,
    })
    plan_json = json.dumps({
        "headline": "LLM 生成的学习路径",
        "summary": "针对性辨析",
        "selected_mode": "contrast-drill",
        "expected_outcome": "区分清楚",
        "steps": [
            {"id": "s1", "title": "对比训练", "mode": "contrast-drill",
             "reason": "针对用户的具体混淆点", "outcome": "能说清边界"},
        ],
    })
    reply_content = "LLM 回复"
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _mock_openai_response(signals_json),
        _mock_openai_response(diagnosis_json),
        _mock_openai_response(plan_json),
        _mock_openai_response(reply_content),
    ]
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    request = AgentRequest(
        project_id="rag-demo",
        thread_id="thread-1",
        entry_mode="chat-question",
        topic="RAG",
        target_unit_id="unit-rag-retrieval",
        messages=[{"role": "user", "content": "分不清"}],
    )
    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.plan is not None
    assert result.graph_state.plan.headline == "LLM 生成的学习路径"
    assert result.graph_state.assistant_message == reply_content
    compose_rationale = [r for r in result.graph_state.rationale if "compose_response" in r]
    assert len(compose_rationale) == 1
    assert "plan=LLM" in compose_rationale[0]
    assert "reply=LLM" in compose_rationale[0]


def test_compose_response_falls_back_plan_to_template_when_llm_plan_fails() -> None:
    from xidea_agent.runtime import run_agent_v0
    from xidea_agent.state import AgentRequest

    signals_json = json.dumps([
        {"kind": "concept-confusion", "score": 0.85, "confidence": 0.88,
         "summary": "混淆"},
    ])
    diagnosis_json = json.dumps({
        "recommended_action": "clarify",
        "reason": "概念混淆",
        "confidence": 0.88,
        "primary_issue": "concept-confusion",
        "needs_tool": False,
    })
    reply_content = "LLM 回复"
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _mock_openai_response(signals_json),
        _mock_openai_response(diagnosis_json),
        RuntimeError("plan generation failed"),
        _mock_openai_response(reply_content),
    ]
    llm = LLMClient(client=mock_client, model="gpt-4o-mini")

    request = AgentRequest(
        project_id="rag-demo",
        thread_id="thread-1",
        entry_mode="chat-question",
        topic="RAG",
        target_unit_id="unit-rag-retrieval",
        messages=[{"role": "user", "content": "分不清"}],
    )
    result = run_agent_v0(request, llm=llm)

    assert result.graph_state.plan is not None
    assert result.graph_state.assistant_message == reply_content
    compose_rationale = [r for r in result.graph_state.rationale if "compose_response" in r]
    assert len(compose_rationale) == 1
    assert "plan=template" in compose_rationale[0]
    assert "reply=LLM" in compose_rationale[0]
