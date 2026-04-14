from __future__ import annotations

from pydantic import BaseModel

from xidea_agent.state import GraphState


class GuardrailResult(BaseModel):
    rule_id: str
    rule_name: str
    passed: bool
    violation: str = ""
    suggestion: str = ""


def check_diagnosis_required(state: GraphState) -> GuardrailResult:
    if state.plan is not None and state.diagnosis is None:
        return GuardrailResult(
            rule_id="G1",
            rule_name="诊断优先",
            passed=False,
            violation="生成了学习计划，但当前轮还没有 diagnosis。",
            suggestion="先完成 diagnose 节点，再进入 decide_action / compose_response。",
        )

    return GuardrailResult(rule_id="G1", rule_name="诊断优先", passed=True)


def check_no_review_when_not_understood(state: GraphState) -> GuardrailResult:
    if state.learner_unit_state is None or state.diagnosis is None:
        return GuardrailResult(rule_id="G2", rule_name="不懂不复习", passed=True)

    if (
        state.learner_unit_state.understanding_level < 40
        and state.diagnosis.recommended_action == "review"
    ):
        return GuardrailResult(
            rule_id="G2",
            rule_name="不懂不复习",
            passed=False,
            violation=(
                f"understanding={state.learner_unit_state.understanding_level} < 40，"
                "但当前动作仍被判成了 review。"
            ),
            suggestion="先切到 teach 或 clarify，确认建立理解框架后再安排复习。",
        )

    return GuardrailResult(rule_id="G2", rule_name="不懂不复习", passed=True)


def check_clarify_when_confused(state: GraphState) -> GuardrailResult:
    if state.learner_unit_state is None or state.diagnosis is None or state.plan is None:
        return GuardrailResult(rule_id="G3", rule_name="高混淆先澄清", passed=True)

    if state.learner_unit_state.confusion_level < 70:
        return GuardrailResult(rule_id="G3", rule_name="高混淆先澄清", passed=True)

    has_clarify_step = any(step.mode == "contrast-drill" for step in state.plan.steps)
    if state.diagnosis.recommended_action == "clarify" and not has_clarify_step:
        return GuardrailResult(
            rule_id="G3",
            rule_name="高混淆先澄清",
            passed=False,
            violation="当前混淆风险很高，但计划里没有真正的澄清步骤。",
            suggestion="确保 clarify 动作包含 contrast-drill，避免只做泛问答。",
        )

    return GuardrailResult(rule_id="G3", rule_name="高混淆先澄清", passed=True)


def check_mode_in_candidates(state: GraphState) -> GuardrailResult:
    if state.learning_unit is None or state.plan is None:
        return GuardrailResult(rule_id="G4", rule_name="模式匹配", passed=True)

    candidates = set(state.learning_unit.candidate_modes)
    invalid = [step for step in state.plan.steps if step.mode not in candidates]
    if invalid:
        names = ", ".join(f"{step.id}({step.mode})" for step in invalid)
        return GuardrailResult(
            rule_id="G4",
            rule_name="模式匹配",
            passed=False,
            violation=f"以下步骤使用了学习单元不支持的训练模式: {names}",
            suggestion=f"当前 unit 的候选模式是: {sorted(candidates)}",
        )

    return GuardrailResult(rule_id="G4", rule_name="模式匹配", passed=True)


def check_reason_not_empty(state: GraphState) -> GuardrailResult:
    if state.plan is None:
        return GuardrailResult(rule_id="G5", rule_name="必须解释", passed=True)

    empty_steps = [step.id for step in state.plan.steps if not step.reason.strip()]
    if empty_steps:
        return GuardrailResult(
            rule_id="G5",
            rule_name="必须解释",
            passed=False,
            violation=f"以下步骤缺少 reason: {', '.join(empty_steps)}",
            suggestion="每个步骤都要说明为什么安排这个训练动作。",
        )

    return GuardrailResult(rule_id="G5", rule_name="必须解释", passed=True)


def validate_diagnosis(
    diagnosis: "Diagnosis",
    learner_state: "LearnerUnitState | None",
) -> list[GuardrailResult]:
    """Pre-validate a diagnosis before it enters the graph.

    Used to reject LLM diagnoses that violate hard constraints, triggering
    fallback to rule-based diagnosis.
    """
    from xidea_agent.state import Diagnosis, LearnerUnitState

    results: list[GuardrailResult] = []

    if learner_state is not None:
        if learner_state.understanding_level < 40 and diagnosis.recommended_action == "review":
            results.append(
                GuardrailResult(
                    rule_id="G2",
                    rule_name="不懂不复习",
                    passed=False,
                    violation=(
                        f"understanding={learner_state.understanding_level} < 40，"
                        "但 LLM 诊断仍选择了 review。"
                    ),
                    suggestion="应切到 teach 或 clarify。",
                )
            )

        if learner_state.confusion_level > 70 and diagnosis.recommended_action not in ("clarify", "teach"):
            results.append(
                GuardrailResult(
                    rule_id="G3",
                    rule_name="高混淆先澄清",
                    passed=False,
                    violation=(
                        f"confusion={learner_state.confusion_level} > 70，"
                        f"但 LLM 诊断选择了 {diagnosis.recommended_action}。"
                    ),
                    suggestion="应优先 clarify 或 teach。",
                )
            )

    return results


ALL_GUARDRAILS = [
    check_diagnosis_required,
    check_no_review_when_not_understood,
    check_clarify_when_confused,
    check_mode_in_candidates,
    check_reason_not_empty,
]


def run_all_guardrails(state: GraphState) -> list[GuardrailResult]:
    return [guardrail(state) for guardrail in ALL_GUARDRAILS]


def get_violations(state: GraphState) -> list[GuardrailResult]:
    return [result for result in run_all_guardrails(state) if not result.passed]
