import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { startTransition, useEffect, useMemo, useState, type ReactElement } from "react";
import {
  Brain,
  FileInput,
  FolderOpen,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Route,
  Target,
} from "lucide-react";
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
import { buildDefaultAgentPrompt, buildMockRuntimeSnapshot, type AgentEntryMode, type RuntimeSnapshot } from "@/domain/agent-runtime";
import { MODE_LABELS } from "@/domain/planner";
import type { LearnerProfile, LearningMode } from "@/domain/types";
import { createAgentChatTransport } from "@/lib/agent-chat-transport";
import { getAgentBaseUrl } from "@/lib/agent-client";

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
  readonly unitId: string;
  readonly title: string;
  readonly summary: string;
  readonly updatedAt: string;
  readonly status: string;
}

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

function getMessageText(message: UIMessage): string {
  const text = message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();

  return text === "" ? "当前消息没有文本内容。" : text;
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

function inferLearnerProfile(
  draftOrLatestUserInput: string,
  runtime: RuntimeSnapshot,
  fallbackProfile: LearnerProfile,
): LearnerProfile {
  const normalized = draftOrLatestUserInput.toLowerCase();

  if (
    normalized.includes("答辩") ||
    normalized.includes("评审") ||
    normalized.includes("汇报") ||
    runtime.state.transferReadiness !== null && runtime.state.transferReadiness >= 68 ||
    runtime.state.recommendedAction === "apply"
  ) {
    return learnerProfiles[2] ?? fallbackProfile;
  }

  if (
    normalized.includes("分不清") ||
    normalized.includes("混淆") ||
    normalized.includes("重排") ||
    runtime.state.confusion >= 60 ||
    runtime.state.recommendedAction === "clarify"
  ) {
    return learnerProfiles[1] ?? fallbackProfile;
  }

  return learnerProfiles[0] ?? fallbackProfile;
}

function buildGeneratedProfileSummary(
  profile: LearnerProfile,
  runtime: RuntimeSnapshot,
  latestUserInput: string,
): {
  readonly title: string;
  readonly summary: string;
  readonly evidence: ReadonlyArray<string>;
} {
  const evidence = [
    runtime.state.weakSignals[0] ?? "当前 thread 仍在积累稳定证据",
    runtime.decision.reason,
    latestUserInput === "" ? "还没有新的用户输入，先沿用当前 session 状态。" : `最近输入：${latestUserInput}`,
  ];

  return {
    title: `系统当前将学习者归为「${profile.name}」`,
    summary: `${profile.role} 系统会在后续对话里继续根据输入、诊断和状态回写动态调整这张画像。`,
    evidence,
  };
}

interface ReviewHeatmapCell {
  readonly dateKey: string;
  readonly tooltip: string;
  readonly intensity: 0 | 1 | 2 | 3 | 4;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildReviewHeatmap(
  runtime: RuntimeSnapshot,
  messageCount: number,
): ReadonlyArray<ReadonlyArray<ReviewHeatmapCell>> {
  const totalDays = 35;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastReviewedAt = runtime.state.lastReviewedAt;
  const nextReviewAt = runtime.state.nextReviewAt;
  const cells: ReviewHeatmapCell[] = [];

  for (let index = totalDays - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);

    let intensity: 0 | 1 | 2 | 3 | 4 = 0;

    if (lastReviewedAt !== null && toDateKey(date) === lastReviewedAt) {
      intensity = 4;
    } else if (nextReviewAt !== null && toDateKey(date) === nextReviewAt) {
      intensity = 1;
    } else if (index < Math.min(6, Math.max(2, messageCount))) {
      intensity = runtime.state.confusion >= 60 ? 2 : 1;
    } else if (
      runtime.state.memoryStrength < 60 &&
      index % Math.max(4, Math.round((100 - runtime.state.memoryStrength) / 10)) === 0
    ) {
      intensity = 1;
    }

    const tooltip =
      intensity === 0
        ? `${toDateKey(date)} 暂无复习动作`
        : `${toDateKey(date)} 复习活跃度 ${intensity}`;

    cells.push({
      dateKey: toDateKey(date),
      tooltip,
      intensity,
    });
  }

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
  name,
  sessionCount,
  onClick,
}: {
  active: boolean;
  name: string;
  sessionCount: number;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      className={
        active
          ? "flex w-full items-center justify-between gap-3 rounded-[1rem] border border-[var(--xidea-selection-border)] bg-[var(--xidea-white)] px-3 py-3 text-left shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xidea-selection-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xidea-parchment)]"
          : "flex w-full items-center justify-between gap-3 rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-3 text-left shadow-none transition-colors hover:border-[var(--xidea-selection-border)] hover:bg-[#fcfbf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xidea-selection-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xidea-parchment)]"
      }
      onClick={onClick}
      type="button"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={
            active
              ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.85rem] bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)]"
              : "flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.85rem] bg-[var(--xidea-parchment)] text-[var(--xidea-stone)]"
          }
        >
          <FolderOpen className="h-4 w-4" />
        </div>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{name}</p>
      </div>
      <span className="shrink-0 text-[11px] text-[var(--xidea-stone)]">{sessionCount}</span>
    </button>
  );
}

function InspectorCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactElement | ReactElement[];
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
  const [selectedProjectId, setSelectedProjectId] = useState(initialSessions[0]?.projectId ?? initialProject.id);
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessions[0]?.id ?? "");
  const [selectedEntryMode, setSelectedEntryMode] = useState<AgentEntryMode>("chat-question");
  const [selectedSourceAssetIds, setSelectedSourceAssetIds] = useState<ReadonlyArray<string>>(
    () => sourceAssets.map((asset) => asset.id),
  );
  const [draftPrompt, setDraftPrompt] = useState(() =>
    buildDefaultAgentPrompt(initialProfile, initialUnit, projectContext),
  );
  const [sessionSnapshots, setSessionSnapshots] = useState<Record<string, RuntimeSnapshot>>({});
  const [sessionMessagesById, setSessionMessagesById] = useState<Record<string, UIMessage[]>>(
    () => Object.fromEntries(initialSessions.map((session) => [session.id, []])),
  );

  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const selectedUnit =
    learningUnits.find((unit) => unit.id === selectedSession?.unitId) ?? initialUnit;
  const seedProfile = initialProfile;
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? initialProject;
  const agentBaseUrl = getAgentBaseUrl();
  const seedRuntime = buildMockRuntimeSnapshot(seedProfile, selectedUnit);
  const latestUserInput = getLatestUserDraft(
    selectedSession ? sessionMessagesById[selectedSession.id] ?? [] : [],
    draftPrompt,
  );
  const inferredProfile = inferLearnerProfile(latestUserInput, seedRuntime, initialProfile);
  const mockRuntime = buildMockRuntimeSnapshot(inferredProfile, selectedUnit);
  const activeRuntime =
    selectedSession === undefined ? mockRuntime : sessionSnapshots[selectedSession.id] ?? mockRuntime;
  const selectedProfile = inferLearnerProfile(latestUserInput, activeRuntime, initialProfile);
  const generatedProfile = buildGeneratedProfileSummary(
    selectedProfile,
    activeRuntime,
    latestUserInput,
  );
  const sessionMessageCount = selectedSession
    ? sessionMessagesById[selectedSession.id]?.length ?? 0
    : 0;
  const reviewHeatmap = buildReviewHeatmap(activeRuntime, sessionMessageCount);
  const activeSourceAssets = useMemo(
    () => sourceAssets.filter((asset) => selectedSourceAssetIds.includes(asset.id)),
    [selectedSourceAssetIds],
  );

  const transport = useMemo(
    () =>
      createAgentChatTransport({
        projectId: selectedProject.id,
        sessionId: selectedSession?.id ?? selectedProject.id,
        entryMode: selectedEntryMode,
        profile: selectedProfile,
        project: projectContext,
        sourceAssets: activeSourceAssets,
        unit: selectedUnit,
        fallbackSnapshot: activeRuntime,
        onSnapshot: (snapshot) => {
          if (selectedSession === undefined) {
            return;
          }

          setSessionSnapshots((current) => ({
            ...current,
            [selectedSession.id]: snapshot,
          }));
          setSessions((current) =>
            current.map((session) =>
              session.id === selectedSession.id
                ? {
                    ...session,
                    status: "已更新",
                    updatedAt: "刚刚",
                  }
                : session,
            ),
          );
        },
      }),
    [
      activeRuntime,
      activeSourceAssets,
      selectedEntryMode,
      selectedProfile,
      selectedProject.id,
      selectedSession,
      selectedUnit,
    ],
  );

  const { clearError, messages, sendMessage, status, error } = useChat({
    id: selectedSession?.id ?? selectedProject?.id ?? "project",
    messages: selectedSession ? sessionMessagesById[selectedSession.id] ?? [] : [],
    transport,
  });

  const errorMessage = getErrorMessage(error);

  useEffect(() => {
    setDraftPrompt(buildDefaultAgentPrompt(selectedProfile, selectedUnit, projectContext));
  }, [selectedSession?.id, selectedUnit.id]);

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
  }, [messages, selectedSession]);

  useEffect(() => {
    if (selectedSession === undefined || error === undefined) {
      return;
    }

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
  }, [error, selectedSession?.id]);

  function handleSelectProject(projectId: string): void {
    setSelectedProjectId(projectId);

    const firstProjectSession = sessions.find((session) => session.projectId === projectId);
    setSelectedSessionId(firstProjectSession?.id ?? "");
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
      unitId: selectedUnit.id,
      title: `${selectedUnit.title} / 新对话 ${nextIndex}`,
      summary: "等待本轮输入",
      updatedAt: "刚刚",
      status: "草稿",
    };

    setSessions((current) => [createdSession, ...current]);
    setSessionMessagesById((current) => ({ ...current, [createdSession.id]: [] }));
    setSelectedProjectId(targetProject.id);
    setSelectedSessionId(createdSession.id);
  }

  function handleSubmitPrompt(): void {
    if (selectedSession === undefined) {
      return;
    }

    const text = draftPrompt.trim();
    if (text === "") {
      return;
    }

    setSessions((current) =>
      current.map((session) =>
        session.id === selectedSession.id
          ? {
              ...session,
              summary: text,
              updatedAt: "刚刚",
              status: "运行中",
            }
          : session,
      ),
    );

    setDraftPrompt("");
    void sendMessage({ text });
  }

  return (
    <main className="xidea-shell min-h-screen bg-[var(--xidea-parchment)] text-[var(--xidea-near-black)]">
      <div className="relative mx-auto min-h-screen max-w-[1520px] px-3 py-3 lg:h-screen lg:min-h-0 lg:px-4 lg:py-4">
        <div className="grid items-start gap-3 lg:h-full lg:grid-cols-[280px_minmax(0,1fr)_300px] lg:items-stretch">
          <Card className="overflow-hidden rounded-[1.4rem] border-[var(--xidea-border)] bg-[#f1f0ea] shadow-none lg:h-full">
            <CardContent className="flex h-full flex-col p-3">
              <Button
                className="justify-start rounded-[0.95rem] border-[var(--xidea-charcoal)] bg-[var(--xidea-white)] px-3 text-[13px] text-[var(--xidea-near-black)] shadow-none transition-colors hover:bg-[#f8f6f1]"
                onClick={handleCreateProject}
                type="button"
                variant="outline"
              >
                <Plus className="h-4 w-4" />
                新建 project
              </Button>

              <Separator className="my-4 bg-[var(--xidea-border)]" />

              <div className="flex min-h-0 flex-1 flex-col space-y-3">
                <p className="xidea-kicker">Projects</p>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="space-y-2 pr-1">
                    {projects.map((project) => {
                      const projectSessions = sessions.filter((session) => session.projectId === project.id);
                      const activeProject = project.id === selectedProject?.id;

                      return (
                        <div key={project.id}>
                          <ProjectCard
                            active={activeProject}
                            name={project.name}
                            onClick={() => {
                              handleSelectProject(project.id);
                            }}
                            sessionCount={projectSessions.length}
                          />

                          {activeProject ? (
                            <div className="mt-2 ml-4 box-border w-[calc(100%-1rem)] border-l border-[var(--xidea-sand)] pl-3">
                              <div className="mb-2 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="xidea-kicker">Sessions</p>
                                  <span className="shrink-0 text-xs text-[var(--xidea-stone)]">
                                    {projectSessions.length}
                                  </span>
                                </div>
                                <Button
                                  className="w-full justify-start rounded-[0.9rem] px-3 text-xs shadow-none transition-colors hover:bg-[var(--xidea-white)]"
                                  onClick={() => {
                                    handleCreateSession(project.id);
                                  }}
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  新建 session
                                </Button>
                              </div>
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
                          ) : null}
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
                  {status === "streaming" || status === "submitted"
                    ? "Streaming"
                    : activeRuntime.source === "live-agent"
                      ? "Live Agent"
                      : agentBaseUrl
                        ? "Mock Fallback"
                        : "Mock Demo"}
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
                          setSelectedEntryMode(entry.id);
                          if (
                            entry.id === "material-import" &&
                            selectedSourceAssetIds.length === 0
                          ) {
                            setSelectedSourceAssetIds(sourceAssets.map((asset) => asset.id));
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
                  <div className="space-y-3 pb-4">
                    {selectedEntryMode === "material-import" ? (
                      <Card className="rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5ede9] text-[var(--xidea-terracotta)]">
                              <FileInput className="h-4 w-4" />
                            </div>
                            <div>
                              <CardTitle className="xidea-kicker text-[var(--xidea-stone)]">材料进入</CardTitle>
                              <CardDescription className="text-sm text-[var(--xidea-stone)]">
                                先告诉系统这轮要读哪几份材料，再决定如何编排学习动作。
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid gap-3 lg:grid-cols-2">
                            {sourceAssets.map((asset) => {
                              const selected = selectedSourceAssetIds.includes(asset.id);

                              return (
                                <button
                                  className={
                                    selected
                                      ? "rounded-[1rem] border border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] px-4 py-4 text-left transition-colors"
                                      : "rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-parchment)] px-4 py-4 text-left transition-colors hover:border-[var(--xidea-selection-border)] hover:bg-[#f8f2ee]"
                                  }
                                  key={asset.id}
                                  onClick={() => {
                                    setSelectedSourceAssetIds((current) =>
                                      current.includes(asset.id)
                                        ? current.filter((id) => id !== asset.id)
                                        : [...current, asset.id],
                                    );
                                  }}
                                  type="button"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                                      {asset.title}
                                    </p>
                                    <Badge
                                      className="border-[var(--xidea-border)] bg-[var(--xidea-white)] text-[var(--xidea-stone)] shadow-none"
                                      variant="outline"
                                    >
                                      {getAssetKindLabel(asset.kind)}
                                    </Badge>
                                  </div>
                                  <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">
                                    {asset.topic}
                                  </p>
                                </button>
                              );
                            })}
                          </div>

                          <div className="rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4 text-sm leading-7 text-[var(--xidea-charcoal)]">
                            {activeSourceAssets.length > 0
                              ? `这轮会把 ${activeSourceAssets.length} 份材料带入 agent：${activeSourceAssets
                                  .map((asset) => asset.title)
                                  .join(" / ")}`
                              : "先选择至少一份材料，再让系统基于材料决定下一步训练动作。"}
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}

                    {selectedSession === undefined ? (
                      <Card className="rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                        <CardHeader className="pb-3">
                          <CardTitle className="xidea-kicker text-[var(--xidea-stone)]">当前 project</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm leading-7 text-[var(--xidea-charcoal)]">
                          <p>这个 project 还没有 session。</p>
                          <p>先在左侧当前 project 下新建 session，再开始这一轮 agent 运行。</p>
                        </CardContent>
                      </Card>
                    ) : messages.length === 0 ? (
                      <>
                        <Card className="rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                          <CardHeader className="pb-3">
                            <CardTitle className="xidea-kicker text-[var(--xidea-stone)]">当前输入</CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm leading-7 text-[var(--xidea-charcoal)]">
                            {draftPrompt.trim() || "输入为空。"}
                          </CardContent>
                        </Card>
                        <Card className="rounded-[1.2rem] border-[#ebd5cc] bg-[#f5ede9] shadow-none">
                          <CardHeader className="pb-3">
                            <CardTitle className="xidea-kicker text-[var(--xidea-selection-text)]">系统判断</CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm leading-7 text-[var(--xidea-charcoal)]">
                            {activeRuntime.decision.reason}
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      messages.map((message) => (
                        <Card
                          className={
                            message.role === "assistant"
                              ? "rounded-[1.2rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] shadow-none"
                              : "rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none"
                          }
                          key={message.id}
                        >
                          <CardHeader className="pb-3">
                            <CardTitle
                              className={
                                message.role === "assistant"
                                  ? "xidea-kicker text-[var(--xidea-selection-text)]"
                                  : "xidea-kicker text-[var(--xidea-stone)]"
                              }
                            >
                              {message.role === "assistant" ? "当前动作" : "当前输入"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm leading-7 text-[var(--xidea-charcoal)]">
                            {getMessageText(message)}
                          </CardContent>
                        </Card>
                      ))
                    )}

                    <Card className="rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5ede9] text-[var(--xidea-terracotta)]">
                            <Route className="h-4 w-4" />
                          </div>
                          <div>
                            <CardTitle className="xidea-kicker text-[var(--xidea-stone)]">下一步路径</CardTitle>
                            <CardDescription className="text-sm text-[var(--xidea-stone)]">
                              由当前 runtime 决定的前三步。
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {activeRuntime.plan.steps.slice(0, 3).map((step, index) => (
                          <div
                            className="flex items-start gap-4 rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4"
                            key={step.id}
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eadfd7] text-sm font-medium text-[var(--xidea-selection-text)]">
                              {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-[var(--xidea-near-black)]">{step.title}</p>
                                <Badge
                                  className={`border shadow-none ${getModeBadgeClass(step.mode)}`}
                                  variant="outline"
                                >
                                  {MODE_LABELS[step.mode]}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">{step.reason}</p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                      <CardHeader className="gap-3 pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <CardTitle className="xidea-kicker text-[var(--xidea-stone)]">编排证据链</CardTitle>
                            <CardDescription className="text-sm text-[var(--xidea-stone)]">
                              把当前诊断、动作依据和状态回写默认展开。
                            </CardDescription>
                          </div>
                          {activeRuntime.decision.confidence !== null ? (
                            <Badge
                              className="border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] text-[var(--xidea-selection-text)] shadow-none"
                              variant="outline"
                            >
                              置信度 {(activeRuntime.decision.confidence * 100).toFixed(0)}%
                            </Badge>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 lg:grid-cols-3">
                          {activeRuntime.signalCards.map((signal) => (
                            <Card
                              className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none"
                              key={signal.id}
                            >
                              <CardContent className="space-y-2 p-4">
                                <p className="xidea-kicker text-[var(--xidea-selection-text)]">
                                  {signal.label}
                                </p>
                                <p className="text-sm font-medium leading-6 text-[var(--xidea-near-black)]">
                                  {signal.observation}
                                </p>
                                <p className="text-sm leading-7 text-[var(--xidea-charcoal)]">
                                  {signal.implication}
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        <div className="rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4">
                          <p className="xidea-kicker text-[var(--xidea-stone)]">为什么是这个动作</p>
                          <div className="mt-3 space-y-2">
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
                        </div>

                        <div className="rounded-[1rem] bg-[var(--xidea-parchment)] px-4 py-4">
                          <p className="xidea-kicker text-[var(--xidea-stone)]">状态回写预览</p>
                          <div className="mt-3 space-y-3">
                            {activeRuntime.writeback.map((item) => (
                              <div
                                className="rounded-[0.9rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] px-4 py-3"
                                key={item.id}
                              >
                                <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                                  {item.target}
                                </p>
                                <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">
                                  {item.change}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </div>

              <div className="shrink-0 border-t border-[var(--xidea-border)] px-5 py-4 lg:px-6">
                <Card className="rounded-[1.2rem] border-[var(--xidea-border)] bg-[var(--xidea-white)] shadow-none">
                  <CardContent className="p-4">
                    <div className="relative">
                      <Textarea
                        className="min-h-28 rounded-[1rem] border-[var(--xidea-sand)] bg-[var(--xidea-ivory)] pr-28 pb-12 text-sm leading-7 text-[var(--xidea-charcoal)] shadow-none focus-visible:ring-[var(--xidea-selection-border)]"
                        onChange={(event) => {
                          if (error !== undefined) {
                            clearError();
                          }
                          setDraftPrompt(event.target.value);
                        }}
                        placeholder={
                          selectedEntryMode === "material-import"
                            ? "补一句你希望系统围绕这些材料先判断什么、澄清什么，或生成什么训练动作。"
                            : "输入这一轮你想推进的问题或材料。"
                        }
                        value={draftPrompt}
                      />

                      <Button
                        className="absolute right-3 bottom-3 rounded-full bg-[var(--xidea-terracotta)] px-4 text-[var(--xidea-ivory)] hover:bg-[var(--xidea-terracotta)]/90"
                        disabled={
                          selectedSession === undefined ||
                          (selectedEntryMode === "material-import" &&
                            activeSourceAssets.length === 0) ||
                          status === "submitted" ||
                          status === "streaming" ||
                          agentBaseUrl === null
                        }
                        onClick={handleSubmitPrompt}
                        type="button"
                      >
                        {status === "submitted" || status === "streaming" ? "运行中..." : "发送"}
                      </Button>
                    </div>

                    {errorMessage ? (
                      <Card className="mt-4 rounded-[1rem] border-[#ebd5cc] bg-[#f9efea] shadow-none">
                        <CardContent className="px-4 py-3 text-sm leading-6 text-[var(--xidea-selection-text)]">
                          {errorMessage}
                        </CardContent>
                      </Card>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <div className="min-h-0 lg:h-full">
            <ScrollArea className="h-full pr-1">
              <div className="flex flex-col gap-3 pb-1">
                <InspectorCard description="由当前对话、诊断和状态信号动态生成。" title="学习画像">
                  <Card className="rounded-[1rem] border-[var(--xidea-selection-border)] bg-[var(--xidea-selection)] shadow-none">
                    <CardContent className="space-y-3 p-4">
                      <p className="text-sm font-medium text-[var(--xidea-near-black)]">
                        {generatedProfile.title}
                      </p>
                      <p className="text-sm leading-7 text-[var(--xidea-charcoal)]">
                        {generatedProfile.summary}
                      </p>
                    </CardContent>
                  </Card>
                  <div className="space-y-2">
                    {generatedProfile.evidence.map((item, index) => (
                      <div
                        className="flex items-start gap-3 rounded-[0.95rem] bg-[var(--xidea-parchment)] px-4 py-3 text-sm leading-7 text-[var(--xidea-charcoal)]"
                        key={`${item}-${index}`}
                      >
                        <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--xidea-terracotta)]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </InspectorCard>

                <InspectorCard description="由当前 runtime 回写出来的学习状态。" title="学习状态">
                  <div className="flex flex-wrap gap-2">
                    {metricCopy.map((metric) => (
                      <Badge
                        className="rounded-full border-[var(--xidea-border)] bg-[var(--xidea-white)] px-3 py-2 text-sm font-medium text-[var(--xidea-charcoal)] shadow-none"
                        key={metric.key}
                        variant="outline"
                      >
                        <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${getMetricDotClass(metric.tone)}`} />
                        {metric.label} {activeRuntime.state[metric.key] === null ? "--" : `${activeRuntime.state[metric.key]}%`}
                      </Badge>
                    ))}
                  </div>
                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                    <CardContent className="p-4 text-sm leading-7 text-[var(--xidea-charcoal)]">
                      {activeRuntime.stateSource}
                    </CardContent>
                  </Card>
                </InspectorCard>

                <InspectorCard description="当前复习节点和弱信号。" title="复习系统">
                  <div className="grid gap-3">
                    <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                      <CardContent className="p-4">
                        <p className="text-sm text-[var(--xidea-stone)]">最近复盘</p>
                        <p className="mt-2 text-sm font-medium text-[var(--xidea-near-black)]">
                          {activeRuntime.state.lastReviewedAt ?? "未记录"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                      <CardContent className="p-4">
                        <p className="text-sm text-[var(--xidea-stone)]">下一次提醒</p>
                        <p className="mt-2 text-sm font-medium text-[var(--xidea-near-black)]">
                          {activeRuntime.state.nextReviewAt ?? "待本轮决定"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeRuntime.state.weakSignals.map((signal) => (
                      <Badge
                        className="border-[var(--xidea-sand)] bg-[var(--xidea-ivory)] px-3 py-2 text-sm text-[var(--xidea-charcoal)] shadow-none"
                        key={signal}
                        variant="outline"
                      >
                        {signal}
                      </Badge>
                    ))}
                  </div>
                  <div className="rounded-[1rem] border border-[var(--xidea-border)] bg-[var(--xidea-white)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[var(--xidea-near-black)]">复习热力图</p>
                      <span className="text-xs text-[var(--xidea-stone)]">最近 5 周</span>
                    </div>
                    <div className="mt-4 grid grid-cols-5 gap-2">
                      {reviewHeatmap.map((week, weekIndex) => (
                        <div className="grid grid-rows-7 gap-2" key={`week-${weekIndex}`}>
                          {week.map((cell) => (
                            <div
                              className={`h-4 w-full rounded-[4px] ${getHeatmapCellClass(cell.intensity)}`}
                              key={cell.dateKey}
                              title={cell.tooltip}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--xidea-stone)]">
                      <span>低</span>
                      <span>高</span>
                    </div>
                  </div>
                </InspectorCard>

                <InspectorCard description="项目上下文和当前主训练动作。" title="项目面板">
                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-[var(--xidea-near-black)]">{selectedProject.name}</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">
                        当前 project 下共有 {sessions.filter((session) => session.projectId === selectedProject.id).length} 个 session。
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-[var(--xidea-terracotta)]" />
                        <p className="text-sm font-medium text-[var(--xidea-near-black)]">{activeRuntime.decision.title}</p>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">{activeRuntime.decision.objective}</p>
                    </CardContent>
                  </Card>

                  <div className="flex flex-wrap gap-2">
                    {selectedUnit.candidateModes.map((mode) => (
                      <Badge className={`border shadow-none ${getModeBadgeClass(mode)}`} key={mode} variant="outline">
                        {MODE_LABELS[mode]}
                      </Badge>
                    ))}
                  </div>

                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-[var(--xidea-terracotta)]" />
                        <p className="text-sm font-medium text-[var(--xidea-near-black)]">当前材料</p>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">
                        {selectedEntryMode === "material-import"
                          ? activeSourceAssets.length > 0
                            ? `当前已选中 ${activeSourceAssets.length} 份材料：${activeSourceAssets
                                .map((asset) => asset.title)
                                .join(" / ")}`
                            : "当前还没有选中材料。"
                          : `${sourceAssets.length} 份材料已接入当前项目线程，默认按相关性带入。`}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[1rem] border-[var(--xidea-border)] bg-[var(--xidea-parchment)] shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <RefreshCcw className="h-4 w-4 text-[var(--xidea-terracotta)]" />
                        <p className="text-sm font-medium text-[var(--xidea-near-black)]">状态回写</p>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-[var(--xidea-charcoal)]">
                        {activeRuntime.writeback[0]?.change ?? "本轮结果会写回 learner state 和 review engine。"}
                      </p>
                    </CardContent>
                  </Card>
                </InspectorCard>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </main>
  );
}
