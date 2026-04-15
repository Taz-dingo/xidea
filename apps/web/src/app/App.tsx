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
  type ReactNode,
} from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  FileInput,
  Folder,
  FolderOpen,
  MessageSquareText,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { LearningActivityCard } from "@/components/learning-activity-card";
import { MarkdownContent } from "@/components/markdown-content";
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
import { MODE_LABELS } from "@/domain/planner";
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

const entryModes = [
  { id: "chat-question" as const, icon: MessageSquareText, title: "问答进入" },
  { id: "material-import" as const, icon: FileInput, title: "材料进入" },
];

const sessionMetaByUnitId: Record<string, { updatedAt: string; status: string }> = {
  "unit-1": { updatedAt: "1h", status: "诊断中" },
  "unit-2": { updatedAt: "昨天", status: "待澄清" },
  "unit-3": { updatedAt: "2d", status: "待答辩" },
};

interface ProjectItem {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

const initialProjects: ReadonlyArray<ProjectItem> = [
  {
    id: "project-rag-demo",
    name: projectContext.name,
    description: "围绕同一个比赛案例组织 session。",
  },
] as const;

interface SessionItem {
  readonly id: string;
  readonly projectId: string;
  readonly unitId: string | null;
  readonly title: string;
  readonly summary: string;
  readonly updatedAt: string;
  readonly status: string;
}

type ActivityResolution = "submitted" | "skipped";

const initialSessions: ReadonlyArray<SessionItem> = learningUnits.map((unit) => {
  const meta = sessionMetaByUnitId[unit.id] ?? { updatedAt: "刚刚", status: "进行中" };

  return {
    id: `session-${unit.id}`,
    projectId: "project-rag-demo",
    unitId: unit.id,
    title: unit.title,
    summary: unit.summary,
    updatedAt: meta.updatedAt,
    status: meta.status,
  };
});

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

function getMetricDotClass(tone: "emerald" | "amber" | "rose" | "sky"): string {
  switch (tone) {
    case "emerald":
      return "bg-[#7a9d83]";
    case "amber":
      return "bg-[#b98a4a]";
    case "sky":
      return "bg-[#7f9eb7]";
    case "rose":
      return "bg-[#b37a7f]";
  }
}

function getAssetKindLabel(kind: (typeof sourceAssets)[number]["kind"]): string {
  switch (kind) {
    case "audio":
      return "音频";
    case "image":
      return "图片";
    case "note":
      return "笔记";
    case "pdf":
      return "PDF";
    case "video":
      return "视频";
    case "web":
      return "网页";
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

function getDefaultSourceAssetIds(entryMode: AgentEntryMode): ReadonlyArray<string> {
  return getRequestSourceAssetIds(entryMode, sourceAssets);
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

function SessionCard({
  active,
  title,
  updatedAt,
  onClick,
}: {
  active: boolean;
  title: string;
  updatedAt: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      className={
        active
          ? "flex w-full items-center justify-between gap-3 rounded-[0.9rem] border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xidea-selection-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xidea-parchment)]"
          : "flex w-full items-center justify-between gap-3 rounded-[0.9rem] border border-transparent bg-transparent px-3 py-2 text-left transition-colors hover:border-[var(--xidea-border)] hover:bg-[var(--xidea-white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xidea-selection-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xidea-parchment)]"
      }
      onClick={onClick}
      type="button"
    >
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
      <span
        className={
          active
            ? "shrink-0 text-[11px] text-[var(--xidea-selection-text)]"
            : "shrink-0 text-[11px] text-[var(--xidea-stone)]"
        }
      >
        {updatedAt}
      </span>
    </button>
  );
}

function ProjectCard({
  active,
  expanded,
  name,
  onClick,
  onCreateSession,
}: {
  active: boolean;
  expanded: boolean;
  name: string;
  onClick: () => void;
  onCreateSession: () => void;
}): ReactElement {
  return (
    <div
      className={
        active
          ? "flex items-center justify-between gap-2 rounded-[1rem] border border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] px-2 py-2 shadow-none transition-colors"
          : "flex items-center justify-between gap-2 rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-2 py-2 shadow-none transition-colors hover:border-[var(--xidea-selection-border)] hover:bg-[#fcfbf7]"
      }
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[0.85rem] px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xidea-selection-border)]"
        onClick={onClick}
        type="button"
      >
        <div
          className={
            active
              ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.85rem] bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)]"
              : "flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.85rem] bg-[var(--xidea-parchment)] text-[var(--xidea-stone)]"
          }
        >
          {expanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
        </div>
      </button>

      <Button
        className="h-8 w-8 shrink-0 rounded-[0.85rem] text-[var(--xidea-stone)] hover:bg-[var(--xidea-parchment)] hover:text-[var(--xidea-near-black)]"
        onClick={onCreateSession}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

function InspectorCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Card className="rounded-[1.25rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardHeader className="pb-4">
        <CardTitle className="xidea-kicker text-[var(--xidea-stone)]">{title}</CardTitle>
        {description ? <CardDescription className="text-sm text-[var(--xidea-stone)]">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function MonitorSection({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Card className="min-w-0 overflow-hidden rounded-[1.1rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
      <CardHeader className="px-4 pb-3 pt-4">
        <CardTitle className="xidea-kicker text-[var(--xidea-stone)]">
          {title}
          {accent ? <span className="ml-2 text-[var(--xidea-selection-text)]">{accent}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3 px-4 pb-4 pt-0">{children}</CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose" | "sky";
}): ReactElement {
  return (
    <div className="min-w-0 overflow-hidden rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-3 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${getMetricDotClass(tone)}`} />
        <span className="truncate text-[11px] uppercase tracking-[0.14em] text-[var(--xidea-stone)]">
          {label}
        </span>
      </div>
      <p className="mt-2 min-w-0 break-words text-sm font-medium leading-5 text-[var(--xidea-near-black)]">
        {value}
      </p>
    </div>
  );
}

function CompactNote({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-[0.95rem] bg-[var(--xidea-parchment)] px-3 py-2.5">
      <span className="shrink-0 pt-0.5 text-[11px] uppercase tracking-[0.14em] text-[var(--xidea-stone)]">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words text-right text-sm leading-5 text-[var(--xidea-charcoal)]">
        {value}
      </span>
    </div>
  );
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

  if (initialProfile === undefined || initialUnit === undefined || initialProject === undefined) {
    throw new Error("Demo data must contain at least one learner profile, learning unit, and project.");
  }

  const [projects, setProjects] = useState<ReadonlyArray<ProjectItem>>(initialProjects);
  const [sessions, setSessions] = useState<ReadonlyArray<SessionItem>>(initialSessions);
  const [expandedProjectIds, setExpandedProjectIds] = useState<ReadonlyArray<string>>([
    initialProject.id,
  ]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialSessions[0]?.projectId ?? initialProject.id);
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessions[0]?.id ?? "");
  const [sessionEntryModes, setSessionEntryModes] = useState<Record<string, AgentEntryMode>>(
    () => Object.fromEntries(initialSessions.map((session) => [session.id, "chat-question"])),
  );
  const [sessionSourceAssetIds, setSessionSourceAssetIds] = useState<Record<string, ReadonlyArray<string>>>(
    () =>
      Object.fromEntries(
        initialSessions.map((session) => [session.id, getDefaultSourceAssetIds("chat-question")]),
      ),
  );
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(() =>
    buildDefaultAgentPrompt(initialUnit, projectContext),
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
  const selectedUnitId = selectedSession?.unitId ?? null;
  const selectedUnit = selectedSession?.unitId
    ? learningUnits.find((unit) => unit.id === selectedSession.unitId)
    : undefined;
  const runtimeUnit = selectedUnit ?? initialUnit;
  const seedProfile = initialProfile;
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? initialProject;
  const selectedEntryMode = selectedSession
    ? sessionEntryModes[selectedSession.id] ?? "chat-question"
    : "chat-question";
  const selectedSourceAssetIds = selectedSession
    ? sessionSourceAssetIds[selectedSession.id] ?? getDefaultSourceAssetIds(selectedEntryMode)
    : getDefaultSourceAssetIds(selectedEntryMode);
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
  const activeRuntime =
    selectedSession === undefined ? mockRuntime : sessionSnapshots[selectedSession.id] ?? mockRuntime;
  const currentActivity = activeRuntime.activity;
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
    selectedSession.unitId === null &&
    sessionMessageCount === 0 &&
    sessionSnapshots[selectedSession.id] === undefined &&
    draftPrompt.trim() === "";
  const activeSourceAssets = useMemo(
    () => sourceAssets.filter((asset) => selectedSourceAssetIds.includes(asset.id)),
    [selectedSourceAssetIds],
  );
  const activeSourceAssetsRef = useRef<ReadonlyArray<SourceAsset>>(activeSourceAssets);
  activeSourceAssetsRef.current = activeSourceAssets;
  const requestSourceAssetIds = useMemo(
    () => getRequestSourceAssetIds(selectedEntryMode, activeSourceAssets),
    [activeSourceAssets, selectedEntryMode],
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
  const isAgentRunning = selectedSessionKey === null ? false : runningSessionIds[selectedSessionKey] === true;
  const hasPendingActivity =
    hasStructuredRuntime && currentActivity !== null && currentActivityResolution === null;

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
        entryMode: selectedEntryMode,
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
      selectedEntryMode,
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
  const latestAssistantMessageId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id ?? null;

  const errorMessage = getErrorMessage(error);

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
      selectedSession?.unitId === null
        ? ""
        : buildDefaultAgentPrompt(runtimeUnit, projectContext),
    );
  }, [runtimeUnit, selectedSession?.id, selectedSession?.unitId]);

  useEffect(() => {
    setIsEvidenceExpanded(false);
  }, [selectedSession?.id]);

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
      selectedUnitId === null
    ) {
      return;
    }

    const bootstrapKey = `${selectedSessionKey}:${selectedUnitId}`;
    if (bootstrapLoadedKeysRef.current[bootstrapKey]) {
      return;
    }

    bootstrapLoadedKeysRef.current[bootstrapKey] = true;
    const abortController = new AbortController();

    void getInspectorBootstrap(selectedSessionKey, selectedUnitId, {
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
    selectedUnitId,
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
      selectedUnitId === null ||
      isAgentRunning ||
      messages.length === 0
    ) {
      return;
    }

    const abortController = new AbortController();

    void getReviewInspector(selectedSessionKey, selectedUnitId, {
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
  }, [agentConnectionState, isAgentRunning, messages.length, selectedSessionKey, selectedUnitId]);

  function handleSelectProject(projectId: string): void {
    setSelectedProjectId(projectId);

    const firstProjectSession = sessions.find((session) => session.projectId === projectId);
    setSelectedSessionId(firstProjectSession?.id ?? "");
  }

  function handleToggleProject(projectId: string): void {
    setExpandedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
  }

  function handleCreateProject(): void {
    const nextIndex = projects.length + 1;
    const createdProject: ProjectItem = {
      id: `project-${Date.now()}`,
      name: `新项目 ${nextIndex}`,
      description: "围绕一个新的答辩主题组织 session。",
    };

    setProjects((current) => [createdProject, ...current]);
    setSelectedProjectId(createdProject.id);
    setSelectedSessionId("");
    setExpandedProjectIds((current) => [createdProject.id, ...current]);
  }

  function handleCreateSession(projectId: string): void {
    const targetProject =
      projects.find((project) => project.id === projectId) ?? selectedProject ?? projects[0];

    if (targetProject === undefined) {
      return;
    }

    const nextIndex = sessions.filter((session) => session.projectId === targetProject.id).length + 1;
    const createdSession: SessionItem = {
      id: `session-${Date.now()}`,
      projectId: targetProject.id,
      unitId: null,
      title: `新对话 ${nextIndex}`,
      summary: "暂无内容",
      updatedAt: "刚刚",
      status: "空白",
    };

    setSessions((current) => [createdSession, ...current]);
    setSessionMessagesById((current) => ({ ...current, [createdSession.id]: [] }));
    setDraftPrompt("");
    setSessionEntryModes((current) => ({ ...current, [createdSession.id]: "chat-question" }));
    setSessionSourceAssetIds((current) => ({ ...current, [createdSession.id]: [] }));
    setSelectedProjectId(targetProject.id);
    setSelectedSessionId(createdSession.id);
    setExpandedProjectIds((current) =>
      current.includes(targetProject.id) ? current : [...current, targetProject.id],
    );
  }

  function handleSubmitPrompt(): void {
    if (selectedSession === undefined) {
      return;
    }

    const text = draftPrompt.trim();
    if (text === "") {
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
    handleSendToAgent({
      text: `我先跳过「${currentActivity.title}」这轮学习动作。请基于当前状态重新安排下一步，并告诉我为什么要这样推进。`,
      sessionSummary: `${currentActivity.title} / 跳过后重新编排`,
    });
  }

  return (
    <main className="xidea-shell min-h-screen bg-[var(--xidea-parchment)] text-[var(--xidea-near-black)]">
      <div className="relative mx-auto min-h-screen max-w-[1520px] px-3 py-3 lg:h-screen lg:min-h-0 lg:px-4 lg:py-4">
        <div className="grid items-start gap-3 lg:h-full lg:grid-cols-[280px_minmax(0,1fr)_328px] lg:items-stretch">
          <Card className="overflow-hidden rounded-[1.4rem] border-[var(--xidea-border)] bg-[#f1f0ea] shadow-none lg:h-full">
            <CardContent className="flex h-full flex-col p-3">
              <div className="flex min-h-0 flex-1 flex-col space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="xidea-kicker">Projects</p>
                  <Button
                    className="h-8 w-8 rounded-[0.85rem] text-[var(--xidea-stone)] hover:bg-[var(--xidea-white)] hover:text-[var(--xidea-near-black)]"
                    onClick={handleCreateProject}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="space-y-2 pr-1">
                    {projects.map((project) => {
                      const projectSessions = sessions.filter((session) => session.projectId === project.id);
                      const activeProject = project.id === selectedProject?.id;
                      const expanded = expandedProjectIds.includes(project.id);

                      return (
                        <div key={project.id}>
                          <ProjectCard
                            active={activeProject}
                            expanded={expanded}
                            name={project.name}
                            onClick={() => {
                              if (!activeProject) {
                                handleSelectProject(project.id);
                              }
                              handleToggleProject(project.id);
                            }}
                            onCreateSession={() => {
                              handleCreateSession(project.id);
                            }}
                          />

                          <div
                            className={
                              expanded
                                ? "xidea-sidebar-reveal mt-2 ml-4 box-border grid w-[calc(100%-1rem)] grid-rows-[1fr] border-l border-[var(--xidea-sand)] pl-3 opacity-100"
                                : "xidea-sidebar-reveal ml-4 box-border grid w-[calc(100%-1rem)] grid-rows-[0fr] border-l border-[var(--xidea-sand)] pl-3 opacity-0"
                            }
                          >
                            <div className="overflow-hidden">
                              <div className="space-y-2">
                                {projectSessions.length === 0 ? (
                                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                                    <CardContent className="px-4 py-3 text-sm text-[var(--xidea-stone)]">
                                      这个 project 还没有 session。
                                    </CardContent>
                                  </Card>
                                ) : null}
                                {projectSessions.map((session) => (
                                  <SessionCard
                                    active={session.id === selectedSession?.id}
                                    key={session.id}
                                    onClick={() => {
                                      startTransition(() => {
                                        setSelectedProjectId(project.id);
                                        setSelectedSessionId(session.id);
                                      });
                                    }}
                                    title={session.title}
                                    updatedAt={session.updatedAt}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden rounded-[1.4rem] border-[var(--xidea-border)] bg-[var(--xidea-ivory)] shadow-none lg:h-full">
            <CardHeader className="gap-3 border-b border-[var(--xidea-border)] px-5 pb-4 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-sm font-medium text-[var(--xidea-near-black)]">
                    {selectedSession?.title ?? `${selectedProject.name} / 暂无 session`}
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm text-[var(--xidea-stone)]">
                    {selectedProject.name} / {selectedSession?.status ?? "等待创建 session"}
                  </CardDescription>
                </div>
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
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-0">
              <div className="px-5 pt-5 lg:px-6">
                <div className="flex flex-wrap gap-2">
                  {entryModes.map((entry) => {
                    const Icon = entry.icon;
                    const active = entry.id === selectedEntryMode;

                    return (
                      <Button
                        className={
                          active
                            ? "rounded-full border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)] hover:bg-[#f2e6df]"
                            : "rounded-full border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-charcoal)] hover:border-[var(--xidea-selection-border)] hover:bg-[#f8f6f1]"
                        }
                        key={entry.id}
                        onClick={() => {
                          if (selectedSession === undefined) {
                            return;
                          }

                          setSessionEntryModes((current) => ({
                            ...current,
                            [selectedSession.id]: entry.id,
                          }));
                          if (entry.id === "material-import" && selectedSourceAssetIds.length === 0) {
                            setSessionSourceAssetIds((current) => ({
                              ...current,
                              [selectedSession.id]: getDefaultSourceAssetIds("material-import"),
                            }));
                          }
                        }}
                        type="button"
                        variant="outline"
                      >
                        <Icon className="h-4 w-4" />
                        {entry.title}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <Separator className="bg-[var(--xidea-border)]" />

              <div className="min-h-0 flex-1 px-5 lg:px-6">
                <ScrollArea className="h-full pr-3">
                  <div className="space-y-4 pb-4">
                    {selectedEntryMode === "material-import" ? (
                      <section className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5ede9] text-[var(--xidea-terracotta)]">
                            <FileInput className="h-4 w-4" />
                          </div>
                          <p className="xidea-kicker text-[var(--xidea-stone)]">材料</p>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-2">
                          {sourceAssets.map((asset) => {
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
                                  if (selectedSession === undefined) {
                                    return;
                                  }

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
                      </section>
                    ) : null}

                    {selectedSession === undefined || messages.length === 0 ? null : (
                      messages.map((message) => {
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
                                <LearningActivityCard
                                  activity={currentActivity}
                                  disabled={
                                    selectedSession === undefined ||
                                    isAgentRunning ||
                                    agentBaseUrl === null
                                  }
                                  key={`${selectedSession?.id ?? "seed"}-${currentActivityKey ?? currentActivity.id}`}
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

                    {hasStructuredRuntime ? (
                    <section className="space-y-4 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="xidea-kicker text-[var(--xidea-stone)]">编排证据</p>
                        <div className="flex items-center gap-2">
                          {activeRuntime.decision.confidence !== null ? (
                            <span className="text-[12px] font-medium text-[var(--xidea-selection-text)]">
                              {(activeRuntime.decision.confidence * 100).toFixed(0)}%
                            </span>
                          ) : null}
                          <div className="flex items-center gap-2">
                            <Button
                              className="h-8 w-8 rounded-[0.85rem] text-[var(--xidea-stone)] hover:bg-[var(--xidea-parchment)] hover:text-[var(--xidea-near-black)]"
                              onClick={() => {
                                setIsEvidenceExpanded((current) => !current);
                              }}
                              size="icon"
                              type="button"
                              variant="ghost"
                            >
                              {isEvidenceExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="text-sm leading-7 text-[var(--xidea-charcoal)]">
                        {activeRuntime.decision.reason}
                      </div>

                      {isEvidenceExpanded ? (
                        <>
                          <div className="grid gap-3 lg:grid-cols-3">
                            {activeRuntime.signalCards.map((signal) => (
                              <div className="space-y-2 rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4" key={signal.id}>
                                <p className="xidea-kicker text-[var(--xidea-selection-text)]">
                                  {signal.label}
                                </p>
                                <p className="text-sm font-medium leading-6 text-[var(--xidea-near-black)]">
                                  {signal.observation}
                                </p>
                                <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                                  {signal.implication}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-2">
                            <p className="xidea-kicker text-[var(--xidea-stone)]">Rationale</p>
                            {activeRuntime.rationale.length > 0 ? (
                              activeRuntime.rationale.map((item, index) => (
                                <div
                                  className="flex items-start gap-3 text-sm leading-7 text-[var(--xidea-charcoal)]"
                                  key={`${item}-${index}`}
                                >
                                  <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--xidea-terracotta)]" />
                                  <span>{item}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm leading-7 text-[var(--xidea-charcoal)]">
                                {activeRuntime.decision.reason}
                              </p>
                            )}
                          </div>

                          <div className="space-y-3">
                            <p className="xidea-kicker text-[var(--xidea-stone)]">Writeback</p>
                            {activeRuntime.writeback.map((item) => (
                              <div className="space-y-1 rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4" key={item.id}>
                                <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                                  {item.target}
                                </p>
                                <p className="text-sm leading-6 text-[var(--xidea-charcoal)]">
                                  {item.change}
                                </p>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </section>
                    ) : null}
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
                          setDraftPrompt(event.target.value);
                        }}
                        placeholder={
                          hasPendingActivity
                            ? "先完成当前学习动作或跳过，再继续对话。"
                            : selectedEntryMode === "material-import"
                            ? "补一句你希望系统围绕这些材料先判断什么、澄清什么，或生成什么训练动作。"
                            : "输入这一轮你想推进的问题或材料。"
                        }
                        value={draftPrompt}
                      />

                      <Button
                        className="absolute right-3 bottom-3 rounded-full bg-[var(--xidea-terracotta)] px-4 text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                        disabled={
                          selectedSession === undefined ||
                          hasPendingActivity ||
                          (selectedEntryMode === "material-import" &&
                            activeSourceAssets.length === 0) ||
                          isAgentRunning ||
                          agentBaseUrl === null
                        }
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

          <div className="min-h-0 min-w-0 lg:h-full">
            <ScrollArea className="h-full pr-1">
              <div className="grid gap-3 pb-1">
                <MonitorSection
                  accent={
                    activeRuntime.source === "live-agent"
                      ? "Live"
                      : activeRuntime.source === "hydrated-state"
                        ? "Hydrated"
                        : "Mock"
                  }
                  title="Session"
                >
                  <CompactNote label="Project" value={selectedProject.name} />
                  <CompactNote label="Thread" value={selectedSession?.status ?? "等待创建"} />
                  <CompactNote label="Mode" value={hasStructuredRuntime ? activeRuntime.decision.title : "待生成"} />
                  <CompactNote
                    label="Agent"
                    value={
                      !hasStructuredRuntime
                        ? "--"
                        : activeRuntime.decision.confidence !== null
                        ? `${(activeRuntime.decision.confidence * 100).toFixed(0)}% confidence`
                        : "live"
                    }
                  />
                  <CompactNote
                    label="State"
                    value={
                      hasPersistedState
                        ? activeRuntime.stateSource
                        : "当前 session 还没有真实 learner state。"
                    }
                  />
                </MonitorSection>

                <MonitorSection title="Learner">
                  <div className="grid grid-cols-2 gap-2">
                    {metricCopy.map((metric) => (
                      <MetricTile
                        key={metric.key}
                        label={metric.label}
                        tone={metric.tone}
                        value={
                          !hasPersistedState || activeRuntime.state[metric.key] === null
                            ? "--"
                            : `${activeRuntime.state[metric.key]}%`
                        }
                      />
                    ))}
                  </div>
                  <div className="rounded-[0.95rem] border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--xidea-selection-text)]">
                      Profile
                    </p>
                    <p className="mt-2 text-sm font-medium text-[var(--xidea-near-black)]">
                      {hasPersistedState ? generatedProfile.title : "--"}
                    </p>
                    {hasPersistedState ? (
                      <>
                        <p className="mt-2 text-[13px] leading-6 text-[var(--xidea-charcoal)]">
                          {generatedProfile.summary}
                        </p>
                        <p className="mt-2 text-[12px] leading-6 text-[var(--xidea-charcoal)]/80">
                          {generatedProfile.evidence[0]}
                        </p>
                      </>
                    ) : null}
                  </div>
                </MonitorSection>

                <MonitorSection title="Review">
                  <div className="grid grid-cols-2 gap-2">
                    <MetricTile
                      label="Last"
                      tone="amber"
                      value={
                        !hasPersistedState
                          ? "--"
                          : latestReviewedEvent?.event_at
                            ? formatDateLabel(latestReviewedEvent.event_at) ?? "未记录"
                            : activeRuntime.state.lastReviewedAt ?? "未记录"
                      }
                    />
                    <MetricTile
                      label="Next"
                      tone="sky"
                      value={
                        !hasPersistedState
                          ? "--"
                          : activeReviewInspector?.scheduledAt
                            ? formatDateLabel(activeReviewInspector.scheduledAt) ?? "待决定"
                            : activeRuntime.state.nextReviewAt ?? "待决定"
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(!hasPersistedState
                      ? []
                      : activeReviewInspector?.performanceTrend?.weakSignals ?? activeRuntime.state.weakSignals.slice(0, 3)
                    ).slice(0, 3).map((signal) => (
                      <Badge
                        className="border-[var(--xidea-sand)] bg-[var(--xidea-ivory)] px-2 py-1 text-[12px] text-[var(--xidea-charcoal)] shadow-none"
                        key={signal}
                        variant="outline"
                      >
                        {signal}
                      </Badge>
                    ))}
                  </div>
                  <CompactNote
                    label="Risk"
                    value={!hasPersistedState ? "--" : activeReviewInspector?.decayRisk ?? "unknown"}
                  />
                  {activeReviewInspector?.summary ? (
                    <div className="rounded-[0.95rem] bg-[var(--xidea-selection)] px-3 py-3 text-[13px] leading-6 text-[var(--xidea-charcoal)]">
                      {activeReviewInspector.summary}
                    </div>
                  ) : null}
                  <div className="rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--xidea-stone)]">
                        Heatmap
                      </p>
                      <span className="text-[11px] text-[var(--xidea-stone)]">5w</span>
                    </div>
                    <div className="mt-3 grid grid-cols-5 gap-1.5">
                      {reviewHeatmap.map((week, weekIndex) => (
                        <div className="grid grid-rows-7 gap-1.5" key={`week-${weekIndex}`}>
                          {week.map((cell) => (
                            <div
                              className={`h-3.5 w-full rounded-[3px] ${getHeatmapCellClass(cell.intensity)}`}
                              key={cell.dateKey}
                              title={cell.tooltip}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </MonitorSection>

                <MonitorSection title="Materials">
                  <CompactNote
                    label="Selected"
                    value={
                      isBlankSession
                        ? "0 assets"
                        : selectedEntryMode === "material-import"
                        ? `${requestSourceAssetIds.length} assets`
                        : `${requestSourceAssetIds.length} linked`
                    }
                  />
                  <CompactNote label="Unit" value={selectedUnit?.title ?? "未指定"} />
                  <CompactNote
                    label="Context"
                    value={activeAssetSummary?.summary ?? "等待读取真实材料上下文"}
                  />
                  <div className="rounded-[0.95rem] bg-[var(--xidea-parchment)] px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-[var(--xidea-terracotta)]" />
                      <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                        {hasStructuredRuntime ? activeRuntime.decision.title : "材料上下文"}
                      </p>
                    </div>
                    {hasStructuredRuntime ? (
                      <p className="mt-2 text-[13px] leading-6 text-[var(--xidea-charcoal)]">
                        {activeRuntime.decision.objective}
                      </p>
                    ) : activeAssetSummary ? (
                      <p className="mt-2 text-[13px] leading-6 text-[var(--xidea-charcoal)]">
                        {activeAssetSummary.summary}
                      </p>
                    ) : null}
                  </div>
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
                  {activeAssetSummary?.assets.slice(0, 2).map((asset) => (
                    <div
                      className="rounded-[0.95rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-3"
                      key={asset.id}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-[var(--xidea-near-black)]">{asset.title}</p>
                        <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--xidea-stone)]">
                          {getAssetKindLabel(asset.kind)}
                        </span>
                      </div>
                      <p className="mt-2 text-[13px] leading-6 text-[var(--xidea-charcoal)]">
                        {asset.contentExcerpt}
                      </p>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    {(selectedUnit?.candidateModes ?? []).slice(0, 3).map((mode) => (
                      <Badge
                        className={`border px-2 py-1 text-[12px] shadow-none ${getModeBadgeClass(mode)}`}
                        key={mode}
                        variant="outline"
                      >
                        {MODE_LABELS[mode]}
                      </Badge>
                    ))}
                  </div>
                </MonitorSection>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </main>
  );
}
