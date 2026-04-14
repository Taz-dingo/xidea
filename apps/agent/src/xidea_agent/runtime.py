from __future__ import annotations

from datetime import datetime, timedelta, timezone

from xidea_agent.guardrails import get_violations, validate_diagnosis
from xidea_agent.repository import SQLiteRepository
from xidea_agent.review_engine import ReviewDecision, should_enter_review, schedule_next_review
from xidea_agent.state import (
    AgentRequest,
    AgentRunResult,
    Diagnosis,
    DiagnosisEvent,
    DoneEvent,
    Explanation,
    GraphState,
    LearnerStatePatch,
    LearnerUnitState,
    LearningMode,
    Message,
    Observation,
    PedagogicalAction,
    PlanEvent,
    PrimaryIssue,
    ReviewPatch,
    Signal,
    StatePatch,
    StatePatchEvent,
    StudyPlan,
    StudyPlanStep,
    TextDeltaEvent,
    ToolIntent,
    ToolResult,
    build_initial_graph_state,
)
from xidea_agent.tools import resolve_tool_result, retrieve_learning_unit, retrieve_source_assets


UTC = timezone.utc

CONFUSION_KEYWORDS = ("分不清", "混淆", "区别", "差别", "搞不清", "边界")
UNDERSTANDING_KEYWORDS = ("为什么", "原理", "什么意思", "怎么理解", "不懂", "没懂", "解释")
RECALL_KEYWORDS = ("复习", "忘", "记不住", "回忆", "巩固")
TRANSFER_KEYWORDS = ("项目", "方案", "设计", "落地", "评审", "答辩", "bad case", "场景")
PRACTICE_KEYWORDS = ("练习", "试试", "演练", "模拟")

MODE_LABELS: dict[LearningMode, str] = {
    "socratic": "苏格拉底追问",
    "guided-qa": "1v1 导师问答",
    "contrast-drill": "对比辨析训练",
    "image-recall": "看图回忆",
    "audio-recall": "听音作答",
    "scenario-sim": "情境模拟",
}

ACTION_ISSUE: dict[PedagogicalAction, PrimaryIssue] = {
    "clarify": "concept-confusion",
    "teach": "insufficient-understanding",
    "review": "weak-recall",
    "apply": "poor-transfer",
    "practice": "poor-transfer",
}

ACTION_REASON: dict[PedagogicalAction, str] = {
    "clarify": "当前最大问题是概念边界混淆，先把区别拉清楚比继续讲知识点更重要。",
    "teach": "用户还没有形成稳定理解框架，先补建模再安排练习更稳。",
    "apply": "概念基础已基本具备，但还需要在项目场景里验证是否真的会用。",
    "practice": "当前适合通过练习把已有理解转成更稳定的应用能力。",
}


def latest_user_message(messages: list[Message]) -> str:
    for message in reversed(messages):
        if message.role == "user":
            return message.content

    return messages[-1].content


def _multi_turn_frequency(
    messages: list[Message], keywords: tuple[str, ...], lowercase: bool = False
) -> int:
    """Count user messages in recent history that mention at least one keyword."""
    count = 0
    for msg in messages:
        if msg.role != "user":
            continue
        text = msg.content.lower() if lowercase else msg.content
        if any(kw in text for kw in keywords):
            count += 1
    return count


def _boost(base: float, turn_count: int, per_turn: float = 0.06) -> float:
    """Boost a value when multiple turns mention the same signal."""
    if turn_count <= 1:
        return base
    return min(1.0, base + per_turn * (turn_count - 1))


