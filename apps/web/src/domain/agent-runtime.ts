import { MODE_LABELS, buildStudyPlan } from "./planner";
import type {
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
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface AgentRequest {
  readonly project_id: string;
  readonly thread_id: string;
  readonly entry_mode: AgentEntryMode;
  readonly topic: string;
  readonly messages: ReadonlyArray<AgentMessage>;
  readonly source_asset_ids: ReadonlyArray<string>;
  readonly target_unit_id: string | null;
  readonly context_hint: string | null;
  readonly response_mode: "sync" | "stream";
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
  | { readonly event: "text-delta"; readonly delta: string }
  | { readonly event: "diagnosis"; readonly diagnosis: AgentDiagnosis }
  | { readonly event: "plan"; readonly plan: AgentPlan }
  | { readonly event: "state-patch"; readonly state_patch: AgentStatePatch }
  | { readonly event: "done"; readonly final_message: string | null };

export interface AgentRunResult {
  readonly graph_state: {
    readonly signals: ReadonlyArray<AgentSignal>;
    readonly learner_unit_state: AgentLearnerUnitState | null;
    readonly diagnosis: AgentDiagnosis | null;
    readonly plan: AgentPlan | null;
    readonly assistant_message: string | null;
    readonly state_patch: AgentStatePatch | null;
    readonly rationale: ReadonlyArray<string>;
  };
  readonly events: ReadonlyArray<AgentStreamEvent>;
}

export interface RuntimeSignalCard {
  readonly id: string;
  readonly label: string;
  readonly observation: string;
  readonly implication: string;
}

export interface RuntimeSnapshot {
  readonly source: "mock" | "live-agent";
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
  readonly assistantMessage: string;
  readonly rationale: ReadonlyArray<string>;
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

  return (
    events
      .filter(
        (event): event is Extract<AgentStreamEvent, { event: "text-delta" }> =>
          event.event === "text-delta",
      )
      .map((event) => event.delta)
      .join("") || "Agent 已返回结构化结果。"
  );
}

export function buildDefaultAgentPrompt(
  profile: LearnerProfile,
  unit: LearningUnit,
  project: ProjectContext,
): string {
  return `我正在推进「${project.name}」，当前目标是${project.goal}。我现在属于「${profile.name}」这个阶段：${profile.role}。请围绕「${unit.title}」判断我这轮更适合先学什么，并解释为什么。`;
}

export function buildAgentRequest(input: {
  readonly projectId: string;
  readonly sessionId: string;
  readonly entryMode: AgentEntryMode;
  readonly prompt: string;
  readonly profile: LearnerProfile;
  readonly project: ProjectContext;
  readonly sourceAssets: ReadonlyArray<SourceAsset>;
  readonly unit: LearningUnit;
}): AgentRequest {
  const normalizedPrompt = input.prompt.trim();
  const fallbackPrompt =
    normalizedPrompt || buildDefaultAgentPrompt(input.profile, input.unit, input.project);
  const sourceAssetIds =
    input.entryMode === "material-import"
      ? input.sourceAssets.map((asset) => asset.id)
      : input.sourceAssets.slice(0, 2).map((asset) => asset.id);

  return {
    project_id: input.projectId,
    thread_id: input.sessionId,
    entry_mode: input.entryMode,
    topic: input.unit.title,
    messages: [{ role: "user", content: fallbackPrompt }],
    source_asset_ids: sourceAssetIds,
    target_unit_id: input.unit.id,
    context_hint: `${input.project.currentThread} 当前学习者画像：${input.profile.role}`,
    response_mode: "stream",
  };
}

export function buildMockRuntimeSnapshot(
  profile: LearnerProfile,
  unit: LearningUnit,
): RuntimeSnapshot {
  const plan = buildStudyPlan(unit, profile.state);

  return {
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
    assistantMessage: `${plan.decision.reason} 这轮我会先用「${plan.decision.title}」推进，目标是${plan.decision.objective}。`,
    rationale: [],
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
    assistantMessage: buildAssistantMessageFromEvents(result),
    rationale: result.graph_state.rationale,
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
  const statePatchEvent = input.events.find(
    (event): event is Extract<AgentStreamEvent, { event: "state-patch" }> =>
      event.event === "state-patch",
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
        learnerPatch?.next_review_at ??
          statePatchEvent?.state_patch.review_patch?.scheduled_at ??
          null,
      ),
    },
    stateSource: stateSourceParts.join(" "),
    signalCards: [],
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
    assistantMessage: buildAssistantMessageFromStreamEvents(input.events),
    rationale: diagnosis.explanation?.evidence ?? [],
  };
}
