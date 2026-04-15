"""LLM client initialization and structured prompt functions.

Supports two wire API modes via XIDEA_LLM_WIRE_API:
- completions: Standard /chat/completions endpoint (default, widest compatibility — GLM, DeepSeek, etc.)
- responses:   OpenAI Responses API (/responses endpoint, supports built-in tool use)
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from xidea_agent.state import (
    Diagnosis,
    Explanation,
    LearnerUnitState,
    LearningMode,
    LearningUnit,
    Message,
    Observation,
    PedagogicalAction,
    PrimaryIssue,
    Signal,
    SignalKind,
    StudyPlan,
    StudyPlanStep,
    ToolResult,
)

logger = logging.getLogger(__name__)

WireAPI = Literal["completions", "responses"]

_llm_instance: ChatOpenAI | None = None
_openai_client: Any = None
_env_loaded = False


def _ensure_env() -> None:
    global _env_loaded
    if _env_loaded:
        return
    agent_root = Path(__file__).resolve().parent.parent.parent
    load_dotenv(agent_root / ".env", override=False)
    load_dotenv(override=False)
    _env_loaded = True


def _get_wire_api() -> WireAPI:
    mode = os.getenv("XIDEA_LLM_WIRE_API", "completions").lower()
    if mode in ("completions", "responses"):
        return mode  # type: ignore[return-value]
    logger.warning("Unknown XIDEA_LLM_WIRE_API=%s, defaulting to completions", mode)
    return "completions"


def get_llm() -> ChatOpenAI | None:
    """Return a configured ChatOpenAI instance (completions mode), or None if not configured."""
    global _llm_instance
    if _llm_instance is not None:
        return _llm_instance

    _ensure_env()

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "sk-xxx":
        return None

    _llm_instance = ChatOpenAI(
        model=os.getenv("XIDEA_LLM_MODEL", "gpt-4o"),
        api_key=api_key,
        base_url=os.getenv("OPENAI_API_BASE"),
        temperature=float(os.getenv("XIDEA_LLM_TEMPERATURE", "0.7")),
        max_tokens=int(os.getenv("XIDEA_LLM_MAX_TOKENS", "2048")),
        streaming=True,
    )
    return _llm_instance


def _get_openai_client():
    """Return a raw OpenAI client for responses mode."""
    global _openai_client
    if _openai_client is not None:
        return _openai_client

    _ensure_env()
    from openai import OpenAI

    _openai_client = OpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        base_url=os.getenv("OPENAI_API_BASE"),
    )
    return _openai_client


def is_llm_configured() -> bool:
    """Check whether LLM is configured (API key present)."""
    _ensure_env()
    api_key = os.getenv("OPENAI_API_KEY")
    return bool(api_key and api_key != "sk-xxx")


def reset_llm() -> None:
    """Reset cached instances (useful for testing)."""
    global _llm_instance, _openai_client, _env_loaded
    _llm_instance = None
    _openai_client = None
    _env_loaded = False


# ---------------------------------------------------------------------------
# Structured output models for LLM responses
# ---------------------------------------------------------------------------

class LLMSignalOutput(BaseModel):
    """A single diagnostic signal extracted by LLM."""
    kind: SignalKind
    score: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    summary: str


class LLMDiagnosisOutput(BaseModel):
    """Combined LLM output: learner state estimation + diagnosis."""
    understanding_level: int = Field(ge=0, le=100)
    confusion_level: int = Field(ge=0, le=100)
    memory_strength: int = Field(ge=0, le=100)
    transfer_readiness: int = Field(ge=0, le=100)
    mastery: int = Field(ge=0, le=100)
    weak_signals: list[str]
    signals: list[LLMSignalOutput]
    recommended_action: PedagogicalAction
    primary_issue: PrimaryIssue
    reason: str = Field(description="用中文解释为什么选择这个动作，2-3句话")
    confidence: float = Field(ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

DIAGNOSIS_SYSTEM_PROMPT = """你是 Xidea 学习编排系统的诊断引擎。你的任务是分析学习者的对话历史和上下文，判断学习者当前的认知状态，并推荐最合适的下一步学习动作。

## 你需要评估的维度（0-100）

- **understanding_level**: 理解水平。学习者对当前主题核心概念的理解深度
- **confusion_level**: 混淆程度。学习者是否在混淆相近概念的边界
- **memory_strength**: 记忆强度。学习者对已学内容的记忆稳定性
- **transfer_readiness**: 迁移准备度。学习者能否把知识应用到实际项目场景
- **mastery**: 综合掌握度。以上各维度的加权综合

## 可选的学习动作（recommended_action）