def _score_actions(
    learner_state: LearnerUnitState,
    review_decision: ReviewDecision,
    prior_state: LearnerUnitState | None = None,
) -> dict[PedagogicalAction, float]:
    """Score each pedagogical action; highest score wins."""
    scores: dict[PedagogicalAction, float] = {
        "clarify": 0.0,
        "teach": 0.0,
        "review": 0.0,
        "apply": 0.0,
        "practice": 0.12,
    }

    confusion = learner_state.confusion_level
    understanding = learner_state.understanding_level
    transfer = learner_state.transfer_readiness

    if confusion > 40:
        scores["clarify"] = min(1.0, (confusion - 40) / 25)

    if review_decision.should_review:
        scores["review"] = review_decision.priority

    if understanding < 60:
        scores["teach"] = min(1.0, (60 - understanding) / 60) * 0.7

    if transfer < 50:
        scores["apply"] = min(1.0, (50 - transfer) / 50) * 0.6

    if prior_state and prior_state.recommended_action:
        pa = prior_state.recommended_action
        if pa == "clarify" and prior_state.confusion_level >= 55:
            scores["clarify"] *= 0.75
        elif pa == "teach" and prior_state.understanding_level <= 55:
            scores["teach"] *= 0.75
        elif pa == "review" and prior_state.memory_strength <= 45:
            scores["review"] *= 0.75
        elif pa == "apply" and prior_state.transfer_readiness <= 45:
            scores["apply"] *= 0.75

    return scores


def build_signals(
    messages: list[Message],
    observations: list[Observation],
    entry_mode: str,
    prior_state: LearnerUnitState | None = None,
) -> list[Signal]:
    message = latest_user_message(messages)
    lowered = message.lower()
    observation_ids = [item.observation_id for item in observations]

    confusion_turns = _multi_turn_frequency(messages, CONFUSION_KEYWORDS)
    understanding_turns = _multi_turn_frequency(messages, UNDERSTANDING_KEYWORDS)
    recall_turns = _multi_turn_frequency(messages, RECALL_KEYWORDS)
    transfer_turns = _multi_turn_frequency(messages, TRANSFER_KEYWORDS)
    practice_turns = _multi_turn_frequency(messages, PRACTICE_KEYWORDS, lowercase=True)

    signals: list[Signal] = [
        Signal(
            kind="project-relevance",
            score=0.8,
            confidence=0.8,
            summary="当前问题带有明确项目上下文，适合围绕真实任务编排学习动作。",
            based_on=observation_ids[:1],
        )
    ]

    if any(keyword in message for keyword in CONFUSION_KEYWORDS):
        signals.append(
            Signal(
                kind="concept-confusion",
                score=_boost(0.82, confusion_turns),
                confidence=_boost(0.86, confusion_turns, per_turn=0.04),
                summary=f"用户明确表达概念边界混淆（{confusion_turns}轮提及），优先澄清区别而不是继续泛讲。",
                based_on=observation_ids[:1],
            )
        )

    if any(keyword in message for keyword in UNDERSTANDING_KEYWORDS):
        signals.append(
            Signal(
                kind="concept-gap",
                score=_boost(0.76, understanding_turns),
                confidence=_boost(0.8, understanding_turns, per_turn=0.04),
                summary=f"用户当前更像在补理解框架（{understanding_turns}轮提及），还没有形成稳定解释。",
                based_on=observation_ids[:1],
            )
        )

    if any(keyword in message for keyword in RECALL_KEYWORDS):
        signals.append(
            Signal(
                kind="memory-weakness",
                score=_boost(0.8, recall_turns),
                confidence=_boost(0.78, recall_turns, per_turn=0.04),
                summary=f"用户显式提到复习或遗忘（{recall_turns}轮提及），当前存在记忆稳定性风险。",
                based_on=observation_ids[:1],
            )
        )

    if any(keyword in message for keyword in TRANSFER_KEYWORDS):
        signals.append(
            Signal(
                kind="transfer-readiness",
                score=_boost(0.42, transfer_turns),
                confidence=_boost(0.72, transfer_turns, per_turn=0.04),
                summary=f"问题已经落到项目设计或答辩场景（{transfer_turns}轮提及），需要验证是否会迁移应用。",
                based_on=observation_ids[:1],
            )
        )

    if any(keyword in lowered for keyword in PRACTICE_KEYWORDS):
        signals.append(
            Signal(
                kind="transfer-readiness",
                score=_boost(0.38, practice_turns),
                confidence=_boost(0.75, practice_turns, per_turn=0.04),
                summary=f"用户有主动演练意图（{practice_turns}轮提及），适合进入练习或情境验证。",
                based_on=observation_ids[:1],
            )
        )

    if entry_mode == "material-import":
        signals.append(
            Signal(
                kind="project-relevance",
                score=0.9,
                confidence=0.9,
                summary="当前入口包含材料导入，说明补材料上下文本身是主链路的一部分。",
                based_on=observation_ids,
            )
        )

    if prior_state is not None:
        if prior_state.confusion_level >= 45 and confusion_turns > 0:
            signals.append(
                Signal(
                    kind="concept-confusion",
                    score=0.65,
                    confidence=0.72,
                    summary=f"混淆度持续偏高（prior={prior_state.confusion_level}），趋势信号。",
                    based_on=["prior-state-trend"],
                )
            )

        if prior_state.memory_strength <= 50 and recall_turns == 0:
            signals.append(
                Signal(
                    kind="memory-weakness",
                    score=0.55,
                    confidence=0.6,
                    summary=f"记忆强度偏低（prior={prior_state.memory_strength}）但用户未主动提及，可能存在隐性遗忘风险。",
                    based_on=["prior-state-trend"],
                )
            )

    return signals


