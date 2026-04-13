"""Review Engine v0 — 独立启发式复习调度层。

职责：决定"什么时候复习"，与 LangGraph 编排层协同但不互相替代。
第一版采用 6 条启发式规则，不实现完整 SRS / FSRS 算法。
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel, Field

UTC = timezone.utc

DecayRisk = Literal["low", "medium", "high", "critical"]

BASE_INTERVAL_DAYS = 1
MAX_INTERVAL_DAYS = 30
INTERVAL_MULTIPLIER = 1.8
LAPSE_SHRINK_FACTOR = 0.5


class ReviewState(BaseModel):
    """单个 unit 的完整复习状态。"""

    unit_id: str
    memory_strength: int = Field(ge=0, le=100, default=60)
    last_reviewed_at: datetime | None = None
    next_review_at: datetime | None = None
    review_count: int = Field(ge=0, default=0)
    lapse_count: int = Field(ge=0, default=0)


class ReviewDecision(BaseModel):
    """Review Engine 的决策输出。"""

    should_review: bool
    priority: float = Field(ge=0.0, le=1.0, default=0.0)
    reason: str
    blocked_by: str | None = None


class ReviewOutcome(BaseModel):
    """一次复习后的状态变更。"""

    memory_strength_delta: int
    new_next_review_at: datetime
    review_count_delta: int = 1
    lapse_count_delta: int = 0
    reason: str


def should_enter_review(
    understanding_level: int,
    confusion_level: int,
    memory_strength: int,
    next_review_at: datetime | None = None,
    now: datetime | None = None,
) -> ReviewDecision:
    """应用规则 1-4 判断是否可以进入复习。"""
    now = now or datetime.now(UTC)

    # 规则 1: understanding < 60 → 不复习
    if understanding_level < 60:
        return ReviewDecision(
            should_review=False,
            priority=0.0,
            reason="理解水平不足，先补理解框架再考虑复习。",
            blocked_by="rule-1-understanding-insufficient",
        )

    # 规则 2: confusion > 70 → 不复习
    if confusion_level > 70:
        return ReviewDecision(
            should_review=False,
            priority=0.0,
            reason="混淆度过高，先澄清概念边界再进入复习。",
            blocked_by="rule-2-confusion-too-high",
        )

    # 规则 3: understanding >= 60 且 memory < 65 → 可以复习
    if memory_strength < 65:
        priority = _compute_priority(memory_strength, next_review_at, now)
        return ReviewDecision(
            should_review=True,
            priority=priority,
            reason="理解已基本建立但记忆强度不足，适合安排针对性复习。",
        )

    # 规则 4: nextReviewAt <= now → 提高复习优先级
    if next_review_at is not None and next_review_at <= now:
        return ReviewDecision(
            should_review=True,
            priority=0.85,
            reason="已到达计划复习时间，建议优先安排复习。",
        )

    return ReviewDecision(
        should_review=False,
        priority=0.0,
        reason="当前记忆状态稳定，暂不需要复习。",
    )


def on_recall_success(
    review_state: ReviewState,
    now: datetime | None = None,
) -> ReviewOutcome:
    """规则 5: 回忆成功 → 记忆上升、间隔拉长。"""
    now = now or datetime.now(UTC)
    strength_delta = _success_strength_gain(review_state.review_count)
    next_interval = _next_interval_after_success(review_state.review_count)

    return ReviewOutcome(
        memory_strength_delta=strength_delta,
        new_next_review_at=now + next_interval,
        review_count_delta=1,
        lapse_count_delta=0,
        reason=f"回忆成功，记忆强度 +{strength_delta}，下次复习间隔 {next_interval.days} 天。",
    )


def on_recall_failure(
    review_state: ReviewState,
    now: datetime | None = None,
) -> ReviewOutcome:
    """规则 6: 回忆失败 → 记忆下降、间隔缩短。"""
    now = now or datetime.now(UTC)
    strength_delta = _failure_strength_loss(review_state.lapse_count)
    next_interval = _next_interval_after_failure(review_state.review_count)

    return ReviewOutcome(
        memory_strength_delta=-strength_delta,
        new_next_review_at=now + next_interval,
        review_count_delta=1,
        lapse_count_delta=1,
        reason=f"回忆失败，记忆强度 -{strength_delta}，缩短复习间隔至 {next_interval.days} 天。",
    )


def apply_outcome(review_state: ReviewState, outcome: ReviewOutcome) -> ReviewState:
    """将 ReviewOutcome 应用到 ReviewState 上，返回新状态。"""
    new_memory = max(0, min(100, review_state.memory_strength + outcome.memory_strength_delta))
    return ReviewState(
        unit_id=review_state.unit_id,
        memory_strength=new_memory,
        last_reviewed_at=outcome.new_next_review_at - (
            outcome.new_next_review_at - (review_state.last_reviewed_at or outcome.new_next_review_at)
        ),
        next_review_at=outcome.new_next_review_at,
        review_count=review_state.review_count + outcome.review_count_delta,
        lapse_count=review_state.lapse_count + outcome.lapse_count_delta,
    )


def compute_decay_risk(memory_strength: int) -> DecayRisk:
    """基于记忆强度计算衰减风险等级。"""
    if memory_strength <= 30:
        return "critical"
    if memory_strength <= 50:
        return "high"
    if memory_strength <= 70:
        return "medium"
    return "low"


def schedule_next_review(
    review_count: int,
    recall_success: bool,
    now: datetime | None = None,
) -> datetime:
    """基于启发式规则计算下次复习时间。"""
    now = now or datetime.now(UTC)
    if recall_success:
        return now + _next_interval_after_success(review_count)
    return now + _next_interval_after_failure(review_count)


def _compute_priority(
    memory_strength: int,
    next_review_at: datetime | None,
    now: datetime,
) -> float:
    base = max(0.0, (65 - memory_strength) / 65.0)

    overdue_bonus = 0.0
    if next_review_at is not None and next_review_at <= now:
        hours_overdue = (now - next_review_at).total_seconds() / 3600
        overdue_bonus = min(0.3, hours_overdue / 72.0)

    return min(1.0, base + overdue_bonus)


def _success_strength_gain(review_count: int) -> int:
    if review_count <= 1:
        return 15
    if review_count <= 3:
        return 10
    return 6


def _failure_strength_loss(lapse_count: int) -> int:
    if lapse_count <= 1:
        return 12
    if lapse_count <= 3:
        return 18
    return 22


def _next_interval_after_success(review_count: int) -> timedelta:
    days = min(MAX_INTERVAL_DAYS, BASE_INTERVAL_DAYS * (INTERVAL_MULTIPLIER ** review_count))
    return timedelta(days=max(1, int(days)))


def _next_interval_after_failure(review_count: int) -> timedelta:
    days = max(1, int(BASE_INTERVAL_DAYS * (INTERVAL_MULTIPLIER ** review_count) * LAPSE_SHRINK_FACTOR))
    return timedelta(days=min(days, 3))
