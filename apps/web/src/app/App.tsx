import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  ArrowLeft,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { KnowledgePointDetailScreen } from "@/components/project-workspace-detail";
import { ProjectSessionWorkspace } from "@/components/project-session-workspace";
import {
  CreateProjectPanel,
  EditProjectMetaPanel,
} from "@/components/project-workspace-management";
import {
  HomeScreen,
  WorkspaceBrowseScreen,
} from "@/components/project-workspace-screens";
import {
  ProjectMetaPanel,
} from "@/components/project-workspace-primitives";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { learnerProfiles, learningUnits, projectContext, sourceAssets } from "@/data/demo";
import {
  initialKnowledgePoints,
  initialProjects,
  initialSessions,
} from "@/data/project-workspace-demo";
import {
  getTutorFixtureScenario,
  tutorFixtureScenarios,
} from "@/data/tutor-fixtures";
import {
  buildDefaultAgentPrompt,
  formatActivitySubmissionForAgent,
  buildMockRuntimeSnapshot,
  getRequestSourceAssetIds,
  hydrateRuntimeSnapshotFromLearnerState,
  type AgentAssetSummary,
  type AgentEntryMode,
  type AgentReviewInspector,
  type RuntimeSnapshot,
} from "@/domain/agent-runtime";
import {
  getNextSuggestedAction,
  getProjectStats,
  type AppScreen,
  type HomeSection,
  type KnowledgePointItem,
  type ProjectItem,
  type SessionItem,
  type SessionType,
  type WorkspaceSection,
} from "@/domain/project-workspace";
import {
  buildEmptyReviewHeatmap,
  buildReviewHeatmap,
  formatDateLabel,
  getLatestIsoDate,
} from "@/domain/review-heatmap";
import {
  buildDevTutorFixtureState,
  buildGeneratedProfileSummary,
  createFixtureUiMessage,
  getActionLabel,
  getDefaultSourceAssetIds,
  getErrorMessage,
  getLatestReviewEvent,
  getNextFixtureSnapshot,
  getRelativeTimeRank,
  type ActivityResolution,
  type DevTutorFixtureState,
} from "@/domain/project-session-runtime";
import type { LearningActivitySubmission, SourceAsset } from "@/domain/types";
import { getLatestUserDraft } from "@/domain/chat-message";
import { createAgentChatTransport } from "@/lib/agent-chat-transport";
import {
  getAgentBaseUrl,
  getAgentHealth,
  getAssetSummary,
  getInspectorBootstrap,
  getReviewInspector,
  getThreadContext,
} from "@/lib/agent-client";

interface ProjectDraft {
  readonly name: string;
  readonly topic: string;
  readonly description: string;
  readonly specialRulesText: string;
  readonly initialMaterialIds: ReadonlyArray<string>;
}

interface EditableKnowledgePointDraft {
  readonly title: string;
  readonly description: string;
}

interface ProjectMetaDraft {
  readonly topic: string;
  readonly description: string;
  readonly specialRulesText: string;
  readonly materialIds: ReadonlyArray<string>;
}

interface PendingSessionIntent {
  readonly projectId: string;
  readonly type: Extract<SessionType, "review" | "study">;
  readonly knowledgePointId: string | null;
  readonly knowledgePointTitle: string | null;
  readonly sourceAssetIds: ReadonlyArray<string>;
}

interface PendingInitialPrompt {
  readonly sessionId: string;
  readonly text: string;
  readonly sessionSummary: string;
}

function setDevTutorFixtureQueryParam(fixtureId: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (fixtureId === null) {
    url.searchParams.delete("mockTutor");
  } else {
    url.searchParams.set("mockTutor", fixtureId);
  }
  window.history.replaceState({}, "", url);
}

