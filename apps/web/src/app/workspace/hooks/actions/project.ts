import type { SessionItem } from "@/domain/project-workspace";
import { getDefaultSourceAssetIds } from "@/domain/project-session-runtime";
import type { WorkspaceData } from "@/app/workspace/hooks/use-data";

export function useProjectActions(data: WorkspaceData) {
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
    data.setSessionMessagesById((current) => ({
      ...current,
      [createdSession.id]: [],
    }));
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
      materialIds:
        data.projectMaterialIdsByProject[data.selectedProject.id] ?? [],
    });
    data.setIsEditingProjectMeta(true);
  }

  function handleOpenProjectMetaEditor(): void {
    data.setIsProjectMetaOpen(true);
    handleStartEditingProjectMeta();
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
      materialIds:
        data.projectMaterialIdsByProject[data.selectedProject.id] ?? [],
    });
    data.setIsEditingProjectMeta(false);
  }

  return {
    handleCancelCreatingProject: () => data.setIsCreatingProject(false),
    handleCancelEditingProjectMeta,
    handleOpenProjectMetaEditor,
    handleSaveProject,
    handleSaveProjectMeta,
    handleStartCreatingProject,
    handleStartEditingProjectMeta,
    handleToggleProjectMeta: () =>
      data.setIsProjectMetaOpen((current) => !current),
  };
}
