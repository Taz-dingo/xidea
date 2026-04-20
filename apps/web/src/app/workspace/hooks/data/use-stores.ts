import { useShallow } from "zustand/react/shallow";
import { useWorkspaceEntitiesStore } from "@/app/workspace/store/entities-store";
import { useWorkspaceRuntimeStore } from "@/app/workspace/store/runtime-store";
import { useWorkspaceUiStore } from "@/app/workspace/store/ui-store";

export function useWorkspaceStores() {
  const ui = useWorkspaceUiStore(
    useShallow((state) => ({
      archiveConfirmationPointId: state.archiveConfirmationPointId,
      draftPrompt: state.draftPrompt,
      homeSection: state.homeSection,
      isCreatingProject: state.isCreatingProject,
      isEditingKnowledgePoint: state.isEditingKnowledgePoint,
      isEditingProjectMeta: state.isEditingProjectMeta,
      isProjectMetaOpen: state.isProjectMetaOpen,
      pendingInitialPrompt: state.pendingInitialPrompt,
      pendingSessionIntent: state.pendingSessionIntent,
      screen: state.screen,
      searchQuery: state.searchQuery,
      selectedKnowledgePointId: state.selectedKnowledgePointId,
      selectedProjectId: state.selectedProjectId,
      selectedSessionId: state.selectedSessionId,
      setArchiveConfirmationPointId: state.setArchiveConfirmationPointId,
      setDraftPrompt: state.setDraftPrompt,
      setHomeSection: state.setHomeSection,
      setIsCreatingProject: state.setIsCreatingProject,
      setIsEditingKnowledgePoint: state.setIsEditingKnowledgePoint,
      setIsEditingProjectMeta: state.setIsEditingProjectMeta,
      setIsProjectMetaOpen: state.setIsProjectMetaOpen,
      setPendingInitialPrompt: state.setPendingInitialPrompt,
      setPendingSessionIntent: state.setPendingSessionIntent,
      setScreen: state.setScreen,
      setSearchQuery: state.setSearchQuery,
      setSelectedKnowledgePointId: state.setSelectedKnowledgePointId,
      setSelectedProjectId: state.setSelectedProjectId,
      setSelectedSessionId: state.setSelectedSessionId,
      setWorkspaceSection: state.setWorkspaceSection,
      workspaceSection: state.workspaceSection,
    })),
  );
  const entities = useWorkspaceEntitiesStore(
    useShallow((state) => ({
      knowledgePoints: state.knowledgePoints,
      projectMaterialIdsByProject: state.projectMaterialIdsByProject,
      projects: state.projects,
      sessions: state.sessions,
      sourceAssets: state.sourceAssets,
      setKnowledgePoints: state.setKnowledgePoints,
      setProjectMaterialIdsByProject: state.setProjectMaterialIdsByProject,
      setProjects: state.setProjects,
      setSessions: state.setSessions,
      setSourceAssets: state.setSourceAssets,
    })),
  );
  const runtime = useWorkspaceRuntimeStore(
    useShallow((state) => ({
      activityResolutionsBySession: state.activityResolutionsBySession,
      agentConnectionState: state.agentConnectionState,
      assetSummaryByKey: state.assetSummaryByKey,
      bootstrapLoadedKeys: state.bootstrapLoadedKeys,
      clearBootstrapLoaded: state.clearBootstrapLoaded,
      devTutorFixtureState: state.devTutorFixtureState,
      markBootstrapLoaded: state.markBootstrapLoaded,
      runningSessionIds: state.runningSessionIds,
      sessionEntryModes: state.sessionEntryModes,
      sessionMaterialTrayOpen: state.sessionMaterialTrayOpen,
      sessionMessagesById: state.sessionMessagesById,
      sessionReviewInspectors: state.sessionReviewInspectors,
      sessionSnapshots: state.sessionSnapshots,
      sessionSourceAssetIds: state.sessionSourceAssetIds,
      setActivityResolutionsBySession: state.setActivityResolutionsBySession,
      setAgentConnectionState: state.setAgentConnectionState,
      setAssetSummaryByKey: state.setAssetSummaryByKey,
      setDevTutorFixtureState: state.setDevTutorFixtureState,
      setRunningSessionIds: state.setRunningSessionIds,
      setSessionEntryModes: state.setSessionEntryModes,
      setSessionMaterialTrayOpen: state.setSessionMaterialTrayOpen,
      setSessionMessagesById: state.setSessionMessagesById,
      setSessionReviewInspectors: state.setSessionReviewInspectors,
      setSessionSnapshots: state.setSessionSnapshots,
      setSessionSourceAssetIds: state.setSessionSourceAssetIds,
    })),
  );

  return {
    ...entities,
    ...runtime,
    ...ui,
  };
}
