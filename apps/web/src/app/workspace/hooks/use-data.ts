import type { UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { learnerProfiles, learningUnits, sourceAssets } from "@/data/demo";
import {
  initialKnowledgePoints,
  initialProjects,
  initialSessions,
} from "@/data/project-workspace-demo";
import { getTutorFixtureScenario } from "@/data/tutor-fixtures";
import type {
  AgentAssetSummary,
  AgentEntryMode,
  AgentReviewInspector,
  RuntimeSnapshot,
} from "@/domain/agent-runtime";
import {
  getDefaultSourceAssetIds,
  type ActivityResolution,
  type DevTutorFixtureState,
  buildDevTutorFixtureState,
} from "@/domain/project-session-runtime";
import type {
  KnowledgePointItem,
  SessionItem,
} from "@/domain/project-workspace";
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
import type {
  EditableKnowledgePointDraft,
  ProjectDraft,
  ProjectMetaDraft,
} from "@/app/workspace/model/types";
import { useWorkspaceEntitiesStore } from "@/app/workspace/store/entities-store";
import { useWorkspaceRuntimeStore } from "@/app/workspace/store/runtime-store";
import { useWorkspaceUiStore } from "@/app/workspace/store/ui-store";

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

  const {
    archiveConfirmationPointId,
    draftPrompt,
    homeSection,
    isCreatingProject,
    isEditingKnowledgePoint,
    isEditingProjectMeta,
    isProjectMetaOpen,
    pendingInitialPrompt,
    pendingSessionIntent,
    screen,
    searchQuery,
    selectedKnowledgePointId,
    selectedProjectId,
    selectedSessionId,
    setArchiveConfirmationPointId,
    setDraftPrompt,
    setHomeSection,
    setIsCreatingProject,
    setIsEditingKnowledgePoint,
    setIsEditingProjectMeta,
    setIsProjectMetaOpen,
    setPendingInitialPrompt,
    setPendingSessionIntent,
    setScreen,
    setSearchQuery,
    setSelectedKnowledgePointId,
    setSelectedProjectId,
    setSelectedSessionId,
    setWorkspaceSection,
    workspaceSection,
  } = useWorkspaceUiStore(
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
  const {
    knowledgePoints,
    projectMaterialIdsByProject,
    projects,
    sessions,
    setKnowledgePoints,
    setProjectMaterialIdsByProject,
    setProjects,
    setSessions,
  } = useWorkspaceEntitiesStore(
    useShallow((state) => ({
      knowledgePoints: state.knowledgePoints,
      projectMaterialIdsByProject: state.projectMaterialIdsByProject,
      projects: state.projects,
      sessions: state.sessions,
      setKnowledgePoints: state.setKnowledgePoints,
      setProjectMaterialIdsByProject: state.setProjectMaterialIdsByProject,
      setProjects: state.setProjects,
      setSessions: state.setSessions,
    })),
  );
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
    materialIds: initialKnowledgePoints.flatMap((point) => point.sourceAssetIds),
  });
  const [knowledgePointDraft, setKnowledgePointDraft] =
    useState<EditableKnowledgePointDraft>({
      title: initialKnowledgePoint.title,
      description: initialKnowledgePoint.description,
    });
  const {
    activityResolutionsBySession,
    agentConnectionState,
    assetSummaryByKey,
    bootstrapLoadedKeys,
    clearBootstrapLoaded,
    devTutorFixtureState,
    markBootstrapLoaded,
    runningSessionIds,
    sessionEntryModes,
    sessionMaterialTrayOpen,
    sessionMessagesById,
    sessionReviewInspectors,
    sessionSnapshots,
    sessionSourceAssetIds,
    setActivityResolutionsBySession,
    setAgentConnectionState,
    setAssetSummaryByKey,
    setDevTutorFixtureState,
    setRunningSessionIds,
    setSessionEntryModes,
    setSessionMaterialTrayOpen,
    setSessionMessagesById,
    setSessionReviewInspectors,
    setSessionSnapshots,
    setSessionSourceAssetIds,
  } = useWorkspaceRuntimeStore(
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

  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const selectedProject = getSelectedProject(projects, selectedProjectId, initialProject);
  const selectedProjectKnowledgePoints = useMemo(
    () => getSelectedProjectKnowledgePoints(knowledgePoints, selectedProject.id),
    [knowledgePoints, selectedProject.id],
  );
  const selectedKnowledgePoint = useMemo(
    () => getSelectedKnowledgePoint(selectedProjectKnowledgePoints, selectedKnowledgePointId),
    [selectedKnowledgePointId, selectedProjectKnowledgePoints],
  );
  const selectedKnowledgePointAssets = useMemo(
    () => getSelectedKnowledgePointAssets(sourceAssets, selectedKnowledgePoint),
    [selectedKnowledgePoint],
  );
  const selectedProjectSessions = useMemo(
    () => getSelectedProjectSessions(sessions, selectedProject.id),
    [selectedProject.id, sessions],
  );
  const knowledgePointRelatedSessions = useMemo(
    () => getKnowledgePointRelatedSessions(selectedKnowledgePoint, selectedProjectSessions),
    [selectedKnowledgePoint, selectedProjectSessions],
  );
  const knowledgePointReviewInspectors = useMemo(
    () =>
      getKnowledgePointReviewInspectors(
        knowledgePointRelatedSessions,
        sessionReviewInspectors,
      ),
    [knowledgePointRelatedSessions, sessionReviewInspectors],
  );
  const selectedProjectMaterials = useMemo(
    () =>
      getSelectedProjectMaterials(
        sourceAssets,
        projectMaterialIdsByProject[selectedProject.id] ?? [],
      ),
    [projectMaterialIdsByProject, selectedProject.id],
  );

  useEffect(() => {
    if (selectedKnowledgePoint === null) {
      return;
    }

    setKnowledgePointDraft({
      title: selectedKnowledgePoint.title,
      description: selectedKnowledgePoint.description,
    });
    setIsEditingKnowledgePoint(false);
  }, [selectedKnowledgePoint?.id]);

  useEffect(() => {
    setArchiveConfirmationPointId(null);
  }, [selectedKnowledgePoint?.id]);

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
  ]);

  return {
    activityResolutionsBySession,
    agentConnectionState,
    archiveConfirmationPointId,
    assetSummaryByKey,
    devTutorFixtureState,
    draftPrompt,
    initialKnowledgePoint,
    initialProfile,
    initialProject,
    initialUnit,
    isCreatingProject,
    isDevEnvironment,
    isEditingKnowledgePoint,
    isEditingProjectMeta,
    isProjectMetaOpen,
    homeSection,
    knowledgePointDraft,
    knowledgePointRelatedSessions,
    knowledgePointReviewInspectors,
    knowledgePoints,
    pendingInitialPrompt,
    pendingSessionIntent,
    projectDraft,
    projectMaterialIdsByProject,
    projectMetaDraft,
    projects,
    runningSessionIds,
    screen,
    searchQuery,
    selectedKnowledgePoint,
    selectedKnowledgePointAssets,
    selectedKnowledgePointId,
    selectedProject,
    selectedProjectId,
    selectedProjectKnowledgePoints,
    selectedProjectMaterials,
    selectedProjectSessions,
    selectedSession,
    selectedSessionId,
    bootstrapLoadedKeys,
    clearBootstrapLoaded,
    markBootstrapLoaded,
    sessionEntryModes,
    sessionEntryModesSetter: setSessionEntryModes,
    sessionMaterialTrayOpen,
    sessionMessagesById,
    sessionReviewInspectors,
    sessionSnapshots,
    sessionSourceAssetIds,
    sessions,
    setActivityResolutionsBySession,
    setAgentConnectionState,
    setArchiveConfirmationPointId,
    setAssetSummaryByKey,
    setDevTutorFixtureState,
    setDraftPrompt,
    setHomeSection,
    setIsCreatingProject,
    setIsEditingKnowledgePoint,
    setIsEditingProjectMeta,
    setIsProjectMetaOpen,
    setKnowledgePointDraft,
    setKnowledgePoints,
    setPendingInitialPrompt,
    setPendingSessionIntent,
    setProjectDraft,
    setProjectMaterialIdsByProject,
    setProjectMetaDraft,
    setProjects,
    setRunningSessionIds,
    setScreen,
    setSearchQuery,
    setSelectedKnowledgePointId,
    setSelectedProjectId,
    setSelectedSessionId,
    setSessionMaterialTrayOpen,
    setSessionMessagesById,
    setSessionReviewInspectors,
    setSessionSnapshots,
    setSessionSourceAssetIds,
    setSessions,
    setWorkspaceSection,
    workspaceSection,
  };
}

export type WorkspaceData = ReturnType<typeof useWorkspaceData>;