def estimate_learner_state(
    target_unit_id: str | None,
    signals: list[Signal],
    prior_state: LearnerUnitState | None = None,
) -> LearnerUnitState:
    mastery = prior_state.mastery if prior_state else 58
    understanding = prior_state.understanding_level if prior_state else 60
    memory_strength = prior_state.memory_strength if prior_state else 58
    confusion = prior_state.confusion_level if prior_state else 30
    transfer_readiness = prior_state.transfer_readiness if prior_state else 55
    weak_signals: list[str] = list(prior_state.weak_signals) if prior_state else []

    signal_kinds_seen: set[str] = set()
    kind_count: dict[str, int] = {}
    for signal in signals:
        w = signal.confidence
        kind_count[signal.kind] = kind_count.get(signal.kind, 0) + 1
        repeat_damping = 1.0 / kind_count[signal.kind]

        if signal.kind == "concept-confusion":
            confusion += int(22 * w * repeat_damping)
            understanding -= int(8 * w * repeat_damping)
            mastery -= int(5 * w * repeat_damping)
            weak_signals.append("概念边界混淆")
        elif signal.kind == "concept-gap":
            understanding -= int(16 * w * repeat_damping)
            mastery -= int(7 * w * repeat_damping)
            weak_signals.append("理解框架不稳")
        elif signal.kind == "memory-weakness":
            memory_strength -= int(18 * w * repeat_damping)
            weak_signals.append("关键概念记忆不稳")
        elif signal.kind == "transfer-readiness":
            transfer_readiness -= int(12 * w * repeat_damping)
            mastery -= int(4 * w * repeat_damping)
            weak_signals.append("还不能稳定迁移到真实场景")
        signal_kinds_seen.add(signal.kind)

    active_signal_count = sum(1 for s in signals if s.kind != "project-relevance")
    source_diversity = len(signal_kinds_seen - {"project-relevance"})
    confidence = min(0.95, 0.55 + 0.06 * active_signal_count + 0.05 * source_diversity)

    return LearnerUnitState(
        unit_id=target_unit_id or "rag-core-unit",
        mastery=max(0, min(100, mastery)),
        understanding_level=max(0, min(100, understanding)),
        memory_strength=max(0, min(100, memory_strength)),
        confusion_level=max(0, min(100, confusion)),
        transfer_readiness=max(0, min(100, transfer_readiness)),
        weak_signals=list(dict.fromkeys(weak_signals)),
        confidence=round(confidence, 2),
        based_on=[signal.summary for signal in signals],
        updated_at=datetime.now(UTC),
    )


