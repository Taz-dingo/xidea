import { MODE_LABELS, buildStudyPlan } from "./planner";
import type { SessionType } from "./project-workspace";
import type {
  LearningActivity,
  LearningActivitySubmission,
  LearnerProfile,
  LearningMode,
  LearningUnit,
  ProjectContext,
  SourceAsset,
  StudyPlanStep,
  WritebackPreview,
} from "./types";

export type AgentEntryMode = "chat-question" | "material-import" | "coach-followup";
export type AgentAction = "teach" | "clarify" | "practice" | "review" | "apply";
export type AgentPrimaryIssue =
  | "insufficient-understanding"
  | "concept-confusion"
  | "weak-recall"
  | "poor-transfer"
  | "missing-context";
export type AgentSignalKind =
  | "concept-gap"
  | "concept-confusion"
  | "memory-weakness"
  | "transfer-readiness"
  | "review-pressure"
  | "project-relevance";

export interface AgentMessage {
  readonly message_id?: number;
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
  readonly created_at?: string;
}

export interface AgentRequest {
  readonly project_id: string;
  readonly thread_id: string;
  readonly session_type: SessionType;
  readonly session_title: string | null;
  readonly session_summary: string | null;
  readonly knowledge_point_id: string | null;
  readonly entry_mode: AgentEntryMode;
  readonly topic: string;
  readonly messages: ReadonlyArray<AgentMessage>;
  readonly source_asset_ids: ReadonlyArray<string>;
  readonly target_unit_id: string | null;
  readonly context_hint: string | null;
  readonly activity_result: AgentActivityResult | null;
  readonly response_mode: "sync" | "stream";
}

export type AgentActivityResultType = "exercise" | "review";
export type AgentActivityResultAction = "submit" | "skip";

export interface AgentActivityResult {
  readonly run_id: string;
  readonly project_id: string;
  readonly session_id: string;
  readonly activity_id: string;
  readonly knowledge_point_id: string;
  readonly result_type: AgentActivityResultType;
  readonly action: AgentActivityResultAction;
  readonly answer: string | null;
  readonly meta: Record<string, unknown>;
}

interface AgentExplanation {
  readonly summary: string;
  readonly evidence: ReadonlyArray<string>;
  readonly confidence: number;
}

interface AgentSignal {
  readonly kind: AgentSignalKind;
  readonly score: number;
  readonly confidence: number;
  readonly summary: string;
  readonly based_on: ReadonlyArray<string>;
}

export interface AgentDiagnosis {
  readonly recommended_action: AgentAction;
  readonly reason: string;
  readonly confidence: number;
  readonly focus_unit_id: string | null;
  readonly primary_issue: AgentPrimaryIssue;
  readonly needs_tool: boolean;
  readonly explanation: AgentExplanation | null;
}

interface AgentPlanStep {
  readonly id: string;
  readonly title: string;
  readonly mode: LearningMode;
  readonly reason: string;
  readonly outcome: string;
}

export interface AgentPlan {
  readonly headline: string;
  readonly summary: string;
  readonly selected_mode: LearningMode;
  readonly expected_outcome: string;
  readonly steps: ReadonlyArray<AgentPlanStep>;
}

export interface AgentSessionOrchestrationStep {
  readonly knowledge_point_id: string;
  readonly title: string;
  readonly reason: string;
  readonly status: "pending" | "active" | "completed";
}

export interface AgentSessionOrchestration {
  readonly objective: string;
  readonly summary: string;
  readonly status: "planned" | "adjusted" | "completed";
  readonly candidate_pool_ids: ReadonlyArray<string>;
  readonly current_focus_id: string | null;
  readonly steps: ReadonlyArray<AgentSessionOrchestrationStep>;
  readonly last_change_reason: string | null;
}

export interface AgentSessionOrchestrationEventRecord {
  readonly kind: "plan_created" | "plan_adjusted" | "plan_step_completed" | "session_completed";
  readonly title: string;
  readonly summary: string;
  readonly reason: string | null;
  readonly visibility: "silent" | "sidebar_only" | "timeline";
  readonly created_at: string | null;
  readonly plan_snapshot: AgentSessionOrchestration;
}

interface AgentActivityChoice {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly is_correct?: boolean;
  readonly feedback_layers?: ReadonlyArray<string>;
  readonly analysis?: string | null;
}

type AgentActivityInput =
  | {
      readonly type: "choice";
      readonly choices: ReadonlyArray<AgentActivityChoice>;
    }
  | {
      readonly type: "text";
      readonly placeholder: string;
      readonly min_length: number;
    };

export interface AgentActivity {
  readonly id: string;
  readonly kind: LearningActivity["kind"];
  readonly title: string;
  readonly objective: string;
  readonly prompt: string;
  readonly support: string;
  readonly mode: LearningMode | null;
  readonly evidence: ReadonlyArray<string>;
  readonly submit_label: string;
  readonly input: AgentActivityInput;
}

export interface AgentLearnerUnitState {
  readonly unit_id: string;
  readonly mastery: number;
  readonly understanding_level: number;
  readonly memory_strength: number;
  readonly confusion_level: number;
  readonly transfer_readiness: number;
  readonly weak_signals: ReadonlyArray<string>;
  readonly recommended_action: AgentAction | null;
  readonly confidence: number;
  readonly based_on: ReadonlyArray<string>;
}

export interface AgentKnowledgePoint {
  readonly id: string;
  readonly project_id: string;
  readonly title: string;
  readonly description: string;
  readonly status: "active" | "archived";
  readonly origin_type: string;
  readonly origin_session_id: string | null;
  readonly source_material_refs: ReadonlyArray<string>;
  readonly created_at: string | null;
  readonly updated_at: string | null;
}

