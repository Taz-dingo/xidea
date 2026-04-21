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
  projectMaterialIdsByProject,
  selectedKnowledgePoint,
  selectedProject,
  setArchiveConfirmationPointId,
  setIsEditingKnowledgePoint,
  setIsEditingProjectMeta,
}: {
  projectMaterialIdsByProject: Record<string, ReadonlyArray<string>>;
  selectedKnowledgePoint: KnowledgePointItem | null;
  selectedProject: ProjectItem;
  setArchiveConfirmationPointId: (pointId: string | null) => void;
  setIsEditingKnowledgePoint: (value: boolean) => void;
  setIsEditingProjectMeta: (value: boolean) => void;
}) {
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>({
    id: "",
    name: "",
    topic: "",
    description: "",
    specialRulesText: "",
    initialMaterialIds: [],
  });
  const [projectMetaDraft, setProjectMetaDraft] = useState<ProjectMetaDraft>({
    name: "",
    topic: "",
    description: "",
    specialRulesText: "",
    materialIds: [],
  });
  const [knowledgePointDraft, setKnowledgePointDraft] =
    useState<EditableKnowledgePointDraft>({
      title: "",
      description: "",
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
      name: selectedProject.name,
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
    selectedProject.name,
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