def diagnose_state(
    entry_mode: str,
    target_unit_id: str | None,
    learner_state: LearnerUnitState,
    prior_state: LearnerUnitState | None = None,
    next_review_at: datetime | None = None,
) -> Diagnosis:
    needs_tool = entry_mode == "material-import"

    if not target_unit_id and entry_mode != "material-import":
        return Diagnosis(
            recommended_action="clarify",
            reason="当前线程还缺少明确学习单元，先补齐上下文再做更稳的判断。",
            confidence=learner_state.confidence,
            focus_unit_id=learner_state.unit_id,
            primary_issue="missing-context",
            needs_tool=True,
            explanation=build_explanation(
                learner_state,
                "当前线程还缺少明确学习单元，先补齐上下文再做更稳的判断。",
            ),
        )

    review_decision = should_enter_review(
        understanding_level=learner_state.understanding_level,
        confusion_level=learner_state.confusion_level,
        memory_strength=learner_state.memory_strength,
        next_review_at=next_review_at,
    )

    scores = _score_actions(learner_state, review_decision, prior_state=prior_state)
    action: PedagogicalAction = max(scores, key=lambda k: scores[k])

    issue = ACTION_ISSUE[action]
    if action == "review":
        reason = review_decision.reason
    else:
        reason = ACTION_REASON.get(action, "当前适合通过练习把已有理解转成更稳定的应用能力。")

    return Diagnosis(
        recommended_action=action,
        reason=reason,
        confidence=learner_state.confidence,
        focus_unit_id=learner_state.unit_id,
        primary_issue=issue,
        needs_tool=needs_tool,
        explanation=build_explanation(learner_state, reason, action_scores=scores),
    )


def build_explanation(
    learner_state: LearnerUnitState,
    summary: str,
    action_scores: dict[PedagogicalAction, float] | None = None,
) -> Explanation:
    evidence = [
        f"understanding={learner_state.understanding_level}",
        f"memory={learner_state.memory_strength}",
        f"confusion={learner_state.confusion_level}",
        f"transfer={learner_state.transfer_readiness}",
    ]
    if action_scores:
        ranked = sorted(action_scores.items(), key=lambda x: x[1], reverse=True)
        evidence.append("action-scores: " + ", ".join(f"{k}={v:.2f}" for k, v in ranked))
    return Explanation(
        summary=summary,
        evidence=evidence,
        confidence=learner_state.confidence,
    )


def choose_tool_intent(entry_mode: str, diagnosis: Diagnosis) -> ToolIntent:
    if not diagnosis.needs_tool:
        return "none"

    if entry_mode == "material-import":
        return "asset-summary"
    if diagnosis.recommended_action == "review":
        return "review-context"
    if entry_mode == "coach-followup":
        return "thread-memory"

    return "unit-detail"


def selected_mode_for_action(action: PedagogicalAction) -> LearningMode:
    if action == "clarify":
        return "contrast-drill"
    if action == "teach":
        return "guided-qa"
    if action == "review":
        return "guided-qa"
    if action == "apply":
        return "scenario-sim"
    return "socratic"


