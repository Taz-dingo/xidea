from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field


EntryMode = Literal["chat-question", "material-import", "coach-followup"]
ResponseMode = Literal["sync", "stream"]
MessageRole = Literal["system", "user", "assistant"]
ObservationKind = Literal[
    "user-message",
    "assistant-message",
    "source-asset",
    "exercise-result",
    "review-result",
    "project-note",
]
SignalKind = Literal[
    "concept-gap",
    "concept-confusion",
    "memory-weakness",
    "transfer-readiness",
    "review-pressure",
    "project-relevance",
]
PrimaryIssue = Literal[
    "insufficient-understanding",
    "concept-confusion",
    "weak-recall",
    "poor-transfer",
    "missing-context",
]
PedagogicalAction = Literal["teach", "clarify", "practice", "review", "apply"]
ToolIntent = Literal["none", "asset-summary", "unit-detail", "thread-memory", "review-context"]
LearningMode = Literal[
    "socratic",
    "guided-qa",
    "contrast-drill",
    "image-recall",
    "audio-recall",
    "scenario-sim",
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Message(StrictModel):
    role: MessageRole
    content: str = Field(min_length=1)


class SourceAsset(StrictModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    kind: Literal["pdf", "web", "note", "audio", "video", "image"]
    topic: str = Field(min_length=1)


class LearningUnit(StrictModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    weakness_tags: list[str] = Field(default_factory=list)
    candidate_modes: list[LearningMode] = Field(default_factory=list)
    difficulty: Literal[1, 2, 3, 4, 5] = 3


class Observation(StrictModel):
    observation_id: str = Field(min_length=1)
    kind: ObservationKind
    source: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    detail: dict[str, Any] = Field(default_factory=dict)
    captured_at: datetime | None = None


class Signal(StrictModel):
    kind: SignalKind
    score: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    summary: str = Field(min_length=1)
    based_on: list[str] = Field(default_factory=list)


class Explanation(StrictModel):
    summary: str = Field(min_length=1)
    evidence: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class LearnerUnitState(StrictModel):
    unit_id: str = Field(min_length=1)
    mastery: int = Field(ge=0, le=100)
    understanding_level: int = Field(ge=0, le=100)
    memory_strength: int = Field(ge=0, le=100)
    confusion_level: int = Field(ge=0, le=100)
    transfer_readiness: int = Field(ge=0, le=100)
    weak_signals: list[str] = Field(default_factory=list)
    recommended_action: PedagogicalAction | None = None
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    based_on: list[str] = Field(default_factory=list)
    updated_at: datetime | None = None


class Diagnosis(StrictModel):
    recommended_action: PedagogicalAction
    reason: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)
    focus_unit_id: str | None = None
    primary_issue: PrimaryIssue
    needs_tool: bool = False
    explanation: Explanation | None = None


class StudyPlanStep(StrictModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    mode: LearningMode
    reason: str = Field(min_length=1)
    outcome: str = Field(min_length=1)


class StudyPlan(StrictModel):
    headline: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    selected_mode: LearningMode
    expected_outcome: str = Field(min_length=1)
    steps: list[StudyPlanStep] = Field(min_length=1, max_length=3)


class LearnerStatePatch(StrictModel):
    mastery: int | None = Field(default=None, ge=0, le=100)
    understanding_level: int | None = Field(default=None, ge=0, le=100)
    memory_strength: int | None = Field(default=None, ge=0, le=100)
    confusion_level: int | None = Field(default=None, ge=0, le=100)
    transfer_readiness: int | None = Field(default=None, ge=0, le=100)
    weak_signals: list[str] | None = None
    recommended_action: PedagogicalAction | None = None
    last_reviewed_at: datetime | None = None
    next_review_at: datetime | None = None


class LastActionRecord(StrictModel):
    action: PedagogicalAction
    mode: LearningMode | None = None
    unit_id: str | None = None


class ReviewPatch(StrictModel):
    due_unit_ids: list[str] | None = None
    scheduled_at: datetime | None = None
    review_reason: str | None = None


class StatePatch(StrictModel):
    learner_state_patch: LearnerStatePatch | None = None
    last_action: LastActionRecord | None = None
    review_patch: ReviewPatch | None = None


class ToolResult(StrictModel):
    kind: ToolIntent
    payload: dict[str, Any]


class AgentRequest(StrictModel):
    project_id: str = Field(min_length=1)
    thread_id: str = Field(min_length=1)
    entry_mode: EntryMode
    topic: str = Field(min_length=1)
    messages: list[Message] = Field(min_length=1)
    source_asset_ids: list[str] = Field(default_factory=list)
    target_unit_id: str | None = None
    context_hint: str | None = None
    response_mode: ResponseMode = "stream"


class GraphState(StrictModel):
    request: AgentRequest
    observations: list[Observation] = Field(default_factory=list)
    source_assets: list[SourceAsset] = Field(default_factory=list)
    learning_unit: LearningUnit | None = None
    signals: list[Signal] = Field(default_factory=list)
    prior_learner_unit_state: LearnerUnitState | None = None
    learner_unit_state: LearnerUnitState | None = None
    diagnosis: Diagnosis | None = None
    tool_intent: ToolIntent = "none"
    tool_result: ToolResult | None = None
    plan: StudyPlan | None = None
    assistant_message: str | None = None
    state_patch: StatePatch | None = None
    recent_messages: list[Message] = Field(default_factory=list)
    rationale: list[str] = Field(default_factory=list)


class TextDeltaEvent(StrictModel):
    event: Literal["text-delta"]
    delta: str = Field(min_length=1)


class DiagnosisEvent(StrictModel):
    event: Literal["diagnosis"]
    diagnosis: Diagnosis


class PlanEvent(StrictModel):
    event: Literal["plan"]
    plan: StudyPlan


class StatePatchEvent(StrictModel):
    event: Literal["state-patch"]
    state_patch: StatePatch


class DoneEvent(StrictModel):
    event: Literal["done"]
    final_message: str | None = None


StreamEvent = Annotated[
    TextDeltaEvent | DiagnosisEvent | PlanEvent | StatePatchEvent | DoneEvent,
    Field(discriminator="event"),
]


class AgentRunResult(StrictModel):
    graph_state: GraphState
    events: list[StreamEvent] = Field(default_factory=list)


def build_initial_observations(request: AgentRequest) -> list[Observation]:
    observations: list[Observation] = []

    for index, message in enumerate(request.messages, start=1):
        kind: ObservationKind = (
            "user-message" if message.role == "user" else "assistant-message"
        )
        observations.append(
            Observation(
                observation_id=f"message-{index}",
                kind=kind,
                source="thread-message",
                summary=message.content,
                detail={"role": message.role},
            )
        )

    for index, asset_id in enumerate(request.source_asset_ids, start=1):
        observations.append(
            Observation(
                observation_id=f"asset-{index}",
                kind="source-asset",
                source="request-asset",
                summary=f"Selected source asset {asset_id}",
                detail={"assetId": asset_id},
            )
        )

    if request.context_hint:
        observations.append(
            Observation(
                observation_id="context-hint",
                kind="project-note",
                source="request-context",
                summary=request.context_hint,
            )
        )

    return observations


def build_initial_graph_state(request: AgentRequest) -> GraphState:
    observations = build_initial_observations(request)
    recent_messages = request.messages[-8:]

    return GraphState(
        request=request,
        observations=observations,
        recent_messages=recent_messages,
        rationale=[
            "v0 keeps observations, signals, and learner state separate.",
            "Explanation is downstream of state estimation, not the state source itself.",
        ],
    )
