import type { UIMessage } from "ai";
import type {
  AgentAction,
  AgentActivityResult,
  AgentReviewEvent,
  RuntimeSnapshot,
} from "@/domain/agent-runtime";
import type { SessionType } from "@/domain/project-workspace";
import type { TutorFixtureScenario } from "@/data/tutor-fixtures";
import type {
  LearningActivity,
  LearningActivityKind,
  LearningActivityAttempt,
  LearningActivitySubmission,
} from "@/domain/types";

export type ActivityResolution = "submitted" | "skipped";

export interface ActivityBatchResult {
  readonly activityId: string;
  readonly activityTitle: string;
  readonly activityPrompt: string;
  readonly knowledgePointId: string | null;
  readonly kind: LearningActivityKind;
  readonly action: "submit" | "skip";
  readonly responseText: string;
  readonly selectedChoiceId: string | null;
  readonly isCorrect: boolean | null;
  readonly attempts: ReadonlyArray<LearningActivityAttempt>;
  readonly finalFeedback: string | null;
  readonly finalAnalysis: string | null;
}

export interface CompletedActivityDeck {
  readonly deckKey: string;
  readonly sessionId: string;
  readonly sessionType: SessionType;
  readonly knowledgePointId: string | null;
  readonly completedAt: string;
  readonly cards: ReadonlyArray<ActivityBatchResult>;
}

export interface SessionActivityBatchState {
  readonly assistantMessageIdBeforeSend: string | null;
  readonly awaitingAgent: boolean;
  readonly currentIndex: number;
  readonly deckKey: string;
  readonly results: ReadonlyArray<ActivityBatchResult>;
}

export interface DevTutorFixtureState {
  readonly fixtureId: string;
  readonly messages: ReadonlyArray<UIMessage>;
  readonly snapshot: RuntimeSnapshot;
  readonly errorMessage: string | null;
}

export function getActionLabel(action: AgentAction): string {
  switch (action) {
    case "apply":
      return "迁移验证";
    case "clarify":
      return "边界澄清";
    case "practice":
      return "练习强化";
    case "review":
      return "复习回拉";
    case "teach":
      return "导师建模";
  }
}

