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
  FileInput,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { KnowledgePointDetailScreen } from "@/components/project-workspace-detail";
import { LearningActivityStack } from "@/components/learning-activity-stack";
import { MarkdownContent } from "@/components/markdown-content";
import {
  CreateProjectPanel,
  EditProjectMetaPanel,
} from "@/components/project-workspace-management";
import {
  HomeScreen,
  WorkspaceBrowseScreen,
} from "@/components/project-workspace-screens";
import {
  CompactNote,
  getAssetKindLabel,
  MetricTile,
  MonitorSection,
  ProjectMetaPanel,
  SessionCard,
  SessionTypeBadge,
  WorkspaceNavButton,
  getKnowledgePointAccent,
} from "@/components/project-workspace-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { learnerProfiles, learningUnits, projectContext, sourceAssets } from "@/data/demo";
import {
  initialKnowledgePoints,
  initialProjects,
  initialSessions,
} from "@/data/project-workspace-demo";
import {
  getTutorFixtureScenario,
  tutorFixtureScenarios,
  type TutorFixtureScenario,
} from "@/data/tutor-fixtures";
import {
  buildDefaultAgentPrompt,
  formatActivitySubmissionForAgent,
  buildMockRuntimeSnapshot,
  getRequestSourceAssetIds,
  hydrateRuntimeSnapshotFromLearnerState,
  type AgentAssetSummary,
  type AgentEntryMode,
  type AgentReviewEvent,
  type AgentReviewInspector,
  type AgentAction,
  type RuntimeSnapshot,
} from "@/domain/agent-runtime";
import {
  getNextSuggestedAction,
  getProjectStats,
  type AppScreen,
  type KnowledgePointItem,
  type KnowledgePointStatus,
  type ProjectItem,
  type SessionItem,
  type SessionType,
  type WorkspaceSection,
} from "@/domain/project-workspace";
import type { LearningActivitySubmission, LearningMode, SourceAsset } from "@/domain/types";
import { createAgentChatTransport } from "@/lib/agent-chat-transport";
import {
  getAgentBaseUrl,
  getAgentHealth,
  getAssetSummary,
  getInspectorBootstrap,
  getReviewInspector,
  getThreadContext,
} from "@/lib/agent-client";

type ActivityResolution = "submitted" | "skipped";

interface DevTutorFixtureState {
  readonly fixtureId: string;
  readonly messages: ReadonlyArray<UIMessage>;
  readonly snapshot: RuntimeSnapshot;
  readonly errorMessage: string | null;
}

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

const metricCopy = [
  { key: "understandingLevel", label: "理解", tone: "emerald" },
  { key: "memoryStrength", label: "记忆", tone: "amber" },
  { key: "confusion", label: "混淆", tone: "rose" },
  { key: "transferReadiness", label: "迁移", tone: "sky" },
] as const;

function getModeBadgeClass(_mode: LearningMode): string {
  return "border-[var(--xidea-sand)] bg-[var(--xidea-parchment)] text-[var(--xidea-charcoal)]";
}

function getActionLabel(action: AgentAction): string {
  switch (action) {
    case "apply":
      return "迁移验证";
    case "clarify":
      return "边界澄清";
    case "practice":
      return "练习强化";
    case "review":
      return "复习回拉";
    case "teach":
      return "导师建模";
  }
}

function sanitizeVisibleAssistantText(text: string): string {
  const withoutThinkBlocks = text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "");
  const withoutDanglingThink = withoutThinkBlocks.replace(/<think\b[^>]*>[\s\S]*$/i, "");
  const withoutWrappers = withoutDanglingThink
    .replace(/^\s*<(answer|output|response|result|json)\b[^>]*>\s*/i, "")
    .replace(/\s*<\/(answer|output|response|result|json)>\s*$/i, "");
  return withoutWrappers.trim();
}