- **clarify**: 澄清 — 学习者在混淆概念边界，需要先拉清楚区别
- **teach**: 教学 — 学习者还没有稳定的理解框架，需要补建模
- **review**: 复习 — 学习者有遗忘风险，需要巩固记忆
- **apply**: 应用 — 学习者理解基础已具备，需要在项目场景中验证
- **practice**: 练习 — 学习者适合通过练习强化应用能力

## 核心问题类型（primary_issue）

- **concept-confusion**: 概念混淆
- **insufficient-understanding**: 理解不足
- **weak-recall**: 记忆薄弱
- **poor-transfer**: 迁移能力不足
- **missing-context**: 缺少上下文

## 信号类型（signals.kind）

- **concept-gap**: 概念缺口
- **concept-confusion**: 概念混淆
- **memory-weakness**: 记忆薄弱
- **transfer-readiness**: 迁移准备
- **review-pressure**: 复习压力
- **project-relevance**: 项目相关性

## 输出要求

请返回严格符合 JSON schema 的结构化数据：
1. 从对话中提取诊断信号（signals），每个信号需要有类型、评分、置信度和摘要
2. 评估学习者在各维度的数值（0-100）
3. 推荐一个学习动作，并用中文解释理由
4. reason 字段用 2-3 句中文解释，聚焦"为什么选这个动作"而不是泛泛描述"""


COMPOSE_SYSTEM_PROMPT = """你是 Xidea 学习编排系统的教学引擎。你的任务是基于系统的诊断结果和学习计划，生成高质量的个性化教学回复。

## 角色定位

你是一个 AI 学习教练，不是搜索引擎。你的回复应该：
1. **有针对性** — 直接回应学习者的问题和困惑
2. **有教学策略** — 根据诊断结果选择合适的教学方式（追问、对比、举例、类比等）
3. **有项目关联** — 尽量把知识点和学习者的真实项目场景联系起来
4. **有推进感** — 每次回复都要让学习进度往前走，不能原地打转

## 回复风格

- 用中文回复
- 语气自然、有教学感，不要像 AI 客服
- 适当使用标记（加粗、列表）让关键点突出
- 如果是追问模式，用 1-2 个有挑战性的问题结尾
- 如果是教学模式，先给核心解释，再追问验证理解
- 如果是对比模式，明确列出两个概念的边界差异
- 长度适中，300-600字为宜"""


def _format_messages_for_prompt(messages: list[Message]) -> str:
    lines = []
    for msg in messages:
        role_label = {"user": "学习者", "assistant": "系统", "system": "系统"}.get(msg.role, msg.role)
        lines.append(f"[{role_label}] {msg.content}")
    return "\n".join(lines)


def _format_observations(observations: list[Observation]) -> str:
    if not observations:
        return "无额外观测数据"
    lines = []
    for obs in observations:
        lines.append(f"- [{obs.kind}] {obs.summary}")
    return "\n".join(lines)


def _format_prior_state(prior_state: LearnerUnitState | None) -> str:
    if prior_state is None:
        return "无历史状态（首次交互）"
    return (
        f"理解水平={prior_state.understanding_level}, "
        f"混淆度={prior_state.confusion_level}, "
        f"记忆强度={prior_state.memory_strength}, "
        f"迁移准备度={prior_state.transfer_readiness}, "
        f"综合掌握度={prior_state.mastery}, "
        f"弱点信号={prior_state.weak_signals}, "
        f"上次推荐动作={prior_state.recommended_action}"
    )


def _format_learning_unit(unit: LearningUnit | None) -> str:
    if unit is None:
        return "未指定学习单元"
    return (
        f"标题: {unit.title}\n"
        f"摘要: {unit.summary}\n"
        f"弱点标签: {unit.weakness_tags}\n"
        f"候选模式: {unit.candidate_modes}\n"
        f"难度: {unit.difficulty}/5"
    )


def build_diagnosis_prompt(
    messages: list[Message],
    observations: list[Observation],
    entry_mode: str,
    learning_unit: LearningUnit | None,
    prior_state: LearnerUnitState | None,
) -> str:
    return f"""## 当前交互上下文

**入口模式**: {entry_mode}

### 对话历史
{_format_messages_for_prompt(messages)}

### 观测数据
{_format_observations(observations)}

### 学习单元
{_format_learning_unit(learning_unit)}

### 历史学习状态
{_format_prior_state(prior_state)}

