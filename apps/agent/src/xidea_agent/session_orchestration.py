from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from xidea_agent.state import (
    AgentRequest,
    KnowledgePoint,
    KnowledgePointState,
    SessionOrchestration,
    SessionOrchestrationEventRecord,
    SessionOrchestrationStep,
)

if TYPE_CHECKING:
    from xidea_agent.repository import SQLiteRepository


def build_initial_session_orchestration(
    *,
    session_type: str,
    user_intent: str,
    knowledge_points: list[KnowledgePoint],
    knowledge_point_states: dict[str, KnowledgePointState | None],
    seed_knowledge_point_id: str | None,
    limit: int = 3,
) -> tuple[SessionOrchestration, SessionOrchestrationEventRecord]:
    selected_points = _select_candidate_pool(
        session_type=session_type,
        user_intent=user_intent,
        knowledge_points=knowledge_points,
        knowledge_point_states=knowledge_point_states,
        seed_knowledge_point_id=seed_knowledge_point_id,
        limit=limit,
    )
    if not selected_points:
        raise ValueError("Cannot build orchestration without eligible knowledge points.")

    first_point = selected_points[0]
    steps = [
        SessionOrchestrationStep(
            knowledge_point_id=point.id,
            title=point.title,
            reason=_build_step_reason(
                point=point,
                index=index,
                user_intent=user_intent,
                previous_point=selected_points[index - 1] if index > 0 else None,
            ),
            status="active" if index == 0 else "pending",
        )
        for index, point in enumerate(selected_points)
    ]

    summary = _build_plan_summary(selected_points)
    orchestration = SessionOrchestration(
        objective=_build_objective(user_intent, first_point.title),
        summary=summary,
        status="planned",
        candidate_pool_ids=[point.id for point in selected_points],
        current_focus_id=first_point.id,
        steps=steps,
        last_change_reason="首次编排已锁定当前小学习计划。",
    )
    event = SessionOrchestrationEventRecord(
        kind="plan_created",
        title="本轮学习计划",
        summary=summary,
        reason="系统结合 session 类型、首句意图和相邻知识点，先排出这一小轮的学习顺序。",
        visibility="timeline",
        created_at=datetime.now(UTC),
        plan_snapshot=orchestration,
    )
    return orchestration, event


def advance_session_orchestration(
    orchestration: SessionOrchestration,
) -> tuple[SessionOrchestration, SessionOrchestrationEventRecord]:
    if not orchestration.steps:
        raise ValueError("Cannot advance orchestration without steps.")

    current_index = next(
        (
            index
            for index, step in enumerate(orchestration.steps)
            if step.knowledge_point_id == orchestration.current_focus_id
        ),
        0,
    )

    next_steps: list[SessionOrchestrationStep] = []
    next_focus_id: str | None = None
    for index, step in enumerate(orchestration.steps):
        if index < current_index:
            next_steps.append(step.model_copy(update={"status": "completed"}))
            continue
        if index == current_index:
            next_steps.append(step.model_copy(update={"status": "completed"}))
            continue
        if next_focus_id is None:
            next_focus_id = step.knowledge_point_id
            next_steps.append(step.model_copy(update={"status": "active"}))
            continue
        next_steps.append(step)

    if next_focus_id is None:
        completed = orchestration.model_copy(
            update={
                "status": "completed",
                "current_focus_id": None,
                "steps": next_steps,
                "last_change_reason": "当前候选池已经完成，这轮 session 可以结束。",
            }
        )
        event = SessionOrchestrationEventRecord(
            kind="session_completed",
            title="本轮计划完成",
            summary=completed.summary,
            reason="当前候选池已经全部推进完成。",
            visibility="timeline",
            created_at=datetime.now(UTC),
            plan_snapshot=completed,
        )
        return completed, event

    next_focus_title = next(
        step.title for step in next_steps if step.knowledge_point_id == next_focus_id
    )
    updated = orchestration.model_copy(
        update={
            "status": "adjusted",
            "current_focus_id": next_focus_id,
            "steps": next_steps,
            "last_change_reason": f"上一张已完成，下一步切到「{next_focus_title}」。",
        }
    )
    event = SessionOrchestrationEventRecord(
        kind="plan_adjusted",
        title="计划已调整",
        summary=updated.summary,
        reason=f"上一张已完成，当前小学习计划继续推进到「{next_focus_title}」。",
        visibility="timeline",
        created_at=datetime.now(UTC),
        plan_snapshot=updated,
    )
    return updated, event