export interface AgentKnowledgePointState {
  readonly knowledge_point_id: string;
  readonly mastery: number;
  readonly learning_status: string;
  readonly review_status: string;
  readonly next_review_at: string | null;
  readonly archive_suggested: boolean;
  readonly updated_at: string | null;
}

export interface AgentKnowledgePointSuggestion {
  readonly id: string;
  readonly kind: "create" | "archive";
  readonly project_id: string;
  readonly session_id: string;
  readonly origin_message_id?: number | null;
  readonly knowledge_point_id: string | null;
  readonly title: string;
  readonly description: string;
  readonly reason: string;
  readonly source_material_refs: ReadonlyArray<string>;
  readonly status: "pending" | "accepted" | "dismissed";
  readonly created_at: string | null;
  readonly resolved_at: string | null;
  readonly updated_at: string | null;
}

export interface AgentKnowledgePointSuggestionResolution {
  readonly suggestion: AgentKnowledgePointSuggestion;
  readonly knowledge_point: AgentKnowledgePoint | null;
  readonly knowledge_point_state: AgentKnowledgePointState | null;
  readonly linked_session_message_ids: Readonly<Record<string, number>>;
}

export interface AgentKnowledgePointRecord {
  readonly knowledge_point: AgentKnowledgePoint;
  readonly knowledge_point_state: AgentKnowledgePointState | null;
  readonly linked_session_ids: ReadonlyArray<string>;
  readonly linked_session_message_ids: Readonly<Record<string, number>>;
}

interface AgentLearnerStatePatch {
  readonly mastery: number | null;
  readonly understanding_level: number | null;
  readonly memory_strength: number | null;
  readonly confusion_level: number | null;
  readonly transfer_readiness: number | null;
  readonly weak_signals: ReadonlyArray<string> | null;
  readonly recommended_action: AgentAction | null;
  readonly last_reviewed_at: string | null;
  readonly next_review_at: string | null;
}

interface AgentLastAction {
  readonly action: AgentAction;
  readonly mode: LearningMode | null;
  readonly unit_id: string | null;
}

interface AgentReviewPatch {
  readonly due_unit_ids: ReadonlyArray<string> | null;
  readonly scheduled_at: string | null;
  readonly review_reason: string | null;
}

export interface AgentStatePatch {
  readonly learner_state_patch: AgentLearnerStatePatch | null;
  readonly last_action: AgentLastAction | null;
  readonly review_patch: AgentReviewPatch | null;
}

export type AgentStreamEvent =
  | {
      readonly event: "status";
      readonly phase:
        | "loading-context"
        | "making-decision"
        | "retrieving-context"
        | "composing-response"
        | "preparing-followup"
        | "writing-state";
      readonly message: string;
    }
  | { readonly event: "text-delta"; readonly delta: string }
  | { readonly event: "diagnosis"; readonly diagnosis: AgentDiagnosis }
  | { readonly event: "activity"; readonly activity: AgentActivity }
  | { readonly event: "activities"; readonly activities: ReadonlyArray<AgentActivity> }
  | {
      readonly event: "knowledge-point-suggestion";
      readonly suggestions: ReadonlyArray<AgentKnowledgePointSuggestion>;
    }
  | { readonly event: "plan"; readonly plan: AgentPlan }
  | {
      readonly event: "session-orchestration";
      readonly change: AgentSessionOrchestrationEventRecord;
    }
  | { readonly event: "state-patch"; readonly state_patch: AgentStatePatch }
  | { readonly event: "done"; readonly final_message: string | null };

export interface AgentRunResult {
  readonly graph_state: {
    readonly signals: ReadonlyArray<AgentSignal>;
    readonly learner_unit_state: AgentLearnerUnitState | null;
    readonly diagnosis: AgentDiagnosis | null;
    readonly plan: AgentPlan | null;
    readonly activity: AgentActivity | null;
    readonly activities: ReadonlyArray<AgentActivity>;
    readonly assistant_message: string | null;
    readonly state_patch: AgentStatePatch | null;
    readonly session_orchestration: AgentSessionOrchestration | null;
    readonly orchestration_events: ReadonlyArray<AgentSessionOrchestrationEventRecord>;
    readonly rationale: ReadonlyArray<string>;
  };
  readonly events: ReadonlyArray<AgentStreamEvent>;
}

export interface AgentThreadContext {
  readonly thread_id: string;
  readonly entry_mode: AgentEntryMode;
  readonly source_asset_ids: ReadonlyArray<string>;
  readonly session_orchestration: AgentSessionOrchestration | null;
  readonly orchestration_events: ReadonlyArray<AgentSessionOrchestrationEventRecord>;
  readonly updated_at: string;
}

