from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field


EntryMode = Literal["chat-question", "material-import", "coach-followup"]
ResponseMode = Literal["sync", "stream"]
SessionType = Literal["project", "study", "review"]
MessageRole = Literal["system", "user", "assistant"]
ActivityKind = Literal["quiz", "recall", "coach-followup"]
ActivityResultType = Literal["exercise", "review"]
ActivityResultAction = Literal["submit", "skip"]
ProjectStatus = Literal["active", "archived"]
SessionType = Literal["project", "study", "review"]
SessionStatus = Literal["active", "closed"]
ProjectMaterialKind = Literal["pdf", "web", "note", "audio", "video", "image"]
ProjectMaterialStatus = Literal["active", "archived"]
KnowledgePointStatus = Literal["active", "archived"]
KnowledgePointSuggestionKind = Literal["create", "archive"]
KnowledgePointSuggestionStatus = Literal["pending", "accepted", "dismissed"]
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
    "off-topic",
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
StatusPhase = Literal[
    "loading-context",
    "making-decision",
    "retrieving-context",
    "composing-response",
    "preparing-followup",
    "writing-state",
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Message(StrictModel):
    role: MessageRole
    content: str = Field(min_length=1)


class SourceAsset(StrictModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    kind: ProjectMaterialKind
    topic: str = Field(min_length=1)
    summary: str | None = None
    source_uri: str | None = None
    content_ref: str | None = None
    status: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class Project(StrictModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    topic: str = Field(min_length=1)
    description: str = Field(min_length=1)
    special_rules: list[str] = Field(default_factory=list)
    status: ProjectStatus = "active"
    created_at: datetime | None = None
    updated_at: datetime | None = None


class Session(StrictModel):
    id: str = Field(min_length=1)
    project_id: str = Field(min_length=1)
    type: SessionType
    title: str = Field(min_length=1)
    status: SessionStatus = "active"
    focus_knowledge_point_ids: list[str] = Field(default_factory=list)
    current_activity_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProjectMaterial(StrictModel):
    id: str = Field(min_length=1)
    project_id: str = Field(min_length=1)
    kind: ProjectMaterialKind
    title: str = Field(min_length=1)
    source_uri: str | None = None
    content_ref: str | None = None
    summary: str | None = None
    status: ProjectMaterialStatus = "active"
    created_at: datetime | None = None
    updated_at: datetime | None = None


class SessionAttachment(StrictModel):
    id: str = Field(min_length=1)
    session_id: str = Field(min_length=1)
    project_material_id: str = Field(min_length=1)
    role: str = Field(min_length=1)
    attached_at: datetime | None = None


class SessionOrchestrationStep(StrictModel):
    knowledge_point_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    reason: str = Field(min_length=1)
    status: Literal["pending", "active", "completed"]


class SessionOrchestration(StrictModel):
    objective: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    status: Literal["planned", "adjusted", "completed"]
    candidate_pool_ids: list[str] = Field(min_length=1, max_length=3)
    current_focus_id: str | None = None
    steps: list[SessionOrchestrationStep] = Field(min_length=1, max_length=3)
    last_change_reason: str | None = None


class SessionOrchestrationEventRecord(StrictModel):
    kind: Literal["plan_created", "plan_adjusted", "plan_step_completed", "session_completed"]
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    reason: str | None = None
    visibility: Literal["silent", "sidebar_only", "timeline"] = "timeline"
    created_at: datetime | None = None
    plan_snapshot: SessionOrchestration


class ThreadContextRecord(StrictModel):
    thread_id: str = Field(min_length=1)
    entry_mode: EntryMode
    source_asset_ids: list[str] = Field(default_factory=list)
    session_orchestration: SessionOrchestration | None = None
    orchestration_events: list[SessionOrchestrationEventRecord] = Field(default_factory=list)
    updated_at: datetime | None = None


class ProjectMaterialInput(StrictModel):
    id: str | None = None
    kind: ProjectMaterialKind
    title: str = Field(min_length=1)
    source_uri: str | None = None
    content_ref: str | None = None
    summary: str | None = None


class LearningUnit(StrictModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    weakness_tags: list[str] = Field(default_factory=list)
    candidate_modes: list[LearningMode] = Field(default_factory=list)
    difficulty: Literal[1, 2, 3, 4, 5] = 3


class ProjectContext(StrictModel):
    project_id: str = Field(min_length=1)
    topic: str = Field(min_length=1)
    focus_unit_id: str | None = None
    focus_unit_title: str | None = None
    source_asset_ids: list[str] = Field(default_factory=list)
    source_asset_summary: str | None = None
    thread_memory_summary: str | None = None
    review_summary: str | None = None
    project_memory_summary: str | None = None
    project_learning_profile_summary: str | None = None
    recent_messages: list[Message] = Field(default_factory=list)
    source: Literal["repository", "request"]
    summary: str = Field(min_length=1)


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


class ActivityChoice(StrictModel):
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    detail: str = Field(min_length=1)
    is_correct: bool = False
    feedback_layers: list[str] = Field(default_factory=list)
    analysis: str | None = None


class ActivityChoiceInput(StrictModel):
    type: Literal["choice"]
    choices: list[ActivityChoice] = Field(min_length=1)


class ActivityTextInput(StrictModel):
    type: Literal["text"]
    placeholder: str = Field(min_length=1)
    min_length: int = Field(ge=1)


ActivityInput = Annotated[
    ActivityChoiceInput | ActivityTextInput,
    Field(discriminator="type"),
]


class Activity(StrictModel):
    id: str = Field(min_length=1)
    kind: ActivityKind
    knowledge_point_id: str | None = None
    title: str = Field(min_length=1)
    objective: str = Field(min_length=1)
    prompt: str = Field(min_length=1)
    support: str = Field(min_length=1)
    mode: LearningMode | None = None
    evidence: list[str] = Field(default_factory=list)
    submit_label: str = Field(min_length=1)
    input: ActivityInput


class KnowledgePoint(StrictModel):
    id: str = Field(min_length=1)
    project_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    status: KnowledgePointStatus
    origin_type: str = Field(min_length=1)
    origin_session_id: str | None = None
    source_material_refs: list[str] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class KnowledgePointState(StrictModel):
    knowledge_point_id: str = Field(min_length=1)
    mastery: int = Field(default=0, ge=0, le=100)
    learning_status: str = Field(default="new", min_length=1)
    review_status: str = Field(default="idle", min_length=1)
    next_review_at: datetime | None = None
    archive_suggested: bool = False
    updated_at: datetime | None = None


class KnowledgePointRecord(StrictModel):
    knowledge_point: KnowledgePoint
    knowledge_point_state: KnowledgePointState | None = None


class KnowledgePointSuggestion(StrictModel):
    id: str = Field(min_length=1)
    kind: KnowledgePointSuggestionKind
    project_id: str = Field(min_length=1)
    session_id: str = Field(min_length=1)
    origin_message_id: int | None = None
    knowledge_point_id: str | None = None
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    reason: str = Field(min_length=1)
    source_material_refs: list[str] = Field(default_factory=list)
    status: KnowledgePointSuggestionStatus = "pending"
    created_at: datetime | None = None
    resolved_at: datetime | None = None
    updated_at: datetime | None = None


class KnowledgePointSuggestionResolution(StrictModel):
    suggestion: KnowledgePointSuggestion
    knowledge_point: KnowledgePoint | None = None
    knowledge_point_state: KnowledgePointState | None = None
    linked_session_message_ids: dict[str, int] = Field(default_factory=dict)


class ProjectMemory(StrictModel):
    id: str | None = None
    project_id: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    key_facts: list[str] = Field(default_factory=list)
    open_threads: list[str] = Field(default_factory=list)
    updated_at: datetime | None = None


class ProjectLearningProfile(StrictModel):
    id: str | None = None
    project_id: str = Field(min_length=1)
    current_stage: str = Field(min_length=1)
    primary_weaknesses: list[str] = Field(default_factory=list)
    learning_preferences: list[str] = Field(default_factory=list)
    freshness: str = Field(min_length=1)
    updated_at: datetime | None = None


class ActivityResult(StrictModel):
    run_id: str = Field(min_length=1)
    project_id: str = Field(min_length=1)
    session_id: str = Field(min_length=1)
    activity_id: str = Field(min_length=1)
    knowledge_point_id: str = Field(min_length=1)
    result_type: ActivityResultType
    action: ActivityResultAction
    answer: str | None = None
    meta: dict[str, Any] = Field(default_factory=dict)


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
    review_count: int | None = None
    lapse_count: int | None = None


class StatePatch(StrictModel):
    learner_state_patch: LearnerStatePatch | None = None
    last_action: LastActionRecord | None = None
    review_patch: ReviewPatch | None = None


class CreateProjectRequest(StrictModel):
    project_id: str | None = None
    title: str = Field(min_length=1)
    topic: str = Field(min_length=1)
    description: str = Field(min_length=1)
    special_rules: list[str] = Field(default_factory=list)
    initial_materials: list[ProjectMaterialInput] = Field(default_factory=list)


class UpdateProjectRequest(StrictModel):
    title: str | None = None
    topic: str | None = None
    description: str | None = None
    special_rules: list[str] | None = None
    initial_materials: list[ProjectMaterialInput] | None = None


class CreateSessionRequest(StrictModel):
    session_id: str | None = None
    type: SessionType
    title: str | None = Field(default=None, min_length=1)
    entry_mode: EntryMode = "chat-question"
    focus_knowledge_point_ids: list[str] = Field(default_factory=list)
    project_material_ids: list[str] = Field(default_factory=list)


class UpdateSessionRequest(StrictModel):
    title: str | None = Field(default=None, min_length=1)
    status: SessionStatus | None = None
    focus_knowledge_point_ids: list[str] | None = None
    project_material_ids: list[str] | None = None


class UpdateKnowledgePointRequest(StrictModel):
    title: str | None = Field(default=None, min_length=1)
    description: str | None = Field(default=None, min_length=1)
    source_material_refs: list[str] | None = None


class ProjectBootstrap(StrictModel):
    project: Project
    sessions: list[Session] = Field(default_factory=list)
    project_materials: list[ProjectMaterial] = Field(default_factory=list)
    session_attachments: list[SessionAttachment] = Field(default_factory=list)
    knowledge_points: list[KnowledgePoint] = Field(default_factory=list)
    knowledge_point_states: list[KnowledgePointState] = Field(default_factory=list)
    project_memory: ProjectMemory | None = None
    project_learning_profile: ProjectLearningProfile | None = None


class SessionDetail(StrictModel):
    session: Session
    thread_context: ThreadContextRecord | None = None
    session_attachments: list[SessionAttachment] = Field(default_factory=list)
    recent_messages: list[Message] = Field(default_factory=list)


class ToolResult(StrictModel):
    kind: ToolIntent
    payload: dict[str, Any]


class AgentRequest(StrictModel):
    project_id: str = Field(min_length=1)
    thread_id: str = Field(min_length=1)
    session_type: SessionType = "study"
    session_title: str | None = None
    session_summary: str | None = None
    knowledge_point_id: str | None = None
    entry_mode: EntryMode
    topic: str = Field(min_length=1)
    messages: list[Message] = Field(min_length=1)
    source_asset_ids: list[str] = Field(default_factory=list)
    target_unit_id: str | None = None
    context_hint: str | None = None
    activity_result: ActivityResult | None = None
    response_mode: ResponseMode = "stream"


class GraphState(StrictModel):
    request: AgentRequest
    observations: list[Observation] = Field(default_factory=list)
    project_context: ProjectContext | None = None
    is_off_topic: bool = False
    off_topic_reason: str | None = None
    source_assets: list[SourceAsset] = Field(default_factory=list)
    learning_unit: LearningUnit | None = None
    session_orchestration: SessionOrchestration | None = None
    orchestration_events: list[SessionOrchestrationEventRecord] = Field(default_factory=list)
    signals: list[Signal] = Field(default_factory=list)
    prior_learner_unit_state: LearnerUnitState | None = None
    prior_next_review_at: datetime | None = None
    prior_review_state: ReviewPatch | None = None
    prior_knowledge_point_state: KnowledgePointState | None = None
    learner_unit_state: LearnerUnitState | None = None
    diagnosis: Diagnosis | None = None
    tool_intent: ToolIntent = "none"
    tool_result: ToolResult | None = None
    plan: StudyPlan | None = None
    activity: Activity | None = None
    activities: list[Activity] = Field(default_factory=list)
    knowledge_point_suggestions: list[KnowledgePointSuggestion] = Field(default_factory=list)
    knowledge_point_state_writebacks: list[KnowledgePointState] = Field(default_factory=list)
    project_memory_writeback: ProjectMemory | None = None
    project_learning_profile_writeback: ProjectLearningProfile | None = None
    assistant_message: str | None = None
    state_patch: StatePatch | None = None
    recent_messages: list[Message] = Field(default_factory=list)
    rationale: list[str] = Field(default_factory=list)


class TextDeltaEvent(StrictModel):
    event: Literal["text-delta"]
    delta: str = Field(min_length=1)


class StatusEvent(StrictModel):
    event: Literal["status"]
    phase: StatusPhase
    message: str = Field(min_length=1)


class DiagnosisEvent(StrictModel):
    event: Literal["diagnosis"]
    diagnosis: Diagnosis


class PlanEvent(StrictModel):
    event: Literal["plan"]
    plan: StudyPlan


class ActivityEvent(StrictModel):
    event: Literal["activity"]
    activity: Activity


class ActivitiesEvent(StrictModel):
    event: Literal["activities"]
    activities: list[Activity] = Field(min_length=1)


class KnowledgePointSuggestionEvent(StrictModel):
    event: Literal["knowledge-point-suggestion"]
    suggestions: list[KnowledgePointSuggestion] = Field(min_length=1)


class StatePatchEvent(StrictModel):
    event: Literal["state-patch"]
    state_patch: StatePatch


class SessionOrchestrationEvent(StrictModel):
    event: Literal["session-orchestration"]
    change: SessionOrchestrationEventRecord


class DoneEvent(StrictModel):
    event: Literal["done"]
    final_message: str | None = None


StreamEvent = Annotated[
    StatusEvent
    | TextDeltaEvent
    | DiagnosisEvent
    | PlanEvent
    | ActivityEvent
    | ActivitiesEvent
    | KnowledgePointSuggestionEvent
    | StatePatchEvent
    | SessionOrchestrationEvent
    | DoneEvent,
    Field(discriminator="event"),
]


class AgentRunResult(StrictModel):
    graph_state: GraphState
    events: list[StreamEvent] = Field(default_factory=list)


def build_initial_observations(request: AgentRequest) -> list[Observation]:
    observations: list[Observation] = []
    session_guidance = {
        "project": "当前是 project session：优先围绕学习方向、主题讨论、材料和知识点池决定下一步，可提出知识点新增或归档建议。",
        "study": "当前是 study session：优先围绕当前知识点建立理解、澄清边界或推进受约束练习。",
        "review": "当前是 review session：优先做主动回忆、短反馈和复盘校准，除非混淆明显，不要扩散成普通 project 问答。",
    }

    observations.append(
        Observation(
            observation_id="session-type",
            kind="project-note",
            source="request-session",
            summary=session_guidance[request.session_type],
            detail={"sessionType": request.session_type},
        )
    )

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

    if request.activity_result is not None:
        answer_preview = (request.activity_result.answer or "").strip()
        summary = (
            f"{request.activity_result.result_type} activity {request.activity_result.action}"
            f": {answer_preview[:120]}"
            if answer_preview
            else f"{request.activity_result.result_type} activity {request.activity_result.action}"
        )
        observations.append(
            Observation(
                observation_id=f"activity-result-{request.activity_result.activity_id}",
                kind=(
                    "exercise-result"
                    if request.activity_result.result_type == "exercise"
                    else "review-result"
                ),
                source="activity-result",
                summary=summary,
                detail=request.activity_result.model_dump(mode="json"),
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