def build_plan(
    topic: str,
    learning_unit_title: str,
    candidate_modes: list[LearningMode],
    diagnosis: Diagnosis,
    learner_state: LearnerUnitState,
) -> StudyPlan:
    selected_mode = selected_mode_for_action(diagnosis.recommended_action)
    steps: list[StudyPlanStep] = []
    candidates = set(candidate_modes)

    def allow(mode: LearningMode) -> bool:
        return not candidates or mode in candidates

    if diagnosis.recommended_action == "clarify":
        if allow("contrast-drill"):
            steps.append(
                StudyPlanStep(
                    id="contrast-boundary",
                    title=MODE_LABELS["contrast-drill"],
                    mode="contrast-drill",
                    reason="先比较相近概念的边界，避免继续带着错误模型推进项目。",
                    outcome="用户能说清两个概念分别解决什么问题。",
                )
            )
        if allow("guided-qa"):
            steps.append(
                StudyPlanStep(
                    id="guided-check",
                    title=MODE_LABELS["guided-qa"],
                    mode="guided-qa",
                    reason="在澄清边界后立即追问，确认不是表面上听懂。",
                    outcome="系统能判断理解是否真正稳定下来。",
                )
            )
    elif diagnosis.recommended_action == "teach":
        if allow("guided-qa"):
            steps.append(
                StudyPlanStep(
                    id="guided-model",
                    title=MODE_LABELS["guided-qa"],
                    mode="guided-qa",
                    reason="先补关键设计框架，建立能解释问题的骨架。",
                    outcome="用户能用自己的话复述当前主题的核心判断逻辑。",
                )
            )
        if allow("scenario-sim"):
            steps.append(
                StudyPlanStep(
                    id="scenario-check",
                    title=MODE_LABELS["scenario-sim"],
                    mode="scenario-sim",
                    reason="补完框架后立刻放回项目场景，防止理解停留在抽象层。",
                    outcome="确认知识能否映射到真实项目取舍。",
                )
            )
    elif diagnosis.recommended_action == "review":
        if allow("guided-qa"):
            steps.append(
                StudyPlanStep(
                    id="recall-core",
                    title=MODE_LABELS["guided-qa"],
                    mode="guided-qa",
                    reason="先做主动回忆，判断记忆断点到底在哪里。",
                    outcome="确认哪些概念已掉出可用工作记忆。",
                )
            )
        if allow("contrast-drill"):
            steps.append(
                StudyPlanStep(
                    id="contrast-fix",
                    title=MODE_LABELS["contrast-drill"],
                    mode="contrast-drill",
                    reason="对混淆点做一次快速辨析，减少下一次再次出错的概率。",
                    outcome="把高风险混淆重新压回稳定区间。",
                )
            )
    else:
        primary_mode: LearningMode = "scenario-sim" if diagnosis.recommended_action == "apply" else "socratic"
        if allow(primary_mode):
            steps.append(
                StudyPlanStep(
                    id="project-sim",
                    title=MODE_LABELS[primary_mode],
                    mode=primary_mode,
                    reason="当前最有价值的是把知识放回项目语境，看能否解释设计取舍。",
                    outcome="用户能把当前主题映射到自己项目里的判断动作。",
                )
            )
        if allow("guided-qa"):
            steps.append(
                StudyPlanStep(
                    id="gap-check",
                    title=MODE_LABELS["guided-qa"],
                    mode="guided-qa",
                    reason="在应用之后回头追问，确认迁移过程中暴露出的新缺口。",
                    outcome="为下一轮诊断留下更清晰的状态依据。",
                )
            )

    if not steps:
        steps.append(
            StudyPlanStep(
                id="fallback-guided",
                title=MODE_LABELS["guided-qa"],
                mode="guided-qa",
                reason="当前候选模式不足，先回到最稳的导师问答继续推进。",
                outcome="先保留编排闭环，再在下一轮补更多上下文。",
            )
        )

    effective_title = learning_unit_title or topic
    return StudyPlan(
        headline=f"围绕「{effective_title}」的动态学习路径",
        summary=(
            f"系统综合理解水平 {learner_state.understanding_level}、记忆强度 "
            f"{learner_state.memory_strength} 和混淆风险 {learner_state.confusion_level}，"
            f"决定先执行 {MODE_LABELS[steps[0].mode]}。"
        ),
        selected_mode=steps[0].mode,
        expected_outcome="让下一轮判断不只基于口头回答，而基于更可检视的学习表现。",
        steps=steps[:3],
    )


def compose_assistant_message(
    diagnosis: Diagnosis, plan: StudyPlan, tool_result: ToolResult | None
) -> str:
    message = (
        f"{diagnosis.reason} 这轮我会先用「{plan.steps[0].title}」推进，"
        f"目标是{plan.steps[0].outcome}"
    )
    if tool_result is not None:
        message += f"。在开始前，我会先补一层 {tool_result.kind} 上下文，避免判断建立在信息缺口上。"
    else:
        message += "。"
    return message