export interface AgentProjectThreadRecord {
  readonly thread_id: string;
  readonly project_id: string;
  readonly topic: string;
  readonly session_type: SessionType;
  readonly knowledge_point_id: string | null;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly entry_mode: AgentEntryMode;
  readonly source_asset_ids: ReadonlyArray<string>;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface AgentAssetSummaryAsset {
  readonly id: string;
  readonly title: string;
  readonly kind: SourceAsset["kind"];
  readonly topic: string;
  readonly contentExcerpt: string;
  readonly keyConcepts: ReadonlyArray<string>;
  readonly relevanceHint: string;
}

export interface AgentAssetSummary {
  readonly assetIds: ReadonlyArray<string>;
  readonly assets: ReadonlyArray<AgentAssetSummaryAsset>;
  readonly keyConcepts: ReadonlyArray<string>;
  readonly summary: string;
}

export interface AgentReviewEvent {
  readonly event_kind: "reviewed" | "scheduled";
  readonly event_at: string;
  readonly review_reason: string | null;
}

export interface AgentReviewInspector {
  readonly focusUnitId: string;
  readonly dueUnitIds: ReadonlyArray<string> | null;
  readonly scheduledAt: string | null;
  readonly reviewCount: number;
  readonly lapseCount: number;
  readonly performanceTrend: {
    readonly memoryStrength: number;
    readonly understandingLevel: number;
    readonly confusionLevel: number;
    readonly weakSignals: ReadonlyArray<string>;
    readonly trendHint: string;
  } | null;
  readonly decayRisk: "unknown" | "low" | "medium" | "high" | "critical";
  readonly lastReviewOutcome: {
    readonly scheduledAt: string | null;
    readonly reviewReason: string | null;
    readonly dueUnitIds: ReadonlyArray<string> | null;
    readonly reviewCount: number;
    readonly lapseCount: number;
  } | null;
  readonly summary: string;
  readonly events: ReadonlyArray<AgentReviewEvent>;
}

export interface AgentInspectorBootstrap {
  readonly thread_context: AgentThreadContext | null;
  readonly learner_state: AgentLearnerUnitState | null;
  readonly review_inspector: AgentReviewInspector | null;
}

export interface RuntimeSignalCard {
  readonly id: string;
  readonly label: string;
  readonly observation: string;
  readonly implication: string;
}

export interface RuntimeSnapshot {
  readonly source: "mock" | "hydrated-state" | "live-agent";
  readonly state: {
    readonly mastery: number;
    readonly understandingLevel: number;
    readonly memoryStrength: number;
    readonly confusion: number;
    readonly transferReadiness: number | null;
    readonly weakSignals: ReadonlyArray<string>;
    readonly recommendedAction: AgentAction;
    readonly lastReviewedAt: string | null;
    readonly nextReviewAt: string | null;
  };
  readonly stateSource: string;
  readonly signalCards: ReadonlyArray<RuntimeSignalCard>;
  readonly decision: {
    readonly title: string;
    readonly reason: string;
    readonly objective: string;
    readonly confidence: number | null;
  };
  readonly plan: {
    readonly headline: string;
    readonly summary: string;
    readonly steps: ReadonlyArray<StudyPlanStep>;
    readonly highlightedModes: ReadonlyArray<LearningMode>;
    readonly primaryMode: LearningMode | null;
  };
  readonly writeback: ReadonlyArray<WritebackPreview>;
  readonly activity: LearningActivity | null;
  readonly activities: ReadonlyArray<LearningActivity>;
  readonly assistantMessage: string;
  readonly streamStatusPhase:
    | "loading-context"
    | "making-decision"
    | "retrieving-context"
    | "composing-response"
    | "preparing-followup"
    | "writing-state"
    | null;
  readonly streamStatusLabel: string | null;
  readonly rationale: ReadonlyArray<string>;
  readonly orchestration: {
    readonly current: AgentSessionOrchestration | null;
    readonly latestEvent: AgentSessionOrchestrationEventRecord | null;
    readonly timeline: ReadonlyArray<AgentSessionOrchestrationEventRecord>;
  };
}

const SIGNAL_COPY: Record<AgentSignalKind, { label: string; implication: string }> = {
  "concept-gap": {
    label: "理解缺口",
    implication: "当前更适合先补框架，而不是直接推进更难的迁移练习。",
  },
  "concept-confusion": {
    label: "概念混淆",
    implication: "要先把边界拉清楚，否则会带着错模型继续推进项目。",
  },
  "memory-weakness": {
    label: "记忆走弱",
    implication: "下一轮需要把关键概念重新拉回可用状态，避免只剩模糊印象。",
  },
  "transfer-readiness": {
    label: "迁移能力",
    implication: "系统会判断是继续讲解，还是可以把知识丢进真实情境验证。",
  },
  "review-pressure": {
    label: "复习压力",
    implication: "说明这轮不仅要学新内容，还要考虑是否该安排复盘窗口。",
  },
  "project-relevance": {
    label: "项目相关性",
    implication: "系统确认当前问题和真实项目绑定，可以直接按项目学习来编排。",
  },
};

const PRIMARY_ISSUE_COPY: Record<AgentPrimaryIssue, string> = {
  "insufficient-understanding": "当前的主要问题是理解框架还没成形。",
  "concept-confusion": "当前最需要先拆开容易混淆的边界。",
  "weak-recall": "当前瓶颈更像记忆可用性下降。",
  "poor-transfer": "当前已经不只是会不会背，而是能不能用到项目场景。",
  "missing-context": "系统判断当前仍缺少必要上下文，先补足背景再继续。",
};

function formatDateLabel(value: string | null): string | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function toSignalCard(signal: AgentSignal, index: number): RuntimeSignalCard {
  const copy = SIGNAL_COPY[signal.kind];

  return {
    id: `${signal.kind}-${index}`,
    label: copy.label,
    observation: signal.summary,
    implication: `${copy.implication} 当前置信度 ${(signal.confidence * 100).toFixed(0)}%。`,
  };
}

function buildSignalCardsFromStream(
  diagnosis: AgentDiagnosis,
  learnerState: AgentLearnerUnitState,
): ReadonlyArray<RuntimeSignalCard> {
  const cards: RuntimeSignalCard[] = [
    {
      id: "stream-primary-issue",
      label: "主要问题",
      observation: PRIMARY_ISSUE_COPY[diagnosis.primary_issue],
      implication: `${diagnosis.reason} 当前置信度 ${(diagnosis.confidence * 100).toFixed(0)}%。`,
    },
  ];

  learnerState.based_on.slice(0, 2).forEach((reason, index) => {
    cards.push({
      id: `stream-based-on-${index}`,
      label: `判断依据 ${index + 1}`,
      observation: reason,
      implication: "这条依据会继续影响下一轮动作选择和状态回写。",
    });
  });

  if (cards.length < 3 && learnerState.weak_signals.length > 0) {
    cards.push({
      id: "stream-weak-signals",
      label: "弱信号",
      observation: learnerState.weak_signals.join(" / "),
      implication: "系统会把这些弱信号继续挂在当前 unit 上，避免下一轮重新从零判断。",
    });
  }

  return cards;
}

function normalizeAgentActivity(activity: AgentActivity): LearningActivity {
  return {
    id: activity.id,
    kind: activity.kind,
    title: activity.title,
    objective: activity.objective,
    prompt: activity.prompt,
    support: activity.support,
    mode: activity.mode,
    evidence: activity.evidence,
    submitLabel: activity.submit_label,
    input:
      activity.input.type === "choice"
        ? {
            type: "choice",
            choices: activity.input.choices.map((choice) => ({
              id: choice.id,
              label: choice.label,
              detail: choice.detail,
              isCorrect: choice.is_correct ?? false,
              feedbackLayers: choice.feedback_layers ?? [],
              analysis: choice.analysis ?? null,
            })),
          }
        : {
            type: "text",
            placeholder: activity.input.placeholder,
            minLength: activity.input.min_length,
          },
  };
}

function normalizeAgentActivities(
  activities: ReadonlyArray<AgentActivity>,
): ReadonlyArray<LearningActivity> {
  return activities.map(normalizeAgentActivity);
}

function buildActivityList(
  primaryActivity: LearningActivity | null,
  additionalActivities?: ReadonlyArray<LearningActivity>,
): ReadonlyArray<LearningActivity> {
  if (additionalActivities !== undefined) {
    return additionalActivities;
  }

  return primaryActivity === null ? [] : [primaryActivity];
}

function withActivities(snapshot: RuntimeSnapshot): RuntimeSnapshot {
  if (snapshot.activities.length > 0 || snapshot.activity === null) {
    return snapshot;
  }

  return {
    ...snapshot,
    activities: [snapshot.activity],
  };
}

export function formatActivitySubmissionForAgent(input: {
  readonly activity: LearningActivity;
  readonly submission: LearningActivitySubmission;
}): string {
  const selectedChoice =
    input.activity.input.type === "choice" && input.submission.selectedChoiceId !== null
      ? input.activity.input.choices.find((choice) => choice.id === input.submission.selectedChoiceId) ??
        null
      : null;
  const normalizedResponse = input.submission.responseText.trim();

  if (selectedChoice !== null) {
    return `我的选择是「${selectedChoice.label}」。请根据这个判断继续安排下一步。`;
  }

  if (normalizedResponse !== "") {
    return `我的回答是：${normalizedResponse}。请根据这个回答继续安排下一步。`;
  }

  return `我完成了「${input.activity.title}」。请继续安排下一步。`;
}

function buildWritebackFromAgent(statePatch: AgentStatePatch | null): ReadonlyArray<WritebackPreview> {
  if (statePatch === null) {
    return [];
  }

  const items: WritebackPreview[] = [];
  const learnerPatch = statePatch.learner_state_patch;

  if (learnerPatch?.understanding_level !== null && learnerPatch?.understanding_level !== undefined) {
    items.push({
      id: "writeback-understanding",
      target: "LearnerState.understandingLevel",
      change: `把当前理解水平估计更新到 ${learnerPatch.understanding_level}，作为下一轮动作选择依据。`,
    });
  }

  if (learnerPatch?.confusion_level !== null && learnerPatch?.confusion_level !== undefined) {
    items.push({
      id: "writeback-confusion",
      target: "LearnerState.confusionLevel",
      change: `记录当前混淆风险 ${learnerPatch.confusion_level}，继续追踪是否已经把边界拉开。`,
    });
  }

  if (statePatch.last_action?.action !== null && statePatch.last_action?.action !== undefined) {
    items.push({
      id: "writeback-last-action",
      target: "LastAction",
      change: `记录本轮执行了 ${statePatch.last_action.action} / ${statePatch.last_action.mode ?? "unknown"}。`,
    });
  }

  if (statePatch.review_patch?.scheduled_at) {
    items.push({
      id: "writeback-review",
      target: "Review Engine",
      change: `安排下一次复盘时间 ${formatDateLabel(statePatch.review_patch.scheduled_at) ?? statePatch.review_patch.scheduled_at}。`,
    });
  }

  if (items.length === 0) {
    items.push({
      id: "writeback-thread",
      target: "Project Thread",
      change: "把这轮判断、动作和结果写回线程，作为下一轮编排的上下文。",
    });
  }

  return items;
}

function buildAssistantMessageFromEvents(result: AgentRunResult): string {
  const doneEvent = result.events.find((event) => event.event === "done");
  if (doneEvent?.final_message) {
    return doneEvent.final_message;
  }

  const deltaText = result.events
    .filter((event): event is Extract<AgentStreamEvent, { event: "text-delta" }> => event.event === "text-delta")
    .map((event) => event.delta)
    .join("");

  return deltaText || result.graph_state.assistant_message || "Agent 已返回结构化结果。";
}

function buildAssistantMessageFromStreamEvents(events: ReadonlyArray<AgentStreamEvent>): string {
  const doneEvent = events.find((event) => event.event === "done");
  if (doneEvent?.final_message) {
    return doneEvent.final_message;
  }

  return events
    .filter(
      (event): event is Extract<AgentStreamEvent, { event: "text-delta" }> =>
        event.event === "text-delta",
    )
    .map((event) => event.delta)
    .join("");
}

function getLatestStreamStatus(
  events: ReadonlyArray<AgentStreamEvent>,
): Extract<AgentStreamEvent, { event: "status" }> | null {
  return (
    [...events]
      .reverse()
      .find(
        (event): event is Extract<AgentStreamEvent, { event: "status" }> =>
          event.event === "status",
      ) ?? null
  );
}

function getSessionOrchestrationEvents(
  events: ReadonlyArray<AgentStreamEvent>,
): ReadonlyArray<AgentSessionOrchestrationEventRecord> {
  return events
    .filter(
      (event): event is Extract<AgentStreamEvent, { event: "session-orchestration" }> =>
        event.event === "session-orchestration",
    )
    .map((event) => event.change);
}

function mergeOrchestrationTimeline(
  previous: ReadonlyArray<AgentSessionOrchestrationEventRecord>,
  next: ReadonlyArray<AgentSessionOrchestrationEventRecord>,
): ReadonlyArray<AgentSessionOrchestrationEventRecord> {
  if (previous.length === 0) {
    return next;
  }
  if (next.length === 0) {
    return previous;
  }

  const merged = [...previous];
  for (const event of next) {
    const eventKey = `${event.kind}:${event.created_at ?? "unknown"}:${event.plan_snapshot.current_focus_id ?? "none"}`;
    const hasEvent = merged.some(
      (candidate) =>
        `${candidate.kind}:${candidate.created_at ?? "unknown"}:${candidate.plan_snapshot.current_focus_id ?? "none"}` ===
        eventKey,
    );
    if (!hasEvent) {
      merged.push(event);
    }
  }
  return merged;
}

function buildOrchestrationState(input: {
  readonly current: AgentSessionOrchestration | null;
  readonly timeline: ReadonlyArray<AgentSessionOrchestrationEventRecord>;
}) {
  return {
    current: input.current,
    latestEvent: input.timeline.at(-1) ?? null,
    timeline: input.timeline,
  };
}

export function buildDefaultAgentPrompt(
  unit: LearningUnit,
  project: ProjectContext,
): string {
  return `我正在推进「${project.name}」，当前目标是${project.goal}。请围绕「${unit.title}」判断我这轮更适合先学什么，并解释为什么。`;
}

function buildAttachedMaterialPromptContext(
  sourceAssets: ReadonlyArray<SourceAsset>,
): string | null {
  if (sourceAssets.length === 0) {
    return null;
  }

  const materialLines = sourceAssets.slice(0, 3).map((asset, index) => {
    return [
      `${index + 1}. ${asset.title}`,
      asset.topic.trim() ? `主题：${asset.topic.trim()}` : null,
    ]
      .filter(Boolean)
      .join("；");
  });

  return [
    "当前已附材料，请优先读取这些材料的正文，再判断学习主题、关键概念和知识点建议。",
    materialLines.join("\n"),
  ].join("\n");
}

function shouldInjectMaterialTargeting(prompt: string): boolean {
  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt === "") {
    return true;
  }

