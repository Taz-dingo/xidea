from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from xidea_agent.review_engine import ReviewState, on_recall_failure, on_recall_success
from xidea_agent.state import (
    GraphState,
    KnowledgePointState,
    LearnerStatePatch,
    ProjectLearningProfile,
    ProjectMemory,
    ReviewPatch,
)


UTC = timezone.utc
_TRUE_STRINGS = {"true", "1", "yes", "y", "success", "pass", "passed", "correct"}
_FALSE_STRINGS = {"false", "0", "no", "n", "fail", "failed", "incorrect", "wrong"}


def apply_activity_result_writeback(state: GraphState) -> GraphState:
    result = state.request.activity_result
    if result is None or state.learner_unit_state is None or state.state_patch is None:
        return state

    now = datetime.now(UTC)
    if result.project_id != state.request.project_id or result.session_id != state.request.thread_id:
        state.rationale.append(
            "activity_result identifiers mismatched request envelope; writeback trusted request-level project/thread ids."
        )

    success = _resolve_result_success(result.result_type, result.action, result.answer, result.meta)
    if result.result_type == "review":
        _apply_review_result(state, success, now)
    else:
        _apply_exercise_result(state, success, now)

    knowledge_point_state = _build_knowledge_point_state(state, success, now)
    if knowledge_point_state is not None:
        state.knowledge_point_state_writebacks = [knowledge_point_state]

    state.project_learning_profile_writeback = _build_project_learning_profile(state, success, now)
    state.project_memory_writeback = _build_project_memory(state, success, now)
    state.rationale.append(
        f"activity_result writeback updated project-level state for {result.result_type}:{result.action}."
    )
    return state


def _apply_exercise_result(
    state: GraphState,
    success: bool | None,
    now: datetime,
) -> None:
    learner_state = state.learner_unit_state
    learner_patch = _ensure_learner_patch(state)
    prior_review = state.prior_review_state or ReviewPatch()

    if state.request.activity_result is None:
        return

    if state.request.activity_result.action == "skip":
        mastery_delta = -5
        understanding_delta = -3
        confusion_delta = 6
        transfer_delta = -4
        scheduled_at = now + timedelta(hours=12)
        review_reason = "本轮练习被跳过，先缩短间隔，避免知识点继续悬空。"
    elif success is True:
        mastery_delta = 12
        understanding_delta = 8
        confusion_delta = -10
        transfer_delta = 8
        scheduled_at = now + timedelta(days=2)
        review_reason = "练习表现稳定，已安排短间隔复盘，确认理解不会快速回落。"
    elif success is False:
        mastery_delta = -6
        understanding_delta = -5
        confusion_delta = 8
        transfer_delta = -4
        scheduled_at = now + timedelta(hours=16)
        review_reason = "练习结果暴露明显缺口，先把下次复盘间隔压短。"
    else:
        mastery_delta = 4
        understanding_delta = 2
        confusion_delta = -2
        transfer_delta = 3
        scheduled_at = now + timedelta(days=1)
        review_reason = "已收到练习作答，先安排一次短间隔回看，再结合下一轮判断继续校准。"

    learner_state.mastery = _clamp(learner_state.mastery + mastery_delta)
    learner_state.understanding_level = _clamp(learner_state.understanding_level + understanding_delta)
    learner_state.confusion_level = _clamp(learner_state.confusion_level + confusion_delta)
    learner_state.transfer_readiness = _clamp(learner_state.transfer_readiness + transfer_delta)
    learner_state.updated_at = now

    learner_patch.mastery = learner_state.mastery
    learner_patch.understanding_level = learner_state.understanding_level
    learner_patch.confusion_level = learner_state.confusion_level
    learner_patch.transfer_readiness = learner_state.transfer_readiness
    learner_patch.next_review_at = scheduled_at

    state.state_patch.review_patch = ReviewPatch(
        due_unit_ids=[learner_state.unit_id],
        scheduled_at=scheduled_at,
        review_reason=review_reason,
        review_count=prior_review.review_count or 0,
        lapse_count=prior_review.lapse_count or 0,
    )