export function App(): ReactElement {
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
    throw new Error("Demo data must contain at least one learner profile, learning unit, knowledge point, and project.");
  }

  const [screen, setScreen] = useState<AppScreen>("home");
  const [homeSection, setHomeSection] = useState<HomeSection>("all-projects");
  const [projects, setProjects] = useState<ReadonlyArray<ProjectItem>>(initialProjects);
  const [knowledgePoints, setKnowledgePoints] = useState<ReadonlyArray<KnowledgePointItem>>(initialKnowledgePoints);
  const [sessions, setSessions] = useState<ReadonlyArray<SessionItem>>(initialSessions);
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>("overview");
  const [isProjectMetaOpen, setIsProjectMetaOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>({
    name: "",
    topic: "",
    description: "",
    specialRulesText: "",
    initialMaterialIds: [],
  });
  const [isEditingProjectMeta, setIsEditingProjectMeta] = useState(false);
  const [projectMetaDraft, setProjectMetaDraft] = useState<ProjectMetaDraft>({
    topic: initialProject.topic,
    description: initialProject.description,
    specialRulesText: initialProject.specialRules.join("\n"),
    materialIds: initialKnowledgePoints.flatMap((point) => point.sourceAssetIds),
  });
  const [isEditingKnowledgePoint, setIsEditingKnowledgePoint] = useState(false);
  const [archiveConfirmationPointId, setArchiveConfirmationPointId] = useState<string | null>(null);
  const [knowledgePointDraft, setKnowledgePointDraft] = useState<EditableKnowledgePointDraft>({
    title: initialKnowledgePoint.title,
    description: initialKnowledgePoint.description,
  });
  const [pendingSessionIntent, setPendingSessionIntent] = useState<PendingSessionIntent | null>(
    null,
  );
  const [pendingInitialPrompt, setPendingInitialPrompt] = useState<PendingInitialPrompt | null>(
    null,
  );
  const [selectedProjectId, setSelectedProjectId] = useState(initialProject.id);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedKnowledgePointId, setSelectedKnowledgePointId] = useState(initialKnowledgePoint.id);
  const [projectMaterialIdsByProject, setProjectMaterialIdsByProject] = useState<
    Record<string, ReadonlyArray<string>>
  >(() =>
    Object.fromEntries(
      initialProjects.map((project) => [
        project.id,
        Array.from(
          new Set(
            initialKnowledgePoints
              .filter((point) => point.projectId === project.id)
              .flatMap((point) => point.sourceAssetIds),
          ),
        ),
      ]),
    ),
  );
  const [, setSessionEntryModes] = useState<Record<string, AgentEntryMode>>(
    () => Object.fromEntries(initialSessions.map((session) => [session.id, "chat-question"])),
  );
  const [sessionSourceAssetIds, setSessionSourceAssetIds] = useState<Record<string, ReadonlyArray<string>>>(
    () =>
      Object.fromEntries(
        initialSessions.map((session) => [session.id, getDefaultSourceAssetIds()]),
      ),
  );
  const [sessionMaterialTrayOpen, setSessionMaterialTrayOpen] = useState<Record<string, boolean>>(
    {},
  );
  const [draftPrompt, setDraftPrompt] = useState(() =>
    buildDefaultAgentPrompt(initialUnit, projectContext),
  );
  const [devTutorFixtureState, setDevTutorFixtureState] = useState<DevTutorFixtureState | null>(
    () => {
      if (!isDevEnvironment || typeof window === "undefined") {
        return null;
      }

      const fixtureId = new URLSearchParams(window.location.search).get("mockTutor");
      const fixture = getTutorFixtureScenario(fixtureId);
      return fixture ? buildDevTutorFixtureState(fixture) : null;
    },
  );
  const [sessionSnapshots, setSessionSnapshots] = useState<Record<string, RuntimeSnapshot>>({});
  const [sessionReviewInspectors, setSessionReviewInspectors] = useState<
    Record<string, AgentReviewInspector | null>
  >({});
  const [assetSummaryByKey, setAssetSummaryByKey] = useState<Record<string, AgentAssetSummary>>({});
  const [agentConnectionState, setAgentConnectionState] = useState<"checking" | "ready" | "offline">(
    "checking",
  );
  const [sessionMessagesById, setSessionMessagesById] = useState<Record<string, UIMessage[]>>(
    () => Object.fromEntries(initialSessions.map((session) => [session.id, []])),
  );
  const [activityResolutionsBySession, setActivityResolutionsBySession] = useState<
    Record<string, Record<string, ActivityResolution>>
  >({});
  const [runningSessionIds, setRunningSessionIds] = useState<Record<string, boolean>>({});
  const bootstrapLoadedKeysRef = useRef<Record<string, boolean>>({});
  const sessionSnapshotsRef = useRef<Record<string, RuntimeSnapshot>>(sessionSnapshots);
  sessionSnapshotsRef.current = sessionSnapshots;

  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const selectedSessionKey = selectedSession?.id ?? null;
  const selectedSessionKnowledgePointId = selectedSession?.knowledgePointId ?? null;
  const selectedUnit = selectedSession?.knowledgePointId
    ? learningUnits.find((unit) => unit.id === selectedSession.knowledgePointId)
    : undefined;
  const runtimeUnit = selectedUnit ?? initialUnit;
  const seedProfile = initialProfile;
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? initialProject;
  const selectedProjectKnowledgePoints = useMemo(
    () => knowledgePoints.filter((point) => point.projectId === selectedProject.id),
    [knowledgePoints, selectedProject.id],
  );
  const selectedKnowledgePoint =
    selectedProjectKnowledgePoints.find((point) => point.id === selectedKnowledgePointId) ??
    selectedProjectKnowledgePoints[0] ??
    null;
  const selectedKnowledgePointAssets = selectedKnowledgePoint
    ? sourceAssets.filter((asset) => selectedKnowledgePoint.sourceAssetIds.includes(asset.id))
    : [];
  const selectedProjectSessions = useMemo(
    () => sessions.filter((session) => session.projectId === selectedProject.id),
    [selectedProject.id, sessions],
  );
  const knowledgePointRelatedSessions = useMemo(
    () =>
      selectedKnowledgePoint === null
        ? []
        : selectedProjectSessions.filter(
            (session) => session.knowledgePointId === selectedKnowledgePoint.id,
          ),
    [selectedKnowledgePoint, selectedProjectSessions],
  );
  const knowledgePointReviewInspectors = useMemo(
    () =>
      knowledgePointRelatedSessions
        .map((session) => sessionReviewInspectors[session.id])
        .filter(
          (inspector): inspector is AgentReviewInspector =>
            inspector !== null && inspector !== undefined,
        ),
    [knowledgePointRelatedSessions, sessionReviewInspectors],
  );
  const knowledgePointReviewEvents = useMemo(
    () => knowledgePointReviewInspectors.flatMap((inspector) => inspector.events),
    [knowledgePointReviewInspectors],
  );
  const selectedProjectMaterials = useMemo(
    () =>
      sourceAssets.filter((asset) =>
        (projectMaterialIdsByProject[selectedProject.id] ?? []).includes(asset.id),
      ),
    [projectMaterialIdsByProject, selectedProject.id],
  );
  const projectStats = useMemo(
    () => getProjectStats(selectedProjectKnowledgePoints),
    [selectedProjectKnowledgePoints],
  );
  const projectMaterialCount = useMemo(
    () => selectedProjectMaterials.length,
    [selectedProjectMaterials],
  );
  const visibleKnowledgePoints = useMemo(() => {
    switch (workspaceSection) {
      case "archived":
        return selectedProjectKnowledgePoints.filter((point) => point.status === "archived");
      case "due-review":
        return selectedProjectKnowledgePoints.filter((point) => point.status === "active_review");
      case "overview":
        return selectedProjectKnowledgePoints.filter((point) => point.status !== "archived");
    }
  }, [selectedProjectKnowledgePoints, workspaceSection]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const projectSummaries = useMemo(
    () =>
      projects.map((project) => ({
        project,
        stats: getProjectStats(
          knowledgePoints.filter((point) => point.projectId === project.id),
        ),
      })),
    [knowledgePoints, projects],
  );
  const recentProjectSummaries = useMemo(
    () =>
      [...projectSummaries]
        .sort(
          (left, right) =>
            getRelativeTimeRank(right.project.updatedAt) -
            getRelativeTimeRank(left.project.updatedAt),
        )
        .slice(0, Math.min(projectSummaries.length, 4)),
    [projectSummaries],
  );
  const homeSectionCounts = useMemo(
    () => ({
      recent: recentProjectSummaries.length,
      dueReview: projectSummaries.filter(({ stats }) => stats.dueReview > 0).length,
      archived: projectSummaries.filter(({ stats }) => stats.archived > 0).length,
    }),
    [projectSummaries, recentProjectSummaries.length],
  );
  const homeSectionProjectSummaries = useMemo(() => {
    switch (homeSection) {
      case "all-projects":
        return projectSummaries;
      case "recent":
        return recentProjectSummaries;
      case "due-review":
        return projectSummaries.filter(({ stats }) => stats.dueReview > 0);
      case "archived":
        return projectSummaries.filter(({ stats }) => stats.archived > 0);
    }
  }, [homeSection, projectSummaries, recentProjectSummaries]);
  const filteredProjectSummaries = useMemo(() => {
    if (normalizedSearchQuery === "") {
      return homeSectionProjectSummaries;
    }

    return homeSectionProjectSummaries.filter(({ project }) =>
      [project.name, project.topic, project.description]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery),
    );
  }, [homeSectionProjectSummaries, normalizedSearchQuery]);
  const filteredKnowledgePoints = useMemo(() => {
    if (normalizedSearchQuery === "") {
      return visibleKnowledgePoints;
    }

    return visibleKnowledgePoints.filter((point) =>
      [point.title, point.description, point.stageLabel]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery),
    );
  }, [normalizedSearchQuery, visibleKnowledgePoints]);
  const selectedSourceAssetIds = selectedSession
    ? sessionSourceAssetIds[selectedSession.id] ?? getDefaultSourceAssetIds()
    : getDefaultSourceAssetIds();
  const agentBaseUrl = getAgentBaseUrl();
  const seedRuntime = useMemo(
    () => buildMockRuntimeSnapshot(seedProfile, runtimeUnit),
    [seedProfile, runtimeUnit],
  );
  const latestUserInput = getLatestUserDraft(
    selectedSession ? sessionMessagesById[selectedSession.id] ?? [] : [],
    draftPrompt,
  );
  const mockRuntime = seedRuntime;
  const fixtureIdFromUrl =
    isDevEnvironment && typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("mockTutor")
      : null;
  const activeTutorFixture =
    devTutorFixtureState === null ? null : getTutorFixtureScenario(devTutorFixtureState.fixtureId);
  const isUsingDevTutorFixture = activeTutorFixture !== null;
  const activeRuntime =
    selectedSession === undefined
      ? mockRuntime
      : isUsingDevTutorFixture
        ? devTutorFixtureState?.snapshot ?? mockRuntime
        : sessionSnapshots[selectedSession.id] ?? mockRuntime;
  const currentActivities =
    activeRuntime.activities.length > 0
      ? activeRuntime.activities
      : activeRuntime.activity === null
        ? []
        : [activeRuntime.activity];
  const currentActivity = currentActivities[0] ?? null;
  const currentActivityKey =
    currentActivity === null
      ? null
      : `${currentActivity.id}:${activeRuntime.assistantMessage || activeRuntime.decision.reason}`;
  const currentActivityResolution =
    selectedSessionKey === null || currentActivityKey === null
      ? null
      : activityResolutionsBySession[selectedSessionKey]?.[currentActivityKey] ?? null;
  const hasPersistedState = activeRuntime.source === "hydrated-state" || activeRuntime.source === "live-agent";
  const hasStructuredRuntime = activeRuntime.source === "live-agent";
  const generatedProfile = buildGeneratedProfileSummary(activeRuntime, latestUserInput);
  const sessionMessageCount = selectedSession
    ? sessionMessagesById[selectedSession.id]?.length ?? 0
    : 0;
  const isBlankSession =
    selectedSession !== undefined &&
    selectedSession.knowledgePointId === null &&
    sessionMessageCount === 0 &&
    sessionSnapshots[selectedSession.id] === undefined &&
    draftPrompt.trim() === "";
  const activeSourceAssets = useMemo(
    () => sourceAssets.filter((asset) => selectedSourceAssetIds.includes(asset.id)),
    [selectedSourceAssetIds],
  );
  const effectiveEntryMode: AgentEntryMode =
    selectedSourceAssetIds.length > 0 ? "material-import" : "chat-question";
  const isMaterialsTrayOpen =
    selectedSessionKey === null
      ? false
      : selectedSourceAssetIds.length > 0 || sessionMaterialTrayOpen[selectedSessionKey] === true;
  const activeSourceAssetsRef = useRef<ReadonlyArray<SourceAsset>>(activeSourceAssets);
  activeSourceAssetsRef.current = activeSourceAssets;
  const requestSourceAssetIds = useMemo(
    () => getRequestSourceAssetIds(effectiveEntryMode, activeSourceAssets),
    [activeSourceAssets, effectiveEntryMode],
  );
  const assetSummaryKey = requestSourceAssetIds.join("|");
  const activeAssetSummary = assetSummaryKey === "" ? null : assetSummaryByKey[assetSummaryKey] ?? null;
  const activeReviewInspector = selectedSession ? sessionReviewInspectors[selectedSession.id] ?? null : null;
  const latestReviewedEvent = activeReviewInspector ? getLatestReviewEvent(activeReviewInspector.events, "reviewed") : null;
  const reviewHeatmap =
    isBlankSession || !hasPersistedState
      ? buildEmptyReviewHeatmap()
      : buildReviewHeatmap(
          activeReviewInspector?.events ?? [],
          latestReviewedEvent?.event_at
            ? formatDateLabel(latestReviewedEvent.event_at)
            : activeRuntime.state.lastReviewedAt,
          activeReviewInspector?.scheduledAt
            ? formatDateLabel(activeReviewInspector.scheduledAt)
            : activeRuntime.state.nextReviewAt,
        );
  const transportSessionId = selectedSession?.id ?? selectedProject.id;
  const fallbackSnapshotForTransport = activeRuntime;
  const isAgentRunning =
    isUsingDevTutorFixture
      ? false
      : selectedSessionKey === null
        ? false
        : runningSessionIds[selectedSessionKey] === true;
  const hasPendingActivity =
    hasStructuredRuntime && currentActivity !== null && currentActivityResolution === null;
  const continueProjectSummary = filteredProjectSummaries[0] ?? null;
  const continueProjectPoints = useMemo(
    () =>
      continueProjectSummary === null
        ? []
        : knowledgePoints.filter(
            (point) => point.projectId === continueProjectSummary.project.id,
          ),
    [continueProjectSummary, knowledgePoints],
  );
  const continueActionLabel =
    continueProjectSummary === null
      ? null
      : getNextSuggestedAction(continueProjectPoints);
  const continueReviewTargetPoint =
    continueProjectSummary === null
      ? null
      : continueProjectPoints.find((point) => point.status === "active_review") ?? null;
  const browseProfileSummary = {
    title: generatedProfile.title
      .replace("系统当前把这个 session 视为", "")
      .replace(/[「」]/g, ""),
    evidence: generatedProfile.evidence[0] ?? "",
  };
  const studyTargetPoint =
    selectedKnowledgePoint?.status === "active_unlearned"
      ? selectedKnowledgePoint
      : selectedProjectKnowledgePoints.find((point) => point.status === "active_unlearned") ??
        selectedKnowledgePoint;
  const reviewTargetPoint =
    selectedKnowledgePoint?.status === "active_review"
      ? selectedKnowledgePoint
      : selectedProjectKnowledgePoints.find((point) => point.status === "active_review") ??
        selectedKnowledgePoint;
  const relatedKnowledgePoints = useMemo(() => {
    if (
      selectedSession?.knowledgePointId !== null &&
      selectedSession?.knowledgePointId !== undefined
    ) {
      return selectedProjectKnowledgePoints.filter(
        (point) => point.id === selectedSession.knowledgePointId,
      );
    }

    if (selectedKnowledgePoint !== null) {
      return [selectedKnowledgePoint];
    }

    return selectedProjectKnowledgePoints.slice(0, 3);
  }, [selectedKnowledgePoint, selectedProjectKnowledgePoints, selectedSession?.knowledgePointId]);
  const latestKnowledgePointReviewedEvent = getLatestReviewEvent(
    knowledgePointReviewEvents,
    "reviewed",
  );
  const knowledgePointReviewHeatmap =
    selectedKnowledgePoint === null
      ? buildEmptyReviewHeatmap()
      : buildReviewHeatmap(
          knowledgePointReviewEvents,
          latestKnowledgePointReviewedEvent?.event_at
            ? formatDateLabel(latestKnowledgePointReviewedEvent.event_at)
            : null,
          formatDateLabel(
            getLatestIsoDate(
              knowledgePointReviewInspectors.map((inspector) => inspector.scheduledAt),
            ),
          ),
        );
  const knowledgePointReviewHistorySummary =
    knowledgePointReviewInspectors.length > 0
      ? "热力图汇总这个知识点在相关 sessions 里的复习安排与完成记录。"
      : "当前还没有回读到这个知识点的真实复习记录；打开相关 session 后会回填热力图。";

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
  }, [projectMaterialIdsByProject, selectedProject.description, selectedProject.id, selectedProject.specialRules, selectedProject.topic]);

  const handleTransportSnapshot = useCallback((sessionId: string, snapshot: RuntimeSnapshot) => {
    setSessionSnapshots((current) => ({
      ...current,
      [sessionId]: snapshot,
    }));
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              status: "已更新",
              updatedAt: "刚刚",
            }
          : session,
      ),
    );
  }, []);

  const handleTransportRunStateChange = useCallback((sessionId: string, isRunning: boolean) => {
    setRunningSessionIds((current) =>
      current[sessionId] === isRunning
        ? current
        : {
            ...current,
            [sessionId]: isRunning,
          },
    );
  }, []);

  const transport = useMemo(
    () =>
      createAgentChatTransport({
        projectId: selectedProject.id,
        sessionId: transportSessionId,
        entryMode: effectiveEntryMode,
        project: projectContext,
        getSourceAssets: () => activeSourceAssetsRef.current,
        unit: runtimeUnit,
        getFallbackSnapshot: () =>
          sessionSnapshotsRef.current[transportSessionId] ?? fallbackSnapshotForTransport,
        onSnapshot: (snapshot) => {
          handleTransportSnapshot(transportSessionId, snapshot);
        },
        onRunStateChange: (nextIsRunning) => {
          handleTransportRunStateChange(transportSessionId, nextIsRunning);
        },
      }),
    [
      handleTransportRunStateChange,
      handleTransportSnapshot,
      effectiveEntryMode,
      fallbackSnapshotForTransport,
      selectedProject.id,
      transportSessionId,
      runtimeUnit,
    ],
  );

  const { clearError, messages, sendMessage, error } = useChat({
    id: selectedSession?.id ?? selectedProject?.id ?? "project",
    messages: selectedSession ? sessionMessagesById[selectedSession.id] ?? [] : [],
    transport,
  });
  const displayMessages = isUsingDevTutorFixture
    ? devTutorFixtureState?.messages ?? []
    : messages;
  const latestAssistantMessageId = [...displayMessages]
    .reverse()
    .find((message) => message.role === "assistant")?.id ?? null;

  const errorMessage = isUsingDevTutorFixture
    ? devTutorFixtureState?.errorMessage ?? null
    : getErrorMessage(error);

  useEffect(() => {
    if (!isDevEnvironment) {
      return;
    }

    const fixtureFromUrl = getTutorFixtureScenario(fixtureIdFromUrl);
    if (fixtureFromUrl === null) {
      return;
    }

    if (devTutorFixtureState?.fixtureId !== fixtureFromUrl.id) {
      setDevTutorFixtureState(buildDevTutorFixtureState(fixtureFromUrl));
    }
  }, [devTutorFixtureState?.fixtureId, fixtureIdFromUrl, isDevEnvironment]);

  useEffect(() => {
    if (agentBaseUrl === null) {
      setAgentConnectionState("offline");
      return;
    }

    const abortController = new AbortController();
    setAgentConnectionState("checking");

    void getAgentHealth({ signal: abortController.signal })
      .then((healthy) => {
        if (!abortController.signal.aborted) {
          setAgentConnectionState(healthy ? "ready" : "offline");
        }
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          setAgentConnectionState("offline");
        }
      });

    return () => {
      abortController.abort();
    };
  }, [agentBaseUrl]);

  useEffect(() => {
    setDraftPrompt(
      selectedSession?.knowledgePointId === null
        ? ""
        : buildDefaultAgentPrompt(runtimeUnit, projectContext),
    );
  }, [runtimeUnit, selectedSession?.id, selectedSession?.knowledgePointId]);

  useEffect(() => {
    if (selectedSession === undefined) {
      return;
    }

    setSessionMessagesById((current) =>
      current[selectedSession.id] === messages
        ? current
        : {
            ...current,
            [selectedSession.id]: messages,
          },
    );
  }, [messages, selectedSessionKey]);

  useEffect(() => {
    if (selectedSession === undefined || error === undefined) {
      return;
    }

    if (currentActivityKey !== null) {
      setActivityResolutionsBySession((current) => {
        const sessionResolutions = current[selectedSession.id];
        if (sessionResolutions === undefined || sessionResolutions[currentActivityKey] === undefined) {
          return current;
        }

        const nextSessionResolutions = { ...sessionResolutions };
        delete nextSessionResolutions[currentActivityKey];

        return {
          ...current,
          [selectedSession.id]: nextSessionResolutions,
        };
      });
    }

    setRunningSessionIds((current) =>
      current[selectedSession.id] !== true
        ? current
        : {
            ...current,
            [selectedSession.id]: false,
          },
    );
    setSessions((current) =>
      current.map((session) =>
        session.id === selectedSession.id
          ? session.status === "错误"
            ? session
            : {
                ...session,
                status: "错误",
                updatedAt: "刚刚",
              }
          : session,
      ),
      );
  }, [currentActivityKey, error, selectedSession?.id]);

  useEffect(() => {
    if (
      agentConnectionState !== "ready" ||
      selectedSessionKey === null ||
      selectedSessionKnowledgePointId === null
    ) {
      return;
    }

    const bootstrapKey = `${selectedSessionKey}:${selectedSessionKnowledgePointId}`;
    if (bootstrapLoadedKeysRef.current[bootstrapKey]) {
      return;
    }

    bootstrapLoadedKeysRef.current[bootstrapKey] = true;
    const abortController = new AbortController();

    void getInspectorBootstrap(selectedSessionKey, selectedSessionKnowledgePointId, {
      signal: abortController.signal,
    })
      .then(({ learner_state: learnerState, review_inspector: reviewInspector, thread_context: threadContext }) => {
      if (abortController.signal.aborted) {
        return;
      }

      if (learnerState !== null) {
        setSessionSnapshots((current) => {
          const existingSnapshot = current[selectedSessionKey];
          if (existingSnapshot?.source === "live-agent") {
            return current;
          }

          return {
            ...current,
            [selectedSessionKey]: hydrateRuntimeSnapshotFromLearnerState(learnerState, mockRuntime),
          };
        });
      }

      setSessionReviewInspectors((current) => ({
        ...current,
        [selectedSessionKey]: reviewInspector,
      }));

      if (threadContext !== null) {
        setSessionEntryModes((current) => ({
          ...current,
          [selectedSessionKey]: threadContext.entry_mode,
        }));
        setSessionSourceAssetIds((current) => ({
          ...current,
          [selectedSessionKey]: threadContext.source_asset_ids,
        }));
      }
    })
      .catch(() => {
        delete bootstrapLoadedKeysRef.current[bootstrapKey];
        // Keep the local fallback snapshot when bootstrap data is temporarily unavailable.
      });

    return () => {
      abortController.abort();
    };
  }, [
    agentConnectionState,
    selectedSessionKey,
    selectedSessionKnowledgePointId,
  ]);

  useEffect(() => {
    if (agentConnectionState !== "ready" || assetSummaryKey === "") {
      return;
    }

    const abortController = new AbortController();

    void getAssetSummary(requestSourceAssetIds, {
      signal: abortController.signal,
    })
      .then((summary) => {
        if (abortController.signal.aborted) {
          return;
        }

        setAssetSummaryByKey((current) =>
          current[assetSummaryKey] !== undefined
            ? current
            : {
                ...current,
                [assetSummaryKey]: summary,
              },
        );
      })
      .catch(() => {
        // Keep the materials panel quiet when asset summary is temporarily unavailable.
      });

    return () => {
      abortController.abort();
    };
  }, [agentConnectionState, assetSummaryKey]);

  useEffect(() => {
    if (
      agentConnectionState !== "ready" ||
      selectedSessionKey === null ||
      selectedSessionKnowledgePointId === null ||
      isAgentRunning ||
      messages.length === 0
    ) {
      return;
    }

    const abortController = new AbortController();

    void getReviewInspector(selectedSessionKey, selectedSessionKnowledgePointId, {
      signal: abortController.signal,
    })
      .then((reviewInspector) => {
        if (abortController.signal.aborted) {
          return;
        }

        setSessionReviewInspectors((current) => ({
          ...current,
          [selectedSessionKey]: reviewInspector,
        }));
      })
      .catch(() => {
        // Keep the previous inspector data when refresh fails.
      });

    void getThreadContext(selectedSessionKey, {
      signal: abortController.signal,
    })
      .then((threadContext) => {
        if (abortController.signal.aborted || threadContext === null) {
          return;
        }

        setSessionEntryModes((current) => ({
          ...current,
          [selectedSessionKey]: threadContext.entry_mode,
        }));
        setSessionSourceAssetIds((current) => ({
          ...current,
          [selectedSessionKey]: threadContext.source_asset_ids,
        }));
      })
      .catch(() => {
        // Session-scoped local selections stay as fallback when persisted context is unavailable.
      });

    return () => {
      abortController.abort();
    };
  }, [
    agentConnectionState,
    isAgentRunning,
    messages.length,
    selectedSessionKey,
    selectedSessionKnowledgePointId,
  ]);

  function handleSelectProject(projectId: string): void {
    setSelectedProjectId(projectId);
    setSelectedSessionId("");
    setWorkspaceSection("overview");
    setIsProjectMetaOpen(false);
    setIsEditingProjectMeta(false);
    setIsCreatingProject(false);
    setPendingSessionIntent(null);
    setPendingInitialPrompt(null);
    setScreen("workspace");
    startTransition(() => {
      const firstKnowledgePoint = knowledgePoints.find((point) => point.projectId === projectId);
      if (firstKnowledgePoint !== undefined) {
        setSelectedKnowledgePointId(firstKnowledgePoint.id);
      }
    });
  }

  function handleStartCreatingProject(): void {
    setProjectDraft({
      name: "",
      topic: "",
      description: "",
      specialRulesText: "",
      initialMaterialIds: [],
    });
    setIsCreatingProject(true);
    setIsProjectMetaOpen(false);
    setPendingSessionIntent(null);
  }

  function handleSaveProject(): void {
    const nextName = projectDraft.name.trim();
    const nextTopic = projectDraft.topic.trim();
    const nextDescription = projectDraft.description.trim();
    const specialRules = projectDraft.specialRulesText
      .split("\n")
      .map((rule) => rule.trim())
      .filter((rule) => rule !== "");

    if (nextName === "" || nextTopic === "" || nextDescription === "") {
      return;
    }

    const createdProject: ProjectItem = {
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

    setProjects((current) => [createdProject, ...current]);
    setProjectMaterialIdsByProject((current) => ({
      ...current,
      [createdProject.id]: projectDraft.initialMaterialIds,
    }));
    setSessions((current) => [createdSession, ...current]);
    setSessionMessagesById((current) => ({ ...current, [createdSession.id]: [] }));
    setSessionSourceAssetIds((current) => ({ ...current, [createdSession.id]: getDefaultSourceAssetIds() }));
    setSelectedKnowledgePointId("");
    setSelectedProjectId(createdProject.id);
    setSelectedSessionId("");
    setIsProjectMetaOpen(true);
    setIsCreatingProject(false);
    setPendingSessionIntent(null);
    setSearchQuery("");
    setScreen("workspace");
  }

  function handleCancelCreatingProject(): void {
    setIsCreatingProject(false);
  }

  function handleStartEditingProjectMeta(): void {
    setProjectMetaDraft({
      topic: selectedProject.topic,
      description: selectedProject.description,
      specialRulesText: selectedProject.specialRules.join("\n"),
      materialIds: projectMaterialIdsByProject[selectedProject.id] ?? [],
    });
    setIsEditingProjectMeta(true);
  }

  function handleSaveProjectMeta(): void {
    const nextTopic = projectMetaDraft.topic.trim();
    const nextDescription = projectMetaDraft.description.trim();
    const nextSpecialRules = projectMetaDraft.specialRulesText
      .split("\n")
      .map((rule) => rule.trim())
      .filter((rule) => rule !== "");

    if (nextTopic === "" || nextDescription === "") {
      return;
    }

    setProjects((current) =>
      current.map((project) =>
        project.id === selectedProject.id
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
    setProjectMaterialIdsByProject((current) => ({
      ...current,
      [selectedProject.id]: projectMetaDraft.materialIds,
    }));
    setIsEditingProjectMeta(false);
  }

  function handleCancelEditingProjectMeta(): void {
    setProjectMetaDraft({
      topic: selectedProject.topic,
      description: selectedProject.description,
      specialRulesText: selectedProject.specialRules.join("\n"),
      materialIds: projectMaterialIdsByProject[selectedProject.id] ?? [],
    });
    setIsEditingProjectMeta(false);
  }

  function handlePrepareSessionStart(
    projectId: string,
    type: Extract<SessionType, "review" | "study">,
    knowledgePointId: string | null = null,
  ): void {
    const targetProject =
      projects.find((project) => project.id === projectId) ?? selectedProject ?? projects[0];

    if (targetProject === undefined) {
      return;
    }

    const targetPoint =
      knowledgePointId === null
        ? null
        : knowledgePoints.find((point) => point.id === knowledgePointId) ?? null;
    const projectMaterialIds = projectMaterialIdsByProject[targetProject.id] ?? [];
    const suggestedSourceAssetIds =
      targetPoint === null
        ? []
        : targetPoint.sourceAssetIds.filter((assetId) => projectMaterialIds.includes(assetId));

    setSelectedProjectId(targetProject.id);
    setSelectedSessionId("");
    setSelectedKnowledgePointId(targetPoint?.id ?? selectedKnowledgePointId);
    setWorkspaceSection(type === "review" ? "due-review" : "overview");
    setIsEditingProjectMeta(false);
    setIsProjectMetaOpen(false);
    setPendingInitialPrompt(null);
    setDraftPrompt("");
    setSearchQuery("");
    setPendingSessionIntent({
      projectId: targetProject.id,
      type,
      knowledgePointId: targetPoint?.id ?? knowledgePointId,
      knowledgePointTitle: targetPoint?.title ?? null,
      sourceAssetIds: suggestedSourceAssetIds,
    });
    setScreen("workspace");
  }

  function handleCreateSession(
    projectId: string,
    type: SessionType = "project",
    knowledgePointId: string | null = null,
    initialSourceAssetIds: ReadonlyArray<string> = getDefaultSourceAssetIds(),
  ): SessionItem | null {
    const targetProject =
      projects.find((project) => project.id === projectId) ?? selectedProject ?? projects[0];

    if (targetProject === undefined) {
      return null;
    }

    const nextIndex = sessions.filter((session) => session.projectId === targetProject.id).length + 1;
    const titlePrefix =
      type === "study" ? "学习" : type === "review" ? "复习" : "project";
    const summary =
      type === "study"
        ? "围绕未学知识点启动一轮学习。"
        : type === "review"
          ? "围绕待复习知识点安排一轮回拉。"
          : "继续围绕 project 目标推进材料与知识点。";
    const createdSession: SessionItem = {
      id: `session-${Date.now()}`,
      projectId: targetProject.id,
      type,
      knowledgePointId,
      title: `${titlePrefix} session ${nextIndex}`,
      summary,
      updatedAt: "刚刚",
      status: "空白",
    };

    setSessions((current) => [createdSession, ...current]);
    setSessionMessagesById((current) => ({ ...current, [createdSession.id]: [] }));
    setDraftPrompt("");
    setSessionEntryModes((current) => ({ ...current, [createdSession.id]: "chat-question" }));
    setSessionSourceAssetIds((current) => ({
      ...current,
      [createdSession.id]: initialSourceAssetIds,
    }));
    setSelectedProjectId(targetProject.id);
    setSelectedSessionId(createdSession.id);
    setIsEditingProjectMeta(false);
    setIsProjectMetaOpen(false);
    setPendingSessionIntent(null);
    setScreen("workspace");
    return createdSession;
  }

  function handleOpenKnowledgePoint(pointId: string): void {
    setSelectedKnowledgePointId(pointId);
    setSelectedSessionId("");
    setIsEditingProjectMeta(false);
    setIsProjectMetaOpen(false);
    setPendingSessionIntent(null);
    setScreen("detail");
  }

  function handleStartArchiveConfirmation(pointId: string): void {
    setArchiveConfirmationPointId((current) =>
      current === pointId ? null : pointId,
    );
  }

  function handleArchiveKnowledgePoint(pointId: string): void {
    setKnowledgePoints((current) =>
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
    setArchiveConfirmationPointId(null);
  }

  function handleStartEditingKnowledgePoint(): void {
    if (selectedKnowledgePoint === null) {
      return;
    }

    setArchiveConfirmationPointId(null);
    setKnowledgePointDraft({
      title: selectedKnowledgePoint.title,
      description: selectedKnowledgePoint.description,
    });
    setIsEditingKnowledgePoint(true);
  }

  function handleSaveKnowledgePoint(): void {
    if (selectedKnowledgePoint === null) {
      return;
    }

    const nextTitle = knowledgePointDraft.title.trim();
    const nextDescription = knowledgePointDraft.description.trim();
    if (nextTitle === "" || nextDescription === "") {
      return;
    }

    setKnowledgePoints((current) =>
      current.map((point) =>
        point.id === selectedKnowledgePoint.id
          ? {
              ...point,
              title: nextTitle,
              description: nextDescription,
              updatedAt: "刚刚",
            }
          : point,
      ),
    );
    setIsEditingKnowledgePoint(false);
    setArchiveConfirmationPointId(null);
  }

  function handleSubmitPrompt(): void {
    const text = draftPrompt.trim();
    if (text === "") {
      return;
    }

    if (selectedSession === undefined) {
      if (pendingSessionIntent === null) {
        return;
      }

      const createdSession = handleCreateSession(
        pendingSessionIntent.projectId,
        pendingSessionIntent.type,
        pendingSessionIntent.knowledgePointId,
        pendingSessionIntent.sourceAssetIds,
      );

      if (createdSession === null) {
        return;
      }

      setPendingInitialPrompt({
        sessionId: createdSession.id,
        text,
        sessionSummary: text,
      });
      setDraftPrompt("");
      return;
    }

    if (isUsingDevTutorFixture) {
      setDevTutorFixtureState((current) => {
        if (current === null) {
          return current;
        }

        const assistantReply =
          "这是 dev fixture 的本地回复，用来继续打磨消息流密度、markdown 样式和无卡片场景。";

        return {
          ...current,
          errorMessage: null,
          messages: [
            ...current.messages,
            createFixtureUiMessage("user", text, "free-user"),
            createFixtureUiMessage("assistant", assistantReply, "free-assistant"),
          ],
          snapshot: {
            ...current.snapshot,
            activity: null,
            activities: [],
            assistantMessage: assistantReply,
          },
        };
      });
      setDraftPrompt("");
      return;
    }

    handleSendToAgent({
      text,
      sessionSummary: text,
    });
    setDraftPrompt("");
  }

  function handleSendToAgent(input: {
    readonly text: string;
    readonly sessionSummary: string;
  }): void {
    if (selectedSession === undefined) {
      return;
    }

    setSessions((current) =>
      current.map((session) =>
        session.id === selectedSession.id
          ? {
              ...session,
              summary: input.sessionSummary,
              updatedAt: "刚刚",
              status: "运行中",
            }
          : session,
      ),
    );
    setRunningSessionIds((current) => ({
      ...current,
      [selectedSession.id]: true,
    }));

    void sendMessage({ text: input.text });
  }

  useEffect(() => {
    if (
      pendingInitialPrompt === null ||
      selectedSession?.id !== pendingInitialPrompt.sessionId
    ) {
      return;
    }

    setSessions((current) =>
      current.map((session) =>
        session.id === pendingInitialPrompt.sessionId
          ? {
              ...session,
              summary: pendingInitialPrompt.sessionSummary,
              updatedAt: "刚刚",
              status: "运行中",
            }
          : session,
      ),
    );
    setRunningSessionIds((current) => ({
      ...current,
      [pendingInitialPrompt.sessionId]: true,
    }));
    void sendMessage({ text: pendingInitialPrompt.text });
    setPendingInitialPrompt(null);
  }, [pendingInitialPrompt, selectedSession?.id, sendMessage]);

  function handleSubmitActivity(submission: LearningActivitySubmission): void {
    if (selectedSession === undefined || currentActivity === null || currentActivityKey === null) {
      return;
    }

    if (error !== undefined) {
      clearError();
    }

    setActivityResolutionsBySession((current) => ({
      ...current,
      [selectedSession.id]: {
        ...(current[selectedSession.id] ?? {}),
        [currentActivityKey]: "submitted",
      },
    }));

    if (isUsingDevTutorFixture && activeTutorFixture !== null) {
      if (activeTutorFixture.submitErrorMessage !== null) {
        setActivityResolutionsBySession((current) => {
          const sessionResolutions = current[selectedSession.id] ?? {};
          const nextSessionResolutions = { ...sessionResolutions };
          delete nextSessionResolutions[currentActivityKey];
          return {
            ...current,
            [selectedSession.id]: nextSessionResolutions,
          };
        });
        setDevTutorFixtureState((current) =>
          current === null
            ? current
            : {
                ...current,
                errorMessage: activeTutorFixture.submitErrorMessage,
              },
        );
        return;
      }

      const submissionText = formatActivitySubmissionForAgent({
        activity: currentActivity,
        submission,
      });
      setDevTutorFixtureState((current) =>
        current === null
          ? current
          : {
              ...current,
              errorMessage: null,
              messages: [
                ...current.messages,
                createFixtureUiMessage("user", submissionText, "submit-user"),
                createFixtureUiMessage("assistant", activeTutorFixture.submitReply, "submit-assistant"),
              ],
              snapshot: getNextFixtureSnapshot(current.snapshot, activeTutorFixture.submitReply),
            },
      );
      return;
    }

    handleSendToAgent({
      text: formatActivitySubmissionForAgent({
        activity: currentActivity,
        submission,
      }),
      sessionSummary: `${currentActivity.title} / ${getActionLabel(activeRuntime.state.recommendedAction)}`,
    });
  }

  function handleSkipActivity(): void {
    if (selectedSession === undefined || currentActivity === null || currentActivityKey === null) {
      return;
    }

    if (error !== undefined) {
      clearError();
    }

    setActivityResolutionsBySession((current) => ({
      ...current,
      [selectedSession.id]: {
        ...(current[selectedSession.id] ?? {}),
        [currentActivityKey]: "skipped",
      },
    }));

    if (isUsingDevTutorFixture && activeTutorFixture !== null) {
      setDevTutorFixtureState((current) =>
        current === null
          ? current
          : {
              ...current,
              errorMessage: null,
              messages: [
                ...current.messages,
                createFixtureUiMessage(
                  "user",
                  `我先跳过「${currentActivity.title}」这轮学习动作。`,
                  "skip-user",
                ),
                createFixtureUiMessage("assistant", activeTutorFixture.skipReply, "skip-assistant"),
              ],
              snapshot: getNextFixtureSnapshot(current.snapshot, activeTutorFixture.skipReply),
            },
      );
      return;
    }

    handleSendToAgent({
      text: `我先跳过「${currentActivity.title}」这轮学习动作。请基于当前状态重新安排下一步，并告诉我为什么要这样推进。`,
      sessionSummary: `${currentActivity.title} / 跳过后重新编排`,
    });
  }

  return (
    <main className="xidea-shell min-h-screen bg-[var(--xidea-parchment)] text-[var(--xidea-near-black)]">
      <div className="relative mx-auto min-h-screen max-w-[1520px] px-3 py-3 lg:px-4 lg:py-4">
        <div className="space-y-4">
          <Card className="rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
            <CardContent className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <button
                  className="rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-1.5 text-sm font-medium text-[var(--xidea-near-black)]"
                  onClick={() => {
                    setScreen("home");
                    setSelectedSessionId("");
                  }}
                  type="button"
                >
                  Xidea
                </button>
                <div className="min-w-0">
                  <p className="xidea-kicker">Project-centric learning workspace</p>
                  <p className="text-sm text-[var(--xidea-stone)]">
                    {screen === "home"
                      ? "先选 project，再进入知识点池或 session 工作态。"
                      : `${selectedProject.name} / ${screen === "detail" ? "Knowledge Point Detail" : "Project Workspace"}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-[220px] items-center gap-2 rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-2 text-sm text-[var(--xidea-charcoal)]">
                  <Search className="h-4 w-4 shrink-0 text-[var(--xidea-stone)]" />
                  <input
                    className="w-full bg-transparent outline-none placeholder:text-[var(--xidea-stone)]"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={
                      screen === "home"
                        ? "搜索 project"
                        : "搜索 knowledge point"
                    }
                    value={searchQuery}
                  />
                </label>
                <Button
                  className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                  onClick={handleStartCreatingProject}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  新建 Project
                </Button>
              </div>
            </CardContent>
          </Card>

          {isCreatingProject ? (
            <CreateProjectPanel
              assets={sourceAssets}
              draft={projectDraft}
              onCancel={handleCancelCreatingProject}
              onChange={setProjectDraft}
              onSave={handleSaveProject}
            />
          ) : null}

          {screen === "home" ? (
            <HomeScreen
              continueProjectSummary={continueProjectSummary}
              continueActionLabel={continueActionLabel}
              filteredProjects={filteredProjectSummaries}
              homeSection={homeSection}
              homeSectionCounts={homeSectionCounts}
              onContinueProject={() => {
                if (continueProjectSummary !== null) {
                  handleSelectProject(continueProjectSummary.project.id);
                }
              }}
              onHomeSectionChange={setHomeSection}
              onOpenProject={handleSelectProject}
              onStartReview={() => {
                if (continueProjectSummary !== null) {
                  handlePrepareSessionStart(
                    continueProjectSummary.project.id,
                    "review",
                    continueReviewTargetPoint?.id ?? null,
                  );
                }
              }}
              totalProjects={projects.length}
            />
          ) : (
            <div className="space-y-4">
              <Card className="rounded-[1.45rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] shadow-none">
                <CardContent className="space-y-4 p-6">
                  {screen === "detail" ? (
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-1.5 text-sm text-[var(--xidea-charcoal)]"
                      onClick={() => setScreen("workspace")}
                      type="button"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      返回 Project Workspace
                    </button>
                  ) : null}
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <p className="xidea-kicker text-[var(--xidea-selection-text)]">Project Workspace</p>
                      <h1 className="text-2xl font-medium text-[var(--xidea-near-black)]">{selectedProject.name}</h1>
                      <p className="text-sm leading-7 text-[var(--xidea-charcoal)]">{selectedProject.topic}</p>
                      <p className="max-w-4xl text-sm leading-7 text-[var(--xidea-stone)]">{selectedProject.description}</p>
                    </div>

                    {screen !== "detail" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="rounded-full bg-[var(--xidea-terracotta)] text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                          disabled={studyTargetPoint === undefined}
                          onClick={() =>
                            handlePrepareSessionStart(
                              selectedProject.id,
                              "study",
                              studyTargetPoint?.id ?? null,
                            )
                          }
                          type="button"
                        >
                          学习
                        </Button>
                        <Button
                          className="rounded-full"
                          disabled={reviewTargetPoint === undefined}
                          onClick={() =>
                            handlePrepareSessionStart(
                              selectedProject.id,
                              "review",
                              reviewTargetPoint?.id ?? null,
                            )
                          }
                          type="button"
                          variant="outline"
                        >
                          复习
                        </Button>
                        <Button
                          className="rounded-full"
                          onClick={() => handleCreateSession(selectedProject.id, "project")}
                          type="button"
                          variant="outline"
                        >
                          <MessageSquareText className="h-4 w-4" />
                          新建 project session
                        </Button>
                        <Button
                          className="rounded-full"
                          onClick={() => setIsProjectMetaOpen((current) => !current)}
                          type="button"
                          variant="outline"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          More
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {isProjectMetaOpen ? (
                <div className="space-y-4">
                  <ProjectMetaPanel
                    materialCount={projectMaterialCount}
                    materials={selectedProjectMaterials}
                    onClose={() => {
                      setIsProjectMetaOpen(false);
                      setIsEditingProjectMeta(false);
                    }}
                    project={selectedProject}
                    sessionCount={selectedProjectSessions.length}
                  />
                  <Card className="rounded-[1.35rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                    <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-2">
                        <p className="xidea-kicker text-[var(--xidea-selection-text)]">Project Settings</p>
                        <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                          继续调整当前 project 的主题、规则和材料池，不需要回到首页重建。
                        </p>
                      </div>
                      <Button
                        className="rounded-full"
                        onClick={handleStartEditingProjectMeta}
                        type="button"
                        variant="outline"
                      >
                        编辑 Project Meta
                      </Button>
                    </CardContent>
                  </Card>

                  {isEditingProjectMeta ? (
                    <EditProjectMetaPanel
                      assets={sourceAssets}
                      draft={projectMetaDraft}
                      onCancel={handleCancelEditingProjectMeta}
                      onChange={setProjectMetaDraft}
                      onSave={handleSaveProjectMeta}
                    />
                  ) : null}
                </div>
              ) : null}

              {screen === "detail" && selectedKnowledgePoint !== null ? (
                <KnowledgePointDetailScreen
                  draft={knowledgePointDraft}
                  isEditing={isEditingKnowledgePoint}
                  isArchiveConfirmationOpen={
                    archiveConfirmationPointId === selectedKnowledgePoint.id
                  }
                  knowledgePoint={selectedKnowledgePoint}
                  knowledgePointAssets={selectedKnowledgePointAssets}
                  onCancelArchiveConfirmation={() => setArchiveConfirmationPointId(null)}
                  onCancelEditing={() => {
                    setKnowledgePointDraft({
                      title: selectedKnowledgePoint.title,
                      description: selectedKnowledgePoint.description,
                    });
                    setIsEditingKnowledgePoint(false);
                  }}
                  onChangeDraft={setKnowledgePointDraft}
                  onConfirmArchive={() =>
                    handleArchiveKnowledgePoint(selectedKnowledgePoint.id)
                  }
                  onOpenSession={(sessionId) => {
                    setPendingSessionIntent(null);
                    setSelectedSessionId(sessionId);
                    setScreen("workspace");
                  }}
                  onSave={handleSaveKnowledgePoint}
                  onStartArchiveConfirmation={() =>
                    handleStartArchiveConfirmation(selectedKnowledgePoint.id)
                  }
                  onStartEditing={handleStartEditingKnowledgePoint}
                  onStartReview={() =>
                    handlePrepareSessionStart(
                      selectedProject.id,
                      "review",
                      selectedKnowledgePoint.id,
                    )
                  }
                  onStartStudy={() =>
                    handlePrepareSessionStart(
                      selectedProject.id,
                      "study",
                      selectedKnowledgePoint.id,
                    )
                  }
                  reviewHeatmap={knowledgePointReviewHeatmap}
                  reviewHistorySummary={knowledgePointReviewHistorySummary}
                  relatedSessions={knowledgePointRelatedSessions}
                  selectedSessionId={selectedSessionId}
                />
              ) : selectedSession === undefined ? (
                <WorkspaceBrowseScreen
                  filteredKnowledgePoints={filteredKnowledgePoints}
                  normalizedSearchQuery={normalizedSearchQuery}
                  onOpenKnowledgePoint={handleOpenKnowledgePoint}
                  onOpenSession={(sessionId) => {
                    setPendingSessionIntent(null);
                    setSelectedSessionId(sessionId);
                  }}
                  onCancelPendingSession={() => {
                    setPendingSessionIntent(null);
                    setDraftPrompt("");
                  }}
                  onChangePendingPrompt={setDraftPrompt}
                  onSubmitPendingPrompt={handleSubmitPrompt}
                  pendingPrompt={draftPrompt}
                  pendingSessionIntent={pendingSessionIntent}
                  projectMaterialCount={projectMaterialCount}
                  projectMaterials={selectedProjectMaterials}
                  onWorkspaceSectionChange={setWorkspaceSection}
                  profileSummary={browseProfileSummary}
                  projectStats={projectStats}
                  selectedProjectSessions={selectedProjectSessions}
                  onTogglePendingMaterial={(assetId) => {
                    setPendingSessionIntent((current) =>
                      current === null
                        ? current
                        : {
                            ...current,
                            sourceAssetIds: current.sourceAssetIds.includes(assetId)
                              ? current.sourceAssetIds.filter((id) => id !== assetId)
                              : [...current.sourceAssetIds, assetId],
                          },
                    );
                  }}
                  workspaceSection={workspaceSection}
                />
              ) : (
                <ProjectSessionWorkspace
                  activeAssetSummary={activeAssetSummary}
                  activeReviewInspector={activeReviewInspector}
                  activeRuntime={activeRuntime}
                  activeSourceAssets={activeSourceAssets}
                  activeTutorFixtureId={activeTutorFixture?.id ?? null}
                  agentConnectionState={agentConnectionState}
                  currentActivities={currentActivities}
                  currentActivity={currentActivity}
                  currentActivityKey={currentActivityKey}
                  currentActivityResolution={currentActivityResolution}
                  displayMessages={displayMessages}
                  draftPrompt={draftPrompt}
                  errorMessage={errorMessage}
                  generatedProfileSummary={generatedProfile.summary}
                  hasPendingActivity={hasPendingActivity}
                  hasPersistedState={hasPersistedState}
                  hasStructuredRuntime={hasStructuredRuntime}
                  isAgentRunning={isAgentRunning}
                  isBlankSession={isBlankSession}
                  isDevEnvironment={isDevEnvironment}
                  isMaterialsTrayOpen={isMaterialsTrayOpen}
                  isUsingDevTutorFixture={isUsingDevTutorFixture}
                  latestAssistantMessageId={latestAssistantMessageId}
                  latestReviewedLabel={
                    latestReviewedEvent?.event_at
                      ? formatDateLabel(latestReviewedEvent.event_at) ?? "待回读"
                      : activeRuntime.state.lastReviewedAt ?? "待回读"
                  }
                  nextReviewLabel={
                    activeReviewInspector?.scheduledAt
                      ? formatDateLabel(activeReviewInspector.scheduledAt) ?? "待安排"
                      : activeRuntime.state.nextReviewAt ?? "待安排"
                  }
                  onChangeDraftPrompt={(value) => {
                    if (error !== undefined) {
                      clearError();
                    }
                    if (isUsingDevTutorFixture) {
                      setDevTutorFixtureState((current) =>
                        current === null
                          ? current
                          : {
                              ...current,
                              errorMessage: null,
                            },
                      );
                    }
                    setDraftPrompt(value);
                  }}
                  onCloseSession={() => setSelectedSessionId("")}
                  onDisableTutorFixture={() => {
                    setDevTutorFixtureQueryParam(null);
                    setDevTutorFixtureState(null);
                  }}
                  onOpenKnowledgePoint={handleOpenKnowledgePoint}
                  onOpenSession={(sessionId) => {
                    setPendingSessionIntent(null);
                    setSelectedSessionId(sessionId);
                  }}
                  onSelectTutorFixture={(fixture) => {
                    setDevTutorFixtureQueryParam(fixture.id);
                    setDevTutorFixtureState(buildDevTutorFixtureState(fixture));
                  }}
                  onSkipActivity={handleSkipActivity}
                  onSubmitActivity={handleSubmitActivity}
                  onSubmitPrompt={handleSubmitPrompt}
                  onToggleMaterialsTray={() => {
                    if (selectedSessionKey === null) {
                      return;
                    }

                    setSessionMaterialTrayOpen((current) => ({
                      ...current,
                      [selectedSessionKey]: !isMaterialsTrayOpen,
                    }));
                  }}
                  onToggleProjectMaterial={(assetId) => {
                    setSessionSourceAssetIds((current) => {
                      const currentSelection = current[selectedSession.id] ?? [];

                      return {
                        ...current,
                        [selectedSession.id]: currentSelection.includes(assetId)
                          ? currentSelection.filter((id) => id !== assetId)
                          : [...currentSelection, assetId],
                      };
                    });
                  }}
                  onUnsetSourceAsset={(assetId) => {
                    setSessionSourceAssetIds((current) => ({
                      ...current,
                      [selectedSession.id]: (current[selectedSession.id] ?? []).filter(
                        (id) => id !== assetId,
                      ),
                    }));
                  }}
                  onWorkspaceSectionChange={(section) => {
                    setWorkspaceSection(section);
                    setSelectedSessionId("");
                  }}
                  projectStats={projectStats}
                  relatedKnowledgePoints={relatedKnowledgePoints}
                  requestSourceAssetIds={requestSourceAssetIds}
                  reviewHeatmap={reviewHeatmap}
                  selectedProject={selectedProject}
                  selectedProjectMaterials={selectedProjectMaterials}
                  selectedProjectSessions={selectedProjectSessions}
                  selectedSession={selectedSession}
                  selectedSourceAssetIds={selectedSourceAssetIds}
                  selectedUnitTitle={selectedUnit?.title ?? null}
                  submitDisabled={hasPendingActivity || isAgentRunning || agentBaseUrl === null}
                  tutorFixtureScenarios={tutorFixtureScenarios}
                  workspaceSection={workspaceSection}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
