import { deleteKnowledgePoint } from "@/lib/agent-client";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useKnowledgePointActions(data: WorkspaceData) {
  function handleOpenKnowledgePointEditor(pointId: string): void {
    const targetPoint =
      data.knowledgePoints.find((point) => point.id === pointId) ?? null;

    if (targetPoint === null) {
      return;
    }

    data.setSelectedKnowledgePointId(targetPoint.id);
    data.setSelectedSessionId("");
    data.setArchiveConfirmationPointId(null);
    data.setIsEditingProjectMeta(false);
    data.setIsProjectMetaOpen(false);
    data.setKnowledgePointDraft({
      title: targetPoint.title,
      description: targetPoint.description,
    });
    data.setIsEditingKnowledgePoint(true);
    data.setPendingSessionIntent(null);
    data.setIsKnowledgePointDialogOpen(true);
  }

  function handleArchiveKnowledgePoint(pointId: string): void {
    data.setKnowledgePoints((current) =>
      current.map((point) =>
        point.id === pointId
          ? {
              ...point,
              status:
                point.status === "archived" ? "active_review" : "archived",
              stageLabel: point.status === "archived" ? "待复习" : "已归档",
              nextReviewLabel:
                point.status === "archived" ? "等待重新安排" : null,
              archiveSuggestion: null,
              updatedAt: "刚刚",
            }
          : point,
      ),
    );
    data.setArchiveConfirmationPointId(null);
  }

  function handleSaveKnowledgePoint(): void {
    if (data.selectedKnowledgePoint === null) {
      return;
    }

    const nextTitle = data.knowledgePointDraft.title.trim();
    const nextDescription = data.knowledgePointDraft.description.trim();
    if (nextTitle === "" || nextDescription === "") {
      return;
    }

    data.setKnowledgePoints((current) =>
      current.map((point) =>
        point.id === data.selectedKnowledgePoint?.id
          ? {
              ...point,
              title: nextTitle,
              description: nextDescription,
              updatedAt: "刚刚",
            }
          : point,
      ),
    );
    data.setIsEditingKnowledgePoint(false);
    data.setArchiveConfirmationPointId(null);
  }

  function handleDeleteKnowledgePoint(pointId: string): void {
    const targetPoint =
      data.knowledgePoints.find((point) => point.id === pointId) ?? null;
    if (targetPoint === null) {
      return;
    }

    void deleteKnowledgePoint(targetPoint.projectId, pointId).catch(() => undefined);

    data.setKnowledgePoints((current) =>
      current.filter((point) => point.id !== pointId),
    );
    data.setSessions((current) =>
      current.map((session) =>
        session.knowledgePointId === pointId
          ? { ...session, knowledgePointId: null }
          : session,
      ),
    );
    data.setArchiveConfirmationPointId(null);
    data.setIsEditingKnowledgePoint(false);
    data.setIsKnowledgePointDialogOpen(false);
    data.setSelectedKnowledgePointId((current) => {
      if (current !== pointId) {
        return current;
      }
      const fallbackPoint = data.knowledgePoints.find(
        (point) => point.projectId === targetPoint.projectId && point.id !== pointId,
      );
      return fallbackPoint?.id ?? "";
    });
  }

  return {
    handleArchiveKnowledgePoint,
    handleCancelKnowledgePointEditing: () => {
      if (data.selectedKnowledgePoint === null) {
        return;
      }
      data.setKnowledgePointDraft({
        title: data.selectedKnowledgePoint.title,
        description: data.selectedKnowledgePoint.description,
      });
      data.setIsEditingKnowledgePoint(false);
    },
    handleDeleteKnowledgePoint,
    handleOpenKnowledgePointEditor,
    handleSaveKnowledgePoint,
    handleStartArchiveConfirmation: (pointId: string) =>
      data.setArchiveConfirmationPointId((current) =>
        current === pointId ? null : pointId,
      ),
    handleStartEditingKnowledgePoint: () => {
      if (data.selectedKnowledgePoint === null) {
        return;
      }
      data.setArchiveConfirmationPointId(null);
      data.setKnowledgePointDraft({
        title: data.selectedKnowledgePoint.title,
        description: data.selectedKnowledgePoint.description,
      });
      data.setIsEditingKnowledgePoint(true);
    },
  };
}