def _apply_review_result(
    state: GraphState,
    success: bool | None,
    now: datetime,
) -> None:
    learner_state = state.learner_unit_state
    learner_patch = _ensure_learner_patch(state)
    prior_review = state.prior_review_state or ReviewPatch()
    review_count = prior_review.review_count or 0
    lapse_count = prior_review.lapse_count or 0

    if state.request.activity_result is None:
        return

    if state.request.activity_result.action == "skip":
        learner_state.memory_strength = _clamp(learner_state.memory_strength - 8)
        learner_state.mastery = _clamp(learner_state.mastery - 6)
        learner_state.confusion_level = _clamp(learner_state.confusion_level + 6)
        scheduled_at = now + timedelta(hours=8)
        learner_patch.last_reviewed_at = None
        learner_patch.next_review_at = scheduled_at
        learner_patch.memory_strength = learner_state.memory_strength
        learner_patch.mastery = learner_state.mastery
        learner_patch.confusion_level = learner_state.confusion_level
        learner_state.updated_at = now
        state.state_patch.review_patch = ReviewPatch(
            due_unit_ids=[learner_state.unit_id],
            scheduled_at=scheduled_at,
            review_reason="本轮复习被跳过，已缩短间隔并保留高优先级。",
            review_count=review_count,
            lapse_count=lapse_count + 1,
        )
        return

    review_state = ReviewState(
        unit_id=learner_state.unit_id,
        memory_strength=learner_state.memory_strength,
        next_review_at=prior_review.scheduled_at,
        review_count=review_count,
        lapse_count=lapse_count,
    )
    explicit_success = True if success is None else success
    outcome = (
        on_recall_success(review_state, now)
        if explicit_success
        else on_recall_failure(review_state, now)
    )

    learner_state.memory_strength = _clamp(
        learner_state.memory_strength + outcome.memory_strength_delta
    )
    learner_state.mastery = _clamp(
        learner_state.mastery + (10 if explicit_success else -8)
    )
    learner_state.confusion_level = _clamp(
        learner_state.confusion_level + (-6 if explicit_success else 8)
    )
    learner_state.updated_at = now

    learner_patch.memory_strength = learner_state.memory_strength
    learner_patch.mastery = learner_state.mastery
    learner_patch.confusion_level = learner_state.confusion_level
    learner_patch.last_reviewed_at = now
    learner_patch.next_review_at = outcome.new_next_review_at

    state.state_patch.review_patch = ReviewPatch(
        due_unit_ids=[learner_state.unit_id],
        scheduled_at=outcome.new_next_review_at,
        review_reason=outcome.reason,
        review_count=review_count + outcome.review_count_delta,
        lapse_count=lapse_count + outcome.lapse_count_delta,
    )


def _build_knowledge_point_state(
    state: GraphState,
    success: bool | None,
    now: datetime,
) -> KnowledgePointState | None:
    result = state.request.activity_result
    if result is None:
        return None

    prior = state.prior_knowledge_point_state
    base_mastery = prior.mastery if prior is not None else state.learner_unit_state.mastery
    next_review_at = (
        state.state_patch.review_patch.scheduled_at
        if state.state_patch is not None and state.state_patch.review_patch is not None
        else prior.next_review_at if prior is not None else None
    )

    if result.result_type == "review":
        mastery_delta = 8 if success is not False and result.action == "submit" else -10
        learning_status = "stable" if mastery_delta > 0 and base_mastery + mastery_delta >= 80 else (
            "reviewing" if mastery_delta > 0 else "needs-review"
        )
        review_status = "scheduled" if mastery_delta > 0 else "due"
    else:
        mastery_delta = 10 if success is True else -6 if success is False else 4
        learning_status = "practicing" if mastery_delta >= 0 else "needs-clarification"
        review_status = "scheduled" if next_review_at is not None else (
            prior.review_status if prior is not None else "idle"
        )

    return KnowledgePointState(
        knowledge_point_id=result.knowledge_point_id,
        mastery=_clamp(base_mastery + mastery_delta),
        learning_status=learning_status,
        review_status=review_status,
        next_review_at=next_review_at,
        archive_suggested=False,
        updated_at=now,
    )