def prepare_session_orchestration(
    *,
    request: AgentRequest,
    repository: "SQLiteRepository" | None,
    existing_context: dict[str, object] | None,
) -> tuple[SessionOrchestration | None, list[SessionOrchestrationEventRecord], str | None]:
    if request.session_type not in {"study", "review"} or repository is None:
        return None, [], request.target_unit_id or request.knowledge_point_id

    existing_orchestration = _parse_orchestration(existing_context)
    existing_events = _parse_orchestration_events(existing_context)

    if existing_orchestration is not None:
        if request.activity_result is None:
            return (
                existing_orchestration,
                existing_events,
                existing_orchestration.current_focus_id,
            )

        next_orchestration, next_event = advance_session_orchestration(existing_orchestration)
        return (
            next_orchestration,
            [*existing_events, next_event][-12:],
            next_orchestration.current_focus_id,
        )

    knowledge_points = repository.list_project_knowledge_points(request.project_id)
    if not knowledge_points:
        return None, existing_events, request.target_unit_id or request.knowledge_point_id
    knowledge_point_states = {
        point.id: repository.get_knowledge_point_state(point.id)
        for point in knowledge_points
    }
    orchestration, event = build_initial_session_orchestration(
        session_type=request.session_type,
        user_intent=request.messages[-1].content if request.messages else "",
        knowledge_points=knowledge_points,
        knowledge_point_states=knowledge_point_states,
        seed_knowledge_point_id=request.target_unit_id or request.knowledge_point_id,
    )
    return orchestration, [event], orchestration.current_focus_id


def _select_candidate_pool(
    *,
    session_type: str,
    user_intent: str,
    knowledge_points: list[KnowledgePoint],
    knowledge_point_states: dict[str, KnowledgePointState | None],
    seed_knowledge_point_id: str | None,
    limit: int,
) -> list[KnowledgePoint]:
    eligible_points = [
        point
        for point in knowledge_points
        if _is_point_eligible(session_type, point, knowledge_point_states.get(point.id))
    ]
    if not eligible_points:
        eligible_points = [point for point in knowledge_points if point.status != "archived"]
    if not eligible_points:
        return []

    tokens = _extract_query_tokens(user_intent)
    seed_point = next(
        (point for point in eligible_points if point.id == seed_knowledge_point_id),
        None,
    )
    order_index = {point.id: index for index, point in enumerate(knowledge_points)}

    ranked = sorted(
        eligible_points,
        key=lambda point: (
            -_score_point(
                point=point,
                tokens=tokens,
                seed_point=seed_point,
                order_index=order_index,
            ),
            order_index.get(point.id, 999),
            point.id,
        ),
    )
    return ranked[: max(1, min(limit, 3))]


def _is_point_eligible(
    session_type: str,
    point: KnowledgePoint,
    state: KnowledgePointState | None,
) -> bool:
    if point.status == "archived":
        return False

    if session_type == "review":
        return state is not None and state.next_review_at is not None

    if session_type == "study":
        if state is None:
            return True
        return state.next_review_at is None and state.learning_status == "new" and state.mastery == 0

    return True


def _score_point(
    *,
    point: KnowledgePoint,
    tokens: set[str],
    seed_point: KnowledgePoint | None,
    order_index: dict[str, int],
) -> int:
    haystack = f"{point.title} {point.description}".lower()
    score = 0

    for token in tokens:
        if token in haystack:
            score += 6

    if seed_point is not None:
        if point.id == seed_point.id:
            score += 10
        if set(point.source_material_refs) & set(seed_point.source_material_refs):
            score += 4
        score += max(0, 3 - abs(order_index.get(point.id, 99) - order_index.get(seed_point.id, 99)))

    return score


def _extract_query_tokens(text: str) -> set[str]:
    ascii_tokens = {
        token.lower()
        for token in re.findall(r"[A-Za-z0-9_-]{3,}", text)
    }
    cjk_tokens = {
        token
        for token in re.findall(r"[\u4e00-\u9fff]{2,8}", text)
    }
    return ascii_tokens | cjk_tokens


def _build_objective(user_intent: str, first_title: str) -> str:
    normalized_intent = " ".join(user_intent.strip().split())
    if normalized_intent:
        return f"先围绕「{first_title}」回应你的启动意图：{normalized_intent}"
    return f"先围绕「{first_title}」建立这一轮的最小学习闭环。"


def _build_plan_summary(points: list[KnowledgePoint]) -> str:
    if len(points) == 1:
        return f"先把「{points[0].title}」压清楚，再结束这一小轮。"
    return " -> ".join(point.title for point in points)


def _build_step_reason(
    *,
    point: KnowledgePoint,
    index: int,
    user_intent: str,
    previous_point: KnowledgePoint | None,
) -> str:
    if index == 0:
        return (
            f"首句里已经点到「{point.title}」附近的问题，先从这里开始最稳。"
            if point.title[:4] in user_intent or point.title.lower() in user_intent.lower()
            else f"这轮先用「{point.title}」做起点，回应你刚才的启动意图。"
        )
    if previous_point is not None and set(point.source_material_refs) & set(previous_point.source_material_refs):
        return f"它和「{previous_point.title}」来自相近材料线索，适合连着推进。"
    return "作为这一小轮的相邻补位点，避免主题一下子跳散。"


def _parse_orchestration(
    thread_context: dict[str, object] | None,
) -> SessionOrchestration | None:
    if thread_context is None:
        return None
    payload = thread_context.get("session_orchestration")
    if not isinstance(payload, dict):
        return None
    return SessionOrchestration.model_validate(payload)


def _parse_orchestration_events(
    thread_context: dict[str, object] | None,
) -> list[SessionOrchestrationEventRecord]:
    if thread_context is None:
        return []
    payload = thread_context.get("orchestration_events")
    if not isinstance(payload, list):
        return []
    return [SessionOrchestrationEventRecord.model_validate(item) for item in payload if isinstance(item, dict)]