请基于以上信息，输出结构化的诊断结果。"""


def build_compose_prompt(
    diagnosis: Diagnosis,
    plan: StudyPlan,
    tool_result: ToolResult | None,
    messages: list[Message],
    learning_unit: LearningUnit | None,
) -> str:
    tool_context = ""
    if tool_result is not None:
        tool_context = f"\n### 补充上下文（{tool_result.kind}）\n{_format_tool_payload(tool_result.payload)}\n"

    return f"""## 诊断结果

- **推荐动作**: {diagnosis.recommended_action}
- **原因**: {diagnosis.reason}
- **核心问题**: {diagnosis.primary_issue}
- **置信度**: {diagnosis.confidence}

## 学习计划

- **计划标题**: {plan.headline}
- **摘要**: {plan.summary}
- **当前模式**: {plan.selected_mode}
- **预期成果**: {plan.expected_outcome}

### 计划步骤
{_format_plan_steps(plan.steps)}
{tool_context}
### 学习单元
{_format_learning_unit(learning_unit)}

### 对话历史
{_format_messages_for_prompt(messages)}

请基于以上诊断和计划，生成面向学习者的教学回复。直接输出回复内容，不要加"回复："等前缀。"""


def _format_plan_steps(steps: list[StudyPlanStep]) -> str:
    lines = []
    for i, step in enumerate(steps, 1):
        lines.append(f"{i}. **{step.title}**（{step.mode}）— {step.reason}")
    return "\n".join(lines)


def _format_tool_payload(payload: dict[str, Any]) -> str:
    lines = []
    for key, value in payload.items():
        if isinstance(value, list):
            items = ", ".join(str(v) for v in value[:5])
            lines.append(f"- {key}: [{items}]")
        elif isinstance(value, dict):
            lines.append(f"- {key}: (详细数据)")
        else:
            lines.append(f"- {key}: {value}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Completions mode — uses LangChain ChatOpenAI
# ---------------------------------------------------------------------------

def _diagnose_via_completions(
    messages: list[Message],
    observations: list[Observation],
    entry_mode: str,
    learning_unit: LearningUnit | None,
    prior_state: LearnerUnitState | None,
) -> LLMDiagnosisOutput:
    llm = get_llm()
    if llm is None:
        raise RuntimeError("LLM not configured")

    prompt = build_diagnosis_prompt(messages, observations, entry_mode, learning_unit, prior_state)

    schema_hint = json.dumps(LLMDiagnosisOutput.model_json_schema(), ensure_ascii=False, indent=2)
    full_system = (
        DIAGNOSIS_SYSTEM_PROMPT
        + "\n\n## JSON Schema\n\n请严格按照以下 schema 返回 JSON（不要包含 markdown 代码块标记）：\n"
        + schema_hint
    )

    response = llm.invoke([
        SystemMessage(content=full_system),
        HumanMessage(content=prompt),
    ])

    raw = response.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        raw = raw.rsplit("```", 1)[0].strip()

    data = json.loads(raw)
    return LLMDiagnosisOutput(**data)


def _compose_via_completions(
    diagnosis: Diagnosis,
    plan: StudyPlan,
    tool_result: ToolResult | None,
    messages: list[Message],
    learning_unit: LearningUnit | None,
) -> str:
    llm = get_llm()
    if llm is None:
        raise RuntimeError("LLM not configured")

    prompt = build_compose_prompt(diagnosis, plan, tool_result, messages, learning_unit)
    response = llm.invoke([
        SystemMessage(content=COMPOSE_SYSTEM_PROMPT),
        HumanMessage(content=prompt),
    ])
    return response.content


# ---------------------------------------------------------------------------
# Responses mode — uses OpenAI SDK directly (/v1/responses)
# ---------------------------------------------------------------------------

def _diagnose_via_responses(
    messages: list[Message],
    observations: list[Observation],
    entry_mode: str,
    learning_unit: LearningUnit | None,
    prior_state: LearnerUnitState | None,
) -> LLMDiagnosisOutput:
    client = _get_openai_client()
    prompt = build_diagnosis_prompt(messages, observations, entry_mode, learning_unit, prior_state)

    response = client.responses.create(
        model=os.getenv("XIDEA_LLM_MODEL", "gpt-4o"),
        instructions=DIAGNOSIS_SYSTEM_PROMPT,
        input=prompt,
        text={
            "format": {
                "type": "json_schema",
                "name": "diagnosis_output",
                "schema": LLMDiagnosisOutput.model_json_schema(),
                "strict": True,
            }
        },
        temperature=float(os.getenv("XIDEA_LLM_TEMPERATURE", "0.7")),
    )

    raw_text = response.output_text
    data = json.loads(raw_text)
    return LLMDiagnosisOutput(**data)


def _compose_via_responses(
    diagnosis: Diagnosis,
    plan: StudyPlan,
    tool_result: ToolResult | None,
    messages: list[Message],
    learning_unit: LearningUnit | None,
) -> str:
    client = _get_openai_client()
    prompt = build_compose_prompt(diagnosis, plan, tool_result, messages, learning_unit)

    response = client.responses.create(
        model=os.getenv("XIDEA_LLM_MODEL", "gpt-4o"),
        instructions=COMPOSE_SYSTEM_PROMPT,
        input=prompt,
        temperature=float(os.getenv("XIDEA_LLM_TEMPERATURE", "0.7")),
    )

    return response.output_text


# ---------------------------------------------------------------------------
# Public API — dispatches to the configured wire mode
# ---------------------------------------------------------------------------

def diagnose_with_llm(
    messages: list[Message],
    observations: list[Observation],
    entry_mode: str,
    learning_unit: LearningUnit | None,
    prior_state: LearnerUnitState | None,
    target_unit_id: str | None,
) -> tuple[list[Signal], LearnerUnitState, Diagnosis]:
    """Use LLM to analyze learner state and produce structured diagnosis.

    Dispatches to completions or responses mode based on XIDEA_LLM_WIRE_API.
    Returns (signals, learner_unit_state, diagnosis) matching existing types.
    """
    if not is_llm_configured():
        raise RuntimeError(
            "LLM is not configured. Set OPENAI_API_KEY in .env to enable LLM diagnosis."
        )

    wire_api = _get_wire_api()
    logger.info("Running LLM diagnosis via %s mode", wire_api)

    if wire_api == "responses":
        result = _diagnose_via_responses(
            messages, observations, entry_mode, learning_unit, prior_state,
        )
    else:
        result = _diagnose_via_completions(
            messages, observations, entry_mode, learning_unit, prior_state,
        )

    return _map_diagnosis_output(result, observations, learning_unit, target_unit_id, entry_mode)


def compose_with_llm(
    diagnosis: Diagnosis,
    plan: StudyPlan,
    tool_result: ToolResult | None,
    messages: list[Message],
    learning_unit: LearningUnit | None,
) -> str:
    """Use LLM to generate a personalized teaching response.

    Dispatches to completions or responses mode based on XIDEA_LLM_WIRE_API.
    """
    if not is_llm_configured():
        raise RuntimeError(
            "LLM is not configured. Set OPENAI_API_KEY in .env to enable LLM response."
        )

    wire_api = _get_wire_api()
    logger.info("Composing response via %s mode", wire_api)

    if wire_api == "responses":
        return _compose_via_responses(diagnosis, plan, tool_result, messages, learning_unit)
    else:
        return _compose_via_completions(diagnosis, plan, tool_result, messages, learning_unit)


# ---------------------------------------------------------------------------
# Output mapping helpers
# ---------------------------------------------------------------------------

def _map_diagnosis_output(
    result: LLMDiagnosisOutput,
    observations: list[Observation],
    learning_unit: LearningUnit | None,
    target_unit_id: str | None,
    entry_mode: str = "chat-question",
) -> tuple[list[Signal], LearnerUnitState, Diagnosis]:
    signals = [
        Signal(
            kind=s.kind,
            score=s.score,
            confidence=s.confidence,
            summary=s.summary,
            based_on=[obs.observation_id for obs in observations[:2]],
        )
        for s in result.signals
    ]

    unit_id = target_unit_id or (learning_unit.id if learning_unit else "unknown")
    learner_state = LearnerUnitState(
        unit_id=unit_id,
        mastery=result.mastery,
        understanding_level=result.understanding_level,
        memory_strength=result.memory_strength,
        confusion_level=result.confusion_level,
        transfer_readiness=result.transfer_readiness,
        weak_signals=result.weak_signals,
        confidence=result.confidence,
        based_on=[s.summary for s in signals],
    )

    explanation = Explanation(
        summary=result.reason,
        evidence=[
            f"understanding={result.understanding_level}",
            f"memory={result.memory_strength}",
            f"confusion={result.confusion_level}",
            f"transfer={result.transfer_readiness}",
            f"recommended={result.recommended_action}",
        ],
        confidence=result.confidence,
    )

    needs_tool = entry_mode == "material-import"
    diagnosis = Diagnosis(
        recommended_action=result.recommended_action,
        reason=result.reason,
        confidence=result.confidence,
        focus_unit_id=unit_id,
        primary_issue=result.primary_issue,
        needs_tool=needs_tool,
        explanation=explanation,
    )

    return signals, learner_state, diagnosis
