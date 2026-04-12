"""Agent 行为约束规则（Guardrails）。

每条 guardrail 是一个纯函数，接收 GraphState 返回检查结果。
在 graph 的关键节点后执行，防止 agent 做出不合理的教学决策。
"""

from __future__ import annotations

from pydantic import BaseModel

from xidea_agent.state import GraphState, LearningMode, TrainingAction


class GuardrailResult(BaseModel):
    rule_id: str
    rule_name: str
    passed: bool
    violation: str = ""
    suggestion: str = ""


# ---------------------------------------------------------------------------
# G1: 诊断优先 — 必须先完成诊断，才能选择训练动作
# ---------------------------------------------------------------------------


def check_diagnosis_required(state: GraphState) -> GuardrailResult:
    if state.plan is not None and state.learner_state is None:
        return GuardrailResult(
            rule_id="G1",
            rule_name="诊断优先",
            passed=False,
            violation="生成了学习计划但未完成学习者诊断",
            suggestion="在 select_training_mode 之前必须先运行 diagnose_learner",
        )
    return GuardrailResult(rule_id="G1", rule_name="诊断优先", passed=True)


# ---------------------------------------------------------------------------
# G2: 不懂不复习 — understanding_level < 40 时禁止 REVIEW
# ---------------------------------------------------------------------------

_UNDERSTANDING_THRESHOLD = 40


def check_no_review_when_not_understood(state: GraphState) -> GuardrailResult:
    if state.learner_state is None or state.plan is None:
        return GuardrailResult(rule_id="G2", rule_name="不懂不复习", passed=True)

    if state.learner_state.understanding_level < _UNDERSTANDING_THRESHOLD:
        has_review = any(
            step.mode in (LearningMode.AUDIO_RECALL, LearningMode.IMAGE_RECALL)
            for step in state.plan.steps
        ) or state.learner_state.recommended_action == TrainingAction.REVIEW
        if has_review:
            return GuardrailResult(
                rule_id="G2",
                rule_name="不懂不复习",
                passed=False,
                violation=(
                    f"understanding_level={state.learner_state.understanding_level} "
                    f"< {_UNDERSTANDING_THRESHOLD}，但计划中包含了复习类动作"
                ),
                suggestion="先安排 TEACH 或 CLARIFY，确认用户理解后再进入复习",
            )
    return GuardrailResult(rule_id="G2", rule_name="不懂不复习", passed=True)


# ---------------------------------------------------------------------------
# G3: 高混淆先澄清 — confusion >= 70 时必须包含澄清类步骤
# ---------------------------------------------------------------------------

_CONFUSION_THRESHOLD = 70


def check_clarify_when_confused(state: GraphState) -> GuardrailResult:
    if state.learner_state is None or state.plan is None:
        return GuardrailResult(rule_id="G3", rule_name="高混淆先澄清", passed=True)

    if state.learner_state.confusion >= _CONFUSION_THRESHOLD:
        has_clarify = any(
            step.mode == LearningMode.CONTRAST_DRILL for step in state.plan.steps
        ) or state.learner_state.recommended_action == TrainingAction.CLARIFY
        if not has_clarify:
            return GuardrailResult(
                rule_id="G3",
                rule_name="高混淆先澄清",
                passed=False,
                violation=(
                    f"confusion={state.learner_state.confusion} "
                    f">= {_CONFUSION_THRESHOLD}，但计划中缺少澄清类步骤"
                ),
                suggestion="增加 contrast-drill 或将 recommended_action 设为 CLARIFY",
            )
    return GuardrailResult(rule_id="G3", rule_name="高混淆先澄清", passed=True)


# ---------------------------------------------------------------------------
# G4: 模式匹配 — 选择的 mode 必须在 unit.candidate_modes 内
# ---------------------------------------------------------------------------


def check_mode_in_candidates(state: GraphState) -> GuardrailResult:
    if state.unit is None or state.plan is None:
        return GuardrailResult(rule_id="G4", rule_name="模式匹配", passed=True)

    candidates = set(state.unit.candidate_modes)
    invalid = [
        step for step in state.plan.steps if step.mode not in candidates
    ]
    if invalid:
        names = ", ".join(f"{s.id}({s.mode.value})" for s in invalid)
        return GuardrailResult(
            rule_id="G4",
            rule_name="模式匹配",
            passed=False,
            violation=f"以下步骤使用了学习单元不支持的模式: {names}",
            suggestion=f"可选模式: {[m.value for m in state.unit.candidate_modes]}",
        )
    return GuardrailResult(rule_id="G4", rule_name="模式匹配", passed=True)


# ---------------------------------------------------------------------------
# G5: 必须解释 — 每个 step 必须有非空 reason
# ---------------------------------------------------------------------------


def check_reason_not_empty(state: GraphState) -> GuardrailResult:
    if state.plan is None:
        return GuardrailResult(rule_id="G5", rule_name="必须解释", passed=True)

    empty = [step for step in state.plan.steps if not step.reason.strip()]
    if empty:
        ids = ", ".join(s.id for s in empty)
        return GuardrailResult(
            rule_id="G5",
            rule_name="必须解释",
            passed=False,
            violation=f"以下步骤缺少 reason: {ids}",
            suggestion="每个步骤必须说明为什么安排这个训练动作",
        )
    return GuardrailResult(rule_id="G5", rule_name="必须解释", passed=True)


# ---------------------------------------------------------------------------
# 统一入口
# ---------------------------------------------------------------------------

ALL_GUARDRAILS = [
    check_diagnosis_required,
    check_no_review_when_not_understood,
    check_clarify_when_confused,
    check_mode_in_candidates,
    check_reason_not_empty,
]


def run_all_guardrails(state: GraphState) -> list[GuardrailResult]:
    """执行所有 guardrail 检查，返回结果列表。"""
    return [g(state) for g in ALL_GUARDRAILS]


def get_violations(state: GraphState) -> list[GuardrailResult]:
    """只返回未通过的 guardrail。"""
    return [r for r in run_all_guardrails(state) if not r.passed]