function getMessageText(message: UIMessage): string {
  const textFromParts = message.parts
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }

      return "";
    })
    .join("")
    .trim();
  const fallbackText =
    typeof (message as { content?: unknown }).content === "string"
      ? (message as { content?: string }).content ?? ""
      : "";
  const text = (textFromParts || fallbackText).trim();
  const visibleText = message.role === "assistant" ? sanitizeVisibleAssistantText(text) : text;

  if (visibleText === "" && message.role === "assistant") {
    return "";
  }

  return visibleText === "" ? "当前消息没有文本内容。" : visibleText;
}

function getLatestUserDraft(messages: ReadonlyArray<UIMessage>, draftPrompt: string): string {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (latestUserMessage !== undefined) {
    const text = getMessageText(latestUserMessage);
    if (text !== "当前消息没有文本内容。") {
      return text;
    }
  }

  return draftPrompt.trim();
}

function createFixtureUiMessage(
  role: "assistant" | "user",
  content: string,
  seed: string,
): UIMessage {
  return {
    id: `fixture-${seed}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    parts: [{ type: "text", text: content }],
    content,
  } as UIMessage;
}

function buildDevTutorFixtureState(
  fixture: TutorFixtureScenario,
): DevTutorFixtureState {
  return {
    fixtureId: fixture.id,
    messages: fixture.messages.map((message, index) =>
      createFixtureUiMessage(message.role, message.content, `${fixture.id}-${index}`),
    ),
    snapshot: fixture.snapshot,
    errorMessage: null,
  };
}

function getDefaultSourceAssetIds(): ReadonlyArray<string> {
  return [];
}

function getNextFixtureSnapshot(
  snapshot: RuntimeSnapshot,
  assistantMessage: string,
): RuntimeSnapshot {
  const remainingActivities = snapshot.activities.slice(1);

  return {
    ...snapshot,
    activity: remainingActivities[0] ?? null,
    activities: remainingActivities,
    assistantMessage,
  };
}

function buildGeneratedProfileSummary(
  runtime: RuntimeSnapshot,
  latestUserInput: string,
): {
  readonly title: string;
  readonly summary: string;
  readonly evidence: ReadonlyArray<string>;
} {
  const stage =
    runtime.state.recommendedAction === "clarify" || runtime.state.confusion >= 65
      ? "概念边界待拉清"
      : runtime.state.recommendedAction === "review" || runtime.state.memoryStrength <= 50
        ? "记忆可用性待回拉"
        : runtime.state.recommendedAction === "apply" ||
            (runtime.state.transferReadiness !== null && runtime.state.transferReadiness >= 65)
          ? "已进入项目迁移验证"
          : "理解框架待稳定";
  const evidence = [
    runtime.state.weakSignals[0] ?? runtime.stateSource,
    runtime.source === "live-agent"
      ? runtime.decision.reason
      : "当前只恢复了 learner state，下一轮会基于真实状态重新生成诊断和路径。",
    latestUserInput === "" ? "还没有新的用户输入，先沿用当前 session 状态。" : `最近输入：${latestUserInput}`,
  ];

  return {
    title: `系统当前把这个 session 视为「${stage}」`,
    summary: "画像来自当前 learner state、诊断动作和已落库证据，不再依赖前端预设角色猜测。",
    evidence,
  };
}

interface ReviewHeatmapCell {
  readonly dateKey: string;
  readonly tooltip: string;
  readonly intensity: 0 | 1 | 2 | 3 | 4;
}

function getLatestReviewEvent(
  events: ReadonlyArray<AgentReviewEvent>,
  kind: AgentReviewEvent["event_kind"],
): AgentReviewEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.event_kind === kind) {
      return event;
    }
  }

  return null;
}

function formatDateLabel(value: string | null): string | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildReviewHeatmap(
  reviewEvents: ReadonlyArray<AgentReviewEvent>,
  lastReviewedAt: string | null,
  nextReviewAt: string | null,
): ReadonlyArray<ReadonlyArray<ReviewHeatmapCell>> {
  const totalDays = 35;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventMap = new Map<string, { intensity: ReviewHeatmapCell["intensity"]; notes: string[] }>();

  for (const event of reviewEvents) {
    const date = formatDateLabel(event.event_at);
    if (date === null) {
      continue;
    }

    const existing = eventMap.get(date);
    const nextIntensity = event.event_kind === "reviewed" ? 4 : 2;
    const nextNotes = existing?.notes ?? [];
    nextNotes.push(
      event.event_kind === "reviewed"
        ? "已发生一次真实复盘"
        : `已安排复盘：${event.review_reason ?? "等待本轮回拉"}`,
    );
    eventMap.set(date, {
      intensity: existing ? Math.max(existing.intensity, nextIntensity) as ReviewHeatmapCell["intensity"] : nextIntensity,
      notes: nextNotes,
    });
  }

  const cells: ReviewHeatmapCell[] = [];

  for (let index = totalDays - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);

    const dateKey = toDateKey(date);
    const event = eventMap.get(dateKey);
    let intensity: 0 | 1 | 2 | 3 | 4 = event?.intensity ?? 0;
    const notes = event?.notes ?? [];

    if (lastReviewedAt !== null && dateKey === lastReviewedAt) {
      intensity = Math.max(intensity, 4) as ReviewHeatmapCell["intensity"];
      notes.push("当前 learner state 记录：最近一次复盘");
    }

    if (nextReviewAt !== null && dateKey === nextReviewAt) {
      intensity = Math.max(intensity, 1) as ReviewHeatmapCell["intensity"];
      notes.push("当前 Review Engine 计划：下一次复盘");
    }

    const tooltip =
      notes.length === 0
        ? `${dateKey} 暂无复习动作`
        : `${dateKey} ${notes.join(" / ")}`;

    cells.push({
      dateKey,
      tooltip,
      intensity,
    });
  }

  return Array.from({ length: 5 }, (_, weekIndex) =>
    cells.slice(weekIndex * 7, weekIndex * 7 + 7),
  );
}

function buildEmptyReviewHeatmap(): ReadonlyArray<ReadonlyArray<ReviewHeatmapCell>> {
  const totalDays = 35;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (totalDays - index - 1));

    return {
      dateKey: toDateKey(date),
      tooltip: `${toDateKey(date)} 暂无复习动作`,
      intensity: 0 as const,
    };
  });

  return Array.from({ length: 5 }, (_, weekIndex) =>
    cells.slice(weekIndex * 7, weekIndex * 7 + 7),
  );
}

function getHeatmapCellClass(intensity: ReviewHeatmapCell["intensity"]): string {
  switch (intensity) {
    case 0:
      return "bg-[var(--xidea-parchment)]";
    case 1:
      return "bg-[#e7d8cf]";
    case 2:
      return "bg-[#ddb9a8]";
    case 3:
      return "bg-[#d98e70]";
    case 4:
      return "bg-[var(--xidea-terracotta)]";
  }
}

function getErrorMessage(error: Error | undefined): string | null {
  if (error === undefined) {
    return null;
  }

  const message = error.message.trim();
  if (message === "") {
    return "Agent 当前不可用，请稍后重试。";
  }

  if (message.startsWith("{")) {
    return "Agent 当前不可用，请检查本地服务或代理配置。";
  }

  return message;
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
  const filteredProjects = useMemo(() => {
    if (normalizedSearchQuery === "") {
      return projects;
    }

    return projects.filter((project) =>
      [project.name, project.topic, project.description]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery),
    );
  }, [normalizedSearchQuery, projects]);
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
  const continueProject = projects[0] ?? selectedProject;
  const continueProjectPoints = knowledgePoints.filter((point) => point.projectId === continueProject.id);
  const continueProjectStats = getProjectStats(continueProjectPoints);
  const continueActionLabel = getNextSuggestedAction(continueProjectPoints);
  const continueReviewTargetPoint =
    continueProjectPoints.find((point) => point.status === "active_review") ?? null;
  const filteredProjectSummaries = useMemo(
    () =>
      filteredProjects.map((project) => ({
        project,
        stats: getProjectStats(
          knowledgePoints.filter((point) => point.projectId === project.id),
        ),
      })),
    [filteredProjects, knowledgePoints],
  );
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
  }

  function handleStartEditingKnowledgePoint(): void {
    if (selectedKnowledgePoint === null) {
      return;
    }

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
              continueActionLabel={continueActionLabel}
              continueProject={continueProject}
              continueProjectStats={continueProjectStats}
              filteredProjects={filteredProjectSummaries}
              onContinueProject={() => handleSelectProject(continueProject.id)}
              onOpenProject={handleSelectProject}
              onStartReview={() => {
                handlePrepareSessionStart(
                  continueProject.id,
                  "review",
                  continueReviewTargetPoint?.id ?? null,
                );
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
                  knowledgePoint={selectedKnowledgePoint}
                  knowledgePointAssets={selectedKnowledgePointAssets}
                  onArchive={() => handleArchiveKnowledgePoint(selectedKnowledgePoint.id)}
                  onCancelEditing={() => {
                    setKnowledgePointDraft({
                      title: selectedKnowledgePoint.title,
                      description: selectedKnowledgePoint.description,
                    });
                    setIsEditingKnowledgePoint(false);
                  }}
                  onChangeDraft={setKnowledgePointDraft}
                  onOpenSession={(sessionId) => {
                    setPendingSessionIntent(null);
                    setSelectedSessionId(sessionId);
                    setScreen("workspace");
                  }}
                  onSave={handleSaveKnowledgePoint}
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
                <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
                  <Card className="rounded-[1.4rem] border-[var(--xidea-border)] bg-[#f1f0ea] shadow-none">
                    <CardContent className="space-y-4 p-3">
                      <div className="space-y-2">
                        <WorkspaceNavButton active={workspaceSection === "overview"} count={projectStats.total - projectStats.archived} label="Overview" onClick={() => {
                          setWorkspaceSection("overview");
                          setSelectedSessionId("");
                        }} />
                        <WorkspaceNavButton active={workspaceSection === "due-review"} count={projectStats.dueReview} label="Due Review" onClick={() => {
                          setWorkspaceSection("due-review");
                          setSelectedSessionId("");
                        }} />
                        <WorkspaceNavButton active={workspaceSection === "archived"} count={projectStats.archived} label="Archived" onClick={() => {
                          setWorkspaceSection("archived");
                          setSelectedSessionId("");
                        }} />
                      </div>

                      <div className="space-y-2 rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-3">
                        <p className="xidea-kicker text-[var(--xidea-stone)]">Recent Sessions</p>
                        {selectedProjectSessions.slice(0, 5).map((session) => (
                          <SessionCard
                            active={session.id === selectedSession.id}
                            key={session.id}
                            onClick={() => {
                              setPendingSessionIntent(null);
                              setSelectedSessionId(session.id);
                            }}
                            title={session.title}
                            type={session.type}
                            updatedAt={session.updatedAt}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="flex min-h-0 flex-col overflow-hidden rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] shadow-none">
                    <CardHeader className="gap-3 border-b border-[var(--xidea-border)] px-5 pb-4 pt-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="truncate text-sm font-medium text-[var(--xidea-near-black)]">
                            {selectedSession.title}
                          </CardTitle>
                          <CardDescription className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--xidea-stone)]">
                            <SessionTypeBadge type={selectedSession.type} />
                            <span>{selectedSession.status}</span>
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className="border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-stone)] shadow-none"
                            variant="outline"
                          >
                            {isAgentRunning
                              ? "Streaming"
                              : agentConnectionState === "offline"
                                ? "Offline"
                                : activeRuntime.source === "live-agent"
                                  ? "Live Agent"
                                  : activeRuntime.source === "hydrated-state"
                                    ? "Hydrated"
                                    : agentConnectionState === "ready"
                                      ? "Agent Ready"
                                      : "Checking"}
                          </Badge>
                          <Button className="rounded-full" onClick={() => setSelectedSessionId("")} type="button" variant="outline">
                            关闭 session
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-0">
                      <div className="px-5 pt-5 lg:px-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <Button
                              className="rounded-full border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-charcoal)] hover:border-[var(--xidea-selection-border)] hover:bg-[#f8f6f1]"
                              onClick={() => {
                                if (selectedSessionKey === null) {
                                  return;
                                }

                                setSessionMaterialTrayOpen((current) => ({
                                  ...current,
                                  [selectedSessionKey]: !isMaterialsTrayOpen,
                                }));
                              }}
                              type="button"
                              variant="outline"
                            >
                              <FileInput className="h-4 w-4" />
                              {isMaterialsTrayOpen ? "收起材料" : "添加材料"}
                            </Button>
                            {selectedSourceAssetIds.length > 0 ? (
                              <Badge
                                className="border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)] shadow-none"
                                variant="outline"
                              >
                                已附 {selectedSourceAssetIds.length} 份材料
                              </Badge>
                            ) : (
                              <span className="text-sm text-[var(--xidea-stone)]">
                                当前先按纯对话推进，需要时再把材料挂进这一轮。
                              </span>
                            )}
                          </div>

                          {selectedSourceAssetIds.length > 0 ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              {activeSourceAssets.slice(0, 3).map((asset) => (
                                <button
                                  className="rounded-full border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-3 py-1.5 text-[12px] text-[var(--xidea-selection-text)] transition-colors hover:bg-[#f2e6df]"
                                  key={asset.id}
                                  onClick={() => {
                                    setSessionSourceAssetIds((current) => ({
                                      ...current,
                                      [selectedSession.id]: (current[selectedSession.id] ?? []).filter(
                                        (id) => id !== asset.id,
                                      ),
                                    }));
                                  }}
                                  type="button"
                                >
                                  {asset.title}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <Separator className="bg-[var(--xidea-border)]" />

                      <div className="min-h-0 flex-1 px-5 lg:px-6">
                        <ScrollArea className="h-full pr-3">
                          <div className="space-y-4 pb-4">
                            {isMaterialsTrayOpen ? (
                              <section className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5ede9] text-[var(--xidea-terracotta)]">
                                    <FileInput className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="xidea-kicker text-[var(--xidea-stone)]">材料</p>
                                    <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                                      这些材料会作为本轮附加上下文一起送给 agent，不需要先切模式。
                                    </p>
                                  </div>
                                </div>
                                <div className="grid gap-3 lg:grid-cols-2">
                                  {selectedProjectMaterials.map((asset) => {
                                    const selected = selectedSourceAssetIds.includes(asset.id);

                                    return (
                                      <button
                                        className={
                                          selected
                                            ? "rounded-[1rem] bg-[var(--xidea-selection)] px-4 py-4 text-left transition-colors"
                                            : "rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4 text-left transition-colors hover:bg-[#f8f2ee]"
                                        }
                                        key={asset.id}
                                        onClick={() => {
                                          setSessionSourceAssetIds((current) => {
                                            const currentSelection = current[selectedSession.id] ?? [];

                                            return {
                                              ...current,
                                              [selectedSession.id]: currentSelection.includes(asset.id)
                                                ? currentSelection.filter((id) => id !== asset.id)
                                                : [...currentSelection, asset.id],
                                            };
                                          });
                                        }}
                                        type="button"
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                                            {asset.title}
                                          </p>
                                          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--xidea-stone)]">
                                            {getAssetKindLabel(asset.kind)}
                                          </span>
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-[var(--xidea-charcoal)]">
                                          {asset.topic}
                                        </p>
                                      </button>
                                    );
                                  })}
                                </div>
                                {selectedProjectMaterials.length === 0 ? (
                                    <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                                      <CardContent className="px-4 py-4 text-sm leading-6 text-[var(--xidea-stone)]">
                                      当前 project 还没有材料。先到 More 里的“编辑 Project Meta”把材料加入项目池，再挂进 session。
                                      </CardContent>
                                    </Card>
                                  ) : null}
                              </section>
                            ) : null}

                            {displayMessages.length === 0 ? (
                              <Card className="rounded-[1.1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                                <CardContent className="px-4 py-4 text-sm leading-6 text-[var(--xidea-stone)]">
                                  当前 session 还没有消息。你可以先输入问题、补材料，或让系统直接开始学习 / 复习。
                                </CardContent>
                              </Card>
                            ) : (
                              displayMessages.map((message) => {
                                const isAssistant = message.role === "assistant";
                                const rawText = getMessageText(message);
                                if (isAssistant && rawText === "") {
                                  return null;
                                }

                                return (
                                  <div className="space-y-3" key={message.id}>
                                    <div className={isAssistant ? "flex justify-start" : "flex justify-end"}>
                                      {isAssistant ? (
                                        <div className="w-full max-w-[82%] py-0.5">
                                          <div className="mb-1.5 flex items-center gap-2">
                                            <span className="xidea-kicker text-[var(--xidea-selection-text)]">
                                              Agent
                                            </span>
                                          </div>
                                          <MarkdownContent content={rawText} />
                                        </div>
                                      ) : (
                                        <Card className="w-full max-w-[72%] rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                                          <CardContent className="px-3 py-2.5 text-sm leading-6 text-[var(--xidea-charcoal)]">
                                            <div>{rawText}</div>
                                          </CardContent>
                                        </Card>
                                      )}
                                    </div>

                                    {isAssistant &&
                                    message.id === latestAssistantMessageId &&
                                    hasStructuredRuntime &&
                                    currentActivity !== null ? (
                                      <div className="w-full max-w-[82%] pl-1">
                                        <LearningActivityStack
                                          activities={currentActivities}
                                          disabled={isAgentRunning || agentBaseUrl === null}
                                          key={`${selectedSession.id}-${currentActivityKey ?? currentActivity.id}`}
                                          onSkip={handleSkipActivity}
                                          onSubmit={handleSubmitActivity}
                                          resolution={currentActivityResolution}
                                        />
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </ScrollArea>
                      </div>

                      <div className="shrink-0 border-t border-[var(--xidea-border)] px-5 py-4 lg:px-6">
                        <Card className="rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                          <CardContent className="p-4">
                            <div className="relative">
                              <Textarea
                                className="min-h-28 rounded-[1rem] border-[var(--xidea-sand)] bg-[var(--xidea-ivory)] pr-28 pb-12 text-sm leading-7 text-[var(--xidea-charcoal)] shadow-none focus-visible:ring-[var(--xidea-selection-border)]"
                                disabled={hasPendingActivity || isAgentRunning || agentBaseUrl === null}
                                onChange={(event) => {
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
                                  setDraftPrompt(event.target.value);
                                }}
                                placeholder={
                                  hasPendingActivity
                                    ? "先完成当前学习动作或跳过，再继续对话。"
                                    : selectedSourceAssetIds.length > 0
                                      ? "补一句你希望系统围绕这些材料先判断什么、澄清什么，或生成什么训练动作。"
                                      : "输入这一轮你想推进的问题或材料。"
                                }
                                value={draftPrompt}
                              />

                              <Button
                                className="absolute bottom-3 right-3 rounded-full bg-[var(--xidea-terracotta)] px-4 text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                                disabled={hasPendingActivity || isAgentRunning || agentBaseUrl === null}
                                onClick={handleSubmitPrompt}
                                type="button"
                              >
                                {isAgentRunning ? "运行中..." : "发送"}
                              </Button>
                            </div>

                            {errorMessage ? (
                              <Card className="mt-4 rounded-[1rem] border-[#ebd5cc] bg-[#f9efea] shadow-none">
                                <CardContent className="px-4 py-3 text-sm leading-6 text-[var(--xidea-selection-text)]">
                                  {errorMessage}
                                </CardContent>
                              </Card>
                            ) : hasPendingActivity ? (
                              <p className="mt-3 text-sm leading-6 text-[var(--xidea-stone)]">
                                这轮先完成上面的学习动作，或者选择跳过，再继续自由对话。
                              </p>
                            ) : null}
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    {isDevEnvironment ? (
                      <MonitorSection accent="Mock" title="Tutor Fixtures">
                        <div className="space-y-2">
                          <p className="text-[13px] leading-6 text-[var(--xidea-charcoal)]">
                            用前端本地场景直接打磨 activity 插卡、gating 和失败回滚，不用起后端。
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              className="h-8 rounded-full px-3"
                              onClick={() => {
                                setDevTutorFixtureQueryParam(null);
                                setDevTutorFixtureState(null);
                              }}
                              size="sm"
                              type="button"
                              variant={isUsingDevTutorFixture ? "outline" : "default"}
                            >
                              关闭
                            </Button>
                            {tutorFixtureScenarios.map((fixture) => (
                              <Button
                                className="h-8 rounded-full px-3"
                                key={fixture.id}
                                onClick={() => {
                                  setDevTutorFixtureQueryParam(fixture.id);
                                  setDevTutorFixtureState(buildDevTutorFixtureState(fixture));
                                }}
                                size="sm"
                                type="button"
                                variant={activeTutorFixture?.id === fixture.id ? "default" : "outline"}
                              >
                                {fixture.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </MonitorSection>
                    ) : null}

                    <MonitorSection title="当前相关知识点">
                      <div className="space-y-3">
                        {relatedKnowledgePoints.map((point) => (
                          <button
                            className="w-full rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-4 py-3 text-left transition-colors hover:border-[var(--xidea-selection-border)]"
                            key={point.id}
                            onClick={() => handleOpenKnowledgePoint(point.id)}
                            type="button"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-[var(--xidea-near-black)]">{point.title}</p>
                              <Badge className={`border px-2 py-1 text-[12px] shadow-none ${getKnowledgePointAccent(point.status)}`} variant="outline">
                                {point.stageLabel}
                              </Badge>
                            </div>
                            <p className="mt-2 text-[13px] leading-6 text-[var(--xidea-charcoal)]">{point.description}</p>
                            <p className="mt-2 text-[12px] text-[var(--xidea-stone)]">{point.nextReviewLabel ?? "等待下一次调度"}</p>
                          </button>
                        ))}
                      </div>
                    </MonitorSection>

                    <MonitorSection
                      accent={
                        activeRuntime.source === "live-agent"
                          ? "Live"
                          : activeRuntime.source === "hydrated-state"
                            ? "Hydrated"
                            : "Mock"
                      }
                      title="Session Summary"
                    >
                      <CompactNote label="Project" value={selectedProject.name} />
                      <CompactNote label="Session" value={selectedSession.status} />
                      <CompactNote label="Mode" value={hasStructuredRuntime ? activeRuntime.decision.title : "待生成"} />
                      <CompactNote
                        label="State"
                        value={hasPersistedState ? activeRuntime.stateSource : "当前 session 还没有真实 learner state。"}
                      />
                      {hasPersistedState ? (
                        <div className="rounded-[0.95rem] bg-[var(--xidea-selection)] px-3 py-3 text-[13px] leading-6 text-[var(--xidea-charcoal)]">
                          {generatedProfile.summary}
                        </div>
                      ) : null}
                    </MonitorSection>

                    <MonitorSection title="Materials">
                      <CompactNote
                        label="Selected"
                        value={
                          isBlankSession
                            ? "0 assets"
                            : selectedSourceAssetIds.length > 0
                              ? `${requestSourceAssetIds.length} attached`
                              : `${requestSourceAssetIds.length} linked`
                        }
                      />
                      <CompactNote label="Knowledge" value={selectedUnit?.title ?? "未指定"} />
                      <CompactNote label="Context" value={activeAssetSummary?.summary ?? "等待读取真实材料上下文"} />
                      {activeAssetSummary?.keyConcepts.length ? (
                        <div className="flex flex-wrap gap-2">
                          {activeAssetSummary.keyConcepts.slice(0, 4).map((concept) => (
                            <Badge
                              className="border-[var(--xidea-sand)] bg-[var(--xidea-ivory)] px-2 py-1 text-[12px] text-[var(--xidea-charcoal)] shadow-none"
                              key={concept}
                              variant="outline"
                            >
                              {concept}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </MonitorSection>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
