"""LLM integration layer — the core decision-making brain of Xidea.

The LLM is the pedagogical agent; rules serve only as guardrails.

- LLM extracts learning signals from user messages (structured output).
- LLM makes diagnosis decisions (which pedagogical action to take).
- LLM generates study plans tailored to the learner's specific situation.
- LLM generates natural-language teaching replies.
- Guardrails enforce hard constraints on LLM outputs.
- A compatible LLM API key is required. The system will not start without it.
"""

from __future__ import annotations

import json
import logging
import os
import re
from ast import literal_eval
from collections.abc import Iterator
from dataclasses import dataclass

import httpx

from xidea_agent.state import (
    Diagnosis,
    Explanation,
    LearnerUnitState,
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

ZHIPU_OPENAI_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/"

VALID_SIGNAL_KINDS: set[str] = {
    "concept-gap",
    "concept-confusion",
    "memory-weakness",
    "transfer-readiness",
    "review-pressure",
    "project-relevance",
}

VALID_ACTIONS: set[str] = {"teach", "clarify", "practice", "review", "apply"}

VALID_PRIMARY_ISSUES: set[str] = {
    "insufficient-understanding",
    "concept-confusion",
    "weak-recall",
    "poor-transfer",
    "missing-context",
}

PROVIDER_SAFETY_REASON = (
    "这轮问题触发了模型提供方的内容安全限制，我不能直接返回内部 system prompt 或隐藏指令；"
    "如果你愿意，我可以改为概述这个 agent 的判断逻辑、输入字段和决策流程。"
)

SIGNAL_EXTRACTION_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的信号检测模块。

你的职责是分析学习者的消息，提取结构化的学习信号。每个信号描述学习者当前可能存在的一种学习问题或状态。

## 信号类型（只能使用以下值）

- concept-gap: 学习者缺少对某个概念的基本理解（如"什么意思""不懂""怎么理解"）
- concept-confusion: 学习者对相近概念存在混淆或边界不清（如"分不清""搞混了""区别是什么"）
- memory-weakness: 学习者表现出记忆不稳定或遗忘风险（如"忘了""记不住""需要复习"）
- transfer-readiness: 学习者想要在实际场景中应用知识（如"项目里怎么用""设计方案""答辩"）
- review-pressure: 存在复习调度压力
- project-relevance: 问题与真实项目上下文相关

## 输出格式

严格输出 JSON 数组，每个元素包含：
- kind: 信号类型（上述枚举之一）
- score: 信号强度 0.0-1.0
- confidence: 你对这个判断的确信度 0.0-1.0
- summary: 一句话中文说明为什么检测到这个信号

## 约束

- 不要输出上述类型之外的 kind
- 如果消息中没有明显信号，至少输出一个 project-relevance 信号
- score 和 confidence 要基于文本中信号的明确程度合理设置
- 如果用户在多轮消息中反复提到同一类问题，提高对应信号的 score 和 confidence
- 直接输出 JSON 数组，不要包含 markdown 代码块标记
"""

DIAGNOSIS_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的诊断决策模块。

你的职责是根据学习者当前状态和检测到的信号，决定本轮最合适的教学动作。

## 可选动作（recommended_action）

- teach: 学习者还没形成基本理解，需要先教学建模
- clarify: 学习者对概念边界混淆，需要先澄清区别
- practice: 基本理解已有但不够稳，需要练习巩固
- review: 学过但记忆在衰退，需要定向复习
- apply: 概念基础具备，需要在真实场景验证迁移

## 问题类型（primary_issue）

- insufficient-understanding: 理解不够
- concept-confusion: 概念混淆
- weak-recall: 记忆不稳
- poor-transfer: 迁移能力不足
- missing-context: 上下文不足

## 输出格式

严格输出一个 JSON 对象：
{
  "recommended_action": "teach|clarify|practice|review|apply",
  "reason": "一句中文说明为什么选择这个动作",
  "confidence": 0.0-1.0,
  "primary_issue": "问题类型枚举值",
  "needs_tool": true/false
}

## 决策约束

- 如果理解水平 < 60，优先 teach 或 clarify，不选 review
- 如果混淆度 > 70，优先 clarify
- 如果理解 >= 60 且记忆 < 65，可以选 review
- 如果上一轮选了某个动作但对应指标没改善，应该切换策略
- needs_tool: 当你认为信息不足以做稳定判断时设为 true
- reason 要具体到用户的表达，不要泛泛而谈
- 直接输出 JSON 对象，不要包含 markdown 代码块标记
"""

COMBINED_DIAGNOSIS_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的联合诊断模块。

你的职责是一次完成两件事：
1. 从学习者消息中提取结构化学习信号
2. 基于学习者状态和这些信号，给出本轮最合适的教学动作

## 信号类型（signals.kind 只能使用以下值）

- concept-gap
- concept-confusion
- memory-weakness
- transfer-readiness
- review-pressure
- project-relevance

## 可选动作（diagnosis.recommended_action）

- teach
- clarify
- practice
- review
- apply

## 问题类型（diagnosis.primary_issue）

- insufficient-understanding
- concept-confusion
- weak-recall
- poor-transfer
- missing-context

## 输出格式

严格输出一个 JSON 对象：
{
  "signals": [
    {
      "kind": "concept-gap|concept-confusion|memory-weakness|transfer-readiness|review-pressure|project-relevance",
      "score": 0.0,
      "confidence": 0.0,
      "summary": "一句中文说明"
    }
  ],
  "diagnosis": {
    "recommended_action": "teach|clarify|practice|review|apply",
    "reason": "一句中文说明为什么选择这个动作",
    "confidence": 0.0,
    "primary_issue": "问题类型枚举值",
    "needs_tool": true
  }
}

## 约束

- 如果消息中没有明显信号，至少输出一个 project-relevance 信号
- 如果理解水平 < 60，优先 teach 或 clarify，不选 review
- 如果混淆度 > 70，优先 clarify
- 如果理解 >= 60 且记忆 < 65，可以选 review
- 如果上一轮选了某个动作但对应指标没改善，应该切换策略
- needs_tool: 当你认为信息不足以做稳定判断时设为 true
- 直接输出 JSON 对象，不要包含 markdown 代码块标记
"""

PLAN_GENERATION_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的学习路径规划器。

你的职责是根据诊断结果、学习者状态和用户问题，生成一个针对性的学习计划。

## 可用训练模式

- socratic: 苏格拉底追问 — 通过连续提问引导思考
- guided-qa: 1v1 导师问答 — 直接讲解和追问
- contrast-drill: 对比辨析训练 — 比较相近概念的边界
- image-recall: 看图回忆
- audio-recall: 听音作答
- scenario-sim: 情境模拟 — 在真实项目场景中验证

## 输出格式

严格输出一个 JSON 对象：
{
  "headline": "当前轮学习安排的标题",
  "summary": "为什么这样安排的简短说明",
  "selected_mode": "主训练模式（上述枚举之一）",
  "expected_outcome": "本轮完成后希望达到的效果",
  "steps": [
    {
      "id": "步骤唯一标识（英文短横线格式）",
      "title": "步骤名称",
      "mode": "训练模式（上述枚举之一）",
      "reason": "为什么安排这一步（要具体到用户的问题）",
      "outcome": "完成后能检验什么（要可检视、可判断）"
    }
  ]
}

## 约束

- steps 数量限制在 1 到 3 步
- 如果提供了候选模式列表，steps 中的 mode 必须从候选列表中选
- selected_mode 取第一步的 mode
- reason 和 outcome 必须针对用户的具体问题，不要泛泛而谈
- headline 和 summary 要简洁
- 直接输出 JSON 对象，不要包含 markdown 代码块标记
"""

REPLY_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的教学助手。

你的职责是根据系统的诊断结果和学习计划，为学习者生成自然、有针对性的教学回复。

约束：
- 你不能改变系统的诊断结论（recommended_action / primary_issue）
- 你的回复必须围绕当前学习计划的第一步展开
- 你的语气应该像一位有经验的导师，简洁、有方向感
- 回复控制在 2-4 句话以内
- 直接开始教学内容，不要以"好的"、"当然"等口水话开头
"""

PLAN_ENRICH_SYSTEM_PROMPT = """\
你是 Xidea 学习编排系统的内部规划器。

你需要根据用户的具体问题和诊断上下文，为学习计划的每个步骤生成针对性的 reason 和 outcome。

约束：
- reason 说明"为什么安排这一步"，要具体到用户的问题，不要泛泛而谈
- outcome 说明"完成后能检验什么"，要可检视、可判断
- 每个字段控制在 1-2 句话以内
- 输出严格 JSON 数组，每个元素含 id, reason, outcome 三个字段
"""


@dataclass
class LLMClient:
    """Minimal wrapper holding an OpenAI-compatible client and model name."""

    client: object  # openai.OpenAI instance
    model: str
    provider: str = "openai-compatible"
    base_url: str | None = None


def _is_zhipu_base_url(base_url: str | None) -> bool:
    return bool(base_url and "bigmodel.cn" in base_url.lower())


def _read_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def _build_http_client() -> httpx.Client:
    # Default to direct outbound requests for local demo runs. This avoids
    # accidental proxy interception causing custom-CA verification failures.
    trust_env = _read_bool_env("XIDEA_LLM_TRUST_ENV", False)
    verify: bool | str = True
    for env_name in ("XIDEA_LLM_CA_BUNDLE", "SSL_CERT_FILE", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE"):
        bundle = os.getenv(env_name, "").strip()
        if bundle:
            verify = bundle
            break

    return httpx.Client(trust_env=trust_env, verify=verify)


def _resolve_zhipu_thinking_mode() -> str:
    raw = os.getenv("XIDEA_LLM_ZHIPU_THINKING", "").strip().lower()
    if raw in {"enabled", "disabled"}:
        return raw
    return "disabled"


def _resolve_llm_config() -> tuple[str, str | None, str, str]:
    configured_api_key = os.getenv("XIDEA_LLM_API_KEY", "").strip()
    zai_api_key = os.getenv("ZAI_API_KEY", "").strip()
    openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()

    if configured_api_key:
        api_key = configured_api_key
        base_url = os.getenv("XIDEA_LLM_BASE_URL", "").strip() or ZHIPU_OPENAI_BASE_URL
    elif zai_api_key:
        api_key = zai_api_key
        base_url = os.getenv("XIDEA_LLM_BASE_URL", "").strip() or ZHIPU_OPENAI_BASE_URL
    elif openai_api_key:
        api_key = openai_api_key
        base_url = os.getenv("XIDEA_LLM_BASE_URL", "").strip() or None
    else:
        raise RuntimeError(
            "LLM API key is required. "
            "Set XIDEA_LLM_API_KEY, ZAI_API_KEY, or OPENAI_API_KEY to start the system."
        )

    if _is_zhipu_base_url(base_url):
        default_model = "glm-5"
        provider = "zhipu"
    elif base_url:
        default_model = "gpt-4o-mini"
        provider = "openai-compatible"
    else:
        default_model = "gpt-4o-mini"
        provider = "openai"

    model = os.getenv("XIDEA_LLM_MODEL", "").strip() or default_model
    return api_key, base_url, model, provider


def build_llm_client() -> LLMClient:
    """Create an LLM client from environment variables.

    Raises RuntimeError if no supported LLM API key is set — the LLM is the
    core decision-maker and the system cannot operate without it.
    """
    api_key, base_url, model, provider = _resolve_llm_config()

    from openai import OpenAI

    client_kwargs: dict[str, object] = {
        "api_key": api_key,
        "http_client": _build_http_client(),
    }
    if base_url:
        client_kwargs["base_url"] = base_url

    client = OpenAI(**client_kwargs)
    return LLMClient(client=client, model=model, provider=provider, base_url=base_url)


def _strip_code_fence(raw: str) -> str:
    """Remove optional markdown code fences from LLM output."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()
    return raw


def _strip_think_tags(raw: str) -> str:
    """Remove provider-added thinking blocks from visible content."""
    cleaned = re.sub(r"<think\b[^>]*>.*?</think>", "", raw, flags=re.IGNORECASE | re.DOTALL)
    return cleaned.strip()


def _strip_structured_wrappers(raw: str) -> str:
    """Remove common XML-ish wrappers that surround JSON answers."""
    cleaned = raw.strip()

    wrapper_names = ("answer", "output", "response", "result", "json")
    for name in wrapper_names:
        cleaned = re.sub(rf"^\s*<{name}\b[^>]*>\s*", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
        cleaned = re.sub(rf"\s*</{name}>\s*$", "", cleaned, flags=re.IGNORECASE | re.DOTALL)

    return cleaned.strip()


def _extract_balanced_json_block(raw: str, *, prefer: str | None = None) -> str | None:
    open_chars = [prefer] if prefer in {"{", "["} else ["{", "["]

    for open_char in open_chars:
        close_char = "}" if open_char == "{" else "]"
        start = raw.find(open_char)
        while start != -1:
            depth = 0
            in_string = False
            escaped = False
            for index in range(start, len(raw)):
                char = raw[index]
                if in_string:
                    if escaped:
                        escaped = False
                    elif char == "\\":
                        escaped = True
                    elif char == '"':
                        in_string = False
                    continue

                if char == '"':
                    in_string = True
                    continue

                if char == open_char:
                    depth += 1
                elif char == close_char:
                    depth -= 1
                    if depth == 0:
                        return raw[start : index + 1]

            start = raw.find(open_char, start + 1)

    return None


def _prepare_structured_output(raw: str, *, prefer: str | None = None) -> str:
    cleaned = _strip_structured_wrappers(_strip_think_tags(_strip_code_fence(raw)))
    extracted = _extract_balanced_json_block(cleaned, prefer=prefer)
    return (extracted or cleaned).strip()


def _repair_jsonish_text(raw: str) -> str:
    repaired = raw.strip()
    repaired = re.sub(r"/\*.*?\*/", "", repaired, flags=re.DOTALL)
    repaired = re.sub(r"(^|[\n\r])\s*//.*?(?=$|[\n\r])", r"\1", repaired)
    repaired = re.sub(r"(^|[\n\r])\s*#.*?(?=$|[\n\r])", r"\1", repaired)
    repaired = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)", r'\1"\2"\3', repaired)
    repaired = re.sub(r",(\s*[}\]])", r"\1", repaired)
    repaired = re.sub(r"\bTrue\b", "true", repaired)
    repaired = re.sub(r"\bFalse\b", "false", repaired)
    repaired = re.sub(r"\bNone\b", "null", repaired)
    repaired = re.sub(
        r"'([^'\\]*(?:\\.[^'\\]*)*)'",
        lambda match: json.dumps(bytes(match.group(1), "utf-8").decode("unicode_escape")),
        repaired,
    )
    repaired = _repair_unterminated_double_quoted_strings(repaired)
    return repaired.strip()


def _repair_unterminated_double_quoted_strings(raw: str) -> str:
    output: list[str] = []
    in_string = False
    escaped = False
    index = 0
    length = len(raw)

    while index < length:
        char = raw[index]

        if in_string:
            if escaped:
                output.append(char)
                escaped = False
                index += 1
                continue

            if char == "\\":
                output.append(char)
                escaped = True
                index += 1
                continue

            if char == '"':
                output.append(char)
                in_string = False
                index += 1
                continue

            if char in "\r\n":
                remaining = raw[index + 1 :]
                next_key_match = re.match(r"\s*\"[A-Za-z_][A-Za-z0-9_-]*\"\s*:", remaining)
                if next_key_match:
                    last_non_space = len(output) - 1
                    while last_non_space >= 0 and output[last_non_space].isspace():
                        last_non_space -= 1
                    if last_non_space >= 0 and output[last_non_space] == ",":
                        output.insert(last_non_space, '"')
                    else:
                        output.append('"')
                    in_string = False
                    output.append(char)
                    index += 1
                    continue

            output.append(char)
            index += 1
            continue

        output.append(char)
        if char == '"':
            in_string = True
        index += 1

    if in_string:
        last_non_space = len(output) - 1
        while last_non_space >= 0 and output[last_non_space].isspace():
            last_non_space -= 1
        if last_non_space >= 0 and output[last_non_space] == ",":
            output.insert(last_non_space, '"')
        else:
            output.append('"')

    return "".join(output)


def _load_structured_json(raw: str) -> object:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    repaired = _repair_jsonish_text(raw)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    pythonish = re.sub(r"\btrue\b", "True", repaired)
    pythonish = re.sub(r"\bfalse\b", "False", pythonish)
    pythonish = re.sub(r"\bnull\b", "None", pythonish)
    return literal_eval(pythonish)


def _parse_signal_list(
    parsed: object,
    observations: list[Observation],
) -> list[Signal] | None:
    if not isinstance(parsed, list):
        return None

    signals: list[Signal] = []
    observation_ids = [o.observation_id for o in observations]
    for item in parsed:
        if not isinstance(item, dict):
            continue
        kind = item.get("kind", "")
        if kind not in VALID_SIGNAL_KINDS:
            continue
        signals.append(
            Signal(
                kind=kind,  # type: ignore[arg-type]
                score=max(0.0, min(1.0, float(item.get("score", 0.5)))),
                confidence=max(0.0, min(1.0, float(item.get("confidence", 0.5)))),
                summary=str(item.get("summary", "LLM 检测到的信号")),
                based_on=observation_ids[:2],
            )
        )

    return signals or None


def _parse_diagnosis_payload(
    parsed: object,
    learner_state: LearnerUnitState,
    entry_mode: str,
    target_unit_id: str | None,
) -> Diagnosis | None:
    if not isinstance(parsed, dict):
        return None

    action = parsed.get("recommended_action", "")
    if action not in VALID_ACTIONS:
        return None

    primary_issue = parsed.get("primary_issue", "")
    if primary_issue not in VALID_PRIMARY_ISSUES:
        primary_issue = _infer_issue_from_action(action)

    reason = str(parsed.get("reason", "")).strip()
    if not reason:
        return None

    confidence = max(0.0, min(1.0, float(parsed.get("confidence", 0.7))))
    needs_tool = bool(parsed.get("needs_tool", False))
    if entry_mode == "material-import":
        needs_tool = True

    return Diagnosis(
        recommended_action=action,  # type: ignore[arg-type]
        reason=reason,
        confidence=confidence,
        focus_unit_id=target_unit_id or learner_state.unit_id,
        primary_issue=primary_issue,  # type: ignore[arg-type]
        needs_tool=needs_tool,
        explanation=Explanation(
            summary=reason,
            evidence=[
                f"understanding={learner_state.understanding_level}",
                f"memory={learner_state.memory_strength}",
                f"confusion={learner_state.confusion_level}",
                f"transfer={learner_state.transfer_readiness}",
                "source=LLM",
            ],
            confidence=confidence,
        ),
    )


def _chat_completion(
    llm: LLMClient,
    *,
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int,
    expect_json_object: bool = False,
):
    kwargs: dict[str, object] = {
        "model": llm.model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if expect_json_object:
        kwargs["response_format"] = {"type": "json_object"}
    if llm.provider == "zhipu":
        kwargs["extra_body"] = {
            "thinking": {
                "type": _resolve_zhipu_thinking_mode(),
            }
        }

    return llm.client.chat.completions.create(**kwargs)


def _chat_completion_stream(
    llm: LLMClient,
    *,
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int,
):
    kwargs: dict[str, object] = {
        "model": llm.model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    if llm.provider == "zhipu":
        kwargs["extra_body"] = {
            "thinking": {
                "type": _resolve_zhipu_thinking_mode(),
            }
        }

    return llm.client.chat.completions.create(**kwargs)


def _extract_message_text(response: object) -> str:
    message = response.choices[0].message
    content = getattr(message, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text_value = item.get("text")
                if isinstance(text_value, str):
                    text_parts.append(text_value)
            else:
                text_value = getattr(item, "text", None)
                if isinstance(text_value, str):
                    text_parts.append(text_value)
        if text_parts:
            return "".join(text_parts)

    reasoning_content = getattr(message, "reasoning_content", None)
    if isinstance(reasoning_content, str):
        return reasoning_content
    return ""


def _extract_stream_chunk_text(chunk: object) -> str:
    choices = getattr(chunk, "choices", None)
    if not choices:
        return ""

    delta = getattr(choices[0], "delta", None)
    if delta is None:
        return ""

    content = getattr(delta, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text_value = item.get("text")
                if isinstance(text_value, str):
                    text_parts.append(text_value)
            else:
                text_value = getattr(item, "text", None)
                if isinstance(text_value, str):
                    text_parts.append(text_value)
        return "".join(text_parts)
    return ""


def _extract_provider_error_details(error: Exception) -> tuple[str, str]:
    body = getattr(error, "body", None)
    code = ""
    message = str(error)

    if isinstance(body, dict):
        error_body = body.get("error")
        if isinstance(error_body, dict):
            code = str(error_body.get("code", "")).strip()
            body_message = error_body.get("message")
            if isinstance(body_message, str) and body_message.strip():
                message = body_message.strip()
        if not code:
            filter_entries = body.get("contentFilter")
            if isinstance(filter_entries, list) and filter_entries:
                code = "content-filter"

    return code, message


def _is_provider_safety_error(error: Exception) -> bool:
    code, message = _extract_provider_error_details(error)
    lowered = message.lower()
    return (
        getattr(error, "status_code", None) == 400
        and (
            code in {"1301", "content-filter"}
            or "敏感内容" in message
            or "不安全" in message
            or "content filter" in lowered
            or "unsafe" in lowered
        )
    )


def _build_provider_safety_signals(observations: list[Observation]) -> list[Signal]:
    return [
        Signal(
            kind="project-relevance",
            score=0.2,
            confidence=0.35,
            summary="本轮问题更适合转成系统边界说明，而不是继续走常规学习诊断。",
            based_on=[o.summary for o in observations[:3]],
        )
    ]


def _build_provider_safety_diagnosis(
    learner_state: LearnerUnitState,
    target_unit_id: str | None,
) -> Diagnosis:
    return Diagnosis(
        recommended_action="clarify",
        reason=PROVIDER_SAFETY_REASON,
        confidence=0.36,
        focus_unit_id=target_unit_id or learner_state.unit_id,
        primary_issue="missing-context",
        needs_tool=False,
        explanation=Explanation(
            summary="provider safety filter blocked the structured diagnosis request",
            evidence=[
                "source=provider-safety",
                f"understanding={learner_state.understanding_level}",
                f"memory={learner_state.memory_strength}",
                f"confusion={learner_state.confusion_level}",
                f"transfer={learner_state.transfer_readiness}",
            ],
            confidence=0.36,
        ),
    )


def _is_provider_safety_diagnosis(diagnosis: Diagnosis) -> bool:
    return diagnosis.reason == PROVIDER_SAFETY_REASON or (
        diagnosis.explanation is not None
        and "source=provider-safety" in diagnosis.explanation.evidence
    )


def _build_provider_safety_reply() -> str:
    return (
        "我不能直接提供内部 system prompt 或隐藏指令。"
        "如果你的目标是理解这个 demo 的行为，我可以继续用三种安全方式回答："
        "1. 概述当前 agent 的判断流程；"
        "2. 解释 `/runs/v0/stream` 这条链路会做哪些步骤；"
        "3. 总结 system prompt 的职责边界，但不逐字泄露内部提示词。"
    )


def _chunk_text_for_ui(text: str, max_chunk_chars: int = 24) -> Iterator[str]:
    normalized = text
    while normalized:
        yield normalized[:max_chunk_chars]
        normalized = normalized[max_chunk_chars:]


def llm_build_signals(
    llm: LLMClient,
    messages: list[Message],
    observations: list[Observation],
    entry_mode: str,
    prior_state: LearnerUnitState | None = None,
) -> list[Signal] | None:
    """Use LLM to extract learning signals from user messages.

    Returns a list of Signal objects on success, None on failure so caller
    can fall back to rule-based signal extraction.
    """
    user_texts = [m.content for m in messages if m.role == "user"]
    if not user_texts:
        return None

    context_parts = [
        f"学习者最新消息：{user_texts[-1]}",
    ]
    if len(user_texts) > 1:
        context_parts.append(f"历史消息（最近 {len(user_texts)} 轮）：")
        for i, text in enumerate(user_texts[:-1], 1):
            context_parts.append(f"  第{i}轮：{text}")

    context_parts.append(f"入口方式：{entry_mode}")

    if prior_state is not None:
        context_parts.append(
            f"上轮学习状态：理解={prior_state.understanding_level}, "
            f"记忆={prior_state.memory_strength}, "
            f"混淆={prior_state.confusion_level}, "
            f"迁移={prior_state.transfer_readiness}"
        )
        if prior_state.recommended_action:
            context_parts.append(f"上轮推荐动作：{prior_state.recommended_action}")

    if observations:
        obs_summaries = [o.summary for o in observations[:5]]
        context_parts.append(f"观测摘要：{'; '.join(obs_summaries)}")

    user_prompt = "\n".join(context_parts)

    try:
        response = _chat_completion(
            llm,
            messages=[
                {"role": "system", "content": SIGNAL_EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=600,
        )
        raw = _extract_message_text(response)
        raw = _prepare_structured_output(raw, prefer="[")

        parsed = _load_structured_json(raw)
        return _parse_signal_list(parsed, observations)

    except Exception as exc:
        if _is_provider_safety_error(exc):
            logger.warning("LLM signal extraction hit provider safety filter; using safety signals.")
            return _build_provider_safety_signals(observations)
        logger.warning(
            "LLM signal extraction failed, falling back to rules. raw preview: %r",
            raw[:160] if "raw" in locals() else "",
            exc_info=True,
        )
        return None


def llm_diagnose(
    llm: LLMClient,
    learner_state: LearnerUnitState,
    signals: list[Signal],
    entry_mode: str,
    target_unit_id: str | None,
    prior_state: LearnerUnitState | None = None,
    review_should: bool = False,
    review_priority: float = 0.0,
    review_reason: str = "",
) -> Diagnosis | None:
    """Use LLM to make a diagnosis decision.

    Returns a Diagnosis on success, None on failure so caller can fall back
    to rule-based diagnosis.
    """
    context_parts = [
        f"学习者当前状态：理解={learner_state.understanding_level}, "
        f"记忆={learner_state.memory_strength}, "
        f"混淆={learner_state.confusion_level}, "
        f"迁移={learner_state.transfer_readiness}, "
        f"掌握={learner_state.mastery}",
    ]

    if learner_state.weak_signals:
        context_parts.append(f"薄弱信号：{', '.join(learner_state.weak_signals)}")

    context_parts.append(f"入口方式：{entry_mode}")
    context_parts.append(f"是否有明确学习单元：{'是' if target_unit_id else '否'}")

    signal_desc = "; ".join(f"{s.kind}(score={s.score:.2f}, conf={s.confidence:.2f}): {s.summary}" for s in signals)
    context_parts.append(f"检测到的信号：{signal_desc}")

    if review_should:
        context_parts.append(f"复习引擎建议：应复习 (priority={review_priority:.2f}, reason={review_reason})")
    else:
        context_parts.append("复习引擎建议：暂不需要复习")

    if prior_state is not None:
        context_parts.append(
            f"上轮状态：理解={prior_state.understanding_level}, "
            f"记忆={prior_state.memory_strength}, "
            f"混淆={prior_state.confusion_level}"
        )
        if prior_state.recommended_action:
            context_parts.append(f"上轮推荐动作：{prior_state.recommended_action}")

    user_prompt = "\n".join(context_parts)

    try:
        response = _chat_completion(
            llm,
            messages=[
                {"role": "system", "content": DIAGNOSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=300,
            expect_json_object=True,
        )
        raw = _extract_message_text(response)
        raw = _prepare_structured_output(raw, prefer="{")

        parsed = _load_structured_json(raw)
        return _parse_diagnosis_payload(parsed, learner_state, entry_mode, target_unit_id)

    except Exception as exc:
        if _is_provider_safety_error(exc):
            logger.warning("LLM diagnosis hit provider safety filter; using safety diagnosis.")
            return _build_provider_safety_diagnosis(learner_state, target_unit_id)
        logger.warning(
            "LLM diagnosis failed, falling back to rules. raw preview: %r",
            raw[:160] if "raw" in locals() else "",
            exc_info=True,
        )
        return None


def _infer_issue_from_action(action: str) -> str:
    mapping = {
        "clarify": "concept-confusion",
        "teach": "insufficient-understanding",
        "review": "weak-recall",
        "apply": "poor-transfer",
        "practice": "poor-transfer",
    }
    return mapping.get(action, "missing-context")


def llm_build_signals_and_diagnosis(
    llm: LLMClient,
    messages: list[Message],
    observations: list[Observation],
    entry_mode: str,
    learner_state: LearnerUnitState,
    target_unit_id: str | None,
    prior_state: LearnerUnitState | None = None,
    review_should: bool = False,
    review_priority: float = 0.0,
    review_reason: str = "",
) -> tuple[list[Signal], Diagnosis] | None:
    user_texts = [m.content for m in messages if m.role == "user"]
    if not user_texts:
        return None

    context_parts = [
        f"学习者最新消息：{user_texts[-1]}",
    ]
    if len(user_texts) > 1:
        context_parts.append(f"历史消息（最近 {len(user_texts)} 轮）：")
        for i, text in enumerate(user_texts[:-1], 1):
            context_parts.append(f"  第{i}轮：{text}")

    context_parts.extend([
        f"入口方式：{entry_mode}",
        f"学习者当前状态：理解={learner_state.understanding_level}, "
        f"记忆={learner_state.memory_strength}, "
        f"混淆={learner_state.confusion_level}, "
        f"迁移={learner_state.transfer_readiness}, "
        f"掌握={learner_state.mastery}",
        f"是否有明确学习单元：{'是' if target_unit_id else '否'}",
    ])

    if learner_state.weak_signals:
        context_parts.append(f"薄弱信号：{', '.join(learner_state.weak_signals)}")

    if observations:
        obs_summaries = [o.summary for o in observations[:5]]
        context_parts.append(f"观测摘要：{'; '.join(obs_summaries)}")

    if review_should:
        context_parts.append(f"复习引擎建议：应复习 (priority={review_priority:.2f}, reason={review_reason})")
    else:
        context_parts.append("复习引擎建议：暂不需要复习")

    if prior_state is not None:
        context_parts.append(
            f"上轮状态：理解={prior_state.understanding_level}, "
            f"记忆={prior_state.memory_strength}, "
            f"混淆={prior_state.confusion_level}, "
            f"迁移={prior_state.transfer_readiness}"
        )
        if prior_state.recommended_action:
            context_parts.append(f"上轮推荐动作：{prior_state.recommended_action}")

    user_prompt = "\n".join(context_parts)

    try:
        response = _chat_completion(
            llm,
            messages=[
                {"role": "system", "content": COMBINED_DIAGNOSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=900,
            expect_json_object=True,
        )
        raw = _extract_message_text(response)
        raw = _prepare_structured_output(raw, prefer="{")
        parsed = _load_structured_json(raw)
        if not isinstance(parsed, dict):
            return None

        signals = _parse_signal_list(parsed.get("signals"), observations)
        diagnosis = _parse_diagnosis_payload(
            parsed.get("diagnosis"),
            learner_state,
            entry_mode,
            target_unit_id,
        )
        if signals is None or diagnosis is None:
            return None
        return signals, diagnosis
    except Exception as exc:
        if _is_provider_safety_error(exc):
            logger.warning(
                "LLM combined signals+diagnosis hit provider safety filter; using safety fallback."
            )
            return (
                _build_provider_safety_signals(observations),
                _build_provider_safety_diagnosis(learner_state, target_unit_id),
            )
        logger.warning(
            "LLM combined signals+diagnosis failed, falling back to split calls. raw preview: %r",
            raw[:160] if "raw" in locals() else "",
            exc_info=True,
        )
        return None


VALID_MODES: set[str] = {
    "socratic", "guided-qa", "contrast-drill",
    "image-recall", "audio-recall", "scenario-sim",
}


def llm_build_plan(
    llm: LLMClient,
    topic: str,
    unit_title: str,
    candidate_modes: list[str],
    diagnosis: Diagnosis,
    learner_state: LearnerUnitState,
    user_message: str,
) -> StudyPlan | None:
    """Use LLM to generate a complete StudyPlan.

    Returns a StudyPlan on success, None on failure so caller can fall back
    to rule-based plan generation.
    """
    context_parts = [
        f"用户问题：{user_message}",
        f"学习主题：{topic}",
        f"学习单元：{unit_title}",
        f"诊断结果：recommended_action={diagnosis.recommended_action}, "
        f"primary_issue={diagnosis.primary_issue}, reason={diagnosis.reason}",
        f"学习者状态：理解={learner_state.understanding_level}, "
        f"记忆={learner_state.memory_strength}, "
        f"混淆={learner_state.confusion_level}, "
        f"迁移={learner_state.transfer_readiness}",
    ]
    if candidate_modes:
        context_parts.append(f"候选训练模式（steps 的 mode 必须从中选）：{', '.join(candidate_modes)}")

    user_prompt = "\n".join(context_parts)

    try:
        response = _chat_completion(
            llm,
            messages=[
                {"role": "system", "content": PLAN_GENERATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=600,
            expect_json_object=True,
        )
        raw = _extract_message_text(response)
        raw = _prepare_structured_output(raw, prefer="{")

        parsed = _load_structured_json(raw)
        if not isinstance(parsed, dict):
            return None

        steps_raw = parsed.get("steps", [])
        if not isinstance(steps_raw, list) or not steps_raw or len(steps_raw) > 3:
            return None

        candidates = set(candidate_modes) if candidate_modes else None
        steps: list[StudyPlanStep] = []
        for s in steps_raw:
            mode = s.get("mode", "")
            if mode not in VALID_MODES:
                continue
            if candidates and mode not in candidates:
                continue
            step_id = str(s.get("id", f"step-{len(steps)+1}")).strip()
            title = str(s.get("title", "")).strip()
            reason = str(s.get("reason", "")).strip()
            outcome = str(s.get("outcome", "")).strip()
            if not step_id or not title or not reason or not outcome:
                continue
            steps.append(StudyPlanStep(id=step_id, title=title, mode=mode, reason=reason, outcome=outcome))

        if not steps:
            return None

        headline = str(parsed.get("headline", "")).strip()
        summary = str(parsed.get("summary", "")).strip()
        selected_mode = steps[0].mode
        expected_outcome = str(parsed.get("expected_outcome", "")).strip()

        if not headline or not summary or not expected_outcome:
            return None

        return StudyPlan(
            headline=headline,
            summary=summary,
            selected_mode=selected_mode,
            expected_outcome=expected_outcome,
            steps=steps,
        )

    except Exception:
        logger.warning(
            "LLM plan generation failed, falling back to template. raw preview: %r",
            raw[:160] if "raw" in locals() else "",
            exc_info=True,
        )
        return None


def generate_assistant_reply(
    llm: LLMClient,
    diagnosis: Diagnosis,
    plan: StudyPlan | None,
    learner_state: LearnerUnitState,
    user_message: str,
    tool_result: ToolResult | None = None,
) -> str | None:
    """Generate a natural-language teaching reply using LLM. Returns None on failure."""
    if _is_provider_safety_diagnosis(diagnosis):
        return _build_provider_safety_reply()

    context_parts = [
        f"用户问题：{user_message}",
        f"诊断结果：recommended_action={diagnosis.recommended_action}, "
        f"primary_issue={diagnosis.primary_issue}, reason={diagnosis.reason}",
        f"学习者状态：理解={learner_state.understanding_level}, "
        f"记忆={learner_state.memory_strength}, "
        f"混淆={learner_state.confusion_level}, "
        f"迁移={learner_state.transfer_readiness}",
    ]
    if plan is not None:
        context_parts.append(f"学习计划第一步：{plan.steps[0].title}（{plan.steps[0].mode}）")
    if tool_result is not None:
        context_parts.append(f"补充上下文类型：{tool_result.kind}")

    user_prompt = "\n".join(context_parts)

    try:
        response = _chat_completion(
            llm,
            messages=[
                {"role": "system", "content": REPLY_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=300,
        )
        content = _extract_message_text(response)
        if content and content.strip():
            return content.strip()
    except Exception as exc:
        if _is_provider_safety_error(exc):
            logger.warning("LLM reply generation hit provider safety filter; using local refusal reply.")
            return _build_provider_safety_reply()
        logger.warning("LLM reply generation failed, falling back to template.", exc_info=True)

    return None


def stream_assistant_reply(
    llm: LLMClient,
    diagnosis: Diagnosis,
    plan: StudyPlan | None,
    learner_state: LearnerUnitState,
    user_message: str,
    tool_result: ToolResult | None = None,
) -> Iterator[str]:
    """Generate a streaming natural-language teaching reply.

    Falls back to chunking a non-streaming response when the provider or mock
    returns a full response object instead of a streaming iterator.
    """
    if _is_provider_safety_diagnosis(diagnosis):
        yield from _chunk_text_for_ui(_build_provider_safety_reply())
        return

    context_parts = [
        f"用户问题：{user_message}",
        f"诊断结果：recommended_action={diagnosis.recommended_action}, "
        f"primary_issue={diagnosis.primary_issue}, reason={diagnosis.reason}",
        f"学习者状态：理解={learner_state.understanding_level}, "
        f"记忆={learner_state.memory_strength}, "
        f"混淆={learner_state.confusion_level}, "
        f"迁移={learner_state.transfer_readiness}",
    ]
    if plan is not None:
        context_parts.append(f"学习计划第一步：{plan.steps[0].title}（{plan.steps[0].mode}）")
    if tool_result is not None:
        context_parts.append(f"补充上下文类型：{tool_result.kind}")

    user_prompt = "\n".join(context_parts)

    try:
        stream_or_response = _chat_completion_stream(
            llm,
            messages=[
                {"role": "system", "content": REPLY_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=300,
        )

        if hasattr(stream_or_response, "choices"):
            text = _extract_message_text(stream_or_response).strip()
            if text:
                yield from _chunk_text_for_ui(text)
            return

        for chunk in stream_or_response:
            text = _extract_stream_chunk_text(chunk)
            if not text:
                continue
            yield from _chunk_text_for_ui(text)
        return
    except Exception as exc:
        if _is_provider_safety_error(exc):
            logger.warning("LLM reply streaming hit provider safety filter; using local refusal reply.")
            yield from _chunk_text_for_ui(_build_provider_safety_reply())
            return
        logger.warning("LLM reply streaming failed, falling back to sync reply.", exc_info=True)

    fallback = generate_assistant_reply(
        llm,
        diagnosis,
        plan,
        learner_state,
        user_message,
        tool_result=tool_result,
    )
    if fallback is not None:
        yield from _chunk_text_for_ui(fallback)


def enrich_plan_steps(
    llm: LLMClient,
    steps: list[StudyPlanStep],
    diagnosis: Diagnosis,
    user_message: str,
    unit_title: str,
) -> list[StudyPlanStep] | None:
    """Use LLM to generate context-specific reason/outcome for each plan step.

    Returns enriched steps on success, None on failure so caller can use originals.
    """
    skeleton = [{"id": s.id, "title": s.title, "mode": s.mode} for s in steps]

    user_prompt = (
        f"用户问题：{user_message}\n"
        f"学习单元：{unit_title}\n"
        f"诊断动作：{diagnosis.recommended_action}（{diagnosis.reason}）\n"
        f"步骤骨架：{json.dumps(skeleton, ensure_ascii=False)}\n\n"
        f"请为每个步骤生成 reason 和 outcome，输出 JSON 数组。"
    )

    try:
        response = _chat_completion(
            llm,
            messages=[
                {"role": "system", "content": PLAN_ENRICH_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=500,
        )
        raw = _extract_message_text(response)
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()
        raw = _prepare_structured_output(raw, prefer="[")

        enrichments = _load_structured_json(raw)
        if not isinstance(enrichments, list) or len(enrichments) != len(steps):
            return None

        enriched: list[StudyPlanStep] = []
        for original, patch in zip(steps, enrichments):
            reason = patch.get("reason", "").strip() or original.reason
            outcome = patch.get("outcome", "").strip() or original.outcome
            enriched.append(
                StudyPlanStep(
                    id=original.id,
                    title=original.title,
                    mode=original.mode,
                    reason=reason,
                    outcome=outcome,
                )
            )
        return enriched

    except Exception:
        logger.warning(
            "LLM plan enrichment failed, falling back to template. raw preview: %r",
            raw[:160] if "raw" in locals() else "",
            exc_info=True,
        )
        return None
