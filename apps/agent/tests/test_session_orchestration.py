from datetime import datetime, timezone

from xidea_agent.state import KnowledgePoint, KnowledgePointState
from xidea_agent.session_orchestration import (
    advance_session_orchestration,
    build_initial_session_orchestration,
)


def _point(point_id: str, title: str, *, sources: list[str]) -> KnowledgePoint:
    now = datetime.now(timezone.utc)
    return KnowledgePoint(
        id=point_id,
        project_id="rag-demo",
        title=title,
        description=f"{title} 的说明。",
        status="active",
        origin_type="seed",
        source_material_refs=sources,
        created_at=now,
        updated_at=now,
    )


def _state(
    point_id: str,
    *,
    mastery: int = 0,
    learning_status: str = "new",
    next_review_at: datetime | None = None,
) -> KnowledgePointState:
    now = datetime.now(timezone.utc)
    return KnowledgePointState(
        knowledge_point_id=point_id,
        mastery=mastery,
        learning_status=learning_status,
        review_status="idle",
        next_review_at=next_review_at,
        archive_suggested=False,
        updated_at=now,
    )


def test_build_initial_session_orchestration_prefers_prompt_match_and_adjacent_theme() -> None:
    retrieval = _point("kp-retrieval", "retrieval 与召回覆盖", sources=["asset-rag"])
    reranking = _point("kp-reranking", "reranking 与精排判断", sources=["asset-rag"])
    chunking = _point("kp-chunking", "chunking 策略", sources=["asset-chunk"])

    orchestration, event = build_initial_session_orchestration(
        session_type="study",
        user_intent="先带我理清 reranking 和召回的边界",
        knowledge_points=[retrieval, reranking, chunking],
        knowledge_point_states={
            retrieval.id: _state(retrieval.id),
            reranking.id: _state(reranking.id),
            chunking.id: _state(chunking.id),
        },
        seed_knowledge_point_id=None,
    )

    assert orchestration.current_focus_id == "kp-reranking"
    assert orchestration.candidate_pool_ids == [
        "kp-reranking",
        "kp-retrieval",
        "kp-chunking",
    ]
    assert orchestration.steps[0].status == "active"
    assert event.kind == "plan_created"
    assert event.visibility == "timeline"


def test_build_initial_session_orchestration_filters_review_pool_to_due_points() -> None:
    now = datetime.now(timezone.utc)
    due_review = _point("kp-rerank-review", "reranking 复习", sources=["asset-rag"])
    stable_learning = _point("kp-learning", "向量召回基础", sources=["asset-rag"])

    orchestration, _event = build_initial_session_orchestration(
        session_type="review",
        user_intent="先带我复习最近快忘的部分",
        knowledge_points=[due_review, stable_learning],
        knowledge_point_states={
            due_review.id: _state(due_review.id, mastery=72, learning_status="learning", next_review_at=now),
            stable_learning.id: _state(stable_learning.id, mastery=68, learning_status="learning"),
        },
        seed_knowledge_point_id=None,
    )

    assert orchestration.candidate_pool_ids == ["kp-rerank-review"]
    assert orchestration.current_focus_id == "kp-rerank-review"


def test_advance_session_orchestration_moves_to_next_focus() -> None:
    retrieval = _point("kp-retrieval", "retrieval 与召回覆盖", sources=["asset-rag"])
    reranking = _point("kp-reranking", "reranking 与精排判断", sources=["asset-rag"])

    orchestration, _event = build_initial_session_orchestration(
        session_type="study",
        user_intent="先带我过一轮",
        knowledge_points=[retrieval, reranking],
        knowledge_point_states={
            retrieval.id: _state(retrieval.id),
            reranking.id: _state(reranking.id),
        },
        seed_knowledge_point_id="kp-retrieval",
    )

    next_orchestration, event = advance_session_orchestration(orchestration)

    assert next_orchestration.current_focus_id == "kp-reranking"
    assert [step.status for step in next_orchestration.steps] == ["completed", "active"]
    assert next_orchestration.status == "adjusted"
    assert event.kind == "plan_adjusted"
    assert "kp-reranking" in next_orchestration.candidate_pool_ids