def _build_project_learning_profile(
    state: GraphState,
    success: bool | None,
    now: datetime,
) -> ProjectLearningProfile:
    learner_state = state.learner_unit_state
    if learner_state is None:
        raise ValueError("learner_state is required to build project learning profile")

    weaknesses: list[str] = []
    if state.diagnosis is not None:
        weaknesses.append(state.diagnosis.primary_issue)
    if learner_state.confusion_level >= 60 and "concept-confusion" not in weaknesses:
        weaknesses.append("concept-confusion")
    if learner_state.memory_strength <= 55 and "weak-recall" not in weaknesses:
        weaknesses.append("weak-recall")
    if learner_state.transfer_readiness <= 55 and "poor-transfer" not in weaknesses:
        weaknesses.append("poor-transfer")

    preferences: list[str] = []
    if state.plan is not None:
        preferences.append(state.plan.selected_mode)
    if state.activity is not None and state.activity.kind not in preferences:
        preferences.append(state.activity.kind)

    current_stage = _infer_stage(state, success)
    freshness = "fresh" if state.request.activity_result is not None else "stale"
    return ProjectLearningProfile(
        project_id=state.request.project_id,
        current_stage=current_stage,
        primary_weaknesses=weaknesses[:3],
        learning_preferences=preferences[:3],
        freshness=freshness,
        updated_at=now,
    )


def _build_project_memory(
    state: GraphState,
    success: bool | None,
    now: datetime,
) -> ProjectMemory:
    result = state.request.activity_result
    if result is None:
        raise ValueError("activity_result is required to build project memory")

    focus_label = _resolve_focus_label(state, result.knowledge_point_id)
    status_label = _describe_result_outcome(result.result_type, result.action, success)
    parts = [f"最近一次 {result.result_type} 结果：围绕「{focus_label}」{status_label}"]

    review_patch = state.state_patch.review_patch if state.state_patch is not None else None
    if review_patch is not None and review_patch.scheduled_at is not None:
        parts.append(f"下次复习已安排在 {review_patch.scheduled_at.isoformat()}")
    if state.diagnosis is not None:
        parts.append(f"当前主要问题仍是 {state.diagnosis.primary_issue}")

    return ProjectMemory(
        project_id=state.request.project_id,
        summary="；".join(parts) + "。",
        updated_at=now,
    )


def _ensure_learner_patch(state: GraphState) -> LearnerStatePatch:
    if state.state_patch is None:
        raise ValueError("state_patch must exist before activity result writeback")
    if state.state_patch.learner_state_patch is None:
        state.state_patch.learner_state_patch = LearnerStatePatch()
    return state.state_patch.learner_state_patch


def _resolve_result_success(
    result_type: str,
    action: str,
    answer: str | None,
    meta: dict[str, Any],
) -> bool | None:
    if action == "skip":
        return False

    for key in ("correct", "is_correct", "passed", "success", "recall_success"):
        if key in meta:
            coerced = _coerce_bool(meta[key])
            if coerced is not None:
                return coerced

    for key in ("score", "normalized_score"):
        value = meta.get(key)
        if isinstance(value, (int, float)):
            return value >= 0.6

    for key in ("verdict", "outcome", "result"):
        coerced = _coerce_bool(meta.get(key))
        if coerced is not None:
            return coerced

    if result_type == "review" and (answer or "").strip():
        return True
    if (answer or "").strip():
        return None
    return False


def _coerce_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in _TRUE_STRINGS:
            return True
        if lowered in _FALSE_STRINGS:
            return False
    return None


def _infer_stage(state: GraphState, success: bool | None) -> str:
    learner_state = state.learner_unit_state
    result = state.request.activity_result
    if learner_state is None or result is None:
        return "active"
    if result.result_type == "review":
        return "stabilizing" if success is not False and result.action == "submit" else "reviewing"
    if learner_state.understanding_level < 60:
        return "building-understanding"
    if learner_state.transfer_readiness >= 70:
        return "applying"
    return "practicing"


def _resolve_focus_label(state: GraphState, knowledge_point_id: str) -> str:
    if state.activity is not None and state.activity.knowledge_point_id == knowledge_point_id:
        return state.activity.title
    if state.project_context is not None and state.project_context.focus_unit_title is not None:
        return state.project_context.focus_unit_title
    return knowledge_point_id


def _describe_result_outcome(
    result_type: str,
    action: str,
    success: bool | None,
) -> str:
    if action == "skip":
        return "跳过了当前动作，系统已缩短下一次跟进间隔"
    if success is True:
        return "完成了当前动作，状态进入更稳定区间"
    if success is False:
        return "提交了当前动作，但结果暴露出明显缺口"
    if result_type == "exercise":
        return "提交了当前动作，系统会继续结合下一轮判断校准状态"
    return "完成了当前动作，系统会继续观察记忆稳定性"


def _clamp(value: int) -> int:
    return max(0, min(100, value))
