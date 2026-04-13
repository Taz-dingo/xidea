from __future__ import annotations

from datetime import datetime, timedelta, timezone

from xidea_agent.guardrails import get_violations
from xidea_agent.repository import SQLiteRepository
from xidea_agent.review_engine import should_enter_review, schedule_next_review
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


def latest_user_message(messages: list[Message]) -> str:
    for message in reversed(messages):
        if message.role == "user":
            return message.content

    return messages[-1].content


def build_signals(messages: list[Message], observations: list[Observation], entry_mode: str) -> list[Signal]:
    message = latest_user_message(messages)
    lowered = message.lower()
    observation_ids = [item.observation_id for item in observations]

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
                score=0.82,
                confidence=0.86,
                summary="用户明确表达概念边界混淆，优先澄清区别而不是继续泛讲。",
                based_on=observation_ids[:1],
            )
        )

    if any(keyword in message for keyword in UNDERSTANDING_KEYWORDS):
        signals.append(
            Signal(
                kind="concept-gap",
                score=0.76,
                confidence=0.8,
                summary="用户当前更像在补理解框架，还没有形成稳定解释。",
                based_on=observation_ids[:1],
            )
        )

    if any(keyword in message for keyword in RECALL_KEYWORDS):
        signals.append(
            Signal(
                kind="memory-weakness",
                score=0.8,
                confidence=0.78,
                summary="用户显式提到复习或遗忘，当前存在记忆稳定性风险。",
                based_on=observation_ids[:1],
            )
        )

    if any(keyword in message for keyword in TRANSFER_KEYWORDS):
        signals.append(
            Signal(
                kind="transfer-readiness",
                score=0.42,
                confidence=0.72,
                summary="问题已经落到项目设计或答辩场景，需要验证是否会迁移应用。",
                based_on=observation_ids[:1],
            )
        )

    if any(keyword in lowered for keyword in PRACTICE_KEYWORDS):
        signals.append(
            Signal(
                kind="transfer-readiness",
                score=0.38,
                confidence=0.75,
                summary="用户有主动演练意图，适合进入练习或情境验证。",
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

    for signal in signals:
        if signal.kind == "concept-confusion":
            confusion += 38
            understanding -= 12
            mastery -= 8
            weak_signals.append("概念边界混淆")
        elif signal.kind == "concept-gap":
            understanding -= 24
            mastery -= 10
            weak_signals.append("理解框架不稳")
        elif signal.kind == "memory-weakness":
            memory_strength -= 28
            weak_signals.append("关键概念记忆不稳")
        elif signal.kind == "transfer-readiness":
            transfer_readiness -= 18
            mastery -= 6
            weak_signals.append("还不能稳定迁移到真实场景")

    return LearnerUnitState(
        unit_id=target_unit_id or "rag-core-unit",
        mastery=max(0, min(100, mastery)),
        understanding_level=max(0, min(100, understanding)),
        memory_strength=max(0, min(100, memory_strength)),
        confusion_level=max(0, min(100, confusion)),
        transfer_readiness=max(0, min(100, transfer_readiness)),
        weak_signals=list(dict.fromkeys(weak_signals)),
        confidence=0.74,
        based_on=[signal.summary for signal in signals],
        updated_at=datetime.now(UTC),
    )


def diagnose_state(entry_mode: str, target_unit_id: str | None, learner_state: LearnerUnitState) -> Diagnosis:
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
    )

    if learner_state.confusion_level >= 68:
        action: PedagogicalAction = "clarify"
        issue: PrimaryIssue = "concept-confusion"
        reason = "当前最大问题是概念边界混淆，先把区别拉清楚比继续讲知识点更重要。"
    elif review_decision.should_review:
        action = "review"
        issue = "weak-recall"
        reason = review_decision.reason
    elif learner_state.understanding_level <= 50:
        action = "teach"
        issue = "insufficient-understanding"
        reason = "用户还没有形成稳定理解框架，先补建模再安排练习更稳。"
    elif learner_state.transfer_readiness <= 44:
        action = "apply"
        issue = "poor-transfer"
        reason = "概念基础已基本具备，但还需要在项目场景里验证是否真的会用。"
    else:
        action = "practice"
        issue = "poor-transfer"
        reason = "当前适合通过练习把已有理解转成更稳定的应用能力。"

    return Diagnosis(
        recommended_action=action,
        reason=reason,
        confidence=learner_state.confidence,
        focus_unit_id=learner_state.unit_id,
        primary_issue=issue,
        needs_tool=needs_tool,
        explanation=build_explanation(learner_state, reason),
    )


def build_explanation(learner_state: LearnerUnitState, summary: str) -> Explanation:
    return Explanation(
        summary=summary,
        evidence=[
            f"understanding={learner_state.understanding_level}",
            f"memory={learner_state.memory_strength}",
            f"confusion={learner_state.confusion_level}",
            f"transfer={learner_state.transfer_readiness}",
        ],
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

    if state.request.source_asset_ids:
        state.source_assets = retrieve_source_assets(state.request.source_asset_ids)
        state.rationale.append(f"load_context attached {len(state.source_assets)} source assets.")

    state.learning_unit = retrieve_learning_unit(state.request.target_unit_id, state.request.topic)
    state.rationale.append(f"load_context selected learning unit {state.learning_unit.id}.")
    return state


def diagnose_step(state: GraphState) -> GraphState:
    state.signals = build_signals(state.recent_messages, state.observations, state.request.entry_mode)
    state.learner_unit_state = estimate_learner_state(
        state.request.target_unit_id,
        state.signals,
        prior_state=state.prior_learner_unit_state,
    )
    state.diagnosis = diagnose_state(
        state.request.entry_mode, state.request.target_unit_id, state.learner_unit_state
    )
    state.learner_unit_state.recommended_action = state.diagnosis.recommended_action
    state.rationale.append(
        f"diagnose selected {state.diagnosis.recommended_action} for {state.diagnosis.primary_issue}."
    )
    return state


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


def compose_response_step(state: GraphState) -> GraphState:
    if state.diagnosis is None or state.learner_unit_state is None:
        return state

    unit_title = state.learning_unit.title if state.learning_unit else state.request.topic
    candidate_modes = state.learning_unit.candidate_modes if state.learning_unit else []
    state.plan = build_plan(
        state.request.topic,
        unit_title,
        candidate_modes,
        state.diagnosis,
        state.learner_unit_state,
    )
    state.assistant_message = compose_assistant_message(
        state.diagnosis, state.plan, state.tool_result
    )
    state.rationale.append(
        f"compose_response built a {len(state.plan.steps)}-step plan with mode {state.plan.selected_mode}."
    )
    return state


def writeback_step(state: GraphState) -> GraphState:
    if state.diagnosis is None or state.learner_unit_state is None or state.plan is None:
        return state

    state.state_patch = build_state_patch(state.diagnosis, state.learner_unit_state, state.plan)
    violations = get_violations(state)
    if violations:
        names = ", ".join(f"{item.rule_id}({item.rule_name})" for item in violations)
        state.rationale.append(f"Guardrail checks failed: {names}.")
        for item in violations:
            state.rationale.append(f"{item.rule_id}: {item.violation} -> {item.suggestion}")
    else:
        state.rationale.append("Guardrail checks passed.")
    return state


def run_agent_v0(
    request: AgentRequest, repository: SQLiteRepository | None = None
) -> AgentRunResult:
    state = build_initial_graph_state(request)
    for step in (
        lambda current: load_context_step(current, repository=repository),
        diagnose_step,
        decide_action_step,
        lambda current: maybe_tool_step(current, repository=repository),
        compose_response_step,
        writeback_step,
    ):
        state = step(state)

    if state.assistant_message is None or state.diagnosis is None or state.plan is None or state.state_patch is None:
        raise RuntimeError("Agent v0 graph did not produce a complete response payload.")

    return AgentRunResult(
        graph_state=state,
        events=build_events(state.assistant_message, state.diagnosis, state.plan, state.state_patch),
    )
