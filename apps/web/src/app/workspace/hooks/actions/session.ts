import type {
  SessionItem,
  SessionType,
} from "@/domain/project-workspace";
import { getDefaultSourceAssetIds } from "@/domain/project-session-runtime";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useSessionActions(data: WorkspaceData) {
  function handlePrepareSessionStart(
    projectId: string,
    type: Extract<SessionType, "review" | "study">,
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
        : (data.knowledgePoints.find(
            (point) => point.id === knowledgePointId,
          ) ?? null);
    const projectMaterialIds =
      data.projectMaterialIdsByProject[targetProject.id] ?? [];
    const suggestedSourceAssetIds =
      targetPoint === null
        ? []
        : targetPoint.sourceAssetIds.filter((assetId) =>
            projectMaterialIds.includes(assetId),
          );

    data.setSelectedProjectId(targetProject.id);
    data.setSelectedSessionId("");
    data.setSelectedKnowledgePointId(
      targetPoint?.id ?? data.selectedKnowledgePointId,
    );
    data.setWorkspaceSection(type === "review" ? "due-review" : "overview");
    data.setIsEditingProjectMeta(false);
    data.setIsProjectMetaOpen(false);
    data.setPendingInitialPrompt(null);
    data.setDraftPrompt("");
    data.setSearchQuery("");
    data.setPendingSessionIntent({
      projectId: targetProject.id,
      type,
      knowledgePointId: targetPoint?.id ?? knowledgePointId,
      knowledgePointTitle: targetPoint?.title ?? null,
      sourceAssetIds: suggestedSourceAssetIds,
    });
    data.setScreen("workspace");
  }

  function handleCreateSession(
    projectId: string,
    type: SessionType = "project",
    knowledgePointId: string | null = null,
    initialSourceAssetIds: ReadonlyArray<string> = getDefaultSourceAssetIds(),
  ): SessionItem | null {
    const targetProject =
      data.projects.find((project) => project.id === projectId) ??
      data.selectedProject ??
      data.projects[0];

    if (targetProject === undefined) {
      return null;
    }

    const nextIndex =
      data.sessions.filter((session) => session.projectId === targetProject.id)
        .length + 1;
    const titlePrefix =
      type === "study" ? "学习" : type === "review" ? "复习" : "project";
    const createdSession: SessionItem = {
      id: `session-${Date.now()}`,
      projectId: targetProject.id,
      type,
      knowledgePointId,
      title: `${titlePrefix} session ${nextIndex}`,
      summary:
        type === "study"
          ? "围绕未学知识点启动一轮学习。"
          : type === "review"
            ? "围绕待复习知识点安排一轮回拉。"
            : "继续围绕 project 目标推进材料与知识点。",
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
      [createdSession.id]: initialSourceAssetIds,
    }));
    data.setSelectedProjectId(targetProject.id);
    data.setSelectedSessionId(createdSession.id);
    data.setIsEditingProjectMeta(false);
    data.setIsProjectMetaOpen(false);
    data.setPendingSessionIntent(null);
    data.setScreen("workspace");
    return createdSession;
  }

  return {
    handleCancelPendingSession: () => {
      data.setPendingSessionIntent(null);
      data.setDraftPrompt("");
    },
    handleCreateSession,
    handlePrepareSessionStart,
    handleTogglePendingMaterial: (assetId: string) => {
      data.setPendingSessionIntent((current) =>
        current === null
          ? current
          : {
              ...current,
              sourceAssetIds: current.sourceAssetIds.includes(assetId)
                ? current.sourceAssetIds.filter((id) => id !== assetId)
                : [...current.sourceAssetIds, assetId],
            },
      );
    },
  };
}
