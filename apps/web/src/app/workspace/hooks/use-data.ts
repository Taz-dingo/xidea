import { useMemo } from "react";
import {
  getSelectedKnowledgePoint,
  getSelectedKnowledgePointAssets,
  getKnowledgePointRelatedSessions,
  getSessionReviewInspectors,
  getSelectedProject,
  getSelectedProjectKnowledgePoints,
  getSelectedProjectMaterials,
  getSelectedProjectSessions,
} from "@/app/workspace/model/selectors";
import {
  EMPTY_KNOWLEDGE_POINT_ITEM,
  EMPTY_LEARNING_UNIT,
  EMPTY_PROJECT_ITEM,
} from "@/app/workspace/model/empty-state";
import { useWorkspaceBackendHydration } from "@/app/workspace/hooks/data/use-backend-hydration";
import { useWorkspaceDrafts } from "@/app/workspace/hooks/data/use-drafts";
import { useWorkspaceStores } from "@/app/workspace/hooks/data/use-stores";

export function useWorkspaceData() {
  const initialUnit = EMPTY_LEARNING_UNIT;
  const initialProject = EMPTY_PROJECT_ITEM;
  const initialKnowledgePoint = EMPTY_KNOWLEDGE_POINT_ITEM;
  const isDevEnvironment = import.meta.env.DEV;

  const stores = useWorkspaceStores();
  useWorkspaceBackendHydration({
    selectedProjectId: stores.selectedProjectId,
    selectedKnowledgePointId: stores.selectedKnowledgePointId,
    selectedSessionId: stores.selectedSessionId,
    setProjects: stores.setProjects,
    setKnowledgePoints: stores.setKnowledgePoints,
    setSessions: stores.setSessions,
    setSourceAssets: stores.setSourceAssets,
    setProjectMaterialIdsByProject: stores.setProjectMaterialIdsByProject,
    setProjectAssetsByProject: stores.setProjectAssetsByProject,
    sessionEntryModesSetter: stores.setSessionEntryModes,
    setSessionSourceAssetIds: stores.setSessionSourceAssetIds,
    setSessionMessagesById: stores.setSessionMessagesById,
    setSelectedProjectId: stores.setSelectedProjectId,
    setSelectedKnowledgePointId: stores.setSelectedKnowledgePointId,
    setSelectedSessionId: stores.setSelectedSessionId,
  });
  const selectedSession = stores.sessions.find(
    (session) => session.id === stores.selectedSessionId,
  );
  const selectedProject = getSelectedProject(
    stores.projects,
    stores.selectedProjectId,
    initialProject,
  );
  const selectedProjectAssets = useMemo(
    () => stores.projectAssetsByProject[selectedProject.id] ?? [],
    [selectedProject.id, stores.projectAssetsByProject],
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
    () => getSelectedKnowledgePointAssets(selectedProjectAssets, selectedKnowledgePoint),
    [selectedKnowledgePoint, selectedProjectAssets],
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
      getSessionReviewInspectors(
        knowledgePointRelatedSessions,
        stores.sessionReviewInspectors,
      ),
    [knowledgePointRelatedSessions, stores.sessionReviewInspectors],
  );
  const projectReviewInspectors = useMemo(
    () =>
      getSessionReviewInspectors(
        selectedProjectSessions,
        stores.sessionReviewInspectors,
      ),
    [selectedProjectSessions, stores.sessionReviewInspectors],
  );
  const selectedProjectMaterials = useMemo(
    () =>
      getSelectedProjectMaterials(
        selectedProjectAssets,
        stores.projectMaterialIdsByProject[selectedProject.id] ?? [],
      ),
    [selectedProject.id, selectedProjectAssets, stores.projectMaterialIdsByProject],
  );
  const drafts = useWorkspaceDrafts({
    projectMaterialIdsByProject: stores.projectMaterialIdsByProject,
    selectedKnowledgePoint,
    selectedProject,
    setArchiveConfirmationPointId: stores.setArchiveConfirmationPointId,
    setIsEditingKnowledgePoint: stores.setIsEditingKnowledgePoint,
    setIsEditingProjectMeta: stores.setIsEditingProjectMeta,
  });

  return {
    initialKnowledgePoint,
    initialProject,
    initialUnit,
    isDevEnvironment,
    knowledgePointRelatedSessions,
    knowledgePointReviewInspectors,
    projectReviewInspectors,
    selectedKnowledgePoint,
    selectedKnowledgePointAssets,
    selectedProject,
    selectedProjectAssets,
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