def build_state_patch(
    diagnosis: Diagnosis, learner_state: LearnerUnitState, plan: StudyPlan
) -> StatePatch:
    learner_patch = LearnerStatePatch(
        mastery=learner_state.mastery,
        understanding_level=learner_state.understanding_level,
        memory_strength=learner_state.memory_strength,
        confusion_level=learner_state.confusion_level,
        transfer_readiness=learner_state.transfer_readiness,
        weak_signals=learner_state.weak_signals,
        recommended_action=diagnosis.recommended_action,
    )

    review_patch: ReviewPatch | None = None
    if diagnosis.recommended_action == "review":
        now = datetime.now(UTC)
        next_review = schedule_next_review(review_count=0, recall_success=True, now=now)
        review_patch = ReviewPatch(
            due_unit_ids=[learner_state.unit_id],
            scheduled_at=next_review,
            review_reason="当前暴露出记忆稳定性不足，需要安排下一次定向复盘。",
            review_count=1,
            lapse_count=0,
        )
        learner_patch.last_reviewed_at = now
        learner_patch.next_review_at = next_review

    return StatePatch(
        learner_state_patch=learner_patch,
        last_action={
            "action": diagnosis.recommended_action,
            "mode": plan.selected_mode,
            "unit_id": learner_state.unit_id,
        },
        review_patch=review_patch,
    )


def build_events(message: str, diagnosis: Diagnosis, plan: StudyPlan, state_patch: StatePatch):
    return [
        TextDeltaEvent(event="text-delta", delta=message),
        DiagnosisEvent(event="diagnosis", diagnosis=diagnosis),
        PlanEvent(event="plan", plan=plan),
        StatePatchEvent(event="state-patch", state_patch=state_patch),
        DoneEvent(event="done", final_message=message),
    ]


def load_context_step(
    state: GraphState, repository: SQLiteRepository | None = None, message_limit: int = 5
) -> GraphState:
    if repository is not None:
        prior_messages = repository.list_recent_messages(state.request.thread_id, limit=message_limit)
        if prior_messages:
            merged_messages = [*prior_messages, *state.request.messages]
            state.recent_messages = merged_messages[-8:]
            state.rationale.append("load_context pulled recent thread messages from SQLite repository.")
        else:
            state.rationale.append("load_context found no prior thread messages in SQLite repository.")

        if state.request.target_unit_id:
            state.prior_learner_unit_state = repository.get_learner_unit_state(
                state.request.thread_id, state.request.target_unit_id
            )
            if state.prior_learner_unit_state is not None:
                state.rationale.append(
                    "load_context reused the latest learner unit state snapshot as the estimation baseline."
                )

            review_patch = repository.get_review_state(
                state.request.thread_id, state.request.target_unit_id
            )
            if review_patch is not None and review_patch.scheduled_at is not None:
                state.prior_next_review_at = review_patch.scheduled_at
                state.rationale.append("load_context loaded prior review schedule from repository.")

    if state.request.source_asset_ids:
        state.source_assets = retrieve_source_assets(state.request.source_asset_ids)
        state.rationale.append(f"load_context attached {len(state.source_assets)} source assets.")

    state.learning_unit = retrieve_learning_unit(state.request.target_unit_id, state.request.topic)
    state.rationale.append(f"load_context selected learning unit {state.learning_unit.id}.")
    return state


