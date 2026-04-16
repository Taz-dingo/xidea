import { formatActivitySubmissionForAgent } from "@/domain/agent-runtime";
import type { TutorFixtureScenario } from "@/data/tutor-fixtures";
import { getActionLabel } from "@/domain/project-session-runtime";
import type { LearningActivitySubmission } from "@/domain/types";
import {
  buildFreeReplyFixtureState,
  buildSubmittedFixtureState,
  buildSkippedFixtureState,
  selectFixture,
  setDevTutorFixtureQueryParam,
} from "@/app/workspace/agent/session-fixture";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function createSessionActions({
  activeRuntime,
  activeTutorFixture,
  clearError,
  currentActivity,
  currentActivityKey,
  data,
  error,
  handleCreateSession,
  isMaterialsTrayOpen,
  isUsingDevTutorFixture,
  selectedSessionKey,
  sendMessage,
}: {
  activeRuntime: {
    state: { recommendedAction: "apply" | "clarify" | "practice" | "review" | "teach" };
  };
  activeTutorFixture:
    | {
        id: string;
        skipReply: string;
        submitReply: string;
        submitErrorMessage: string | null;
      }
    | null;
  clearError: () => void;
  currentActivity:
    | Parameters<typeof formatActivitySubmissionForAgent>[0]["activity"]
    | null;
  currentActivityKey: string | null;
  data: WorkspaceData;
  error: Error | undefined;
  handleCreateSession: (
    projectId: string,
    type?: "project" | "study" | "review",
    knowledgePointId?: string | null,
    initialSourceAssetIds?: ReadonlyArray<string>,
  ) => { id: string } | null;
  isMaterialsTrayOpen: boolean;
  isUsingDevTutorFixture: boolean;
  selectedSessionKey: string | null;
  sendMessage: (message: { text: string }) => PromiseLike<void> | void;
}) {
  function handleSendToAgent(text: string, sessionSummary: string): void {
    if (data.selectedSession === undefined) {
      return;
    }

    data.setSessions((current) =>
      current.map((session) =>
        session.id === data.selectedSession!.id
          ? { ...session, summary: sessionSummary, updatedAt: "刚刚", status: "运行中" }
          : session,
      ),
    );
    data.setRunningSessionIds((current) => ({ ...current, [data.selectedSession!.id]: true }));
    void sendMessage({ text });
  }

  function handleSubmitPrompt(): void {
    const text = data.draftPrompt.trim();
    if (text === "") {
      return;
    }

    if (data.selectedSession === undefined) {
      if (data.pendingSessionIntent === null) {
        return;
      }

      const createdSession = handleCreateSession(
        data.pendingSessionIntent.projectId,
        data.pendingSessionIntent.type,
        data.pendingSessionIntent.knowledgePointId,
        data.pendingSessionIntent.sourceAssetIds,
      );
      if (createdSession !== null) {
        data.setPendingInitialPrompt({ sessionId: createdSession.id, text, sessionSummary: text });
        data.setDraftPrompt("");
      }
      return;
    }

    if (isUsingDevTutorFixture) {
      data.setDevTutorFixtureState((current) =>
        current === null ? current : buildFreeReplyFixtureState(current, text),
      );
      data.setDraftPrompt("");
      return;
    }

    handleSendToAgent(text, text);
    data.setDraftPrompt("");
  }

  function handleSubmitActivity(submission: LearningActivitySubmission): void {
    if (data.selectedSession === undefined || currentActivity === null || currentActivityKey === null) {
      return;
    }
    if (error !== undefined) {
      clearError();
    }

    data.setActivityResolutionsBySession((current) => ({
      ...current,
      [data.selectedSession!.id]: {
        ...(current[data.selectedSession!.id] ?? {}),
        [currentActivityKey]: "submitted",
      },
    }));

    if (isUsingDevTutorFixture && activeTutorFixture !== null) {
      if (activeTutorFixture.submitErrorMessage !== null) {
        data.setDevTutorFixtureState((current) =>
          current === null
            ? current
            : { ...current, errorMessage: activeTutorFixture.submitErrorMessage },
        );
        return;
      }

      const submissionText = formatActivitySubmissionForAgent({ activity: currentActivity, submission });
      data.setDevTutorFixtureState((current) =>
        current === null
          ? current
          : buildSubmittedFixtureState(current, submissionText, activeTutorFixture.submitReply),
      );
      return;
    }

    handleSendToAgent(
      formatActivitySubmissionForAgent({ activity: currentActivity, submission }),
      `${currentActivity.title} / ${getActionLabel(activeRuntime.state.recommendedAction)}`,
    );
  }

  function handleSkipActivity(): void {
    if (data.selectedSession === undefined || currentActivity === null || currentActivityKey === null) {
      return;
    }
    if (error !== undefined) {
      clearError();
    }

    data.setActivityResolutionsBySession((current) => ({
      ...current,
      [data.selectedSession!.id]: {
        ...(current[data.selectedSession!.id] ?? {}),
        [currentActivityKey]: "skipped",
      },
    }));

    if (isUsingDevTutorFixture && activeTutorFixture !== null) {
      data.setDevTutorFixtureState((current) =>
        current === null
          ? current
          : buildSkippedFixtureState(current, currentActivity.title, activeTutorFixture.skipReply),
      );
      return;
    }

    handleSendToAgent(
      `我先跳过「${currentActivity.title}」这轮学习动作。请基于当前状态重新安排下一步，并告诉我为什么要这样推进。`,
      `${currentActivity.title} / 跳过后重新编排`,
    );
  }

  return {
    handleChangeDraftPrompt: (value: string) => {
      if (error !== undefined) {
        clearError();
      }
      if (isUsingDevTutorFixture) {
        data.setDevTutorFixtureState((current) =>
          current === null ? current : { ...current, errorMessage: null },
        );
      }
      data.setDraftPrompt(value);
    },
    handleDisableTutorFixture: () => {
      setDevTutorFixtureQueryParam(null);
      data.setDevTutorFixtureState(null);
    },
    handleSelectTutorFixture: (fixture: TutorFixtureScenario) => {
      data.setDevTutorFixtureState(selectFixture(fixture));
    },
    handleSkipActivity,
    handleSubmitActivity,
    handleSubmitPrompt,
    handleToggleMaterialsTray: () => {
      if (selectedSessionKey !== null) {
        data.setSessionMaterialTrayOpen((current) => ({
          ...current,
          [selectedSessionKey]: !isMaterialsTrayOpen,
        }));
      }
    },
    handleToggleProjectMaterial: (assetId: string) => {
      if (data.selectedSession !== undefined) {
        data.setSessionSourceAssetIds((current) => {
          const currentSelection = current[data.selectedSession!.id] ?? [];
          return {
            ...current,
            [data.selectedSession!.id]: currentSelection.includes(assetId)
              ? currentSelection.filter((id) => id !== assetId)
              : [...currentSelection, assetId],
          };
        });
      }
    },
    handleUnsetSourceAsset: (assetId: string) => {
      if (data.selectedSession !== undefined) {
        data.setSessionSourceAssetIds((current) => ({
          ...current,
          [data.selectedSession!.id]: (current[data.selectedSession!.id] ?? []).filter(
            (id) => id !== assetId,
          ),
        }));
      }
    },
  };
}