export function createFixtureUiMessage(
  role: "assistant" | "user",
  content: string,
  seed: string,
): UIMessage {
  return {
    id: `fixture-${seed}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    parts: [{ type: "text", text: content }],
    content,
  } as UIMessage;
}

export function buildDevTutorFixtureState(
  fixture: TutorFixtureScenario,
): DevTutorFixtureState {
  return {
    fixtureId: fixture.id,
    messages: fixture.messages.map((message, index) =>
      createFixtureUiMessage(message.role, message.content, `${fixture.id}-${index}`),
    ),
    snapshot: fixture.snapshot,
    errorMessage: null,
  };
}

export function getDefaultSourceAssetIds(): ReadonlyArray<string> {
  return [];
}

export function buildActivityDeckKey(snapshot: RuntimeSnapshot): string | null {
  const activityIds = snapshot.activities.map((activity) => activity.id);
  if (activityIds.length === 0) {
    return null;
  }

  return `${snapshot.assistantMessage || snapshot.decision.reason}::${activityIds.join("|")}`;
}

export function getVisibleActivitiesForBatch(input: {
  readonly activities: ReadonlyArray<LearningActivity>;
  readonly batchState: SessionActivityBatchState | null;
  readonly deckKey: string | null;
}): ReadonlyArray<LearningActivity> {
  if (
    input.batchState === null ||
    input.deckKey === null ||
    input.batchState.deckKey !== input.deckKey
  ) {
    return input.activities;
  }

  return input.activities.slice(input.batchState.currentIndex);
}

export function createActivityBatchResult(input: {
  readonly activity: LearningActivity;
  readonly knowledgePointId: string | null;
  readonly submission: LearningActivitySubmission | null;
  readonly action: "submit" | "skip";
}): ActivityBatchResult {
  return {
    activityId: input.activity.id,
    activityTitle: input.activity.title,
    activityPrompt: input.activity.prompt,
    knowledgePointId: input.knowledgePointId,
    kind: input.activity.kind,
    action: input.action,
    responseText: input.submission?.responseText.trim() ?? "",
    selectedChoiceId: input.submission?.selectedChoiceId ?? null,
    isCorrect: input.submission?.isCorrect ?? null,
    attempts: input.submission?.attempts ?? [],
    finalFeedback: input.submission?.finalFeedback ?? null,
    finalAnalysis: input.submission?.finalAnalysis ?? null,
  };
}

export function buildCompletedActivityDeck(input: {
  readonly deckKey: string;
  readonly sessionId: string;
  readonly sessionType: SessionType;
  readonly results: ReadonlyArray<ActivityBatchResult>;
}): CompletedActivityDeck | null {
  const lastResult = input.results.at(-1);
  if (lastResult === undefined) {
    return null;
  }

  return {
    deckKey: input.deckKey,
    sessionId: input.sessionId,
    sessionType: input.sessionType,
    knowledgePointId: lastResult.knowledgePointId,
    completedAt: new Date().toISOString(),
    cards: input.results,
  };
}

export function buildActivityBatchSummaryMessage(
  results: ReadonlyArray<ActivityBatchResult>,
): string {
  const lines = results.map((result, index) => {
    const prefix = result.action === "skip" ? "跳过" : "完成";
    const detail =
      result.action === "skip"
        ? "本轮先跳过。"
        : result.responseText !== ""
          ? `最终作答：${result.responseText}`
          : "我完成了这一步。";
    const attemptsSummary =
      result.attempts.length > 0
        ? `共尝试 ${result.attempts.length} 次，错误 ${result.attempts.filter((item) => item.isCorrect === false).length} 次。`
        : "";
    const analysis =
      result.finalAnalysis !== null && result.finalAnalysis.trim() !== ""
        ? `分析：${result.finalAnalysis}`
        : "";

    return `${index + 1}. [${prefix}] ${result.activityTitle} ${detail} ${attemptsSummary} ${analysis}`.trim();
  });

  return [
    "我刚完成了这一组学习动作：",
    ...lines,
    "请把这一组表现当成同一轮输入，统一判断下一步该怎么安排，并说明原因。",
  ].join("\n");
}

export function buildAggregateActivityResult(input: {
  readonly fallbackKnowledgePointId: string | null;
  readonly results: ReadonlyArray<ActivityBatchResult>;
  readonly runId: string;
  readonly sessionId: string;
  readonly sessionType: SessionType;
  readonly projectId: string;
}): AgentActivityResult | null {
  const lastResult = input.results.at(-1);
  const knowledgePointId =
    lastResult?.knowledgePointId ?? input.fallbackKnowledgePointId;

  if (lastResult === undefined || knowledgePointId === null) {
    return null;
  }

  const submittedCount = input.results.filter((item) => item.action === "submit").length;
  const skippedCount = input.results.length - submittedCount;
  const attemptCount = input.results.reduce((total, item) => total + item.attempts.length, 0);
  const incorrectAttemptCount = input.results.reduce(
    (total, item) =>
      total + item.attempts.filter((attempt) => attempt.isCorrect === false).length,
    0,
  );
  const correctCount = input.results.filter(
    (item) => item.action === "submit" && item.isCorrect === true,
  ).length;
  const normalizedScore =
    attemptCount === 0
      ? null
      : Number(
          (
            correctCount /
            Math.max(correctCount + incorrectAttemptCount * 0.35 + skippedCount * 0.5, 1)
          ).toFixed(2),
        );
  const meta: Record<string, unknown> = {
    batch_size: input.results.length,
    submitted_count: submittedCount,
    skipped_count: skippedCount,
    correct_count: correctCount,
    incorrect_attempt_count: incorrectAttemptCount,
    attempt_count: attemptCount,
    normalized_score: normalizedScore,
    items: input.results,
  };
  if (
    submittedCount > 0 &&
    skippedCount === 0 &&
    incorrectAttemptCount === 0 &&
    input.results.every((item) => item.action !== "submit" || item.isCorrect === true)
  ) {
    meta.correct = true;
  }

  return {
    run_id: input.runId,
    project_id: input.projectId,
    session_id: input.sessionId,
    activity_id: `batch-${lastResult.activityId}`,
    knowledge_point_id: knowledgePointId,
    result_type: input.sessionType === "review" ? "review" : "exercise",
    action: skippedCount === input.results.length ? "skip" : "submit",
    answer: buildActivityBatchSummaryMessage(input.results),
    meta,
  };
}

export function getNextFixtureSnapshot(
  snapshot: RuntimeSnapshot,
  assistantMessage: string,
): RuntimeSnapshot {
  const remainingActivities = snapshot.activities.slice(1);

  return {
    ...snapshot,
    activity: remainingActivities[0] ?? null,
    activities: remainingActivities,
    assistantMessage,
  };
}

export function getLatestReviewEvent(
  events: ReadonlyArray<AgentReviewEvent>,
  kind: AgentReviewEvent["event_kind"],
): AgentReviewEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.event_kind === kind) {
      return event;
    }
  }

  return null;
}

export function getErrorMessage(error: Error | undefined): string | null {
  if (error === undefined) {
    return null;
  }

  const message = error.message.trim();
  if (message === "") {
    return "Agent 当前不可用，请稍后重试。";
  }

  if (message.startsWith("{")) {
    return "Agent 当前不可用，请检查本地服务或代理配置。";
  }

  return message;
}

export function getRelativeTimeRank(label: string): number {
  if (label.includes("刚刚")) {
    return 6;
  }

  if (label.includes("今天") || label.includes("1h")) {
    return 5;
  }

  if (label.includes("昨天")) {
    return 4;
  }

  if (label.includes("2d") || label.includes("2 天前")) {
    return 3;
  }

  if (label.includes("3d") || label.includes("3 天前")) {
    return 2;
  }

  if (label.includes("天前")) {
    return 1;
  }

  return 0;
}