  if (normalizedPrompt.length <= 12) {
    return true;
  }

  return /这个|这些|这份|这篇|这几个|这组|上面这|刚上传|附件|材料/.test(
    normalizedPrompt,
  );
}

export function getRequestSourceAssetIds(
  _entryMode: AgentEntryMode,
  sourceAssets: ReadonlyArray<SourceAsset>,
): ReadonlyArray<string> {
  return sourceAssets.map((asset) => asset.id);
}

export function buildAgentRequest(input: {
  readonly activityResult: AgentActivityResult | null;
  readonly projectId: string;
  readonly sessionId: string;
  readonly sessionType: SessionType;
  readonly sessionTitle: string | null;
  readonly sessionSummary: string | null;
  readonly knowledgePointId: string | null;
  readonly entryMode: AgentEntryMode;
  readonly prompt: string;
  readonly project: ProjectContext;
  readonly sourceAssets: ReadonlyArray<SourceAsset>;
  readonly unit: LearningUnit;
  readonly targetUnitId: string | null;
}): AgentRequest {
  const normalizedPrompt = input.prompt.trim();
  const sourceAssetIds = getRequestSourceAssetIds(input.entryMode, input.sourceAssets);
  const materialContext = buildAttachedMaterialPromptContext(input.sourceAssets);
  const fallbackPrompt = normalizedPrompt || buildDefaultAgentPrompt(input.unit, input.project);
  const materialFocusHint =
    materialContext === null
      ? null
      : shouldInjectMaterialTargeting(normalizedPrompt)
        ? materialContext
        : materialContext;
  const contextHint =
    materialFocusHint === null
      ? input.project.currentThread
      : [input.project.currentThread, materialFocusHint].filter(Boolean).join("\n\n");

  return {
    project_id: input.projectId,
    thread_id: input.sessionId,
    session_type: input.sessionType,
    session_title: input.sessionTitle,
    session_summary: input.sessionSummary,
    knowledge_point_id: input.knowledgePointId,
    entry_mode: input.entryMode,
    topic:
      input.targetUnitId === null
        ? input.project.goal.trim() || input.project.name
        : input.unit.title,
    messages: [{ role: "user", content: fallbackPrompt }],
    source_asset_ids: sourceAssetIds,
    target_unit_id: input.targetUnitId,
    context_hint: contextHint,
    activity_result: input.activityResult,
    response_mode: "stream",
  };
}

