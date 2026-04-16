import { useMemo } from "react";
import { learnerProfiles, learningUnits, sourceAssets } from "@/data/demo";
import {
  initialKnowledgePoints,
  initialProjects,
} from "@/data/project-workspace-demo";
import {
  getSelectedKnowledgePoint,
  getSelectedKnowledgePointAssets,
  getKnowledgePointRelatedSessions,
  getKnowledgePointReviewInspectors,
  getSelectedProject,
  getSelectedProjectKnowledgePoints,
  getSelectedProjectMaterials,
  getSelectedProjectSessions,
} from "@/app/workspace/model/selectors";
import { useWorkspaceDrafts } from "@/app/workspace/hooks/data/use-drafts";
import { useWorkspaceStores } from "@/app/workspace/hooks/data/use-stores";

export function useWorkspaceData() {
  const initialProfile = learnerProfiles[1] ?? learnerProfiles[0];
  const initialUnit = learningUnits[0];
  const initialProject = initialProjects[0];
  const initialKnowledgePoint = initialKnowledgePoints[0];
  const isDevEnvironment = import.meta.env.DEV;

  if (
    initialProfile === undefined ||
    initialUnit === undefined ||
    initialProject === undefined ||
    initialKnowledgePoint === undefined
  ) {
    throw new Error(
      "Demo data must contain at least one learner profile, learning unit, knowledge point, and project.",
    );
  }

  const stores = useWorkspaceStores();
  const selectedSession = stores.sessions.find(
    (session) => session.id === stores.selectedSessionId,
  );
  const selectedProject = getSelectedProject(
    stores.projects,
    stores.selectedProjectId,
    initialProject,
  );
  const selectedProjectKnowledgePoints = useMemo(
    () => getSelectedProjectKnowledgePoints(stores.knowledgePoints, selectedProject.id),
    [selectedProject.id, stores.knowledgePoints],
  );
  const selectedKnowledgePoint = useMemo(
    () =>
      getSelectedKnowledgePoint(
        selectedProjectKnowledgePoints,
        stores.selectedKnowledgePointId,
      ),
    [selectedProjectKnowledgePoints, stores.selectedKnowledgePointId],
  );
  const selectedKnowledgePointAssets = useMemo(
    () => getSelectedKnowledgePointAssets(sourceAssets, selectedKnowledgePoint),
    [selectedKnowledgePoint],
  );
  const selectedProjectSessions = useMemo(
    () => getSelectedProjectSessions(stores.sessions, selectedProject.id),
    [selectedProject.id, stores.sessions],
  );
  const knowledgePointRelatedSessions = useMemo(
    () => getKnowledgePointRelatedSessions(selectedKnowledgePoint, selectedProjectSessions),
    [selectedKnowledgePoint, selectedProjectSessions],
  );
  const knowledgePointReviewInspectors = useMemo(
    () =>
      getKnowledgePointReviewInspectors(
        knowledgePointRelatedSessions,
        stores.sessionReviewInspectors,
      ),
    [knowledgePointRelatedSessions, stores.sessionReviewInspectors],
  );
  const selectedProjectMaterials = useMemo(
    () =>
      getSelectedProjectMaterials(
        sourceAssets,
        stores.projectMaterialIdsByProject[selectedProject.id] ?? [],
      ),
    [selectedProject.id, stores.projectMaterialIdsByProject],
  );
  const drafts = useWorkspaceDrafts({
    initialKnowledgePoint,
    initialProject,
    projectMaterialIdsByProject: stores.projectMaterialIdsByProject,
    selectedKnowledgePoint,
    selectedProject,
    setArchiveConfirmationPointId: stores.setArchiveConfirmationPointId,
    setIsEditingKnowledgePoint: stores.setIsEditingKnowledgePoint,
    setIsEditingProjectMeta: stores.setIsEditingProjectMeta,
  });

  return {
    initialKnowledgePoint,
    initialProfile,
    initialProject,
    initialUnit,
    isDevEnvironment,
    knowledgePointRelatedSessions,
    knowledgePointReviewInspectors,
    selectedKnowledgePoint,
    selectedKnowledgePointAssets,
    selectedProject,
    selectedProjectKnowledgePoints,
    selectedProjectMaterials,
    selectedProjectSessions,
    selectedSession,
    sessionEntryModesSetter: stores.setSessionEntryModes,
    ...drafts,
    ...stores,
  };
}

export type WorkspaceData = ReturnType<typeof useWorkspaceData>;
