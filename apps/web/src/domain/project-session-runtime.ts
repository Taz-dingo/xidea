import type { UIMessage } from "ai";
import type {
  AgentAction,
  AgentReviewEvent,
  RuntimeSnapshot,
} from "@/domain/agent-runtime";
import type { TutorFixtureScenario } from "@/data/tutor-fixtures";

export type ActivityResolution = "submitted" | "skipped";

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