export function buildMockRuntimeSnapshot(
  profile: LearnerProfile,
  unit: LearningUnit,
  sessionType: SessionType = "study",
): RuntimeSnapshot {
  const plan = buildStudyPlan(unit, profile.state);
  const activities: ReadonlyArray<LearningActivity> = [];
  const activity: LearningActivity | null = null;

  return withActivities({
    source: "mock",
    state: {
      mastery: profile.state.mastery,
      understandingLevel: profile.state.understandingLevel,
      memoryStrength: profile.state.memoryStrength,
      confusion: profile.state.confusion,
      transferReadiness: null,
      weakSignals: profile.state.weakSignals,
      recommendedAction: profile.state.recommendedAction,
      lastReviewedAt: profile.state.lastReviewedAt,
      nextReviewAt: profile.state.nextReviewAt,
    },
    stateSource: profile.stateSource,
    signalCards: profile.diagnosisSignals,
    decision: {
      title: plan.decision.title,
      reason: plan.decision.reason,
      objective: plan.decision.objective,
      confidence: null,
    },
    plan: {
      headline: plan.headline,
      summary: plan.summary,
      steps: plan.steps,
      highlightedModes: plan.steps.map((step) => step.mode),
      primaryMode: plan.steps[0]?.mode ?? null,
    },
    writeback: plan.writeback,
    activity,
    activities,
    assistantMessage: `${plan.decision.reason} 这轮我会先用「${plan.decision.title}」推进，目标是${plan.decision.objective}。`,
    streamStatusPhase: null,
    streamStatusLabel: null,
    rationale: [],
    orchestration: buildOrchestrationState({ current: null, timeline: [] }),
  });
}

