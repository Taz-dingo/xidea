import type {
  SessionItem,
  SessionType,
} from "@/domain/project-workspace";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

function buildFocusedSessionKickoff(type: SessionType, knowledgePointTitle: string | null): {
  readonly text: string;
  readonly sessionSummary: string;
} {
  const focusTitle = knowledgePointTitle?.trim() || "当前知识点";

  if (type === "review") {
    return {
      text: `围绕「${focusTitle}」开始这一轮复习，先从这个知识点出第一张卡，再按需要带上相关知识点。`,
      sessionSummary: `围绕「${focusTitle}」开始复习`,
    };
  }

  return {
    text: `围绕「${focusTitle}」开始这一轮学习，先从这个知识点出第一张卡，再按需要带上相关知识点。`,
    sessionSummary: `围绕「${focusTitle}」开始学习`,
  };
}

export function useSessionActions(data: WorkspaceData) {
  function handleCreateSession(
    projectId: string,
    type: SessionType = "project",
    knowledgePointId: string | null = null,
    initialSourceAssetIds: ReadonlyArray<string> = [],
  ): SessionItem | null {
    const targetProject =
      data.projects.find((project) => project.id === projectId) ??
      data.selectedProject ??
      data.projects[0];

    if (targetProject === undefined) {
      return null;
    }

    const targetPoint =
      knowledgePointId === null
        ? null
        : (data.knowledgePoints.find((point) => point.id === knowledgePointId) ?? null);

    const nextIndex =
      data.sessions.filter((session) => session.projectId === targetProject.id)
        .length + 1;
    const createdSession: SessionItem = {
      id: `session-${Date.now()}`,
      projectId: targetProject.id,
      type,
      knowledgePointId,
      title:
        type === "project"
          ? "新研讨"
          : type === "review"
            ? "新复习"
            : "新学习",
      summary:
        type === "study"
          ? "围绕未学知识点启动一轮学习。"
          : type === "review"
            ? "围绕待复习知识点安排一轮回拉。"
            : "继续围绕项目目标推进材料与知识点。",
      updatedAt: "刚刚",
      status: "空白",
    };

    data.setSessions((current) => [createdSession, ...current]);
    data.setSessionMessagesById((current) => ({
      ...current,
      [createdSession.id]: [],
    }));
    data.setDraftPrompt("");
    data.sessionEntryModesSetter((current) => ({
      ...current,
      [createdSession.id]: "chat-question",
    }));
    data.setSessionSourceAssetIds((current) => ({
      ...current,
      [createdSession.id]: type === "project" ? initialSourceAssetIds : [],
    }));
    data.setSelectedProjectId(targetProject.id);
    data.setSelectedSessionId(createdSession.id);
    data.setIsEditingProjectMeta(false);
    data.setIsProjectMetaOpen(false);
    data.setPendingSessionIntent(null);
    data.setScreen("workspace");
    return createdSession;
  }

  function handlePrepareSessionStart(
    projectId: string,
    type: SessionType,
    knowledgePointId: string | null = null,
  ): void {
    const targetProject =
      data.projects.find((project) => project.id === projectId) ??
      data.selectedProject ??
      data.projects[0];

    if (targetProject === undefined) {
      return;
    }

    const targetPoint =
      knowledgePointId === null
        ? null
        : (data.knowledgePoints.find((point) => point.id === knowledgePointId) ?? null);

    data.setSelectedProjectId(targetProject.id);
    data.setSelectedKnowledgePointId(targetPoint?.id ?? data.selectedKnowledgePointId);
    data.setWorkspaceSection(type === "review" ? "due-review" : "overview");
    data.setIsEditingProjectMeta(false);
    data.setIsProjectMetaOpen(false);
    data.setIsKnowledgePointDialogOpen(false);
    data.setPendingInitialPrompt(null);
    data.setPendingSessionIntent({
      projectId: targetProject.id,
      type,
      knowledgePointId: targetPoint?.id ?? knowledgePointId,
      knowledgePointTitle: targetPoint?.title ?? null,
    });
    data.setSelectedSessionId("");
    data.setDraftPrompt("");
    data.setSearchQuery("");
    data.setScreen("workspace");
  }

  function handleQuickStartFocusedSession(
    projectId: string,
    type: Exclude<SessionType, "project">,
    knowledgePointId: string,
  ): void {
    const targetProject =
      data.projects.find((project) => project.id === projectId) ??
      data.selectedProject ??
      data.projects[0];

    if (targetProject === undefined) {
      return;
    }

    const targetPoint =
      data.knowledgePoints.find((point) => point.id === knowledgePointId) ?? null;

    const createdSession = handleCreateSession(
      targetProject.id,
      type,
      targetPoint?.id ?? knowledgePointId,
    );

    if (createdSession === null) {
      return;
    }

    const kickoff = buildFocusedSessionKickoff(type, targetPoint?.title ?? null);

    data.setSelectedKnowledgePointId(targetPoint?.id ?? data.selectedKnowledgePointId);
    data.setPendingInitialPrompt({
      sessionId: createdSession.id,
      text: kickoff.text,
      sessionSummary: kickoff.sessionSummary,
    });
  }

  return {
    handleCancelPendingSession: () => {
      data.setPendingSessionIntent(null);
      data.setDraftPrompt("");
    },
    handleCreateSession,
    handlePrepareSessionStart,
    handleQuickStartFocusedSession,
    handleTogglePendingMaterial: (_assetId: string) => {},
  };
}
