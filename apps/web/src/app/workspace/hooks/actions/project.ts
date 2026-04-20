import { sourceAssets } from "@/data/demo";
import { uploadProjectMaterial } from "@/lib/agent-client";
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
    const initialProjectAssets = sourceAssets.filter((asset) =>
      data.projectDraft.initialMaterialIds.includes(asset.id),
    );

    data.setProjects((current) => [createdProject, ...current]);
    data.setProjectAssetsByProject((current) => ({
      ...current,
      [createdProject.id]: initialProjectAssets,
    }));
    data.setProjectMaterialIdsByProject((current) => ({
      ...current,
      [createdProject.id]: data.projectDraft.initialMaterialIds,
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
      name: data.selectedProject.name,
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
    const nextName = data.projectMetaDraft.name.trim();
    const nextTopic = data.projectMetaDraft.topic.trim();
    const nextDescription = data.projectMetaDraft.description.trim();
    const nextSpecialRules = data.projectMetaDraft.specialRulesText
      .split("\n")
      .map((rule) => rule.trim())
      .filter((rule) => rule !== "");

    if (nextName === "" || nextTopic === "" || nextDescription === "") {
      return;
    }

    data.setProjects((current) =>
      current.map((project) =>
        project.id === data.selectedProject.id
          ? {
              ...project,
              name: nextName,
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
    data.setIsProjectMetaOpen(false);
  }

  async function uploadAndStoreProjectMaterial(file: File) {
    const projectId = data.selectedProject.id;
    const projectTopic = data.selectedProject.topic;
    const uploadedAsset = await uploadProjectMaterial({
      projectId,
      file,
      topic: projectTopic,
    });

    data.setProjectAssetsByProject((current) => {
      const projectAssets = current[projectId] ?? [];
      if (projectAssets.some((asset) => asset.id === uploadedAsset.id)) {
        return current;
      }
      return {
        ...current,
        [projectId]: [uploadedAsset, ...projectAssets],
      };
    });
    data.setProjectMaterialIdsByProject((current) => {
      const currentIds = current[projectId] ?? [];
      if (currentIds.includes(uploadedAsset.id)) {
        return current;
      }
      return {
        ...current,
        [projectId]: [uploadedAsset.id, ...currentIds],
      };
    });
    if (data.isEditingProjectMeta) {
      data.setProjectMetaDraft((current) => ({
        ...current,
        materialIds: current.materialIds.includes(uploadedAsset.id)
          ? current.materialIds
          : [uploadedAsset.id, ...current.materialIds],
      }));
    }

    return uploadedAsset;
  }

  async function handleUploadProjectMaterial(file: File): Promise<void> {
    await uploadAndStoreProjectMaterial(file);
  }

  async function handleUploadProjectMaterialAndAttach(file: File): Promise<void> {
    const selectedSessionId = data.selectedSession?.id ?? null;
    const selectedSessionType = data.selectedSession?.type ?? null;
    const uploadedAsset = await uploadAndStoreProjectMaterial(file);

    if (selectedSessionId === null || selectedSessionType !== "project") {
      return;
    }

    data.setSessionSourceAssetIds((current) => {
      const currentIds = current[selectedSessionId] ?? [];
      if (currentIds.includes(uploadedAsset.id)) {
        return current;
      }
      return {
        ...current,
        [selectedSessionId]: [...currentIds, uploadedAsset.id],
      };
    });
  }

  function handleCancelEditingProjectMeta(): void {
    data.setProjectMetaDraft({
      name: data.selectedProject.name,
      topic: data.selectedProject.topic,
      description: data.selectedProject.description,
      specialRulesText: data.selectedProject.specialRules.join("\n"),
      materialIds:
        data.projectMaterialIdsByProject[data.selectedProject.id] ?? [],
    });
    data.setIsEditingProjectMeta(false);
    data.setIsProjectMetaOpen(false);
  }

  return {
    handleCancelCreatingProject: () => data.setIsCreatingProject(false),
    handleCancelEditingProjectMeta,
    handleOpenProjectMetaEditor,
    handleSaveProject,
    handleSaveProjectMeta,
    handleUploadProjectMaterial,
    handleUploadProjectMaterialAndAttach,
    handleStartCreatingProject,
    handleStartEditingProjectMeta,
    handleToggleProjectMeta: () =>
      data.setIsProjectMetaOpen((current) => !current),
  };
}