export function hydrateRuntimeSnapshotFromLearnerState(
  learnerState: AgentLearnerUnitState,
  fallbackSnapshot: RuntimeSnapshot,
): RuntimeSnapshot {
  const signalCards =
    learnerState.based_on.length > 0
      ? learnerState.based_on.slice(0, 3).map((reason, index) => ({
          id: `persisted-based-on-${index}`,
          label: `判断依据 ${index + 1}`,
          observation: reason,
          implication: "这条依据来自已落库 learner state，会继续影响下一轮判断。",
        }))
      : fallbackSnapshot.signalCards;

  return withActivities({
    ...fallbackSnapshot,
    source: "hydrated-state",
    state: {
      mastery: learnerState.mastery,
      understandingLevel: learnerState.understanding_level,
      memoryStrength: learnerState.memory_strength,
      confusion: learnerState.confusion_level,
      transferReadiness: learnerState.transfer_readiness,
      weakSignals: learnerState.weak_signals,
      recommendedAction: learnerState.recommended_action ?? fallbackSnapshot.state.recommendedAction,
      lastReviewedAt: fallbackSnapshot.state.lastReviewedAt,
      nextReviewAt: fallbackSnapshot.state.nextReviewAt,
    },
    stateSource: learnerState.based_on.length > 0
      ? `来源：真实 learner state。${learnerState.based_on.join(" / ")}`
      : "来源：真实 learner state。",
    signalCards,
    activity: fallbackSnapshot.activity,
    activities: fallbackSnapshot.activities,
    streamStatusPhase: null,
    streamStatusLabel: null,
    orchestration: fallbackSnapshot.orchestration,
  });
}

export function hydrateRuntimeSnapshotFromThreadContext(
  threadContext: AgentThreadContext,
  fallbackSnapshot: RuntimeSnapshot,
): RuntimeSnapshot {
  return {
    ...fallbackSnapshot,
    orchestration: buildOrchestrationState({
      current: threadContext.session_orchestration,
      timeline: threadContext.orchestration_events,
    }),
  };
}

export function normalizeAgentRunResult(result: AgentRunResult): RuntimeSnapshot {
  const diagnosis = result.graph_state.diagnosis;
  const learnerState = result.graph_state.learner_unit_state;
  const plan = result.graph_state.plan;

  if (diagnosis === null || learnerState === null || plan === null) {
    throw new Error("Agent result is missing diagnosis, learner state, or plan.");
  }

  const learnerPatch = result.graph_state.state_patch?.learner_state_patch;
  const primaryReason = diagnosis.explanation?.summary ?? diagnosis.reason;
  const stateSourceParts = [
    "来源：真实 `/runs/v0` agent 结果。",
    PRIMARY_ISSUE_COPY[diagnosis.primary_issue],
    learnerState.based_on.length > 0 ? `判断依据：${learnerState.based_on.join(" / ")}` : null,
  ].filter((item): item is string => item !== null);

  const activities =
    result.graph_state.activities.length > 0
      ? normalizeAgentActivities(result.graph_state.activities)
      : result.graph_state.activity !== null
        ? [normalizeAgentActivity(result.graph_state.activity)]
        : [];
  const activity = activities[0] ?? null;
  const orchestrationTimeline =
    result.graph_state.orchestration_events.length > 0
      ? result.graph_state.orchestration_events
      : getSessionOrchestrationEvents(result.events);

  return {
    source: "live-agent",
    state: {
      mastery: learnerState.mastery,
      understandingLevel: learnerState.understanding_level,
      memoryStrength: learnerState.memory_strength,
      confusion: learnerState.confusion_level,
      transferReadiness: learnerState.transfer_readiness,
      weakSignals: learnerState.weak_signals,
      recommendedAction: diagnosis.recommended_action,
      lastReviewedAt: formatDateLabel(learnerPatch?.last_reviewed_at ?? null),
      nextReviewAt: formatDateLabel(
        learnerPatch?.next_review_at ?? result.graph_state.state_patch?.review_patch?.scheduled_at ?? null,
      ),
    },
    stateSource: stateSourceParts.join(" "),
    signalCards: result.graph_state.signals.map(toSignalCard),
    decision: {
      title: MODE_LABELS[plan.selected_mode],
      reason: primaryReason,
      objective: plan.expected_outcome,
      confidence: diagnosis.confidence,
    },
    plan: {
      headline: plan.headline,
      summary: plan.summary,
      steps: plan.steps,
      highlightedModes: plan.steps.map((step) => step.mode),
      primaryMode: plan.selected_mode,
    },
    writeback: buildWritebackFromAgent(result.graph_state.state_patch),
    activity,
    activities,
    assistantMessage: buildAssistantMessageFromEvents(result),
    streamStatusPhase: null,
    streamStatusLabel: null,
    rationale: result.graph_state.rationale,
    orchestration: buildOrchestrationState({
      current: result.graph_state.session_orchestration,
      timeline: orchestrationTimeline,
    }),
  };
}

