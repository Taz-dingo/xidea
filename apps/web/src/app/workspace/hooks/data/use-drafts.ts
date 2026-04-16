import { useEffect, useState } from "react";
import type {
  KnowledgePointItem,
  ProjectItem,
} from "@/domain/project-workspace";
import type {
  EditableKnowledgePointDraft,
  ProjectDraft,
  ProjectMetaDraft,
} from "@/app/workspace/model/types";

export function useWorkspaceDrafts({
  initialKnowledgePoint,
  initialProject,
  projectMaterialIdsByProject,
  selectedKnowledgePoint,
  selectedProject,
  setArchiveConfirmationPointId,
  setIsEditingKnowledgePoint,
  setIsEditingProjectMeta,
}: {
  initialKnowledgePoint: KnowledgePointItem;
  initialProject: ProjectItem;
  projectMaterialIdsByProject: Record<string, ReadonlyArray<string>>;
  selectedKnowledgePoint: KnowledgePointItem | null;
  selectedProject: ProjectItem;
  setArchiveConfirmationPointId: (pointId: string | null) => void;
  setIsEditingKnowledgePoint: (value: boolean) => void;
  setIsEditingProjectMeta: (value: boolean) => void;
}) {
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>({
    name: "",
    topic: "",
    description: "",
    specialRulesText: "",
    initialMaterialIds: [],
  });
  const [projectMetaDraft, setProjectMetaDraft] = useState<ProjectMetaDraft>({
    topic: initialProject.topic,
    description: initialProject.description,
    specialRulesText: initialProject.specialRules.join("\n"),
    materialIds: initialKnowledgePoint.sourceAssetIds,
  });
  const [knowledgePointDraft, setKnowledgePointDraft] =
    useState<EditableKnowledgePointDraft>({
      title: initialKnowledgePoint.title,
      description: initialKnowledgePoint.description,
    });

  useEffect(() => {
    if (selectedKnowledgePoint === null) {
      return;
    }

    setKnowledgePointDraft({
      title: selectedKnowledgePoint.title,
      description: selectedKnowledgePoint.description,
    });
    setIsEditingKnowledgePoint(false);
  }, [
    selectedKnowledgePoint?.description,
    selectedKnowledgePoint?.id,
    selectedKnowledgePoint?.title,
    setIsEditingKnowledgePoint,
  ]);

  useEffect(() => {
    setArchiveConfirmationPointId(null);
  }, [selectedKnowledgePoint?.id, setArchiveConfirmationPointId]);

  useEffect(() => {
    setProjectMetaDraft({
      topic: selectedProject.topic,
      description: selectedProject.description,
      specialRulesText: selectedProject.specialRules.join("\n"),
      materialIds: projectMaterialIdsByProject[selectedProject.id] ?? [],
    });
    setIsEditingProjectMeta(false);
  }, [
    projectMaterialIdsByProject,
    selectedProject.description,
    selectedProject.id,
    selectedProject.specialRules,
    selectedProject.topic,
    setIsEditingProjectMeta,
  ]);

  return {
    knowledgePointDraft,
    projectDraft,
    projectMetaDraft,
    setKnowledgePointDraft,
    setProjectDraft,
    setProjectMetaDraft,
  };
}
