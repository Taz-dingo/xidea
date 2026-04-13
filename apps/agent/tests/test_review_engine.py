from datetime import datetime, timedelta, timezone

from xidea_agent.review_engine import (
    ReviewState,
    apply_outcome,
    compute_decay_risk,
    on_recall_failure,
    on_recall_success,
    schedule_next_review,
    should_enter_review,
)

UTC = timezone.utc
NOW = datetime(2026, 4, 13, 12, 0, 0, tzinfo=UTC)


def test_rule1_blocks_review_when_understanding_low() -> None:
    decision = should_enter_review(
        understanding_level=45,
        confusion_level=30,
        memory_strength=40,
        now=NOW,
    )
    assert decision.should_review is False
    assert decision.blocked_by == "rule-1-understanding-insufficient"


def test_rule2_blocks_review_when_confusion_high() -> None:
    decision = should_enter_review(
        understanding_level=75,
        confusion_level=80,
        memory_strength=40,
        now=NOW,
    )
    assert decision.should_review is False
    assert decision.blocked_by == "rule-2-confusion-too-high"


def test_rule3_allows_review_when_understanding_ok_memory_weak() -> None:
    decision = should_enter_review(
        understanding_level=65,
        confusion_level=30,
        memory_strength=50,
        now=NOW,
    )
    assert decision.should_review is True
    assert decision.priority > 0.0
    assert decision.blocked_by is None


def test_rule4_boosts_priority_when_overdue() -> None:
    past = NOW - timedelta(hours=48)
    decision = should_enter_review(
        understanding_level=70,
        confusion_level=20,
        memory_strength=66,
        next_review_at=past,
        now=NOW,
    )
    assert decision.should_review is True
    assert decision.priority >= 0.8


def test_stable_memory_no_review() -> None:
    decision = should_enter_review(
        understanding_level=80,
        confusion_level=20,
        memory_strength=85,
        now=NOW,
    )
    assert decision.should_review is False
    assert decision.blocked_by is None


def test_recall_success_increases_memory() -> None:
    state = ReviewState(unit_id="test-unit", memory_strength=50, review_count=1)
    outcome = on_recall_success(state, now=NOW)

    assert outcome.memory_strength_delta > 0
    assert outcome.review_count_delta == 1
    assert outcome.lapse_count_delta == 0
    assert outcome.new_next_review_at > NOW


def test_recall_failure_decreases_memory() -> None:
    state = ReviewState(unit_id="test-unit", memory_strength=50, lapse_count=0)
    outcome = on_recall_failure(state, now=NOW)

    assert outcome.memory_strength_delta < 0
    assert outcome.lapse_count_delta == 1
    assert outcome.new_next_review_at > NOW
    assert outcome.new_next_review_at <= NOW + timedelta(days=3)


def test_apply_outcome_clamps_memory() -> None:
    state = ReviewState(unit_id="test-unit", memory_strength=95, review_count=0)
    outcome = on_recall_success(state, now=NOW)
    new_state = apply_outcome(state, outcome)

    assert new_state.memory_strength <= 100
    assert new_state.review_count == 1


def test_apply_outcome_does_not_go_negative() -> None:
    state = ReviewState(unit_id="test-unit", memory_strength=5, lapse_count=5)
    outcome = on_recall_failure(state, now=NOW)
    new_state = apply_outcome(state, outcome)

    assert new_state.memory_strength >= 0
    assert new_state.lapse_count == 6


def test_decay_risk_levels() -> None:
    assert compute_decay_risk(25) == "critical"
    assert compute_decay_risk(40) == "high"
    assert compute_decay_risk(60) == "medium"
    assert compute_decay_risk(85) == "low"


def test_schedule_next_review_success_extends() -> None:
    next_time = schedule_next_review(review_count=0, recall_success=True, now=NOW)
    assert next_time > NOW

    next_time_2 = schedule_next_review(review_count=3, recall_success=True, now=NOW)
    assert next_time_2 > next_time


def test_schedule_next_review_failure_shortens() -> None:
    success_time = schedule_next_review(review_count=2, recall_success=True, now=NOW)
    failure_time = schedule_next_review(review_count=2, recall_success=False, now=NOW)
    assert failure_time < success_time


def test_successive_successes_extend_interval() -> None:
    state = ReviewState(unit_id="test-unit", memory_strength=50, review_count=0)
    intervals = []

    for _ in range(4):
        outcome = on_recall_success(state, now=NOW)
        intervals.append((outcome.new_next_review_at - NOW).days)
        state = apply_outcome(state, outcome)

    assert intervals == sorted(intervals), "Intervals should grow with successive successes"
