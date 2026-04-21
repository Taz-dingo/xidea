import { startTransition } from "react";
import type { WorkspaceSection } from "@/domain/project-workspace";
import { deleteThread } from "@/lib/agent-client";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useNavigationActions(data: WorkspaceData) {
  function handleSelectProject(projectId: string): void {
    data.setSelectedProjectId(projectId);
    data.setSelectedSessionId("");
    data.setDraftPrompt("");
    data.setWorkspaceSection("overview");
    data.setIsProjectMetaOpen(false);
    data.setIsEditingProjectMeta(false);
    data.setIsCreatingProject(false);
    data.setPendingSessionIntent(null);
    data.setPendingInitialPrompt(null);
    data.setScreen("workspace");
    startTransition(() => {
      const firstKnowledgePoint = data.knowledgePoints.find(
        (point) => point.projectId === projectId,
      );
      data.setSelectedKnowledgePointId(firstKnowledgePoint?.id ?? "");
    });
  }

  function handleOpenKnowledgePoint(pointId: string): void {
    data.setSelectedKnowledgePointId(pointId);
    data.setIsEditingKnowledgePoint(false);
    data.setIsEditingProjectMeta(false);
    data.setIsProjectMetaOpen(false);
    data.setPendingSessionIntent(null);
    data.setIsKnowledgePointDialogOpen(true);
  }

  function handleOpenSession(sessionId: string): void {
    data.setPendingSessionIntent(null);
    data.setIsKnowledgePointDialogOpen(false);
    data.setSelectedSessionId(sessionId);
    data.setScreen("workspace");
  }

  function handleSessionWorkspaceSectionChange(section: WorkspaceSection): void {
    data.setWorkspaceSection(section);
    data.setSelectedSessionId("");
  }

  function handleDeleteSession(sessionId?: string): void {
    const targetSessionId = sessionId ?? data.selectedSession?.id;
    if (!targetSessionId) {
      return;
    }

    void deleteThread(targetSessionId).catch(() => undefined);
    data.setSessions((current) => current.filter((session) => session.id !== targetSessionId));
    data.setSessionMessagesById((current) => {
      const next = { ...current };
      delete next[targetSessionId];
      return next;
    });
    data.setSessionSnapshots((current) => {
      const next = { ...current };
      delete next[targetSessionId];
      return next;
    });
    data.setSessionReviewInspectors((current) => {
      const next = { ...current };
      delete next[targetSessionId];
      return next;
    });
    data.setSessionSourceAssetIds((current) => {
      const next = { ...current };
      delete next[targetSessionId];
      return next;
    });
    data.sessionEntryModesSetter((current) => {
      const next = { ...current };
      delete next[targetSessionId];
      return next;
    });
    data.setRunningSessionIds((current) => {
      const next = { ...current };
      delete next[targetSessionId];
      return next;
    });
    data.setActivityBatchStateBySession((current) => {
      const next = { ...current };
      delete next[targetSessionId];
      return next;
    });
    data.setActivityReplayStateBySession((current) => {
      const next = { ...current };
      delete next[targetSessionId];
      return next;
    });
    data.setActivityResolutionsBySession((current) => {
      const next = { ...current };
      delete next[targetSessionId];
      return next;
    });
    data.setCompletedActivityDecksBySession((current) => {
      const next = { ...current };
      delete next[targetSessionId];
      return next;
    });
    if (data.selectedSession?.id === targetSessionId) {
      data.setSelectedSessionId("");
    }
  }

  return {
    handleCloseKnowledgePointDialog: () => data.setIsKnowledgePointDialogOpen(false),
    handleCloseProjectMeta: () => {
      data.setIsProjectMetaOpen(false);
      data.setIsEditingProjectMeta(false);
    },
    handleCloseSession: () => data.setSelectedSessionId(""),
    handleDeleteSession,
    handleGoHome: () => {
      data.setScreen("home");
      data.setIsKnowledgePointDialogOpen(false);
      data.setSelectedSessionId("");
    },
    handleOpenKnowledgePoint,
    handleOpenSession,
    handleSelectProject,
    handleSessionWorkspaceSectionChange,
  };
}
