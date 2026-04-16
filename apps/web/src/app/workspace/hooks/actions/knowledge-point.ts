import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useKnowledgePointActions(data: WorkspaceData) {
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
