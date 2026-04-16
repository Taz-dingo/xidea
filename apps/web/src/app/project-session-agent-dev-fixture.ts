import type { TutorFixtureScenario } from "@/data/tutor-fixtures";
import {
  buildDevTutorFixtureState,
  createFixtureUiMessage,
  getNextFixtureSnapshot,
  type DevTutorFixtureState,
} from "@/domain/project-session-runtime";

export function setDevTutorFixtureQueryParam(fixtureId: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (fixtureId === null) {
    url.searchParams.delete("mockTutor");
  } else {
    url.searchParams.set("mockTutor", fixtureId);
  }
  window.history.replaceState({}, "", url);
}

export function buildFreeReplyFixtureState(
  current: DevTutorFixtureState,
  text: string,
): DevTutorFixtureState {
  const assistantReply =
    "这是 dev fixture 的本地回复，用来继续打磨消息流密度、markdown 样式和无卡片场景。";

  return {
    ...current,
    errorMessage: null,
    messages: [
      ...current.messages,
      createFixtureUiMessage("user", text, "free-user"),
      createFixtureUiMessage("assistant", assistantReply, "free-assistant"),
    ],
    snapshot: {
      ...current.snapshot,
      activity: null,
      activities: [],
      assistantMessage: assistantReply,
    },
  };
}

export function buildSubmittedFixtureState(
  current: DevTutorFixtureState,
  submissionText: string,
  submitReply: string,
): DevTutorFixtureState {
  return {
    ...current,
    errorMessage: null,
    messages: [
      ...current.messages,
      createFixtureUiMessage("user", submissionText, "submit-user"),
      createFixtureUiMessage("assistant", submitReply, "submit-assistant"),
    ],
    snapshot: getNextFixtureSnapshot(current.snapshot, submitReply),
  };
}

export function buildSkippedFixtureState(
  current: DevTutorFixtureState,
  activityTitle: string,
  skipReply: string,
): DevTutorFixtureState {
  return {
    ...current,
    errorMessage: null,
    messages: [
      ...current.messages,
      createFixtureUiMessage(
        "user",
        `我先跳过「${activityTitle}」这轮学习动作。`,
        "skip-user",
      ),
      createFixtureUiMessage("assistant", skipReply, "skip-assistant"),
    ],
    snapshot: getNextFixtureSnapshot(current.snapshot, skipReply),
  };
}

export function selectFixture(fixture: TutorFixtureScenario): DevTutorFixtureState {
  setDevTutorFixtureQueryParam(fixture.id);
  return buildDevTutorFixtureState(fixture);
}
