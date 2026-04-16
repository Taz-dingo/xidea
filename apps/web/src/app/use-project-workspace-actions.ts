import { startTransition } from "react";
import type { SessionItem, SessionType, WorkspaceSection } from "@/domain/project-workspace";
import { getDefaultSourceAssetIds } from "@/domain/project-session-runtime";
import type { ProjectWorkspaceData } from "@/app/use-project-workspace-data";

export function useProjectWorkspaceActions(data: ProjectWorkspaceData) {
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

  function handleStartCreatingProject(): void {
    data.setProjectDraft({
      name: "",
      topic: "",
      description: "",
      specialRulesText: "",
      initialMaterialIds: [],
    });
    data.setIsCreatingProject(true);
    data.setIsProjectMetaOpen(false);
    data.setPendingSessionIntent(null);
  }

  function handleSaveProject(): void {
    const nextName = data.projectDraft.name.trim();
    const nextTopic = data.projectDraft.topic.trim();
    const nextDescription = data.projectDraft.description.trim();
    const specialRules = data.projectDraft.specialRulesText
      .split("\n")
      .map((rule) => rule.trim())
      .filter((rule) => rule !== "");

    if (nextName === "" || nextTopic === "" || nextDescription === "") {
      return;
    }

    const createdProject = {
      id: `project-${Date.now()}`,
      name: nextName,
      topic: nextTopic,
      description: nextDescription,
      specialRules:
        specialRules.length > 0
          ? specialRules
          : ["先收敛主题和材料，再开始学习编排。"],
      updatedAt: "刚刚",
    };
    const createdSession: SessionItem = {
      id: `session-${Date.now()}-project`,
      projectId: createdProject.id,
      type: "project",
      knowledgePointId: null,
      title: "初始 project session",
      summary: "围绕项目目标、材料边界和知识点池初始化这轮工作区。",
      updatedAt: "刚刚",
      status: "空白",
    };

    data.setProjects((current) => [createdProject, ...current]);
    data.setProjectMaterialIdsByProject((current) => ({
      ...current,
      [createdProject.id]: data.projectDraft.initialMaterialIds,
    }));
    data.setSessions((current) => [createdSession, ...current]);
    data.setSessionMessagesById((current) => ({ ...current, [createdSession.id]: [] }));
    data.setSessionSourceAssetIds((current) => ({
      ...current,
      [createdSession.id]: getDefaultSourceAssetIds(),
    }));
    data.setSelectedKnowledgePointId("");
    data.setSelectedProjectId(createdProject.id);
    data.setSelectedSessionId("");
    data.setIsProjectMetaOpen(true);
    data.setIsCreatingProject(false);
    data.setPendingSessionIntent(null);
    data.setSearchQuery("");
    data.setScreen("workspace");
  }

  function handleStartEditingProjectMeta(): void {
    data.setProjectMetaDraft({
      topic: data.selectedProject.topic,
      description: data.selectedProject.description,
      specialRulesText: data.selectedProject.specialRules.join("\n"),
      materialIds: data.projectMaterialIdsByProject[data.selectedProject.id] ?? [],
    });
    data.setIsEditingProjectMeta(true);
  }

  function handleSaveProjectMeta(): void {
    const nextTopic = data.projectMetaDraft.topic.trim();
    const nextDescription = data.projectMetaDraft.description.trim();
    const nextSpecialRules = data.projectMetaDraft.specialRulesText
      .split("\n")
      .map((rule) => rule.trim())
      .filter((rule) => rule !== "");

    if (nextTopic === "" || nextDescription === "") {
      return;
    }

    data.setProjects((current) =>
      current.map((project) =>
        project.id === data.selectedProject.id
          ? {
              ...project,
              topic: nextTopic,
              description: nextDescription,
              specialRules:
                nextSpecialRules.length > 0
                  ? nextSpecialRules
                  : ["先收敛主题和材料，再开始学习编排。"],
              updatedAt: "刚刚",
            }
          : project,
      ),
    );
    data.setProjectMaterialIdsByProject((current) => ({
      ...current,
      [data.selectedProject.id]: data.projectMetaDraft.materialIds,
    }));
    data.setIsEditingProjectMeta(false);
  }

  function handleCancelEditingProjectMeta(): void {
    data.setProjectMetaDraft({
      topic: data.selectedProject.topic,
      description: data.selectedProject.description,
      specialRulesText: data.selectedProject.specialRules.join("\n"),
      materialIds: data.projectMaterialIdsByProject[data.selectedProject.id] ?? [],
    });
    data.setIsEditingProjectMeta(false);
  }

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
        : data.knowledgePoints.find((point) => point.id === knowledgePointId) ?? null;
    const projectMaterialIds = data.projectMaterialIdsByProject[targetProject.id] ?? [];
    const suggestedSourceAssetIds =
      targetPoint === null
        ? []
        : targetPoint.sourceAssetIds.filter((assetId) => projectMaterialIds.includes(assetId));

    data.setSelectedProjectId(targetProject.id);
    data.setSelectedSessionId("");
    data.setSelectedKnowledgePointId(targetPoint?.id ?? data.selectedKnowledgePointId);
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
      data.sessions.filter((session) => session.projectId === targetProject.id).length + 1;
    const titlePrefix = type === "study" ? "学习" : type === "review" ? "复习" : "project";
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
    data.setSessionMessagesById((current) => ({ ...current, [createdSession.id]: [] }));
    data.setDraftPrompt("");
    data.sessionEntryModesSetter((current) => ({ ...current, [createdSession.id]: "chat-question" }));
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

  function handleOpenKnowledgePoint(pointId: string): void {
    data.setSelectedKnowledgePointId(pointId);
    data.setSelectedSessionId("");
    data.setIsEditingProjectMeta(false);
    data.setIsProjectMetaOpen(false);
    data.setPendingSessionIntent(null);
    data.setScreen("detail");
  }

  function handleArchiveKnowledgePoint(pointId: string): void {
    data.setKnowledgePoints((current) =>
      current.map((point) =>
        point.id === pointId
          ? {
              ...point,
              status: point.status === "archived" ? "active_review" : "archived",
              stageLabel: point.status === "archived" ? "待复习" : "已归档",
              nextReviewLabel: point.status === "archived" ? "等待重新安排" : null,
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
          ? { ...point, title: nextTitle, description: nextDescription, updatedAt: "刚刚" }
          : point,
      ),
    );
    data.setIsEditingKnowledgePoint(false);
    data.setArchiveConfirmationPointId(null);
  }

  function handleSessionWorkspaceSectionChange(section: WorkspaceSection): void {
    data.setWorkspaceSection(section);
    data.setSelectedSessionId("");
  }

  return {
    handleArchiveKnowledgePoint,
    handleCancelCreatingProject: () => data.setIsCreatingProject(false),
    handleCancelEditingProjectMeta,
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
    handleCancelPendingSession: () => {
      data.setPendingSessionIntent(null);
      data.setDraftPrompt("");
    },
    handleCloseProjectMeta: () => {
      data.setIsProjectMetaOpen(false);
      data.setIsEditingProjectMeta(false);
    },
    handleCloseSession: () => data.setSelectedSessionId(""),
    handleCreateSession,
    handleGoHome: () => {
      data.setScreen("home");
      data.setSelectedSessionId("");
    },
    handleBackToWorkspace: () => data.setScreen("workspace"),
    handleOpenKnowledgePoint,
    handleOpenSession: (sessionId: string) => {
      data.setPendingSessionIntent(null);
      data.setSelectedSessionId(sessionId);
      data.setScreen("workspace");
    },
    handlePrepareSessionStart,
    handleSaveKnowledgePoint,
    handleSaveProject,
    handleSaveProjectMeta,
    handleSelectProject,
    handleSessionWorkspaceSectionChange,
    handleStartArchiveConfirmation: (pointId: string) =>
      data.setArchiveConfirmationPointId((current) => (current === pointId ? null : pointId)),
    handleStartCreatingProject,
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
    handleStartEditingProjectMeta,
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
    handleToggleProjectMeta: () => data.setIsProjectMetaOpen((current) => !current),
  };
}