export function normalizeAgentStreamResult(input: {
  readonly events: ReadonlyArray<AgentStreamEvent>;
  readonly learnerState: AgentLearnerUnitState | null;
  readonly fallbackSnapshot: RuntimeSnapshot;
}): RuntimeSnapshot {
  const diagnosisEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "diagnosis" }> =>
      event.event === "diagnosis",
  );
  const planEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "plan" }> => event.event === "plan",
  );
  const activityEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "activity" }> =>
      event.event === "activity",
  );
  const activitiesEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "activities" }> =>
      event.event === "activities",
  );
  const statePatchEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "state-patch" }> =>
      event.event === "state-patch",
  );
  const streamStatus = getLatestStreamStatus(input.events);
  const orchestrationTimeline = getSessionOrchestrationEvents(input.events);
  const mergedOrchestrationTimeline = mergeOrchestrationTimeline(
    input.fallbackSnapshot.orchestration.timeline,
    orchestrationTimeline,
  );

  const diagnosis = diagnosisEvent?.diagnosis;
  const plan = planEvent?.plan;
  const learnerState = input.learnerState;

  if (diagnosis === undefined || plan === undefined || learnerState === null) {
    return input.fallbackSnapshot;
  }

  const learnerPatch = statePatchEvent?.state_patch.learner_state_patch;
  const primaryReason = diagnosis.explanation?.summary ?? diagnosis.reason;
  const stateSourceParts = [
    "来源：真实 `/runs/v0/stream` agent 结果。",
    PRIMARY_ISSUE_COPY[diagnosis.primary_issue],
    learnerState.based_on.length > 0 ? `判断依据：${learnerState.based_on.join(" / ")}` : null,
  ].filter((item): item is string => item !== null);

  const activities =
    activitiesEvent !== undefined
      ? normalizeAgentActivities(activitiesEvent.activities)
      : activityEvent !== undefined
        ? [normalizeAgentActivity(activityEvent.activity)]
        : [];
  const activity = activities[0] ?? null;

  return withActivities({
    source: "live-agent",
    state: {
      mastery: learnerState.mastery,
      understandingLevel: learnerState.understanding_level,
      memoryStrength: learnerState.memory_strength,
      confusion: learnerState.confusion_level,
      transferReadiness: learnerState.transfer_readiness,
      weakSignals: learnerState.weak_signals,
      recommendedAction: diagnosis.recommended_action,
      lastReviewedAt: formatDateLabel(learnerPatch?.last_reviewed_at ?? null),
      nextReviewAt: formatDateLabel(
        learnerPatch?.next_review_at ??
          statePatchEvent?.state_patch.review_patch?.scheduled_at ??
          null,
      ),
    },
    stateSource: stateSourceParts.join(" "),
    signalCards: buildSignalCardsFromStream(diagnosis, learnerState),
    decision: {
      title: MODE_LABELS[plan.selected_mode],
      reason: primaryReason,
      objective: plan.expected_outcome,
      confidence: diagnosis.confidence,
    },
    plan: {
      headline: plan.headline,
      summary: plan.summary,
      steps: plan.steps,
      highlightedModes: plan.steps.map((step) => step.mode),
      primaryMode: plan.selected_mode,
    },
    writeback: buildWritebackFromAgent(statePatchEvent?.state_patch ?? null),
    activity,
    activities,
    assistantMessage: buildAssistantMessageFromStreamEvents(input.events),
    streamStatusPhase: streamStatus?.phase ?? null,
    streamStatusLabel: streamStatus?.message ?? null,
    rationale: diagnosis.explanation?.evidence ?? [],
    orchestration: buildOrchestrationState({
      current: orchestrationTimeline.at(-1)?.plan_snapshot ?? input.fallbackSnapshot.orchestration.current,
      timeline: mergedOrchestrationTimeline,
    }),
  });
}

