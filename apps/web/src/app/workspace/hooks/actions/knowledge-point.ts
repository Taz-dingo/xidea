import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useKnowledgePointActions(data: WorkspaceData) {
  function handleAcceptKnowledgePointSuggestion(sessionId: string): void {
    const suggestion = data.sessionKnowledgePointSuggestions[sessionId] ?? null;

    if (suggestion === null || suggestion.acceptedKnowledgePointId !== null) {
      return;
    }

    const existingPoint =
      data.knowledgePoints.find(
        (point) =>
          point.projectId === suggestion.projectId &&
          point.title.trim().toLowerCase() === suggestion.title.trim().toLowerCase(),
      ) ?? null;

    const acceptedKnowledgePointId =
      existingPoint?.id ?? `point-${Date.now()}`;

    if (existingPoint === null) {
      data.setKnowledgePoints((current) => [
        {
          id: acceptedKnowledgePointId,
          projectId: suggestion.projectId,
          title: suggestion.title,
          description: suggestion.description,
          status: "active_unlearned",
          mastery: 0,
          stageLabel: "待系统编排",
          nextReviewLabel: null,
          updatedAt: "刚刚",
          sourceAssetIds: suggestion.sourceAssetIds,
          archiveSuggestion: null,
        },
        ...current,
      ]);
    }

    data.setSelectedKnowledgePointId(acceptedKnowledgePointId);
    data.setSessionKnowledgePointSuggestions((current) => ({
      ...current,
      [sessionId]: {
        ...suggestion,
        acceptedKnowledgePointId,
      },
    }));
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

  return {
    handleAcceptKnowledgePointSuggestion,
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
    handleDismissKnowledgePointSuggestion: (sessionId: string) =>
      data.setSessionKnowledgePointSuggestions((current) => ({
        ...current,
        [sessionId]: null,
      })),
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