def diagnose_step(state: GraphState, llm: "LLMClient") -> GraphState:
    from xidea_agent.llm import llm_build_signals, llm_diagnose

    llm_signals = llm_build_signals(
        llm,
        state.recent_messages,
        state.observations,
        state.request.entry_mode,
        prior_state=state.prior_learner_unit_state,
    )
    if llm_signals is not None:
        state.signals = llm_signals
        signal_source = "LLM"
    else:
        state.signals = build_signals(
            state.recent_messages,
            state.observations,
            state.request.entry_mode,
            prior_state=state.prior_learner_unit_state,
        )
        signal_source = "rules"
        state.rationale.append("LLM signal extraction returned None, using rule-based signals.")

    state.learner_unit_state = estimate_learner_state(
        state.request.target_unit_id,
        state.signals,
        prior_state=state.prior_learner_unit_state,
    )

    review_decision = should_enter_review(
        understanding_level=state.learner_unit_state.understanding_level,
        confusion_level=state.learner_unit_state.confusion_level,
        memory_strength=state.learner_unit_state.memory_strength,
        next_review_at=state.prior_next_review_at,
    )

    llm_diag = llm_diagnose(
        llm,
        state.learner_unit_state,
        state.signals,
        state.request.entry_mode,
        state.request.target_unit_id,
        prior_state=state.prior_learner_unit_state,
        review_should=review_decision.should_review,
        review_priority=review_decision.priority,
        review_reason=review_decision.reason,
    )

    if llm_diag is not None:
        violations = validate_diagnosis(llm_diag, state.learner_unit_state)
        if violations:
            names = ", ".join(f"{v.rule_id}({v.rule_name})" for v in violations)
            state.rationale.append(
                f"LLM diagnosis rejected by guardrails: {names}. "
                "Applying guardrail corrections."
            )
            _apply_diagnosis_guardrail_corrections(llm_diag, state, violations)
        state.diagnosis = llm_diag
        diag_source = "LLM"
    else:
        raise RuntimeError(
            "LLM diagnosis returned None. The LLM is the core decision-maker "
            "and cannot be bypassed."
        )

    state.learner_unit_state.recommended_action = state.diagnosis.recommended_action

    state.rationale.append(
        f"diagnose selected {state.diagnosis.recommended_action} "
        f"for {state.diagnosis.primary_issue} "
        f"(signals={signal_source}, diagnosis={diag_source})."
    )
    return state


def _apply_diagnosis_guardrail_corrections(
    diag: Diagnosis, state: GraphState, violations: list
) -> None:
    """Correct a guardrail-violating LLM diagnosis in-place."""
    for v in violations:
        if v.rule_id == "G2":
            diag.recommended_action = "teach"
            diag.reason = f"Guardrail 修正：{v.violation} 切换到 teach。"
            diag.primary_issue = "insufficient-understanding"
        elif v.rule_id == "G3":
            diag.recommended_action = "clarify"
            diag.reason = f"Guardrail 修正：{v.violation} 切换到 clarify。"
            diag.primary_issue = "concept-confusion"


def decide_action_step(state: GraphState) -> GraphState:
    if state.diagnosis is None:
        return state

    state.tool_intent = choose_tool_intent(state.request.entry_mode, state.diagnosis)
    state.rationale.append(f"decide_action chose tool intent {state.tool_intent}.")
    return state


def maybe_tool_step(state: GraphState, repository: SQLiteRepository | None = None) -> GraphState:
    state.tool_result = resolve_tool_result(state.tool_intent, state.request, repository=repository)
    if state.tool_result is not None:
        state.rationale.append(f"maybe_tool loaded {state.tool_result.kind} context.")
    else:
        state.rationale.append("maybe_tool skipped because no extra context was required.")
    return state