export function normalizePartialAgentStreamResult(input: {
  readonly events: ReadonlyArray<AgentStreamEvent>;
  readonly fallbackSnapshot: RuntimeSnapshot;
}): RuntimeSnapshot {
  const diagnosisEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "diagnosis" }> =>
      event.event === "diagnosis",
  );
  const planEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "plan" }> => event.event === "plan",
  );
  const activityEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "activity" }> =>
      event.event === "activity",
  );
  const activitiesEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "activities" }> =>
      event.event === "activities",
  );
  const statePatchEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "state-patch" }> =>
      event.event === "state-patch",
  );
  const streamStatus = getLatestStreamStatus(input.events);
  const orchestrationTimeline = getSessionOrchestrationEvents(input.events);
  const mergedOrchestrationTimeline = mergeOrchestrationTimeline(
    input.fallbackSnapshot.orchestration.timeline,
    orchestrationTimeline,
  );

  const diagnosis = diagnosisEvent?.diagnosis;
  const plan = planEvent?.plan;
  const learnerPatch = statePatchEvent?.state_patch.learner_state_patch;
  const fallbackState = input.fallbackSnapshot.state;

  if (diagnosis === undefined && plan === undefined && statePatchEvent === undefined) {
    return {
      ...input.fallbackSnapshot,
      source: streamStatus === null ? input.fallbackSnapshot.source : "live-agent",
      assistantMessage: buildAssistantMessageFromStreamEvents(input.events),
      streamStatusPhase: streamStatus?.phase ?? null,
      streamStatusLabel: streamStatus?.message ?? null,
      orchestration: buildOrchestrationState({
        current: orchestrationTimeline.at(-1)?.plan_snapshot ?? input.fallbackSnapshot.orchestration.current,
        timeline: mergedOrchestrationTimeline,
      }),
    };
  }

  const activities =
    activitiesEvent !== undefined
      ? normalizeAgentActivities(activitiesEvent.activities)
      : activityEvent !== undefined
        ? [normalizeAgentActivity(activityEvent.activity)]
        : [];
  const activity = activities[0] ?? null;

  return withActivities({
    source: "live-agent",
    state: {
      mastery: learnerPatch?.mastery ?? fallbackState.mastery,
      understandingLevel: learnerPatch?.understanding_level ?? fallbackState.understandingLevel,
      memoryStrength: learnerPatch?.memory_strength ?? fallbackState.memoryStrength,
      confusion: learnerPatch?.confusion_level ?? fallbackState.confusion,
      transferReadiness: learnerPatch?.transfer_readiness ?? fallbackState.transferReadiness,
      weakSignals: learnerPatch?.weak_signals ?? fallbackState.weakSignals,
      recommendedAction:
        diagnosis?.recommended_action ??
        learnerPatch?.recommended_action ??
        fallbackState.recommendedAction,
      lastReviewedAt: formatDateLabel(
        learnerPatch?.last_reviewed_at ?? fallbackState.lastReviewedAt,
      ),
      nextReviewAt: formatDateLabel(
        learnerPatch?.next_review_at ??
          statePatchEvent?.state_patch.review_patch?.scheduled_at ??
          fallbackState.nextReviewAt,
      ),
    },
    stateSource:
      diagnosis !== undefined
        ? `来源：实时 /runs/v0/stream 事件。${PRIMARY_ISSUE_COPY[diagnosis.primary_issue]}`
        : "来源：实时 /runs/v0/stream 事件，持久化 learner state 尚未回读。",
    signalCards:
      diagnosis !== undefined
        ? [
            {
              id: "stream-primary-issue",
              label: "主要问题",
              observation: PRIMARY_ISSUE_COPY[diagnosis.primary_issue],
              implication: `${diagnosis.reason} 当前置信度 ${(diagnosis.confidence * 100).toFixed(0)}%。`,
            },
          ]
        : input.fallbackSnapshot.signalCards,
    decision: {
      title:
        plan !== undefined
          ? MODE_LABELS[plan.selected_mode]
          : diagnosis !== undefined
          ? MODE_LABELS[diagnosis.recommended_action === "clarify"
              ? "contrast-drill"
              : diagnosis.recommended_action === "teach"
              ? "guided-qa"
              : diagnosis.recommended_action === "review"
              ? "guided-qa"
              : diagnosis.recommended_action === "apply"
              ? "scenario-sim"
              : "socratic"]
          : input.fallbackSnapshot.decision.title,
      reason: diagnosis?.reason ?? input.fallbackSnapshot.decision.reason,
      objective: plan?.expected_outcome ?? input.fallbackSnapshot.decision.objective,
      confidence: diagnosis?.confidence ?? input.fallbackSnapshot.decision.confidence,
    },
    plan: {
      headline: plan?.headline ?? input.fallbackSnapshot.plan.headline,
      summary: plan?.summary ?? input.fallbackSnapshot.plan.summary,
      steps: plan?.steps ?? input.fallbackSnapshot.plan.steps,
      highlightedModes:
        plan?.steps.map((step) => step.mode) ?? input.fallbackSnapshot.plan.highlightedModes,
      primaryMode: plan?.selected_mode ?? input.fallbackSnapshot.plan.primaryMode,
    },
    writeback: buildWritebackFromAgent(statePatchEvent?.state_patch ?? null),
    activity,
    activities,
    assistantMessage: buildAssistantMessageFromStreamEvents(input.events),
    streamStatusPhase: streamStatus?.phase ?? null,
    streamStatusLabel: streamStatus?.message ?? null,
    rationale: diagnosis?.explanation?.evidence ?? input.fallbackSnapshot.rationale,
    orchestration: buildOrchestrationState({
      current: orchestrationTimeline.at(-1)?.plan_snapshot ?? input.fallbackSnapshot.orchestration.current,
      timeline: mergedOrchestrationTimeline,
    }),
  });
}
