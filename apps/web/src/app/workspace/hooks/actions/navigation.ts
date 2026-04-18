import { startTransition } from "react";
import type { WorkspaceSection } from "@/domain/project-workspace";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useNavigationActions(data: WorkspaceData) {
  function handleSelectProject(projectId: string): void {
    data.setSelectedProjectId(projectId);
    data.setSelectedSessionId("");
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
      if (firstKnowledgePoint !== undefined) {
        data.setSelectedKnowledgePointId(firstKnowledgePoint.id);
      }
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
    data.setSelectedSessionId(sessionId);
    data.setScreen("workspace");
  }

  function handleSessionWorkspaceSectionChange(section: WorkspaceSection): void {
    data.setWorkspaceSection(section);
    data.setSelectedSessionId("");
  }

  return {
    handleCloseKnowledgePointDialog: () => data.setIsKnowledgePointDialogOpen(false),
    handleCloseProjectMeta: () => {
      data.setIsProjectMetaOpen(false);
      data.setIsEditingProjectMeta(false);
    },
    handleCloseSession: () => data.setSelectedSessionId(""),
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