def compose_response_step(state: GraphState, llm: "LLMClient") -> GraphState:
    if state.diagnosis is None or state.learner_unit_state is None:
        return state

    from xidea_agent.llm import generate_assistant_reply, llm_build_plan

    unit_title = state.learning_unit.title if state.learning_unit else state.request.topic
    candidate_modes = state.learning_unit.candidate_modes if state.learning_unit else []
    user_msg = state.request.messages[-1] if state.request.messages else state.request.topic

    llm_plan = llm_build_plan(
        llm,
        state.request.topic,
        unit_title,
        candidate_modes,
        state.diagnosis,
        state.learner_unit_state,
        user_msg,
    )
    if llm_plan is not None:
        state.plan = llm_plan
        plan_source = "LLM"
    else:
        state.plan = build_plan(
            state.request.topic,
            unit_title,
            candidate_modes,
            state.diagnosis,
            state.learner_unit_state,
        )
        plan_source = "template"
        state.rationale.append("LLM plan generation returned None, using template plan.")

    reply = generate_assistant_reply(
        llm, state.diagnosis, state.plan, state.learner_unit_state,
        user_msg, state.tool_result,
    )
    if reply is not None:
        state.assistant_message = reply
        reply_source = "LLM"
    else:
        state.assistant_message = compose_assistant_message(
            state.diagnosis, state.plan, state.tool_result
        )
        reply_source = "template"
        state.rationale.append("LLM reply generation returned None, using template reply.")

    state.rationale.append(
        f"compose_response built a {len(state.plan.steps)}-step plan "
        f"with mode {state.plan.selected_mode} (plan={plan_source}, reply={reply_source})."
    )
    return state


def _apply_guardrail_corrections(state: GraphState, violations: list) -> bool:
    """Apply corrections for guardrail violations. Returns True if any correction was made."""
    corrected = False
    for v in violations:
        if v.rule_id == "G2" and state.diagnosis is not None:
            state.diagnosis = Diagnosis(
                recommended_action="teach",
                reason=f"Guardrail 修正：{v.violation} 切换到 teach。",
                confidence=state.diagnosis.confidence,
                focus_unit_id=state.diagnosis.focus_unit_id,
                primary_issue="insufficient-understanding",
                needs_tool=state.diagnosis.needs_tool,
                explanation=state.diagnosis.explanation,
            )
            if state.learner_unit_state is not None:
                state.learner_unit_state.recommended_action = "teach"
            corrected = True
        elif v.rule_id == "G3" and state.diagnosis is not None:
            state.diagnosis = Diagnosis(
                recommended_action="clarify",
                reason=f"Guardrail 修正：{v.violation} 切换到 clarify。",
                confidence=state.diagnosis.confidence,
                focus_unit_id=state.diagnosis.focus_unit_id,
                primary_issue="concept-confusion",
                needs_tool=state.diagnosis.needs_tool,
                explanation=state.diagnosis.explanation,
            )
            if state.learner_unit_state is not None:
                state.learner_unit_state.recommended_action = "clarify"
            corrected = True
    return corrected


def writeback_step(state: GraphState) -> GraphState:
    if state.diagnosis is None or state.learner_unit_state is None or state.plan is None:
        return state

    state.state_patch = build_state_patch(state.diagnosis, state.learner_unit_state, state.plan)
    violations = get_violations(state)
    if violations:
        names = ", ".join(f"{item.rule_id}({item.rule_name})" for item in violations)
        state.rationale.append(f"Guardrail violations detected: {names}.")
        for item in violations:
            state.rationale.append(f"{item.rule_id}: {item.violation} -> {item.suggestion}")

        if _apply_guardrail_corrections(state, violations):
            state.state_patch = build_state_patch(state.diagnosis, state.learner_unit_state, state.plan)
            state.rationale.append("Guardrail corrections applied, state_patch rebuilt.")
    else:
        state.rationale.append("Guardrail checks passed.")
    return state


def run_agent_v0(
    request: AgentRequest,
    repository: SQLiteRepository | None = None,
    *,
    llm: "LLMClient",
) -> AgentRunResult:
    state = build_initial_graph_state(request)
    for step in (
        lambda current: load_context_step(current, repository=repository),
        lambda current: diagnose_step(current, llm=llm),
        decide_action_step,
        lambda current: maybe_tool_step(current, repository=repository),
        lambda current: compose_response_step(current, llm=llm),
        writeback_step,
    ):
        state = step(state)

    if state.assistant_message is None or state.diagnosis is None or state.plan is None or state.state_patch is None:
        raise RuntimeError("Agent v0 graph did not produce a complete response payload.")

    return AgentRunResult(
        graph_state=state,
        events=build_events(state.assistant_message, state.diagnosis, state.plan, state.state_patch),
    )
