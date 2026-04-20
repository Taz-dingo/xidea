from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from xidea_agent.repository import SQLiteRepository
from xidea_agent.state import KnowledgePoint, KnowledgePointState, KnowledgePointSuggestion


UTC = timezone.utc
UNSTABLE_LEARNING_STATUSES = {"new", "learning", "needs-review"}
STABLE_LEARNING_STATUSES = {"stable", "complete", "learned"}
STABLE_REVIEW_STATUSES = {"stable", "mastered"}


def build_consolidation_preview(
    project_id: str,
    repository: SQLiteRepository,
    *,
    now: datetime | None = None,
    limit: int = 5,
) -> dict[str, object] | None:
    current_time = now.astimezone(UTC) if now is not None else datetime.now(UTC)
    project_context = repository.get_project_context(project_id, "__consolidation__", recent_message_limit=0)
    project_memory = repository.get_project_memory(project_id)
    project_learning_profile = repository.get_project_learning_profile(project_id)
    knowledge_points = repository.list_project_knowledge_points(project_id)
    pending_suggestions = repository.list_knowledge_point_suggestions(project_id, statuses=["pending"])

    if not any(
        [
            project_context is not None,
            project_memory is not None,
            project_learning_profile is not None,
            knowledge_points,
            pending_suggestions,
        ]
    ):
        return None

    point_summaries: list[dict[str, Any]] = []
    due_for_review: list[dict[str, Any]] = []
    unstable_points: list[dict[str, Any]] = []
    stable_points: list[dict[str, Any]] = []

    for point in knowledge_points:
        point_state = repository.get_knowledge_point_state(point.id)
        summary = _build_knowledge_point_summary(point, point_state, current_time)
        point_summaries.append(summary)
        if summary["review_due"]:
            due_for_review.append(summary)
        if point.status == "active" and _is_unstable(summary):
            unstable_points.append(summary)
        if point.status == "active" and _is_stable(summary):
            stable_points.append(summary)

    due_for_review.sort(key=lambda item: item["next_review_at"] or "")
    unstable_points.sort(key=lambda item: (item["mastery"], item["title"]))
    stable_points.sort(key=lambda item: (-item["mastery"], item["title"]))

    create_suggestions = [item for item in pending_suggestions if item.kind == "create"]
    archive_suggestions = [item for item in pending_suggestions if item.kind == "archive"]

    return {
        "project_id": project_id,
        "project_topic": (
            project_context.get("project_topic")
            if isinstance(project_context, dict)
            else None
        ),
        "generated_at": current_time.isoformat(),
        "project_memory": (
            project_memory.model_dump(mode="json") if project_memory is not None else None
        ),
        "project_learning_profile": (
            project_learning_profile.model_dump(mode="json")
            if project_learning_profile is not None
            else None
        ),
        "knowledge_point_stats": {
            "total": len(knowledge_points),
            "active": sum(1 for point in knowledge_points if point.status == "active"),
            "archived": sum(1 for point in knowledge_points if point.status == "archived"),
            "due_for_review": len(due_for_review),
            "archive_suggested": sum(
                1 for item in point_summaries if item["archive_suggested"]
            ),
            "pending_create_suggestions": len(create_suggestions),
            "pending_archive_suggestions": len(archive_suggestions),
        },
        "due_for_review": due_for_review[:limit],
        "unstable_knowledge_points": unstable_points[:limit],
        "stable_knowledge_points": stable_points[:limit],
        "pending_suggestions": [
            _serialize_suggestion(suggestion) for suggestion in pending_suggestions[:limit]
        ],
        "recommended_actions": _build_recommended_actions(
            due_for_review=due_for_review,
            unstable_points=unstable_points,
            create_suggestions=create_suggestions,
            archive_suggestions=archive_suggestions,
            project_learning_profile=project_learning_profile,
            project_memory_present=project_memory is not None,
        ),
    }


def _build_knowledge_point_summary(
    point: KnowledgePoint,
    point_state: KnowledgePointState | None,
    current_time: datetime,
) -> dict[str, Any]:
    next_review_at = _coerce_datetime(point_state.next_review_at) if point_state is not None else None
    updated_at = _coerce_datetime(point_state.updated_at) if point_state is not None else None
    mastery = point_state.mastery if point_state is not None else 0
    learning_status = point_state.learning_status if point_state is not None else "unknown"
    review_status = point_state.review_status if point_state is not None else "unknown"
    archive_suggested = point_state.archive_suggested if point_state is not None else False

    return {
        "knowledge_point_id": point.id,
        "title": point.title,
        "status": point.status,
        "mastery": mastery,
        "learning_status": learning_status,
        "review_status": review_status,
        "next_review_at": next_review_at.isoformat() if next_review_at is not None else None,
        "updated_at": updated_at.isoformat() if updated_at is not None else None,
        "archive_suggested": archive_suggested,
        "review_due": (
            point.status == "active"
            and next_review_at is not None
            and next_review_at <= current_time
        ),
    }


def _serialize_suggestion(suggestion: KnowledgePointSuggestion) -> dict[str, Any]:
    return {
        "id": suggestion.id,
        "kind": suggestion.kind,
        "title": suggestion.title,
        "knowledge_point_id": suggestion.knowledge_point_id,
        "reason": suggestion.reason,
        "status": suggestion.status,
        "created_at": suggestion.created_at,
    }


def _build_recommended_actions(
    *,
    due_for_review: list[dict[str, Any]],
    unstable_points: list[dict[str, Any]],
    create_suggestions: list[KnowledgePointSuggestion],
    archive_suggestions: list[KnowledgePointSuggestion],
    project_learning_profile,
    project_memory_present: bool,
) -> list[str]:
    actions: list[str] = []

    if due_for_review:
        actions.append(
            f"优先开一个 review session，先处理 {len(due_for_review)} 个已到期知识点。"
        )
    if archive_suggestions:
        actions.append(
            f"先处理 {len(archive_suggestions)} 个 archive suggestion，避免 active 知识点池继续积噪。"
        )
    if create_suggestions:
        actions.append(
            f"确认或忽略 {len(create_suggestions)} 个新增知识点建议，把 project chat 里反复出现的边界问题沉淀下来。"
        )

    weaknesses = (
        project_learning_profile.primary_weaknesses
        if project_learning_profile is not None
        else []
    )
    if weaknesses:
        focus = "、".join(weaknesses[:2])
        actions.append(f"这轮 Consolidation 里优先保留「{focus}」相关弱点，作为下一轮编排重点。")

    if not actions and unstable_points:
        actions.append(
            f"下一轮更适合继续围绕「{unstable_points[0]['title']}」推进 study/project session，把不稳定点先压实。"
        )

    if not actions:
        if project_memory_present:
            actions.append("当前没有明显积压项，这轮 Consolidation 可以作为对外演示的 project 状态快照。")
        else:
            actions.append("当前还缺少足够的 project-level 沉淀，先继续跑一轮 project 或 study session。")

    return actions[:3]


def _is_stable(point_summary: dict[str, Any]) -> bool:
    return (
        point_summary["mastery"] >= 80
        and (
            point_summary["learning_status"].lower() in STABLE_LEARNING_STATUSES
            or point_summary["review_status"].lower() in STABLE_REVIEW_STATUSES
        )
    )


def _is_unstable(point_summary: dict[str, Any]) -> bool:
    return (
        point_summary["mastery"] < 70
        or point_summary["learning_status"].lower() in UNSTABLE_LEARNING_STATUSES
        or point_summary["review_due"]
    )


def _coerce_datetime(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(UTC) if value.tzinfo is not None else value.replace(tzinfo=UTC)
    return datetime.fromisoformat(value)
